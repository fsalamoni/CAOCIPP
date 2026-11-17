"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgsReport = void 0;
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
// Tamanho médio estimado (bytes) por documento.
const AVG_DOC_BYTES = {
    processes: 3000,
    expedientes: 2500,
    members: 600,
};
function tsToIso(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
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
exports.getOrgsReport = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const cap = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 200, 1), 500);
    const total = await countWhere(db.collection('organizations'));
    // Sem orderBy: órgão sem created_at (antigo ou criado à mão) também
    // aparece. A ordem final é por volume, logo abaixo.
    const snap = await db
        .collection('organizations')
        .limit(cap)
        .get();
    const organizations = await Promise.all(snap.docs.map(async (docSnap) => {
        var _a, _b, _c;
        const data = docSnap.data() || {};
        const stats = data.stats || {};
        const orgId = docSnap.id;
        // Contadores baratos vindos de stats; expedientes via count().
        const membersCount = typeof stats.members_count === 'number'
            ? stats.members_count
            : await countWhere(db
                .collection('userOrganizations')
                .where('organization_id', '==', orgId));
        const processesCount = typeof stats.processes_count === 'number'
            ? stats.processes_count
            : await countWhere(db
                .collection('processes')
                .where('organization_id', '==', orgId));
        const expedientesCount = await countWhere(db.collection('expedientes').where('organization_id', '==', orgId));
        const storageEstimateBytes = processesCount * AVG_DOC_BYTES.processes +
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
            active_processes: typeof stats.active_processes === 'number'
                ? stats.active_processes
                : 0,
            storageEstimateBytes,
            suspended: ((_a = data.platform_suspension) === null || _a === void 0 ? void 0 : _a.ativa) === true,
            pe_enabled: ((_b = data.secretariaConfig) === null || _b === void 0 ? void 0 : _b.enabled) === true,
            pe_suspended: ((_c = data.secretariaConfig) === null || _c === void 0 ? void 0 : _c.suspensa_plataforma) === true,
        };
    }));
    // Ordena por volume (processos + expedientes) desc para destacar maiores.
    organizations.sort((a, b) => b.processes_count + b.expedientes_count -
        (a.processes_count + a.expedientes_count));
    return {
        generatedAt: new Date().toISOString(),
        total,
        returned: organizations.length,
        hasMore: total > snap.size,
        organizations,
    };
});
//# sourceMappingURL=orgs.js.map