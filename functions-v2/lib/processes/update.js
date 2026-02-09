"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProcess = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
exports.updateProcess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId, changes } = request.data;
    if (!id || !organizationId || !changes) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify permissions
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    const role = (_a = membershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role;
    // Check if user is owner of process or admin/creator
    // For simplicity, we trust the membership logic here, but stricter rule would read process first.
    // Let's read process to be safe and also to update logs.
    const processRef = db.collection('processes').doc(id);
    const processSnap = await processRef.get();
    if (!processSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Process not found');
    }
    const processData = processSnap.data();
    if ((processData === null || processData === void 0 ? void 0 : processData.organization_id) !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Process belongs to another organization');
    }
    // Allow update if admin/creator OR responsible user
    const isResponsible = (processData === null || processData === void 0 ? void 0 : processData.responsible_user_id) === userId;
    const isManager = ['admin', 'creator'].includes(role);
    if (!isManager && !isResponsible) {
        // Members can usually update if they created it? Or just read?
        // Current rules say: update if member AND (manager OR owner).
        throw new https_1.HttpsError('permission-denied', 'Insufficient permissions to update this process');
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
    const mergedData = Object.assign(Object.assign({}, processData), changes);
    // Status Logic:
    // 1. If explicit status is provided in changes, USE IT (manual override)
    // 2. If no status provided, Calculate it based on dates (automatic)
    if (changes.status) {
        // Respect manual status change
    }
    else {
        const newStatus = (0, status_1.calculateStatus)(mergedData);
        if (newStatus && newStatus !== processData.status) {
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
});
//# sourceMappingURL=update.js.map