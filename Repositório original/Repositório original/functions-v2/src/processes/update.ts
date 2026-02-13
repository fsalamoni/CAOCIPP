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

        // Allow update if user is an authenticated member of the organization
        // We already verified membershipSnap.exists above
        const isMember = membershipSnap.exists;

        if (!isMember) {
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

        // Recalculate status
        // Case A: Explicit status change (user manually selected a new status)
        // Case B: No status provided or status is the same as current (allow auto-calculation from dates)
        const statusInChanges = changes.status;
        const currentStatus = processData.status;

        if (statusInChanges && statusInChanges !== currentStatus) {
            // Respect manual status override
        } else {
            const newStatus = calculateStatus(mergedData);
            if (newStatus && newStatus !== currentStatus) {
                changes.status = newStatus;
            }
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
