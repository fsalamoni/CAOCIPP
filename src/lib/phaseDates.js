// ============================================================================
// phaseDates — espelho JS do functions-v2/src/shared/phaseDates.ts
// ----------------------------------------------------------------------------
// Mapa de fases → data automática. Itens 10/11/13 do plano de Parcerias.
//
// Sincronizar SEMPRE que uma fase for adicionada/removida (atualizar os 3:
// backend TS, este JS, e EditDialog/Kanban se houver).
//
// Comportamento esperado (espelhado nos 3 lugares):
//   - Quando a fase MUDA para uma nova, a data da fase-alvo é preenchida
//     automaticamente com a data atual.
//   - Se a data já existir (manual ou já gravada), NÃO sobrescreve.
// ============================================================================

/** Mapa de fase → campo de data automática na coleção. */
export const AUTO_DATE_BY_PHASE = Object.freeze({
    'Em análise': 'distribution_date',
    'Em revisão': 'review_start_date',
    'Revisadas': 'reviewed_date',
    'Aguarda Terceiros': 'third_party_referral_date',
    'Parcerias': 'third_party_return_date',
    'Extintos': 'archived_date',
});

/**
 * Retorna um patch com a data automática da fase, se aplicável.
 * NÃO muta o estado — retorna um objeto novo.
 *
 * @param {string} status fase alvo
 * @param {Object} current estado atual do formData (para checagem de "já existe")
 * @returns {Object} patch vazio se nada a aplicar, ou { campo: data } se deve injetar
 */
export function getAutoDateForPhase(status, current) {
    const field = AUTO_DATE_BY_PHASE[status];
    if (!field) return {};
    // Preserva valor existente (manual ou já gravado).
    const existing = current?.[field];
    if (existing) return {};
    const today = new Date().toISOString().split('T')[0];
    return { [field]: today };
}
