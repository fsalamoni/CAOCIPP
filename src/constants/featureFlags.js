// ============================================================================
// FEATURE FLAGS - Catálogo central de flags da plataforma
// ----------------------------------------------------------------------------
// MODELO ATUAL (após a integração permanente):
//   - A MAIORIA das funcionalidades foi INTEGRADA permanentemente ao produto
//     (permanentes/design). Ficam LIGADAS por padrão e NÃO aparecem na página
//     de Administração para ligar/desligar — não exigem manutenção de flag.
//     Um `false` explícito no Firestore ainda é respeitado como VÁLVULA DE
//     EMERGÊNCIA (permite desligar sem redeploy). Ver `OPTIONAL_FLAG_KEYS`
//     abaixo: tudo o que NÃO está nesse conjunto é considerado integrado.
//   - Um pequeno conjunto continua como flag OPCIONAL (o admin liga/desliga):
//     ver `OPTIONAL_FLAG_KEYS`. Essas têm DEFAULT = false (OFF) e são lidas do
//     Firestore normalmente.
//
// Por que manter as entradas das integradas neste catálogo? Muitas partes do
// código referenciam `FEATURE_FLAGS.X.key` — remover as entradas quebraria
// essas referências. Mantê-las (com useFlag retornando sempre true para as
// integradas) preserva 100% do comportamento atual sem risco.
//
// A persistência das OPCIONAIS fica em Firestore: platformConfig/featureFlags
// (global) e organizations/{id}.featureFlags (override por órgão, opcional).
// ============================================================================

