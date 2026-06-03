import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Loader2, Layers } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Resumo genérico com KPIs e gráficos por fase / por campo.
 * props: entityType, records, isLoading
 */
export default function GenericSummary({ entityType, records = [], isLoading }) {
    const phases = useMemo(
        () => (entityType?.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [entityType]
    );

    const byPhaseData = useMemo(() => {
        const counts = {};
        for (const p of phases) counts[p.key] = 0;
        for (const r of records) {
            if (counts[r.phase] !== undefined) counts[r.phase] += 1;
        }
        return phases.map((p, i) => ({
            name: p.label,
            value: counts[p.key] || 0,
            color: p.color || PALETTE[i % PALETTE.length],
        }));
    }, [phases, records]);

    // KPIs configurados (cards) — soma/contagem/média de campos numéricos.
    const numericFields = useMemo(
        () => (entityType?.fields || []).filter((f) => f.type === 'number' || f.type === 'currency'),
        [entityType]
    );

    const kpis = useMemo(() => {
        const out = [{ label: `Total de ${entityType?.label_plural || 'registros'}`, value: String(records.length) }];
        for (const f of numericFields.slice(0, 3)) {
            let sum = 0;
            let n = 0;
            for (const r of records) {
                const v = Number(r.values?.[f.key]);
                if (Number.isFinite(v)) { sum += v; n += 1; }
            }
            const fmt = f.type === 'currency'
                ? (x) => currencyFmt.format(x)
                : (x) => new Intl.NumberFormat('pt-BR').format(x);
            out.push({ label: `Total ${f.label}`, value: fmt(sum) });
            if (n > 0) out.push({ label: `Média ${f.label}`, value: fmt(sum / n) });
        }
        return out;
    }, [records, numericFields, entityType]);

    // Distribuição por um campo select (primeiro encontrado).
    const selectField = useMemo(
        () => (entityType?.fields || []).find((f) => f.type === 'select'),
        [entityType]
    );
    const bySelectData = useMemo(() => {
        if (!selectField) return [];
        const counts = {};
        for (const o of selectField.options || []) counts[o.value] = 0;
        for (const r of records) {
            const v = r.values?.[selectField.key];
            if (v !== undefined && counts[v] !== undefined) counts[v] += 1;
        }
        return (selectField.options || []).map((o, i) => ({
            name: o.label,
            value: counts[o.value] || 0,
            color: o.color || PALETTE[i % PALETTE.length],
        })).filter((d) => d.value > 0);
    }, [selectField, records]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <EmptyState
                icon={Layers}
                title="Sem dados para resumir"
                description={`Crie alguns ${entityType?.label_plural?.toLowerCase() || 'registros'} para ver indicadores.`}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((k, i) => (
                    <Card key={i}>
                        <CardContent className="pt-5">
                            <div className="text-2xl font-bold">{k.value}</div>
                            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por fase */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Por fase</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={byPhaseData}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {byPhaseData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Por campo select */}
                {selectField && bySelectData.length > 0 && (
                    <Card>
                        <CardHeader><CardTitle className="text-base">Por {selectField.label}</CardTitle></CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie data={bySelectData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                                        {bySelectData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                    </Pie>
                                    <Legend />
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
