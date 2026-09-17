"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manageJurimetriaTemplate = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
/**
 * Modelos de relatório dinâmico, compartilhados dentro do órgão.
 *
 * Antes eles viviam no `localStorage` de cada navegador, como no aplicativo de
 * origem — o que significava que o cruzamento que alguém levou uma tarde para
 * desenhar morria com o cache do navegador e não chegava a mais ninguém.
 *
 * Agora vivem no Firestore, com uma regra simples de autoria: qualquer membro
 * do órgão usa qualquer modelo; só quem criou — ou quem administra o órgão —
 * edita ou exclui. A checagem é feita aqui, no servidor, porque as regras do
 * Firestore bloqueiam toda escrita direta do cliente nesta coleção.
 */
const MAX_TEMPLATES_POR_ORGAO = 300;
const TIPOS = new Set(['pivot', 'descritivo']);
/**
 * A configuração é opaca para o servidor — quem a interpreta é a engine no
 * cliente, e ela muda a cada evolução do módulo. O que o servidor garante é
 * que não vira um depósito: JSON válido, com teto de tamanho e profundidade.
 */
function sanitizeConfig(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new https_1.HttpsError('invalid-argument', 'Configuração do modelo inválida');
    }
    let serialized;
    try {
        serialized = JSON.stringify(input);
    }
    catch (_a) {
        throw new https_1.HttpsError('invalid-argument', 'Configuração do modelo não é serializável');
    }
    if (serialized.length > 20000) {
        throw new https_1.HttpsError('invalid-argument', 'Configuração do modelo excede o tamanho permitido');
    }
    // Reserializa a partir do texto: derruba undefined, funções e protótipos
    // exóticos que por acaso tenham chegado.
    return JSON.parse(serialized);
}
/** Vínculo do usuário com o órgão + se ele administra (criador ou delegado). */
async function loadMembership(db, userId, organizationId) {
    const snap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!snap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const data = snap.data() || {};
    const isCreator = data.role === 'creator';
    const permissions = (data.permissions && typeof data.permissions === 'object')
        ? data.permissions
        : {};
    return {
        data,
        // "Administra o módulo" é a mesma permissão que configura a Jurimetria:
        // quem pode mudar as listas oficiais do órgão pode faxinar os modelos.
        isAdmin: isCreator || permissions.configure_jurimetria === true,
        userName: String(data.user_name || '') || 'Usuário desconhecido',
    };
}
exports.manageJurimetriaTemplate = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b;
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
    const collection = db.collection('jurimetriaTemplates');
    // ---- Exclusão -------------------------------------------------------
    if (action === 'delete') {
        if (!id)
            throw new https_1.HttpsError('invalid-argument', 'id é obrigatório');
        const snap = await collection.doc(id).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        const modelo = snap.data() || {};
        // IDOR: um id de outro órgão não pode ser apagado daqui.
        if (modelo.organization_id !== organizationId) {
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        }
        if (modelo.created_by !== userId && !membership.isAdmin) {
            throw new https_1.HttpsError('permission-denied', 'Somente quem criou o modelo ou um administrador do órgão pode excluí-lo');
        }
        await snap.ref.delete();
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'DELETE_JURIMETRIA_TEMPLATE',
            details: { id, nome: modelo.nome || '', tipo: modelo.tipo || '' },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, id };
    }
    // ---- Criação e edição ----------------------------------------------
    const nome = String((_a = payload.nome) !== null && _a !== void 0 ? _a : '').trim().slice(0, 120);
    if (!nome)
        throw new https_1.HttpsError('invalid-argument', 'Informe um nome para o modelo');
    const tipo = String((_b = payload.tipo) !== null && _b !== void 0 ? _b : '');
    if (!TIPOS.has(tipo)) {
        throw new https_1.HttpsError('invalid-argument', 'Tipo de modelo inválido');
    }
    const config = sanitizeConfig(payload.config);
    if (action === 'update') {
        if (!id)
            throw new https_1.HttpsError('invalid-argument', 'id é obrigatório');
        const snap = await collection.doc(id).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        const modelo = snap.data() || {};
        if (modelo.organization_id !== organizationId) {
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        }
        if (modelo.created_by !== userId && !membership.isAdmin) {
            throw new https_1.HttpsError('permission-denied', 'Somente quem criou o modelo ou um administrador do órgão pode editá-lo');
        }
        // O tipo é a identidade do modelo: uma tabela dinâmica não vira um
        // descritivo no meio do caminho.
        if (modelo.tipo !== tipo) {
            throw new https_1.HttpsError('invalid-argument', 'O tipo do modelo não pode ser alterado');
        }
        await snap.ref.update({
            nome,
            config,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            updated_by_name: userName,
        });
        return { success: true, id };
    }
    if (action !== 'create') {
        throw new https_1.HttpsError('invalid-argument', 'Ação inválida');
    }
    const existentes = await collection
        .where('organization_id', '==', organizationId)
        .count()
        .get();
    if (existentes.data().count >= MAX_TEMPLATES_POR_ORGAO) {
        throw new https_1.HttpsError('resource-exhausted', `Este órgão já tem ${MAX_TEMPLATES_POR_ORGAO} modelos salvos. Exclua algum antes de criar outro.`);
    }
    const doc = await collection.add({
        organization_id: organizationId,
        nome,
        tipo,
        config,
        created_by: userId,
        created_by_name: userName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
        updated_by_name: userName,
    });
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'CREATE_JURIMETRIA_TEMPLATE',
        details: { id: doc.id, nome, tipo },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, id: doc.id };
});
//# sourceMappingURL=manage.js.map