import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, User, FolderOpen, Calendar, Eye, Building2, Monitor } from 'lucide-react';
import { getExpedienteField, calculateExpedienteDerivedStatus, isExpedienteUrgent } from '@/utils/expedienteUtils';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { getDaysInCurrentStage, getStageTimeSeverity } from '@/lib/stageTime';
import StageTimeBadge from '@/components/ui/StageTimeBadge';
import { toast } from 'sonner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from "@/components/ui/tooltip";

/**
 * ExpedienteKanbanCard — Visual card for an expediente in the Kanban board.
 */
export default function ExpedienteKanbanCard({ expediente, columnId, overlay = false, onViewDetails, stageAverages = null }) {
    const canCopyProcessNumber = useFlag(FEATURE_FLAGS.COPY_PROCESS_NUMBER.key);
    const stageTimeIndicatorOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: expediente.id,
        data: { expediente, columnId },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : 'transform 120ms ease',
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
    };

    const field = (key) => getExpedienteField(expediente, key);
    const isUrgent = isExpedienteUrgent(expediente);
    const responsibleName = field('responsible_user_name');
    const expedienteNumber = field('expediente_number');
    const system = field('system');
    const origin = field('origin');
    const object = field('object');

    // Indicador de tempo na etapa atual (flag `stage_time_indicator`).
    const currentStatus = calculateExpedienteDerivedStatus(expediente);
    // Mesma correção de KanbanCard.jsx: getDaysInCurrentStage chama
    // getField(record, key) com dois argumentos — o closure local `field`
    // só aceita `key`, então precisa da função de verdade aqui.
    const daysInStage = stageTimeIndicatorOn ? getDaysInCurrentStage(expediente, currentStatus, getExpedienteField) : null;
    const stageAvg = stageAverages ? stageAverages[currentStatus] : null;
    const stageSeverity = stageTimeIndicatorOn ? getStageTimeSeverity(daysInStage, stageAvg) : null;

    // Entry date
    const entryDateRaw = field('entry_date');
    const entryDate = (() => {
        if (!entryDateRaw) return null;
        const d = parseLocalDate(entryDateRaw);
        return isValid(d) ? format(d, 'dd/MM/yyyy') : null;
    })();

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleEyeClick = (e) => {
        // Prevent drag from starting
        e.stopPropagation();
        e.preventDefault();
        if (onViewDetails) onViewDetails(expediente);
    };

    const handleCopyProcessNumber = (e) => {
        if (!canCopyProcessNumber || !expedienteNumber) return;
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(expedienteNumber).then(() => {
            toast.success('Número do expediente copiado!');
        }).catch(() => {
            toast.error('Erro ao copiar número do expediente');
        });
    };

    const cardContent = (
        <div
            className={`
        bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2
        shadow-sm
        ${isDragging && !overlay ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40' : ''}
        ${overlay ? 'shadow-xl border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900' : ''}
      `}
        >
            {/* Header: Expediente Number + Urgency */}
            <div className="flex items-start justify-between gap-2">
                {canCopyProcessNumber && expedienteNumber ? (
                    <span
                        className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={handleCopyProcessNumber}
                        title="Clique para copiar"
                    >
                        {expedienteNumber}
                    </span>
                ) : (
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1">
                        {expedienteNumber || 'Sem número'}
                    </span>
                )}
                <div className="flex items-center gap-1 shrink-0">
                    {isUrgent && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 border-none bg-rose-500 animate-pulse cursor-help">
                                    <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                    URG
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">Prioridade Urgente</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* System and Origin */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {system && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-medium">
                        <Monitor className="w-2.5 h-2.5 mr-1" />
                        {system}
                    </Badge>
                )}
                {origin && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-medium">
                        <Building2 className="w-2.5 h-2.5 mr-1" />
                        {origin}
                    </Badge>
                )}
            </div>

            {/* Object */}
            {object && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                    {object}
                </p>
            )}

            {/* Entry Date + Stage time indicator */}
            {(entryDate || daysInStage != null) && (
                <div className="flex items-center justify-between gap-2">
                    {entryDate && (
                        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 min-w-0">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] truncate">Entrada: {entryDate}</span>
                        </div>
                    )}
                    <StageTimeBadge days={daysInStage} severity={stageSeverity} avg={stageAvg} className="ml-auto shrink-0" />
                </div>
            )}

            {/* Footer: Responsible + Eye Icon */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                {responsibleName ? (
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <span className="text-[8px] font-bold">{getInitials(responsibleName)}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{responsibleName}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-slate-300 dark:text-slate-600">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Sem responsável</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    {field('network_folder') && (
                        <FolderOpen className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500" title="Pasta na rede vinculada" />
                    )}
                    {/* Eye icon — opens detail sheet, does NOT trigger drag */}
                    {!overlay && onViewDetails && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={handleEyeClick}
                                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Ver detalhes do expediente</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );

    if (overlay) {
        return cardContent;
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {cardContent}
        </div>
    );
}
