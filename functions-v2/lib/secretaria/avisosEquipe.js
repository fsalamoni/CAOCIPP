"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkProcesso = exports.TIPO_NOTIFICACAO = void 0;
exports.prefDe = prefDe;
exports.notificarPessoas = notificarPessoas;
exports.lotadosDaUnidade = lotadosDaUnidade;
exports.avisarUnidadeRecebeu = avisarUnidadeRecebeu;
exports.avisarPedidoAssinatura = avisarPedidoAssinatura;
exports.avisarPendencia = avisarPendencia;
exports.avisarPeticao = avisarPeticao;
exports.enviarResumosDiarios = enviarResumosDiarios;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const secretaria_1 = require("../shared/secretaria");
const email_1 = require("../shared/email");
const autos_1 = require("./autos");
const context_1 = require("./context");
/**
 * Avisos à equipe: sino da plataforma (coleção `notifications`, tipo
 * `processo_eletronico`) e e-mail, conforme a preferência da pessoa em
 * userPreferences/{uid}.notificationPreferences.processo_eletronico:
 *   sino: true (padrão) | false
 *   email: 'cada' (padrão, um e-mail por evento) | 'resumo' (um por dia, no
 *          alerta das 7h) | 'nenhum'
 * Chamados depois da transação (nunca dentro) e sempre engolindo falhas:
 * aviso que não sai não desfaz o ato.
 */
