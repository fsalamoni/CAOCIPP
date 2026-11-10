"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lerOrgaos = lerOrgaos;
exports.salvarOrgao = salvarOrgao;
exports.removerOrgao = removerOrgao;
exports.criarEstrutura = criarEstrutura;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const orgaos_1 = require("../shared/orgaos");
const context_1 = require("./context");
const MAX_UNIDADES = 100;
const novoId = () => `org_${(0, crypto_1.randomBytes)(6).toString('hex')}`;
async function lerOrgaos(db, orgId, tx) {
    var _a;
    const ref = db.collection(context_1.COL.config).doc(orgId);
    return (0, orgaos_1.orgaosDe)((_a = (tx ? await tx.get(ref) : await ref.get()).data()) === null || _a === void 0 ? void 0 : _a.orgaos);
}
async function exigirMembro(c, uid) {
    var _a;
    if (!uid)
        return;
    const s = await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get();
    if (!s.exists || ((_a = s.data()) === null || _a === void 0 ? void 0 : _a.active) === false)
        throw new https_1.HttpsError('invalid-argument', 'O titular precisa ser membro ativo');
}
/** Regrava a lista de órgãos dentro de uma transação, validando a estrutura inteira. */
async function mudar(c, uid, fn) {
    const ref = c.db.collection(context_1.COL.config).doc(c.orgId);
    return c.db.runTransaction(async (tx) => {
        var _a;
        let lista = [];
        try {
            lista = (0, orgaos_1.validarEstrutura)(fn((0, orgaos_1.orgaosDe)((_a = (await tx.get(ref)).data()) === null || _a === void 0 ? void 0 : _a.orgaos)));
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        tx.set(ref, { organization_id: c.orgId, orgaos: lista, updated_at: firestore_1.FieldValue.serverTimestamp(), updated_by: uid }, { merge: true });
        return lista;
    });
}
async function salvarOrgao(c, p, uid, auditar) {
    (0, context_1.exigirAdmin)(c);
    const id = p.id ? String(p.id) : novoId();
    let orgao;
    try {
        orgao = (0, orgaos_1.sanitizeOrgao)(p.orgao, id);
    }
    catch (e) {
        (0, context_1.erroUsuario)(e);
    }
    await exigirMembro(c, orgao.titular_uid);
    await mudar(c, uid, (atuais) => {
        const i = atuais.findIndex((o) => o.id === id);
        if (p.id && i < 0)
            throw new https_1.HttpsError('not-found', 'Órgão não encontrado');
        if (i < 0)
            return [...atuais, Object.assign(Object.assign({}, orgao), { ordem: atuais.length })];
        return atuais.map((o) => (o.id === id ? orgao : o));
    });
    await auditar('SECRETARIA_ORGAO_SALVO', { orgao_id: id, nome: orgao.nome, superior: orgao.pai_id });
    return { success: true, id };
}
/** Só remove órgão vazio: sem subordinados e sem unidades (nada se perde). */
async function removerOrgao(c, p, uid, auditar) {
    (0, context_1.exigirAdmin)(c);
    const id = String(p.id || '');
    const comUnidades = c.unidades.filter((u) => u.orgao_id === id).length;
    if (comUnidades)
        throw new https_1.HttpsError('failed-precondition', `Este órgão tem ${comUnidades} unidade(s). Mova-as para outro órgão antes de removê-lo, ou apenas desative-o.`);
    let nome = '';
    await mudar(c, uid, (atuais) => {
        const alvo = atuais.find((o) => o.id === id);
        if (!alvo)
            throw new https_1.HttpsError('not-found', 'Órgão não encontrado');
        if (atuais.some((o) => o.pai_id === id))
            throw new https_1.HttpsError('failed-precondition', 'Este órgão tem órgãos subordinados. Mova-os ou remova-os antes.');
        nome = alvo.nome;
        return atuais.filter((o) => o.id !== id);
    });
    await auditar('SECRETARIA_ORGAO_REMOVIDO', { orgao_id: id, nome });
    return { success: true };
}
/** Assistente: cria de uma vez vários órgãos (somados aos que existem) e as unidades de cada um. */
async function criarEstrutura(c, p, uid, auditar) {
    (0, context_1.exigirAdmin)(c);
    let proposta = [];
    try {
        proposta = (0, orgaos_1.sanitizeProposta)(p.orgaos);
    }
    catch (e) {
        (0, context_1.erroUsuario)(e);
    }
    const ids = new Map(proposta.map((o) => [o.chave, novoId()]));
    const totalUnidades = proposta.reduce((n, o) => n + o.unidades.length, 0);
    if (c.unidades.length + totalUnidades > MAX_UNIDADES)
        throw new https_1.HttpsError('resource-exhausted', 'Limite de unidades atingido');
    let criados = [];
    await mudar(c, uid, (atuais) => {
        criados = proposta.map((o, i) => {
            // O superior pode ser outro órgão da proposta (pela chave) ou um já existente (pelo id).
            const pai = o.pai_chave ? ids.get(o.pai_chave) || (atuais.some((a) => a.id === o.pai_chave) ? o.pai_chave : null) : null;
            if (o.pai_chave && !pai)
                throw new Error(`O órgão superior de "${String(o.orgao.nome || '')}" não existe`);
            return Object.assign(Object.assign({}, (0, orgaos_1.sanitizeOrgao)(Object.assign(Object.assign({}, o.orgao), { titular_uid: null, pai_id: pai }), ids.get(o.chave))), { ordem: atuais.length + i });
        });
        return [...atuais, ...criados];
    });
    const agora = firestore_1.FieldValue.serverTimestamp();
    const lote = c.db.batch();
    for (const o of proposta) {
        for (const u of o.unidades) {
            lote.set(c.db.collection(context_1.COL.unidades).doc(), {
                organization_id: c.orgId, nome: u.nome, sigla: u.sigla, tipo: u.tipo, descricao: '', orgao_id: ids.get(o.chave), competencias: [],
                ativa: true, lotacoes: [], membros_uids: [], pedidos: [], created_at: agora, created_by: uid,
            });
        }
    }
    if (totalUnidades)
        await lote.commit();
    await auditar('SECRETARIA_ESTRUTURA_CRIADA', { orgaos: criados.map((o) => o.nome), unidades: totalUnidades });
    return { success: true, orgaos: criados.length, unidades: totalUnidades };
}
//# sourceMappingURL=orgaos.js.map