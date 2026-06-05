import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { useEntityTypes, useRecords } from '@/hooks/useCustomEntities';
import {
    getActiveDataPages, getPageMetrics, buildPageContext, getRecordYear,
} from '@/lib/dashboardMetrics';
import { evaluateMetric } from '@/lib/metricsEngine';
import MetricCard from './MetricCard';

/**
 * Painel de métricas do GeneralInfo. Renderiza, de forma organizada, as métricas
 * de cada PÁGINA ATIVA do órgão:
 *   - páginas ordinárias (Consultas / Expedientes) respeitando o moduleConfig —
 *     quando um painel está desligado, suas métricas somem daqui também;
 *   - páginas criadas pelo admin (tipos de entidade) habilitadas;
 * usando as métricas definidas pelo admin (ou padrões sensatos enquanto nada
 * foi configurado). Com a flag CUSTOM_ENTITIES desligada, mostra Consultas +
 * Expedientes exatamente como hoje.
 *
 * props:
 *   - organization, processes, expedientes
 *   - selectedYear
 *   - customEntitiesOn
 *   - onCustomYears?(yearsArray)  reporta anos encontrados nas páginas custom,
 *     para enriquecer o seletor de ano do GeneralInfo.
 */
export default function DashboardMetrics({
    organization,
    processes = [],
    expedientes = [],
    selectedYear,
    customEntitiesOn = false,
    onCustomYears,
}) {
    const { entityTypes } = useEntityTypes(customEntitiesOn ? organization?.id : null);

    const pages = useMemo(
        () => getActiveDataPages(organization, { customEntitiesOn, entityTypes }),
        [organization, customEntitiesOn, entityTypes]
    );

    // Agregação dos anos descobertos nas páginas custom (para o seletor de ano).
    const yearsByPageRef = useRef({});
    const lastSentRef = useRef('');
    const reportYears = useCallback((pageKey, years) => {
        yearsByPageRef.current[pageKey] = years;
        const all = new Set();
        Object.values(yearsByPageRef.current).forEach((arr) => (arr || []).forEach((y) => all.add(y)));
        const sorted = Array.from(all).sort((a, b) => b - a);
        const sig = sorted.join(',');
        if (sig !== lastSentRef.current) {
            lastSentRef.current = sig;
            onCustomYears?.(sorted);
        }
    }, [onCustomYears]);

    if (!pages.length) {
        return (
            <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6 text-center">
                Nenhuma página com dados está habilitada neste órgão. Ative páginas em
                <strong> Painel Administrativo → Páginas e Módulos</strong>.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {pages.map((page) => {
                if (page.kind === 'custom') {
                    return (
                        <CustomPageMetricsSection
                            key={page.key}
                            organization={organization}
                            page={page}
                            selectedYear={selectedYear}
                            onYears={reportYears}
                        />
                    );
                }
                const records = page.kind === 'processes' ? processes : expedientes;
                return (
                    <BuiltinMetricsSection
                        key={page.key}
                        organization={organization}
                        page={page}
                        records={records}
                        selectedYear={selectedYear}
                    />
                );
            })}
        </div>
    );
}

function MetricsGrid({ title, metrics, records, ctx, badge }) {
    if (!metrics || metrics.length === 0) return null;
    return (
        <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-700 bg-slate-100 py-1.5 px-3 rounded-md inline-flex">
                    {title}
                </h3>
                {badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {badge}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m) => {
                    const { display } = evaluateMetric(m, records, ctx);
                    return <MetricCard key={m.id} metric={m} value={display} />;
                })}
            </div>
        </div>
    );
}

function BuiltinMetricsSection({ organization, page, records, selectedYear }) {
    const metrics = useMemo(() => getPageMetrics(organization, page), [organization, page]);
    const ctx = useMemo(() => buildPageContext(page.kind, page), [page]);
    const filtered = useMemo(() => (records || []).filter((r) => {
        const y = getRecordYear(r, page.kind);
        return y === null ? false : y === selectedYear;
    }), [records, page, selectedYear]);

    return <MetricsGrid title={page.label} metrics={metrics} records={filtered} ctx={ctx} />;
}

function CustomPageMetricsSection({ organization, page, selectedYear, onYears }) {
    const { records } = useRecords(organization?.id, page.entityType?.id);
    const metrics = useMemo(() => getPageMetrics(organization, page), [organization, page]);
    const ctx = useMemo(() => buildPageContext('custom', page), [page]);

    const years = useMemo(() => {
        const s = new Set();
        (records || []).forEach((r) => { const y = getRecordYear(r, 'custom'); if (y) s.add(y); });
        return Array.from(s);
    }, [records]);

    useEffect(() => { onYears?.(page.key, years); }, [years, page.key, onYears]);

    const filtered = useMemo(() => (records || []).filter((r) => {
        const y = getRecordYear(r, 'custom');
        return y === null ? true : y === selectedYear;
    }), [records, selectedYear]);

    return <MetricsGrid title={page.label} metrics={metrics} records={filtered} ctx={ctx} badge="Personalizada" />;
}
