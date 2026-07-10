import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

// Chave de API do provedor de e-mail transacional (Resend). Configurada fora
// do app via `firebase functions:secrets:set EMAIL_API_KEY` — NUNCA guardada
// no Firestore nem no código. Sem este secret, `sendEmail` é um no-op
// silencioso (loga e retorna), preservando o "zero-quebra": a flag
// `scheduled_email_reports` pode estar ligada sem que nada seja enviado até
// que um super-admin configure o provedor.
export const EMAIL_API_KEY = defineSecret('EMAIL_API_KEY');

interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
}

// Envia via API REST da Resend (https://resend.com/docs/api-reference/emails/send-email).
// Provedor único, deliberadamente simples: se o projeto adotar outro serviço
// no futuro, esta é a única função a trocar.
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
    const apiKey = EMAIL_API_KEY.value();
    if (!apiKey) {
        console.log('[email] EMAIL_API_KEY não configurado — envio ignorado.', { to, subject });
        return false;
    }

    const db = admin.firestore();
    const providerSnap = await db.collection('platformConfig').doc('emailProvider').get();
    const provider = providerSnap.data();
    const fromEmail = provider?.fromEmail;
    if (!fromEmail) {
        console.log('[email] Remetente (fromEmail) não configurado em Administração da Plataforma — envio ignorado.');
        return false;
    }
    const fromName = provider?.fromName || 'Consultas CAO';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: [to],
                subject,
                html,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error('[email] Falha ao enviar', response.status, body);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[email] Erro ao enviar', error);
        return false;
    }
}

// Resolve o melhor e-mail de destino para um usuário: notification_email
// (campo dedicado, definido em Meu Perfil) e, na ausência, o e-mail da
// própria conta Firebase Auth.
export async function resolveUserEmail(userId: string): Promise<string | null> {
    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(userId).get();
    const notificationEmail = userSnap.data()?.notification_email;
    if (notificationEmail) return notificationEmail;

    try {
        const userRecord = await admin.auth().getUser(userId);
        return userRecord.email || null;
    } catch {
        return null;
    }
}
