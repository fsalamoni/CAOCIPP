// ============================================================================
// Ritos da Secretaria Processual: conversão de/para planilha e diagrama
// (Mermaid), modelos prontos e posições do diagrama do fluxo. Lógica pura,
// testada em src/lib/secretariaRito.test.js (npm run test:lib).
//
// Uma fase é { id, nome, prazo_dias?, orientacao?, proximas?: id[] }.
// Sem `proximas`, a fase segue para a seguinte da lista. O servidor revalida
// tudo (sanitizeRito); aqui é só conveniência para quem configura.
// ============================================================================

let seq = 0;
/** Id provisório de fase; o servidor transforma em slug e mantém as referências. */
export const novoIdFase = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Fase de espera (ex.: diligência externa): o processo entra nela por uma
 * saída escrita de outra fase e volta para a fase de onde veio. Nunca é a
 * primeira nem a final (o servidor descarta a marca nesses casos).
 */
export const ehEspera = (fases, i) => i > 0 && fases[i]?.espera === true && !fases[i].final;

/** Quem não escreveu saídas segue para a próxima da lista que não é de espera. */
const seguinteDaLista = (fases, i) => {
    const k = fases.findIndex((x, j) => j > i && !ehEspera(fases, j));
    return k < 0 ? [] : [fases[k].id];
};

/** Fases que levam a uma fase de espera: é para uma delas que o processo volta. */
export function origensDaEspera(fases, id) {
    return fases.filter((x, k) => x.id !== id && !x.final && !ehEspera(fases, k) && (x.proximas || []).includes(id)).map((x) => x.id);
}

/**
 * Seguintes efetivas de cada fase (as explícitas ou a próxima da lista). A
 * fase de espera "segue" para as fases que levam a ela (a volta).
 */
export function seguintes(fases, i) {
    const f = fases[i];
    if (f?.final) return [];
    if (ehEspera(fases, i)) return origensDaEspera(fases, f.id);
    if (f?.proximas?.length) return f.proximas.filter((id) => fases.some((x) => x.id === id));
    return seguinteDaLista(fases, i);
}

/**
 * Saídas do processo agora, como o servidor entende: `caminho` (as fases do
 * rito, sem as de espera), `esperas` (fases de espera a que a atual leva) e
 * `volta` (em fase de espera: a fase de onde o processo veio).
 */
export function saidasDoProcesso(p) {
    const fases = p?.fases || [];
    const i = fases.findIndex((f) => f.id === p?.fase_atual);
    const fase = (id) => fases.find((f) => f.id === id);
    if (i < 0) return { caminho: [], esperas: [], volta: null };
    if (ehEspera(fases, i)) {
        const volta = fase(p.espera?.fase) || null;
        return { caminho: volta ? [volta] : [], esperas: [], volta };
    }
    const todas = seguintes(fases, i).map(fase).filter(Boolean);
    const deEspera = (f) => ehEspera(fases, fases.indexOf(f));
    return { caminho: todas.filter((f) => !deEspera(f)), esperas: todas.filter(deEspera), volta: null };
}

/** Saídas como o servidor vai gravar (sem a própria fase e sem as que não existem; vazio = a seguinte da lista). */
function saidasGravadas(fases, i, ids) {
    const f = fases[i];
    if (f.final) return [];
    if (ehEspera(fases, i)) return origensDaEspera(fases, f.id);
    const p = (f.proximas || []).filter((id) => id !== f.id && ids.has(id));
    return p.length ? p : seguinteDaLista(fases, i);
}

/**
 * Fases que nenhum caminho alcança a partir da primeira (`soltas`) e as que,
 * alcançadas, nunca chegam ao fim (`presas`: ciclo sem saída). Fim = fase sem
 * saída (final ou a última sem encaminhamento).
 */
export function problemasDoFluxo(fases) {
    const ids = new Set(fases.map((f) => f.id));
    const pos = new Map(fases.map((f, i) => [f.id, i]));
    const saidas = fases.map((_, i) => saidasGravadas(fases, i, ids));
    const alcancadas = new Set();
    const fila = fases.length ? [0] : [];
    while (fila.length) {
        const i = fila.pop();
        if (alcancadas.has(i)) continue;
        alcancadas.add(i);
        saidas[i].forEach((id) => fila.push(pos.get(id)));
    }
    // De trás para a frente: quem chega a uma fase de fim.
    const chegam = new Set(fases.map((_, i) => i).filter((i) => !saidas[i].length));
    for (let mudou = true; mudou;) {
        mudou = false;
        saidas.forEach((s, i) => { if (!chegam.has(i) && s.some((id) => chegam.has(pos.get(id)))) { chegam.add(i); mudou = true; } });
    }
    return {
        soltas: fases.filter((_, i) => i > 0 && !alcancadas.has(i)).map((f) => f.id),
        presas: fases.filter((_, i) => alcancadas.has(i) && !chegam.has(i)).map((f) => f.id),
    };
}

