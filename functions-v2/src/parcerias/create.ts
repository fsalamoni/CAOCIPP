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
    categoria?: string;
    signatureDate?: string;
    validityPeriod?: string;
    // Item 4: 'vigência a contar de' — base do cálculo do termo final.
    validityStartsFrom?: 'signature_date' | 'demp';
    endDate?: string;
    renewalNoticeDate?: string;
    // Itens 7/8/9: avisos automáticos.
    renewalNoticePeriod?: number;
    renewalNoticePeriodUnit?: 'dias' | 'meses' | 'anos';
    reviewNoticePeriod?: number;
    reviewNoticePeriodUnit?: 'dias' | 'meses' | 'anos';
    reviewNoticeDate?: string;
    networkFolder?: string;
    observations?: string;
    responsibleUserId?: string;
    responsibleUserName?: string;
    responsibilityDate?: string;
    urgencyRequest?: boolean | string;
    // Aliases snake_case aceitos pelo backend (frontend envia em snake).
    partnership_type?: string;
    partnership_number?: string;
    signature_date?: string;
    validity_period?: string;
    validity_starts_from?: 'signature_date' | 'demp';
    renewal_notice_period?: number;
    renewal_notice_period_unit?: 'dias' | 'meses' | 'anos';
    review_notice_period?: number;
    review_notice_period_unit?: 'dias' | 'meses' | 'anos';
    review_notice_date?: string;
    end_date?: string;
    renewal_notice_date?: string;
    network_folder?: string;
    responsible_user_id?: string;
    responsible_user_name?: string;
    responsibility_date?: string;
    urgency_request?: boolean | string;
}

export const createParceria = onCall<CreateParceriaRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const data = request.data || ({} as CreateParceriaRequest);
        const { organizationId, pgea, subject, object, parties } = data;

        // Normalização snake/camel: o frontend envia em snake_case
        // (partnership_type, signature_date, etc), mas a interface canônica
        // é camelCase. Aceitar ambos para não quebrar chamadas legadas.
        const partnershipType = data.partnershipType || data.partnership_type || null;
        const partnershipNumber = data.partnershipNumber || data.partnership_number || null;
        const categoria = data.categoria || null;
        const signatureDate = data.signatureDate || data.signature_date || null;
        const validityPeriod = data.validityPeriod || data.validity_period || null;
        const validityStartsFrom = data.validityStartsFrom || data.validity_starts_from || null;
        // Itens 7/8/9: avisos automáticos.
        const renewalNoticePeriod = Number(
            data.renewalNoticePeriod ?? data.renewal_notice_period
        );
        const renewalNoticePeriodUnit = String(
            data.renewalNoticePeriodUnit ?? (data.renewal_notice_period_unit || '')
        ) as 'dias' | 'meses' | 'anos' | '';
        const reviewNoticePeriod = Number(
            data.reviewNoticePeriod ?? data.review_notice_period
        );
        const reviewNoticePeriodUnit = String(
            data.reviewNoticePeriodUnit ?? (data.review_notice_period_unit || '')
        ) as 'dias' | 'meses' | 'anos' | '';
        const reviewNoticeDate = data.reviewNoticeDate || data.review_notice_date || null;
        const endDate = data.endDate || data.end_date || null;
        const renewalNoticeDate = data.renewalNoticeDate || data.renewal_notice_date || null;
        const networkFolder = data.networkFolder || data.network_folder || '';
        const observations = data.observations || '';
        const responsibleUserId = data.responsibleUserId || data.responsible_user_id || null;
        const responsibleUserName = data.responsibleUserName || data.responsible_user_name || null;
        const responsibilityDate = data.responsibilityDate || data.responsibility_date || null;
        // Flag opcional de urgência — aceita boolean ou string "sim"/"true".
        // (Restrição de acesso removida no PR #70 — sem uso no produto.)
        const toBool = (v: unknown): boolean => {
            if (v === true) return true;
            if (typeof v === 'string') {
                const s = v.toLowerCase().trim();
                return s === 'sim' || s === 'true' || s === '1' || s === 'yes';
            }
            return false;
        };
        const urgencyRequest = toBool(data.urgencyRequest ?? data.urgency_request);

        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório');
        }
        if (!pgea || !String(pgea).trim()) {
            throw new HttpsError('invalid-argument', 'PGEA é obrigatório');
        }
        if (!subject || !String(subject).trim()) {
            throw new HttpsError('invalid-argument', 'Assunto é obrigatório');
        }
        if (!parties || !String(parties).trim()) {
            throw new HttpsError('invalid-argument', 'Partes é obrigatório');
        }
        // Objeto deixou de ser obrigatório na criação: ele é exigido apenas na
        // formalização (fase "Parcerias"). Novas parcerias entram em "Pendente".

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
            partnership_type: partnershipType,
            partnership_number: partnershipNumber,
            signature_date: signatureDate,
            end_date: endDate,
            renewal_notice_date: renewalNoticeDate,
            network_folder: networkFolder,
            observations: observations,
            responsible_user_id: responsibleUserId,
            responsibility_date: responsibilityDate,
            review_conclusion_date: null,
            third_party: null,
            extinguished: false,
        };
        const status = calculateParceriaStatus(initialRecord);

        // (3.1) Se um assessor já é atribuído na criação, registra a data de
        // distribuição — mas NÃO a data de responsabilidade: a parceria
        // permanece em "Pendente" (entrar em "Em análise" é uma transição
        // própria no Kanban, que exige assessor e registra responsibility_date).
        const distributionDate = responsibleUserId ? logDate : null;

        const parceriaData: Record<string, unknown> = {
            id: parceriaRef.id,
            organization_id: organizationId,
            pgea: String(pgea).trim(),
            subject: String(subject).trim(),
            object: object ? String(object).trim() : '',
            parties: String(parties).trim(),
            distribution_date: distributionDate,
            partnership_type: partnershipType,
            partnership_number: partnershipNumber,
            categoria,
            signature_date: signatureDate,
            validity_period: validityPeriod,
            validity_starts_from: validityStartsFrom,
            end_date: endDate,
            renewal_notice_period: Number.isFinite(renewalNoticePeriod) && renewalNoticePeriod > 0
                ? renewalNoticePeriod : null,
            renewal_notice_period_unit: ['dias','meses','anos'].includes(renewalNoticePeriodUnit as string)
                ? renewalNoticePeriodUnit : null,
            review_notice_period: Number.isFinite(reviewNoticePeriod) && reviewNoticePeriod > 0
                ? reviewNoticePeriod : null,
            review_notice_period_unit: ['dias','meses','anos'].includes(reviewNoticePeriodUnit as string)
                ? reviewNoticePeriodUnit : null,
            review_notice_date: reviewNoticeDate,
            renewal_notice_date: renewalNoticeDate,
            network_folder: networkFolder,
            observations: observations,
            responsible_user_id: responsibleUserId,
            responsible_user_name: responsibleUserName,
            responsibility_date: responsibilityDate,
            review_conclusion_date: null,
            third_party: null,
            urgency_request: urgencyRequest,
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
