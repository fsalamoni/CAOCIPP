import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hasOrgPermission, MembershipLike } from '../shared/permissions';

interface DeleteJurisRequest {
    organizationId: string;
    /** Um id (exclusão individual) ou vários (exclusão em massa). */
    id?: string;
    ids?: string[];
}

/** Teto por chamada: mantém a operação dentro do tempo/limite de lote. */
const MAX_BULK_DELETE = 500;

export const deleteJuris = onCall<DeleteJurisRequest>(
    { region: 'southamerica-east1', timeoutSeconds: 300 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { organizationId, id, ids } = request.data || ({} as DeleteJurisRequest);
        const targetIds = [...new Set(
            (Array.isArray(ids) ? ids : [])
                .concat(id ? [id] : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        )];

        if (!organizationId || targetIds.length === 0) {
            throw new HttpsError('invalid-argument', 'organizationId e ao menos um id são obrigatórios');
        }
        if (targetIds.length > MAX_BULK_DELETE) {
            throw new HttpsError(
                'invalid-argument',
                `Selecione no máximo ${MAX_BULK_DELETE} júris por vez (recebidos: ${targetIds.length}).`
            );
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        const membershipSnap = await db
            .collection('userOrganizations')
            .doc(`${userId}_${organizationId}`)
            .get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }
        if (!hasOrgPermission(membershipSnap.data() as MembershipLike, 'delete_records')) {
            throw new HttpsError(
                'permission-denied',
                'Você não tem permissão para excluir júris neste órgão'
            );
        }

        let deleted = 0;
        let skipped = 0;

        // Processa em lotes paralelos: 500 exclusões recursivas em série
        // estourariam o tempo limite da função.
        const CONCURRENCY = 20;
        for (let i = 0; i < targetIds.length; i += CONCURRENCY) {
            const chunk = targetIds.slice(i, i + CONCURRENCY);
            const refs = chunk.map((juriId) => db.collection('juris').doc(juriId));
            const snaps = await db.getAll(...refs);

            const removable = snaps.filter((snap) => {
                // IDOR: nunca apaga um documento de outro órgão, mesmo que o id exista.
                if (!snap.exists || snap.data()?.organization_id !== organizationId) {
                    skipped += 1;
                    return false;
                }
                return true;
            });

            await Promise.all(removable.map((snap) => db.recursiveDelete(snap.ref)));
            deleted += removable.length;
        }

        if (deleted > 0) {
            await db.collection('organizations').doc(organizationId).update({
                'stats.juris_count': admin.firestore.FieldValue.increment(-deleted),
            });
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_JURI',
            details: { deleted, requested: targetIds.length, skipped },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, deleted, skipped };
    }
);
