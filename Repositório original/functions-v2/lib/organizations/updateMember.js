"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMember = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.updateMember = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { organizationId, userIdToUpdate, newRole, newFunction } = request.data;
    const db = admin.firestore();
    const requesterId = request.auth.uid;
    // 1. Check requester permissions
    const requesterMembershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
    const requesterMembershipSnap = await requesterMembershipRef.get();
    if (!requesterMembershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Not a member');
    }
    const requesterRole = (_a = requesterMembershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (requesterRole !== 'creator' && requesterRole !== 'admin') { // Admins can update members? Usually yes.
        throw new https_1.HttpsError('permission-denied', 'Insufficient permissions');
    }
    // 2. Check target
    const targetRef = db.collection('userOrganizations').doc(`${userIdToUpdate}_${organizationId}`);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Target member not found');
    }
    const targetData = targetSnap.data();
    if ((targetData === null || targetData === void 0 ? void 0 : targetData.role) === 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Cannot change creator role');
    }
    // 3. Update
    const updates = {};
    if (newRole)
        updates.role = newRole;
    if (newFunction)
        updates.function = newFunction;
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    await targetRef.update(updates);
    // 4. Audit
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: request.auth.token.name || '',
        action: 'UPDATE_MEMBER',
        details: { updated_user_id: userIdToUpdate, changes: updates },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=updateMember.js.map