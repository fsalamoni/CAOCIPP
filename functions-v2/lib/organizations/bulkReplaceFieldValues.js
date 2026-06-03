"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkReplaceFieldValues = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const normalization_1 = require("../shared/normalization");
const history_1 = require("../shared/history");
const VALID_COLLECTIONS = ['processes', 'expedientes'];
const VALID_FIELDS = ['responsible_user_name', 'consultant', 'location', 'origin', 'object'];
function normalizeSearch(value) {
    return (value || '').trim().toLowerCase();
}
function normalizeReplacement(field, value) {
    const trimmed = (value || '').trim().replace(/\s+/g, ' ');
    if (!trimmed)
        return '';
    if (field === 'responsible_user_name')
        return (0, normalization_1.formatPersonName)(trimmed);
    return trimmed;
}
exports.bulkReplaceFieldValues = (0, https_1.onCall)({ region: 'southamerica-east1', timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, targetCollections, field, fromValue, toValue } = request.data;
    const requesterId = request.auth.uid;
    const db = admin.firestore();
    if (!organizationId || !Array.isArray(targetCollections) || targetCollections.length === 0 || !field) {
        throw new https_1.HttpsError('invalid-argument', 'Parâmetros obrigatórios inválidos');
    }
    if (!VALID_FIELDS.includes(field)) {
        throw new https_1.HttpsError('invalid-argument', 'Campo de substituição inválido');
    }
    const uniqueCollections = Array.from(new Set(targetCollections));
    if (uniqueCollections.some(c => !VALID_COLLECTIONS.includes(c))) {
        throw new https_1.HttpsError('invalid-argument', 'Coleção de destino inválida');
    }
    const normalizedFrom = normalizeSearch(fromValue || '');
    const replacement = normalizeReplacement(field, toValue || '');
    if (!normalizedFrom || !replacement) {
        throw new https_1.HttpsError('invalid-argument', 'Os campos "de" e "para" são obrigatórios');
    }
    const membershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists || ((_a = membershipSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Apenas o criador da organização pode executar substituição em bloco');
    }
    const totals = { processes: 0, expedientes: 0 };
    const batches = [];
    let currentBatch = db.batch();
    let operationsInBatch = 0;
    const commitBatchIfNeeded = async () => {
        if (operationsInBatch > 0) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            operationsInBatch = 0;
        }
    };
    const appendLog = (ref, action) => {
        var _a, _b;
        const now = new Date();
        const logEntry = {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            user_id: requesterId,
            user_name: (0, normalization_1.formatPersonName)(((_b = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.name) || ''),
            action,
            timestamp: now.toISOString(),
        };
        currentBatch.update(ref, {
            [field]: replacement,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: requesterId,
            activity_log: admin.firestore.FieldValue.arrayUnion(logEntry),
        });
        // Dual-write aditivo: espelha a entrada no histórico (subcoleção),
        // no mesmo batch (atômico) e com id determinístico (idempotente).
        currentBatch.set(ref.collection('history').doc((0, history_1.historyEntryId)(logEntry)), Object.assign(Object.assign({}, logEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
        operationsInBatch += 2;
    };
    for (const collectionName of uniqueCollections) {
        const snapshot = await db.collection(collectionName)
            .where('organization_id', '==', organizationId)
            .select(field)
            .get();
        for (const docSnap of snapshot.docs) {
            const rawValue = docSnap.get(field);
            if (typeof rawValue !== 'string')
                continue;
            const current = rawValue.trim();
            if (!current)
                continue;
            if (normalizeSearch(current) === normalizedFrom) {
                const action = `Substituição em bloco: campo "${field}" alterado de "${current}" para "${replacement}"`;
                appendLog(docSnap.ref, action);
                totals[collectionName] += 1;
                if (operationsInBatch >= 450) {
                    await commitBatchIfNeeded();
                }
            }
        }
    }
    await commitBatchIfNeeded();
    for (const batch of batches) {
        await batch.commit();
    }
    const totalUpdated = totals.processes + totals.expedientes;
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: (0, normalization_1.formatPersonName)(request.auth.token.name || ''),
        action: 'BULK_REPLACE_FIELD_VALUES',
        details: {
            field,
            from_value: fromValue,
            to_value: replacement,
            target_collections: uniqueCollections,
            updated: totals,
            total_updated: totalUpdated
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        field,
        updated: totals,
        totalUpdated,
        message: totalUpdated > 0
            ? `${totalUpdated} registro(s) atualizados com sucesso`
            : 'Nenhum registro encontrado para substituição'
    };
});
//# sourceMappingURL=bulkReplaceFieldValues.js.map