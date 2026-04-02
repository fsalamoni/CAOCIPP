// processUtils.js - Centralized Logic for Consultas CAOPP (v1.13.0)

/**
 * Field Aliases Mapping
 * Ensures 100% data visibility across different field name variations (Excel imports, legacy DB)
 */
export const FIELD_ALIASES = {
    process_number: ['process_number', 'numero', 'n_processo', 'processo', 'PROCESSO SIM\n(NÚMERO)', 'PROCESSO SIM\\n(NÚMERO)'],
    consultant: ['consultant', 'consulente', 'cliente', 'interessado', 'CONSULENTE'],
    location: ['location', 'local', 'cidade', 'local_fatos', 'municipio', 'LOCAL DOS FATOS\n(CIDADE)', 'LOCAL DOS FATOS\\n(CIDADE)'],
    entry_date: ['entry_date', 'data_entrada', 'entrada', 'data', 'ENTRADA NO CAOPP\n(DATA)', 'ENTRADA NO CAOPP\\n(DATA)'],
    distribution_date: ['distribution_date', 'data_distribuicao', 'distribuicao', 'DISTRIBUIÇÃO\n(DATA)', 'DISTRIBUIÇÃO\\n(DATA)'],
    analysis_start_date: ['analysis_start_date', 'inicio_analise', 'data_inicio', 'INÍCIO DA ANÁLISE\n(DATA)', 'INÍCIO DA ANÁLISE\\n(DATA)'],
    review_submission_date: ['review_submission_date', 'remessa_revisao', 'data_revisao', 'remessa', 'REMESSA AO DR. PARA REVISÃO (DATA)'],
    review_return_date: ['review_return_date', 'devolucao_revisao', 'retorno_revisao', 'retorno', 'DEVOLUÇÃO APÓS REVISÃO\n(DATA)', 'DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)'],
    archived_date: ['archived_date', 'data_arquivamento', 'arquivamento', 'data_arquivo', 'NA PASTA\nARQUIVADO\n(DATA)', 'NA PASTA\\nARQUIVADO\\n(DATA)'],
    urgency_request: ['urgency_request', 'urgente', 'prioridade', 'urgente', 'PEDIDO DE URGÊNCIA', 'Solicitação de Urgência'],
    status: ['status', 'situacao', 'estado'],
};

/**
 * Robustly get a field value from a process object using aliases
 */
export function getProcessField(p, fieldKey) {
    if (!p) return '';

    const aliases = FIELD_ALIASES[fieldKey] || [fieldKey];

    // 1. Precise Match
    for (const alias of aliases) {
        if (p[alias] !== undefined && p[alias] !== null && String(p[alias]).trim() !== '') {
            const value = p[alias];
            if (fieldKey === 'responsible_user_name') return formatPersonName(String(value));
            return value;
        }
    }

    // 2. Normalized Match (Aggressive)
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedTargetAliases = aliases.map(normalize);
    const dbKeys = Object.keys(p);

    for (const dbKey of dbKeys) {
        if (normalizedTargetAliases.includes(normalize(dbKey))) {
            const val = p[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                if (fieldKey === 'responsible_user_name') return formatPersonName(String(val));
                return val;
            }
        }
    }

    return fieldKey === 'urgency_request' ? false : '';
}

/**
 * ABSOLUTE 1-4 STATUS HIERARCHY (v1.13.0)
 * This logic must be followed strictly by BOTH frontend and backend.
 */
export function calculateDerivedStatus(p) {
    // 1. "Na pasta" (Verde): Precedência absoluta.
    if (getProcessField(p, 'archived_date')) return "Na pasta";

    // 2. "Em revisão" (Azul/Roxo): Remessa p/ Revisão preenchida.
    if (getProcessField(p, 'review_submission_date')) return "Em revisão";

    // 3. "Em elaboração" (Amarelo/Âmbar): Início da Análise preenchido.
    if (getProcessField(p, 'analysis_start_date')) return "Em elaboração";

    // 4. Fallback: Pendente (Branco) ou Status original se manual.
    return getProcessField(p, 'status') || "Pendente";
}
import { formatPersonName } from '@/utils/nameUtils';
