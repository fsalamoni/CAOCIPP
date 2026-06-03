"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformOverview = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * Conta documentos de uma coleção usando agregação count() (barato:
 * cobrado ~1 leitura por 1000 documentos, sem baixar os dados).
 */
async function countCollection(db, collection) {
    try {
        const snap = await db.collection(collection).count().get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// Tamanho médio estimado (bytes) por documento de cada coleção.
// Valores conservadores; refinados na Onda 2 com amostragem real.
const AVG_DOC_BYTES = {
    organizations: 2000,
    users: 1500,
    processes: 3000,
    expedientes: 2500,
    userOrganizations: 600,
    auditLogs: 800,
    notifications: 600,
};
/**
 * getPlatformOverview - KPIs globais da plataforma para a página de Admin.
 * Apenas super-admin. Usa agregação count() (não varre coleções inteiras).
 */
exports.getPlatformOverview = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const [organizations, users, processes, expedientes, memberships, auditLogs, notifications,] = await Promise.all([
        countCollection(db, 'organizations'),
        countCollection(db, 'users'),
        countCollection(db, 'processes'),
        countCollection(db, 'expedientes'),
        countCollection(db, 'userOrganizations'),
        countCollection(db, 'auditLogs'),
        countCollection(db, 'notifications'),
    ]);
    const counts = {
        organizations,
        users,
        processes,
        expedientes,
        userOrganizations: memberships,
        auditLogs,
        notifications,
    };
    const byCollection = {};
    let totalBytes = 0;
    for (const [name, count] of Object.entries(counts)) {
        const bytes = count * (AVG_DOC_BYTES[name] || 1000);
        byCollection[name] = bytes;
        totalBytes += bytes;
    }
    return {
        generatedAt: new Date().toISOString(),
        totals: {
            organizations,
            users,
            processes,
            expedientes,
            memberships,
            auditLogs,
            notifications,
        },
        storageEstimate: { byCollection, totalBytes },
    };
});
//# sourceMappingURL=overview.js.map