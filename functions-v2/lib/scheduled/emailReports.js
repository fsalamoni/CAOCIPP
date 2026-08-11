"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWeeklyOrgReport = exports.sendDailyUrgentSummary = void 0;
const admin = require("firebase-admin");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const email_1 = require("../shared/email");
// Destinatários de relatórios de um órgão: criador + administradores
// (mesmo critério usado no escalonamento automático).
async function getOrgAdminIds(orgId) {
    const db = admin.firestore();
    const membershipsSnap = await db.collection('userOrganizations')
        .where('organization_id', '==', orgId)
        .get();
    return Array.from(new Set(membershipsSnap.docs
        .map((d) => d.data())
        .filter((m) => m.role === 'creator' || m.role === 'admin')
        .map((m) => m.user_id)
        .filter(Boolean)));
}
async function countUrgentPending(orgId, collection) {
    const db = admin.firestore();
    const snap = await db.collection(collection)
        .where('organization_id', '==', orgId)
        .where('urgency_request', '==', true)
        .limit(1000)
        .get();
    return snap.docs.filter((d) => d.data().status !== 'Na pasta').length;
}
// Resumo diário de urgentes pendentes (flag `scheduled_email_reports`,
// organization.reportsConfig.dailySummaryEnabled).
exports.sendDailyUrgentSummary = (0, scheduler_1.onSchedule)({ schedule: 'every day 08:00', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' }, async () => {
    var _a, _b;
    const db = admin.firestore();
    const flagsSnap = await db.collection('platformConfig').doc('featureFlags').get();
    const flags = (((_a = flagsSnap.data()) === null || _a === void 0 ? void 0 : _a.flags) || {});
    if (flags.scheduled_email_reports !== true)
        return;
    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const org = orgDoc.data();
        if (!((_b = org.reportsConfig) === null || _b === void 0 ? void 0 : _b.dailySummaryEnabled))
            continue;
        // Isola falhas por órgão: um erro num órgão não deve impedir o
        // envio do resumo para os demais.
        try {
            const orgId = orgDoc.id;
            const [urgentProcesses, urgentExpedientes] = await Promise.all([
                countUrgentPending(orgId, 'processes'),
                countUrgentPending(orgId, 'expedientes'),
            ]);
            if (urgentProcesses === 0 && urgentExpedientes === 0)
                continue;
            const recipients = await getOrgAdminIds(orgId);
            const html = `
                    <h2>Resumo diário — ${org.name || 'Órgão'}</h2>
                    <p><strong>${urgentProcesses}</strong> Consulta(s) urgente(s) pendente(s).</p>
                    <p><strong>${urgentExpedientes}</strong> Expediente(s) urgente(s) pendente(s).</p>
                `;
            for (const userId of recipients) {
                const email = await (0, email_1.resolveUserEmail)(userId);
                if (!email)
                    continue;
                await (0, email_1.sendEmail)({ to: email, subject: `[SIGO] Resumo diário — ${org.name || 'Órgão'}`, html });
            }
        }
        catch (error) {
            console.error('[sendDailyUrgentSummary] falha no órgão', orgDoc.id, error);
        }
    }
});
// Relatório semanal do órgão (flag `scheduled_email_reports`,
// organization.reportsConfig.weeklyReportEnabled). Toda segunda-feira.
exports.sendWeeklyOrgReport = (0, scheduler_1.onSchedule)({ schedule: 'every monday 08:00', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' }, async () => {
    var _a, _b;
    const db = admin.firestore();
    const flagsSnap = await db.collection('platformConfig').doc('featureFlags').get();
    const flags = (((_a = flagsSnap.data()) === null || _a === void 0 ? void 0 : _a.flags) || {});
    if (flags.scheduled_email_reports !== true)
        return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const orgsSnap = await db.collection('organizations').get();
    for (const orgDoc of orgsSnap.docs) {
        const org = orgDoc.data();
        if (!((_b = org.reportsConfig) === null || _b === void 0 ? void 0 : _b.weeklyReportEnabled))
            continue;
        // Isola falhas por órgão: um erro num órgão não deve impedir o
        // envio do relatório para os demais.
        try {
            const orgId = orgDoc.id;
            const [newProcesses, newExpedientes, urgentProcesses, urgentExpedientes] = await Promise.all([
                db.collection('processes')
                    .where('organization_id', '==', orgId)
                    .where('created_at', '>=', sevenDaysAgo)
                    .limit(1000)
                    .get(),
                db.collection('expedientes')
                    .where('organization_id', '==', orgId)
                    .where('created_at', '>=', sevenDaysAgo)
                    .limit(1000)
                    .get(),
                countUrgentPending(orgId, 'processes'),
                countUrgentPending(orgId, 'expedientes'),
            ]);
            const finishedProcesses = newProcesses.docs.filter((d) => d.data().status === 'Na pasta').length;
            const finishedExpedientes = newExpedientes.docs.filter((d) => d.data().status === 'Na pasta').length;
            const recipients = await getOrgAdminIds(orgId);
            const html = `
                    <h2>Relatório semanal — ${org.name || 'Órgão'}</h2>
                    <p><strong>${newProcesses.size}</strong> Consulta(s) nova(s) nos últimos 7 dias (${finishedProcesses} já concluída(s)).</p>
                    <p><strong>${newExpedientes.size}</strong> Expediente(s) novo(s) nos últimos 7 dias (${finishedExpedientes} já concluído(s)).</p>
                    <p><strong>${urgentProcesses}</strong> Consulta(s) e <strong>${urgentExpedientes}</strong> Expediente(s) urgente(s) ainda pendente(s).</p>
                `;
            for (const userId of recipients) {
                const email = await (0, email_1.resolveUserEmail)(userId);
                if (!email)
                    continue;
                await (0, email_1.sendEmail)({ to: email, subject: `[SIGO] Relatório semanal — ${org.name || 'Órgão'}`, html });
            }
        }
        catch (error) {
            console.error('[sendWeeklyOrgReport] falha no órgão', orgDoc.id, error);
        }
    }
});
//# sourceMappingURL=emailReports.js.map