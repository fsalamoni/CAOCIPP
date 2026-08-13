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
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, GitBranch } from 'lucide-react';

/**
 * ConcludeAditivoDialog — passo final do aditivo (fase "Parcerias").
 *
 * O aditivo NÃO tem "tipo de parceria" próprio. Ao concluir, coleta:
 *   - Número do aditivo (somente leitura — sequencial da parceria)
 *   - Data de assinatura do aditivo (obrigatória)
 *   - Prazo de prorrogação (opcional): quantidade + unidade → amplia o termo
 *     final e a vigência da ORIGINAL automaticamente.
 *   - Objeto do aditivo (opcional) → é somado ao objeto da ORIGINAL.
 * É obrigatório informar ao menos um: prazo OU objeto.
 */
export default function ConcludeAditivoDialog({
    open,
    onClose,
    aditivoNumber,
    onConfirm,
}) {
    const today = new Date().toISOString().split('T')[0];
    const [signatureDate, setSignatureDate] = useState(today);
    const [prazoValor, setPrazoValor] = useState('');
    const [prazoUnidade, setPrazoUnidade] = useState('meses');
    const [objeto, setObjeto] = useState('');
    const [saving, setSaving] = useState(false);

    const hasPrazo = prazoValor !== '' && Number(prazoValor) > 0;
    const hasObjeto = objeto.trim().length > 0;

    const reset = () => {
        setSignatureDate(today);
        setPrazoValor('');
        setPrazoUnidade('meses');
        setObjeto('');
        setSaving(false);
    };

    const handleClose = () => {
        reset();
        onClose?.();
    };

    const isValid = () => !!signatureDate && (hasPrazo || hasObjeto);

    const handleConfirm = async () => {
        if (!isValid()) return;
        setSaving(true);
        try {
            await onConfirm({
                aditivoSignatureDate: signatureDate,
                prazoValor: hasPrazo ? Number(prazoValor) : null,
                prazoUnidade: hasPrazo ? prazoUnidade : null,
                objetoAditivo: hasObjeto ? objeto.trim() : null,
            });
            reset();
        } catch {
            // erro tratado pelo chamador
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        Concluir Aditivo
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        Ao concluir, as alterações são gravadas no aditivo e aplicadas à
                        Parceria original (termo final/vigência e/ou objeto), que volta a
                        ficar ativa em “Parcerias”.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                        <GitBranch className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-200">
                            Aditivo nº {aditivoNumber || '—'}
                        </span>
                    </div>

                    <div>
                        <Label>Data de Assinatura do Aditivo <span className="text-rose-500">*</span></Label>
                        <Input
                            type="date"
                            value={signatureDate}
                            onChange={(e) => setSignatureDate(e.target.value)}
                            className="mt-1"
                        />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Prorrogação (opcional)
                        </p>
                        <Label className="text-xs text-slate-500">Prazo de prorrogação — amplia o termo final e a vigência da original</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="0"
                                value={prazoValor}
                                onChange={(e) => setPrazoValor(e.target.value)}
                                placeholder="Ex.: 12"
                                className="w-28"
                            />
                            <Select value={prazoUnidade} onValueChange={setPrazoUnidade}>
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dias">dias</SelectItem>
                                    <SelectItem value="meses">meses</SelectItem>
                                    <SelectItem value="anos">anos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Alteração de objeto (opcional)
                        </p>
                        <Label className="text-xs text-slate-500">Objeto do aditivo — é somado ao objeto da original</Label>
                        <Textarea
                            value={objeto}
                            onChange={(e) => setObjeto(e.target.value)}
                            rows={3}
                            placeholder="Descreva a alteração/acréscimo ao objeto..."
                        />
                    </div>

                    {!isValid() && (
                        <p className="text-xs text-rose-500">
                            Informe a data de assinatura e ao menos um: prazo de prorrogação ou objeto do aditivo.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={!isValid() || saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Concluir Aditivo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
