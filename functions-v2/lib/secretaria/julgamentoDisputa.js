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
exports.ACOES_JULGAMENTO_FORNECEDOR = exports.ACOES_JULGAMENTO_ORGAO = void 0;
exports.acaoJulgamentoOrgao = acaoJulgamentoOrgao;
exports.acaoJulgamentoFornecedor = acaoJulgamentoFornecedor;
/**
 * Julgamento da disputa de preços (S13): depois dos lances (ou da abertura,
 * sem lances), cada item ou lote passa por desempate de ME/EPP, análise da
 * proposta, negociação, convocação da proposta ajustada e dos documentos,
 * aceitação e habilitação (com recusa motivada e chamada do próximo). Com
 * tudo decidido, o órgão declara o vencedor e abre a intenção de recurso
 * (razões e contrarrazões em 3 dias úteis cada, decisão); por fim, registra o
 * resultado (homologada, deserta ou fracassada), a ata vai aos autos e a ação
 * do rito se cumpre sozinha, como o julgamento proclamado na sessão.
 *
 * O estado mora em `secCertames/{id}/sala/julgamento`. Cada ato do órgão
 * deixa aviso na conversa da sala (todos os licitantes leem) e os atos que
 * decidem (vencedor, recurso, resultado) entram nos autos. Antes de declarado
 * o vencedor, o licitante vê os outros por apelido.
 *
 * Órgão (secretariaProcesso): certameJulgamento (abre e lê), certameDesempate,
 *   certameNegociar, certameConvocar, certameArquivo, certameAceitar,
 *   certameRecusar, certameHabilitar, certameReabrir, certameDeclarar,
 *   certameDecidirRecurso, certameResultado.
 * Fornecedor (secretariaPortal): disputaJulgamento, disputaDesempate,
 *   disputaNegociar, disputaEnviarArquivo, disputaIntencao, disputaRazoes,
 *   disputaContrarrazoes.
 */
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const certames_1 = require("../shared/certames");
const config_1 = require("./config");
const context_1 = require("./context");
const salaLances_1 = require("./salaLances");
const certames_2 = require("./certames");
const processos_1 = require("./processos");
exports.ACOES_JULGAMENTO_ORGAO = ['certameJulgamento', 'certameDesempate', 'certameNegociar', 'certameConvocar', 'certameArquivo', 'certameAceitar',
    'certameRecusar', 'certameHabilitar', 'certameReabrir', 'certameDeclarar', 'certameDecidirRecurso', 'certameResultado'];
