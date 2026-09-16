"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateJuris = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const history_1 = require("../shared/history");
const jurimetria_1 = require("../shared/jurimetria");
const MAX_BULK_UPDATE = 500;
const BATCH_SIZE = 200;
/** Campos fixos que podem ser aplicados em massa. */
const BULK_ALLOWED_CORE = [
    'data_juri', 'comarca', 'tipo', 'resultado', 'promotor', 'horario', 'vara', 'observacoes',
];
const FIELD_LABELS = {
    data_juri: 'Data do júri',
    comarca: 'Comarca',
    tipo: 'Matéria / Tipo',
    resultado: 'Espécie de resultado',
    promotor: 'Promotor(a)',
    horario: 'Horário',
    vara: 'Vara / Órgão julgador',
    observacoes: 'Observações',
    responsible_user_id: 'Responsável',
};
/**
 * Aplica a MESMA alteração a vários júris de uma vez: atribuir um responsável
 * do órgão, padronizar a comarca/matéria/espécie de um conjunto de registros,
 * ou preencher uma coluna personalizada. Cada registro recebe sua própria
 * entrada de histórico.
 */
exports.bulkUpdateJuris = (0, https_1.onCall)({ region: 'southamerica-east1', timeoutSeconds: 300 }, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, ids, data } = request.data || {};
    const targetIds = [...new Set((Array.isArray(ids) ? ids : []).map((x) => String(x || '').trim()).filter(Boolean))];
    if (!organizationId || targetIds.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e ids são obrigatórios');
    }
    if (targetIds.length > MAX_BULK_UPDATE) {
        throw new https_1.HttpsError('invalid-argument', `Selecione no máximo ${MAX_BULK_UPDATE} júris por vez (recebidos: ${targetIds.length}).`);
    }
    const incoming = (data && typeof data === 'object' ? data : {});
    if (Object.keys(incoming).length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Informe ao menos um campo para atualizar');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const orgSnap = await db.collection('organizations').doc(organizationId).get();
    if (!orgSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Organização não encontrada');
    }
    const settings = (0, jurimetria_1.resolveJurimetriaSettings)(orgSnap.data());
    // 1. Normaliza os valores UMA vez (valem para todos os selecionados).
    const { core, values } = (0, jurimetria_1.sanitizeJuriInput)(incoming, settings);
    const coreUpdates = {};
    const changedLabels = [];
    for (const key of BULK_ALLOWED_CORE) {
        if (!Object.prototype.hasOwnProperty.call(incoming, key))
            continue;
        if (key === 'data_juri' && !core.data_juri) {
            throw new https_1.HttpsError('invalid-argument', 'A data do júri informada é inválida');
        }
        coreUpdates[key] = core[key];
        changedLabels.push(FIELD_LABELS[key] || key);
    }
    // 2. Responsável: precisa ser membro do órgão (ou nulo, para desatribuir).
    let responsibleTouched = false;
    let responsibleUserId = null;
    let responsibleUserName = null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'responsible_user_id')) {
        responsibleTouched = true;
        responsibleUserId = String((_a = incoming.responsible_user_id) !== null && _a !== void 0 ? _a : '').trim() || null;
        responsibleUserName = String((_b = incoming.responsible_user_name) !== null && _b !== void 0 ? _b : '').trim().slice(0, 160) || null;
        if (responsibleUserId) {
            const respSnap = await db
                .collection('userOrganizations')
                .doc(`${responsibleUserId}_${organizationId}`)
                .get();
            if (!respSnap.exists) {
                throw new https_1.HttpsError('invalid-argument', 'O responsável indicado não é membro deste órgão');
            }
            if (!responsibleUserName) {
                responsibleUserName = String(((_c = respSnap.data()) === null || _c === void 0 ? void 0 : _c.user_name) || '') || null;
            }
        }
        else if (settings.requireResponsible) {
            throw new https_1.HttpsError('invalid-argument', 'Este órgão exige um responsável para cada júri');
        }
        changedLabels.push(FIELD_LABELS.responsible_user_id);
    }
    // 3. Colunas personalizadas: só as chaves realmente enviadas.
    const customUpdates = {};
    const rawValues = (incoming.values && typeof incoming.values === 'object'
        ? incoming.values
        : {});
    for (const key of Object.keys(rawValues)) {
        const field = settings.customFields.find((f) => f.key === key);
        if (!field)
            continue;
        customUpdates[key] = values[key];
        changedLabels.push(field.label);
    }
    if (changedLabels.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Nenhum campo válido foi informado');
    }
    const now = new Date();
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const logEntry = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: userId,
        user_name: userName,
        action: `Atualização em massa — ${[...new Set(changedLabels)].join(', ')}`,
        timestamp: now.toISOString(),
    };
    let updated = 0;
    let skipped = 0;
    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const chunk = targetIds.slice(i, i + BATCH_SIZE);
        const refs = chunk.map((juriId) => db.collection('juris').doc(juriId));
        const snaps = await db.getAll(...refs);
        const batch = db.batch();
        let batchCount = 0;
        snaps.forEach((snap) => {
            var _a;
            // IDOR: ignora silenciosamente o que não é deste órgão.
            if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId) {
                skipped += 1;
                return;
            }
            const current = snap.data() || {};
            const update = Object.assign({}, coreUpdates);
            if (responsibleTouched) {
                update.responsible_user_id = responsibleUserId;
                update.responsible_user_name = responsibleUserName;
            }
            if (Object.keys(customUpdates).length > 0) {
                update.values = Object.assign(Object.assign({}, (current.values || {})), customUpdates);
            }
            update.updated_at = admin.firestore.FieldValue.serverTimestamp();
            update.updated_by = userId;
            update.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);
            batch.update(snap.ref, update);
            batchCount += 1;
            updated += 1;
        });
        if (batchCount > 0)
            await batch.commit();
        // Espelho do histórico (best-effort, nunca falha a operação).
        try {
            const histBatch = db.batch();
            snaps.forEach((snap) => {
                var _a;
                if (!snap.exists || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.organization_id) !== organizationId)
                    return;
                histBatch.set(snap.ref.collection('history').doc((0, history_1.historyEntryId)(logEntry)), Object.assign(Object.assign({}, logEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
            });
            await histBatch.commit();
        }
        catch (histErr) {
            console.error('[history dual-write] juris bulkUpdate', histErr);
        }
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'BULK_UPDATE_JURI',
        details: { updated, skipped, fields: [...new Set(changedLabels)] },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, updated, skipped };
});
//# sourceMappingURL=bulkUpdate.js.map