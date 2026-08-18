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
import { parceriaStatusConfig } from "@/config/processStatus";
import { Pencil, Calendar, User, FileText, GitBranch, Archive, Send, CheckCircle2, Eye, Lock, AlertCircle, ClipboardList, Trash2 } from 'lucide-react';
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    calculateParceriaDerivedStatus,
    getParceriaField,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { parseLocalDate } from "@/lib/dateUtils";
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { LivePresenceIndicator } from '@/lib/LivePresence';
import EntityComments from './EntityComments';
import { useAuth } from '@/lib/FirebaseAuthContext';

const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'Termo de Cooperação',
    termo_fomento: 'Termo de Fomento',
};

const formatDate = (s) => {
    const d = parseLocalDate(s);
    if (!d || !isValid(d)) return null;
    try { return format(d, "dd/MM/yyyy", { locale: ptBR }); } catch { return null; }
};

/**
 * ParceriaDetailSheet — sheet lateral com timeline, dados, aditivos,
 * comentários, presença e log de atividades.
 *
 * Suporta modo de visualização:
 *  - 'parent': vê a Parceria original (read-only se tem aditivos)
 *  - 'aditivo': vê o aditivo corrente (editável)
 *
 * Props:
 *  - parceria, open, onClose
 *  - onEdit, onIncludeAditivo, onExtinguish, onViewLog
 *  - aditivos, currentAdditiveId
 *  - userRole, organizationId, members
 */
