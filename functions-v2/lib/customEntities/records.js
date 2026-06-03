"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRecord = exports.updateRecord = exports.createRecord = void 0;
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
    const { organizationId, entityTypeId, values, phase } = request.data || {};
    if (!organizationId || !entityTypeId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
    }
    const db = admin.firestore();
    await getMembership(db, userId, organizationId);
    const def = await getEntityType(db, organizationId, entityTypeId);
    const { ok, errors, normalized } = (0, schema_1.validateRecordValues)(def.fields, values || {});
    if (!ok) {
        throw new https_1.HttpsError('invalid-argument', Object.values(errors)[0] || 'Dados inválidos.', { errors });
    }
    let targetPhase = initialPhase(def);
    if (phase && (def.phases || []).some((p) => p.key === phase)) {
        targetPhase = phase;
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
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Autenticação necessária.');
    const userId = request.auth.uid;
    const { organizationId, recordId, values, phase, comment } = request.data || {};
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