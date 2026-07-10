import * as admin from 'firebase-admin';
import * as dns from 'dns/promises';
import { isIP } from 'net';

// Webhooks de integração externa (flag `outbound_webhooks`). Best-effort:
// nunca deve derrubar a operação principal (criação/atualização de
// processo/expediente) que o disparou — qualquer falha é apenas logada.
// Timeout curto para não prender a resposta da Cloud Function esperando um
// destino lento/indisponível.

// Bloqueia SSRF: sem isto, um admin de órgão (ou uma conta comprometida)
// poderia apontar o webhook para o servidor de metadados do GCP
// (169.254.169.254) ou para um endereço interno, fazendo a própria Cloud
// Function vazar credenciais do service account ou sondar a rede interna.
function isPrivateOrLinkLocalIp(ip: string): boolean {
    const version = isIP(ip);
    if (version === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true; // link-local + GCP/AWS metadata
        if (a === 0) return true;
        return false;
    }
    if (version === 6) {
        const lower = ip.toLowerCase();
        if (lower === '::1') return true;
        if (lower.startsWith('fe80:')) return true; // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
        return false;
    }
    return true; // não resolveu para um IP válido — trata como suspeito
}

export async function isSafeWebhookUrl(rawUrl: string): Promise<boolean> {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === 'metadata.google.internal') return false;
    if (isIP(hostname)) return !isPrivateOrLinkLocalIp(hostname);

    try {
        const addresses = await dns.lookup(hostname, { all: true });
        return addresses.every((addr) => !isPrivateOrLinkLocalIp(addr.address));
    } catch {
        return false; // não conseguiu resolver — não dispara
    }
}

export async function fireOrgWebhook(
    organizationId: string,
    eventType: string,
    payload: Record<string, unknown>
): Promise<void> {
    try {
        const db = admin.firestore();
        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        const webhookConfig = orgSnap.data()?.webhookConfig;
        if (!webhookConfig?.enabled || !webhookConfig?.url) return;
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
            body: JSON.stringify({
                event: eventType,
                organization_id: organizationId,
                timestamp: new Date().toISOString(),
                ...payload,
            }),
            signal: AbortSignal.timeout(5000),
        });
    } catch (error) {
        console.error('[webhook] falha ao disparar', organizationId, eventType, error);
    }
}
