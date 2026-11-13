import { chaveCampo, novoCampo } from './camposProcesso.js';
import { seguintes } from './secretariaRito.js';
// ============================================================================
// Espelho, para a tela, das regras do rito (functions-v2/src/shared/
// exigencias.ts): o que cada ação pede, onde cada ato fica registrado e que
// documentos a fase exige. Quem decide é o servidor; aqui é só para montar o
// editor, mostrar o que falta e pré-marcar o que um documento cumpre.
// Testado em exigencias.test.js.
// ============================================================================

export const FORMAS = [['qualquer', 'Redigir ou juntar'], ['redigir', 'Redigido no órgão'], ['juntar', 'Arquivo recebido']];

/**
 * Onde um ato fica: autos (impresso, com folha), evento (extrato impresso, sem
 * folha), só no sistema ou sem evento (registro oculto, só ações e fases).
 * Um só mapa de rótulos para o editor, a prévia e a tela do processo.
 */
export const DESTINO_INFO = {
    autos: { rotulo: 'Nos autos', curto: 'nos autos', frase: 'Gera certidão com folha própria. Sai na impressão dos autos e pode ser mostrada às partes.' },
    evento: { rotulo: 'Evento no extrato', curto: 'evento no extrato', frase: 'Fica na aba Eventos e no extrato ao fim do PDF, sem folha. As partes não veem o evento.' },
    informacao: { rotulo: 'Só no sistema', curto: 'só no sistema', frase: 'Fica só na aba Eventos e nas informações do processo, para controle. Não sai em impressão.' },
    nenhum: { rotulo: 'Sem evento', curto: 'sem evento', frase: 'Não aparece em lugar nenhum: fica só um registro oculto, para auditoria. O dado pedido, se houver, vai para as informações do processo, só para a equipe.' },
    consolidar: { rotulo: 'Na certidão conjunta', curto: 'na certidão conjunta', frase: 'Vira um item de uma só certidão da fase (ou do grupo de fases), com folha, emitida quando o processo sai do grupo, é arquivado ou alguém pede "Emitir certidão agora".' },
};
const DESTINOS_ATO = ['autos', 'evento', 'informacao', 'nenhum'];
const lido = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
export const DESTINOS = DESTINOS_ATO.map((d) => [d, DESTINO_INFO[d].rotulo]);
export const DESTINOS_DOCUMENTO = [
    ['autos', 'Juntado aos autos: peça com folha, sai na impressão'],
    ['evento', 'Guardado fora dos autos, com evento no extrato impresso'],
    ['informacao', 'Guardado fora dos autos, só no sistema (não imprime)'],
];
export const DESTINOS_FASE = [
    ['autos', 'Nos autos (termo com folha)'],
    ['evento', 'Evento no extrato (sem folha)'],
    ['informacao', 'Só no sistema (não imprime)'],
    ['nenhum', 'Sem evento (registro oculto)'],
];
// Ação da fase aceita também a certidão conjunta; entrada, saída e remessas, não.
const DESTINOS_ACAO = [...DESTINOS_ATO, 'consolidar'];
export const ROTULO_DESTINO = Object.fromEntries(DESTINOS_ACAO.map((d) => [d, DESTINO_INFO[d].curto]));

/** Outros atos durante a fase: [chave, rótulo, padrão]. Iguais ao servidor (OUTROS_ATOS, PADRAO_OUTRO). */
export const OUTROS_ATOS = [
    ['prazo', 'Abrir e encerrar prazo', 'autos'],
    ['pendencia', 'Abrir e apreciar pendência', 'autos'],
    ['urgencia', 'Marcar ou retirar urgência', 'autos'],
    ['dados', 'Alterar os dados do processo', 'autos'],
    ['atribuicao', 'Atribuir a uma pessoa', 'evento'],
];
const padraoDoAto = (a) => OUTROS_ATOS.find((x) => x[0] === a)?.[2] || 'autos';
/** Atribuição é registro de controle: nunca termo nos autos. */
export const opcoesDoAto = (a) => (a === 'atribuicao' ? DESTINOS_FASE.filter(([d]) => d !== 'autos') : DESTINOS_FASE);
export const destinoDoAto = (f, a) => lido(f?.registro_atos?.outros?.[a], opcoesDoAto(a).map(([d]) => d), padraoDoAto(a));
/**
 * registro_atos da fase com outro mapa de outros atos. Parte dos níveis
 * efetivos (niveisDaFase), para não perder o formato antigo `registro`.
 */
