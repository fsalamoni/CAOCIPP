import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Info, LayoutDashboard, Loader2, Lock, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { getSetupStatus } from '@/services/platformService';
import { logger } from '@/utils/logger';
import {
    PLATFORM_GROUPS, PLATFORM_SECTIONS, findPlatformSection, platformAlerts, searchPlatformSections,
} from '@/lib/platformAdminSections';
import PlatformOverview from '@/components/admin/PlatformOverview';
import CostsPanel from '@/components/admin/CostsPanel';
import FeatureFlagsPanel from '@/components/admin/FeatureFlagsPanel';
import PlatformAdminsPanel from '@/components/admin/PlatformAdminsPanel';
import BrandingPanel from '@/components/admin/BrandingPanel';
import OrgsPanel from '@/components/admin/OrgsPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import ActivityPanel from '@/components/admin/ActivityPanel';
import FootprintPanel from '@/components/admin/FootprintPanel';
import QuotasPanel from '@/components/admin/QuotasPanel';
import HealthPanel from '@/components/admin/HealthPanel';
import DataToolsPanel from '@/components/admin/DataToolsPanel';
import EmailProviderPanel from '@/components/admin/EmailProviderPanel';
import SetupGuidePanel from '@/components/admin/SetupGuidePanel';
import SecretariaPanel from '@/components/admin/SecretariaPanel';

// Componente de cada seção. O que cada uma é e em que grupo fica está em
// src/lib/platformAdminSections.js.
const SECTION_COMPONENTS = {
    setup: SetupGuidePanel,
    branding: BrandingPanel,
    flags: FeatureFlagsPanel,
    email: EmailProviderPanel,
    orgs: OrgsPanel,
    users: UsersPanel,
    admins: PlatformAdminsPanel,
    secretaria: SecretariaPanel,
    activity: ActivityPanel,
    health: HealthPanel,
    quotas: QuotasPanel,
    footprint: FootprintPanel,
    datatools: DataToolsPanel,
    costs: CostsPanel,
};

const GROUPS = PLATFORM_GROUPS
    .map((g) => ({ ...g, sections: PLATFORM_SECTIONS.filter((s) => s.group === g.key) }))
    .filter((g) => g.sections.length > 0);

