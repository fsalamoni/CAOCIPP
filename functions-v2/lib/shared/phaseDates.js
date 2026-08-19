"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_DATE_BY_PHASE = void 0;
exports.applyAutoDateForPhase = applyAutoDateForPhase;
/**
 * Mapa de fase → campos de data automática na coleção.
 * Cada fase pode preencher MAIS DE UM campo (ex.: "Em revisão" preenche o
 * início da revisão E a remessa para revisão).
 */
exports.AUTO_DATE_BY_PHASE = {
    'Em análise': ['distribution_date'],
    // "Em revisão": início da revisão E remessa para revisão.
    'Em revisão': ['review_start_date', 'review_submission_date'],
    // "Revisadas": revisão concluída E conclusão da revisão.
    'Revisadas': ['reviewed_date', 'review_conclusion_date'],
    'Aguarda Terceiros': ['third_party_referral_date'],
    // "Parcerias": retorno de terceiros (data em que é largada na coluna).
    'Parcerias': ['third_party_return_date'],
    'Extintos': ['archived_date'],
};
/**
 * Aplica a(s) data(s) automática(s) ao `changes` quando a fase muda.
 * Idempotente: se a data já existir (em changes ou no estado atual), não sobrescreve.
 *
 * @param changes objeto de mutação (será mutado in-place se fase bate)
 * @param current estado atual do doc (parceria ou aditivo) para checagem de "já existe"
 * @param todayStr data atual no formato yyyy-MM-dd
 * @returns os campos aplicados (pode ser vazio se nada foi aplicado)
 */
function applyAutoDateForPhase(changes, current, todayStr) {
    var _a;
    const targetPhase = changes.status;
    if (!targetPhase)
        return [];
    const fields = exports.AUTO_DATE_BY_PHASE[targetPhase];
    if (!fields || fields.length === 0)
        return [];
    const applied = [];
    for (const field of fields) {
        // Preserva valor existente (manual ou já gravado).
        const already = (_a = changes[field]) !== null && _a !== void 0 ? _a : current === null || current === void 0 ? void 0 : current[field];
        if (already)
            continue;
        changes[field] = todayStr;
        applied.push(field);
    }
    return applied;
}
//# sourceMappingURL=phaseDates.js.map