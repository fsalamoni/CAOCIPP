import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, GitBranch } from 'lucide-react';
import {
    getParceriaField,
    calculateParceriaDerivedStatus,
    hasAdditives,
} from '@/utils/parceriaUtils';

const STATUS_PILL = {
    'Pendente': 'bg-slate-100 text-slate-700 border-slate-200',
    'Em análise': 'bg-amber-100 text-amber-700 border-amber-200',
    'Revisão': 'bg-sky-100 text-sky-700 border-sky-200',
    'Aguarda Terceiros': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Parcerias': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Extintos': 'bg-slate-200 text-slate-600 border-slate-300',
};

const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'TC',
    termo_fomento: 'TF',
};

export default function ParceriaKanbanCard({
    parceria,
    columnId,
    onViewDetails,
    overlay = false,
    isAdditiveActive = false,
    additiveNumber = 0,
}) {
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
        transition,
        opacity: isDragging && !overlay ? 0.4 : 1,
    };

    const pgea = getParceriaField(parceria, 'pgea');
    const subject = getParceriaField(parceria, 'subject');
    const type = getParceriaField(parceria, 'partnership_type');
    const number = getParceriaField(parceria, 'partnership_number');
    const responsible = getParceriaField(parceria, 'responsible_user_name');
    const hasAdd = hasAdditives(parceria) || isAdditiveActive;
    const status = calculateParceriaDerivedStatus(parceria);
    const pillClass = STATUS_PILL[status] || STATUS_PILL['Pendente'];

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
                `}
            >
                <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {pgea || '—'}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            {hasAdd && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                    <GitBranch className="w-3 h-3 mr-0.5" />
                                    Aditivo #{additiveNumber || parceria.aditivo_count || 1}
                                </Badge>
                            )}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onViewDetails?.(parceria); }}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Ver detalhes"
                            >
                                <Eye className="w-3.5 h-3.5" />
                            </button>
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

                    {responsible && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            <span className="font-semibold">Resp.:</span> {responsible}
                        </div>
                    )}

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
