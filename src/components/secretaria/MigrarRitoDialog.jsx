import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secConfig } from '@/services/secretariaService';
import { NativeSelect } from './comum';
import ErroQuery from './ErroQuery';

const plural = (n, um, varios) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/**
 * Leva os processos em andamento de versões anteriores para a versão atual do
 * rito (só o admin). Mostra quantos estão em cada versão e fase; quem está numa
 * fase que deixou de existir precisa de uma fase de destino.
 */
export default function MigrarRitoDialog({ orgId, rito, onFechar }) {
    const qc = useQueryClient();
    const [destinos, setDestinos] = useState({});
    const [gravando, setGravando] = useState(false);
    const q = useQuery({
        queryKey: ['sec-migrar-rito', orgId, rito?.id],
        queryFn: () => secConfig(orgId, 'migrarRito', { rito_id: rito.id, simular: true }),
        enabled: !!rito, staleTime: 0,
    });
    const d = q.data;
    const faltam = (d?.grupos || []).filter((g) => !g.existe && !destinos[g.fase_id]);
    const atualizar = async () => {
        setGravando(true);
        try {
            const r = await secConfig(orgId, 'migrarRito', { rito_id: rito.id, destinos });
            toast.success(`${plural(r.atualizados, 'processo levado', 'processos levados')} à versão ${r.versao}.${r.restantes ? ` Faltam ${r.restantes}: clique em Atualizar de novo.` : ''}`);
            qc.invalidateQueries({ queryKey: ['sec-migrar-rito', orgId, rito.id] });
            qc.invalidateQueries({ queryKey: ['sec-processos'] });
            qc.invalidateQueries({ queryKey: ['sec-proc'] });
            if (!r.restantes) onFechar();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível atualizar os processos');
        } finally { setGravando(false); }
    };
    return (
        <Dialog open={!!rito} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Atualizar processos do rito {rito?.nome}</DialogTitle>
                    <DialogDescription>
                        Cada processo segue a versão do rito com que foi autuado. Aqui você leva os que estão em andamento ou sobrestados para a versão atual.
                        O que já foi feito em cada fase continua valendo quando a ação ou o documento tem o mesmo texto. Nada do que está nos autos muda, e cada processo ganha um registro interno da atualização.
                    </DialogDescription>
                </DialogHeader>
                {q.isLoading && <p role="status" className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Procurando processos…</p>}
                {q.error && <ErroQuery q={q} />}
                {d && d.total === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">Todos os processos em andamento já estão na versão {d.versao}.</p>}
                {d && d.total > 0 && (
                    <div className="space-y-3 text-sm">
                        <p className="text-slate-700 dark:text-slate-300">{plural(d.total, 'processo está', 'processos estão')} numa versão anterior à {d.versao}{d.cortado ? ' (contados até 2.000)' : ''}.</p>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                            {d.grupos.map((g) => (
                                <li key={`${g.versao}-${g.fase_id}`} className="p-3 space-y-2">
                                    <p><span className="font-medium">{plural(g.processos, 'processo', 'processos')}</span> na versão {g.versao}, fase <span className="font-medium">{g.fase_nome}</span>
                                        {g.existe ? <span className="text-slate-600 dark:text-slate-400"> (continua nesta fase)</span> : <span className="text-amber-800 dark:text-amber-300"> (fase que não existe na versão {d.versao})</span>}</p>
                                    {!g.existe && (
                                        <NativeSelect id={`destino-${g.versao}-${g.fase_id}`} label={`Fase da versão ${d.versao} para quem está em ${g.fase_nome}`}
                                            value={destinos[g.fase_id] || ''} onChange={(v) => setDestinos((x) => ({ ...x, [g.fase_id]: v }))}
                                            options={[['', 'Escolha…'], ...d.fases.map((f) => [f.id, f.nome])]} />
                                    )}
                                </li>
                            ))}
                        </ul>
                        {faltam.length > 0 && <p className="text-amber-800 dark:text-amber-300">Escolha a fase de destino para continuar.</p>}
                    </div>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>{d?.total ? 'Cancelar' : 'Fechar'}</Button>
                    {d?.total > 0 && (
                        <Button disabled={gravando || faltam.length > 0} onClick={atualizar}>
                            {gravando && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />} Atualizar {plural(Math.min(d.total, 300), 'processo', 'processos')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
