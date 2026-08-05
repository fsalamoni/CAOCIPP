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
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

// Defaults alinhados com sanitizeParceriaSettings no backend.
const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_VIGENCIA_OPTIONS = [
    '6 meses', '12 meses', '24 meses', '36 meses', '60 meses', 'Indeterminado',
];

export default function CreateParceriaDialog({ open, setOpen, organization, onSuccess }) {
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        pgea: '',
        subject: '',
        object: '',
        parties: '',
        partnership_type: '',
        categoria: '',
        partnership_number: '',
        signature_date: '',
        validity_period: '',
        pgea_date: '',
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
        pgea: '', subject: '', object: '', parties: '',
        partnership_type: '', categoria: '', partnership_number: '',
        signature_date: '', validity_period: '', pgea_date: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.pgea.trim() || !formData.subject.trim() || !formData.object.trim() || !formData.parties.trim()) {
            toast.error('Preencha PGEA, Assunto, Objeto e Partes.');
            return;
        }
        try {
            setIsCreating(true);
            // Limpa strings vazias para null nos campos opcionais.
            const payload = {
                pgea: formData.pgea.trim(),
                subject: formData.subject.trim(),
                object: formData.object.trim(),
                parties: formData.parties.trim(),
            };
            for (const k of ['partnership_type', 'categoria', 'partnership_number', 'signature_date', 'validity_period', 'pgea_date']) {
                if (formData[k] && formData[k].trim()) payload[k] = formData[k].trim();
            }
            await createParceria({
                organizationId: organization.id,
                ...payload,
            });
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

                    <hr className="my-2 border-slate-200" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Dados opcionais (completam o cadastro conforme o uso)
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Parceria</Label>
                            <Select
                                value={formData.partnership_type || 'none'}
                                onValueChange={(val) => setFormData({ ...formData, partnership_type: val === 'none' ? '' : val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
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
                                value={formData.categoria || 'none'}
                                onValueChange={(val) => setFormData({ ...formData, categoria: val === 'none' ? '' : val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
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

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Criar Parceria
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
