// ============================================================================
// fieldTypes — registro de tipos de campo no cliente (espelha o servidor)
// ----------------------------------------------------------------------------
// Fornece metadados para o construtor, além de helpers de validação e
// formatação para exibição. O servidor permanece como fonte da verdade.
// ============================================================================

import { RS_CITIES } from '@/utils/cities';

export const FIELD_TYPE_LIST = [
    { type: 'text', label: 'Texto curto', icon: 'Type', hasOptions: false, group: 'Básico' },
    { type: 'textarea', label: 'Texto longo', icon: 'AlignLeft', hasOptions: false, group: 'Básico' },
    { type: 'number', label: 'Número', icon: 'Hash', hasOptions: false, group: 'Básico' },
    { type: 'currency', label: 'Valor (R$)', icon: 'DollarSign', hasOptions: false, group: 'Básico' },
    { type: 'date', label: 'Data', icon: 'Calendar', hasOptions: false, group: 'Básico' },
    { type: 'boolean', label: 'Sim/Não', icon: 'ToggleLeft', hasOptions: false, group: 'Básico' },
    { type: 'select', label: 'Lista (uma opção)', icon: 'List', hasOptions: true, group: 'Opções' },
    { type: 'multiselect', label: 'Lista (várias opções)', icon: 'ListChecks', hasOptions: true, group: 'Opções' },
    { type: 'user_ref', label: 'Pessoa (membro)', icon: 'User', hasOptions: false, group: 'Avançado' },
    { type: 'city', label: 'Município (RS)', icon: 'MapPin', hasOptions: false, group: 'Avançado' },
    { type: 'link', label: 'Link / Caminho', icon: 'Link', hasOptions: false, group: 'Avançado' },
];

export const FIELD_TYPE_META = FIELD_TYPE_LIST.reduce((acc, f) => {
    acc[f.type] = f;
    return acc;
}, {});

export const CITY_OPTIONS = RS_CITIES;

export function isEmptyValue(v) {
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Valor inicial em branco apropriado para o tipo. */
export function emptyValueForType(type) {
    if (type === 'multiselect') return [];
    if (type === 'boolean') return false;
    return '';
}

/**
 * Valida um único valor (UX). Retorna string de erro ou null.
 */
export function validateFieldValue(field, value) {
    if (isEmptyValue(value)) {
        if (field.required) return `${field.label} é obrigatório.`;
        return null;
    }
    const v = field.validation || {};
    switch (field.type) {
        case 'text':
        case 'textarea':
        case 'city':
        case 'user_ref':
        case 'link': {
            const s = String(value);
            if (v.minLength && s.length < v.minLength) return `Mínimo de ${v.minLength} caracteres.`;
            if (v.maxLength && s.length > v.maxLength) return `Máximo de ${v.maxLength} caracteres.`;
            if (v.pattern) {
                try { if (!new RegExp(v.pattern).test(s)) return 'Formato inválido.'; } catch { /* ignora */ }
            }
            return null;
        }
        case 'number':
        case 'currency': {
            const n = Number(value);
            if (!Number.isFinite(n)) return 'Informe um número válido.';
            if (v.min !== undefined && n < v.min) return `Valor mínimo é ${v.min}.`;
            if (v.max !== undefined && n > v.max) return `Valor máximo é ${v.max}.`;
            return null;
        }
        case 'date':
            if (!/^\d{4}-\d{2}-\d{2}/.test(String(value))) return 'Data inválida.';
            return null;
        case 'select': {
            const allowed = (field.options || []).map((o) => o.value);
            if (!allowed.includes(String(value))) return 'Opção inválida.';
            return null;
        }
        case 'multiselect': {
            const allowed = (field.options || []).map((o) => o.value);
            const arr = Array.isArray(value) ? value : [value];
            if (arr.some((x) => !allowed.includes(String(x)))) return 'Opção inválida.';
            return null;
        }
        default:
            return null;
    }
}

/** Valida o objeto inteiro de valores. Retorna { ok, errors }. */
export function validateAllValues(fields, values) {
    const errors = {};
    for (const f of fields || []) {
        const err = validateFieldValue(f, values?.[f.key]);
        if (err) errors[f.key] = err;
    }
    return { ok: Object.keys(errors).length === 0, errors };
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata um valor para exibição em tabela/detalhe. */
export function formatFieldValue(field, value, opts = {}) {
    if (isEmptyValue(value)) return '—';
    switch (field.type) {
        case 'currency':
            return currencyFmt.format(Number(value) || 0);
        case 'number':
            return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
        case 'date': {
            const s = String(value).slice(0, 10);
            const [y, m, d] = s.split('-');
            return d && m && y ? `${d}/${m}/${y}` : s;
        }
        case 'boolean':
            return value === true || value === 'true' ? 'Sim' : 'Não';
        case 'select': {
            const opt = (field.options || []).find((o) => o.value === String(value));
            return opt ? opt.label : String(value);
        }
        case 'multiselect': {
            const arr = Array.isArray(value) ? value : [value];
            return arr.map((x) => {
                const opt = (field.options || []).find((o) => o.value === String(x));
                return opt ? opt.label : String(x);
            }).join(', ');
        }
        case 'user_ref': {
            const m = opts.membersById?.[String(value)];
            return m?.user_name || String(value);
        }
        default:
            return String(value);
    }
}
