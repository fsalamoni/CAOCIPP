import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hasOrgPermission, MembershipLike } from '../shared/permissions';

interface DeleteExpedienteRequest {
    id: string;
    organizationId: string;
}

export const deleteExpediente = onCall<DeleteExpedienteRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { id, organizationId } = request.data;
        if (!id || !organizationId) {
            throw new HttpsError('invalid-argument', 'Missing ID');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify permissions (Creator only)
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Not a member');
        }
        // O criador pode excluir; membros precisam da permissão `delete_records`.
        if (!hasOrgPermission(membershipSnap.data() as MembershipLike, 'delete_records')) {
            throw new HttpsError('permission-denied', 'Only the organization creator can delete expedientes');
        }

        // 2. Delete
        await db.collection('expedientes').doc(id).delete();

        // 3. Update stats
        await db.collection('organizations').doc(organizationId).update({
            'stats.expedientes_count': admin.firestore.FieldValue.increment(-1),
            'stats.active_expedientes': admin.firestore.FieldValue.increment(-1)
        });

        // 4. Audit
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_EXPEDIENTE',
            details: { expediente_id: id },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    }
);
