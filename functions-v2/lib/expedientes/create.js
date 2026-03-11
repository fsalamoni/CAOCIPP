"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpediente = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
exports.createExpediente = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const data = request.data;
    const { organizationId, expedienteNumber } = data;
    if (!organizationId || !expedienteNumber) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    // 2. Calculate initial status based on dates
    const status = (0, status_1.calculateStatus)({
        entry_date: data.entryDate,
        distribution_date: data.distributionDate,
        analysis_start_date: data.analysisStartDate,
        review_submission_date: data.reviewSubmissionDate,
        review_return_date: data.reviewReturnDate,
        archived_date: data.archivedDate
    });
    // 3. Create expediente
    const expedienteRef = db.collection('expedientes').doc();
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const expedienteData = {
        id: expedienteRef.id,
        organization_id: organizationId,
        expediente_number: expedienteNumber,
        system: data.system || '',
        origin: data.origin || '',
        entry_date: data.entryDate || null,
        object: data.object || '',
        status: status,
        urgency_request: data.urgencyRequest || false,
        distribution_date: data.distributionDate || null,
        responsible_user_id: data.responsibleUserId || null,
        responsible_user_name: data.responsibleUserName || null,
        analysis_start_date: data.analysisStartDate || null,
        observations: data.observations || '',
        review_submission_date: data.reviewSubmissionDate || null,
        review_return_date: data.reviewReturnDate || null,
        archived_date: data.archivedDate || null,
        network_folder: data.networkFolder || '',
        created_by: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        activity_log: [{
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: 'Expediente criado manualmente',
                timestamp: now.toISOString(),
            }],
    };
    await expedienteRef.set(expedienteData);
    // 4. Update stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.expedientes_count': admin.firestore.FieldValue.increment(1),
        'stats.active_expedientes': admin.firestore.FieldValue.increment(1)
    });
    // 5. Audit Log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'CREATE_EXPEDIENTE',
        details: { expediente_number: expedienteNumber, expediente_id: expedienteRef.id },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, expedienteId: expedienteRef.id };
});
//# sourceMappingURL=create.js.map