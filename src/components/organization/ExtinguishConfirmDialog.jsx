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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive, AlertTriangle, Loader2 } from 'lucide-react';
import { extinguishParceria } from '@/services/functionsService';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

const REQUIRED_TOKEN = 'EXTINGUIR';

/**
 * ExtinguishConfirmDialog — confirmação dupla (digitar "EXTINGUIR") para
 * extinguir uma Parceria sem renovação. Aciona Cloud Function extinguishParceria.
 */
export default function ExtinguishConfirmDialog({ open, onClose, parceria, organizationId, onSuccess }) {
    const [token, setToken] = useState('');
    const [saving, setSaving] = useState(false);

    const handleConfirm = async () => {
        if (token !== REQUIRED_TOKEN) {
            toast.error(`Digite "${REQUIRED_TOKEN}" para confirmar.`);
            return;
        }
        try {
            setSaving(true);
            await extinguishParceria({
                parceriaId: parceria.id,
                organizationId,
                confirm: REQUIRED_TOKEN,
            });
            toast.success('Parceria extinta sem renovação.');
            onSuccess?.();
            onClose?.();
        } catch (error) {
            logger.error('Error extinguishing:', error);
            toast.error('Erro ao extinguir: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Archive className="w-5 h-5 text-slate-500" />
                        Confirmar Extinção
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        Esta ação é <strong>terminal</strong>: a Parceria{' '}
                        <span className="font-mono font-semibold">{parceria?.pgea}</span>{' '}
                        será marcada como extinta sem renovação. Todos os aditivos
                        também serão marcados como extintos.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800">
                            A extinção NÃO pode ser desfeita. Se a Parceria puder
                            ser renovada, crie um aditivo antes.
                        </p>
                    </div>

                    <div>
                        <Label>
                            Digite <code className="font-mono font-bold text-rose-600">{REQUIRED_TOKEN}</code> para confirmar
                        </Label>
                        <Input
                            value={token}
                            onChange={(e) => setToken(e.target.value.toUpperCase())}
                            placeholder={REQUIRED_TOKEN}
                            className="mt-1 font-mono"
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={saving || token !== REQUIRED_TOKEN}
                        className="bg-slate-600 hover:bg-slate-700"
                    >
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Extinção
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
