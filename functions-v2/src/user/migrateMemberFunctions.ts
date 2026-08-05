import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

// Funções genéricas que vieram dos seeds do sistema. Quando o member.function
// é uma dessas, sobrescrevemos com o userProfile.function atual do usuário.
const GENERIC_FUNCTIONS = new Set(['Membro', 'Criador', 'Admin', 'Owner', 'Membro fundador']);

/**
 * migrateMemberFunctions — migração one-time que sincroniza `member.function`
 * com `users/{userId}.function` (a fonte da verdade do /Profile).
 *
 * Por que existe:
 * - Antes desta migração, member.function era gravado como "Criador" no
 *   create.ts e "Membro" no join.ts. Com o passar do tempo, o usuário pode
 *   ter preenchido a função real no /Profile (ex.: "Procurador", "Assessor
 *   Chefe") mas o member.function continuou genérico — aparecendo em todas
 *   as UIs (Kanban, tabela, painel admin) como "Criador" ou "Membro".
 * - updateProfile.ts já propaga a função em tempo real, mas para os dados
 *   LEGADOS (memberships já gravados) é preciso rodar uma varredura.
 *
 * Comportamento:
 * - Itera todos os userOrganizations (em batches de 400 para respeitar o
 *   limite de writes do Firestore).
 * - Para cada membership, lê o userProfile correspondente. Se member.function
 *   for genérico (vazio/"Membro"/"Criador"/"Admin"/"Owner"/"Membro fundador")
 *   E o userProfile.function estiver preenchido, sobrescreve member.function
 *   com o do profile.
 * - NÃO sobrescreve funções que o admin do órgão personalizou
 *   manualmente (heurística: não está no conjunto genérico).
 *
 * Segurança: apenas super-admin (platform_admin custom claim) pode chamar.
 *
 * @param {object} data - { dryRun?: boolean }
 * @returns { scanned: number, updated: number, dryRun: boolean }
 */
export const migrateMemberFunctions = onCall<{ dryRun?: boolean }>(
    { region: 'southamerica-east1', cors: true },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }
        // Defesa em profundidade: só platform admin roda migrações estruturais.
        if (request.auth.token?.platform_admin !== true) {
            throw new HttpsError('permission-denied', 'Apenas platform admin pode rodar migrações.');
        }

        const db = admin.firestore();
        const dryRun = request.data?.dryRun === true;

        let scanned = 0;
        let updated = 0;
        let cursor: admin.firestore.QueryDocumentSnapshot | null = null;
        const PAGE_SIZE = 200;

        // Loop em páginas para não carregar tudo na memória.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            let q: admin.firestore.Query = db.collection('userOrganizations')
                .orderBy(admin.firestore.FieldPath.documentId())
                .limit(PAGE_SIZE);
            if (cursor) q = q.startAfter(cursor);

            const snap = await q.get();
            if (snap.empty) break;

            const batch = db.batch();
            let batchCount = 0;

            for (const doc of snap.docs) {
                scanned += 1;
                const data = doc.data();
                const userId = String(data.user_id || '');
                if (!userId) continue;
                const currentFunction = String(data.function || '');

                // Só sincroniza se for genérico (ou vazio). Não toca em
                // funções personalizadas pelo admin do órgão.
                if (currentFunction && !GENERIC_FUNCTIONS.has(currentFunction)) continue;

                const userSnap = await db.collection('users').doc(userId).get();
                if (!userSnap.exists) continue;
                const profileFunction = String(userSnap.get('function') || '').trim();
                if (!profileFunction) continue;

                // Já está igual? Pula.
                if (profileFunction === currentFunction) continue;

                if (!dryRun) {
                    batch.update(doc.ref, { function: profileFunction });
                    batchCount += 1;
                    updated += 1;
                } else {
                    updated += 1; // para fins de relatório do dryRun
                }

                if (batchCount >= 400) {
                    // commit e segue
                    if (!dryRun) await batch.commit();
                    batchCount = 0;
                }
            }
            if (batchCount > 0 && !dryRun) await batch.commit();

            cursor = snap.docs[snap.docs.length - 1];
            if (snap.size < PAGE_SIZE) break;
        }

        return { scanned, updated, dryRun };
    }
);
