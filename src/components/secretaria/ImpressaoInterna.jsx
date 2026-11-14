import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { baixarBase64 } from '@/services/secretariaService';
import { dataHora } from './comum';
import { itensInternos, rotuloDocumentoInterno, selecaoInterna, totalMarcado } from '@/lib/impressaoInterna';

const linha = 'flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-2 text-sm';
const menor = 'block text-xs text-slate-600 dark:text-slate-400';

/**
 * Impressão interna: a equipe marca registros internos, minutas, documentos
 * guardados fora dos autos e redações anteriores, e recebe um PDF de uso
 * interno (sem folhas dos autos, com a marca em toda página).
 * `gerar(selecao)` devolve `{ base64, nome }`.
 */
export default function ImpressaoInterna({ aberto, movimentos, documentos, gerar, onFechar }) {
    const [marcados, setMarcados] = useState(() => new Set());
    const [gerando, setGerando] = useState(false);
    const itens = useMemo(() => itensInternos(movimentos, documentos), [movimentos, documentos]);
    useEffect(() => { if (!aberto) setMarcados(new Set()); }, [aberto]);

    const alternar = (chaves, ligar) => setMarcados((s) => {
        const n = new Set(s);
        chaves.forEach((k) => (ligar ? n.add(k) : n.delete(k)));
        return n;
    });
    const chavesRegistros = itens.registros.map((m) => `r:${m.seq}`);
    const todosRegistros = chavesRegistros.length > 0 && chavesRegistros.every((k) => marcados.has(k));
    const selecao = selecaoInterna(marcados, itens);
    const total = totalMarcado(selecao);
    const vazio = !itens.registros.length && !itens.documentos.length && !itens.soVersoes.length;

    const confirmar = async () => {
        setGerando(true);
        try {
            const r = await gerar(selecao);
            baixarBase64(r.base64, r.nome);
            toast.success('PDF interno gerado');
            onFechar();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível gerar o PDF interno');
        } finally { setGerando(false); }
    };
    // Funções, não componentes: componente criado a cada render remontaria a caixa e tiraria o foco do teclado.
    const caixa = (chave, rotulo) => (
        <Checkbox className="mt-0.5" checked={marcados.has(chave)} onCheckedChange={(c) => alternar([chave], c === true)} aria-label={rotulo} />
    );
    const comVersoes = (d) => (d.versoes > 0 ? (
        <label className="mt-1 flex min-h-[2.75rem] sm:min-h-0 items-center gap-1.5 text-xs">
            <Checkbox checked={marcados.has(`v:${d.id}`)} onCheckedChange={(c) => alternar([`v:${d.id}`], c === true)} aria-label={`Incluir as redações anteriores de ${d.titulo}`} />
            Incluir as redações anteriores ({d.versoes})
        </label>
    ) : null);

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && !gerando && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Impressão interna</DialogTitle>
                    <DialogDescription>
                        PDF de uso da equipe com o que fica fora dos autos. Marque o que deve sair. Ele não tem folhas dos autos, leva a marca de uso interno em toda página e não deve ser entregue às partes.
                    </DialogDescription>
                </DialogHeader>
                {vazio && <p className="text-sm text-slate-600 dark:text-slate-400">Este processo não tem registros internos, minutas nem documentos fora dos autos.</p>}
                {itens.registros.length > 0 && (
                    <section className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">Registros internos ({itens.registros.length})</h3>
                            <Button size="sm" variant="ghost" onClick={() => alternar(chavesRegistros, !todosRegistros)}>{todosRegistros ? 'Desmarcar todos' : 'Marcar todos'}</Button>
                        </div>
                        <ul className="space-y-1.5">
                            {itens.registros.map((m) => (
                                <li key={m.seq}>
                                    <label className={linha}>
                                        {caixa(`r:${m.seq}`, `Imprimir o registro ${m.seq}: ${m.titulo}`)}
                                        <span className="min-w-0">
                                            <span className="font-medium">{m.seq} · {m.titulo}</span>
                                            <span className={menor}>{dataHora(m.em)} · {m.autor_nome}</span>
                                            <span className="block break-words text-slate-700 dark:text-slate-300">{String(m.descricao || '').slice(0, 220)}{String(m.descricao || '').length > 220 ? '…' : ''}</span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {itens.documentos.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Minutas e documentos fora dos autos ({itens.documentos.length})</h3>
                        <ul className="space-y-1.5">
                            {itens.documentos.map((d) => (
                                <li key={d.id} className={linha}>
                                    {caixa(`d:${d.id}`, `Imprimir ${d.titulo}`)}
                                    <div className="min-w-0">
                                        <p className="font-medium break-words">{d.titulo}</p>
                                        <p className={menor}>{rotuloDocumentoInterno(d)} · {d.tipo} · {d.origem === 'editor' ? 'redigido' : d.nome_arquivo} · {d.autor_nome}</p>
                                        {comVersoes(d)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {itens.soVersoes.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold">Redações anteriores de documentos dos autos</h3>
                        <p className={menor}>O documento juntado sai no PDF dos autos. Aqui entra só o que foi escrito antes da revisão.</p>
                        <ul className="space-y-1.5">
                            {itens.soVersoes.map((d) => (
                                <li key={d.id} className={linha}>
                                    <div className="min-w-0">
                                        <p className="font-medium break-words">{d.titulo}</p>
                                        <p className={menor}>{rotuloDocumentoInterno(d)} · {d.tipo}</p>
                                        {comVersoes(d)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                <DialogFooter>
                    <Button variant="outline" disabled={gerando} onClick={onFechar}>Cancelar</Button>
                    <Button className="gap-2" disabled={gerando || total === 0} onClick={confirmar}>
                        {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Gerar PDF interno{total ? ` (${total})` : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
