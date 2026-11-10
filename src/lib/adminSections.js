// ============================================================================
// adminSections — mapa do Painel Administrativo do órgão.
// ----------------------------------------------------------------------------
// Fonte única de: quais seções existem, em que grupo ficam, quem pode abrir
// cada uma (criador ou permissão delegada) e de quais flags globais dependem.
// A interface (AdminManagement) só desenha o que sai daqui; a autorização de
// verdade continua nas Cloud Functions.
// ============================================================================

import {
    Building2, LayoutGrid, Gauge, Users, ShieldCheck, Search, FileText, Handshake,
    Scale, Telescope, Gavel, Timer, Zap, Replace, Lock, AlertTriangle,
} from 'lucide-react';
import { hasOrgPermission, hasAnyAdminPermission } from '../constants/orgPermissions.js';

export const ADMIN_GROUPS = [
    { key: 'orgao', label: 'Órgão', description: 'Quem é o órgão e o que aparece para a equipe.' },
    { key: 'pessoas', label: 'Pessoas e acesso', description: 'Quem faz parte do órgão e o que cada pessoa pode fazer.' },
    { key: 'modulos', label: 'Módulos de trabalho', description: 'Listas, campos e regras de cada página de trabalho.' },
    { key: 'regras', label: 'Regras e automação', description: 'Prazos, metas, alertas e relatórios automáticos.' },
    { key: 'dados', label: 'Dados e segurança', description: 'Correção em massa, auditoria, retenção, integrações e exclusão.' },
];

// `permission`: permissão delegável que abre a seção (o criador sempre abre).
// Sem `permission`, a seção é exclusiva do criador.
// `flags`: basta UMA das flags globais estar ligada; todas desligadas esconde a seção.
// `module`: módulo de Páginas e módulos ao qual a configuração pertence.
// `hideWhenModuleOff`: com o módulo desligado, mostra só o aviso (sem a configuração).
export const ADMIN_SECTIONS = [
    {
        key: 'details', group: 'orgao', label: 'Identidade e contato', icon: Building2, permission: 'edit_details',
        description: 'Nome oficial, sigla, descrição e dados de contato exibidos em Informações Gerais.',
        keywords: 'nome sigla descrição competência e-mail telefone endereço site detalhes',
    },
    {
        key: 'modules', group: 'orgao', label: 'Páginas e módulos', icon: LayoutGrid, permission: 'manage_modules', flags: ['customEntities'],
        description: 'Ligue, desligue e ordene as páginas do órgão e crie páginas personalizadas.',
        keywords: 'abas navegação ordem páginas personalizadas módulos ativar desativar',
    },
    {
        key: 'metrics', group: 'orgao', label: 'Métricas das páginas', icon: Gauge, permission: 'manage_metrics',
        description: 'Indicadores que cada página mostra em Informações Gerais.',
        keywords: 'indicadores painel cartões dashboard contagem soma',
    },
    {
        key: 'members', group: 'pessoas', label: 'Membros e convite', icon: Users,
        description: 'Quem faz parte do órgão, função e papel de cada pessoa e o código de convite.',
        keywords: 'convidar código convite remover função papel administrador assessoria secretaria decisória ex-membro',
    },
    {
        key: 'permissions', group: 'pessoas', label: 'Atribuições especiais', icon: ShieldCheck,
        description: 'Delegue a membros, uma a uma ou por área, as tarefas que hoje são só do criador.',
        keywords: 'permissões delegar poderes acesso excluir registros',
    },
    {
        key: 'matters', group: 'modulos', label: 'Consultas', icon: Search, permission: 'manage_matters', module: 'processes',
        description: 'Classificação por matérias e a lista de terceiros da fase de retorno.',
        keywords: 'matérias categorias subcategorias classificação terceiros aguarda retorno processos',
    },
    {
        key: 'expedientes', group: 'modulos', label: 'Expedientes', icon: FileText, permission: 'configure_expedientes', module: 'expedientes',
        description: 'Sistemas, origens e terceiros dos expedientes administrativos.',
        keywords: 'sistemas origens terceiros',
    },
    {
        key: 'parcerias', group: 'modulos', label: 'Parcerias', icon: Handshake, permission: 'configure_parcerias', module: 'parcerias',
        description: 'Tipos de parceria e de aditivo, vigências, categorias e comportamento do módulo.',
        keywords: 'convênio termo cooperação fomento aditivos vigência extinção terceiros',
    },
    {
        key: 'jurimetria', group: 'modulos', label: 'Jurimetria', icon: Scale, permission: 'configure_jurimetria', module: 'jurimetria',
        flags: ['jurimetria'], hideWhenModuleOff: true,
        description: 'Listas oficiais, tabela de pontuação e colunas da base de júris.',
        keywords: 'júri comarcas espécies resultado pontuação colunas importação',
    },
    {
        key: 'panorama', group: 'modulos', label: 'Panorama', icon: Telescope, permission: 'configure_panorama', module: 'panorama',
        flags: ['panorama'], hideWhenModuleOff: true,
        description: 'Bases analíticas: colunas, papéis, desfechos, regiões e regras de prescrição.',
        keywords: 'bases planilha colunas desfechos regiões prescrição',
    },
    {
        key: 'secretaria', group: 'modulos', label: 'Processo Eletrônico', icon: Gavel, permission: 'configure_secretaria',
        description: 'Liga o módulo e configura unidades, equipes, tipos de processo, ritos, documentos e calendário.',
        keywords: 'unidades equipes secretaria gabinete assessoria ritos tipos modelos papel timbrado calendário feriados portal partes',
    },
    {
        key: 'stagetime', group: 'regras', label: 'Indicador de tempo', icon: Timer, permission: 'configure_automation', flags: ['stageTime'],
        description: 'Limites de dias e cores do selo que mostra há quanto tempo um item está na etapa.',
        keywords: 'dias úteis corridos cores selo etapa prazo alerta',
    },
    {
        key: 'automation', group: 'regras', label: 'Metas, alertas e relatórios', icon: Zap, permission: 'configure_automation',
        flags: ['goals', 'escalation', 'reports'],
        description: 'Metas de conclusão por assessor, escalonamento de urgentes parados e relatórios por e-mail.',
        keywords: 'metas escalonamento urgentes parados resumo diário relatório semanal e-mail',
    },
    {
        key: 'padronizacao', group: 'dados', label: 'Padronização em bloco', icon: Replace, permission: 'bulk_standardize',
        description: 'Corrija de uma vez valores escritos de formas diferentes nos registros.',
        keywords: 'substituir valores campos em massa corrigir',
    },
    {
        key: 'security', group: 'dados', label: 'Auditoria, retenção e integrações', icon: Lock, flags: ['accessLog', 'retention', 'webhooks'],
        description: 'Log de acesso, política de retenção e anonimização e webhooks para sistemas externos.',
        keywords: 'log auditoria lgpd anonimização retenção webhook integração segurança',
    },
    {
        key: 'danger', group: 'dados', label: 'Manutenção e zona de perigo', icon: AlertTriangle, danger: true,
        description: 'Gerar logs retroativos, limpar os dados ou excluir o órgão. Ações sem volta.',
        keywords: 'excluir apagar limpar dados logs retroativos',
    },
];

