"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityFeed = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
function tsToIso(value) {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
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
exports.getActivityFeed = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const limit = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 50, 1), 200);
    const { organizationId, userId, action, cursor } = request.data || {};
    let query = db.collection('auditLogs');
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
            query = query.startAfter(admin.firestore.Timestamp.fromDate(cursorDate));
        }
    }
    // Busca limit+1 para saber se há mais.
    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit);
    const hasMore = snap.size > limit;
    const items = docs.map((doc) => {
        const d = doc.data() || {};
        return {
            id: doc.id,
            organization_id: d.organization_id ? String(d.organization_id) : null,
            user_id: d.user_id ? String(d.user_id) : null,
            user_name: d.user_name ? String(d.user_name) : null,
            action: d.action ? String(d.action) : null,
            details: d.details && typeof d.details === 'object' ? d.details : null,
            timestamp: tsToIso(d.timestamp),
        };
    });
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].timestamp : null;
    return {
        generatedAt: new Date().toISOString(),
        returned: items.length,
        hasMore,
        nextCursor,
        items,
    };
});
//# sourceMappingURL=activity.js.map