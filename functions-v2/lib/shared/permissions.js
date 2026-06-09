"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORG_PERMISSION_KEYS = void 0;
exports.hasOrgPermission = hasOrgPermission;
exports.sanitizePermissions = sanitizePermissions;
exports.ORG_PERMISSION_KEYS = [
    'edit_details',
    'manage_matters',
    'configure_expedientes',
    'manage_metrics',
    'manage_modules',
    'bulk_standardize',
    'delete_records',
];
/**
 * Indica se o membership possui a permissão informada. O criador sempre possui
 * todas as permissões.
 */
function hasOrgPermission(membership, key) {
    var _a;
    if (!membership)
        return false;
    if (membership.role === 'creator')
        return true;
    return ((_a = membership.permissions) === null || _a === void 0 ? void 0 : _a[key]) === true;
}
/**
 * Sanitiza um mapa de permissões recebido do cliente: mantém apenas as chaves
 * conhecidas e converte para booleano estrito. Qualquer chave desconhecida é
 * descartada e qualquer valor não-`true` vira `false`.
 */
function sanitizePermissions(input) {
    const source = (input && typeof input === 'object' ? input : {});
    const out = {};
    for (const key of exports.ORG_PERMISSION_KEYS) {
        out[key] = source[key] === true;
    }
    return out;
}
//# sourceMappingURL=permissions.js.map