import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

async function countCollection(
    db: admin.firestore.Firestore,
    collection: string
): Promise<number> {
    try {
        const snap = await db.collection(collection).count().get();
        return snap.data().count;
    } catch {
        return 0;
    }
}

const AVG_DOC_BYTES: Record<string, number> = {
    organizations: 2_000,
    users: 1_500,
    processes: 3_000,
    expedientes: 2_500,
    userOrganizations: 600,
    auditLogs: 800,
    notifications: 600,
};

// Limite de doc do Firestore: 1 MiB.
const DOC_LIMIT_BYTES = 1_048_576;
const SAMPLE_SIZE = 100;
const LARGE_LOG_THRESHOLD = 200; // entradas em activity_log que merecem alerta

interface CollectionFootprint {
    collection: string;
    count: number;
    estimatedBytes: number;
}

interface SampleStat {
    collection: string;
    sampled: number;
    maxLogEntries: number;
    avgLogEntries: number;
    docsOverThreshold: number;
}

interface FootprintResponse {
    generatedAt: string;
    collections: CollectionFootprint[];
    totalEstimatedBytes: number;
    samples: SampleStat[];
    alerts: string[];
    docLimitBytes: number;
}

/**
 * Amostra documentos de uma coleção e mede o tamanho do array activity_log,
 * que é a principal fonte de crescimento descontrolado (risco de 1 MiB).
 * Usa apenas uma amostra (SAMPLE_SIZE) ordenada por created_at desc — barato.
 */
async function sampleActivityLog(
    db: admin.firestore.Firestore,
    collection: string
): Promise<SampleStat> {
    let snap: admin.firestore.QuerySnapshot;
    try {
        snap = await db
            .collection(collection)
            .orderBy('created_at', 'desc')
            .limit(SAMPLE_SIZE)
            .get();
    } catch {
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
        if (entries > maxLogEntries) maxLogEntries = entries;
        if (entries >= LARGE_LOG_THRESHOLD) docsOverThreshold += 1;
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
export const getStorageFootprint = onCall<void>(
    { region: REGION },
    async (request): Promise<FootprintResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const names = Object.keys(AVG_DOC_BYTES);
        const counts = await Promise.all(
            names.map((n) => countCollection(db, n))
        );

        const collections: CollectionFootprint[] = [];
        let totalEstimatedBytes = 0;
        names.forEach((name, i) => {
            const estimatedBytes = counts[i] * (AVG_DOC_BYTES[name] || 1_000);
            collections.push({ collection: name, count: counts[i], estimatedBytes });
            totalEstimatedBytes += estimatedBytes;
        });

        // Amostragem de activity_log nas coleções que o utilizam.
        const samples = await Promise.all([
            sampleActivityLog(db, 'processes'),
            sampleActivityLog(db, 'expedientes'),
        ]);

        const alerts: string[] = [];
        for (const s of samples) {
            if (s.docsOverThreshold > 0) {
                alerts.push(
                    `${s.collection}: ${s.docsOverThreshold} de ${s.sampled} amostrados com activity_log grande (≥ ${LARGE_LOG_THRESHOLD} entradas). Considerar migração para subcoleção (flag history_subcollection).`
                );
            }
            // Estimativa grosseira de bytes do log (≈ 250 bytes/entrada).
            const estLogBytes = s.maxLogEntries * 250;
            if (estLogBytes > DOC_LIMIT_BYTES * 0.5) {
                alerts.push(
                    `${s.collection}: maior activity_log amostrado ~${(estLogBytes / 1024).toFixed(0)} KB, acima de 50% do limite de 1 MiB.`
                );
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
    }
);
