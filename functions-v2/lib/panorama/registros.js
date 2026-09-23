"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.managePanoramaRegistro = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const panorama_1 = require("../shared/panorama");
/**
 * Registros de uma base do Panorama.
 *
 * Diferente da Jurimetria, aqui NENHUM campo é fixo: tudo o que o usuário
 * preenche vive em `values`, chaveado pelas colunas que a base define. O que
 * fica na raiz do documento é só o que o servidor precisa para consultar —
 * órgão, base e a chave natural normalizada.
 */
const MAX_BULK = 500;
const BATCH_SIZE = 200;
async function loadMembership(db, userId, organizationId) {
    const snap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!snap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const data = snap.data() || {};
    const permissions = (data.permissions && typeof data.permissions === 'object')
        ? data.permissions
        : {};
    return {
        canDelete: data.role === 'creator' || permissions.delete_records === true,
        userName: String(data.user_name || '') || 'Usuário desconhecido',
    };
}
/** Carrega a base e confere que ela pertence ao órgão da requisição. */
async function loadBase(db, organizationId, baseId) {
    const snap = await db.collection('panoramaBases').doc(baseId).get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Base não encontrada');
    const data = snap.data() || {};
    if (data.organization_id !== organizationId) {
        throw new https_1.HttpsError('not-found', 'Base não encontrada');
    }
    return (0, panorama_1.sanitizeBaseDef)(data);
}
/**
 * Chave natural do registro, quando a base tem uma coluna de identificador.
 *
 * Sem identificador a base ainda funciona — só perde a proteção contra
 * duplicata na reimportação, e a interface avisa isso.
 */
