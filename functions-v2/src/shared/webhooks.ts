import * as admin from 'firebase-admin';

// Webhooks de integração externa (flag `outbound_webhooks`). Best-effort:
// nunca deve derrubar a operação principal (criação/atualização de
// processo/expediente) que o disparou — qualquer falha é apenas logada.
// Timeout curto para não prender a resposta da Cloud Function esperando um
// destino lento/indisponível.
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
