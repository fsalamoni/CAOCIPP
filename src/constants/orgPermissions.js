// ============================================================================
// Permissões especiais delegáveis pelo CRIADOR da organização.
//
// O criador (role === 'creator') sempre possui TODAS as permissões de forma
// implícita. Membros comuns (role !== 'creator') só possuem uma permissão
// quando ela está explicitamente marcada como `true` no mapa
// `permissions` do documento de membership (userOrganizations/{userId}_{orgId}).
//
// Este arquivo é a ÚNICA fonte da verdade no frontend. O equivalente no
// backend é `functions-v2/src/shared/permissions.ts` — mantenha as chaves
// em sincronia entre os dois arquivos.
// ============================================================================

/**
 * Definição das permissões delegáveis. A ordem é usada na interface.
 * @type {Array<{key:string,label:string,description:string}>}
 */
export const ORG_PERMISSIONS = [
    {
        key: 'edit_details',
        label: 'Editar detalhes',
        description: 'Editar nome e descrição da organização.',
    },
    {
        key: 'manage_matters',
        label: 'Configurar consultas e matérias',
        description: 'Criar, editar e excluir a classificação de matérias (configuração de consultas).',
    },
    {
        key: 'configure_expedientes',
        label: 'Configurar expedientes',
        description: 'Gerenciar os sistemas e as origens dos expedientes.',
    },
    {
        key: 'manage_metrics',
        label: 'Gerenciar métricas',
        description: 'Criar, editar e excluir as métricas do painel.',
    },
    {
        key: 'manage_modules',
        label: 'Gerenciar páginas e módulos',
        description: 'Criar, editar e excluir módulos e páginas personalizadas.',
    },
    {
        key: 'bulk_standardize',
        label: 'Padronização em bloco',
        description: 'Padronizar valores de campos em bloco.',
    },
    {
        key: 'delete_records',
        label: 'Excluir consultas e expedientes',
        description: 'Excluir consultas (processos) e expedientes.',
    },
];

/** Conjunto das chaves válidas para validação rápida. */
export const ORG_PERMISSION_KEYS = ORG_PERMISSIONS.map((p) => p.key);

/**
 * Mapa: aba do Painel Administrativo -> permissão necessária para acessá-la.
 * Abas não listadas aqui (membros, ia, perigo, atribuições) permanecem
 * exclusivas do criador.
 */
export const ADMIN_TAB_PERMISSION = {
    details: 'edit_details',
    matters: 'manage_matters',
    expedientes: 'configure_expedientes',
    metrics: 'manage_metrics',
    modules: 'manage_modules',
    padronizacao: 'bulk_standardize',
};

/**
 * Retorna o mapa de permissões efetivas para um membership.
 * O criador recebe todas as permissões; demais membros recebem apenas as
 * marcadas explicitamente.
 * @param {object|null|undefined} membership Documento de membership.
 * @returns {Record<string, boolean>}
 */
export function getEffectivePermissions(membership) {
    const result = {};
    const isCreator = membership?.role === 'creator';
    const granted = (membership && typeof membership.permissions === 'object' && membership.permissions) || {};
    for (const key of ORG_PERMISSION_KEYS) {
        result[key] = isCreator || granted[key] === true;
    }
    return result;
}

/**
 * Indica se o membership possui a permissão informada (criador sempre possui).
 * @param {object|null|undefined} membership
 * @param {string} key
 * @returns {boolean}
 */
export function hasOrgPermission(membership, key) {
    if (!key || !ORG_PERMISSION_KEYS.includes(key)) return false;
    if (membership?.role === 'creator') return true;
    return membership?.permissions?.[key] === true;
}

/**
 * Indica se o membership possui ao menos uma permissão administrativa
 * delegada (usado para liberar o acesso ao Painel Administrativo).
 * O criador sempre retorna true.
 * @param {object|null|undefined} membership
 * @returns {boolean}
 */
export function hasAnyAdminPermission(membership) {
    if (membership?.role === 'creator') return true;
    const granted = membership?.permissions;
    if (!granted || typeof granted !== 'object') return false;
    return ORG_PERMISSION_KEYS.some((key) => granted[key] === true);
}

/**
 * Sanitiza um mapa de permissões vindo da UI, mantendo apenas chaves válidas
 * e valores booleanos. Útil antes de enviar ao backend.
 * @param {Record<string, any>} input
 * @returns {Record<string, boolean>}
 */
export function sanitizePermissions(input) {
    const out = {};
    for (const key of ORG_PERMISSION_KEYS) {
        out[key] = input?.[key] === true;
    }
    return out;
}