/** Módulo ligado para o órgão? Órgão sem moduleConfig (legado) tem tudo ligado. */
function moduleEnabled(organization, moduleKey) {
    const cfg = organization?.moduleConfig;
    if (!cfg || typeof cfg !== 'object') return true;
    return cfg[moduleKey]?.enabled === true;
}

/**
 * Seções que a pessoa pode abrir, na ordem de exibição.
 * @param {object} args
 * @param {object} args.membership  Vínculo da pessoa ({ role, permissions }).
 * @param {object} args.organization  Documento do órgão.
 * @param {Record<string, boolean>} args.flags  Flags globais (customEntities, jurimetria, panorama,
 *   stageTime, goals, escalation, reports, accessLog, retention, webhooks).
 * @returns {Array<object>} Seções com `moduleOff` (página desligada em Páginas e módulos)
 *   e `delegated` (aberta por permissão delegada, não por ser criador).
 */
export function resolveAdminSections({ membership, organization, flags = {} }) {
    const isCreator = membership?.role === 'creator';
    if (!isCreator && !hasAnyAdminPermission(membership)) return [];
    return ADMIN_SECTIONS
        .filter((s) => !s.flags || s.flags.some((f) => flags[f] === true))
        .filter((s) => isCreator || (s.permission && hasOrgPermission(membership, s.permission)))
        .map((s) => ({
            ...s,
            delegated: !isCreator,
            // O moduleConfig só vale com a flag de páginas personalizadas ligada.
            moduleOff: Boolean(s.module) && flags.customEntities === true && !moduleEnabled(organization, s.module),
        }));
}

/** Busca simples (sem acento, sem caixa) em rótulo, descrição e palavras-chave. */
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchAdminSections(sections, query) {
    const termos = normalizar(query).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return sections;
    return sections.filter((s) => {
        const alvo = normalizar(`${s.label} ${s.description} ${s.keywords || ''}`);
        return termos.every((t) => alvo.includes(t));
    });
}
