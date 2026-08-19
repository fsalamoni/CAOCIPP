// ============================================================================
// phaseDates — mapa de fases → data automática
// ----------------------------------------------------------------------------
// Itens 10, 11, 13 do plano de Parcerias. Centraliza o mesmo mapa em
// update.ts (parceria), updateAditivo.ts (aditivo) e o frontend
// (EditParceriaDialog), para evitar divergência entre cliente/servidor.
//
// Comportamento esperado (espelhado nos 3 lugares):
//   - Quando a fase MUDA para uma nova (changes.status), a data da fase-alvo
//     é preenchida automaticamente com a data atual.
//   - Se a data já existir (manual ou já gravada), NÃO sobrescreve.
//
// Aditivo (item 11) e Parceria (item 10) seguem o MESMO mapa (mesmas fases).
// ============================================================================

/** Mapa de fase → campo de data automática na coleção. */
export const AUTO_DATE_BY_PHASE: Record<string, string> = {
    'Em análise': 'distribution_date',
    'Em revisão': 'review_start_date',
    'Revisadas': 'reviewed_date',
    'Aguarda Terceiros': 'third_party_referral_date',
    'Parcerias': 'third_party_return_date',
    'Extintos': 'archived_date',
};

/**
 * Aplica a data automática ao `changes` quando a fase muda.
 * Idempotente: se a data já existir (em changes ou no estado atual), não sobrescreve.
 *
 * @param changes objeto de mutação (será mutado in-place se fase bate)
 * @param current estado atual do doc (parceria ou aditivo) para checagem de "já existe"
 * @param todayStr data atual no formato yyyy-MM-dd
 * @returns o campo aplicado, ou null se nada foi aplicado
 */
export function applyAutoDateForPhase(
    changes: Record<string, any>,
    current: Record<string, any>,
    todayStr: string,
): string | null {
    const targetPhase = changes.status;
    if (!targetPhase) return null;
    const field = AUTO_DATE_BY_PHASE[targetPhase];
    if (!field) return null;
    // Preserva valor existente (manual ou já gravado).
    const already = changes[field] ?? current?.[field];
    if (already) return null;
    changes[field] = todayStr;
    return field;
}
