import { formatPersonName } from '@/utils/nameUtils';

// expedienteUtils.js - Centralized Logic for Expedientes Administrativos

/**
 * Field Aliases Mapping for Expedientes
 * Ensures 100% data visibility across different field name variations (Excel imports, legacy DB)
 */
export const EXPEDIENTE_FIELD_ALIASES = {
    expediente_number: ['expediente_number', 'numero', 'expediente', 'EXPEDIENTE', 'Expediente', 'Número'],
    system: ['system', 'sistema', 'SISTEMA', 'Sistema'],
    origin: ['origin', 'origem', 'ORIGEM', 'Origem'],
    entry_date: ['entry_date', 'data_entrada', 'entrada', 'data', 'ENTRADA', 'Data de Entrada', 'DATA DE ENTRADA'],
    object: ['object', 'objeto', 'assunto', 'OBJETO', 'Objeto', 'ASSUNTO'],
    distribution_date: ['distribution_date', 'data_distribuicao', 'distribuicao', 'DISTRIBUIÇÃO', 'Distribuição'],
    responsible_user_name: ['responsible_user_name', 'assessor', 'responsavel', 'ASSESSOR RESPONSÁVEL', 'Assessor Responsável'],
    responsible_user_id: ['responsible_user_id'],
    analysis_start_date: ['analysis_start_date', 'inicio_analise', 'INÍCIO DA ANÁLISE', 'Início da Análise'],
    observations: ['observations', 'observacoes', 'obs', 'OBSERVAÇÕES', 'Observações'],
    third_party_referral_date: ['third_party_referral_date', 'remessa_terceiros', 'data_remessa_terceiros'],
    third_party_recipient: ['third_party_recipient', 'remetido_para', 'destinatario_terceiros'],
    review_submission_date: ['review_submission_date', 'remessa_revisao', 'REMESSA P/ REVISÃO', 'Remessa p/ Revisão'],
    reviewed_date: ['reviewed_date', 'data_revisao_concluida', 'revisao_concluida', 'REVISÃO CONCLUÍDA', 'Revisão Concluída', 'REVISADAS', 'Revisadas'],
    review_return_date: ['review_return_date', 'devolucao_revisao', 'DEVOLUÇÃO APÓS REVISÃO', 'Devolução após Revisão'],
    archived_date: ['archived_date', 'arquivamento', 'ARQUIVAMENTO', 'Arquivamento'],
    network_folder: ['network_folder', 'pasta_rede', 'PASTA NA REDE', 'Pasta na Rede'],
    urgency_request: ['urgency_request', 'urgente', 'PEDIDO DE URGÊNCIA', 'Pedido de Urgência'],
    status: ['status', 'situacao', 'estado'],
};

/**
 * Robustly get a field value from an expediente object using aliases
 */
export function getExpedienteField(exp, fieldKey) {
    if (!exp) return '';

    const aliases = EXPEDIENTE_FIELD_ALIASES[fieldKey] || [fieldKey];

    // 1. Precise Match
    for (const alias of aliases) {
        if (exp[alias] !== undefined && exp[alias] !== null && String(exp[alias]).trim() !== '') {
            const value = exp[alias];
            if (fieldKey === 'responsible_user_name') return formatPersonName(String(value));
            return value;
        }
    }

    // 2. Normalized Match (Aggressive)
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedTargetAliases = aliases.map(normalize);
    const dbKeys = Object.keys(exp);

    for (const dbKey of dbKeys) {
        if (normalizedTargetAliases.includes(normalize(dbKey))) {
            const val = exp[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                if (fieldKey === 'responsible_user_name') return formatPersonName(String(val));
                return val;
            }
        }
    }

    return fieldKey === 'urgency_request' ? false : '';
}

/**
 * Normaliza urgency_request (mesma razão de isProcessUrgent em processUtils.js).
 */
export function isExpedienteUrgent(exp) {
    const val = getExpedienteField(exp, 'urgency_request');
    return val === true || String(val).toLowerCase().trim() === 'sim';
}

/**
 * ABSOLUTE 1-4 STATUS HIERARCHY
 * Same logic as processes — status derived from date fields.
 */
export function calculateExpedienteDerivedStatus(exp) {
    // 1. "Na pasta" (Verde): Arquivamento preenchido.
    if (getExpedienteField(exp, 'archived_date')) return "Na pasta";

    // 2. "Revisadas" (Roxo): Revisão concluída pelo responsável.
    if (getExpedienteField(exp, 'reviewed_date')) return "Revisadas";

    // 3. "Em revisão" (Azul): Remessa p/ Revisão preenchida.
    if (getExpedienteField(exp, 'review_submission_date')) return "Em revisão";

    // 3.5. "Aguarda retorno de terceiros" (Ciano): fase OPCIONAL — mesma
    // lógica de processUtils.js: pode nunca ocorrer (Em elaboração vai direto
    // p/ Em revisão) ou ocorrer normalmente, sem travar o fluxo.
    if (getExpedienteField(exp, 'third_party_referral_date')) return "Aguarda retorno de terceiros";

    // 4. "Em elaboração" (Amarelo/Âmbar): Início da Análise preenchido.
    if (getExpedienteField(exp, 'analysis_start_date')) return "Em elaboração";

    // 5. Fallback: Pendente ou Status original se manual.
    return getExpedienteField(exp, 'status') || "Pendente";
}
