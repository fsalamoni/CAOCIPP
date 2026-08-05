"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMember = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.removeMember = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { organizationId, userIdToRemove } = request.data;
    if (!organizationId || !userIdToRemove) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const db = admin.firestore();
    const requesterId = request.auth.uid;
    // 1. Check requester permissions
    const requesterMembershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
    const requesterMembershipSnap = await requesterMembershipRef.get();
    if (!requesterMembershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    const requesterRole = (_a = requesterMembershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!['creator', 'admin'].includes(requesterRole)) {
        throw new https_1.HttpsError('permission-denied', 'Only admins or creators can remove members');
    }
    // Prevent removing yourself (use leaveOrganization instead)
    if (requesterId === userIdToRemove) {
        throw new https_1.HttpsError('invalid-argument', 'You cannot remove yourself using this function');
    }
    // 2. Check target membership
    const targetMembershipRef = db.collection('userOrganizations').doc(`${userIdToRemove}_${organizationId}`);
    const targetMembershipSnap = await targetMembershipRef.get();
    if (!targetMembershipSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Member not found');
    }
    const targetRole = (_b = targetMembershipSnap.data()) === null || _b === void 0 ? void 0 : _b.role;
    // Creator cannot be removed
    if (targetRole === 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Cannot remove the organization creator');
    }
    // 3. Soft remove membership
    // Instead of deleting, we mark as inactive and set left_at
    await targetMembershipRef.update({
        active: false,
        left_at: admin.firestore.FieldValue.serverTimestamp()
    });
    // 4. Update stats
    const orgRef = db.collection('organizations').doc(organizationId);
    await orgRef.update({
        'stats.members_count': admin.firestore.FieldValue.increment(-1)
    });
    // 5. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: request.auth.token.name || '',
        action: 'REMOVE_MEMBER',
        details: { removed_user_id: userIdToRemove },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Membro removido com sucesso' };
});
//# sourceMappingURL=removeMember.js.map