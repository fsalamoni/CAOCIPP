// ============================================================================
// organizationModules — fonte única de verdade das ABAS/MÓDULOS de um órgão
// ----------------------------------------------------------------------------
// Objetivo (zero quebra):
//   - Com a flag CUSTOM_ENTITIES DESLIGADA, getOrganizationTabs() devolve a
//     lista COMPLETA de abas built-in, na MESMA ordem de hoje. Ou seja, a UI
//     fica idêntica ao comportamento atual.
//   - Com a flag LIGADA, a visibilidade dos módulos built-in (Consultas /
//     Expedientes / Resumos) passa a respeitar organization.moduleConfig.
//
// Retrocompatibilidade do moduleConfig:
//   - Órgão SEM moduleConfig (todos os órgãos existentes hoje) => built-ins
//     LIGADOS por padrão. Nada some.
//   - Órgão COM moduleConfig (apenas órgãos novos criados em modo mínimo, ou
//     órgãos cujo admin já salvou preferências) => respeita os booleanos
//     explícitos; chave ausente é tratada como DESLIGADA.
//
// As abas custom (entityTypes) entram aqui em fases seguintes via customTypes.
// ============================================================================

import {
    Building2,
    LayoutDashboard,
    Search,
    FileText,
    Sparkles,
    Settings,
} from 'lucide-react';

// Chaves de módulo built-in (cada módulo pode gerar 1+ abas).
export const BUILTIN_MODULES = {
    PROCESSES: 'processes',
    EXPEDIENTES: 'expedientes',
    SUMMARY: 'summary',
};

// Metadados dos módulos built-in para a UI de administração (liga/desliga).
export const BUILTIN_MODULE_META = [
    {
        key: BUILTIN_MODULES.PROCESSES,
        label: 'Consultas',
        description: 'Painel de Consultas (kanban) + lista de Consultas.',
        icon: Search,
    },
    {
        key: BUILTIN_MODULES.EXPEDIENTES,
        label: 'Expedientes',
        description: 'Painel de Expedientes (kanban) + lista de Expedientes.',
        icon: FileText,
    },
    {
        key: BUILTIN_MODULES.SUMMARY,
        label: 'Resumos Inteligentes',
        description: 'Indicadores e gráficos consolidados do órgão.',
        icon: Sparkles,
    },
];

/**
 * Resolve quais módulos built-in estão habilitados para um órgão.
 * @param {object} organization
 * @returns {{processes:boolean, expedientes:boolean, summary:boolean}}
 */
export function resolveBuiltinModules(organization) {
    const cfg = organization?.moduleConfig;
    // Legado: sem config => tudo ligado (comportamento atual, nada some).
    if (!cfg || typeof cfg !== 'object') {
        return { processes: true, expedientes: true, summary: true };
    }
    return {
        processes: cfg.processes?.enabled === true,
        expedientes: cfg.expedientes?.enabled === true,
        summary: cfg.summary?.enabled === true,
    };
}

/**
 * Monta a lista ordenada de abas que devem aparecer para o órgão.
 *
 * @param {object} organization  Documento do órgão (pode conter moduleConfig).
 * @param {object} [opts]
 * @param {boolean} [opts.customEntitiesOn=false]  Estado da flag CUSTOM_ENTITIES.
 * @param {Array}  [opts.customTypes=[]]  Tipos de entidade custom (fases futuras).
 * @returns {Array<{key:string,label:string,icon:Function,creatorOnly?:boolean,module?:string,custom?:boolean,typeId?:string}>}
 */
export function getOrganizationTabs(organization, opts = {}) {
    const { customEntitiesOn = false, customTypes = [] } = opts;
    const enabled = resolveBuiltinModules(organization);

    // Quando a flag está DESLIGADA, todos os built-ins aparecem (idêntico a hoje).
    const showProcesses = !customEntitiesOn || enabled.processes;
    const showExpedientes = !customEntitiesOn || enabled.expedientes;
    const showSummary = !customEntitiesOn || enabled.summary;

    const tabs = [];

    // Página obrigatória e permanente.
    tabs.push({ key: 'info', label: 'Informações Gerais', icon: Building2, module: 'core' });

    if (showProcesses) {
        tabs.push({ key: 'kanban', label: 'Painel de Consultas', icon: LayoutDashboard, module: BUILTIN_MODULES.PROCESSES });
        tabs.push({ key: 'processes', label: 'Consultas', icon: Search, module: BUILTIN_MODULES.PROCESSES });
    }

    if (showExpedientes) {
        tabs.push({ key: 'kanban-expedientes', label: 'Painel de Expedientes', icon: LayoutDashboard, module: BUILTIN_MODULES.EXPEDIENTES });
        tabs.push({ key: 'expedientes', label: 'Expedientes', icon: FileText, module: BUILTIN_MODULES.EXPEDIENTES });
    }

    if (showSummary) {
        tabs.push({ key: 'summary', label: 'Resumos Inteligentes', icon: Sparkles, module: BUILTIN_MODULES.SUMMARY });
    }

    // Reservado para fases B+ (tipos de entidade custom geram cpanel:/clist:/csummary:).
    if (customEntitiesOn && Array.isArray(customTypes)) {
        customTypes
            .filter((t) => t && t.enabled !== false)
            .forEach((t) => {
                // Placeholder de contrato; componentes genéricos chegam nas fases B/C/E.
                tabs.push({ key: `cpanel:${t.id}`, label: `Painel de ${t.label_plural || t.label_singular || 'Personalizado'}`, icon: LayoutDashboard, custom: true, typeId: t.id });
                tabs.push({ key: `clist:${t.id}`, label: t.label_plural || t.label_singular || 'Personalizado', icon: FileText, custom: true, typeId: t.id });
            });
    }

    // Página obrigatória e permanente (somente Criador).
    tabs.push({ key: 'admin', label: 'Painel Administrativo', icon: Settings, module: 'core', creatorOnly: true });

    return tabs;
}

/**
 * Conjunto das chaves de aba built-in conhecidas (para validação de navegação).
 */
export const BUILTIN_TAB_KEYS = [
    'info',
    'kanban',
    'processes',
    'kanban-expedientes',
    'expedientes',
    'summary',
    'admin',
];

/**
 * Indica se a aba ativa é válida (visível) para o órgão dado o estado da flag.
 * Útil para redirecionar para "info" caso o módulo esteja desligado.
 */
export function isTabVisible(activeTab, organization, opts = {}) {
    const tabs = getOrganizationTabs(organization, opts);
    return tabs.some((t) => t.key === activeTab);
}
