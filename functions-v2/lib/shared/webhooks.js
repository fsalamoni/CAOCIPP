"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fireOrgWebhook = fireOrgWebhook;
const admin = require("firebase-admin");
// Webhooks de integração externa (flag `outbound_webhooks`). Best-effort:
// nunca deve derrubar a operação principal (criação/atualização de
// processo/expediente) que o disparou — qualquer falha é apenas logada.
// Timeout curto para não prender a resposta da Cloud Function esperando um
// destino lento/indisponível.
async function fireOrgWebhook(organizationId, eventType, payload) {
    var _a;
    try {
        const db = admin.firestore();
        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        const webhookConfig = (_a = orgSnap.data()) === null || _a === void 0 ? void 0 : _a.webhookConfig;
        if (!(webhookConfig === null || webhookConfig === void 0 ? void 0 : webhookConfig.enabled) || !(webhookConfig === null || webhookConfig === void 0 ? void 0 : webhookConfig.url))
            return;
        // `events` vazio é uma escolha explícita do admin (nenhum evento
        // selecionado) — deve silenciar tudo, não disparar para tudo.
        if (Array.isArray(webhookConfig.events) && !webhookConfig.events.includes(eventType)) {
            return;
        }
        await fetch(webhookConfig.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ event: eventType, organization_id: organizationId, timestamp: new Date().toISOString() }, payload)),
            signal: AbortSignal.timeout(5000),
        });
    }
    catch (error) {
        console.error('[webhook] falha ao disparar', organizationId, eventType, error);
    }
}
//# sourceMappingURL=webhooks.js.map