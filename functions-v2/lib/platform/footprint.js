"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageFootprint = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
async function countCollection(db, collection) {
    try {
        const snap = await db.collection(collection).count().get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
const AVG_DOC_BYTES = {
    organizations: 2000,
    users: 1500,
    processes: 3000,
    expedientes: 2500,
    userOrganizations: 600,
    auditLogs: 800,
    notifications: 600,
};
// Limite de doc do Firestore: 1 MiB.
const DOC_LIMIT_BYTES = 1048576;
const SAMPLE_SIZE = 100;
const LARGE_LOG_THRESHOLD = 200; // entradas em activity_log que merecem alerta
/**
 * Amostra documentos de uma coleção e mede o tamanho do array activity_log,
 * que é a principal fonte de crescimento descontrolado (risco de 1 MiB).
 * Usa apenas uma amostra (SAMPLE_SIZE) ordenada por created_at desc — barato.
 */
async function sampleActivityLog(db, collection) {
    let snap;
    try {
        snap = await db
            .collection(collection)
            .orderBy('created_at', 'desc')
            .limit(SAMPLE_SIZE)
            .get();
    }
    catch (_a) {
        // Sem índice/campo created_at: amostra simples.
        snap = await db.collection(collection).limit(SAMPLE_SIZE).get();
    }
    let maxLogEntries = 0;
    let totalLogEntries = 0;
    let docsOverThreshold = 0;
    snap.forEach((doc) => {
        const data = doc.data() || {};
        const log = data.activity_log;
        const entries = Array.isArray(log) ? log.length : 0;
        totalLogEntries += entries;
        if (entries > maxLogEntries)
            maxLogEntries = entries;
        if (entries >= LARGE_LOG_THRESHOLD)
            docsOverThreshold += 1;
    });
    return {
        collection,
        sampled: snap.size,
        maxLogEntries,
        avgLogEntries: snap.size > 0 ? Math.round(totalLogEntries / snap.size) : 0,
        docsOverThreshold,
    };
}
/**
 * getStorageFootprint - Footprint de armazenamento por coleção + alertas (Onda 2).
 *
 * Contagem por agregação count() + estimativa de bytes + amostragem do tamanho
 * de activity_log para detectar documentos próximos do limite de 1 MiB.
 * Apenas super-admin. Não baixa coleções inteiras (usa count + amostra).
 */
exports.getStorageFootprint = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const names = Object.keys(AVG_DOC_BYTES);
    const counts = await Promise.all(names.map((n) => countCollection(db, n)));
    const collections = [];
    let totalEstimatedBytes = 0;
    names.forEach((name, i) => {
        const estimatedBytes = counts[i] * (AVG_DOC_BYTES[name] || 1000);
        collections.push({ collection: name, count: counts[i], estimatedBytes });
        totalEstimatedBytes += estimatedBytes;
    });
    // Amostragem de activity_log nas coleções que o utilizam.
    const samples = await Promise.all([
        sampleActivityLog(db, 'processes'),
        sampleActivityLog(db, 'expedientes'),
    ]);
    const alerts = [];
    for (const s of samples) {
        if (s.docsOverThreshold > 0) {
            alerts.push(`${s.collection}: ${s.docsOverThreshold} de ${s.sampled} amostrados com activity_log grande (≥ ${LARGE_LOG_THRESHOLD} entradas). Considerar migração para subcoleção (flag history_subcollection).`);
        }
        // Estimativa grosseira de bytes do log (≈ 250 bytes/entrada).
        const estLogBytes = s.maxLogEntries * 250;
        if (estLogBytes > DOC_LIMIT_BYTES * 0.5) {
            alerts.push(`${s.collection}: maior activity_log amostrado ~${(estLogBytes / 1024).toFixed(0)} KB, acima de 50% do limite de 1 MiB.`);
        }
    }
    return {
        generatedAt: new Date().toISOString(),
        collections,
        totalEstimatedBytes,
        samples,
        alerts,
        docLimitBytes: DOC_LIMIT_BYTES,
    };
});
//# sourceMappingURL=footprint.js.map