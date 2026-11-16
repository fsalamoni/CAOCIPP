import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, Gavel, MessageSquare, Send, Timer, Trophy, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secPortal, secProcesso } from '@/services/secretariaService';
import { numero, problemaDoLance, quandoBr, relogio, valorTexto } from '@/lib/certames';

/**
 * Sala de lances (S12). O relógio é o do servidor: cada resposta traz `agora`
 * e a tela corrige a contagem pela diferença para o relógio do aparelho. O
 * lance que chega depois do fim é recusado pelo servidor, qualquer que seja a
 * contagem na tela. A tela consulta a sala a cada poucos segundos.
 *   ponytail: consulta periódica; trocar por um painel público com onSnapshot se a sala precisar de menos de 3 s de atraso.
 */

/** Hora do servidor, avançando a cada segundo a partir da última resposta. */
export function useAgoraServidor(agoraServidor, recebidoEm) {
    const [tick, setTick] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);
    if (!agoraServidor || !recebidoEm) return tick;
    return Date.parse(agoraServidor) + (tick - recebidoEm);
}
const horaBr = (iso) => new Date(Date.parse(iso) - 3 * 3600e3).toISOString().slice(11, 19);
const novoEnvio = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function Relogio({ fim, agora }) {
    const ms = Date.parse(fim) - agora;
    return (
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${ms < 5 * 60000 ? 'text-rose-700 dark:text-rose-300' : 'text-indigo-800 dark:text-indigo-200'}`} role="timer" aria-live="off">
            <Timer className="w-4 h-4" aria-hidden /> {ms > 0 ? <>Termina em <span className="tabular-nums">{relogio(ms)}</span></> : 'Encerrando…'}
            <span className="font-normal text-xs text-slate-600 dark:text-slate-400">({quandoBr(fim)}, horário de Brasília)</span>
        </p>
    );
}

export function Mensagens({ lista, onEnviar, rotulo, id }) {
    const [txt, setTxt] = useState('');
    const [indo, setIndo] = useState(false);
    const fim = useRef(null);
    useEffect(() => { fim.current?.scrollIntoView?.({ block: 'nearest' }); }, [lista.length]);
    return (
        <section className="space-y-2" aria-label="Mensagens da sala">
            <h4 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="w-4 h-4" aria-hidden /> Mensagens</h4>
            <ul className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-slate-200 dark:border-slate-700 p-2 text-sm">
                {!lista.length && <li className="text-slate-600 dark:text-slate-400">Nenhuma mensagem.</li>}
                {lista.map((m) => (
                    <li key={m.id} className={m.aviso ? 'text-amber-800 dark:text-amber-300' : ''}>
                        <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">{horaBr(m.em)}</span> <b>{m.nome}</b>: {m.texto}
                    </li>
                ))}
                <li ref={fim} aria-hidden />
            </ul>
            {onEnviar && (
                <div className="flex gap-2 items-end">
                    <div className="flex-1"><Label htmlFor={id} className="text-xs">{rotulo}</Label>
                        <Textarea id={id} rows={1} maxLength={500} className="mt-1 min-h-9" value={txt} onChange={(e) => setTxt(e.target.value)} /></div>
                    <Button size="sm" className="gap-1" disabled={indo || txt.trim().length < 2} onClick={async () => {
                        setIndo(true);
                        try { await onEnviar(txt.trim()); setTxt(''); } catch (e) { toast.error(e?.message || 'Não foi possível enviar'); } finally { setIndo(false); }
                    }}><Send className="w-4 h-4" aria-hidden /> Enviar</Button>
                </div>
            )}
        </section>
    );
}

// ─── Fornecedor ────────────────────────────────────────────────────────────

function UnidadeLance({ u, aviso, certameId, onFeito, observador }) {
    const [v, setV] = useState('');
    const [indo, setIndo] = useState(false);
    const desc = aviso.criterio === 'maior_desconto';
    const porUnitario = !desc && aviso.unidade_disputa === 'item';
    const valor = numero(v);
    const aviso1 = v.trim() && u.meu ? problemaDoLance(valor, u.meu.valor, aviso) : '';
    const primeiro = u.posicao === 1;
    const enviar = async () => {
        setIndo(true);
        try {
            const r = await secPortal('disputaLance', { certame_id: certameId, chave: u.chave, valor, envio: novoEnvio() });
            toast.success(`Lance registrado: ${valorTexto(r.lance.valor, aviso.criterio)}, às ${horaBr(r.lance.em)}`);
            setV('');
            onFeito();
        } catch (e) { toast.error(e?.message || 'Lance não registrado'); } finally { setIndo(false); }
    };
    return (
        <section aria-label={`Lances do ${u.nome}`} className={`rounded-md border p-3 space-y-2 ${primeiro ? 'border-emerald-400 dark:border-emerald-700' : 'border-slate-200 dark:border-slate-700'}`}>
            <div>
                <h4 className="text-sm font-semibold">{u.nome}{u.quantidade != null ? <span className="font-normal text-slate-600 dark:text-slate-400"> · {String(u.quantidade).replace('.', ',')} {u.unidade}</span> : null}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">{u.descricao}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <p><span className="block text-xs text-slate-600 dark:text-slate-400">Melhor oferta</span><b>{u.melhor ? valorTexto(u.melhor.valor, aviso.criterio) : '—'}</b>{porUnitario && u.melhor ? <span className="block text-xs text-slate-600 dark:text-slate-400">total {valorTexto(u.melhor.total, 'menor_preco')}</span> : null}</p>
                {!observador && <p><span className="block text-xs text-slate-600 dark:text-slate-400">Sua oferta</span><b>{u.meu ? valorTexto(u.meu.valor, aviso.criterio) : 'não cotou'}</b></p>}
                <p className={observador ? 'hidden' : ''}><span className="block text-xs text-slate-600 dark:text-slate-400">Sua posição</span>
                    {u.posicao ? <b className={primeiro ? 'text-emerald-800 dark:text-emerald-300 flex items-center gap-1' : ''}>{primeiro && <Trophy className="w-4 h-4" aria-hidden />}{u.posicao}º de {u.participantes}</b> : '—'}</p>
            </div>
            {u.meu && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[10rem]"><Label htmlFor={`ln-${u.chave}`} className="text-xs">Seu lance {desc ? '(desconto, em %)' : porUnitario ? '(valor unitário, R$)' : '(valor global do lote, R$)'}</Label>
                        <Input id={`ln-${u.chave}`} className="mt-1" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && v.trim() && !aviso1 && !indo) enviar(); }} /></div>
                    <Button className="gap-1" disabled={indo || !v.trim() || !!aviso1} onClick={enviar}><Gavel className="w-4 h-4" aria-hidden /> Dar lance</Button>
                    {aviso1 && <p className="basis-full text-xs text-amber-800 dark:text-amber-300">{aviso1}</p>}
                </div>
            )}
        </section>
    );
}

export function SalaLancesFornecedor({ certameId, aviso, onFim }) {
    const qc = useQueryClient();
    const chave = ['disputa-sala', certameId];
    const q = useQuery({ queryKey: chave, queryFn: () => secPortal('disputaSala', { certame_id: certameId }), refetchInterval: (s) => (s.state.data?.momento === 'lances' ? 3000 : false) });
    const d = q.data;
    const agora = useAgoraServidor(d?.agora, q.dataUpdatedAt);
    const atualizar = () => qc.invalidateQueries({ queryKey: chave });
    useEffect(() => { if (d && d.momento !== 'lances') onFim?.(); }, [d, onFim]);
    if (q.isLoading) return <p className="text-sm text-slate-600 dark:text-slate-400">Entrando na sala de lances…</p>;
    if (q.error) return <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>;
    if (d.momento !== 'lances') return <p className="text-sm">A fase de lances terminou. O órgão julga as ofertas e publica o resultado.</p>;
    const desfazAte = d.pode_desfazer ? Date.parse(d.pode_desfazer.ate) - agora : 0;
    return (
        <section aria-label="Sala de lances" className="space-y-4 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Sala de lances <Badge className="bg-indigo-600 hover:bg-indigo-600">Em lances</Badge></h2>
                <Relogio fim={d.fim} agora={agora} />
            </div>
            {d.observador && <p className="text-xs text-slate-600 dark:text-slate-400">Você acompanha a sessão pública: vê o melhor valor de cada item e os avisos do órgão, sem saber quem deu cada lance.</p>}
            <p className={d.observador ? 'hidden' : 'text-xs text-slate-600 dark:text-slate-400'}>
                Ninguém vê o seu nome: os outros veem só o melhor valor, e o órgão vê você como <b>{d.apelido}</b> até o fim. Cada lance precisa ser melhor que o seu último
                {aviso.intervalo?.valor ? `, respeitado o intervalo mínimo de ${aviso.intervalo.tipo === 'valor' && aviso.criterio !== 'maior_desconto' ? valorTexto(aviso.intervalo.valor, 'menor_preco') : `${String(aviso.intervalo.valor).replace('.', ',')}${aviso.criterio === 'maior_desconto' ? ' ponto(s) percentual(is)' : '%'}`}` : ''};
                não precisa vencer o melhor. Você pode desfazer o último lance uma vez por item, em até 15 segundos.
            </p>
            {d.pode_desfazer && desfazAte > 0 && (
                <Button variant="outline" size="sm" className="gap-1" onClick={async () => {
                    try { await secPortal('disputaDesfazer', { certame_id: certameId, lance_id: d.pode_desfazer.lance_id }); toast.success('Lance desfeito'); atualizar(); } catch (e) { toast.error(e?.message || 'Não foi possível desfazer'); }
                }}><Undo2 className="w-4 h-4" aria-hidden /> Desfazer meu último lance ({Math.min(15, Math.ceil(desfazAte / 1000))} s)</Button>
            )}
            <div className="space-y-3">{d.unidades.map((u) => <UnidadeLance key={u.chave} u={u} aviso={aviso} certameId={certameId} onFeito={atualizar} observador={d.observador} />)}</div>
            {d.meus.length > 0 && (
                <details className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <summary className="text-sm font-semibold cursor-pointer">Meus lances ({d.meus.length})</summary>
                    <ul className="mt-2 space-y-0.5 text-sm">
                        {d.meus.map((l) => (
                            <li key={l.id} className={l.excluido ? 'line-through text-slate-500' : ''}>
                                <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400">{horaBr(l.em)}</span> {d.unidades.find((u) => u.chave === l.chave)?.nome}: {valorTexto(l.valor, aviso.criterio)}
                                {l.excluido && <span className="no-underline"> ({l.excluido.por === 'agente' ? `excluído pelo órgão: ${l.excluido.motivo}` : 'desfeito'})</span>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            <Mensagens lista={d.mensagens} id="ln-msg" rotulo={d.observador ? 'Avisos do órgão' : 'Mensagem ao órgão (os outros licitantes não veem)'}
                onEnviar={d.observador ? null : async (texto) => { await secPortal('disputaMensagem', { certame_id: certameId, texto }); atualizar(); }} />
        </section>
    );
}

// ─── Órgão ─────────────────────────────────────────────────────────────────

export function SalaLancesOrgao({ orgId, procId }) {
    const qc = useQueryClient();
    const chave = ['sec-disputa-sala', orgId, procId];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'certameSala', { processo_id: procId }), refetchInterval: (s) => (s.state.data?.momento === 'lances' ? 4000 : false) });
    const d = q.data;
    const agora = useAgoraServidor(d?.agora, q.dataUpdatedAt);
    const [excluir, setExcluir] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [indo, setIndo] = useState(false);
    const atualizar = () => { qc.invalidateQueries({ queryKey: chave }); qc.invalidateQueries({ queryKey: ['sec-disputa', orgId, procId] }); };
    useEffect(() => { if (d && d.momento === 'encerrada') qc.invalidateQueries({ queryKey: ['sec-disputa', orgId, procId] }); }, [d?.momento]);
    if (q.isLoading) return <p className="text-sm text-slate-600 dark:text-slate-400">Abrindo a sala de lances…</p>;
    if (q.error) return <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>;
    const nomeU = (k) => d.unidades.find((u) => u.chave === k)?.nome || k;
    return (
        <section aria-label="Sala de lances" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Gavel className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden /> Sala de lances
                    <Badge className={d.momento === 'lances' ? 'bg-indigo-600 hover:bg-indigo-600' : 'bg-slate-600 hover:bg-slate-600'}>{d.momento === 'lances' ? 'Em lances' : 'Encerrada'}</Badge>
                    <span className="font-normal text-xs text-slate-600 dark:text-slate-400">{d.total_lances} lance{d.total_lances === 1 ? '' : 's'}</span></h3>
                {d.momento === 'lances' && <Relogio fim={d.fim} agora={agora} />}
            </div>
            {d.momento === 'lances' && <p className="text-xs text-slate-600 dark:text-slate-400">Durante os lances, o órgão vê os licitantes por apelido; os nomes aparecem na classificação, no fim. A sala fecha sozinha na hora marcada.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
                {d.unidades.map((u) => (
                    <div key={u.chave} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                        <h4 className="text-sm font-semibold">{u.nome} <span className="font-normal text-xs text-slate-600 dark:text-slate-400">{u.descricao}</span></h4>
                        {!u.posicoes.length ? <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma oferta.</p> : (
                            <ol className="mt-1 space-y-0.5 text-sm">
                                {u.posicoes.map((v, k) => (
                                    <li key={k} className="flex flex-wrap gap-2"><span className="w-6 font-semibold">{k + 1}º</span><span className="flex-1">{v.quem}</span>
                                        <b>{valorTexto(v.valor, d.criterio)}</b><span className="text-xs text-slate-600 dark:text-slate-400">{v.lance ? 'lance' : 'proposta'}</span></li>
                                ))}
                            </ol>
                        )}
                    </div>
                ))}
            </div>
            {d.lances.length > 0 && (
                <details className="rounded-md border border-slate-200 dark:border-slate-700 p-2" open={d.momento === 'lances'}>
                    <summary className="text-sm font-semibold cursor-pointer">Lances registrados ({d.lances.length})</summary>
                    <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {d.lances.map((l) => (
                            <li key={l.id} className="py-1 flex flex-wrap items-center gap-2">
                                <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400">{horaBr(l.em)}</span>
                                <span className={`flex-1 min-w-[10rem] ${l.excluido ? 'line-through text-slate-500' : ''}`}>{nomeU(l.chave)} · {l.quem} · {valorTexto(l.valor, d.criterio)}</span>
                                {l.excluido && <span className="text-xs text-slate-600 dark:text-slate-400">{l.excluido.por === 'agente' ? `excluído: ${l.excluido.motivo}` : 'desfeito pelo licitante'}</span>}
                                {d.pode.gerir && !l.excluido && <Button size="sm" variant="ghost" className="gap-1 h-7 text-rose-700 dark:text-rose-300" aria-label={`Excluir o lance ${l.seq}`} onClick={() => { setExcluir(l); setMotivo(''); }}><Ban className="w-3.5 h-3.5" aria-hidden /> Excluir</Button>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
            {excluir && (
                <div role="group" aria-label="Excluir o lance" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                    <p className="text-sm font-semibold">Excluir o lance de {valorTexto(excluir.valor, d.criterio)} de {excluir.quem} em {nomeU(excluir.chave)}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">Para lance que compromete a disputa (por exemplo, valor claramente inexequível). O licitante volta ao lance anterior e todos na sala recebem aviso com o motivo.</p>
                    <div><Label htmlFor="ln-motivo" className="text-xs">Motivo</Label><Textarea id="ln-motivo" className="mt-1" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setExcluir(null)}>Voltar</Button>
                        <Button disabled={indo || motivo.trim().length < 5} onClick={async () => {
                            setIndo(true);
                            try { await secProcesso(orgId, 'certameExcluirLance', { processo_id: procId, lance_id: excluir.id, motivo }); toast.success('Lance excluído'); setExcluir(null); atualizar(); } catch (e) { toast.error(e?.message || 'Não foi possível excluir'); } finally { setIndo(false); }
                        }}>Excluir o lance</Button>
                    </div>
                </div>
            )}
            <Mensagens lista={d.mensagens} id="ln-aviso" rotulo="Mensagem a todos os licitantes"
                onEnviar={d.pode.conversar ? async (texto) => { await secProcesso(orgId, 'certameMensagem', { processo_id: procId, texto }); atualizar(); } : null} />
        </section>
    );
}
