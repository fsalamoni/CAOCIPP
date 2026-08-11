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

/**
 * CreateParceriaDialog — modal de criação enxuto.
 *
 * A nova Parceria entra SEMPRE na fase "Pendente". O modal coleta apenas os
 * campos mínimos; os demais (tipo, número, datas de formalização, objeto,
 * etc.) são preenchidos ao longo do fluxo de fases no Painel (Kanban), nas
 * transições próprias. Assessor é opcional — se informado, o backend registra
 * a data de distribuição, mas a Parceria continua em "Pendente" (entrar em
 * "Em análise" é uma transição própria).
 */
export default function CreateParceriaDialog({ open, setOpen, organization, members = [], onSuccess }) {
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        pgea: '',
        pgea_date: format(new Date(), 'yyyy-MM-dd'),
        subject: '',
        parties: '',
        responsible_user_id: '',
        responsible_user_name: '',
    });

    const resetForm = () => setFormData({
        pgea: '',
        pgea_date: format(new Date(), 'yyyy-MM-dd'),
        subject: '',
        parties: '',
        responsible_user_id: '',
        responsible_user_name: '',
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
        if (!formData.pgea.trim() || !formData.pgea_date || !formData.subject.trim() || !formData.parties.trim()) {
            toast.error('Preencha PGEA, Data do PGEA, Assunto e Partes.');
            return;
        }
        try {
            setIsCreating(true);
            const payload = {
                organizationId: organization.id,
                pgea: formData.pgea.trim(),
                pgeaDate: formData.pgea_date,
                subject: formData.subject.trim(),
                parties: formData.parties.trim(),
            };
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
                            <Label htmlFor="pgea_date">Data do PGEA *</Label>
                            <Input
                                id="pgea_date"
                                type="date"
                                value={formData.pgea_date}
                                onChange={(e) => setFormData({ ...formData, pgea_date: e.target.value })}
                                required
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

                    {members.length > 0 && (
                        <div>
                            <Label>Assessor Responsável</Label>
                            <Select
                                value={formData.responsible_user_id || ''}
                                onValueChange={handleResponsibleChange}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione o responsável (opcional)" />
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

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        A Parceria entra na fase <strong>Pendente</strong>. Os demais dados
                        (tipo, número, datas, objeto, etc.) são preenchidos ao avançar as
                        fases no Painel de Parcerias.
                    </p>

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
