import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

interface UserRow {
    uid: string;
    email: string | null;
    displayName: string | null;
    fullName: string | null;
    function: string | null;
    disabled: boolean;
    lastLogin: string | null;
    createdAt: string | null;
    orgCount: number;
    roles: string[];
}

interface UsersResponse {
    generatedAt: string;
    returned: number;
    hasMore: boolean;
    users: UserRow[];
}

function tsToIso(value: unknown): string | null {
    if (value && typeof (value as admin.firestore.Timestamp).toDate === 'function') {
        return (value as admin.firestore.Timestamp).toDate().toISOString();
    }
    return null;
}

/**
 * listPlatformUsers - Registro de TODOS os usuários da plataforma (Onda 2).
 *
 * Fonte primária: Firebase Auth (e-mail, último login, criação) via listUsers
 * (até 1000 por página). Complementa com a coleção `users` (nome/função) e
 * agrega os vínculos (`userOrganizations`) em memória para contar órgãos/papéis.
 * Apenas super-admin.
 */
export const listPlatformUsers = onCall<{ pageToken?: string }>(
    { region: REGION },
    async (request): Promise<UsersResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        // 1. Usuários do Firebase Auth (uma página de até 1000).
        const pageToken = request.data?.pageToken || undefined;
        const authResult = await admin.auth().listUsers(1000, pageToken);

        // 2. Mapa de vínculos por usuário (contagem + papéis).
        //    Lê userOrganizations com cap de segurança para não varrer sem limite.
        const membershipByUser = new Map<string, { count: number; roles: Set<string> }>();
        const membershipSnap = await db
            .collection('userOrganizations')
            .limit(10000)
            .get();
        membershipSnap.forEach((m) => {
            const d = m.data() || {};
            const uid = String(d.user_id || '');
            if (!uid) return;
            const entry =
                membershipByUser.get(uid) || { count: 0, roles: new Set<string>() };
            entry.count += 1;
            if (d.role) entry.roles.add(String(d.role));
            membershipByUser.set(uid, entry);
        });

        // 3. Documentos da coleção users (nome/função) — busca em lote por uid.
        const uids = authResult.users.map((u) => u.uid);
        const userDocs = new Map<string, admin.firestore.DocumentData>();
        for (let i = 0; i < uids.length; i += 30) {
            const chunk = uids.slice(i, i + 30);
            if (chunk.length === 0) continue;
            const snap = await db
                .collection('users')
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            snap.forEach((doc) => userDocs.set(doc.id, doc.data() || {}));
        }

        const users: UserRow[] = authResult.users.map((u) => {
            const profile = userDocs.get(u.uid) || {};
            const membership = membershipByUser.get(u.uid);
            return {
                uid: u.uid,
                email: u.email || null,
                displayName: u.displayName || null,
                fullName:
                    (profile.full_name as string) ||
                    (profile.platform_name as string) ||
                    null,
                function: (profile.function as string) || null,
                disabled: !!u.disabled,
                lastLogin: u.metadata.lastSignInTime
                    ? new Date(u.metadata.lastSignInTime).toISOString()
                    : tsToIso(profile.updated_at),
                createdAt: u.metadata.creationTime
                    ? new Date(u.metadata.creationTime).toISOString()
                    : null,
                orgCount: membership ? membership.count : 0,
                roles: membership ? Array.from(membership.roles) : [],
            };
        });

        // Ordena por último login desc (mais ativos primeiro).
        users.sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''));

        return {
            generatedAt: new Date().toISOString(),
            returned: users.length,
            hasMore: !!authResult.pageToken,
            users,
        };
    }
);
