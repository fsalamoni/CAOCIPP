import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secDocumento } from '@/services/secretariaService';
import { dataHora } from './comum';

/**
 * Redações anteriores de um documento: o que cada pessoa tinha escrito antes
 * de outra revisar (ex.: a minuta da assessoria antes da revisão do gabinete).
 * Só a equipe vê; as partes nunca.
 */
export default function VersoesMinuta({ orgId, procId, documento, ocupado, onLer, onFechar }) {
    const q = useQuery({
        queryKey: ['sec-doc-versoes', orgId, procId, documento?.id, documento?.versoes],
        queryFn: () => secDocumento(orgId, procId, 'versoes', { docId: documento.id }),
        enabled: !!documento,
    });
    const versoes = q.data?.versoes || [];
    return (
        <Dialog open={!!documento} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Redações anteriores: {documento?.titulo}</DialogTitle>
                    <DialogDescription>
                        Quando outra pessoa revisa a minuta, a redação de quem escreveu antes fica guardada aqui. Só a equipe vê; não vai aos autos nem ao portal das partes.
                    </DialogDescription>
                </DialogHeader>
                {q.isLoading && <p className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>}
                {q.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{q.error?.message || 'Não foi possível carregar as versões.'}</p>}
                {q.isSuccess && versoes.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Este documento não tem redações anteriores.</p>}
                <ol className="space-y-2">
                    {versoes.map((v, i) => (
                        <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-2">
                            <div className="flex-1 min-w-[10rem]">
                                <p className="text-sm font-medium">{i === 0 ? 'Redação original' : `${i + 1}ª redação`}, de {v.autor_nome || 'autor não identificado'}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                    {v.de ? `escrita até ${dataHora(v.de)} · ` : ''}revista em {dataHora(v.substituida_em)} por {v.substituida_por}
                                </p>
                            </div>
                            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => onLer(v)}>Ler</Button>
                        </li>
                    ))}
                </ol>
            </DialogContent>
        </Dialog>
    );
}
