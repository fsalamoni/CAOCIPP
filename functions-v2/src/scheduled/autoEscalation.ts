import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Reimplementação mínima (server-side) do cálculo de dias úteis já usado no
// frontend (`src/lib/dateUtils.js` / `src/lib/stageTime.js`). Mantida local
// e sem dependências para não acoplar o pacote de Functions ao app React.

function parseLocalDate(value: unknown): Date {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split('/').map(Number);
            return new Date(y, m - 1, d);
        }
    }
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
}

function calculateBusinessDays(startDate: unknown, endDate: unknown): number {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;
    let count = 0;
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    const final = new Date(end);
    final.setHours(0, 0, 0, 0);
    while (cur <= final) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

// Campo de data em que o registro entrou em cada etapa não-terminal.
const STAGE_ENTRY_FIELD: Record<string, string> = {
    'Pendente': 'entry_date',
    'Em elaboração': 'distribution_date',
    'Aguarda retorno de terceiros': 'third_party_referral_date',
    'Em revisão': 'review_submission_date',
    'Revisadas': 'reviewed_date',
};

const ENTITY_DEFS = [
    { collection: 'processes', entityType: 'process', numberField: 'process_number', label: 'Consulta' },
    { collection: 'expedientes', entityType: 'expediente', numberField: 'expediente_number', label: 'Expediente' },
] as const;

// Escalonamento automático de urgentes parados (flag `auto_escalation`).
// Rotina diária: para cada órgão com escalationConfig.enabled, verifica
// Consultas/Expedientes urgentes e ainda não finalizados cuja permanência na
// etapa atual (dias úteis) já ultrapassou o limite configurado, e notifica
// o criador, os administradores delegados e o responsável pelo registro.
export const autoEscalateStalledUrgent = onSchedule(
    { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
    async () => {
        const db = admin.firestore();

        // Funcionalidade integrada permanentemente ao produto: o disparo é
        // controlado apenas pela configuração por órgão (escalationConfig.*).

        const orgsSnap = await db.collection('organizations').get();

        for (const orgDoc of orgsSnap.docs) {
            const org = orgDoc.data();
            const escalationConfig = org.escalationConfig;
            if (!escalationConfig?.enabled) continue;

            const maxDays = Number(escalationConfig.maxDaysStalled);
            const threshold = Number.isFinite(maxDays) && maxDays > 0 ? maxDays : 5;
            const orgId = orgDoc.id;

            // Isola falhas por órgão: um erro num órgão não deve impedir o
            // processamento dos demais.
            try {
                const membershipsSnap = await db.collection('userOrganizations')
                    .where('organization_id', '==', orgId)
                    .get();
                const adminIds = new Set(
                    membershipsSnap.docs
                        .map((d) => d.data())
                        .filter((m) => m.role === 'creator' || m.role === 'admin')
                        .map((m) => m.user_id)
                        .filter(Boolean)
                );

                for (const { collection, entityType, numberField, label } of ENTITY_DEFS) {
                    const itemsSnap = await db.collection(collection)
                        .where('organization_id', '==', orgId)
                        .where('urgency_request', '==', true)
                        .limit(500)
                        .get();

                    for (const itemDoc of itemsSnap.docs) {
                        const item = itemDoc.data();
                        if (item.status === 'Na pasta') continue;

                        const entryField = STAGE_ENTRY_FIELD[item.status];
                        if (!entryField || !item[entryField]) continue;

                        const daysStalled = calculateBusinessDays(item[entryField], new Date());
                        if (daysStalled < threshold) continue;

                        const recipients = new Set(adminIds);
                        if (item.responsible_user_id) recipients.add(item.responsible_user_id);
                        if (recipients.size === 0) continue;

                        const recipientList = Array.from(recipients);
                        const prefSnaps = await Promise.all(
                            recipientList.map((id) => db.collection('userPreferences').doc(id).get())
                        );

                        const batch = db.batch();
                        let anyQueued = false;
                        recipientList.forEach((userId, idx) => {
                            const prefs = prefSnaps[idx].data()?.notificationPreferences;
                            if (prefs?.escalation === false) return;
                            anyQueued = true;
                            const notifRef = db.collection('notifications').doc();
                            batch.set(notifRef, {
                                user_id: userId,
                                type: 'escalation',
                                title: 'Urgente parado há muito tempo',
                                message: `${label} ${item[numberField] || ''} está há ${daysStalled} dia(s) útil(eis) na etapa "${item.status}".`.trim(),
                                organization_id: orgId,
                                entity_type: entityType,
                                entity_id: itemDoc.id,
                                read: false,
                                created_at: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        });
                        if (anyQueued) await batch.commit();
                    }
                }
            } catch (error) {
                console.error('[autoEscalateStalledUrgent] falha no órgão', orgId, error);
            }
        }
    }
);
