import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

const PLATFORM_CONFIG = 'platformConfig';
const FEATURE_FLAGS_DOC = 'featureFlags';

interface GetFlagsResponse {
    flags: Record<string, boolean>;
    updatedAt: string | null;
    updatedBy: string | null;
}

/**
 * getFeatureFlags - Lê o documento global de feature flags.
 * Apenas super-admin (o front também lê via onSnapshot quando autorizado).
 */
export const getFeatureFlags = onCall<void>(
    { region: REGION },
    async (request): Promise<GetFlagsResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const snap = await db.collection(PLATFORM_CONFIG).doc(FEATURE_FLAGS_DOC).get();

        if (!snap.exists) {
            return { flags: {}, updatedAt: null, updatedBy: null };
        }
        const data = snap.data() || {};
        const updatedAt = data.updated_at?.toDate
            ? data.updated_at.toDate().toISOString()
            : null;
        return {
            flags: data.flags || {},
            updatedAt,
            updatedBy: data.updated_by || null,
        };
    }
);

interface SetFlagRequest {
    flagKey: string;
    enabled: boolean;
}

/**
 * setFeatureFlag - Liga/desliga UMA flag global.
 * Escrita exclusiva de super-admin, com auditoria.
 * Operação aditiva: usa merge, nunca apaga outras flags.
 */
export const setFeatureFlag = onCall<SetFlagRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const { flagKey, enabled } = request.data || ({} as SetFlagRequest);

        if (!flagKey || typeof flagKey !== 'string') {
            throw new HttpsError('invalid-argument', 'flagKey é obrigatório.');
        }
        if (typeof enabled !== 'boolean') {
            throw new HttpsError('invalid-argument', 'enabled deve ser booleano.');
        }

        const db = admin.firestore();
        const ref = db.collection(PLATFORM_CONFIG).doc(FEATURE_FLAGS_DOC);

        await ref.set(
            {
                flags: { [flagKey]: enabled },
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: actor.name,
                updated_by_uid: actor.uid,
            },
            { merge: true }
        );

        await writePlatformAudit(actor.uid, actor.name, 'SET_FEATURE_FLAG', {
            flagKey,
            enabled,
        });

        return { success: true, flagKey, enabled };
    }
);
