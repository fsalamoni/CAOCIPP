import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileUp, Gavel, Handshake, RotateCcw, Scale, Timer, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { baixarResposta, prepararEnvio, secPortal, secProcesso } from '@/services/secretariaService';
import { numero, quandoBr, relogio, valorTexto } from '@/lib/certames';
import { Mensagens, useAgoraServidor } from './SalaLances';

/**
 * Julgamento da disputa (S13). Órgão: por item ou lote, desempate de ME/EPP,
 * negociação, convocação de proposta ajustada e documentos, aceitação,
 * habilitação ou recusa motivada (chama o próximo); depois, vencedor, recurso
 * e resultado, que cumpre a ação do rito. Fornecedor: a própria situação em
 * cada item, o desempate, a negociação, o envio de arquivos e o recurso.
 * O servidor decide tudo; a tela consulta de tempos em tempos.
 */
const sel = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const tom = { habilitada: 'bg-emerald-700 hover:bg-emerald-700', fracassada: 'bg-rose-700 hover:bg-rose-700', deserta: 'bg-slate-600 hover:bg-slate-600', desempate: 'bg-amber-600 hover:bg-amber-600' };
const Selo = ({ u }) => <Badge className={tom[u.situacao] || 'bg-indigo-600 hover:bg-indigo-600'}>{u.situacao_nome}</Badge>;

function Contagem({ ate, agora }) {
    const ms = Date.parse(ate) - agora;
    return <span className="inline-flex items-center gap-1 tabular-nums font-semibold" role="timer"><Timer className="w-3.5 h-3.5" aria-hidden />{ms > 0 ? relogio(ms) : 'prazo encerrado'}</span>;
}

/** Pequeno formulário de um ato com texto (motivo, contraproposta, fundamentos). */
function AtoComTexto({ id, rotulo, botao, minimo = 10, onFazer, onVoltar, indo, linhas = 2 }) {
    const [t, setT] = useState('');
    return (
        <div role="group" aria-label={rotulo} className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 space-y-2">
            <div><Label htmlFor={id} className="text-xs">{rotulo}</Label><Textarea id={id} rows={linhas} maxLength={2000} className="mt-1" value={t} onChange={(e) => setT(e.target.value)} /></div>
            <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={onVoltar}>Voltar</Button>
                <Button size="sm" disabled={indo || t.trim().length < minimo} onClick={async () => { if (await onFazer(t.trim())) onVoltar(); }}>{botao}</Button>
            </div>
        </div>
    );
}

// ─── Órgão ─────────────────────────────────────────────────────────────────

