// ============================================================================
// platformAdminSections — mapa da Administração da plataforma (super-admin).
// ----------------------------------------------------------------------------
// Fonte única de: quais seções existem, em que grupo ficam e como se acham na
// busca. A página (src/pages/Admin.jsx) só desenha o que sai daqui. Quem pode
// abrir é decidido nas Cloud Functions (assertPlatformAdmin); a tela só esconde.
// Não confundir com src/lib/adminSections.js, que é o painel de cada órgão.
// ============================================================================

import {
    Settings, Flag, Mail, Building2, Users, ShieldCheck, Gavel, Activity,
    HeartPulse, SlidersHorizontal, HardDrive, Wrench, DollarSign, Palette, Megaphone, Lock,
} from 'lucide-react';

export { searchAdminSections as searchPlatformSections } from './adminSections.js';

export const PLATFORM_GROUPS = [
    { key: 'plataforma', label: 'Plataforma', description: 'Configuração inicial, identidade visual, funcionalidades ligadas e envio de e-mail.' },
    { key: 'pessoas', label: 'Órgãos e pessoas', description: 'Quem usa o SIGO, em que órgão, e quem administra a plataforma.' },
    { key: 'modulos', label: 'Módulos', description: 'Controles da plataforma sobre cada módulo de trabalho.' },
    { key: 'operacao', label: 'Operação e diagnóstico', description: 'O que está acontecendo, a saúde do sistema e os limites de uso.' },
    { key: 'dados', label: 'Dados e custos', description: 'Espaço ocupado, ferramentas de correção e quanto a plataforma custa.' },
];

