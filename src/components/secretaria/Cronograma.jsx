// Cronograma de obrigações na tela do processo: o diálogo que registra as
// parcelas (gerador de parcelas iguais e lista editável) e o resumo do
// andamento. As obrigações são prazos do processo (`obrigacao: true`): o
// servidor confere tudo de novo (shared/cronograma.ts).

import React, { useState } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { INTERVALOS, MAX_OBRIGACOES, fraseDoCronograma, gerarParcelas, problemasDoCronograma, reais, situacaoDasObrigacoes, totalDe, valorDe } from '@/lib/cronograma';

const sel = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const hojeBr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const VAZIO = { descricao: '', vence_em: '', valor: '' };

/**
 * Registrar o cronograma. `partes`: as partes do processo (para dizer a cargo
 * de quem). `onEnviar({ itens, destinatario })` devolve true quando gravou.
 */
export function CronogramaDialog({ alvo, partes = [], ocupado, onFechar, onEnviar }) {
    const [g, setG] = useState({ descricao: 'Parcela', quantidade: '12', primeira: '', intervalo: 'mensal', valor: '', total: '' });
    const [linhas, setLinhas] = useState([]);
    const [destinatario, setDestinatario] = useState('');
    const [tentou, setTentou] = useState(false);
    if (!alvo) return null;
    const ativos = partes.filter((x) => !x.retirada);
    const itens = linhas.map((x) => ({ descricao: x.descricao.trim(), vence_em: x.vence_em, ...(String(x.valor).trim() ? { valor: valorDe(x.valor) } : {}) }));
    const problemas = problemasDoCronograma(itens);
    const total = totalDe(itens.filter((x) => x.valor > 0));
    const fechar = () => { setLinhas([]); setTentou(false); onFechar(); };
    const gerar = () => {
        const novas = gerarParcelas({ ...g, valor: valorDe(g.valor), total: valorDe(g.total) })
            .map((x) => ({ ...x, valor: x.valor ? String(x.valor.toFixed(2)).replace('.', ',') : '' }));
        setLinhas((l) => [...l, ...novas].slice(0, MAX_OBRIGACOES));
    };
    const setL = (i, x) => setLinhas((l) => l.map((y, j) => (j === i ? { ...y, ...x } : y)));
    const podeGerar = Number(g.quantidade) >= 1 && !!g.primeira;
    return (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{alvo.titulo || 'Cronograma de obrigações'}</DialogTitle>
                    <DialogDescription>
                        Cada obrigação vira um prazo do processo: entra no alerta de vencimento, aparece para a parte no portal, que responde a ela com o comprovante, e você a encerra como cumprida quando conferir.
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    if (problemas.length) { setTentou(true); return; }
                    onEnviar({ itens, destinatario: destinatario.trim() }).then((ok) => ok && (setLinhas([]), setTentou(false)));
                }}>
                    <fieldset className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                        <legend className="px-1 text-sm font-medium">Gerar parcelas iguais</legend>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                            <div className="col-span-2 sm:col-span-2"><Label htmlFor="cr-desc">Descrição</Label><Input id="cr-desc" className="mt-1" maxLength={150} value={g.descricao} onChange={(e) => setG({ ...g, descricao: e.target.value })} /></div>
                            <div><Label htmlFor="cr-qtd">Quantidade</Label><Input id="cr-qtd" className="mt-1" type="number" inputMode="numeric" min={1} max={MAX_OBRIGACOES} value={g.quantidade} onChange={(e) => setG({ ...g, quantidade: e.target.value })} /></div>
                            <div><Label htmlFor="cr-prim">Primeiro vencimento</Label><Input id="cr-prim" className="mt-1" type="date" value={g.primeira} onChange={(e) => setG({ ...g, primeira: e.target.value })} /></div>
                            <div>
                                <Label htmlFor="cr-int">Periodicidade</Label>
                                <select id="cr-int" className={sel} value={g.intervalo} onChange={(e) => setG({ ...g, intervalo: e.target.value })}>
                                    {INTERVALOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                                </select>
                            </div>
                            <div><Label htmlFor="cr-val">Valor de cada (R$)</Label><Input id="cr-val" className="mt-1" inputMode="decimal" placeholder="Opcional" value={g.valor} disabled={!!g.total.trim()} onChange={(e) => setG({ ...g, valor: e.target.value })} /></div>
                            <div className="col-span-2 sm:col-span-2"><Label htmlFor="cr-tot">Ou valor total a dividir (R$)</Label><Input id="cr-tot" className="mt-1" inputMode="decimal" placeholder="Opcional" value={g.total} onChange={(e) => setG({ ...g, total: e.target.value })} /></div>
                            <div className="col-span-2 sm:col-span-4 flex items-end">
                                <Button type="button" variant="outline" className="gap-1" disabled={!podeGerar || linhas.length >= MAX_OBRIGACOES} onClick={gerar}><ListPlus className="w-4 h-4" aria-hidden /> Gerar e incluir na lista</Button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Para obrigações sem valor (entregar um relatório, concluir uma obra), deixe os valores em branco. Dá para gerar mais de um grupo e ajustar cada linha depois.</p>
                    </fieldset>

                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">Obrigações ({linhas.length}){total > 0 ? ` · total de ${reais(total)}` : ''}</p>
                            <Button type="button" size="sm" variant="ghost" className="gap-1" disabled={linhas.length >= MAX_OBRIGACOES} onClick={() => setLinhas((l) => [...l, VAZIO])}><Plus className="w-4 h-4" aria-hidden /> Incluir uma</Button>
                        </div>
                        {linhas.length === 0 ? (
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Nenhuma obrigação na lista. Gere as parcelas acima ou inclua uma a uma.</p>
                        ) : (
                            <ul className="mt-1 space-y-2">
                                {linhas.map((x, i) => (
                                    <li key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_10rem_8rem_auto] gap-2 items-center">
                                        <Input aria-label={`Descrição da obrigação ${i + 1}`} className="col-span-2 sm:col-span-1" maxLength={200} placeholder="O que deve ser cumprido" value={x.descricao} onChange={(e) => setL(i, { descricao: e.target.value })} />
                                        <Input aria-label={`Vencimento da obrigação ${i + 1}`} type="date" value={x.vence_em} onChange={(e) => setL(i, { vence_em: e.target.value })} />
                                        <Input aria-label={`Valor da obrigação ${i + 1}, em reais`} inputMode="decimal" placeholder="R$ (opcional)" value={x.valor} onChange={(e) => setL(i, { valor: e.target.value })} />
                                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Tirar a obrigação ${i + 1}`} onClick={() => setLinhas((l) => l.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" aria-hidden /></Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="sm:max-w-sm">
                        <Label htmlFor="cr-dest">A cargo de</Label>
                        <Input id="cr-dest" className="mt-1" list="cr-partes" maxLength={120} placeholder="Opcional: a parte que deve cumprir" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
                        <datalist id="cr-partes">{ativos.map((x, i) => <option key={i} value={x.nome} />)}</datalist>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Com o nome de uma parte, só ela vê o botão de enviar o comprovante no portal. Em branco, todas as partes veem.</p>
                    </div>

                    {tentou && problemas.length > 0 && <ul role="alert" className="text-sm text-red-700 dark:text-red-300 list-disc pl-5">{problemas.map((x) => <li key={x}>{x}</li>)}</ul>}
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
                        <Button type="submit" disabled={ocupado || linhas.length === 0}>Registrar o cronograma</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Barra e frase do andamento do cronograma (nada quando o processo não tem obrigações). */
export function ResumoCronograma({ prazos, hoje = hojeBr(), className = '' }) {
    const s = situacaoDasObrigacoes(prazos, hoje);
    if (!s.total) return null;
    return (
        <div className={`rounded-md border px-3 py-2 ${s.atrasadas ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'} ${className}`}>
            <p className="text-sm font-medium">Cronograma de obrigações</p>
            <Progress className="mt-1.5 h-2" value={Math.round((s.cumpridas / s.total) * 100)} aria-label={`${s.cumpridas} de ${s.total} obrigações cumpridas`} />
            <p className={`mt-1 text-xs ${s.atrasadas ? 'text-red-700 dark:text-red-300 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>{fraseDoCronograma(s)}.</p>
        </div>
    );
}
