"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salvarUnidade = salvarUnidade;
exports.excluirUnidade = excluirUnidade;
exports.obterUnidadeDocumento = obterUnidadeDocumento;
exports.salvarUnidadeDocumento = salvarUnidadeDocumento;
exports.convidarEquipe = convidarEquipe;
exports.revogarConviteEquipe = revogarConviteEquipe;
exports.convitesPendentes = convitesPendentes;
exports.pedirLotacao = pedirLotacao;
exports.decidirPedido = decidirPedido;
exports.verConviteEquipe = verConviteEquipe;
exports.aceitarConviteEquipe = aceitarConviteEquipe;
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const normalization_1 = require("../shared/normalization");
const email_1 = require("../shared/email");
const context_1 = require("./context");
const autos_1 = require("./autos");
const documentoConfig_1 = require("./documentoConfig");
const orgaos_1 = require("../shared/orgaos");
const orgaos_2 = require("./orgaos");
const exigencias_1 = require("../shared/exigencias");
/**
 * Unidades de lotação do Processo Eletrônico: dados, equipe (lotações com
 * atribuição e gestão), convites, pedidos de lotação e papel timbrado/tipos
 * de documento próprios. O admin do órgão faz tudo; o gestor da unidade
 * cuida da equipe, do timbrado e dos modelos dela.
 */
