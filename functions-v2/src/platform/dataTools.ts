import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

/**
 * Conta documentos via agregação count() (barato).
 */
async function countWhere(query: admin.firestore.Query): Promise<number> {
    try {
        const snap = await query.count().get();
        return snap.data().count;
    } catch {
        return 0;
    }
}

interface DriftRow {
    organization_id: string;
    name: string;
    field: string;
    stored: number;
    actual: number;
    diff: number;
}

interface IntegrityResponse {
    generatedAt: string;
    scanned: number;
    okCount: number;
    driftRows: DriftRow[];
}

// Apenas contadores de TOTAL, cuja verdade é um count() inequívoco.
// active_* dependem da semântica de "ativo" e NÃO são auto-corrigidos aqui.
const TOTAL_COUNTERS: {
    field: string;
    statKey: string;
    collection: string;
}[] = [
    {
        field: 'members_count',
        statKey: 'members_count',
        collection: 'userOrganizations',
    },
    {
        field: 'processes_count',
        statKey: 'processes_count',
        collection: 'processes',
    },
    {
        field: 'expedientes_count',
        statKey: 'expedientes_count',
        collection: 'expedientes',
    },
];

/**
 * runIntegrityAudit - Auditoria SOMENTE LEITURA de integridade (Onda 3).
 *
 * Compara os contadores mantidos em organizations/{id}.stats com a contagem
 * real (count()) de membros, processos e expedientes. Reporta divergências
 * (drift) sem alterar nada. Apenas super-admin.
 */
// Tamanho do lote de órgãos processados em paralelo: rápido o bastante para
// não estourar o timeout com centenas de órgãos, sem disparar todos os
// count() de uma vez (500 órgãos x 3 contadores = 1500 requisições simultâneas).
const AUDIT_BATCH_SIZE = 20;

export const runIntegrityAudit = onCall<{ limit?: number }>(
    { region: REGION, timeoutSeconds: 300 },
    async (request): Promise<IntegrityResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const cap = Math.min(Math.max(Number(request.data?.limit) || 200, 1), 500);

        const snap = await db.collection('organizations').limit(cap).get();

        const driftRows: DriftRow[] = [];
        let okCount = 0;

        for (let i = 0; i < snap.docs.length; i += AUDIT_BATCH_SIZE) {
            const batch = snap.docs.slice(i, i + AUDIT_BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(async (docSnap) => {
                const data = docSnap.data() || {};
                const stats = data.stats || {};
                const orgId = docSnap.id;
                const name = String(data.name || 'Sem nome');

                const actualCounts = await Promise.all(TOTAL_COUNTERS.map((counter) => countWhere(
                    db.collection(counter.collection).where('organization_id', '==', orgId)
                )));

                const rows: DriftRow[] = [];
                TOTAL_COUNTERS.forEach((counter, idx) => {
                    const actual = actualCounts[idx];
                    const stored = typeof stats[counter.statKey] === 'number' ? stats[counter.statKey] : 0;
                    if (stored !== actual) {
                        rows.push({
                            organization_id: orgId,
                            name,
                            field: counter.field,
                            stored,
                            actual,
                            diff: actual - stored,
                        });
                    }
                });
                return rows;
            }));

            batchResults.forEach((rows) => {
                driftRows.push(...rows);
                if (rows.length === 0) okCount += 1;
            });
        }

        return {
            generatedAt: new Date().toISOString(),
            scanned: snap.size,
            okCount,
            driftRows,
        };
    }
);

interface RecalcRequest {
    organizationId: string;
}

/**
 * recalcOrgStats - Corrige os contadores de TOTAL de UM órgão (Onda 3).
 *
 * Recalcula members_count, processes_count e expedientes_count a partir da
 * contagem real e grava via merge. Operação idempotente e corretiva: só pode
 * alinhar os contadores com a verdade, nunca apagar dados. Os campos active_*
 * NÃO são tocados (dependem da semântica de "ativo"). Apenas super-admin,
 * auditado, um órgão por vez (explícito).
 */
export const recalcOrgStats = onCall<RecalcRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const organizationId = String(request.data?.organizationId || '').trim();

        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório.');
        }

        const db = admin.firestore();
        const orgRef = db.collection('organizations').doc(organizationId);
        const orgSnap = await orgRef.get();
        if (!orgSnap.exists) {
            throw new HttpsError('not-found', 'Órgão não encontrado.');
        }

        const before = (orgSnap.data()?.stats as Record<string, number>) || {};
        const update: Record<string, number> = {};
        const recalculated: Record<string, { before: number; after: number }> = {};

        for (const counter of TOTAL_COUNTERS) {
            const actual = await countWhere(
                db
                    .collection(counter.collection)
                    .where('organization_id', '==', organizationId)
            );
            update[`stats.${counter.statKey}`] = actual;
            recalculated[counter.statKey] = {
                before: typeof before[counter.statKey] === 'number'
                    ? before[counter.statKey]
                    : 0,
                after: actual,
            };
        }

        await orgRef.update(update);

        await writePlatformAudit(actor.uid, actor.name, 'RECALC_ORG_STATS', {
            organizationId,
            recalculated,
        });

        return { success: true, organizationId, recalculated };
    }
);
