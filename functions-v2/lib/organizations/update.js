"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganization = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.updateOrganization = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { organizationId, data } = request.data;
    const requesterId = request.auth.uid;
    const db = admin.firestore();
    // 1. Verify access (Must be CREATOR)
    // Memberships are stored in 'userOrganizations' collection as {userId}_{orgId}
    const membershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'User is not a member of this organization');
    }
    const membership = membershipSnap.data();
    if ((membership === null || membership === void 0 ? void 0 : membership.role) !== 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Only the organization Creator can update settings');
    }
    // 2. Validate Data
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'Organization ID is required');
    }
    // 3. Update Organization
    // Only allow specific fields to be updated
    const updates = {};
    if (data.name !== undefined)
        updates.name = data.name;
    if (data.description !== undefined)
        updates.description = data.description;
    if (data.matterSettings !== undefined)
        updates.matterSettings = data.matterSettings;
    if (data.summarySettings !== undefined)
        updates.summarySettings = data.summarySettings;
    if (data.expedienteSettings !== undefined)
        updates.expedienteSettings = data.expedienteSettings;
    if (data.moduleConfig !== undefined)
        updates.moduleConfig = sanitizeModuleConfig(data.moduleConfig);
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    if (Object.keys(updates).length === 0) {
        return { success: true, message: 'No changes detected' };
    }
    await db.collection('organizations').doc(organizationId).update(updates);
    // 4. Audit Log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: request.auth.token.name || 'Unknown',
        action: 'UPDATE_ORGANIZATION',
        details: {
            fields_updated: Object.keys(updates).filter(k => k !== 'updated_at')
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Organization updated successfully' };
});
// Aceita apenas módulos built-in conhecidos, com booleano enabled e order numérico.
function sanitizeModuleConfig(input) {
    const allowed = ['processes', 'expedientes', 'summary'];
    const out = {};
    for (const key of allowed) {
        const entry = input === null || input === void 0 ? void 0 : input[key];
        if (entry && typeof entry === 'object') {
            out[key] = Object.assign({ enabled: entry.enabled === true }, (typeof entry.order === 'number' ? { order: entry.order } : {}));
        }
    }
    return out;
}
//# sourceMappingURL=update.js.map