import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserRound, RefreshCw, Loader2, AlertCircle, Search, ChevronRight, Ban, ShieldCheck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { platformUser } from '@/services/platformService';
import UserDetail from './UserDetail';

const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DIA = 86400000;

export const quandoAcessou = (iso) => {
    if (!iso) return 'nunca entrou';
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
    if (dias <= 0) return 'entrou hoje';
    if (dias === 1) return 'entrou ontem';
    if (dias < 60) return `entrou há ${dias} dias`;
    return `último acesso em ${new Date(iso).toLocaleDateString('pt-BR')}`;
};

const FILTROS = [
    { key: 'todos', label: 'Todas', ok: () => true },
    { key: 'bloqueadas', label: 'Bloqueadas', ok: (p) => p.bloqueado },
    { key: 'sem_orgao', label: 'Sem órgão', ok: (p) => !p.orgaos && !p.super_admin },
    { key: 'inativas', label: 'Sem acesso há 90 dias', ok: (p) => !p.ultimo_acesso || Date.now() - new Date(p.ultimo_acesso).getTime() > 90 * DIA },
    { key: 'super', label: 'Super-admins', ok: (p) => p.super_admin },
];

/**
 * Pessoas do SIGO: só quem tem vínculo, perfil no SIGO ou é super-admin (o
 * login é compartilhado com outros sistemas, que ficam de fora). Um clique abre
 * a ficha (&pessoa=<uid> no endereço).
 */
export default function UsersPanel() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('todos');
    const aberta = searchParams.get('pessoa');

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['platformUsers'],
        queryFn: () => platformUser('listar'),
    });

    const abrir = (uid) => {
        const next = new URLSearchParams(searchParams);
        if (uid) next.set('pessoa', uid); else next.delete('pessoa');
        setSearchParams(next);
    };

    const todas = data?.pessoas || [];
    const lista = useMemo(() => {
        const f = FILTROS.find((x) => x.key === filtro) || FILTROS[0];
        const termo = semAcento(busca.trim());
        return todas.filter(f.ok).filter((p) => !termo || semAcento(`${p.nome} ${p.email}`).includes(termo));
    }, [todas, filtro, busca]);

    if (aberta) return <UserDetail uid={aberta} onBack={() => abrir('')} />;

    if (isLoading) {
        return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando pessoas...</div>;
    }
    if (error) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error.message || 'Erro ao carregar pessoas.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    const contagem = (key) => todas.filter(FILTROS.find((x) => x.key === key).ok).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                    <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" placeholder="Buscar por nome ou e-mail" aria-label="Buscar pessoa por nome ou e-mail" />
                </div>
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2 shrink-0">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />Atualizar
                </Button>
            </div>

            <div role="group" aria-label="Filtrar pessoas" className="flex flex-wrap gap-2">
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

            <p className="text-sm text-slate-600 dark:text-slate-300">
                {fmtNum(lista.length)} de {fmtNum(todas.length)} pessoas do SIGO. Contas do mesmo login usadas só em outros sistemas não aparecem.
            </p>

            {lista.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <UserRound className="w-8 h-8 text-slate-400" aria-hidden />Nenhuma pessoa com esse filtro ou nome.
                </div>
            ) : (
                <ul className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {lista.map((p) => (
                        <li key={p.uid}>
                            <button
                                type="button" onClick={() => abrir(p.uid)}
                                className="group w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                            >
                                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-950 text-sm font-semibold text-indigo-700 dark:text-indigo-300" aria-hidden>
                                    {(p.nome || p.email || '?').trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-semibold text-slate-900 dark:text-white break-words">{p.nome || 'Sem nome'}</span>
                                        {p.bloqueado && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"><Ban className="w-3 h-3" aria-hidden />Bloqueada</span>}
                                        {p.super_admin && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><ShieldCheck className="w-3 h-3" aria-hidden />Super-admin</span>}
                                    </span>
                                    <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                                        <span className="break-all">{p.email || 'sem e-mail'}</span>
                                        <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" aria-hidden />{p.orgaos === 1 ? '1 órgão' : `${fmtNum(p.orgaos)} órgãos`}</span>
                                        <span>{quandoAcessou(p.ultimo_acesso)}</span>
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
