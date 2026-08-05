import React, { useState } from 'react';
import { createParceria } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { format } from 'date-fns';

// Defaults alinhados com sanitizeParceriaSettings no backend.
const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_VIGENCIA_OPTIONS = [
    '6 meses', '12 meses', '24 meses', '36 meses', '60 meses', 'Indeterminado',
];

/**
 * CreateParceriaDialog — modal de criação no padrão de CreateExpedienteDialog.
 * Aceita campos opcionais de formalização (tipo, número, categoria, datas)
 * e flags de comportamento (urgency_request, access_restriction).
 */
export default function CreateParceriaDialog({ open, setOpen, organization, members = [], onSuccess }) {
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        pgea: '',
        pgea_date: format(new Date(), 'yyyy-MM-dd'),
        subject: '',
        object: '',
        parties: '',
        partnership_type: '',
        categoria: '',
        partnership_number: '',
        signature_date: '',
        validity_period: '',
        end_date: '',
        renewal_notice_date: '',
        responsible_user_id: '',
        responsible_user_name: '',
        urgency_request: false,
        access_restriction: false,
    });

    // Configurações do módulo vindas do banco do órgão.
    const tipos = organization?.parceriaSettings?.tipos?.length
        ? organization.parceriaSettings.tipos
        : DEFAULT_TIPOS;
    const categorias = organization?.parceriaSettings?.categorias || [];
    const vigenciaOptions = organization?.parceriaSettings?.vigenciaOptions?.length
        ? organization.parceriaSettings.vigenciaOptions
        : DEFAULT_VIGENCIA_OPTIONS;

    const resetForm = () => setFormData({
        pgea: '',
        pgea_date: format(new Date(), 'yyyy-MM-dd'),
        subject: '',
        object: '',
        parties: '',
        partnership_type: '',
        categoria: '',
        partnership_number: '',
        signature_date: '',
        validity_period: '',
        end_date: '',
        renewal_notice_date: '',
        responsible_user_id: '',
        responsible_user_name: '',
        urgency_request: false,
        access_restriction: false,
    });

    const handleResponsibleChange = (userId) => {
        const member = members.find((m) => m.user_id === userId);
        setFormData((prev) => ({
            ...prev,
            responsible_user_id: userId,
            responsible_user_name: member?.user_name || '',
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.pgea.trim() || !formData.subject.trim() || !formData.object.trim() || !formData.parties.trim()) {
            toast.error('Preencha PGEA, Assunto, Objeto e Partes.');
            return;
        }
        try {
            setIsCreating(true);
            // Envia apenas campos preenchidos (vazios viram null no backend).
            const payload = {
                organizationId: organization.id,
                pgea: formData.pgea.trim(),
                pgeaDate: formData.pgea_date || null,
                subject: formData.subject.trim(),
                object: formData.object.trim(),
                parties: formData.parties.trim(),
                urgencyRequest: !!formData.urgency_request,
                accessRestriction: !!formData.access_restriction,
            };
            const optStr = (v) => (v && v.trim()) ? v.trim() : null;
            if (formData.partnership_type) payload.partnershipType = formData.partnership_type;
            if (formData.categoria) payload.categoria = formData.categoria;
            if (formData.partnership_number) payload.partnershipNumber = formData.partnership_number;
            if (formData.signature_date) payload.signatureDate = formData.signature_date;
            if (formData.validity_period) payload.validityPeriod = formData.validity_period;
            if (formData.end_date) payload.endDate = formData.end_date;
            if (formData.renewal_notice_date) payload.renewalNoticeDate = formData.renewal_notice_date;
            if (formData.responsible_user_id) {
                payload.responsibleUserId = formData.responsible_user_id;
                payload.responsibleUserName = formData.responsible_user_name || null;
            }

            await createParceria(payload);
            toast.success('Parceria criada com sucesso!');
            setOpen(false);
            resetForm();
            if (onSuccess) onSuccess();
        } catch (error) {
            logger.error('Error creating parceria:', error);
            toast.error('Erro ao criar Parceria: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nova Parceria</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="pgea">PGEA *</Label>
                            <Input
                                id="pgea"
                                value={formData.pgea}
                                onChange={(e) => setFormData({ ...formData, pgea: e.target.value })}
                                placeholder="Ex.: 12345/2024"
                                required
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="pgea_date">Data do PGEA</Label>
                            <Input
                                id="pgea_date"
                                type="date"
                                value={formData.pgea_date}
                                onChange={(e) => setFormData({ ...formData, pgea_date: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="subject">Assunto *</Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="Resumo da Parceria"
                            required
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="object">Objeto *</Label>
                        <Textarea
                            id="object"
                            value={formData.object}
                            onChange={(e) => setFormData({ ...formData, object: e.target.value })}
                            placeholder="Descreva o objeto da Parceria..."
                            rows={3}
                            required
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="parties">Partes *</Label>
                        <Textarea
                            id="parties"
                            value={formData.parties}
                            onChange={(e) => setFormData({ ...formData, parties: e.target.value })}
                            placeholder="Partes envolvidas (ex.: MP/RS + Município X)"
                            rows={2}
                            required
                            className="mt-1"
                        />
                    </div>

                    <hr className="my-2 border-slate-200 dark:border-slate-700" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Dados opcionais (completam o cadastro conforme o uso)
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Parceria</Label>
                            <Select
                                value={formData.partnership_type || ''}
                                onValueChange={(val) => setFormData({ ...formData, partnership_type: val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {tipos.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="partnership_number">Número da Parceria</Label>
                            <Input
                                id="partnership_number"
                                value={formData.partnership_number}
                                onChange={(e) => setFormData({ ...formData, partnership_number: e.target.value })}
                                placeholder="Ex.: 001/2024"
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {categorias.length > 0 && (
                        <div>
                            <Label>Categoria</Label>
                            <Select
                                value={formData.categoria || ''}
                                onValueChange={(val) => setFormData({ ...formData, categoria: val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categorias.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="signature_date">Data da Assinatura</Label>
                            <Input
                                id="signature_date"
                                type="date"
                                value={formData.signature_date}
                                onChange={(e) => setFormData({ ...formData, signature_date: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="validity_period">Vigência</Label>
                            <Input
                                id="validity_period"
                                list="vigencia-options-create"
                                value={formData.validity_period}
                                onChange={(e) => setFormData({ ...formData, validity_period: e.target.value })}
                                placeholder="Ex.: 12 meses"
                                className="mt-1"
                            />
                            <datalist id="vigencia-options-create">
                                {vigenciaOptions.map((v) => <option key={v} value={v} />)}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="end_date">Termo Final</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="renewal_notice_date">Data do Aviso de Renovação</Label>
                            <Input
                                id="renewal_notice_date"
                                type="date"
                                value={formData.renewal_notice_date}
                                onChange={(e) => setFormData({ ...formData, renewal_notice_date: e.target.value })}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {members.length > 0 && (
                        <div>
                            <Label>Assessor Responsável</Label>
                            <Select
                                value={formData.responsible_user_id || ''}
                                onValueChange={handleResponsibleChange}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione o responsável" />
                                </SelectTrigger>
                                <SelectContent>
                                    {members.map((m) => (
                                        <SelectItem key={m.user_id} value={m.user_id}>
                                            {m.user_name} {m.function && `(${m.function})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                            <Label htmlFor="urgency_request" className="cursor-pointer">Pedido de Urgência</Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Marcar esta Parceria como urgente</p>
                        </div>
                        <Switch
                            id="urgency_request"
                            checked={formData.urgency_request}
                            onCheckedChange={(checked) => setFormData({ ...formData, urgency_request: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                            <Label htmlFor="access_restriction" className="cursor-pointer">Restrição de Acesso</Label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Restringe o acesso a este registro (auditado via flag `access_audit_log`)
                            </p>
                        </div>
                        <Switch
                            id="access_restriction"
                            checked={formData.access_restriction}
                            onCheckedChange={(checked) => setFormData({ ...formData, access_restriction: checked })}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-primary"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                'Criar Parceria'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
