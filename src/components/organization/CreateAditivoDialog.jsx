import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, GitBranch } from 'lucide-react';
import { addAditivo } from '@/services/functionsService';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

const VALID_TYPES = [
    { value: 'renovacao_prorrogacao', label: 'Renovação / Prorrogação' },
    { value: 'qualitativo', label: 'Qualitativo (Objeto)' },
];

/**
 * CreateAditivoDialog — modal que pede APENAS o tipo de aditivo.
 * Após confirmar, o backend cria o aditivo vazio (status Pendente) e abre
 * o EditAditivoDialog para preenchimento.
 */
export default function CreateAditivoDialog({ open, onClose, parceria, organizationId, onSuccess }) {
    const [type, setType] = useState('renovacao_prorrogacao');
    const [saving, setSaving] = useState(false);

    const handleConfirm = async () => {
        try {
            setSaving(true);
            const result = await addAditivo({
                parceriaId: parceria.id,
                organizationId,
                aditivoType: type,
            });
            toast.success(`Aditivo #${result.aditivoNumber} criado!`);
            onSuccess?.(result);
            onClose?.();
        } catch (error) {
            logger.error('Error creating aditivo:', error);
            toast.error('Erro ao criar aditivo: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-amber-600" />
                        Incluir Aditivo
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        Parceria <span className="font-mono font-semibold">{parceria?.pgea}</span>.
                        Escolha o tipo de aditivo. A Parceria original será congelada
                        e o aditivo seguirá o fluxo normal.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 py-2">
                    <Label>Tipo de Aditivo</Label>
                    <div className="space-y-2">
                        {VALID_TYPES.map((t) => (
                            <label
                                key={t.value}
                                className={`
                                    flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition
                                    ${type === t.value
                                        ? 'border-amber-500 bg-amber-50'
                                        : 'border-slate-200 hover:border-slate-300'}
                                `}
                            >
                                <input
                                    type="radio"
                                    name="aditivo_type"
                                    value={t.value}
                                    checked={type === t.value}
                                    onChange={(e) => setType(e.target.value)}
                                    className="text-amber-600 focus:ring-amber-500"
                                />
                                <span className="font-medium text-sm">{t.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Criar Aditivo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
