import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Save, RotateCcw, Gauge,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/ui/EmptyState';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useEntityTypes } from '@/hooks/useCustomEntities';
import { updateOrganization } from '@/services/functionsService';
import { logger } from '@/utils/logger';
import { PHASE_FIELD_KEY } from '@/lib/metricsEngine';
import {
    getActiveDataPages, getPageMetrics, getDefaultCustomMetrics, DEFAULT_METRICS,
    buildDashboardConfigForSave, newMetric, normalizeMetric, colorClasses, sizeSpanClass,
    METRIC_SIZES,
} from '@/lib/dashboardMetrics';
import { MetricIcon } from '@/components/organization/metricIcons';
import MetricEditorDialog from './MetricEditorDialog';

const AGG_SHORT = { count: 'Contagem', percent: 'Percentual', sum: 'Soma', avg: 'Média', min: 'Menor', max: 'Maior' };
const OP_SHORT = {
    eq: '=', neq: '≠', in: 'é um de', nin: 'não é', gt: '>', gte: '≥', lt: '<', lte: '≤',
    contains: 'contém', filled: 'preenchido', empty: 'vazio', truthy: 'Sim', falsy: 'Não',
};

const selectCls = 'h-10 w-full px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700';

function fieldLabelOf(schema, key) {
    if (key === PHASE_FIELD_KEY) return schema.phaseLabel || 'Fase';
    const f = (schema.fields || []).find((x) => x.key === key);
    return f ? f.label : key;
}
function optionsOf(schema, key) {
    if (key === PHASE_FIELD_KEY) return (schema.phases || []).map((p) => ({ value: p.key, label: p.label }));
    const f = (schema.fields || []).find((x) => x.key === key);
    return (f?.options || []).map((o) => ({ value: o.value, label: o.label }));
}
function valueLabelOf(schema, key, value) {
    const opts = optionsOf(schema, key);
    const resolve = (v) => { const o = opts.find((x) => x.value === String(v)); return o ? o.label : String(v); };
    if (Array.isArray(value)) return value.map(resolve).join(' ou ');
    return resolve(value);
}
function describeFilter(schema, f) {
    const fl = fieldLabelOf(schema, f.field);
    const op = OP_SHORT[f.op] || f.op;
    if (['filled', 'empty', 'truthy', 'falsy'].includes(f.op)) return `${fl}: ${op}`;
    return `${fl} ${op} ${valueLabelOf(schema, f.field, f.value)}`;
}
function describeMetric(schema, m) {
    let base = AGG_SHORT[m.agg] || m.agg;
    if (m.field) base += ` · ${fieldLabelOf(schema, m.field)}`;
    if (m.filters?.length) base += ` · onde ${m.filters.map((f) => describeFilter(schema, f)).join(' e ')}`;
    return base;
}

/**
 * Gerenciador de métricas por página (Painel Administrativo). Permite ao admin
 * criar, editar, reordenar, redimensionar e excluir as métricas exibidas na
 * página de Informações Gerais — para cada página habilitada (Consultas,
 * Expedientes ou páginas criadas pelo admin), usando suas colunas e fases.
 * Tudo é salvo em organization.dashboardConfig.
 */
