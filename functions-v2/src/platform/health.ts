import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

/**
 * Conta documentos via agregação count() (barato).
 */
async function countWhere(query: admin.firestore.Query): Promise<number> {
    try {
        const snap = await query.count().get();
        return snap.data().count;
    } catch {
        return 0;
    }
}

const ERROR_HINTS = ['ERROR', 'FAIL', 'FAILED', 'ERRO', 'FALHA'];
const RECENT_SAMPLE = 50;

interface HealthCheck {
    name: string;
    status: 'ok' | 'warn' | 'error';
    detail: string;
}

interface RecentError {
    action: string;
    organization_id: string | null;
    user_name: string | null;
    timestamp: string | null;
}

interface HealthResponse {
    generatedAt: string;
    checks: HealthCheck[];
    metrics: {
        auditLogsLast24h: number;
        auditLogsTotal: number;
        lastActivityAt: string | null;
        recentErrorCount: number;
    };
    recentErrors: RecentError[];
}

function tsToIso(value: unknown): string | null {
    if (value && typeof (value as admin.firestore.Timestamp).toDate === 'function') {
        return (value as admin.firestore.Timestamp).toDate().toISOString();
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
export const getSystemHealth = onCall<void>(
    { region: REGION },
    async (request): Promise<HealthResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const checks: HealthCheck[] = [];

        // 1. Conectividade com o Firestore (read trivial).
        let firestoreOk = true;
        try {
            await db.collection('platformConfig').doc('featureFlags').get();
            checks.push({
                name: 'Firestore',
                status: 'ok',
                detail: 'Banco de dados acessível.',
            });
        } catch (e) {
            firestoreOk = false;
            checks.push({
                name: 'Firestore',
                status: 'error',
                detail: `Falha ao acessar o banco: ${(e as Error).message}`,
            });
        }

        // 2. Volume de auditoria nas últimas 24h.
        const cutoff = admin.firestore.Timestamp.fromMillis(
            Date.now() - 24 * 60 * 60 * 1000
        );
        const auditLogsLast24h = firestoreOk
            ? await countWhere(
                  db.collection('auditLogs').where('timestamp', '>=', cutoff)
              )
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
        let lastActivityAt: string | null = null;
        const recentErrors: RecentError[] = [];
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
            } catch {
                // Sem índice de timestamp: ignora amostra (não crítico).
            }
        }

        const recentErrorCount = recentErrors.length;
        checks.push({
            name: 'Erros recentes',
            status:
                recentErrorCount === 0
                    ? 'ok'
                    : recentErrorCount < 5
                      ? 'warn'
                      : 'error',
            detail:
                recentErrorCount === 0
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
    }
);
