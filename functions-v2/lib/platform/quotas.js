"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPlatformQuota = exports.getPlatformQuotas = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const PLATFORM_CONFIG = 'platformConfig';
const QUOTAS_DOC = 'quotas';
const QUOTA_DEFS = [
    {
        key: 'max_import_rows',
        label: 'Tamanho máximo de importação',
        description: 'Quantidade máxima de linhas aceitas em uma única importação de planilha.',
        unit: 'linhas',
        default: 5000,
        min: 100,
        max: 200000,
    },
    {
        key: 'default_page_size',
        label: 'Tamanho padrão de página',
        description: 'Quantidade de itens carregados por página nas listagens (quando a paginação no banco estiver ativa).',
        unit: 'itens',
        default: 50,
        min: 10,
        max: 500,
    },
    {
        key: 'audit_log_retention_days',
        label: 'Retenção de auditoria',
        description: 'Por quantos dias os registros de auditoria globais devem ser mantidos (informativo; a limpeza só ocorre se/quando uma rotina de expurgo for ativada).',
        unit: 'dias',
        default: 365,
        min: 30,
        max: 3650,
    },
    {
        key: 'activity_log_max_entries',
        label: 'Máximo de entradas no histórico do documento',
        description: 'Tamanho recomendado máximo do histórico (activity_log) embutido em cada documento antes de migrar para subcoleção.',
        unit: 'entradas',
        default: 200,
        min: 20,
        max: 2000,
    },
    {
        key: 'max_listeners_per_session',
        label: 'Máximo de ouvintes em tempo real por sessão',
        description: 'Limite recomendado de listeners simultâneos do Firestore por sessão de usuário.',
        unit: 'ouvintes',
        default: 20,
        min: 3,
        max: 200,
    },
];
const QUOTA_BY_KEY = QUOTA_DEFS.reduce((acc, q) => {
    acc[q.key] = q;
    return acc;
}, {});
/**
 * getPlatformQuotas - Lê as cotas configuradas, mesclando com os padrões.
 * Apenas super-admin.
 */
exports.getPlatformQuotas = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a, _b;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const snap = await db.collection(PLATFORM_CONFIG).doc(QUOTAS_DOC).get();
    const stored = (snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.values)) || {};
    // Mescla: padrão para qualquer cota ainda não definida.
    const quotas = {};
    QUOTA_DEFS.forEach((def) => {
        const v = stored[def.key];
        quotas[def.key] = typeof v === 'number' ? v : def.default;
    });
    const data = snap.data() || {};
    const updatedAt = ((_b = data.updated_at) === null || _b === void 0 ? void 0 : _b.toDate)
        ? data.updated_at.toDate().toISOString()
        : null;
    return {
        quotas,
        definitions: QUOTA_DEFS,
        updatedAt,
        updatedBy: data.updated_by || null,
    };
});
/**
 * setPlatformQuota - Define UMA cota.
 * Escrita exclusiva de super-admin, com auditoria. Usa merge (aditivo).
 */
exports.setPlatformQuota = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const { quotaKey, value } = request.data || {};
    const def = QUOTA_BY_KEY[quotaKey];
    if (!def) {
        throw new https_1.HttpsError('invalid-argument', 'Cota desconhecida.');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new https_1.HttpsError('invalid-argument', 'Valor inválido.');
    }
    const intValue = Math.round(value);
    if (intValue < def.min || intValue > def.max) {
        throw new https_1.HttpsError('invalid-argument', `Valor deve estar entre ${def.min} e ${def.max}.`);
    }
    const db = admin.firestore();
    const ref = db.collection(PLATFORM_CONFIG).doc(QUOTAS_DOC);
    await ref.set({
        values: { [quotaKey]: intValue },
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: actor.name,
        updated_by_uid: actor.uid,
    }, { merge: true });
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'SET_PLATFORM_QUOTA', {
        quotaKey,
        value: intValue,
    });
    return { success: true, quotaKey, value: intValue };
});
//# sourceMappingURL=quotas.js.map