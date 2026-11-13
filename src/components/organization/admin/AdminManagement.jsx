import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, LayoutDashboard, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { ORG_PERMISSIONS, ORG_PERMISSION_KEYS } from '@/constants/orgPermissions';
import { ADMIN_GROUPS, resolveAdminSections, searchAdminSections } from '@/lib/adminSections';

import OrganizationDetails from './OrganizationDetails';
import MemberManagement from './MemberManagement';
import MatterConfiguration from './MatterConfiguration';
import ExpedienteConfiguration from './ExpedienteConfiguration';
import ParceriaConfiguration from './ParceriaConfiguration';
import JurimetriaConfiguration from './JurimetriaConfiguration';
import PanoramaConfiguration from './PanoramaConfiguration';
import DangerZone from './DangerZone';
import BulkReplaceTool from './BulkReplaceTool';
import ModulesManager from './ModulesManager';
import MetricsManager from './MetricsManager';
import PermissionsManager from './PermissionsManager';
import AutomationSettings from './AutomationSettings';
import SecuritySettings from './SecuritySettings';
import StageTimeSettings from './StageTimeSettings';
import ProcessoEletronicoAdmin from '@/components/secretaria/ProcessoEletronicoAdmin';

// Componente de cada seção. O que cada uma é, a que grupo pertence e quem pode
// abrir está em src/lib/adminSections.js.
const SECTION_COMPONENTS = {
    details: OrganizationDetails,
    modules: ModulesManager,
    metrics: MetricsManager,
    members: MemberManagement,
    permissions: PermissionsManager,
    matters: MatterConfiguration,
    expedientes: ExpedienteConfiguration,
    parcerias: ParceriaConfiguration,
    jurimetria: JurimetriaConfiguration,
    panorama: PanoramaConfiguration,
    secretaria: ProcessoEletronicoAdmin,
    stagetime: StageTimeSettings,
    automation: AutomationSettings,
    padronizacao: BulkReplaceTool,
    security: SecuritySettings,
    danger: DangerZone,
};

const PERMISSION_LABEL = Object.fromEntries(ORG_PERMISSIONS.map((p) => [p.key, p.label]));

/**
 * Painel Administrativo do órgão: visão geral + seções agrupadas por assunto.
 * A seção aberta fica no endereço (&secao=…), então dá para voltar, recarregar
 * e compartilhar o link de uma configuração.
 */
