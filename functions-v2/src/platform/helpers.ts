import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';

/**
 * Região padrão das funções (São Paulo).
 */
export const REGION = 'southamerica-east1';

/**
 * E-mails de bootstrap do super-admin.
 * Permite conceder o primeiro acesso ANTES de existir qualquer registro na
 * allowlist (que é gravável apenas por Cloud Functions).
 *
 * Defina via variável de ambiente PLATFORM_ADMIN_EMAILS (lista separada por
 * vírgula). Mantido vazio por padrão (nenhum acesso implícito).
 */
function getBootstrapEmails(): string[] {
    const raw = process.env.PLATFORM_ADMIN_EMAILS || '';
    return raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * Verifica se o solicitante é super-admin da plataforma.
 *
 * Aceita QUALQUER um dos mecanismos (decisão do projeto: claim + allowlist):
 *   1. Custom claim platformAdmin === true no token.
 *   2. Documento platformAdmins/{uid} com active === true.
 *   3. E-mail presente em PLATFORM_ADMIN_EMAILS (bootstrap).
 *
 * Lança HttpsError quando não autorizado.
 */
export async function assertPlatformAdmin(
    request: CallableRequest<unknown>
): Promise<{ uid: string; email: string; name: string }> {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = request.auth.uid;
    const token = request.auth.token || {};
    const email = String(token.email || '').toLowerCase();
    const name = String(token.name || 'Desconhecido');

    // 1. Custom claim
    if (token.platformAdmin === true) {
        return { uid, email, name };
    }

    // 2. Allowlist em Firestore
    const db = admin.firestore();
    const adminDoc = await db.collection('platformAdmins').doc(uid).get();
    if (adminDoc.exists && adminDoc.data()?.active === true) {
        return { uid, email, name };
    }

    // 3. Bootstrap por e-mail
    if (email && getBootstrapEmails().includes(email)) {
        return { uid, email, name };
    }

    throw new HttpsError(
        'permission-denied',
        'Acesso restrito ao super-administrador da plataforma.'
    );
}

/**
 * Registra uma ação administrativa de plataforma no auditLogs global.
 */
export async function writePlatformAudit(
    actorUid: string,
    actorName: string,
    action: string,
    details: Record<string, unknown>
): Promise<void> {
    const db = admin.firestore();
    await db.collection('auditLogs').add({
        scope: 'platform',
        organization_id: null,
        user_id: actorUid,
        user_name: actorName,
        action,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
