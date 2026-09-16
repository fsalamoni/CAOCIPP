"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJuris = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const permissions_1 = require("../shared/permissions");
/** Teto por chamada: mantém a operação dentro do tempo/limite de lote. */
const MAX_BULK_DELETE = 500;
exports.deleteJuris = (0, https_1.onCall)({ region: 'southamerica-east1', timeoutSeconds: 300 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, id, ids } = request.data || {};
    const targetIds = [...new Set((Array.isArray(ids) ? ids : [])
            .concat(id ? [id] : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean))];
    if (!organizationId || targetIds.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e ao menos um id são obrigatórios');
    }
    if (targetIds.length > MAX_BULK_DELETE) {
        throw new https_1.HttpsError('invalid-argument', `Selecione no máximo ${MAX_BULK_DELETE} júris por vez (recebidos: ${targetIds.length}).`);
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    if (!(0, permissions_1.hasOrgPermission)(membershipSnap.data(), 'delete_records')) {
        throw new https_1.HttpsError('permission-denied', 'Você não tem permissão para excluir júris neste órgão');
    }
    let deleted = 0;
    let skipped = 0;
    // Processa em lotes paralelos: 500 exclusões recursivas em série
    // estourariam o tempo limite da função.
    const CONCURRENCY = 20;
    for (let i = 0; i < targetIds.length; i += CONCURRENCY) {
        const chunk = targetIds.slice(i, i + CONCURRENCY);
        const refs = chunk.map((juriId) => db.collection('juris').doc(juriId));
        const snaps = await db.getAll(...refs);
        const removable = snaps.filter((snap) => {
            var _a;
            // IDOR: nunca apaga um documento de outro órgão, mesmo que o id exista.
            if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
                skipped += 1;
                return false;
            }
            return true;
        });
        await Promise.all(removable.map((snap) => db.recursiveDelete(snap.ref)));
        deleted += removable.length;
    }
    if (deleted > 0) {
        await db.collection('organizations').doc(organizationId).update({
            'stats.juris_count': admin.firestore.FieldValue.increment(-deleted),
        });
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_JURI',
        details: { deleted, requested: targetIds.length, skipped },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, deleted, skipped };
});
//# sourceMappingURL=delete.js.map