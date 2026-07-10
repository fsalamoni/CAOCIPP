"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetupStatus = void 0;
const admin = require("firebase-admin");
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