"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteParceria = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const permissions_1 = require("../shared/permissions");
exports.deleteParceria = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId } = request.data || {};
    if (!id || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'id e organizationId são obrigatórios');
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
        throw new https_1.HttpsError('permission-denied', 'Você não tem permissão para excluir Parcerias neste órgão');
    }
    // 2. IDOR check
    const parceriaRef = db.collection('parcerias').doc(id);
    const parceriaSnap = await parceriaRef.get();
    if (!parceriaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Parceria não encontrada');
    }
    if (((_a = parceriaSnap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Parceria pertence a outra organização');
    }
    // 3. recursiveDelete: remove a Parceria + history/ + aditivos/* + comments/
    await db.recursiveDelete(parceriaRef);
    // 4. Update stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.parcerias_count': admin.firestore.FieldValue.increment(-1),
        'stats.active_parcerias': admin.firestore.FieldValue.increment(-1),
    });
    // 5. Audit
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_PARCERIA',
        details: { parceria_id: id },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=delete.js.map