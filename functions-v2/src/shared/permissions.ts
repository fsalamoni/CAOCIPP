// ============================================================================
// Permissões especiais delegáveis pelo CRIADOR da organização (lado servidor).
//
// Espelha `src/constants/orgPermissions.js` no frontend. Mantenha as chaves
// em sincronia entre os dois arquivos.
//
// Regra geral de autorização adotada nas Cloud Functions:
//   - role === 'creator'  => possui TODAS as permissões implicitamente.
//   - demais memberships  => só possuem a permissão se membership.permissions[key] === true.
// ============================================================================

export type OrgPermissionKey =
    | 'edit_details'
    | 'manage_matters'
    | 'configure_expedientes'
    | 'manage_metrics'
    | 'manage_modules'
    | 'bulk_standardize'
    | 'delete_records';

export const ORG_PERMISSION_KEYS: OrgPermissionKey[] = [
    'edit_details',
    'manage_matters',
    'configure_expedientes',
    'manage_metrics',
    'manage_modules',
    'bulk_standardize',
    'delete_records',
];

/**
 * Estrutura mínima de um membership relevante para autorização.
 */
export interface MembershipLike {
    role?: string;
    permissions?: Record<string, unknown>;
}

/**
 * Indica se o membership possui a permissão informada. O criador sempre possui
 * todas as permissões.
 */
export function hasOrgPermission(
    membership: MembershipLike | undefined | null,
    key: OrgPermissionKey
): boolean {
    if (!membership) return false;
    if (membership.role === 'creator') return true;
    return membership.permissions?.[key] === true;
}

/**
 * Sanitiza um mapa de permissões recebido do cliente: mantém apenas as chaves
 * conhecidas e converte para booleano estrito. Qualquer chave desconhecida é
 * descartada e qualquer valor não-`true` vira `false`.
 */
export function sanitizePermissions(
    input: unknown
): Record<OrgPermissionKey, boolean> {
    const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const out = {} as Record<OrgPermissionKey, boolean>;
    for (const key of ORG_PERMISSION_KEYS) {
        out[key] = source[key] === true;
    }
    return out;
}
