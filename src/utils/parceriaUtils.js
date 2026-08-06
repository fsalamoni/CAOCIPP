import { formatPersonName } from '@/utils/nameUtils';

// parceriaUtils.js - Centralized Logic for Parcerias
// (Convênio, Termo de Cooperação, Termo de Fomento).
//
// Espelho de expedienteUtils.js — 100% das funções de leitura resiliente de
// campos (com aliases) e cálculo de status derivado. Mantido separado para
// que o motor de métricas consiga tratar parcerias como kind distinto.

/**
 * Field Aliases Mapping for Parcerias
 * Garante 100% de visibilidade dos dados independentemente da origem
 * (criação manual, import de planilha, atualização via updateAditivo, etc.)
 */
export const PARCERIA_FIELD_ALIASES = {
    pgea: ['pgea', 'PGEA', 'Pgea'],
    subject: ['subject', 'assunto', 'Assunto', 'ASSUNTO'],
    object: ['object', 'objeto', 'Objeto', 'OBJETO'],
    parties: ['parties', 'partes', 'Partes', 'PARTES'],
    partnership_type: ['partnership_type', 'tipo_parceria', 'TIPO DE PARCERIA', 'Tipo de Parceria'],
    partnership_number: ['partnership_number', 'numero_parceria', 'NÚMERO DA PARCERIA', 'Número da Parceria'],
    categoria: ['categoria', 'CATEGORIA', 'Categoria', 'category'],
    signature_date: ['signature_date', 'data_assinatura', 'DATA DA ASSINATURA', 'Data da Assinatura'],
    validity_period: ['validity_period', 'vigencia', 'VIGÊNCIA', 'Vigência'],
    end_date: ['end_date', 'termo_final', 'TERMO FINAL', 'Termo Final'],
    renewal_notice_date: ['renewal_notice_date', 'data_aviso_renovacao', 'DATA DO AVISO DE RENOVAÇÃO', 'Data do Aviso de Renovação'],
    responsible_user_name: ['responsible_user_name', 'assessor_responsavel', 'ASSESSOR RESPONSÁVEL', 'Assessor Responsável', 'responsavel', 'RESPONSÁVEL', 'Responsável'],
    responsible_user_id: ['responsible_user_id'],
    responsibility_date: ['responsibility_date', 'data_responsabilidade'],
    network_folder: ['network_folder', 'pasta_rede', 'PASTA NA REDE', 'Pasta na Rede'],
    observations: ['observations', 'observacoes', 'OBSERVAÇÕES', 'Observações', 'obs'],
    review_conclusion_date: ['review_conclusion_date', 'data_conclusao_revisao'],
    third_party: ['third_party', 'terceiro'],
    status: ['status', 'situacao', 'estado'],
    pgea_date: ['pgea_date', 'data_pgea', 'DATA PGEA', 'Data PGEA'],
    aditivo_count: ['aditivo_count', 'qtd_aditivos'],
    current_additive_id: ['current_additive_id'],
    extinguished: ['extinguished', 'extinto'],
    extinguished_at: ['extinguished_at'],
    created_at: ['created_at', 'criado_em', 'data_criacao', 'createdAt', 'createdAtMs'],
    updated_at: ['updated_at', 'atualizado_em', 'data_atualizacao', 'updatedAt'],
};

/**
 * Lê um campo de um documento de Parceria usando aliases (resiliente a
 * variações de capitalização/acentos vindas de import ou DB legados).
 */
export function getParceriaField(parceria, fieldKey) {
    if (!parceria) return '';

    try {
        const aliases = PARCERIA_FIELD_ALIASES[fieldKey] || [fieldKey];

        // 1. Match preciso.
        for (const alias of aliases) {
            if (parceria[alias] !== undefined && parceria[alias] !== null && String(parceria[alias]).trim() !== '') {
                const value = parceria[alias];
                if (fieldKey === 'responsible_user_name') return formatPersonName(String(value));
                return value;
            }
        }

    // 2. Match normalizado (agressivo) — p.ex. "PGEA" == "pgea" == "Pgea".
    const normalize = (s) => {
        if (s == null) return '';
        try {
            return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        } catch (e) {
            if (typeof window !== 'undefined' && window.console) {
                console.warn('[getParceriaField] normalize error', { s, fieldKey, e });
            }
            return '';
        }
    };
    const normalizedTargetAliases = aliases.map(normalize);
    const dbKeys = Object.keys(parceria);

    for (const dbKey of dbKeys) {
        if (normalizedTargetAliases.includes(normalize(dbKey))) {
            const val = parceria[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                if (fieldKey === 'responsible_user_name') return formatPersonName(String(val));
                return val;
            }
        }
    }

        return fieldKey === 'extinguished' ? false : '';
    } catch (e) {
        if (typeof window !== 'undefined' && window.console) {
            console.error('[getParceriaField] CRASH', { parceria, fieldKey, e: e?.message, stack: e?.stack });
        }
        return fieldKey === 'extinguished' ? false : '';
    }
}

/**
 * Indica se a Parceria está extinta (campo `extinguished` true).
 */
export function isParceriaExtinguished(p) {
    return getParceriaField(p, 'extinguished') === true
        || String(getParceriaField(p, 'extinguished')).toLowerCase() === 'true';
}

/**
 * Indica se a Parceria tem aditivos. Considera tanto o campo `aditivo_count`
 * quanto a presença de `current_additive_id`.
 */
export function hasAdditives(p) {
    const count = Number(getParceriaField(p, 'aditivo_count')) || 0;
    return count > 0;
}

/**
 * Hierarquia de status (espelho de calculateParceriaStatus no backend).
 * Ordem: do mais "avançado" para o mais "inicial".
 *
 *   Extintos                  → extinguished === true
 *   Parcerias                 → tem todos os campos de formalização
 *   Aguarda Terceiros         → review_conclusion_date + third_party
 *   Revisão                   → network_folder + observations
 *   Em análise                → responsible_user_id + responsibility_date
 *   Pendente                  → fallback
 */
export function calculateParceriaDerivedStatus(p) {
    if (isParceriaExtinguished(p)) return 'Extintos';

    if (
        getParceriaField(p, 'partnership_type') &&
        getParceriaField(p, 'partnership_number') &&
        getParceriaField(p, 'signature_date') &&
        getParceriaField(p, 'end_date') &&
        getParceriaField(p, 'renewal_notice_date')
    ) return 'Parcerias';

    if (
        getParceriaField(p, 'review_conclusion_date') &&
        getParceriaField(p, 'third_party')
    ) return 'Aguarda Terceiros';

    if (
        getParceriaField(p, 'network_folder') &&
        getParceriaField(p, 'observations')
    ) return 'Revisão';

    if (
        getParceriaField(p, 'responsible_user_id') &&
        getParceriaField(p, 'responsibility_date')
    ) return 'Em análise';

    return getParceriaField(p, 'status') || 'Pendente';
}
