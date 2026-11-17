import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hasOrgPermission, MembershipLike } from '../shared/permissions';
import { vinculoBloqueado } from '../shared/vinculo';
import { conferirExclusao } from '../registros/aditivos';

interface DeleteProcessRequest {
    id: string;
    organizationId: string;
}

export const deleteProcess = onCall<DeleteProcessRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { id, organizationId } = request.data;
        if (!id || !organizationId) {
            throw new HttpsError('invalid-argument', 'Missing ID');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify permissions (Manager only)
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists || vinculoBloqueado(membershipSnap.data())) {
            throw new HttpsError('permission-denied', 'Not a member');
        }
        // O criador pode excluir; membros precisam da permissão `delete_records`.
        if (!hasOrgPermission(membershipSnap.data() as MembershipLike, 'delete_records')) {
            throw new HttpsError('permission-denied', 'Only the organization creator can delete processes');
        }

        // 2. Verify the target record actually belongs to this organization —
        // sem isto, um usuário com delete_records no órgão A podia apagar
        // qualquer processo de outro órgão (B) só informando o organizationId
        // de A (que passa na checagem de permissão) junto do ID do documento
        // de B.
        const processRef = db.collection('processes').doc(id);
        const processSnap = await processRef.get();
        if (!processSnap.exists) {
            throw new HttpsError('not-found', 'Process not found');
        }
        if (processSnap.data()?.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Process belongs to another organization');
        }

        // 3. Delete (recursivo: remove também as subcoleções history/comments —
        // um `.delete()` simples deixava essas subcoleções órfãs e, pelas
        // regras de leitura delas dependerem de um get() no doc pai, também
        // permanentemente inacessíveis, sem nenhuma forma de limpeza depois).
        const depois = await conferirExclusao('processes', organizationId, id, processSnap.data() || {});
        await db.recursiveDelete(processRef);
        if (depois) await depois(userId, request.auth.token.name || 'Usuário desconhecido');

        // 4. Update stats
        await db.collection('organizations').doc(organizationId).update({
            'stats.processes_count': FieldValue.increment(-1),
            'stats.active_processes': FieldValue.increment(-1)
        });

        // 5. Audit
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_PROCESS',
            details: { process_id: id },
            timestamp: FieldValue.serverTimestamp()
        });

        return { success: true };
    }
);
