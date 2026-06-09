// ============================================================================
// OrganizationPermissionsContext
// ----------------------------------------------------------------------------
// Disponibiliza, para a árvore de componentes da página de Organização, as
// permissões EFETIVAS do usuário atual naquele órgão (ver
// `src/constants/orgPermissions.js`).
//
// Objetivo: permitir que componentes profundos (ex.: diálogos de edição de
// processo/expediente) saibam se o usuário pode executar ações delegadas sem
// precisar repassar props por toda a árvore.
//
// ZERO QUEBRA:
//   - Default: nenhuma permissão (todas false). Se o provider não envolver o
//     componente, `useOrgPermission` retorna false e o comportamento atual
//     (apenas criador) é mantido pelas verificações de `userRole` existentes.
// ============================================================================

import React, { createContext, useContext, useMemo } from 'react';
import { getEffectivePermissions } from '@/constants/orgPermissions';

const OrganizationPermissionsContext = createContext({});

/**
 * Provider. Recebe o membership do usuário atual e expõe o mapa de permissões
 * efetivas.
 */
export const OrganizationPermissionsProvider = ({ membership, children }) => {
    const value = useMemo(() => getEffectivePermissions(membership), [membership]);
    return (
        <OrganizationPermissionsContext.Provider value={value}>
            {children}
        </OrganizationPermissionsContext.Provider>
    );
};

/** Retorna o mapa completo de permissões efetivas. */
export function useOrgPermissions() {
    return useContext(OrganizationPermissionsContext);
}

/**
 * Retorna se o usuário atual possui a permissão informada.
 * @param {string} key
 * @returns {boolean}
 */
export function useOrgPermission(key) {
    const permissions = useContext(OrganizationPermissionsContext);
    return permissions?.[key] === true;
}

export default OrganizationPermissionsContext;