exports.ACOES_JULGAMENTO_FORNECEDOR = ['disputaJulgamento', 'disputaDesempate', 'disputaNegociar', 'disputaEnviarArquivo', 'disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'];
const TIPOS_ARQUIVO = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
const agora = () => new Date().toISOString();
const jref = (ref) => ref.collection('sala').doc('julgamento');
const quando = (iso) => {
    const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString();
    return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, às ${d.slice(11, 16)}`;
};
const apelido = (j, uid) => { var _a; return `Licitante ${((_a = j.licitantes[uid]) === null || _a === void 0 ? void 0 : _a.apelido) || '?'}`; };
const declarado = (j) => !!j.recurso || j.etapa === 'encerrado' || j.recursos_anteriores.length > 0;
const nomeComApelido = (j, uid) => { var _a; return `${((_a = j.licitantes[uid]) === null || _a === void 0 ? void 0 : _a.nome) || '?'} (${apelido(j, uid)})`; };
function exigirJulgavel(x, quando0 = agora()) {
    if (!x || (x.situacao !== 'publicado' && x.situacao !== 'encerrado'))
        throw new https_1.HttpsError('failed-precondition', 'A disputa não está em curso');
    if (!x.abertura_em || x.abertura_em > quando0)
        throw new https_1.HttpsError('failed-precondition', 'O julgamento começa depois da abertura');
    const fim = x.lances ? Date.parse(x.abertura_em) + x.horas_lances * 3600e3 : 0;
    if (x.situacao === 'publicado' && fim && Date.parse(quando0) < fim)
        throw new https_1.HttpsError('failed-precondition', 'Os lances ainda estão em curso: o julgamento começa no fim');
}
/** Monta o julgamento das posições finais (sala de lances) ou das propostas (sem lances). Só leituras. */
async function montar(db, ref, x, tx) {
    const ps = await tx.get(ref.collection('propostas'));
    const props = ps.docs.map((d) => ({ uid: d.id, p: d.data() })).sort((a, b) => a.p.enviada_em.localeCompare(b.p.enviada_em));
    let posicoes;
    let apelidos;
    let lances = 0;
    if (x.lances) {
        const { estado } = await (0, salaLances_1.lerEstado)(db, ref, x, tx);
        ({ posicoes, apelidos } = estado);
        lances = estado.seq;
    }
    else {
        posicoes = Object.fromEntries((0, certames_1.unidadesDeDisputa)(x).map((u) => [u.chave,
            (0, certames_1.ordenarPosicoes)(props.map(({ uid, p }) => (0, certames_1.posicaoDe)(uid, p, u, x, [])).filter((v) => !!v), x)]));
        apelidos = Object.fromEntries(props.map(({ uid }, i) => [uid, i + 1]));
    }
    const licitantes = Object.fromEntries(props.map(({ uid, p }) => [uid, { nome: p.licitante.razao_social, documento: p.licitante.documento, porte: p.licitante.porte, apelido: apelidos[uid] || 0 }]));
    const unidades = Object.fromEntries((0, certames_1.unidadesDeDisputa)(x).map((u) => [u.chave,
        (0, certames_1.abrirUnidade)((posicoes[u.chave] || []).map((v) => { var _a; return ({ uid: v.uid, valor: v.valor, total: v.total, em: v.em, porte: ((_a = licitantes[v.uid]) === null || _a === void 0 ? void 0 : _a.porte) || 'demais' }); }), x)]));
    return { etapa: 'julgamento', unidades, licitantes, recursos_anteriores: [], lances, aberto_em: agora() };
}
/** Sem intenção de recurso no prazo, o julgamento segue ao resultado. Devolve se mudou. */
function atualizarEtapa(j, t) {
    if (j.etapa === 'recurso' && j.recurso && (0, certames_1.momentoDoRecurso)(j.recurso, t) === 'sem_recurso') {
        j.etapa = 'resultado';
        return true;
    }
    return false;
}
function unidadeDe(j, x, chave) {
    const u0 = (0, certames_1.unidadesDeDisputa)(x).find((v) => v.chave === chave);
    const u = u0 && j.unidades[u0.chave];
    if (!u0 || !u)
        throw new https_1.HttpsError('invalid-argument', 'Item ou lote inexistente');
    return { u0, u };
}
const semPath = (u) => (u ? Object.assign(Object.assign({}, u), { arquivos: u.arquivos.map((_a) => {
        var { path: _p } = _a, a = __rest(_a, ["path"]);
        return a;
    }) }) : undefined);
async function acaoJulgamentoOrgao(c, p, classificar) {
    var _a;
    const db = c.db;
    const col = db.collection('secCertames');
    const idDe = (data) => { var _a; return ((_a = ((data.certame || data.ultimo_certame))) === null || _a === void 0 ? void 0 : _a.id) || null; };
    if (p.action === 'certameJulgamento' || p.action === 'certameArquivo') {
        const { ref: pref, data } = await (0, context_1.lerProcesso)(c, p.processo_id);
        const id = idDe(data);
        if (!id)
            throw new https_1.HttpsError('not-found', 'Disputa não encontrada');
        const ref = col.doc(id);
        const x = (await ref.get()).data();
        exigirJulgavel(x);
        if (p.action === 'certameArquivo') {
            const j = (await jref(ref).get()).data();
            if (!j)
                throw new https_1.HttpsError('not-found', 'Arquivo não encontrado');
            const { u } = unidadeDe(j, x, p.chave);
            const a = (_a = u.convocacao) === null || _a === void 0 ? void 0 : _a.arquivos.find((v) => v.id === p.arquivo_id);
            if (!a)
                throw new https_1.HttpsError('not-found', 'Arquivo não encontrado');
            const [buf] = await admin.storage().bucket().file(a.path).download();
            return { base64: buf.toString('base64'), nome: a.nome, mime: a.mime };
        }
        // Primeiro acesso depois dos lances: o encerramento vai aos autos (como na classificação).
        if (x.lances && x.situacao === 'publicado' && !(await jref(ref).get()).exists)
            await classificar(c, pref, id, x);
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        return db.runTransaction(async (tx) => {
            const [js, ms] = await Promise.all([tx.get(jref(ref)), tx.get(ref.collection('mensagens').orderBy('em', 'desc').limit(200))]);
            let j = js.data();
            const novo = !j;
            if (!j)
                j = await montar(db, ref, x, tx);
            const t = agora();
            if ((atualizarEtapa(j, t) || novo) && posse)
                tx.set(jref(ref), j);
            return vistaOrgao(x, j, ms.docs.map((d) => (Object.assign({ id: d.id }, d.data()))), posse, t);
        });
    }
    let email = null;
    let fechar = false;
    let procId = '';
    const r = await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d;
        const { ref: pref, data } = await (0, context_1.lerProcesso)(c, p.processo_id, tx);
        (0, context_1.exigirPosse)(c, data);
        procId = pref.id;
        const atual = (data.certame || data.ultimo_certame);
        if (!atual)
            throw new https_1.HttpsError('not-found', 'Disputa não encontrada');
        const ref = col.doc(atual.id);
        const [xs, js] = await Promise.all([tx.get(ref), tx.get(jref(ref))]);
        const x = xs.data();
        const t = agora();
        exigirJulgavel(x, t);
        const j = js.data();
        if (!j)
            throw new https_1.HttpsError('failed-precondition', 'Abra o julgamento antes');
        if (j.etapa === 'encerrado')
            throw new https_1.HttpsError('failed-precondition', 'A disputa já tem resultado');
        atualizarEtapa(j, t);
        const cal = (0, secretaria_1.sanitizeCalendario)((_a = (await tx.get(db.collection(context_1.COL.config).doc(c.orgId))).data()) === null || _a === void 0 ? void 0 : _a.calendario);
        const avisos = [];
        let mov = null;
        let extraProc = {};
        let auditoria = '';
        const todos = Object.keys(j.licitantes);
        const exigirJulgamento = () => { if (j.etapa !== 'julgamento')
            throw new https_1.HttpsError('failed-precondition', 'O vencedor já foi declarado: o julgamento só se refaz se o recurso for provido'); };
        if (['certameDesempate', 'certameNegociar', 'certameConvocar', 'certameAceitar', 'certameRecusar', 'certameHabilitar', 'certameReabrir'].includes(String(p.action))) {
            exigirJulgamento();
            const { u0, u } = unidadeDe(j, x, p.chave);
            const nome = u0.nome;
            if (p.action === 'certameDesempate') {
                if (u.situacao !== 'desempate' || !u.desempate)
                    throw new https_1.HttpsError('failed-precondition', 'Não há desempate pendente neste item ou lote');
                const at = u.desempate.atual;
                if (at && !at.recusou && t <= at.ate)
                    throw new https_1.HttpsError('failed-precondition', `Aguarde: ${apelido(j, at.uid)} tem até ${quando(at.ate).split(', às ')[1]} para a oferta`);
                if (at && !u.desempate.feitos.includes(at.uid))
                    u.desempate.feitos.push(at.uid);
                const prox = (0, certames_1.proximoDoDesempate)(u);
                if (prox) {
                    u.desempate.atual = { uid: prox, ate: new Date(Date.parse(t) + certames_1.MINUTOS_DESEMPATE * 60e3).toISOString() };
                    avisos.push(`Empate ficto em ${nome}: ${apelido(j, prox)} (ME/EPP) pode, em até ${certames_1.MINUTOS_DESEMPATE} minutos, oferecer ${x.criterio === 'maior_desconto' ? 'desconto maior' : 'valor menor'} que ${(0, certames_1.valorTexto)(u.ordem[0].total, x)}, pela própria disputa.`);
                    email = { uids: [prox], assunto: `Desempate: ${x.objeto.slice(0, 60)}`, corpo: `Você está em empate ficto (ME/EPP) em ${nome} da disputa do processo ${x.processo_numero} e tem ${certames_1.MINUTOS_DESEMPATE} minutos para cobrir a melhor oferta. Abra a disputa agora.` };
                }
                else {
                    j.unidades[u0.chave] = (0, certames_1.fimDoDesempate)(u);
                    avisos.push(`Desempate encerrado em ${nome} sem oferta melhor: segue em análise a proposta de ${apelido(j, j.unidades[u0.chave].vez)}.`);
                }
            }
            if (p.action === 'certameNegociar') {
                if (u.situacao !== 'analise' || !u.vez)
                    throw new https_1.HttpsError('failed-precondition', 'Negocia-se com quem está em análise');
                const msg = (0, secretaria_1.texto)(p.texto, 1000);
                if (msg.length < 5)
                    throw new https_1.HttpsError('invalid-argument', 'Escreva a contraproposta (ao menos 5 letras)');
                u.negociacao = { uid: u.vez, desde: t };
                avisos.push(`Negociação em ${nome} com ${apelido(j, u.vez)}: ${msg}`);
                email = { uids: [u.vez], assunto: `Negociação: ${x.objeto.slice(0, 60)}`, corpo: `O órgão abriu negociação em ${nome} da disputa do processo ${x.processo_numero}: ${msg}` };
            }
            if (p.action === 'certameConvocar') {
                if (!['analise', 'aceita'].includes(u.situacao) || !u.vez)
                    throw new https_1.HttpsError('failed-precondition', 'Convoca-se quem está em análise');
                const o_que = p.o_que === 'documentos' ? 'documentos' : 'proposta';
                const horas = Math.round((0, certames_1.num)(p.horas));
                if (!(horas >= certames_1.HORAS_CONVOCACAO[0] && horas <= certames_1.HORAS_CONVOCACAO[1]))
                    throw new https_1.HttpsError('invalid-argument', `O prazo é de ${certames_1.HORAS_CONVOCACAO[0]} a ${certames_1.HORAS_CONVOCACAO[1]} horas`);
                const ate = new Date(Date.parse(t) + horas * 3600e3).toISOString();
                const antes = ((_b = u.convocacao) === null || _b === void 0 ? void 0 : _b.uid) === u.vez ? u.convocacao.arquivos : [];
                u.convocacao = { uid: u.vez, o_que, ate, em: t, arquivos: antes };
                const oque = o_que === 'proposta' ? 'a proposta ajustada ao valor final' : 'os documentos de habilitação';
                avisos.push(`${apelido(j, u.vez)}: envie ${oque} de ${nome} até ${quando(ate)}, pela própria disputa.`);
                email = { uids: [u.vez], assunto: `Envie ${o_que === 'proposta' ? 'a proposta ajustada' : 'os documentos'}: ${x.objeto.slice(0, 50)}`, corpo: `O órgão pede ${oque} de ${nome} da disputa do processo ${x.processo_numero} até ${quando(ate)} (horário de Brasília).` };
            }
            if (p.action === 'certameAceitar') {
                if (u.situacao !== 'analise' || !u.vez)
                    throw new https_1.HttpsError('failed-precondition', 'Não há proposta em análise neste item ou lote');
                const c0 = u.ordem.find((v) => v.uid === u.vez);
                u.situacao = 'aceita';
                u.aceita = { uid: u.vez, total: c0.total, em: t, por: c.userName };
                delete u.negociacao;
                avisos.push(`Aceita em ${nome} a proposta de ${apelido(j, u.vez)} (${(0, certames_1.valorTexto)(c0.total, x)}). Segue a análise da habilitação.`);
            }
            if (p.action === 'certameRecusar') {
                if (!['analise', 'aceita'].includes(u.situacao) || !u.vez)
                    throw new https_1.HttpsError('failed-precondition', 'Não há proposta em análise neste item ou lote');
                const motivo = (0, secretaria_1.texto)(p.motivo, 2000);
                if (motivo.length < 10)
                    throw new https_1.HttpsError('invalid-argument', 'Diga o motivo (ao menos 10 letras): ele vai à conversa e à ata');
                const etapa = u.situacao === 'analise' ? 'proposta' : 'habilitacao';
                const saiu = u.vez;
                u.recusas.push({ uid: saiu, etapa, motivo, em: t, por: c.userName });
                delete u.aceita;
                delete u.negociacao;
                delete u.convocacao;
                // ponytail: não refaz o empate ficto para o novo primeiro; se a lei local pedir, chamar abrirUnidade de novo aqui.
                const prox = (0, certames_1.proximaVez)(u);
                u.vez = prox;
                u.situacao = prox ? 'analise' : 'fracassada';
                avisos.push(`${etapa === 'proposta' ? 'Recusada a proposta' : 'Inabilitado'} em ${nome}: ${apelido(j, saiu)}. Motivo: ${motivo.replace(/[.\s]+$/, '')}. ${prox ? `Segue em análise a proposta de ${apelido(j, prox)}, próxima classificada.` : `${nome} fracassou: não há outra proposta.`}`);
                auditoria = 'SECRETARIA_SESSAO_PROPOSTA_RECUSADA';
            }
            if (p.action === 'certameHabilitar') {
                if (u.situacao !== 'aceita' || !u.aceita)
                    throw new https_1.HttpsError('failed-precondition', 'Habilita-se depois de aceitar a proposta');
                u.situacao = 'habilitada';
                u.habilitada = { uid: u.aceita.uid, total: u.ordem.find((v) => v.uid === u.aceita.uid).total, em: t, por: c.userName };
                u.vez = null;
                avisos.push(`Habilitado em ${nome}: ${apelido(j, u.habilitada.uid)}.`);
            }
            if (p.action === 'certameReabrir') {
                const motivo = (0, secretaria_1.texto)(p.motivo, 2000);
                if (motivo.length < 10)
                    throw new https_1.HttpsError('invalid-argument', 'Diga o motivo da reabertura (ao menos 10 letras)');
                const alvo = u.ordem.find((v) => v.uid === p.uid);
                if (!alvo)
                    throw new https_1.HttpsError('invalid-argument', 'Licitante sem proposta neste item ou lote');
                u.recusas = u.recusas.filter((v) => v.uid !== alvo.uid);
                delete u.aceita;
                delete u.habilitada;
                delete u.negociacao;
                delete u.desempate;
                if (((_c = u.convocacao) === null || _c === void 0 ? void 0 : _c.uid) !== alvo.uid)
                    delete u.convocacao;
                u.situacao = 'analise';
                u.vez = alvo.uid;
                avisos.push(`Reaberto o julgamento de ${nome}: volta à análise a proposta de ${apelido(j, alvo.uid)}. Motivo: ${motivo.replace(/[.\s]+$/, '')}.`);
                auditoria = 'SECRETARIA_SESSAO_JULGAMENTO_REABERTO';
            }
        }
        const us = (0, certames_1.unidadesDeDisputa)(x).map((u0) => ({ nome: u0.nome, u: j.unidades[u0.chave] }));
        const quem = (uid) => { var _a; return ((_a = j.licitantes[uid]) === null || _a === void 0 ? void 0 : _a.nome) || apelido(j, uid); };
        const linhas = () => us.map(({ nome, u }) => (0, certames_1.linhaDaUnidade)(nome, u, quem, x)).join('\n');
        if (p.action === 'certameDeclarar') {
            exigirJulgamento();
            if (!(0, certames_1.julgamentoConcluido)(us.map((v) => v.u)))
                throw new https_1.HttpsError('failed-precondition', 'Decida antes todos os itens ou lotes (habilitado, fracassado ou deserto)');
            if (us.every((v) => v.u.situacao === 'deserta'))
                throw new https_1.HttpsError('failed-precondition', 'Ninguém propôs: registre o resultado (deserta) direto');
            const minutos = Math.round((0, certames_1.num)((_d = p.minutos) !== null && _d !== void 0 ? _d : certames_1.MINUTOS_INTENCAO[0]));
            if (!(minutos >= certames_1.MINUTOS_INTENCAO[0] && minutos <= certames_1.MINUTOS_INTENCAO[1]))
                throw new https_1.HttpsError('invalid-argument', `A intenção de recurso fica aberta de ${certames_1.MINUTOS_INTENCAO[0]} a ${certames_1.MINUTOS_INTENCAO[1]} minutos`);
            if (j.recurso)
                j.recursos_anteriores.push(j.recurso);
            const razoes_ate = (0, certames_1.fimDoPrazoUtil)((0, secretaria_1.hojeBrasil)(), 3, cal);
            j.recurso = {
                declarado_em: t, intencao_ate: new Date(Date.parse(t) + minutos * 60e3).toISOString(), razoes_ate,
                contrarrazoes_ate: (0, certames_1.fimDoPrazoUtil)((0, secretaria_1.hojeBrasil)(new Date(razoes_ate)), 3, cal), intencoes: [], contrarrazoes: [],
            };
            j.etapa = 'recurso';
            const txt = `Declarado o resultado do julgamento da ${certames_1.PERFIS_DISPUTA[x.perfil].toLowerCase()}:\n${linhas()}\nAberta a intenção de recurso até ${quando(j.recurso.intencao_ate)}; quem manifestar tem até ${quando(razoes_ate)} para as razões, e os demais, até ${quando(j.recurso.contrarrazoes_ate)} para as contrarrazões.`;
            mov = { tipo: 'disputa_vencedor_declarado', texto: txt };
            avisos.push(txt);
            email = { uids: todos, assunto: `Vencedor declarado: ${x.objeto.slice(0, 60)}`, corpo: `${txt}\nPara manifestar intenção de recurso, abra a disputa dentro do prazo.` };
            auditoria = 'SECRETARIA_SESSAO_VENCEDOR_DECLARADO';
        }
        if (p.action === 'certameDecidirRecurso') {
            const rr = j.recurso;
            if (j.etapa !== 'recurso' || !rr || (0, certames_1.momentoDoRecurso)(rr, t) !== 'decisao')
                throw new https_1.HttpsError('failed-precondition', 'O recurso se decide depois do prazo das contrarrazões (ou das razões, se ninguém arrazoou)');
            const provimento = String(p.provimento);
            if (!certames_1.PROVIMENTOS[provimento])
                throw new https_1.HttpsError('invalid-argument', 'Escolha a decisão do recurso');
            const fundamentos = (0, secretaria_1.texto)(p.fundamentos, 20000);
            if (fundamentos.length < 20)
                throw new https_1.HttpsError('invalid-argument', 'Fundamente a decisão (ao menos 20 letras)');
            rr.decisao = { provimento: provimento, fundamentos, em: t, por: c.userName };
            j.etapa = provimento === 'nao' ? 'resultado' : 'julgamento';
            const txt = `Recurso na ${certames_1.PERFIS_DISPUTA[x.perfil].toLowerCase()}: ${certames_1.PROVIMENTOS[provimento]}. ${fundamentos.replace(/[.\s]+$/, '')}.${provimento === 'nao' ? '' : ' O julgamento se refaz no que o recurso alcançou e o vencedor é declarado de novo.'}`;
            mov = { tipo: 'disputa_recurso_decidido', texto: txt };
            avisos.push(txt);
            email = { uids: todos, assunto: `Recurso decidido: ${x.objeto.slice(0, 60)}`, corpo: txt };
            auditoria = 'SECRETARIA_SESSAO_RECURSO_DECIDIDO';
        }
        if (p.action === 'certameResultado') {
            const desertas = us.every((v) => v.u.situacao === 'deserta');
            if (!(j.etapa === 'resultado' || (j.etapa === 'julgamento' && desertas))) {
                throw new https_1.HttpsError('failed-precondition', j.etapa === 'recurso' ? 'Aguarde o fim do prazo de recurso (ou decida o recurso)' : 'Declare antes o vencedor (com a intenção de recurso)');
            }
            const resultado = (0, certames_1.resultadoDaDisputa)(us.map((v) => v.u));
            const rodadas = [...j.recursos_anteriores, ...(j.recurso ? [j.recurso] : [])];
            const ata = (0, certames_1.textoDaAta)(x, us, quem, rodadas, resultado, j.lances);
            j.etapa = 'encerrado';
            j.resultado = resultado;
            j.ata = ata;
            const ato = resultado === 'Homologada' ? 'Adjudicado o objeto e homologada a disputa' : `Declarada ${resultado.toLowerCase()} a disputa`;
            mov = { tipo: 'disputa_resultado', texto: `${ato}.\n\n${ata}` };
            avisos.push(`${ato}. A ata está nos autos.`);
            const resumo = us.map(({ nome, u }) => (0, certames_1.linhaDaUnidade)(nome, u, quem, x)).join('; ');
            extraProc = { [data.certame ? 'certame' : 'ultimo_certame']: Object.assign(Object.assign({}, atual), { situacao: 'encerrado', resultado, resumo }) };
            tx.update(ref, { situacao: 'encerrado', resultado, encerrado_em: t, version: (x.version || 0) + 1 });
            email = { uids: todos, assunto: `Resultado: ${x.objeto.slice(0, 60)}`, corpo: `${ato}.\n${resumo}` };
            auditoria = 'SECRETARIA_SESSAO_DISPUTA_RESULTADO';
            fechar = !!data.certame;
        }
        if (!avisos.length && !mov)
            throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
        tx.set(jref(ref), j);
        for (const a of avisos)
            tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: c.userName, texto: a, em: t, aviso: true });
        if (mov) {
            const m = (0, context_1.registrarMovimento)(tx, c, pref, data, mov.tipo, mov.texto, { certame_id: ref.id });
            tx.update(pref, Object.assign(Object.assign({}, m), extraProc));
        }
        return { ok: true, etapa: j.etapa, resultado: j.resultado, auditoria, certame_id: ref.id };
    });
    const _b = r, { auditoria, certame_id } = _b, resto = __rest(_b, ["auditoria", "certame_id"]);
    if (auditoria)
        await (0, config_1.auditar)(db, c.orgId, c.ctx.uid, c.userName, auditoria, { processo_id: p.processo_id });
    const e = email;
    if (e)
        void (0, certames_2.avisarPorEmail)(db, certame_id, e.uids, e.assunto, e.corpo);
    // O resultado cumpre a ação do rito (certidão, saída da fase e avanço automático, como no julgamento da sessão).
    if (fechar)
        return Object.assign(Object.assign({}, resto), { aviso_acao: await (0, processos_1.registrarResultadoDaDisputa)(db, c.orgId, procId, c.userName) });
    return resto;
}
function vistaOrgao(x, j, msgs, posse, t) {
    const nome = (uid) => (uid ? nomeComApelido(j, uid) : null);
    const us = (0, certames_1.unidadesDeDisputa)(x).map((u0) => ({ u0, u: j.unidades[u0.chave] }));
    const momento = j.recurso ? (0, certames_1.momentoDoRecurso)(j.recurso, t) : null;
    const gerir = posse && j.etapa !== 'encerrado';
    const desertas = us.every((v) => v.u.situacao === 'deserta');
    return {
        etapa: j.etapa, etapa_nome: certames_1.ETAPAS_JULGAMENTO[j.etapa], criterio: x.criterio, perfil: x.perfil, lances: j.lances, agora: t, resultado: j.resultado || null, ata: j.ata || null,
        unidades: us.map(({ u0, u }) => ({
            chave: u0.chave, nome: u0.nome, situacao: u.situacao, situacao_nome: certames_1.SITUACOES_JULGAMENTO[u.situacao], vez: u.vez, vez_nome: nome(u.vez),
            ordem: u.ordem.map((v) => { var _a, _b; return (Object.assign(Object.assign({}, v), { nome: ((_a = j.licitantes[v.uid]) === null || _a === void 0 ? void 0 : _a.nome) || '?', apelido: apelido(j, v.uid), documento: ((_b = j.licitantes[v.uid]) === null || _b === void 0 ? void 0 : _b.documento) || '', recusa: u.recusas.find((r) => r.uid === v.uid) || null })); }),
            desempate: u.desempate ? {
                atual: u.desempate.atual ? Object.assign(Object.assign({}, u.desempate.atual), { nome: nome(u.desempate.atual.uid), vencido: t > u.desempate.atual.ate }) : null,
                proximo: nome(u.desempate.candidatos.find((v) => { var _a; return !u.desempate.feitos.includes(v) && v !== ((_a = u.desempate.atual) === null || _a === void 0 ? void 0 : _a.uid); })),
                candidatos: u.desempate.candidatos.map((v) => nome(v)),
            } : null,
            negociacao: u.negociacao || null, convocacao: semPath(u.convocacao) || null, aceita: u.aceita || null, habilitada: u.habilitada || null, recusas: u.recusas,
        })),
        recurso: j.recurso ? Object.assign(Object.assign({}, j.recurso), { momento }) : null,
        recursos_anteriores: j.recursos_anteriores,
        mensagens: msgs.map((m) => ({ id: m.id, de: m.de, nome: m.de === 'licitante' && m.uid ? nome(m.uid) : m.nome, texto: m.texto, em: m.em, aviso: m.aviso })).reverse(),
        pode: {
            gerir: gerir && j.etapa === 'julgamento',
            conversar: gerir && x.situacao === 'publicado',
            declarar: gerir && j.etapa === 'julgamento' && (0, certames_1.julgamentoConcluido)(us.map((v) => v.u)) && !desertas,
            decidir: gerir && j.etapa === 'recurso' && momento === 'decisao',
            resultado: gerir && (j.etapa === 'resultado' || (j.etapa === 'julgamento' && desertas)),
        },
    };
}
async function acaoJulgamentoFornecedor(db, uid, p, lerCertame) {
    if (p.action === 'disputaJulgamento') {
        const { ref, x } = await lerCertame(db, p.certame_id);
        if (!(x.fornecedores_uids || []).includes(uid))
            throw new https_1.HttpsError('permission-denied', 'Você não participa desta disputa');
        const [js, msgA, msgM] = await Promise.all([
            jref(ref).get(),
            ref.collection('mensagens').where('de', '==', 'agente').get(),
            ref.collection('mensagens').where('uid', '==', uid).get(),
        ]);
        const mensagens = [...msgA.docs, ...msgM.docs].map((d) => { const m = d.data(); return { id: d.id, de: m.de, nome: m.de === 'licitante' ? 'Você' : m.nome, texto: m.texto, em: m.em, aviso: m.aviso }; })
            .sort((a, b) => a.em.localeCompare(b.em)).slice(-150);
        const j = js.data();
        const t = agora();
        if (!j)
            return { etapa: null, mensagens, agora: t };
        atualizarEtapa(j, t);
        return vistaFornecedor(x, j, uid, t, mensagens);
    }
    if (p.action === 'disputaEnviarArquivo') {
        const mime = String(p.mime || '');
        if (!TIPOS_ARQUIVO[mime])
            throw new https_1.HttpsError('invalid-argument', 'Anexe PDF, Word (DOCX), PNG ou JPG');
        const buf = Buffer.from(String(p.base64 || ''), 'base64');
        if (!buf.length || buf.length > secretaria_1.MAX_UPLOAD_BYTES)
            throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio ou acima de 5 MB');
        const nomeArq = (0, secretaria_1.texto)(p.nome, 120).replace(/[\\/]/g, '_') || `arquivo.${TIPOS_ARQUIVO[mime]}`;
        // Confere antes de gravar o arquivo; a transação confere de novo e, se falhar, o arquivo sai.
        const { ref, x } = await lerCertame(db, p.certame_id);
        const conferir = (j) => {
            const { u0, u } = unidadeDe(j || { unidades: {} }, x, p.chave);
            const cv = u.convocacao;
            if (!cv || cv.uid !== uid || j.etapa !== 'julgamento' || !['analise', 'aceita'].includes(u.situacao))
                throw new https_1.HttpsError('failed-precondition', 'Não há convocação sua para enviar arquivo neste item ou lote');
            if (agora() > cv.ate)
                throw new https_1.HttpsError('deadline-exceeded', 'O prazo da convocação terminou');
            if (cv.arquivos.length >= certames_1.MAX_ARQUIVOS_CONVOCACAO)
                throw new https_1.HttpsError('resource-exhausted', `Até ${certames_1.MAX_ARQUIVOS_CONVOCACAO} arquivos por convocação`);
            return { u0, u };
        };
        conferir((await jref(ref).get()).data());
        const id = ref.collection('_').doc().id;
        const path = `secretaria/${x.organization_id}/certames/${ref.id}/${uid}/${id}`;
        const arquivo = admin.storage().bucket().file(path);
        await arquivo.save(buf, { contentType: mime, resumable: false });
        try {
            return await db.runTransaction(async (tx) => {
                const j = (await tx.get(jref(ref))).data();
                const { u0, u } = conferir(j);
                const t = agora();
                u.convocacao.arquivos.push({ id, nome: nomeArq, mime, bytes: buf.length, em: t, path });
                tx.set(jref(ref), j);
                tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: 'Sistema', texto: `${apelido(j, uid)} enviou ${nomeArq} em ${u0.nome}.`, em: t, aviso: true });
                return { ok: true, arquivo: { id, nome: nomeArq, em: t } };
            });
        }
        catch (e) {
            await arquivo.delete({ ignoreNotFound: true }).catch(() => undefined);
            throw e;
        }
    }
    return db.runTransaction(async (tx) => {
        var _a, _b;
        const { ref, x } = await lerCertame(db, p.certame_id, tx);
        const j = (await tx.get(jref(ref))).data();
        const t = agora();
        if (!j || x.situacao !== 'publicado')
            throw new https_1.HttpsError('failed-precondition', 'A disputa não está em julgamento');
        if (!j.licitantes[uid])
            throw new https_1.HttpsError('permission-denied', 'Só quem enviou proposta participa do julgamento');
        atualizarEtapa(j, t);
        const avisos = [];
        const eu = apelido(j, uid);
        if (p.action === 'disputaDesempate' || p.action === 'disputaNegociar') {
            if (j.etapa !== 'julgamento')
                throw new https_1.HttpsError('failed-precondition', 'O julgamento já terminou');
            const { u0, u } = unidadeDe(j, x, p.chave);
            if (p.action === 'disputaDesempate') {
                const at = (_a = u.desempate) === null || _a === void 0 ? void 0 : _a.atual;
                if (u.situacao !== 'desempate' || !at || at.uid !== uid || at.recusou)
                    throw new https_1.HttpsError('failed-precondition', 'Você não está convocado para o desempate neste item ou lote');
                if (t > at.ate)
                    throw new https_1.HttpsError('deadline-exceeded', 'O prazo do desempate terminou');
                if (p.recusar === true) {
                    at.recusou = true;
                    avisos.push(`${eu} não cobriu a melhor oferta em ${u0.nome}.`);
                }
                else {
                    const valor = Math.round((0, certames_1.num)(p.valor) * 10000) / 10000;
                    if (!Number.isFinite(valor) || valor <= 0)
                        throw new https_1.HttpsError('invalid-argument', 'Informe o valor da oferta');
                    const novo = (0, certames_1.aplicarDesempate)(u, uid, valor, (0, certames_1.totalDoValor)(valor, u0, x), t, x);
                    if (typeof novo === 'string')
                        throw new https_1.HttpsError('invalid-argument', novo);
                    j.unidades[u0.chave] = novo;
                    avisos.push(`${eu} (ME/EPP) cobriu a melhor oferta em ${u0.nome}: ${(0, certames_1.valorTexto)(novo.ordem[0].total, x)}. A proposta passa à análise.`);
                }
            }
            else {
                if (u.situacao !== 'analise' || ((_b = u.negociacao) === null || _b === void 0 ? void 0 : _b.uid) !== uid)
                    throw new https_1.HttpsError('failed-precondition', 'Não há negociação aberta com você neste item ou lote');
                const valor = Math.round((0, certames_1.num)(p.valor) * 10000) / 10000;
                const c0 = u.ordem.find((v) => v.uid === uid);
                const total = (0, certames_1.totalDoValor)(valor, u0, x);
                if (!Number.isFinite(valor) || valor <= 0 || !(0, certames_1.ofertaMelhor)(total, c0.total, x)) {
                    throw new https_1.HttpsError('invalid-argument', `A nova oferta precisa ser ${x.criterio === 'maior_desconto' ? 'maior' : 'menor'} que a sua atual (${(0, certames_1.valorTexto)(c0.total, x)})`);
                }
                Object.assign(c0, { valor, total, em: t, negociado: true });
                avisos.push(`${eu} melhorou a oferta em ${u0.nome}: ${(0, certames_1.valorTexto)(total, x)}.`);
            }
        }
        if (['disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'].includes(String(p.action))) {
            const rr = j.recurso;
            if (j.etapa !== 'recurso' || !rr)
                throw new https_1.HttpsError('failed-precondition', 'Não há prazo de recurso aberto');
            const m = (0, certames_1.momentoDoRecurso)(rr, t);
            const nome = j.licitantes[uid].nome;
            const minha = rr.intencoes.find((i) => i.uid === uid);
            if (p.action === 'disputaIntencao') {
                if (m !== 'intencao')
                    throw new https_1.HttpsError('deadline-exceeded', 'O prazo da intenção de recurso terminou');
                if (minha)
                    throw new https_1.HttpsError('already-exists', 'Você já manifestou intenção de recorrer');
                const motivo = (0, secretaria_1.texto)(p.motivo, 2000);
                if (motivo.length < 10)
                    throw new https_1.HttpsError('invalid-argument', 'Diga, em síntese, contra o que recorre (ao menos 10 letras)');
                rr.intencoes.push({ uid, nome, motivo, em: t });
                avisos.push(`${nome} manifestou intenção de recorrer: ${motivo}`);
            }
            else {
                const corpo = (0, secretaria_1.texto)(p.texto, 20000);
                if (corpo.length < 20)
                    throw new https_1.HttpsError('invalid-argument', 'Escreva o texto (ao menos 20 letras)');
                if (p.action === 'disputaRazoes') {
                    if (!minha)
                        throw new https_1.HttpsError('permission-denied', 'Só apresenta razões quem manifestou intenção de recorrer');
                    if (t > rr.razoes_ate || rr.decisao)
                        throw new https_1.HttpsError('deadline-exceeded', 'O prazo das razões terminou');
                    const nova = !minha.razoes;
                    minha.razoes = { texto: corpo, em: t };
                    if (nova)
                        avisos.push(`${nome} apresentou as razões do recurso.`);
                }
                else {
                    if (!rr.intencoes.length || t <= rr.intencao_ate)
                        throw new https_1.HttpsError('failed-precondition', 'As contrarrazões cabem depois de haver intenção de recurso');
                    if (t > rr.contrarrazoes_ate || rr.decisao || m === 'decisao')
                        throw new https_1.HttpsError('deadline-exceeded', 'O prazo das contrarrazões terminou');
                    const k = rr.contrarrazoes.findIndex((v) => v.uid === uid);
                    if (k >= 0)
                        rr.contrarrazoes[k] = { uid, nome, texto: corpo, em: t };
                    else {
                        rr.contrarrazoes.push({ uid, nome, texto: corpo, em: t });
                        avisos.push(`${nome} apresentou contrarrazões.`);
                    }
                }
            }
        }
        if (!['disputaDesempate', 'disputaNegociar', 'disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'].includes(String(p.action)))
            throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
        tx.set(jref(ref), j);
        for (const a of avisos)
            tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: 'Sistema', texto: a, em: t, aviso: true });
        return { ok: true };
    });
}
function vistaFornecedor(x, j, uid, t, mensagens) {
    const pub = declarado(j);
    const quem = (u) => { var _a; return (!u ? null : u === uid ? 'Você' : pub ? ((_a = j.licitantes[u]) === null || _a === void 0 ? void 0 : _a.nome) || '?' : apelido(j, u)); };
    const rr = j.recurso;
    const momento = rr ? (0, certames_1.momentoDoRecurso)(rr, t) : null;
    const eu = !!j.licitantes[uid];
    const minha = rr === null || rr === void 0 ? void 0 : rr.intencoes.find((i) => i.uid === uid);
    return {
        etapa: j.etapa, etapa_nome: certames_1.ETAPAS_JULGAMENTO[j.etapa], criterio: x.criterio, agora: t, apelido: apelido(j, uid), resultado: j.resultado || null, ata: j.ata || null, mensagens,
        unidades: (0, certames_1.unidadesDeDisputa)(x).map((u0) => {
            var _a, _b, _c;
            const u = j.unidades[u0.chave];
            const k = u.ordem.findIndex((v) => v.uid === uid);
            const at = (_a = u.desempate) === null || _a === void 0 ? void 0 : _a.atual;
            const cv = ((_b = u.convocacao) === null || _b === void 0 ? void 0 : _b.uid) === uid ? u.convocacao : null;
            return {
                chave: u0.chave, nome: u0.nome, situacao: u.situacao, situacao_nome: certames_1.SITUACOES_JULGAMENTO[u.situacao],
                posicao: k >= 0 ? k + 1 : null, meu: k >= 0 ? { valor: u.ordem[k].valor, total: u.ordem[k].total } : null, melhor: u.ordem[0] ? { total: u.ordem[0].total } : null,
                vez: quem(u.vez), vez_sou_eu: u.vez === uid,
                recusa: u.recusas.find((r) => r.uid === uid) || null,
                desempate: at && at.uid === uid && !at.recusou && t <= at.ate ? { ate: at.ate, alvo: u.ordem[0].total } : null,
                negociacao: u.situacao === 'analise' && ((_c = u.negociacao) === null || _c === void 0 ? void 0 : _c.uid) === uid,
                convocacao: cv ? { o_que: cv.o_que, ate: cv.ate, aberta: t <= cv.ate && j.etapa === 'julgamento', arquivos: cv.arquivos.map((_a) => {
                        var { path: _p } = _a, a = __rest(_a, ["path"]);
                        return a;
                    }) } : null,
                vencedor: pub && u.habilitada ? { quem: quem(u.habilitada.uid), total: u.habilitada.total } : null,
            };
        }),
        recurso: rr ? {
            momento, intencao_ate: rr.intencao_ate, razoes_ate: rr.razoes_ate, contrarrazoes_ate: rr.contrarrazoes_ate, decisao: rr.decisao ? { provimento: rr.decisao.provimento, fundamentos: rr.decisao.fundamentos, em: rr.decisao.em } : null,
            intencoes: rr.intencoes.map((i) => ({ nome: i.uid === uid ? 'Você' : i.nome, motivo: i.motivo, em: i.em, razoes: i.razoes || null })),
            contrarrazoes: rr.contrarrazoes.map((c) => ({ nome: c.uid === uid ? 'Você' : c.nome, texto: c.texto, em: c.em })),
            minha_intencao: !!minha,
        } : null,
        pode: {
            intencao: eu && momento === 'intencao' && !minha,
            razoes: !!minha && !!rr && t <= rr.razoes_ate && !rr.decisao,
            contrarrazoes: eu && !!rr && rr.intencoes.length > 0 && (momento === 'razoes' || momento === 'contrarrazoes'),
        },
    };
}
//# sourceMappingURL=julgamentoDisputa.js.map