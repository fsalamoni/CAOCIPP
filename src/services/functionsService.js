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
        const joinOrgFn = httpsCallable(functions, 'joinOrganization', { timeout: 600000 });
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

export const deleteOrganization = async ({ organizationId, confirmName }) => {
    try {
        const deleteOrgFn = httpsCallable(functions, 'deleteOrganization', { timeout: 540000 });
        const result = await deleteOrgFn({ organizationId, confirmName });
        return result.data;
    } catch (error) {
        logger.error('Error calling deleteOrganization:', error);
        throw error;
    }
};

export const updateOrganization = async (data) => {
    try {
        // data: { organizationId, data: { name?, description?, matterSettings?, summarySettings? } }
        const updateOrgFn = httpsCallable(functions, 'updateOrganization');
        const result = await updateOrgFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling updateOrganization:', error);
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

export const deleteProcess = async ({ id, organizationId }) => {
    try {
        const deleteProcessFn = httpsCallable(functions, 'deleteProcess');
        const result = await deleteProcessFn({ id, organizationId });
        return result.data;
    } catch (error) {
        logger.error('Error calling deleteProcess:', error);
        throw error;
    }
};

/**
 * Archives a process by setting its archived_date to now
 * Note: Cloud Function 'archiveProcess' was consolidated into 'updateProcess'
 */
export const archiveProcess = async ({ id, organizationId }) => {
    try {
        const now = new Date().toISOString().split('T')[0];
        return await updateProcess({
            id,
            organizationId,
            changes: {
                archived_date: now,
                status: 'Na pasta'
            }
        });
    } catch (error) {
        logger.error('Error in archiveProcess:', error);
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

        const importFn = httpsCallable(functions, 'importProcessesFromExcel', { timeout: 600000 });
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

export const backfillProcessLogs = async (organizationId) => {
    try {
        const backfillFn = httpsCallable(functions, 'backfillProcessLogs', { timeout: 600000 });
        const result = await backfillFn({ organizationId });
        return result.data;
    } catch (error) {
        logger.error('Error calling backfillProcessLogs:', error);
        throw error;
    }
};

// ========== EXPEDIENTE FUNCTIONS ==========

export const createExpediente = async (data) => {
    try {
        const createExpedienteFn = httpsCallable(functions, 'createExpediente');
        const result = await createExpedienteFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling createExpediente:', error);
        throw error;
    }
};

export const updateExpediente = async (data) => {
    try {
        const updateExpedienteFn = httpsCallable(functions, 'updateExpediente');
        const result = await updateExpedienteFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling updateExpediente:', error);
        throw error;
    }
};

export const deleteExpediente = async ({ id, organizationId }) => {
    try {
        const deleteExpedienteFn = httpsCallable(functions, 'deleteExpediente');
        const result = await deleteExpedienteFn({ id, organizationId });
        return result.data;
    } catch (error) {
        logger.error('Error calling deleteExpediente:', error);
        throw error;
    }
};

export const archiveExpediente = async ({ id, organizationId }) => {
    try {
        const now = new Date().toISOString().split('T')[0];
        return await updateExpediente({
            id,
            organizationId,
            changes: {
                archived_date: now,
                status: 'Na pasta'
            }
        });
    } catch (error) {
        logger.error('Error in archiveExpediente:', error);
        throw error;
    }
};

export const importExpedientesFromExcel = async (data) => {
    try {
        const { auth } = await import('@/config/firebase');

        if (!auth.currentUser) {
            throw new Error('Você precisa estar autenticado para importar expedientes');
        }

        try {
            await auth.currentUser.getIdToken(true);
        } catch (tokenError) {
            throw new Error('Erro ao renovar autenticação. Faça login novamente.');
        }

        const importFn = httpsCallable(functions, 'importExpedientesFromExcel', { timeout: 600000 });
        const result = await importFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling importExpedientesFromExcel:', error);
        throw error;
    }
};

export const bulkReplaceFieldValues = async (data) => {
    try {
        const replaceFn = httpsCallable(functions, 'bulkReplaceFieldValues', { timeout: 600000 });
        const result = await replaceFn(data);
        return result.data;
    } catch (error) {
        logger.error('Error calling bulkReplaceFieldValues:', error);
        throw error;
    }
};
