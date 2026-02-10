"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateProcessStatus = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
exports.calculateProcessStatus = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { processId, processData, organizationId } = request.data;
    const db = admin.firestore();
    // 1. Bulk Update Logic (if organizationId provided)
    if (organizationId) {
        // Verify admin/creator
        const membershipRef = db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        const role = (_a = membershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
        if (!['admin', 'creator'].includes(role)) {
            throw new https_1.HttpsError('permission-denied', 'Only admins can recalculate all');
        }
        const processesSnap = await db.collection('processes')
            .where('organization_id', '==', organizationId)
            .get();
        let updatedCount = 0;
        const batch = db.batch();
        processesSnap.docs.forEach(doc => {
            const p = doc.data();
            const newStatus = (0, status_1.calculateStatus)(p);
            if (p.status !== newStatus) {
                batch.update(doc.ref, { status: newStatus });
                updatedCount++;
            }
        });
        if (updatedCount > 0)
            await batch.commit();
        return { success: true, message: `${updatedCount} process statuses updated.` };
    }
    // 2. Single Process Update
    if (!processId) {
        throw new https_1.HttpsError('invalid-argument', 'Process ID required');
    }
    const processRef = db.collection('processes').doc(processId);
    const processSnap = await processRef.get();
    if (!processSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Process not found');
    }
    const currentData = processSnap.data();
    // Merge provided data (simulating what the new state would be)
    const mergedData = Object.assign(Object.assign({}, currentData), processData);
    const newStatus = (0, status_1.calculateStatus)(mergedData);
    // Only update if status implies a change or if we want to force it
    // The legacy function did an update.
    if ((currentData === null || currentData === void 0 ? void 0 : currentData.status) !== newStatus) {
        await processRef.update({ status: newStatus });
        // Audit
        await db.collection('auditLogs').add({
            organization_id: currentData === null || currentData === void 0 ? void 0 : currentData.organization_id,
            user_id: request.auth.uid,
            user_name: request.auth.token.name || '',
            action: 'UPDATE_STATUS',
            details: {
                process_id: processId,
                old_status: currentData === null || currentData === void 0 ? void 0 : currentData.status,
                new_status: newStatus
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    return { success: true, status: newStatus };
});
//# sourceMappingURL=calculateStatus.js.map