export const FEATURE_FLAGS = {
    // --- Fase 2: otimizações de escala ---
    DB_PAGINATION: {
        key: 'db_pagination',
        label: 'Paginação no banco de dados',
        description:
            'As tabelas de processos e expedientes passam a paginar diretamente no Firestore (limit + cursor) em vez de baixar a coleção inteira para o navegador. Reduz drasticamente leituras e uso de memória.',
        category: 'Escala',
        risk: 'medium',
        default: false,
    },
    PER_TAB_LOADING: {
        key: 'per_tab_loading',
        label: 'Carregar apenas a aba ativa',
        description:
            'A página do Órgão carrega somente os dados da aba aberta, em vez de carregar processos, expedientes, membros e resumos ao mesmo tempo.',
        category: 'Escala',
        risk: 'medium',
        default: false,
    },
    DASHBOARD_SUMMARIES: {
        key: 'dashboard_summaries',
        label: 'Resumos pré-calculados no painel',
        description:
            'O painel inicial lê documentos de resumo (mantidos por funções/cron) em vez de recalcular contagens no navegador a cada acesso.',
        category: 'Escala',
        risk: 'medium',
        default: false,
    },

    // --- Fase 3: evolução do modelo de dados ---
    HISTORY_SUBCOLLECTION: {
        key: 'history_subcollection',
        label: 'Histórico em subcoleção',
        description:
            'Move o histórico de atividades (activity_log) para subcoleções, evitando o crescimento dos documentos. Usa escrita dupla + verificação antes da troca de leitura.',
        category: 'Dados',
        risk: 'high',
        default: false,
    },

    // --- Fase 4: cargas pesadas assíncronas ---
    ASYNC_IMPORTS: {
        key: 'async_imports',
        label: 'Importações assíncronas',
        description:
            'Importações grandes passam a usar upload + fila + processamento em segundo plano, com progresso, em vez de processamento síncrono.',
        category: 'Cargas pesadas',
        risk: 'high',
        default: false,
    },

    // --- Fase 5: concorrência e segurança ---
    OPTIMISTIC_LOCKING: {
        key: 'optimistic_locking',
        label: 'Controle de versão (concorrência)',
        description:
            'Evita sobrescrita silenciosa quando duas pessoas editam o mesmo processo/expediente ao mesmo tempo, usando verificação de versão.',
        category: 'Integridade',
        risk: 'medium',
        default: false,
    },

    // --- Página de administração (rollout por ondas) ---
    ADMIN_WAVE_2: {
        key: 'admin_wave_2',
        label: 'Admin - Onda 2 (Órgãos, Usuários, Movimentações)',
        description:
            'Habilita as abas avançadas da página de Administração: drilldown por órgão, registro de usuários, feed global de movimentações e footprint de armazenamento.',
        category: 'Administração',
        risk: 'low',
        default: false,
    },
    ADMIN_WAVE_3: {
        key: 'admin_wave_3',
        label: 'Admin - Onda 3 (Cotas, Saúde, Ferramentas)',
        description:
            'Habilita cotas configuráveis, painel de saúde do sistema e ferramentas de dados (backup, backfill, auditoria de integridade).',
        category: 'Administração',
        risk: 'low',
        default: false,
    },

    // --- Fase 6: páginas e processos personalizados (no-code builder) ---
    CUSTOM_ENTITIES: {
        key: 'custom_entities',
        label: 'Páginas e processos personalizados',
        description:
            'Permite que cada organização ligue/desligue os módulos (Consultas, Expedientes, Resumos) e, futuramente, crie páginas próprias com tabelas, formulários, fases (kanban) e regras. Com a flag DESLIGADA, a organização funciona exatamente como hoje.',
        category: 'Personalização',
        risk: 'high',
        default: false,
    },

    // --- Fase 7: Usabilidade ---
    COPY_PROCESS_NUMBER: {
        key: 'copy_process_number',
        label: 'Copiar número do processo ao clicar',
        description:
            'Permite que o usuário clique no número do processo nos cartões do Kanban para copiar o texto para a área de transferência.',
        category: 'Usabilidade',
        risk: 'low',
        default: false,
    },

    // --- Fase 8: Redesign visual (V2) ---
    FRONTEND_V2: {
        key: 'frontend_v2',
        label: 'Novo design (V2) — visual minimalista',
        description:
            'Aplica o novo padrão visual minimalista (tipografia IBM Plex, paleta neutra e navy, cantos e sombras mais suaves) em toda a plataforma: painel, órgãos, kanban, tabelas, modais e administração. É uma troca puramente visual (CSS/tema) — nenhuma função, rota ou dado muda. Pode ser desligada a qualquer momento, retornando 100% ao visual atual.',
        category: 'Aparência',
        risk: 'low',
        default: false,
    },

    // --- Fase 9: Diagnóstico de plataforma — Aparência e personalização ---
    THEME_SWITCHER: {
        key: 'theme_switcher',
        label: 'Alternância de tema claro/escuro',
        description:
            'Adiciona um controle na interface para o usuário escolher entre tema claro, escuro ou o padrão do sistema operacional. Hoje o modo escuro não tem nenhum controle visível.',
        category: 'Aparência',
        risk: 'low',
        default: false,
    },
    TABLE_DENSITY: {
        key: 'table_density',
        label: 'Densidade de tabela ajustável',
        description:
            'Permite alternar entre densidade confortável e compacta nas tabelas de Consultas e Expedientes, além do seletor de colunas já existente. Preferência salva por usuário.',
        category: 'Aparência',
        risk: 'low',
        default: false,
    },

    // --- Fase 9: Produtividade ---
    COMMAND_PALETTE: {
        key: 'command_palette',
        label: 'Paleta de comandos (Ctrl/Cmd + K)',
        description:
            'Abre uma busca rápida para pular direto a qualquer órgão, aba ou página, ou disparar ações comuns, tudo por teclado. Inclui um painel de atalhos (tecla "?").',
        category: 'Produtividade',
        risk: 'low',
        default: false,
    },
    SAVED_VIEWS: {
        key: 'saved_views',
        label: 'Filtros salvos (visões nomeadas)',
        description:
            'Permite salvar uma combinação de filtros da tabela de Consultas/Expedientes com um nome, para reaplicar com um clique depois.',
        category: 'Produtividade',
        risk: 'low',
        default: false,
    },
    GLOBAL_SEARCH: {
        key: 'global_search',
        label: 'Busca global entre órgãos',
        description:
            'Uma busca única, acessível de qualquer tela, que procura por número de processo/expediente ou consulente em todos os órgãos do usuário — não só no órgão aberto no momento.',
        category: 'Produtividade',
        risk: 'medium',
        default: false,
    },
    BULK_ACTIONS: {
        key: 'bulk_actions',
        label: 'Ações em massa na tabela',
        description:
            'Permite selecionar várias linhas na tabela de Consultas/Expedientes para arquivar ou exportar de uma vez.',
        category: 'Produtividade',
        risk: 'medium',
        default: false,
    },

    // --- Fase 9: Prazos e priorização ---
    STAGE_TIME_INDICATOR: {
        key: 'stage_time_indicator',
        label: 'Indicador de tempo na etapa atual',
        description:
            'Mostra, no cartão do Kanban e na tabela, há quantos dias úteis o processo/expediente está parado na etapa atual, com selo de cor por limiar fixo: até 5 dias úteis (verde), até 10 dias úteis (amarelo/mostarda), mais de 10 dias úteis (vermelho).',
        category: 'Prazos',
        risk: 'low',
        default: false,
    },
    DEADLINE_CALENDAR: {
        key: 'deadline_calendar',
        label: 'Vista de calendário de vencimentos',
        description:
            'Adiciona uma aba de calendário mensal com as datas relevantes (distribuição, revisão, arquivamento) de Consultas e Expedientes do órgão.',
        category: 'Prazos',
        risk: 'low',
        default: false,
    },
    ASSESSOR_GOALS: {
        key: 'assessor_goals',
        label: 'Metas configuráveis por assessor/órgão',
        description:
            'Permite ao administrador do órgão definir uma meta de conclusão (ex.: % em até N dias úteis), exibida como barra de progresso no painel de cada assessor.',
        category: 'Prazos',
        risk: 'low',
        default: false,
    },
    AUTO_ESCALATION: {
        key: 'auto_escalation',
        label: 'Escalonamento automático de urgentes parados',
        description:
            'Uma rotina diária (Cloud Function agendada) verifica processos/expedientes urgentes sem movimentação há mais que o limite configurado pelo órgão e notifica o criador/administrador delegado, além do responsável.',
        category: 'Prazos',
        risk: 'medium',
        default: false,
    },

    // --- Fase 9: Relatórios e exportação ---
    EXPORT_PDF_EXCEL: {
        key: 'export_pdf_excel',
        label: 'Exportação para PDF e Excel',
        description:
            'Adiciona botões de exportação na tabela (respeitando os filtros ativos) e na ficha de um processo/expediente, em PDF ou Excel.',
        category: 'Relatórios',
        risk: 'low',
        default: false,
    },
    PERIOD_COMPARISON: {
        key: 'period_comparison',
        label: 'Comparação entre períodos',
        description:
            'Em Resumos Inteligentes, mostra os números do período selecionado lado a lado com o período anterior equivalente.',
        category: 'Relatórios',
        risk: 'low',
        default: false,
    },
    CUSTOM_DASHBOARD: {
        key: 'custom_dashboard',
        label: 'Painel inicial personalizável',
        description:
            'Permite reordenar ou ocultar os cartões de indicadores do Painel de Consultas (Início), com a preferência salva por usuário.',
        category: 'Relatórios',
        risk: 'low',
        default: false,
    },

    // --- Fase 9: Colaboração ---
    PROCESS_COMMENTS: {
        key: 'process_comments',
        label: 'Comentários internos com menções',
        description:
            'Adiciona um espaço de comentários por processo/expediente, com @menção a colegas do órgão e notificação automática de quem foi mencionado.',
        category: 'Colaboração',
        risk: 'medium',
        default: false,
    },
    LIVE_PRESENCE: {
        key: 'live_presence',
        label: 'Presença em tempo real',
        description:
            'Mostra, na ficha de um processo/expediente, quais outros membros do órgão estão vendo aquele registro no momento.',
        category: 'Colaboração',
        risk: 'low',
        default: false,
    },
    NOTIFICATION_CENTER_V2: {
        key: 'notification_center_v2',
        label: 'Central de notificações avançada',
        description:
            'Evolui o sino de notificações: agrupamento por tipo, marcar todas como lidas de uma vez, e preferências de quais eventos notificar.',
        category: 'Colaboração',
        risk: 'low',
        default: false,
    },

    // --- Fase 9: Automação por e-mail ---
    SCHEDULED_EMAIL_REPORTS: {
        key: 'scheduled_email_reports',
        label: 'Resumo diário e relatório semanal por e-mail',
        description:
            'Envia, por e-mail, um resumo diário de urgentes pendentes e/ou um relatório semanal do órgão. Exige configurar um provedor de e-mail em Administração da Plataforma; sem isso, fica inativa mesmo ligada.',
        category: 'Colaboração',
        risk: 'medium',
        default: false,
    },

    // --- Fase 9: Segurança e conformidade ---
    ACCESS_AUDIT_LOG: {
        key: 'access_audit_log',
        label: 'Log de acesso e auditoria exportável',
        description:
            'Registra exportações e aberturas de processos com restrição de acesso, com uma tela no órgão para consultar e exportar esse histórico (conformidade com a LGPD).',
        category: 'Segurança',
        risk: 'low',
        default: false,
    },
    DATA_RETENTION_POLICY: {
        key: 'data_retention_policy',
        label: 'Política de retenção e anonimização',
        description:
            'Permite configurar, por órgão, um prazo após o arquivamento para anonimizar dados pessoais do consulente. A anonimização em si só roda depois de uma pré-visualização e confirmação explícita — nunca automaticamente sem revisão. Ação irreversível: use com cautela.',
        category: 'Segurança',
        risk: 'high',
        default: false,
    },
    TWO_FACTOR_AUTH: {
        key: 'two_factor_auth',
        label: 'Autenticação em duas etapas (código por e-mail)',
        description:
            'Camada adicional opcional além do login Google: um código de verificação por e-mail a cada novo login. Exige o mesmo provedor de e-mail do item de relatórios agendados.',
        category: 'Segurança',
        risk: 'medium',
        default: false,
    },
    OUTBOUND_WEBHOOKS: {
        key: 'outbound_webhooks',
        label: 'Webhooks de integração externa',
        description:
            'Permite configurar, por órgão, uma URL para receber notificações automáticas (ex.: novo processo urgente, processo arquivado) via HTTP POST — para integrar com Slack, Teams ou sistemas próprios.',
        category: 'Segurança',
        risk: 'medium',
        default: false,
    },

    // --- Fase 9: Onboarding ---
    ONBOARDING_TOUR: {
        key: 'onboarding_tour',
        label: 'Tour guiado de primeiro acesso',
        description:
            'Mostra um tour curto e dispensável na primeira visita de um membro novo a um órgão, apontando a navegação principal.',
        category: 'Onboarding',
        risk: 'low',
        default: false,
    },

    // --- Módulo Parcerias (Convênio, Termo de Cooperação, Termo de Fomento) ---
    PARCERIAS: {
        key: 'parcerias_enabled',
        label: 'Módulo de Parcerias',
        description:
            'Habilita o módulo de Parcerias (Convênio, Termo de Cooperação, Termo de Fomento) em todos os órgãos, com Painel Kanban, lista, aditivos, importação por planilha e configuração de terceiros. Inclui 2 abas (Painel de Parcerias + Parcerias). Com a flag DESLIGADA, nada aparece na interface — comportamento idêntico ao atual. Quando a flag CUSTOM_ENTITIES está ligada, cada órgão pode ligar/desligar Parcerias individualmente em Gerenciar Páginas e Módulos.',
        category: 'Funcionalidades',
        risk: 'high',
        default: false,
    },
};

