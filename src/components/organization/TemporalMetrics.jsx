import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Clock, FileEdit, CheckCircle2 } from 'lucide-react';

export default function TemporalMetrics({ totalAvg, analysisAvg, reviewAvg }) {
    return (
        <Card className="shadow-sm border-slate-200 bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 py-4">
                <CardTitle className="text-lg flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                    <History className="w-5 h-5 text-indigo-500" />
                    Temporalidade das Consultas (dias úteis)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <MetricItem
                        icon={Clock}
                        label="Tempo total médio entre entrada e devolução"
                        value={totalAvg}
                        unit="dias"
                        color="text-indigo-600 bg-indigo-50"
                    />
                    <MetricItem
                        icon={FileEdit}
                        label="Tempo médio para análise de consultas"
                        value={analysisAvg}
                        unit="dias"
                        color="text-emerald-600 bg-emerald-50"
                        sublabel="Desde o início da análise até a remessa"
                    />
                    <MetricItem
                        icon={CheckCircle2}
                        label="Tempo médio para revisão de minutas"
                        value={reviewAvg}
                        unit="dias"
                        color="text-amber-600 bg-amber-50"
                        sublabel="Entre a remessa e a devolução"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function MetricItem({ icon: Icon, label, value, unit, color, sublabel }) {
    return (
        <div className="p-5 flex items-start gap-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-0.5">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-4">
                        {label}
                    </p>
                    <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{value}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{unit}</span>
                    </div>
                </div>
                {sublabel && (
                    <p className="text-xs font-medium text-slate-400 truncate">
                        {sublabel}
                    </p>
                )}
            </div>
        </div>
    );
}
