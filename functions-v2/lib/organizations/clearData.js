"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearOrganizationData = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
/**
 * Cloud Function to permanently wipe all process data for an organization.
 * Restricted to the organization creator.
 */
exports.clearOrganizationData = (0, https_1.onCall)({ region: 'southamerica-east1', cors: true }, async (request) => {
    var _a;
    // 1. Authenticate user
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { organizationId } = request.data;
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'Organization ID is required');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 2. Authorize - MUST be organization creator
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    const role = (_a = membershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Only the organization creator can wipe all data');
    }
    console.log(`[ClearData] Starting wipe for organization ${organizationId} by user ${userId}`);
    // 3. Delete processes in batches
    const processesQuery = db.collection('processes')
        .where('organization_id', '==', organizationId);
    let deletedCount = 0;
    let hasMore = true;
    // We use a loop to handle potential large data sets exceeding single batch limits
    while (hasMore) {
        const snapshot = await processesQuery.limit(500).get();
        if (snapshot.empty) {
            hasMore = false;
            break;
        }
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });
        await batch.commit();
        console.log(`[ClearData] Deleted ${deletedCount} processes so far...`);
        // Safety break to prevent infinite loops if something goes wrong with the query
        if (snapshot.size < 500) {
            hasMore = false;
        }
    }
    // 4. Reset organization stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.processes_count': 0,
        'stats.active_processes': 0,
        'updated_at': admin.firestore.FieldValue.serverTimestamp()
    });
    // 5. Audit Log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'CLEAR_ORGANIZATION_DATA',
        details: {
            processes_deleted: deletedCount,
            timestamp: new Date().toISOString()
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        deletedCount,
        message: `${deletedCount} processos foram removidos com sucesso da organização.`
    };
});
//# sourceMappingURL=clearData.js.map