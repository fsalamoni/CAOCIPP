import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateStatus } from '../shared/status';

interface UpdateExpedienteRequest {
    id: string;
    organizationId: string;
    changes: Record<string, any>;
}

export const updateExpediente = onCall<UpdateExpedienteRequest>(
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

        // 2. Read existing expediente
        const expedienteRef = db.collection('expedientes').doc(id);
        const expedienteSnap = await expedienteRef.get();

        if (!expedienteSnap.exists) {
            throw new HttpsError('not-found', 'Expediente not found');
        }

        const expedienteData = expedienteSnap.data();
        if (expedienteData?.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Expediente belongs to another organization');
        }

        // 3. Sanitize changes
        delete changes.id;
        delete changes.organization_id;
        delete changes.created_at;
        delete changes.created_by;
        delete changes.activity_log;

        changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
        changes.updated_by = userId;

        // Auto-fill distribution_date when responsible changes
        if (
            changes.responsible_user_id &&
            changes.responsible_user_id !== expedienteData.responsible_user_id &&
            !changes.distribution_date
        ) {
            const today = new Date().toISOString().split('T')[0];
            changes.distribution_date = today;
        }

        // Recalculate status
        const mergedData = { ...expedienteData, ...changes };
        const statusInChanges = changes.status;
        const currentStatus = expedienteData.status;

        if (statusInChanges && statusInChanges !== currentStatus) {
            // Respect manual status override
        } else {
            const newStatus = calculateStatus(mergedData);
            if (newStatus && newStatus !== currentStatus) {
                changes.status = newStatus;
            }
        }

        // 4. Build activity log entry
        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];
        const userName = request.auth.token.name || 'Usuário desconhecido';

        const fieldLabels: Record<string, string> = {
            expediente_number: 'Número do Expediente',
            system: 'Sistema',
            origin: 'Origem',
            entry_date: 'Data de Entrada',
            object: 'Objeto',
            urgency_request: 'Pedido de Urgência',
            distribution_date: 'Data de Distribuição',
            responsible_user_id: 'Responsável',
            responsible_user_name: 'Nome do Responsável',
            analysis_start_date: 'Início da Análise',
            observations: 'Observações',
            review_submission_date: 'Remessa para Revisão',
            review_return_date: 'Devolução após Revisão',
            archived_date: 'Data de Arquivamento',
            network_folder: 'Pasta na Rede',
            status: 'Status',
        };

        const changedFields = Object.keys(changes)
            .filter(k => !['updated_at', 'updated_by'].includes(k))
            .map(k => fieldLabels[k] || k);

        let actionDesc = '';
        if (changedFields.length === 1 && changes.status && changes.status !== currentStatus) {
            actionDesc = `Status alterado de "${currentStatus || 'Pendente'}" para "${changes.status}"`;
        } else if (changedFields.length > 0) {
            actionDesc = `Campos atualizados: ${changedFields.join(', ')}`;
        } else {
            actionDesc = 'Expediente atualizado';
        }

        const logEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: actionDesc,
            timestamp: now.toISOString(),
        };

        changes.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);

        await expedienteRef.update(changes);

        // 5. Global Audit Log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'UPDATE_EXPEDIENTE',
            details: { expediente_id: id, changes: Object.keys(changes) },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    }
);
