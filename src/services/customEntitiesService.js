// ============================================================================
// customEntitiesService — wrappers para as Cloud Functions de entidades custom
// ============================================================================
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { logger } from '@/utils/logger';

async function call(name, payload, options) {
    try {
        const fn = httpsCallable(functions, name, options);
        const result = await fn(payload);
        return result.data;
    } catch (error) {
        logger.error(`Error calling ${name}:`, error);
        throw error;
    }
}

export const upsertEntityType = (organizationId, entityType) =>
    call('upsertEntityType', { organizationId, entityType });

export const deleteEntityType = (organizationId, entityTypeId) =>
    call('deleteEntityType', { organizationId, entityTypeId });

export const createRecord = (organizationId, entityTypeId, values, phase) =>
    call('createRecord', { organizationId, entityTypeId, values, phase });

export const updateRecord = (payload) =>
    // payload: { organizationId, recordId, values?, phase?, comment? }
    call('updateRecord', payload);

export const deleteRecord = (organizationId, recordId) =>
    call('deleteRecord', { organizationId, recordId });

export const importRecords = (organizationId, entityTypeId, rows) =>
    // rows: [{ values: {fieldKey: value}, phase? }]
    call('importRecords', { organizationId, entityTypeId, rows }, { timeout: 540000 });
