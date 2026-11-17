"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criarAditivo = exports.CAMPOS_VINCULO = exports.CAMPOS_HERDADOS = void 0;
exports.montarAditivo = montarAditivo;
exports.protegerVinculo = protegerVinculo;
exports.propagarNumero = propagarNumero;
exports.conferirExclusao = conferirExclusao;
// Aditivos de Consultas e Expedientes.
//
// Um aditivo é um registro novo na mesma coleção do original, com o mesmo nº
// do PGEA, os dados de identificação copiados e a tramitação em branco (entra
// em "Pendente"). O original não muda: só ganha uma entrada no histórico e os
// contadores `aditivos_seq` (numeração, nunca diminui) e `aditivos_count`
// (quantos existem). Cada um tem a sua linha do tempo; o vínculo é `aditivo_de`
// (id do original) e `aditivo_numero` (1, 2, ...). Aditivo de aditivo vira
// aditivo do original.
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const status_1 = require("../shared/status");
const normalization_1 = require("../shared/normalization");
const history_1 = require("../shared/history");
const vinculo_1 = require("../shared/vinculo");
const registrosPgea_1 = require("../shared/registrosPgea");
/** Campos de identificação que o aditivo herda de quem o originou. */
exports.CAMPOS_HERDADOS = {
    consultas: ['consultant', 'location', 'matter_category', 'matter_subcategory', 'matter_object', 'access_restriction'],
    expedientes: ['system', 'origin', 'object'],
};
/** Campos do vínculo que só o servidor grava. */
exports.CAMPOS_VINCULO = ['aditivo_de', 'aditivo_numero', 'aditivo_motivo', 'aditivos_seq', 'aditivos_count'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
function entradaLog(uid, nome, action) {
    const now = new Date();
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: uid,
        user_name: nome,
        action,
        timestamp: now.toISOString(),
    };
}
async function espelharHistorico(ref, e) {
    try {
        await ref.collection('history').doc((0, history_1.historyEntryId)(e)).set(Object.assign(Object.assign({}, e), { created_at: firestore_1.FieldValue.serverTimestamp() }));
    }
    catch (err) {
        console.error('[history dual-write] aditivo', ref.path, err);
    }
}
/** Monta o documento do aditivo a partir de quem o originou (sem efeito colateral). */
function montarAditivo(modulo, origem, raiz, o) {
    var _a;
    const cfg = (0, registrosPgea_1.moduloPgea)(modulo);
    const herdados = {};
    for (const c of exports.CAMPOS_HERDADOS[modulo])
        herdados[c] = (_a = origem[c]) !== null && _a !== void 0 ? _a : (c === 'access_restriction' ? false : '');
    const base = Object.assign(Object.assign({ id: o.id, organization_id: o.orgId, [cfg.campoNumero]: raiz[cfg.campoNumero] }, herdados), { entry_date: o.entrada, urgency_request: o.urgente, responsible_user_id: o.responsavelId, responsible_user_name: o.responsavelNome ? (0, normalization_1.formatPersonName)(o.responsavelNome) : null, distribution_date: o.responsavelId ? o.entrada : null, analysis_start_date: null, third_party_referral_date: null, review_submission_date: null, reviewed_date: null, review_return_date: null, archived_date: null, network_folder: '', observations: '', aditivo_de: raiz.id, aditivo_numero: o.numero, aditivo_motivo: o.motivo, created_by: o.uid, activity_log: [o.log] });
    return Object.assign(Object.assign({}, base), { status: (0, status_1.calculateStatus)(base) });
}
exports.criarAditivo = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Entre na sua conta.');
    const d = request.data || {};
    const cfg = (0, registrosPgea_1.moduloPgea)(d.modulo);
    const motivo = String(d.motivo || '').trim();
    const entrada = d.entryDate ? String(d.entryDate) : new Date().toISOString().split('T')[0];
    if (!d.organizationId || !cfg || !d.origemId || typeof d.origemId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Pedido incompleto.');
    }
    if (!motivo)
        throw new https_1.HttpsError('invalid-argument', 'Informe o motivo do aditivo.');
    if (motivo.length > 2000)
        throw new https_1.HttpsError('invalid-argument', 'O motivo passa de 2.000 caracteres.');
    if (!DATA.test(entrada))
        throw new https_1.HttpsError('invalid-argument', 'Data de entrada inválida.');
    const modulo = d.modulo;
    const db = admin.firestore();
    const uid = request.auth.uid;
    const nomeUsuario = request.auth.token.name || 'Usuário desconhecido';
    const vinculo = await db.collection('userOrganizations').doc(`${uid}_${d.organizationId}`).get();
    if (!vinculo.exists || (0, vinculo_1.vinculoBloqueado)(vinculo.data())) {
        throw new https_1.HttpsError('permission-denied', 'Você não faz parte deste órgão.');
    }
    // Responsável escolhido precisa ser membro ativo do órgão.
    let responsavelId = null;
    let responsavelNome = null;
    if (d.responsibleUserId) {
        const m = await db.collection('userOrganizations').doc(`${d.responsibleUserId}_${d.organizationId}`).get();
        if (!m.exists || (0, vinculo_1.vinculoBloqueado)(m.data()))
            throw new https_1.HttpsError('invalid-argument', 'O responsável escolhido não está no órgão.');
        responsavelId = String(d.responsibleUserId);
        responsavelNome = String(m.get('user_name') || '');
    }
    const col = db.collection(cfg.colecao);
    const novoRef = col.doc();
    const res = await db.runTransaction(async (tx) => {
        const origemSnap = await tx.get(col.doc(d.origemId));
        if (!origemSnap.exists || origemSnap.get('organization_id') !== d.organizationId) {
            throw new https_1.HttpsError('not-found', `${cfg.nome === 'consulta' ? 'Consulta' : 'Expediente'} não encontrad${cfg.nome === 'consulta' ? 'a' : 'o'} neste órgão.`);
        }
        const origem = Object.assign({ id: origemSnap.id }, origemSnap.data());
        let raiz = origem;
        let raizRef = origemSnap.ref;
        if (origem.aditivo_de) {
            const raizSnap = await tx.get(col.doc(String(origem.aditivo_de)));
            if (!raizSnap.exists || raizSnap.get('organization_id') !== d.organizationId) {
                throw new https_1.HttpsError('failed-precondition', 'O original deste aditivo não existe mais.');
            }
            raiz = Object.assign({ id: raizSnap.id }, raizSnap.data());
            raizRef = raizSnap.ref;
        }
        const numero = (Number(raiz.aditivos_seq) || 0) + 1;
        const numeroPgea = String(raiz[cfg.campoNumero] || '');
        const logNovo = entradaLog(uid, nomeUsuario, `Aditivo nº ${numero} criado a partir d${cfg.nome === 'consulta' ? 'a consulta' : 'o expediente'} ${numeroPgea}. Motivo: ${motivo}`);
        const logRaiz = entradaLog(uid, nomeUsuario, `Aditivo nº ${numero} criado (tramitação própria, em Pendente)`);
        const doc = montarAditivo(modulo, origem, raiz, {
            id: novoRef.id, orgId: d.organizationId, numero, motivo, entrada, urgente: d.urgencyRequest === true,
            responsavelId, responsavelNome, uid, log: logNovo,
        });
        tx.set(novoRef, Object.assign(Object.assign({}, doc), { created_at: firestore_1.FieldValue.serverTimestamp(), updated_at: firestore_1.FieldValue.serverTimestamp() }));
        // O original fica como está (fase, datas, updated_at): só o vínculo e o histórico.
        tx.update(raizRef, { aditivos_seq: numero, aditivos_count: firestore_1.FieldValue.increment(1), activity_log: firestore_1.FieldValue.arrayUnion(logRaiz) });
        return { numero, numeroPgea, raizRef, logNovo, logRaiz };
    });
    await espelharHistorico(novoRef, res.logNovo);
    await espelharHistorico(res.raizRef, res.logRaiz);
    const stats = modulo === 'consultas'
        ? { 'stats.processes_count': firestore_1.FieldValue.increment(1), 'stats.active_processes': firestore_1.FieldValue.increment(1) }
        : { 'stats.expedientes_count': firestore_1.FieldValue.increment(1), 'stats.active_expedientes': firestore_1.FieldValue.increment(1) };
    await db.collection('organizations').doc(d.organizationId).update(stats).catch((e) => console.error('[aditivo] stats', e));
    await db.collection('auditLogs').add({
        organization_id: d.organizationId,
        user_id: uid,
        user_name: request.auth.token.name || '',
        action: modulo === 'consultas' ? 'CREATE_PROCESS_ADITIVO' : 'CREATE_EXPEDIENTE_ADITIVO',
        details: { id: novoRef.id, aditivo_de: res.raizRef.id, aditivo_numero: res.numero, numero: res.numeroPgea },
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, id: novoRef.id, aditivo_numero: res.numero, aditivo_de: res.raizRef.id };
});
/**
 * Antes de gravar uma edição: tira dos `changes` o que só o servidor grava e,
 * num aditivo, o nº do PGEA (ele acompanha o original).
 */
