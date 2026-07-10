import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// Política de retenção e anonimização (flag `data_retention_policy`, alto
// risco). Duas etapas OBRIGATÓRIAS e distintas — nunca automáticas:
//   1. previewAnonymization: lista o que SERIA anonimizado, sem alterar nada.
//   2. runAnonymization: anonimiza APENAS os IDs explicitamente confirmados
//      pelo Criador (não "todos os elegíveis" — a lista vem da preview).
// Nenhuma rotina agendada dispara isto sozinha.

async function assertIsCreator(db: admin.firestore.Firestore, userId: string, organizationId: string): Promise<void> {
    const membershipSnap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!membershipSnap.exists || membershipSnap.data()?.role !== 'creator') {
        throw new HttpsError('permission-denied', 'Apenas o Criador do órgão pode gerenciar a política de retenção.');
    }
}

function isEligible(data: admin.firestore.DocumentData, cutoff: Date): boolean {
    if (data.anonymized === true) return false;
    if (!data.archived_date) return false;
    const archived = new Date(data.archived_date);
    if (isNaN(archived.getTime())) return false;
    return archived <= cutoff;
}

export const previewAnonymization = onCall<{ organizationId: string }>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }
        const { organizationId } = request.data || {};
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório.');
        }

        const db = admin.firestore();
        await assertIsCreator(db, request.auth.uid, organizationId);

        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        const retentionConfig = orgSnap.data()?.retentionConfig;
        const anonymizeAfterDays = Number(retentionConfig?.anonymizeAfterDays) || 365;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - anonymizeAfterDays);

        const snap = await db.collection('processes')
            .where('organization_id', '==', organizationId)
            .limit(2000)
            .get();

        const eligible = snap.docs
            .filter((d) => isEligible(d.data(), cutoff))
            .map((d) => ({
                id: d.id,
                process_number: d.data().process_number || '',
                consultant: d.data().consultant || '',
                archived_date: d.data().archived_date || '',
            }));

        return {
            anonymizeAfterDays,
            totalEligible: eligible.length,
            items: eligible.slice(0, 300),
        };
    }
);

export const runAnonymization = onCall<{ organizationId: string; ids: string[] }>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }
        const { organizationId, ids } = request.data || {};
        if (!organizationId || !Array.isArray(ids) || ids.length === 0) {
            throw new HttpsError('invalid-argument', 'organizationId e ids são obrigatórios.');
        }
        if (ids.length > 300) {
            throw new HttpsError('invalid-argument', 'Máximo de 300 registros por execução.');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;
        await assertIsCreator(db, userId, organizationId);

        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        const retentionConfig = orgSnap.data()?.retentionConfig;
        const anonymizeAfterDays = Number(retentionConfig?.anonymizeAfterDays) || 365;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - anonymizeAfterDays);

        // Revalida no servidor: só anonimiza o que ainda é elegível AGORA (evita
        // que uma lista de IDs desatualizada/manipulada anonimize algo indevido).
        const refs = ids.map((id) => db.collection('processes').doc(id));
        const snaps = await db.getAll(...refs);

        const batch = db.batch();
        let anonymizedCount = 0;
        const now = admin.firestore.FieldValue.serverTimestamp();

        snaps.forEach((snap) => {
            const data = snap.data();
            if (!snap.exists || !data || data.organization_id !== organizationId) return;
            if (!isEligible(data, cutoff)) return;

            batch.update(snap.ref, {
                consultant: 'Consulente anonimizado (LGPD)',
                anonymized: true,
                anonymized_at: now,
                anonymized_by: userId,
            });
            anonymizedCount += 1;
        });

        if (anonymizedCount === 0) {
            return { success: true, anonymizedCount: 0 };
        }

        await batch.commit();

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || 'Usuário',
            action: 'ANONYMIZE_RECORDS',
            details: { count: anonymizedCount },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, anonymizedCount };
    }
);
