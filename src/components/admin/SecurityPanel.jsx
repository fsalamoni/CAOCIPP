import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Loader2, AlertCircle, RefreshCw, ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle, CheckCircle2,
    ArrowRight, Download, KeyRound, MailCheck, MailWarning, Clock, UserX, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformSecurity } from '@/services/platformService';
import { ESTADOS, ordenarItens, faixaPontuacao, OPCOES_ACAO, rotuloAcao, resumoDetalhes, diasDesde } from '@/lib/platformSecurity';
import { exportTableToCsv, dateSuffix } from '@/lib/jurimetriaExport';

const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

const TOM = {
    risco: { icone: ShieldAlert, caixa: 'border-red-200 dark:border-red-900/60', selo: 'bg-red-100 text-red-950 dark:bg-red-950/60 dark:text-red-200', cor: 'text-red-600 dark:text-red-400' },
    atencao: { icone: AlertTriangle, caixa: 'border-amber-200 dark:border-amber-900/60', selo: 'bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200', cor: 'text-amber-600 dark:text-amber-400' },
    desconhecido: { icone: HelpCircle, caixa: 'border-slate-200 dark:border-slate-800', selo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200', cor: 'text-slate-500 dark:text-slate-400' },
    ok: { icone: CheckCircle2, caixa: 'border-slate-200 dark:border-slate-800', selo: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200', cor: 'text-emerald-600 dark:text-emerald-400' },
};

const linkSecao = 'inline-flex items-center gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

function Pontuacao({ valor, itens, geradoEm, onAtualizar, atualizando }) {
    const faixa = faixaPontuacao(valor);
    const conta = (e) => itens.filter((i) => i.estado === e).length;
    const raio = 34;
    const volta = 2 * Math.PI * raio;
    return (
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative w-24 h-24 shrink-0" role="img" aria-label={`Pontuação de segurança: ${valor} de 100`}>
                <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90" aria-hidden>
                    <circle cx="40" cy="40" r={raio} strokeWidth="8" className="fill-none stroke-slate-100 dark:stroke-slate-800" />
                    <circle
                        cx="40" cy="40" r={raio} strokeWidth="8" strokeLinecap="round" strokeDasharray={volta} strokeDashoffset={volta * (1 - valor / 100)}
                        className={`fill-none ${faixa.tom === 'ok' ? 'stroke-emerald-500' : faixa.tom === 'atencao' ? 'stroke-amber-500' : 'stroke-red-500'}`}
                    />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{valor}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">de 100</span>
                </span>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">{faixa.frase}</p>
                <ul className="flex flex-wrap gap-2 text-sm" aria-label="Resumo do checklist">
                    {['risco', 'atencao', 'desconhecido', 'ok'].map((e) => conta(e) > 0 && (
                        <li key={e} className={`rounded-full px-2.5 py-0.5 font-medium ${TOM[e].selo}`}>{conta(e)} {ESTADOS[e].rotulo.toLowerCase()}</li>
                    ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400">Conferido em {fmtData(geradoEm)}. Itens não verificados ficam fora da conta.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onAtualizar} disabled={atualizando} className="gap-1.5 self-start sm:self-center">
                <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} aria-hidden />Conferir de novo
            </Button>
        </section>
    );
}

function ItemChecklist({ item, onConfirmar, confirmando }) {
    const t = TOM[item.estado] || TOM.desconhecido;
    const Icone = t.icone;
    return (
        <li className={`bg-white dark:bg-slate-900 rounded-lg border ${t.caixa} p-4 flex gap-3`}>
            <Icone className={`w-5 h-5 mt-0.5 shrink-0 ${t.cor}`} aria-hidden />
            <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">{item.titulo}</h4>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${t.selo}`}>{ESTADOS[item.estado]?.rotulo}</span>
                    {item.manual && <span className="text-xs text-slate-500 dark:text-slate-400">conferido no console</span>}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200">{item.detalhe}</p>
                {item.acao && <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">O que fazer:</span> {item.acao}</p>}
                {item.confirmado && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Confirmado por {item.confirmado.por || 'administração'}{item.confirmado.em ? ` em ${fmtData(item.confirmado.em)}` : ''}.</p>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    {item.secao && item.estado !== 'ok' && (
                        <Link to={`/Admin?secao=${item.secao}`} className={linkSecao}>Resolver<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
                    )}
                    {item.manual && (
                        <Button size="sm" variant={item.confirmado ? 'ghost' : 'outline'} disabled={confirmando} onClick={() => onConfirmar(item.key, !item.confirmado)}>
                            {confirmando && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden />}
                            {item.confirmado ? 'Desfazer confirmação' : 'Já está feito no console'}
                        </Button>
                    )}
                </div>
            </div>
        </li>
    );
}

function Acessos({ admins, resumo }) {
    const ativos = admins.filter((a) => a.ativo);
    const retirados = admins.filter((a) => !a.ativo);
    return (
        <section className="space-y-3" aria-labelledby="seg-acessos">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h3 id="seg-acessos" className="font-semibold text-slate-900 dark:text-white">Quem administra a plataforma</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Revise de tempos em tempos: cada pessoa aqui pode tudo no SIGO.</p>
                </div>
                <Link to="/Admin?secao=admins" className={linkSecao}>Conceder ou retirar acesso<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
                {ativos.map((a) => {
                    const dias = diasDesde(a.ultimo_acesso);
                    return (
                        <li key={a.uid} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2 min-w-0">
                            <div className="min-w-0">
                                <Link to={`/Admin?secao=users&pessoa=${encodeURIComponent(a.uid)}`} className="block font-medium text-indigo-700 dark:text-indigo-300 hover:underline truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">{a.nome || a.email || 'Sem nome'}</Link>
                                <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{a.email}</p>
                            </div>
                            <ul className="space-y-1 text-sm">
                                <li className={`flex items-center gap-1.5 ${dias === null || dias > 90 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                    <Clock className="w-4 h-4 shrink-0" aria-hidden />
                                    {dias === null ? 'Nunca entrou' : dias === 0 ? 'Entrou hoje' : `Último login há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                                </li>
                                <li className={`flex items-center gap-1.5 ${a.dois_fatores ? 'text-slate-700 dark:text-slate-200' : 'text-amber-800 dark:text-amber-300'}`}>
                                    <KeyRound className="w-4 h-4 shrink-0" aria-hidden />{a.dois_fatores ? 'Código por e-mail ligado' : 'Sem código por e-mail no login'}
                                </li>
                                <li className={`flex items-center gap-1.5 ${a.email_verificado ? 'text-slate-700 dark:text-slate-200' : 'text-amber-800 dark:text-amber-300'}`}>
                                    {a.email_verificado ? <MailCheck className="w-4 h-4 shrink-0" aria-hidden /> : <MailWarning className="w-4 h-4 shrink-0" aria-hidden />}
                                    {a.email_verificado ? 'E-mail confirmado' : 'E-mail não confirmado'}
                                </li>
                            </ul>
                            {a.concedido_em && <p className="text-xs text-slate-500 dark:text-slate-400">Acesso concedido{a.concedido_por ? ` por ${a.concedido_por}` : ''} em {fmtData(a.concedido_em)}.</p>}
                        </li>
                    );
                })}
            </ul>
            {retirados.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer text-slate-700 dark:text-slate-200 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Acessos retirados ({retirados.length})</summary>
                    <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                        {retirados.map((a) => (
                            <li key={a.uid}>{a.nome || a.email || a.uid}{a.retirado_em ? `: retirado${a.retirado_por ? ` por ${a.retirado_por}` : ''} em ${fmtData(a.retirado_em)}` : ''}</li>
                        ))}
                    </ul>
                </details>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
                <Link to="/Admin?secao=users" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    <UserX className="w-4 h-4" aria-hidden />{resumo?.bloqueados ?? '?'} {resumo?.bloqueados === 1 ? 'pessoa bloqueada' : 'pessoas bloqueadas'}
                </Link>
                <Link to="/Admin?secao=orgs" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    <Building2 className="w-4 h-4" aria-hidden />{resumo?.orgsSuspensos ?? '?'} {resumo?.orgsSuspensos === 1 ? 'órgão suspenso' : 'órgãos suspensos'}
                </Link>
            </div>
        </section>
    );
}

function Auditoria() {
    const [filtro, setFiltro] = useState({ acao: '', de: '', ate: '' });
    const params = {
        acao: filtro.acao || undefined,
        de: filtro.de ? new Date(`${filtro.de}T00:00:00`).toISOString() : undefined,
        ate: filtro.ate ? new Date(`${filtro.ate}T23:59:59`).toISOString() : undefined,
    };
    const q = useInfiniteQuery({
        queryKey: ['platformSecurityAudit', params],
        queryFn: ({ pageParam }) => platformSecurity('auditoria', { ...params, cursor: pageParam || undefined, limite: 50 }),
        initialPageParam: null,
        getNextPageParam: (ultima) => (ultima?.temMais ? ultima.cursor : undefined),
    });
    const itens = (q.data?.pages || []).flatMap((p) => p.itens);

    const exportar = () => exportTableToCsv({
        rows: itens,
        filenameBase: `auditoria-plataforma-${dateSuffix()}`,
        columns: [
            { label: 'Quando', value: (r) => fmtData(r.em) },
            { label: 'Quem', key: 'por' },
            { label: 'Ação', value: (r) => rotuloAcao(r.acao) },
            { label: 'Código da ação', key: 'acao' },
            { label: 'Órgão', key: 'organization_id' },
            { label: 'Detalhes', value: (r) => (r.detalhes ? JSON.stringify(r.detalhes) : '') },
        ],
    });

    return (
        <section className="space-y-3" aria-labelledby="seg-auditoria">
            <div>
                <h3 id="seg-auditoria" className="font-semibold text-slate-900 dark:text-white">Auditoria da administração</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Tudo o que super-admins fizeram na plataforma. O que acontece dentro de cada órgão fica em Movimentações.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="space-y-1 min-w-0 flex-1 sm:flex-none">
                    <Label htmlFor="seg-acao">Ação</Label>
                    <select
                        id="seg-acao" value={filtro.acao} onChange={(e) => setFiltro((f) => ({ ...f, acao: e.target.value }))}
                        className="h-9 w-full sm:w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        <option value="">Todas</option>
                        {OPCOES_ACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="seg-de">De</Label>
                    <Input id="seg-de" type="date" value={filtro.de} onChange={(e) => setFiltro((f) => ({ ...f, de: e.target.value }))} className="w-40" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="seg-ate">Até</Label>
                    <Input id="seg-ate" type="date" value={filtro.ate} onChange={(e) => setFiltro((f) => ({ ...f, ate: e.target.value }))} className="w-40" />
                </div>
                <Button variant="outline" size="sm" onClick={exportar} disabled={!itens.length} className="gap-1.5 sm:ml-auto">
                    <Download className="w-4 h-4" aria-hidden />Exportar {itens.length ? `${itens.length} ` : ''}em CSV
                </Button>
            </div>
            {q.isLoading ? (
                <div role="status" className="flex items-center justify-center py-10 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando auditoria...</div>
            ) : q.error ? (
                <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" aria-hidden />{q.error.message || 'Erro ao carregar a auditoria.'}
                    <Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar de novo</Button>
                </div>
            ) : !itens.length ? (
                <p className="py-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhuma ação encontrada com esses filtros.</p>
            ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    {itens.map((r) => (
                        <li key={r.id} className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-baseline gap-x-4 gap-y-0.5">
                            <time dateTime={r.em || undefined} className="text-xs text-slate-500 dark:text-slate-400 sm:w-32 shrink-0 tabular-nums">{fmtData(r.em)}</time>
                            <div className="min-w-0">
                                <p className="text-sm text-slate-900 dark:text-white"><span className="font-medium">{r.por || 'Alguém'}</span> {rotuloAcao(r.acao).toLowerCase()}</p>
                                {resumoDetalhes(r.detalhes) && <p className="text-xs text-slate-600 dark:text-slate-300 break-words">{resumoDetalhes(r.detalhes)}</p>}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            {q.hasNextPage && (
                <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} className="gap-1.5">
                    {q.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}Carregar mais
                </Button>
            )}
        </section>
    );
}

/** Central de segurança: checklist com pontuação, revisão de acessos e auditoria. */
export default function SecurityPanel() {
    const qc = useQueryClient();
    const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['platformSecurity'], queryFn: () => platformSecurity('painel') });
    const [confirmando, setConfirmando] = useState(null);

    const confirmar = async (item, confirmado) => {
        setConfirmando(item);
        try {
            await platformSecurity('confirmar', { item, confirmado });
            toast.success(confirmado ? 'Item marcado como feito.' : 'Confirmação desfeita.');
            await refetch();
            qc.invalidateQueries({ queryKey: ['platformSecurityAudit'] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar.');
        } finally {
            setConfirmando(null);
        }
    };

    if (isLoading) {
        return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Conferindo a segurança...</div>;
    }
    if (error || !data) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Erro ao conferir a segurança.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Pontuacao valor={data.pontuacao} itens={data.itens} geradoEm={data.geradoEm} onAtualizar={() => refetch()} atualizando={isFetching} />
                <section aria-labelledby="seg-checklist" className="space-y-3">
                    <h3 id="seg-checklist" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />Checklist
                    </h3>
                    <ul className="space-y-3">
                        {ordenarItens(data.itens).map((i) => <ItemChecklist key={i.key} item={i} onConfirmar={confirmar} confirmando={confirmando === i.key} />)}
                    </ul>
                </section>
            </div>
            <Acessos admins={data.admins} resumo={data.resumo} />
            <Auditoria />
        </div>
    );
}
