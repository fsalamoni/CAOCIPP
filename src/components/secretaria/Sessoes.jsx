import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Ban, CalendarDays, CalendarPlus, CheckCircle2, ExternalLink, Flag, Gavel, Laptop, ListOrdered, Loader2, MapPin, Megaphone, MessageSquare, MonitorPlay, NotebookPen, Pencil, Plus, Radio, ScrollText, Search, Send, Trash2, Users, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secProcesso } from '@/services/secretariaService';
import {
    CARATER_SESSAO, INCLUSAO, MODOS_SESSAO, ROTULO_MOTIVO, SITUACAO_ITEM, SITUACAO_SESSAO, agruparSessoes, br, problemasDaSessao, situacaoDaVotacao,
    juntarNomes, ordemDoCPC, quandoSessao, selosDosPedidos, textoAntecedencia, textoDaVistaNaPauta,
} from '@/lib/sessoes';
import { POLOS, SeloUrgente } from './comum';
import AjudaTermo from './AjudaTermo';
import ErroQuery from './ErroQuery';
import { ItemOrdenavel, ListaOrdenavel } from './Ordenavel';
import VotacaoSessao from './VotacaoSessao';
import { AtaDaSessao, BotaoAgenda, PainelAoVivo, PresencaSessao, usePainelSessao } from './PainelSessao';
import { PainelReuniao, PautaReuniao } from './Reuniao';
import RelatorioColegiado, { GuiaColegiado } from './RelatorioColegiado';

const hojeIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const sel = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const COR_SITUACAO = {
    rascunho: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    publicada: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
    encerrada: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    cancelada: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
};
const Situacao = ({ s }) => <Badge variant="outline" className={`border-0 ${COR_SITUACAO[s] || ''}`}>{SITUACAO_SESSAO[s] || s}</Badge>;
const IconeModo = ({ modo, className = 'w-4 h-4' }) => (modo === 'presencial' ? <MapPin className={className} aria-hidden /> : <Video className={className} aria-hidden />);

/**
 * Aba Sessões: agenda das sessões de julgamento dos colegiados que a pessoa
 * vê (secretaria, lotados e membros), com a pauta de cada uma. A secretaria
 * marca a sessão, monta a ordem do dia, publica e cancela.
 */
export default function Sessoes({ orgId, onAbrir }) {
    const [params, setParams] = useSearchParams();
    const aberta = params.get('sessao');
    const abrir = (id) => {
        const next = new URLSearchParams(params);
        if (id) next.set('sessao', id); else next.delete('sessao');
        setParams(next);
    };
    return aberta
        ? <DetalheSessao orgId={orgId} id={aberta} onVoltar={() => abrir(null)} onAbrir={onAbrir} />
        : <ListaSessoes orgId={orgId} onAbrirSessao={abrir} />;
}

function CartaoSessao({ s, onAbrir, mostraOrgao }) {
    const [, m, d] = s.data.split('-');
    return (
        <li>
            <button type="button" onClick={() => onAbrir(s.id)}
                className="w-full text-left flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:border-indigo-300 dark:hover:border-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <span className="flex flex-col items-center justify-center w-14 shrink-0 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 py-1" aria-hidden>
                    <span className="text-xl font-semibold leading-none">{d}</span>
                    <span className="text-xs uppercase">{MESES[Number(m) - 1]}</span>
                </span>
                <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{s.titulo}</span>
                        <Situacao s={s.situacao} />
                        {s.tipo === 'reuniao' && <Badge variant="outline" className="gap-1 border-violet-300 text-violet-900 dark:border-violet-800 dark:text-violet-200"><MessageSquare className="w-3 h-3" aria-hidden /> Reunião</Badge>}
                        {s.componho && <Badge className="bg-indigo-600 hover:bg-indigo-600">Você compõe</Badge>}
                    </span>
                    <span className="block text-sm text-slate-700 dark:text-slate-300">
                        {mostraOrgao && <>{s.orgao_nome} · </>}
                        {s.modo === 'assincrona'
                            ? <><Laptop className="inline w-3.5 h-3.5 -mt-0.5" aria-hidden /> Votação virtual de {br(s.data)} a {br(s.fim)}</>
                            : <>{br(s.data)}, às {s.hora} · <IconeModo modo={s.modo} className="inline w-3.5 h-3.5 -mt-0.5" /> {s.modo === 'presencial' ? s.local : s.modo === 'virtual' ? 'Por videoconferência' : `${s.local} e por vídeo`}</>}
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{s.tipo === 'reuniao'
                        ? (s.itens === 0 ? 'Nenhum assunto na pauta' : s.itens === 1 ? '1 assunto na pauta' : `${s.itens} assuntos na pauta`)
                        : (s.itens === 0 ? 'Nenhum processo na pauta' : s.itens === 1 ? '1 processo na pauta' : `${s.itens} processos na pauta`)}</span>
                </span>
            </button>
        </li>
    );
}

function Grupo({ titulo, itens, vazio, onAbrir, mostraOrgao }) {
    return (
        <section className="space-y-2" aria-label={titulo}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
            {itens.length ? <ul className="grid gap-2 md:grid-cols-2">{itens.map((s) => <CartaoSessao key={s.id} s={s} onAbrir={onAbrir} mostraOrgao={mostraOrgao} />)}</ul>
                : <p className="text-sm text-slate-600 dark:text-slate-400">{vazio}</p>}
        </section>
    );
}

