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

/** Seguintes efetivas de cada fase (as explícitas ou a próxima da lista). */
export function seguintes(fases, i) {
    const f = fases[i];
    if (f?.final) return [];
    if (f?.proximas?.length) return f.proximas.filter((id) => fases.some((x) => x.id === id));
    return i < fases.length - 1 ? [fases[i + 1].id] : [];
}

/** Saídas como o servidor vai gravar (sem a própria fase e sem as que não existem; vazio = a seguinte da lista). */
function saidasGravadas(fases, i, ids) {
    const f = fases[i];
    if (f.final) return [];
    const p = (f.proximas || []).filter((id) => id !== f.id && ids.has(id));
    return p.length ? p : i < fases.length - 1 ? [fases[i + 1].id] : [];
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
        const antes = i >= 0 ? saidasGravadas(origem, i, ids) : (c.proximas || []);
        if (i >= 0 || c.proximas) c.proximas = antes.map(novo).filter(Boolean);
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
        const linear = i < fases.length - 1 ? [fases[i + 1].id] : [];
        const p = (f.proximas || []).filter((id) => id !== f.id && fases.some((x) => x.id === id));
        const igual = p.length === linear.length && p.every((id, k) => id === linear[k]);
        const { proximas: _p, final, ...resto } = f;
        if (final) return i < fases.length - 1 ? { ...resto, final: true } : resto;
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
    const saidas = new Map(fases.map((f, i) => [f.id, seguintes(fases, i)]));
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
    ];
}
