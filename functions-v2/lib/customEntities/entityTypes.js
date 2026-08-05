"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEntityType = exports.upsertEntityType = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const schema_1 = require("./schema");
const permissions_1 = require("../shared/permissions");
const REGION = 'southamerica-east1';
async function assertManager(db, userId, organizationId) {
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const snap = await membershipRef.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização.');
    }
    const membership = snap.data();
    const role = membership === null || membership === void 0 ? void 0 : membership.role;
    // Criador/Administradores sempre podem; membros precisam da permissão
    // delegada `manage_modules`.
    if (role !== 'creator' && role !== 'admin' && !(0, permissions_1.hasOrgPermission)(membership, 'manage_modules')) {
        throw new https_1.HttpsError('permission-denied', 'Apenas o Criador ou Administradores podem gerenciar páginas personalizadas.');
    }
    return role;
}
exports.upsertEntityType = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, entityType } = request.data || {};
    if (!organizationId)
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    const db = admin.firestore();
    await assertManager(db, userId, organizationId);
    let def;
    try {
        def = (0, schema_1.sanitizeEntityTypeDefinition)(entityType);
    }
    catch (e) {
        throw new https_1.HttpsError('invalid-argument', (e === null || e === void 0 ? void 0 : e.message) || 'Definição inválida.');
    }
    const existingId = (entityType === null || entityType === void 0 ? void 0 : entityType.id) ? String(entityType.id) : null;
    const ref = existingId
        ? db.collection('entityTypes').doc(existingId)
        : db.collection('entityTypes').doc();
    // Se for edição, confirma que pertence ao mesmo órgão.
    if (existingId) {
        const cur = await ref.get();
        if (cur.exists && ((_a = cur.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
            throw new https_1.HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
        }
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const payload = Object.assign(Object.assign({}, def), { id: ref.id, organization_id: organizationId, updated_at: now, updated_by: userId });
    if (!existingId) {
        payload.created_at = now;
        payload.created_by = userId;
    }
    await ref.set(payload, { merge: true });
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: existingId ? 'UPDATE_ENTITY_TYPE' : 'CREATE_ENTITY_TYPE',
        details: { entity_type_id: ref.id, label: def.label_plural },
        timestamp: now,
    });
    return { success: true, entityTypeId: ref.id };
});
exports.deleteEntityType = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, entityTypeId } = request.data || {};
    if (!organizationId || !entityTypeId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
    }
    const db = admin.firestore();
    await assertManager(db, userId, organizationId);
    const ref = db.collection('entityTypes').doc(entityTypeId);
    const snap = await ref.get();
    if (!snap.exists) {
        return { success: true, message: 'Tipo já removido.' };
    }
    if (((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
    }
    // Bloqueia exclusão se houver registros (preserva dados). Oferece desativar.
    const hasRecords = await db.collection('customRecords')
        .where('organization_id', '==', organizationId)
        .where('entity_type_id', '==', entityTypeId)
        .limit(1)
        .get();
    if (!hasRecords.empty) {
        throw new https_1.HttpsError('failed-precondition', 'Este tipo possui registros. Desative-o em vez de excluir, ou remova os registros antes.');
    }
    await ref.delete();
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_ENTITY_TYPE',
        details: { entity_type_id: entityTypeId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=entityTypes.js.map