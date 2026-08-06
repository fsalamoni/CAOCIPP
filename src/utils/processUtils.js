import { formatPersonName } from '@/utils/nameUtils';

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
    third_party_referral_date: ['third_party_referral_date', 'remessa_terceiros', 'data_remessa_terceiros'],
    third_party_recipient: ['third_party_recipient', 'remetido_para', 'destinatario_terceiros'],
    review_submission_date: ['review_submission_date', 'remessa_revisao', 'data_revisao', 'remessa', 'REMESSA AO DR. PARA REVISÃO (DATA)'],
    reviewed_date: ['reviewed_date', 'data_revisao_concluida', 'revisado', 'revisao_concluida', 'REVISÃO CONCLUÍDA (DATA)', 'REVISADAS\n(DATA)'],
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

    try {
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
    const normalize = (s) => {
        if (s == null) return '';
        try {
            return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        } catch (e) {
            if (typeof window !== 'undefined' && window.console) {
                console.warn('[getProcessField] normalize error', { s, fieldKey, e });
            }
            return '';
        }
    };
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
    } catch (e) {
        if (typeof window !== 'undefined' && window.console) {
            console.error('[getProcessField] CRASH', { p, fieldKey, e: e?.message, stack: e?.stack });
        }
        return fieldKey === 'urgency_request' ? false : '';
    }
}

/**
 * Normaliza urgency_request: aceita tanto boolean true quanto strings legadas
 * de import ('Sim'/'sim'). Centralizado aqui para não divergir entre
 * ProcessTable/KanbanCard/ProcessDetailSheet — um `=== true` estrito nesses
 * componentes deixava de marcar como urgente qualquer processo importado com
 * o valor em texto.
 */
export function isProcessUrgent(p) {
    const val = getProcessField(p, 'urgency_request');
    return val === true || String(val).toLowerCase().trim() === 'sim';
}

/**
 * ABSOLUTE 1-4 STATUS HIERARCHY (v1.13.0)
 * This logic must be followed strictly by BOTH frontend and backend.
 */
export function calculateDerivedStatus(p) {
    // 1. "Na pasta" (Verde): Precedência absoluta.
    if (getProcessField(p, 'archived_date')) return "Na pasta";

    // 2. "Revisadas" (Roxo): Revisão concluída pelo responsável.
    if (getProcessField(p, 'reviewed_date')) return "Revisadas";

    // 3. "Em revisão" (Azul): Remessa p/ Revisão preenchida.
    if (getProcessField(p, 'review_submission_date')) return "Em revisão";

    // 3.5. "Aguarda retorno de terceiros" (Ciano): fase OPCIONAL — remessa a
    // terceiros preenchida mas ainda sem remessa p/ revisão. Um processo pode
    // nunca passar por aqui (vai direto de "Em elaboração" p/ "Em revisão")
    // ou entrar e sair normalmente; a precedência de "Em revisão" acima
    // garante que passar direto por esta fase não trava o processo aqui.
    if (getProcessField(p, 'third_party_referral_date')) return "Aguarda retorno de terceiros";

    // 4. "Em elaboração" (Amarelo/Âmbar): Início da Análise preenchido.
    if (getProcessField(p, 'analysis_start_date')) return "Em elaboração";

    // 5. Fallback: Pendente (Branco) ou Status original se manual.
    return getProcessField(p, 'status') || "Pendente";
}
