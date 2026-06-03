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
exports.runIntegrityAudit = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const cap = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 200, 1), 500);
    const snap = await db.collection('organizations').limit(cap).get();
    const driftRows = [];
    let okCount = 0;
    for (const docSnap of snap.docs) {
        const data = docSnap.data() || {};
        const stats = data.stats || {};
        const orgId = docSnap.id;
        const name = String(data.name || 'Sem nome');
        let orgHasDrift = false;
        for (const counter of TOTAL_COUNTERS) {
            const actual = await countWhere(db
                .collection(counter.collection)
                .where('organization_id', '==', orgId));
            const stored = typeof stats[counter.statKey] === 'number'
                ? stats[counter.statKey]
                : 0;
            if (stored !== actual) {
                orgHasDrift = true;
                driftRows.push({
                    organization_id: orgId,
                    name,
                    field: counter.field,
                    stored,
                    actual,
                    diff: actual - stored,
                });
            }
        }
        if (!orgHasDrift)
            okCount += 1;
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