/**
 * Cópias das fases com ids novos. Saídas, condições e certidão conjunta entre
 * as copiadas passam para as cópias; as que apontam para fora só ficam se a
 * fase de destino estiver em `validos` (ids do rito que recebe as cópias).
 * `origem`: o rito inteiro de onde vêm, para a saída implícita ("a seguinte da
 * lista") virar explícita antes de copiar. A cópia que perde todas as saídas
 * vira final (marcada em `sem_saida`), em vez de seguir sozinha para a fase
 * que vier depois dela.
 */
export function copiarFases(fases, validos = new Set(), origem = null) {
    const mapa = new Map(fases.map((f) => [f.id, novoIdFase()]));
    const novo = (id) => mapa.get(id) || (validos.has(id) ? id : null);
    const ids = origem ? new Set(origem.map((f) => f.id)) : null;
    return fases.map((f) => {
        const c = JSON.parse(JSON.stringify(f));
        c.id = mapa.get(f.id);
        const i = origem ? origem.findIndex((x) => x.id === f.id) : -1;
        // Fase de espera não tem saída própria: volta para quem levar a ela no rito que a recebe.
        const espera = c.espera === true && !c.final;
        const antes = espera ? [] : i >= 0 ? saidasGravadas(origem, i, ids) : (c.proximas || []);
        if (espera) delete c.proximas;
        else if (i >= 0 || c.proximas) c.proximas = antes.map(novo).filter(Boolean);
        if (!c.final && antes.length && !c.proximas.length) { c.final = true; c.sem_saida = true; }
        if (c.condicoes) c.condicoes = Object.fromEntries(Object.entries(c.condicoes).map(([k, v]) => [novo(k), v]).filter(([k]) => k));
        if (c.condicoes_regra) {
            c.condicoes_regra = Object.fromEntries(Object.entries(c.condicoes_regra).map(([k, v]) => [novo(k), v]).filter(([k]) => k && c.proximas?.includes(k)));
            if (!Object.keys(c.condicoes_regra).length) delete c.condicoes_regra;
        }
        if (c.certidao?.grupo) {
            const { grupo, ...resto } = c.certidao;
            const g = novo(grupo);
            c.certidao = g ? { ...resto, grupo: g } : resto;
            if (!Object.keys(c.certidao).length) delete c.certidao;
        }
        return c;
    });
}

/** Remove `proximas` que só repetem o fluxo linear, para o rito ficar simples. */
export function simplificar(fases) {
    return fases.map((f, i) => {
        const linear = seguinteDaLista(fases, i);
        const p = (f.proximas || []).filter((id) => id !== f.id && fases.some((x) => x.id === id));
        const igual = p.length === linear.length && p.every((id, k) => id === linear[k]);
        const { proximas: _p, final, ...resto } = f;
        if (final) return i < fases.length - 1 ? { ...resto, final: true } : resto;
        if (ehEspera(fases, i)) return resto;
        // Saída com condição escrita fica explícita, mesmo sendo a seguinte da lista.
        const temCondicao = Object.keys(resto.condicoes || {}).length > 0 || Object.keys(resto.condicoes_regra || {}).length > 0;
        return (igual && !temCondicao) || p.length === 0 ? resto : { ...resto, proximas: p };
    });
}

// ---- Planilha ---------------------------------------------------------------

const COLUNAS = {
    nome: ['fase', 'nome', 'etapa', 'nome da fase'],
    prazo: ['prazo', 'prazo (dias)', 'prazo dias', 'dias'],
    proximas: ['proximas', 'proximas fases', 'segue para', 'proxima', 'proxima fase', 'destino'],
    orientacao: ['orientacao', 'descricao', 'instrucoes', 'observacao', 'o que fazer'],
};

