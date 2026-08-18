// ============================================================================
// Validators - Validações puras de domínio, reusadas por Cloud Functions.
//
// Cada validator lança `HttpsError('failed-precondition', ...)` com mensagem
// clara em PT-BR quando o registro NÃO está apto para a transição pedida.
// A defesa em camadas é: frontend AVISA, backend EXIGE.
// ============================================================================

import { HttpsError } from 'firebase-functions/v2/https';
import { getSmartField } from './fields';

/**
 * Mapa canônico: ao ENTRAR na fase X, estes campos são OBRIGATÓRIOS.
 * Espelha o que a UI pede no ParceriaKanbanTransitionDialog.
 */
const PARCERIA_PHASE_REQUIREMENTS: Record<string, string[]> = {
    'Pendente': ['pgea', 'subject', 'parties'],
    'Em análise': ['responsible_user_id', 'responsibility_date'],
    'Em revisão': ['review_start_date', 'network_folder', 'observations'],
    'Revisadas': ['reviewed_date'],
    'Aguarda Terceiros': ['third_party_referral_date', 'third_party'],
    'Parcerias': [
        'third_party_return_date',
        // partnership_number é OPCIONAL (vazio = "Sem número").
        'partnership_type',
        'signature_date',
        'demp',
        'validity_period',
        'object',
        'end_date',
        'renewal_notice_date',
    ],
    'Extintos': ['extinguished'],
};

/**
 * Campos cujo valor é considerado "preenchido" para fins de validação.
 * Espelha o que getSmartField() devolve para entradas não-vazias.
 */
function isFilled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
        // Firestore Timestamp
        if ('toDate' in (value as any) && typeof (value as any).toDate === 'function') return true;
        return Object.keys(value as object).length > 0;
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
export function validateParceriaPhaseTransition(
    mergedRecord: Record<string, unknown>,
    targetPhase: string
): void {
    const required = PARCERIA_PHASE_REQUIREMENTS[targetPhase];
    if (!required) {
        throw new HttpsError(
            'invalid-argument',
            `Fase "${targetPhase}" não é uma fase válida de Parceria.`
        );
    }

    const missing: string[] = [];
    for (const field of required) {
        const value = getSmartField(mergedRecord as any, field);
        if (!isFilled(value)) {
            missing.push(field);
        }
    }

    if (missing.length > 0) {
        const labels: Record<string, string> = {
            pgea: 'PGEA',
            subject: 'Assunto',
            object: 'Objeto',
            parties: 'Partes',
            responsible_user_id: 'Assessor Responsável',
            responsibility_date: 'Data de Responsabilidade',
            review_start_date: 'Data de Início da Revisão',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            reviewed_date: 'Data de Conclusão da Revisão',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party_referral_date: 'Data da Remessa a Terceiros',
            third_party_return_date: 'Data de Retorno de Terceiros',
            third_party: 'Remetido para',
            partnership_type: 'Tipo de Parceria',
            partnership_number: 'Número da Parceria',
            signature_date: 'Data da Assinatura',
            publication_date: 'Publicação no DEMP',
            demp: 'Publicação no DEMP',
            validity_period: 'Vigência',
            end_date: 'Termo Final',
            renewal_notice_date: 'Data do Aviso de Renovação',
            extinguished: 'confirmação de extinção',
        };
        const missingLabels = missing.map((f) => labels[f] || f);
        const humanList =
            missingLabels.length === 1
                ? missingLabels[0]
                : missingLabels.length === 2
                ? `${missingLabels[0]} e ${missingLabels[1]}`
                : `${missingLabels.slice(0, -1).join(', ')} e ${missingLabels[missingLabels.length - 1]}`;

        throw new HttpsError(
            'failed-precondition',
            `Para entrar em "${targetPhase}", preencha: ${humanList}.`
        );
    }
}

/**
 * Valida se o aditivo de uma Parceria tem os campos obrigatórios da fase-alvo.
 * Usa o mesmo mapa canônico, já que aditivos seguem as mesmas 6 fases.
 */
export function validateAditivoPhaseTransition(
    mergedAdditive: Record<string, unknown>,
    targetPhase: string
): void {
    // Aditivos não usam "pgea" como obrigatório (PGEA é da Parceria pai).
    // Mas mantemos os outros campos da fase.
    const required = (PARCERIA_PHASE_REQUIREMENTS[targetPhase] || [])
        .filter((f) => f !== 'pgea' && f !== 'extinguished');
    if (targetPhase === 'Pendente') {
        // Para um aditivo "Pendente", basta ele existir (sem campos extras).
        return;
    }
    const missing: string[] = [];
    for (const field of required) {
        const value = getSmartField(mergedAdditive as any, field);
        if (!isFilled(value)) {
            missing.push(field);
        }
    }
    if (missing.length > 0) {
        const labels: Record<string, string> = {
            subject: 'Assunto',
            object: 'Objeto',
            parties: 'Partes',
            responsible_user_id: 'Assessor Responsável',
            responsibility_date: 'Data de Responsabilidade',
            review_start_date: 'Data de Início da Revisão',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            reviewed_date: 'Data de Conclusão da Revisão',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party_referral_date: 'Data da Remessa a Terceiros',
            third_party_return_date: 'Data de Retorno de Terceiros',
            third_party: 'Remetido para',
            partnership_type: 'Tipo de Parceria',
            partnership_number: 'Número da Parceria',
            signature_date: 'Data da Assinatura',
            publication_date: 'Publicação no DEMP',
            demp: 'Publicação no DEMP',
            validity_period: 'Vigência',
            end_date: 'Termo Final',
            renewal_notice_date: 'Data do Aviso de Renovação',
        };
        const humanList = missing.map((f) => labels[f] || f).join(', ');
        throw new HttpsError(
            'failed-precondition',
            `Para o aditivo entrar em "${targetPhase}", preencha: ${humanList}.`
        );
    }
}
