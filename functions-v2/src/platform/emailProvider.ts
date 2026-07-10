import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

const PLATFORM_CONFIG = 'platformConfig';
const EMAIL_PROVIDER_DOC = 'emailProvider';

// Configuração NÃO sensível do provedor de e-mail (relatórios agendados,
// flag `scheduled_email_reports`). A chave de API real NUNCA é guardada
// aqui — vive na variável de ambiente EMAIL_API_KEY da Cloud Function
// (ver functions-v2/src/shared/email.ts), configurada fora do app.
// Sem essa variável configurada, o envio fica inativo mesmo com tudo aqui preenchido.
interface EmailProviderConfig {
    fromEmail: string;
    fromName: string;
}

export const getEmailProviderConfig = onCall<void>(
    { region: REGION },
    async (request) => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const snap = await db.collection(PLATFORM_CONFIG).doc(EMAIL_PROVIDER_DOC).get();
        const data = snap.exists ? snap.data() : {};
        return {
            fromEmail: data?.fromEmail || '',
            fromName: data?.fromName || '',
        };
    }
);

export const setEmailProviderConfig = onCall<EmailProviderConfig>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const fromEmail = String(request.data?.fromEmail || '').trim().slice(0, 200);
        const fromName = String(request.data?.fromName || '').trim().slice(0, 120);

        if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
            throw new HttpsError('invalid-argument', 'fromEmail inválido.');
        }

        const db = admin.firestore();
        await db.collection(PLATFORM_CONFIG).doc(EMAIL_PROVIDER_DOC).set({
            fromEmail,
            fromName,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: actor.name,
            updated_by_uid: actor.uid,
        }, { merge: true });

        await writePlatformAudit(actor.uid, actor.name, 'SET_EMAIL_PROVIDER_CONFIG', { fromEmail, fromName });

        return { success: true };
    }
);
