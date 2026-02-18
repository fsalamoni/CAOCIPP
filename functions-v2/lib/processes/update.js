"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProcess = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
exports.updateProcess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
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
    // Allow update if user is an authenticated member of the organization
    // We already verified membershipSnap.exists above
    const isMember = membershipSnap.exists;
    if (!isMember) {
        throw new https_1.HttpsError('permission-denied', 'Insufficient permissions to update this process');
    }
    // 2. Apply updates
    // Sanitize changes to prevent overwriting critical fields like id, organization_id
    delete changes.id;
    delete changes.organization_id;
    delete changes.created_at;
    delete changes.created_by;
    delete changes.activity_log; // Prevent manual log manipulation
    changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
    changes.updated_by = userId;
    // Auto-fill distribution_date when responsible changes
    if (changes.responsible_user_id &&
        changes.responsible_user_id !== processData.responsible_user_id &&
        !changes.distribution_date) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        changes.distribution_date = today;
    }
    // Recalculate status
    const mergedData = Object.assign(Object.assign({}, processData), changes);
    const statusInChanges = changes.status;
    const currentStatus = processData.status;
    if (statusInChanges && statusInChanges !== currentStatus) {
        // Respect manual status override
    }
    else {
        const newStatus = (0, status_1.calculateStatus)(mergedData);
        if (newStatus && newStatus !== currentStatus) {
            changes.status = newStatus;
        }
    }
    // 3. Build per-process activity log entry
    const now = new Date();
    const logDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const logTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const userName = request.auth.token.name || 'Usuário desconhecido';
    // Build human-readable action description
    const fieldLabels = {
        process_number: 'Número do Processo',
        consultant: 'Consulente',
        location: 'Local dos Fatos',
        entry_date: 'Data de Entrada',
        matter_object: 'Objeto da Consulta',
        urgency_request: 'Pedido de Urgência',
        distribution_date: 'Data de Distribuição',
        responsible_user_id: 'Responsável',
        responsible_user_name: 'Nome do Responsável',
        analysis_start_date: 'Início da Análise',
        observations: 'Observações',
        review_submission_date: 'Remessa para Revisão',
        review_return_date: 'Retorno da Revisão',
        archived_date: 'Data de Arquivamento',
        access_restriction: 'Restrição de Acesso',
        network_folder: 'Pasta na Rede',
        decision: 'Decisão',
        status: 'Status',
    };
    const changedFields = Object.keys(changes)
        .filter(k => !['updated_at', 'updated_by'].includes(k))
        .map(k => fieldLabels[k] || k);
    let actionDesc = '';
    if (changedFields.length === 1 && changes.status && changes.status !== currentStatus) {
        actionDesc = `Status alterado de "${currentStatus || 'Pendente'}" para "${changes.status}"`;
    }
    else if (changedFields.length > 0) {
        actionDesc = `Campos atualizados: ${changedFields.join(', ')}`;
    }
    else {
        actionDesc = 'Processo atualizado';
    }
    const logEntry = {
        date: logDate,
        time: logTime,
        user_id: userId,
        user_name: userName,
        action: actionDesc,
        timestamp: now.toISOString(),
    };
    // Append to activity_log array
    changes.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);
    await processRef.update(changes);
    // 4. Global Audit Log (keep for backward compat)
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'UPDATE_PROCESS',
        details: { process_id: id, changes: Object.keys(changes) },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=update.js.map