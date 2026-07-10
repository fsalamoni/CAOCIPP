import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { STAGE_TIME_COLOR_PRESETS, DEFAULT_STAGE_TIME_CONFIG } from '@/lib/stageTime';

const NEUTRAL_STYLE = 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700';

/**
 * StageTimeBadge — selo "N dias" na etapa atual, com cor definida pelo
 * admin do órgão (Painel Administrativo → Indicador de Tempo, flag
 * `stage_time_indicator`) para cada nível de severidade (ok/atenção/risco).
 */
export default function StageTimeBadge({ days, severity, avg, colors, dayType = 'business', className }) {
    if (days == null) return null;

    const colorKey = (colors && colors[severity]) || DEFAULT_STAGE_TIME_CONFIG.colors[severity];
    const style = STAGE_TIME_COLOR_PRESETS[colorKey]?.classes || NEUTRAL_STYLE;

    const unit = dayType === 'calendar' ? 'dia(s) corrido(s)' : 'dia(s) útil(is)';
    const tooltipText = avg != null
        ? `${days} ${unit} na etapa atual — média do órgão: ${avg.toFixed(1)} dia(s)`
        : `${days} ${unit} na etapa atual`;

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