export default function ParceriaDetailSheet({
    parceria,
    open,
    onClose,
    onEdit,
    onDelete,
    onIncludeAditivo,
    onExtinguish,
    onViewLog,
    aditivos = [],
    currentAdditiveId,
    userRole,
    organizationId,
    members = [],
}) {
    const { user } = useAuth();
    const isCommentsOn = useFlag(FEATURE_FLAGS.PROCESS_COMMENTS.key);
    const isPresenceOn = useFlag(FEATURE_FLAGS.LIVE_PRESENCE.key);
    const showCollabSection = isCommentsOn || isPresenceOn;

    const [viewMode, setViewMode] = useState('parent');
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

    const isUrgent = parceria?.urgency_request === true
        || String(parceria?.urgency_request).toLowerCase().trim() === 'sim';

    // Timeline no fluxo canônico das fases:
    // Pendente → Em análise → Em revisão → Revisadas → Aguarda Terceiros
    //          → Parcerias → Extintos
    const timelineSteps = isViewingAdditive
        ? [
            { label: 'Aditivo criado', key: 'created_at', icon: GitBranch },
            { label: 'Distribuição', key: 'distribution_date', icon: Send },
            { label: 'Entrada em Análise', key: 'responsibility_date', icon: User },
            { label: 'Início da Revisão', key: 'review_start_date', icon: FileText },
            { label: 'Conclusão da Revisão', key: 'reviewed_date', icon: Eye },
            { label: 'Remessa a Terceiros', key: 'third_party_referral_date', icon: Send },
            { label: 'Retorno de Terceiros', key: 'third_party_return_date', icon: CheckCircle2 },
            { label: 'Data da Assinatura', key: 'signature_date', icon: CheckCircle2 },
            { label: 'Publicação no DEMP', key: 'demp', icon: Calendar },
            { label: 'Arquivamento', key: 'archived_date', icon: Archive },
        ]
        : [
            { label: 'Distribuição', key: 'distribution_date', icon: Send },
            { label: 'Entrada em Análise', key: 'responsibility_date', icon: User },
            { label: 'Início da Revisão', key: 'review_start_date', icon: FileText },
            { label: 'Conclusão da Revisão', key: 'reviewed_date', icon: Eye },
            { label: 'Remessa a Terceiros', key: 'third_party_referral_date', icon: Send },
            { label: 'Retorno de Terceiros', key: 'third_party_return_date', icon: CheckCircle2 },
            { label: 'Data da Assinatura', key: 'signature_date', icon: CheckCircle2 },
            { label: 'Publicação no DEMP', key: 'demp', icon: Calendar },
            { label: 'Termo Final', key: 'end_date', icon: Calendar },
            { label: 'Arquivamento', key: 'archived_date', icon: Archive },
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
                                {isUrgent && (
                                    <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-5 border-none bg-rose-500 animate-pulse">
                                        URGENTE
                                    </Badge>
                                )}
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
                        <div className="flex flex-col gap-2 shrink-0">
                            {onEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEdit?.(parceria)}
                                    className="gap-1.5"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Editar
                                </Button>
                            )}
                            {onDelete && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDelete?.(parceria)}
                                    className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Excluir
                                </Button>
                            )}
                            {isCreator && onViewLog && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onViewLog?.()}
                                    className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    Ver Log
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <StatusBadge status={status} configMap={parceriaStatusConfig} />
                        {isViewingAdditive && (
                            <span className="text-xs text-amber-700 font-semibold">
                                Vendo Aditivo #{selectedAdditive.aditivo_number}
                            </span>
                        )}
                    </div>

                    {/* Toggle Original / Aditivo */}
                    {hasAdd && (
                        <div className="mt-3 flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit flex-wrap">
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
                                <strong>Aditivo nº {selectedAdditive.aditivo_number}</strong> ({selectedAdditive.aditivo_type_label || selectedAdditive.aditivo_type}).
                                {selectedAdditive.status === 'Concluído'
                                    ? ' Aditivo concluído — as alterações já foram aplicadas à Parceria original.'
                                    : ' Procedimento de alteração da Parceria original. Ao concluí-lo (fase “Parcerias”), as mudanças de prazo/objeto serão aplicadas à original.'}
                            </p>
                        </div>
                    )}

                    {/* Live Presence (sinaliza quem está vendo agora) */}
                    {isPresenceOn && organizationId && parceria.id && !isViewingAdditive && (
                        <LivePresenceIndicator
                            organizationId={organizationId}
                            entityType="parceria"
                            entityId={parceria.id}
                            userName={user?.displayName}
                        />
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

                    {/* Timeline do Workflow */}
                    <Section title="Timeline da Parceria">
                        <div className="space-y-0">
                            {timelineSteps.map((step, idx) => {
                                const dateVal = getParceriaField(viewing, step.key);
                                const formattedDate = formatDate(dateVal);
                                const isCompleted = !!formattedDate;
                                const isLast = idx === timelineSteps.length - 1;
                                const StepIcon = step.icon;

                                return (
                                    <div key={step.key} className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isCompleted
                                                ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                                                }`}>
                                                {isCompleted
                                                    ? <StepIcon className="w-3.5 h-3.5" />
                                                    : <AlertCircle className="w-3 h-3" />
                                                }
                                            </div>
                                            {!isLast && (
                                                <div className={`w-0.5 h-6 ${isCompleted ? 'bg-indigo-200 dark:bg-indigo-900' : 'bg-slate-100 dark:bg-slate-800'}`} />
                                            )}
                                        </div>
                                        <div className="pb-4 pt-0.5">
                                            <p className={`text-sm font-medium ${isCompleted ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                                                {step.label}
                                            </p>
                                            {formattedDate && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formattedDate}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {/* Dados de formalização */}
                    {getParceriaField(viewing, 'partnership_type') && (
                        <Section title="Formalização">
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <DetailItem label="Tipo" value={PARTNERSHIP_TYPE_LABEL[getParceriaField(viewing, 'partnership_type')] || getParceriaField(viewing, 'partnership_type')} />
                                <DetailItem label="Número" value={getParceriaField(viewing, 'partnership_number')} />
                                {getParceriaField(viewing, 'categoria') && (
                                    <DetailItem label="Categoria" value={getParceriaField(viewing, 'categoria')} />
                                )}
                                <DetailItem label="Assinatura" value={formatDate(getParceriaField(viewing, 'signature_date'))} />
                                {getParceriaField(viewing, 'demp') && (
                                    <DetailItem label="Publicação no DEMP" value={formatDate(getParceriaField(viewing, 'demp'))} />
                                )}
                                <DetailItem label="Vigência" value={getParceriaField(viewing, 'validity_period')} />
                                <DetailItem label="Termo Final" value={formatDate(getParceriaField(viewing, 'end_date'))} />
                                <DetailItem label="Aviso Renovação" value={formatDate(getParceriaField(viewing, 'renewal_notice_date'))} />
                            </div>
                        </Section>
                    )}

                    {/* Dados de conclusão do ADITIVO (aditivo não tem "tipo de parceria") */}
                    {isViewingAdditive && (getParceriaField(viewing, 'aditivo_signature_date') || getParceriaField(viewing, 'demp') || getParceriaField(viewing, 'objeto_aditivo') || getParceriaField(viewing, 'prazo_valor')) && (
                        <Section title="Conclusão do Aditivo">
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <DetailItem label="Nº do Aditivo" value={selectedAdditive.aditivo_number} />
                                <DetailItem label="Assinatura do Aditivo" value={formatDate(getParceriaField(viewing, 'aditivo_signature_date'))} />
                                {getParceriaField(viewing, 'demp') && (
                                    <DetailItem label="Publicação no DEMP" value={formatDate(getParceriaField(viewing, 'demp'))} />
                                )}
                                {getParceriaField(viewing, 'prazo_valor') && (
                                    <DetailItem label="Prazo de Prorrogação" value={`${getParceriaField(viewing, 'prazo_valor')} ${getParceriaField(viewing, 'prazo_unidade') || ''}`} />
                                )}
                                {getParceriaField(viewing, 'objeto_aditivo') && (
                                    <DetailItem label="Objeto do Aditivo" value={getParceriaField(viewing, 'objeto_aditivo')} multiline />
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Alterações aplicadas por aditivos (na ORIGINAL) */}
                    {!isViewingAdditive && Array.isArray(parceria.aditivo_modifications) && parceria.aditivo_modifications.length > 0 && (
                        <Section title="Alterações por Aditivo(s)">
                            <div className="pt-2 space-y-2">
                                {parceria.aditivo_modifications.map((m, i) => (
                                    <div key={m.aditivo_id || i} className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-2.5">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                                            Aditivo nº {m.aditivo_number}
                                            {m.aditivo_signature_date ? ` — assinado em ${formatDate(m.aditivo_signature_date)}` : ''}
                                            {m.demp ? ` — Publicação no DEMP ${formatDate(m.demp)}` : ''}
                                        </p>
                                        {(m.prazo_valor || m.new_end_date) && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                                                Prorrogação: +{m.prazo_valor} {m.prazo_unidade}
                                                {m.new_end_date ? ` → termo final ${formatDate(m.new_end_date)}` : ''}
                                            </p>
                                        )}
                                        {m.objeto_aditivo && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                                                Objeto acrescido: {m.objeto_aditivo}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Terceiros */}
                    {getParceriaField(viewing, 'third_party') && (
                        <Section title="Terceiros">
                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <DetailItem
                                    icon={Send}
                                    label="Remetido para"
                                    value={getParceriaField(viewing, 'third_party')}
                                />
                                {getParceriaField(viewing, 'third_party_referral_date') && (
                                    <DetailItem
                                        label="Remessa a Terceiros"
                                        value={formatDate(getParceriaField(viewing, 'third_party_referral_date'))}
                                    />
                                )}
                                {getParceriaField(viewing, 'third_party_return_date') && (
                                    <DetailItem
                                        label="Retorno de Terceiros"
                                        value={formatDate(getParceriaField(viewing, 'third_party_return_date'))}
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

                    {/* Comentários (colaboração) */}
                    {isCommentsOn && !isViewingAdditive && organizationId && parceria.id && (
                        <Section title="Comentários">
                            <div className="pt-2">
                                <EntityComments
                                    organizationId={organizationId}
                                    entityType="parceria"
                                    entityId={parceria.id}
                                    members={members}
                                />
                            </div>
                        </Section>
                    )}

                    {/* Ações */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                        {!isViewingAdditive && isCreator && (
                            <>
                                {/* Só é possível incluir aditivo quando a Parceria está
                                    ativa em "Parcerias" e não há aditivo em andamento
                                    (um por vez). */}
                                {status === 'Parcerias' && !parceria.current_additive_id && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        onClick={() => onIncludeAditivo?.(parceria)}
                                    >
                                        <GitBranch className="w-4 h-4 text-amber-600" />
                                        {hasAdd ? 'Incluir Novo Aditivo' : 'Incluir Aditivo'}
                                    </Button>
                                )}
                                {status === 'Parcerias' && !parceria.current_additive_id && onExtinguish && (
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
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
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
