import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateParceriaStatus } from '../shared/status';
import { historyEntryId } from '../shared/history';
import { fireOrgWebhook } from '../shared/webhooks';

interface CreateParceriaRequest {
    organizationId: string;
    pgea: string;
    subject: string;
    object: string;
    parties: string;
    partnershipType?: string;
    partnershipNumber?: string;
    signatureDate?: string;
    validityPeriod?: string;
    endDate?: string;
    renewalNoticeDate?: string;
    networkFolder?: string;
    observations?: string;
    responsibleUserId?: string;
    responsibleUserName?: string;
    responsibilityDate?: string;
    pgeaDate?: string;
}

export const createParceria = onCall<CreateParceriaRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const data = request.data || ({} as CreateParceriaRequest);
        const { organizationId, pgea, subject, object, parties } = data;

        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório');
        }
        if (!pgea || !String(pgea).trim()) {
            throw new HttpsError('invalid-argument', 'PGEA é obrigatório');
        }
        if (!subject || !String(subject).trim()) {
            throw new HttpsError('invalid-argument', 'Assunto é obrigatório');
        }
        if (!object || !String(object).trim()) {
            throw new HttpsError('invalid-argument', 'Objeto é obrigatório');
        }
        if (!parties || !String(parties).trim()) {
            throw new HttpsError('invalid-argument', 'Partes é obrigatório');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify membership
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        // 2. Create parceria
        const parceriaRef = db.collection('parcerias').doc();
        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];
        const userName = request.auth.token.name || 'Usuário desconhecido';

        // 3. Calculate initial status (vai ser "Pendente" se faltar tudo do fluxo)
        const initialRecord: Record<string, unknown> = {
            partnership_type: data.partnershipType || null,
            partnership_number: data.partnershipNumber || null,
            signature_date: data.signatureDate || null,
            end_date: data.endDate || null,
            renewal_notice_date: data.renewalNoticeDate || null,
            network_folder: data.networkFolder || '',
            observations: data.observations || '',
            responsible_user_id: data.responsibleUserId || null,
            responsibility_date: data.responsibilityDate || null,
            review_conclusion_date: null,
            third_party: null,
            extinguished: false,
        };
        const status = calculateParceriaStatus(initialRecord);

        const parceriaData: Record<string, unknown> = {
            id: parceriaRef.id,
            organization_id: organizationId,
            pgea: String(pgea).trim(),
            subject: String(subject).trim(),
            object: String(object).trim(),
            parties: String(parties).trim(),
            partnership_type: data.partnershipType || null,
            partnership_number: data.partnershipNumber || null,
            signature_date: data.signatureDate || null,
            validity_period: data.validityPeriod || null,
            end_date: data.endDate || null,
            renewal_notice_date: data.renewalNoticeDate || null,
            network_folder: data.networkFolder || '',
            observations: data.observations || '',
            responsible_user_id: data.responsibleUserId || null,
            responsible_user_name: data.responsibleUserName || null,
            responsibility_date: data.responsibilityDate || null,
            review_conclusion_date: null,
            third_party: null,
            pgea_date: data.pgeaDate || null,
            status,
            extinguished: false,
            extinguished_at: null,
            extinguished_by: null,
            aditivo_count: 0,
            current_additive_id: '',
            created_by: userId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            activity_log: [{
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: 'Parceria criada manualmente',
                timestamp: now.toISOString(),
            }],
        };

        await parceriaRef.set(parceriaData);

        // Fase 3 (escrita dupla, ADITIVA): espelha a entrada inicial na
        // subcoleção parcerias/{id}/history. Best-effort: NUNCA falha a
        // operação principal. ID determinístico => idempotente.
        try {
            const createEntry = {
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: 'Parceria criada manualmente',
                timestamp: now.toISOString(),
            };
            await parceriaRef.collection('history').doc(historyEntryId(createEntry)).set({
                ...createEntry,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (histErr) {
            console.error('[history dual-write] parceria create', parceriaRef.id, histErr);
        }

        // 4. Update stats
        await db.collection('organizations').doc(organizationId).update({
            'stats.parcerias_count': admin.firestore.FieldValue.increment(1),
            'stats.active_parcerias': admin.firestore.FieldValue.increment(1),
        });

        // Webhook de integração externa (flag `outbound_webhooks`).
        await fireOrgWebhook(organizationId, 'parceria_created', {
            entity_type: 'parceria',
            entity_id: parceriaRef.id,
            pgea: parceriaData.pgea,
            subject: parceriaData.subject,
        });

        // 5. Audit Log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'CREATE_PARCERIA',
            details: { parceria_id: parceriaRef.id, pgea: parceriaData.pgea },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, parceriaId: parceriaRef.id };
    }
);
