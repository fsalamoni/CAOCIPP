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
exports.deleteProcess = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const permissions_1 = require("../shared/permissions");
const vinculo_1 = require("../shared/vinculo");
exports.deleteProcess = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId } = request.data;
    if (!id || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing ID');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify permissions (Manager only)
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'Not a member');
    }
    // O criador pode excluir; membros precisam da permissão `delete_records`.
    if (!(0, permissions_1.hasOrgPermission)(membershipSnap.data(), 'delete_records')) {
        throw new https_1.HttpsError('permission-denied', 'Only the organization creator can delete processes');
    }
    // 2. Verify the target record actually belongs to this organization —
    // sem isto, um usuário com delete_records no órgão A podia apagar
    // qualquer processo de outro órgão (B) só informando o organizationId
    // de A (que passa na checagem de permissão) junto do ID do documento
    // de B.
    const processRef = db.collection('processes').doc(id);
    const processSnap = await processRef.get();
    if (!processSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Process not found');
    }
    if (((_a = processSnap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Process belongs to another organization');
    }
    // 3. Delete (recursivo: remove também as subcoleções history/comments —
    // um `.delete()` simples deixava essas subcoleções órfãs e, pelas
    // regras de leitura delas dependerem de um get() no doc pai, também
    // permanentemente inacessíveis, sem nenhuma forma de limpeza depois).
    await db.recursiveDelete(processRef);
    // 4. Update stats
    await db.collection('organizations').doc(organizationId).update({
        'stats.processes_count': admin.firestore.FieldValue.increment(-1),
        'stats.active_processes': admin.firestore.FieldValue.increment(-1)
    });
    // 5. Audit
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_PROCESS',
        details: { process_id: id },
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=delete.js.map