// ============================================================================
// parceriaPhases — requisitos de cada fase da Parceria (espelho do backend)
// ----------------------------------------------------------------------------
// Espelha functions-v2/src/shared/validators.ts (PARCERIA_PHASE_REQUIREMENTS).
//
// A defesa é em camadas: o FRONTEND avisa (antes de chamar a função), o
// BACKEND exige (rejeita a transição com HttpsError). Este módulo existe para
// que o aviso do frontend diga EXATAMENTE o que falta — e em qual aba do modal
// o campo é preenchido — em vez de deixar o usuário descobrir pelo erro cru
// devolvido pela Cloud Function.
//
// SINCRONIZAR SEMPRE que PARCERIA_PHASE_REQUIREMENTS mudar no backend.
// ============================================================================

import { getParceriaField } from '@/utils/parceriaUtils';

/** Ordem canônica das fases (espelha PARCERIA_VALID_STATUSES). */
export const PARCERIA_PHASE_SEQUENCE = [
    'Pendente',
    'Em análise',
    'Em revisão',
    'Revisadas',
    'Aguarda Terceiros',
    'Parcerias',
    'Extintos',
];

/**
 * Ao ENTRAR na fase X, estes campos são OBRIGATÓRIOS.
 * Espelho exato de PARCERIA_PHASE_REQUIREMENTS (functions-v2/shared/validators.ts).
 */
export const PARCERIA_PHASE_REQUIREMENTS = {
    'Pendente': ['pgea', 'subject', 'parties'],
    'Em análise': ['responsible_user_id', 'responsibility_date'],
    // Observações são OPCIONAIS ao enviar para revisão (o que se exige é a pasta
    // na rede). A data de início é preenchida automaticamente (phaseDates.ts).
    'Em revisão': ['review_start_date', 'network_folder'],
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

/** Rótulos PT-BR (mesmos usados nas mensagens do backend). */
export const PARCERIA_FIELD_LABELS = {
    pgea: 'PGEA',
    subject: 'Assunto',
    object: 'Objeto',
    parties: 'Partes',
    responsible_user_id: 'Assessor Responsável',
    responsibility_date: 'Data de Responsabilidade',
    distribution_date: 'Data de Distribuição',
    review_start_date: 'Início da Revisão',
    network_folder: 'Pasta na Rede',
    observations: 'Observações',
    reviewed_date: 'Revisão Concluída',
    review_conclusion_date: 'Conclusão da Revisão',
    third_party_referral_date: 'Data da Remessa a Terceiros',
    third_party_return_date: 'Data de Retorno de Terceiros',
    third_party: 'Remetido para',
    partnership_type: 'Tipo de Parceria',
    partnership_number: 'Número da Parceria',
    signature_date: 'Data da Assinatura',
    demp: 'Publicação no DEMP',
    publication_date: 'Publicação no DEMP',
    review_submission_date: 'Remessa para Revisão',
    responsible_user_name: 'Nome do Responsável',
    archived_date: 'Data de Arquivamento',
    validity_period: 'Vigência',
    end_date: 'Termo Final',
    renewal_notice_date: 'Data do Aviso de Renovação',
    extinguished: 'confirmação de extinção',
};

/**
 * Aba do modal de edição onde cada campo é preenchido. Usado para levar o
 * usuário direto ao lugar certo quando o aviso de campos faltantes aparece.
 */
export const PARCERIA_FIELD_TABS = {
    pgea: 'basic',
    subject: 'basic',
    parties: 'basic',
    object: 'basic',
    partnership_type: 'basic',
    partnership_number: 'basic',
    signature_date: 'basic',
    demp: 'basic',
    validity_period: 'basic',
    responsible_user_id: 'workflow',
    responsibility_date: 'workflow',
    distribution_date: 'workflow',
    third_party_referral_date: 'workflow',
    third_party: 'workflow',
    third_party_return_date: 'workflow',
    observations: 'workflow',
    review_conclusion_date: 'workflow',
    review_start_date: 'archive',
    reviewed_date: 'archive',
    network_folder: 'archive',
    end_date: 'archive',
    renewal_notice_date: 'archive',
};

/** Nome visível de cada aba (para a mensagem do aviso). */
export const PARCERIA_TAB_LABELS = {
    basic: 'Dados Básicos',
    workflow: 'Fluxo de Trabalho',
    archive: 'Revisão e Arquivo',
};

/**
 * Um valor conta como "preenchido"? Espelha isFilled() do backend.
 */
export function isFilledValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
        if (typeof value.toDate === 'function') return true;
        return Object.keys(value).length > 0;
    }
    return Boolean(value);
}

/**
 * Campos obrigatórios que FALTAM para o registro entrar na fase-alvo.
 *
 * @param {Object} record   estado FINAL do registro (doc atual + alterações).
 * @param {string} phase    fase-alvo.
 * @param {Object} [opts]
 * @param {boolean} [opts.isAditivo] aditivo não exige `pgea` nem `extinguished`
 *                                   (espelha validateAditivoPhaseTransition).
 * @returns {Array<{field: string, label: string, tab: string, tabLabel: string}>}
 */
export function getMissingPhaseFields(record, phase, { isAditivo = false } = {}) {
    let required = PARCERIA_PHASE_REQUIREMENTS[phase];
    if (!required) return [];

    if (isAditivo) {
        // Aditivo "Pendente" não exige nada (basta existir).
        if (phase === 'Pendente') return [];
        required = required.filter((f) => f !== 'pgea' && f !== 'extinguished');
    }

    const missing = [];
    for (const field of required) {
        // getParceriaField resolve aliases igual ao getSmartField do backend.
        // `extinguished` é o único campo booleano: só conta como preenchido
        // quando é TRUE (extinguir é uma ação explícita, não um campo em branco).
        const value = getParceriaField(record, field);
        const filled = field === 'extinguished'
            ? (value === true || String(value).toLowerCase() === 'true')
            : isFilledValue(value);
        if (!filled) {
            // `extinguished` (e qualquer campo sem lugar no modal) fica sem aba:
            // o aviso mostra só o rótulo, sem mandar o usuário para lugar nenhum.
            const tab = PARCERIA_FIELD_TABS[field] || null;
            missing.push({
                field,
                label: PARCERIA_FIELD_LABELS[field] || field,
                tab,
                tabLabel: tab ? (PARCERIA_TAB_LABELS[tab] || '') : '',
            });
        }
    }
    return missing;
}

/**
 * Lista humana ("A, B e C") dos rótulos dos campos faltantes.
 */
export function describeMissingFields(missing) {
    const labels = (missing || []).map((m) => m.label);
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
