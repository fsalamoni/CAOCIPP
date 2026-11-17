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
exports.listPlatformAdmins = exports.revokePlatformAdmin = exports.grantPlatformAdmin = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const COLLECTION = 'platformAdmins';
/**
 * Aplica/remove o custom claim platformAdmin para um usuário.
 */
async function setAdminClaim(uid, enabled) {
    const user = await admin.auth().getUser(uid);
    const existing = user.customClaims || {};
    await admin.auth().setCustomUserClaims(uid, Object.assign(Object.assign({}, existing), { platformAdmin: enabled }));
}
/**
 * grantPlatformAdmin - Concede acesso de super-admin a um e-mail.
 * Adiciona à allowlist (platformAdmins/{uid}) e aplica o custom claim.
 * Só pode ser chamado por um super-admin já existente (ou bootstrap por env).
 */
exports.grantPlatformAdmin = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const email = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.email) || '').trim().toLowerCase();
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', 'E-mail é obrigatório.');
    }
    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail(email);
    }
    catch (_b) {
        throw new https_1.HttpsError('not-found', 'Não há usuário cadastrado com este e-mail. Peça para a pessoa fazer login uma vez primeiro.');
    }
    const db = admin.firestore();
    await db.collection(COLLECTION).doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        active: true,
        granted_by: actor.name,
        granted_by_uid: actor.uid,
        granted_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await setAdminClaim(userRecord.uid, true);
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'GRANT_PLATFORM_ADMIN', {
        target_uid: userRecord.uid,
        target_email: email,
    });
    return { success: true, uid: userRecord.uid, email };
});
/**
 * revokePlatformAdmin - Revoga o acesso de super-admin de um usuário.
 * Desativa na allowlist e remove o custom claim.
 */
exports.revokePlatformAdmin = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const uid = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.uid) || '').trim();
    if (!uid) {
        throw new https_1.HttpsError('invalid-argument', 'uid é obrigatório.');
    }
    if (uid === actor.uid) {
        throw new https_1.HttpsError('failed-precondition', 'Você não pode revogar o seu próprio acesso de super-admin.');
    }
    const db = admin.firestore();
    await db.collection(COLLECTION).doc(uid).set({
        active: false,
        revoked_by: actor.name,
        revoked_by_uid: actor.uid,
        revoked_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await setAdminClaim(uid, false);
    // O token já emitido ainda traz platformAdmin:true até expirar (1 h),
    // mas assertPlatformAdmin e as regras conferem platformAdmins/{uid}
    // (active === false recusa na hora). Não revogamos tokens: o Auth é
    // compartilhado com outros apps e isso desconectaria a pessoa de todos.
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'REVOKE_PLATFORM_ADMIN', {
        target_uid: uid,
    });
    return { success: true, uid };
});
/**
 * listPlatformAdmins - Lista todos os super-admins (ativos e revogados).
 */
exports.listPlatformAdmins = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const snap = await db.collection(COLLECTION).get();
    const admins = snap.docs.map((d) => {
        var _a;
        const data = d.data();
        return {
            uid: d.id,
            email: data.email || null,
            active: data.active === true,
            granted_by: data.granted_by || null,
            granted_at: ((_a = data.granted_at) === null || _a === void 0 ? void 0 : _a.toDate)
                ? data.granted_at.toDate().toISOString()
                : null,
        };
    });
    return { admins };
});
//# sourceMappingURL=adminClaims.js.map