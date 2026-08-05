import React, { useState } from 'react';
import { createParceria } from '@/services/functionsService';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];

export default function CreateParceriaDialog({ open, setOpen, organization, onSuccess }) {
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        pgea: '',
        subject: '',
        object: '',
        parties: '',
    });

    const tipos = organization?.parceriaSettings?.tipos || DEFAULT_TIPOS;

    const resetForm = () => setFormData({ pgea: '', subject: '', object: '', parties: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.pgea.trim() || !formData.subject.trim() || !formData.object.trim() || !formData.parties.trim()) {
            toast.error('Preencha PGEA, Assunto, Objeto e Partes.');
            return;
        }
        try {
            setIsCreating(true);
            await createParceria({
                organizationId: organization.id,
                pgea: formData.pgea.trim(),
                subject: formData.subject.trim(),
                object: formData.object.trim(),
                parties: formData.parties.trim(),
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
