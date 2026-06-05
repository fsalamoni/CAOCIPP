"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganization = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.updateOrganization = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { organizationId, data } = request.data;
    const requesterId = request.auth.uid;
    const db = admin.firestore();
    // 1. Verify access (Must be CREATOR)
    // Memberships are stored in 'userOrganizations' collection as {userId}_{orgId}
    const membershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'User is not a member of this organization');
    }
    const membership = membershipSnap.data();
    if ((membership === null || membership === void 0 ? void 0 : membership.role) !== 'creator') {
        throw new https_1.HttpsError('permission-denied', 'Only the organization Creator can update settings');
    }
    // 2. Validate Data
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'Organization ID is required');
    }
    // 3. Update Organization
    // Only allow specific fields to be updated
    const updates = {};
    if (data.name !== undefined)
        updates.name = data.name;
    if (data.description !== undefined)
        updates.description = data.description;
    if (data.matterSettings !== undefined)
        updates.matterSettings = data.matterSettings;
    if (data.summarySettings !== undefined)
        updates.summarySettings = data.summarySettings;
    if (data.expedienteSettings !== undefined)
        updates.expedienteSettings = data.expedienteSettings;
    if (data.moduleConfig !== undefined)
        updates.moduleConfig = sanitizeModuleConfig(data.moduleConfig);
    if (data.dashboardConfig !== undefined)
        updates.dashboardConfig = sanitizeDashboardConfig(data.dashboardConfig);
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    if (Object.keys(updates).length === 0) {
        return { success: true, message: 'No changes detected' };
    }
    await db.collection('organizations').doc(organizationId).update(updates);
    // 4. Audit Log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: requesterId,
        user_name: request.auth.token.name || 'Unknown',
        action: 'UPDATE_ORGANIZATION',
        details: {
            fields_updated: Object.keys(updates).filter(k => k !== 'updated_at')
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Organization updated successfully' };
});
// Aceita apenas módulos built-in conhecidos, com booleano enabled e order numérico.
function sanitizeModuleConfig(input) {
    const allowed = ['processes', 'expedientes', 'summary'];
    const out = {};
    for (const key of allowed) {
        const entry = input === null || input === void 0 ? void 0 : input[key];
        if (entry && typeof entry === 'object') {
            out[key] = Object.assign({ enabled: entry.enabled === true }, (typeof entry.order === 'number' ? { order: entry.order } : {}));
        }
    }
    return out;
}
// ============================================================================
// dashboardConfig — métricas por página exibidas em "Informações Gerais".
// Estrutura: { pages: { [pageKey]: { metrics: MetricDef[] } } }
// O servidor é a fonte da verdade: tudo é saneado e limitado.
// ============================================================================
const DASH_VALID_AGGS = new Set(['count', 'sum', 'avg', 'min', 'max', 'percent']);
const DASH_VALID_OPS = new Set(['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'filled', 'empty', 'truthy', 'falsy', 'contains']);
const DASH_VALID_FORMATS = new Set(['auto', 'number', 'currency', 'percent']);
const DASH_NO_VALUE_OPS = new Set(['filled', 'empty', 'truthy', 'falsy']);
function dashStr(v, max) {
    return String(v !== null && v !== void 0 ? v : '').slice(0, max);
}
function sanitizeDashFilter(input) {
    if (!input || typeof input !== 'object')
        return null;
    const field = dashStr(input.field, 60).trim();
    const op = String(input.op || '');
    if (!field || !DASH_VALID_OPS.has(op))
        return null;
    const out = { field, op };
    if (op === 'in' || op === 'nin') {
        const arr = Array.isArray(input.value) ? input.value : [input.value];
        out.value = arr.slice(0, 50).map((x) => dashStr(x, 120));
    }
    else if (!DASH_NO_VALUE_OPS.has(op)) {
        const v = input.value;
        if (typeof v === 'number' && Number.isFinite(v))
            out.value = v;
        else if (typeof v === 'boolean')
            out.value = v;
        else
            out.value = dashStr(v, 200);
    }
    return out;
}
function sanitizeDashMetric(input) {
    if (!input || typeof input !== 'object')
        return null;
    const agg = DASH_VALID_AGGS.has(input.agg) ? input.agg : 'count';
    let size = Number(input.size);
    if (!Number.isInteger(size) || size < 1 || size > 4)
        size = 1;
    const needsField = ['sum', 'avg', 'min', 'max'].includes(agg);
    const filters = (Array.isArray(input.filters) ? input.filters : [])
        .slice(0, 12)
        .map(sanitizeDashFilter)
        .filter((f) => f !== null);
    return {
        id: dashStr(input.id, 60) || `m_${Math.random().toString(36).slice(2)}`,
        label: dashStr(input.label, 80) || 'Métrica',
        agg,
        field: needsField && input.field ? dashStr(input.field, 60) : null,
        filters,
        format: DASH_VALID_FORMATS.has(input.format) ? input.format : 'auto',
        icon: dashStr(input.icon, 40) || 'Hash',
        color: dashStr(input.color, 40) || 'indigo',
        size,
    };
}
function sanitizeDashboardConfig(input) {
    const out = { pages: {} };
    const pages = input === null || input === void 0 ? void 0 : input.pages;
    if (!pages || typeof pages !== 'object')
        return out;
    let pageCount = 0;
    for (const key of Object.keys(pages)) {
        if (pageCount >= 50)
            break;
        const val = pages[key];
        if (!val || typeof val !== 'object' || !Array.isArray(val.metrics))
            continue;
        const pageKey = dashStr(key, 120);
        if (!pageKey)
            continue;
        const metrics = val.metrics
            .slice(0, 24)
            .map(sanitizeDashMetric)
            .filter((m) => m !== null);
        out.pages[pageKey] = { metrics };
        pageCount += 1;
    }
    return out;
}
//# sourceMappingURL=update.js.map