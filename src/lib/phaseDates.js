// ============================================================================
// phaseDates — espelho JS do functions-v2/src/shared/phaseDates.ts
// ----------------------------------------------------------------------------
// Mapa de fases → data(s) automática(s). Itens 10/11/13 do plano de Parcerias.
//
// Sincronizar SEMPRE que uma fase for adicionada/removida (atualizar os 3:
// backend TS, este JS, e EditDialog/Kanban se houver).
//
// Comportamento esperado (espelhado nos 3 lugares):
//   - Quando a fase MUDA para uma nova, a(s) data(s) da fase-alvo são
//     preenchidas automaticamente com a data atual.
//   - Se a data já existir (manual ou já gravada), NÃO sobrescreve.
//
// Cada fase pode preencher MAIS DE UM campo (ex.: "Em revisão" preenche tanto
// o início da revisão quanto a remessa para revisão).
// ============================================================================

/** Mapa de fase → campos de data automática na coleção. */
export const AUTO_DATE_BY_PHASE = Object.freeze({
    'Em análise': ['distribution_date'],
    // "Em revisão": marca o início da revisão E a remessa para revisão.
    'Em revisão': ['review_start_date', 'review_submission_date'],
    // "Revisadas": marca a revisão concluída E a conclusão da revisão.
    'Revisadas': ['reviewed_date', 'review_conclusion_date'],
    'Aguarda Terceiros': ['third_party_referral_date'],
    // "Parcerias": retorno de terceiros (data em que é largada na coluna).
    'Parcerias': ['third_party_return_date'],
    'Extintos': ['archived_date'],
});

/**
 * Retorna um patch com a(s) data(s) automática(s) da fase, se aplicável.
 * NÃO muta o estado — retorna um objeto novo. Só preenche campos ainda vazios
 * (preserva valor manual ou já gravado).
 *
 * @param {string} status fase alvo
 * @param {Object} current estado atual do formData (para checagem de "já existe")
 * @returns {Object} patch vazio se nada a aplicar, ou { campo: data, ... }
 */
export function getAutoDateForPhase(status, current) {
    const fields = AUTO_DATE_BY_PHASE[status];
    if (!fields || fields.length === 0) return {};
    const today = new Date().toISOString().split('T')[0];
    const patch = {};
    for (const field of fields) {
        // Preserva valor existente (manual ou já gravado).
        if (current?.[field]) continue;
        patch[field] = today;
    }
    return patch;
}
