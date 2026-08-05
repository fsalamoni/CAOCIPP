import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface AddCommentRequest {
    organizationId: string;
    entityType: 'process' | 'expediente' | 'parceria';
    entityId: string;
    text: string;
    mentionedUserIds?: string[];
}

const ENTITY_COLLECTION: Record<string, string> = {
    process: 'processes',
    expediente: 'expedientes',
    parceria: 'parcerias',
};

const ENTITY_NUMBER_FIELD: Record<string, string> = {
    process: 'process_number',
    expediente: 'expediente_number',
    parceria: 'pgea',
};

const ENTITY_LABEL: Record<string, string> = {
    process: 'Consulta',
    expediente: 'Expediente',
    parceria: 'Parceria',
};

// Comentários internos com @menção (flag `process_comments`). Escrita
// exclusiva via Cloud Function: valida associação ao órgão, valida que o
// registro pertence ao órgão informado, e só notifica quem for de fato
// membro do órgão (mesmo que o cliente tenha enviado IDs incorretos/antigos).
export const addComment = onCall<AddCommentRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { organizationId, entityType, entityId } = request.data;
        const text = (request.data.text || '').trim();
        const mentionedUserIds = Array.isArray(request.data.mentionedUserIds) ? request.data.mentionedUserIds : [];

        if (!organizationId || !entityType || !entityId || !text) {
            throw new HttpsError('invalid-argument', 'Missing required fields');
        }
        const collectionName = ENTITY_COLLECTION[entityType];
        if (!collectionName) {
            throw new HttpsError('invalid-argument', 'Invalid entityType');
        }
        if (text.length > 2000) {
            throw new HttpsError('invalid-argument', 'Comment too long (max 2000 characters)');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verifica associação ao órgão.
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'You are not a member of this organization');
        }

        // 2. Verifica que o registro pertence a este órgão.
        const entityRef = db.collection(collectionName).doc(entityId);
        const entitySnap = await entityRef.get();
        const entityData = entitySnap.data();
        if (!entitySnap.exists || entityData?.organization_id !== organizationId) {
            throw new HttpsError('not-found', 'Record not found in this organization');
        }

        // 3. Só notifica quem for realmente membro do órgão (defesa contra IDs
        // arbitrários enviados pelo cliente).
        const candidateMentions = mentionedUserIds.filter((id) => id && id !== userId);
        let validMentions: string[] = [];
        if (candidateMentions.length > 0) {
            const checks = await Promise.all(
                candidateMentions.map(async (id) => {
                    const snap = await db.collection('userOrganizations').doc(`${id}_${organizationId}`).get();
                    return snap.exists ? id : null;
                })
            );
            validMentions = checks.filter((id): id is string => Boolean(id));
        }

        const userName = request.auth.token.name || 'Usuário';
        const commentRef = entityRef.collection('comments').doc();

        await commentRef.set({
            text,
            author_id: userId,
            author_name: userName,
            mentioned_user_ids: validMentions,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Notificações para os mencionados — respeita a preferência de
        // notificação de cada usuário (userPreferences/{uid}.notificationPreferences.mention),
        // que por padrão (campo ausente) é considerada ligada.
        if (validMentions.length > 0) {
            const prefSnaps = await Promise.all(
                validMentions.map((id) => db.collection('userPreferences').doc(id).get())
            );
            const recipients = validMentions.filter((_, idx) => {
                const prefs = prefSnaps[idx].data()?.notificationPreferences;
                return prefs?.mention !== false;
            });

            if (recipients.length > 0) {
                const batch = db.batch();
                const entityNumber = entityData?.[ENTITY_NUMBER_FIELD[entityType]] || '';
                recipients.forEach((mentionedId) => {
                    const notifRef = db.collection('notifications').doc();
                    batch.set(notifRef, {
                        user_id: mentionedId,
                        type: 'mention',
                        title: `${userName} mencionou você em um comentário`,
                        message: `${ENTITY_LABEL[entityType]} ${entityNumber}`.trim(),
                        organization_id: organizationId,
                        entity_type: entityType,
                        entity_id: entityId,
                        read: false,
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
                await batch.commit();
            }
        }

        return { success: true, commentId: commentRef.id };
    }
);
