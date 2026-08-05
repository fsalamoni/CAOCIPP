import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Eye, GitBranch, Pencil, Trash2, AlertCircle, Calendar, User, Lock,
} from 'lucide-react';
import {
    getParceriaField,
    calculateParceriaDerivedStatus,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

const STATUS_PILL = {
    'Pendente': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
    'Em análise': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700',
    'Revisão': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900 dark:text-sky-100 dark:border-sky-700',
    'Aguarda Terceiros': 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-100 dark:border-cyan-700',
    'Parcerias': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-700',
    'Extintos': 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-500',
};

const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'TC',
    termo_fomento: 'TF',
};

const isUrgencyMarked = (value) =>
    value === true || String(value ?? '').toLowerCase().trim() === 'sim';

const isRestricted = (value) =>
    value === true || String(value ?? '').toLowerCase().trim() === 'sim';

export default function ParceriaKanbanCard({
    parceria,
    columnId,
    onViewDetails,
    onEdit,
    onDelete,
    canDelete = false,
    isDeleting = false,
    overlay = false,
    isAdditiveActive = false,
    additiveNumber = 0,
}) {
    const canCopy = useFlag(FEATURE_FLAGS.COPY_PROCESS_NUMBER.key);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: parceria.id,
        data: { columnId },
        disabled: overlay,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : (transition || 'transform 120ms ease'),
        opacity: isDragging && !overlay ? 0.4 : 1,
    };

    const pgea = getParceriaField(parceria, 'pgea');
    const subject = getParceriaField(parceria, 'subject');
    const type = getParceriaField(parceria, 'partnership_type');
    const number = getParceriaField(parceria, 'partnership_number');
    const responsible = getParceriaField(parceria, 'responsible_user_name');
    const hasAdd = hasAdditives(parceria) || isAdditiveActive;
    const isUrgent = isUrgencyMarked(getParceriaField(parceria, 'urgency_request'));
    const restricted = isRestricted(getParceriaField(parceria, 'access_restriction'));
    const status = calculateParceriaDerivedStatus(parceria);
    const pillClass = STATUS_PILL[status] || STATUS_PILL['Pendente'];

    // Datas usadas no card.
    const signatureRaw = getParceriaField(parceria, 'signature_date');
    const signatureDate = (() => {
        if (!signatureRaw) return null;
        const d = parseLocalDate(signatureRaw);
        return isValid(d) ? format(d, 'dd/MM/yyyy') : null;
    })();

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleEyeClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onViewDetails) onViewDetails(parceria);
    };
    const handleEditClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onEdit) onEdit(parceria);
    };
    const handleDeleteClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) onDelete(parceria);
    };
    const handleCopyPgea = (e) => {
        if (!canCopy || !pgea) return;
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(pgea).then(() => {
            // notificação sutil via toast
            // eslint-disable-next-line no-undef
            if (typeof window !== 'undefined' && window.__toast) window.__toast('PGEA copiado!');
        }).catch(() => {});
    };

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={overlay ? undefined : style}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            className="touch-none"
        >
            <Card
                className={`
                    cursor-grab active:cursor-grabbing
                    hover:shadow-md transition-shadow
                    border-l-4
                    ${hasAdd ? 'border-l-amber-500' : 'border-l-indigo-500'}
                    ${isDragging && !overlay ? 'border-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900' : ''}
                    ${overlay ? 'shadow-xl border-indigo-400 dark:border-indigo-400 bg-white dark:bg-slate-800' : ''}
                `}
            >
                <CardContent className="p-3 space-y-2">
                    {/* Header: PGEA + Urgência + Restrição + Aditivo badge + Ações */}
                    <div className="flex items-start justify-between gap-2">
                        {canCopy && pgea ? (
                            <span
                                className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleCopyPgea}
                                title="Clique para copiar PGEA"
                            >
                                {pgea}
                            </span>
                        ) : (
                            <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex-1">
                                {pgea || '—'}
                            </span>
                        )}

                        <div className="flex flex-col items-end gap-1 shrink-0">
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
                            {restricted && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-rose-50 dark:bg-rose-900 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-700 cursor-help">
                                            <Lock className="w-2.5 h-2.5" />
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Acesso restrito</TooltipContent>
                                </Tooltip>
                            )}
                            {hasAdd && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                    <GitBranch className="w-2.5 h-2.5 mr-0.5" />
                                    Aditivo #{additiveNumber || parceria.aditivo_count || 1}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                        {subject || 'Sem assunto'}
                    </div>

                    {type && number && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                            {PARTNERSHIP_TYPE_LABEL[type] || type} {number}
                        </div>
                    )}

                    {/* Assinatura */}
                    {signatureDate && (
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 min-w-0">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] truncate">Assinatura: {signatureDate}</span>
                        </div>
                    )}

                    {/* Footer: Responsável + Ações */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-600">
                        {responsible ? (
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100 flex items-center justify-center">
                                    <span className="text-[8px] font-bold">{getInitials(responsible)}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-300 truncate max-w-[100px]">{responsible}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-slate-300 dark:text-slate-500">
                                <User className="w-3.5 h-3.5" />
                                <span className="text-[10px]">Sem responsável</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1">
                            {/* Olho — abre DetailSheet */}
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
                                    <TooltipContent side="top">Ver detalhes</TooltipContent>
                                </Tooltip>
                            )}

                            {/* Editar — admin/owner/creator OU delete_records */}
                            {!overlay && onEdit && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={handleEditClick}
                                            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Editar</TooltipContent>
                                </Tooltip>
                            )}

                            {/* Excluir — mesma permissão que Editar */}
                            {!overlay && onDelete && canDelete && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={handleDeleteClick}
                                            disabled={isDeleting}
                                            className="p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Excluir</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Status pill */}
                    <div className="pt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${pillClass}`}>
                            {status}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
