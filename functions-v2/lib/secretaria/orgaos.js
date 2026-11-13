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
async function exigirMembro(c, uid, papel = 'O titular') {
    var _a;
    if (!uid)
        return;
    const s = await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get();
    if (!s.exists || ((_a = s.data()) === null || _a === void 0 ? void 0 : _a.active) === false)
        throw new https_1.HttpsError('invalid-argument', `${papel} precisa ser membro ativo`);
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
/**
 * Cria ou edita um órgão interno. O admin da entidade mexe em tudo; o admin
 * delegado, só no que administra (conferirDelegado, dentro da transação).
 */
async function salvarOrgao(c, p, uid, auditar) {
    if (!c.ctx.isAdmin && !(c.adminOrgaos || []).length)
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
    for (const a of orgao.admins_uids)
        await exigirMembro(c, a, 'Quem administra o órgão');
    await mudar(c, uid, (atuais) => {
        const i = atuais.findIndex((o) => o.id === id);
        if (p.id && i < 0)
            throw new https_1.HttpsError('not-found', 'Órgão não encontrado');
        if (!c.ctx.isAdmin)
            (0, orgaos_1.conferirDelegado)(atuais, uid, orgao);
        if (i < 0)
            return [...atuais, Object.assign(Object.assign({}, orgao), { ordem: atuais.length, criado_por: uid })];
        return atuais.map((o) => (o.id === id ? Object.assign(Object.assign({}, orgao), { criado_por: o.criado_por || null }) : o));
    });
    await auditar('SECRETARIA_ORGAO_SALVO', { orgao_id: id, nome: orgao.nome, superior: orgao.pai_id, admins: orgao.admins_uids.length });
    return { success: true, id };
}
/**
 * Exclui o órgão interno. O que estava nele (unidades, órgãos subordinados,
 * tipos de processo e modelos) passa para `destino`: outro órgão ou, vazio,
 * direto na entidade. Nada se apaga e os processos seguem nas mesmas unidades.
 * O admin exclui qualquer órgão; quem o criou, só o vazio; o admin delegado,
 * os que ficam abaixo do órgão que lhe foi delegado, levando o conteúdo para
 * outro órgão que administra.
 */
async function removerOrgao(c, p, uid, auditar) {
    const id = String(p.id || '');
    const destino = p.destino ? String(p.destino) : null;
    const unidades = c.unidades.filter((u) => u.orgao_id === id);
    let nome = '';
    let subordinados = 0;
    await mudar(c, uid, (atuais) => {
        const alvo = atuais.find((o) => o.id === id);
        if (!alvo)
            throw new https_1.HttpsError('not-found', 'Órgão não encontrado');
        const meus = c.ctx.isAdmin ? [] : (0, orgaos_1.orgaosAdministrados)(atuais, uid);
        // Delegado: o órgão fica abaixo de um que ele administra, e o conteúdo vai para outro que administra.
        const delegado = !!alvo.pai_id && meus.includes(alvo.pai_id);
        if (delegado && !(destino && meus.includes(destino)))
            throw new https_1.HttpsError('invalid-argument', 'Escolha como destino um órgão que você administra');
        if (!c.ctx.isAdmin && !delegado && alvo.criado_por !== uid)
            throw new https_1.HttpsError('permission-denied', 'Só o admin do órgão ou quem criou este órgão interno pode excluí-lo');
        subordinados = atuais.filter((o) => o.pai_id === id).length;
        if ((unidades.length || subordinados) && !c.ctx.isAdmin && !delegado) {
            throw new https_1.HttpsError('permission-denied', 'Este órgão tem unidades ou órgãos subordinados. Só o admin do órgão pode excluí-lo, levando-os para outro lugar.');
        }
        if (destino && (destino === id || !atuais.some((o) => o.id === destino)))
            throw new https_1.HttpsError('invalid-argument', 'Escolha um destino válido');
        // Destino abaixo do próprio órgão criaria um ciclo na árvore.
        for (let o = atuais.find((x) => x.id === destino); o; o = atuais.find((x) => x.id === o.pai_id)) {
            if (o.pai_id === id)
                throw new https_1.HttpsError('invalid-argument', 'O destino não pode ser um órgão subordinado a este');
        }
        nome = alvo.nome;
        return atuais.filter((o) => o.id !== id).map((o) => (o.pai_id === id ? Object.assign(Object.assign({}, o), { pai_id: destino }) : o));
    });
    const [tipos, modelos] = await Promise.all([
        c.db.collection(context_1.COL.tipos).where('organization_id', '==', c.orgId).where('orgao_id', '==', id).get(),
        c.db.collection(context_1.COL.modelos).where('organization_id', '==', c.orgId).where('orgao_id', '==', id).get(),
    ]);
    const refs = [...unidades.map((u) => c.db.collection(context_1.COL.unidades).doc(u.id)), ...tipos.docs.map((d) => d.ref), ...modelos.docs.map((d) => d.ref)];
    for (let i = 0; i < refs.length; i += 400) {
        const lote = c.db.batch();
        refs.slice(i, i + 400).forEach((r) => lote.update(r, { orgao_id: destino }));
        await lote.commit();
    }
    await auditar('SECRETARIA_ORGAO_REMOVIDO', { orgao_id: id, nome, destino, unidades: unidades.length, subordinados, tipos: tipos.size, modelos: modelos.size });
    return { success: true, unidades: unidades.length, subordinados };
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
            return Object.assign(Object.assign({}, (0, orgaos_1.sanitizeOrgao)(Object.assign(Object.assign({}, o.orgao), { titular_uid: null, pai_id: pai }), ids.get(o.chave))), { ordem: atuais.length + i, criado_por: uid });
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