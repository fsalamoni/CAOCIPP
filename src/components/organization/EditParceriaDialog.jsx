import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrgPermission } from '@/lib/OrganizationPermissionsContext';
import {
    updateParceria,
    updateAditivo,
    deleteAditivo,
    deleteParceria,
} from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Lock, Trash2, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { parseLocalDate, parseValidityPeriod, formatValidityPeriod, VIGENCIA_UNITS } from '@/lib/dateUtils';
import { logger } from '@/utils/logger';
import { hasAdditives, calculateParceriaDerivedStatus } from '@/utils/parceriaUtils';
import { useAditivos } from '@/hooks/useFirestore';
import ProcessLogDialog from './ProcessLogDialog';
import EntityComments from './EntityComments';
import { LivePresenceIndicator } from '@/lib/LivePresence';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Defaults alinhados com sanitizeParceriaSettings no backend.
const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_ADITIVO_TIPOS = [
    'Aditivo de Prazo',
    'Aditivo de Valor',
    'Aditivo de Alteração',
    'Aditivo de Reequilíbrio',
    'Aditivo de Execução',
];
const DEFAULT_THIRD_PARTIES = ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

// Fases (espelhadas em functions-v2/src/shared/status.ts).
const PARCERIA_STATUSES = [
    'Pendente',
    'Em análise',
    'Em revisão',
    'Revisadas',
    'Aguarda Terceiros',
    'Parcerias',
    'Extintos',
];

/**
 * EditParceriaDialog — diálogo de edição no padrão de EditExpedienteDialog.
 *
 * Mesma estrutura visual de Tabs:
 *   - Dados Básicos: PGEA, Assunto, Partes, Objeto, Tipo/Número, Categoria, Urgência
 *   - Formalização: Tipo, Número, Assinatura, Vigência, Termo Final, Aviso Renovação
 *   - Fluxo de Trabalho: Assessor Responsável, Datas de Análise/Revisão/Terceiros, Observações, Status
 *   - Revisão e Arquivo: Pasta na Rede, Datas de Revisão, Conclusão
 *   - Colaboração (condicional): Comentários + Presença (flags)
 *
 * Suporta Parceria original (com lock se tem aditivos) OU aditivo (sempre
 * editável). Quando `isAdditive === true`, o `formData` é carregado a partir
 * de `additiveData` em vez de `parceria`.
 *
 * Permissões:
 *   - canDeleteRecords (config) || userRole admin/owner/creator → pode excluir
 *   - userRole === 'creator' → botão "Verificar Log"
 *
 * Log de acesso (flag access_audit_log): a Parceria não tem mais restrição
 * de acesso; o registro de log de auditoria é feito em outros pontos.
 */
