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
exports.getSetupStatus = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * getSetupStatus - Checklist de configuração de infraestrutura que vive fora
 * do Firestore (variáveis de ambiente da Cloud Function, GitHub Actions
 * secrets, APIs do GCP) e por isso não aparece em nenhum outro painel.
 * Só leitura, sem custo relevante. Apenas super-admin.
 */
exports.getSetupStatus = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const providerSnap = await db.collection('platformConfig').doc('emailProvider').get();
    const fromEmail = ((_a = providerSnap.data()) === null || _a === void 0 ? void 0 : _a.fromEmail) || '';
    return {
        emailApiKeyConfigured: !!process.env.EMAIL_API_KEY,
        emailFromConfigured: !!fromEmail,
        platformAdminBootstrapConfigured: !!process.env.PLATFORM_ADMIN_EMAILS,
        billingExportConfigured: !!(process.env.BILLING_BQ_PROJECT &&
            process.env.BILLING_BQ_DATASET &&
            process.env.BILLING_BQ_TABLE),
    };
});
//# sourceMappingURL=setupStatus.js.map