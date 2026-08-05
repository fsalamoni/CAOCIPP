import React, { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from "@/components/ui/StatusBadge";
import { Pencil, Calendar, User, FileText, GitBranch, Archive, Send, CheckCircle2, Eye, Plus, Lock } from 'lucide-react';
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    calculateParceriaDerivedStatus,
    getParceriaField,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { parseLocalDate } from "@/lib/dateUtils";

const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'Termo de Cooperação',
    termo_fomento: 'Termo de Fomento',
};

const formatDate = (s) => {
    const d = parseLocalDate(s);
    if (!d || !isValid(d)) return null;
    try { return format(d, 'dd/MM/yyyy', { locale: ptBR }); } catch { return null; }
};

/**
 * ParceriaDetailSheet — sheet lateral com timeline, dados, aditivos e ações.
 *
 * Suporta modo de visualização:
 *  - 'parent': vê a Parceria original (read-only se tem aditivos)
 *  - 'aditivo': vê o aditivo corrente (editável)
 */
export default function ParceriaDetailSheet({
    parceria,
    open,
    onClose,
    onEdit,
    onIncludeAditivo,
    onExtinguish,
    aditivos = [],
    currentAdditiveId,
    userRole,
}) {
    const [viewMode, setViewMode] = useState('parent'); // 'parent' | 'aditivo'
    const [selectedAdditive, setSelectedAdditive] = useState(null);

    useEffect(() => {
        if (!parceria) return;
        if (hasAdditives(parceria) && currentAdditiveId) {
            setViewMode('aditivo');
            setSelectedAdditive(aditivos.find((a) => a.id === currentAdditiveId) || null);
        } else {
            setViewMode('parent');
            setSelectedAdditive(null);
        }
    }, [parceria, currentAdditiveId, aditivos]);

    if (!parceria) return null;

    const hasAdd = hasAdditives(parceria);
    const isCreator = userRole === 'creator';
    const viewing = viewMode === 'aditivo' && selectedAdditive ? selectedAdditive : parceria;
    const isViewingAdditive = viewMode === 'aditivo' && !!selectedAdditive;
    const status = isViewingAdditive
        ? (selectedAdditive.status || 'Pendente')
        : calculateParceriaDerivedStatus(parceria);

    const timelineSteps = isViewingAdditive
        ? [
            { label: 'Aditivo criado', key: 'created_at', icon: GitBranch },
            { label: 'Data de Responsabilidade', key: 'responsibility_date', icon: User },
            { label: 'Pasta na Rede', key: 'network_folder', icon: FileText },
            { label: 'Conclusão da Revisão', key: 'review_conclusion_date', icon: Eye },
            { label: 'Data da Assinatura', key: 'signature_date', icon: CheckCircle2 },
        ]
        : [
            { label: 'PGEA recebido', key: 'pgea_date', icon: Calendar },
            { label: 'Data de Responsabilidade', key: 'responsibility_date', icon: User },
            { label: 'Pasta na Rede', key: 'network_folder', icon: FileText },
            { label: 'Conclusão da Revisão', key: 'review_conclusion_date', icon: Eye },
            { label: 'Data da Assinatura', key: 'signature_date', icon: CheckCircle2 },
            { label: 'Termo Final', key: 'end_date', icon: Calendar },
        ];

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <SheetTitle className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                                    {getParceriaField(parceria, 'pgea')}
                                </SheetTitle>
                                {hasAdd && (
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                        <GitBranch className="w-3 h-3 mr-0.5" />
                                        {parceria.aditivo_count} aditivo{parceria.aditivo_count > 1 ? 's' : ''}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {getParceriaField(parceria, 'partnership_type') && (
                                    <Badge variant="outline" className="text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                                        {PARTNERSHIP_TYPE_LABEL[getParceriaField(parceria, 'partnership_type')] || getParceriaField(parceria, 'partnership_type')}
                                    </Badge>
                                )}
                                {getParceriaField(parceria, 'partnership_number') && (
                                    <Badge variant="outline" className="text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-mono">
                                        {getParceriaField(parceria, 'partnership_number')}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit?.(parceria)}
                            className="shrink-0 gap-1.5"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                        </Button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <StatusBadge status={status} />
                        {isViewingAdditive && (
                            <span className="text-xs text-amber-700 font-semibold">
                                Vendo Aditivo #{selectedAdditive.aditivo_number}
                            </span>
                        )}
                    </div>

                    {/* Toggle Original / Aditivo */}
                    {hasAdd && (
                        <div className="mt-3 flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
                            <button
                                type="button"
                                onClick={() => setViewMode('parent')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                    viewMode === 'parent'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <Lock className="w-3 h-3 inline mr-1" />
                                Original
                            </button>
                            {aditivos.map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => { setViewMode('aditivo'); setSelectedAdditive(a); }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                                        viewMode === 'aditivo' && selectedAdditive?.id === a.id
                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    Aditivo #{a.aditivo_number}
                                </button>
                            ))}
                        </div>
                    )}
                </SheetHeader>

                <div className="px-6 py-5 space-y-6">
                    {isViewingAdditive && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-3">
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>Aditivo #{selectedAdditive.aditivo_number}</strong> ({selectedAdditive.aditivo_type_label || selectedAdditive.aditivo_type}).
                                A Parceria original está congelada; os dados abaixo são do aditivo corrente.
                            </p>
                        </div>
                    )}

                    {/* Dados principais */}
                    <Section title={isViewingAdditive ? 'Dados do Aditivo' : 'Dados Principais'}>
                        <div className="pt-2 space-y-2">
                            <DetailItem label="Assunto" value={getParceriaField(viewing, 'subject')} />
                            <DetailItem label="Objeto" value={getParceriaField(viewing, 'object')} multiline />
                            <DetailItem label="Partes" value={getParceriaField(viewing, 'parties')} />
                            {getParceriaField(viewing, 'responsible_user_name') && (
                                <DetailItem
                                    icon={User}
                                    label="Assessor Responsável"
                                    value={getParceriaField(viewing, 'responsible_user_name')}
                                />
                            )}
                        </div>
                    </Section>

                    {/* Dados de formalização */}
                    {getParceriaField(viewing, 'partnership_type') && (
                        <Section title="Formalização">
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <DetailItem label="Tipo" value={PARTNERSHIP_TYPE_LABEL[getParceriaField(viewing, 'partnership_type')] || getParceriaField(viewing, 'partnership_type')} />
                                <DetailItem label="Número" value={getParceriaField(viewing, 'partnership_number')} />
                                <DetailItem label="Assinatura" value={formatDate(getParceriaField(viewing, 'signature_date'))} />
                                <DetailItem label="Vigência" value={getParceriaField(viewing, 'validity_period')} />
                                <DetailItem label="Termo Final" value={formatDate(getParceriaField(viewing, 'end_date'))} />
                                <DetailItem label="Aviso Renovação" value={formatDate(getParceriaField(viewing, 'renewal_notice_date'))} />
                            </div>
                        </Section>
                    )}

                    {/* Terceiros */}
                    {getParceriaField(viewing, 'third_party') && (
                        <Section title="Terceiros">
                            <div className="pt-2">
                                <DetailItem
                                    icon={Send}
                                    label="Terceiro"
                                    value={getParceriaField(viewing, 'third_party')}
                                />
                                {getParceriaField(viewing, 'review_conclusion_date') && (
                                    <DetailItem
                                        label="Conclusão da Revisão"
                                        value={formatDate(getParceriaField(viewing, 'review_conclusion_date'))}
                                    />
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Rede / observações */}
                    {(getParceriaField(viewing, 'network_folder') || getParceriaField(viewing, 'observations')) && (
                        <Section title="Pasta na Rede & Observações">
                            {getParceriaField(viewing, 'network_folder') && (
                                <div className="pt-2">
                                    <p className="text-xs font-medium text-slate-500 mb-1.5">Pasta na Rede</p>
                                    <p className="text-xs text-blue-600 dark:text-blue-200 font-mono bg-blue-50 dark:bg-blue-900 rounded-lg p-3 border border-blue-100 dark:border-blue-600 break-all">
                                        {getParceriaField(viewing, 'network_folder')}
                                    </p>
                                </div>
                            )}
                            {getParceriaField(viewing, 'observations') && (
                                <div className="pt-3">
                                    <p className="text-xs font-medium text-slate-500 mb-1.5">Observações</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                                        {getParceriaField(viewing, 'observations')}
                                    </p>
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Ações */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                        {!isViewingAdditive && !hasAdd && isCreator && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => onIncludeAditivo?.(parceria)}
                                >
                                    <GitBranch className="w-4 h-4 text-amber-600" />
                                    Incluir Aditivo
                                </Button>
                                {status === 'Parcerias' && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start gap-2 text-slate-700"
                                        onClick={() => onExtinguish?.(parceria)}
                                    >
                                        <Archive className="w-4 h-4" />
                                        Confirmar Extinção sem Renovação
                                    </Button>
                                )}
                            </>
                        )}
                        {!isViewingAdditive && hasAdd && isCreator && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start gap-2"
                                    onClick={() => onIncludeAditivo?.(parceria)}
                                >
                                    <Plus className="w-4 h-4 text-amber-600" />
                                    Incluir Novo Aditivo
                                </Button>
                                {status === 'Parcerias' && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start gap-2 text-slate-700"
                                        onClick={() => onExtinguish?.(parceria)}
                                    >
                                        <Archive className="w-4 h-4" />
                                        Confirmar Extinção sem Renovação
                                    </Button>
                                )}
                            </>
                        )}
                        {isViewingAdditive && (
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
                                <p>
                                    Para editar os dados deste aditivo, use o botão
                                    <strong> Editar </strong>
                                    acima. O aditivo corrente pode ser editado a qualquer momento.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                {title}
            </h3>
            {children}
        </div>
    );
}

function DetailItem({ icon: Icon, label, value, multiline = false }) {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
        <div className={multiline ? '' : 'flex items-baseline gap-2'}>
            <p className="text-xs font-medium text-slate-500 mb-0.5">
                {Icon && <Icon className="w-3 h-3 inline mr-1" />}
                {label}
            </p>
            {multiline ? (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                    {value}
                </p>
            ) : (
                <p className="text-sm text-slate-700 dark:text-slate-300">{value}</p>
            )}
        </div>
    );
}
