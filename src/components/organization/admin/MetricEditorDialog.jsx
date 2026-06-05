import React, { useMemo, useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { AGGREGATIONS, FILTER_OPERATORS, PHASE_FIELD_KEY } from '@/lib/metricsEngine';
import {
    METRIC_COLORS, METRIC_SIZES, METRIC_ICON_NAMES, numericFieldsOf, normalizeMetric,
} from '@/lib/dashboardMetrics';
import { MetricIcon } from '@/components/organization/metricIcons';

// Operadores disponíveis conforme o tipo da coluna escolhida no filtro.
function opsForType(type, isPhase) {
    if (isPhase || type === 'select') return ['eq', 'neq', 'in', 'nin', 'filled', 'empty'];
    if (type === 'multiselect') return ['in', 'nin', 'contains', 'filled', 'empty'];
    if (type === 'boolean') return ['truthy', 'falsy', 'eq', 'neq', 'filled', 'empty'];
    if (type === 'number' || type === 'currency') return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'filled', 'empty'];
    if (type === 'date') return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'filled', 'empty'];
    return ['eq', 'neq', 'contains', 'filled', 'empty']; // text/city/user_ref/link
}

const OP_LABEL = FILTER_OPERATORS.reduce((acc, o) => { acc[o.value] = o.label; return acc; }, {});
const OP_META = FILTER_OPERATORS.reduce((acc, o) => { acc[o.value] = o; return acc; }, {});

// Metadados de uma coluna (ou da pseudo-coluna "Fase/Situação").
function fieldMeta(schema, key) {
    if (key === PHASE_FIELD_KEY) {
        return {
            key: PHASE_FIELD_KEY,
            label: schema.phaseLabel || 'Fase',
            type: 'select',
            isPhase: true,
            options: (schema.phases || []).map((p) => ({ value: p.key, label: p.label })),
        };
    }
    const f = (schema.fields || []).find((x) => x.key === key);
    if (!f) return null;
    return { ...f, isPhase: false, options: (f.options || []).map((o) => ({ value: o.value, label: o.label })) };
}

const selectCls = 'h-9 w-full px-2 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700';

