import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

/**
 * Conta documentos via agregação count() (barato).
 */
async function countWhere(
    query: admin.firestore.Query
): Promise<number> {
    try {
        const snap = await query.count().get();
        return snap.data().count;
    } catch {
        return 0;
    }
}

// Tamanho médio estimado (bytes) por documento.
const AVG_DOC_BYTES = {
    processes: 3_000,
    expedientes: 2_500,
    members: 600,
};

interface OrgRow {
    id: string;
    name: string;
    created_at: string | null;
    created_by: string | null;
    members_count: number;
    processes_count: number;
    expedientes_count: number;
    active_processes: number;
    storageEstimateBytes: number;
}

interface OrgsResponse {
    generatedAt: string;
    total: number;
    returned: number;
    hasMore: boolean;
    organizations: OrgRow[];
}

function tsToIso(value: unknown): string | null {
    if (value && typeof (value as admin.firestore.Timestamp).toDate === 'function') {
        return (value as admin.firestore.Timestamp).toDate().toISOString();
    }
    return null;
}

/**
 * getOrgsReport - Lista todos os órgãos com footprint (drilldown da Onda 2).
 *
 * Usa os contadores já mantidos em `stats` (baratos) e complementa com
 * agregação count() apenas para expedientes (que não têm contador em stats).
 * Apenas super-admin. Limitado para não varrer indefinidamente.
 */
export const getOrgsReport = onCall<{ limit?: number }>(
    { region: REGION },
    async (request): Promise<OrgsResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const cap = Math.min(Math.max(Number(request.data?.limit) || 200, 1), 500);

        const total = await countWhere(db.collection('organizations'));

        const snap = await db
            .collection('organizations')
            .orderBy('created_at', 'desc')
            .limit(cap)
            .get();

        const organizations: OrgRow[] = await Promise.all(
            snap.docs.map(async (docSnap) => {
                const data = docSnap.data() || {};
                const stats = data.stats || {};
                const orgId = docSnap.id;

                // Contadores baratos vindos de stats; expedientes via count().
                const membersCount =
                    typeof stats.members_count === 'number'
                        ? stats.members_count
                        : await countWhere(
                              db
                                  .collection('userOrganizations')
                                  .where('organization_id', '==', orgId)
                          );

                const processesCount =
                    typeof stats.processes_count === 'number'
                        ? stats.processes_count
                        : await countWhere(
                              db
                                  .collection('processes')
                                  .where('organization_id', '==', orgId)
                          );

                const expedientesCount = await countWhere(
                    db.collection('expedientes').where('organization_id', '==', orgId)
                );

                const storageEstimateBytes =
                    processesCount * AVG_DOC_BYTES.processes +
                    expedientesCount * AVG_DOC_BYTES.expedientes +
                    membersCount * AVG_DOC_BYTES.members;

                return {
                    id: orgId,
                    name: String(data.name || 'Sem nome'),
                    created_at: tsToIso(data.created_at),
                    created_by: data.created_by ? String(data.created_by) : null,
                    members_count: membersCount,
                    processes_count: processesCount,
                    expedientes_count: expedientesCount,
                    active_processes:
                        typeof stats.active_processes === 'number'
                            ? stats.active_processes
                            : 0,
                    storageEstimateBytes,
                };
            })
        );

        // Ordena por volume (processos + expedientes) desc para destacar maiores.
        organizations.sort(
            (a, b) =>
                b.processes_count + b.expedientes_count -
                (a.processes_count + a.expedientes_count)
        );

        return {
            generatedAt: new Date().toISOString(),
            total,
            returned: organizations.length,
            hasMore: total > snap.size,
            organizations,
        };
    }
);
