"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARCERIA_VALID_STATUSES = exports.PARCERIA_FINAL_STATUSES = void 0;
exports.calculateStatus = calculateStatus;
exports.calculateParceriaStatus = calculateParceriaStatus;
const fields_1 = require("./fields");
function calculateStatus(process) {
    // 1. "Na pasta" (Verde): Se o campo de Arquivamento estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'archived_date'))
        return "Na pasta";
    // 2. "Revisadas" (Roxo): Se a Revisão concluída pelo responsável estiver preenchida.
    if ((0, fields_1.getSmartField)(process, 'reviewed_date'))
        return "Revisadas";
    // 3. "Em revisão" (Azul): Se o campo Remessa p/ Revisão estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'review_submission_date'))
        return "Em revisão";
    // 3.5. "Aguarda retorno de terceiros" (Ciano): fase OPCIONAL — se a Remessa
    // a Terceiros estiver preenchida mas ainda não houver Remessa p/ Revisão.
    // Pode nunca ocorrer (vai direto de "Em elaboração" p/ "Em revisão").
    if ((0, fields_1.getSmartField)(process, 'third_party_referral_date'))
        return "Aguarda retorno de terceiros";
    // 4. "Em elaboração" (Âmbar/Amarelo): Se o campo Início da Análise estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'analysis_start_date'))
        return "Em elaboração";
    // 5. "Pendente" (Branco): Fallback final.
    return (0, fields_1.getSmartField)(process, 'status') || "Pendente";
}
// ============================================================================
// Parcerias (Convênio, Termo de Cooperação, Termo de Fomento)
//
// Fluxo (da fase "inicial" para a "final"):
//   Pendente → Em análise → Em revisão → Revisadas → Aguarda Terceiros
//            → Parcerias → Extintos
//
// Marcadores de fase (campo preenchido ao ENTRAR na fase):
//   1. Extintos          → extinguished === true (auto: archived_date)
//   2. Parcerias         → formalização completa (auto: third_party_return_date)
//   3. Aguarda Terceiros → third_party_referral_date + third_party (Remetido para)
//   4. Revisadas         → reviewed_date (data de conclusão da revisão)
//   5. Em revisão        → review_start_date  (ou network_folder + observations)
//   6. Em análise        → responsibility_date (entrada em análise)
//   7. Pendente          → fallback (só os mínimos: pgea/assunto/partes)
//
// IMPORTANTE (compat): registros legados usavam o rótulo "Revisão" (sem
// "Em") e `review_conclusion_date` como marcador de "Aguarda Terceiros".
// Aqui tratamos `reviewed_date`/`review_conclusion_date` como conclusão da
// revisão (Revisadas). O rótulo legado "Revisão" é normalizado para
// "Em revisão" no frontend.
//
// Segue a mesma filosofia do calculateStatus(process): quanto mais campos
// "avançados" preenchidos, mais à direita no fluxo. O frontend tem cópia
// para exibição; a autoridade da fase é o campo `status` (definido nas
// transições), com este cálculo como fallback/recomputo defensivo.
// ============================================================================
exports.PARCERIA_FINAL_STATUSES = ['Parcerias', 'Extintos'];
exports.PARCERIA_VALID_STATUSES = [
    'Pendente',
    'Em análise',
    'Em revisão',
    'Revisadas',
    'Aguarda Terceiros',
    'Parcerias',
    'Extintos',
];
function calculateParceriaStatus(parceria) {
    // 1. "Extintos" (slate desaturado): marcado explicitamente como extinto.
    if ((parceria === null || parceria === void 0 ? void 0 : parceria.extinguished) === true)
        return 'Extintos';
    // 2. "Parcerias" (emerald): tem todos os campos de formalização preenchidos.
    if ((0, fields_1.getSmartField)(parceria, 'partnership_type') &&
        (0, fields_1.getSmartField)(parceria, 'partnership_number') &&
        (0, fields_1.getSmartField)(parceria, 'signature_date') &&
        (0, fields_1.getSmartField)(parceria, 'end_date') &&
        (0, fields_1.getSmartField)(parceria, 'renewal_notice_date'))
        return 'Parcerias';
    // 3. "Aguarda Terceiros" (cyan): remessa a terceiros + terceiro escolhido.
    if ((0, fields_1.getSmartField)(parceria, 'third_party_referral_date') &&
        (0, fields_1.getSmartField)(parceria, 'third_party'))
        return 'Aguarda Terceiros';
    // 4. "Revisadas" (violeta): revisão concluída (data registrada).
    if ((0, fields_1.getSmartField)(parceria, 'reviewed_date') ||
        (0, fields_1.getSmartField)(parceria, 'review_conclusion_date'))
        return 'Revisadas';
    // 5. "Em revisão" (sky): início da revisão OU pasta na rede + observações.
    if ((0, fields_1.getSmartField)(parceria, 'review_start_date') ||
        ((0, fields_1.getSmartField)(parceria, 'network_folder') && (0, fields_1.getSmartField)(parceria, 'observations')))
        return 'Em revisão';
    // 6. "Em análise" (amber): entrou em análise (data de responsabilidade).
    if ((0, fields_1.getSmartField)(parceria, 'responsibility_date'))
        return 'Em análise';
    // 7. "Pendente" (slate): fallback. Normaliza rótulo legado "Revisão".
    const stored = (0, fields_1.getSmartField)(parceria, 'status');
    return stored === 'Revisão' ? 'Em revisão' : (stored || 'Pendente');
}
//# sourceMappingURL=status.js.map