export function registroComOutros(f, outros) {
    const n = niveisDaFase(f);
    const base = { ...(n.fase !== 'autos' ? { fase: n.fase } : {}), ...(n.remessas !== 'autos' ? { remessas: n.remessas } : {}) };
    return comOutros(Object.keys(base).length ? base : undefined, outros);
}

/** registro_atos com outro mapa de outros atos (guarda só o que difere do padrão). */
export function comOutros(ra, outros) {
    const { outros: _o, ...resto } = ra || {};
    const o = Object.fromEntries(Object.entries(outros || {}).filter(([a, d]) => d && d !== padraoDoAto(a)));
    const n = { ...resto, ...(Object.keys(o).length ? { outros: o } : {}) };
    return Object.keys(n).length ? n : undefined;
}

/** O que a ação pede a quem a cumpre. */
export const PEDIDOS = [
    ['confirmar', 'Só confirmar (caixa de marcar)'],
    ['texto', 'Um texto curto'],
    ['texto_longo', 'Um texto longo'],
    ['numero', 'Um número'],
    ['data', 'Uma data'],
    ['lista', 'Uma escolha numa lista'],
    ['sim_nao', 'Sim ou não'],
    ['registro', 'Um registro de outro módulo'],
    ['formulario', 'Um formulário (vários campos)'],
    ['documento', 'Um documento'],
    ['orientacao', 'Nada: só orienta (não se marca)'],
];
/** Campos de uma ação que pede um formulário (igual ao servidor). */
export const MAX_CAMPOS_ACAO = 10;
export const ROTULO_PEDIDO = Object.fromEntries(PEDIDOS);

/** Para a fase seguir: obrigatória (padrão), recomendada (avisa) ou opcional. Igual ao servidor (NIVEIS). */
export const NIVEIS = [
    ['', 'Obrigatória: sem ela, só com motivo de dispensa'],
    ['recomendado', 'Recomendada: avisa, mas não impede'],
    ['opcional', 'Opcional: só lembra'],
];
/** Nível da ação: documento guarda em `documento.nivel`; as demais, em obrigatoria/recomendada (ausente = opcional). */
export const nivelDaAcao = (r) => (r?.documento ? r.documento.nivel || '' : r?.obrigatoria ? '' : r?.recomendada ? 'recomendado' : 'opcional');
/** A regra com outro nível (o que não muda fica como estava). */
export function regraComNivel(r, nivel) {
    if (r?.documento) {
        const { nivel: _n, ...d } = r.documento;
        return { ...r, documento: { ...d, ...(nivel ? { nivel } : {}) } };
    }
    const { obrigatoria: _o, recomendada: _r, ...resto } = r || {};
    const n = { ...resto, ...(nivel === '' ? { obrigatoria: true } : nivel === 'recomendado' ? { recomendada: true } : {}) };
    return Object.keys(n).length ? n : null;
}

export const destinoDaAcao = (r) => (r?.documento
    ? lido(r.documento.destino, ['evento', 'informacao'], 'autos')
    : r?.destino ? lido(r.destino, DESTINOS_ACAO, 'evento') : (r?.autos ? 'autos' : 'evento'));
export const pedidoDaAcao = (r) => (r?.documento ? 'documento' : r?.pede || 'confirmar');
// Ação de só confirmar fora dos autos não tem o que mostrar às partes (nem certidão, nem dado). Sem evento: ninguém vê.
export const partesVeem = (r) => destinoDaAcao(r) !== 'nenhum'
    && (r?.partes === true || (r?.partes === undefined && r?.autos === true))
    && (pedidoDaAcao(r) !== 'confirmar' || ['autos', 'consolidar'].includes(destinoDaAcao(r)));
