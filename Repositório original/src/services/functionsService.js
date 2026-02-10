import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase'; // Ensure you have functions exported from firebase config
import { logger } from '@/utils/logger';

// Organization Functions
export const createOrganization = async (data) => {
    try {
        const createOrgFn = httpsCallable(functions, 'createOrganization');
        const result = await createOrgFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling createOrganization:', error);
        throw error;
    }
};

export const joinOrganization = async (inviteCode) => {
    try {
        const joinOrgFn = httpsCallable(functions, 'joinOrganization');
        const result = await joinOrgFn({ inviteCode });
        return result.data;
    } catch (error) {
        logger.error('Error calling joinOrganization:', error);
        throw error;
    }
};

export const removeMember = async (organizationId, userIdToRemove) => {
    try {
        const removeMemberFn = httpsCallable(functions, 'removeMember');
        const result = await removeMemberFn({ organizationId, userIdToRemove });
        return result.data;
    } catch (error) {
        logger.error('Error calling removeMember:', error);
        throw error;
    }
};

export const updateMember = async (data) => {
    try {
        // data: { organizationId, userIdToUpdate, newRole?, newFunction? }
        const updateMemberFn = httpsCallable(functions, 'updateMember');
        const result = await updateMemberFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling updateMember:', error);
        throw error;
    }
};

export const clearOrganizationData = async (organizationId) => {
    try {
        const clearDataFn = httpsCallable(functions, 'clearOrganizationData');
        const result = await clearDataFn({ organizationId });
        return result.data;
    } catch (error) {
        logger.error('Error calling clearOrganizationData:', error);
        throw error;
    }
};

// Process Functions
export const createProcess = async (data) => {
    try {
        const createProcessFn = httpsCallable(functions, 'createProcess');
        const result = await createProcessFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling createProcess:', error);
        throw error;
    }
};

export const updateProcess = async (data) => {
    try {
        const updateProcessFn = httpsCallable(functions, 'updateProcess');
        const result = await updateProcessFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling updateProcess:', error);
        throw error;
    }
};

export const deleteProcess = async (id) => {
    try {
        const deleteProcessFn = httpsCallable(functions, 'deleteProcess');
        const result = await deleteProcessFn({ id });
        return result.data;
    } catch (error) {
        logger.error('Error calling deleteProcess:', error);
        throw error;
    }
};

export const archiveProcess = async (id) => {
    try {
        const archiveProcessFn = httpsCallable(functions, 'archiveProcess');
        const result = await archiveProcessFn({ id });
        return result.data;
    } catch (error) {
        logger.error('Error calling archiveProcess:', error);
        throw error;
    }
};

// Import Functions
export const importProcessesFromExcel = async (data) => {
    try {
        // CRITICAL: Get auth instance to verify user is authenticated
        const { auth } = await import('@/config/firebase');

        // 1. Check if user exists
        if (!auth.currentUser) {
            console.error('[importProcessesFromExcel] ❌ No currentUser');
            throw new Error('Você precisa estar autenticado para importar processos');
        }

        console.log('[importProcessesFromExcel] ✅ User authenticated:', auth.currentUser.email);

        // 2. Force token refresh (prevents "expired token" issues)
        try {
            const token = await auth.currentUser.getIdToken(true); // true = force refresh
            console.log('[importProcessesFromExcel] ✅ Token refreshed, length:', token.length);
        } catch (tokenError) {
            console.error('[importProcessesFromExcel] ❌ Token refresh failed:', tokenError);
            throw new Error('Erro ao renovar autenticação. Faça login novamente.');
        }

        // 3. Call function (now with fresh token)
        console.log('[importProcessesFromExcel] 📤 Calling Cloud Function with data:', {
            organizationId: data.organizationId,
            fileDataLength: data.fileData?.length || 0
        });

        const importFn = httpsCallable(functions, 'importProcessesFromExcel');
        const result = await importFn(data);

        console.log('[importProcessesFromExcel] ✅ Success:', result.data);
        return result.data;
    } catch (error) {
        console.error('[importProcessesFromExcel] ❌ Error:', {
            code: error.code,
            message: error.message,
            details: error.details
        });
        logger.error('Error calling importProcessesFromExcel:', error);
        throw error;
    }
};

export const updateProfile = async (data) => {
    try {
        const updateProfileFn = httpsCallable(functions, 'updateProfile');
        const result = await updateProfileFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling updateProfile:', error);
        throw error;
    }
};
