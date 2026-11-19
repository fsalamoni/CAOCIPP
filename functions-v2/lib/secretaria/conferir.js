"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaAlertaPrazos = exports.DIAS_ALERTA = exports.secretariaConferir = exports.CONFERENCIAS_POR_HORA = void 0;
exports.tratarVencidos = tratarVencidos;
exports.respostasPorDecurso = respostasPorDecurso;
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const secretaria_1 = require("../shared/secretaria");
const efeitosFase_1 = require("../shared/efeitosFase");
const exigencias_1 = require("../shared/exigencias");
const prazosFase_1 = require("../shared/prazosFase");
const email_1 = require("../shared/email");
const autos_1 = require("./autos");
const context_1 = require("./context");
const arquivos_1 = require("./arquivos");
const portalAvisos_1 = require("./portalAvisos");
const avisosEquipe_1 = require("./avisosEquipe");
const comunicacoes_1 = require("./comunicacoes");
const processos_1 = require("./processos");
const context_2 = require("./context");
const votacao_1 = require("./votacao");
const painelAta_1 = require("./painelAta");
const portalAvisos_2 = require("./portalAvisos");
const vinculo_1 = require("../shared/vinculo");
const rotinas_1 = require("../shared/rotinas");
exports.CONFERENCIAS_POR_HORA = 60;
/**
 * Chamada pública: no máximo `limite` por hora por endereço de rede (guardado
 * só como hash). Freia quem tenta adivinhar códigos sem atrapalhar quem confere.
 */
async function limitarPorHora(chave, origem, limite) {
    const db = admin.firestore();
    const hora = new Date().toISOString().slice(0, 13);
    const id = `${chave}_${(0, crypto_1.createHash)('sha256').update(origem || 'sem-origem').digest('hex').slice(0, 32)}_${hora}`;
    const ref = db.collection(context_1.COL.limites).doc(id);
    const n = await db.runTransaction(async (tx) => {
        var _a;
        const atual = Number(((_a = (await tx.get(ref)).data()) === null || _a === void 0 ? void 0 : _a.n) || 0) + 1;
        tx.set(ref, { n: atual, expira_em: firestore_1.Timestamp.fromMillis(Date.now() + 2 * 3600 * 1000) });
        return atual;
    });
    if (n > limite)
        throw new https_1.HttpsError('resource-exhausted', 'Muitas consultas seguidas deste endereço. Tente de novo daqui a uma hora.');
}
/**
 * Conferência pública (sem login) de um documento juntado pelo código
 * impresso nas folhas. Responde só os dados da juntada: quem tem o código
 * tem o próprio documento.
 */
exports.secretariaConferir = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a, _b, _c, _d;
    const ip = String(((_b = (_a = request.rawRequest) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b['x-forwarded-for']) || '').split(',')[0].trim() || ((_c = request.rawRequest) === null || _c === void 0 ? void 0 : _c.ip) || '';
    await limitarPorHora('conferir', ip, exports.CONFERENCIAS_POR_HORA);
    const codigo = (0, autos_1.normalizarCodigo)((_d = request.data) === null || _d === void 0 ? void 0 : _d.codigo);
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
        // Saiu dos autos depois: a conferência diz, para ninguém tomar a cópia como peça vigente.
        desentranhado_em: v.desentranhado_em || null,
    };
});
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const br = (iso) => iso.split('-').reverse().join('/');
exports.DIAS_ALERTA = efeitosFase_1.ALERTA_PADRAO;
/**
 * Prazo aberto pela fase que venceu sem ser cumprido, quando o rito diz o que
 * fazer: marca o processo como urgente e avisa quem gere a unidade. Uma vez
 * por prazo (`vencido_tratado_em`). O registro é interno: prazo interno não vai
 * às partes. Devolve os prazos tratados, para o aviso.
 */
