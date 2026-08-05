"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalcOrgStats = exports.runIntegrityAudit = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * Conta documentos via agregação count() (barato).
 */
async function countWhere(query) {
    try {
        const snap = await query.count().get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// Apenas contadores de TOTAL, cuja verdade é um count() inequívoco.
// active_* dependem da semântica de "ativo" e NÃO são auto-corrigidos aqui.
const TOTAL_COUNTERS = [
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
exports.runIntegrityAudit = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 300 }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const cap = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 200, 1), 500);
    const snap = await db.collection('organizations').limit(cap).get();
    const driftRows = [];
    let okCount = 0;
    for (let i = 0; i < snap.docs.length; i += AUDIT_BATCH_SIZE) {
        const batch = snap.docs.slice(i, i + AUDIT_BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (docSnap) => {
            const data = docSnap.data() || {};
            const stats = data.stats || {};
            const orgId = docSnap.id;
            const name = String(data.name || 'Sem nome');
            const actualCounts = await Promise.all(TOTAL_COUNTERS.map((counter) => countWhere(db.collection(counter.collection).where('organization_id', '==', orgId))));
            const rows = [];
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
            if (rows.length === 0)
                okCount += 1;
        });
    }
    return {
        generatedAt: new Date().toISOString(),
        scanned: snap.size,
        okCount,
        driftRows,
    };
});
/**
 * recalcOrgStats - Corrige os contadores de TOTAL de UM órgão (Onda 3).
 *
 * Recalcula members_count, processes_count e expedientes_count a partir da
 * contagem real e grava via merge. Operação idempotente e corretiva: só pode
 * alinhar os contadores com a verdade, nunca apagar dados. Os campos active_*
 * NÃO são tocados (dependem da semântica de "ativo"). Apenas super-admin,
 * auditado, um órgão por vez (explícito).
 */
exports.recalcOrgStats = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a, _b;
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const organizationId = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.organizationId) || '').trim();
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    }
    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Órgão não encontrado.');
    }
    const before = ((_b = orgSnap.data()) === null || _b === void 0 ? void 0 : _b.stats) || {};
    const update = {};
    const recalculated = {};
    for (const counter of TOTAL_COUNTERS) {
        const actual = await countWhere(db
            .collection(counter.collection)
            .where('organization_id', '==', organizationId));
        update[`stats.${counter.statKey}`] = actual;
        recalculated[counter.statKey] = {
            before: typeof before[counter.statKey] === 'number'
                ? before[counter.statKey]
                : 0,
            after: actual,
        };
    }
    await orgRef.update(update);
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'RECALC_ORG_STATS', {
        organizationId,
        recalculated,
    });
    return { success: true, organizationId, recalculated };
});
//# sourceMappingURL=dataTools.js.map