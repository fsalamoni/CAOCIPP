"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COL = exports.REGION = void 0;
exports.exigirAuth = exigirAuth;
exports.carregarContexto = carregarContexto;
exports.exigirAdmin = exigirAdmin;
exports.lerProcesso = lerProcesso;
exports.exigirPosse = exigirPosse;
exports.conferirVersao = conferirVersao;
exports.registrarMovimento = registrarMovimento;
exports.nomeUnidade = nomeUnidade;
exports.erroUsuario = erroUsuario;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
exports.REGION = 'southamerica-east1';
exports.COL = {
    processos: 'secProcessos',
    unidades: 'secUnidades',
    ritos: 'secRitos',
    contadores: 'secContadores',
    convites: 'secConvites',
    tipos: 'secTipos',
    config: 'secConfig',
    modelos: 'secModelos',
};
function exigirAuth(request) {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'É preciso estar autenticado');
    return request.auth;
}
/**
 * Carrega quem é o usuário dentro da Secretaria do órgão. Exige vínculo com o
 * órgão e, salvo `permitirInativa`, a Secretaria ligada pelo admin do órgão.
 */
async function carregarContexto(auth, orgId, opts = {}) {
    var _a, _b, _c;
    if (typeof orgId !== 'string' || !orgId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    }
    const db = admin.firestore();
    const [memSnap, orgSnap, unSnap] = await Promise.all([
        db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`).get(),
        db.collection('organizations').doc(orgId).get(),
        // ponytail: lê todas as unidades do órgão e filtra em memória (dezenas,
        // não milhares); trocar por um índice de lotação se passar de centenas.
        db.collection(exports.COL.unidades).where('organization_id', '==', orgId).get(),
    ]);
    if (!memSnap.exists || !orgSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const mem = memSnap.data() || {};
    const org = orgSnap.data() || {};
    const isAdmin = mem.role === 'creator' || ((_a = mem.permissions) === null || _a === void 0 ? void 0 : _a.configure_secretaria) === true;
    if (!opts.permitirInativa && ((_b = org.secretariaConfig) === null || _b === void 0 ? void 0 : _b.enabled) !== true) {
        throw new https_1.HttpsError('failed-precondition', 'A Secretaria Processual não está ativa neste órgão');
    }
    if (!opts.permitirInativa && ((_c = org.secretariaConfig) === null || _c === void 0 ? void 0 : _c.suspensa_plataforma) === true) {
        throw new https_1.HttpsError('failed-precondition', 'A Secretaria Processual deste órgão está suspensa pela administração da plataforma');
    }
    const unidades = unSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const unidadeIds = unidades
        .filter((u) => u.ativa !== false && Array.isArray(u.membros_uids) && u.membros_uids.includes(auth.uid))
        .map((u) => u.id);
    return {
        db,
        orgId,
        org,
        ctx: { uid: auth.uid, isAdmin, unidadeIds },
        userName: String(auth.token.name || mem.user_name || mem.user_email || 'Usuário'),
        unidades,
    };
}
function exigirAdmin(c) {
    if (!c.ctx.isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Configurar Secretaria Processual"');
    }
}
/** Lê o processo garantindo que é do órgão (sem vazar existência de outro). */
async function lerProcesso(c, id, tx) {
    if (typeof id !== 'string' || !id)
        throw new https_1.HttpsError('invalid-argument', 'processoId é obrigatório');
    const ref = c.db.collection(exports.COL.processos).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const data = snap.data();
    if (!snap.exists || !data || data.organization_id !== c.orgId || !(0, secretaria_1.podeVer)(data, c.ctx)) {
        throw new https_1.HttpsError('not-found', 'Processo não encontrado');
    }
    return { ref, data };
}
function exigirPosse(c, proc) {
    if (!(0, secretaria_1.podeAgir)(proc, c.ctx)) {
        throw new https_1.HttpsError('permission-denied', 'O processo não está com uma unidade em que você esteja lotado');
    }
}
function conferirVersao(proc, esperada) {
    if (typeof esperada === 'number' && esperada !== proc.version) {
        throw new https_1.HttpsError('aborted', 'O processo foi movimentado por outra pessoa. Recarregue e tente de novo.');
    }
}
/**
 * Grava um movimento encadeado. Deve rodar DENTRO da transação que leu o
 * processo; devolve os campos a gravar no processo junto.
 */
function registrarMovimento(tx, c, procRef, proc, tipo, descricao, dados = {}) {
    const seq = (Number(proc.mov_seq) || 0) + 1;
    const base = {
        seq,
        tipo,
        descricao,
        autor_uid: c.ctx.uid,
        autor_nome: c.userName,
        unidade_id: String(proc.unidade_atual || ''),
        em: new Date().toISOString(),
        dados,
        hash_anterior: String(proc.ultimo_hash || ''),
    };
    const hash = (0, secretaria_1.hashMovimento)(base);
    tx.set(procRef.collection('movimentos').doc(String(seq).padStart(6, '0')), Object.assign(Object.assign({}, base), { hash }));
    return {
        mov_seq: seq,
        ultimo_hash: hash,
        version: (Number(proc.version) || 0) + 1,
        updated_at: firestore_1.FieldValue.serverTimestamp(),
        ultimo_movimento: { tipo, descricao, em: base.em },
    };
}
function nomeUnidade(c, id) {
    const u = c.unidades.find((x) => x.id === id);
    return u ? String(u.nome) : id;
}
function erroUsuario(e) {
    if (e instanceof https_1.HttpsError)
        throw e;
    throw new https_1.HttpsError('invalid-argument', e instanceof Error ? e.message : 'Dados inválidos');
}
//# sourceMappingURL=context.js.map