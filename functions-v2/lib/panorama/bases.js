"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.managePanoramaBase = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const panorama_1 = require("../shared/panorama");
/**
 * Bases analíticas do módulo Panorama.
 *
 * Uma "base" é um conjunto de registros com um esquema próprio: o CAO de
 * Patrimônio Público pode ter uma base de improbidade e outra de contratos,
 * com colunas inteiramente diferentes, sem que uma interfira na outra.
 *
 * A definição da base (colunas, papéis, desfechos, regiões, prescrição) vive
 * aqui; os registros vivem em `panoramaRegistros`, apontando para a base.
 */
const MAX_BASES_POR_ORGAO = 40;
/** Vínculo com o órgão + se pode CONFIGURAR o módulo. */
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
        isCreator: data.role === 'creator',
        canConfigure: data.role === 'creator' || permissions.configure_panorama === true,
        canDelete: data.role === 'creator' || permissions.delete_records === true,
        userName: String(data.user_name || '') || 'Usuário desconhecido',
    };
}
exports.managePanoramaBase = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const payload = request.data || {};
    const { organizationId, action = 'create', id } = payload;
    if (!organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membership = await loadMembership(db, userId, organizationId);
    const userName = request.auth.token.name || membership.userName;
    const collection = db.collection('panoramaBases');
    // Criar e configurar uma base muda o significado de todos os números do
    // órgão — é ato de administração do módulo, não de uso.
    if (!membership.canConfigure) {
        throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Configurar Panorama" para gerenciar bases');
    }
    // ---- Exclusão ------------------------------------------------------
    if (action === 'delete') {
        if (!id)
            throw new https_1.HttpsError('invalid-argument', 'id é obrigatório');
        if (!membership.canDelete) {
            throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Excluir registros" para excluir uma base');
        }
        const snap = await collection.doc(id).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        const base = snap.data() || {};
        // IDOR: um id de outro órgão não pode ser apagado daqui.
        if (base.organization_id !== organizationId) {
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        }
        // Excluir a base apaga TODOS os registros dela. Exigir o nome
        // digitado é a mesma proteção que a plataforma usa para excluir um
        // órgão: um clique sozinho não deve poder destruir uma base inteira.
        const nomeGravado = String(base.nome || '');
        if (String(payload.confirmName || '').trim() !== nomeGravado) {
            throw new https_1.HttpsError('failed-precondition', 'Digite o nome exato da base para confirmar a exclusão');
        }
        // Apaga os registros em lotes antes da base, para não deixar
        // registros órfãos apontando para uma base que não existe mais.
        let apagados = 0;
        for (;;) {
            const lote = await db.collection('panoramaRegistros')
                .where('organization_id', '==', organizationId)
                .where('base_id', '==', id)
                .limit(400)
                .get();
            if (lote.empty)
                break;
            const batch = db.batch();
            lote.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            apagados += lote.size;
            if (lote.size < 400)
                break;
        }
        await snap.ref.delete();
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'DELETE_PANORAMA_BASE',
            details: { id, nome: nomeGravado, registros_excluidos: apagados },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, id, registrosExcluidos: apagados };
    }
    // ---- Criação e edição ----------------------------------------------
    const def = (0, panorama_1.sanitizeBaseDef)(payload.def);
    if (!def.nome)
        throw new https_1.HttpsError('invalid-argument', 'Informe um nome para a base');
    const now = new Date();
    const logEntry = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: userId,
        user_name: userName,
        timestamp: now.toISOString(),
    };
    if (action === 'update') {
        if (!id)
            throw new https_1.HttpsError('invalid-argument', 'id é obrigatório');
        const snap = await collection.doc(id).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        const atual = snap.data() || {};
        if (atual.organization_id !== organizationId) {
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        }
        // As CHAVES de coluna são a ligação com os dados já gravados.
        // Renomear rótulo é livre; remover uma chave que ainda tem dado
        // gravado apenas a esconde — o valor continua no registro e volta a
        // aparecer se a coluna for recriada com a mesma chave.
        await snap.ref.update(Object.assign(Object.assign({}, def), { updated_at: admin.firestore.FieldValue.serverTimestamp(), updated_by: userId, updated_by_name: userName, activity_log: admin.firestore.FieldValue.arrayUnion(Object.assign(Object.assign({}, logEntry), { action: `Configuração da base atualizada (${def.columns.length} coluna(s))` })) }));
        return { success: true, id };
    }
    if (action !== 'create') {
        throw new https_1.HttpsError('invalid-argument', 'Ação inválida');
    }
    const existentes = await collection
        .where('organization_id', '==', organizationId)
        .count()
        .get();
    if (existentes.data().count >= MAX_BASES_POR_ORGAO) {
        throw new https_1.HttpsError('resource-exhausted', `Este órgão já tem ${MAX_BASES_POR_ORGAO} bases. Exclua alguma antes de criar outra.`);
    }
    const doc = await collection.add(Object.assign(Object.assign({ organization_id: organizationId }, def), { created_by: userId, created_by_name: userName, created_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp(), updated_by: userId, updated_by_name: userName, activity_log: [Object.assign(Object.assign({}, logEntry), { action: 'Base criada' })] }));
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'CREATE_PANORAMA_BASE',
        details: { id: doc.id, nome: def.nome, colunas: def.columns.length },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, id: doc.id };
});
//# sourceMappingURL=bases.js.map