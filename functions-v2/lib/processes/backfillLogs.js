"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillProcessLogs = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.backfillProcessLogs = (0, https_1.onCall)({
    region: 'southamerica-east1',
    timeoutSeconds: 540,
    memory: '512MiB',
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId } = request.data;
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId is required');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // Verify user is creator of this organization
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Organization not found');
    }
    const orgData = orgDoc.data();
    if ((orgData === null || orgData === void 0 ? void 0 : orgData.created_by) !== userId) {
        throw new https_1.HttpsError('permission-denied', 'Only the organization creator can backfill logs');
    }
    // Build a map of user_id -> user_name from membership docs
    const membershipsSnap = await db.collection('userOrganizations')
        .where('organization_id', '==', organizationId)
        .get();
    const userNames = {};
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
            let dateObj;
            if (createdAt.toDate) {
                // Firestore Timestamp
                dateObj = createdAt.toDate();
            }
            else if (createdAt instanceof Date) {
                dateObj = createdAt;
            }
            else {
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
        }
        else {
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
});
//# sourceMappingURL=backfillLogs.js.map