function ListaSessoes({ orgId, onAbrirSessao }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-sessoes', orgId], queryFn: () => secProcesso(orgId, 'sessaoListar') });
    const [filtro, setFiltro] = useState('');
    const [nova, setNova] = useState(false);
    const [acordao, setAcordao] = useState(null);
    if (q.isLoading) return <p className="text-sm text-slate-600 flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando as sessões…</p>;
    if (q.error) return <ErroQuery q={q} />;
    const { colegiados = [], sessoes = [], acordaos = [], hoje = hojeIso() } = q.data || {};
    const lista = filtro ? sessoes.filter((s) => s.orgao_id === filtro) : sessoes;
    const g = agruparSessoes(lista, hoje);
    const gere = colegiados.filter((c) => c.gere);
    const varios = colegiados.length > 1;
    return (
        <div className="space-y-5 pt-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 max-w-2xl">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Sessões e reuniões</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        A agenda dos colegiados: sessões de julgamento, com a ordem do dia de processos, e reuniões deliberativas, com pauta de assuntos e votação. {gere.length ? 'Marque a sessão, inclua os processos com julgamento pendente e publique a pauta: cada processo recebe a certidão nos autos e as partes são avisadas.' : 'Abra a sessão para ver a pauta.'} <AjudaTermo id="pauta" />
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {varios && (
                        <label className="text-sm">
                            <span className="sr-only">Colegiado</span>
                            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className={sel} aria-label="Colegiado">
                                <option value="">Todos os colegiados</option>
                                {colegiados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </label>
                    )}
                    {gere.length > 0 && <Button className="gap-2" onClick={() => setNova(true)}><CalendarPlus className="w-4 h-4" aria-hidden /> Marcar sessão</Button>}
                </div>
            </div>
            {!colegiados.length && (
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <p>Nenhum colegiado ativo em que você esteja lotado ou que você componha.</p>
                    <p>Para criar um: na configuração do Processo Eletrônico, aba Estrutura, cadastre o órgão com decisão colegiada, a composição (presidente e membros) e ao menos uma unidade dele. Depois, use no rito a ação Julgar em colegiado; a biblioteca de ritos tem modelos prontos com sessão.</p>
                </div>
            )}
            {gere.map((c) => <GuiaColegiado key={c.id} colegiado={c} sessoes={sessoes} />)}
            {acordaos.length > 0 && (
                <section className="space-y-2" aria-label="Acórdãos que você redige">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><ScrollText className="w-4 h-4" aria-hidden /> Acórdãos que você redige ({acordaos.length})</h3>
                    <ul className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                        {acordaos.map((a) => (
                            <li key={a.processo_id} className="p-3 flex flex-wrap items-center gap-2 text-sm">
                                <span className="min-w-0 flex-1">
                                    <span className="font-mono text-slate-800 dark:text-slate-200 mr-2">{a.numero}</span>
                                    <span className="text-slate-900 dark:text-white">{a.resultado}</span>
                                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                                        {a.sessao}{varios ? ` · ${a.colegiado}` : ''} · {a.enviado ? 'enviado à unidade, aguardando a juntada' : <span className={a.prazo < hoje ? 'text-rose-700 dark:text-rose-300 font-semibold' : ''}>até {br(a.prazo)}{a.prazo < hoje ? ' (vencido)' : ''}</span>}
                                    </span>
                                </span>
                                <Button size="sm" variant={a.enviado ? 'outline' : 'default'} aria-label={`Acórdão de ${a.numero}`} onClick={() => setAcordao(a)}>{a.enviado ? 'Ver' : 'Redigir'}</Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {acordao && <VotacaoSessao orgId={orgId} sessaoId={acordao.sessao_id} processoId={acordao.processo_id} onFechar={() => setAcordao(null)} onMudou={() => qc.invalidateQueries({ queryKey: ['sec-sessoes', orgId] })} />}
            {colegiados.length > 0 && (
                <>
                    {g.minhas.length > 0 && <Grupo titulo="Minhas próximas sessões" itens={g.minhas} onAbrir={onAbrirSessao} mostraOrgao={varios} />}
                    {(g.proximas.length > 0 || !g.minhas.length) && (
                        <Grupo titulo={g.minhas.length ? 'Outras próximas sessões' : 'Próximas sessões'} itens={g.proximas} onAbrir={onAbrirSessao} mostraOrgao={varios}
                            vazio={gere.length ? 'Nenhuma sessão com pauta publicada. Use Marcar sessão para começar.' : 'Nenhuma sessão com pauta publicada por enquanto.'} />
                    )}
                    {gere.length > 0 && <Grupo titulo="Rascunhos de pauta" itens={g.rascunhos} onAbrir={onAbrirSessao} mostraOrgao={varios} vazio="Nenhum rascunho." />}
                    {g.passadas.length > 0 && (
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">Realizadas e canceladas ({g.passadas.length})</summary>
                            <ul className="grid gap-2 md:grid-cols-2 mt-2">{g.passadas.map((s) => <CartaoSessao key={s.id} s={s} onAbrir={onAbrirSessao} mostraOrgao={varios} />)}</ul>
                        </details>
                    )}
                    <RelatorioColegiado orgId={orgId} colegiados={colegiados} hoje={hoje} />
                </>
            )}
            {nova && (
                <FormSessao orgId={orgId} colegiados={gere} hoje={hoje} onFechar={() => setNova(false)}
                    onSalvo={async (id) => { setNova(false); await qc.invalidateQueries({ queryKey: ['sec-sessoes', orgId] }); onAbrirSessao(id); }} />
            )}
        </div>
    );
}

const VAZIA = { tipo: 'julgamento', titulo: '', carater: 'ordinaria', modo: 'presencial', data: '', hora: '', local: '', link: '', observacoes: '' };

/** Marcar ou editar a sessão. Publicada, só as observações mudam (a pauta já foi às partes). */
function FormSessao({ orgId, colegiados, sessao, hoje, onFechar, onSalvo }) {
    const [orgao, setOrgao] = useState(sessao?.orgao_id || colegiados[0]?.id || '');
    const [f, setF] = useState(sessao ? { ...VAZIA, ...sessao } : VAZIA);
    const [salvando, setSalvando] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const travada = sessao?.situacao === 'publicada';
    const virtual = f.modo === 'assincrona';
    const reuniao = f.tipo === 'reuniao';
    const problemas = travada ? [] : problemasDaSessao(f, hoje);
    const regra = textoAntecedencia(colegiados.find((c) => c.id === orgao)?.pauta);
    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secProcesso(orgId, 'sessaoSalvar', { id: sessao?.id, orgao_id: orgao, sessao: f });
            toast.success(sessao ? 'Dados atualizados' : reuniao ? 'Reunião marcada. Agora inclua os assuntos na pauta.' : 'Sessão marcada. Agora inclua os processos na pauta.');
            await onSalvo(r.id);
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    const campo = (id, rotulo, el) => <label htmlFor={id} className="text-sm space-y-1 block"><span className="block text-slate-700 dark:text-slate-300">{rotulo}</span>{el}</label>;
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>{sessao ? (reuniao ? 'Dados da reunião' : 'Dados da sessão') : 'Marcar sessão ou reunião'}</DialogTitle>
                    <DialogDescription>
                        {travada ? 'A pauta já foi publicada com estes dados: só as observações mudam. Para outra data, hora ou local, cancele a sessão (as partes são avisadas) e marque outra.'
                            : 'A sessão começa como rascunho de pauta, que só a secretaria vê. Ninguém é avisado até a publicação.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                    {!sessao && (
                        <fieldset className="sm:col-span-2 space-y-1">
                            <legend className="text-sm text-slate-700 dark:text-slate-300">O que é</legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {[['julgamento', 'Sessão de julgamento', 'Pauta de processos com julgamento pendente; relator, votos e acórdão.'], ['reuniao', 'Reunião deliberativa', 'Pauta de assuntos; palavra, votação nominal, simbólica ou secreta, e ata.']].map(([v, r, d]) => (
                                    <label key={v} className={`flex gap-2 rounded-md border p-2 text-sm cursor-pointer ${f.tipo === v ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <input type="radio" name="ss-tipo" value={v} checked={f.tipo === v} onChange={() => set('tipo', v)} className="mt-1 accent-indigo-600" />
                                        <span><span className="block font-medium text-slate-900 dark:text-white">{r}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{d}</span></span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}
                    {!sessao && colegiados.length > 1 && (
                        <div className="sm:col-span-2">{campo('ss-orgao', 'Colegiado', (
                            <select id="ss-orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)} className={sel}>
                                {colegiados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>))}</div>
                    )}
                    <div className="sm:col-span-2">{campo('ss-titulo', 'Título (opcional)', <Input id="ss-titulo" value={f.titulo} disabled={travada} maxLength={120} onChange={(e) => set('titulo', e.target.value)} placeholder={reuniao ? 'Reunião ordinária de dd/mm/aaaa' : 'Sessão ordinária de dd/mm/aaaa'} />)}</div>
                    {campo('ss-carater', 'Caráter', (
                        <select id="ss-carater" value={f.carater} disabled={travada} onChange={(e) => set('carater', e.target.value)} className={sel}>
                            {CARATER_SESSAO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>))}
                    {campo('ss-modo', 'Como', (
                        <select id="ss-modo" value={f.modo} disabled={travada} onChange={(e) => set('modo', e.target.value)} className={sel}>
                            {MODOS_SESSAO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                        </select>))}
                    {campo('ss-data', virtual ? 'Primeiro dia da votação' : 'Data', <Input id="ss-data" type="date" min={hoje} value={f.data} disabled={travada} onChange={(e) => set('data', e.target.value)} />)}
                    {campo('ss-hora', virtual ? 'Abre às' : 'Hora', <Input id="ss-hora" type="time" value={f.hora} disabled={travada} onChange={(e) => set('hora', e.target.value)} />)}
                    {virtual && (
                        <div className="sm:col-span-2 space-y-1">
                            {campo('ss-fim', 'Último dia da votação', <Input id="ss-fim" type="date" min={f.data || hoje} value={f.fim || ''} disabled={travada} onChange={(e) => set('fim', e.target.value)} />)}
                            {reuniao ? <p className="text-xs text-slate-600 dark:text-slate-400">Os membros votam cada assunto pelo sistema, cada um no seu tempo, do primeiro ao último dia (votação nominal ou secreta). No dia seguinte ao último, o sistema apura e lavra a ata; empate ou falta de quórum ficam para a próxima reunião.</p>
                                : <p className="text-xs text-slate-600 dark:text-slate-400">Os membros votam cada um no seu tempo, do primeiro ao último dia (a Res. CNJ 591/2024 usa até 6 dias úteis). No dia seguinte ao último, o sistema apura os resultados; o que ficar sem resultado (sem o voto do relator ou sem quórum) é adiado para a sessão seguinte. Até 48 horas antes do início, as partes podem pedir destaque, para o julgamento ir a uma sessão síncrona, e enviar a sustentação oral gravada.</p>}
                        </div>
                    )}
                    {f.modo !== 'virtual' && !virtual && <div className="sm:col-span-2">{campo('ss-local', 'Local', <Input id="ss-local" value={f.local} disabled={travada} maxLength={200} onChange={(e) => set('local', e.target.value)} placeholder="Sala de sessões, endereço" />)}</div>}
                    {f.modo !== 'presencial' && <div className="sm:col-span-2">{campo('ss-link', virtual ? 'Onde acompanhar (opcional)' : 'Link ou sala virtual', <Input id="ss-link" value={f.link} disabled={travada} maxLength={500} onChange={(e) => set('link', e.target.value)} placeholder="https://" />)}</div>}
                    <div className="sm:col-span-2">{campo('ss-obs', 'Observações (aparecem para quem vê a sessão, não para as partes)', <Textarea id="ss-obs" rows={3} value={f.observacoes} maxLength={2000} onChange={(e) => set('observacoes', e.target.value)} />)}</div>
                </div>
                {regra && !travada && <p className="text-sm text-slate-600 dark:text-slate-400">{regra} Isso é conferido na publicação.</p>}
                {problemas.length > 0 && f.data && <ul role="alert" className="text-sm text-amber-800 dark:text-amber-200 list-disc pl-5">{problemas.map((x) => <li key={x}>{x}</li>)}</ul>}
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>Fechar</Button>
                    <Button onClick={salvar} disabled={salvando || problemas.length > 0 || !orgao}>{salvando && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{sessao ? 'Salvar' : 'Marcar sessão'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Pede o motivo (retirada, cancelamento) antes de mexer nos autos. */
function DialogoMotivo({ titulo, descricao, acao, perigo, onFechar, onConfirmar }) {
    const [motivo, setMotivo] = useState('');
    const [indo, setIndo] = useState(false);
    const ir = async () => { setIndo(true); try { await onConfirmar(motivo.trim()); } finally { setIndo(false); } };
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descricao}</DialogDescription></DialogHeader>
                <label htmlFor="ss-motivo" className="text-sm space-y-1 block">
                    <span className="block text-slate-700 dark:text-slate-300">Motivo (vai para a certidão nos autos)</span>
                    <Textarea id="ss-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </label>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>Voltar</Button>
                    <Button variant={perigo ? 'destructive' : 'default'} disabled={indo || motivo.trim().length < 5} onClick={ir}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{acao}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Processos aptos: em unidade do colegiado, com julgamento pendente na fase atual. */
function IncluirProcessos({ orgId, sessao, pautados, onFechar, onIncluido }) {
    const q = useQuery({ queryKey: ['sec-sessao-aptos', orgId, sessao.orgao_id], queryFn: () => secProcesso(orgId, 'sessaoAptos', { orgao_id: sessao.orgao_id }) });
    const [busca, setBusca] = useState('');
    const [inclusao, setInclusao] = useState('extrapauta');
    const [motivo, setMotivo] = useState('');
    const [indo, setIndo] = useState('');
    const publicada = sessao.situacao === 'publicada';
    const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = (q.data?.processos || []).filter((x) => !pautados.has(x.id) && (!busca || norm(`${x.numero} ${x.assunto}`).includes(norm(busca))));
    const incluir = async (x) => {
        setIndo(x.id);
        try {
            await secProcesso(orgId, 'sessaoIncluir', { id: sessao.id, processo_id: x.id, ...(publicada ? { inclusao, motivo: motivo.trim() } : {}) });
            toast.success(publicada ? `${x.numero} incluído; a certidão foi aos autos e as partes foram avisadas` : `${x.numero} incluído na pauta`);
            await onIncluido();
            if (publicada) onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível incluir'); } finally { setIndo(''); }
    };
    const falta = publicada && motivo.trim().length < 5;
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Incluir processos na pauta</DialogTitle>
                    <DialogDescription>Aparecem os processos que estão em unidade do colegiado e têm o julgamento pendente na fase atual. Quem já está em outra pauta aparece marcado.</DialogDescription>
                </DialogHeader>
                {publicada && (
                    <fieldset className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2 text-sm">
                        <legend className="px-1 font-medium text-amber-900 dark:text-amber-100">A pauta já foi publicada</legend>
                        <div className="flex flex-wrap gap-4">
                            {['extrapauta', 'mesa'].map((v) => (
                                <label key={v} className="flex items-center gap-2"><input type="radio" name="ss-inclusao" value={v} checked={inclusao === v} onChange={() => setInclusao(v)} /> {INCLUSAO[v]} <AjudaTermo id={v === 'mesa' ? 'em_mesa' : 'extrapauta'} /></label>
                            ))}
                        </div>
                        <label htmlFor="ss-motivo-inc" className="block space-y-1">
                            <span className="block text-slate-700 dark:text-slate-300">Motivo (vai para a certidão nos autos)</span>
                            <Textarea id="ss-motivo-inc" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                        </label>
                    </fieldset>
                )}
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" aria-hidden />
                    <Input className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número ou assunto" aria-label="Buscar processo" />
                </div>
                {q.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Procurando processos…</p>}
                {q.error && <ErroQuery q={q} />}
                {q.data && !lista.length && <p className="text-sm text-slate-600 dark:text-slate-400">{busca ? 'Nenhum processo com essa busca.' : 'Nenhum processo aguardando julgamento neste colegiado. O processo aparece aqui quando chega a uma fase com a ação de registrar julgamento ainda pendente.'}</p>}
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {lista.map((x) => (
                        <li key={x.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1">
                                <span className="font-mono text-indigo-700 dark:text-indigo-300 mr-2">{x.numero}</span>
                                <span className="font-medium">{x.assunto}</span>
                                {x.urgente && <SeloUrgente className="ml-2" />}
                                <span className="block text-xs text-slate-600 dark:text-slate-400">{x.fase_nome}{x.acao ? ` · ${x.acao}` : ''}{x.em_pauta ? ` · já na pauta da ${x.em_pauta}` : ''}</span>
                                {x.vista && (
                                    <span className="block text-xs text-violet-900 dark:text-violet-200">
                                        {x.vista.vencida ? `Prazo de vista de ${juntarNomes(x.vista.nomes)} vencido em ${br(x.vista.prazo)}: incluir agora requisita o processo.` : `Com vista para ${juntarNomes(x.vista.nomes)} até ${br(x.vista.prazo)}: volta à pauta com a devolução.`}
                                    </span>
                                )}
                                {x.continua && <span className="block text-xs text-slate-600 dark:text-slate-400">Julgamento já iniciado: segue com {x.continua.relator_nome ? `o relator ${x.continua.relator_nome}` : 'o mesmo relator'}{x.continua.manter_votos ? ' e os votos já dados' : ''}.</span>}
                            </span>
                            <Button size="sm" variant="outline" className="gap-1" disabled={!!indo || !!x.em_pauta || falta || (x.vista && !x.vista.vencida)} onClick={() => incluir(x)} aria-label={`Incluir ${x.numero}`}>
                                {indo === x.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />} Incluir
                            </Button>
                        </li>
                    ))}
                </ul>
                <DialogFooter><Button variant="outline" onClick={onFechar}>Fechar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Sessão virtual (S7): em que ponto está a votação e, terminada, a apuração. */
function AvisoVirtual({ s, reuniao, pode, indo, onApurar }) {
    const caixa = 'text-sm rounded-md p-2 flex flex-wrap items-center gap-2';
    if (s.situacao === 'encerrada') {
        return <p className={`${caixa} bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100`}><CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> Votação encerrada{s.encerrada_em ? ` em ${new Date(s.encerrada_em).toLocaleDateString('pt-BR')}` : ''}: o sistema apurou os resultados; o que ficou sem resultado foi adiado para {reuniao ? 'outra reunião' : 'a sessão seguinte'}.</p>;
    }
    if (s.situacao !== 'publicada') return null;
    if (s.virtual_encerrou) {
        return (
            <div className={`${caixa} bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100`} role="status">
                <span className="flex-1 min-w-[12rem]">A votação terminou em {br(s.fim)}. O sistema apura os resultados às 7h do dia seguinte; {pode ? 'você pode apurar agora.' : 'o presidente ou a secretaria podem apurar antes.'}</span>
                {pode && <Button size="sm" disabled={indo} onClick={onApurar}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Apurar e encerrar</Button>}
            </div>
        );
    }
    return (
        <p className={`${caixa} bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100`} role="status">
            <Laptop className="w-4 h-4 shrink-0" aria-hidden />
            {s.votacao_aberta ? `Votação aberta até ${br(s.fim)}. Cada membro vota no seu tempo; ${reuniao ? 'o resultado sai na apuração, no fim.' : 'o placar aparece na tela de julgamento.'}` : `A votação abre em ${br(s.data)}, a partir das ${s.hora}.${reuniao ? '' : ' O relator pode liberar o voto antes.'}`}
        </p>
    );
}

function DetalheSessao({ orgId, id, onVoltar, onAbrir }) {
    const qc = useQueryClient();
    const chave = ['sec-sessao', orgId, id];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'sessaoObter', { id }) });
    const [dialogo, setDialogo] = useState(null); // 'editar' | 'incluir' | 'publicar' | 'cancelar' | { tirar: item }
    const [indo, setIndo] = useState(false);
    const [ordem, setOrdem] = useState(null);
    const [telao, setTelao] = useState(false);
    const atualizar = () => Promise.all([qc.invalidateQueries({ queryKey: chave }), qc.invalidateQueries({ queryKey: ['sec-sessoes', orgId] }), qc.invalidateQueries({ queryKey: ['sec-sessao-aptos', orgId] })]);
    // S8: ao vivo. Escuta o painel depois de abrir a sessão (abrir é o que dá a leitura) e recarrega a cada mudança.
    const painel = usePainelSessao(q.data ? id : null, () => {
        qc.invalidateQueries({ queryKey: chave });
        qc.invalidateQueries({ queryKey: ['sec-votacao', orgId, id] });
    });
    const pauta = useMemo(() => q.data?.pauta || [], [q.data]);
    if (q.isLoading) return <p className="text-sm text-slate-600 flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando a sessão…</p>;
    if (q.error) return <div className="space-y-3 pt-2"><Button variant="ghost" className="gap-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" aria-hidden /> Voltar às sessões</Button><ErroQuery q={q} /></div>;
    const { sessao: s, colegiado, gere, hoje, data_minima: minima, dia_util: diaUtil, pode: podeS8 = {}, presenca, ata } = q.data;
    const sincrona = s.modo !== 'assincrona';
    const ativa = s.situacao === 'rascunho' || s.situacao === 'publicada';
    const pode = gere && ativa;
    const pautados = pauta.filter((x) => x.situacao === 'pautado');
    const ids = (ordem || pauta.map((x) => x.processo_id));
    const porId = new Map(pauta.map((x) => [x.processo_id, x]));
    const itens = ids.map((i) => porId.get(i)).filter(Boolean);
    const cedo = s.situacao === 'rascunho' && minima && s.data < minima;
    const acao = async (nome, extra, ok) => {
        setIndo(true);
        try { await secProcesso(orgId, nome, { id, ...extra }); toast.success(ok); setDialogo(null); await atualizar(); return true; } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return false; } finally { setIndo(false); }
    };
    const reuniao = s.tipo === 'reuniao';
    // Reunião (S9): a ordem dos assuntos.
    const moverAssunto = async (de, para) => {
        const nova = (q.data.assuntos || []).map((a) => a.id);
        nova.splice(para, 0, nova.splice(de, 1)[0]);
        try { await secProcesso(orgId, 'reuniaoOrdenar', { id, ordem: nova }); await qc.invalidateQueries({ queryKey: chave }); } catch (e) { toast.error(e?.message || 'Não foi possível mudar a ordem'); }
    };
    const mover = async (de, para) => {
        const nova = [...ids];
        nova.splice(para, 0, nova.splice(de, 1)[0]);
        setOrdem(nova);
        try { await secProcesso(orgId, 'sessaoOrdenar', { id, ordem: nova }); await qc.invalidateQueries({ queryKey: chave }); } catch (e) { toast.error(e?.message || 'Não foi possível mudar a ordem'); } finally { setOrdem(null); }
    };
    const tirar = (x) => (s.situacao === 'rascunho' ? acao('sessaoTirar', { processo_id: x.processo_id }, `${x.numero} saiu do rascunho da pauta`) : setDialogo({ tirar: x }));
    const linha = (x, i, alca) => {
        const fora = x.situacao !== 'pautado';
        const suspenso = x.situacao === 'vista';
        const chamado = s.em_julgamento === x.processo_id && !fora && !x.julgado;
        return (
            <div className={`flex gap-2 p-3 ${fora ? 'opacity-70' : ''} ${chamado ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''}`}>
                {pode && !fora && !x.julgado ? alca : <span className="w-6 shrink-0" aria-hidden />}
                <span className="w-7 shrink-0 text-right font-semibold text-slate-500 dark:text-slate-400 pt-0.5">{i + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                        {x.pode_abrir ? (
                            <button type="button" className="font-mono text-indigo-700 dark:text-indigo-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded" onClick={() => onAbrir(x.processo_id)}>{x.numero}</button>
                        ) : <span className="font-mono text-slate-800 dark:text-slate-200">{x.numero}</span>}
                        <span className={`font-medium text-slate-900 dark:text-white ${x.situacao === 'retirado' ? 'line-through' : ''}`}>{x.assunto}</span>
                        {x.urgente && <SeloUrgente />}
                        {x.inclusao !== 'pauta' && <Badge variant="outline" className="border-amber-300 text-amber-900 dark:border-amber-800 dark:text-amber-200">{INCLUSAO[x.inclusao]}</Badge>}
                        {x.julgado && <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Julgado</Badge>}
                        {chamado && <Badge className="bg-indigo-600 hover:bg-indigo-600 gap-1"><Radio className="w-3.5 h-3.5" aria-hidden /> Em julgamento agora</Badge>}
                        {fora && <Badge variant="outline" className={suspenso ? 'border-violet-300 text-violet-900 dark:border-violet-800 dark:text-violet-200' : ''}>{SITUACAO_ITEM[x.situacao]}</Badge>}
                        {x.minha_anotacao && <Badge variant="outline" className="gap-1" title="Só você vê"><NotebookPen className="w-3.5 h-3.5" aria-hidden /> Sua anotação</Badge>}
                        {!fora && selosDosPedidos(x.pedidos).map((t) => <Badge key={t} variant="outline" className="border-sky-300 text-sky-900 dark:border-sky-800 dark:text-sky-200">{t}</Badge>)}
                        {!fora && gere && x.pedidos?.a_decidir > 0 && <Badge className="bg-amber-600 hover:bg-amber-600">{x.pedidos.a_decidir === 1 ? '1 pedido a decidir' : `${x.pedidos.a_decidir} pedidos a decidir`}</Badge>}
                    </div>
                    {x.partes?.length > 0 && <p className="text-slate-700 dark:text-slate-300"><Users className="inline w-3.5 h-3.5 -mt-0.5 mr-1" aria-hidden />{x.partes.map((p) => `${p.nome} (${POLOS[p.polo] || p.polo})`).join('; ')}</p>}
                    {x.motivo && <p className="text-xs text-slate-600 dark:text-slate-400">{ROTULO_MOTIVO[x.situacao] || 'Motivo da inclusão'}: {x.motivo}</p>}
                    {x.vista && <p className="text-xs text-violet-900 dark:text-violet-200">{textoDaVistaNaPauta(x.vista)}</p>}
                    {x.acordao && (
                        <p className={`text-xs flex items-center gap-1 ${x.acordao.sou_redator && !x.acordao.enviado ? 'font-semibold text-amber-800 dark:text-amber-200' : 'text-slate-700 dark:text-slate-300'}`}>
                            <ScrollText className="w-3.5 h-3.5 shrink-0" aria-hidden />
                            {x.acordao.juntado ? 'Acórdão juntado aos autos.' : x.acordao.enviado ? `Acórdão de ${x.acordao.redator_nome} enviado à unidade, para juntar aos autos.`
                                : x.acordao.sou_redator ? `Você redige o acórdão, até ${br(x.acordao.prazo)}.` : `Acórdão a cargo de ${x.acordao.redator_nome}, até ${br(x.acordao.prazo)}.`}
                        </p>
                    )}
                    {(!fora || suspenso) && s.situacao !== 'cancelada' && (x.relator_nome || (gere && !x.julgado)) && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>{x.relator_nome ? `Relator: ${x.relator_nome}` : 'Sem relator designado'}</span>
                            {situacaoDaVotacao(x) && <span className={x.votacao?.aguarda_meu_voto ? 'font-semibold text-amber-800 dark:text-amber-200' : x.votacao?.proclamado ? 'font-semibold text-emerald-800 dark:text-emerald-200' : ''}>· {situacaoDaVotacao(x)}</span>}
                        </p>
                    )}
                    {x.problema && <p className="text-xs text-amber-800 dark:text-amber-200 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /> O processo {x.problema}. Retire da pauta ou acerte o processo antes de {s.situacao === 'rascunho' ? 'publicar' : 'julgar'}.</p>}
                </div>
                {podeS8.chamar && !fora && !x.julgado && !chamado && (
                    <Button size="sm" variant="ghost" className="shrink-0 gap-1 self-start" disabled={indo} aria-label={`Chamar ${x.numero} para julgamento`}
                        onClick={() => acao('sessaoChamar', { processo_id: x.processo_id }, `${x.numero} chamado: o painel mostra o processo em julgamento`)}>
                        <Megaphone className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Chamar</span>
                    </Button>
                )}
                {(!fora || suspenso) && s.situacao !== 'cancelada' && (gere || x.votacao?.liberado || x.votacao?.sou_relator || x.votacao?.proclamado) && (
                    <Button size="sm" variant={x.votacao?.aguarda_meu_voto || (x.votacao?.sou_relator && !x.votacao?.liberado) ? 'default' : 'outline'} className="shrink-0 gap-1 self-start"
                        aria-label={`Julgamento de ${x.numero}`} onClick={() => setDialogo({ votacao: x.processo_id })}>
                        <Gavel className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Julgamento</span>
                    </Button>
                )}
                {pode && !fora && !x.julgado && (
                    <Button size="icon" variant="ghost" className="shrink-0 text-rose-700 dark:text-rose-300" aria-label={`Tirar ${x.numero} da pauta`} disabled={indo} onClick={() => tirar(x)}><Trash2 className="w-4 h-4" aria-hidden /></Button>
                )}
            </div>
        );
    };
    return (
        <div className="space-y-4 pt-2">
            <Button variant="ghost" className="gap-2 -ml-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" aria-hidden /> Voltar às sessões</Button>
            <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">{s.titulo} <Situacao s={s.situacao} /></h2>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{reuniao ? 'Reunião deliberativa · ' : ''}{colegiado.nome} · {CARATER_SESSAO.find(([v]) => v === s.carater)?.[1]}</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 flex items-start gap-1.5"><CalendarDays className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {quandoSessao(s)}</p>
                        {s.modo === 'assincrona' && <AvisoVirtual s={s} reuniao={reuniao} pode={(gere || s.preside) && s.situacao === 'publicada'} indo={indo} onApurar={() => acao('sessaoEncerrar', {}, reuniao ? 'Votação apurada e reunião encerrada.' : 'Votação apurada e sessão encerrada.')} />}
                        {s.link && s.modo !== 'presencial' && /^https:\/\//.test(s.link) && (
                            <a href={s.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm text-indigo-700 dark:text-indigo-300 underline">Entrar na sala virtual <ExternalLink className="w-3.5 h-3.5" aria-hidden /></a>
                        )}
                        {diaUtil === false && ativa && <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> A data cai em fim de semana, feriado ou recesso do órgão.</p>}
                        {s.publicada_em && <p className="text-xs text-slate-600 dark:text-slate-400">{reuniao ? 'Convocada em' : 'Pauta publicada em'} {new Date(s.publicada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{s.publicada_por ? ` por ${s.publicada_por}` : ''}.</p>}
                        {s.situacao === 'cancelada' && <p className="text-sm text-rose-800 dark:text-rose-200">Cancelada{s.motivo_cancelamento ? `: ${s.motivo_cancelamento}` : ''}.</p>}
                        {s.situacao === 'encerrada' && sincrona && <p className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-1"><CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> {reuniao ? 'Reunião encerrada' : 'Sessão encerrada'}{s.encerrada_em ? ` em ${new Date(s.encerrada_em).toLocaleDateString('pt-BR')}` : ''}{s.encerrada_por ? ` por ${s.encerrada_por}` : ''}.</p>}
                        {s.observacoes && <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{s.observacoes}</p>}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                        {(s.situacao === 'publicada' || (painel && s.situacao === 'encerrada')) && (
                            <div className="flex flex-wrap gap-2">
                                {s.situacao === 'publicada' && <BotaoAgenda s={s} colegiado={colegiado.nome} />}
                                {painel && <Button variant="outline" size="sm" className="gap-1" onClick={() => setTelao(true)}><MonitorPlay className="w-4 h-4" aria-hidden /> Painel ao vivo</Button>}
                                {podeS8.encerrar && sincrona && <Button size="sm" className="gap-1" onClick={() => setDialogo('encerrar')}><Flag className="w-4 h-4" aria-hidden /> {reuniao ? 'Encerrar reunião' : 'Encerrar sessão'}</Button>}
                            </div>
                        )}
                        {pode && (
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="gap-1" onClick={() => setDialogo('editar')}><Pencil className="w-4 h-4" aria-hidden /> {reuniao ? 'Dados da reunião' : 'Dados da sessão'}</Button>
                                {!reuniao && <Button variant="outline" size="sm" className="gap-1" onClick={() => setDialogo('incluir')}><Plus className="w-4 h-4" aria-hidden /> Incluir processos</Button>}
                                {s.situacao === 'rascunho' && <Button size="sm" className="gap-1" disabled={(reuniao ? !(q.data.assuntos || []).length : !pautados.length) || cedo} onClick={() => setDialogo('publicar')}><Send className="w-4 h-4" aria-hidden /> {reuniao ? 'Convocar' : 'Publicar pauta'}</Button>}
                                <Button variant="ghost" size="sm" className="gap-1 text-rose-700 dark:text-rose-300" onClick={() => setDialogo('cancelar')}><Ban className="w-4 h-4" aria-hidden /> {reuniao ? 'Cancelar reunião' : 'Cancelar sessão'}</Button>
                            </div>
                        )}
                    </div>
                </div>
                {gere && s.situacao === 'rascunho' && (
                    <p className={`text-sm rounded-md p-2 ${cedo ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100' : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`} role={cedo ? 'alert' : undefined}>
                        {textoAntecedencia(colegiado.pauta) || 'O colegiado não pede antecedência mínima para a pauta.'}{' '}
                        {cedo ? `Publicada hoje, a sessão só pode ser a partir de ${br(minima)}: mude a data da sessão.` : 'Rascunho: só a secretaria vê esta pauta, e ninguém foi avisado ainda.'}
                    </p>
                )}
            </section>

            {podeS8.presenca && presenca && <PresencaSessao key={JSON.stringify(presenca.marcas)} presenca={presenca} reuniao={reuniao} indo={indo} onSalvar={(presencas) => acao('sessaoPresenca', { presencas }, 'Presença registrada: vai para a ata')} />}
            <AtaDaSessao ata={ata} pode={podeS8} indo={indo} acao={acao} reuniao={reuniao} />

            {reuniao && <PautaReuniao q={q.data} acao={acao} indo={indo} mover={moverAssunto} />}
            {!reuniao && <section className="space-y-2" aria-label="Ordem do dia">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ordem do dia{pautados.length ? ` (${pautados.length})` : ''}</h3>
                    {pode && pautados.length > 1 && (
                        <Button variant="outline" size="sm" className="gap-1" disabled={indo} title="Primeiro os processos com sustentação oral, depois os com preferência, os que começaram em sessão anterior e os demais"
                            onClick={() => acao('sessaoOrdenar', { ordem: ordemDoCPC(pauta) }, 'Ordem do dia arrumada como no CPC, art. 936')}>
                            <ListOrdered className="w-4 h-4" aria-hidden /> Ordem do CPC
                        </Button>
                    )}
                </div>
                {!gere && itens.some((x) => x.pode_abrir) && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">Toque no número para ler os autos e fazer suas anotações. Quem compõe o colegiado lê enquanto o processo está pautado, e cada leitura fica registrada.</p>
                )}
                {!itens.length && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4">
                        Nenhum processo na pauta. {pode ? 'Use Incluir processos: aparecem os que estão em unidade do colegiado com o julgamento pendente na fase.' : ''}
                    </p>
                )}
                {itens.length > 0 && (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                        {pode ? (
                            <ListaOrdenavel ids={ids} nome={(i) => porId.get(i)?.numero || 'processo'} onMover={mover}>
                                {itens.map((x, i) => <ItemOrdenavel key={x.processo_id} id={x.processo_id} rotulo={`Mudar a posição de ${x.numero}`}>{({ alca }) => linha(x, i, alca)}</ItemOrdenavel>)}
                            </ListaOrdenavel>
                        ) : itens.map((x, i) => <div key={x.processo_id}>{linha(x, i, null)}</div>)}
                    </div>
                )}
            </section>}

            {dialogo === 'editar' && <FormSessao orgId={orgId} colegiados={[{ id: s.orgao_id, nome: colegiado.nome, pauta: colegiado.pauta }]} sessao={s} hoje={hoje} onFechar={() => setDialogo(null)} onSalvo={async () => { setDialogo(null); await atualizar(); }} />}
            {dialogo?.votacao && <VotacaoSessao orgId={orgId} sessaoId={id} processoId={dialogo.votacao} onFechar={() => setDialogo(null)} onMudou={atualizar} />}
            {dialogo === 'incluir' &&<IncluirProcessos orgId={orgId} sessao={s} pautados={new Set(pautados.map((x) => x.processo_id))} onFechar={() => setDialogo(null)} onIncluido={atualizar} />}
            {dialogo === 'publicar' && (
                <Dialog open onOpenChange={(o) => !o && setDialogo(null)}>
                    <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>{reuniao ? 'Convocar a reunião?' : 'Publicar a pauta?'}</DialogTitle>
                            <DialogDescription>
                                {reuniao ? 'Quem compõe o colegiado é avisado (sino e e-mail, pela preferência de cada um) e passa a ver a pauta. Depois disso, data, hora e local não mudam; assunto novo entra como extrapauta, com o motivo.' : null}
                                {!reuniao && `${pautados.length === 1 ? 'O processo recebe' : `Os ${pautados.length} processos recebem`} a certidão de inclusão em pauta nos autos, com a data, a hora e o local da sessão, e as partes com acesso ao portal são avisadas por e-mail. Quem compõe o colegiado passa a ver a sessão. Depois disso, data, hora e local não mudam: para mudar, é preciso cancelar a sessão.`}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setDialogo(null)}>Voltar</Button>
                            <Button disabled={indo} onClick={() => acao('sessaoPublicar', {}, reuniao ? 'Reunião convocada. A composição foi avisada.' : 'Pauta publicada. As certidões foram aos autos e as partes foram avisadas.')}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{reuniao ? 'Convocar' : 'Publicar'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            {telao && (reuniao ? <PainelReuniao painel={painel} onFechar={() => setTelao(false)} /> : <PainelAoVivo painel={painel} onFechar={() => setTelao(false)} />)}
            {dialogo === 'encerrar' && (
                <Dialog open onOpenChange={(o) => !o && setDialogo(null)}>
                    <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>{reuniao ? 'Encerrar a reunião?' : 'Encerrar a sessão?'}</DialogTitle>
                            <DialogDescription>
                                {reuniao ? 'O assunto ainda não deliberado (sem votação apurada, ou empatado sem o voto de qualidade) fica adiado, para trazer a outra reunião. ' : pautados.length
                                    ? `${pautados.length === 1 ? 'O processo ainda pautado, sem resultado proclamado, é adiado' : `Os ${pautados.length} processos ainda pautados, sem resultado proclamado, são adiados`} para a sessão seguinte, com os votos já dados, e recebem a certidão nos autos. `
                                    : 'Todos os processos da pauta já tiveram desfecho. '}
                                O sistema lavra a ata com a presença e o que aconteceu com cada {reuniao ? 'assunto (falas, votos e encaminhamentos)' : 'processo'}, para a secretaria conferir e o presidente e a secretaria assinarem.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setDialogo(null)}>Voltar</Button>
                            <Button disabled={indo} onClick={() => acao('sessaoEncerrar', {}, `${reuniao ? 'Reunião encerrada' : 'Sessão encerrada'}. A ata está pronta para conferir e assinar.`)}>{indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Encerrar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            {dialogo === 'cancelar' && (
                <DialogoMotivo titulo={reuniao ? 'Cancelar a reunião?' : 'Cancelar a sessão?'} perigo acao={reuniao ? 'Cancelar reunião' : 'Cancelar sessão'} onFechar={() => setDialogo(null)}
                    descricao={reuniao ? (s.situacao === 'publicada' ? 'A composição é avisada do cancelamento, com o motivo. A reunião fica na lista como cancelada.' : 'É só um rascunho: ninguém foi avisado.') : s.situacao === 'publicada' ?'Cada processo pautado recebe a certidão de retirada de pauta, com o motivo, e as partes são avisadas. A sessão fica na lista como cancelada.' : 'É só um rascunho: ninguém foi avisado, e nada vai aos autos.'}
                    onConfirmar={(motivo) => acao('sessaoCancelar', { motivo }, 'Sessão cancelada')} />
            )}
            {dialogo?.tirar && (
                <DialogoMotivo titulo={`Retirar ${dialogo.tirar.numero} da pauta?`} acao="Retirar da pauta" onFechar={() => setDialogo(null)}
                    descricao="O processo recebe a certidão de retirada de pauta, com o motivo, e as partes são avisadas. Ele volta a aparecer entre os aptos para outra sessão."
                    onConfirmar={(motivo) => acao('sessaoTirar', { processo_id: dialogo.tirar.processo_id, motivo }, `${dialogo.tirar.numero} retirado da pauta`)} />
            )}
        </div>
    );
}
