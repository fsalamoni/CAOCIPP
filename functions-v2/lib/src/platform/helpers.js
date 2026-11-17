"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGION = void 0;
exports.assertPlatformAdmin = assertPlatformAdmin;
exports.writePlatformAudit = writePlatformAudit;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
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
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    const uid = request.auth.uid;
    const token = request.auth.token || {};
    const email = String(token.email || '').toLowerCase();
    const name = String(token.name || 'Desconhecido');
    // A allowlist manda: acesso retirado (active === false) vale na hora, mesmo
    // com o claim ainda no token já emitido ou com o e-mail no bootstrap. Assim
    // não é preciso revogar tokens (o Auth é compartilhado com outros apps).
    const db = admin.firestore();
    const adminDoc = await db.collection('platformAdmins').doc(uid).get();
    if (adminDoc.exists && ((_a = adminDoc.data()) === null || _a === void 0 ? void 0 : _a.active) === false) {
        throw new https_1.HttpsError('permission-denied', 'Acesso restrito ao super-administrador da plataforma.');
    }
    // 1. Custom claim
    if (token.platformAdmin === true) {
        return { uid, email, name };
    }
    // 2. Allowlist em Firestore
    if (adminDoc.exists && ((_b = adminDoc.data()) === null || _b === void 0 ? void 0 : _b.active) === true) {
        return { uid, email, name };
    }
    // 3. Bootstrap por e-mail
    // Só e-mail confirmado pelo provedor: o Portal das partes aceita criar conta
    // de e-mail e senha, e um endereço não confirmado pode ser de outra pessoa.
    if (email && token.email_verified === true && getBootstrapEmails().includes(email)) {
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
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=helpers.js.map