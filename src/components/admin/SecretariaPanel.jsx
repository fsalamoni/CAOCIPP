import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gavel, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secPlataforma } from '@/services/secretariaService';

/**
 * Secretaria Processual vista pela plataforma: órgãos que usam o módulo,
 * volume, e suspensão por órgão (bloqueia sem apagar). Ativar continua com o
 * admin de cada órgão.
 */
export default function SecretariaPanel() {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-plataforma'], queryFn: () => secPlataforma('resumo') });
    const [alvo, setAlvo] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const orgs = q.data?.orgs || [];

    const aplicar = async (org, suspensa) => {
        setOcupado(true);
        try {
            await secPlataforma('suspender', { organizationId: org.id, suspensa, motivo });
            toast.success(suspensa ? 'Módulo suspenso no órgão' : 'Suspensão retirada');
            setAlvo(null);
            setMotivo('');
            qc.invalidateQueries({ queryKey: ['sec-plataforma'] });
        } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); } finally { setOcupado(false); }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600" /> Secretaria Processual</CardTitle>
                    <CardDescription>Órgãos com o módulo ligado. Suspender bloqueia o uso no órgão (equipe e partes) sem apagar processos; o admin do órgão vê o motivo.</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => q.refetch()} disabled={q.isFetching}>
                    <RefreshCw className={`w-4 h-4 ${q.isFetching ? 'animate-spin' : ''}`} /> Atualizar
                </Button>
            </CardHeader>
            <CardContent>
                {q.isLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>}
                {q.error && <p className="text-sm text-red-600">{q.error.message}</p>}
                {!q.isLoading && !q.error && orgs.length === 0 && <p className="text-sm text-slate-500">Nenhum órgão usa a Secretaria Processual.</p>}
                {orgs.length > 0 && (
                    <>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                            {orgs.length} órgão(s) · {orgs.reduce((a, o) => a + o.processos, 0)} processos · {orgs.reduce((a, o) => a + o.em_tramitacao, 0)} em tramitação
                        </p>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {orgs.map((o) => (
                                <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                                    <div className="flex-1 min-w-[14rem]">
                                        <p className="font-medium">{o.nome}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{o.processos} processos · {o.em_tramitacao} em tramitação · {o.unidades} unidades</p>
                                        {o.suspensa && o.motivo_suspensao && <p className="text-xs text-amber-800 dark:text-amber-300">Motivo: {o.motivo_suspensao}</p>}
                                    </div>
                                    {o.suspensa ? <Badge variant="destructive">Suspensa</Badge> : <Badge variant="secondary">Em uso</Badge>}
                                    {o.suspensa
                                        ? <Button size="sm" variant="outline" disabled={ocupado} onClick={() => aplicar(o, false)}>Retirar suspensão</Button>
                                        : <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setMotivo(''); setAlvo(o); }}>Suspender</Button>}
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </CardContent>
            <Dialog open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)}>
                <DialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Suspender a Secretaria em {alvo?.nome}</DialogTitle>
                        <DialogDescription>A equipe e as partes deixam de acessar os processos até a suspensão ser retirada. Nada é apagado.</DialogDescription>
                    </DialogHeader>
                    <div><Label htmlFor="susp-motivo">Motivo (aparece para o admin do órgão)</Label><Textarea id="susp-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAlvo(null)}>Cancelar</Button>
                        <Button variant="destructive" disabled={ocupado || !motivo.trim()} onClick={() => aplicar(alvo, true)}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Suspender</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
