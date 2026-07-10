"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgAccessLog = exports.logAccess = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
function isOrgAdmin(membership) {
    if (!membership)
        return false;
    if (membership.role === 'creator' || membership.role === 'admin')
        return true;
    return Object.values(membership.permissions || {}).some((v) => v === true);
}
// Log de acesso e auditoria (flag `access_audit_log`). Registra aberturas de
// registros com restrição de acesso e exportações de tabela — reaproveita a
// coleção global `auditLogs` já usada pelas demais Cloud Functions.
exports.logAccess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, entityType, entityId, action, details } = request.data || {};
    if (!organizationId || !action) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || 'Usuário',
        action: action === 'view_restricted' ? 'VIEW_RESTRICTED_RECORD' : 'EXPORT_TABLE',
        details: Object.assign({ entity_type: entityType || null, entity_id: entityId || null }, (details || {})),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// getOrgAccessLog - Consulta o log de acesso de UM órgão (criador ou
// administrador delegado). Diferente de getActivityFeed (plataforma/super-admin),
// esta função é escopada ao próprio órgão do solicitante.
exports.getOrgAccessLog = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId } = request.data || {};
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    if (!isOrgAdmin(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'Apenas o criador ou administradores delegados podem consultar o log de acesso.');
    }
    const limit = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 100, 1), 300);
    const snap = await db.collection('auditLogs')
        .where('organization_id', '==', organizationId)
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();
    const items = snap.docs
        .map((d) => d.data())
        .filter((d) => d.action === 'VIEW_RESTRICTED_RECORD' || d.action === 'EXPORT_TABLE')
        .slice(0, limit)
        .map((d) => {
        var _a;
        return ({
            user_name: d.user_name || 'Usuário',
            action: d.action,
            details: d.details || {},
            timestamp: ((_a = d.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) ? d.timestamp.toDate().toISOString() : null,
        });
    });
    return { items };
});
//# sourceMappingURL=accessLog.js.map