exports.TIPO_NOTIFICACAO = 'processo_eletronico';
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const linkProcesso = (orgId, procId) => `${autos_1.APP_URL}/ProcessoEletronico?org=${orgId}&p=${procId}`;
exports.linkProcesso = linkProcesso;
function prefDe(prefs) {
    const p = (prefs === null || prefs === void 0 ? void 0 : prefs.processo_eletronico) || {};
    return {
        sino: p.sino !== false,
        email: p.email === 'resumo' || p.email === 'nenhum' ? p.email : 'cada',
    };
}
/** Membros ativos do órgão com os uids dados, com e-mail e preferência de aviso. */
async function pessoas(db, orgId, uids) {
    const lista = [...new Set(uids)].filter(Boolean);
    if (!lista.length)
        return [];
    const [mems, prefs] = await Promise.all([
        db.getAll(...lista.map((uid) => db.collection('userOrganizations').doc(`${uid}_${orgId}`))),
        db.getAll(...lista.map((uid) => db.collection('userPreferences').doc(uid))),
    ]);
    const out = [];
    lista.forEach((uid, i) => {
        var _a;
        const m = mems[i].data();
        if (!m || m.active === false)
            return;
        out.push({ uid, email: String(m.user_email || ''), nome: String(m.user_name || m.user_email || 'Membro'), pref: prefDe((_a = prefs[i].data()) === null || _a === void 0 ? void 0 : _a.notificationPreferences) });
    });
    return out;
}
/** Sino para quem o tem ligado, e-mail para quem escolheu "cada evento". */
async function notificarPessoas(db, orgId, uids, aviso, autorUid) {
    try {
        const dest = (await pessoas(db, orgId, uids)).filter((p) => p.uid !== autorUid);
        if (!dest.length)
            return;
        const batch = db.batch();
        let noSino = 0;
        for (const p of dest) {
            if (!p.pref.sino)
                continue;
            noSino++;
            batch.set(db.collection('notifications').doc(), {
                user_id: p.uid, type: exports.TIPO_NOTIFICACAO, subtype: aviso.subtipo,
                title: aviso.titulo, message: aviso.mensagem,
                organization_id: orgId, entity_type: exports.TIPO_NOTIFICACAO, entity_id: aviso.procId,
                read: false, created_at: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        if (noSino)
            await batch.commit();
        for (const p of dest) {
            if (aviso.soSino || p.pref.email !== 'cada' || !p.email)
                continue;
            await (0, email_1.sendEmail)({
                to: p.email,
                subject: aviso.titulo,
                html: `<p>Olá, ${escapar(p.nome)}.</p>${aviso.html}<p><a href="${(0, exports.linkProcesso)(orgId, aviso.procId)}">Abrir o processo</a></p><p style="color:#64748b;font-size:12px">Para receber um resumo diário em vez de um e-mail por evento, ou desligar, use "Avisos" no Processo Eletrônico.</p>`,
            }).catch(() => false);
        }
    }
    catch (e) {
        console.error('avisosEquipe: aviso não enviado', e);
    }
}
/** Uids lotados numa unidade (documento já carregado ou lido agora). */
async function lotadosDaUnidade(db, unidadeId, unidade) {
    const u = unidade || (await db.collection(context_1.COL.unidades).doc(unidadeId).get()).data();
    return u ? (0, secretaria_1.lotacoesDe)(u).map((l) => l.uid) : [];
}
/** Processo chegou na unidade: avisa quem está lotado nela (menos quem remeteu). */
/** Quem é parte no processo não é avisado como equipe (acompanha pelo portal). */
const semPartes = (proc, uids) => uids.filter((u) => !(0, secretaria_1.ehParte)(proc, u));
async function avisarUnidadeRecebeu(c, unidadeId, proc, procId, motivo) {
    const unidade = c.unidades.find((u) => u.id === unidadeId);
    if (!unidade)
        return;
    await notificarPessoas(c.db, c.orgId, semPartes(proc, await lotadosDaUnidade(c.db, unidadeId, unidade)), {
        subtipo: 'recebido', procId,
        titulo: `Processo ${proc.numero} chegou em ${unidade.nome}`,
        mensagem: `${c.userName} remeteu: ${proc.assunto || ''}${motivo ? ` · ${motivo}` : ''}`.slice(0, 300),
        html: `<p>${escapar(c.userName)} remeteu o processo <b>${escapar(String(proc.numero))}</b> (${escapar(String(proc.assunto || ''))}) para <b>${escapar(String(unidade.nome))}</b>.</p>${motivo ? `<blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(motivo)}</blockquote>` : ''}`,
    }, c.ctx.uid);
}
/** Alguém pediu a assinatura de uma pessoa da unidade numa minuta. */
async function avisarPedidoAssinatura(c, uid, proc, procId, titulo) {
    await notificarPessoas(c.db, c.orgId, semPartes(proc, [uid]), {
        subtipo: 'assinatura', procId,
        titulo: `Assinatura pedida: ${titulo}`,
        mensagem: `${c.userName} pediu sua assinatura no processo ${proc.numero}`,
        html: `<p>${escapar(c.userName)} pediu a sua assinatura em <b>${escapar(titulo)}</b>, minuta do processo <b>${escapar(String(proc.numero))}</b>. Assine em Minutas da unidade.</p>`,
    });
}
/** Pendência aberta num processo que está com o gabinete: avisa quem decide. */
async function avisarPendencia(c, proc, procId, descricao) {
    const unidade = c.unidades.find((u) => u.id === proc.unidade_atual);
    if (!unidade || unidade.tipo !== 'gabinete')
        return;
    await notificarPessoas(c.db, c.orgId, semPartes(proc, await lotadosDaUnidade(c.db, unidade.id, unidade)), {
        subtipo: 'pendencia', procId,
        titulo: `Pendência para decidir no processo ${proc.numero}`,
        mensagem: descricao.slice(0, 300),
        html: `<p>Nova pendência no processo <b>${escapar(String(proc.numero))}</b> (${escapar(String(proc.assunto || ''))}), aberta por ${escapar(c.userName)}:</p><blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(descricao)}</blockquote>`,
    }, c.ctx.uid);
}
/** Petição da parte: avisa a unidade que está com o processo. */
async function avisarPeticao(db, proc, procId, parteNome, titulo, tipo) {
    await notificarPessoas(db, String(proc.organization_id), semPartes(proc, await lotadosDaUnidade(db, String(proc.unidade_atual))), {
        subtipo: 'peticao', procId,
        titulo: `Petição de ${parteNome} no processo ${proc.numero}`,
        mensagem: `${tipo ? `${tipo}: ` : ''}${titulo}`.slice(0, 300),
        html: `<p>${escapar(parteNome)} protocolou pelo portal das partes, no processo <b>${escapar(String(proc.numero))}</b>: <b>${escapar(titulo)}</b>${tipo ? ` (${escapar(tipo)})` : ''}. A pendência já está aberta para o decisor.</p>`,
    });
}
/**
 * Resumo diário por e-mail para quem escolheu "resumo": o que chegou no sino
 * nas últimas 24 horas e ainda não foi lido. Roda junto com o alerta de prazos.
 */
async function enviarResumosDiarios(db) {
    try {
        const prefs = await db.collection('userPreferences').where('notificationPreferences.processo_eletronico.email', '==', 'resumo').limit(500).get();
        const desde = firestore_1.Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000);
        for (const pd of prefs.docs) {
            const uid = pd.id;
            const snap = await db.collection('notifications').where('user_id', '==', uid).where('read', '==', false).orderBy('created_at', 'desc').limit(100).get();
            const itens = snap.docs.map((d) => d.data()).filter((n) => n.type === exports.TIPO_NOTIFICACAO && n.created_at && n.created_at.toMillis() >= desde.toMillis());
            if (!itens.length)
                continue;
            let email = '';
            try {
                email = (await admin.auth().getUser(uid)).email || '';
            }
            catch (_a) {
                email = '';
            }
            if (!email)
                continue;
            const porOrg = new Map();
            for (const n of itens)
                porOrg.set(String(n.organization_id), [...(porOrg.get(String(n.organization_id)) || []), n]);
            const blocos = [];
            for (const [orgId, lista] of porOrg) {
                blocos.push(`<ul>${lista.slice(0, 40).map((n) => `<li><a href="${(0, exports.linkProcesso)(orgId, String(n.entity_id))}">${escapar(String(n.title))}</a> — ${escapar(String(n.message || ''))}</li>`).join('')}</ul>${lista.length > 40 ? `<p>… e mais ${lista.length - 40}.</p>` : ''}`);
            }
            await (0, email_1.sendEmail)({
                to: email,
                subject: `Processo Eletrônico: ${itens.length} aviso${itens.length > 1 ? 's' : ''} nas últimas 24 horas`,
                html: `<p>Resumo do que aconteceu nos seus processos:</p>${blocos.join('')}<p style="color:#64748b;font-size:12px">Você recebe este resumo porque escolheu "um resumo por dia" em Avisos, no Processo Eletrônico.</p>`,
            }).catch(() => false);
        }
    }
    catch (e) {
        console.error('avisosEquipe: resumo não enviado', e);
    }
}
//# sourceMappingURL=avisosEquipe.js.map