export default function MetricsManager({ organization }) {
    const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);
    const { entityTypes, isLoading: typesLoading } = useEntityTypes(customEntitiesOn ? organization?.id : null);

    const pages = useMemo(
        () => getActiveDataPages(organization, { customEntitiesOn, entityTypes }),
        [organization, customEntitiesOn, entityTypes]
    );

    const [selectedKey, setSelectedKey] = useState(null);
    const selectedPage = useMemo(
        () => pages.find((p) => p.key === selectedKey) || pages[0] || null,
        [pages, selectedKey]
    );

    const [metrics, setMetrics] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingIdx, setEditingIdx] = useState(-1);
    const [editingMetric, setEditingMetric] = useState(null);

    // (Re)semeia a lista quando troca de página ou quando a config do órgão muda
    // e não há edições pendentes.
    const reseed = useCallback((page) => {
        if (!page) { setMetrics([]); return; }
        setMetrics(getPageMetrics(organization, page));
        setDirty(false);
    }, [organization]);

    useEffect(() => {
        if (!selectedPage) return;
        if (!dirty) reseed(selectedPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPage?.key, organization?.dashboardConfig]);

    const switchPage = (key) => {
        if (dirty && !window.confirm('Há alterações não salvas nesta página. Descartar?')) return;
        setSelectedKey(key);
        const page = pages.find((p) => p.key === key);
        reseed(page);
    };

    const mutate = (next) => { setMetrics(next); setDirty(true); };

    const move = (idx, dir) => {
        const j = idx + dir;
        if (j < 0 || j >= metrics.length) return;
        const next = metrics.slice();
        [next[idx], next[j]] = [next[j], next[idx]];
        mutate(next);
    };
    const setSize = (idx, size) => mutate(metrics.map((m, i) => (i === idx ? { ...m, size } : m)));
    const removeMetric = (idx) => mutate(metrics.filter((_, i) => i !== idx));
    const openCreate = () => { setEditingIdx(-1); setEditingMetric(newMetric()); setEditorOpen(true); };
    const openEdit = (idx) => { setEditingIdx(idx); setEditingMetric(metrics[idx]); setEditorOpen(true); };
    const onEditorSave = (metric) => {
        if (editingIdx < 0) mutate([...metrics, metric]);
        else mutate(metrics.map((m, i) => (i === editingIdx ? metric : m)));
    };

    const restoreDefaults = () => {
        if (!selectedPage) return;
        if (dirty && !window.confirm('Substituir as métricas atuais pelos padrões da plataforma?')) return;
        const defaults = selectedPage.kind === 'processes'
            ? DEFAULT_METRICS.processes
            : selectedPage.kind === 'expedientes'
                ? DEFAULT_METRICS.expedientes
                : getDefaultCustomMetrics(selectedPage.entityType);
        mutate(defaults.map(normalizeMetric));
    };

    const handleSave = async () => {
        if (!selectedPage) return;
        try {
            setIsSaving(true);
            const dashboardConfig = buildDashboardConfigForSave(organization, selectedPage.key, metrics);
            await updateOrganization({ organizationId: organization.id, data: { dashboardConfig } });
            toast.success('Métricas salvas com sucesso!');
            setDirty(false);
        } catch (error) {
            logger.error('Erro ao salvar métricas:', error);
            toast.error('Erro ao salvar métricas: ' + (error?.message || 'tente novamente'));
        } finally {
            setIsSaving(false);
        }
    };

    // Sem a flag de páginas personalizadas, o gerenciador ainda funciona para as
    // páginas ordinárias (Consultas e Expedientes): o admin pode criar, editar,
    // reordenar e redimensionar as métricas exibidas em Informações Gerais.
    // Páginas personalizadas só aparecem na lista quando a flag está ligada.
    if (typesLoading && pages.length === 0) {
        return (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
        );
    }

    if (pages.length === 0) {
        return (
            <EmptyState
                icon={Gauge}
                title="Nenhuma página habilitada"
                description="Ative páginas em 'Páginas e Módulos' para então configurar suas métricas."
            />
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Métricas das páginas</h3>
                <p className="text-sm text-slate-500">
                    Defina os indicadores que aparecem na página <strong>Informações Gerais</strong>, para cada
                    página habilitada. Crie, edite, reordene e redimensione livremente — usando as colunas e fases
                    de cada página. Tudo é salvo na organização.
                </p>
            </div>

            {/* Seletor de página */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                    <Label className="mb-1 block">Página</Label>
                    <select className={selectCls} value={selectedPage?.key || ''} onChange={(e) => switchPage(e.target.value)}>
                        {pages.map((p) => (
                            <option key={p.key} value={p.key}>
                                {p.label}{p.kind === 'custom' ? ' (personalizada)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-1.5" onClick={restoreDefaults}>
                        <RotateCcw className="h-4 w-4" /> Restaurar padrão
                    </Button>
                    <Button className="gap-1.5" onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Nova métrica
                    </Button>
                </div>
            </div>

            {/* Pré-visualização (layout/tamanho/cor) */}
            {metrics.length > 0 && (
                <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wider text-slate-400">Pré-visualização</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {metrics.map((m) => {
                            const c = colorClasses(m.color);
                            return (
                                <Card key={`pv-${m.id}`} className={`shadow-sm border-slate-200 bg-white dark:bg-slate-900 ${sizeSpanClass(m.size)}`}>
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center ${c.text} shrink-0`}>
                                            <MetricIcon name={m.icon} className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{m.label}</p>
                                            <h3 className="text-2xl font-black text-slate-300 dark:text-slate-600">—</h3>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Lista de métricas (editar/ordenar/redimensionar/excluir) */}
            <div className="space-y-2">
                <Label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Métricas ({metrics.length})</Label>
                {metrics.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma métrica nesta página. Esta página ficará sem indicadores nas Informações Gerais.
                            Clique em <strong>Nova métrica</strong> ou <strong>Restaurar padrão</strong>.
                        </CardContent>
                    </Card>
                ) : (
                    metrics.map((m, idx) => {
                        const c = colorClasses(m.color);
                        return (
                            <Card key={m.id}>
                                <CardContent className="flex items-center gap-3 py-3">
                                    <div className="flex flex-col">
                                        <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                                        <button type="button" onClick={() => move(idx, 1)} disabled={idx === metrics.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                                    </div>
                                    <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
                                        <MetricIcon name={m.icon} className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium truncate">{m.label}</p>
                                        <p className="text-xs text-muted-foreground truncate">{describeMetric(selectedPage, m)}</p>
                                    </div>
                                    <select
                                        className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs dark:bg-slate-800 dark:border-slate-700 shrink-0"
                                        value={m.size}
                                        onChange={(e) => setSize(idx, Number(e.target.value))}
                                        title="Tamanho"
                                    >
                                        {METRIC_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(idx)} className="shrink-0">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 shrink-0" onClick={() => removeMetric(idx)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pt-3">
                {dirty && <span className="text-xs text-amber-600 mr-auto">Há alterações não salvas.</span>}
                <Button onClick={handleSave} disabled={!dirty || isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar métricas
                </Button>
            </div>

            {selectedPage && (
                <MetricEditorDialog
                    open={editorOpen}
                    onOpenChange={setEditorOpen}
                    schema={selectedPage}
                    metric={editingMetric}
                    onSave={onEditorSave}
                />
            )}
        </div>
    );
}
