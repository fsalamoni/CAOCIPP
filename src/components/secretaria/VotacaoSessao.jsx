import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, ClipboardList, Eye, Gavel, Hourglass, Loader2, Lock, Megaphone, Send, Undo2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secProcesso } from '@/services/secretariaService';
import { MODOS_VOTO, br, juntarNomes, textoDoVoto } from '@/lib/sessoes';
import AjudaTermo from './AjudaTermo';
import ErroQuery from './ErroQuery';

const sel = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const caixa = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3';
const titulo = 'text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2';
const FUNCAO = { presidente: 'Presidente', membro: 'Titular' };

/** Relatório e voto do relator: rascunho que só ele vê, até liberar aos pares. */
function Relatar({ orgId, sessaoId, d, onMudou }) {
    const [f, setF] = useState({ relatorio: d.relatorio || '', resultado: d.resultado || '', fundamentos: d.fundamentos || '' });
    const [indo, setIndo] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const salvar = async (liberar) => {
        setIndo(true);
        try {
            await secProcesso(orgId, 'sessaoRelatar', { id: sessaoId, processo_id: d.processo_id, ...f, liberar });
            toast.success(liberar ? 'Voto liberado aos pares' : 'Rascunho guardado');
            setConfirmar(false);
            await onMudou();
        } catch (e) { toast.error(e?.message || 'Não foi possível guardar'); } finally { setIndo(false); }
    };
    const pronto = f.resultado && f.relatorio.trim().length >= 10 && f.fundamentos.trim().length >= 10;
    return (
        <section className={caixa} aria-labelledby="vt-relatar">
            <h3 id="vt-relatar" className={titulo}><UserRound className="w-4 h-4" aria-hidden /> Seu relatório e voto</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 flex gap-1"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> Só você vê enquanto não liberar. Liberado, os pares e a secretaria leem e votam; depois disso o voto não muda.</p>
            <div>
                <Label htmlFor="vt-relatorio">Relatório</Label>
                <Textarea id="vt-relatorio" rows={5} className="mt-1" value={f.relatorio} onChange={(e) => setF({ ...f, relatorio: e.target.value })} placeholder="O caso, o pedido, a defesa e o que se apurou." />
            </div>
            <div>
                <Label htmlFor="vt-resultado">Seu voto</Label>
                <select id="vt-resultado" className={`${sel} mt-1`} value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })}>
                    <option value="">Escolha o resultado</option>
                    {d.resultados.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
            <div>
                <Label htmlFor="vt-fundamentos">Fundamentos do voto</Label>
                <Textarea id="vt-fundamentos" rows={6} className="mt-1" value={f.fundamentos} onChange={(e) => setF({ ...f, fundamentos: e.target.value })} placeholder="Por que você vota assim." />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={indo} onClick={() => salvar(false)}>Guardar rascunho</Button>
                <Button className="gap-1" disabled={indo || !pronto || d.situacao !== 'publicada'} onClick={() => setConfirmar(true)}><Send className="w-4 h-4" aria-hidden /> Liberar aos pares</Button>
            </div>
            {d.situacao !== 'publicada' && <p className="text-xs text-slate-600 dark:text-slate-400">Você libera o voto depois que a pauta for publicada.</p>}
            {confirmar && (
                <Dialog open onOpenChange={(o) => !o && setConfirmar(false)}>
                    <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>Liberar o voto aos pares?</DialogTitle>
                            <DialogDescription>Os membros do colegiado e a secretaria passam a ler o relatório e o voto ({f.resultado}) e podem votar. O voto não muda depois.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setConfirmar(false)}>Voltar</Button>
                            <Button disabled={indo} onClick={() => salvar(true)}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Liberar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    );
}

