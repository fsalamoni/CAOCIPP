"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParceria = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
const history_1 = require("../shared/history");
const webhooks_1 = require("../shared/webhooks");
exports.createParceria = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const data = request.data || {};
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
    const renewalNoticePeriod = Number((_a = data.renewalNoticePeriod) !== null && _a !== void 0 ? _a : data.renewal_notice_period);
    const renewalNoticePeriodUnit = String((_b = data.renewalNoticePeriodUnit) !== null && _b !== void 0 ? _b : (data.renewal_notice_period_unit || ''));
    const reviewNoticePeriod = Number((_c = data.reviewNoticePeriod) !== null && _c !== void 0 ? _c : data.review_notice_period);
    const reviewNoticePeriodUnit = String((_d = data.reviewNoticePeriodUnit) !== null && _d !== void 0 ? _d : (data.review_notice_period_unit || ''));
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
    const toBool = (v) => {
        if (v === true)
            return true;
        if (typeof v === 'string') {
            const s = v.toLowerCase().trim();
            return s === 'sim' || s === 'true' || s === '1' || s === 'yes';
        }
        return false;
    };
    const urgencyRequest = toBool((_e = data.urgencyRequest) !== null && _e !== void 0 ? _e : data.urgency_request);
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    }
    if (!pgea || !String(pgea).trim()) {
        throw new https_1.HttpsError('invalid-argument', 'PGEA é obrigatório');
    }
    if (!subject || !String(subject).trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Assunto é obrigatório');
    }
    if (!parties || !String(parties).trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Partes é obrigatório');
    }
    // Objeto deixou de ser obrigatório na criação: ele é exigido apenas na
    // formalização (fase "Parcerias"). Novas parcerias entram em "Pendente".
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    // 2. Create parceria
    const parceriaRef = db.collection('parcerias').doc();
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    // 3. Calculate initial status (vai ser "Pendente" se faltar tudo do fluxo)
    const initialRecord = {
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
    const status = (0, status_1.calculateParceriaStatus)(initialRecord);
    // (3.1) Se um assessor já é atribuído na criação, registra a data de
    // distribuição — mas NÃO a data de responsabilidade: a parceria
    // permanece em "Pendente" (entrar em "Em análise" é uma transição
    // própria no Kanban, que exige assessor e registra responsibility_date).
    const distributionDate = responsibleUserId ? logDate : null;
    const parceriaData = {
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
        renewal_notice_period_unit: ['dias', 'meses', 'anos'].includes(renewalNoticePeriodUnit)
            ? renewalNoticePeriodUnit : null,
        review_notice_period: Number.isFinite(reviewNoticePeriod) && reviewNoticePeriod > 0
            ? reviewNoticePeriod : null,
        review_notice_period_unit: ['dias', 'meses', 'anos'].includes(reviewNoticePeriodUnit)
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
        await parceriaRef.collection('history').doc((0, history_1.historyEntryId)(createEntry)).set(Object.assign(Object.assign({}, createEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] parceria create', parceriaRef.id, histErr);
    }
    // 4. Update stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.parcerias_count': admin.firestore.FieldValue.increment(1),
        'stats.active_parcerias': admin.firestore.FieldValue.increment(1),
    });
    // Webhook de integração externa (flag `outbound_webhooks`).
    await (0, webhooks_1.fireOrgWebhook)(organizationId, 'parceria_created', {
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
});
//# sourceMappingURL=create.js.map