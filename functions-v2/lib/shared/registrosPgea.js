"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPOS_RESUMO = exports.MODULOS_PGEA = void 0;
exports.moduloPgea = moduloPgea;
exports.normalizarNumeroPgea = normalizarNumeroPgea;
exports.resumoRegistro = resumoRegistro;
exports.ordenarResumos = ordenarResumos;
// Regras comuns de Consultas e Expedientes ligadas ao número do PGEA:
// conferência do número na criação e vínculo entre original e aditivos.
const status_1 = require("./status");
exports.MODULOS_PGEA = {
    consultas: { colecao: 'processes', campoNumero: 'process_number', nome: 'consulta' },
    expedientes: { colecao: 'expedientes', campoNumero: 'expediente_number', nome: 'expediente' },
};
function moduloPgea(m) {
    return Object.prototype.hasOwnProperty.call(exports.MODULOS_PGEA, String(m)) ? exports.MODULOS_PGEA[m] : null;
}
/**
 * Forma de comparar números: só letras e dígitos, em maiúsculas, sem zeros à
 * esquerda. "00021.000.125/2024", "21.000.125/2024" e "000210001252024"
 * são o mesmo número.
 */
function normalizarNumeroPgea(n) {
    return String(n !== null && n !== void 0 ? n : '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+/, '');
}
/** Campos lidos para resumir um registro (consulta com `.select`). */
exports.CAMPOS_RESUMO = [
    'entry_date', 'status', 'archived_date', 'reviewed_date', 'review_submission_date',
    'third_party_referral_date', 'analysis_start_date', 'responsible_user_name',
    'aditivo_de', 'aditivo_numero', 'aditivos_count',
];
function resumoRegistro(id, d, campoNumero) {
    var _a;
    return {
        id,
        numero: String((_a = d[campoNumero]) !== null && _a !== void 0 ? _a : ''),
        fase: (0, status_1.calculateStatus)(d),
        responsavel: String(d.responsible_user_name || ''),
        arquivado: Boolean(d.archived_date),
        entrada: d.entry_date || null,
        aditivo_de: d.aditivo_de || null,
        aditivo_numero: typeof d.aditivo_numero === 'number' ? d.aditivo_numero : null,
        aditivos: Number(d.aditivos_count) || 0,
    };
}
/** Original primeiro, depois os aditivos em ordem; registros soltos por data de entrada. */
function ordenarResumos(lista) {
    const raiz = (r) => r.aditivo_de || r.id;
    return [...lista].sort((a, b) => raiz(a).localeCompare(raiz(b)) || (a.aditivo_numero || 0) - (b.aditivo_numero || 0)
        || String(a.entrada || '').localeCompare(String(b.entrada || '')));
}
//# sourceMappingURL=registrosPgea.js.map