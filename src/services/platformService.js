// ============================================================================
// platformService - Chamadas às Cloud Functions de plataforma (super-admin)
// ----------------------------------------------------------------------------
// Todas as funções revalidam o papel de super-admin no servidor.
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

// Visão geral / KPIs globais
export const getPlatformOverview = () => call('getPlatformOverview');

// Feature flags
export const getFeatureFlags = () => call('getFeatureFlags');
export const setFeatureFlag = (flagKey, enabled) =>
    call('setFeatureFlag', { flagKey, enabled });

// Super-admins
export const grantPlatformAdmin = (email) => call('grantPlatformAdmin', { email });
export const revokePlatformAdmin = (uid) => call('revokePlatformAdmin', { uid });
export const listPlatformAdmins = () => call('listPlatformAdmins');

// Custos (Billing via BigQuery)
export const getCostReport = (days = 30) =>
    call('getCostReport', { days }, { timeout: 120000 });

// --- Onda 2: Órgãos, Usuários, Movimentações, Footprint ---
export const getOrgsReport = (limit = 200) =>
    call('getOrgsReport', { limit }, { timeout: 120000 });
export const listPlatformUsers = (pageToken) =>
    call('listPlatformUsers', { pageToken }, { timeout: 120000 });
export const getActivityFeed = (params = {}) =>
    call('getActivityFeed', params);
export const getStorageFootprint = () =>
    call('getStorageFootprint', undefined, { timeout: 120000 });

// --- Onda 3: Cotas, Saúde do sistema, Ferramentas de dados ---
export const getPlatformQuotas = () => call('getPlatformQuotas');
export const setPlatformQuota = (quotaKey, value) =>
    call('setPlatformQuota', { quotaKey, value });
export const getSystemHealth = () =>
    call('getSystemHealth', undefined, { timeout: 120000 });
export const runIntegrityAudit = (limit = 200) =>
    call('runIntegrityAudit', { limit }, { timeout: 120000 });
export const recalcOrgStats = (organizationId) =>
    call('recalcOrgStats', { organizationId });

// Exclusão permanente de um órgão e todo o seu banco de dados (super-admin).
// A mesma Cloud Function valida criador OU super-admin e exige o nome exato.
export const deleteOrganization = (organizationId, confirmName) =>
    call('deleteOrganization', { organizationId, confirmName }, { timeout: 540000 });

// --- Fase 3: backfill do histórico (array activity_log -> subcoleção history) ---
// verifyOnly=true não escreve nada (apenas audita paridade). Sem verifyOnly,
// copia as entradas (idempotente). Paginação por lote via startAfter/lastDocId.
export const backfillHistory = ({ organizationId, collection, startAfter = null, batchDocs = 200, verifyOnly = false }) =>
    call('backfillHistory', { organizationId, collection, startAfter, batchDocs, verifyOnly }, { timeout: 540000 });
