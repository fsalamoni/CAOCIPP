"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLoginOtp = exports.sendLoginOtp = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const https_1 = require("firebase-functions/v2/https");
const email_1 = require("../shared/email");
// Autenticação em duas etapas por e-mail (flag `two_factor_auth`).
// ----------------------------------------------------------------------------
// IMPORTANTE: isto NÃO é MFA nativo do Firebase/Identity Platform (que exige
// upgrade de projeto fora do alcance desta implementação) — é uma camada
// própria e mais simples: um código de 6 dígitos por e-mail, válido por 5
// minutos, guardado (com hash, nunca em texto puro) em `otpCodes/{uid}`,
// coleção sem NENHUM acesso de leitura/escrita pelo cliente.
//
// Falha aberta por segurança operacional: se o e-mail não puder ser enviado
// (provedor não configurado), `sendLoginOtp` devolve `sent: false` e o
// front-end (TwoFactorGate) libera o acesso mesmo assim — o objetivo é nunca
// trancar um usuário para fora da própria conta por um problema de terceiros
// (provedor de e-mail) que foge do controle dele.
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;
function hashCode(uid, code) {
    return crypto.createHash('sha256').update(`${uid}:${code}`).digest('hex');
}
exports.sendLoginOtp = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const userId = request.auth.uid;
    const db = admin.firestore();
    // Cooldown entre envios: sem isto, qualquer usuário autenticado podia
    // apontar notification_email para o e-mail de um terceiro (não exige
    // confirmação de posse) e chamar esta função em loop, bombardeando a
    // vítima com e-mails reais indefinidamente.
    const otpRef = db.collection('otpCodes').doc(userId);
    const existing = await otpRef.get();
    const lastSentAt = (_c = (_b = (_a = existing.data()) === null || _a === void 0 ? void 0 : _a.created_at) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b);
    if (lastSentAt && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
        throw new https_1.HttpsError('resource-exhausted', 'Aguarde alguns segundos antes de solicitar um novo código.');
    }
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashCode(userId, code);
    await otpRef.set({
        codeHash,
        expires_at: admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
        attempts: 0,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    const email = await (0, email_1.resolveUserEmail)(userId);
    if (!email) {
        return { sent: false, reason: 'no_email' };
    }
    const sent = await (0, email_1.sendEmail)({
        to: email,
        subject: 'Seu código de verificação — Consultas CAO',
        html: `
                <p>Use o código abaixo para concluir seu login:</p>
                <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
                <p>Válido por 5 minutos. Se você não solicitou este código, ignore este e-mail.</p>
            `,
    });
    return { sent, reason: sent ? null : 'provider_unavailable' };
});
exports.verifyLoginOtp = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const userId = request.auth.uid;
    const code = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.code) || '').trim();
    if (!code) {
        throw new https_1.HttpsError('invalid-argument', 'Código é obrigatório.');
    }
    const db = admin.firestore();
    const ref = db.collection('otpCodes').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Nenhum código pendente. Solicite um novo.');
    }
    const data = snap.data();
    if (!data || data.expires_at.toMillis() < Date.now()) {
        await ref.delete();
        throw new https_1.HttpsError('failed-precondition', 'Código expirado. Solicite um novo.');
    }
    if ((data.attempts || 0) >= MAX_ATTEMPTS) {
        await ref.delete();
        throw new https_1.HttpsError('resource-exhausted', 'Muitas tentativas. Solicite um novo código.');
    }
    if (hashCode(userId, code) !== data.codeHash) {
        await ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
        throw new https_1.HttpsError('invalid-argument', 'Código incorreto.');
    }
    await ref.delete();
    return { success: true };
});
//# sourceMappingURL=twoFactor.js.map