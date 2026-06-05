// ============================================================================
// metricsEngine — motor puro de cálculo de métricas (KPIs) do painel
// ----------------------------------------------------------------------------
// Independente de React e de domínio. Recebe:
//   - uma DEFINIÇÃO de métrica (MetricDef) criada pelo admin,
//   - um array de registros (processos, expedientes ou registros custom),
//   - um CONTEXTO (ctx) com adaptadores que sabem ler campos/fase de cada
//     registro daquela página (colunas e fases).
//
// Assim, a MESMA engine calcula métricas para qualquer página — ordinária da
// plataforma (Consultas/Expedientes) ou criada pelo admin — usando as colunas
// e as fases disponíveis.
//
// MetricDef:
//   {
//     id, label,
//     agg: 'count'|'sum'|'avg'|'min'|'max'|'percent',
//     field: string|null,            // coluna numérica p/ soma/média/min/max
//     filters: Filter[],             // condições E (todas precisam casar)
//     format: 'auto'|'number'|'currency'|'percent',
//     icon, color, size              // apresentação (size = colunas no grid)
//   }
// Filter: { field, op, value }
//   field: chave da coluna, ou '__phase__' (fase/situação atual)
//   op: 'eq'|'neq'|'in'|'nin'|'gt'|'gte'|'lt'|'lte'|'filled'|'empty'|'truthy'|'falsy'|'contains'
//
// ctx:
//   { getField(record,key), getPhase(record), getFieldType(key) }
// ============================================================================

import { isEmptyValue } from '@/lib/fieldTypes';

export const AGGREGATIONS = [
    { value: 'count', label: 'Contagem (quantidade)', needsField: false },
    { value: 'percent', label: 'Percentual do total', needsField: false },
    { value: 'sum', label: 'Soma de uma coluna', needsField: true },
    { value: 'avg', label: 'Média de uma coluna', needsField: true },
    { value: 'min', label: 'Menor valor de uma coluna', needsField: true },
    { value: 'max', label: 'Maior valor de uma coluna', needsField: true },
];

export const FILTER_OPERATORS = [
    { value: 'eq', label: 'é igual a', needsValue: true },
    { value: 'neq', label: 'é diferente de', needsValue: true },
    { value: 'in', label: 'é um de (lista)', needsValue: true, multi: true },
    { value: 'nin', label: 'não é nenhum de', needsValue: true, multi: true },
    { value: 'gt', label: 'é maior que', needsValue: true },
    { value: 'gte', label: 'é maior ou igual a', needsValue: true },
    { value: 'lt', label: 'é menor que', needsValue: true },
    { value: 'lte', label: 'é menor ou igual a', needsValue: true },
    { value: 'contains', label: 'contém o texto', needsValue: true },
    { value: 'filled', label: 'está preenchido', needsValue: false },
    { value: 'empty', label: 'está vazio', needsValue: false },
    { value: 'truthy', label: 'é Sim/verdadeiro', needsValue: false },
    { value: 'falsy', label: 'é Não/falso', needsValue: false },
];

export const PHASE_FIELD_KEY = '__phase__';

const NUMERIC_TYPES = new Set(['number', 'currency']);

