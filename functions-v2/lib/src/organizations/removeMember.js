"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMember = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const vinculo_1 = require("../shared/vinculo");
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
    if (!requesterMembershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(requesterMembershipSnap.data())) {
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
        left_at: firestore_1.FieldValue.serverTimestamp()
    });
    // 4. Update stats
    const orgRef = db.collection('organizations').doc(organizationId);
    await orgRef.update({
        'stats.members_count': firestore_1.FieldValue.increment(-1)
    });
    // 5. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: request.auth.token.name || '',
        action: 'REMOVE_MEMBER',
        details: { removed_user_id: userIdToRemove },
        timestamp: firestore_1.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Membro removido com sucesso' };
});
//# sourceMappingURL=removeMember.js.map