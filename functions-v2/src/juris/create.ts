import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { historyEntryId } from '../shared/history';
import {
    resolveJurimetriaSettings,
    sanitizeJuriInput,
    normalizeProcessNumber,
} from '../shared/jurimetria';

interface CreateJuriRequest {
    organizationId: string;
    /** Campos fixos + `values` com as colunas personalizadas do órgão. */
    data: Record<string, unknown>;
}

export const createJuri = onCall<CreateJuriRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { organizationId, data } = request.data || ({} as CreateJuriRequest);
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Membro do órgão?
        const membershipSnap = await db
            .collection('userOrganizations')
            .doc(`${userId}_${organizationId}`)
            .get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        // 2. Configuração do órgão (listas oficiais e colunas personalizadas).
        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        if (!orgSnap.exists) {
            throw new HttpsError('not-found', 'Organização não encontrada');
        }
        const settings = resolveJurimetriaSettings(orgSnap.data());

        // 3. Validação + normalização.
        const { core, values } = sanitizeJuriInput(data || {}, settings);
        if (!core.numero_processo) {
            throw new HttpsError('invalid-argument', 'O número do processo é obrigatório');
        }
        if (!core.data_juri) {
            throw new HttpsError('invalid-argument', 'A data do júri é obrigatória e deve ser válida');
        }

        const numeroNorm = normalizeProcessNumber(core.numero_processo);

        // 4. Duplicidade: o número do processo é a chave natural dentro do órgão.
        if (numeroNorm) {
            const dupSnap = await db
                .collection('juris')
                .where('organization_id', '==', organizationId)
                .where('numero_processo_norm', '==', numeroNorm)
                .limit(1)
                .get();
            if (!dupSnap.empty) {
                throw new HttpsError(
                    'already-exists',
                    `Já existe um júri cadastrado com o processo ${core.numero_processo} neste órgão.`
                );
            }
        }

        // 5. Responsável (opcional) — precisa ser membro do próprio órgão.
        const responsibleUserId = String(
            (data as any)?.responsible_user_id ?? ''
        ).trim() || null;
        let responsibleUserName = String((data as any)?.responsible_user_name ?? '').trim().slice(0, 160) || null;
        if (responsibleUserId) {
            const respSnap = await db
                .collection('userOrganizations')
                .doc(`${responsibleUserId}_${organizationId}`)
                .get();
            if (!respSnap.exists) {
                throw new HttpsError('invalid-argument', 'O responsável indicado não é membro deste órgão');
            }
            if (!responsibleUserName) {
                responsibleUserName = String(respSnap.data()?.user_name || '') || null;
            }
        }
        if (settings.requireResponsible && !responsibleUserId) {
            throw new HttpsError('invalid-argument', 'Este órgão exige um responsável para cada júri');
        }

        const juriRef = db.collection('juris').doc();
        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];
        const userName = request.auth.token.name || 'Usuário desconhecido';

        const logEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: 'Júri cadastrado manualmente',
            timestamp: now.toISOString(),
        };

        await juriRef.set({
            id: juriRef.id,
            organization_id: organizationId,
            ...core,
            numero_processo_norm: numeroNorm,
            values,
            responsible_user_id: responsibleUserId,
            responsible_user_name: responsibleUserName,
            source: 'manual',
            imported_from: null,
            created_by: userId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            activity_log: [logEntry],
        });

        // Espelho do log na subcoleção `history` (best-effort, idempotente).
        try {
            await juriRef.collection('history').doc(historyEntryId(logEntry)).set({
                ...logEntry,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (histErr) {
            console.error('[history dual-write] juri create', juriRef.id, histErr);
        }

        await db.collection('organizations').doc(organizationId).update({
            'stats.juris_count': admin.firestore.FieldValue.increment(1),
        });

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'CREATE_JURI',
            details: { juri_id: juriRef.id, numero_processo: core.numero_processo },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, juriId: juriRef.id };
    }
);
