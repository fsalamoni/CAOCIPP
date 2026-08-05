"use strict";
// ============================================================================
// Validators - Validações puras de domínio, reusadas por Cloud Functions.
//
// Cada validator lança `HttpsError('failed-precondition', ...)` com mensagem
// clara em PT-BR quando o registro NÃO está apto para a transição pedida.
// A defesa em camadas é: frontend AVISA, backend EXIGE.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParceriaPhaseTransition = validateParceriaPhaseTransition;
exports.validateAditivoPhaseTransition = validateAditivoPhaseTransition;
const https_1 = require("firebase-functions/v2/https");
const fields_1 = require("./fields");
/**
 * Mapa canônico: ao ENTRAR na fase X, estes campos são OBRIGATÓRIOS.
 * Espelha o que a UI pede no ParceriaKanbanTransitionDialog.
 */
const PARCERIA_PHASE_REQUIREMENTS = {
    'Pendente': ['pgea', 'subject', 'object', 'parties'],
    'Em análise': ['responsible_user_id', 'responsibility_date'],
    'Revisão': ['network_folder', 'observations'],
    'Aguarda Terceiros': ['review_conclusion_date', 'third_party'],
    'Parcerias': [
        'partnership_type',
        'partnership_number',
        'signature_date',
        'validity_period',
        'end_date',
        'renewal_notice_date',
    ],
    'Extintos': ['extinguished'],
};
/**
 * Campos cujo valor é considerado "preenchido" para fins de validação.
 * Espelha o que getSmartField() devolve para entradas não-vazias.
 */
function isFilled(value) {
    if (value === null || value === undefined)
        return false;
    if (typeof value === 'string')
        return value.trim().length > 0;
    if (typeof value === 'boolean')
        return true;
    if (typeof value === 'number')
        return Number.isFinite(value);
    if (Array.isArray(value))
        return value.length > 0;
    if (typeof value === 'object') {
        // Firestore Timestamp
        if ('toDate' in value && typeof value.toDate === 'function')
            return true;
        return Object.keys(value).length > 0;
    }
    return Boolean(value);
}
/**
 * Valida se a Parceria (registro + changes aplicadas) tem todos os campos
 * obrigatórios da fase-alvo. Lança HttpsError se faltar algo.
 *
 * @param mergedRecord   Estado FINAL da Parceria (registro atual + changes aplicados).
 * @param targetPhase    Fase para a qual o usuário quer mover.
 */
function validateParceriaPhaseTransition(mergedRecord, targetPhase) {
    const required = PARCERIA_PHASE_REQUIREMENTS[targetPhase];
    if (!required) {
        throw new https_1.HttpsError('invalid-argument', `Fase "${targetPhase}" não é uma fase válida de Parceria.`);
    }
    const missing = [];
    for (const field of required) {
        const value = (0, fields_1.getSmartField)(mergedRecord, field);
        if (!isFilled(value)) {
            missing.push(field);
        }
    }
    if (missing.length > 0) {
        const labels = {
            pgea: 'PGEA',
            subject: 'Assunto',
            object: 'Objeto',
            parties: 'Partes',
            responsible_user_id: 'Assessor Responsável',
            responsibility_date: 'Data de Responsabilidade',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party: 'Terceiro',
            partnership_type: 'Tipo de Parceria',
            partnership_number: 'Número da Parceria',
            signature_date: 'Data da Assinatura',
            validity_period: 'Vigência',
            end_date: 'Termo Final',
            renewal_notice_date: 'Data do Aviso de Renovação',
            extinguished: 'confirmação de extinção',
        };
        const missingLabels = missing.map((f) => labels[f] || f);
        const humanList = missingLabels.length === 1
            ? missingLabels[0]
            : missingLabels.length === 2
                ? `${missingLabels[0]} e ${missingLabels[1]}`
                : `${missingLabels.slice(0, -1).join(', ')} e ${missingLabels[missingLabels.length - 1]}`;
        throw new https_1.HttpsError('failed-precondition', `Para entrar em "${targetPhase}", preencha: ${humanList}.`);
    }
}
/**
 * Valida se o aditivo de uma Parceria tem os campos obrigatórios da fase-alvo.
 * Usa o mesmo mapa canônico, já que aditivos seguem as mesmas 6 fases.
 */
function validateAditivoPhaseTransition(mergedAdditive, targetPhase) {
    // Aditivos não usam "pgea" como obrigatório (PGEA é da Parceria pai).
    // Mas mantemos os outros campos da fase.
    const required = (PARCERIA_PHASE_REQUIREMENTS[targetPhase] || [])
        .filter((f) => f !== 'pgea' && f !== 'extinguished');
    if (targetPhase === 'Pendente') {
        // Para um aditivo "Pendente", basta ele existir (sem campos extras).
        return;
    }
    const missing = [];
    for (const field of required) {
        const value = (0, fields_1.getSmartField)(mergedAdditive, field);
        if (!isFilled(value)) {
            missing.push(field);
        }
    }
    if (missing.length > 0) {
        const labels = {
            subject: 'Assunto',
            object: 'Objeto',
            parties: 'Partes',
            responsible_user_id: 'Assessor Responsável',
            responsibility_date: 'Data de Responsabilidade',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party: 'Terceiro',
            partnership_type: 'Tipo de Parceria',
            partnership_number: 'Número da Parceria',
            signature_date: 'Data da Assinatura',
            validity_period: 'Vigência',
            end_date: 'Termo Final',
            renewal_notice_date: 'Data do Aviso de Renovação',
        };
        const humanList = missing.map((f) => labels[f] || f).join(', ');
        throw new https_1.HttpsError('failed-precondition', `Para o aditivo entrar em "${targetPhase}", preencha: ${humanList}.`);
    }
}
//# sourceMappingURL=validators.js.map