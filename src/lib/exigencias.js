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

/** Redigir = produzido no órgão (editor ou modelo); juntar = recebido de fora (arquivo ou petição da parte). */
export function atende(e, d) {
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
