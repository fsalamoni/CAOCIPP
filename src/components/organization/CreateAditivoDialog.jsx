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

// Defaults alinhados com sanitizeParceriaSettings no backend.
const DEFAULT_ADITIVO_TIPOS = [
    'Aditivo de Prazo',
    'Aditivo de Valor',
    'Aditivo de Alteração',
    'Aditivo de Reequilíbrio',
    'Aditivo de Execução',
];

/**
 * CreateAditivoDialog — modal que pede o TIPO de aditivo.
 * O tipo é uma string livre (customizável pelo admin do órgão em
 * Administração → Configurações → Parcerias → Tipos de Aditivo).
 * Após confirmar, o backend cria o aditivo vazio (status Pendente) e abre
 * o EditParceriaDialog para preenchimento.
 */
export default function CreateAditivoDialog({
    open,
    onClose,
    parceria,
    organizationId,
    organization,
    onSuccess,
}) {
    // Tipos configurados pelo admin (com fallback para defaults).
    const tipos = (organization?.parceriaSettings?.aditivoTipos?.length
        ? organization.parceriaSettings.aditivoTipos
        : DEFAULT_ADITIVO_TIPOS
    );

    const [type, setType] = useState(tipos[0] || DEFAULT_ADITIVO_TIPOS[0]);
    const [saving, setSaving] = useState(false);

    // Garante que o tipo inicial sempre exista na lista (caso o admin troque
    // as configs enquanto o modal está aberto).
    React.useEffect(() => {
        if (!tipos.includes(type) && tipos.length > 0) {
            setType(tipos[0]);
        }
    }, [tipos, type]);

    const handleConfirm = async () => {
        if (!type) {
            toast.error('Selecione um tipo de aditivo.');
            return;
        }
        try {
            setSaving(true);
            const result = await addAditivo({
                parceriaId: parceria.id,
                organizationId,
                aditivoType: type,
                aditivoTypeLabel: type,
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
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                        {tipos.map((t) => (
                            <label
                                key={t}
                                className={`
                                    flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition
                                    ${type === t
                                        ? 'border-amber-500 bg-amber-50'
                                        : 'border-slate-200 hover:border-slate-300'}
                                `}
                            >
                                <input
                                    type="radio"
                                    name="aditivo_type"
                                    value={t}
                                    checked={type === t}
                                    onChange={(e) => setType(e.target.value)}
                                    className="text-amber-600 focus:ring-amber-500"
                                />
                                <span className="font-medium text-sm">{t}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        Os tipos são configurados pelo administrador do órgão em
                        <strong> Administração → Configurações → Parcerias → Tipos de Aditivo</strong>.
                    </p>
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