export default function AdminManagement({ organization, members, userRole, userMembership }) {
    const flags = {
        customEntities: useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key),
        jurimetria: useFlag(FEATURE_FLAGS.JURIMETRIA.key),
        panorama: useFlag(FEATURE_FLAGS.PANORAMA.key),
        stageTime: useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key),
        goals: useFlag(FEATURE_FLAGS.ASSESSOR_GOALS.key),
        escalation: useFlag(FEATURE_FLAGS.AUTO_ESCALATION.key),
        reports: useFlag(FEATURE_FLAGS.SCHEDULED_EMAIL_REPORTS.key),
        accessLog: useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key),
        retention: useFlag(FEATURE_FLAGS.DATA_RETENTION_POLICY.key),
        webhooks: useFlag(FEATURE_FLAGS.OUTBOUND_WEBHOOKS.key),
    };
    const flagsKey = JSON.stringify(flags);
    const isCreator = userRole === 'creator';
    const [searchParams, setSearchParams] = useSearchParams();
    const [busca, setBusca] = useState('');

    const sections = useMemo(
        () => resolveAdminSections({
            membership: isCreator ? { ...userMembership, role: 'creator' } : userMembership,
            organization,
            flags: JSON.parse(flagsKey),
        }),
        [isCreator, userMembership, organization, flagsKey]
    );
    const groups = useMemo(
        () => ADMIN_GROUPS
            .map((g) => ({ ...g, sections: sections.filter((s) => s.group === g.key) }))
            .filter((g) => g.sections.length > 0),
        [sections]
    );

    if (sections.length === 0) {
        return (
            <div className="p-8 text-center text-slate-600 dark:text-slate-300">
                Acesso restrito ao criador do órgão e a quem recebeu atribuições especiais.
            </div>
        );
    }

    const active = sections.find((s) => s.key === searchParams.get('secao')) || null;
    const resultados = busca.trim() ? searchAdminSections(sections, busca) : null;

    const openSection = (key) => {
        const next = new URLSearchParams(searchParams);
        if (key) next.set('secao', key); else next.delete('secao');
        next.delete('aba'); // aba interna de uma seção (ex.: Processo Eletrônico) não vale para outra
        setSearchParams(next);
        setBusca('');
    };

    // Situação resumida de cada seção, mostrada na visão geral.
    const ativos = members.filter((m) => m.active !== false);
    const comAtribuicoes = ativos.filter((m) => m.role !== 'creator' && ORG_PERMISSION_KEYS.some((k) => m.permissions?.[k] === true)).length;
    const peLigado = organization?.secretariaConfig?.enabled === true;
    const statusOf = (s) => {
        if (s.moduleOff) return { text: 'Página desligada', tone: 'muted' };
        if (s.key === 'members') return { text: `${ativos.length} ${ativos.length === 1 ? 'ativo' : 'ativos'}` };
        if (s.key === 'permissions') return { text: comAtribuicoes === 0 ? 'Ninguém delegado' : `${comAtribuicoes} com atribuições`, tone: comAtribuicoes === 0 ? 'muted' : undefined };
        if (s.key === 'secretaria') return { text: peLigado ? 'Ligado' : 'Desligado', tone: peLigado ? 'on' : 'muted' };
        return null;
    };

    const navButton = (key, label, Icon, extra = {}) => {
        const current = (active?.key || '') === key && !resultados;
        return (
            <button
                key={key || 'overview'} type="button" onClick={() => openSection(key)} aria-current={current ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${current
                    ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950 dark:text-indigo-200'
                    : extra.danger
                        ? 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
            >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                <span className="flex-1 min-w-0">{label}</span>
                {extra.moduleOff && <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">desligada</span>}
            </button>
        );
    };

    const sectionCard = (s) => {
        const status = statusOf(s);
        const Icon = s.icon;
        return (
            <li key={s.key}>
                <button
                    type="button" onClick={() => openSection(s.key)}
                    className="group w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.danger ? 'bg-red-50 dark:bg-red-950' : 'bg-indigo-50 dark:bg-indigo-950'}`}>
                        <Icon className={`w-5 h-5 ${s.danger ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`} aria-hidden />
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-semibold text-slate-900 dark:text-white">{s.label}</span>
                            {status && (
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${status.tone === 'on'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                    : status.tone === 'muted'
                                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`}>
                                    {status.text}
                                </span>
                            )}
                        </span>
                        <span className="block text-sm text-slate-600 dark:text-slate-300">{s.description}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" aria-hidden />
                </button>
            </li>
        );
    };

    const ActiveComponent = active ? SECTION_COMPONENTS[active.key] : null;
    const activeGroup = active ? ADMIN_GROUPS.find((g) => g.key === active.group) : null;
    const canOpenModules = sections.some((s) => s.key === 'modules');

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel Administrativo</h2>
                    <p className="text-slate-600 dark:text-slate-300">
                        {isCreator
                            ? 'Tudo o que define como o órgão funciona, organizado por assunto.'
                            : 'Você recebeu atribuições especiais neste órgão. Só as áreas liberadas para você aparecem aqui.'}
                    </p>
                </div>
                <div className="relative md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                    <Input
                        type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 pr-9"
                        placeholder="Buscar configuração" aria-label="Buscar configuração no Painel Administrativo"
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
                    <label htmlFor="admin-secao" className="sr-only">Seção do Painel Administrativo</label>
                    <select
                        id="admin-secao" value={active?.key || ''} onChange={(e) => openSection(e.target.value)}
                        className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">Visão geral</option>
                        {groups.map((g) => (
                            <optgroup key={g.key} label={g.label}>
                                {g.sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <nav aria-label="Seções do Painel Administrativo" className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4 pr-1">
                    {navButton('', 'Visão geral', LayoutDashboard)}
                    {groups.map((g) => (
                        <div key={g.key}>
                            <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{g.label}</p>
                            <div className="space-y-0.5">
                                {g.sections.map((s) => navButton(s.key, s.label, s.icon, { danger: s.danger, moduleOff: s.moduleOff }))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="min-w-0">
                    {resultados ? (
                        <section aria-live="polite" className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                            <h3 className="px-3 pt-1 pb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                {resultados.length === 0 ? 'Nada encontrado' : `${resultados.length} ${resultados.length === 1 ? 'seção encontrada' : 'seções encontradas'}`}
                            </h3>
                            {resultados.length === 0 ? (
                                <p className="px-3 pb-3 text-sm text-slate-600 dark:text-slate-300">
                                    Tente outra palavra, como &quot;convite&quot;, &quot;terceiros&quot;, &quot;cores&quot; ou &quot;webhook&quot;.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">{resultados.map(sectionCard)}</ul>
                            )}
                        </section>
                    ) : !active ? (
                        <div className="grid gap-4 xl:grid-cols-2">
                            {groups.map((g) => (
                                <section key={g.key} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                                    <div className="px-3 pt-1 pb-2">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{g.label}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{g.description}</p>
                                    </div>
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">{g.sections.map(sectionCard)}</ul>
                                </section>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <header className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <button type="button" onClick={() => openSection('')} className="hover:text-indigo-700 dark:hover:text-indigo-300 underline-offset-2 hover:underline">Visão geral</button>
                                    <span aria-hidden> / </span>{activeGroup?.label}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{active.label}</h3>
                                    {isCreator && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            {active.permission ? `Pode ser delegada: ${PERMISSION_LABEL[active.permission]}` : 'Só o criador'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-600 dark:text-slate-300">{active.description}</p>
                            </header>

                            {active.moduleOff && (
                                <Alert>
                                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
                                        <span className="flex-1">
                                            A página de {active.label} está desligada neste órgão.{' '}
                                            {active.hideWhenModuleOff
                                                ? 'Ligue a página para configurar.'
                                                : 'Você pode configurar agora; as mudanças valem quando a página for ligada.'}
                                        </span>
                                        {canOpenModules && (
                                            <Button variant="outline" size="sm" onClick={() => openSection('modules')}>Abrir Páginas e módulos</Button>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {!(active.moduleOff && active.hideWhenModuleOff) && (
                                <ActiveComponent
                                    key={active.key}
                                    organization={organization}
                                    members={members}
                                    onOpenSection={openSection}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
