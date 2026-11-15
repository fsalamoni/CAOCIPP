import React, { useEffect, useMemo, useState } from 'react';
import {
    Ban, CheckCircle2, ClipboardList, Hand, History, Loader2, Lock, Megaphone, MessageSquare, Mic, MicOff, Pencil, Plus, Scale, ShieldOff, Trash2, Vote, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { quandoSessao } from '@/lib/sessoes';
import AjudaTermo from './AjudaTermo';
import { ItemOrdenavel, ListaOrdenavel } from './Ordenavel';

/**
 * Reunião deliberativa (S9): a pauta de assuntos, a palavra, o impedimento, a
 * votação (nominal, simbólica ou secreta), a apuração e o encaminhamento de
 * cada assunto, e o painel ao vivo da reunião.
 */

export const NOME_VOTACAO = { nominal: 'Nominal', simbolica: 'Simbólica', secreta: 'Secreta', sem_votacao: 'Sem votação' };
const AJUDA_VOTACAO = {
    nominal: 'cada membro vota pelo sistema (ou a secretaria registra o voto dado de viva voz); a ata traz o nome e o voto de cada um.',
    simbolica: 'o presidente pede que quem concorda permaneça como está e anuncia o resultado; a secretaria registra o placar.',
    secreta: 'cada membro vota pelo sistema, que guarda só quem votou e a soma: ninguém, nem a secretaria, vê o voto de alguém.',
    sem_votacao: 'informe ou apresentação: o assunto é tratado e registrado na ata, sem voto.',
};
export const NOME_MAIORIA = { simples: 'Maioria simples', absoluta: 'Maioria absoluta', dois_tercos: 'Dois terços' };
const AJUDA_MAIORIA = {
    simples: 'aprova com mais votos a favor que contra, entre os que votaram (abstenção não conta).',
    absoluta: 'aprova com mais da metade de quem pode votar o assunto, tenha votado ou não.',
    dois_tercos: 'aprova com dois terços de quem pode votar o assunto.',
};
export const SITUACAO_ASSUNTO = { pauta: 'Na pauta', em_votacao: 'Em votação', empate: 'Empate', deliberado: 'Deliberado', retirado: 'Retirado', adiado: 'Adiado' };
const COR_ASSUNTO = {
    em_votacao: 'bg-indigo-600 text-white', empate: 'bg-amber-500 text-white', deliberado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    retirado: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200', adiado: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
};
const VOTO = { sim: 'A favor', nao: 'Contra', abstencao: 'Abstenção' };
const sel = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const vivo = (a) => ['pauta', 'em_votacao', 'empate'].includes(a.situacao);

/** Tempo de fala corrido, mm:ss. */
export function Cronometro({ desde, className = '' }) {
    const [agora, setAgora] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
    const s = Math.max(0, Math.floor((agora - new Date(desde).getTime()) / 1000));
    return <span className={`font-mono tabular-nums ${className}`} aria-label={`${Math.floor(s / 60)} minutos e ${s % 60} segundos de fala`}>{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>;
}

/** Novo assunto, edição, ou um assunto adiado de outra reunião trazido para esta. */
function FormAssunto({ assunto, s, pendentes, onFechar, acao, indo }) {
    const [f, setF] = useState(() => ({ titulo: '', descricao: '', proponente: '', votacao: 'nominal', maioria: 'simples', ...(assunto || {}) }));
    const [motivo, setMotivo] = useState('');
    const [de, setDe] = useState(null);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const virtual = s.modo === 'assincrona';
    const extrapauta = !assunto && s.situacao === 'publicada';
    const trazer = (p) => { setDe(p); setF((x) => ({ ...x, titulo: p.titulo, votacao: p.votacao, maioria: p.maioria })); };
    const salvar = () => acao('reuniaoAssunto', {
        assunto_id: assunto?.id, assunto: f, ...(extrapauta ? { motivo } : {}), ...(de ? { de: { sessao_id: de.sessao_id, assunto_id: de.assunto_id } } : {}),
    }, assunto ? 'Assunto atualizado' : de ? 'Assunto trazido para esta reunião' : 'Assunto incluído na pauta');
    const campo = (id, rotulo, el, ajuda) => (
        <label htmlFor={id} className="text-sm space-y-1 block">
            <span className="block text-slate-700 dark:text-slate-300">{rotulo}</span>{el}
            {ajuda && <span className="block text-xs text-slate-600 dark:text-slate-400">{ajuda}</span>}
        </label>
    );
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>{assunto ? 'Editar assunto' : 'Novo assunto na pauta'}</DialogTitle>
                    <DialogDescription>
                        {extrapauta ? 'A reunião já foi convocada: o assunto entra como extrapauta, com o motivo, e aparece assim na ata.' : 'O assunto aparece na pauta para quem compõe o colegiado. A forma de votar e a maioria valem para ele.'}
                    </DialogDescription>
                </DialogHeader>
                {!assunto && pendentes?.length > 0 && (
                    <section className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-2" aria-label="Adiados de outras reuniões">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 flex items-center gap-1.5"><History className="w-4 h-4" aria-hidden /> Adiados de outras reuniões</p>
                        <ul className="space-y-1">
                            {pendentes.map((p) => (
                                <li key={`${p.sessao_id}-${p.assunto_id}`} className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="flex-1 min-w-[10rem]">{p.titulo} <span className="text-xs text-slate-600 dark:text-slate-400">· {p.sessao}{p.motivo ? ` · ${p.motivo}` : ''}</span></span>
                                    <Button size="sm" variant={de?.assunto_id === p.assunto_id ? 'default' : 'outline'} onClick={() => trazer(p)} aria-label={`Trazer ${p.titulo}`}>{de?.assunto_id === p.assunto_id ? 'Escolhido' : 'Trazer'}</Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">{campo('as-titulo', 'Título', <Input id="as-titulo" value={f.titulo} maxLength={200} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Aprovação do plano de trabalho de 2027" />)}</div>
                    <div className="sm:col-span-2">{campo('as-desc', 'Descrição (o que se decide, com os documentos ou links)', <Textarea id="as-desc" rows={4} value={f.descricao} maxLength={5000} onChange={(e) => set('descricao', e.target.value)} />)}</div>
                    <div className="sm:col-span-2">{campo('as-prop', 'Quem propõe (opcional)', <Input id="as-prop" value={f.proponente} maxLength={120} onChange={(e) => set('proponente', e.target.value)} placeholder="Presidência, membro, comissão" />)}</div>
                    {campo('as-votacao', 'Votação', (
                        <select id="as-votacao" className={sel} value={f.votacao} onChange={(e) => set('votacao', e.target.value)}>
                            {Object.entries(NOME_VOTACAO).filter(([v]) => !(virtual && v === 'simbolica')).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>), AJUDA_VOTACAO[f.votacao])}
                    {f.votacao !== 'sem_votacao' && campo('as-maioria', 'Para aprovar', (
                        <select id="as-maioria" className={sel} value={f.maioria} onChange={(e) => set('maioria', e.target.value)}>
                            {Object.entries(NOME_MAIORIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>), AJUDA_MAIORIA[f.maioria])}
                    {extrapauta && <div className="sm:col-span-2">{campo('as-motivo', 'Motivo da inclusão depois da convocação', <Input id="as-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />)}</div>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>Fechar</Button>
                    <Button disabled={indo || f.titulo.trim().length < 3 || (extrapauta && motivo.trim().length < 5)} onClick={salvar}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{assunto ? 'Salvar' : 'Incluir'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Placar anunciado na votação simbólica. */
function FormSimbolica({ a, acao, indo }) {
    const [p, setP] = useState({ sim: '', nao: '', abstencao: '0' });
    const n = (k) => (
        <label className="text-xs space-y-1" htmlFor={`sb-${k}-${a.id}`}>
            <span className="block text-slate-700 dark:text-slate-300">{VOTO[k]}</span>
            <Input id={`sb-${k}-${a.id}`} type="number" min={0} inputMode="numeric" className="w-20" value={p[k]} onChange={(e) => setP((x) => ({ ...x, [k]: e.target.value }))} />
        </label>
    );
    return (
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
            {n('sim')}{n('nao')}{n('abstencao')}
            <Button size="sm" disabled={indo || p.sim === '' || p.nao === ''} onClick={() => acao('reuniaoSimbolica', { assunto_id: a.id, sim: Number(p.sim), nao: Number(p.nao), abstencao: Number(p.abstencao || 0) }, 'Resultado registrado')}>Registrar o resultado</Button>
        </div>
    );
}

/** A secretaria registra o voto nominal dado de viva voz por quem não está no sistema. */
function VotoPorOutro({ a, composicao, acao, indo }) {
    const [uid, setUid] = useState('');
    const ja = new Map((a.votos_registrados || []).map((v) => [v.uid, v.voto]));
    const m = composicao.find((x) => x.uid === uid);
    return (
        <details className="text-sm">
            <summary className="cursor-pointer text-indigo-700 dark:text-indigo-300">Registrar voto dado de viva voz</summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <select aria-label="Membro" className={`${sel} max-w-xs`} value={uid} onChange={(e) => setUid(e.target.value)}>
                    <option value="">Escolha o membro</option>
                    {composicao.filter((x) => x.funcao !== 'suplente').map((x) => <option key={x.uid} value={x.uid}>{x.nome}{ja.has(x.uid) ? ` (${VOTO[ja.get(x.uid)]})` : ''}</option>)}
                </select>
                {Object.entries(VOTO).map(([v, r]) => <Button key={v} size="sm" variant="outline" disabled={!uid || indo} onClick={() => acao('reuniaoVotar', { assunto_id: a.id, voto: v, por_uid: uid, nome: m?.nome }, `Voto de ${m?.nome} registrado`)}>{r}</Button>)}
            </div>
        </details>
    );
}

function Encaminhamento({ a, acao, indo }) {
    const [t, setT] = useState(a.encaminhamento || '');
    const [aberto, setAberto] = useState(false);
    if (!aberto) return <Button size="sm" variant="ghost" className="gap-1" onClick={() => setAberto(true)}><ClipboardList className="w-4 h-4" aria-hidden /> {a.encaminhamento ? 'Editar encaminhamento' : 'Registrar encaminhamento'}</Button>;
    return (
        <div className="space-y-2 w-full">
            <label htmlFor={`enc-${a.id}`} className="text-xs text-slate-700 dark:text-slate-300 block">Encaminhamento (o que se decidiu fazer, quem faz e até quando): vai para a ata</label>
            <Textarea id={`enc-${a.id}`} rows={3} value={t} maxLength={5000} onChange={(e) => setT(e.target.value)} />
            <div className="flex gap-2">
                <Button size="sm" disabled={indo} onClick={async () => { if (await acao('reuniaoEncaminhar', { assunto_id: a.id, texto: t }, 'Encaminhamento registrado')) setAberto(false); }}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            </div>
        </div>
    );
}

function CartaoAssunto({ a, i, alca, s, pode, gere, composicao, emFoco, acao, indo, onEditar, onTirar }) {
    const ativa = s.situacao === 'rascunho' || s.situacao === 'publicada';
    const fora = a.situacao === 'retirado' || a.situacao === 'adiado';
    const conduz = pode.conduzir;
    const virtual = s.modo === 'assincrona';
    const euInscrito = a.inscritos.some((x) => x.sou_eu);
    const proximo = a.inscritos[0];
    return (
        <div className={`flex gap-2 p-3 ${fora ? 'opacity-75' : ''} ${emFoco ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''}`}>
            {alca || <span className="w-6 shrink-0" aria-hidden />}
            <span className="w-7 shrink-0 text-right font-semibold text-slate-500 dark:text-slate-400 pt-0.5">{i + 1}.</span>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium text-slate-900 dark:text-white ${a.situacao === 'retirado' ? 'line-through' : ''}`}>{a.titulo}</span>
                    <Badge variant="outline" className={`border-0 ${COR_ASSUNTO[a.situacao] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>{SITUACAO_ASSUNTO[a.situacao]}</Badge>
                    <Badge variant="outline" className="gap-1">{a.votacao === 'secreta' ? <Lock className="w-3 h-3" aria-hidden /> : <Vote className="w-3 h-3" aria-hidden />}{NOME_VOTACAO[a.votacao]}{a.votacao !== 'sem_votacao' ? ` · ${NOME_MAIORIA[a.maioria].toLowerCase()}` : ''}</Badge>
                    {a.inclusao === 'extrapauta' && <Badge variant="outline" className="border-amber-300 text-amber-900 dark:border-amber-800 dark:text-amber-200">Extrapauta</Badge>}
                    {emFoco && vivo(a) && <Badge className="bg-indigo-600 hover:bg-indigo-600 gap-1"><Megaphone className="w-3.5 h-3.5" aria-hidden /> Em discussão</Badge>}
                </div>
                {(a.proponente || a.vem_de) && <p className="text-xs text-slate-600 dark:text-slate-400">{a.proponente ? `Proposto por ${a.proponente}` : ''}{a.proponente && a.vem_de ? ' · ' : ''}{a.vem_de ? `Vindo da ${a.vem_de.titulo}` : ''}</p>}
                {a.descricao && <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">{a.descricao}</p>}
                {a.motivo && (fora || a.inclusao === 'extrapauta') && <p className="text-xs text-slate-600 dark:text-slate-400">{fora ? `${SITUACAO_ASSUNTO[a.situacao]}: ` : 'Incluído depois da convocação: '}{a.motivo}</p>}
                {a.impedidos.length > 0 && <p className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1"><ShieldOff className="w-3.5 h-3.5" aria-hidden /> Impedimento declarado: {a.impedidos.join(', ')} (fora do quórum e da votação deste assunto)</p>}

                {/* Palavra */}
                {(a.com_a_palavra || a.inscritos.length > 0 || a.falaram.length > 0) && (
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-2 space-y-1">
                        {a.com_a_palavra && (
                            <p className="flex flex-wrap items-center gap-2 font-medium text-indigo-900 dark:text-indigo-100">
                                <Mic className="w-4 h-4" aria-hidden /> Com a palavra: {a.com_a_palavra.sou_eu ? 'você' : a.com_a_palavra.nome} · <Cronometro desde={a.com_a_palavra.em} />
                                {conduz && <Button size="sm" variant="outline" className="h-7 gap-1" disabled={indo} onClick={() => acao('reuniaoPalavra', { assunto_id: a.id, acao: 'encerrar' }, 'Fala encerrada')}><MicOff className="w-3.5 h-3.5" aria-hidden /> Encerrar a fala</Button>}
                            </p>
                        )}
                        {a.inscritos.length > 0 && (
                            <div className="text-xs text-slate-700 dark:text-slate-300">
                                <span className="font-medium">Inscritos para falar:</span>
                                <ol className="mt-1 flex flex-wrap gap-1.5">
                                    {a.inscritos.map((x, k) => (
                                        <li key={x.uid} className="flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-600 pl-2 pr-1 py-0.5">
                                            {k + 1}. {x.sou_eu ? 'Você' : x.nome}
                                            {conduz && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-indigo-700 dark:text-indigo-300" disabled={indo} aria-label={`Dar a palavra a ${x.nome}`} onClick={() => acao('reuniaoPalavra', { assunto_id: a.id, acao: 'conceder', uid: x.uid }, `Palavra com ${x.nome}`)}><Mic className="w-3.5 h-3.5" aria-hidden /></Button>}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}
                        {a.falaram.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400">Já falaram: {a.falaram.join(', ')}</p>}
                    </div>
                )}

                {/* Votação */}
                {a.situacao === 'em_votacao' && a.votacao !== 'simbolica' && <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100 flex items-center gap-1" role="status"><Vote className="w-4 h-4" aria-hidden /> Votação aberta: votaram {a.votaram} de {a.aptos}</p>}
                {virtual && a.situacao === 'pauta' && a.votacao !== 'sem_votacao' && s.situacao === 'publicada' && <p className="text-xs text-slate-700 dark:text-slate-300">Votaram {a.votaram} de {a.aptos} até agora. O sistema apura no fim da votação.</p>}
                {(a.meu_voto || (a.votacao === 'secreta' && a.ja_votei)) && (
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" aria-hidden />
                        {a.votacao === 'secreta' ? 'Você já votou. O voto é secreto: nem o sistema mostra o que você escolheu.' : `Seu voto: ${VOTO[a.meu_voto]}${vivo(a) ? ' (muda até a apuração)' : ''}`}
                    </p>
                )}
                {a.pode_votar && (
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Seu voto em ${a.titulo}`}>
                        {a.votacao === 'secreta' && <span className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1 w-full"><Lock className="w-3.5 h-3.5" aria-hidden /> Voto secreto: o sistema guarda só que você votou. Depois de votar, não muda.</span>}
                        {Object.entries(VOTO).map(([v, r]) => (
                            <Button key={v} size="sm" variant={a.meu_voto === v ? 'default' : 'outline'} disabled={indo} aria-pressed={a.meu_voto === v}
                                className={v === 'sim' ? 'border-emerald-400' : v === 'nao' ? 'border-rose-400' : ''}
                                onClick={() => acao('reuniaoVotar', { assunto_id: a.id, voto: v }, a.votacao === 'secreta' ? 'Voto secreto registrado' : `Voto registrado: ${r}`)}>{r}</Button>
                        ))}
                    </div>
                )}
                {gere && a.situacao === 'em_votacao' && a.votacao === 'nominal' && composicao?.length > 0 && <VotoPorOutro a={a} composicao={composicao} acao={acao} indo={indo} />}
                {conduz && a.situacao === 'em_votacao' && a.votacao === 'simbolica' && <FormSimbolica a={a} acao={acao} indo={indo} />}

                {a.resultado && (
                    <div className={`rounded-md p-2 ${a.resultado.aprovado === true ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100' : a.resultado.aprovado === false ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'}`} role="status">
                        <p className="font-medium flex items-start gap-1"><Scale className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {a.resultado.texto}</p>
                        {a.nominais?.length > 0 && <p className="text-xs mt-1">{Object.entries(VOTO).map(([v, r]) => { const ns = a.nominais.filter((x) => x.voto === v).map((x) => x.nome); return ns.length ? `${r}: ${ns.join(', ')}` : null; }).filter(Boolean).join(' · ')}</p>}
                    </div>
                )}
                {a.situacao === 'empate' && pode.desempatar && (
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Voto de qualidade">
                        <Button size="sm" disabled={indo} onClick={() => acao('reuniaoDesempate', { assunto_id: a.id, voto: 'sim' }, 'Empate desfeito: aprovado')}>Desempatar a favor</Button>
                        <Button size="sm" variant="outline" disabled={indo} onClick={() => acao('reuniaoDesempate', { assunto_id: a.id, voto: 'nao' }, 'Empate desfeito: rejeitado')}>Desempatar contra</Button>
                    </div>
                )}
                {a.encaminhamento && <p className="text-sm text-slate-800 dark:text-slate-200 flex gap-1"><ClipboardList className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> <span><span className="font-medium">Encaminhamento:</span> {a.encaminhamento}</span></p>}

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2">
                    {a.pode_pedir_palavra && !a.com_a_palavra?.sou_eu && (
                        <Button size="sm" variant={euInscrito ? 'secondary' : 'outline'} className="gap-1" disabled={indo}
                            onClick={() => acao('reuniaoPalavra', { assunto_id: a.id, acao: euInscrito ? 'desistir' : 'pedir' }, euInscrito ? 'Inscrição retirada' : 'Você está inscrito para falar')}>
                            <Hand className="w-4 h-4" aria-hidden /> {euInscrito ? 'Desistir da palavra' : 'Pedir a palavra'}
                        </Button>
                    )}
                    {conduz && vivo(a) && proximo && !a.com_a_palavra && <Button size="sm" variant="outline" className="gap-1" disabled={indo} onClick={() => acao('reuniaoPalavra', { assunto_id: a.id, acao: 'conceder', uid: proximo.uid }, `Palavra com ${proximo.nome}`)}><Mic className="w-4 h-4" aria-hidden /> Dar a palavra a {proximo.sou_eu ? 'você' : proximo.nome}</Button>}
                    {conduz && vivo(a) && !emFoco && <Button size="sm" variant="ghost" className="gap-1" disabled={indo} aria-label={`Chamar ${a.titulo}`} onClick={() => acao('sessaoChamar', { processo_id: a.id }, 'Assunto chamado: o painel mostra o que está em discussão')}><Megaphone className="w-4 h-4" aria-hidden /> Chamar</Button>}
                    {conduz && a.situacao === 'pauta' && a.votacao !== 'sem_votacao' && <Button size="sm" className="gap-1" disabled={indo} onClick={() => acao('reuniaoAbrir', { assunto_id: a.id }, 'Votação aberta')}><Vote className="w-4 h-4" aria-hidden /> Abrir votação</Button>}
                    {conduz && a.situacao === 'em_votacao' && a.votacao !== 'simbolica' && <Button size="sm" className="gap-1" disabled={indo} onClick={() => acao('reuniaoApurar', { assunto_id: a.id }, 'Votação apurada')}><Scale className="w-4 h-4" aria-hidden /> Encerrar e apurar</Button>}
                    {conduz && a.situacao === 'pauta' && a.votacao === 'sem_votacao' && <Button size="sm" variant="outline" className="gap-1" disabled={indo} onClick={() => acao('reuniaoApurar', { assunto_id: a.id }, 'Assunto concluído')}><CheckCircle2 className="w-4 h-4" aria-hidden /> Concluir</Button>}
                    {a.pode_impedir && (
                        <Button size="sm" variant="ghost" className="gap-1" disabled={indo} onClick={() => acao('reuniaoImpedimento', { assunto_id: a.id, impedido: !a.eu_impedido }, a.eu_impedido ? 'Impedimento retirado' : 'Impedimento declarado: você fica fora da votação deste assunto')}>
                            <ShieldOff className="w-4 h-4" aria-hidden /> {a.eu_impedido ? 'Retirar impedimento' : 'Declarar impedimento'}
                        </Button>
                    )}
                    {pode.encaminhar && !fora && <Encaminhamento a={a} acao={acao} indo={indo} />}
                    {gere && ativa && a.situacao === 'pauta' && (s.situacao === 'rascunho' || !a.votaram) && <Button size="sm" variant="ghost" className="gap-1" onClick={() => onEditar(a)}><Pencil className="w-4 h-4" aria-hidden /> Editar</Button>}
                    {gere && ativa && vivo(a) && (
                        <Button size="icon" variant="ghost" className="text-rose-700 dark:text-rose-300" disabled={indo} aria-label={`Tirar ${a.titulo} da pauta`} onClick={() => onTirar(a)}><Trash2 className="w-4 h-4" aria-hidden /></Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/** A pauta da reunião: assuntos em ordem, cada um com palavra, votação e encaminhamento. */
export function PautaReuniao({ q, acao, indo, mover }) {
    const { sessao: s, gere, pode = {}, assuntos = [], pendentes = [], presenca, regras_reuniao: regras } = q;
    const [form, setForm] = useState(null); // {} novo | assunto
    const [tirar, setTirar] = useState(null);
    const [motivo, setMotivo] = useState('');
    const ativa = s.situacao === 'rascunho' || s.situacao === 'publicada';
    const ordenar = gere && ativa;
    const ids = useMemo(() => assuntos.map((a) => a.id), [assuntos]);
    const porId = new Map(assuntos.map((a) => [a.id, a]));
    const composicao = presenca?.composicao || [];
    const quorum = { maioria: 'maioria dos membros', um_terco: 'um terço dos membros', dois_tercos: 'dois terços dos membros', livre: 'sem quórum mínimo' }[regras?.quorum || 'maioria'];
    const linha = (a, i, alca) => (
        <CartaoAssunto a={a} i={i} alca={alca} s={s} pode={pode} gere={gere} composicao={composicao} emFoco={s.em_julgamento === a.id} acao={acao} indo={indo}
            onEditar={(x) => setForm(x)} onTirar={(x) => (s.situacao === 'rascunho' ? acao('reuniaoTirar', { assunto_id: x.id }, 'Assunto tirado do rascunho') : (setTirar(x), setMotivo('')))} />
    );
    return (
        <section className="space-y-2" aria-label="Pauta da reunião">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><MessageSquare className="w-4 h-4" aria-hidden /> Pauta{assuntos.length ? ` (${assuntos.length})` : ''} <AjudaTermo id="reuniao" /></h3>
                {gere && ativa && <Button size="sm" className="gap-1" onClick={() => setForm({})}><Plus className="w-4 h-4" aria-hidden /> Novo assunto</Button>}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                Quórum para votar: {quorum}{regras?.desempate === 'rejeita' ? '; no empate, o assunto é rejeitado' : '; no empate, o presidente dá o voto de qualidade'}. {s.modo === 'assincrona' ? 'Na reunião virtual, cada membro vota no seu tempo e o sistema apura no fim.' : 'O presidente (ou a secretaria) dá a palavra, abre e apura cada votação.'}
            </p>
            {!assuntos.length && <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4">Nenhum assunto na pauta. {gere && ativa ? 'Use Novo assunto.' : ''}</p>}
            {assuntos.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                    {ordenar ? (
                        <ListaOrdenavel ids={ids} nome={(i) => porId.get(i)?.titulo || 'assunto'} onMover={mover}>
                            {assuntos.map((a, i) => <ItemOrdenavel key={a.id} id={a.id} rotulo={`Mudar a posição de ${a.titulo}`}>{({ alca }) => linha(a, i, alca)}</ItemOrdenavel>)}
                        </ListaOrdenavel>
                    ) : assuntos.map((a, i) => <div key={a.id}>{linha(a, i, null)}</div>)}
                </div>
            )}
            {form && <FormAssunto assunto={form.id ? form : null} s={s} pendentes={pendentes} indo={indo} onFechar={() => setForm(null)} acao={async (...x) => { if (await acao(...x)) setForm(null); }} />}
            {tirar && (
                <Dialog open onOpenChange={(o) => !o && setTirar(null)}>
                    <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>Tirar &quot;{tirar.titulo}&quot; da pauta?</DialogTitle>
                            <DialogDescription>Retirado, o assunto sai da reunião. Adiado, ele fica entre os pendentes, para a secretaria trazer a outra reunião. O motivo vai para a ata.</DialogDescription>
                        </DialogHeader>
                        <label htmlFor="tr-motivo" className="text-sm space-y-1 block"><span className="block">Motivo</span><Input id="tr-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} /></label>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setTirar(null)}>Voltar</Button>
                            <Button variant="outline" disabled={indo || motivo.trim().length < 5} onClick={() => { acao('reuniaoTirar', { assunto_id: tirar.id, motivo, adiar: true }, 'Assunto adiado'); setTirar(null); }}>Adiar</Button>
                            <Button variant="destructive" className="gap-1" disabled={indo || motivo.trim().length < 5} onClick={() => { acao('reuniaoTirar', { assunto_id: tirar.id, motivo }, 'Assunto retirado da pauta'); setTirar(null); }}><Ban className="w-4 h-4" aria-hidden /> Retirar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    );
}

/** Painel em tela cheia da reunião: o assunto em discussão, quem fala, a votação e os resultados. */
export function PainelReuniao({ painel, onFechar }) {
    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onFechar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onFechar]);
    const itens = painel?.itens || [];
    const atual = itens.find((x) => x.id === painel?.em_julgamento);
    const feitos = itens.filter((x) => x.situacao === 'deliberado').length;
    return (
        <div role="dialog" aria-modal="true" aria-label="Painel ao vivo da reunião" className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
            <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                            {painel?.situacao === 'publicada'
                                ? <><span className="relative flex h-2.5 w-2.5" aria-hidden><span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping motion-reduce:animate-none" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" /></span> Ao vivo</>
                                : 'Reunião encerrada'}
                            <span className="text-slate-500 dark:text-slate-400">· {painel?.colegiado}</span>
                        </p>
                        <h2 className="text-2xl sm:text-4xl font-semibold">{painel?.titulo || 'Reunião'}</h2>
                        {painel && <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300">{quandoSessao(painel)}</p>}
                    </div>
                    <Button variant="outline" size="icon" onClick={onFechar} aria-label="Fechar o painel"><X className="w-5 h-5" aria-hidden /></Button>
                </div>
                {!painel && <p className="text-lg flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Carregando o painel…</p>}
                <section aria-live="polite" aria-label="Em discussão">
                    {atual ? (
                        <div className="rounded-2xl border-2 border-indigo-500 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-3 shadow-sm">
                            <p className="text-sm uppercase tracking-wide font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2"><Megaphone className="w-4 h-4" aria-hidden /> Em discussão</p>
                            <p className="text-2xl sm:text-4xl font-semibold">{atual.titulo}</p>
                            {atual.com_a_palavra && <p className="text-xl sm:text-3xl flex flex-wrap items-center gap-3"><Mic className="w-6 h-6 text-indigo-600" aria-hidden /> {atual.com_a_palavra.nome} <Cronometro desde={atual.com_a_palavra.em} className="text-slate-600 dark:text-slate-300" /></p>}
                            {atual.inscritos?.length > 0 && <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300">Inscritos: {atual.inscritos.map((n, k) => `${k + 1}. ${n}`).join('  ')}</p>}
                            <p className="text-base sm:text-xl font-medium">
                                {atual.resultado || (atual.situacao === 'em_votacao' ? (atual.votacao === 'simbolica' ? 'Votação simbólica em curso' : `Votação aberta: votaram ${atual.votaram} de ${atual.aptos}`) : 'Em discussão')}
                            </p>
                        </div>
                    ) : painel?.situacao === 'publicada' && (
                        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-lg text-slate-700 dark:text-slate-300">
                            {painel.modo === 'assincrona' ? 'Reunião virtual: cada membro vota no seu tempo, até o último dia.' : 'Nenhum assunto em discussão agora. O presidente ou a secretaria chamam o próximo.'}
                        </p>
                    )}
                </section>
                {itens.length > 0 && (
                    <section className="space-y-2" aria-label="Pauta">
                        <h3 className="text-lg font-semibold">Pauta <span className="font-normal text-slate-600 dark:text-slate-400">· {feitos} de {itens.length} deliberados</span></h3>
                        <ol className="space-y-2">
                            {itens.map((x, i) => (
                                <li key={x.id} className={`rounded-xl bg-white dark:bg-slate-900 border p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-1 ${x.id === painel.em_julgamento ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-800'}`}>
                                    <span className="w-8 text-right text-lg font-semibold text-slate-500 dark:text-slate-400">{i + 1}.</span>
                                    <span className="flex-1 min-w-[10rem] text-base">{x.titulo} <span className="text-sm text-slate-600 dark:text-slate-400">· {NOME_VOTACAO[x.votacao]}</span></span>
                                    <Badge variant="outline" className={`border-0 text-sm ${COR_ASSUNTO[x.situacao] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
                                        {x.situacao === 'deliberado' && x.resultado ? <><CheckCircle2 className="w-4 h-4 mr-1" aria-hidden />{x.aprovado === true ? 'Aprovado' : x.aprovado === false ? 'Rejeitado' : 'Deliberado'}</> : SITUACAO_ASSUNTO[x.situacao]}
                                    </Badge>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
                {painel?.atualizado_em && <p className="text-xs text-slate-500 dark:text-slate-400">Atualizado às {new Date(painel.atualizado_em).toLocaleTimeString('pt-BR')}. O painel mostra quantos votaram, nunca o voto de alguém; o resultado aparece na apuração.</p>}
            </div>
        </div>
    );
}