/**
 * Lê as linhas de uma planilha (matriz de células). Aceita cabeçalho com os
 * nomes de COLUNAS em qualquer ordem; sem cabeçalho, a ordem é
 * Fase | Prazo | Próximas | Orientação. "Próximas" pode citar o nome da fase
 * ou o número da linha, separados por vírgula, ponto e vírgula ou barra.
 */
export function ritoDeTabela(linhas) {
    const rows = (linhas || []).map((r) => (r || []).map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
    if (!rows.length) return { fases: [], avisos: ['A planilha está vazia'] };
    const cab = rows[0].map(sem);
    const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, cab.findIndex((c) => nomes.includes(c))]));
    const temCab = idx.nome >= 0;
    const col = temCab ? idx : { nome: 0, prazo: 1, proximas: 2, orientacao: 3 };
    const dados = (temCab ? rows.slice(1) : rows).filter((r) => r[col.nome]);
    const fases = dados.map((r) => {
        const prazo = parseInt(r[col.prazo] ?? '', 10);
        return {
            id: novoIdFase(),
            nome: r[col.nome],
            ...(prazo > 0 ? { prazo_dias: prazo } : {}),
            ...(col.orientacao >= 0 && r[col.orientacao] ? { orientacao: r[col.orientacao] } : {}),
            _prox: col.proximas >= 0 ? r[col.proximas] || '' : '',
        };
    });
    const avisos = [];
    const porNome = new Map(fases.map((f) => [sem(f.nome), f.id]));
    for (const f of fases) {
        if (/^(fim|final|encerra|-)$/.test(sem(f._prox))) { f.final = true; delete f._prox; continue; }
        const refs = f._prox.split(/[;,/\n]|\s+e\s+/).map((s) => s.trim()).filter(Boolean);
        f.proximas = refs.map((ref) => {
            const n = Number(ref);
            const id = Number.isInteger(n) && fases[n - 1] ? fases[n - 1].id : porNome.get(sem(ref));
            if (!id) avisos.push(`"${f.nome}" segue para "${ref}", que não está na planilha`);
            return id;
        }).filter(Boolean);
        delete f._prox;
    }
    return { fases: simplificar(fases), avisos };
}

/** Quantas etapas faltam, no caminho mais curto, até o fim do rito (null se a fase não existe). */
export function etapasAteOFim(fases, atualId) {
    const i0 = fases.findIndex((f) => f.id === atualId);
    if (i0 < 0) return null;
    const dist = new Map([[atualId, 0]]);
    const fila = [atualId];
    while (fila.length) {
        const id = fila.shift();
        const i = fases.findIndex((f) => f.id === id);
        const prox = seguintes(fases, i);
        if (prox.length === 0) return dist.get(id);
        for (const n of prox) if (!dist.has(n)) { dist.set(n, dist.get(id) + 1); fila.push(n); }
    }
    return null;
}

/** Linhas para exportar (com cabeçalho), citando as próximas pelo nome. */
export function ritoParaTabela(fases) {
    const nome = (id) => fases.find((f) => f.id === id)?.nome || id;
    return [
        ['Fase', 'Prazo (dias)', 'Próximas fases', 'Orientação'],
        ...fases.map((f) => [f.nome, f.prazo_dias || '', f.final ? 'Fim' : (f.proximas || []).map(nome).join('; '), f.orientacao || '']),
    ];
}

// ---- Diagrama (Mermaid flowchart) ------------------------------------------

const NO = /([A-Za-z0-9_À-ſ]+)\s*(\(\(.+?\)\)|\[\[.+?\]\]|\[\(.+?\)\]|\[.+?\]|\(.+?\)|\{.+?\}|>.+?\])?/y;
const SETA = /\s*(?:--\s*[^->|]+?\s*-->|-->|---|-\.->|==>|-\.-|--o|--x)\s*(?:\|[^|]*\|)?\s*/y;