/** Converte para número finito ou null. */
export function toNumberOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Converte uma data ('YYYY-MM-DD' ou similar) para milissegundos, ou null. */
function toDateMs(v) {
    if (isEmptyValue(v)) return null;
    const s = String(v).slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function isTruthy(v) {
    return v === true || v === 'true' || v === 1 || v === '1' || v === 'sim';
}

/**
 * Avalia uma única condição sobre o valor já extraído do registro.
 */
function valueMatches(value, op, target, fieldType) {
    switch (op) {
        case 'filled':
            return !isEmptyValue(value);
        case 'empty':
            return isEmptyValue(value);
        case 'truthy':
            return isTruthy(value);
        case 'falsy':
            return !isTruthy(value);
        default:
            break;
    }

    // Operadores de lista.
    if (op === 'in' || op === 'nin') {
        const list = Array.isArray(target) ? target.map((x) => String(x)) : [String(target)];
        const valArr = Array.isArray(value) ? value.map((x) => String(x)) : [String(value)];
        const hit = valArr.some((x) => list.includes(x));
        return op === 'in' ? hit : !hit;
    }

    if (op === 'contains') {
        if (Array.isArray(value)) {
            return value.some((x) => String(x).toLowerCase().includes(String(target).toLowerCase()));
        }
        if (isEmptyValue(value)) return false;
        return String(value).toLowerCase().includes(String(target).toLowerCase());
    }

    // Comparações numéricas / data / texto.
    const isNumeric = NUMERIC_TYPES.has(fieldType);
    const isDate = fieldType === 'date';

    if (isNumeric || isDate) {
        const a = isDate ? toDateMs(value) : toNumberOrNull(value);
        const b = isDate ? toDateMs(target) : toNumberOrNull(target);
        if (a === null || b === null) {
            // Sem número/data comparável: só 'neq' pode ser verdadeiro.
            return op === 'neq';
        }
        switch (op) {
            case 'eq': return a === b;
            case 'neq': return a !== b;
            case 'gt': return a > b;
            case 'gte': return a >= b;
            case 'lt': return a < b;
            case 'lte': return a <= b;
            default: return false;
        }
    }

    // Texto / seleção / fase.
    const valStr = Array.isArray(value) ? value.map((x) => String(x)) : [String(value ?? '')];
    const tgt = String(target ?? '');
    switch (op) {
        case 'eq': return valStr.includes(tgt);
        case 'neq': return !valStr.includes(tgt);
        case 'gt': return valStr[0] > tgt;
        case 'gte': return valStr[0] >= tgt;
        case 'lt': return valStr[0] < tgt;
        case 'lte': return valStr[0] <= tgt;
        default: return false;
    }
}

/**
 * Indica se um registro casa com TODAS as condições (E lógico).
 */
export function recordMatchesFilters(record, filters, ctx) {
    if (!Array.isArray(filters) || filters.length === 0) return true;
    for (const f of filters) {
        if (!f || !f.field) continue;
        const isPhase = f.field === PHASE_FIELD_KEY;
        const value = isPhase ? ctx.getPhase(record) : ctx.getField(record, f.field);
        const fieldType = isPhase ? 'select' : (ctx.getFieldType ? ctx.getFieldType(f.field) : 'text');
        if (!valueMatches(value, f.op, f.value, fieldType)) return false;
    }
    return true;
}

/**
 * Calcula o valor bruto de uma métrica sobre os registros (já filtrados por ano).
 * Retorna { raw:number, count:number } onde raw é o número final e count é a
 * quantidade de registros que entraram no cálculo.
 */
export function computeMetricValue(def, records, ctx) {
    const list = Array.isArray(records) ? records : [];
    const matched = list.filter((r) => recordMatchesFilters(r, def.filters, ctx));

    switch (def.agg) {
        case 'count':
            return { raw: matched.length, count: matched.length };
        case 'percent': {
            const denom = list.length;
            const raw = denom > 0 ? (matched.length / denom) * 100 : 0;
            return { raw, count: matched.length };
        }
        case 'sum':
        case 'avg':
        case 'min':
        case 'max': {
            const nums = [];
            for (const r of matched) {
                const n = toNumberOrNull(ctx.getField(r, def.field));
                if (n !== null) nums.push(n);
            }
            if (nums.length === 0) return { raw: 0, count: 0 };
            if (def.agg === 'sum') return { raw: nums.reduce((a, b) => a + b, 0), count: nums.length };
            if (def.agg === 'avg') return { raw: nums.reduce((a, b) => a + b, 0) / nums.length, count: nums.length };
            if (def.agg === 'min') return { raw: Math.min(...nums), count: nums.length };
            return { raw: Math.max(...nums), count: nums.length };
        }
        default:
            return { raw: matched.length, count: matched.length };
    }
}

const numberFmt = new Intl.NumberFormat('pt-BR');
const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimalFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * Resolve o formato efetivo de uma métrica ('auto' → baseado no agg/coluna).
 */
export function resolveMetricFormat(def, fieldType) {
    if (def.format && def.format !== 'auto') return def.format;
    if (def.agg === 'percent') return 'percent';
    if (NUMERIC_TYPES.has(fieldType) && fieldType === 'currency') return 'currency';
    return 'number';
}

/**
 * Formata o valor bruto para exibição.
 */
export function formatMetricValue(raw, def, fieldType) {
    const fmt = resolveMetricFormat(def, fieldType);
    if (raw === null || raw === undefined || Number.isNaN(raw)) return '—';
    switch (fmt) {
        case 'percent':
            return `${Math.round(raw)}%`;
        case 'currency':
            return currencyFmt.format(raw);
        case 'number':
        default:
            // Inteiro para contagens; uma casa decimal para médias fracionárias.
            if (Number.isInteger(raw)) return numberFmt.format(raw);
            return decimalFmt.format(raw);
    }
}

/**
 * Conveniência: calcula e formata em uma chamada.
 * Retorna { raw, count, display }.
 */
export function evaluateMetric(def, records, ctx) {
    const { raw, count } = computeMetricValue(def, records, ctx);
    const fieldType = def.field && ctx.getFieldType ? ctx.getFieldType(def.field) : null;
    return { raw, count, display: formatMetricValue(raw, def, fieldType) };
}
