import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hasOrgPermission, MembershipLike } from '../shared/permissions';

interface DeleteParceriaRequest {
    id: string;
    organizationId: string;
}

export const deleteParceria = onCall<DeleteParceriaRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { id, organizationId } = request.data || ({} as DeleteParceriaRequest);
        if (!id || !organizationId) {
            throw new HttpsError('invalid-argument', 'id e organizationId são obrigatórios');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify membership + permissão
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }
        if (!hasOrgPermission(membershipSnap.data() as MembershipLike, 'delete_records')) {
            throw new HttpsError(
                'permission-denied',
                'Você não tem permissão para excluir Parcerias neste órgão'
            );
        }

        // 2. IDOR check
        const parceriaRef = db.collection('parcerias').doc(id);
        const parceriaSnap = await parceriaRef.get();
        if (!parceriaSnap.exists) {
            throw new HttpsError('not-found', 'Parceria não encontrada');
        }
        if (parceriaSnap.data()?.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Parceria pertence a outra organização');
        }

        // 3. recursiveDelete: remove a Parceria + history/ + aditivos/* + comments/
        await db.recursiveDelete(parceriaRef);

        // 4. Update stats
        await db.collection('organizations').doc(organizationId).update({
            'stats.parcerias_count': admin.firestore.FieldValue.increment(-1),
            'stats.active_parcerias': admin.firestore.FieldValue.increment(-1),
        });

        // 5. Audit
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_PARCERIA',
            details: { parceria_id: id },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    }
);
