// ============================================================================
// FEATURE FLAGS - Catálogo central de flags da plataforma
// ----------------------------------------------------------------------------
// IMPORTANTE (segurança / zero quebra):
//   - Toda flag tem DEFAULT = false (OFF).
//   - Flag OFF significa SEMPRE o comportamento atual do sistema.
//   - Nenhuma flag ligada por padrão. Você habilita na página de Administração.
//   - O caminho antigo permanece intacto como fallback para cada flag.
//
// Estrutura: cada flag possui chave estável (key) + metadados para a UI.
// A persistência fica em Firestore: platformConfig/featureFlags (global)
// e organizations/{id}.featureFlags (override por órgão, opcional).
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
};

// Lista plana das flags para iteração em UI.
export const FEATURE_FLAG_LIST = Object.values(FEATURE_FLAGS);

// Mapa { key: default } para inicialização segura.
export const FEATURE_FLAG_DEFAULTS = FEATURE_FLAG_LIST.reduce((acc, flag) => {
    acc[flag.key] = flag.default;
    return acc;
}, {});

// Categorias distintas (para agrupar na UI).
export const FEATURE_FLAG_CATEGORIES = [
    ...new Set(FEATURE_FLAG_LIST.map((f) => f.category)),
];
