import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Clock, FolderOpen, Loader2, PauseCircle, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { secProcesso } from '@/services/secretariaService';
import { rotuloUnidade } from './comum';

const hojeBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somar = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dias = (desdeIso) => Math.max(0, Math.floor((Date.now() - new Date(desdeIso).getTime()) / 86400000));
const br = (iso) => iso.split('-').reverse().join('/');

/**
 * Painel da Secretaria: volume, gargalos e o que vence. Calculado sobre os
 * processos que a pessoa pode ver (mesma lista da aba Todos), com filtro por
 * unidade para a visão da secretaria ou do gabinete.
 */
export default function PainelSecretaria({ orgId, estado, onAbrir }) {
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'todos'], queryFn: () => secProcesso(orgId, 'listar', { escopo: 'todos' }) });
    const [unidade, setUnidade] = useState(estado.minhasUnidades.length === 1 ? estado.minhasUnidades[0] : '');
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || '—';

    const m = useMemo(() => {
        const hoje = hojeBR();
        const semana = somar(hoje, 7);
        const todos = (q.data?.processos || []).filter((p) => !unidade || p.unidade_atual === unidade);
        const ativos = todos.filter((p) => p.status === 'em_tramitacao');
        const contar = (lista, chave) => Object.entries(lista.reduce((acc, p) => ({ ...acc, [chave(p)]: (acc[chave(p)] || 0) + 1 }), {}))
            .sort((a, b) => b[1] - a[1]);
        return {
            ativos: ativos.length,
            sobrestados: todos.filter((p) => p.status === 'sobrestado').length,
            arquivados: todos.filter((p) => p.status === 'arquivado').length,
            comPendencia: ativos.filter((p) => p.pendencias_abertas > 0).length,
            vencidos: ativos.filter((p) => p.proximo_vencimento && p.proximo_vencimento < hoje),
            semana: ativos.filter((p) => p.proximo_vencimento && p.proximo_vencimento >= hoje && p.proximo_vencimento <= semana),
            porUnidade: contar(ativos, (p) => nomeUnidade(p.unidade_atual)),
            porFase: contar(ativos, (p) => p.fase_nome || '—').slice(0, 10),
            porTipo: contar(ativos, (p) => p.tipo_nome || 'Sem tipo').slice(0, 10),
            pendentes: ativos.filter((p) => p.pendencia_desde).sort((a, b) => a.pendencia_desde.localeCompare(b.pendencia_desde)).slice(0, 8),
            idadeMedia: ativos.length ? Math.round(ativos.reduce((s, p) => s + (p.autuado_em ? dias(p.autuado_em) : 0), 0) / ativos.length) : 0,
            hoje,
        };
    }, [q.data, unidade]);

    if (q.isLoading) return <div className="py-8 text-slate-500 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <div className="py-8 text-red-600">{q.error.message}</div>;

    const kpis = [
        { rotulo: 'Em tramitação', valor: m.ativos, icone: FolderOpen, cor: 'text-indigo-600 dark:text-indigo-400' },
        { rotulo: 'Com pendência para o decisor', valor: m.comPendencia, icone: AlertTriangle, cor: 'text-amber-600 dark:text-amber-400' },
        { rotulo: 'Prazos vencidos', valor: m.vencidos.length, icone: Clock, cor: 'text-red-600 dark:text-red-400' },
        { rotulo: 'Prazos em 7 dias', valor: m.semana.length, icone: CalendarClock, cor: 'text-sky-600 dark:text-sky-400' },
        { rotulo: 'Sobrestados', valor: m.sobrestados, icone: PauseCircle, cor: 'text-slate-500' },
        { rotulo: 'Arquivados', valor: m.arquivados, icone: Archive, cor: 'text-slate-500' },
    ];

    return (
        <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center gap-3 justify-between">
                <select aria-label="Unidade do painel" value={unidade} onChange={(e) => setUnidade(e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                    <option value="">Todas as unidades</option>
                    {estado.unidades.filter((u) => u.ativa).map((u) => <option key={u.id} value={u.id}>{u.nome} ({rotuloUnidade(u.tipo).toLowerCase()})</option>)}
                </select>
                <p className="text-sm text-slate-500 dark:text-slate-400">Idade média dos processos em tramitação: {m.idadeMedia} dias</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {kpis.map(({ rotulo, valor, icone: Icone, cor }) => (
                    <div key={rotulo} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                        <Icone className={`w-4 h-4 ${cor}`} aria-hidden="true" />
                        <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{valor}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</p>
                    </div>
                ))}
            </div>
            <div className="grid lg:grid-cols-3 gap-4 [&>*]:min-w-0">
                <Barras titulo="Em tramitação por unidade" dados={m.porUnidade} />
                <Barras titulo="Por fase" dados={m.porFase} />
                <Barras titulo="Por tipo de processo" dados={m.porTipo} />
            </div>
            <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Pendências mais antigas</CardTitle></CardHeader>
                    <CardContent>
                        {m.pendentes.length === 0 ? <p className="text-sm text-slate-500">Nenhuma pendência aberta.</p> : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {m.pendentes.map((p) => (
                                    <li key={p.id}>
                                        <button onClick={() => onAbrir(p.id)} className="w-full text-left py-2 flex items-baseline gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1">
                                            <span className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{p.numero}</span>
                                            <span className="flex-1 min-w-0 truncate text-sm">{p.assunto}</span>
                                            <span className={`text-xs tabular-nums ${dias(p.pendencia_desde) > 10 ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-500'}`}>há {dias(p.pendencia_desde)} dia(s)</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Prazos vencidos e da semana</CardTitle></CardHeader>
                    <CardContent>
                        {m.vencidos.length + m.semana.length === 0 ? <p className="text-sm text-slate-500">Nenhum prazo vencido ou para os próximos 7 dias.</p> : (
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {[...m.vencidos, ...m.semana].sort((a, b) => a.proximo_vencimento.localeCompare(b.proximo_vencimento)).slice(0, 10).map((p) => (
                                    <li key={p.id}>
                                        <button onClick={() => onAbrir(p.id)} className="w-full text-left py-2 flex items-baseline gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1">
                                            <span className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{p.numero}</span>
                                            <span className="flex-1 min-w-0 truncate text-sm">{p.assunto}</span>
                                            <span className={`text-xs tabular-nums ${p.proximo_vencimento < m.hoje ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-500'}`}>
                                                {p.proximo_vencimento < m.hoje ? 'venceu' : 'vence'} {br(p.proximo_vencimento)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Barras({ titulo, dados }) {
    const max = Math.max(1, ...dados.map(([, v]) => v));
    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
            <CardContent>
                {dados.length === 0 ? <p className="text-sm text-slate-500">Sem processos em tramitação.</p> : (
                    <ul className="space-y-2">
                        {dados.map(([nome, v]) => (
                            <li key={nome} className="text-sm">
                                <div className="flex justify-between gap-2"><span className="truncate">{nome}</span><span className="tabular-nums text-slate-500">{v}</span></div>
                                <div className="mt-1 h-2 rounded bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                                    <div className="h-2 rounded bg-indigo-500 dark:bg-indigo-400" style={{ width: `${(v / max) * 100}%` }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
