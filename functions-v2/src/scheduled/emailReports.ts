import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sendEmail, resolveUserEmail, EMAIL_API_KEY } from '../shared/email';

// Destinatários de relatórios de um órgão: criador + administradores
// (mesmo critério usado no escalonamento automático).
async function getOrgAdminIds(orgId: string): Promise<string[]> {
    const db = admin.firestore();
    const membershipsSnap = await db.collection('userOrganizations')
        .where('organization_id', '==', orgId)
        .get();
    return Array.from(new Set(
        membershipsSnap.docs
            .map((d) => d.data())
            .filter((m) => m.role === 'creator' || m.role === 'admin')
            .map((m) => m.user_id)
            .filter(Boolean)
    ));
}

async function countUrgentPending(orgId: string, collection: string): Promise<number> {
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
export const sendDailyUrgentSummary = onSchedule(
    { schedule: 'every day 08:00', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1', secrets: [EMAIL_API_KEY] },
    async () => {
        const db = admin.firestore();

        const flagsSnap = await db.collection('platformConfig').doc('featureFlags').get();
        const flags = (flagsSnap.data()?.flags || {}) as Record<string, boolean>;
        if (flags.scheduled_email_reports !== true) return;

        const orgsSnap = await db.collection('organizations').get();

        for (const orgDoc of orgsSnap.docs) {
            const org = orgDoc.data();
            if (!org.reportsConfig?.dailySummaryEnabled) continue;

            const orgId = orgDoc.id;
            const [urgentProcesses, urgentExpedientes] = await Promise.all([
                countUrgentPending(orgId, 'processes'),
                countUrgentPending(orgId, 'expedientes'),
            ]);

            if (urgentProcesses === 0 && urgentExpedientes === 0) continue;

            const recipients = await getOrgAdminIds(orgId);
            const html = `
                <h2>Resumo diário — ${org.name || 'Órgão'}</h2>
                <p><strong>${urgentProcesses}</strong> Consulta(s) urgente(s) pendente(s).</p>
                <p><strong>${urgentExpedientes}</strong> Expediente(s) urgente(s) pendente(s).</p>
            `;

            for (const userId of recipients) {
                const email = await resolveUserEmail(userId);
                if (!email) continue;
                await sendEmail({ to: email, subject: `[Consultas CAO] Resumo diário — ${org.name || 'Órgão'}`, html });
            }
        }
    }
);

// Relatório semanal do órgão (flag `scheduled_email_reports`,
// organization.reportsConfig.weeklyReportEnabled). Toda segunda-feira.
export const sendWeeklyOrgReport = onSchedule(
    { schedule: 'every monday 08:00', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1', secrets: [EMAIL_API_KEY] },
    async () => {
        const db = admin.firestore();

        const flagsSnap = await db.collection('platformConfig').doc('featureFlags').get();
        const flags = (flagsSnap.data()?.flags || {}) as Record<string, boolean>;
        if (flags.scheduled_email_reports !== true) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const orgsSnap = await db.collection('organizations').get();

        for (const orgDoc of orgsSnap.docs) {
            const org = orgDoc.data();
            if (!org.reportsConfig?.weeklyReportEnabled) continue;

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
                const email = await resolveUserEmail(userId);
                if (!email) continue;
                await sendEmail({ to: email, subject: `[Consultas CAO] Relatório semanal — ${org.name || 'Órgão'}`, html });
            }
        }
    }
);