export const pedeDado = (r) => !['confirmar', 'documento', 'orientacao'].includes(pedidoDaAcao(r));
/** O dado da ação pode ir para a folha de dados do processo (evento 1 do PDF)? Reservado, nunca: a folha é de toda a equipe. */
export const podeIrParaFolha = (r) => pedeDado(r) && !r?.ve;
/** Ação que não se marca: só orienta quem está na fase. */
export const soOrienta = (r) => r?.pede === 'orientacao';

/**
 * Variáveis que os campos dos tipos e as informações das ações dão aos modelos:
 * [chave, rótulo, grupo], sem repetir e sem as chaves de `fora` (as fixas).
 */
export function variaveisDisponiveis(estado, fora = []) {
    const vistas = new Set(fora);
    const out = [];
    const add = (rot, grupo) => {
        const k = chaveCampo(rot);
        if (!k || k.length > 60 || vistas.has(k)) return;
        vistas.add(k);
        out.push([k, String(rot).trim(), grupo]);
    };
    for (const t of estado?.tipos || []) for (const c of t.formulario?.campos || []) add(c.rotulo, 'Campos dos tipos');
    for (const r of estado?.ritos || []) {
        for (const f of r.fases || []) (f.acoes || []).forEach((a, i) => { const rg = f.acoes_regras?.[i]; if (rg && pedeDado(rg)) add(rg.rotulo || a, 'Informações das ações'); });
    }
    return out;
}

/** Entrada/saída e remessas da fase: onde ficam (lê também o formato antigo `registro`). */
export function niveisDaFase(f) {
    if (!f) return { fase: 'autos', remessas: 'autos' };
    if (f.registro_atos) return { fase: lido(f.registro_atos.fase, DESTINOS_ATO, 'autos'), remessas: lido(f.registro_atos.remessas, DESTINOS_ATO, 'autos') };
    if (f.registro === 'interno') return { fase: 'evento', remessas: 'evento' };
    if (f.registro === 'remessas_fora') return { fase: 'autos', remessas: 'evento' };
    return { fase: 'autos', remessas: 'autos' };
}

const ORDEM = { autos: 2, evento: 1, informacao: 0, nenhum: -1 };
/** Mudança entre duas fases: o mais reservado; "sem evento" numa só delas não apaga o registro da outra. */
export const destinoTransicao = (a, b) => (a === 'nenhum' ? b : b === 'nenhum' ? a : ORDEM[a] <= ORDEM[b] ? a : b);

/**
 * Grupo da certidão conjunta: a fase raiz (a que não aponta para outra).
 * No editor a cadeia pode estar no meio (A → B → C); o servidor grava a raiz.
 */
export function grupoDe(fases, f) {
    const vistas = new Set();
    let g = f;
    while (g?.certidao?.grupo && !vistas.has(g.id)) {
        vistas.add(g.id);
        const prox = fases.find((x) => x.id === g.certidao.grupo);
        if (!prox) break;
        g = prox;
    }
    return g?.id || '';
}

/** Título da certidão do grupo (igual ao do servidor): o que uma fase deu ou o nome das fases. */
export function tituloCertidao(fases, grupo) {
    const membros = fases.filter((f) => grupoDe(fases, f) === grupo);
    const dado = membros.find((f) => f.id === grupo)?.certidao?.titulo || membros.find((f) => f.certidao?.titulo)?.certidao?.titulo;
    if (dado) return dado;
    const nomes = membros.map((f) => f.nome || f.id);
    return nomes.length > 1 ? `Certidão das fases ${nomes.join(', ')}` : `Certidão da fase ${nomes[0] || ''}`;
}

/** A mudança entre as duas fases entra na certidão conjunta (mesmo grupo e uma delas pede)? */
export const mudancaNaCertidao = (fases, de, para) => !!de && !!para && grupoDe(fases, de) === grupoDe(fases, para)
    && (de.certidao?.incluir_mudancas === true || para.certidao?.incluir_mudancas === true);

