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
exports.setFeatureFlag = exports.getFeatureFlags = void 0;
const admin = __importStar(require("firebase-admin"));
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