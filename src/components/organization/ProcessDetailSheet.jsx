import React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import {
    Pencil,
    MapPin,
    Calendar,
    User,
    FileText,
    FolderOpen,
    Lock,
    Clock,
    CheckCircle2,
    Circle,
    ArrowRight
} from "lucide-react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";

/**
 * ProcessDetailSheet — Side panel for viewing all details of a process.
 *
 * Uses the Sheet (Radix Dialog side="right") component for a smooth, non-blocking overlay.
 * Provides a timeline of the workflow, full observation text, and all metadata.
 *
 * Props:
 * - process: The process object to display
 * - open: boolean controlling open state
 * - onClose: callback when the sheet should close
 * - onEdit: callback to open the edit dialog
 * - getProcessField: the field alias resolver function
 */
export default function ProcessDetailSheet({ process, open, onClose, onEdit, getProcessField }) {
    if (!process) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        const date = parseLocalDate(dateStr);
        if (!isValid(date)) return null;
        try {
            return format(date, "dd/MM/yyyy", { locale: ptBR });
        } catch {
            return null;
        }
    };

    const field = (key) => getProcessField(process, key);

    const isUrgent = (() => {
        const val = field('urgency_request');
        return val === true || String(val).toLowerCase().trim() === 'sim';
    })();

    const isRestricted = (() => {
        const val = field('access_restriction');
        return val === true || String(val).toLowerCase().trim() === 'sim';
    })();

    // Timeline steps — each step has a label, date field key, and icon
    const timelineSteps = [
        { label: 'Entrada no CAO', key: 'entry_date', icon: Calendar },
        { label: 'Distribuição', key: 'distribution_date', icon: ArrowRight },
        { label: 'Início da Análise', key: 'analysis_start_date', icon: FileText },
        { label: 'Remessa p/ Revisão', key: 'review_submission_date', icon: Clock },
        { label: 'Devolução após Revisão', key: 'review_return_date', icon: CheckCircle2 },
        { label: 'Arquivamento', key: 'archived_date', icon: FolderOpen },
    ];

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <SheetTitle className="text-xl font-bold text-slate-900">
                                    {field('process_number')}
                                </SheetTitle>
                                {isUrgent && (
                                    <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-5 border-none bg-rose-500 animate-pulse">
                                        URGENTE
                                    </Badge>
                                )}
                                {isRestricted && (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-amber-300 text-amber-600 bg-amber-50">
                                        <Lock className="w-3 h-3 mr-1" />
                                        RESTRITO
                                    </Badge>
                                )}
                            </div>
                            <SheetDescription className="text-sm text-slate-500 line-clamp-1">
                                {field('consultant')}
                            </SheetDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { onEdit(process); onClose(false); }}
                            className="shrink-0 gap-1.5"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                        </Button>
                    </div>
                    <div className="mt-3">
                        <StatusBadge status={field('status')} className="" />
                    </div>
                </SheetHeader>

                {/* Content */}
                <div className="px-6 py-5 space-y-6">

                    {/* Dados Principais */}
                    <Section title="Dados Principais">
                        <DetailItem icon={User} label="Consulente" value={field('consultant')} />
                        <DetailItem icon={MapPin} label="Local dos Fatos" value={field('location')} />
                        <div className="pt-2">
                            <p className="text-xs font-medium text-slate-500 mb-1.5">Objeto da Consulta</p>
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                                {field('matter_object') || <span className="text-slate-400 italic">Não informado</span>}
                            </p>
                        </div>
                        {field('responsible_user_name') && (
                            <DetailItem icon={User} label="Assessor Responsável" value={field('responsible_user_name')} />
                        )}
                    </Section>

                    {/* Timeline do Workflow */}
                    <Section title="Timeline do Processo">
                        <div className="space-y-0">
                            {timelineSteps.map((step, idx) => {
                                const dateVal = field(step.key);
                                const formattedDate = formatDate(dateVal);
                                const isCompleted = !!formattedDate;
                                const isLast = idx === timelineSteps.length - 1;
                                const StepIcon = step.icon;

                                return (
                                    <div key={step.key} className="flex gap-3">
                                        {/* Timeline connector */}
                                        <div className="flex flex-col items-center">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCompleted
                                                ? 'bg-indigo-100 text-indigo-600'
                                                : 'bg-slate-100 text-slate-300'
                                                }`}>
                                                {isCompleted
                                                    ? <StepIcon className="w-3.5 h-3.5" />
                                                    : <Circle className="w-3 h-3" />
                                                }
                                            </div>
                                            {!isLast && (
                                                <div className={`w-0.5 h-6 ${isCompleted ? 'bg-indigo-200' : 'bg-slate-100'}`} />
                                            )}
                                        </div>
                                        {/* Step content */}
                                        <div className="pb-4 pt-0.5">
                                            <p className={`text-sm font-medium ${isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
                                                {step.label}
                                            </p>
                                            {formattedDate && (
                                                <p className="text-xs text-slate-500 mt-0.5">{formattedDate}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Observações */}
                    {field('observations') && (
                        <Section title="Observações">
                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border border-slate-100">
                                {field('observations')}
                            </p>
                        </Section>
                    )}

                    {/* Pasta na Rede */}
                    {field('network_folder') && (
                        <Section title="Pasta na Rede">
                            <p className="text-xs text-blue-600 font-mono bg-blue-50 rounded-lg p-3 border border-blue-100 break-all">
                                {field('network_folder')}
                            </p>
                        </Section>
                    )}

                    {/* Metadados */}
                    <Section title="Metadados do Sistema">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <MetaItem label="ID do Processo" value={process.id} />
                            <MetaItem label="Criado em" value={formatDate(process.created_at) || formatDate(process.createdAt)} />
                            <MetaItem label="Atualizado em" value={formatDate(process.updated_at) || formatDate(process.updatedAt)} />
                            <MetaItem label="Resp. User ID" value={process.responsible_user_id} />
                        </div>
                    </Section>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Helper Components ──

function Section({ title, children }) {
    return (
        <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
            {children}
        </div>
    );
}

function DetailItem({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-2.5 py-1.5">
            <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm text-slate-700 font-medium">
                    {value || <span className="text-slate-400 italic font-normal">Não informado</span>}
                </p>
            </div>
        </div>
    );
}

function MetaItem({ label, value }) {
    return (
        <div className="bg-slate-50 rounded-md p-2">
            <p className="text-slate-400 font-medium">{label}</p>
            <p className="text-slate-600 font-mono mt-0.5 truncate" title={value || ''}>
                {value || '-'}
            </p>
        </div>
    );
}
