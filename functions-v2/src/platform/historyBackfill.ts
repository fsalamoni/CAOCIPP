import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { historyEntryId, ActivityLogEntry } from '../shared/history';

interface BackfillRequest {
    organizationId: string;
    collection: 'processes' | 'expedientes';
    startAfter?: string | null;
    batchDocs?: number;
    verifyOnly?: boolean;
}

interface Mismatch {
    id: string;
    arrayCount: number;
    historyCount: number;
}

interface BackfillResponse {
    organizationId: string;
    collection: 'processes' | 'expedientes';
    verifyOnly: boolean;
    processed: number;
    entriesWritten: number;
    arrayEntriesTotal: number;
    historyEntriesTotal: number;
    mismatches: Mismatch[];
    lastDocId: string | null;
    done: boolean;
}

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
export const backfillHistory = onCall<BackfillRequest>(
    { region: REGION, timeoutSeconds: 540, memory: '512MiB' },
    async (request): Promise<BackfillResponse> => {
        const actor = await assertPlatformAdmin(request);

        const organizationId = String(request.data?.organizationId || '').trim();
        const collection = request.data?.collection;
        const verifyOnly = !!request.data?.verifyOnly;
        const batchDocs = Math.min(Math.max(Number(request.data?.batchDocs) || 200, 1), 400);
        const startAfter = request.data?.startAfter || null;

        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório.');
        }
        if (collection !== 'processes' && collection !== 'expedientes') {
            throw new HttpsError('invalid-argument', 'collection deve ser "processes" ou "expedientes".');
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
        const mismatches: Mismatch[] = [];
        let lastDocId: string | null = null;

        for (const docSnap of snap.docs) {
            processed += 1;
            lastDocId = docSnap.id;

            const data = docSnap.data() || {};
            const rawLog: ActivityLogEntry[] = Array.isArray(data.activity_log)
                ? (data.activity_log as ActivityLogEntry[])
                : [];

            // Deduplica por id determinístico (espelha a dedup do arrayUnion).
            const byId = new Map<string, ActivityLogEntry>();
            for (const e of rawLog) {
                byId.set(historyEntryId(e), e);
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
                batch.set(historyRef.doc(hid), {
                    ...entry,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    backfilled: true,
                });
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
            await writePlatformAudit(actor.uid, actor.name, 'BACKFILL_HISTORY', {
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
    }
);