function UnidadeOrgao({ u, criterio, gerir, chamar, indo, agora, baixar }) {
    const [ato, setAto] = useState(null); // 'negociar' | 'recusar' | 'convocar' | {reabrir: uid}
    const [conv, setConv] = useState({ o_que: u.situacao === 'aceita' ? 'documentos' : 'proposta', horas: '2' });
    const ch = { chave: u.chave };
    const at = u.desempate?.atual;
    const esperando = at && !at.recusou && !at.vencido;
    const final = ['habilitada', 'fracassada', 'deserta'].includes(u.situacao);
    return (
        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <h4 className="text-sm font-semibold">{u.nome}</h4><Selo u={u} />
            </div>
            {!u.ordem.length ? <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma proposta: deserto.</p> : (
                <ol className="space-y-1">
                    {u.ordem.map((c, k) => (
                        <li key={c.uid} className={`flex flex-wrap items-center gap-2 text-sm rounded-md border px-2 py-1 ${c.uid === u.vez ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                            <span className="font-semibold w-6">{k + 1}º</span>
                            <span className={`flex-1 min-w-[10rem] ${c.recusa ? 'line-through text-slate-500' : ''}`}>{c.nome} <span className="text-xs text-slate-600 dark:text-slate-400">({c.apelido}) {c.documento}{c.porte === 'me_epp' ? ' · ME/EPP' : ''}</span></span>
                            <b>{valorTexto(c.total, criterio)}</b>
                            {c.desempate && <Badge variant="outline">desempate</Badge>}
                            {c.negociado && <Badge variant="outline">negociado</Badge>}
                            {c.uid === u.vez && <Badge className="bg-indigo-600 hover:bg-indigo-600">em análise</Badge>}
                            {c.recusa && <span className="w-full text-xs text-rose-700 dark:text-rose-300">{c.recusa.etapa === 'proposta' ? 'Proposta recusada' : 'Inabilitado'}: {c.recusa.motivo}</span>}
                            {gerir && final && c.uid !== u.habilitada?.uid && <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAto({ reabrir: c.uid })}><RotateCcw className="w-3.5 h-3.5" aria-hidden /> Reabrir</Button>}
                        </li>
                    ))}
                </ol>
            )}
            {u.desempate && (
                <div className="text-sm rounded-md border border-amber-300 dark:border-amber-800 p-2 space-y-1">
                    <p>Empate ficto (ME/EPP até 5% acima da melhor oferta): {u.desempate.candidatos.join(', ')}.</p>
                    {esperando && <p>Aguardando a oferta de <b>{at.nome}</b>: <Contagem ate={at.ate} agora={agora} /></p>}
                    {at?.recusou && <p>{at.nome} não cobriu a oferta.</p>}
                    {gerir && !esperando && (
                        <Button size="sm" className="gap-1" disabled={indo} onClick={() => chamar('certameDesempate', ch, u.desempate.proximo ? 'Convocado para o desempate' : 'Desempate encerrado')}>
                            <Scale className="w-4 h-4" aria-hidden /> {u.desempate.proximo ? `Convocar ${u.desempate.proximo} para o desempate (5 min)` : 'Encerrar o desempate e analisar a primeira'}
                        </Button>
                    )}
                </div>
            )}
            {u.negociacao && <p className="text-xs text-slate-700 dark:text-slate-300"><Handshake className="w-3.5 h-3.5 inline" aria-hidden /> Negociação aberta em {quandoBr(u.negociacao.desde)}: o licitante responde com nova oferta na disputa.</p>}
            {u.convocacao && (
                <div className="text-sm rounded-md border border-slate-200 dark:border-slate-700 p-2 space-y-1">
                    <p>Convocado para enviar {u.convocacao.o_que === 'proposta' ? 'a proposta ajustada' : 'os documentos de habilitação'} até {quandoBr(u.convocacao.ate)} (<Contagem ate={u.convocacao.ate} agora={agora} />).</p>
                    {!u.convocacao.arquivos.length ? <p className="text-xs text-slate-600 dark:text-slate-400">Nenhum arquivo enviado ainda.</p> : (
                        <ul className="space-y-1">{u.convocacao.arquivos.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="flex-1">{a.nome} · {quandoBr(a.em)}</span>
                                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => baixar(u.chave, a)}><Download className="w-3.5 h-3.5" aria-hidden /> Baixar</Button></li>
                        ))}</ul>
                    )}
                </div>
            )}
            {gerir && ['analise', 'aceita'].includes(u.situacao) && !ato && (
                <div className="flex flex-wrap gap-2">
                    {u.situacao === 'analise' && <Button size="sm" variant="outline" className="gap-1" disabled={indo} onClick={() => setAto('negociar')}><Handshake className="w-4 h-4" aria-hidden /> Negociar</Button>}
                    <Button size="sm" variant="outline" className="gap-1" disabled={indo} onClick={() => setAto('convocar')}><FileUp className="w-4 h-4" aria-hidden /> Pedir {u.situacao === 'aceita' ? 'documentos' : 'proposta ou documentos'}</Button>
                    {u.situacao === 'analise'
                        ? <Button size="sm" className="gap-1" disabled={indo} onClick={() => chamar('certameAceitar', ch, 'Proposta aceita')}><CheckCircle2 className="w-4 h-4" aria-hidden /> Aceitar a proposta</Button>
                        : <Button size="sm" className="gap-1" disabled={indo} onClick={() => chamar('certameHabilitar', ch, 'Licitante habilitado')}><Trophy className="w-4 h-4" aria-hidden /> Habilitar</Button>}
                    <Button size="sm" variant="ghost" className="gap-1 text-rose-700 dark:text-rose-300" disabled={indo} onClick={() => setAto('recusar')}><XCircle className="w-4 h-4" aria-hidden /> {u.situacao === 'analise' ? 'Recusar a proposta' : 'Inabilitar'}</Button>
                </div>
            )}
            {ato === 'negociar' && <AtoComTexto id={`jg-neg-${u.chave}`} rotulo="Contraproposta ao licitante (vai à conversa da sala)" botao="Abrir a negociação" minimo={5} indo={indo} onVoltar={() => setAto(null)} onFazer={(texto) => chamar('certameNegociar', { ...ch, texto }, 'Negociação aberta')} />}
            {ato === 'recusar' && <AtoComTexto id={`jg-motivo-${u.chave}`} rotulo={u.situacao === 'analise' ? 'Motivo da recusa da proposta (vai à conversa e à ata)' : 'Motivo da inabilitação (vai à conversa e à ata)'} botao={u.situacao === 'analise' ? 'Recusar e chamar o próximo' : 'Inabilitar e chamar o próximo'} indo={indo} onVoltar={() => setAto(null)} onFazer={(motivo) => chamar('certameRecusar', { ...ch, motivo }, 'Registrado; segue o próximo classificado')} />}
            {ato?.reabrir && <AtoComTexto id={`jg-reabrir-${u.chave}`} rotulo="Motivo da reabertura (por exemplo, recurso provido)" botao="Reabrir a análise" indo={indo} onVoltar={() => setAto(null)} onFazer={(motivo) => chamar('certameReabrir', { ...ch, uid: ato.reabrir, motivo }, 'Julgamento reaberto')} />}
            {ato === 'convocar' && (
                <div role="group" aria-label="Convocar o licitante" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 grid gap-2 sm:grid-cols-3 items-end">
                    <div><Label htmlFor={`jg-oque-${u.chave}`} className="text-xs">O que enviar</Label>
                        <select id={`jg-oque-${u.chave}`} className={sel} value={conv.o_que} onChange={(e) => setConv((v) => ({ ...v, o_que: e.target.value }))}>
                            <option value="proposta">Proposta ajustada ao valor final</option><option value="documentos">Documentos de habilitação</option>
                        </select></div>
                    <div><Label htmlFor={`jg-horas-${u.chave}`} className="text-xs">Prazo, em horas (2 a 72)</Label>
                        <Input id={`jg-horas-${u.chave}`} type="number" min={2} max={72} className="mt-1" value={conv.horas} onChange={(e) => setConv((v) => ({ ...v, horas: e.target.value }))} /></div>
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setAto(null)}>Voltar</Button>
                        <Button size="sm" disabled={indo} onClick={async () => { if (await chamar('certameConvocar', { ...ch, ...conv }, 'Licitante convocado')) setAto(null); }}>Convocar</Button>
                    </div>
                </div>
            )}
        </li>
    );
}

function Recurso({ r, nomes = true }) {
    const fases = { intencao: 'Aberta a intenção de recurso', razoes: 'Prazo das razões', contrarrazoes: 'Prazo das contrarrazões', decisao: 'Aguardando a decisão', autoridade: 'Encaminhado à autoridade superior', sem_recurso: 'Ninguém manifestou intenção de recorrer', decidido: 'Recurso decidido' };
    return (
        <div className="text-sm space-y-1">
            <p><b>{fases[r.momento] || ''}</b>. Intenção até {quandoBr(r.intencao_ate)}; razões até {quandoBr(r.razoes_ate)}; contrarrazões até {quandoBr(r.contrarrazoes_ate)} (horário de Brasília).</p>
            {r.intencoes.map((i, k) => (
                <details key={k} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <summary className="cursor-pointer">{nomes ? i.nome : 'Licitante'}: {i.motivo} {i.razoes ? '(razões apresentadas)' : ''}</summary>
                    {i.razoes && <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{i.razoes.texto}</p>}
                </details>
            ))}
            {r.contrarrazoes.map((c, k) => (
                <details key={k} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                    <summary className="cursor-pointer">Contrarrazões de {c.nome}</summary>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{c.texto}</p>
                </details>
            ))}
            {r.encaminhado && <p><b>Mantida a decisão e encaminhado à autoridade superior:</b> {r.encaminhado.fundamentos}</p>}
            {r.decisao && <p><b>Decisão{r.encaminhado ? ' da autoridade superior' : ''}:</b> {{ nao: 'Negado provimento', sim: 'Dado provimento', parcial: 'Dado provimento em parte' }[r.decisao.provimento]}. {r.decisao.fundamentos}</p>}
        </div>
    );
}

export function JulgamentoOrgao({ orgId, procId }) {
    const qc = useQueryClient();
    const chave = ['sec-julgamento', orgId, procId];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'certameJulgamento', { processo_id: procId }), refetchInterval: (s) => (s.state.data?.etapa === 'encerrado' ? false : 8000) });
    const d = q.data;
    const agora = useAgoraServidor(d?.agora, q.dataUpdatedAt);
    const [indo, setIndo] = useState(false);
    const [minutos, setMinutos] = useState('10');
    const [decisao, setDecisao] = useState({ provimento: 'nao', fundamentos: '' });
    const chamar = async (action, extra, ok) => {
        setIndo(true);
        try {
            const r = await secProcesso(orgId, action, { processo_id: procId, ...extra });
            toast.success(ok);
            if (r?.aviso_acao) toast.warning(`A ação do rito não se cumpriu sozinha: ${r.aviso_acao}`);
            await qc.invalidateQueries({ queryKey: chave });
            qc.invalidateQueries({ queryKey: ['sec-disputa', orgId, procId] });
            qc.invalidateQueries({ queryKey: ['sec-proc', orgId, procId] });
            return r || true;
        } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return false; } finally { setIndo(false); }
    };
    const baixar = async (ch, a) => {
        try { const r = await secProcesso(orgId, 'certameArquivo', { processo_id: procId, chave: ch, arquivo_id: a.id }); baixarResposta(r, r.nome, r.mime); } catch (e) { toast.error(e?.message || 'Não foi possível baixar'); }
    };
    if (q.isLoading) return <p className="text-sm text-slate-600 dark:text-slate-400">Abrindo o julgamento…</p>;
    if (q.error) return <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>;
    const algumVencedor = d.unidades.some((u) => u.situacao === 'habilitada');
    const tudoDeserto = d.unidades.every((u) => u.situacao === 'deserta');
    return (
        <section aria-label="Julgamento da disputa" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Julgamento</h3>
                <Badge className={d.etapa === 'encerrado' ? 'bg-emerald-700 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-600'}>{d.resultado || d.etapa_nome}</Badge>
            </div>
            {d.equipe?.agente && !d.pode.gerir && d.etapa === 'julgamento' && <p className="text-xs text-slate-700 dark:text-slate-300">Quem conduz o julgamento é o agente de contratação, {d.equipe.agente.nome}. Aqui você acompanha.</p>}
            {d.etapa === 'julgamento' && <p className="text-xs text-slate-600 dark:text-slate-400">Cada item ou lote: desempate de ME/EPP quando houver, análise da proposta (negociação, proposta ajustada), aceitação, documentos e habilitação. Recusar ou inabilitar chama o próximo classificado. Tudo o que você faz aparece na conversa da sala.</p>}
            <ul className="space-y-2">{d.unidades.map((u) => <UnidadeOrgao key={u.chave} u={u} criterio={d.criterio} gerir={d.pode.gerir} chamar={chamar} indo={indo} agora={agora} baixar={baixar} />)}</ul>
            {d.pode.declarar && (
                <div role="group" aria-label="Declarar o vencedor" className="rounded-md border border-indigo-200 dark:border-indigo-900 p-3 flex flex-wrap items-end gap-2">
                    <p className="text-sm flex-1 min-w-[14rem]">Todos os itens decididos. Declarar o vencedor vai aos autos e abre a intenção de recurso; quem manifestar tem 3 dias úteis para as razões, e os demais, outros 3 para as contrarrazões.</p>
                    <div><Label htmlFor="jg-minutos" className="text-xs">Intenção aberta por (minutos, 10 a 60)</Label><Input id="jg-minutos" type="number" min={10} max={60} className="mt-1 w-28" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></div>
                    <Button className="gap-1" disabled={indo} onClick={() => chamar('certameDeclarar', { minutos: numero(minutos) }, 'Vencedor declarado')}><Trophy className="w-4 h-4" aria-hidden /> Declarar o vencedor</Button>
                </div>
            )}
            {d.recurso && <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><h4 className="text-sm font-semibold mb-1">Recurso</h4><Recurso r={d.recurso} /></div>}
            {d.recursos_anteriores.length > 0 && <details className="text-sm"><summary className="cursor-pointer">Rodadas anteriores de recurso ({d.recursos_anteriores.length})</summary>{d.recursos_anteriores.map((r, k) => <Recurso key={k} r={{ ...r, momento: 'decidido' }} />)}</details>}
            {d.pode.decidir && (
                <div role="group" aria-label="Decidir o recurso" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                    <div><Label htmlFor="jg-provimento" className="text-xs">Decisão</Label>
                        <select id="jg-provimento" className={sel} value={decisao.provimento} onChange={(e) => setDecisao((v) => ({ ...v, provimento: e.target.value }))}>
                            <option value="nao">{d.pode.encaminha ? 'Manter a decisão e encaminhar à autoridade superior' : 'Negar provimento (segue ao resultado)'}</option>
                            <option value="sim">{d.pode.encaminha ? 'Reconsiderar: dar provimento (refaz o julgamento)' : 'Dar provimento (refaz o julgamento)'}</option>
                            <option value="parcial">{d.pode.encaminha ? 'Reconsiderar em parte (refaz o que alcançou)' : 'Dar provimento em parte (refaz o que alcançou)'}</option>
                        </select></div>
                    {d.pode.encaminha && <p className="text-xs text-slate-700 dark:text-slate-300">Com autoridade superior designada, quem conduz reconsidera ou mantém a decisão e encaminha o recurso, com a motivação, para a autoridade decidir (Lei 14.133/2021, art. 165, § 2º).</p>}
                    <div><Label htmlFor="jg-fundamentos" className="text-xs">Fundamentos (vão aos autos)</Label><Textarea id="jg-fundamentos" rows={4} className="mt-1" value={decisao.fundamentos} onChange={(e) => setDecisao((v) => ({ ...v, fundamentos: e.target.value }))} /></div>
                    <div className="flex justify-end"><Button disabled={indo || decisao.fundamentos.trim().length < 20} onClick={() => chamar('certameDecidirRecurso', decisao, d.pode.encaminha && decisao.provimento === 'nao' ? 'Recurso encaminhado' : 'Recurso decidido')}>{d.pode.encaminha && decisao.provimento === 'nao' ? 'Encaminhar o recurso' : 'Registrar a decisão'}</Button></div>
                </div>
            )}
            {d.pode.resultado && (
                <div role="group" aria-label="Registrar o resultado" className="rounded-md border border-emerald-300 dark:border-emerald-800 p-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm flex-1 min-w-[14rem]">O resultado vai aos autos com a ata da disputa e cumpre a ação do rito{algumVencedor ? ': o objeto é adjudicado aos vencedores e a disputa, homologada.' : '.'}</p>
                    <Button className="gap-1" disabled={indo} onClick={() => chamar('certameResultado', {}, 'Resultado registrado')}><CheckCircle2 className="w-4 h-4" aria-hidden /> {algumVencedor ? 'Adjudicar e homologar' : tudoDeserto ? 'Declarar deserta' : 'Declarar fracassada'}</Button>
                </div>
            )}
            {d.ata && <details className="rounded-md border border-slate-200 dark:border-slate-700 p-2" open><summary className="text-sm font-semibold cursor-pointer">Ata da disputa</summary><pre className="mt-2 whitespace-pre-wrap text-sm font-sans">{d.ata}</pre></details>}
            <Mensagens lista={d.mensagens} id="jg-msg" rotulo="Mensagem a todos os licitantes"
                onEnviar={d.pode.conversar ? async (texto) => { await secProcesso(orgId, 'certameMensagem', { processo_id: procId, texto }); qc.invalidateQueries({ queryKey: chave }); } : null} />
        </section>
    );
}

// ─── Fornecedor ────────────────────────────────────────────────────────────

function UnidadeFornecedor({ u, criterio, certameId, agora, atualizar }) {
    const [v, setV] = useState('');
    const [indo, setIndo] = useState(false);
    const fazer = async (action, extra, ok) => {
        setIndo(true);
        try { await secPortal(action, { certame_id: certameId, chave: u.chave, ...extra }); toast.success(ok); setV(''); atualizar(); } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); } finally { setIndo(false); }
    };
    const enviar = async (file) => {
        if (!file) return;
        setIndo(true);
        try {
            await secPortal('disputaEnviarArquivo', { certame_id: certameId, chave: u.chave, nome: file.name, ...await prepararEnvio(file) });
            toast.success('Arquivo enviado');
            atualizar();
        } catch (e) { toast.error(e?.message || 'Não foi possível enviar'); } finally { setIndo(false); }
    };
    const desc = criterio === 'maior_desconto';
    return (
        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 justify-between"><h4 className="font-semibold">{u.nome}</h4><Selo u={u} /></div>
            {u.posicao ? <p>Sua posição: <b>{u.posicao}º</b>, com {valorTexto(u.meu.total, criterio)}.{u.vez && !u.vez_sou_eu ? ` Em análise: ${u.vez}.` : ''}{u.vez_sou_eu ? ' A sua proposta está em análise.' : ''}</p>
                : <p className="text-slate-600 dark:text-slate-400">Você não cotou este item ou lote.</p>}
            {u.recusa && <p className="text-rose-700 dark:text-rose-300">{u.recusa.etapa === 'proposta' ? 'Sua proposta foi recusada' : 'Você foi inabilitado'}: {u.recusa.motivo}</p>}
            {u.vencedor && <p className="flex items-center gap-1"><Trophy className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden /><span>Vencedor: <b>{u.vencedor.quem}</b>, {valorTexto(u.vencedor.total, criterio)}.</span></p>}
            {u.desempate && (
                <div role="group" aria-label="Desempate" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 space-y-2">
                    <p>Você está em empate ficto como ME/EPP. Para ficar em primeiro, ofereça {desc ? 'desconto maior' : 'valor menor'} que {valorTexto(u.desempate.alvo, criterio)} em até <Contagem ate={u.desempate.ate} agora={agora} />.</p>
                    <div className="flex flex-wrap gap-2 items-end">
                        <div><Label htmlFor={`jg-desempate-${u.chave}`} className="text-xs">{desc ? 'Desconto (%)' : 'Valor (o mesmo que você digitaria no lance)'}</Label><Input id={`jg-desempate-${u.chave}`} inputMode="decimal" className="mt-1 w-40" value={v} onChange={(e) => setV(e.target.value)} /></div>
                        <Button size="sm" disabled={indo || !v.trim()} onClick={() => fazer('disputaDesempate', { valor: v }, 'Oferta registrada')}>Cobrir a oferta</Button>
                        <Button size="sm" variant="ghost" disabled={indo} onClick={() => fazer('disputaDesempate', { recusar: true }, 'Registrado')}>Não vou cobrir</Button>
                    </div>
                </div>
            )}
            {u.negociacao && (
                <div role="group" aria-label="Negociação" className="rounded-md border border-indigo-200 dark:border-indigo-900 p-2 flex flex-wrap gap-2 items-end">
                    <p className="w-full">O órgão abriu negociação com você (veja a contraproposta nas mensagens). Se aceitar, mande a nova oferta.</p>
                    <div><Label htmlFor={`jg-neg-${u.chave}`} className="text-xs">Nova oferta</Label><Input id={`jg-neg-${u.chave}`} inputMode="decimal" className="mt-1 w-40" value={v} onChange={(e) => setV(e.target.value)} /></div>
                    <Button size="sm" disabled={indo || !v.trim()} onClick={() => fazer('disputaNegociar', { valor: v }, 'Nova oferta enviada')}><Handshake className="w-4 h-4 mr-1" aria-hidden /> Enviar a nova oferta</Button>
                </div>
            )}
            {u.convocacao && (
                <div role="group" aria-label="Envio de arquivos" className="rounded-md border border-indigo-200 dark:border-indigo-900 p-2 space-y-2">
                    <p>Envie {u.convocacao.o_que === 'proposta' ? 'a proposta ajustada ao valor final' : 'os documentos de habilitação'} até {quandoBr(u.convocacao.ate)} (<Contagem ate={u.convocacao.ate} agora={agora} />). PDF, Word, PNG ou JPG, até 50 MB cada.</p>
                    {u.convocacao.arquivos.map((a) => <p key={a.id} className="text-xs">Enviado: {a.nome}, {quandoBr(a.em)}</p>)}
                    {u.convocacao.aberta && <div><Label htmlFor={`jg-arq-${u.chave}`} className="text-xs">Arquivo</Label><Input id={`jg-arq-${u.chave}`} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" className="mt-1" disabled={indo} onChange={(e) => { enviar(e.target.files?.[0]); e.target.value = ''; }} /></div>}
                </div>
            )}
        </li>
    );
}

export function JulgamentoFornecedor({ certameId, criterio }) {
    const qc = useQueryClient();
    const chave = ['disputa-julgamento', certameId];
    const q = useQuery({ queryKey: chave, queryFn: () => secPortal('disputaJulgamento', { certame_id: certameId }), refetchInterval: (s) => (s.state.data?.etapa === 'encerrado' ? false : 5000) });
    const d = q.data;
    const agora = useAgoraServidor(d?.agora, q.dataUpdatedAt);
    const [txt, setTxt] = useState({});
    const [indo, setIndo] = useState(false);
    const atualizar = () => qc.invalidateQueries({ queryKey: chave });
    const fazer = async (action, extra, ok) => {
        setIndo(true);
        try { await secPortal(action, { certame_id: certameId, ...extra }); toast.success(ok); atualizar(); } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); } finally { setIndo(false); }
    };
    if (q.isLoading) return <p className="text-sm text-slate-600 dark:text-slate-400">Carregando o julgamento…</p>;
    if (q.error) return <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>;
    const enviarMsg = d.etapa !== 'encerrado' && !d.observador ? async (texto) => { await secPortal('disputaMensagem', { certame_id: certameId, texto }); atualizar(); } : null;
    const campo = (id, rotulo, chaveTxt, inicial = '') => (
        <div><Label htmlFor={id} className="text-xs">{rotulo}</Label>
            <Textarea id={id} rows={4} maxLength={20000} className="mt-1" value={txt[chaveTxt] ?? inicial} onChange={(e) => setTxt((t) => ({ ...t, [chaveTxt]: e.target.value }))} /></div>
    );
    const r = d.recurso;
    return (
        <section aria-label="Julgamento da disputa" className="space-y-3 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Julgamento</h2>
                {d.etapa && <Badge className={d.etapa === 'encerrado' ? 'bg-emerald-700 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-600'}>{d.resultado || d.etapa_nome}</Badge>}
            </div>
            {!d.etapa && <p className="text-sm">A fase de lances terminou. O órgão abre o julgamento: acompanhe aqui e pelas mensagens.</p>}
            {d.observador && <p className="text-xs text-slate-600 dark:text-slate-400">Você acompanha a sessão pública: vê o andamento de cada item, os avisos do órgão, o recurso e a ata. Os licitantes aparecem por apelido até a declaração do vencedor.</p>}
            {d.etapa && !d.observador && <p className="text-xs text-slate-600 dark:text-slate-400">Até o vencedor ser declarado, você aparece aos outros como {d.apelido}. Fique atento: o desempate de ME/EPP dura 5 minutos, e os prazos de envio de arquivos são do órgão.</p>}
            {d.etapa && <ul className="space-y-2">{d.unidades.map((u) => <UnidadeFornecedor key={u.chave} u={u} criterio={criterio} certameId={certameId} agora={agora} atualizar={atualizar} />)}</ul>}
            {r && (
                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                    <h3 className="text-sm font-semibold">Recurso</h3>
                    <Recurso r={r} />
                    {d.pode.intencao && (
                        <div role="group" aria-label="Intenção de recurso" className="space-y-2">
                            <p className="text-sm">A intenção de recurso fica aberta por pouco tempo: <Contagem ate={r.intencao_ate} agora={agora} />. Diga, em síntese, contra o que recorre.</p>
                            {campo('jg-intencao', 'Síntese da intenção de recorrer', 'intencao')}
                            <Button size="sm" disabled={indo || (txt.intencao || '').trim().length < 10} onClick={() => fazer('disputaIntencao', { motivo: txt.intencao }, 'Intenção registrada')}>Manifestar intenção de recorrer</Button>
                        </div>
                    )}
                    {d.pode.razoes && (
                        <div role="group" aria-label="Razões do recurso" className="space-y-2">
                            {campo('jg-razoes', `Razões do recurso (até ${quandoBr(r.razoes_ate)})`, 'razoes', r.intencoes.find((i) => i.nome === 'Você')?.razoes?.texto || '')}
                            <Button size="sm" disabled={indo || (txt.razoes || '').trim().length < 20} onClick={() => fazer('disputaRazoes', { texto: txt.razoes }, 'Razões registradas')}>Enviar as razões</Button>
                        </div>
                    )}
                    {d.pode.contrarrazoes && (
                        <div role="group" aria-label="Contrarrazões" className="space-y-2">
                            {campo('jg-contra', `Contrarrazões (até ${quandoBr(r.contrarrazoes_ate)})`, 'contra', r.contrarrazoes.find((c) => c.nome === 'Você')?.texto || '')}
                            <Button size="sm" disabled={indo || (txt.contra || '').trim().length < 20} onClick={() => fazer('disputaContrarrazoes', { texto: txt.contra }, 'Contrarrazões registradas')}>Enviar as contrarrazões</Button>
                        </div>
                    )}
                </div>
            )}
            {d.ata && <details className="rounded-md border border-slate-200 dark:border-slate-700 p-2" open><summary className="text-sm font-semibold cursor-pointer">Ata da disputa</summary><pre className="mt-2 whitespace-pre-wrap text-sm font-sans">{d.ata}</pre></details>}
            <Mensagens lista={d.mensagens} id="jg-msg" rotulo={d.observador ? 'Avisos do órgão' : 'Mensagem ao órgão (só o órgão lê)'} onEnviar={enviarMsg} />
        </section>
    );
}
