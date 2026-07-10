import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Lock, AlertCircle, User, FolderOpen, Calendar, Eye } from 'lucide-react';
import { getProcessField, calculateDerivedStatus, isProcessUrgent } from '@/utils/processUtils';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { getDaysInCurrentStage, getStageTimeSeverity, resolveStageTimeConfig } from '@/lib/stageTime';
import StageTimeBadge from '@/components/ui/StageTimeBadge';
import { toast } from 'sonner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from "@/components/ui/tooltip";

/**
 * KanbanCard — Visual card for a process in the Kanban board.
 * Props:
 *  - process: the process object
 *  - overlay: true when rendering inside DragOverlay
 *  - onViewDetails: callback(process) to open the detail sheet
 */
export default function KanbanCard({ process, columnId, overlay = false, onViewDetails, stageAverages = null, stageTimeConfig = null }) {
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
        id: process.id,
        data: { process, columnId },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : 'transform 120ms ease',
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
    };

    const field = (key) => getProcessField(process, key);
    const isUrgent = isProcessUrgent(process);
    const isRestricted = (() => {
        const val = field('access_restriction');
        return val === true || String(val).toLowerCase().trim() === 'sim';
    })();
    const responsibleName = field('responsible_user_name');
    const processNumber = field('process_number');
    const consultant = field('consultant');
    const matterObject = field('matter_object');

    // Indicador de tempo na etapa atual (flag `stage_time_indicator`).
    const currentStatus = calculateDerivedStatus(process);
    // getDaysInCurrentStage chama getField(record, key) com DOIS argumentos —
    // passar o closure local `field` (que só aceita `key`, com `process` já
    // fechado por escopo) fazia esse segundo argumento (`record`) ser lido
    // como se fosse `key`, e getProcessField(process, record) quebrava ao
    // tentar chamar `.toLowerCase()` num objeto. Passa a função de verdade,
    // que já aceita (registro, chave).
    const resolvedStageTimeConfig = resolveStageTimeConfig(stageTimeConfig);
    const daysInStage = stageTimeIndicatorOn
        ? getDaysInCurrentStage(process, currentStatus, getProcessField, resolvedStageTimeConfig.dayType)
        : null;
    const stageAvg = stageAverages ? stageAverages[currentStatus] : null;
    const stageSeverity = stageTimeIndicatorOn ? getStageTimeSeverity(daysInStage, resolvedStageTimeConfig) : null;

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
        if (onViewDetails) onViewDetails(process);
    };

    const handleCopyProcessNumber = (e) => {
        if (!canCopyProcessNumber || !processNumber) return;
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(processNumber).then(() => {
            toast.success('Número do processo copiado!');
        }).catch(() => {
            toast.error('Erro ao copiar número do processo');
        });
    };

    const cardContent = (
        <div
            className={`
        bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2
        shadow-sm dark:shadow-black/30
        ${isDragging && !overlay ? 'border-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900' : ''}
        ${overlay ? 'shadow-xl border-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-800' : ''}
      `}
        >
            {/* Header: Process Number + Badges */}
            <div className="flex items-start justify-between gap-2">
                {canCopyProcessNumber && processNumber ? (
                    <span
                        className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={handleCopyProcessNumber}
                        title="Clique para copiar"
                    >
                        {processNumber}
                    </span>
                ) : (
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate flex-1">
                        {processNumber || 'Sem número'}
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
                    {isRestricted && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-300 dark:border-amber-500 text-amber-600 dark:text-amber-100 bg-amber-50 dark:bg-amber-800 cursor-help">
                                    <Lock className="w-2.5 h-2.5" />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">Acesso Restrito</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Consultant */}
            {consultant && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                    {consultant}
                </p>
            )}

            {/* Matter Object */}
            {matterObject && (
                <p className="text-[11px] text-slate-400 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {matterObject}
                </p>
            )}

            {/* Entry Date + Stage time indicator */}
            {(entryDate || daysInStage != null) && (
                <div className="flex items-center justify-between gap-2">
                    {entryDate && (
                        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 min-w-0">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] truncate">Entrada: {entryDate}</span>
                        </div>
                    )}
                    <StageTimeBadge days={daysInStage} severity={stageSeverity} avg={stageAvg} colors={resolvedStageTimeConfig.colors} dayType={resolvedStageTimeConfig.dayType} className="ml-auto shrink-0" />
                </div>
            )}

            {/* Footer: Responsible + Eye Icon */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-600">
                {responsibleName ? (
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 flex items-center justify-center">
                            <span className="text-[8px] font-bold">{getInitials(responsibleName)}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 truncate max-w-[100px]">{responsibleName}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-slate-300 dark:text-slate-500">
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
                                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Ver detalhes do processo</TooltipContent>
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