export const PLATFORM_SECTIONS = [
    {
        key: 'setup', group: 'plataforma', label: 'Configuração inicial', icon: Settings,
        description: 'Passo a passo dos segredos e integrações que ficam fora do banco: chave de e-mail, faturamento, primeiro acesso.',
        keywords: 'segredos variáveis ambiente github actions chave api bigquery faturamento bootstrap instalação',
    },
    {
        key: 'branding', group: 'plataforma', label: 'Identidade e termos', icon: Palette,
        description: 'Nome, cor e logo da plataforma, textos da tela de entrada, rodapé, contato de suporte e termos de uso com aceite.',
        keywords: 'marca logotipo logo cor nome personalizar identidade visual tela inicial entrada rodapé suporte contato termos de uso aceite versão',
    },
    {
        key: 'flags', group: 'plataforma', label: 'Funcionalidades', icon: Flag,
        description: 'Liga e desliga as funcionalidades opcionais para todos os órgãos.',
        keywords: 'feature flags chaves ligar desligar jurimetria panorama busca global metas 2fa tour',
    },
    {
        key: 'email', group: 'plataforma', label: 'E-mail', icon: Mail,
        description: 'Remetente e nome usados nos e-mails que a plataforma envia.',
        keywords: 'resend remetente envio notificação código dois fatores',
    },
    {
        key: 'orgs', group: 'pessoas', label: 'Órgãos', icon: Building2,
        description: 'Todos os órgãos, com busca e filtros. A ficha de cada um mostra membros, volumes e atividade e permite suspender, reativar, trocar o criador e excluir.',
        keywords: 'organizações promotorias unidades excluir membros registros suspender reativar bloquear criador transferir ficha',
    },
    {
        key: 'users', group: 'pessoas', label: 'Usuários', icon: Users,
        description: 'Todas as pessoas do SIGO: ficha, órgãos e papéis, conta, atividade e bloqueio de acesso.',
        keywords: 'pessoas contas vínculos papéis membros e-mail bloquear desbloquear bloqueio último acesso inativos',
    },
    {
        key: 'admins', group: 'pessoas', label: 'Administradores da plataforma', icon: ShieldCheck,
        description: 'Quem tem acesso a esta página. Conceda ou retire o acesso de super-admin.',
        keywords: 'super-admin conceder revogar acesso permissão administradores',
    },
    {
        key: 'secretaria', group: 'modulos', label: 'Processo Eletrônico', icon: Gavel,
        description: 'Órgãos com o Processo Eletrônico ligado, volume de processos e suspensão pela plataforma.',
        keywords: 'secretaria processo eletrônico suspender reativar ritos unidades',
    },
    {
        key: 'seguranca', group: 'operacao', label: 'Central de segurança', icon: Lock,
        description: 'Checklist com pontuação (cópia do banco, código por e-mail, quem administra), revisão de acessos e auditoria da administração com exportação.',
        keywords: 'segurança proteção checklist pontuação score backup cópia pitr app check chave api 2fa dois fatores auditoria exportar csv acessos revisão',
    },
    {
        key: 'avisos', group: 'operacao', label: 'Avisos e manutenção', icon: Megaphone,
        description: 'Faixa de aviso para todas as pessoas, com período e prévia, e o modo manutenção, que deixa só a administração usar o sistema.',
        keywords: 'aviso comunicado banner faixa mensagem todos manutenção fora do ar parada indisponível',
    },
    {
        key: 'activity', group: 'operacao', label: 'Movimentações', icon: Activity,
        description: 'Tudo o que foi feito na plataforma, em ordem, com filtro por órgão e por ação.',
        keywords: 'auditoria log histórico feed ações eventos',
    },
    {
        key: 'health', group: 'operacao', label: 'Diagnóstico e saúde', icon: HeartPulse,
        description: 'Serviços e versão no ar, rotinas agendadas com o resultado de cada execução, erros reais do servidor nas últimas 24 horas e espaço dos arquivos.',
        keywords: 'diagnóstico saúde erros falhas status monitoramento rotinas agendadas cron versão deploy commit logs arquivos storage espaço',
    },
    {
        key: 'quotas', group: 'operacao', label: 'Cotas e limites', icon: SlidersHorizontal,
        description: 'Limites que o servidor confere: órgãos criados por pessoa, membros por órgão e linhas por importação, com o uso atual de cada um.',
        keywords: 'cotas limites importação linhas planilha membros órgãos criar convite uso capacidade',
    },
    {
        key: 'footprint', group: 'dados', label: 'Armazenamento', icon: HardDrive,
        description: 'Quantos documentos e quanto espaço cada coleção ocupa no banco.',
        keywords: 'espaço tamanho coleções documentos footprint banco',
    },
    {
        key: 'datatools', group: 'dados', label: 'Ferramentas de dados', icon: Wrench,
        description: 'Confere e recalcula os contadores dos órgãos e migra o histórico para subcoleção.',
        keywords: 'integridade contadores recalcular backfill histórico migração correção',
    },
    {
        key: 'costs', group: 'dados', label: 'Custos', icon: DollarSign,
        description: 'Quanto a plataforma custou por serviço, lido do faturamento do Google Cloud.',
        keywords: 'dinheiro gastos faturamento billing bigquery reais',
    },
];

export const findPlatformSection = (key) => PLATFORM_SECTIONS.find((s) => s.key === key) || null;

/**
 * Pendências da configuração inicial, mostradas na visão geral.
 * @param {object|null} setup Resposta de getSetupStatus.
 * @returns {Array<{key: string, text: string, section: string, tone: 'warn'|'info'}>}
 */
export function platformAlerts(setup) {
    if (!setup) return [];
    const alerts = [];
    if (!setup.emailApiKeyConfigured) {
        alerts.push({ key: 'emailKey', tone: 'warn', section: 'setup', text: 'A chave do serviço de e-mail não está configurada. Códigos de dois fatores e avisos por e-mail não saem.' });
    }
    if (!setup.emailFromConfigured) {
        alerts.push({ key: 'emailFrom', tone: 'warn', section: 'email', text: 'O remetente dos e-mails não foi definido.' });
    }
    if (!setup.billingExportConfigured) {
        alerts.push({ key: 'billing', tone: 'info', section: 'setup', text: 'Os custos reais não aparecem porque a exportação do faturamento para o BigQuery não está ligada.' });
    }
    if (!setup.platformAdminBootstrapConfigured) {
        alerts.push({ key: 'bootstrap', tone: 'info', section: 'setup', text: 'Não há e-mail de recuperação do super-admin. Se todos os administradores perderem o acesso, só o console devolve.' });
    }
    return alerts;
}
