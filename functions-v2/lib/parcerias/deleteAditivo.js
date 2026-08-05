"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAditivo = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const permissions_1 = require("../shared/permissions");
const history_1 = require("../shared/history");
exports.deleteAditivo = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const data = request.data || {};
    const { parceriaId, aditivoId, organizationId } = data;
    if (!parceriaId || !aditivoId || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'parceriaId, aditivoId e organizationId são obrigatórios');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership + permissão
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    if (!(0, permissions_1.hasOrgPermission)(membershipSnap.data(), 'delete_records')) {
        throw new https_1.HttpsError('permission-denied', 'Você não tem permissão para excluir aditivos neste órgão');
    }
    // 2. Read parceria pai (IDOR check)
    const parceriaRef = db.collection('parcerias').doc(parceriaId);
    const parceriaSnap = await parceriaRef.get();
    if (!parceriaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Parceria não encontrada');
    }
    const parceriaData = parceriaSnap.data() || {};
    if (parceriaData.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Parceria pertence a outra organização');
    }
    // 3. Ler aditivo
    const aditivoRef = parceriaRef.collection('aditivos').doc(aditivoId);
    const aditivoSnap = await aditivoRef.get();
    if (!aditivoSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Aditivo não encontrado');
    }
    const aditivoNumber = (_a = aditivoSnap.data()) === null || _a === void 0 ? void 0 : _a.aditivo_number;
    // 4. Recursive delete do aditivo (history/ etc.)
    await db.recursiveDelete(aditivoRef);
    // 5. Decrementar aditivo_count e ajustar current_additive_id
    // (pega o penúltimo aditivo; se não houver mais, current_additive_id = '')
    const newCount = Math.max(0, (parceriaData.aditivo_count || 1) - 1);
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    let newCurrentId = '';
    if (newCount > 0) {
        // Pega o aditivo restante mais recente
        const remaining = await parceriaRef
            .collection('aditivos')
            .orderBy('aditivo_number', 'desc')
            .limit(1)
            .get();
        if (!remaining.empty) {
            newCurrentId = remaining.docs[0].id;
        }
    }
    const updatePayload = {
        aditivo_count: newCount,
        current_additive_id: newCurrentId,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
    };
    updatePayload.activity_log = admin.firestore.FieldValue.arrayUnion({
        date: logDate,
        time: logTime,
        user_id: userId,
        user_name: userName,
        action: `Aditivo #${aditivoNumber} excluído`,
        timestamp: now.toISOString(),
    });
    await parceriaRef.update(updatePayload);
    // Dual-write do log no histórico do parent.
    try {
        const parentLogEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: `Aditivo #${aditivoNumber} excluído`,
            timestamp: now.toISOString(),
        };
        await parceriaRef
            .collection('history')
            .doc((0, history_1.historyEntryId)(parentLogEntry))
            .set(Object.assign(Object.assign({}, parentLogEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] deleteAditivo', parceriaId, histErr);
    }
    // 6. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'DELETE_ADITIVO',
        details: {
            parceria_id: parceriaId,
            aditivo_id: aditivoId,
            aditivo_number: aditivoNumber,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, newCount, newCurrentId };
});
//# sourceMappingURL=deleteAditivo.js.map