function chaveDe(values, def) {
    const col = (0, panorama_1.columnForRole)(def, 'identificador');
    if (!col)
        return '';
    return (0, panorama_1.normalizeIdentifier)(values[col.key]);
}
exports.managePanoramaRegistro = (0, https_1.onCall)({ region: 'southamerica-east1', timeoutSeconds: 300 }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const payload = request.data || {};
    const { organizationId, baseId, action = 'create' } = payload;
    if (!organizationId)
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    if (!baseId)
        throw new https_1.HttpsError('invalid-argument', 'baseId é obrigatório');
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membership = await loadMembership(db, userId, organizationId);
    const userName = request.auth.token.name || membership.userName;
    const def = await loadBase(db, organizationId, baseId);
    const collection = db.collection('panoramaRegistros');
    const now = new Date();
    const logEntry = (acao) => ({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: userId,
        user_name: userName,
        action: acao,
        timestamp: now.toISOString(),
    });
    // ---- Exclusão (individual ou em massa) -----------------------------
    if (action === 'delete') {
        if (!membership.canDelete) {
            throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Excluir registros" para excluir');
        }
        const alvos = ((_a = payload.ids) === null || _a === void 0 ? void 0 : _a.length)
            ? payload.ids
            : (payload.id ? [payload.id] : []);
        if (alvos.length === 0)
            throw new https_1.HttpsError('invalid-argument', 'Informe o registro a excluir');
        if (alvos.length > MAX_BULK) {
            throw new https_1.HttpsError('invalid-argument', `Máximo de ${MAX_BULK} registros por vez`);
        }
        let excluidos = 0;
        let ignorados = 0;
        for (let i = 0; i < alvos.length; i += BATCH_SIZE) {
            const chunk = alvos.slice(i, i + BATCH_SIZE);
            const refs = chunk.map((rid) => collection.doc(rid));
            const snaps = await db.getAll(...refs);
            const batch = db.batch();
            let n = 0;
            snaps.forEach((snap) => {
                const data = snap.data();
                // IDOR: ignora silenciosamente o que não é deste órgão/base.
                if (!snap.exists || (data === null || data === void 0 ? void 0 : data.organization_id) !== organizationId
                    || (data === null || data === void 0 ? void 0 : data.base_id) !== baseId) {
                    ignorados += 1;
                    return;
                }
                batch.delete(snap.ref);
                n += 1;
                excluidos += 1;
            });
            if (n > 0)
                await batch.commit();
        }
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'DELETE_PANORAMA_REGISTRO',
            details: { base_id: baseId, excluidos, ignorados },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, excluidos, ignorados };
    }
    // ---- Edição em massa ------------------------------------------------
    if (action === 'bulkUpdate') {
        const alvos = payload.ids || [];
        if (alvos.length === 0)
            throw new https_1.HttpsError('invalid-argument', 'Nenhum registro selecionado');
        if (alvos.length > MAX_BULK) {
            throw new https_1.HttpsError('invalid-argument', `Máximo de ${MAX_BULK} registros por vez`);
        }
        const patch = (0, panorama_1.sanitizeRecordValues)(payload.values, def);
        const chaves = Object.keys(patch);
        if (chaves.length === 0) {
            throw new https_1.HttpsError('invalid-argument', 'Nenhum campo válido foi informado');
        }
        // Alterar o identificador em massa colocaria a mesma chave natural
        // em todos os selecionados — é a receita para um conjunto de
        // duplicatas que a próxima importação não consegue desfazer.
        const colId = (0, panorama_1.columnForRole)(def, 'identificador');
        if (colId && chaves.includes(colId.key)) {
            throw new https_1.HttpsError('invalid-argument', 'O identificador não pode ser alterado em massa: ele é a chave de cada registro');
        }
        const rotulos = chaves.map((k) => { var _a; return ((_a = def.columns.find((c) => c.key === k)) === null || _a === void 0 ? void 0 : _a.label) || k; });
        const entry = logEntry(`Atualização em massa — ${rotulos.join(', ')}`);
        let atualizados = 0;
        let ignorados = 0;
        for (let i = 0; i < alvos.length; i += BATCH_SIZE) {
            const chunk = alvos.slice(i, i + BATCH_SIZE);
            const snaps = await db.getAll(...chunk.map((rid) => collection.doc(rid)));
            const batch = db.batch();
            let n = 0;
            snaps.forEach((snap) => {
                const data = snap.data();
                if (!snap.exists || (data === null || data === void 0 ? void 0 : data.organization_id) !== organizationId
                    || (data === null || data === void 0 ? void 0 : data.base_id) !== baseId) {
                    ignorados += 1;
                    return;
                }
                batch.update(snap.ref, {
                    values: Object.assign(Object.assign({}, (data.values || {})), patch),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                    activity_log: admin.firestore.FieldValue.arrayUnion(entry),
                });
                n += 1;
                atualizados += 1;
            });
            if (n > 0)
                await batch.commit();
        }
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'BULK_UPDATE_PANORAMA_REGISTRO',
            details: { base_id: baseId, atualizados, ignorados, campos: rotulos },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, atualizados, ignorados };
    }
    // ---- Criação e edição individual ------------------------------------
    const values = (0, panorama_1.sanitizeRecordValues)(payload.values, def);
    if (action === 'update') {
        const { id } = payload;
        if (!id)
            throw new https_1.HttpsError('invalid-argument', 'id é obrigatório');
        const snap = await collection.doc(id).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Registro não encontrado');
        const atual = snap.data() || {};
        if (atual.organization_id !== organizationId || atual.base_id !== baseId) {
            throw new https_1.HttpsError('not-found', 'Registro não encontrado');
        }
        const merged = Object.assign(Object.assign({}, (atual.values || {})), values);
        const novaChave = chaveDe(merged, def);
        // Trocar o identificador para um que já existe uniria dois registros
        // distintos sob a mesma chave, e a próxima importação atualizaria o
        // errado.
        if (novaChave && novaChave !== atual.chave_norm) {
            const conflito = await collection
                .where('organization_id', '==', organizationId)
                .where('base_id', '==', baseId)
                .where('chave_norm', '==', novaChave)
                .limit(1)
                .get();
            if (!conflito.empty && conflito.docs[0].id !== id) {
                throw new https_1.HttpsError('already-exists', 'Já existe um registro nesta base com esse identificador');
            }
        }
        const alterados = Object.keys(values).filter((k) => { var _a, _b, _c; return String((_b = (_a = atual.values) === null || _a === void 0 ? void 0 : _a[k]) !== null && _b !== void 0 ? _b : '') !== String((_c = values[k]) !== null && _c !== void 0 ? _c : ''); });
        if (alterados.length === 0) {
            return { success: true, id, semAlteracao: true };
        }
        const rotulos = alterados.map((k) => { var _a; return ((_a = def.columns.find((c) => c.key === k)) === null || _a === void 0 ? void 0 : _a.label) || k; });
        await snap.ref.update({
            values: merged,
            chave_norm: novaChave,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            activity_log: admin.firestore.FieldValue.arrayUnion(logEntry(`Campos atualizados: ${rotulos.join(', ')}`)),
        });
        return { success: true, id };
    }
    if (action !== 'create') {
        throw new https_1.HttpsError('invalid-argument', 'Ação inválida');
    }
    const chave = chaveDe(values, def);
    const colId = (0, panorama_1.columnForRole)(def, 'identificador');
    if (colId && !chave) {
        throw new https_1.HttpsError('invalid-argument', `O campo "${colId.label}" é o identificador desta base e é obrigatório`);
    }
    if (chave) {
        const duplicado = await collection
            .where('organization_id', '==', organizationId)
            .where('base_id', '==', baseId)
            .where('chave_norm', '==', chave)
            .limit(1)
            .get();
        if (!duplicado.empty) {
            throw new https_1.HttpsError('already-exists', 'Já existe um registro nesta base com esse identificador');
        }
    }
    const doc = await collection.add({
        organization_id: organizationId,
        base_id: baseId,
        chave_norm: chave,
        values,
        source: 'manual',
        created_by: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
        activity_log: [logEntry('Registro cadastrado manualmente')],
    });
    return { success: true, id: doc.id };
});
//# sourceMappingURL=registros.js.map