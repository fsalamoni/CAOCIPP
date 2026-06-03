import * as admin from 'firebase-admin';

admin.initializeApp();

// Export function modules
export { createOrganization } from './organizations/create';
export { getUserOrganizations } from './organizations/getUser';
export { joinOrganization } from './organizations/join';
export { removeMember } from './organizations/removeMember';
export { updateMember } from './organizations/updateMember';
export { clearOrganizationData } from './organizations/clearData';
export { updateOrganization } from './organizations/update';
export { bulkReplaceFieldValues } from './organizations/bulkReplaceFieldValues';

export { createProcess } from './processes/create';
export { updateProcess } from './processes/update';
export { deleteProcess } from './processes/delete';
export { calculateProcessStatus } from './processes/calculateStatus';
export { backfillProcessLogs } from './processes/backfillLogs';

export { updateProfile } from './user/updateProfile';

export { importProcessesFromExcel } from './import/fromExcel';

export { createExpediente } from './expedientes/create';
export { updateExpediente } from './expedientes/update';
export { deleteExpediente } from './expedientes/delete';
export { importExpedientesFromExcel } from './import/fromExcelExpedientes';

// ========== PLATAFORMA: Administração & Custos (super-admin) ==========
export { getPlatformOverview } from './platform/overview';
export { getFeatureFlags, setFeatureFlag } from './platform/featureFlags';
export {
    grantPlatformAdmin,
    revokePlatformAdmin,
    listPlatformAdmins,
} from './platform/adminClaims';
export { getCostReport } from './platform/costs';
// Onda 2: Órgãos, Usuários, Movimentações, Footprint
export { getOrgsReport } from './platform/orgs';
export { listPlatformUsers } from './platform/users';
export { getActivityFeed } from './platform/activity';
export { getStorageFootprint } from './platform/footprint';
// Onda 3: Cotas, Saúde do sistema, Ferramentas de dados
export { getPlatformQuotas, setPlatformQuota } from './platform/quotas';
export { getSystemHealth } from './platform/health';
export { runIntegrityAudit, recalcOrgStats } from './platform/dataTools';
export { backfillHistory } from './platform/historyBackfill';

// ========== Páginas e processos personalizados (flag: custom_entities) ==========
export { upsertEntityType, deleteEntityType } from './customEntities/entityTypes';
export { createRecord, updateRecord, deleteRecord, importRecords } from './customEntities/records';
