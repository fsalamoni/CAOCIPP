import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateStatus } from '../shared/status';

interface UpdateProcessRequest {
    id: string;
    organizationId: string;
    changes: Record<string, any>;
}

export const updateProcess = onCall<UpdateProcessRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { id, organizationId, changes } = request.data;
        if (!id || !organizationId || !changes) {
            throw new HttpsError('invalid-argument', 'Missing required fields');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify permissions
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'You are not a member of this organization');
        }
        const role = membershipSnap.data()?.role;

        // Check if user is owner of process or admin/creator
        // For simplicity, we trust the membership logic here, but stricter rule would read process first.
        // Let's read process to be safe and also to update logs.
        const processRef = db.collection('processes').doc(id);
        const processSnap = await processRef.get();

        if (!processSnap.exists) {
            throw new HttpsError('not-found', 'Process not found');
        }

        const processData = processSnap.data();
        if (processData?.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Process belongs to another organization');
        }

        // Allow update if admin/creator OR responsible user
        const isResponsible = processData?.responsible_user_id === userId;
        const isManager = ['admin', 'creator'].includes(role);

        if (!isManager && !isResponsible) {
            // Members can usually update if they created it? Or just read?
            // Current rules say: update if member AND (manager OR owner).
            throw new HttpsError('permission-denied', 'Insufficient permissions to update this process');
        }

        // 2. Apply updates
        // Sanitize changes to prevent overwriting critical fields like id, organization_id
        delete changes.id;
        delete changes.organization_id;
        delete changes.created_at;
        delete changes.created_by;

        changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
        changes.updated_by = userId;

        // Recalculate status
        // Merge changes into current data to calculate new status
        const mergedData = { ...processData, ...changes };
        const newStatus = calculateStatus(mergedData);
        if (newStatus) {
            changes.status = newStatus; // Enforce calculated status
        } else if (!changes.status && processData.status) {
            // Keep existing status if calculation returns null/undefined (fallback)
            // or do nothing
        }

        await processRef.update(changes);

        // 3. Audit Log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'UPDATE_PROCESS',
            details: { process_id: id, changes: Object.keys(changes) },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    }
);
