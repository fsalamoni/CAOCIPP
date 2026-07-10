import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SEVERITY_STYLES = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
    warn: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    risk: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
    neutral: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
};

/**
 * StageTimeBadge — selo "N dias" na etapa atual, colorido conforme a
 * comparação com a média histórica do órgão (flag `stage_time_indicator`).
 */
export default function StageTimeBadge({ days, severity, avg, className }) {
    if (days == null) return null;
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.neutral;

    const tooltipText = avg != null
        ? `${days} dia(s) útil(is) na etapa atual — média do órgão: ${avg.toFixed(1)} dia(s)`
        : `${days} dia(s) útil(is) na etapa atual`;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold font-mono whitespace-nowrap cursor-help',
                        style,
                        className
                    )}
                >
                    {days}d
                </span>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
    );
}
