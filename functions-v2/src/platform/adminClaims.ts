import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

const COLLECTION = 'platformAdmins';

/**
 * Aplica/remove o custom claim platformAdmin para um usuário.
 */
async function setAdminClaim(uid: string, enabled: boolean): Promise<void> {
    const user = await admin.auth().getUser(uid);
    const existing = user.customClaims || {};
    await admin.auth().setCustomUserClaims(uid, {
        ...existing,
        platformAdmin: enabled,
    });
}

interface GrantRequest {
    email: string;
}

/**
 * grantPlatformAdmin - Concede acesso de super-admin a um e-mail.
 * Adiciona à allowlist (platformAdmins/{uid}) e aplica o custom claim.
 * Só pode ser chamado por um super-admin já existente (ou bootstrap por env).
 */
export const grantPlatformAdmin = onCall<GrantRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const email = String(request.data?.email || '').trim().toLowerCase();
        if (!email) {
            throw new HttpsError('invalid-argument', 'E-mail é obrigatório.');
        }

        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        } catch {
            throw new HttpsError(
                'not-found',
                'Não há usuário cadastrado com este e-mail. Peça para a pessoa fazer login uma vez primeiro.'
            );
        }

        const db = admin.firestore();
        await db.collection(COLLECTION).doc(userRecord.uid).set(
            {
                uid: userRecord.uid,
                email,
                active: true,
                granted_by: actor.name,
                granted_by_uid: actor.uid,
                granted_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        await setAdminClaim(userRecord.uid, true);
        await writePlatformAudit(actor.uid, actor.name, 'GRANT_PLATFORM_ADMIN', {
            target_uid: userRecord.uid,
            target_email: email,
        });

        return { success: true, uid: userRecord.uid, email };
    }
);

interface RevokeRequest {
    uid: string;
}

/**
 * revokePlatformAdmin - Revoga o acesso de super-admin de um usuário.
 * Desativa na allowlist e remove o custom claim.
 */
export const revokePlatformAdmin = onCall<RevokeRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const uid = String(request.data?.uid || '').trim();
        if (!uid) {
            throw new HttpsError('invalid-argument', 'uid é obrigatório.');
        }
        if (uid === actor.uid) {
            throw new HttpsError(
                'failed-precondition',
                'Você não pode revogar o seu próprio acesso de super-admin.'
            );
        }

        const db = admin.firestore();
        await db.collection(COLLECTION).doc(uid).set(
            {
                active: false,
                revoked_by: actor.name,
                revoked_by_uid: actor.uid,
                revoked_at: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        await setAdminClaim(uid, false);
        await writePlatformAudit(actor.uid, actor.name, 'REVOKE_PLATFORM_ADMIN', {
            target_uid: uid,
        });

        return { success: true, uid };
    }
);

/**
 * listPlatformAdmins - Lista todos os super-admins (ativos e revogados).
 */
export const listPlatformAdmins = onCall<void>(
    { region: REGION },
    async (request) => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const snap = await db.collection(COLLECTION).get();
        const admins = snap.docs.map((d) => {
            const data = d.data();
            return {
                uid: d.id,
                email: data.email || null,
                active: data.active === true,
                granted_by: data.granted_by || null,
                granted_at: data.granted_at?.toDate
                    ? data.granted_at.toDate().toISOString()
                    : null,
            };
        });
        return { admins };
    }
);
