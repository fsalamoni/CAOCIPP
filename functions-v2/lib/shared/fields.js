"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_ALIASES = void 0;
exports.getSmartField = getSmartField;
/**
 * Field Aliases Mapping
 * Synchronized with ProcessTable.jsx and EditProcessDialog.jsx
 */
exports.FIELD_ALIASES = {
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
function getSmartField(process, fieldKey) {
    if (!process)
        return null;
    const aliases = exports.FIELD_ALIASES[fieldKey] || [fieldKey];
    // 1. Precise Match
    for (const alias of aliases) {
        if (process[alias] !== undefined && process[alias] !== null && String(process[alias]).trim() !== '') {
            return process[alias];
        }
    }
    // 2. Normalized Match (Aggressive)
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedTargetAliases = aliases.map(normalize);
    const dbKeys = Object.keys(process);
    for (const dbKey of dbKeys) {
        if (normalizedTargetAliases.includes(normalize(dbKey))) {
            const val = process[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                return val;
            }
        }
    }
    return null;
}
//# sourceMappingURL=fields.js.map