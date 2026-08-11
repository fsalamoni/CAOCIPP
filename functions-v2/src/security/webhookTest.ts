import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { isSafeWebhookUrl } from '../shared/webhooks';

type MembershipLike = { role?: string; permissions?: Record<string, unknown> };

function isOrgAdmin(membership: MembershipLike | undefined): boolean {
    if (!membership) return false;
    if (membership.role === 'creator' || membership.role === 'admin') return true;
    return Object.values(membership.permissions || {}).some((v) => v === true);
}

// Dispara um evento de teste para a URL configurada (flag `outbound_webhooks`),
// para o Criador/administrador confirmar a integração sem esperar um evento real.
export const testOrgWebhook = onCall<{ organizationId: string }>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }
        const { organizationId } = request.data || {};
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório.');
        }

        const db = admin.firestore();
        const membershipSnap = await db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`).get();
        if (!membershipSnap.exists || !isOrgAdmin(membershipSnap.data() as MembershipLike)) {
            throw new HttpsError('permission-denied', 'Apenas o Criador ou administradores delegados podem testar o webhook.');
        }

        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        const url = orgSnap.data()?.webhookConfig?.url;
        if (!url) {
            throw new HttpsError('failed-precondition', 'Configure e salve uma URL de webhook antes de testar.');
        }
        if (!(await isSafeWebhookUrl(url))) {
            throw new HttpsError('invalid-argument', 'URL bloqueada: aponta para um endereço privado/interno.');
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
                throw new HttpsError('unknown', `O destino respondeu com status ${response.status}.`);
            }
        } catch (error) {
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('unknown', 'Falha ao conectar com a URL configurada.');
        }

        return { success: true };
    }
);
