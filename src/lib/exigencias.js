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
export const ROTULO_DESTINO = Object.fromEntries(DESTINOS_ATO.map((d) => [d, DESTINO_INFO[d].curto]));

/** O que a ação pede a quem a cumpre. */
export const PEDIDOS = [
    ['confirmar', 'Só confirmar (caixa de marcar)'],
    ['texto', 'Um texto curto'],
    ['texto_longo', 'Um texto longo'],
    ['numero', 'Um número'],
    ['data', 'Uma data'],
    ['lista', 'Uma escolha numa lista'],
    ['sim_nao', 'Sim ou não'],
    ['documento', 'Um documento'],
];
export const ROTULO_PEDIDO = Object.fromEntries(PEDIDOS);

export const destinoDaAcao = (r) => (r?.documento
    ? lido(r.documento.destino, ['evento', 'informacao'], 'autos')
    : r?.destino ? lido(r.destino, DESTINOS_ATO, 'evento') : (r?.autos ? 'autos' : 'evento'));
export const pedidoDaAcao = (r) => (r?.documento ? 'documento' : r?.pede || 'confirmar');
// Ação de só confirmar fora dos autos não tem o que mostrar às partes (nem certidão, nem dado). Sem evento: ninguém vê.
export const partesVeem = (r) => destinoDaAcao(r) !== 'nenhum'
    && (r?.partes === true || (r?.partes === undefined && r?.autos === true))
    && (pedidoDaAcao(r) !== 'confirmar' || destinoDaAcao(r) === 'autos');
export const pedeDado = (r) => !['confirmar', 'documento'].includes(pedidoDaAcao(r));

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

/** Fases para onde a fase segue: as saídas do rito ou, sem saídas, a próxima da lista. */
export function saidasDaFase(fases, f) {
    if (!f || f.final) return [];
    const ids = (f.proximas || []).filter((id) => id !== f.id);
    if (ids.length) return ids.map((id) => fases.find((x) => x.id === id)).filter(Boolean);
    const i = fases.findIndex((x) => x.id === f.id);
    return fases[i + 1] ? [fases[i + 1]] : [];
}

/** Regra nova a partir de outra, trocando o que a ação pede (mantém destino, quem vê e obrigatoriedade). */
export function regraComPedido(r, pede, acao) {
    const dest = destinoDaAcao(r);
    // Documento novo vai aos autos, salvo se o criador já tinha escolhido outro destino para a ação.
    const escolhido = r?.documento?.destino || r?.destino;
    if (pede === 'documento') return { documento: { descricao: acao, forma: r?.documento?.forma || 'qualquer', ...(['evento', 'informacao'].includes(escolhido) ? { destino: escolhido } : {}) } };
    const base = {
        ...(pede !== 'confirmar' ? { pede } : {}),
        ...(r?.rotulo && pede !== 'confirmar' ? { rotulo: r.rotulo } : {}),
        ...(pede === 'lista' ? { opcoes: r?.opcoes || [] } : {}),
        ...(dest !== 'evento' ? { destino: dest } : {}),
        ...(partesVeem(r) ? { partes: true } : {}),
        ...(r?.obrigatoria ? { obrigatoria: true } : {}),
    };
    return Object.keys(base).length ? base : null;
}

/** Frase do que a ação faz, para o editor e a prévia. */
export function resumoDaAcao(r) {
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    if (pede === 'documento') {
        return dest === 'autos' ? 'documento juntado aos autos' : `documento guardado fora dos autos (${dest === 'evento' ? 'evento no extrato' : 'só no sistema'})`;
    }
    const oque = pede === 'confirmar' ? 'confirmação' : ROTULO_PEDIDO[pede].replace(/^Uma? /, '').toLowerCase();
    const onde = dest === 'autos' ? 'certidão nos autos' : ROTULO_DESTINO[dest];
    return `${oque}${r?.rotulo ? ` (${r.rotulo})` : ''}; ${onde}${partesVeem(r) ? '; partes veem' : ''}${r?.obrigatoria ? '; obrigatória' : ''}`;
}

/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
export function exigenciasDaFase(f) {
    if (!f) return [];
    return [
        ...(f.documentos || []).map((d, i) => ({ ...d, chave: `d${i}` })),
        ...(f.acoes_regras || []).flatMap((r, i) => (r?.documento && f.acoes?.[i] ? [{ ...r.documento, chave: `a${i}`, acao_idx: i }] : [])),
    ];
}

/** Cada exigência com o documento que a cumpriu (ou null). */
export function situacaoDaFase(f, cumpridas) {
    const feitas = (f && cumpridas?.[f.id]) || {};
    return exigenciasDaFase(f).map((e) => ({ ...e, cumprida: feitas[e.chave] || null }));
}

export const pendentesDaFase = (f, cumpridas) => situacaoDaFase(f, cumpridas).filter((e) => !e.cumprida);

/** Ações obrigatórias (sem documento) ainda não feitas. */
export function acoesObrigatoriasPendentes(f, feitas = []) {
    if (!f) return [];
    const ok = new Set(feitas);
    return (f.acoes || []).flatMap((a, i) => (f.acoes_regras?.[i]?.obrigatoria && !f.acoes_regras[i]?.documento && !ok.has(i) ? [{ descricao: a, acao_idx: i }] : []));
}

/** Tudo o que falta para a fase seguir sem dispensa: documentos e ações obrigatórias. */
export const faltaNaFase = (f, cumpridas, feitas) => [...pendentesDaFase(f, cumpridas), ...acoesObrigatoriasPendentes(f, feitas)];

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
