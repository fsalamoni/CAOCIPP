import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * backfillProcessLogs — One-time callable function to add initial activity_log
 * entries to all existing processes that don't have one yet.
 *
 * Uses process metadata (created_at, created_by, last_imported_at) to determine
 * the correct initial log entry (manual creation vs import).
 *
 * Only callable by the organization creator (admin).
 */

interface BackfillRequest {
    organizationId: string;
}

export const backfillProcessLogs = onCall<BackfillRequest>(
    {
        region: 'southamerica-east1',
        timeoutSeconds: 540,
        memory: '512MiB',
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { organizationId } = request.data;
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId is required');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // Verify user is creator of this organization
        const orgDoc = await db.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new HttpsError('not-found', 'Organization not found');
        }
        const orgData = orgDoc.data();
        if (orgData?.created_by !== userId) {
            throw new HttpsError('permission-denied', 'Only the organization creator can backfill logs');
        }

        // Build a map of user_id -> user_name from membership docs
        const membershipsSnap = await db.collection('userOrganizations')
            .where('organization_id', '==', organizationId)
            .get();
        const userNames: Record<string, string> = {};
        membershipsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.user_id && d.user_name) {
                userNames[d.user_id] = d.user_name;
            }
        });

        // Get all processes for this organization
        const processesSnap = await db.collection('processes')
            .where('organization_id', '==', organizationId)
            .get();

        if (processesSnap.empty) {
            return { success: true, processed: 0, skipped: 0, message: 'Nenhum processo encontrado.' };
        }

        const batchSize = 450;
        let batch = db.batch();
        let batchCount = 0;
        let processed = 0;
        let skipped = 0;

        for (const doc of processesSnap.docs) {
            const data = doc.data();

            // Skip if already has activity_log with entries
            if (data.activity_log && Array.isArray(data.activity_log) && data.activity_log.length > 0) {
                skipped++;
                continue;
            }

            // Determine the origin of the process
            const createdAt = data.created_at;
            const lastImportedAt = data.last_imported_at;
            const createdBy = data.created_by || '';
            const creatorName = userNames[createdBy] || 'Usuário do sistema';

            // Parse created_at timestamp
            let logDate = '—';
            let logTime = '—';
            let logTimestamp = '';

            if (createdAt) {
                let dateObj: Date;
                if (createdAt.toDate) {
                    // Firestore Timestamp
                    dateObj = createdAt.toDate();
                } else if (createdAt instanceof Date) {
                    dateObj = createdAt;
                } else {
                    dateObj = new Date(createdAt);
                }

                if (!isNaN(dateObj.getTime())) {
                    logDate = dateObj.toISOString().split('T')[0];
                    logTime = dateObj.toTimeString().split(' ')[0];
                    logTimestamp = dateObj.toISOString();
                }
            }

            // Determine action description
            let action = '';
            if (lastImportedAt) {
                action = 'Processo criado via importação de planilha (registro retroativo)';
            } else {
                action = 'Processo criado manualmente (registro retroativo)';
            }

            const initialLog = [{
                date: logDate,
                time: logTime,
                user_id: createdBy,
                user_name: creatorName,
                action: action,
                timestamp: logTimestamp || new Date().toISOString(),
            }];

            batch.update(doc.ref, { activity_log: initialLog });
            processed++;
            batchCount++;

            if (batchCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`[Backfill] Completed: ${processed} processes updated, ${skipped} skipped (already had logs)`);

        return {
            success: true,
            processed,
            skipped,
            total: processesSnap.size,
            message: `${processed} processos atualizados com log inicial, ${skipped} já possuíam log.`,
        };
    }
);