// Lista plana das flags para iteração em UI.
export const FEATURE_FLAG_LIST = Object.values(FEATURE_FLAGS);

// ----------------------------------------------------------------------------
// Integração permanente
// ----------------------------------------------------------------------------
// Conjunto das ÚNICAS flags que permanecem OPCIONAIS (o admin liga/desliga).
// Fonte: estado real em produção (Admin → Funcionalidades). Todo o resto foi
// integrado permanentemente ao produto e fica sempre ligado.
//
// Manter/alterar aqui é o único ponto necessário para promover uma flag de
// "opcional" para "integrada" (basta removê-la deste conjunto) ou o inverso.
export const OPTIONAL_FLAG_KEYS = new Set([
    'global_search',
    'assessor_goals',
    'two_factor_auth',
    'onboarding_tour',
]);

// Uma flag é "integrada" (permanente/on por padrão) se NÃO está no conjunto
// opcional.
export const isIntegratedFlag = (key) => !OPTIONAL_FLAG_KEYS.has(key);

// Listas derivadas para a UI de Administração.
export const INTEGRATED_FLAG_LIST = FEATURE_FLAG_LIST.filter((f) => isIntegratedFlag(f.key));
export const OPTIONAL_FLAG_LIST = FEATURE_FLAG_LIST.filter((f) => !isIntegratedFlag(f.key));

// Mapa { key: default } para inicialização.
//   - Integradas: default TRUE (permanentes; já valem antes de ler o Firestore
//     e mesmo se a leitura falhar). Um `false` explícito no Firestore ainda é
//     respeitado como válvula de emergência (ver FeatureFlagsContext).
//   - Opcionais: mantêm seu default declarado (false / OFF).
export const FEATURE_FLAG_DEFAULTS = FEATURE_FLAG_LIST.reduce((acc, flag) => {
    acc[flag.key] = isIntegratedFlag(flag.key) ? true : flag.default;
    return acc;
}, {});

// Categorias distintas (para agrupar na UI).
export const FEATURE_FLAG_CATEGORIES = [
    ...new Set(FEATURE_FLAG_LIST.map((f) => f.category)),
];
