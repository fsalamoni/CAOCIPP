import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, BellRing, CalendarClock, CheckCircle2, Eye, Hourglass, Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createPageUrl } from '@/utils';
import { secPortal } from '@/services/secretariaService';
import { STATUS_ROTULO, SeloUrgente, dataHora } from '@/components/secretaria/comum';

// Planilha dos processos em que a pessoa é parte ou representante. O que ela
// faz como membro de um órgão fica na página do órgão, não aqui. Cada linha
// diz o que fazer agora; a cor (com ícone e texto) indica prazo vencido,
// prazo aberto ou prazo por abrir (comunicação aguardando ciência).

const brData = (iso) => (iso || '').split('-').reverse().join('/');
const dias = (iso, hoje) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${hoje}T12:00:00`)) / 86400000);

export const SITUACOES = {
    vencido: { rotulo: 'Prazo vencido', icone: AlertTriangle, selo: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100', borda: 'border-l-red-500' },
    ciencia: { rotulo: 'Prazo por abrir', icone: BellRing, selo: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100', borda: 'border-l-sky-500' },
    prazo: { rotulo: 'Prazo aberto', icone: CalendarClock, selo: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100', borda: 'border-l-amber-500' },
    apreciacao: { rotulo: 'Aguardando o órgão', icone: Hourglass, selo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200', borda: 'border-l-slate-300 dark:border-l-slate-600' },
    acompanhar: { rotulo: 'Sem pendência', icone: Eye, selo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200', borda: 'border-l-slate-300 dark:border-l-slate-600' },
    encerrado: { rotulo: 'Arquivado', icone: CheckCircle2, selo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', borda: 'border-l-slate-200 dark:border-l-slate-700' },
};
const FILTROS = [['todos', 'Todos'], ['vencido', 'Prazo vencido'], ['ciencia', 'Prazo por abrir'], ['prazo', 'Prazo aberto'], ['outros', 'Sem pendência']];
const noFiltro = (p, f) => f === 'todos' || (f === 'outros' ? !['vencido', 'ciencia', 'prazo'].includes(p.situacao) : p.situacao === f);

function Selo({ situacao }) {
    const s = SITUACOES[situacao] || SITUACOES.acompanhar;
    return <Badge className={`gap-1 font-normal whitespace-nowrap hover:bg-transparent ${s.selo}`}><s.icone className="w-3 h-3" aria-hidden /> {s.rotulo}</Badge>;
}

/** Data que importa na linha, com a contagem de dias. */
function Quando({ p, hoje }) {
    if (!p.data) return <span className="text-slate-500">—</span>;
    const n = dias(p.data, hoje);
    const quanto = n < 0 ? `há ${-n} dia${n === -1 ? '' : 's'}` : n === 0 ? 'hoje' : `em ${n} dia${n === 1 ? '' : 's'}`;
    return (
        <span className="whitespace-nowrap">
            <span className="font-medium">{brData(p.data)}</span>
            <span className={`block text-xs ${n < 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400'}`}>{p.situacao === 'ciencia' ? `ciência ${quanto}` : quanto}</span>
        </span>
    );
}

const posicao = (p) => (p.como === 'representante' ? `Representante de ${p.parte_nome} (${p.polo})` : `${p.parte_nome || 'Parte'} (${p.polo})`);

