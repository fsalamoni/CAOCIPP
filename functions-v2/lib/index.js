"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
admin.initializeApp();
/**
 * Export preguiçoso: cada função do Cloud Functions roda numa instância
 * própria, que carrega este index. Com `export { x } from './y'` toda
 * instância carregava os ~70 módulos (e as bibliotecas de PDF, Word e Excel)
 * antes de responder, o que pesava em cada partida a frio. O getter só
 * carrega o módulo da função chamada; a descoberta do deploy
 * (`Object.entries` do firebase-functions) lê todos os exports, como antes.
 */
function preguicoso(carregar, nomes) {
    for (const nome of nomes) {
        Object.defineProperty(exports, nome, { enumerable: true, get: () => carregar()[nome] });
    }
}
// Export function modules
preguicoso(() => require('./organizations/create'), ['createOrganization']);
preguicoso(() => require('./organizations/getUser'), ['getUserOrganizations']);
preguicoso(() => require('./organizations/join'), ['joinOrganization']);
preguicoso(() => require('./organizations/removeMember'), ['removeMember']);
preguicoso(() => require('./organizations/updateMember'), ['updateMember']);
preguicoso(() => require('./organizations/clearData'), ['clearOrganizationData']);
preguicoso(() => require('./organizations/delete'), ['deleteOrganization']);
preguicoso(() => require('./organizations/update'), ['updateOrganization']);
preguicoso(() => require('./organizations/bulkReplaceFieldValues'), ['bulkReplaceFieldValues']);
preguicoso(() => require('./processes/create'), ['createProcess']);
preguicoso(() => require('./processes/update'), ['updateProcess']);
preguicoso(() => require('./processes/delete'), ['deleteProcess']);
preguicoso(() => require('./processes/calculateStatus'), ['calculateProcessStatus']);
preguicoso(() => require('./processes/backfillLogs'), ['backfillProcessLogs']);
preguicoso(() => require('./user/updateProfile'), ['updateProfile']);
preguicoso(() => require('./user/migrateMemberFunctions'), ['migrateMemberFunctions']);
preguicoso(() => require('./import/fromExcel'), ['importProcessesFromExcel']);
preguicoso(() => require('./expedientes/create'), ['createExpediente']);
preguicoso(() => require('./expedientes/update'), ['updateExpediente']);
preguicoso(() => require('./expedientes/delete'), ['deleteExpediente']);
preguicoso(() => require('./import/fromExcelExpedientes'), ['importExpedientesFromExcel']);
// ========== PARCERIAS (Convênio, Termo de Cooperação, Termo de Fomento) ==========
// Módulo novo (v1.16.0) com 6 fases próprias (Pendente, Em análise, Revisão,
// Aguarda Terceiros, Parcerias, Extintos) e suporte a aditivos em subcoleção.
preguicoso(() => require('./parcerias/create'), ['createParceria']);
preguicoso(() => require('./parcerias/update'), ['updateParceria']);
preguicoso(() => require('./parcerias/delete'), ['deleteParceria']);
preguicoso(() => require('./parcerias/addAditivo'), ['addAditivo']);
preguicoso(() => require('./parcerias/updateAditivo'), ['updateAditivo']);
preguicoso(() => require('./parcerias/concludeAditivo'), ['concludeAditivo']);
preguicoso(() => require('./parcerias/deleteAditivo'), ['deleteAditivo']);
preguicoso(() => require('./parcerias/extinguish'), ['extinguishParceria']);
preguicoso(() => require('./import/fromExcelParcerias'), ['importParceriasFromExcel']);
// ========== JURIMETRIA (base de júris do órgão — flag: jurimetria_enabled) ==========
// Módulo de jurimetria: base própria de júris por órgão, com importação
// idempotente de planilha (pré-visualização + confirmação), CRUD, atualização
// em massa e exclusão. As listas oficiais, a tabela de pontuação e as colunas
// personalizadas ficam em `organization.jurimetriaSettings` (ver
// shared/jurimetria.ts), gravadas por updateOrganization.
preguicoso(() => require('./juris/create'), ['createJuri']);
preguicoso(() => require('./juris/update'), ['updateJuri']);
preguicoso(() => require('./juris/delete'), ['deleteJuris']);
preguicoso(() => require('./juris/bulkUpdate'), ['bulkUpdateJuris']);
// Modelos de relatório dinâmico, compartilhados dentro do órgão: todos usam,
// só o autor e quem administra o módulo editam ou excluem.
preguicoso(() => require('./jurimetriaTemplates/manage'), ['manageJurimetriaTemplate']);
// ========== PANORAMA (bases analíticas do órgão — flag: panorama_enabled) ==========
// Módulo coringa: o ESQUEMA de cada base vem da planilha importada, não do
// código. A importação detecta as colunas, mede cada uma e propõe o papel
// semântico (identificador, data, unidade, responsável, assunto, desfecho,
// situação, valor, prazo); a partir daí a maquinaria analítica funciona sobre
// qualquer área de atuação do MP. Ver shared/panorama.ts.
preguicoso(() => require('./panorama/bases'), ['managePanoramaBase']);
preguicoso(() => require('./panorama/registros'), ['managePanoramaRegistro']);
preguicoso(() => require('./panorama/importar'), ['importPanorama']);
preguicoso(() => require('./panorama/templates'), ['managePanoramaTemplate']);
preguicoso(() => require('./import/fromExcelJuris'), ['importJurisFromExcel']);
// ========== SECRETARIA PROCESSUAL (processo eletrônico; ligada pelo admin do órgão) ==========
// Unidades, ritos, autuação, tramitação, documentos (editor e upload),
// assinatura simples, juntada e exportação dos autos em PDF. Todas as leituras
// e escritas passam por aqui; as coleções sec* são fechadas ao cliente.
preguicoso(() => require('./secretaria/config'), ['secretariaConfig']);
preguicoso(() => require('./secretaria/processos'), ['secretariaProcesso']);
preguicoso(() => require('./secretaria/documentos'), ['secretariaDocumento']);
preguicoso(() => require('./secretaria/exportar'), ['secretariaExportarPdf']);
preguicoso(() => require('./secretaria/portal'), ['secretariaPortal']);
preguicoso(() => require('./secretaria/plataforma'), ['secretariaPlataforma']);
preguicoso(() => require('./secretaria/conferir'), ['secretariaConferir', 'secretariaAlertaPrazos']);
// ========== PLATAFORMA: Administração & Custos (super-admin) ==========
preguicoso(() => require('./platform/overview'), ['getPlatformOverview']);
preguicoso(() => require('./platform/featureFlags'), ['getFeatureFlags', 'setFeatureFlag']);
preguicoso(() => require('./platform/adminClaims'), ['grantPlatformAdmin', 'revokePlatformAdmin', 'listPlatformAdmins']);
preguicoso(() => require('./platform/costs'), ['getCostReport']);
// Onda 2: Órgãos, Usuários, Movimentações, Footprint
preguicoso(() => require('./platform/orgs'), ['getOrgsReport']);
preguicoso(() => require('./platform/orgAdmin'), ['platformOrg']);
preguicoso(() => require('./platform/userAdmin'), ['platformUser']);
preguicoso(() => require('./platform/branding'), ['platformBranding']);
preguicoso(() => require('./platform/activity'), ['getActivityFeed']);
preguicoso(() => require('./platform/footprint'), ['getStorageFootprint']);
// Onda 3: Cotas, Saúde do sistema, Ferramentas de dados
preguicoso(() => require('./platform/quotas'), ['getPlatformQuotas', 'setPlatformQuota']);
preguicoso(() => require('./platform/health'), ['getSystemHealth']);
preguicoso(() => require('./platform/dataTools'), ['runIntegrityAudit', 'recalcOrgStats']);
preguicoso(() => require('./platform/historyBackfill'), ['backfillHistory']);
preguicoso(() => require('./platform/setupStatus'), ['getSetupStatus']);
// ========== Páginas e processos personalizados (flag: custom_entities) ==========
preguicoso(() => require('./customEntities/entityTypes'), ['upsertEntityType', 'deleteEntityType']);
preguicoso(() => require('./customEntities/records'), ['createRecord', 'updateRecord', 'deleteRecord', 'importRecords']);
// ========== Colaboração (flag: process_comments) ==========
preguicoso(() => require('./collaboration/comments'), ['addComment']);
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
// Item 7/8 do plano: cria aditivo automático quando o aviso de renovação
// (parceria com prazo determinado) ou o aviso de revisão (parceria com
// prazo indeterminado) é atingido. Roda 1x por dia às 03:00 horário de Brasília.
// Comentada: API cloudscheduler.googleapis.com está habilitada, mas a
// service account do CI ainda não tem o papel "Cloud Scheduler Admin"
// (permissão cloudscheduler.jobs.update). O owner precisa conceder
// essa permissão à service account. Enquanto isso, schema/UI estão
// funcionais.
preguicoso(() => require('./scheduled/checkPartnershipNoticeDeadlines'), ['checkPartnershipNoticeDeadlines']);
preguicoso(() => require('./platform/emailProvider'), ['getEmailProviderConfig', 'setEmailProviderConfig']);
// ========== Segurança, conformidade e integrações (Fase 5) ==========
preguicoso(() => require('./security/accessLog'), ['logAccess', 'getOrgAccessLog']);
preguicoso(() => require('./security/anonymization'), ['previewAnonymization', 'runAnonymization']);
preguicoso(() => require('./security/twoFactor'), ['sendLoginOtp', 'verifyLoginOtp']);
preguicoso(() => require('./security/webhookTest'), ['testOrgWebhook']);
//# sourceMappingURL=index.js.map