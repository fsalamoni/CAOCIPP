"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACOES_FORNECEDOR = exports.ACOES_CERTAME = exports.COL_CERTAMES = void 0;
exports.acaoCertame = acaoCertame;
exports.acaoFornecedor = acaoFornecedor;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const exigencias_1 = require("../shared/exigencias");
const permissoesFase_1 = require("../shared/permissoesFase");
const certames_1 = require("../shared/certames");
const salaLances_1 = require("./salaLances");
const email_1 = require("../shared/email");
const config_1 = require("./config");
const context_1 = require("./context");
exports.COL_CERTAMES = 'secCertames';
const COL_ACESSOS = 'secPortalAcessos';
exports.ACOES_CERTAME = ['certameLer', 'certameSalvar', 'certamePublicar', 'certameAdiar', 'certameCancelar', 'certameConvidar', 'certameRevogarConvite', 'certamePropostas', ...salaLances_1.ACOES_SALA_ORGAO];
exports.ACOES_FORNECEDOR = ['disputaMinhas', 'disputaAviso', 'disputaConvite', 'disputaParticipar', 'disputaProposta', 'disputaRetirar', ...salaLances_1.ACOES_SALA_FORNECEDOR];
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const CONVITE_DIAS = 60;
const brData = (s) => s.split('-').reverse().join('/');
const quando = (iso) => {
    const d = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
    return `${brData(d.slice(0, 10))}, às ${d.slice(11, 16)}`;
};
const linkDoAviso = (codigo) => `${APP_URL}/Disputas?c=${codigo}`;
/** A ação `disputa` da fase atual que ainda pede o certame (ou a do certame em curso). */
function acaoDaDisputa(proc, idx) {
    var _a;
    const fase = (proc.fases || []).find((f) => f.id === proc.fase_atual);
    if (!fase)
        return null;
    const feitas = (proc.acoes_feitas || {})[fase.id] || [];
    const resp = (0, exigencias_1.respostasDaFase)(proc);
    const lista = (fase.acoes_regras || []).map((r, i) => ({ r, i }))
        .filter(({ r, i }) => (r === null || r === void 0 ? void 0 : r.pede) === 'disputa' && !feitas.includes(i) && (0, exigencias_1.acaoAtiva)(fase, i, resp) && (idx === undefined || i === idx));
    const a = lista[0];
    return a ? { fase, idx: a.i, regra: a.r, acao: ((_a = fase.acoes) === null || _a === void 0 ? void 0 : _a[a.i]) || 'Disputa de preços' } : null;
}
async function calendario(db, orgId) {
    var _a;
    return (0, secretaria_1.sanitizeCalendario)((_a = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _a === void 0 ? void 0 : _a.calendario);
}
function semSegredos(id, x) {
    const { convites, fornecedores_uids: _f, convites_hashes: _h } = x, resto = __rest(x, ["convites", "fornecedores_uids", "convites_hashes"]);
    return Object.assign(Object.assign({ id }, resto), { convites: (convites || []).map((_a) => {
            var { hash: _h, uid: _u } = _a, v = __rest(_a, ["hash", "uid"]);
            return (Object.assign(Object.assign({}, v), { aceito: !!v.aceito_em }));
        }), situacao_nome: certames_1.SITUACOES_CERTAME[x.situacao] });
}
/** Aviso para o fornecedor: só o que é público (sem convites, sem e-mails, sem valor estimado se sigiloso). */
function avisoPublico(id, x) {
    return {
        id, perfil: x.perfil, perfil_nome: certames_1.PERFIS_DISPUTA[x.perfil], orgao_nome: x.orgao_nome, unidade_nome: x.unidade_nome, processo_numero: x.processo_numero,
        situacao: x.situacao, situacao_nome: certames_1.SITUACOES_CERTAME[x.situacao], objeto: x.objeto, criterio: x.criterio, unidade_disputa: x.unidade_disputa,
        itens: x.itens.map((i) => (x.orcamento_sigiloso ? Object.assign(Object.assign({}, i), { valor_estimado: undefined }) : i)),
        orcamento_sigiloso: x.orcamento_sigiloso, intervalo: x.intervalo, lances: x.lances, horas_lances: x.horas_lances,
        abertura_data: x.abertura_data, abertura_hora: x.abertura_hora, abertura_em: x.abertura_em, condicoes: x.condicoes, habilitacao: x.habilitacao,
        participacao: x.perfil === 'cotacao' ? 'convidados' : 'aberta', codigo: x.codigo, adiamentos: (x.adiamentos || []).map((_a) => {
            var { por: _p } = _a, a = __rest(_a, ["por"]);
            return a;
        }),
        cancelado: x.cancelado ? { motivo: x.cancelado.motivo, em: x.cancelado.em } : undefined,
        fim_lances: (0, certames_1.fimDosLances)(x), momento: x.situacao === 'publicado' ? (0, certames_1.momentoDaDisputa)(x, new Date().toISOString()) : null,
    };
}
async function acaoCertame(c, p) {
    var _a, _b;
    if (salaLances_1.ACOES_SALA_ORGAO.includes(String(p.action)))
        return (0, salaLances_1.acaoSalaOrgao)(c, p, (data) => { var _a; return ((_a = data.certame) === null || _a === void 0 ? void 0 : _a.id) || null; });
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const col = c.db.collection(exports.COL_CERTAMES);
    if (p.action === 'certameLer' || p.action === 'certamePropostas') {
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.processo_id);
        const atual = data.certame;
        const alvo = acaoDaDisputa(data);
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        const podeCumprir = !!alvo && (!alvo.regra.quem || (0, permissoesFase_1.podeQuem)(alvo.regra.quem, alvo.regra.atribuicao, (0, context_1.atorDe)(c, data)));
        const cal = await calendario(c.db, c.orgId);
        const hoje = (0, secretaria_1.hojeBrasil)();
        const snap = atual ? await col.doc(atual.id).get() : null;
        const x = (snap === null || snap === void 0 ? void 0 : snap.exists) ? snap.data() : null;
        if (p.action === 'certamePropostas') {
            if (!x || !atual)
                throw new https_1.HttpsError('not-found', 'Disputa não encontrada');
            if (!x.abertura_em || x.abertura_em > new Date().toISOString() || x.situacao === 'cancelado' || x.situacao === 'rascunho') {
                throw new https_1.HttpsError('failed-precondition', 'As propostas são sigilosas até a abertura');
            }
            if (x.lances) {
                if ((0, certames_1.momentoDaDisputa)(x, new Date().toISOString()) !== 'encerrada')
                    throw new https_1.HttpsError('failed-precondition', 'Os lances ainda estão em curso: a classificação sai no fim');
                return classificacaoComLances(c, ref, atual.id, x);
            }
            const ps = await col.doc(atual.id).collection('propostas').get();
            const propostas = ps.docs.map((d) => d.data());
            const desc = x.criterio === 'maior_desconto';
            return {
                unidades: (0, certames_1.unidadesDeDisputa)(x).map((u) => ({
                    chave: u.chave, nome: u.nome,
                    classificacao: propostas.map((pr) => ({ fornecedor: pr.licitante.razao_social, documento: pr.licitante.documento, porte: pr.licitante.porte, valor: (0, certames_1.valorNaUnidade)(pr, u, x.criterio), enviada_em: pr.atualizada_em }))
                        .filter((v) => v.valor != null)
                        // Empate: vale quem registrou antes (IN 67/2021, art. 12, § 1º).
                        .sort((a, b) => (desc ? b.valor - a.valor : a.valor - b.valor) || a.enviada_em.localeCompare(b.enviada_em)),
                })),
            };
        }
        return {
            processo: { id: ref.id, numero: data.numero || '', assunto: data.assunto || '' },
            acao: alvo ? { fase_id: alvo.fase.id, acao_idx: alvo.idx, nome: alvo.acao, perfil: ((_a = alvo.regra.disputa) === null || _a === void 0 ? void 0 : _a.perfil) || 'cotacao' } : null,
            certame: x && atual ? Object.assign(Object.assign({}, semSegredos(atual.id, x)), { aviso: (0, certames_1.textoDoAviso)(x.perfil, x, x.processo_numero, x.unidade_nome), valor_estimado: (0, certames_1.valorEstimado)(x.itens), link: x.codigo ? linkDoAviso(x.codigo) : null }) : null,
            abertura_minima: (0, certames_1.aberturaMinima)(((x === null || x === void 0 ? void 0 : x.perfil) || ((_b = alvo === null || alvo === void 0 ? void 0 : alvo.regra.disputa) === null || _b === void 0 ? void 0 : _b.perfil) || 'cotacao'), hoje, cal),
            hoje,
            agora: new Date().toISOString(),
            momento: x && x.situacao === 'publicado' ? (0, certames_1.momentoDaDisputa)(x, new Date().toISOString()) : null,
            declaracoes: certames_1.DECLARACOES.map(([id, t, o]) => ({ id, texto: t, obrigatoria: o })),
            pode: {
                editar: posse && podeCumprir && (!x || x.situacao === 'rascunho' || x.situacao === 'cancelado'),
                gerir: posse && !!x && !!atual && (x.situacao === 'publicado' || x.situacao === 'rascunho') && (!x.abertura_em || x.abertura_em > new Date().toISOString()),
            },
            motivo: !alvo && !x ? 'A fase atual não tem ação de disputa de preços pendente.' : !posse ? 'O processo não está com uma unidade em que você esteja lotado.' : !podeCumprir && (alvo === null || alvo === void 0 ? void 0 : alvo.regra.quem) ? `A disputa é de ${(0, permissoesFase_1.textoQuem)(alvo.regra.quem, alvo.regra.atribuicao)}.` : '',
        };
    }
    let email = null;
    let convite = null;
    const r = await c.db.runTransaction(async (tx) => {
        var _a, _b, _c;
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.processo_id, tx);
        (0, context_1.exigirPosse)(c, data);
        const atual = data.certame;
        const cref = atual ? col.doc(atual.id) : null;
        const x = cref ? (await tx.get(cref)).data() : undefined;
        const agora = new Date().toISOString();
        const viva = x && x.situacao !== 'cancelado' ? x : undefined;
        if (p.action === 'certameSalvar') {
            const alvo = acaoDaDisputa(data, viva ? viva.acao_idx : undefined);
            if (!alvo)
                throw new https_1.HttpsError('failed-precondition', 'A fase atual não tem ação de disputa de preços pendente');
            if (alvo.regra.quem && !(0, permissoesFase_1.podeQuem)(alvo.regra.quem, alvo.regra.atribuicao, (0, context_1.atorDe)(c, data))) {
                throw new https_1.HttpsError('permission-denied', `"${alvo.acao}" é de ${(0, permissoesFase_1.textoQuem)(alvo.regra.quem, alvo.regra.atribuicao)}.`);
            }
            if (viva && viva.situacao !== 'rascunho')
                throw new https_1.HttpsError('failed-precondition', 'A disputa já foi publicada: o aviso não muda (adie ou cancele, se for o caso)');
            const perfil = (((_a = alvo.regra.disputa) === null || _a === void 0 ? void 0 : _a.perfil) || 'cotacao');
            let dados = null;
            try {
                dados = (0, certames_1.sanitizeDadosCertame)(p.dados, perfil);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            if (viva && cref) {
                tx.update(cref, Object.assign(Object.assign({}, dados), { version: (viva.version || 0) + 1, atualizado_em: agora }));
                return { ok: true, certame_id: cref.id };
            }
            const nref = col.doc();
            const un = (await tx.get(c.db.collection(context_1.COL.unidades).doc(String(data.unidade_atual)))).data();
            const novo = Object.assign(Object.assign({}, dados), { organization_id: c.orgId, orgao_nome: String(c.org.name || ''), processo_id: ref.id, processo_numero: String(data.numero || ''), unidade_id: String(data.unidade_atual), unidade_nome: String((un === null || un === void 0 ? void 0 : un.nome) || ''), fase_id: alvo.fase.id, acao_idx: alvo.idx, acao: alvo.acao, perfil, situacao: 'rascunho', criado_em: agora, criado_por: quem, convites: [], fornecedores_uids: [], propostas_n: 0, version: 1 });
            tx.set(nref, novo);
            const resumo = { id: nref.id, situacao: 'rascunho', perfil, fase_id: alvo.fase.id, acao_idx: alvo.idx };
            tx.update(ref, { certame: resumo });
            return { ok: true, certame_id: nref.id, auditoria: 'SECRETARIA_SESSAO_DISPUTA_CRIADA' };
        }
        if (!viva || !cref || !atual)
            throw new https_1.HttpsError('not-found', 'Monte a disputa antes');
        const aberta = !!viva.abertura_em && viva.abertura_em <= agora;
        if (p.action === 'certamePublicar') {
            if (viva.situacao !== 'rascunho')
                throw new https_1.HttpsError('failed-precondition', 'A disputa já foi publicada');
            const cal = (0, secretaria_1.sanitizeCalendario)((_b = (await tx.get(c.db.collection(context_1.COL.config).doc(c.orgId))).data()) === null || _b === void 0 ? void 0 : _b.calendario);
            const falta = (0, certames_1.problemasParaPublicar)(viva, viva.perfil, (0, secretaria_1.hojeBrasil)(), cal);
            if (falta.length)
                throw new https_1.HttpsError('failed-precondition', `Antes de publicar: ${falta.join('; ')}`);
            const codigo = (0, certames_1.codigoDoAviso)((0, crypto_1.randomBytes)(8));
            const abertura_em = (0, certames_1.instanteDaAbertura)(viva);
            tx.update(cref, { situacao: 'publicado', codigo, abertura_em, publicado_em: agora, publicado_por: quem, version: viva.version + 1 });
            const aviso = (0, certames_1.textoDoAviso)(viva.perfil, viva, viva.processo_numero, viva.unidade_nome);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'disputa_publicada', `Aviso de ${certames_1.PERFIS_DISPUTA[viva.perfil].toLowerCase()} publicado. Propostas até ${quando(abertura_em)}${viva.perfil === 'dispensa' ? `, pelo link público ${linkDoAviso(codigo)}` : ', pelos fornecedores convidados'}.\n${aviso}`, { certame_id: cref.id, codigo });
            tx.update(ref, Object.assign(Object.assign({}, mov), { certame: Object.assign(Object.assign({}, atual), { situacao: 'publicado', abertura_em, codigo }) }));
            return { ok: true, codigo, link: linkDoAviso(codigo), auditoria: 'SECRETARIA_SESSAO_DISPUTA_PUBLICADA' };
        }
        if (p.action === 'certameAdiar') {
            if (viva.situacao !== 'publicado' || aberta)
                throw new https_1.HttpsError('failed-precondition', 'Só se adia a abertura de disputa publicada, antes da abertura');
            const motivo = (0, secretaria_1.texto)(p.motivo, 1000);
            if (motivo.length < 5)
                throw new https_1.HttpsError('invalid-argument', 'Diga o motivo do adiamento (ao menos 5 letras)');
            let novos = null;
            try {
                novos = (0, certames_1.sanitizeDadosCertame)(Object.assign(Object.assign({}, viva), { abertura_data: p.abertura_data, abertura_hora: p.abertura_hora }), viva.perfil);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const para = (0, certames_1.instanteDaAbertura)(novos);
            if (para <= viva.abertura_em)
                throw new https_1.HttpsError('invalid-argument', 'A nova abertura precisa ser depois da atual');
            const cal = (0, secretaria_1.sanitizeCalendario)((_c = (await tx.get(c.db.collection(context_1.COL.config).doc(c.orgId))).data()) === null || _c === void 0 ? void 0 : _c.calendario);
            const falta = (0, certames_1.problemasParaPublicar)(novos, viva.perfil, (0, secretaria_1.hojeBrasil)(), cal).filter((f) => /abertura/.test(f));
            if (falta.length)
                throw new https_1.HttpsError('failed-precondition', falta.join('; '));
            const adiamentos = [...(viva.adiamentos || []), { de: viva.abertura_em, para, motivo, em: agora, por: quem.nome }];
            tx.update(cref, { abertura_data: novos.abertura_data, abertura_hora: novos.abertura_hora, abertura_em: para, adiamentos, version: viva.version + 1 });
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'disputa_adiada', `Abertura da ${certames_1.PERFIS_DISPUTA[viva.perfil].toLowerCase()} adiada de ${quando(viva.abertura_em)} para ${quando(para)}: ${motivo.replace(/[.\s]+$/, '')}.`, { certame_id: cref.id });
            tx.update(ref, Object.assign(Object.assign({}, mov), { certame: Object.assign(Object.assign({}, atual), { abertura_em: para }) }));
            email = { id: cref.id, uids: viva.fornecedores_uids || [], assunto: `Abertura adiada: ${viva.objeto.slice(0, 60)}`, corpo: `A abertura da disputa do processo ${viva.processo_numero} foi adiada para ${quando(para)} (horário de Brasília). Motivo: ${motivo}` };
            return { ok: true, auditoria: 'SECRETARIA_SESSAO_DISPUTA_ADIADA' };
        }
        if (p.action === 'certameCancelar') {
            if (aberta && viva.situacao !== 'rascunho')
                throw new https_1.HttpsError('failed-precondition', 'A disputa já foi aberta: o desfecho sai pelo julgamento');
            const motivo = (0, secretaria_1.texto)(p.motivo, 1000);
            if (viva.situacao !== 'rascunho' && motivo.length < 5)
                throw new https_1.HttpsError('invalid-argument', 'Diga o motivo do cancelamento (ao menos 5 letras)');
            if (viva.situacao === 'rascunho') {
                // Rascunho não chegou a ninguém: some sem deixar rastro nos autos.
                tx.delete(cref);
                tx.update(ref, { certame: firestore_1.FieldValue.delete() });
                return { ok: true };
            }
            tx.update(cref, { situacao: 'cancelado', cancelado: { motivo, em: agora, por: quem.nome }, version: viva.version + 1 });
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'disputa_cancelada', `${certames_1.PERFIS_DISPUTA[viva.perfil]} cancelada antes da abertura: ${motivo.replace(/[.\s]+$/, '')}.`, { certame_id: cref.id });
            tx.update(ref, Object.assign(Object.assign({}, mov), { certame: firestore_1.FieldValue.delete() }));
            email = { id: cref.id, uids: viva.fornecedores_uids || [], assunto: `Disputa cancelada: ${viva.objeto.slice(0, 60)}`, corpo: `A disputa do processo ${viva.processo_numero} foi cancelada. Motivo: ${motivo}` };
            return { ok: true, auditoria: 'SECRETARIA_SESSAO_DISPUTA_CANCELADA' };
        }
        if (p.action === 'certameConvidar') {
            if (viva.situacao !== 'publicado' || aberta)
                throw new https_1.HttpsError('failed-precondition', 'Convida-se depois de publicar o aviso e antes da abertura');
            const nome = (0, secretaria_1.texto)(p.nome, 200);
            const em = (0, secretaria_1.texto)(p.email, 120).toLowerCase();
            if (nome.length < 3)
                throw new https_1.HttpsError('invalid-argument', 'Informe o nome do fornecedor');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
                throw new https_1.HttpsError('invalid-argument', 'E-mail inválido');
            const ativos = (viva.convites || []).filter((v) => !v.revogado);
            if (ativos.length >= certames_1.MAX_CONVITES)
                throw new https_1.HttpsError('failed-precondition', `Até ${certames_1.MAX_CONVITES} convites por disputa`);
            if (ativos.some((v) => v.email === em))
                throw new https_1.HttpsError('already-exists', 'Este e-mail já foi convidado');
            const token = (0, crypto_1.randomBytes)(24).toString('base64url');
            const v = { id: c.db.collection('_').doc().id, nome, email: em, hash: (0, secretaria_1.sha256)(token), criado_em: agora };
            tx.update(cref, { convites: [...(viva.convites || []), v], convites_hashes: firestore_1.FieldValue.arrayUnion(v.hash) });
            convite = { token, email: em, nome, certame: viva };
            return { ok: true, convite_id: v.id };
        }
        if (p.action === 'certameRevogarConvite') {
            const lista = [...(viva.convites || [])];
            const k = lista.findIndex((v) => v.id === p.convite_id);
            if (k < 0)
                throw new https_1.HttpsError('not-found', 'Convite não encontrado');
            if (lista[k].aceito_em)
                throw new https_1.HttpsError('failed-precondition', 'O fornecedor já aceitou o convite: a participação dele fica');
            lista[k] = Object.assign(Object.assign({}, lista[k]), { revogado: true });
            tx.update(cref, { convites: lista });
            return { ok: true };
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    const _c = r, { auditoria } = _c, resto = __rest(_c, ["auditoria"]);
    if (auditoria)
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, auditoria, { processo_id: p.processo_id });
    const e = email;
    if (e)
        void avisarPorEmail(c.db, e.id, e.uids, e.assunto, e.corpo);
    const cv = convite;
    if (cv) {
        const link = `${APP_URL}/Disputas?convite=${cv.token}`;
        const enviado = await (0, email_1.sendEmail)({
            to: cv.email,
            subject: `Convite para ${certames_1.PERFIS_DISPUTA[cv.certame.perfil].toLowerCase()}: ${cv.certame.objeto.slice(0, 80)}`,
            html: `<p>Olá, ${escapar(cv.nome)}.</p><p>${escapar(cv.certame.orgao_nome || 'O órgão')} convida você a enviar proposta para <b>${escapar(cv.certame.objeto)}</b> (processo ${escapar(cv.certame.processo_numero)}).</p><p>Propostas até ${escapar(quando(cv.certame.abertura_em))} (horário de Brasília).</p><p><a href="${link}">Ver o aviso e enviar a proposta</a> (o convite vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false);
        return Object.assign(Object.assign({}, resto), { link, emailEnviado: enviado });
    }
    return resto;
}
/**
 * Classificação depois da fase de lances: as posições finais da sala, com os
 * nomes. Na primeira leitura depois do fim, registra nos autos o encerramento
 * dos lances (melhor oferta de cada item ou lote, sem nomes: o julgamento os dá).
 */
async function classificacaoComLances(c, pref, id, x0) {
    const ref = c.db.collection(exports.COL_CERTAMES).doc(id);
    return c.db.runTransaction(async (tx) => {
        const [x, pdata] = await Promise.all([tx.get(ref).then((s) => s.data() || x0), tx.get(pref).then((s) => s.data())]);
        const { estado: e, novo } = await (0, salaLances_1.lerEstado)(c.db, ref, x, tx);
        const ps = await tx.get(ref.collection('propostas'));
        const props = new Map(ps.docs.map((d) => [d.id, d.data()]));
        const unidades = (0, certames_1.unidadesDeDisputa)(x).map((u) => ({
            chave: u.chave, nome: u.nome,
            classificacao: (e.posicoes[u.chave] || []).map((v) => {
                const pr = props.get(v.uid);
                return { fornecedor: (pr === null || pr === void 0 ? void 0 : pr.licitante.razao_social) || `Licitante ${e.apelidos[v.uid]}`, documento: (pr === null || pr === void 0 ? void 0 : pr.licitante.documento) || '', porte: pr === null || pr === void 0 ? void 0 : pr.licitante.porte, valor: v.total, lance: v.valor, por_lance: v.seq > 0, enviada_em: v.em };
            }),
        }));
        if (!e.encerramento_registrado) {
            const linhas = unidades.map((u) => {
                const n = (e.posicoes[u.chave] || []).length;
                return `${u.nome}: ${u.classificacao[0] ? `melhor oferta ${(0, certames_1.valorTexto)(u.classificacao[0].valor, x)}` : 'sem oferta'} (${n} licitante${n === 1 ? '' : 's'}).`;
            });
            const mov = (0, context_1.registrarMovimento)(tx, c, pref, pdata, 'disputa_lances_encerrados', `Encerrada a fase de lances da ${certames_1.PERFIS_DISPUTA[x.perfil].toLowerCase()} em ${quando((0, certames_1.fimDosLances)(x))}, com ${e.seq} lance${e.seq === 1 ? '' : 's'}.\n${linhas.join('\n')}`, { certame_id: id });
            tx.update(pref, mov);
            e.encerramento_registrado = true;
            tx.set(ref.collection('sala').doc('estado'), e);
        }
        else if (novo)
            tx.set(ref.collection('sala').doc('estado'), e);
        return { unidades, lances: e.seq };
    });
}
/** E-mail a quem participa (fora da transação; a falha de envio não desfaz o ato). */
async function avisarPorEmail(db, certameId, uids, assunto, corpo) {
    if (!uids.length)
        return;
    const props = await db.getAll(...uids.slice(0, certames_1.MAX_FORNECEDORES).map((u) => db.collection(exports.COL_CERTAMES).doc(certameId).collection('participantes').doc(u)));
    const emails = [...new Set(props.map((d) => { var _a; return String(((_a = d.data()) === null || _a === void 0 ? void 0 : _a.email) || ''); }).filter(Boolean))];
    await Promise.all(emails.map((to) => (0, email_1.sendEmail)({ to, subject: assunto, html: `<p>${escapar(corpo)}</p><p><a href="${APP_URL}/Disputas?d=${certameId}">Abrir a disputa</a></p>` }).catch(() => false)));
}
// ─── Fornecedor ────────────────────────────────────────────────────────────
const orgaoAtivo = (o) => { var _a, _b; return ((_a = o === null || o === void 0 ? void 0 : o.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) === true && ((_b = o === null || o === void 0 ? void 0 : o.secretariaConfig) === null || _b === void 0 ? void 0 : _b.suspensa_plataforma) !== true; };
async function lerCertame(db, id, tx) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
        throw new https_1.HttpsError('invalid-argument', 'Disputa inválida');
    const ref = db.collection(exports.COL_CERTAMES).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const x = snap.data();
    if (!x || x.situacao === 'rascunho')
        throw new https_1.HttpsError('not-found', 'Disputa não encontrada');
    const org = (await db.collection('organizations').doc(x.organization_id).get()).data();
    if (!orgaoAtivo(org))
        throw new https_1.HttpsError('failed-precondition', 'O Processo Eletrônico deste órgão está desativado');
    return { ref, x };
}
/** Quem participa e o que mandou. `participantes/{uid}` guarda o e-mail da conta (para avisos) e o cadastro. */
async function minhaParte(ref, uid, tx) {
    const [pa, pr] = tx ? await Promise.all([tx.get(ref.collection('participantes').doc(uid)), tx.get(ref.collection('propostas').doc(uid))])
        : await Promise.all([ref.collection('participantes').doc(uid).get(), ref.collection('propostas').doc(uid).get()]);
    return { participante: pa.data(), proposta: pr.data() };
}
async function acaoFornecedor(db, auth, p) {
    var _a, _b;
    const uid = auth.uid;
    const emailConta = String(auth.token.email || '');
    const agora = () => new Date().toISOString();
    if (salaLances_1.ACOES_SALA_FORNECEDOR.includes(String(p.action)))
        return (0, salaLances_1.acaoSalaFornecedor)(db, uid, p, lerCertame);
    if (p.action === 'disputaMinhas') {
        const snap = await db.collection(exports.COL_CERTAMES).where('fornecedores_uids', 'array-contains', uid).limit(200).get();
        const perfil = ((_a = (await db.collection(COL_ACESSOS).doc(uid).get()).data()) === null || _a === void 0 ? void 0 : _a.fornecedor) || null;
        return {
            perfil,
            disputas: snap.docs.map((d) => avisoPublico(d.id, d.data()))
                .sort((a, b) => String(b.abertura_em || '').localeCompare(String(a.abertura_em || ''))),
        };
    }
    if (p.action === 'disputaAviso') {
        let id = p.certame_id;
        if (typeof p.codigo === 'string') {
            const cod = p.codigo.trim().toUpperCase();
            if (!/^[A-Z0-9]{8}$/.test(cod))
                throw new https_1.HttpsError('invalid-argument', 'Código do aviso inválido');
            const q = await db.collection(exports.COL_CERTAMES).where('codigo', '==', cod).limit(1).get();
            if (q.empty)
                throw new https_1.HttpsError('not-found', 'Aviso não encontrado');
            id = q.docs[0].id;
        }
        const { ref, x } = await lerCertame(db, id);
        const participa = (x.fornecedores_uids || []).includes(uid);
        // Cotação privada: só quem foi convidado vê o aviso.
        if (x.perfil === 'cotacao' && !participa)
            throw new https_1.HttpsError('not-found', 'Aviso não encontrado');
        const { proposta } = participa ? await minhaParte(ref, uid) : { proposta: undefined };
        const perfil = ((_b = (await db.collection(COL_ACESSOS).doc(uid).get()).data()) === null || _b === void 0 ? void 0 : _b.fornecedor) || null;
        const aberta = !!x.abertura_em && x.abertura_em <= agora();
        return {
            aviso: avisoPublico(ref.id, x), participa, proposta: proposta || null, perfil, agora: agora(),
            alertas: proposta ? (0, certames_1.alertasDaProposta)(proposta, x) : [],
            declaracoes: certames_1.DECLARACOES.map(([i, t, o]) => ({ id: i, texto: t, obrigatoria: o })),
            pode: { participar: !participa && x.perfil === 'dispensa' && x.situacao === 'publicado' && !aberta, propor: participa && x.situacao === 'publicado' && !aberta },
        };
    }
    if (p.action === 'disputaConvite') {
        const token = String(p.convite || '');
        if (token.length < 20)
            throw new https_1.HttpsError('invalid-argument', 'Convite inválido');
        const hash = (0, secretaria_1.sha256)(token);
        const q = await db.collection(exports.COL_CERTAMES).where('convites_hashes', 'array-contains', hash).limit(1).get();
        const alvo = q.docs[0];
        if (!alvo)
            throw new https_1.HttpsError('not-found', 'Convite inválido');
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, alvo.id, tx);
            const lista = [...(x.convites || [])];
            const k = lista.findIndex((v) => v.hash === hash);
            const v = lista[k];
            if (!v || v.revogado)
                throw new https_1.HttpsError('failed-precondition', 'Este convite foi revogado');
            if (v.uid && v.uid !== uid)
                throw new https_1.HttpsError('failed-precondition', 'Este convite já foi usado por outra conta');
            if (!v.uid && Date.parse(v.criado_em) + CONVITE_DIAS * 86400e3 < Date.now())
                throw new https_1.HttpsError('deadline-exceeded', 'Convite vencido. Peça um novo ao órgão.');
            if (x.situacao === 'cancelado')
                throw new https_1.HttpsError('failed-precondition', 'Esta disputa foi cancelada');
            if (!v.uid) {
                lista[k] = Object.assign(Object.assign({}, v), { uid, aceito_em: agora() });
                tx.update(ref, { convites: lista, fornecedores_uids: firestore_1.FieldValue.arrayUnion(uid) });
                tx.set(ref.collection('participantes').doc(uid), { email: emailConta || v.email, desde: agora(), convite_id: v.id });
            }
            return { ok: true, certame_id: ref.id };
        });
    }
    if (p.action === 'disputaParticipar') {
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            if (x.perfil !== 'dispensa')
                throw new https_1.HttpsError('permission-denied', 'Esta disputa é só para convidados');
            if (x.situacao !== 'publicado' || (x.abertura_em && x.abertura_em <= agora()))
                throw new https_1.HttpsError('failed-precondition', 'O prazo de propostas terminou');
            if ((x.fornecedores_uids || []).includes(uid))
                return { ok: true, certame_id: ref.id };
            if ((x.fornecedores_uids || []).length >= certames_1.MAX_FORNECEDORES)
                throw new https_1.HttpsError('resource-exhausted', 'A disputa chegou ao limite de participantes');
            tx.update(ref, { fornecedores_uids: firestore_1.FieldValue.arrayUnion(uid) });
            tx.set(ref.collection('participantes').doc(uid), { email: emailConta, desde: agora() });
            return { ok: true, certame_id: ref.id };
        });
    }
    if (p.action === 'disputaProposta' || p.action === 'disputaRetirar') {
        const r = await db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            if (!(x.fornecedores_uids || []).includes(uid))
                throw new https_1.HttpsError('permission-denied', 'Participe da disputa antes de enviar proposta');
            if (x.situacao !== 'publicado' || !x.abertura_em || x.abertura_em <= agora())
                throw new https_1.HttpsError('failed-precondition', 'O prazo de propostas terminou');
            const { proposta } = await minhaParte(ref, uid, tx);
            const pref = ref.collection('propostas').doc(uid);
            if (p.action === 'disputaRetirar') {
                if (!proposta)
                    throw new https_1.HttpsError('not-found', 'Você não tem proposta nesta disputa');
                tx.delete(pref);
                tx.update(ref, { propostas_n: firestore_1.FieldValue.increment(-1) });
                return { ok: true, retirada: true };
            }
            let lic = null;
            let conteudo = null;
            try {
                lic = (0, certames_1.sanitizeLicitante)(p.licitante, emailConta);
                conteudo = (0, certames_1.sanitizeProposta)(p.proposta, x, lic);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const nova = Object.assign(Object.assign({ licitante: lic }, conteudo), { enviada_em: (proposta === null || proposta === void 0 ? void 0 : proposta.enviada_em) || agora(), atualizada_em: agora() });
            tx.set(pref, nova);
            if (!proposta)
                tx.update(ref, { propostas_n: firestore_1.FieldValue.increment(1) });
            // O cadastro fica para preencher a próxima disputa.
            tx.set(db.collection(COL_ACESSOS).doc(uid), { fornecedor: lic, updated_at: agora() }, { merge: true });
            return { ok: true, recibo: { em: nova.atualizada_em, itens: nova.itens.length, codigo: (0, secretaria_1.sha256)(JSON.stringify(nova)).slice(0, 12).toUpperCase() }, alertas: (0, certames_1.alertasDaProposta)(nova, x) };
        });
        return r;
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
}
//# sourceMappingURL=certames.js.map