async function tratarVencidos(db, ref, hoje) {
    return db.runTransaction(async (tx) => {
        const proc = (await tx.get(ref)).data();
        if (!proc || proc.status !== 'em_tramitacao')
            return null;
        const vencidos = (0, prazosFase_1.vencidosATratar)(proc.prazos, hoje);
        if (!vencidos.length)
            return null;
        const prazos = (proc.prazos || []).map((x) => (vencidos.some((v) => v.id === x.id) ? Object.assign(Object.assign({}, x), { vencido_tratado_em: hoje }) : x));
        const urgencia = vencidos.some((x) => x.ao_vencer.urgente === true) && proc.urgente !== true;
        const gestores = vencidos.some((x) => x.ao_vencer.avisar_gestores === true);
        const c = { db, orgId: String(proc.organization_id), org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        const mov = (0, context_1.registrarMovimento)(tx, c, ref, proc, 'efeitos_fase', `${vencidos.map((x) => `Prazo vencido em ${br(x.vence_em)} sem cumprimento: ${x.descricao}.`).join(' ')} Pela regra do rito: ${[urgencia && 'o processo passa a tramitar com urgência', gestores && 'quem gere a unidade foi avisado'].filter(Boolean).join(' e ') || 'o processo já tramitava com urgência'}.`, Object.assign({ automatico: true, prazos: vencidos.map((x) => x.id) }, (0, exigencias_1.marcasDoDestino)('informacao')));
        tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { prazos }), (0, secretaria_1.derivados)((proc.pendencias || []), prazos)), (urgencia ? { urgente: true, urgencia: { motivo: `Prazo vencido em ${br(vencidos[0].vence_em)}: ${vencidos[0].descricao}`, por: 'Regra do rito', em: new Date().toISOString() } } : {})));
        return { proc, prazos: vencidos.filter((x) => x.ao_vencer.avisar_gestores === true) };
    });
}
/**
 * O prazo de resposta que o rito espera decorreu sem manifestação: certidão de
 * decurso (as partes são avisadas), ações do rito acertadas e, se a fase segue
 * sozinha, o avanço pela regra do rito.
 */
async function respostasPorDecurso(db, hoje = (0, secretaria_1.hojeBrasil)()) {
    // ponytail: até 1000 por dia (os que esperam resposta são poucos); paginar se passar disso.
    const snap = await db.collection(context_1.COL.processos).where('aguarda_resposta', '==', true).limit(1000).get();
    const sistemas = new Map();
    let certidoes = 0;
    for (const d of snap.docs) {
        const r = await (0, comunicacoes_1.certificarDecursos)(db, d.ref, hoje).catch((e) => { console.warn('[comunicacoes] decurso não certificado', d.id, e); return null; });
        if (!r)
            continue;
        certidoes += 1;
        if (r.movimentos)
            await (0, portalAvisos_2.avisarPartesDoMovimento)(db, d.id, undefined, r.movimentos).catch(() => undefined);
        if (!r.avancar)
            continue;
        if (!sistemas.has(r.orgId))
            sistemas.set(r.orgId, (0, context_2.contextoDoSistema)(db, r.orgId));
        const c = await sistemas.get(r.orgId);
        if (c)
            await (0, processos_1.avancarSozinho)(c, d.id);
    }
    return certidoes;
}
/**
 * Todo dia às 7h: para os órgãos que ligaram o alerta, avisa por e-mail os
 * lotados na unidade que tem o processo sobre prazos vencidos ou que vencem
 * em até 2 dias. Um e-mail por pessoa, com a lista.
 */
