"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRecord = exports.importRecords = exports.updateRecord = exports.createRecord = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const schema_1 = require("./schema");
const transitions_1 = require("./transitions");
const history_1 = require("../shared/history");
const REGION = 'southamerica-east1';
async function getMembership(db, userId, organizationId) {
    const snap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!snap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização.');
    }
    return snap.data() || {};
}
async function getEntityType(db, organizationId, entityTypeId) {
    const snap = await db.collection('entityTypes').doc(entityTypeId).get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Tipo de registro não encontrado.');
    const data = snap.data();
    if (data.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
    }
    return Object.assign({ id: snap.id }, data);
}
function initialPhase(def) {
    const init = (def.phases || []).find((p) => p.is_initial) || (def.phases || [])[0];
    return (init === null || init === void 0 ? void 0 : init.key) || '';
}
/** Conjunto de fases já alcançadas até `phaseKey` (por ordem). Usado para só
 *  exigir colunas obrigatórias das fases que o registro já atingiu. */
function phasesReachedUpTo(def, phaseKey) {
    var _a;
    const phases = (def.phases || []).slice().sort((a, b) => { var _a, _b; return ((_a = a.order) !== null && _a !== void 0 ? _a : 0) - ((_b = b.order) !== null && _b !== void 0 ? _b : 0); });
    const cur = phases.find((p) => p.key === phaseKey);
    const curOrder = (_a = cur === null || cur === void 0 ? void 0 : cur.order) !== null && _a !== void 0 ? _a : 0;
    return new Set(phases.filter((p) => { var _a; return ((_a = p.order) !== null && _a !== void 0 ? _a : 0) <= curOrder; }).map((p) => p.key));
}
/** Valida um tipo de processo contra a definição. Retorna a chave válida ou null. */
function resolveRecordType(def, value) {
    const key = String(value !== null && value !== void 0 ? value : '').trim();
    if (!key)
        return null;
    return (def.record_types || []).some((t) => t.key === key) ? key : null;
}
function nowParts() {
    const now = new Date();
    return {
        now,
        logDate: now.toISOString().split('T')[0],
        logTime: now.toTimeString().split(' ')[0],
        iso: now.toISOString(),
    };
}
async function writeHistory(ref, entry) {
    try {
        await ref.collection('history').doc((0, history_1.historyEntryId)(entry)).set(Object.assign(Object.assign({}, entry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (err) {
        console.error('[customRecords history dual-write]', ref.id, err);
    }
}
exports.createRecord = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, entityTypeId, values, phase, record_type } = request.data || {};
    if (!organizationId || !entityTypeId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
    }
    const db = admin.firestore();
    await getMembership(db, userId, organizationId);
    const def = await getEntityType(db, organizationId, entityTypeId);
    let targetPhase = initialPhase(def);
    if (phase && (def.phases || []).some((p) => p.key === phase)) {
        targetPhase = phase;
    }
    // Só exige colunas obrigatórias das fases já alcançadas (a fase inicial,
    // por padrão). Colunas de fases posteriores são cobradas ao avançar.
    const requiredPhases = phasesReachedUpTo(def, targetPhase);
    const { ok, errors, normalized } = (0, schema_1.validateRecordValues)(def.fields, values || {}, { requiredPhases });
    if (!ok) {
        throw new https_1.HttpsError('invalid-argument', Object.values(errors)[0] || 'Dados inválidos.', { errors });
    }
    const ref = db.collection('customRecords').doc();
    const { logDate, logTime, iso } = nowParts();
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const entry = {
        date: logDate, time: logTime, user_id: userId, user_name: userName,
        action: `${def.label_singular} criado`, timestamp: iso,
    };
    const recordData = {
        id: ref.id,
        organization_id: organizationId,
        entity_type_id: entityTypeId,
        entity_key: def.key || null,
        values: normalized,
        phase: targetPhase,
        record_type: resolveRecordType(def, record_type),
        created_by: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        activity_log: [entry],
    };
    await ref.set(recordData);
    await writeHistory(ref, entry);
    // Contadores por tipo no doc do órgão (best-effort).
    try {
        await db.collection('organizations').doc(organizationId).update({
            [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(1),
        });
    }
    catch (e) {
        console.error('[customRecords stats inc]', e);
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'CREATE_RECORD',
        details: { entity_type_id: entityTypeId, record_id: ref.id },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, recordId: ref.id };
});
exports.updateRecord = (0, https_1.onCall)({ region: REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, recordId, values, phase, comment, record_type } = request.data || {};
    if (!organizationId || !recordId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e recordId são obrigatórios.');
    }
    const db = admin.firestore();
    const membership = await getMembership(db, userId, organizationId);
    const userRole = String(membership.role || 'member');
    const ref = db.collection('customRecords').doc(recordId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Registro não encontrado.');
    const current = snap.data();
    if (current.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Registro não pertence a esta organização.');
    }
    const def = await getEntityType(db, organizationId, current.entity_type_id);
    const updates = {
        updated_by: userId,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const logActions = [];
    // Merge de valores (validação parcial dos campos enviados).
    let mergedValues = Object.assign({}, (current.values || {}));
    if (values && typeof values === 'object') {
        const { ok, errors, normalized } = (0, schema_1.validateRecordValues)(def.fields, values, { partial: true });
        if (!ok) {
            throw new https_1.HttpsError('invalid-argument', Object.values(errors)[0] || 'Dados inválidos.', { errors });
        }
        mergedValues = Object.assign(Object.assign({}, mergedValues), normalized);
        updates.values = mergedValues;
        logActions.push('Dados atualizados');
    }
    // Mudança de fase (avalia regras de transição com os valores resultantes).
    if (phase && phase !== current.phase) {
        const evalRes = (0, transitions_1.evaluatePhaseTransition)(def, current.phase || '', phase, mergedValues, { userId, userRole });
        if (!evalRes.allowed) {
            throw new https_1.HttpsError('failed-precondition', evalRes.reason || 'Transição não permitida.');
        }
        if (((_b = (_a = evalRes.rule) === null || _a === void 0 ? void 0 : _a.on_success) === null || _b === void 0 ? void 0 : _b.require_comment) && !String(comment || '').trim()) {
            throw new https_1.HttpsError('failed-precondition', 'Esta mudança exige um comentário.');
        }
        // Aplica set_fields automáticos da regra.
        if ((_e = (_d = (_c = evalRes.rule) === null || _c === void 0 ? void 0 : _c.on_success) === null || _d === void 0 ? void 0 : _d.set_fields) === null || _e === void 0 ? void 0 : _e.length) {
            for (const sf of evalRes.rule.on_success.set_fields) {
                const v = sf.value === 'now' ? new Date().toISOString().slice(0, 10) : sf.value;
                mergedValues[sf.field] = v;
            }
            updates.values = mergedValues;
        }
        updates.phase = phase;
        const fromLabel = ((_f = (def.phases || []).find((p) => p.key === current.phase)) === null || _f === void 0 ? void 0 : _f.label) || current.phase || '—';
        const toLabel = ((_g = (def.phases || []).find((p) => p.key === phase)) === null || _g === void 0 ? void 0 : _g.label) || phase;
        logActions.push(`Fase: ${fromLabel} → ${toLabel}${comment ? ` (${comment})` : ''}`);
    }
    // Mudança de tipo de processo.
    if (record_type !== undefined) {
        const newType = resolveRecordType(def, record_type);
        if (newType !== (current.record_type || null)) {
            updates.record_type = newType;
            const typeLabel = ((_h = (def.record_types || []).find((t) => t.key === newType)) === null || _h === void 0 ? void 0 : _h.label) || (newType || 'sem tipo');
            logActions.push(`Tipo: ${typeLabel}`);
        }
    }
    if (logActions.length === 0) {
        return { success: true, message: 'Nenhuma alteração.' };
    }
    const { logDate, logTime, iso } = nowParts();
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const entry = {
        date: logDate, time: logTime, user_id: userId, user_name: userName,
        action: logActions.join(' · '), timestamp: iso,
    };
    updates.activity_log = admin.firestore.FieldValue.arrayUnion(entry);
    await ref.update(updates);
    await writeHistory(ref, entry);
    return { success: true };
});
const IMPORT_MAX_ROWS = 5000;
const IMPORT_BATCH_SIZE = 400;
exports.importRecords = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, entityTypeId, rows } = request.data || {};
    if (!organizationId || !entityTypeId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Nenhuma linha para importar.');
    }
    if (rows.length > IMPORT_MAX_ROWS) {
        throw new https_1.HttpsError('invalid-argument', `Máximo de ${IMPORT_MAX_ROWS} linhas por importação.`);
    }
    const db = admin.firestore();
    await getMembership(db, userId, organizationId);
    const def = await getEntityType(db, organizationId, entityTypeId);
    const fallbackPhase = initialPhase(def);
    const phaseKeys = new Set((def.phases || []).map((p) => p.key));
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const { logDate, logTime, iso } = nowParts();
    // Valida e normaliza cada linha antes de gravar.
    const valid = [];
    const errorDetails = [];
    rows.forEach((row, i) => {
        const phase = (row === null || row === void 0 ? void 0 : row.phase) && phaseKeys.has(row.phase) ? row.phase : fallbackPhase;
        const requiredPhases = phasesReachedUpTo(def, phase);
        const { ok, errors, normalized } = (0, schema_1.validateRecordValues)(def.fields, (row === null || row === void 0 ? void 0 : row.values) || {}, { requiredPhases });
        if (!ok) {
            errorDetails.push({ row: i + 1, error: Object.values(errors)[0] || 'Dados inválidos.' });
            return;
        }
        valid.push({ values: normalized, phase, record_type: resolveRecordType(def, row === null || row === void 0 ? void 0 : row.record_type) });
    });
    if (valid.length === 0) {
        return { success: false, created: 0, failed: errorDetails.length, total: rows.length, errorDetails: errorDetails.slice(0, 20) };
    }
    // Grava em lotes (Firestore: máx. 500 operações por batch).
    let created = 0;
    for (let i = 0; i < valid.length; i += IMPORT_BATCH_SIZE) {
        const slice = valid.slice(i, i + IMPORT_BATCH_SIZE);
        const batch = db.batch();
        for (const item of slice) {
            const ref = db.collection('customRecords').doc();
            const entry = {
                date: logDate, time: logTime, user_id: userId, user_name: userName,
                action: `${def.label_singular} importado de planilha`, timestamp: iso,
            };
            batch.set(ref, {
                id: ref.id,
                organization_id: organizationId,
                entity_type_id: entityTypeId,
                entity_key: def.key || null,
                values: item.values,
                phase: item.phase,
                record_type: item.record_type,
                created_by: userId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                activity_log: [entry],
                imported: true,
            });
        }
        await batch.commit();
        created += slice.length;
    }
    // Atualiza contador do tipo no doc do órgão (best-effort).
    try {
        await db.collection('organizations').doc(organizationId).update({
            [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(created),
        });
    }
    catch (e) {
        console.error('[importRecords stats inc]', e);
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'IMPORT_RECORDS',
        details: { entity_type_id: entityTypeId, created, failed: errorDetails.length, total: rows.length },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        created,
        failed: errorDetails.length,
        total: rows.length,
        errorDetails: errorDetails.slice(0, 20),
    };
});
exports.deleteRecord = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, recordId } = request.data || {};
    if (!organizationId || !recordId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e recordId são obrigatórios.');
    }
    const db = admin.firestore();
    const membership = await getMembership(db, userId, organizationId);
    const role = String(membership.role || 'member');
    if (role !== 'creator' && role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas Criador ou Administradores podem excluir registros.');
    }
    const ref = db.collection('customRecords').doc(recordId);
    const snap = await ref.get();
    if (!snap.exists)
        return { success: true, message: 'Registro já removido.' };
    const current = snap.data();
    if (current.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Registro não pertence a esta organização.');
    }
    const entityTypeId = current.entity_type_id;
    await ref.delete();
    try {
        await db.collection('organizations').doc(organizationId).update({
            [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(-1),
        });
    }
    catch (e) {
        console.error('[customRecords stats dec]', e);
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: request.auth.token.name || '',
        action: 'DELETE_RECORD',
        details: { entity_type_id: entityTypeId, record_id: recordId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=records.js.map