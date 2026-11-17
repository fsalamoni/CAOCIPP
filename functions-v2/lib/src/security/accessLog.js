"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgAccessLog = exports.logAccess = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const vinculo_1 = require("../shared/vinculo");
function isOrgAdmin(membership) {
    if (!membership)
        return false;
    if (membership.role === 'creator' || membership.role === 'admin')
        return true;
    return Object.values(membership.permissions || {}).some((v) => v === true);
}
// Log de acesso e auditoria (flag `access_audit_log`). Registra aberturas de
// registros com restrição de acesso e exportações de tabela — reaproveita a
// coleção global `auditLogs` já usada pelas demais Cloud Functions.
exports.logAccess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, entityType, entityId, action, details } = request.data || {};
    if (!organizationId || !action) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!membershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    // Cap defensivo no payload livre: sem isto, um cliente podia anexar um
    // objeto arbitrariamente grande/profundo em `details`, inflando o
    // custo de armazenamento do auditLogs (coleção nunca purgada).
    const safeDetails = { entity_type: entityType || null, entity_id: entityId || null };
    if (details && typeof details === 'object') {
        Object.entries(details).slice(0, 10).forEach(([key, value]) => {
            safeDetails[String(key).slice(0, 100)] = typeof value === 'string' ? value.slice(0, 500) : value;
        });
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || 'Usuário',
        action: action === 'view_restricted' ? 'VIEW_RESTRICTED_RECORD' : 'EXPORT_TABLE',
        details: safeDetails,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
// getOrgAccessLog - Consulta o log de acesso de UM órgão (criador ou
// administrador delegado). Diferente de getActivityFeed (plataforma/super-admin),
// esta função é escopada ao próprio órgão do solicitante.
exports.getOrgAccessLog = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId } = request.data || {};
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório.');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!membershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    if (!isOrgAdmin(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'Apenas o criador ou administradores delegados podem consultar o log de acesso.');
    }
    const limit = Math.min(Math.max(Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.limit) || 100, 1), 300);
    // Filtra a ação já na query (existe índice organization_id+action+timestamp)
    // em vez de buscar os 1000 eventos mais recentes de QUALQUER tipo e
    // filtrar depois — antes, em um órgão com muita atividade (imports em
    // massa, edições em lote), eventos genuinos de VIEW_RESTRICTED_RECORD/
    // EXPORT_TABLE podiam ser empurrados para fora dessa janela fixa de
    // 1000 por outras ações mais frequentes, fazendo o log de acesso
    // reportar menos eventos do que realmente aconteceram.
    const snap = await db.collection('auditLogs')
        .where('organization_id', '==', organizationId)
        .where('action', 'in', ['VIEW_RESTRICTED_RECORD', 'EXPORT_TABLE'])
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    const items = snap.docs
        .map((d) => d.data())
        .map((d) => {
        var _a;
        return ({
            user_name: d.user_name || 'Usuário',
            action: d.action,
            details: d.details || {},
            timestamp: ((_a = d.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) ? d.timestamp.toDate().toISOString() : null,
        });
    });
    return { items };
});
//# sourceMappingURL=accessLog.js.map