/** Voto do vogal: acompanha, com ressalva, diverge, impedido ou suspeito; muda até a proclamação. */
function Votar({ orgId, sessaoId, d, onMudou }) {
    const [v, setV] = useState({ modo: d.meu_voto?.modo || '', resultado: d.meu_voto?.modo === 'diverge' ? d.meu_voto.resultado : '', nota: d.meu_voto?.nota || '' });
    const [indo, setIndo] = useState(false);
    const outros = d.resultados.filter((r) => r !== d.resultado);
    const falta = !v.modo || (v.modo === 'diverge' && !v.resultado) || (v.modo === 'ressalva' && v.nota.trim().length < 5);
    const enviar = async () => {
        setIndo(true);
        try { await secProcesso(orgId, 'sessaoVotar', { id: sessaoId, processo_id: d.processo_id, voto: v }); toast.success('Voto registrado'); await onMudou(); } catch (e) { toast.error(e?.message || 'Não foi possível votar'); } finally { setIndo(false); }
    };
    const rotulos = { ...MODOS_VOTO, acompanha: `Acompanho o relator (${d.resultado})`, ressalva: `Acompanho o relator (${d.resultado}), com ressalva`, diverge: 'Divirjo do relator' };
    return (
        <section className={caixa} aria-labelledby="vt-votar">
            <h3 id="vt-votar" className={titulo}><Gavel className="w-4 h-4" aria-hidden /> Seu voto</h3>
            {d.meu_voto && <p className="text-sm text-emerald-800 dark:text-emerald-200">Registrado: {textoDoVoto(d.meu_voto)}. Você pode mudar até a proclamação.</p>}
            <RadioGroup value={v.modo} onValueChange={(modo) => setV({ ...v, modo })} aria-label="Como você vota">
                {Object.keys(MODOS_VOTO).map((m) => (
                    <div key={m} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <RadioGroupItem value={m} id={`vt-modo-${m}`} className="mt-0.5" />
                        <Label htmlFor={`vt-modo-${m}`} className="font-normal leading-snug">{rotulos[m]}</Label>
                    </div>
                ))}
            </RadioGroup>
            {v.modo === 'diverge' && (
                <div>
                    <Label htmlFor="vt-diverge">Resultado do seu voto</Label>
                    <select id="vt-diverge" className={`${sel} mt-1`} value={v.resultado} onChange={(e) => setV({ ...v, resultado: e.target.value })}>
                        <option value="">Escolha</option>
                        {outros.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            )}
            {['ressalva', 'diverge', 'impedido', 'suspeito'].includes(v.modo) && (
                <div>
                    <Label htmlFor="vt-nota">{v.modo === 'ressalva' ? 'Ressalva' : v.modo === 'diverge' ? 'Síntese da divergência (opcional)' : 'Motivo (opcional)'}</Label>
                    <Textarea id="vt-nota" rows={3} className="mt-1" value={v.nota} onChange={(e) => setV({ ...v, nota: e.target.value })} />
                </div>
            )}
            <Button disabled={indo || falta} onClick={enviar}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{d.meu_voto ? 'Mudar meu voto' : 'Registrar meu voto'}</Button>
        </section>
    );
}

/** Confirmação de vista, devolução, adiamento ou diligência; com `minimo`, pede o texto que vai à certidão. */
function Confirmar({ titulo, descricao, botao, rotulo, minimo, indo, onFechar, onConfirmar }) {
    const [texto, setTexto] = useState('');
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descricao}</DialogDescription></DialogHeader>
                {minimo > 0 && (
                    <div>
                        <Label htmlFor="vt-motivo">{rotulo}</Label>
                        <Textarea id="vt-motivo" rows={3} maxLength={2000} className="mt-1" value={texto} onChange={(e) => setTexto(e.target.value)} />
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Vai para a certidão nos autos, que as partes veem.</p>
                    </div>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>Voltar</Button>
                    <Button disabled={indo || texto.trim().length < (minimo || 0)} onClick={() => onConfirmar(texto.trim())}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{botao}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const continuaEm = (r) => (r?.continua_em ? `O julgamento continua na ${r.continua_em.titulo}, em ${br(r.continua_em.data)}.` : 'Ele entra na próxima sessão do colegiado que for marcada.');

/**
 * Vista, adiamento e conversão em diligência (S5): o julgamento sai desta
 * sessão e continua em outra, com o mesmo relator (e, salvo na diligência, com
 * os votos já dados).
 */
function Andamento({ d, indo, acao }) {
    const [aberto, setAberto] = useState(null); // 'vista' | 'juntar' | 'devolver' | 'adiar' | 'diligencia'
    const fechar = () => setAberto(null);
    const ir = async (nome, extra, ok) => { if (await acao(nome, extra, ok)) fechar(); };
    const v = d.vista;
    const algo = v || ['adiado', 'diligencia'].includes(d.situacao_item) || d.pode.vista || d.pode.adiar;
    if (!algo) return null;
    const dias = d.vista_dias;
    return (
        <section className={caixa} aria-labelledby="vt-andamento">
            <h3 id="vt-andamento" className={titulo}><Hourglass className="w-4 h-4" aria-hidden /> Vista, adiamento e diligência <AjudaTermo id="vista" /></h3>
            {v && !v.encerrada && (
                <div className="rounded-md bg-violet-50 dark:bg-violet-950/40 p-3 text-sm text-violet-900 dark:text-violet-100 space-y-1" role="status">
                    <p className="font-semibold">Vista para {juntarNomes(v.nomes)}, até {br(v.prazo)}{v.vencida ? ' (prazo vencido)' : ''}.</p>
                    <p>O julgamento está suspenso e os votos já dados continuam valendo. Com a devolução, o processo vai para a próxima sessão do colegiado, com o mesmo relator.</p>
                    {v.vencida && (d.gere || d.preside) && !v.minha && <p>Vencido o prazo, a secretaria ou o presidente pode requisitar o processo: devolva a vista por quem a pediu, ou inclua o processo direto em outra sessão.</p>}
                </div>
            )}
            {v?.encerrada && <p className="text-sm text-slate-700 dark:text-slate-300">{v.devolvida ? `Vista de ${juntarNomes(v.nomes)}, devolvida. O julgamento continua em outra sessão.` : `Houve pedido de vista de ${juntarNomes(v.nomes)}.`}</p>}
            {d.situacao_item === 'adiado' && <p className="text-sm text-slate-700 dark:text-slate-300">Julgamento adiado{d.motivo ? `: ${d.motivo}` : ''}. Continua em outra sessão, com o relator e os votos já dados.</p>}
            {d.situacao_item === 'diligencia' && <p className="text-sm text-slate-700 dark:text-slate-300">Convertido em diligência{d.motivo ? `: ${d.motivo}` : ''}. O processo voltou à unidade; cumprida a diligência, vai a nova pauta com o mesmo relator, e os votos recomeçam.</p>}
            <div className="flex flex-wrap gap-2">
                {d.pode.vista && <Button variant="outline" className="gap-1" disabled={indo} onClick={() => setAberto('vista')}><Eye className="w-4 h-4" aria-hidden /> Pedir vista</Button>}
                {d.pode.juntar_vista && <Button variant="outline" className="gap-1" disabled={indo} onClick={() => setAberto('juntar')}><Eye className="w-4 h-4" aria-hidden /> Pedir vista também</Button>}
                {d.pode.devolver_vista && <Button className="gap-1" disabled={indo} onClick={() => setAberto('devolver')}><Undo2 className="w-4 h-4" aria-hidden /> {v?.minha ? 'Devolver a vista' : 'Requisitar o processo'}</Button>}
                {d.pode.adiar && <Button variant="outline" className="gap-1" disabled={indo} onClick={() => setAberto('adiar')}><CalendarClock className="w-4 h-4" aria-hidden /> Adiar o julgamento</Button>}
                {d.pode.adiar && <Button variant="outline" className="gap-1" disabled={indo} onClick={() => setAberto('diligencia')}><ClipboardList className="w-4 h-4" aria-hidden /> Converter em diligência</Button>}
            </div>
            {aberto === 'vista' && (
                <Confirmar titulo="Pedir vista?" botao="Pedir vista" indo={indo} onFechar={fechar}
                    descricao={`O julgamento fica suspenso, e você tem ${dias} dias para examinar o processo e devolver. Os votos já dados continuam valendo. O pedido vai aos autos na certidão de vista, e as partes são avisadas.`}
                    onConfirmar={() => ir('sessaoVista', {}, (r) => `Vista pedida, até ${br(r.prazo)}`)} />
            )}
            {aberto === 'juntar' && (
                <Confirmar titulo="Pedir vista também?" botao="Pedir vista" indo={indo} onFechar={fechar}
                    descricao={`A vista é coletiva: você se junta ao pedido de ${juntarNomes(v.nomes)}, no mesmo prazo, até ${br(v.prazo)}.`}
                    onConfirmar={() => ir('sessaoVista', {}, () => 'Você também está com vista')} />
            )}
            {aberto === 'devolver' && (
                <Confirmar titulo={v?.minha ? 'Devolver a vista?' : 'Requisitar o processo?'} botao={v?.minha ? 'Devolver' : 'Requisitar'} indo={indo} onFechar={fechar}
                    descricao="O processo vai para a próxima sessão do colegiado já marcada (extrapauta, se a pauta dela já foi publicada), com o mesmo relator e os votos já dados. A devolução vai aos autos, e as partes são avisadas."
                    onConfirmar={() => ir('sessaoDevolverVista', {}, (r) => `Vista devolvida. ${continuaEm(r)}`)} />
            )}
            {aberto === 'adiar' && (
                <Confirmar titulo="Adiar o julgamento?" botao="Adiar" rotulo="Motivo do adiamento" minimo={5} indo={indo} onFechar={fechar}
                    descricao="O processo sai desta sessão e vai para a próxima do colegiado, com o mesmo relator e os votos já dados."
                    onConfirmar={(motivo) => ir('sessaoAdiar', { motivo }, (r) => `Julgamento adiado. ${continuaEm(r)}`)} />
            )}
            {aberto === 'diligencia' && (
                <Confirmar titulo="Converter o julgamento em diligência?" botao="Converter" rotulo="O que a diligência deve fazer" minimo={10} indo={indo} onFechar={fechar}
                    descricao="O processo sai desta sessão e volta à unidade, com a orientação na capa. Cumprida a diligência, a secretaria o inclui em nova pauta: o relator continua, e os votos recomeçam, porque o processo mudou."
                    onConfirmar={(motivo) => ir('sessaoDiligencia', { motivo }, () => 'Convertido em diligência. A orientação está na capa do processo.')} />
            )}
        </section>
    );
}

/**
 * Julgamento de um processo da pauta: relator, voto liberado, votos dos pares
 * com placar ao vivo e proclamação. Cada um vê e faz o que o seu papel permite.
 */
export default function VotacaoSessao({ orgId, sessaoId, processoId, onFechar, onMudou }) {
    const qc = useQueryClient();
    const chave = ['sec-votacao', orgId, sessaoId, processoId];
    // Ao vivo: enquanto a votação está aberta, a tela se atualiza sozinha.
    const q = useQuery({
        queryKey: chave, queryFn: () => secProcesso(orgId, 'sessaoVotacao', { id: sessaoId, processo_id: processoId }),
        refetchInterval: (query) => (query.state.data?.liberado_em && !query.state.data?.proclamado && query.state.data?.situacao_item === 'pautado' ? 10000 : false),
    });
    const [indo, setIndo] = useState(false);
    const [proclamar, setProclamar] = useState(false);
    const [relator, setRelator] = useState('');
    const d = q.data ? { ...q.data, processo_id: processoId } : null;
    useEffect(() => { if (d?.relator?.uid) setRelator(d.relator.uid); }, [d?.relator?.uid]);
    const mudou = () => Promise.all([qc.invalidateQueries({ queryKey: chave }), onMudou?.()]);
    const acao = async (nome, extra, ok) => {
        setIndo(true);
        try { const r = await secProcesso(orgId, nome, { id: sessaoId, processo_id: processoId, ...extra }); toast.success(ok(r)); await mudou(); return r; } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return null; } finally { setIndo(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-full max-h-[92dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Julgamento do processo {d?.numero || ''}</DialogTitle>
                    <DialogDescription>{d?.assunto || 'Relator, votos e proclamação do resultado.'}</DialogDescription>
                </DialogHeader>
                {q.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p>}
                {q.error && <ErroQuery q={q} />}
                {d && (
                    <div className="space-y-4">
                        {d.proclamado && (
                            <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-100 space-y-1" role="status">
                                <p className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" aria-hidden /> Proclamado: {d.proclamado.resultado}</p>
                                <p>{d.proclamado.texto}.</p>
                                <p className="text-xs">Por {d.proclamado.por_nome}, em {new Date(d.proclamado.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. {d.registrado ? 'A certidão de julgamento já está nos autos.' : 'A unidade registra o julgamento no processo com estes votos.'}</p>
                            </div>
                        )}
                        {!d.pendente && !d.proclamado && d.situacao_item === 'pautado' && <p className="text-sm text-slate-700 dark:text-slate-300">O processo não tem mais o julgamento pendente nesta sessão (foi julgado, retirado ou mudou de fase).</p>}

                        <section className={caixa} aria-labelledby="vt-relator">
                            <h3 id="vt-relator" className={titulo}><UserRound className="w-4 h-4" aria-hidden /> Relator <AjudaTermo id="relator" /></h3>
                            {d.pode.designar ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select aria-label="Relator" className={sel} value={relator} onChange={(e) => setRelator(e.target.value)}>
                                        <option value="">Ninguém designado</option>
                                        {d.membros.map((m) => <option key={m.uid} value={m.uid}>{m.nome} ({FUNCAO[m.funcao]})</option>)}
                                    </select>
                                    <Button variant="outline" disabled={indo || relator === (d.relator?.uid || '')} onClick={() => acao('sessaoRelator', { uid: relator }, () => (relator ? 'Relator designado' : 'Relatoria desfeita'))}>Designar</Button>
                                </div>
                            ) : <p className="text-sm text-slate-800 dark:text-slate-200">{d.relator ? d.relator.nome : 'Ainda sem relator designado pela secretaria.'}</p>}
                            {d.relator && !d.liberado_em && !d.sou_relator && <p className="text-xs text-slate-600 dark:text-slate-400">O relator ainda não liberou o voto aos pares.</p>}
                        </section>

                        {d.pode.relatar && <Relatar orgId={orgId} sessaoId={sessaoId} d={d} onMudou={mudou} />}

                        {d.liberado_em && d.relatorio !== undefined && (
                            <section className={caixa} aria-labelledby="vt-voto-relator">
                                <h3 id="vt-voto-relator" className={titulo}><Gavel className="w-4 h-4" aria-hidden /> Voto do relator: {d.resultado}</h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400">Liberado aos pares em {new Date(d.liberado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Não vai aos autos nem às partes nesta etapa.</p>
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Relatório</p><p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-200">{d.relatorio}</p></div>
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fundamentos</p><p className="text-sm whitespace-pre-line text-slate-800 dark:text-slate-200">{d.fundamentos}</p></div>
                            </section>
                        )}

                        {d.pode.votar && <Votar key={d.meu_voto?.em || 'novo'} orgId={orgId} sessaoId={sessaoId} d={d} onMudou={mudou} />}

                        {d.liberado_em && d.votos.length > 0 && (
                            <section className={caixa} aria-labelledby="vt-votos">
                                <h3 id="vt-votos" className={titulo}>Votos dos vogais <AjudaTermo id="vogal" /> {d.placar.length > 0 && <span className="font-normal text-slate-600 dark:text-slate-400">· {d.placar.map(([r, n]) => `${r} ${n}`).join(' · ')} (com o relator)</span>}</h3>
                                <ul className="divide-y divide-slate-200 dark:divide-slate-700" aria-live="polite">
                                    {d.votos.map((x) => (
                                        <li key={x.uid} className="py-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                                            <span className="text-slate-900 dark:text-white">{x.nome} <span className="text-xs text-slate-500 dark:text-slate-400">({FUNCAO[x.funcao]})</span></span>
                                            {x.modo ? <Badge variant="outline" className={x.modo === 'diverge' ? 'border-amber-300 text-amber-900 dark:border-amber-800 dark:text-amber-200' : ''}>{textoDoVoto(x)}</Badge>
                                                : <span className="text-xs text-slate-500 dark:text-slate-400">{d.proclamado ? 'Ausente' : 'Aguardando'}</span>}
                                            {x.nota && <p className="w-full text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line">{x.nota}</p>}
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {d.pode.proclamar && (
                            <section className={caixa} aria-labelledby="vt-proclamar">
                                <h3 id="vt-proclamar" className={titulo}><Megaphone className="w-4 h-4" aria-hidden /> Proclamação <AjudaTermo id="proclamacao" /></h3>
                                {d.previa?.texto && <p className="text-sm text-slate-800 dark:text-slate-200">Se proclamar agora: {d.previa.texto}. Quem não votou fica ausente.</p>}
                                {d.previa?.erro && <p className="text-sm text-amber-800 dark:text-amber-200" role="alert">{d.previa.erro}.</p>}
                                <Button className="gap-1" disabled={indo || !!d.previa?.erro} onClick={() => setProclamar(true)}><Megaphone className="w-4 h-4" aria-hidden /> Proclamar o resultado</Button>
                            </section>
                        )}
                        {!d.pode.proclamar && d.liberado_em && !d.proclamado && d.pendente && d.situacao_item === 'pautado' && (d.preside || d.gere) && d.data_sessao > d.hoje && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">A proclamação abre no dia da sessão, {br(d.data_sessao)}.</p>
                        )}

                        <Andamento d={d} indo={indo} acao={acao} />
                        {d.liberado_em && !d.proclamado && d.pendente && d.situacao_item === 'pautado' && !d.pode.vista && !d.pode.adiar && d.sou_relator && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">Os vogais podem pedir vista; o presidente pode adiar o julgamento ou convertê-lo em diligência.</p>
                        )}
                    </div>
                )}
                {proclamar && d && (
                    <Dialog open onOpenChange={(o) => !o && setProclamar(false)}>
                        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full">
                            <DialogHeader>
                                <DialogTitle>Proclamar o resultado?</DialogTitle>
                                <DialogDescription>{d.previa?.texto}. A votação se encerra, e o sistema registra o julgamento no processo, com a certidão nos autos que as partes veem.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setProclamar(false)}>Voltar</Button>
                                <Button disabled={indo} onClick={async () => {
                                    const r = await acao('sessaoProclamar', {}, (x) => (x.registrado ? `Proclamado: ${x.resultado}. Certidão de julgamento nos autos.` : `Proclamado: ${x.resultado}.`));
                                    if (r) { setProclamar(false); if (!r.registrado && r.aviso) toast.warning(`O registro no processo ficou com a unidade: ${r.aviso}`); }
                                }}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Proclamar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </DialogContent>
        </Dialog>
    );
}
