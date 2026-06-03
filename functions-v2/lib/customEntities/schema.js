"use strict";
// ============================================================================
// customEntities/schema — definição + validação (autoridade do servidor)
// ----------------------------------------------------------------------------
// Tipos de campo suportados (v1):
//   text, textarea, number, currency, date, boolean, select, multiselect,
//   user_ref (membro do órgão), city (lista RS), link.
// O cliente espelha estas regras para UX; o SERVIDOR é a fonte da verdade.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_TYPES = void 0;
exports.sanitizeEntityTypeDefinition = sanitizeEntityTypeDefinition;
exports.validateRecordValues = validateRecordValues;
exports.FIELD_TYPES = [
    'text', 'textarea', 'number', 'currency', 'date', 'boolean',
    'select', 'multiselect', 'user_ref', 'city', 'link',
];
const SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;
function isPlainString(v) {
    return typeof v === 'string';
}
function toNumberOrNull(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
/**
 * Sanitiza/valida uma definição de tipo de entidade vinda do cliente.
 * Lança Error com mensagem amigável quando inválida.
 */
function sanitizeEntityTypeDefinition(input) {
    if (!input || typeof input !== 'object') {
        throw new Error('Definição inválida.');
    }
    const label_singular = String(input.label_singular || '').trim();
    const label_plural = String(input.label_plural || '').trim();
    if (!label_singular || !label_plural) {
        throw new Error('Informe o nome no singular e no plural.');
    }
    const rawFields = Array.isArray(input.fields) ? input.fields : [];
    if (rawFields.length === 0) {
        throw new Error('Crie pelo menos um campo.');
    }
    const seenKeys = new Set();
    const fields = rawFields.map((f, idx) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const key = String((f === null || f === void 0 ? void 0 : f.key) || '').trim();
        if (!SLUG_RE.test(key)) {
            throw new Error(`Chave de campo inválida: "${key}". Use apenas letras minúsculas, números e _ (começando por letra).`);
        }
        if (seenKeys.has(key)) {
            throw new Error(`Chave de campo duplicada: "${key}".`);
        }
        seenKeys.add(key);
        const type = String((f === null || f === void 0 ? void 0 : f.type) || '');
        if (!exports.FIELD_TYPES.includes(type)) {
            throw new Error(`Tipo de campo inválido: "${type}".`);
        }
        const label = String((f === null || f === void 0 ? void 0 : f.label) || '').trim();
        if (!label) {
            throw new Error(`O campo "${key}" precisa de um rótulo.`);
        }
        let options;
        if (type === 'select' || type === 'multiselect') {
            const rawOpts = Array.isArray(f === null || f === void 0 ? void 0 : f.options) ? f.options : [];
            options = rawOpts
                .map((o) => {
                var _a, _b, _c, _d;
                return (Object.assign({ value: String((_b = (_a = o === null || o === void 0 ? void 0 : o.value) !== null && _a !== void 0 ? _a : o === null || o === void 0 ? void 0 : o.label) !== null && _b !== void 0 ? _b : '').trim(), label: String((_d = (_c = o === null || o === void 0 ? void 0 : o.label) !== null && _c !== void 0 ? _c : o === null || o === void 0 ? void 0 : o.value) !== null && _d !== void 0 ? _d : '').trim() }, ((o === null || o === void 0 ? void 0 : o.color) ? { color: String(o.color) } : {})));
            })
                .filter((o) => o.value !== '');
            if (!options || options.length === 0) {
                throw new Error(`O campo de lista "${label}" precisa de pelo menos uma opção.`);
            }
        }
        const validation = {};
        if ((f === null || f === void 0 ? void 0 : f.validation) && typeof f.validation === 'object') {
            const v = f.validation;
            const min = toNumberOrNull(v.min);
            if (min !== null)
                validation.min = min;
            const max = toNumberOrNull(v.max);
            if (max !== null)
                validation.max = max;
            const minLength = toNumberOrNull(v.minLength);
            if (minLength !== null)
                validation.minLength = minLength;
            const maxLength = toNumberOrNull(v.maxLength);
            if (maxLength !== null)
                validation.maxLength = maxLength;
            if (isPlainString(v.pattern) && v.pattern)
                validation.pattern = v.pattern;
        }
        const out = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ key,
            label,
            type, required: (f === null || f === void 0 ? void 0 : f.required) === true }, ((f === null || f === void 0 ? void 0 : f.help) ? { help: String(f.help) } : {})), (options ? { options } : {})), ((f === null || f === void 0 ? void 0 : f.default) !== undefined ? { default: f.default } : {})), (Object.keys(validation).length ? { validation } : {})), { table: Object.assign({ show: ((_a = f === null || f === void 0 ? void 0 : f.table) === null || _a === void 0 ? void 0 : _a.show) !== false, order: (_c = toNumberOrNull((_b = f === null || f === void 0 ? void 0 : f.table) === null || _b === void 0 ? void 0 : _b.order)) !== null && _c !== void 0 ? _c : idx }, (toNumberOrNull((_d = f === null || f === void 0 ? void 0 : f.table) === null || _d === void 0 ? void 0 : _d.width) !== null ? { width: toNumberOrNull((_e = f === null || f === void 0 ? void 0 : f.table) === null || _e === void 0 ? void 0 : _e.width) } : {})), form: Object.assign(Object.assign({ show: ((_f = f === null || f === void 0 ? void 0 : f.form) === null || _f === void 0 ? void 0 : _f.show) !== false }, (((_g = f === null || f === void 0 ? void 0 : f.form) === null || _g === void 0 ? void 0 : _g.section) ? { section: String(f.form.section) } : {})), { order: (_j = toNumberOrNull((_h = f === null || f === void 0 ? void 0 : f.form) === null || _h === void 0 ? void 0 : _h.order)) !== null && _j !== void 0 ? _j : idx }) });
        return out;
    });
    const rawPhases = Array.isArray(input.phases) ? input.phases : [];
    if (rawPhases.length === 0) {
        throw new Error('Crie pelo menos uma fase (coluna do painel).');
    }
    const seenPhase = new Set();
    const phases = rawPhases.map((p, idx) => {
        var _a;
        const key = String((p === null || p === void 0 ? void 0 : p.key) || '').trim();
        if (!SLUG_RE.test(key)) {
            throw new Error(`Chave de fase inválida: "${key}".`);
        }
        if (seenPhase.has(key)) {
            throw new Error(`Chave de fase duplicada: "${key}".`);
        }
        seenPhase.add(key);
        const label = String((p === null || p === void 0 ? void 0 : p.label) || '').trim();
        if (!label) {
            throw new Error(`A fase "${key}" precisa de um rótulo.`);
        }
        return Object.assign(Object.assign(Object.assign({ key,
            label }, ((p === null || p === void 0 ? void 0 : p.color) ? { color: String(p.color) } : {})), { order: (_a = toNumberOrNull(p === null || p === void 0 ? void 0 : p.order)) !== null && _a !== void 0 ? _a : idx, is_initial: (p === null || p === void 0 ? void 0 : p.is_initial) === true, is_final: (p === null || p === void 0 ? void 0 : p.is_final) === true }), (toNumberOrNull(p === null || p === void 0 ? void 0 : p.wip_limit) !== null ? { wip_limit: toNumberOrNull(p === null || p === void 0 ? void 0 : p.wip_limit) } : {}));
    });
    // Garante exatamente uma fase inicial (a primeira se nenhuma marcada).
    if (!phases.some((p) => p.is_initial)) {
        phases[0].is_initial = true;
    }
    const fieldKeySet = new Set(fields.map((f) => f.key));
    const phaseKeySet = new Set(phases.map((p) => p.key));
    const rawTransitions = Array.isArray(input.transitions) ? input.transitions : [];
    const transitions = rawTransitions.map((t, idx) => {
        const from = String((t === null || t === void 0 ? void 0 : t.from) || '*').trim() || '*';
        const to = String((t === null || t === void 0 ? void 0 : t.to) || '').trim();
        if (!phaseKeySet.has(to)) {
            throw new Error(`Regra de transição inválida: fase de destino "${to}" não existe.`);
        }
        if (from !== '*' && !phaseKeySet.has(from)) {
            throw new Error(`Regra de transição inválida: fase de origem "${from}" não existe.`);
        }
        const reqs = Array.isArray(t === null || t === void 0 ? void 0 : t.requirements) ? t.requirements.map((r) => {
            var _a, _b;
            const type = String((r === null || r === void 0 ? void 0 : r.type) || '');
            if (!['field_required', 'field_condition', 'min_value', 'approval'].includes(type)) {
                throw new Error('Tipo de requisito inválido em uma regra de transição.');
            }
            if ((type === 'field_required' || type === 'field_condition' || type === 'min_value')) {
                const field = String((r === null || r === void 0 ? void 0 : r.field) || '').trim();
                if (!fieldKeySet.has(field)) {
                    throw new Error(`Regra de transição referencia campo inexistente: "${field}".`);
                }
                const req = { type, field };
                if (type === 'field_condition') {
                    req.operator = String((r === null || r === void 0 ? void 0 : r.operator) || 'eq');
                    req.value = r === null || r === void 0 ? void 0 : r.value;
                }
                if (type === 'min_value') {
                    req.value = (_a = toNumberOrNull(r === null || r === void 0 ? void 0 : r.value)) !== null && _a !== void 0 ? _a : 0;
                }
                return req;
            }
            // approval
            const mode = (r === null || r === void 0 ? void 0 : r.mode) === 'users' ? 'users' : 'roles';
            const req = {
                type: 'approval',
                mode,
                count: (_b = toNumberOrNull(r === null || r === void 0 ? void 0 : r.count)) !== null && _b !== void 0 ? _b : 1,
            };
            if (mode === 'users') {
                req.users = Array.isArray(r === null || r === void 0 ? void 0 : r.users) ? r.users.map((u) => String(u)).filter(Boolean) : [];
            }
            else {
                req.roles = Array.isArray(r === null || r === void 0 ? void 0 : r.roles) && r.roles.length
                    ? r.roles.map((u) => String(u)).filter(Boolean)
                    : ['creator', 'admin'];
            }
            return req;
        }) : [];
        return Object.assign(Object.assign({ id: String((t === null || t === void 0 ? void 0 : t.id) || `t_${idx}`), from,
            to }, (reqs.length ? { requirements: reqs } : {})), ((t === null || t === void 0 ? void 0 : t.on_success) ? { on_success: sanitizeOnSuccess(t.on_success, fieldKeySet) } : {}));
    });
    const out = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ label_singular,
        label_plural }, (input.key && SLUG_RE.test(String(input.key)) ? { key: String(input.key) } : {})), (input.icon ? { icon: String(input.icon) } : {})), (input.color ? { color: String(input.color) } : {})), (toNumberOrNull(input.order) !== null ? { order: toNumberOrNull(input.order) } : {})), { enabled: input.enabled !== false, fields,
        phases }), (transitions.length ? { transitions } : {})), (input.form_layout ? { form_layout: sanitizeFormLayout(input.form_layout, fieldKeySet) } : {})), (input.table_layout ? { table_layout: sanitizeTableLayout(input.table_layout, fieldKeySet) } : {})), (input.kpi_config ? { kpi_config: sanitizeKpiConfig(input.kpi_config) } : {}));
    return out;
}
function sanitizeOnSuccess(input, fieldKeySet) {
    const out = {};
    if (Array.isArray(input === null || input === void 0 ? void 0 : input.set_fields)) {
        out.set_fields = input.set_fields
            .map((s) => ({ field: String((s === null || s === void 0 ? void 0 : s.field) || '').trim(), value: s === null || s === void 0 ? void 0 : s.value }))
            .filter((s) => fieldKeySet.has(s.field));
    }
    if ((input === null || input === void 0 ? void 0 : input.require_comment) === true)
        out.require_comment = true;
    return out;
}
function sanitizeFormLayout(input, fieldKeySet) {
    const sections = Array.isArray(input === null || input === void 0 ? void 0 : input.sections) ? input.sections : [];
    return {
        sections: sections.map((s) => ({
            title: String((s === null || s === void 0 ? void 0 : s.title) || '').trim(),
            field_keys: (Array.isArray(s === null || s === void 0 ? void 0 : s.field_keys) ? s.field_keys : [])
                .map((k) => String(k))
                .filter((k) => fieldKeySet.has(k)),
        })),
    };
}
function sanitizeTableLayout(input, fieldKeySet) {
    var _a;
    const columns = Array.isArray(input === null || input === void 0 ? void 0 : input.columns) ? input.columns : [];
    const out = {
        columns: columns
            .map((c, i) => {
            var _a;
            return (Object.assign({ field_key: String((c === null || c === void 0 ? void 0 : c.field_key) || ''), order: (_a = toNumberOrNull(c === null || c === void 0 ? void 0 : c.order)) !== null && _a !== void 0 ? _a : i }, (toNumberOrNull(c === null || c === void 0 ? void 0 : c.width) !== null ? { width: toNumberOrNull(c === null || c === void 0 ? void 0 : c.width) } : {})));
        })
            .filter((c) => fieldKeySet.has(c.field_key)),
    };
    if (((_a = input === null || input === void 0 ? void 0 : input.default_sort) === null || _a === void 0 ? void 0 : _a.field_key) && fieldKeySet.has(String(input.default_sort.field_key))) {
        out.default_sort = {
            field_key: String(input.default_sort.field_key),
            dir: input.default_sort.dir === 'asc' ? 'asc' : 'desc',
        };
    }
    return out;
}
function sanitizeKpiConfig(input) {
    return {
        cards: Array.isArray(input === null || input === void 0 ? void 0 : input.cards) ? input.cards.slice(0, 12) : [],
        charts: Array.isArray(input === null || input === void 0 ? void 0 : input.charts) ? input.charts.slice(0, 8) : [],
    };
}
function isEmptyValue(v) {
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}
/**
 * Valida e normaliza um conjunto de valores contra os campos definidos.
 * Retorna { ok, errors, normalized }.
 */
