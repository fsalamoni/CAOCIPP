"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaAlertaPrazos = exports.DIAS_ALERTA = exports.secretariaConferir = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const secretaria_1 = require("../shared/secretaria");
const email_1 = require("../shared/email");
const autos_1 = require("./autos");
const context_1 = require("./context");
const portalAvisos_1 = require("./portalAvisos");
const avisosEquipe_1 = require("./avisosEquipe");
const comunicacoes_1 = require("./comunicacoes");
/**
 * Conferência pública (sem login) de um documento juntado pelo código
 * impresso nas folhas. Responde só os dados da juntada: quem tem o código
 * tem o próprio documento.
 */
exports.secretariaConferir = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a;
    const codigo = (0, autos_1.normalizarCodigo)((_a = request.data) === null || _a === void 0 ? void 0 : _a.codigo);
    if (!codigo)
        throw new https_1.HttpsError('invalid-argument', 'Código inválido. Ele tem 16 letras e números, no formato XXXX-XXXX-XXXX-XXXX.');
    const v = (await admin.firestore().collection(context_1.COL.verificacao).doc(codigo).get()).data();
    if (!v)
        throw new https_1.HttpsError('not-found', 'Nenhum documento com este código.');
    return {
        codigo,
        orgao: v.orgao, numero: v.numero, ordem: v.ordem, titulo: v.titulo, tipo: v.tipo, origem: v.origem,
        nome_arquivo: v.nome_arquivo, juntado_em: v.juntado_em, juntado_por: v.juntado_por,
        folha_inicial: v.folha_inicial, folha_final: v.folha_final, paginas: v.paginas,
        assinaturas: v.assinaturas || [], sha256: v.sha256, pdf_sha256: v.pdf_sha256, peticao: v.peticao === true,
    };
});
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const br = (iso) => iso.split('-').reverse().join('/');
exports.DIAS_ALERTA = 2;
/**
 * Todo dia às 7h: para os órgãos que ligaram o alerta, avisa por e-mail os
 * lotados na unidade que tem o processo sobre prazos vencidos ou que vencem
 * em até 2 dias. Um e-mail por pessoa, com a lista.
 */
exports.secretariaAlertaPrazos = (0, scheduler_1.onSchedule)({ schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: context_1.REGION }, async () => {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    // Antes dos alertas: a ciência por decurso abre prazos que entram neles.
    await (0, comunicacoes_1.cienciaPorDecurso)(db).catch((e) => console.warn('[comunicacoes] ciência por decurso falhou', e));
    const hoje = (0, secretaria_1.hojeBrasil)();
    const limite = (0, secretaria_1.somarDias)(hoje, exports.DIAS_ALERTA);
    // Só campo único em faixa: dispensa índice composto.
    const snap = await db.collection(context_1.COL.processos).where('proximo_vencimento', '<=', limite).limit(2000).get();
    const porOrg = new Map();
    await (0, portalAvisos_1.lembrarPrazosDasPartes)(db, snap.docs.filter((d) => d.data().status === 'em_tramitacao')).catch(() => undefined);
    for (const d of snap.docs) {
        if (d.data().status !== 'em_tramitacao')
            continue;
        const org = String(d.data().organization_id);
        porOrg.set(org, [...(porOrg.get(org) || []), d]);
    }
    for (const [orgId, procs] of porOrg) {
        const [cfg, org] = await Promise.all([db.collection(context_1.COL.config).doc(orgId).get(), db.collection('organizations').doc(orgId).get()]);
        const sc = ((_a = org.data()) === null || _a === void 0 ? void 0 : _a.secretariaConfig) || {};
        if (((_b = cfg.data()) === null || _b === void 0 ? void 0 : _b.alerta_prazos) !== true || sc.enabled !== true || sc.suspensa_plataforma === true)
            continue;
        const unidades = new Map((await db.collection(context_1.COL.unidades).where('organization_id', '==', orgId).get()).docs.map((u) => [u.id, u.data()]));
        const porPessoa = new Map();
        const sinoPorPessoa = new Map();
        for (const p of procs) {
            const d = p.data();
            const venc = String(d.proximo_vencimento);
            const linha = `<li><b>${escapar(String(d.numero))}</b> — ${escapar(String(d.assunto || ''))}: prazo ${venc < hoje ? `<b>vencido em ${br(venc)}</b>` : `vence em ${br(venc)}`}</li>`;
            for (const uid of (((_c = unidades.get(d.unidade_atual)) === null || _c === void 0 ? void 0 : _c.membros_uids) || []).filter((u) => !(d.partes_uids || []).includes(u))) {
                porPessoa.set(uid, [...(porPessoa.get(uid) || []), linha]);
                sinoPorPessoa.set(uid, [...(sinoPorPessoa.get(uid) || []), { id: p.id, numero: String(d.numero), venc }]);
            }
        }
        // Sino: um aviso por processo com prazo vencendo ou vencido (sem e-mail, que vai abaixo).
        for (const [uid, itens] of sinoPorPessoa) {
            for (const it of itens.slice(0, 20)) {
                await (0, avisosEquipe_1.notificarPessoas)(db, orgId, [uid], {
                    subtipo: 'prazo', procId: it.id, soSino: true,
                    titulo: `Prazo ${it.venc < hoje ? 'vencido' : 'vencendo'} no processo ${it.numero}`,
                    mensagem: `${it.venc < hoje ? 'Venceu' : 'Vence'} em ${br(it.venc)}`, html: '',
                });
            }
        }
        for (const [uid, linhas] of porPessoa) {
            const mem = (await db.collection('userOrganizations').doc(`${uid}_${orgId}`).get()).data();
            const email = mem === null || mem === void 0 ? void 0 : mem.user_email;
            if (!email)
                continue;
            await (0, email_1.sendEmail)({
                to: String(email),
                subject: `Processo Eletrônico: ${linhas.length} prazo(s) vencendo ou vencido(s)`,
                html: `<p>Processos com a sua unidade em ${escapar(String(((_d = org.data()) === null || _d === void 0 ? void 0 : _d.name) || ''))}:</p><ul>${linhas.slice(0, 50).join('')}</ul>${linhas.length > 50 ? `<p>… e mais ${linhas.length - 50}.</p>` : ''}<p><a href="${autos_1.APP_URL}/ProcessoEletronico?org=${orgId}">Abrir o Processo Eletrônico</a></p><p style="color:#64748b;font-size:12px">O administrador do órgão liga ou desliga este aviso em Painel Administrativo → Processo Eletrônico → Calendário.</p>`,
            }).catch(() => false);
        }
    }
    await (0, avisosEquipe_1.enviarResumosDiarios)(db);
});
//# sourceMappingURL=conferir.js.map