"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFeatureFlag = exports.getFeatureFlags = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const PLATFORM_CONFIG = 'platformConfig';
const FEATURE_FLAGS_DOC = 'featureFlags';
/**
 * getFeatureFlags - Lê o documento global de feature flags.
 * Apenas super-admin (o front também lê via onSnapshot quando autorizado).
 */
exports.getFeatureFlags = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const snap = await db.collection(PLATFORM_CONFIG).doc(FEATURE_FLAGS_DOC).get();
    if (!snap.exists) {
        return { flags: {}, updatedAt: null, updatedBy: null };
    }
    const data = snap.data() || {};
    const updatedAt = ((_a = data.updated_at) === null || _a === void 0 ? void 0 : _a.toDate)
        ? data.updated_at.toDate().toISOString()
        : null;
    return {
        flags: data.flags || {},
        updatedAt,
        updatedBy: data.updated_by || null,
    };
});
/**
 * setFeatureFlag - Liga/desliga UMA flag global.
 * Escrita exclusiva de super-admin, com auditoria.
 * Operação aditiva: usa merge, nunca apaga outras flags.
 */
exports.setFeatureFlag = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const { flagKey, enabled } = request.data || {};
    if (!flagKey || typeof flagKey !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'flagKey é obrigatório.');
    }
    if (typeof enabled !== 'boolean') {
        throw new https_1.HttpsError('invalid-argument', 'enabled deve ser booleano.');
    }
    const db = admin.firestore();
    const ref = db.collection(PLATFORM_CONFIG).doc(FEATURE_FLAGS_DOC);
    await ref.set({
        flags: { [flagKey]: enabled },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: actor.name,
        updated_by_uid: actor.uid,
    }, { merge: true });
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'SET_FEATURE_FLAG', {
        flagKey,
        enabled,
    });
    return { success: true, flagKey, enabled };
});
//# sourceMappingURL=featureFlags.js.map