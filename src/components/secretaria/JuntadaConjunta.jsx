import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NativeSelect } from './comum';
import { alinharItens, moverItem, planoDaJuntada } from '@/lib/juntadaConjunta';

const caixa = 'flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm';
const dica = 'block text-xs text-slate-600 dark:text-slate-400';

/**
 * Juntada em conjunto (botão Finalizar da fase): escolher quais minutas e
 * anexos entram nos autos, em que ordem, assinar e juntar de uma vez. O que
 * não for escolhido continua como minuta ou é guardado fora dos autos.
 * `seguir`: rótulo do botão principal da fase, aberto depois da juntada.
 * `sozinha`: a fase segue sozinha quando o que ela exige é cumprido.
 */
export default function JuntadaConjunta({ aberto, titulo, minutas, uid, ocupado, seguir, sozinha, onAnexar, onConfirmar, onFechar }) {
    const [itens, setItens] = useState([]);
    const [visivel, setVisivel] = useState('sim');
    const [guardarResto, setGuardarResto] = useState(false);
    const [depois, setDepois] = useState(true);
    const arquivo = useRef(null);
    const chave = minutas.map((d) => d.id).join();
    // Anexo novo entra no fim da lista sem desfazer a ordem já escolhida; fechado, recomeça.
    useEffect(() => { setItens((a) => (aberto ? alinharItens(a, minutas) : [])); }, [aberto, chave]); // `chave` resume `minutas`, que muda de referência a cada render

    const porId = new Map(minutas.map((d) => [d.id, d]));
    const mudar = (id, parte) => setItens((a) => a.map((x) => (x.id === id ? { ...x, ...parte } : x)));
    const plano = planoDaJuntada(itens, minutas, uid, { guardarResto });
    const juntar = plano.filter((x) => x.acao === 'juntar');
    const assina = juntar.some((x) => x.assinar);
    const sobra = itens.filter((x) => porId.has(x.id) && !x.incluir).length;
    let posicao = 0;

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && !ocupado && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                    <DialogDescription>
                        Escolha o que entra nos autos e em que ordem. Os documentos marcados são juntados um a um, na ordem da lista, e passam a compor o evento desta fase.
                    </DialogDescription>
                </DialogHeader>
                {itens.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Não há minutas nem anexos. Redija um documento ou anexe um arquivo.</p>}
                <ol className="space-y-2">
                    {itens.map((x, i) => {
                        const d = porId.get(x.id);
                        if (!d) return null;
                        const assinei = (d.assinaturas || []).some((a) => a.uid === uid);
                        if (x.incluir) posicao += 1;
                        return (
                            <li key={x.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${x.incluir ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                <Checkbox checked={x.incluir} onCheckedChange={(c) => mudar(x.id, { incluir: c === true })} aria-label={`Juntar ${d.titulo}`} />
                                <span className="w-6 text-center text-sm font-medium tabular-nums" aria-hidden>{x.incluir ? `${posicao}º` : '—'}</span>
                                <div className="flex-1 min-w-[9rem]">
                                    <p className="text-sm font-medium">{d.titulo}</p>
                                    <p className={dica}>
                                        {d.tipo} · {d.origem === 'editor' ? 'redigido' : d.nome_arquivo} · {d.autor_nome}
                                        {(d.assinaturas || []).length ? ` · assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : ''}
                                    </p>
                                </div>
                                {x.incluir && (
                                    <label className="flex items-center gap-1.5 text-sm">
                                        <Checkbox checked={assinei || x.assinar} disabled={assinei} onCheckedChange={(c) => mudar(x.id, { assinar: c === true })} />
                                        {assinei ? 'Você já assinou' : 'Assinar'}
                                    </label>
                                )}
                                <div className="flex">
                                    <Button size="icon" variant="ghost" className="h-9 w-9" disabled={i === 0} onClick={() => setItens((a) => moverItem(a, i, -1))} aria-label={`Subir ${d.titulo}`}><ArrowUp className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-9 w-9" disabled={i === itens.length - 1} onClick={() => setItens((a) => moverItem(a, i, 1))} aria-label={`Descer ${d.titulo}`}><ArrowDown className="w-4 h-4" /></Button>
                                </div>
                            </li>
                        );
                    })}
                </ol>
                <div>
                    <input ref={arquivo} type="file" className="sr-only" tabIndex={-1} aria-hidden accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.odt,.xlsx"
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onAnexar(f); }} />
                    <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={() => arquivo.current?.click()}><Paperclip className="w-4 h-4" /> Anexar outro arquivo</Button>
                </div>
                <NativeSelect label="Portal das partes" value={visivel} onChange={setVisivel} options={[['sim', 'Visível às partes'], ['nao', 'Só para a equipe']]} />
                {sobra > 0 && (
                    <label className={caixa}>
                        <Checkbox className="mt-0.5" checked={guardarResto} onCheckedChange={(c) => setGuardarResto(c === true)} />
                        <span>Guardar fora dos autos o que não foi escolhido ({sobra})
                            <span className={dica}>Fica no processo, à vista da equipe e fora da impressão; depois de guardado, não se edita nem se apaga. Desmarcado, continua como minuta.</span>
                        </span>
                    </label>
                )}
                {sozinha && <p className="text-sm">Esta fase segue sozinha: juntado o último documento, se nada exigido ficar em aberto, o processo vai para a próxima fase.</p>}
                {seguir && (
                    <label className={caixa}>
                        <Checkbox className="mt-0.5" checked={depois} onCheckedChange={(c) => setDepois(c === true)} />
                        <span>{sozinha ? 'Se a fase não seguir sozinha, abrir' : 'Depois de juntar, abrir'}: {seguir}</span>
                    </label>
                )}
                <p className={dica}>
                    {assina ? 'Ao confirmar, os documentos marcados com Assinar recebem a sua assinatura eletrônica simples, com o seu nome. ' : ''}
                    A juntada dá número e folha a cada documento e não pode ser desfeita. As redações anteriores das minutas continuam guardadas para a equipe.
                </p>
                <DialogFooter>
                    <Button variant="outline" disabled={ocupado} onClick={onFechar}>Cancelar</Button>
                    <Button disabled={ocupado || juntar.length === 0} onClick={() => onConfirmar(plano, { visivel: visivel === 'sim', depois: !!seguir && depois })}>
                        {assina ? 'Assinar e juntar' : 'Juntar'} {juntar.length} {juntar.length === 1 ? 'documento' : 'documentos'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
