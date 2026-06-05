// ============================================================================
// dashboardMetrics — cola de domínio entre a engine de métricas e as páginas
// ----------------------------------------------------------------------------
// Responsável por:
//   - descrever as COLUNAS e FASES disponíveis de cada página (ordinária da
//     plataforma — Consultas/Expedientes — ou criada pelo admin);
//   - fornecer os ADAPTADORES (ctx) que a engine usa para ler campo/fase de
//     cada tipo de registro;
//   - resolver quais páginas estão ATIVAS (respeitando moduleConfig e os tipos
//     custom habilitados) — base para esconder métricas de páginas desligadas;
//   - métricas PADRÃO (mantêm o comportamento atual quando o admin ainda não
//     definiu nada) e a leitura/normalização da configuração salva no órgão.
//
// Persistência: organization.dashboardConfig = { pages: { [pageKey]: { metrics:[...] } } }
//   pageKey ∈ 'processes' | 'expedientes' | <entityTypeId>
// ============================================================================

import { resolveBuiltinModules } from '@/lib/organizationModules';
import { statusConfig } from '@/config/processStatus';
import { getExpedienteField, calculateExpedienteDerivedStatus } from '@/utils/expedienteUtils';
import { PHASE_FIELD_KEY } from '@/lib/metricsEngine';

// ----------------------------------------------------------------------------
// Catálogos de apresentação (cores / tamanhos / ícones permitidos)
// ----------------------------------------------------------------------------

