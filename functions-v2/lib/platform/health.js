"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemHealth = void 0;
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
const ERROR_HINTS = ['ERROR', 'FAIL', 'FAILED', 'ERRO', 'FALHA'];
const RECENT_SAMPLE = 50;
function tsToIso(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    return null;
}
/**
 * getSystemHealth - Diagnóstico leve e SOMENTE LEITURA da plataforma (Onda 3).
 *
 * Não depende de APIs externas (Cloud Logging/Monitoring) para evitar falhas de
 * permissão; usa apenas Firestore: conectividade, volume de auditoria nas
 * últimas 24h, última atividade registrada e amostra de eventos de erro.
 * Apenas super-admin.
 */
exports.getSystemHealth = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const checks = [];
    // 1. Conectividade com o Firestore (read trivial).
    let firestoreOk = true;
    try {
        await db.collection('platformConfig').doc('featureFlags').get();
        checks.push({
            name: 'Firestore',
            status: 'ok',
            detail: 'Banco de dados acessível.',
        });
    }
    catch (e) {
        firestoreOk = false;
        checks.push({
            name: 'Firestore',
            status: 'error',
            detail: `Falha ao acessar o banco: ${e.message}`,
        });
    }
    // 2. Volume de auditoria nas últimas 24h.
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const auditLogsLast24h = firestoreOk
        ? await countWhere(db.collection('auditLogs').where('timestamp', '>=', cutoff))
        : 0;
    const auditLogsTotal = firestoreOk
        ? await countWhere(db.collection('auditLogs'))
        : 0;
    checks.push({
        name: 'Atividade (auditoria)',
        status: 'ok',
        detail: `${auditLogsLast24h} evento(s) nas últimas 24h • ${auditLogsTotal} no total.`,
    });
    // 3. Amostra recente de eventos para detectar erros/falhas.
    let lastActivityAt = null;
    const recentErrors = [];
    if (firestoreOk) {
        try {
            const snap = await db
                .collection('auditLogs')
                .orderBy('timestamp', 'desc')
                .limit(RECENT_SAMPLE)
                .get();
            snap.docs.forEach((doc, idx) => {
                const data = doc.data() || {};
                if (idx === 0) {
                    lastActivityAt = tsToIso(data.timestamp);
                }
                const action = String(data.action || '').toUpperCase();
                const isError = ERROR_HINTS.some((h) => action.includes(h));
                if (isError && recentErrors.length < 20) {
                    recentErrors.push({
                        action: String(data.action || ''),
                        organization_id: data.organization_id
                            ? String(data.organization_id)
                            : null,
                        user_name: data.user_name
                            ? String(data.user_name)
                            : null,
                        timestamp: tsToIso(data.timestamp),
                    });
                }
            });
        }
        catch (_a) {
            // Sem índice de timestamp: ignora amostra (não crítico).
        }
    }
    const recentErrorCount = recentErrors.length;
    checks.push({
        name: 'Erros recentes',
        status: recentErrorCount === 0
            ? 'ok'
            : recentErrorCount < 5
                ? 'warn'
                : 'error',
        detail: recentErrorCount === 0
            ? 'Nenhum evento de erro na amostra recente.'
            : `${recentErrorCount} evento(s) de erro/falha na amostra recente.`,
    });
    return {
        generatedAt: new Date().toISOString(),
        checks,
        metrics: {
            auditLogsLast24h,
            auditLogsTotal,
            lastActivityAt,
            recentErrorCount,
        },
        recentErrors,
    };
});
//# sourceMappingURL=health.js.map