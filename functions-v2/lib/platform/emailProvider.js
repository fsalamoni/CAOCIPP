"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEmailProviderConfig = exports.getEmailProviderConfig = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const PLATFORM_CONFIG = 'platformConfig';
const EMAIL_PROVIDER_DOC = 'emailProvider';
exports.getEmailProviderConfig = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const snap = await db.collection(PLATFORM_CONFIG).doc(EMAIL_PROVIDER_DOC).get();
    const data = snap.exists ? snap.data() : {};
    return {
        fromEmail: (data === null || data === void 0 ? void 0 : data.fromEmail) || '',
        fromName: (data === null || data === void 0 ? void 0 : data.fromName) || '',
    };
});
exports.setEmailProviderConfig = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a, _b;
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const fromEmail = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.fromEmail) || '').trim().slice(0, 200);
    const fromName = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.fromName) || '').trim().slice(0, 120);
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
        throw new https_1.HttpsError('invalid-argument', 'fromEmail inválido.');
    }
    const db = admin.firestore();
    await db.collection(PLATFORM_CONFIG).doc(EMAIL_PROVIDER_DOC).set({
        fromEmail,
        fromName,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: actor.name,
        updated_by_uid: actor.uid,
    }, { merge: true });
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'SET_EMAIL_PROVIDER_CONFIG', { fromEmail, fromName });
    return { success: true };
});
//# sourceMappingURL=emailProvider.js.map