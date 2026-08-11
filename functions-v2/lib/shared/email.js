"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.resolveUserEmail = resolveUserEmail;
const admin = require("firebase-admin");
// Chave de API do provedor de e-mail transacional (Resend). Lida de uma
// variável de ambiente simples (process.env.EMAIL_API_KEY) — DELIBERADAMENTE
// NÃO usa o Secret Manager do GCP (`defineSecret`/`firebase functions:secrets:set`):
// isso exigiria habilitar a API do Secret Manager no projeto, e o deploy de
// QUALQUER função que declare esse secret falha inteiro (não só a função)
// enquanto a API/segredo não existir — já aconteceu aqui e derrubou o deploy
// completo (hosting+functions+firestore), não só o dos e-mails.
//
// Configuração (opcional, sem isso o envio fica graciosamente inativo):
// crie `functions-v2/.env` (git-ignorado) com `EMAIL_API_KEY=...`, ou defina
// a variável de ambiente da função pelo Console do Google Cloud
// (Cloud Functions → função → Editar → Variáveis de ambiente).
function getEmailApiKey() {
    return process.env.EMAIL_API_KEY;
}
// Envia via API REST da Resend (https://resend.com/docs/api-reference/emails/send-email).
// Provedor único, deliberadamente simples: se o projeto adotar outro serviço
// no futuro, esta é a única função a trocar.
async function sendEmail({ to, subject, html }) {
    const apiKey = getEmailApiKey();
    if (!apiKey) {
        console.log('[email] EMAIL_API_KEY não configurado — envio ignorado.', { to, subject });
        return false;
    }
    const db = admin.firestore();
    const providerSnap = await db.collection('platformConfig').doc('emailProvider').get();
    const provider = providerSnap.data();
    const fromEmail = provider === null || provider === void 0 ? void 0 : provider.fromEmail;
    if (!fromEmail) {
        console.log('[email] Remetente (fromEmail) não configurado em Administração da Plataforma — envio ignorado.');
        return false;
    }
    const fromName = (provider === null || provider === void 0 ? void 0 : provider.fromName) || 'SIGO';
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
    }
    catch (error) {
        console.error('[email] Erro ao enviar', error);
        return false;
    }
}
// Resolve o melhor e-mail de destino para um usuário: notification_email
// (campo dedicado, definido em Meu Perfil) e, na ausência, o e-mail da
// própria conta Firebase Auth.
async function resolveUserEmail(userId) {
    var _a;
    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(userId).get();
    const notificationEmail = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.notification_email;
    if (notificationEmail)
        return notificationEmail;
    try {
        const userRecord = await admin.auth().getUser(userId);
        return userRecord.email || null;
    }
    catch (_b) {
        return null;
    }
}
//# sourceMappingURL=email.js.map