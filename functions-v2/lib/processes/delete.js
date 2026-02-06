"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProcess = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.deleteProcess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId } = request.data;
    if (!id || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing ID');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify permissions (Manager only)
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Not a member');
    }
    const role = (_a = membershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!['admin', 'creator'].includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can delete processes');
    }
    // 2. Delete
    await db.collection('processes').doc(id).delete();
    // 3. Update stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.processes_count': admin.firestore.FieldValue.increment(-1),
        'stats.active_processes': admin.firestore.FieldValue.increment(-1)
    });
    // 4. Audit
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_PROCESS',
        details: { process_id: id },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=delete.js.map