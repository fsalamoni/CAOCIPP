import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sanitizeEntityTypeDefinition } from './schema';

const REGION = 'southamerica-east1';

interface UpsertEntityTypeRequest {
    organizationId: string;
    entityType: any; // validado por sanitizeEntityTypeDefinition
}

async function assertManager(db: FirebaseFirestore.Firestore, userId: string, organizationId: string) {
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const snap = await membershipRef.get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'Você não é membro desta organização.');
    }
    const role = snap.data()?.role;
    if (role !== 'creator' && role !== 'admin') {
        throw new HttpsError('permission-denied', 'Apenas o Criador ou Administradores podem gerenciar páginas personalizadas.');
    }
    return role;
}

export const upsertEntityType = onCall<UpsertEntityTypeRequest>(
    { region: REGION },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, entityType } = request.data || ({} as UpsertEntityTypeRequest);
        if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId é obrigatório.');

        const db = admin.firestore();
        await assertManager(db, userId, organizationId);

        let def;
        try {
            def = sanitizeEntityTypeDefinition(entityType);
        } catch (e: any) {
            throw new HttpsError('invalid-argument', e?.message || 'Definição inválida.');
        }

        const existingId = entityType?.id ? String(entityType.id) : null;
        const ref = existingId
            ? db.collection('entityTypes').doc(existingId)
            : db.collection('entityTypes').doc();

        // Se for edição, confirma que pertence ao mesmo órgão.
        if (existingId) {
            const cur = await ref.get();
            if (cur.exists && cur.data()?.organization_id !== organizationId) {
                throw new HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
            }
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const payload: any = {
            ...def,
            id: ref.id,
            organization_id: organizationId,
            updated_at: now,
            updated_by: userId,
        };
        if (!existingId) {
            payload.created_at = now;
            payload.created_by = userId;
        }

        await ref.set(payload, { merge: true });

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: existingId ? 'UPDATE_ENTITY_TYPE' : 'CREATE_ENTITY_TYPE',
            details: { entity_type_id: ref.id, label: def.label_plural },
            timestamp: now,
        });

        return { success: true, entityTypeId: ref.id };
    }
);

interface DeleteEntityTypeRequest {
    organizationId: string;
    entityTypeId: string;
}

export const deleteEntityType = onCall<DeleteEntityTypeRequest>(
    { region: REGION },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, entityTypeId } = request.data || ({} as DeleteEntityTypeRequest);
        if (!organizationId || !entityTypeId) {
            throw new HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
        }

        const db = admin.firestore();
        await assertManager(db, userId, organizationId);

        const ref = db.collection('entityTypes').doc(entityTypeId);
        const snap = await ref.get();
        if (!snap.exists) {
            return { success: true, message: 'Tipo já removido.' };
        }
        if (snap.data()?.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
        }

        // Bloqueia exclusão se houver registros (preserva dados). Oferece desativar.
        const hasRecords = await db.collection('customRecords')
            .where('organization_id', '==', organizationId)
            .where('entity_type_id', '==', entityTypeId)
            .limit(1)
            .get();
        if (!hasRecords.empty) {
            throw new HttpsError(
                'failed-precondition',
                'Este tipo possui registros. Desative-o em vez de excluir, ou remova os registros antes.'
            );
        }

        await ref.delete();

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_ENTITY_TYPE',
            details: { entity_type_id: entityTypeId },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    }
);
