import * as admin from 'firebase-admin';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';

interface DeleteOrganizationRequest {
    organizationId: string;
    // Confirmação obrigatória: precisa bater exatamente com o nome do órgão.
    confirmName?: string;
}

/**
 * Coleções de nível superior cujos documentos pertencem a UM órgão via o campo
 * `organization_id`. Cada documento pode ter subcoleções (ex.: `history`), por
 * isso usamos exclusão recursiva.
 */
const ORG_SCOPED_COLLECTIONS = [
    'processes',
    'expedientes',
    'customRecords',
    'entityTypes',
    'userOrganizations',
];

/**
 * Verifica se o solicitante é super-admin da plataforma (claim, allowlist ou
 * bootstrap por e-mail). Não lança — apenas retorna boolean.
 */
async function isPlatformAdmin(
    request: CallableRequest<unknown>
): Promise<boolean> {
    if (!request.auth) return false;
    const token = request.auth.token || {};
    if (token.platformAdmin === true) return true;

    const db = admin.firestore();
    try {
        const adminDoc = await db.collection('platformAdmins').doc(request.auth.uid).get();
        if (adminDoc.exists && adminDoc.data()?.active === true) return true;
    } catch {
        // ignora — cai no bootstrap por e-mail
    }

    const email = String(token.email || '').toLowerCase();
    const bootstrap = (process.env.PLATFORM_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return !!email && bootstrap.includes(email);
}

/**
 * Exclui, em lotes, todos os documentos de uma coleção que pertençam ao órgão,
 * incluindo eventuais subcoleções (exclusão recursiva). Retorna o total apagado.
 */
async function deleteCollectionForOrg(
    db: admin.firestore.Firestore,
    bulkWriter: admin.firestore.BulkWriter,
    collectionName: string,
    organizationId: string
): Promise<number> {
    let deleted = 0;
    // Lê em páginas para nunca carregar a coleção inteira na memória.
    // Cada página é resolvida com recursiveDelete antes de buscar a próxima.
    // Como os documentos são removidos, a mesma query sempre devolve o "topo".
    while (true) {
        const snapshot = await db
            .collection(collectionName)
            .where('organization_id', '==', organizationId)
            .limit(300)
            .get();

        if (snapshot.empty) break;

        await Promise.all(
            snapshot.docs.map((doc) => db.recursiveDelete(doc.ref, bulkWriter))
        );
        deleted += snapshot.size;

        if (snapshot.size < 300) break;
    }
    return deleted;
}

/**
 * deleteOrganization — Exclui PERMANENTEMENTE um órgão e TODO o seu banco de
 * dados (processos, expedientes, registros personalizados, tipos de entidade,
 * vínculos de membros e o próprio documento do órgão), incluindo as subcoleções
 * de histórico de cada registro.
 *
 * Autorização: o CRIADOR do órgão OU um super-admin da plataforma.
 * Exige confirmação pelo nome exato do órgão para evitar exclusões acidentais.
 * Operação irreversível e auditada.
 */
export const deleteOrganization = onCall<DeleteOrganizationRequest>(
    { region: 'southamerica-east1', cors: true, timeoutSeconds: 540, memory: '512MiB' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, confirmName } = request.data || ({} as DeleteOrganizationRequest);
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'Organization ID is required');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Carrega o órgão.
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgSnap = await orgRef.get();
        if (!orgSnap.exists) {
            throw new HttpsError('not-found', 'Organização não encontrada.');
        }
        const orgName = String(orgSnap.data()?.name || '');

        // 2. Autorização: criador do órgão OU super-admin da plataforma.
        const platformAdmin = await isPlatformAdmin(request);
        let isCreator = false;
        if (!platformAdmin) {
            const membershipSnap = await db
                .collection('userOrganizations')
                .doc(`${userId}_${organizationId}`)
                .get();
            const role = membershipSnap.exists ? membershipSnap.data()?.role : null;
            isCreator = role === 'creator';
            if (!isCreator) {
                throw new HttpsError(
                    'permission-denied',
                    'Apenas o Criador da organização ou um administrador da plataforma podem excluí-la.'
                );
            }
        }

        // 3. Confirmação pelo nome exato (guarda contra exclusão acidental).
        if (typeof confirmName !== 'string' || confirmName.trim() !== orgName.trim()) {
            throw new HttpsError(
                'failed-precondition',
                'A confirmação do nome da organização não coincide.'
            );
        }

        console.log(
            `[DeleteOrg] Iniciando exclusão de ${organizationId} (${orgName}) por ${userId} ` +
            `(${platformAdmin ? 'platform-admin' : 'creator'})`
        );

        // 4. Exclui todos os dados do órgão (com subcoleções) em lotes.
        const bulkWriter = db.bulkWriter();
        const deletedByCollection: Record<string, number> = {};
        for (const collectionName of ORG_SCOPED_COLLECTIONS) {
            deletedByCollection[collectionName] = await deleteCollectionForOrg(
                db,
                bulkWriter,
                collectionName,
                organizationId
            );
        }

        // 5. Exclui o documento do órgão (e qualquer subcoleção remanescente).
        await db.recursiveDelete(orgRef, bulkWriter);

        await bulkWriter.close();

        // 6. Registro de auditoria (mantido para rastreabilidade).
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_ORGANIZATION',
            details: {
                organization_name: orgName,
                deleted_by: platformAdmin ? 'platform_admin' : 'creator',
                deleted: deletedByCollection,
                timestamp: new Date().toISOString(),
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
            `[DeleteOrg] Concluída exclusão de ${organizationId}. Removidos:`,
            JSON.stringify(deletedByCollection)
        );

        const totalDeleted = Object.values(deletedByCollection).reduce((a, b) => a + b, 0);

        return {
            success: true,
            organizationId,
            deleted: deletedByCollection,
            message: `Organização "${orgName}" e seus dados (${totalDeleted} registros) foram excluídos permanentemente.`,
        };
    }
);