function rotulo(bruto) {
    return bruto.replace(/^(\(\(|\[\[|\[\(|\[|\(|\{|>)/, '').replace(/(\)\)|\]\]|\)\]|\]|\)|\})$/, '').replace(/^["']|["']$/g, '').trim();
}

/**
 * Lê um fluxograma Mermaid ("flowchart TD" ou "graph LR"), como o que sai do
 * mermaid.live, draw.io (Arrange > Insert > Advanced > Mermaid) ou de uma IA.
 * Cada nó vira uma fase, na ordem em que aparece; cada seta, uma "próxima".
 */
export function ritoDeMermaid(texto) {
    const nos = new Map(); // chave -> {id, nome, saidas[]}
    const avisos = [];
    const no = (chave, bruto) => {
        if (!nos.has(chave)) nos.set(chave, { id: novoIdFase(), nome: chave, saidas: [] });
        if (bruto) {
            // "Análise - 10 dias" ou "Análise (10 dias)" leva o prazo junto.
            const r = rotulo(bruto);
            const m = r.match(/^(.+?)\s*(?:[-–:]\s*|\()(\d{1,4})\s*dias?\)?$/i);
            nos.get(chave).nome = (m ? m[1] : r) || chave;
            if (m) nos.get(chave).prazo_dias = Number(m[2]);
        }
        return nos.get(chave);
    };
    for (const linhaBruta of String(texto || '').split(/\n|;/)) {
        const linha = linhaBruta.replace(/%%.*$/, '').trim();
        if (!linha || /^(flowchart|graph|subgraph|end$|classDef|class |style |linkStyle|click |direction)/i.test(linha)) continue;
        let pos = 0;
        let anterior = null;
        while (pos < linha.length) {
            NO.lastIndex = pos;
            const m = NO.exec(linha);
            if (!m) { avisos.push(`Linha ignorada: ${linha}`); break; }
            const atual = no(m[1], m[2]);
            if (anterior && !anterior.saidas.includes(atual)) anterior.saidas.push(atual);
            pos = NO.lastIndex;
            SETA.lastIndex = pos;
            const s = SETA.exec(linha);
            if (!s) {
                if (linha.slice(pos).trim()) avisos.push(`Trecho ignorado: ${linha.slice(pos).trim()}`);
                break;
            }
            anterior = atual;
            pos = SETA.lastIndex;
        }
    }
    const lista = [...nos.values()];
    // Nó sem saída no meio da lista é fim de fluxo (ex.: "Arquivamento" num ramo).
    const fases = lista.map((n, i) => ({
        id: n.id, nome: n.nome, ...(n.prazo_dias ? { prazo_dias: n.prazo_dias } : {}), proximas: n.saidas.map((s) => s.id).filter((id) => id !== n.id),
        ...(n.saidas.length === 0 && i < lista.length - 1 ? { final: true } : {}),
    }));
    return { fases: simplificar(fases), avisos };
}

export function ritoParaMermaid(fases) {
    const chave = (i) => `F${i + 1}`;
    const pos = new Map(fases.map((f, i) => [f.id, i]));
    const esc = (s) => String(s).replace(/["[\]{}()]/g, ' ').trim();
    const linhas = ['flowchart TD'];
    fases.forEach((f, i) => linhas.push(`    ${chave(i)}[${esc(f.nome)}${f.prazo_dias ? ` - ${f.prazo_dias} dias` : ''}]`));
    fases.forEach((f, i) => seguintes(fases, i).forEach((id) => linhas.push(`    ${chave(i)} --> ${chave(pos.get(id))}`)));
    return linhas.join('\n');
}

// ---- Diagrama na tela -------------------------------------------------------

/**
 * Linha (nível) de cada fase no diagrama: o caminho mais longo desde a
 * primeira, ignorando as voltas (setas para uma fase anterior no percurso).
 * Assim uma fase que encerra vários ramos fica abaixo de todos eles. Fases
 * inalcançáveis vão para depois da última linha, para continuarem visíveis.
 */
export function niveisDoFluxo(fases) {
    const nivel = new Map();
    if (!fases.length) return nivel;
    const idx = new Map(fases.map((f, i) => [f.id, i]));
    // A volta da fase de espera não conta para a posição: ela fica depois de quem leva a ela.
    const saidas = new Map(fases.map((f, i) => [f.id, ehEspera(fases, i) ? [] : seguintes(fases, i)]));
    // 1) Voltas: arestas para um nó ainda na pilha da busca em profundidade.
    const avante = new Map(fases.map((f) => [f.id, []]));
    const estado = new Map(); // 1 = na pilha, 2 = concluído
    const visitar = (id) => {
        estado.set(id, 1);
        for (const p of saidas.get(id)) {
            if (estado.get(p) === 1) continue; // volta
            avante.get(id).push(p);
            if (!estado.has(p)) visitar(p);
        }
        estado.set(id, 2);
    };
    visitar(fases[0].id);
    // 2) Caminho mais longo no grafo sem voltas (ordem topológica pela lista).
    const entradas = new Map(fases.map((f) => [f.id, 0]));
    for (const [id, ps] of avante) if (estado.has(id)) ps.forEach((p) => entradas.set(p, entradas.get(p) + 1));
    const fila = [fases[0].id];
    nivel.set(fases[0].id, 0);
    while (fila.length) {
        const id = fila.shift();
        for (const p of avante.get(id)) {
            nivel.set(p, Math.max(nivel.get(p) ?? 0, nivel.get(id) + 1));
            entradas.set(p, entradas.get(p) - 1);
            if (entradas.get(p) === 0) fila.push(p);
        }
    }
    let max = Math.max(...nivel.values());
    for (const f of [...fases].sort((a, b) => idx.get(a.id) - idx.get(b.id))) if (!nivel.has(f.id)) nivel.set(f.id, ++max);
    return nivel;
}

// ---- Modelos prontos --------------------------------------------------------

const modelo = (nome, descricao, itens) => {
    const ids = itens.map(() => novoIdFase());
    return {
        nome, descricao,
        fases: simplificar(itens.map(([n, prazo, prox, orientacao], i) => ({
            id: ids[i], nome: n, ...(prazo ? { prazo_dias: prazo } : {}), ...(orientacao ? { orientacao } : {}),
            ...(prox === 'fim' ? { final: true } : prox ? { proximas: prox.map((k) => ids[k]) } : {}),
        }))),
    };
};

/**
 * Rito Consultas CAOCIPP: exemplo completo de rito em fases, ações e desvios,
 * com o que o editor oferece: formulário na folha de dados, ação que só vale
 * em alguns casos, fase que segue sozinha, situação da consulta ligada, fase
 * de espera, botão Finalizar e arquivamento ao entrar. `unidade` é o NOME da
 * unidade: a tela casa com as do órgão ou propõe criar (`vincularProposta`).
 * O servidor aceita o modelo inteiro (functions-v2/test/modeloConsultas.test.js).
 */
export function ritoConsultas() {
    const [rec, ana, rev, dev, arq, dil] = Array.from({ length: 6 }, () => novoIdFase());
    // Fase só de trabalho interno: nada dela vira termo nos autos (sai na impressão interna, por seleção).
    const interno = { fase: 'informacao', remessas: 'informacao', outros: { prazo: 'informacao', pendencia: 'informacao', urgencia: 'informacao', dados: 'informacao', atribuicao: 'informacao' } };
    const foraDoSim = { acao: 0, campo: 'sistema', valores: ['SPU', 'E-mail', 'Whatsapp', 'Outros'] };
    const consulta = (ao_entrar, ao_assumir) => ({ modulo: 'consultas', ao_entrar, ...(ao_assumir ? { ao_assumir } : {}) });
    // Dado obrigatório que fica só no sistema; com `folha_dados`, completa a folha do evento 1 no PDF.
    const dado = { obrigatoria: true, destino: 'informacao' };
    const texto = (id, rotulo, obrigatorio = true) => ({ id, rotulo, tipo: 'texto', obrigatorio });
    const data = (id, rotulo) => ({ id, rotulo, tipo: 'data', obrigatorio: true });
    return {
        nome: 'Rito Consultas CAOCIPP',
        descricao: 'Consulta recebida pela Secretaria, analisada pela Assessoria, revisada pelo Gabinete, devolvida e arquivada, com espera por diligências externas.',
        fases: [
            {
                id: rec, nome: 'Recebimento', unidade: 'Secretaria', avanco: 'auto',
                orientacao: 'Registrar a consulta que chegou. Os dados básicos, o número do PGEA e a comunicação ao solicitante completam a folha de dados (evento 1). Salvas as observações, o processo segue sozinho para a Análise.',
                acoes: [
                    'Registrar os dados básicos da consulta',
                    'Registrar a solicitação administrativa no SIM e converter em PGEA',
                    'Registrar o número do PGEA',
                    'Informar ao solicitante que a resposta virá pelo PGEA',
                    'Juntar cópia da comunicação ao solicitante',
                    'Fazer a análise superficial da consulta',
                    'Registrar as observações da análise superficial',
                ],
                acoes_regras: [
                    { ...dado, pede: 'formulario', folha_dados: true, campos: [
                        texto('orgao', 'Órgão solicitante'), data('chegada', 'Data de chegada no CAOCIPP'), texto('assunto', 'Assunto da consulta'), texto('local', 'Local dos fatos', false),
                        { id: 'sistema', rotulo: 'Sistema utilizado pelo solicitante', tipo: 'lista', obrigatorio: true, opcoes: ['SIM', 'SPU', 'E-mail', 'Whatsapp', 'Outros'] },
                    ] },
                    { obrigatoria: true, destino: 'nenhum', se: foraDoSim, ajuda: 'Feito no SIM. Aqui é só marcar: não gera evento.' },
                    { ...dado, pede: 'texto', rotulo: 'Número do PGEA', folha_dados: true, ajuda: 'O que veio pelo SIM ou o que foi gerado na conversão.' },
                    { ...dado, pede: 'formulario', folha_dados: true, se: foraDoSim, campos: [data('data', 'Data da comunicação'), texto('meio', 'Meio utilizado')] },
                    { documento: { forma: 'qualquer', nivel: 'opcional' }, se: foraDoSim, ajuda: 'Se quiser guardar a cópia nos autos, junte antes de salvar as observações.' },
                    { pede: 'orientacao', ajuda: 'Ver se há questão técnico-jurídica, se a pergunta é genérica, se traz a íntegra de procedimentos ou se a matéria é de outro órgão.' },
                    { pede: 'texto_longo', rotulo: 'Observações', obrigatoria: true, destino: 'nenhum', ajuda: 'Só a equipe vê; não gera evento. Sem nada a observar, escreva "Sem observações".' },
                ],
            },
            {
                id: ana, nome: 'Análise', unidade: 'Assessoria', proximas: [rev, dil],
                condicoes: { [rev]: 'minuta pronta', [dil]: 'depende de terceiros' },
                situacao_registro: consulta('Pendente', 'Em elaboração'), registro_atos: interno,
                orientacao: 'A consulta fica Pendente até um assessor assumir o processo. Nada desta fase entra nos autos: minutas, anexos e registros ficam com a equipe e saem na impressão interna, por seleção.',
                acoes: ['Assumir o processo', 'Redigir ou anexar a minuta do parecer', 'Anexar outros documentos, se houver', 'Encaminhar ao Gabinete'],
                acoes_regras: [
                    { pede: 'orientacao', ajuda: 'Pelo botão Assumir. Quem assumiu e quando ficam só no sistema, e a consulta passa a Em elaboração.' },
                    { ...dado, ajuda: 'Crie a minuta com o tipo Parecer e deixe como minuta: quem junta aos autos é o Gabinete, na revisão.' },
                    { pede: 'orientacao', ajuda: 'Também como minuta. O Gabinete decide na revisão o que entra nos autos.' },
                    { pede: 'orientacao', ajuda: 'Em Concluir e seguir, marque as minutas e os anexos que vão com o processo.' },
                ],
            },
            {
                id: rev, nome: 'Revisão', unidade: 'Gabinete', proximas: [dev, dil], juntada_conjunta: true,
                condicoes: { [dev]: 'parecer assinado', [dil]: 'depende de terceiros' },
                situacao_registro: consulta('Em revisão'),
                orientacao: 'O Gabinete edita a minuta (a redação da Assessoria fica guardada em Versões) e termina pelo botão Finalizar Revisão: assina, escolhe e ordena os anexos e junta tudo aos autos. Depois, conclui e envia para a Secretaria.',
                acoes: ['Revisar e editar a minuta', 'Juntar o parecer assinado', 'Decidir os anexos e a ordem'],
                acoes_regras: [
                    { pede: 'orientacao', ajuda: 'A redação original da Assessoria continua em Versões, só para a equipe.' },
                    { documento: { forma: 'qualquer', tipo: 'Parecer' }, ajuda: 'Pelo botão Finalizar Revisão, que abre a assinatura e junta o parecer e os anexos de uma vez.' },
                    { pede: 'orientacao', ajuda: 'No Finalizar Revisão: marque o que entra nos autos, anexe o que faltar e ponha na ordem. O que não for marcado continua como minuta, só para a equipe.' },
                ],
            },
            {
                id: dev, nome: 'Devolução', unidade: 'Secretaria', avanco: 'auto', situacao_registro: consulta('Revisadas'),
                orientacao: 'Devolver a consulta com o parecer ao solicitante e registrar a data e o meio, que ficam nos autos. Cumpridas as ações obrigatórias, o processo segue sozinho para o Arquivamento.',
                acoes: ['Devolver a consulta ao solicitante', 'Fazer os registros de acervo', 'Registrar a devolução'],
                acoes_regras: [
                    { pede: 'orientacao', ajuda: 'Remessa interna, se o solicitante usa o sistema, ou PDF dos autos inserido no PGEA do SIM.' },
                    { ...dado, ajuda: 'Faça antes de registrar a devolução: ao chegar no Arquivamento o processo é arquivado.' },
                    { pede: 'formulario', obrigatoria: true, destino: 'autos', campos: [
                        data('data', 'Data da remessa'),
                        { id: 'meio', rotulo: 'Meio utilizado', tipo: 'lista', obrigatorio: true, opcoes: ['Remessa interna', 'PGEA no SIM', 'E-mail', 'Outro'] },
                    ] },
                ],
            },
            {
                id: arq, nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, situacao_registro: consulta('Na pasta'),
                orientacao: 'O processo é arquivado ao chegar aqui. O registro do arquivamento traz o nome de quem concluiu a devolução e a data, e sai no extrato do PDF.',
            },
            {
                id: dil, nome: 'Diligências externas', espera: true, avanco: 'auto',
                situacao_registro: consulta('Aguarda retorno de terceiros'), registro_atos: interno,
                orientacao: 'Espera por esclarecimento do solicitante ou de terceiros, pedida fora do sistema (e-mail ou protocolo próprio). O processo não sai da unidade. Registrado o retorno, ele volta sozinho para a fase em que estava.',
                acoes: ['Registrar a remessa da diligência', 'Guardar o que foi recebido', 'Registrar o retorno'],
                acoes_regras: [
                    { ...dado, pede: 'formulario', campos: [data('data', 'Data da remessa'), texto('destinatario', 'Destinatário'), texto('meio', 'Meio utilizado')] },
                    { documento: { forma: 'juntar', destino: 'informacao', nivel: 'opcional' }, ajuda: 'Fica guardado fora dos autos, à vista da equipe.' },
                    { ...dado, pede: 'formulario', campos: [data('data', 'Data do retorno'), { id: 'resumo', rotulo: 'Resumo do que voltou', tipo: 'texto_longo', obrigatorio: false }] },
                ],
            },
        ],
    };
}

/** Gera os modelos com ids novos a cada chamada. */
export function modelosDeRito() {
    return [
        modelo('Rito comum', 'Fluxo geral, do protocolo ao arquivamento.', [
            ['Autuação', 2, null, 'Conferir dados, partes e documentos iniciais.'],
            ['Instrução', 30, null, 'Juntar documentos, ouvir partes, diligências.'],
            ['Decisão', 15, null, 'Remeter ao gabinete para decidir.'],
            ['Cumprimento', 15, null, 'Cumprir o que foi decidido e intimar.'],
            ['Encerramento', null, null, 'Certificar o cumprimento e arquivar.'],
        ]),
        modelo('Requerimento simples', 'Pedido que é analisado e deferido ou indeferido.', [
            ['Protocolo', 1],
            ['Análise', 10, [2, 3], 'Verificar requisitos; pedir complementação se faltar algo.'],
            ['Complementação', 10, [1], 'Parte apresenta o que faltou; volta para análise.'],
            ['Decisão', 5, [4]],
            ['Comunicação e arquivamento', 5],
        ]),
        modelo('Procedimento com contraditório', 'Notificação, defesa, instrução e decisão, com recurso.', [
            ['Instauração', 5, null, 'Portaria ou despacho de instauração.'],
            ['Notificação', 5],
            ['Defesa', 15, null, 'Prazo para manifestação da parte.'],
            ['Instrução', 30, null, 'Provas, oitivas e relatório.'],
            ['Decisão', 15, [5, 7]],
            ['Recurso', 15],
            ['Julgamento do recurso', 30],
            ['Arquivamento', null],
        ]),
        modelo('Atendimento ao cidadão', 'Demanda recebida, encaminhada e respondida.', [
            ['Recebimento', 1],
            ['Triagem', 2, [2, 3], 'Encaminhar à área responsável ou responder direto.'],
            ['Encaminhamento à área', 10],
            ['Resposta', 5],
            ['Encerramento', null],
        ]),
        ritoConsultas(),
    ];
}
