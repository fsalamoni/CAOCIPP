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
exports.getPlatformOverview = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * Conta documentos de uma coleção usando agregação count() (barato:
 * cobrado ~1 leitura por 1000 documentos, sem baixar os dados).
 */
async function countCollection(db, collection) {
    try {
        const snap = await db.collection(collection).count().get();
        return snap.data().count;
    }
    catch (_a) {
        return 0;
    }
}
// Tamanho médio estimado (bytes) por documento de cada coleção.
// Valores conservadores; refinados na Onda 2 com amostragem real.
const AVG_DOC_BYTES = {
    organizations: 2000,
    users: 1500,
    processes: 3000,
    expedientes: 2500,
    parcerias: 2800,
    juris: 1200,
    userOrganizations: 600,
    auditLogs: 800,
    notifications: 600,
};
/**
 * getPlatformOverview - KPIs globais da plataforma para a página de Admin.
 * Apenas super-admin. Usa agregação count() (não varre coleções inteiras).
 */
exports.getPlatformOverview = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const [organizations, users, processes, expedientes, parcerias, juris, memberships, auditLogs, notifications,] = await Promise.all([
        countCollection(db, 'organizations'),
        countCollection(db, 'users'),
        countCollection(db, 'processes'),
        countCollection(db, 'expedientes'),
        countCollection(db, 'parcerias'),
        countCollection(db, 'juris'),
        countCollection(db, 'userOrganizations'),
        countCollection(db, 'auditLogs'),
        countCollection(db, 'notifications'),
    ]);
    const counts = {
        organizations,
        users,
        processes,
        expedientes,
        parcerias,
        juris,
        userOrganizations: memberships,
        auditLogs,
        notifications,
    };
    const byCollection = {};
    let totalBytes = 0;
    for (const [name, count] of Object.entries(counts)) {
        const bytes = count * (AVG_DOC_BYTES[name] || 1000);
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
            parcerias,
            juris,
            memberships,
            auditLogs,
            notifications,
        },
        storageEstimate: { byCollection, totalBytes },
    };
});
//# sourceMappingURL=overview.js.map