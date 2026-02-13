import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateStatus } from '../shared/status';

interface CalculateStatusRequest {
    processId: string;
    processData?: any; // Simulating partial update
    organizationId?: string; // If bulk update
}

export const calculateProcessStatus = onCall<CalculateStatusRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { processId, processData, organizationId } = request.data;
        const db = admin.firestore();

        // 1. Bulk Update Logic (if organizationId provided)
        if (organizationId) {
            // Verify admin/creator
            const membershipRef = db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`);
            const membershipSnap = await membershipRef.get();
            const role = membershipSnap.data()?.role;
            if (!['admin', 'creator'].includes(role)) {
                throw new HttpsError('permission-denied', 'Only admins can recalculate all');
            }

            const processesSnap = await db.collection('processes')
                .where('organization_id', '==', organizationId)
                .get();

            let updatedCount = 0;
            const batch = db.batch();

            processesSnap.docs.forEach(doc => {
                const p = doc.data();
                const newStatus = calculateStatus(p);
                if (p.status !== newStatus) {
                    batch.update(doc.ref, { status: newStatus });
                    updatedCount++;
                }
            });

            if (updatedCount > 0) await batch.commit();

            return { success: true, message: `${updatedCount} process statuses updated.` };
        }

        // 2. Single Process Update
        if (!processId) {
            throw new HttpsError('invalid-argument', 'Process ID required');
        }

        const processRef = db.collection('processes').doc(processId);
        const processSnap = await processRef.get();
        if (!processSnap.exists) {
            throw new HttpsError('not-found', 'Process not found');
        }

        const currentData = processSnap.data();
        // Merge provided data (simulating what the new state would be)
        const mergedData = { ...currentData, ...processData };

        const newStatus = calculateStatus(mergedData);

        // Only update if status implies a change or if we want to force it
        // The legacy function did an update.

        if (currentData?.status !== newStatus) {
            await processRef.update({ status: newStatus });

            // Audit
            await db.collection('auditLogs').add({
                organization_id: currentData?.organization_id,
                user_id: request.auth.uid,
                user_name: request.auth.token.name || '',
                action: 'UPDATE_STATUS',
                details: {
                    process_id: processId,
                    old_status: currentData?.status,
                    new_status: newStatus
                },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return { success: true, status: newStatus };
    }
);
