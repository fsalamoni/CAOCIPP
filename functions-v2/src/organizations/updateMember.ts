import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sanitizePermissions } from '../shared/permissions';

interface UpdateMemberRequest {
    organizationId: string;
    userIdToUpdate: string;
    newRole?: 'admin' | 'member';
    newFunction?: string;
    // Mapa de permissões especiais delegadas. Apenas o CRIADOR pode definir.
    permissions?: Record<string, unknown>;
}

export const updateMember = onCall<UpdateMemberRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, userIdToUpdate, newRole, newFunction, permissions } = request.data;

        const db = admin.firestore();
        const requesterId = request.auth.uid;

        // 1. Check requester permissions
        const requesterMembershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
        const requesterMembershipSnap = await requesterMembershipRef.get();

        if (!requesterMembershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Not a member');
        }

        const requesterRole = requesterMembershipSnap.data()?.role;
        if (requesterRole !== 'creator' && requesterRole !== 'admin') { // Admins can update members? Usually yes.
            throw new HttpsError('permission-denied', 'Insufficient permissions');
        }

        // Apenas o CRIADOR pode conceder/revogar permissões especiais, pois
        // elas equivalem a poderes do próprio criador.
        if (permissions !== undefined && requesterRole !== 'creator') {
            throw new HttpsError('permission-denied', 'Only the organization Creator can assign special permissions');
        }

        // 2. Check target
        const targetRef = db.collection('userOrganizations').doc(`${userIdToUpdate}_${organizationId}`);
        const targetSnap = await targetRef.get();

        if (!targetSnap.exists) {
            throw new HttpsError('not-found', 'Target member not found');
        }

        const targetData = targetSnap.data();
        if (targetData?.role === 'creator') {
            throw new HttpsError('permission-denied', 'Cannot change creator role');
        }

        // 3. Update
        const updates: any = {};
        if (newRole) updates.role = newRole;
        if (newFunction !== undefined) updates.function = newFunction;
        if (permissions !== undefined) updates.permissions = sanitizePermissions(permissions);
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
    }
);
