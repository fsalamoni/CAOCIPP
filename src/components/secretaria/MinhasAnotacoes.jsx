import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Lock, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { secProcesso } from '@/services/secretariaService';

/**
 * Anotação privada de quem lê o processo: só a própria pessoa vê, nunca vai
 * aos autos nem às partes. Fechada por padrão; abre sozinha se já houver texto.
 */
export default function MinhasAnotacoes({ orgId, procId }) {
    const qc = useQueryClient();
    const chave = ['sec-anotacao', orgId, procId];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'anotacao', { id: procId }) });
    const [aberta, setAberta] = useState(false);
    const [texto, setTexto] = useState('');
    const [salvando, setSalvando] = useState(false);
    const salvo = q.data?.texto || '';
    useEffect(() => { setTexto(salvo); if (salvo) setAberta(true); }, [salvo]);
    const mudou = texto !== salvo;
    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secProcesso(orgId, 'anotacao', { id: procId, texto });
            qc.setQueryData(chave, r);
            toast.success(r.texto ? 'Anotação guardada' : 'Anotação apagada');
        } catch (e) { toast.error(e?.message || 'Não foi possível guardar'); } finally { setSalvando(false); }
    };
    return (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" aria-labelledby="anot-titulo">
            <button type="button" id="anot-titulo" aria-expanded={aberta} aria-controls="anot-corpo" onClick={() => setAberta(!aberta)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-800 dark:text-slate-100 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <NotebookPen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                Minhas anotações
                {salvo && !aberta && <span className="text-xs font-normal text-slate-600 dark:text-slate-400">(você tem anotação)</span>}
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${aberta ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {aberta && (
                <div id="anot-corpo" className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" aria-hidden /> Só você vê. Não vai aos autos nem às partes, e ninguém da equipe ou da administração lê pela plataforma.</p>
                    {q.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p> : (
                        <>
                            <Textarea rows={5} maxLength={20000} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Minhas anotações sobre este processo"
                                placeholder="Pontos para o voto, dúvidas para a sessão, folhas a reler…" />
                            <div className="flex flex-wrap items-center gap-2">
                                <Button size="sm" onClick={salvar} disabled={salvando || !mudou}>{salvando && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Guardar</Button>
                                {mudou && <Button size="sm" variant="ghost" onClick={() => setTexto(salvo)}>Desfazer</Button>}
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {q.data?.atualizada_em ? `Guardada em ${new Date(q.data.atualizada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'Nada guardado ainda'}
                                    {mudou ? ' · alterações não guardadas' : ''}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