/** Pendências da configuração, no topo da visão geral. */
function Pendencias({ onOpen }) {
    const [alerts, setAlerts] = useState(null);
    useEffect(() => {
        let vivo = true;
        getSetupStatus()
            .then((s) => { if (vivo) setAlerts(platformAlerts(s)); })
            .catch((err) => { logger.error('Falha ao ler a configuração inicial:', err); if (vivo) setAlerts([]); });
        return () => { vivo = false; };
    }, []);
    if (!alerts || alerts.length === 0) return null;
    return (
        <section aria-labelledby="pendencias-titulo" className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
            <h2 id="pendencias-titulo" className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4" aria-hidden />
                {alerts.length === 1 ? '1 pendência de configuração' : `${alerts.length} pendências de configuração`}
            </h2>
            <ul className="space-y-1.5">
                {alerts.map((a) => (
                    <li key={a.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-slate-800 dark:text-slate-100">
                        <span className="flex items-start gap-2 flex-1">
                            {a.tone === 'warn'
                                ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                                : <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />}
                            {a.text}
                        </span>
                        <button type="button" onClick={() => onOpen(a.section)} className="self-start sm:self-auto text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                            Resolver em {findPlatformSection(a.section)?.label}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Administração da plataforma (super-admin): visão geral + seções agrupadas.
 * A seção aberta fica no endereço (?secao=…), então dá para voltar, recarregar
 * e mandar o link de uma seção.
 */
export default function Admin() {
    const { isPlatformAdmin, isLoading } = usePlatformAdmin();
    const [searchParams, setSearchParams] = useSearchParams();
    const [busca, setBusca] = useState('');

    const active = findPlatformSection(searchParams.get('secao'));
    const resultados = useMemo(
        () => (busca.trim() ? searchPlatformSections(PLATFORM_SECTIONS, busca) : null),
        [busca]
    );

    if (isLoading) {
        return (
            <div role="status" className="flex items-center justify-center py-24 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden />
                Verificando acesso...
            </div>
        );
    }

    if (!isPlatformAdmin) {
        return (
            <div className="max-w-md mx-auto mt-16 text-center space-y-3">
                <Lock className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500" aria-hidden />
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Acesso restrito</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Esta área é exclusiva de quem administra a plataforma.
                </p>
            </div>
        );
    }

    const openSection = (key) => {
        const next = new URLSearchParams(searchParams);
        if (key) next.set('secao', key); else next.delete('secao');
        next.delete('orgao'); // ficha de um órgão aberta não vale para outra seção
        setSearchParams(next);
        setBusca('');
        window.scrollTo?.({ top: 0 });
    };

    const navButton = (key, label, Icon) => {
        const current = (active?.key || '') === key && !resultados;
        return (
            <button
                key={key || 'overview'} type="button" onClick={() => openSection(key)} aria-current={current ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${current
                    ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950 dark:text-indigo-200'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
            >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0">{label}</span>
            </button>
        );
    };

    const sectionCard = (s) => {
        const Icon = s.icon;
        return (
            <li key={s.key}>
                <button
                    type="button" onClick={() => openSection(s.key)}
                    className="group w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-950">
                        <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-slate-900 dark:text-white">{s.label}</span>
                        <span className="block text-sm text-slate-600 dark:text-slate-300">{s.description}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" aria-hidden />
                </button>
            </li>
        );
    };

    const ActiveComponent = active ? SECTION_COMPONENTS[active.key] : null;
    const activeGroup = active ? PLATFORM_GROUPS.find((g) => g.key === active.group) : null;

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administração da plataforma</h1>
                    <p className="text-slate-600 dark:text-slate-300">
                        Tudo o que vale para o SIGO inteiro, em todos os órgãos, organizado por assunto.
                    </p>
                </div>
                <div className="relative md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                    <Input
                        type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 pr-9"
                        placeholder="Buscar na administração" aria-label="Buscar seção da administração da plataforma"
                    />
                    {busca && (
                        <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 space-y-4 lg:space-y-0">
                {/* Celular e tablet: seletor nativo, com os mesmos grupos. */}
                <div className="lg:hidden">
                    <label htmlFor="plataforma-secao" className="sr-only">Seção da administração da plataforma</label>
                    <select
                        id="plataforma-secao" value={active?.key || ''} onChange={(e) => openSection(e.target.value)}
                        className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Visão geral</option>
                        {GROUPS.map((g) => (
                            <optgroup key={g.key} label={g.label}>
                                {g.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <nav aria-label="Seções da administração da plataforma" className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4 pr-1">
                    {navButton('', 'Visão geral', LayoutDashboard)}
                    {GROUPS.map((g) => (
                        <div key={g.key}>
                            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.label}</p>
                            <div className="space-y-0.5">{g.sections.map((s) => navButton(s.key, s.label, s.icon))}</div>
                        </div>
                    ))}
                </nav>

                <div className="min-w-0">
                    {resultados ? (
                        <section aria-live="polite" className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                            <h2 className="px-3 pt-1 pb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                {resultados.length === 0 ? 'Nada encontrado' : `${resultados.length} ${resultados.length === 1 ? 'seção encontrada' : 'seções encontradas'}`}
                            </h2>
                            {resultados.length === 0 ? (
                                <p className="px-3 pb-3 text-sm text-slate-600 dark:text-slate-300">
                                    Tente outra palavra, como &quot;erros&quot;, &quot;e-mail&quot;, &quot;custos&quot; ou &quot;super-admin&quot;.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">{resultados.map(sectionCard)}</ul>
                            )}
                        </section>
                    ) : !active ? (
                        <div className="space-y-6">
                            <Pendencias onOpen={openSection} />
                            <PlatformOverview />
                            <div className="grid gap-4 xl:grid-cols-2">
                                {GROUPS.map((g) => (
                                    <section key={g.key} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                                        <div className="px-3 pt-1 pb-2">
                                            <h2 className="text-base font-bold text-slate-900 dark:text-white">{g.label}</h2>
                                            <p className="text-sm text-slate-600 dark:text-slate-300">{g.description}</p>
                                        </div>
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">{g.sections.map(sectionCard)}</ul>
                                    </section>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <header className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <button type="button" onClick={() => openSection('')} className="hover:text-indigo-700 dark:hover:text-indigo-300 underline-offset-2 hover:underline">Visão geral</button>
                                    <span aria-hidden> / </span>{activeGroup?.label}
                                </p>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{active.label}</h2>
                                <p className="text-slate-600 dark:text-slate-300">{active.description}</p>
                            </header>
                            <ActiveComponent key={active.key} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
