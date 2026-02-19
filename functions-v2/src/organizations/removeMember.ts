import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface RemoveMemberRequest {
    organizationId: string;
    userIdToRemove: string;
}

export const removeMember = onCall<RemoveMemberRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, userIdToRemove } = request.data;
        if (!organizationId || !userIdToRemove) {
            throw new HttpsError('invalid-argument', 'Missing required fields');
        }

        const db = admin.firestore();
        const requesterId = request.auth.uid;

        // 1. Check requester permissions
        const requesterMembershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
        const requesterMembershipSnap = await requesterMembershipRef.get();

        if (!requesterMembershipSnap.exists) {
            throw new HttpsError('permission-denied', 'You are not a member of this organization');
        }

        const requesterRole = requesterMembershipSnap.data()?.role;
        if (!['creator', 'admin'].includes(requesterRole)) {
            throw new HttpsError('permission-denied', 'Only admins or creators can remove members');
        }

        // Prevent removing yourself (use leaveOrganization instead)
        if (requesterId === userIdToRemove) {
            throw new HttpsError('invalid-argument', 'You cannot remove yourself using this function');
        }

        // 2. Check target membership
        const targetMembershipRef = db.collection('userOrganizations').doc(`${userIdToRemove}_${organizationId}`);
        const targetMembershipSnap = await targetMembershipRef.get();

        if (!targetMembershipSnap.exists) {
            throw new HttpsError('not-found', 'Member not found');
        }

        const targetRole = targetMembershipSnap.data()?.role;

        // Creator cannot be removed
        if (targetRole === 'creator') {
            throw new HttpsError('permission-denied', 'Cannot remove the organization creator');
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
    }
);
