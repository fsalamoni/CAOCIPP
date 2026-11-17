import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { criarAditivo } from '@/services/functionsService';
import { MODULOS_PGEA } from '@/lib/registrosPgea';

const SEM = '__sem__';

/**
 * Cria um aditivo de uma Consulta ou Expediente. `origem` precisa de `id` e do
 * número (`numero` ou o campo do módulo). O original fica como está; o
 * aditivo nasce em Pendente, com a identificação copiada.
 */
export default function NovoAditivoDialog({ open, onOpenChange, modulo, organization, members = [], origem, onCriado }) {
    const cfg = MODULOS_PGEA[modulo];
    const hoje = () => format(new Date(), 'yyyy-MM-dd');
    const [motivo, setMotivo] = useState('');
    const [entrada, setEntrada] = useState(hoje);
    const [urgente, setUrgente] = useState(false);
    const [responsavel, setResponsavel] = useState(SEM);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setMotivo(''); setEntrada(hoje()); setUrgente(false); setResponsavel(SEM);
    }, [open]);

    if (!cfg || !origem) return null;
    const numero = origem.numero || origem[cfg.campoNumero] || '';
    const ehAditivo = Boolean(origem.aditivo_de);
    const ativos = members.filter((m) => m.active !== false);

    const enviar = async (e) => {
        e.preventDefault();
        if (!motivo.trim()) { toast.error('Informe o motivo do aditivo.'); return; }
        setSalvando(true);
        try {
            const r = await criarAditivo({
                organizationId: organization.id,
                modulo,
                origemId: origem.id,
                motivo: motivo.trim(),
                entryDate: entrada,
                urgencyRequest: urgente,
                responsibleUserId: responsavel === SEM ? null : responsavel,
            });
            toast.success(`Aditivo nº ${r.aditivo_numero} criado. Ele está em Pendente, com tramitação própria.`);
            onOpenChange(false);
            onCriado?.(r);
        } catch (err) {
            toast.error(err?.message || 'Não foi possível criar o aditivo.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FilePlus2 className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                        Novo aditivo
                    </DialogTitle>
                    <DialogDescription>
                        {cfg.Nome} {numero}{ehAditivo ? ' (o aditivo fica vinculado ao original)' : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>O aditivo é um novo card, com o mesmo número e os mesmos dados de identificação, que entra em <strong>Pendente</strong> e percorre todas as fases com a sua própria linha do tempo.</p>
                    <p>{cfg.Nome === 'Consulta' ? 'A consulta original continua' : 'O expediente original continua'} exatamente como está, na fase em que se encontra (se arquivad{cfg.a}, segue arquivad{cfg.a}). Os dois mostram o vínculo e a fase um do outro.</p>
                </div>

                <form onSubmit={enviar} className="space-y-4">
                    <div>
                        <Label htmlFor="aditivo_motivo">Motivo do aditivo *</Label>
                        <Textarea
                            id="aditivo_motivo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Ex.: novo pedido de complementação, fato novo, reiteração..."
                            rows={3}
                            maxLength={2000}
                            required
                            className="mt-1"
                        />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="aditivo_entrada">Data de entrada *</Label>
                            <Input id="aditivo_entrada" type="date" value={entrada} onChange={(e) => setEntrada(e.target.value)} required className="mt-1" />
                        </div>
                        <div>
                            <Label htmlFor="aditivo_responsavel">Assessor responsável</Label>
                            <Select value={responsavel} onValueChange={setResponsavel}>
                                <SelectTrigger id="aditivo_responsavel" className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={SEM}>Distribuir depois</SelectItem>
                                    {ativos.map((m) => (
                                        <SelectItem key={m.user_id} value={m.user_id}>{m.user_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <Label htmlFor="aditivo_urgente" className="cursor-pointer">Pedido de urgência</Label>
                        <Switch id="aditivo_urgente" checked={urgente} onCheckedChange={setUrgente} />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
                        <Button type="submit" disabled={salvando || !motivo.trim()}>
                            {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar aditivo'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