export default function MeusProcessosEletronicos() {
    const q = useQuery({ queryKey: ['portal-processos'], queryFn: () => secPortal('meusProcessos') });
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('todos');
    const [orgao, setOrgao] = useState('');

    const lista = useMemo(() => [...(q.data?.processos || [])].sort((a, b) =>
        (a.prioridade - b.prioridade) || String(a.data || '9').localeCompare(String(b.data || '9')) || Number(b.urgente) - Number(a.urgente)
        || String(b.ultimo_movimento?.em || '').localeCompare(String(a.ultimo_movimento?.em || ''))), [q.data]);

    if (q.isLoading) return <div className="py-10 flex gap-2 items-center text-slate-600" role="status"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando seus processos…</div>;
    if (q.error) return <p role="alert" className="text-red-700 dark:text-red-400">{q.error.message} <Button variant="link" size="sm" className="gap-1 px-1" onClick={() => q.refetch()}><RefreshCw className="w-3 h-3" aria-hidden /> Tentar de novo</Button></p>;

    const hoje = q.data.hoje;
    const orgaos = [...new Set(lista.map((p) => p.orgao))];
    const termo = busca.trim().toLowerCase();
    const visiveis = lista
        .filter((p) => noFiltro(p, filtro))
        .filter((p) => !orgao || p.orgao === orgao)
        .filter((p) => !termo || `${p.numero} ${p.assunto} ${p.orgao} ${p.tipo_nome || ''} ${p.parte_nome || ''} ${p.fase_nome}`.toLowerCase().includes(termo));
    const abrir = (p) => `${createPageUrl('Portal')}?p=${p.id}`;

    return (
        <div className="max-w-7xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Meus Processos Eletrônicos</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Processos em que você é parte ou representante, em qualquer órgão ou entidade. O que você faz como membro de um órgão fica na página do órgão.
                </p>
            </div>

            {lista.length === 0 ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <p>Você não tem processos como parte ou representante no momento.</p>
                    <p>Eles aparecem aqui quando você aceita o convite que a secretaria do órgão ou entidade envia.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por situação">
                        {FILTROS.map(([id, rotulo]) => {
                            const n = lista.filter((p) => noFiltro(p, id)).length;
                            return (
                                <Button key={id} size="sm" variant={filtro === id ? 'default' : 'outline'} aria-pressed={filtro === id} disabled={!n && id !== 'todos'} onClick={() => setFiltro(id)}>
                                    {rotulo} <span className="ml-1.5 tabular-nums opacity-80">{n}</span>
                                </Button>
                            );
                        })}
                        <div className="flex-1" />
                        {orgaos.length > 1 && (
                            <select aria-label="Filtrar por órgão ou entidade" value={orgao} onChange={(e) => setOrgao(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900 max-w-[14rem]">
                                <option value="">Todos os órgãos</option>
                                {orgaos.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        )}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" aria-hidden />
                            <Input className="pl-8 w-64 max-w-full" placeholder="Número, assunto, órgão ou fase" aria-label="Buscar nos meus processos" value={busca} onChange={(e) => setBusca(e.target.value)} />
                        </div>
                    </div>

                    {visiveis.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum processo com esse filtro.</p>}

                    {/* Planilha (telas médias e grandes) */}
                    {visiveis.length > 0 && (
                        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 font-medium">Situação</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Processo e fase</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Órgão e minha posição</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Prazo</th>
                                        <th scope="col" className="px-3 py-2 font-medium">O que fazer agora</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Último andamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {visiveis.map((p) => (
                                        <tr key={p.id} className="align-top">
                                            <td className={`px-3 py-3 border-l-4 ${(SITUACOES[p.situacao] || SITUACOES.acompanhar).borda}`}><Selo situacao={p.situacao} />{p.urgente && <SeloUrgente className="mt-1" />}</td>
                                            <td className="px-3 py-3 min-w-[12rem]">
                                                <Link to={abrir(p)} className="font-mono text-indigo-700 dark:text-indigo-300 hover:underline">{p.numero}</Link>
                                                <span className="block font-medium text-slate-900 dark:text-slate-100">{p.assunto}</span>
                                                <span className="block text-xs text-slate-800 dark:text-slate-200">Fase: {p.fase_nome}</span>
                                                <span className="block text-xs text-slate-600 dark:text-slate-400">{[p.tipo_nome, STATUS_ROTULO[p.status] || p.status, p.autuado_em ? `desde ${dataHora(p.autuado_em).split(',')[0]}` : null].filter(Boolean).join(' · ')}</span>
                                            </td>
                                            <td className="px-3 py-3 min-w-[10rem]">{p.orgao}<span className="block text-xs text-slate-600 dark:text-slate-400">{posicao(p)}</span></td>
                                            <td className="px-3 py-3"><Quando p={p} hoje={hoje} />{p.prazos.length > 1 && <span className="block text-xs text-slate-600 dark:text-slate-400">+{p.prazos.length - 1} prazo{p.prazos.length > 2 ? 's' : ''}</span>}</td>
                                            <td className="px-3 py-3 min-w-[14rem] text-slate-900 dark:text-slate-100">
                                                <span className="block">{p.frase}</span>
                                                <Button asChild size="sm" variant={p.prioridade <= 2 ? 'default' : 'outline'} className="gap-1 mt-2 h-8"><Link to={abrir(p)} aria-label={`Abrir o processo ${p.numero}`}>{p.situacao === 'ciencia' ? 'Dar ciência' : p.prioridade <= 2 ? 'Responder' : 'Abrir'} <ArrowUpRight className="w-3.5 h-3.5" aria-hidden /></Link></Button>
                                            </td>
                                            <td className="px-3 py-3 min-w-[10rem] max-w-[16rem] text-xs text-slate-600 dark:text-slate-400">
                                                {p.ultimo_movimento ? <><span className="block">{dataHora(p.ultimo_movimento.em)}{p.novidades && <Badge className="ml-1 bg-indigo-600 hover:bg-indigo-600">Novo</Badge>}</span><span className="line-clamp-2">{p.ultimo_movimento.descricao}</span></> : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Cartões (celular) */}
                    <ul className="md:hidden space-y-3">
                        {visiveis.map((p) => (
                            <li key={p.id}>
                                <Link to={abrir(p)} className={`block rounded-lg border border-l-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5 ${(SITUACOES[p.situacao] || SITUACOES.acompanhar).borda}`}>
                                    <span className="flex flex-wrap items-center gap-2"><Selo situacao={p.situacao} />{p.urgente && <SeloUrgente />}<span className="font-mono text-sm">{p.numero}</span></span>
                                    <span className="block font-medium">{p.assunto}</span>
                                    <span className="block text-sm text-slate-900 dark:text-slate-100">{p.frase}</span>
                                    <span className="block text-xs text-slate-600 dark:text-slate-400">{p.orgao} · {posicao(p)} · fase: {p.fase_nome}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        <b>Prazo vencido</b> (vermelho): passou da data, manifeste-se. <b>Prazo por abrir</b> (azul): há intimação ou outra comunicação aguardando a sua ciência; o prazo começa quando você a der. <b>Prazo aberto</b> (âmbar): está correndo. Os demais não pedem nada de você agora.
                    </p>
                </>
            )}
        </div>
    );
}