/** Onde fica a mudança de `de` para `para`, contando a certidão conjunta. */
export const destinoDaMudanca = (fases, de, para) => {
    const d = destinoTransicao(niveisDaFase(de).fase, niveisDaFase(para).fase);
    return d !== 'nenhum' && mudancaNaCertidao(fases, de, para) ? 'consolidar' : d;
};

/**
 * Tira a fase do grupo da certidão (ao excluí-la do rito): as fases que
 * apontavam para ela passam para o grupo dela ou, se era a raiz, para a
 * primeira delas, que herda o título.
 */
export function tirarDoGrupo(fases, id) {
    const saindo = fases.find((f) => f.id === id);
    const filhas = fases.filter((f) => f.id !== id && f.certidao?.grupo === id);
    if (!filhas.length) return fases;
    const acima = saindo?.certidao?.grupo;
    const raiz = filhas[0].id;
    return fases.map((f) => {
        if (f.id === id || f.certidao?.grupo !== id) return f;
        const { grupo: _g, ...resto } = f.certidao;
        const grupo = acima || (f.id === raiz ? undefined : raiz);
        const titulo = resto.titulo || (!acima && f.id === raiz ? saindo?.certidao?.titulo : undefined);
        const c = { ...resto, ...(grupo ? { grupo } : {}), ...(titulo ? { titulo } : {}) };
        return { ...f, certidao: Object.keys(c).length ? c : undefined };
    });
}

