import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

interface ActivityItem {
    id: string;
    organization_id: string | null;
    user_id: string | null;
    user_name: string | null;
    action: string | null;
    details: Record<string, unknown> | null;
    timestamp: string | null;
}

interface ActivityResponse {
    generatedAt: string;
    returned: number;
    hasMore: boolean;
    nextCursor: string | null;
    items: ActivityItem[];
}

function tsToIso(value: unknown): string | null {
    if (value && typeof (value as admin.firestore.Timestamp).toDate === 'function') {
        return (value as admin.firestore.Timestamp).toDate().toISOString();
    }
    return null;
}

/**
 * getActivityFeed - Feed global de movimentações (auditLogs) da plataforma.
 *
 * Filtros opcionais: organization_id, user_id, action.
 * Paginação por cursor (ISO timestamp do último item). Apenas super-admin.
 * Ordena por timestamp desc. NÃO varre a coleção: usa limit + cursor.
 */
export const getActivityFeed = onCall<{
    limit?: number;
    organizationId?: string;
    userId?: string;
    action?: string;
    cursor?: string;
}>(
    { region: REGION },
    async (request): Promise<ActivityResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const limit = Math.min(Math.max(Number(request.data?.limit) || 50, 1), 200);
        const { organizationId, userId, action, cursor } = request.data || {};

        let query: admin.firestore.Query = db.collection('auditLogs');

        if (organizationId) {
            query = query.where('organization_id', '==', organizationId);
        }
        if (userId) {
            query = query.where('user_id', '==', userId);
        }
        if (action) {
            query = query.where('action', '==', action);
        }

        query = query.orderBy('timestamp', 'desc');

        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                query = query.startAfter(
                    admin.firestore.Timestamp.fromDate(cursorDate)
                );
            }
        }

        // Busca limit+1 para saber se há mais.
        const snap = await query.limit(limit + 1).get();
        const docs = snap.docs.slice(0, limit);
        const hasMore = snap.size > limit;

        const items: ActivityItem[] = docs.map((doc) => {
            const d = doc.data() || {};
            return {
                id: doc.id,
                organization_id: d.organization_id ? String(d.organization_id) : null,
                user_id: d.user_id ? String(d.user_id) : null,
                user_name: d.user_name ? String(d.user_name) : null,
                action: d.action ? String(d.action) : null,
                details:
                    d.details && typeof d.details === 'object' ? d.details : null,
                timestamp: tsToIso(d.timestamp),
            };
        });

        const nextCursor =
            hasMore && items.length > 0 ? items[items.length - 1].timestamp : null;

        return {
            generatedAt: new Date().toISOString(),
            returned: items.length,
            hasMore,
            nextCursor,
            items,
        };
    }
);
