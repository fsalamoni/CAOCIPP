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

// Import Functions
export const importProcessesFromExcel = async (data) => {
    try {
        // data: { organizationId, fileData (base64) }
        const importFn = httpsCallable(functions, 'importProcessesFromExcel');
        const result = await importFn(data);
        return result.data;
    } catch (error) {
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