function protegerVinculo(changes, atual, campoNumero) {
    for (const c of exports.CAMPOS_VINCULO)
        delete changes[c];
    if (atual.aditivo_de)
        delete changes[campoNumero];
}
/** Original mudou de número: os aditivos passam a ter o mesmo, com entrada no histórico. */
async function propagarNumero(colecao, orgId, raizId, campoNumero, novo, uid, nome) {
    const db = admin.firestore();
    const snap = await db.collection(colecao).where('organization_id', '==', orgId).where('aditivo_de', '==', raizId).get();
    if (snap.empty)
        return 0;
    const log = entradaLog(uid, nome, `Nº do PGEA atualizado para ${novo}, acompanhando o original`);
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { [campoNumero]: novo, activity_log: firestore_1.FieldValue.arrayUnion(log), updated_at: firestore_1.FieldValue.serverTimestamp() }));
    await batch.commit();
    await Promise.all(snap.docs.map((d) => espelharHistorico(d.ref, log)));
    return snap.size;
}
/**
 * Antes de excluir: original com aditivos não sai (os aditivos ficariam sem
 * original). Devolve o que fazer depois da exclusão de um aditivo.
 */
async function conferirExclusao(colecao, orgId, id, dados) {
    const db = admin.firestore();
    if (!dados.aditivo_de) {
        const filhos = await db.collection(colecao).where('organization_id', '==', orgId).where('aditivo_de', '==', id).limit(1).get();
        if (!filhos.empty) {
            throw new https_1.HttpsError('failed-precondition', 'Este procedimento tem aditivos. Exclua os aditivos antes de excluir o original.');
        }
        return null;
    }
    return async (uid, nome) => {
        const raizRef = db.collection(colecao).doc(String(dados.aditivo_de));
        const log = entradaLog(uid, nome, `Aditivo nº ${dados.aditivo_numero} excluído`);
        try {
            await raizRef.update({ aditivos_count: firestore_1.FieldValue.increment(-1), activity_log: firestore_1.FieldValue.arrayUnion(log) });
            await espelharHistorico(raizRef, log);
        }
        catch (e) {
            console.error('[aditivo] exclusão: original não atualizado', raizRef.path, e);
        }
    };
}
//# sourceMappingURL=aditivos.js.map