/** Fases para onde a fase segue: as saídas do rito ou, sem saídas, a próxima da lista. */
export function saidasDaFase(fases, f) {
    // Mesma conta do desenho do fluxo: a seguinte da lista pula a fase de espera, e a de espera volta para quem leva a ela.
    const i = fases.findIndex((x) => x.id === f?.id);
    if (i < 0) return [];
    return seguintes(fases, i).filter((id) => id !== f.id).map((id) => fases.find((x) => x.id === id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Condições pela resposta (iguais às do servidor, em shared/exigencias.ts):
// uma ação de escolha (lista ou sim/não) da fase decide se outra ação vale
// (`regra.se`) e por qual saída o processo segue (`fase.condicoes_regra`).
// ---------------------------------------------------------------------------

/** Quem pode cumprir a ação (além da administração). */
export const QUEM = [['', 'Quem tem o processo'], ['responsavel', 'Só o responsável designado'], ['gestor', 'Só quem gere a unidade']];
export const ROTULO_QUEM = { responsavel: 'só o responsável', gestor: 'só quem gere a unidade' };
/**
 * Quem da equipe vê o dado da ação (espelho de VE no servidor). Reservado: só
 * quem gere a unidade onde foi registrado, quem registrou e a administração.
 */
export const VE = [['', 'Toda a equipe do processo'], ['gestor', 'Só quem gere a unidade']];
/** O que pode ficar reservado: dado digitado, sem escolha que condiciona nem registro de outro módulo. */
export const PEDIDOS_RESERVAVEIS = ['texto', 'texto_longo', 'numero', 'data', 'formulario'];
/** O dado da ação pode ser reservado? (o servidor confere de novo) */
export const podeReservar = (r) => PEDIDOS_RESERVAVEIS.includes(pedidoDaAcao(r))
    && !['autos', 'consolidar'].includes(destinoDaAcao(r)) && !(r?.campos || []).some((c) => c.tipo === 'registro');

/** Respostas possíveis de uma ação de escolha ([valor, rótulo]); null se a ação não é de escolha. */
const SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']];
const opcoesEmPares = (lista) => (lista || []).map((o) => String(o).trim()).filter(Boolean).map((o) => [o, o]);
/** Campos do formulário da ação que condicionam: os de escolha, e nunca os de ação com dado reservado (igual ao servidor). */
export const camposDeEscolha = (r) => (r?.pede === 'formulario' && !r.ve ? (r.campos || []).filter((c) => c.tipo === 'lista' || c.tipo === 'sim_nao') : []);

/** Opções da resposta da ação ou, com `campo`, do campo de escolha do formulário dela: [[valor, rótulo]] ou null. */
export function opcoesDaResposta(r, campo) {
    if (!r || r.documento) return null;
    if (campo) {
        const c = camposDeEscolha(r).find((x) => x.id === campo);
        return !c ? null : c.tipo === 'lista' ? opcoesEmPares(c.opcoes) : SIM_NAO;
    }
    if (r.pede === 'lista') return opcoesEmPares(r.opcoes);
    if (r.pede === 'sim_nao') return SIM_NAO;
    return null;
}

/** Onde a resposta fica na rodada: '2' (a ação 2) ou '2.sistema' (campo do formulário dela). Igual ao servidor. */
export const chaveDaCondicao = (c) => (c.campo ? `${c.acao}.${c.campo}` : String(c.acao));

/** Ações de escolha da fase que podem condicionar (antes de `limite`): [índice, texto]. */
export const acoesDeEscolha = (f, limite = Infinity) => (f?.acoes || [])
    .map((a, i) => [i, a])
    .filter(([i, a]) => i < limite && a.trim() && opcoesDaResposta(f.acoes_regras?.[i]));

/**
 * Tudo o que pode condicionar na fase (antes de `limite`): as ações de escolha
 * e os campos de escolha dos formulários. [{ acao, campo?, rotulo }].
 */
export function fontesDeEscolha(f, limite = Infinity) {
    return (f?.acoes || []).flatMap((a, i) => {
        if (i >= limite || !a.trim()) return [];
        const r = f.acoes_regras?.[i];
        if (opcoesDaResposta(r)) return [{ acao: i, rotulo: `a resposta de "${a.trim()}"` }];
        return camposDeEscolha(r).filter((c) => c.id).map((c) => ({ acao: i, campo: c.id, rotulo: `"${c.rotulo || 'campo'}", de "${a.trim()}"` }));
    });
}

// Com `f`, a resposta só conta se a ação que a deu também vale (condições em cadeia), como no servidor.
export const condicaoAtendida = (c, resp, f) => !c || (resp?.[chaveDaCondicao(c)] !== undefined && c.valores.includes(resp[chaveDaCondicao(c)])
    && (!f || acaoAtiva(f, c.acao, resp)));

/** Ações do mesmo grupo de alternativas que `i` (inclui `i`). Igual ao servidor. */
export function grupoDeAlternativas(f, i) {
    const regras = f?.acoes_regras || [];
    const raiz = (k) => { const o = regras[k]?.ou; return Number.isInteger(o) && o >= 0 && o < k ? raiz(o) : k; };
    const r = raiz(i);
    return (f?.acoes || []).map((_a, k) => k).filter((k) => raiz(k) === r);
}
/** Outra ação do grupo de alternativas já foi cumprida (e vale agora)? */
export const alternativaCumprida = (f, i, feitas, resp) => grupoDeAlternativas(f, i).some((k) => k !== i && feitas.has(k) && acaoAtiva(f, k, resp));
/** Ações anteriores a que `i` pode ser alternativa: as que se marcam (sem documento, sem ser só orientação). [índice, texto]. */
export const podeTerAlternativa = (r) => !r?.documento && !soOrienta(r);
export const alternativasPossiveis = (f, i) => (f?.acoes || []).map((a, k) => [k, a])
    .filter(([k, a]) => k < i && a.trim() && podeTerAlternativa(f.acoes_regras?.[k]));
export const acaoAtiva = (f, i, resp) => {
    const se = f?.acoes_regras?.[i]?.se;
    return !se || (se.acao < i && condicaoAtendida(se, resp, f));
};

/** "Decisão" for Deferido ou Parcial. */
export function textoCondicao(f, c) {
    if (!c) return '';
    const r = f?.acoes_regras?.[c.acao];
    const nomes = Object.fromEntries(opcoesDaResposta(r, c.campo) || []);
    const campo = c.campo ? r?.campos?.find((x) => x.id === c.campo) : null;
    return `"${campo?.rotulo || r?.rotulo || f?.acoes?.[c.acao] || `ação ${c.acao + 1}`}" for ${c.valores.map((v) => nomes[v] || v).join(' ou ')}`;
}

/** O que está errado na condição (para as pendências do editor), ou null. */
export function problemaDaCondicao(f, c, limite = Infinity) {
    if (!c) return null;
    const ops = c.acao < limite ? opcoesDaResposta(f?.acoes_regras?.[c.acao], c.campo) : null;
    if (!ops || !(f?.acoes?.[c.acao] || '').trim()) {
        if (c.campo) return 'depende de um campo que não existe mais ou não é de escolha';
        return limite === Infinity ? 'depende de uma ação que não é mais de escolha' : 'depende de uma ação que não vem antes dela ou não é de escolha';
    }
    if (!c.valores.length) return null; // sem resposta marcada: quem chama avisa à parte
    const validos = c.valores.filter((v) => ops.some(([o]) => o === v));
    return validos.length ? null : 'nenhuma das respostas escolhidas existe mais';
}

/**
 * As ações mudaram de lugar: `origem[j]` é o índice antigo da ação j (-1 se nova).
 * As condições acompanham a ação de que dependem; as que dependiam de ação removida saem.
 */
export function remapearCondicoes(f, origem, regras) {
    const novo = new Map(origem.map((o, j) => [o, j]).filter(([o]) => o >= 0));
    const mapa = (c) => (novo.has(c.acao) ? { ...c, acao: novo.get(c.acao) } : null);
    const rs = regras.map((r, j) => {
        if (!r) return null;
        let n = r;
        if (n.se) {
            const se = mapa(n.se);
            if (se) n = { ...n, se };
            else { const { se: _s, ...resto } = n; n = resto; }
        }
        // "Alternativa a" acompanha a ação de que é alternativa; se ela saiu, a marca sai.
        if (Number.isInteger(n.ou)) {
            // Só vale apontando para trás: se a ordem inverteu, a marca sai.
            if (novo.has(n.ou) && novo.get(n.ou) < j) n = { ...n, ou: novo.get(n.ou) };
            else { const { ou: _o, ...resto } = n; n = resto; }
        }
        return Object.keys(n).length ? n : null;
    });
    const cr = Object.fromEntries(Object.entries(f.condicoes_regra || {}).map(([k, c]) => [k, mapa(c)]).filter(([, c]) => c));
    return { acoes_regras: rs.some(Boolean) ? rs : undefined, condicoes_regra: Object.keys(cr).length ? cr : undefined };
}

/** Saídas da fase com a condição de cada uma e se a resposta registrada a indica. */
export function saidasComCondicao(fases, f, resp) {
    return saidasDaFase(fases, f).map((x) => {
        const c = f.condicoes_regra?.[x.id];
        return { fase: x, condicao: c || null, indicada: !!c && condicaoAtendida(c, resp, f), contra: !!c && !condicaoAtendida(c, resp, f) };
    });
}

/** Regra nova a partir de outra, trocando o que a ação pede (mantém destino, quem vê e obrigatoriedade). */
export function regraComPedido(r, pede, acao) {
    const nova = regraComPedidoSemNivel(r, pede, acao);
    // O nível (obrigatória, recomendada, opcional) acompanha a ação: no documento fica em documento.nivel, nas outras em obrigatoria/recomendada.
    // Nível nunca escolhido (ação sem marca, que lê como opcional) segue o padrão do pedido novo: documento obrigatório; o resto opcional.
    const escolhido = r?.documento || r?.obrigatoria || r?.recomendada;
    return escolhido && pede !== 'orientacao' ? regraComNivel(nova, nivelDaAcao(r)) : nova;
}

function regraComPedidoSemNivel(r, pede, acao) {
    const nova = regraComPedidoBase(r, pede, acao);
    // Só orientação: fica a condição, mais nada (não se marca, não se cobra, não tem alternativa).
    if (pede === 'orientacao') return { ...nova, ...(r?.se ? { se: r.se } : {}) };
    // A condição ("só vale se") e quem cumpre acompanham a ação (documento: quem cumpre é quem junta).
    const extra = { ...(r?.se ? { se: r.se } : {}), ...(r?.quem && pede !== 'documento' ? { quem: r.quem } : {}),
        ...(Number.isInteger(r?.ou) && pede !== 'documento' ? { ou: r.ou } : {}),
        // A folha de dados segue enquanto a ação pedir um dado.
        ...(r?.folha_dados && !['confirmar', 'documento'].includes(pede) ? { folha_dados: true } : {}),
        // Dado reservado segue se o pedido novo ainda puder ser reservado.
        ...(r?.ve && PEDIDOS_RESERVAVEIS.includes(pede) ? { ve: r.ve } : {}) };
    return Object.keys(extra).length ? { ...(nova || {}), ...extra } : nova;
}

function regraComPedidoBase(r, pede, acao) {
    const dest = destinoDaAcao(r);
    // Documento novo vai aos autos, salvo se o criador já tinha escolhido outro destino para a ação.
    const escolhido = r?.documento?.destino || r?.destino;
    if (pede === 'documento') {
        return {
            documento: { descricao: acao, forma: r?.documento?.forma || 'qualquer', ...(['evento', 'informacao'].includes(escolhido) ? { destino: escolhido } : {}) },
            ...(r?.ajuda ? { ajuda: r.ajuda } : {}),
        };
    }
    if (pede === 'orientacao') return { pede, ...(r?.ajuda ? { ajuda: r.ajuda } : {}) };
    const base = {
        ...(pede !== 'confirmar' ? { pede } : {}),
        ...(r?.rotulo && pede !== 'confirmar' ? { rotulo: r.rotulo } : {}),
        ...(pede === 'lista' ? { opcoes: r?.opcoes || [] } : {}),
        ...(pede === 'registro' ? { modulo: r?.modulo || 'consultas' } : {}),
        ...(pede === 'formulario' ? { campos: r?.campos?.length ? r.campos : [novoCampo()] } : {}),
        ...(dest !== 'evento' ? { destino: dest } : {}),
        ...(partesVeem(r) ? { partes: true } : {}),
        ...(r?.obrigatoria ? { obrigatoria: true } : r?.recomendada ? { recomendada: true } : {}),
        ...(r?.ajuda ? { ajuda: r.ajuda } : {}),
    };
    return Object.keys(base).length ? base : null;
}

/** Frase do que a ação faz, para o editor e a prévia. */
export function resumoDaAcao(r) {
    const pede = pedidoDaAcao(r);
    if (pede === 'orientacao') return `só orientação, não se marca${r?.se ? '; condicional' : ''}`;
    const dest = destinoDaAcao(r);
    if (pede === 'documento') {
        return dest === 'autos' ? 'documento juntado aos autos' : `documento guardado fora dos autos (${dest === 'evento' ? 'evento no extrato' : 'só no sistema'})`;
    }
    const oque = pede === 'confirmar' ? 'confirmação'
        : pede === 'formulario' ? `formulário de ${r?.campos?.length || 0} ${r?.campos?.length === 1 ? 'campo' : 'campos'}`
            : ROTULO_PEDIDO[pede].replace(/^Uma? /, '').toLowerCase();
    const onde = dest === 'autos' ? 'certidão nos autos' : ROTULO_DESTINO[dest];
    const nivel = { '': '; obrigatória', recomendado: '; recomendada', opcional: '' }[nivelDaAcao(r)];
    return `${oque}${r?.rotulo ? ` (${r.rotulo})` : ''}; ${onde}${partesVeem(r) ? '; partes veem' : ''}${r?.folha_dados ? '; na folha de dados' : ''}${nivel}${r?.se ? '; condicional' : ''}${Number.isInteger(r?.ou) ? '; alternativa a outra' : ''}${r?.quem ? `; ${ROTULO_QUEM[r.quem]}` : ''}`;
}

/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
export function exigenciasDaFase(f, resp) {
    if (!f) return [];
    return [
        ...(f.documentos || []).map((d, i) => ({ ...d, chave: `d${i}` })),
        // Ação condicional que não vale agora não exige o documento.
        ...(f.acoes_regras || []).flatMap((r, i) => (r?.documento && f.acoes?.[i] && acaoAtiva(f, i, resp) ? [{ ...r.documento, chave: `a${i}`, acao_idx: i }] : [])),
    ];
}

/** Cada exigência com o documento que a cumpriu (ou null). */
export function situacaoDaFase(f, cumpridas, resp) {
    const feitas = (f && cumpridas?.[f.id]) || {};
    return exigenciasDaFase(f, resp).map((e) => ({ ...e, cumprida: feitas[e.chave] || null }));
}

export const pendentesDaFase = (f, cumpridas, resp) => situacaoDaFase(f, cumpridas, resp).filter((e) => !e.cumprida);

/** Ações obrigatórias (sem documento) ainda não feitas (a condicional só quando vale). */
export function acoesObrigatoriasPendentes(f, feitas = [], resp) {
    if (!f) return [];
    const ok = new Set(feitas);
    const cobrada = (i) => !!f.acoes_regras?.[i]?.obrigatoria && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
        && !alternativaCumprida(f, i, ok, resp);
    return (f.acoes || []).flatMap((_a, i) => {
        if (!cobrada(i)) return [];
        // Alternativas: o grupo aparece uma vez, como "A ou B" (só as que valem agora).
        const grupo = grupoDeAlternativas(f, i).filter((k) => acaoAtiva(f, k, resp));
        return grupo.find(cobrada) === i ? [{ descricao: grupo.map((k) => (f.acoes || [])[k]).join(' ou '), acao_idx: i }] : [];
    });
}

/** Tudo o que falta para a fase seguir sem dispensa: documentos e ações obrigatórias (recomendados e opcionais não impedem). */
export const faltaNaFase = (f, cumpridas, feitas, resp) => [...pendentesDaFase(f, cumpridas, resp).filter((e) => !e.nivel), ...acoesObrigatoriasPendentes(f, feitas, resp)];

/** O que o rito recomenda na fase e ainda não foi feito: avisa quem conclui, sem impedir. */
export function recomendadosNaFase(f, cumpridas, feitas = [], resp) {
    if (!f) return [];
    const ok = new Set(feitas);
    return [
        ...pendentesDaFase(f, cumpridas, resp).filter((e) => e.nivel === 'recomendado'),
        ...(f.acoes || []).flatMap((a, i) => (f.acoes_regras?.[i]?.recomendada && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
            && !alternativaCumprida(f, i, ok, resp)
            ? [{ descricao: a, acao_idx: i }] : [])),
    ];
}

/** Redigir = produzido no órgão (editor ou modelo); juntar = recebido de fora (arquivo ou petição da parte). `d.controle`: guardado fora dos autos. */
export function atende(e, d) {
    if (!!e.destino !== (d.controle === true)) return false;
    const redigido = !d.peticao && (d.origem === 'editor' || !!d.modelo_id);
    if (e.forma === 'redigir') return redigido;
    if (e.forma === 'juntar') return !redigido;
    return true;
}

const igual = (a, b) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/** O que o servidor reconheceria sozinho: mesmo modelo ou mesmo tipo. */
export const sugeridas = (pendentes, d) => pendentes
    .filter((e) => atende(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
    .map((e) => e.chave);

/**
 * Quando a lista de ações muda, cada regra acompanha o texto da sua ação:
 * apagar ou reordenar linhas não passa a regra para outra ação. Se só o texto
 * de uma linha mudou (mesma quantidade de linhas), a regra fica na posição.
 */
export function realinharRegras(antigas = [], regras = [], novas = []) {
    if (!regras.some(Boolean)) return undefined;
    const usadas = new Set();
    const out = novas.map((a, i) => {
        const t = a.trim();
        let j = t ? antigas.findIndex((x, k) => !usadas.has(k) && x.trim() === t) : -1;
        if (j < 0 && novas.length === antigas.length && !usadas.has(i)) j = i;
        if (j < 0) return null;
        usadas.add(j);
        return regras[j] || null;
    });
    return out.some(Boolean) ? out : undefined;
}
