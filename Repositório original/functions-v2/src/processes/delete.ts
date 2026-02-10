import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface DeleteProcessRequest {
    id: string;
    organizationId: string;
}

export const deleteProcess = onCall<DeleteProcessRequest>(
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

        // 1. Verify permissions (Manager only)
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Not a member');
        }
        const role = membershipSnap.data()?.role;
        if (!['admin', 'creator'].includes(role)) {
            throw new HttpsError('permission-denied', 'Only admins can delete processes');
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
    }
);
