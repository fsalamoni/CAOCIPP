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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, GitBranch, CalendarClock, FileText } from 'lucide-react';
import { addAditivo } from '@/services/functionsService';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

/**
 * Deriva o rótulo do aditivo a partir do escopo declarado (prorrogação/objeto).
 * Mantém-se em sincronia com o backend (addAditivo.deriveAditivoLabel).
 */
export function deriveAditivoLabel(isProrrogacao, isObjeto) {
    if (isProrrogacao && isObjeto) return 'Prorrogação e Objeto';
    if (isProrrogacao) return 'Prorrogação';
    if (isObjeto) return 'Objeto';
    return '';
}

/**
 * CreateAditivoDialog — modal de inclusão de aditivo.
 *
 * O usuário declara o ESCOPO do aditivo por meio de checkboxes:
 *   - Prorrogação (amplia prazo/vigência da Parceria original)
 *   - Objeto (acrescenta ao objeto da Parceria original)
 * Pode marcar um, o outro ou os dois. No mínimo um deve estar marcado.
 *
 * Após confirmar, o backend cria o aditivo vazio (status Pendente) e abre
 * o EditParceriaDialog para preenchimento. Os efeitos (prazo/objeto) são
 * coletados na conclusão do aditivo, restritos ao escopo declarado aqui.
 */
export default function CreateAditivoDialog({
    open,
    onClose,
    parceria,
    organizationId,
    onSuccess,
}) {
    const [isProrrogacao, setIsProrrogacao] = useState(true);
    const [isObjeto, setIsObjeto] = useState(false);
    // (3.8) PGEA do aditivo: começa com o PGEA da Parceria (herdado), mas pode
    // ser editado para um PGEA próprio do aditivo.
    const [aditivoPgea, setAditivoPgea] = useState(parceria?.pgea || '');
    const [saving, setSaving] = useState(false);

    // Sincroniza o PGEA herdado e reseta o escopo quando o modal reabre.
    React.useEffect(() => {
        if (open) {
            setAditivoPgea(parceria?.pgea || '');
            setIsProrrogacao(true);
            setIsObjeto(false);
        }
    }, [open, parceria?.pgea]);

    const hasScope = isProrrogacao || isObjeto;

    const handleConfirm = async () => {
        if (!hasScope) {
            toast.error('Selecione ao menos um escopo: Prorrogação ou Objeto.');
            return;
        }
        const label = deriveAditivoLabel(isProrrogacao, isObjeto);
        try {
            setSaving(true);
            const result = await addAditivo({
                parceriaId: parceria.id,
                organizationId,
                // Escopo declarado do aditivo.
                isProrrogacao,
                isObjeto,
                // Compat: tipo/label derivados do escopo.
                aditivoType: label,
                aditivoTypeLabel: label,
                // Vazio → backend herda o PGEA da Parceria original.
                aditivoPgea: aditivoPgea.trim(),
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
                        Marque o escopo do aditivo. A Parceria original será congelada
                        e o aditivo seguirá o fluxo normal.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="aditivo_pgea">PGEA do Aditivo</Label>
                        <Input
                            id="aditivo_pgea"
                            value={aditivoPgea}
                            onChange={(e) => setAditivoPgea(e.target.value)}
                            placeholder="PGEA próprio do aditivo"
                            className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Por padrão, herda o PGEA da Parceria. Edite para um PGEA próprio do aditivo.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Escopo do Aditivo <span className="text-rose-500">*</span></Label>
                        <label
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                                isProrrogacao ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Checkbox
                                checked={isProrrogacao}
                                onCheckedChange={(v) => setIsProrrogacao(v === true)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="flex items-center gap-1.5 font-medium text-sm">
                                    <CalendarClock className="w-4 h-4 text-amber-600" />
                                    Prorrogação
                                </span>
                                <span className="block text-xs text-slate-500 mt-0.5">
                                    Amplia o prazo de vigência e o termo final da Parceria original.
                                </span>
                            </span>
                        </label>
                        <label
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                                isObjeto ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Checkbox
                                checked={isObjeto}
                                onCheckedChange={(v) => setIsObjeto(v === true)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="flex items-center gap-1.5 font-medium text-sm">
                                    <FileText className="w-4 h-4 text-amber-600" />
                                    Objeto
                                </span>
                                <span className="block text-xs text-slate-500 mt-0.5">
                                    Acrescenta conteúdo ao objeto da Parceria original.
                                </span>
                            </span>
                        </label>
                        {!hasScope && (
                            <p className="text-xs text-rose-500">
                                Marque ao menos um escopo (Prorrogação e/ou Objeto).
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={saving || !hasScope}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Criar Aditivo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