const MAX_UNIDADES = 100;
const MAX_PEDIDOS = 50;
const CONVITE_DIAS = 7;
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const hashToken = (t) => (0, crypto_1.createHash)('sha256').update(t).digest('hex');
/** Confere que todas as pessoas são membros ativos do órgão. */
async function exigirMembros(c, uids) {
    if (!uids.length)
        return;
    const snaps = await c.db.getAll(...uids.map((uid) => c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`)));
    const fora = snaps.filter((s) => { var _a; return !s.exists || ((_a = s.data()) === null || _a === void 0 ? void 0 : _a.active) === false; }).length;
    if (fora)
        throw new https_1.HttpsError('invalid-argument', `${fora} pessoa(s) não são membros ativos do órgão`);
}
/** Campos a gravar quando as lotações mudam (membros_uids segue em sincronia). */
const camposLotacao = (lotacoes) => ({ lotacoes, membros_uids: lotacoes.map((l) => l.uid) });
async function salvarUnidade(c, p, uid, auditar) {
    var _a;
    const u = (p.unidade && typeof p.unidade === 'object' ? p.unidade : {});
    const lotacoes = (0, secretaria_1.sanitizeLotacoes)((_a = u.lotacoes) !== null && _a !== void 0 ? _a : (Array.isArray(u.membros_uids) ? u.membros_uids.map((x) => ({ uid: x })) : []));
    await exigirMembros(c, lotacoes.map((l) => l.uid));
    const agora = firestore_1.FieldValue.serverTimestamp();
    // Órgão interno a que a unidade pertence (vazio = ligada direto à entidade).
    const orgaoId = String(u.orgao_id || '');
    if (c.ctx.isAdmin && orgaoId && !(await (0, orgaos_2.lerOrgaos)(c.db, c.orgId)).some((o) => o.id === orgaoId)) {
        throw new https_1.HttpsError('invalid-argument', 'Órgão interno inválido');
    }
    const competencias = (0, orgaos_1.sanitizeCompetencias)(u.competencias);
    if (p.id) {
        const atual = (0, context_1.exigirGestor)(c, p.id);
        // O gestor (sem ser admin) cuida da equipe e da descrição; nome, tipo
        // e ativação são do admin do órgão.
        const dados = c.ctx.isAdmin
            ? Object.assign({ nome: (0, secretaria_1.texto)(u.nome) || atual.nome, sigla: (0, secretaria_1.texto)(u.sigla, 20), tipo: (0, secretaria_1.tipoUnidade)(u.tipo), ativa: u.ativa !== false }, ('orgao_id' in u ? { orgao_id: orgaoId || null } : {})) : {};
        if (c.ctx.isAdmin && !(0, secretaria_1.texto)(u.nome))
            throw new https_1.HttpsError('invalid-argument', 'A unidade precisa de um nome');
        // Unidade inativa não movimenta: desativar com processo em andamento deixaria o processo preso.
        if (dados.ativa === false && atual.ativa !== false) {
            const base = c.db.collection(context_1.COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', '==', atual.id);
            const [todos, arquivados] = await Promise.all([base.count().get(), base.where('status', '==', 'arquivado').count().get()]);
            const presos = todos.data().count - arquivados.data().count;
            if (presos > 0) {
                throw new https_1.HttpsError('failed-precondition', `A unidade tem ${presos} processo(s) em andamento. Envie-os para outra unidade antes de desativá-la.`);
            }
        }
        // Quem salva parte da equipe que carregou (`lotacoes_base`): só o que essa
        // pessoa mudou vale sobre a equipe atual, sem desfazer admissões feitas no meio-tempo.
        const ref = c.db.collection(context_1.COL.unidades).doc(atual.id);
        let removidos = [];
        let total = 0;
        await c.db.runTransaction(async (tx) => {
            const atuais = (0, secretaria_1.lotacoesDe)((await tx.get(ref)).data() || {});
            const final = (0, secretaria_1.sanitizeLotacoes)(Array.isArray(p.lotacoes_base) ? (0, secretaria_1.mesclarLotacoes)(atuais, (0, secretaria_1.sanitizeLotacoes)(p.lotacoes_base), lotacoes) : lotacoes);
            // Gestor não tira a própria gestão (evita unidade sem ninguém que a gerencie por engano).
            if (!c.ctx.isAdmin && !final.some((l) => l.uid === uid && l.gestor)) {
                throw new https_1.HttpsError('failed-precondition', 'Você não pode tirar a sua própria gestão da unidade; peça ao admin do órgão');
            }
            removidos = atuais.filter((l) => !final.some((x) => x.uid === l.uid)).map((l) => l.uid);
            total = final.length;
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, dados), { descricao: (0, secretaria_1.texto)(u.descricao, 500) }), ('competencias' in u ? { competencias } : {})), camposLotacao(final)), { updated_at: agora, updated_by: uid }));
        });
        const liberados = await liberarResponsaveis(c, atual.id, removidos);
        await auditar('SECRETARIA_UNIDADE_SALVA', Object.assign({ unidade_id: atual.id, nome: dados.nome || atual.nome, lotacoes: total }, (liberados ? { atribuicoes_removidas: liberados } : {})));
        return { success: true, id: atual.id, atribuicoes_removidas: liberados };
    }
    (0, context_1.exigirAdmin)(c);
    const nome = (0, secretaria_1.texto)(u.nome);
    if (!nome)
        throw new https_1.HttpsError('invalid-argument', 'A unidade precisa de um nome');
    if (c.unidades.filter((x) => !x.excluida).length >= MAX_UNIDADES)
        throw new https_1.HttpsError('resource-exhausted', 'Limite de unidades atingido');
    const ref = await c.db.collection(context_1.COL.unidades).add(Object.assign(Object.assign({ organization_id: c.orgId, nome, sigla: (0, secretaria_1.texto)(u.sigla, 20), tipo: (0, secretaria_1.tipoUnidade)(u.tipo), descricao: (0, secretaria_1.texto)(u.descricao, 500), orgao_id: orgaoId || null, competencias, ativa: u.ativa !== false }, camposLotacao(lotacoes)), { pedidos: [], created_at: agora, created_by: uid }));
    await auditar('SECRETARIA_UNIDADE_SALVA', { unidade_id: ref.id, nome, lotacoes: lotacoes.length });
    return { success: true, id: ref.id };
}
/**
 * Quem saiu da equipe deixa de ser responsável pelos processos da unidade:
 * a atribuição desfeita fica registrada (registro de controle, fora dos autos).
 */
async function liberarResponsaveis(c, unidadeId, uids) {
    let n = 0;
    for (let i = 0; i < uids.length; i += 30) {
        const snap = await c.db.collection(context_1.COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', '==', unidadeId)
            .where('responsavel_uid', 'in', uids.slice(i, i + 30)).limit(500).get();
        for (const d of snap.docs) {
            n += await c.db.runTransaction(async (tx) => {
                const data = (await tx.get(d.ref)).data();
                if (!data || data.unidade_atual !== unidadeId || !uids.includes(data.responsavel_uid))
                    return 0;
                const mov = (0, context_1.registrarMovimento)(tx, c, d.ref, data, 'atribuicao', 'Atribuição removida: a pessoa responsável deixou a equipe da unidade.', Object.assign({ responsavel_uid: null, automatico: true }, (0, exigencias_1.marcasNaFase)(data, 'atribuicao')));
                tx.update(d.ref, Object.assign(Object.assign({}, mov), { responsavel_uid: null }));
                return 1;
            });
        }
    }
    return n;
}
const MAX_SUCESSAO = 500;
/**
 * Exclui a unidade. Nada se apaga: ela some das listas e da escolha de destino,
 * mas o nome continua nos autos. Processos dela (em qualquer situação) vão para
 * a unidade sucessora, com termo de remessa e as minutas junto; a equipe, os
 * pedidos e os convites em aberto deixam de valer. `simular` só devolve o impacto.
 * Admin do órgão exclui qualquer unidade; quem a criou, só a que não tem processo.
 */
async function excluirUnidade(c, p, uid, auditar) {
    const u = c.unidades.find((x) => x.id === String(p.id || '') && !x.excluida);
    if (!u)
        throw new https_1.HttpsError('not-found', 'Unidade não encontrada');
    if (!c.ctx.isAdmin && u.created_by !== uid)
        throw new https_1.HttpsError('permission-denied', 'Só o admin do órgão ou quem criou a unidade pode excluí-la');
    const procs = await c.db.collection(context_1.COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', '==', u.id).limit(MAX_SUCESSAO + 1).get();
    const arquivados = procs.docs.filter((d) => d.data().status === 'arquivado').length;
    if (p.simular === true) {
        const modelos = await c.db.collection(context_1.COL.modelos).where('organization_id', '==', c.orgId).where('unidade_id', '==', u.id).select('excluido').get();
        return { processos: procs.size, arquivados, em_andamento: procs.size - arquivados, modelos: modelos.docs.filter((d) => d.data().excluido !== true).length, equipe: (0, secretaria_1.lotacoesDe)(u).length, pode_mover: c.ctx.isAdmin };
    }
    let sucessora = null;
    if (procs.size) {
        if (!c.ctx.isAdmin)
            throw new https_1.HttpsError('permission-denied', 'A unidade tem processos. Só o admin do órgão pode excluí-la, enviando os processos para outra unidade.');
        if (procs.size > MAX_SUCESSAO)
            throw new https_1.HttpsError('resource-exhausted', `A unidade tem mais de ${MAX_SUCESSAO} processos. Envie parte deles antes de excluí-la.`);
        sucessora = c.unidades.find((x) => x.id === String(p.sucessora || '') && x.id !== u.id && x.ativa !== false && !x.excluida) || null;
        if (!sucessora)
            throw new https_1.HttpsError('invalid-argument', `Escolha a unidade ativa que recebe os ${procs.size} processo(s) desta unidade.`);
        for (const d of procs.docs) {
            await c.db.runTransaction(async (tx) => {
                const data = (await tx.get(d.ref)).data();
                if (!data || data.unidade_atual !== u.id)
                    return;
                const minutas = (await tx.get(d.ref.collection('documentos').where('status', '==', 'minuta'))).docs
                    .filter((m) => (0, secretaria_1.minutaAcessivel)(m.data(), [u.id]));
                const mov = (0, context_1.registrarMovimento)(tx, c, d.ref, data, 'tramitacao', `Remetido de ${u.nome} para ${sucessora.nome}, por exclusão da unidade.`, Object.assign({ de: u.id, para: sucessora.id, exclusao_unidade: true }, (minutas.length ? { minutas: minutas.map((m) => m.id) } : {})));
                minutas.forEach((m) => tx.update(m.ref, { unidades_acesso: firestore_1.FieldValue.arrayUnion(sucessora.id) }));
                tx.update(d.ref, Object.assign(Object.assign({}, mov), { unidade_atual: sucessora.id, unidades_historico: firestore_1.FieldValue.arrayUnion(sucessora.id), responsavel_uid: null, recebido_em: new Date().toISOString() }));
            });
        }
    }
    await c.db.collection(context_1.COL.unidades).doc(u.id).update(Object.assign(Object.assign({ excluida: true, ativa: false }, camposLotacao([])), { pedidos: [], excluida_em: new Date().toISOString(), excluida_por: uid, updated_at: firestore_1.FieldValue.serverTimestamp(), updated_by: uid }));
    const convites = await c.db.collection(context_1.COL.convitesEquipe).where('organization_id', '==', c.orgId).where('unidade_id', '==', u.id).get();
    await Promise.all(convites.docs.filter((d) => !d.data().usado_por && !d.data().revogado).map((d) => d.ref.update({ revogado: true })));
    await auditar('SECRETARIA_UNIDADE_EXCLUIDA', { unidade_id: u.id, nome: u.nome, processos: procs.size, sucessora: (sucessora === null || sucessora === void 0 ? void 0 : sucessora.id) || null });
    return { success: true, processos: procs.size, sucessora: (sucessora === null || sucessora === void 0 ? void 0 : sucessora.nome) || null };
}
async function obterUnidadeDocumento(c, p) {
    const u = (0, context_1.exigirGestor)(c, p.unidadeId);
    const d = (await c.db.collection(context_1.COL.unidadeConfig).doc(u.id).get()).data() || {};
    return {
        timbrado_proprio: d.timbrado_proprio === true,
        documento: d.documento ? (0, documentoConfig_1.sanitizeDocumentoConfig)(d.documento, { semTiposPadrao: true }) : null,
        tipos_documento: Array.isArray(d.tipos_documento) ? d.tipos_documento : [],
    };
}
async function salvarUnidadeDocumento(c, p, uid, auditar) {
    const u = (0, context_1.exigirGestor)(c, p.unidadeId);
    let documento = null;
    try {
        documento = p.documento ? (0, documentoConfig_1.sanitizeDocumentoConfig)(p.documento, { semTiposPadrao: true }) : null;
    }
    catch (e) {
        (0, context_1.erroUsuario)(e);
    }
    const tipos = [...new Set((Array.isArray(p.tipos_documento) ? p.tipos_documento : []).map((t) => (0, secretaria_1.texto)(t, 60)).filter(Boolean))].slice(0, 60);
    const proprio = p.timbrado_proprio === true && !!documento;
    await c.db.collection(context_1.COL.unidadeConfig).doc(u.id).set({
        organization_id: c.orgId, unidade_id: u.id, timbrado_proprio: proprio,
        documento: documento ? Object.assign(Object.assign({}, documento), { tipos_documento: [] }) : null,
        tipos_documento: tipos, updated_at: firestore_1.FieldValue.serverTimestamp(), updated_by: uid,
    });
    await auditar('SECRETARIA_UNIDADE_DOCUMENTO', { unidade_id: u.id, timbrado_proprio: proprio, tipos: tipos.length });
    return { success: true };
}
async function convidarEquipe(c, p, uid, auditar) {
    const u = (0, context_1.exigirGestor)(c, p.unidadeId);
    const email = (0, secretaria_1.texto)(p.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new https_1.HttpsError('invalid-argument', 'Informe um e-mail válido');
    const token = (0, crypto_1.randomBytes)(24).toString('base64url');
    const hash = hashToken(token);
    const expira = new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString();
    await c.db.collection(context_1.COL.convitesEquipe).doc(hash).set({
        organization_id: c.orgId, unidade_id: u.id, unidade_nome: u.nome, email,
        atribuicao: (0, secretaria_1.texto)(p.atribuicao, 80), gestor: p.gestor === true,
        expira_em: expira, criado_por: uid, criado_por_nome: c.userName, criado_em: firestore_1.FieldValue.serverTimestamp(), usado_por: null, revogado: false,
    });
    const link = `${autos_1.APP_URL}/ProcessoEletronico?equipe=${token}`;
    const orgao = String(c.org.name || '');
    const enviado = await (0, email_1.sendEmail)({
        to: email,
        subject: `Convite para a equipe de ${u.nome} (${orgao})`,
        html: `<p>Olá.</p><p>${escapar(c.userName)} convidou você para a unidade <b>${escapar(String(u.nome))}</b> do Processo Eletrônico de <b>${escapar(orgao)}</b>${p.atribuicao ? `, com a atribuição <b>${escapar((0, secretaria_1.texto)(p.atribuicao, 80))}</b>` : ''}.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias). Entre com a conta Google deste e-mail.</p><p>Se você não esperava este e-mail, ignore-o.</p>`,
    }).catch(() => false);
    await auditar('SECRETARIA_EQUIPE_CONVITE', { unidade_id: u.id, email });
    return { success: true, link, emailEnviado: enviado, expira_em: expira };
}
async function revogarConviteEquipe(c, p, auditar) {
    const ref = c.db.collection(context_1.COL.convitesEquipe).doc((0, secretaria_1.texto)(p.id, 80) || '_');
    const d = (await ref.get()).data();
    if (!d || d.organization_id !== c.orgId)
        throw new https_1.HttpsError('not-found', 'Convite não encontrado');
    (0, context_1.exigirGestor)(c, d.unidade_id);
    await ref.update({ revogado: true });
    await auditar('SECRETARIA_EQUIPE_CONVITE_REVOGADO', { unidade_id: d.unidade_id, email: d.email });
    return { success: true };
}
/** Convites pendentes das unidades que a pessoa gere (todas, para o admin). */
async function convitesPendentes(c) {
    if (!c.ctx.isAdmin && !c.gestorDe.length)
        return [];
    const snap = await c.db.collection(context_1.COL.convitesEquipe).where('organization_id', '==', c.orgId).get();
    const agora = new Date().toISOString();
    return snap.docs
        .map((d) => (Object.assign({ id: d.id }, d.data())))
        .filter((d) => !d.usado_por && !d.revogado && String(d.expira_em) > agora)
        .filter((d) => c.ctx.isAdmin || c.gestorDe.includes(String(d.unidade_id)))
        .map((d) => ({ id: d.id, unidade_id: d.unidade_id, email: d.email, atribuicao: d.atribuicao || '', gestor: d.gestor === true, expira_em: d.expira_em }));
}
/** Membro do órgão pede para ser lotado numa unidade; a gestão admite ou recusa. */
async function pedirLotacao(c, p, uid, email) {
    const ref = c.db.collection(context_1.COL.unidades).doc(String(p.unidadeId || '_'));
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data();
        if (!u || u.organization_id !== c.orgId || u.ativa === false)
            throw new https_1.HttpsError('not-found', 'Unidade não encontrada');
        if ((0, secretaria_1.lotacoesDe)(u).some((l) => l.uid === uid))
            throw new https_1.HttpsError('already-exists', 'Você já está lotado nesta unidade');
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x) => x.uid !== uid);
        if (pedidos.length >= MAX_PEDIDOS)
            throw new https_1.HttpsError('resource-exhausted', 'A unidade tem pedidos demais em aberto');
        pedidos.push({ uid, nome: c.userName, email, mensagem: (0, secretaria_1.texto)(p.mensagem, 300), em: new Date().toISOString() });
        tx.update(ref, { pedidos });
    });
    return { success: true };
}
async function decidirPedido(c, p, uid, auditar) {
    const u0 = (0, context_1.exigirGestor)(c, p.unidadeId);
    const alvo = (0, secretaria_1.texto)(p.uid, 128);
    const admitir = p.admitir === true;
    if (admitir)
        await exigirMembros(c, [alvo]);
    const ref = c.db.collection(context_1.COL.unidades).doc(u0.id);
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data() || {};
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []);
        if (!pedidos.some((x) => x.uid === alvo))
            throw new https_1.HttpsError('not-found', 'Pedido não encontrado');
        const lotacoes = (0, secretaria_1.lotacoesDe)(u);
        if (admitir && !lotacoes.some((l) => l.uid === alvo)) {
            lotacoes.push({ uid: alvo, atribuicao: (0, secretaria_1.texto)(p.atribuicao, 80), gestor: false });
        }
        tx.update(ref, Object.assign(Object.assign({ pedidos: pedidos.filter((x) => x.uid !== alvo) }, camposLotacao(lotacoes)), { updated_at: firestore_1.FieldValue.serverTimestamp(), updated_by: uid }));
    });
    await auditar(admitir ? 'SECRETARIA_LOTACAO_ADMITIDA' : 'SECRETARIA_LOTACAO_RECUSADA', { unidade_id: u0.id, uid: alvo });
    return { success: true };
}
/** Prévia do convite (antes do aceite): órgão, unidade e validade. */
async function verConviteEquipe(token) {
    const d = (await admin.firestore().collection(context_1.COL.convitesEquipe).doc(hashToken(String(token || ''))).get()).data();
    if (!d)
        throw new https_1.HttpsError('not-found', 'Convite não encontrado');
    const org = (await admin.firestore().collection('organizations').doc(d.organization_id).get()).data() || {};
    const valido = !d.usado_por && !d.revogado && String(d.expira_em) > new Date().toISOString();
    return {
        valido, orgao: String(org.name || ''), organizationId: d.organization_id, unidade: d.unidade_nome, email: d.email,
        atribuicao: d.atribuicao || '', convidado_por: d.criado_por_nome || '', expira_em: d.expira_em, usado: !!d.usado_por,
    };
}
/**
 * Aceite do convite de equipe: cria (ou reativa) o vínculo com o órgão e
 * lota a pessoa na unidade. Exige a conta do e-mail convidado.
 */
async function aceitarConviteEquipe(auth, token) {
    const db = admin.firestore();
    const ref = db.collection(context_1.COL.convitesEquipe).doc(hashToken(String(token || '')));
    const email = String(auth.token.email || '').toLowerCase();
    const nome = (0, normalization_1.formatPersonName)(String(auth.token.name || '')) || email;
    const r = await db.runTransaction(async (tx) => {
        var _a, _b;
        const d = (await tx.get(ref)).data();
        if (!d)
            throw new https_1.HttpsError('not-found', 'Convite não encontrado');
        if (d.usado_por || d.revogado || String(d.expira_em) <= new Date().toISOString()) {
            throw new https_1.HttpsError('failed-precondition', 'Este convite já foi usado, foi revogado ou expirou. Peça um novo.');
        }
        if (!email || email !== d.email) {
            throw new https_1.HttpsError('permission-denied', `Este convite é para ${d.email}. Entre com a conta desse e-mail.`);
        }
        const orgId = d.organization_id;
        const unRef = db.collection(context_1.COL.unidades).doc(d.unidade_id);
        const memRef = db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`);
        const [un, mem, perfil] = await Promise.all([tx.get(unRef), tx.get(memRef), tx.get(db.collection('users').doc(auth.uid))]);
        const u = un.data();
        if (!u || u.ativa === false)
            throw new https_1.HttpsError('failed-precondition', 'A unidade do convite não está mais ativa');
        const funcao = String(((_a = perfil.data()) === null || _a === void 0 ? void 0 : _a.function) || '').trim() || 'Membro';
        if (!mem.exists) {
            tx.set(memRef, {
                id: `${auth.uid}_${orgId}`, user_id: auth.uid, organization_id: orgId, user_email: email, user_name: nome,
                role: 'member', function: funcao, active: true, joined_at: firestore_1.FieldValue.serverTimestamp(), via: 'convite_equipe',
            });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': firestore_1.FieldValue.increment(1) });
        }
        else if (((_b = mem.data()) === null || _b === void 0 ? void 0 : _b.active) === false) {
            tx.update(memRef, { active: true, role: 'member', joined_at: firestore_1.FieldValue.serverTimestamp(), left_at: firestore_1.FieldValue.delete() });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': firestore_1.FieldValue.increment(1) });
        }
        const lotacoes = (0, secretaria_1.lotacoesDe)(u).filter((l) => l.uid !== auth.uid);
        lotacoes.push({ uid: auth.uid, atribuicao: String(d.atribuicao || ''), gestor: d.gestor === true });
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x) => x.uid !== auth.uid);
        tx.update(unRef, Object.assign(Object.assign({}, camposLotacao(lotacoes)), { pedidos }));
        tx.update(ref, { usado_por: auth.uid, usado_em: firestore_1.FieldValue.serverTimestamp() });
        return { orgId, unidade: String(u.nome) };
    });
    await db.collection('auditLogs').add({
        organization_id: r.orgId, user_id: auth.uid, user_name: nome, action: 'SECRETARIA_EQUIPE_CONVITE_ACEITO',
        details: { unidade: r.unidade }, timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { success: true, organizationId: r.orgId, unidade: r.unidade };
}
//# sourceMappingURL=unidades.js.map