function FilterRow({ schema, filter, onChange, onRemove }) {
    const meta = fieldMeta(schema, filter.field) || fieldMeta(schema, PHASE_FIELD_KEY);
    const allowedOps = opsForType(meta.type, meta.isPhase);
    const needsValue = OP_META[filter.op]?.needsValue;
    const isMulti = filter.op === 'in' || filter.op === 'nin';

    const setField = (field) => {
        const m = fieldMeta(schema, field);
        const ops = opsForType(m?.type, m?.isPhase);
        const op = ops.includes(filter.op) ? filter.op : ops[0];
        onChange({ field, op, value: (op === 'in' || op === 'nin') ? [] : '' });
    };
    const setOp = (op) => {
        const becomingMulti = op === 'in' || op === 'nin';
        onChange({ ...filter, op, value: becomingMulti ? (Array.isArray(filter.value) ? filter.value : []) : (Array.isArray(filter.value) ? '' : filter.value) });
    };

    const hasOptions = meta.isPhase || meta.type === 'select' || meta.type === 'multiselect';

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 p-2">
            <select className={`${selectCls} max-w-[40%]`} value={filter.field} onChange={(e) => setField(e.target.value)}>
                <option value={PHASE_FIELD_KEY}>{schema.phaseLabel || 'Fase'} (situação)</option>
                {(schema.fields || []).map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                ))}
            </select>

            <select className={`${selectCls} max-w-[28%]`} value={filter.op} onChange={(e) => setOp(e.target.value)}>
                {allowedOps.map((op) => (
                    <option key={op} value={op}>{OP_LABEL[op]}</option>
                ))}
            </select>

            {needsValue && (
                <div className="flex-1 min-w-[120px]">
                    {hasOptions && !isMulti && (
                        <select className={selectCls} value={String(filter.value ?? '')} onChange={(e) => onChange({ ...filter, value: e.target.value })}>
                            <option value="">Selecione…</option>
                            {meta.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}
                    {hasOptions && isMulti && (
                        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-md border border-slate-200 dark:border-slate-700 max-h-28 overflow-auto">
                            {meta.options.map((o) => {
                                const arr = Array.isArray(filter.value) ? filter.value : [];
                                const checked = arr.includes(o.value);
                                return (
                                    <label key={o.value} className={`text-xs px-2 py-1 rounded cursor-pointer border ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={checked}
                                            onChange={() => {
                                                const next = checked ? arr.filter((x) => x !== o.value) : [...arr, o.value];
                                                onChange({ ...filter, value: next });
                                            }}
                                        />
                                        {o.label}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {!hasOptions && meta.type === 'boolean' && (
                        <select className={selectCls} value={String(filter.value ?? 'true')} onChange={(e) => onChange({ ...filter, value: e.target.value })}>
                            <option value="true">Sim</option>
                            <option value="false">Não</option>
                        </select>
                    )}
                    {!hasOptions && meta.type === 'date' && (
                        <Input type="date" className="h-9" value={String(filter.value ?? '')} onChange={(e) => onChange({ ...filter, value: e.target.value })} />
                    )}
                    {!hasOptions && (meta.type === 'number' || meta.type === 'currency') && (
                        <Input type="number" step="any" className="h-9" value={String(filter.value ?? '')} onChange={(e) => onChange({ ...filter, value: e.target.value })} />
                    )}
                    {!hasOptions && !['boolean', 'date', 'number', 'currency'].includes(meta.type) && (
                        <Input type="text" className="h-9" value={String(filter.value ?? '')} onChange={(e) => onChange({ ...filter, value: e.target.value })} placeholder="valor" />
                    )}
                </div>
            )}

            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-600 shrink-0" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

/**
 * Dialog para criar/editar uma métrica. Usa as colunas e fases da página
 * (schema) como blocos de construção. Devolve a métrica via onSave.
 *
 * props: open, onOpenChange, schema, metric (inicial), onSave(metric)
 */
export default function MetricEditorDialog({ open, onOpenChange, schema, metric, onSave }) {
    const [draft, setDraft] = useState(metric);

    useEffect(() => { setDraft(metric); }, [metric, open]);

    const numericFields = useMemo(() => numericFieldsOf(schema), [schema]);
    const aggMeta = AGGREGATIONS.find((a) => a.value === draft?.agg) || AGGREGATIONS[0];
    const needsField = aggMeta.needsField;

    if (!draft) return null;

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    const addFilter = () => set({ filters: [...(draft.filters || []), { field: PHASE_FIELD_KEY, op: 'eq', value: '' }] });
    const updateFilter = (idx, next) => set({ filters: draft.filters.map((f, i) => (i === idx ? next : f)) });
    const removeFilter = (idx) => set({ filters: draft.filters.filter((_, i) => i !== idx) });

    const handleSave = () => {
        const clean = normalizeMetric({
            ...draft,
            field: needsField ? draft.field : null,
        });
        onSave(clean);
        onOpenChange(false);
    };

    const colorObj = METRIC_COLORS.find((c) => c.token === draft.color) || METRIC_COLORS[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Métrica</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Preview */}
                    <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40">
                        <div className={`w-12 h-12 ${colorObj.bg} rounded-xl flex items-center justify-center ${colorObj.text} shrink-0`}>
                            <MetricIcon name={draft.icon} className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{draft.label || 'Sem título'}</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">123</h3>
                        </div>
                    </div>

                    {/* Título */}
                    <div>
                        <Label className="mb-1 block">Título</Label>
                        <Input value={draft.label} maxLength={80} onChange={(e) => set({ label: e.target.value })} placeholder="Ex.: Total concluídos" />
                    </div>

                    {/* Cálculo + coluna */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="mb-1 block">Cálculo</Label>
                            <select className={selectCls} value={draft.agg} onChange={(e) => set({ agg: e.target.value })}>
                                {AGGREGATIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                        {needsField && (
                            <div>
                                <Label className="mb-1 block">Coluna (numérica)</Label>
                                {numericFields.length === 0 ? (
                                    <p className="text-xs text-amber-600 mt-2">Esta página não tem colunas numéricas. Use "Contagem" ou "Percentual".</p>
                                ) : (
                                    <select className={selectCls} value={draft.field || ''} onChange={(e) => set({ field: e.target.value })}>
                                        <option value="">Selecione…</option>
                                        {numericFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>

                    {draft.agg === 'percent' && (
                        <p className="text-xs text-slate-500 -mt-2">O percentual é calculado sobre o total de registros da página (após o filtro de ano).</p>
                    )}

                    {/* Filtros */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Filtros (todas as condições precisam ser atendidas)</Label>
                            <Button type="button" variant="outline" size="sm" className="gap-1.5 h-8" onClick={addFilter}>
                                <Plus className="h-3.5 w-3.5" /> Filtro
                            </Button>
                        </div>
                        {(!draft.filters || draft.filters.length === 0) ? (
                            <p className="text-xs text-slate-400">Sem filtros: a métrica considera todos os registros da página.</p>
                        ) : (
                            <div className="space-y-2">
                                {draft.filters.map((f, idx) => (
                                    <FilterRow
                                        key={idx}
                                        schema={schema}
                                        filter={f}
                                        onChange={(next) => updateFilter(idx, next)}
                                        onRemove={() => removeFilter(idx)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Ícone */}
                    <div>
                        <Label className="mb-1 block">Ícone</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {METRIC_ICON_NAMES.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => set({ icon: name })}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${draft.icon === name ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    title={name}
                                >
                                    <MetricIcon name={name} className="w-4 h-4" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cor + Tamanho */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="mb-1 block">Cor</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {METRIC_COLORS.map((c) => (
                                    <button
                                        key={c.token}
                                        type="button"
                                        onClick={() => set({ color: c.token })}
                                        className={`w-7 h-7 rounded-full ${c.dot} ring-2 ring-offset-2 transition-all ${draft.color === c.token ? 'ring-slate-400' : 'ring-transparent'}`}
                                        title={c.label}
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label className="mb-1 block">Tamanho</Label>
                            <select className={selectCls} value={draft.size} onChange={(e) => set({ size: Number(e.target.value) })}>
                                {METRIC_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!draft.label?.trim() || (needsField && !draft.field)}>
                        Aplicar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
