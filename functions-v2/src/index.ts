import * as admin from 'firebase-admin';

admin.initializeApp();

// Export function modules
export { createOrganization } from './organizations/create';
export { getUserOrganizations } from './organizations/getUser';
export { joinOrganization } from './organizations/join';
export { removeMember } from './organizations/removeMember';
export { updateMember } from './organizations/updateMember';
export { clearOrganizationData } from './organizations/clearData';
export { deleteOrganization } from './organizations/delete';
export { updateOrganization } from './organizations/update';
export { bulkReplaceFieldValues } from './organizations/bulkReplaceFieldValues';

export { createProcess } from './processes/create';
export { updateProcess } from './processes/update';
export { deleteProcess } from './processes/delete';
export { calculateProcessStatus } from './processes/calculateStatus';
export { backfillProcessLogs } from './processes/backfillLogs';

export { updateProfile } from './user/updateProfile';
export { migrateMemberFunctions } from './user/migrateMemberFunctions';

export { importProcessesFromExcel } from './import/fromExcel';

export { createExpediente } from './expedientes/create';
export { updateExpediente } from './expedientes/update';
export { deleteExpediente } from './expedientes/delete';
export { importExpedientesFromExcel } from './import/fromExcelExpedientes';

// ========== PARCERIAS (Convênio, Termo de Cooperação, Termo de Fomento) ==========
// Módulo novo (v1.16.0) com 6 fases próprias (Pendente, Em análise, Revisão,
// Aguarda Terceiros, Parcerias, Extintos) e suporte a aditivos em subcoleção.
export { createParceria } from './parcerias/create';
export { updateParceria } from './parcerias/update';
export { deleteParceria } from './parcerias/delete';
export { addAditivo } from './parcerias/addAditivo';
export { updateAditivo } from './parcerias/updateAditivo';
export { deleteAditivo } from './parcerias/deleteAditivo';
export { extinguishParceria } from './parcerias/extinguish';
export { importParceriasFromExcel } from './import/fromExcelParcerias';

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
export { getSetupStatus } from './platform/setupStatus';

// ========== Páginas e processos personalizados (flag: custom_entities) ==========
export { upsertEntityType, deleteEntityType } from './customEntities/entityTypes';
export { createRecord, updateRecord, deleteRecord, importRecords } from './customEntities/records';

// ========== Colaboração (flag: process_comments) ==========
export { addComment } from './collaboration/comments';

// ========== Automação em segundo plano (Fase 4) ==========
// As 3 funções agendadas abaixo (onSchedule) exigem a API
// cloudscheduler.googleapis.com, que NÃO está habilitada neste projeto GCP —
// e a conta de serviço do deploy automático não tem permissão para
// habilitá-la sozinha (erro "Permissions denied enabling
// cloudscheduler.googleapis.com" no deploy). Isso faz o `firebase deploy`
// abortar TODO o restante (hosting + demais functions + firestore), não só
// estas 3. Comentadas temporariamente para o resto do deploy ter sucesso.
//
// Para reativar: um dono do projeto GCP habilita a API em
// https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com
// (ou roda `gcloud services enable cloudscheduler.googleapis.com --project=<id>`),
// depois é só descomentar as 3 linhas abaixo e fazer o deploy de novo.
// export { autoEscalateStalledUrgent } from './scheduled/autoEscalation';
// export { sendDailyUrgentSummary, sendWeeklyOrgReport } from './scheduled/emailReports';
export { getEmailProviderConfig, setEmailProviderConfig } from './platform/emailProvider';

// ========== Segurança, conformidade e integrações (Fase 5) ==========
export { logAccess, getOrgAccessLog } from './security/accessLog';
export { previewAnonymization, runAnonymization } from './security/anonymization';
export { sendLoginOtp, verifyLoginOtp } from './security/twoFactor';
export { testOrgWebhook } from './security/webhookTest';
