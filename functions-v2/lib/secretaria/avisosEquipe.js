"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avisarUnidadeRecebeu = avisarUnidadeRecebeu;
exports.avisarPedidoAssinatura = avisarPedidoAssinatura;
const secretaria_1 = require("../shared/secretaria");
const email_1 = require("../shared/email");
const autos_1 = require("./autos");
/**
 * Avisos por e-mail à equipe. Chamados depois da transação (nunca dentro) e
 * sempre engolindo falhas: e-mail que não sai não desfaz o ato.
 */
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const linkProcesso = (orgId, procId) => `${autos_1.APP_URL}/ProcessoEletronico?org=${orgId}&p=${procId}`;
/** E-mails dos membros do órgão com os uids dados (lidos de userOrganizations). */
async function emailsDe(c, uids) {
    const out = [];
    const refs = [...new Set(uids)].map((uid) => c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`));
    if (!refs.length)
        return out;
    for (const s of await c.db.getAll(...refs)) {
        const m = s.data();
        if (m && m.active !== false && m.user_email)
            out.push({ uid: String(m.user_id || s.id.split('_')[0]), email: String(m.user_email), nome: String(m.user_name || m.user_email) });
    }
    return out;
}
/** Processo chegou na unidade: avisa quem está lotado nela (menos quem remeteu). */
async function avisarUnidadeRecebeu(c, unidadeId, proc, procId, motivo) {
    try {
        const unidade = c.unidades.find((u) => u.id === unidadeId);
        if (!unidade)
            return;
        const uids = (0, secretaria_1.lotacoesDe)(unidade).map((l) => l.uid).filter((uid) => uid !== c.ctx.uid);
        for (const { email, nome } of await emailsDe(c, uids)) {
            await (0, email_1.sendEmail)({
                to: email,
                subject: `Processo ${proc.numero} chegou em ${unidade.nome}`,
                html: `<p>Olá, ${escapar(nome)}.</p><p>${escapar(c.userName)} remeteu o processo <b>${escapar(String(proc.numero))}</b> (${escapar(String(proc.assunto || ''))}) para <b>${escapar(String(unidade.nome))}</b>.</p>${motivo ? `<blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(motivo)}</blockquote>` : ''}<p><a href="${linkProcesso(c.orgId, procId)}">Abrir o processo</a></p>`,
            }).catch(() => false);
        }
    }
    catch ( /* aviso é cortesia */_a) { /* aviso é cortesia */ }
}
/** Alguém pediu a assinatura de uma pessoa da unidade numa minuta. */
async function avisarPedidoAssinatura(c, uid, proc, procId, titulo) {
    try {
        for (const { email, nome } of await emailsDe(c, [uid])) {
            await (0, email_1.sendEmail)({
                to: email,
                subject: `Assinatura pedida: ${titulo} (processo ${proc.numero})`,
                html: `<p>Olá, ${escapar(nome)}.</p><p>${escapar(c.userName)} pediu a sua assinatura em <b>${escapar(titulo)}</b>, minuta do processo <b>${escapar(String(proc.numero))}</b>.</p><p><a href="${linkProcesso(c.orgId, procId)}">Abrir o processo</a> e assinar em Minutas da unidade.</p>`,
            }).catch(() => false);
        }
    }
    catch ( /* aviso é cortesia */_a) { /* aviso é cortesia */ }
}
//# sourceMappingURL=avisosEquipe.js.map