export const METRIC_COLORS = [
    { token: 'indigo', label: 'Índigo', bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
    { token: 'emerald', label: 'Verde', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    { token: 'blue', label: 'Azul', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
    { token: 'red', label: 'Vermelho', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
    { token: 'amber', label: 'Âmbar', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
    { token: 'violet', label: 'Violeta', bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
    { token: 'pink', label: 'Rosa', bg: 'bg-pink-50', text: 'text-pink-600', dot: 'bg-pink-500' },
    { token: 'teal', label: 'Teal', bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500' },
    { token: 'orange', label: 'Laranja', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    { token: 'slate', label: 'Cinza', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-500' },
];

export const METRIC_COLOR_MAP = METRIC_COLORS.reduce((acc, c) => { acc[c.token] = c; return acc; }, {});

export function colorClasses(token) {
    return METRIC_COLOR_MAP[token] || METRIC_COLOR_MAP.indigo;
}

// Cada tamanho mapeia para um número de colunas no grid de 4 colunas (lg).
export const METRIC_SIZES = [
    { value: 1, label: 'Pequeno', span: 'lg:col-span-1' },
    { value: 2, label: 'Médio', span: 'md:col-span-2 lg:col-span-2' },
    { value: 3, label: 'Grande', span: 'md:col-span-2 lg:col-span-3' },
    { value: 4, label: 'Largura total', span: 'md:col-span-2 lg:col-span-4' },
];

export const METRIC_SIZE_MAP = METRIC_SIZES.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

export function sizeSpanClass(size) {
    return (METRIC_SIZE_MAP[size] || METRIC_SIZE_MAP[1]).span;
}

// Ícones permitidos (nomes de lucide-react). O mapa nome→componente vive em
// metricIcons.js (camada React) para manter este módulo livre de JSX.
export const METRIC_ICON_NAMES = [
    'FileText', 'Target', 'AlertTriangle', 'Clock', 'CheckCircle2', 'TrendingUp',
    'TrendingDown', 'Users', 'User', 'DollarSign', 'Hash', 'Layers', 'Calendar',
    'Activity', 'PieChart', 'BarChart3', 'Gauge', 'Flag', 'Inbox', 'Archive',
    'Star', 'Zap', 'Award', 'ClipboardList', 'Scale', 'Briefcase', 'MapPin', 'Percent',
];

// ----------------------------------------------------------------------------
// Helpers de data / ano
// ----------------------------------------------------------------------------

/** Extrai o ano (number) de variados formatos: 'YYYY-MM-DD', Date, Timestamp. */
export function parseYear(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'object') {
        if (typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000).getFullYear();
        }
        if (typeof value.toDate === 'function') {
            try { return value.toDate().getFullYear(); } catch { return null; }
        }
        if (value instanceof Date) return value.getFullYear();
    }
    const s = String(value);
    const m = /^(\d{4})-\d{2}-\d{2}/.exec(s);
    if (m) return Number(m[1]);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

// ----------------------------------------------------------------------------
// Esquemas de página (colunas + fases) para o construtor de métricas
// ----------------------------------------------------------------------------

const PROCESS_FIELD_TYPES = {
    urgency_request: 'boolean',
    entry_date: 'date',
    distribution_date: 'date',
    analysis_start_date: 'date',
    review_submission_date: 'date',
    review_return_date: 'date',
    archived_date: 'date',
    matter_category: 'text',
    matter_subcategory: 'text',
    matter_object: 'text',
    location: 'text',
    consultant: 'text',
    responsible_user_name: 'text',
    network_folder: 'text',
};

const PROCESS_FIELDS = [
    { key: 'urgency_request', label: 'Pedido de urgência', type: 'boolean' },
    { key: 'entry_date', label: 'Data de entrada', type: 'date' },
    { key: 'distribution_date', label: 'Data de distribuição', type: 'date' },
    { key: 'analysis_start_date', label: 'Início da análise', type: 'date' },
    { key: 'review_submission_date', label: 'Remessa para revisão', type: 'date' },
    { key: 'review_return_date', label: 'Devolução após revisão', type: 'date' },
    { key: 'archived_date', label: 'Arquivamento', type: 'date' },
    { key: 'matter_category', label: 'Matéria', type: 'text' },
    { key: 'matter_subcategory', label: 'Submatéria', type: 'text' },
    { key: 'location', label: 'Município', type: 'text' },
    { key: 'consultant', label: 'Consulente', type: 'text' },
    { key: 'responsible_user_name', label: 'Responsável', type: 'text' },
    { key: 'network_folder', label: 'Pasta na rede', type: 'text' },
];

const EXPEDIENTE_FIELD_TYPES = {
    urgency_request: 'boolean',
    entry_date: 'date',
    distribution_date: 'date',
    analysis_start_date: 'date',
    review_submission_date: 'date',
    review_return_date: 'date',
    archived_date: 'date',
    system: 'text',
    origin: 'text',
    object: 'text',
    responsible_user_name: 'text',
    network_folder: 'text',
    observations: 'text',
};

const EXPEDIENTE_FIELDS = [
    { key: 'urgency_request', label: 'Pedido de urgência', type: 'boolean' },
    { key: 'entry_date', label: 'Data de entrada', type: 'date' },
    { key: 'distribution_date', label: 'Data de distribuição', type: 'date' },
    { key: 'analysis_start_date', label: 'Início da análise', type: 'date' },
    { key: 'review_submission_date', label: 'Remessa para revisão', type: 'date' },
    { key: 'review_return_date', label: 'Devolução após revisão', type: 'date' },
    { key: 'archived_date', label: 'Arquivamento', type: 'date' },
    { key: 'system', label: 'Sistema', type: 'text' },
    { key: 'origin', label: 'Origem', type: 'text' },
    { key: 'object', label: 'Objeto', type: 'text' },
    { key: 'responsible_user_name', label: 'Responsável', type: 'text' },
    { key: 'network_folder', label: 'Pasta na rede', type: 'text' },
];

/** Fases/situações dos processos e expedientes (derivadas de statusConfig). */
function builtinPhases() {
    return Object.keys(statusConfig).map((key, idx) => ({
        key,
        label: statusConfig[key].label || key,
        color: statusConfig[key].color,
        order: idx,
        is_final: key === 'Na pasta',
    }));
}

export function getProcessesPageSchema() {
    return {
        key: 'processes',
        label: 'Consultas (Processos)',
        kind: 'processes',
        phaseLabel: 'Situação',
        fields: PROCESS_FIELDS,
        phases: builtinPhases(),
    };
}

export function getExpedientesPageSchema() {
    return {
        key: 'expedientes',
        label: 'Expedientes Administrativos',
        kind: 'expedientes',
        phaseLabel: 'Situação',
        fields: EXPEDIENTE_FIELDS,
        phases: builtinPhases(),
    };
}

export function getCustomPageSchema(entityType) {
    const fields = (entityType?.fields || []).map((f) => ({
        key: f.key,
        label: f.label || f.key,
        type: f.type,
        options: f.options || undefined,
    }));
    const phases = (entityType?.phases || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => ({ key: p.key, label: p.label || p.key, color: p.color, is_final: p.is_final === true }));
    return {
        key: entityType?.id,
        label: entityType?.label_plural || entityType?.label_singular || 'Personalizado',
        kind: 'custom',
        phaseLabel: 'Fase',
        fields,
        phases,
    };
}

/** Colunas numéricas (para soma/média/min/máx) de um esquema. */
export function numericFieldsOf(schema) {
    return (schema?.fields || []).filter((f) => f.type === 'number' || f.type === 'currency');
}

/** Mapa key→type das colunas de um esquema (para a engine). */
function fieldTypeMap(schema) {
    const map = {};
    for (const f of schema?.fields || []) map[f.key] = f.type;
    return map;
}

// ----------------------------------------------------------------------------
// Contexto (adaptadores) por tipo de página, consumido pela engine
// ----------------------------------------------------------------------------

/**
 * Cria o ctx que a engine usa para ler campo/fase/tipo de cada registro.
 * @param {'processes'|'expedientes'|'custom'} kind
 * @param {object} schema  Esquema da página (para getFieldType).
 */
export function buildPageContext(kind, schema) {
    if (kind === 'processes') {
        const types = PROCESS_FIELD_TYPES;
        return {
            getField: (p, key) => {
                if (key === 'status') return p?.status;
                if (key === 'urgency_request') return p?.urgency_request === true;
                return p?.[key];
            },
            getPhase: (p) => p?.status || 'Pendente',
            getFieldType: (key) => types[key] || 'text',
        };
    }
    if (kind === 'expedientes') {
        const types = EXPEDIENTE_FIELD_TYPES;
        return {
            getField: (e, key) => {
                if (key === 'status') return calculateExpedienteDerivedStatus(e);
                if (key === 'urgency_request') return getExpedienteField(e, 'urgency_request') === true;
                return getExpedienteField(e, key);
            },
            getPhase: (e) => calculateExpedienteDerivedStatus(e),
            getFieldType: (key) => types[key] || 'text',
        };
    }
    // custom
    const types = fieldTypeMap(schema);
    return {
        getField: (r, key) => r?.values?.[key],
        getPhase: (r) => r?.phase,
        getFieldType: (key) => types[key] || 'text',
    };
}

/** Ano "natural" de um registro, para o filtro de ano do painel. */
export function getRecordYear(record, kind) {
    if (kind === 'processes') return parseYear(record?.entry_date);
    if (kind === 'expedientes') return parseYear(getExpedienteField(record, 'entry_date'));
    return parseYear(record?.created_at) ?? parseYear(record?.values?.entry_date);
}

// ----------------------------------------------------------------------------
// Métricas padrão (preservam o comportamento atual do GeneralInfo)
// ----------------------------------------------------------------------------

export const DEFAULT_METRICS = {
    processes: [
        { id: 'p_total', label: 'Total do Órgão', agg: 'count', filters: [], icon: 'FileText', color: 'indigo', size: 1 },
        { id: 'p_done', label: 'Concluídos', agg: 'count', filters: [{ field: PHASE_FIELD_KEY, op: 'eq', value: 'Na pasta' }], icon: 'Target', color: 'emerald', size: 1 },
        { id: 'p_urgent', label: 'Urgentes Pendentes', agg: 'count', filters: [{ field: 'urgency_request', op: 'truthy' }, { field: PHASE_FIELD_KEY, op: 'eq', value: 'Pendente' }], icon: 'AlertTriangle', color: 'red', size: 1 },
        { id: 'p_rate', label: 'Taxa de Conclusão', agg: 'percent', filters: [{ field: PHASE_FIELD_KEY, op: 'eq', value: 'Na pasta' }], format: 'percent', icon: 'Clock', color: 'blue', size: 1 },
    ],
    expedientes: [
        { id: 'e_total', label: 'Total (Expedientes)', agg: 'count', filters: [], icon: 'FileText', color: 'indigo', size: 1 },
        { id: 'e_done', label: 'Concluídos', agg: 'count', filters: [{ field: PHASE_FIELD_KEY, op: 'eq', value: 'Na pasta' }], icon: 'Target', color: 'emerald', size: 1 },
        { id: 'e_urgent', label: 'Urgentes Pendentes', agg: 'count', filters: [{ field: 'urgency_request', op: 'truthy' }, { field: PHASE_FIELD_KEY, op: 'eq', value: 'Pendente' }], icon: 'AlertTriangle', color: 'red', size: 1 },
        { id: 'e_rate', label: 'Taxa de Conclusão', agg: 'percent', filters: [{ field: PHASE_FIELD_KEY, op: 'eq', value: 'Na pasta' }], format: 'percent', icon: 'Clock', color: 'blue', size: 1 },
    ],
};

/** Métricas padrão para uma página personalizada (quando nada foi configurado). */
export function getDefaultCustomMetrics(entityType) {
    const plural = entityType?.label_plural || entityType?.label_singular || 'Registros';
    const phases = entityType?.phases || [];
    const finals = phases.filter((p) => p.is_final === true);
    const out = [
        { id: 'c_total', label: `Total de ${plural}`, agg: 'count', filters: [], icon: 'Layers', color: 'indigo', size: 1 },
    ];
    if (finals.length) {
        const finalKeys = finals.map((p) => p.key);
        out.push({ id: 'c_done', label: 'Concluídos', agg: 'count', filters: [{ field: PHASE_FIELD_KEY, op: 'in', value: finalKeys }], icon: 'CheckCircle2', color: 'emerald', size: 1 });
        out.push({ id: 'c_rate', label: 'Taxa de Conclusão', agg: 'percent', filters: [{ field: PHASE_FIELD_KEY, op: 'in', value: finalKeys }], format: 'percent', icon: 'Gauge', color: 'blue', size: 1 });
    }
    const currency = (entityType?.fields || []).find((f) => f.type === 'currency');
    if (currency) {
        out.push({ id: 'c_sum', label: `Total ${currency.label}`, agg: 'sum', field: currency.key, format: 'currency', icon: 'DollarSign', color: 'amber', size: 1 });
    }
    return out;
}

// ----------------------------------------------------------------------------
// Páginas ativas + leitura/normalização da configuração de métricas
// ----------------------------------------------------------------------------

/**
 * Páginas de DADOS ativas do órgão (base do painel de métricas do GeneralInfo).
 * Respeita moduleConfig (quando a flag custom está ligada) e os tipos custom
 * habilitados. Com a flag DESLIGADA, devolve Consultas + Expedientes (idêntico
 * ao comportamento atual).
 */
export function getActiveDataPages(organization, opts = {}) {
    const { customEntitiesOn = false, entityTypes = [] } = opts;
    const builtin = resolveBuiltinModules(organization);
    const showProcesses = !customEntitiesOn || builtin.processes;
    const showExpedientes = !customEntitiesOn || builtin.expedientes;

    const pages = [];
    if (showProcesses) pages.push(getProcessesPageSchema());
    if (showExpedientes) pages.push(getExpedientesPageSchema());

    if (customEntitiesOn && Array.isArray(entityTypes)) {
        entityTypes
            .filter((t) => t && t.enabled !== false)
            .forEach((t) => {
                const schema = getCustomPageSchema(t);
                pages.push({ ...schema, entityType: t });
            });
    }
    return pages;
}

const VALID_AGGS = new Set(['count', 'sum', 'avg', 'min', 'max', 'percent']);
const VALID_OPS = new Set(['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'filled', 'empty', 'truthy', 'falsy', 'contains']);
const VALID_FORMATS = new Set(['auto', 'number', 'currency', 'percent']);

let metricSeq = 0;
export function generateMetricId() {
    metricSeq += 1;
    return `m_${Date.now().toString(36)}_${metricSeq}`;
}

/** Normaliza/saneia uma métrica vinda do banco ou do construtor. */
export function normalizeMetric(def) {
    if (!def || typeof def !== 'object') return null;
    const agg = VALID_AGGS.has(def.agg) ? def.agg : 'count';
    const filters = Array.isArray(def.filters)
        ? def.filters
            .filter((f) => f && typeof f === 'object' && f.field && VALID_OPS.has(f.op))
            .map((f) => {
                const out = { field: String(f.field), op: f.op };
                if (f.op === 'in' || f.op === 'nin') {
                    out.value = Array.isArray(f.value) ? f.value.map((x) => String(x)) : [String(f.value ?? '')];
                } else if (!['filled', 'empty', 'truthy', 'falsy'].includes(f.op)) {
                    out.value = f.value ?? '';
                }
                return out;
            })
        : [];
    let size = Number(def.size);
    if (!Number.isInteger(size) || size < 1 || size > 4) size = 1;
    return {
        id: def.id ? String(def.id) : generateMetricId(),
        label: String(def.label || 'Métrica').slice(0, 80),
        agg,
        field: (['sum', 'avg', 'min', 'max'].includes(agg) && def.field) ? String(def.field) : null,
        filters,
        format: VALID_FORMATS.has(def.format) ? def.format : 'auto',
        icon: METRIC_ICON_NAMES.includes(def.icon) ? def.icon : 'Hash',
        color: METRIC_COLOR_MAP[def.color] ? def.color : 'indigo',
        size,
    };
}

/** Cria uma nova métrica em branco (para o construtor). */
export function newMetric(overrides = {}) {
    return normalizeMetric({
        id: generateMetricId(),
        label: 'Nova métrica',
        agg: 'count',
        filters: [],
        format: 'auto',
        icon: 'Hash',
        color: 'indigo',
        size: 1,
        ...overrides,
    });
}

/**
 * Lê a configuração salva (se houver) de uma página; caso contrário, devolve as
 * métricas padrão. A PRESENÇA de configuração (mesmo lista vazia) é autoritativa
 * — assim o admin pode, inclusive, deixar uma página sem métricas.
 */
export function getPageMetrics(organization, page) {
    const cfg = organization?.dashboardConfig?.pages?.[page.key];
    if (cfg && Array.isArray(cfg.metrics)) {
        return cfg.metrics.map(normalizeMetric).filter(Boolean);
    }
    if (page.kind === 'processes') return DEFAULT_METRICS.processes.map(normalizeMetric);
    if (page.kind === 'expedientes') return DEFAULT_METRICS.expedientes.map(normalizeMetric);
    return getDefaultCustomMetrics(page.entityType).map(normalizeMetric);
}

/** Indica se a página já teve métricas explicitamente definidas pelo admin. */
export function pageHasCustomConfig(organization, pageKey) {
    const cfg = organization?.dashboardConfig?.pages?.[pageKey];
    return !!(cfg && Array.isArray(cfg.metrics));
}

/**
 * Monta o objeto dashboardConfig completo para salvar, aplicando uma mudança em
 * UMA página e preservando as demais. Sane­ia tudo no cliente (o servidor também
 * saneia). metricsOrNull === null remove a configuração explícita da página
 * (volta a usar os padrões).
 */
export function buildDashboardConfigForSave(organization, pageKey, metricsOrNull) {
    const existing = organization?.dashboardConfig?.pages || {};
    const pages = {};
    // Preserva páginas já configuradas (normalizadas).
    for (const [key, val] of Object.entries(existing)) {
        if (val && Array.isArray(val.metrics)) {
            pages[key] = { metrics: val.metrics.map(normalizeMetric).filter(Boolean) };
        }
    }
    if (metricsOrNull === null) {
        delete pages[pageKey];
    } else {
        pages[pageKey] = { metrics: (metricsOrNull || []).map(normalizeMetric).filter(Boolean) };
    }
    return { pages };
}
