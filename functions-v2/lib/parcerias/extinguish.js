"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extinguishParceria = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const history_1 = require("../shared/history");
const webhooks_1 = require("../shared/webhooks");
exports.extinguishParceria = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const data = request.data || {};
    const { parceriaId, organizationId, confirm } = data;
    if (!parceriaId || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'parceriaId e organizationId são obrigatórios');
    }
    if (confirm !== 'EXTINGUIR') {
        throw new https_1.HttpsError('failed-precondition', 'É necessário digitar "EXTINGUIR" para confirmar a extinção da Parceria.');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    // 2. Read parceria
    const parceriaRef = db.collection('parcerias').doc(parceriaId);
    const parceriaSnap = await parceriaRef.get();
    if (!parceriaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Parceria não encontrada');
    }
    const parceriaData = parceriaSnap.data() || {};
    if (parceriaData.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Parceria pertence a outra organização');
    }
    // 3. Regra de negócio: extinguir é uma ação terminal. Só funciona a
    // partir de "Parcerias" (a Parceria precisa estar em vigor).
    if (parceriaData.status !== 'Parcerias') {
        throw new https_1.HttpsError('failed-precondition', `Só é possível extinguir uma Parceria que esteja na fase "Parcerias" (atual: "${parceriaData.status || 'Pendente'}").`);
    }
    // 4. Marcar como extinta
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const updatePayload = {
        extinguished: true,
        extinguished_at: logDate,
        extinguished_by: userId,
        // (3.7) Data de arquivamento registrada automaticamente ao extinguir.
        archived_date: logDate,
        status: 'Extintos',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
    };
    updatePayload.activity_log = admin.firestore.FieldValue.arrayUnion({
        date: logDate,
        time: logTime,
        user_id: userId,
        user_name: userName,
        action: 'Parceria extinta sem renovação',
        timestamp: now.toISOString(),
    });
    await parceriaRef.update(updatePayload);
    // Dual-write do log no histórico.
    try {
        const logEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: 'Parceria extinta sem renovação',
            timestamp: now.toISOString(),
        };
        await parceriaRef.collection('history').doc((0, history_1.historyEntryId)(logEntry)).set(Object.assign(Object.assign({}, logEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] extinguish', parceriaId, histErr);
    }
    // 5. Cascade: marcar aditivos (se houver) como "Extintos" também.
    // (Não apagamos os aditivos — eles ficam como histórico.)
    const aditivosSnap = await parceriaRef.collection('aditivos').get();
    for (const aditivoDoc of aditivosSnap.docs) {
        const aditivoData = aditivoDoc.data();
        if (aditivoData.status === 'Extintos')
            continue;
        await aditivoDoc.ref.update({
            status: 'Extintos',
            archived_date: logDate,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
        });
    }
    // 6. Webhook
    await (0, webhooks_1.fireOrgWebhook)(organizationId, 'parceria_extinguished', {
        entity_type: 'parceria',
        entity_id: parceriaId,
        pgea: parceriaData.pgea,
    });
    // 7. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'EXTINGUISH_PARCERIA',
        details: { parceria_id: parceriaId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=extinguish.js.map