"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGION = void 0;
exports.assertPlatformAdmin = assertPlatformAdmin;
exports.writePlatformAudit = writePlatformAudit;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
/**
 * Região padrão das funções (São Paulo).
 */
exports.REGION = 'southamerica-east1';
/**
 * E-mails de bootstrap do super-admin.
 * Permite conceder o primeiro acesso ANTES de existir qualquer registro na
 * allowlist (que é gravável apenas por Cloud Functions).
 *
 * Defina via variável de ambiente PLATFORM_ADMIN_EMAILS (lista separada por
 * vírgula). Mantido vazio por padrão (nenhum acesso implícito).
 */
function getBootstrapEmails() {
    const raw = process.env.PLATFORM_ADMIN_EMAILS || '';
    return raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}
/**
 * Verifica se o solicitante é super-admin da plataforma.
 *
 * Aceita QUALQUER um dos mecanismos (decisão do projeto: claim + allowlist):
 *   1. Custom claim platformAdmin === true no token.
 *   2. Documento platformAdmins/{uid} com active === true.
 *   3. E-mail presente em PLATFORM_ADMIN_EMAILS (bootstrap).
 *
 * Lança HttpsError quando não autorizado.
 */
async function assertPlatformAdmin(request) {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    const uid = request.auth.uid;
    const token = request.auth.token || {};
    const email = String(token.email || '').toLowerCase();
    const name = String(token.name || 'Desconhecido');
    // 1. Custom claim
    if (token.platformAdmin === true) {
        return { uid, email, name };
    }
    // 2. Allowlist em Firestore
    const db = admin.firestore();
    const adminDoc = await db.collection('platformAdmins').doc(uid).get();
    if (adminDoc.exists && ((_a = adminDoc.data()) === null || _a === void 0 ? void 0 : _a.active) === true) {
        return { uid, email, name };
    }
    // 3. Bootstrap por e-mail
    if (email && getBootstrapEmails().includes(email)) {
        return { uid, email, name };
    }
    throw new https_1.HttpsError('permission-denied', 'Acesso restrito ao super-administrador da plataforma.');
}
/**
 * Registra uma ação administrativa de plataforma no auditLogs global.
 */
async function writePlatformAudit(actorUid, actorName, action, details) {
    const db = admin.firestore();
    await db.collection('auditLogs').add({
        scope: 'platform',
        organization_id: null,
        user_id: actorUid,
        user_name: actorName,
        action,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=helpers.js.map