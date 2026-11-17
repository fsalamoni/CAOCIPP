import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, RefreshCw, Loader2, AlertCircle, Search, ChevronRight, PauseCircle, Gavel, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOrgsReport } from '@/services/platformService';
import OrgDetail from './OrgDetail';

const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILTROS = [
    { key: 'todos', label: 'Todos', ok: () => true },
    { key: 'suspensos', label: 'Suspensos', ok: (o) => o.suspended },
    { key: 'pe', label: 'Com Processo Eletrônico', ok: (o) => o.pe_enabled },
    { key: 'vazios', label: 'Sem registros', ok: (o) => !o.processes_count && !o.expedientes_count },
];

/**
 * Órgãos da plataforma: lista com busca e filtros; um clique abre a ficha
 * (&orgao=<id> no endereço, então o link leva direto a ela).
 */
export default function OrgsPanel() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('todos');
    const aberto = searchParams.get('orgao');

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['platformOrgsReport'],
        queryFn: () => getOrgsReport(500),
    });

    const abrir = (id) => {
        const next = new URLSearchParams(searchParams);
        if (id) next.set('orgao', id); else next.delete('orgao');
        setSearchParams(next);
    };

    const todos = data?.organizations || [];
    const lista = useMemo(() => {
        const f = FILTROS.find((x) => x.key === filtro) || FILTROS[0];
        const termo = semAcento(busca.trim());
        return todos
            .filter(f.ok)
            .filter((o) => !termo || semAcento(o.name).includes(termo) || o.id.toLowerCase().includes(termo))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }, [todos, filtro, busca]);

    if (aberto) return <OrgDetail orgId={aberto} onBack={() => abrir('')} />;

    if (isLoading) {
        return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando órgãos...</div>;
    }
    if (error) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error.message || 'Erro ao carregar órgãos.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    const contagem = (key) => todos.filter(FILTROS.find((x) => x.key === key).ok).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                    <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" placeholder="Buscar órgão pelo nome" aria-label="Buscar órgão pelo nome" />
                </div>
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />Atualizar
                </Button>
            </div>

            <div role="group" aria-label="Filtrar órgãos" className="flex flex-wrap gap-2">
                {FILTROS.map((f) => (
                    <button
                        key={f.key} type="button" onClick={() => setFiltro(f.key)} aria-pressed={filtro === f.key}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${filtro === f.key
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        {f.label} <span className="opacity-80">({contagem(f.key)})</span>
                    </button>
                ))}
            </div>

            {data?.hasMore && (
                <p className="text-sm text-slate-600 dark:text-slate-300">Mostrando {fmtNum(todos.length)} de {fmtNum(data.total)} órgãos.</p>
            )}

            {lista.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <Building2 className="w-8 h-8 text-slate-400" aria-hidden />
                    {todos.length === 0 ? 'Nenhum órgão criado ainda.' : 'Nenhum órgão com esse filtro ou nome.'}
                </div>
            ) : (
                <ul className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {lista.map((o) => (
                        <li key={o.id}>
                            <button
                                type="button" onClick={() => abrir(o.id)}
                                className="group w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                            >
                                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-950">
                                    <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-semibold text-slate-900 dark:text-white break-words">{o.name}</span>
                                        {o.suspended && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"><PauseCircle className="w-3 h-3" aria-hidden />Suspenso</span>}
                                        {o.pe_enabled && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Gavel className="w-3 h-3" aria-hidden />{o.pe_suspended ? 'PE suspenso' : 'PE'}</span>}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden />{fmtNum(o.members_count)} membros</span>
                                        <span>{fmtNum(o.processes_count)} consultas</span>
                                        <span>{fmtNum(o.expedientes_count)} expedientes</span>
                                    </span>
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
