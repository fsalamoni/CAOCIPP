// ============================================================================
// Espelho, para a tela, das exigências do rito (functions-v2/src/shared/
// exigencias.ts). Quem decide é o servidor; aqui é só para mostrar o que
// falta e pré-marcar o que um documento cumpre. Testado em exigencias.test.js.
// ============================================================================

export const FORMAS = [['qualquer', 'Redigir ou juntar'], ['redigir', 'Redigido no órgão'], ['juntar', 'Arquivo recebido']];
export const REGISTROS = [['', 'Tudo vai aos autos'], ['remessas_fora', 'Remessas internas da fase fora dos autos'], ['interno', 'Fase toda só no registro interno']];

/** Exigências da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
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

/** Redigir = produzido no órgão (editor ou modelo); juntar = arquivo recebido. */
export function atende(e, d) {
    const redigido = d.origem === 'editor' || !!d.modelo_id;
    if (e.forma === 'redigir') return redigido;
    if (e.forma === 'juntar') return !redigido;
    return true;
}

const igual = (a, b) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/** O que o servidor reconheceria sozinho: mesmo modelo ou mesmo tipo. */
export const sugeridas = (pendentes, d) => pendentes
    .filter((e) => atende(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
    .map((e) => e.chave);