exports.secretariaAlertaPrazos = (0, scheduler_1.onSchedule)({ schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: context_1.REGION }, (0, rotinas_1.comRegistro)('secretariaAlertaPrazos', async () => {
    var _a, _b, _c, _d, _e;
    const db = admin.firestore();
    // Envios e entregas temporárias de arquivo que ficaram para trás.
    await (0, arquivos_1.limparTemporarios)().catch((e) => console.warn('[arquivos] limpeza dos temporários falhou', e));
    // Antes dos alertas: a ciência por decurso abre prazos que entram neles.
    await (0, comunicacoes_1.cienciaPorDecurso)(db).catch((e) => console.warn('[comunicacoes] ciência por decurso falhou', e));
    await respostasPorDecurso(db).catch((e) => console.warn('[comunicacoes] decurso do prazo de resposta falhou', e));
    // S7: sessões virtuais cuja votação terminou: o sistema apura e encerra.
    await (0, votacao_1.encerrarSessoesVirtuais)(db).catch((e) => console.warn('[sessoes] encerramento das sessões virtuais falhou', e));
    await (0, painelAta_1.lembrarSessoes)(db).catch((e) => console.warn('[sessoes] lembretes das sessões falharam', e));
    const hoje = (0, secretaria_1.hojeBrasil)();
    const limite = (0, secretaria_1.somarDias)(hoje, exports.DIAS_ALERTA);
    // Só campo único em faixa: dispensa índice composto.
    const snap = await db.collection(context_1.COL.processos).where('proximo_vencimento', '<=', limite).limit(2000).get();
    // Prazos com antecedência maior que a padrão (a fase do rito pede): o dia do alerta deles já chegou.
    const antecipados = await db.collection(context_1.COL.processos).where('proximo_alerta', '<=', hoje).limit(2000).get();
    const todos = [...snap.docs, ...antecipados.docs.filter((d) => !snap.docs.some((x) => x.id === d.id))];
    const porOrg = new Map();
    await (0, portalAvisos_1.lembrarPrazosDasPartes)(db, snap.docs.filter((d) => d.data().status === 'em_tramitacao')).catch(() => undefined);
    for (const d of todos) {
        if (d.data().status !== 'em_tramitacao')
            continue;
        const org = String(d.data().organization_id);
        porOrg.set(org, [...(porOrg.get(org) || []), d]);
    }
    for (const [orgId, procs] of porOrg) {
        const [cfg, org] = await Promise.all([db.collection(context_1.COL.config).doc(orgId).get(), db.collection('organizations').doc(orgId).get()]);
        const sc = ((_a = org.data()) === null || _a === void 0 ? void 0 : _a.secretariaConfig) || {};
        if (sc.enabled !== true || (0, vinculo_1.peSuspensoPlataforma)(org.data()))
            continue;
        const unidades = new Map((await db.collection(context_1.COL.unidades).where('organization_id', '==', orgId).get()).docs.map((u) => [u.id, u.data()]));
        // Regra do vencimento (do rito): vale mesmo com o alerta por e-mail do órgão desligado.
        for (const p of procs) {
            if (!(0, prazosFase_1.vencidosATratar)(p.data().prazos, hoje).length)
                continue;
            const t = await tratarVencidos(db, p.ref, hoje).catch((e) => { console.warn('[prazos] regra do vencimento falhou', p.id, e); return null; });
            const u = (t === null || t === void 0 ? void 0 : t.prazos.length) ? unidades.get(t.proc.unidade_atual) : null;
            if (!t || !u)
                continue;
            const gestores = (0, secretaria_1.lotacoesDe)(u).filter((l) => l.gestor).map((l) => l.uid).filter((uid) => !(t.proc.partes_uids || []).includes(uid));
            await (0, avisosEquipe_1.notificarPessoas)(db, orgId, gestores, {
                subtipo: 'prazo', procId: p.id,
                titulo: `Prazo vencido no processo ${t.proc.numero}`,
                mensagem: t.prazos.map((x) => `Venceu em ${br(x.vence_em)}: ${x.descricao}`).join(' · ').slice(0, 300),
                html: `<p>No processo <b>${escapar(String(t.proc.numero))}</b> (${escapar(String(t.proc.assunto || ''))}), que está com ${escapar(String(u.nome || 'a sua unidade'))}, venceu sem cumprimento:</p><ul>${t.prazos.map((x) => `<li>${escapar(String(x.descricao))}, em ${br(x.vence_em)}</li>`).join('')}</ul><p>O rito manda avisar quem gere a unidade.</p>`,
            });
        }
        if (((_b = cfg.data()) === null || _b === void 0 ? void 0 : _b.alerta_prazos) !== true)
            continue;
        const porPessoa = new Map();
        const sinoPorPessoa = new Map();
        for (const p of procs) {
            const d = p.data();
            // Só o prazo que já pede alerta: vencido ou dentro da antecedência dele (a da fase, ou 2 dias).
            const emAlerta = (0, prazosFase_1.prazosEmAlerta)(d.prazos, hoje);
            if (!emAlerta.length)
                continue;
            const venc = emAlerta[0].vence_em;
            const linha = `<li><b>${escapar(String(d.numero))}</b> — ${escapar(String(d.assunto || ''))}: prazo ${venc < hoje ? `<b>vencido em ${br(venc)}</b>` : `vence em ${br(venc)}`}</li>`;
            for (const uid of (((_c = unidades.get(d.unidade_atual)) === null || _c === void 0 ? void 0 : _c.membros_uids) || []).filter((u) => !(d.partes_uids || []).includes(u))) {
                porPessoa.set(uid, [...(porPessoa.get(uid) || []), linha]);
                sinoPorPessoa.set(uid, [...(sinoPorPessoa.get(uid) || []), { id: p.id, numero: String(d.numero), venc }]);
            }
        }
        // Sino: um aviso por processo com prazo vencendo ou vencido (sem e-mail, que vai abaixo).
        for (const [uid, itens] of sinoPorPessoa) {
            // O sino avisa até o dia seguinte ao vencimento; depois, só o e-mail diário lista o atraso.
            for (const it of itens.filter((x) => x.venc >= (0, secretaria_1.somarDias)(hoje, -1)).slice(0, 20)) {
                await (0, avisosEquipe_1.notificarPessoas)(db, orgId, [uid], {
                    subtipo: 'prazo', procId: it.id, soSino: true,
                    titulo: `Prazo ${it.venc < hoje ? 'vencido' : 'vencendo'} no processo ${it.numero}`,
                    mensagem: `${it.venc < hoje ? 'Venceu' : 'Vence'} em ${br(it.venc)}`, html: '',
                });
            }
        }
        for (const [uid, linhas] of porPessoa) {
            const [memSnap, prefSnap] = await Promise.all([
                db.collection('userOrganizations').doc(`${uid}_${orgId}`).get(),
                db.collection('userPreferences').doc(uid).get(),
            ]);
            const mem = memSnap.data();
            const email = mem === null || mem === void 0 ? void 0 : mem.user_email;
            // Quem escolheu "Nenhum e-mail" fica só com o sino; vínculo desativado não recebe nada.
            if (!email || (mem === null || mem === void 0 ? void 0 : mem.active) === false || (0, avisosEquipe_1.prefDe)((_d = prefSnap.data()) === null || _d === void 0 ? void 0 : _d.notificationPreferences).email === 'nenhum')
                continue;
            await (0, email_1.sendEmail)({
                to: String(email),
                subject: `Processo Eletrônico: ${linhas.length} prazo(s) vencendo ou vencido(s)`,
                html: `<p>Processos com a sua unidade em ${escapar(String(((_e = org.data()) === null || _e === void 0 ? void 0 : _e.name) || ''))}:</p><ul>${linhas.slice(0, 50).join('')}</ul>${linhas.length > 50 ? `<p>… e mais ${linhas.length - 50}.</p>` : ''}<p><a href="${autos_1.APP_URL}/ProcessoEletronico?org=${orgId}">Abrir o Processo Eletrônico</a></p><p style="color:#64748b;font-size:12px">O administrador do órgão liga ou desliga este aviso em Painel Administrativo → Processo Eletrônico → Calendário.</p>`,
            }).catch(() => false);
        }
    }
    await (0, avisosEquipe_1.enviarResumosDiarios)(db);
}));
//# sourceMappingURL=conferir.js.map