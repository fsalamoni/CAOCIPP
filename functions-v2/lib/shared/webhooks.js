"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafeWebhookUrl = isSafeWebhookUrl;
exports.fireOrgWebhook = fireOrgWebhook;
const admin = require("firebase-admin");
const dns = require("dns/promises");
const net_1 = require("net");
// Webhooks de integração externa (flag `outbound_webhooks`). Best-effort:
// nunca deve derrubar a operação principal (criação/atualização de
// processo/expediente) que o disparou — qualquer falha é apenas logada.
// Timeout curto para não prender a resposta da Cloud Function esperando um
// destino lento/indisponível.
// Bloqueia SSRF: sem isto, um admin de órgão (ou uma conta comprometida)
// poderia apontar o webhook para o servidor de metadados do GCP
// (169.254.169.254) ou para um endereço interno, fazendo a própria Cloud
// Function vazar credenciais do service account ou sondar a rede interna.
function isPrivateOrLinkLocalIp(ip) {
    const version = (0, net_1.isIP)(ip);
    if (version === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        if (a === 10)
            return true;
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 127)
            return true;
        if (a === 169 && b === 254)
            return true; // link-local + GCP/AWS metadata
        if (a === 0)
            return true;
        return false;
    }
    if (version === 6) {
        const lower = ip.toLowerCase();
        if (lower === '::1')
            return true;
        if (lower.startsWith('fe80:'))
            return true; // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd'))
            return true; // unique local
        return false;
    }
    return true; // não resolveu para um IP válido — trata como suspeito
}
async function isSafeWebhookUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch (_a) {
        return false;
    }
    if (parsed.protocol !== 'https:')
        return false;
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === 'metadata.google.internal')
        return false;
    if ((0, net_1.isIP)(hostname))
        return !isPrivateOrLinkLocalIp(hostname);
    try {
        const addresses = await dns.lookup(hostname, { all: true });
        return addresses.every((addr) => !isPrivateOrLinkLocalIp(addr.address));
    }
    catch (_b) {
        return false; // não conseguiu resolver — não dispara
    }
}
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
        if (!(await isSafeWebhookUrl(webhookConfig.url))) {
            console.error('[webhook] URL bloqueada (aponta para endereço privado/interno)', organizationId, webhookConfig.url);
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