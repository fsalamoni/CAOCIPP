"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.avisarPartesDoMovimento = avisarPartesDoMovimento;
exports.lembrarPrazosDasPartes = lembrarPrazosDasPartes;
const admin = require("firebase-admin");
const secretaria_1 = require("../shared/secretaria");
const email_1 = require("../shared/email");
const autos_1 = require("./autos");
const context_1 = require("./context");
const portal_1 = require("./portal");
const autos_2 = require("../shared/autos");
/**
 * Avisos por e-mail às partes habilitadas no portal. Chamado depois da
 * transação que registrou o movimento (nunca dentro dela) e sempre com
 * `catch`: falha de e-mail não desfaz o ato.
 *
 * Preferência por conta (secPortalAcessos/{uid}.avisos): "tudo" (padrão),
 * "prazos" (só prazos, decisões e situação) ou "nenhum".
 */
const TIPOS_PRAZOS_DECISOES = ['prazo', 'prazo_encerrado', 'pendencia_resolvida', 'situacao', 'fase', 'comunicacao', 'ciencia_decurso'];
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const br = (iso) => iso.split('-').reverse().join('/');
async function destinatarios(db, proc, filtro) {
    // Cada conta habilitada: a parte e cada representante dela.
    const partes = [];
    for (const x of (proc.partes || [])) {
        if (x.uid)
            partes.push(x);
        for (const r of x.representantes || [])
            if (r.uid)
                partes.push(Object.assign(Object.assign({}, r), { polo: x.polo }));
    }
    if (!partes.length)
        return [];
    const prefs = await db.getAll(...partes.map((x) => db.collection(portal_1.COL_ACESSOS).doc(x.uid)));
    const out = [];
    for (let i = 0; i < partes.length; i++) {
        const d = prefs[i].data() || {};
        const pref = (portal_1.AVISOS_PARTE.includes(d.avisos) ? d.avisos : 'tudo');
        if (!filtro(pref))
            continue;
        let email = String(d.email || partes[i].email || '');
        if (!email) {
            try {
                email = (await admin.auth().getUser(partes[i].uid)).email || '';
            }
            catch (_a) {
                email = '';
            }
        }
        if (email)
            out.push({ parte: partes[i], email });
    }
    return out;
}
const rodape = (procId) => `<p><a href="${autos_1.APP_URL}/Portal?p=${procId}">Abrir o processo no portal das partes</a></p><p style="color:#64748b;font-size:12px">Você recebe este aviso porque acompanha o processo pelo portal. Para mudar, abra o portal e ajuste "Avisos por e-mail".</p>`;
/** Avisa as partes sobre o último movimento público do processo. */
async function avisarPartesDoMovimento(db, procId, autorUid, ultimos = 1) {
    var _a;
    const proc = (_a = (await db.collection(context_1.COL.processos).doc(procId).get().catch(() => null))) === null || _a === void 0 ? void 0 : _a.data();
    const fim = Number(proc === null || proc === void 0 ? void 0 : proc.mov_seq) || 0;
    for (let seq = Math.max(1, fim - ultimos + 1); seq <= fim; seq++)
        await avisarDoMovimento(db, procId, proc, seq, autorUid);
}
async function avisarDoMovimento(db, procId, proc, seq, autorUid) {
    try {
        const ref = db.collection(context_1.COL.processos).doc(procId);
        if (!(proc.partes_uids || []).length)
            return;
        const mov = (await ref.collection('movimentos').doc(String(seq).padStart(6, '0')).get()).data();
        if (!mov || !(0, autos_2.visivelParaPartes)(mov))
            return;
        if (['convite', 'habilitacao', 'acesso_revogado'].includes(mov.tipo))
            return; // já têm e-mail próprio ou não interessam
        const org = (await db.collection('organizations').doc(proc.organization_id).get()).data();
        const dest = await destinatarios(db, proc, (pref) => pref === 'tudo' || (pref === 'prazos' && TIPOS_PRAZOS_DECISOES.includes(mov.tipo)));
        for (const { parte, email } of dest) {
            if (autorUid && parte.uid === autorUid)
                continue; // quem peticionou não precisa do aviso do próprio ato
            await (0, email_1.sendEmail)({
                to: email,
                subject: `Processo ${proc.numero}: ${rotulo(mov.tipo)}`,
                html: `<p>Olá, ${escapar(parte.nome)}.</p><p>Novo andamento no processo <b>${escapar(String(proc.numero))}</b> (${escapar(String((org === null || org === void 0 ? void 0 : org.name) || ''))}):</p><blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(String(mov.descricao))}</blockquote>${rodape(procId)}`,
            }).catch(() => false);
        }
    }
    catch (e) {
        console.warn('[portal] aviso às partes falhou', e);
    }
}
function rotulo(tipo) {
    return {
        juntada: 'novo documento nos autos', peticao: 'petição protocolada', fase: 'o processo mudou de fase', situacao: 'a situação do processo mudou',
        prazo: 'prazo aberto', prazo_encerrado: 'prazo encerrado', comunicacao: 'comunicação expedida, aguardando ciência', ciencia_decurso: 'ciência registrada por decurso', pendencia_resolvida: 'decisão registrada', autuacao: 'processo autuado',
    }[tipo] || 'novo andamento';
}
/**
 * Lembrete de prazo às partes: 3 dias antes e no dia do vencimento, para os
 * prazos dirigidos à parte (ou sem destinatário). Roda junto do alerta diário
 * da equipe, mas não depende da preferência do órgão.
 */
async function lembrarPrazosDasPartes(db, procs) {
    const hoje = (0, secretaria_1.hojeBrasil)();
    const em3 = (0, secretaria_1.somarDias)(hoje, 3);
    for (const snap of procs) {
        const proc = snap.data();
        if (!(proc.partes_uids || []).length)
            continue;
        const prazos = (proc.prazos || []).filter((x) => x.status === 'aberto' && (x.vence_em === hoje || x.vence_em === em3));
        if (!prazos.length)
            continue;
        const dest = await destinatarios(db, proc, (pref) => pref !== 'nenhum');
        for (const { parte, email } of dest) {
            const meus = prazos.filter((x) => !x.destinatario || String(x.destinatario).toLowerCase().includes(parte.nome.toLowerCase()));
            if (!meus.length)
                continue;
            const linhas = meus.map((x) => `<li>${escapar(x.descricao)}: ${x.vence_em === hoje ? '<b>vence hoje</b>' : `vence em ${br(x.vence_em)}`}</li>`).join('');
            await (0, email_1.sendEmail)({
                to: email,
                subject: `Processo ${proc.numero}: prazo ${meus.some((x) => x.vence_em === hoje) ? 'vence hoje' : 'vence em 3 dias'}`,
                html: `<p>Olá, ${escapar(parte.nome)}.</p><p>Prazo no processo <b>${escapar(String(proc.numero))}</b>:</p><ul>${linhas}</ul><p>Você pode se manifestar pelo portal a qualquer momento.</p>${rodape(snap.id)}`,
            }).catch(() => false);
        }
    }
}
//# sourceMappingURL=portalAvisos.js.map