function validateRecordValues(fields, values, opts = {}) {
    var _a, _b, _c, _d, _e;
    const errors = {};
    const normalized = {};
    const input = values && typeof values === 'object' ? values : {};
    for (const field of fields) {
        const provided = Object.prototype.hasOwnProperty.call(input, field.key);
        if (opts.partial && !provided)
            continue;
        const raw = input[field.key];
        if (isEmptyValue(raw)) {
            if (field.required && !opts.partial) {
                errors[field.key] = `${field.label} é obrigatório.`;
            }
            normalized[field.key] = field.type === 'multiselect' ? [] : (field.type === 'boolean' ? false : null);
            continue;
        }
        switch (field.type) {
            case 'text':
            case 'textarea':
            case 'city':
            case 'user_ref':
            case 'link': {
                const s = String(raw);
                if (((_a = field.validation) === null || _a === void 0 ? void 0 : _a.minLength) && s.length < field.validation.minLength) {
                    errors[field.key] = `${field.label}: mínimo de ${field.validation.minLength} caracteres.`;
                }
                if (((_b = field.validation) === null || _b === void 0 ? void 0 : _b.maxLength) && s.length > field.validation.maxLength) {
                    errors[field.key] = `${field.label}: máximo de ${field.validation.maxLength} caracteres.`;
                }
                if ((_c = field.validation) === null || _c === void 0 ? void 0 : _c.pattern) {
                    try {
                        if (!new RegExp(field.validation.pattern).test(s)) {
                            errors[field.key] = `${field.label}: formato inválido.`;
                        }
                    }
                    catch ( /* pattern inválido ignora */_f) { /* pattern inválido ignora */ }
                }
                if (field.type === 'link' && s && !/^(https?:\/\/|\/|\\\\|[a-zA-Z]:\\)/.test(s)) {
                    // aceita URLs http(s) ou caminhos de rede/arquivo; senão apenas guarda.
                }
                normalized[field.key] = s;
                break;
            }
            case 'number':
            case 'currency': {
                const n = Number(raw);
                if (!Number.isFinite(n)) {
                    errors[field.key] = `${field.label}: informe um número válido.`;
                    break;
                }
                if (((_d = field.validation) === null || _d === void 0 ? void 0 : _d.min) !== undefined && n < field.validation.min) {
                    errors[field.key] = `${field.label}: valor mínimo é ${field.validation.min}.`;
                }
                if (((_e = field.validation) === null || _e === void 0 ? void 0 : _e.max) !== undefined && n > field.validation.max) {
                    errors[field.key] = `${field.label}: valor máximo é ${field.validation.max}.`;
                }
                normalized[field.key] = n;
                break;
            }
            case 'date': {
                const s = String(raw);
                if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
                    errors[field.key] = `${field.label}: data inválida.`;
                }
                normalized[field.key] = s.slice(0, 10);
                break;
            }
            case 'boolean': {
                normalized[field.key] = raw === true || raw === 'true';
                break;
            }
            case 'select': {
                const allowed = new Set((field.options || []).map((o) => o.value));
                const s = String(raw);
                if (!allowed.has(s)) {
                    errors[field.key] = `${field.label}: opção inválida.`;
                }
                normalized[field.key] = s;
                break;
            }
            case 'multiselect': {
                const allowed = new Set((field.options || []).map((o) => o.value));
                const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [String(raw)];
                const invalid = arr.filter((x) => !allowed.has(x));
                if (invalid.length) {
                    errors[field.key] = `${field.label}: opção(ões) inválida(s).`;
                }
                normalized[field.key] = arr;
                break;
            }
            default:
                normalized[field.key] = raw;
        }
    }
    return { ok: Object.keys(errors).length === 0, errors, normalized };
}
//# sourceMappingURL=schema.js.map