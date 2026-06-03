"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillHistory = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const history_1 = require("../shared/history");
/**
 * backfillHistory - Migração ADITIVA do histórico (Fase 3).
 *
 * Copia as entradas do array activity_log de cada processo/expediente para a
 * subcoleção {doc}/history, usando ID DETERMINÍSTICO (historyEntryId) — exatamente
 * o mesmo esquema da escrita dupla em tempo real. Isso torna a operação:
 *   - IDEMPOTENTE: rodar de novo apenas sobrescreve os mesmos documentos.
 *   - SEM DUPLICATAS: paridade 1:1 com o array (que já deduplica via arrayUnion).
 *   - SEGURA: NUNCA toca no documento principal nem no array; só grava na
 *     subcoleção history. A leitura do app continua vindo do array.
 *
 * Processa em lotes por órgão e por coleção (paginação via startAfter no
 * documentId), retornando `done` e `lastDocId` para a UI iterar até concluir.
 *
 * Modo `verifyOnly`: NÃO escreve nada; apenas compara, por documento, o nº de
 * entradas distintas no array vs a contagem real da subcoleção (count()),
 * reportando divergências. Use para auditar a paridade antes/depois.
 *
 * Apenas super-admin. Auditado.
 */
exports.backfillHistory = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
    var _a, _b, _c, _d, _e;
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const organizationId = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.organizationId) || '').trim();
    const collection = (_b = request.data) === null || _b === void 0 ? void 0 : _b.collection;
    const verifyOnly = !!((_c = request.data) === null || _c === void 0 ? void 0 : _c.verifyOnly);
    const batchDocs = Math.min(Math.max(Number((_d = request.data) === null || _d === void 0 ? void 0 : _d.batchDocs) || 200, 1), 400);
    const startAfter = ((_e = request.data) === null || _e === void 0 ? void 0 : _e.startAfter) || null;
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    }
    if (collection !== 'processes' && collection !== 'expedientes') {
        throw new https_1.HttpsError('invalid-argument', 'collection deve ser "processes" ou "expedientes".');
    }
    const db = admin.firestore();
    let q = db
        .collection(collection)
        .where('organization_id', '==', organizationId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchDocs);
    if (startAfter) {
        q = q.startAfter(startAfter);
    }
    const snap = await q.get();
    let processed = 0;
    let entriesWritten = 0;
    let arrayEntriesTotal = 0;
    let historyEntriesTotal = 0;
    const mismatches = [];
    let lastDocId = null;
    for (const docSnap of snap.docs) {
        processed += 1;
        lastDocId = docSnap.id;
        const data = docSnap.data() || {};
        const rawLog = Array.isArray(data.activity_log)
            ? data.activity_log
            : [];
        // Deduplica por id determinístico (espelha a dedup do arrayUnion).
        const byId = new Map();
        for (const e of rawLog) {
            byId.set((0, history_1.historyEntryId)(e), e);
        }
        arrayEntriesTotal += byId.size;
        const historyRef = docSnap.ref.collection('history');
        if (verifyOnly) {
            const hc = await historyRef.count().get();
            const historyCount = hc.data().count;
            historyEntriesTotal += historyCount;
            if (historyCount < byId.size) {
                mismatches.push({ id: docSnap.id, arrayCount: byId.size, historyCount });
            }
            continue;
        }
        // Grava em lotes (<=450 ops por batch).
        let batch = db.batch();
        let ops = 0;
        for (const [hid, entry] of byId) {
            batch.set(historyRef.doc(hid), Object.assign(Object.assign({}, entry), { created_at: admin.firestore.FieldValue.serverTimestamp(), backfilled: true }));
            ops += 1;
            entriesWritten += 1;
            if (ops >= 450) {
                await batch.commit();
                batch = db.batch();
                ops = 0;
            }
        }
        if (ops > 0) {
            await batch.commit();
        }
    }
    const done = snap.size < batchDocs;
    if (!verifyOnly && processed > 0) {
        await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'BACKFILL_HISTORY', {
            organizationId,
            collection,
            processed,
            entriesWritten,
            startAfter,
            done,
        });
    }
    return {
        organizationId,
        collection,
        verifyOnly,
        processed,
        entriesWritten,
        arrayEntriesTotal,
        historyEntriesTotal,
        mismatches,
        lastDocId,
        done,
    };
});
//# sourceMappingURL=historyBackfill.js.map