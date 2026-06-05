import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { colorClasses, sizeSpanClass } from '@/lib/dashboardMetrics';
import { MetricIcon } from './metricIcons';

/**
 * Card visual de uma métrica (KPI). Apresenta ícone colorido + rótulo + valor,
 * no mesmo padrão visual do GeneralInfo. O span no grid vem de metric.size,
 * permitindo ao admin redimensionar cada card.
 *
 * props:
 *   - metric: MetricDef ({ label, icon, color, size, ... })
 *   - value: string já formatado para exibição
 *   - subtitle?: texto auxiliar opcional
 */
export default function MetricCard({ metric, value, subtitle }) {
    const c = colorClasses(metric?.color);
    return (
        <Card className={`shadow-sm border-slate-200 bg-white dark:bg-slate-900 ${sizeSpanClass(metric?.size)}`}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center ${c.text} shrink-0`}>
                    <MetricIcon name={metric?.icon} className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate" title={metric?.label}>
                        {metric?.label}
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{value}</h3>
                    {subtitle && <p className="text-xs font-medium text-slate-400 truncate">{subtitle}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
