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
exports.testOrgWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const webhooks_1 = require("../shared/webhooks");
const vinculo_1 = require("../shared/vinculo");
function isOrgAdmin(membership) {
    if (!membership)
        return false;
    if (membership.role === 'creator' || membership.role === 'admin')
        return true;
    return Object.values(membership.permissions || {}).some((v) => v === true);
}
// Dispara um evento de teste para a URL configurada (flag `outbound_webhooks`),
// para o Criador/administrador confirmar a integração sem esperar um evento real.
exports.testOrgWebhook = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId } = request.data || {};
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    }
    const db = admin.firestore();
    const membershipSnap = await db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`).get();
    if (!membershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(membershipSnap.data()) || !isOrgAdmin(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'Apenas o Criador ou administradores delegados podem testar o webhook.');
    }
    const orgSnap = await db.collection('organizations').doc(organizationId).get();
    const url = (_b = (_a = orgSnap.data()) === null || _a === void 0 ? void 0 : _a.webhookConfig) === null || _b === void 0 ? void 0 : _b.url;
    if (!url) {
        throw new https_1.HttpsError('failed-precondition', 'Configure e salve uma URL de webhook antes de testar.');
    }
    if (!(await (0, webhooks_1.isSafeWebhookUrl)(url))) {
        throw new https_1.HttpsError('invalid-argument', 'URL bloqueada: aponta para um endereço privado/interno.');
    }
    // Disparo direto (não passa por fireOrgWebhook): o teste deve funcionar
    // mesmo com o webhook ainda desligado, para validar a URL antes de ativar.
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'test',
                organization_id: organizationId,
                timestamp: new Date().toISOString(),
                message: 'Disparo de teste do SIGO — se você recebeu isto, a integração está funcionando.',
            }),
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            throw new https_1.HttpsError('unknown', `O destino respondeu com status ${response.status}.`);
        }
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('unknown', 'Falha ao conectar com a URL configurada.');
    }
    return { success: true };
});
//# sourceMappingURL=webhookTest.js.map