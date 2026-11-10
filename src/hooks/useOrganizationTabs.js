import { useMemo } from 'react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { getOrganizationTabs } from '@/lib/organizationModules';
import { hasAnyAdminPermission } from '@/constants/orgPermissions';
import { useEntityTypes } from '@/hooks/useCustomEntities';

/**
 * Abas que a pessoa vê num órgão: as mesmas na barra horizontal, no sub-menu
 * lateral e no tour, em qualquer página do órgão (inclusive o Processo
 * Eletrônico). `membership` traz `role` e `permissions` do vínculo; o Painel
 * Administrativo só aparece para criador ou quem tem permissão de admin.
 * Sem órgão, devolve lista vazia.
 */
export function useOrganizationTabs(organization, membership) {
    const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);
    const deadlineCalendarOn = useFlag(FEATURE_FLAGS.DEADLINE_CALENDAR.key);
    const parceriasOn = useFlag(FEATURE_FLAGS.PARCERIAS.key);
    const jurimetriaOn = useFlag(FEATURE_FLAGS.JURIMETRIA.key);
    const panoramaOn = useFlag(FEATURE_FLAGS.PANORAMA.key);
    const { entityTypes: customTypes } = useEntityTypes(customEntitiesOn ? organization?.id : null);
    const role = membership?.role;
    const permissions = membership?.permissions;

    return useMemo(() => {
        if (!organization) return [];
        const podeAdmin = role === 'creator' || hasAnyAdminPermission({ role, permissions });
        return getOrganizationTabs(organization, { customEntitiesOn, customTypes, deadlineCalendarOn, parceriasOn, jurimetriaOn, panoramaOn })
            .filter((tab) => !tab.creatorOnly || podeAdmin);
    }, [organization, role, permissions, customEntitiesOn, customTypes, deadlineCalendarOn, parceriasOn, jurimetriaOn, panoramaOn]);
}
