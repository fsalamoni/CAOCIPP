import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

/**
 * Conta documentos de uma coleção usando agregação count() (barato:
 * cobrado ~1 leitura por 1000 documentos, sem baixar os dados).
 */
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

interface OverviewResponse {
    generatedAt: string;
    totals: {
        organizations: number;
        users: number;
        processes: number;
        expedientes: number;
        memberships: number;
        auditLogs: number;
        notifications: number;
    };
    // Estimativas de footprint (bytes) por coleção, com base em tamanho médio.
    storageEstimate: {
        byCollection: Record<string, number>;
        totalBytes: number;
    };
}

// Tamanho médio estimado (bytes) por documento de cada coleção.
// Valores conservadores; refinados na Onda 2 com amostragem real.
const AVG_DOC_BYTES: Record<string, number> = {
    organizations: 2_000,
    users: 1_500,
    processes: 3_000,
    expedientes: 2_500,
    userOrganizations: 600,
    auditLogs: 800,
    notifications: 600,
};

/**
 * getPlatformOverview - KPIs globais da plataforma para a página de Admin.
 * Apenas super-admin. Usa agregação count() (não varre coleções inteiras).
 */
export const getPlatformOverview = onCall<void>(
    { region: REGION },
    async (request): Promise<OverviewResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const [
            organizations,
            users,
            processes,
            expedientes,
            memberships,
            auditLogs,
            notifications,
        ] = await Promise.all([
            countCollection(db, 'organizations'),
            countCollection(db, 'users'),
            countCollection(db, 'processes'),
            countCollection(db, 'expedientes'),
            countCollection(db, 'userOrganizations'),
            countCollection(db, 'auditLogs'),
            countCollection(db, 'notifications'),
        ]);

        const counts: Record<string, number> = {
            organizations,
            users,
            processes,
            expedientes,
            userOrganizations: memberships,
            auditLogs,
            notifications,
        };

        const byCollection: Record<string, number> = {};
        let totalBytes = 0;
        for (const [name, count] of Object.entries(counts)) {
            const bytes = count * (AVG_DOC_BYTES[name] || 1_000);
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
    }
);