export default function EditParceriaDialog({
    open,
    setOpen,
    parceria,
    members = [],
    organizationId,
    organization,
    userRole,
    isAdditive = false,
    additiveData = null,
    onSuccess,
}) {
    const { user } = useAuth();
    const canDeleteRecords = useOrgPermission('delete_records');
    const isCommentsOn = useFlag(FEATURE_FLAGS.PROCESS_COMMENTS.key);
    const isPresenceOn = useFlag(FEATURE_FLAGS.LIVE_PRESENCE.key);
    const showCollabTab = isCommentsOn || isPresenceOn;

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [formData, setFormData] = useState({});

    // Lock: a Parceria ORIGINAL fica read-only quando tem aditivos. Para o
    // aditivo em si, nunca há lock.
    const isLocked = !isAdditive && hasAdditives(parceria);

    // Aditivos da Parceria (somente ao editar a original): cada um vira uma
    // aba própria, somente leitura, com todas as informações do aditivo.
    const { aditivos } = useAditivos(parceria?.id, open && !isAdditive);

    // Configurações do módulo vindas do banco do órgão.
    const tipos = organization?.parceriaSettings?.tipos?.length
        ? organization.parceriaSettings.tipos
        : DEFAULT_TIPOS;
    const aditivoTipos = organization?.parceriaSettings?.aditivoTipos?.length
        ? organization.parceriaSettings.aditivoTipos
        : DEFAULT_ADITIVO_TIPOS;
    const categorias = organization?.parceriaSettings?.categorias || [];
    const thirdParties = organization?.thirdPartiesSettingsParcerias?.length
        ? organization.thirdPartiesSettingsParcerias
        : DEFAULT_THIRD_PARTIES;

    // Helper: formata data para input type="date"
    const formatDateForInput = (value) => {
        if (!value) return '';
        try {
            const d = parseLocalDate(value);
            if (isValid(d)) return format(d, 'yyyy-MM-dd');
        } catch { /* fallthrough */ }
        return '';
    };

    // Helper: formata data para exibição (dd/MM/yyyy) nas abas de aditivo.
    const formatDateDisplay = (value) => {
        if (!value) return '—';
        try {
            const d = parseLocalDate(value);
            if (isValid(d)) return format(d, 'dd/MM/yyyy');
        } catch { /* fallthrough */ }
        return '—';
    };

    // Carrega o formData a partir da fonte (parceria ou aditivo).
    useEffect(() => {
        if (!open) return;
        const src = isAdditive && additiveData ? additiveData : parceria;
        if (!src) return;

        // Resolve o assessor responsável por nome legados (mesma estratégia do
        // EditExpedienteDialog).
        let respId = src.responsible_user_id || '';
        const respName = src.responsible_user_name || '';
        if (!respId && respName && members?.length) {
            const found = members.find(
                (m) => m.user_id === respName
                    || m.user_name?.toLowerCase().trim() === respName.toString().toLowerCase().trim()
            );
            if (found) respId = found.user_id;
        }
        if (!respId && respName) respId = 'historical__advisor__placeholder';

        setFormData({
            pgea: src.pgea || '',
            subject: src.subject || '',
            object: src.object || '',
            parties: src.parties || '',
            partnership_type: src.partnership_type || '',
            partnership_number: src.partnership_number || '',
            categoria: src.categoria || '',
            signature_date: formatDateForInput(src.signature_date),
            demp: formatDateForInput(src.demp),
            validity_period: src.validity_period || '',
            // Vigência estruturada (número + unidade). Usa os campos próprios
            // quando existem; caso contrário, tenta interpretar o texto legado.
            ...(() => {
                if (Number(src.validity_value) > 0) {
                    return {
                        validity_value: String(src.validity_value),
                        validity_unit: VIGENCIA_UNITS.includes(src.validity_unit) ? src.validity_unit : 'meses',
                    };
                }
                const parsed = parseValidityPeriod(src.validity_period);
                return {
                    validity_value: parsed ? String(parsed.value) : '',
                    validity_unit: parsed ? parsed.unit : 'meses',
                };
            })(),
            end_date: formatDateForInput(src.end_date),
            renewal_notice_date: formatDateForInput(src.renewal_notice_date),
            responsible_user_id: respId,
            responsible_user_name: respName,
            responsibility_date: formatDateForInput(src.responsibility_date),
            network_folder: src.network_folder || '',
            observations: src.observations || '',
            review_conclusion_date: formatDateForInput(src.review_conclusion_date),
            third_party: src.third_party || '',
            third_party_referral_date: formatDateForInput(src.third_party_referral_date),
            review_submission_date: formatDateForInput(src.review_submission_date),
            reviewed_date: formatDateForInput(src.reviewed_date),
            archived_date: formatDateForInput(src.archived_date),
            urgency_request: src.urgency_request === true
                || String(src.urgency_request).toLowerCase().trim() === 'sim',
            status: src.status || calculateDerivedStatus(src) || 'Pendente',
            // Campos só de aditivo.
            aditivo_type: src.aditivo_type || '',
            aditivo_number: src.aditivo_number || 0,
        });
        // `members` é resolvido a partir do nome legados e não deve resetar o form
        // a cada mudança no roster.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isAdditive, additiveData, parceria]);

    // Status derivado — usa a função canônica (com aliases e prioridade do
    // campo `status`) para não divergir do Kanban/planilha.
    function calculateDerivedStatus(p) {
        return calculateParceriaDerivedStatus(p);
    }

    // Rollback de campos ao voltar o status para uma fase anterior: limpa os
    // marcadores de TODAS as fases posteriores à fase escolhida. Espelha o
    // rollback do Kanban (ParceriaKanbanBoard.PHASE_MARKER_FIELDS).
    const PHASE_MARKER_FIELDS = {
        'Em análise': { responsible_user_id: null, responsible_user_name: null, responsibility_date: null, distribution_date: null },
        'Em revisão': { review_start_date: null, network_folder: '', observations: '' },
        'Revisadas': { reviewed_date: null, review_conclusion_date: null },
        'Aguarda Terceiros': { third_party_referral_date: null, third_party: null },
        'Parcerias': {
            third_party_return_date: null, partnership_type: null, partnership_number: null,
            signature_date: null, publication_date: null, demp: null, validity_period: null,
            end_date: null, renewal_notice_date: null,
        },
    };
    const PHASE_SEQUENCE = ['Pendente', 'Em análise', 'Em revisão', 'Revisadas', 'Aguarda Terceiros', 'Parcerias', 'Extintos'];
    const getRollbackByStatus = (status) => {
        const targetIdx = PHASE_SEQUENCE.indexOf(status);
        if (targetIdx < 0) return {};
        const rollback = {};
        PHASE_SEQUENCE.forEach((phase, idx) => {
            if (idx > targetIdx && PHASE_MARKER_FIELDS[phase]) {
                Object.assign(rollback, PHASE_MARKER_FIELDS[phase]);
            }
        });
        return rollback;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isLocked) {
            toast.error('Esta Parceria possui aditivos. Edite o aditivo corrente.');
            return;
        }
        try {
            setIsSaving(true);
            const changes = { ...formData };
            // Vigência: compõe o texto ('N unidade') a partir do número +
            // unidade quando informado. Sem número válido, preserva o valor
            // legado de validity_period e não grava os campos estruturados.
            const vv = Number(changes.validity_value);
            if (Number.isFinite(vv) && vv > 0) {
                changes.validity_value = vv;
                changes.validity_unit = VIGENCIA_UNITS.includes(changes.validity_unit) ? changes.validity_unit : 'meses';
                changes.validity_period = formatValidityPeriod(vv, changes.validity_unit);
            } else {
                delete changes.validity_value;
                delete changes.validity_unit;
            }
            // Limpar campos vazios para null (exceto strings "")
            for (const k of Object.keys(changes)) {
                if (changes[k] === '') changes[k] = null;
            }
            // Normalizar sentinelas de Select (Radix não permite value=""):
            // o usuário escolheu "—" => voltamos para string vazia, que o
            // backend normaliza como null.
            for (const k of ['partnership_type', 'categoria', 'third_party']) {
                if (changes[k] === '__none__') changes[k] = null;
            }
            // responsible_user_name baseado no member selecionado
            if (changes.responsible_user_id) {
                const m = members.find((mm) => mm.user_id === changes.responsible_user_id);
                if (m) changes.responsible_user_name = m.user_name;
            }

            if (isAdditive) {
                await updateAditivo({
                    parceriaId: parceria.id,
                    aditivoId: additiveData.id,
                    organizationId,
                    changes,
                });
                toast.success('Aditivo atualizado!');
            } else {
                await updateParceria({
                    id: parceria.id,
                    organizationId,
                    changes,
                });
                toast.success('Parceria atualizada!');
            }
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            logger.error('Error saving parceria/aditivo:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (isAdditive) {
            const msg = `Excluir o Aditivo #${additiveData?.aditivo_number}? Esta ação é irreversível.`;
            if (!window.confirm(msg)) return;
            try {
                setIsDeleting(true);
                await deleteAditivo({ parceriaId: parceria.id, aditivoId: additiveData.id, organizationId });
                toast.success('Aditivo excluído!');
                setOpen(false);
                if (onSuccess) onSuccess();
            } catch (error) {
                logger.error('Error deleting aditivo:', error);
                toast.error('Erro ao excluir: ' + error.message);
            } finally {
                setIsDeleting(false);
            }
        } else {
            const msg = `Excluir a Parceria ${parceria.pgea}? Esta ação apaga também todos os aditivos.`;
            if (!window.confirm(msg)) return;
            try {
                setIsDeleting(true);
                await deleteParceria({ id: parceria.id, organizationId });
                toast.success('Parceria excluída!');
                setOpen(false);
                if (onSuccess) onSuccess();
            } catch (error) {
                logger.error('Error deleting parceria:', error);
                toast.error('Erro ao excluir: ' + error.message);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleStatusChange = (status) => {
        setFormData((prev) => ({ ...prev, status, ...getRollbackByStatus(status) }));
    };

    const handleResponsibleChange = (userId) => {
        if (userId === 'historical__advisor__placeholder') return;
        if (userId === '__none__') {
            setFormData((prev) => ({
                ...prev,
                responsible_user_id: '',
                responsible_user_name: '',
            }));
            return;
        }
        const member = members.find((m) => m.user_id === userId);
        setFormData((prev) => ({
            ...prev,
            responsible_user_id: userId,
            responsible_user_name: member?.user_name || '',
        }));
    };

    const canDelete = (userRole === 'admin' || userRole === 'owner' || userRole === 'creator' || canDeleteRecords)
        && !isLocked;

    const renderValidationSignal = (field) => {
        if (formData[field] && String(formData[field]).trim() !== '') {
            return <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in duration-300" />;
        }
        return null;
    };

    if (!parceria) return null;

    const title = isAdditive
        ? `Editar Aditivo #${additiveData?.aditivo_number} (${additiveData?.aditivo_type_label || additiveData?.aditivo_type})`
        : `Editar Parceria ${parceria.pgea || ''}`;

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className={cn(
                    'max-h-[90vh] overflow-y-auto',
                    !isAdditive && aditivos.length > 0 ? 'max-w-5xl' : 'max-w-3xl'
                )}>
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-2">
                            <DialogTitle>{title}</DialogTitle>
                            {isLocked && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                    <Lock className="w-3 h-3" />
                                    Bloqueado (possui {parceria.aditivo_count} aditivo{parceria.aditivo_count > 1 ? 's' : ''})
                                </span>
                            )}
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="mt-4">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="flex w-full flex-wrap h-auto">
                                <TabsTrigger value="basic" className="flex-1 min-w-[8rem]">Dados Básicos</TabsTrigger>
                                <TabsTrigger value="workflow" className="flex-1 min-w-[8rem]">Fluxo de Trabalho</TabsTrigger>
                                <TabsTrigger value="archive" className="flex-1 min-w-[8rem]">Revisão e Arquivo</TabsTrigger>
                                {showCollabTab && <TabsTrigger value="collab" className="flex-1 min-w-[8rem]">Colaboração</TabsTrigger>}
                                {!isAdditive && aditivos.map((a) => (
                                    <TabsTrigger
                                        key={a.id}
                                        value={`aditivo-${a.id}`}
                                        className="flex-1 min-w-[8rem] text-amber-700 data-[state=active]:text-amber-800"
                                    >
                                        Aditivo {a.aditivo_number}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {/* ===================== DADOS BÁSICOS ===================== */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
                                {!isAdditive && (
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="pgea">PGEA</Label>
                                            {renderValidationSignal('pgea')}
                                        </div>
                                        <Input
                                            id="pgea"
                                            value={formData.pgea || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, pgea: e.target.value })}
                                            className="mt-1 font-mono"
                                        />
                                    </div>
                                )}

                                {isAdditive && (
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Tipo do Aditivo</Label>
                                            {renderValidationSignal('aditivo_type')}
                                        </div>
                                        <Select
                                            value={formData.aditivo_type || ''}
                                            onValueChange={(val) => setFormData({ ...formData, aditivo_type: val })}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {aditivoTipos.map((t) => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                                {formData.aditivo_type && !aditivoTipos.includes(formData.aditivo_type) && (
                                                    <SelectItem value={formData.aditivo_type}>{formData.aditivo_type} (Histórico)</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="subject">Assunto</Label>
                                        {renderValidationSignal('subject')}
                                    </div>
                                    <Input
                                        id="subject"
                                        value={formData.subject || ''}
                                        disabled={isLocked}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="parties">Partes</Label>
                                        {renderValidationSignal('parties')}
                                    </div>
                                    <Input
                                        id="parties"
                                        value={formData.parties || ''}
                                        disabled={isLocked}
                                        onChange={(e) => setFormData({ ...formData, parties: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="object">Objeto</Label>
                                    <Textarea
                                        id="object"
                                        value={formData.object || ''}
                                        disabled={isLocked}
                                        onChange={(e) => setFormData({ ...formData, object: e.target.value })}
                                        rows={3}
                                        className="mt-1"
                                    />
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Tipo de Parceria</Label>
                                            {renderValidationSignal('partnership_type')}
                                        </div>
                                        <Select
                                            value={formData.partnership_type || '__none__'}
                                            onValueChange={(val) => setFormData({ ...formData, partnership_type: val })}
                                            disabled={isLocked}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">—</SelectItem>
                                                {tipos.map((t) => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                                {formData.partnership_type && !tipos.includes(formData.partnership_type) && (
                                                    <SelectItem value={formData.partnership_type}>{formData.partnership_type} (Histórico)</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Número da Parceria</Label>
                                            {renderValidationSignal('partnership_number')}
                                        </div>
                                        <Input
                                            value={formData.partnership_number || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, partnership_number: e.target.value })}
                                            placeholder="Ex.: 001/2024"
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                {categorias.length > 0 && (
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <Label>Categoria</Label>
                                                {renderValidationSignal('categoria')}
                                            </div>
                                            <Select
                                                value={formData.categoria || '__none__'}
                                                onValueChange={(val) => setFormData({ ...formData, categoria: val })}
                                                disabled={isLocked}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">—</SelectItem>
                                                    {categorias.map((c) => (
                                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                                    ))}
                                                    {formData.categoria && !categorias.includes(formData.categoria) && (
                                                        <SelectItem value={formData.categoria}>{formData.categoria} (Histórico)</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Data da Assinatura</Label>
                                            {renderValidationSignal('signature_date')}
                                        </div>
                                        <Input
                                            type="date"
                                            value={formData.signature_date || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, signature_date: e.target.value })}
                                            className={cn(
                                                "mt-1 transition-all duration-300",
                                                formData.signature_date ? "border-emerald-200 focus-visible:ring-emerald-500" : ""
                                            )}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Publicação no DEMP</Label>
                                            {renderValidationSignal('demp')}
                                        </div>
                                        <Input
                                            type="date"
                                            value={formData.demp || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, demp: e.target.value })}
                                            className="mt-1"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-0.5">Data de publicação no Diário Eletrônico do MP</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label>Vigência</Label>
                                            {renderValidationSignal('validity_value')}
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={formData.validity_value || ''}
                                                disabled={isLocked}
                                                onChange={(e) => setFormData({ ...formData, validity_value: e.target.value })}
                                                placeholder="Ex.: 12"
                                                className="w-24"
                                            />
                                            <Select
                                                value={formData.validity_unit || 'meses'}
                                                onValueChange={(val) => setFormData({ ...formData, validity_unit: val })}
                                                disabled={isLocked}
                                            >
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {VIGENCIA_UNITS.map((u) => (
                                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {formData.validity_period && !(Number(formData.validity_value) > 0) && (
                                            <p className="text-[10px] text-slate-400 mt-0.5">Vigência atual: {formData.validity_period}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div>
                                        <Label htmlFor="urgency_request" className="cursor-pointer">Pedido de Urgência</Label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Marcar esta Parceria como urgente</p>
                                    </div>
                                    <Switch
                                        id="urgency_request"
                                        checked={formData.urgency_request || false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, urgency_request: checked })}
                                    />
                                </div>

                            </TabsContent>

                            {/* ===================== FLUXO DE TRABALHO ===================== */}
                            <TabsContent value="workflow" className="space-y-4 mt-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Assessor Responsável</Label>
                                        <Select
                                            value={formData.responsible_user_id || '__none__'}
                                            onValueChange={handleResponsibleChange}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">Sem assessor responsável</SelectItem>
                                                {members.map((member) => (
                                                    <SelectItem key={member.user_id} value={member.user_id}>
                                                        {member.user_name} {member.function ? `(${member.function})` : ''}
                                                    </SelectItem>
                                                ))}
                                                {formData.responsible_user_id && !members.find((m) => m.user_id === formData.responsible_user_id) && formData.responsible_user_name && (
                                                    <SelectItem value={formData.responsible_user_id}>
                                                        {formData.responsible_user_name}
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Data de Responsabilidade</Label>
                                        <Input
                                            type="date"
                                            value={formData.responsibility_date || ''}
                                            onChange={(e) => setFormData({ ...formData, responsibility_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 p-4 bg-cyan-50/50 dark:bg-cyan-950/30 rounded-lg border border-cyan-100 dark:border-cyan-800">
                                    <div>
                                        <Label>Data da Remessa a Terceiros</Label>
                                        <Input
                                            type="date"
                                            value={formData.third_party_referral_date || ''}
                                            onChange={(e) => setFormData({ ...formData, third_party_referral_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Remetido para</Label>
                                        <Select
                                            value={formData.third_party || '__none__'}
                                            onValueChange={(val) => setFormData({ ...formData, third_party: val })}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione o destinatário" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">—</SelectItem>
                                                {thirdParties.map((name) => (
                                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                                ))}
                                                {formData.third_party && !thirdParties.includes(formData.third_party) && (
                                                    <SelectItem value={formData.third_party}>{formData.third_party} (Histórico)</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <Label>Conclusão da Revisão</Label>
                                    <Input
                                        type="date"
                                        value={formData.review_conclusion_date || ''}
                                        onChange={(e) => setFormData({ ...formData, review_conclusion_date: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Observações</Label>
                                    <Textarea
                                        value={formData.observations || ''}
                                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                                        placeholder="Observações sobre a Parceria..."
                                        rows={4}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Status da Parceria</Label>
                                    <Select
                                        value={formData.status || 'Pendente'}
                                        onValueChange={handleStatusChange}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Selecione o status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PARCERIA_STATUSES.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </TabsContent>

                            {/* ===================== REVISÃO E ARQUIVO ===================== */}
                            <TabsContent value="archive" className="space-y-4 mt-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Termo Final</Label>
                                        <Input
                                            type="date"
                                            value={formData.end_date || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Data do Aviso de Renovação</Label>
                                        <Input
                                            type="date"
                                            value={formData.renewal_notice_date || ''}
                                            disabled={isLocked}
                                            onChange={(e) => setFormData({ ...formData, renewal_notice_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Remessa para Revisão</Label>
                                        <Input
                                            type="date"
                                            value={formData.review_submission_date || ''}
                                            onChange={(e) => setFormData({ ...formData, review_submission_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label>Revisão Concluída</Label>
                                        <Input
                                            type="date"
                                            value={formData.reviewed_date || ''}
                                            onChange={(e) => setFormData({ ...formData, reviewed_date: e.target.value })}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Data de Arquivamento</Label>
                                    <Input
                                        type="date"
                                        value={formData.archived_date || ''}
                                        onChange={(e) => setFormData({ ...formData, archived_date: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Pasta na Rede</Label>
                                    <Input
                                        value={formData.network_folder || ''}
                                        onChange={(e) => setFormData({ ...formData, network_folder: e.target.value })}
                                        placeholder="Caminho da pasta na rede..."
                                        className="mt-1"
                                    />
                                </div>
                            </TabsContent>

                            {/* ===================== COLABORAÇÃO (condicional) ===================== */}
                            {showCollabTab && (
                                <TabsContent value="collab" className="space-y-4 mt-4">
                                    {isPresenceOn && source?.id && (
                                        <LivePresenceIndicator
                                            organizationId={organizationId}
                                            entityType="parceria"
                                            entityId={source.id}
                                            userName={user?.displayName}
                                        />
                                    )}
                                    {isCommentsOn && source?.id ? (
                                        <EntityComments
                                            organizationId={organizationId}
                                            entityType="parceria"
                                            entityId={source.id}
                                            members={members}
                                        />
                                    ) : isCommentsOn && (
                                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
                                            Salve a Parceria antes de adicionar comentários.
                                        </p>
                                    )}
                                </TabsContent>
                            )}

                            {/* ===================== ABAS DE ADITIVO (somente leitura) ===================== */}
                            {!isAdditive && aditivos.map((a) => (
                                <TabsContent key={a.id} value={`aditivo-${a.id}`} className="space-y-4 mt-4">
                                    <AditivoReadOnlyPanel
                                        aditivo={a}
                                        formatDate={formatDateDisplay}
                                    />
                                </TabsContent>
                            ))}
                        </Tabs>

                        <div className="flex justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex">
                                {canDelete && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={handleDelete}
                                        disabled={isDeleting || isSaving}
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Excluindo...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir {isAdditive ? 'Aditivo' : 'Parceria'}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {userRole === 'creator' && !isAdditive && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setLogOpen(true)}
                                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    >
                                        <Archive className="w-3.5 h-3.5 mr-1" />
                                        Verificar Log
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    className="bg-primary"
                                    disabled={isSaving || isDeleting || isLocked}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Salvar Alterações'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Log de atividades (reusa ProcessLogDialog, mesmo padrão). */}
            {!isAdditive && (
                <ProcessLogDialog
                    open={logOpen}
                    onClose={() => setLogOpen(false)}
                    process={parceria}
                    collectionName="parcerias"
                />
            )}
        </>
    );
}

/**
 * Escopo declarado do aditivo em texto legível (prorrogação/objeto).
 */
function aditivoScopeLabel(aditivo) {
    const p = aditivo?.is_prorrogacao === true;
    const o = aditivo?.is_objeto === true;
    if (p && o) return 'Prorrogação e Objeto';
    if (p) return 'Prorrogação';
    if (o) return 'Objeto';
    return aditivo?.aditivo_type_label || aditivo?.aditivo_type || '—';
}

/**
 * AditivoReadOnlyPanel — visão somente leitura de um aditivo, dentro da aba
 * própria do aditivo no modal de edição da Parceria. Segue a ordem das fases
 * e da inclusão: identificação → dados → fluxo → conclusão.
 *
 * O aditivo é um procedimento próprio; sua edição acontece no fluxo dele
 * (Kanban / diálogo do aditivo). Aqui é apenas consulta consolidada.
 */
function AditivoReadOnlyPanel({ aditivo, formatDate }) {
    if (!aditivo) return null;
    const isConcluded = aditivo.status === 'Concluído';
    const hasConclusion = isConcluded
        || aditivo.aditivo_signature_date
        || aditivo.demp
        || aditivo.prazo_valor
        || aditivo.objeto_aditivo;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        Aditivo nº {aditivo.aditivo_number} — {aditivoScopeLabel(aditivo)}
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Procedimento próprio da Parceria. Edite-o pelo fluxo do aditivo.
                    </p>
                </div>
                <span className="shrink-0 inline-flex items-center rounded-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-200">
                    {aditivo.status || 'Pendente'}
                </span>
            </div>

            <ReadOnlySection title="Identificação">
                <ReadOnlyField label="Nº do Aditivo" value={aditivo.aditivo_number} />
                <ReadOnlyField label="Escopo" value={aditivoScopeLabel(aditivo)} />
                <ReadOnlyField label="PGEA do Aditivo" value={aditivo.pgea} mono />
                <ReadOnlyField label="PGEA da Parceria (origem)" value={aditivo.pgea_at_additive_creation} mono />
            </ReadOnlySection>

            <ReadOnlySection title="Dados">
                <ReadOnlyField label="Assunto" value={aditivo.subject} full />
                <ReadOnlyField label="Partes" value={aditivo.parties} full />
                <ReadOnlyField label="Objeto" value={aditivo.object} full multiline />
            </ReadOnlySection>

            <ReadOnlySection title="Fluxo de Trabalho">
                <ReadOnlyField label="Assessor Responsável" value={aditivo.responsible_user_name} />
                <ReadOnlyField label="Data de Responsabilidade" value={formatDate(aditivo.responsibility_date)} />
                <ReadOnlyField label="Remessa a Terceiros" value={formatDate(aditivo.third_party_referral_date)} />
                <ReadOnlyField label="Remetido para" value={aditivo.third_party} />
                <ReadOnlyField label="Conclusão da Revisão" value={formatDate(aditivo.review_conclusion_date || aditivo.reviewed_date)} />
                <ReadOnlyField label="Pasta na Rede" value={aditivo.network_folder} full mono />
                <ReadOnlyField label="Observações" value={aditivo.observations} full multiline />
            </ReadOnlySection>

            {hasConclusion && (
                <ReadOnlySection title="Conclusão do Aditivo">
                    <ReadOnlyField label="Assinatura do Aditivo" value={formatDate(aditivo.aditivo_signature_date)} />
                    <ReadOnlyField label="Publicação no DEMP" value={formatDate(aditivo.demp)} />
                    {aditivo.prazo_valor ? (
                        <ReadOnlyField
                            label="Prazo de Prorrogação"
                            value={`+${aditivo.prazo_valor} ${aditivo.prazo_unidade || ''}`.trim()}
                        />
                    ) : null}
                    <ReadOnlyField label="Objeto do Aditivo" value={aditivo.objeto_aditivo} full multiline />
                </ReadOnlySection>
            )}
        </div>
    );
}

function ReadOnlySection({ title, children }) {
    return (
        <div>
            <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                {title}
            </h4>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                {children}
            </div>
        </div>
    );
}

function ReadOnlyField({ label, value, full = false, multiline = false, mono = false }) {
    const isEmpty = value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '—';
    return (
        <div className={full ? 'md:col-span-2' : ''}>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
            {isEmpty ? (
                <p className="text-sm text-slate-300 dark:text-slate-600">—</p>
            ) : multiline ? (
                <p className={cn(
                    'text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded-md p-2.5 border border-slate-100 dark:border-slate-700 mt-0.5',
                    mono && 'font-mono break-all'
                )}>
                    {value}
                </p>
            ) : (
                <p className={cn('text-sm text-slate-700 dark:text-slate-200', mono && 'font-mono break-all')}>
                    {value}
                </p>
            )}
        </div>
    );
}
