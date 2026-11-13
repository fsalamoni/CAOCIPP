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
exports.secretariaProcesso = void 0;
exports.efeitosDaMudanca = efeitosDaMudanca;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const config_1 = require("./config");
const autos_1 = require("../shared/autos");
const exigencias_1 = require("../shared/exigencias");
const email_1 = require("../shared/email");
const camposProcesso_1 = require("../shared/camposProcesso");
const numeracao_1 = require("../shared/numeracao");
const informacoes_1 = require("../shared/informacoes");
const modulos_1 = require("../shared/modulos");
const portalAvisos_1 = require("./portalAvisos");
const orgaos_1 = require("../shared/orgaos");
const orgaos_2 = require("./orgaos");
const avisosEquipe_1 = require("./avisosEquipe");
const comunicacoes_1 = require("./comunicacoes");
const context_1 = require("./context");
const CONVITE_DIAS = 7;
const MAX_LISTA = 5000;
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const MAX_PARTES = 50;
const MAX_REPRESENTANTES = 5;
/** Quantos números já usados a autuação pula antes de desistir. */
const MAX_PULOS = 200;
function sanitizePartes(input, polos = camposProcesso_1.POLOS) {
    const lista = Array.isArray(input) ? input.slice(0, MAX_PARTES) : [];
    const reserva = polos.includes('interessado') ? 'interessado' : polos[0];
    return lista
        .map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        if (o.polo !== undefined && o.polo !== '' && !polos.includes(String(o.polo))) {
            throw new https_1.HttpsError('invalid-argument', `O polo "${String(o.polo).slice(0, 20)}" não é aceito neste tipo de processo`);
        }
        const polo = typeof o.polo === 'string' && polos.includes(o.polo) ? o.polo : reserva;
        return { nome: (0, secretaria_1.texto)(o.nome), documento: (0, secretaria_1.texto)(o.documento, 30), email: (0, secretaria_1.texto)(o.email, 120), polo };
    })
        .filter((p) => p.nome);
}
/** O que o rito exige na fase atual e ainda falta: documentos, ações obrigatórias e campos a preencher. */
function exigenciasAbertas(proc, form) {
    const fase = (proc.fases || []).find((f) => f.id === proc.fase_atual);
    const exigidos = (proc.campos_exigidos || {})[String(proc.fase_atual)];
    return [
        ...(0, exigencias_1.documentosQueFaltam)(fase, proc.exigencias_cumpridas, (0, exigencias_1.respostasDaFase)(proc)),
        ...(0, exigencias_1.acoesObrigatoriasPendentes)(fase, (proc.acoes_feitas || {})[String(proc.fase_atual)], (0, exigencias_1.respostasDaFase)(proc)),
        ...(0, camposProcesso_1.camposFaltando)(exigidos, proc.campos, form).map((x) => ({ descricao: `Preencher "${x.rotulo}"` })),
    ];
}
/**
 * Sair da fase com exigência em aberto: sem motivo, recusa; com motivo, a
 * dispensa fica no movimento (e nos autos). Devolve o que foi dispensado.
 */
/** Texto da condição para mensagens: "Decisão" for Deferido ou Parcial. */
function textoCondicao(f, c) {
    var _a, _b;
    const r = (_a = f === null || f === void 0 ? void 0 : f.acoes_regras) === null || _a === void 0 ? void 0 : _a[c.acao];
    const rot = (v) => ((r === null || r === void 0 ? void 0 : r.pede) === 'sim_nao' ? (v === 'sim' ? 'Sim' : 'Não') : v);
    return `"${(r === null || r === void 0 ? void 0 : r.rotulo) || ((_b = f === null || f === void 0 ? void 0 : f.acoes) === null || _b === void 0 ? void 0 : _b[c.acao]) || 'a resposta'}" for ${c.valores.map(rot).join(' ou ')}`;
}
/**
 * O que o rito faz ao trocar de fase (ou na autuação, sem fase de origem):
 * encerra o prazo automático da fase que sai, abre o da fase que entra,
 * marca a urgência e tira o responsável designado. Vai no mesmo movimento da
 * mudança: `texto` completa a descrição (só o que as partes podem ler: a
 * urgência), `interno` vai num registro só da equipe logo depois (prazo
 * interno e responsável), `campos` vai para o processo.
 * `para` null: só encerra (arquivamento).
 */
function efeitosDaMudanca(proc, deId, para, calendario, quem) {
    var _a, _b;
    const hoje = (0, secretaria_1.hojeBrasil)();
    const agora = new Date().toISOString();
    const frases = [];
    const interno = [];
    const antes = (proc.prazos || []);
    let prazos = antes;
    const daFase = antes.filter((x) => x.status === 'aberto' && x.fase_id && x.fase_id === deId);
    if (daFase.length) {
        prazos = prazos.map((x) => (daFase.includes(x) ? Object.assign(Object.assign({}, x), { status: 'cumprido', encerrado_em: hoje, encerrado_por: quem }) : x));
        daFase.forEach((x) => interno.push(`Prazo interno da fase encerrado ${hoje <= x.vence_em ? 'no prazo' : 'fora do prazo'}: ${x.descricao}.`));
    }
    const dias = Number(para === null || para === void 0 ? void 0 : para.prazo_dias);
    if ((para === null || para === void 0 ? void 0 : para.prazo_auto) && Number.isInteger(dias) && dias > 0 && dias <= secretaria_1.MAX_PRAZO_DIAS && prazos.length < secretaria_1.MAX_ITENS) {
        const contagem = para.prazo_contagem === 'corridos' ? 'corridos' : 'uteis';
        const vence = (0, secretaria_1.calcularVencimento)(hoje, dias, contagem, calendario);
        prazos = [...prazos, {
                id: (0, crypto_1.randomBytes)(10).toString('hex'), descricao: `Fase ${para.nome}`, fase_id: para.id, dias, contagem, inicio: hoje, vence_em: vence,
                status: 'aberto', aberto_em: agora, aberto_por: quem, automatico: true,
            }];
        interno.push(`Prazo interno da fase aberto: ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'}, vence em ${vence.split('-').reverse().join('/')}.`);
    }
    const campos = prazos === antes ? {} : Object.assign({ prazos }, (0, secretaria_1.derivados)((proc.pendencias || []), prazos));
    if (((_a = para === null || para === void 0 ? void 0 : para.ao_entrar) === null || _a === void 0 ? void 0 : _a.urgente) && proc.urgente !== true) {
        campos.urgente = true;
        campos.urgencia = { motivo: `Regra da fase ${para.nome}`, por: quem, em: agora };
        frases.push('Tramitação urgente pela regra da fase.');
    }
    if (((_b = para === null || para === void 0 ? void 0 : para.ao_entrar) === null || _b === void 0 ? void 0 : _b.sem_responsavel) && proc.responsavel_uid) {
        campos.responsavel_uid = null;
        interno.push('Responsável designado retirado pela regra da fase.');
    }
    return { texto: frases.length ? ` ${frases.join(' ')}` : '', interno, campos };
}
/** O que a fase fez sozinha e só interessa à equipe: registro interno, sem termo, fora do portal. */
function registrarInternos(tx, c, ref, proc, interno) {
    if (!interno.length)
        return {};
    return (0, context_1.registrarMovimento)(tx, c, ref, proc, 'efeitos_fase', interno.join(' '), (0, exigencias_1.marcasDoDestino)('informacao'));
}
const SEM_EFEITOS = { texto: '', interno: [], campos: {} };
/**
 * Saída que o rito condiciona à resposta de uma ação: seguir por ela sem a
 * resposta que a indica pede motivo (fica no movimento como contra a condição).
 */
function foraDaCondicao(proc, alvoId) {
    var _a;
    const fase = (proc.fases || []).find((f) => f.id === proc.fase_atual);
    const cond = (_a = fase === null || fase === void 0 ? void 0 : fase.condicoes_regra) === null || _a === void 0 ? void 0 : _a[alvoId];
    if (!cond || (0, exigencias_1.condicaoAtendida)(cond, (0, exigencias_1.respostasDaFase)(proc), fase))
        return null;
    return textoCondicao(fase, cond);
}
function dispensarExigencias(proc, motivo, form) {
    const abertas = exigenciasAbertas(proc, form).map((e) => e.descricao);
    if (abertas.length && !motivo) {
        throw new https_1.HttpsError('failed-precondition', `O rito exige nesta fase: ${abertas.join('; ')}. Cumpra o que falta ou informe o motivo da dispensa.`);
    }
    return abertas;
}
/**
 * Certidão conjunta pendente vira UMA certidão nos autos, com folha, antes do
 * ato que a encerra (sair do grupo, arquivar, encher, "Emitir agora"). Sem
 * pendência (ou `cond` falso), não faz nada. `proc` já traz o movimento, para
 * encadear o ato seguinte na mesma transação.
 */
function emitirSe(cond, tx, c, ref, data) {
    var _a;
    const cons = data.consolidacao;
    if (!cond || !((_a = cons === null || cons === void 0 ? void 0 : cons.itens) === null || _a === void 0 ? void 0 : _a.length))
        return { mov: {}, proc: data };
    const titulo = (0, exigencias_1.tituloCertidao)((data.fases || []), cons.grupo);
    const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'certidao_fase', (0, exigencias_1.textoCertidao)(cons.itens), { grupo: cons.grupo, itens: cons.itens.map((i) => i.seq), titulo, visivel_partes: (0, exigencias_1.visivelCertidao)(cons.itens) });
    return { mov: Object.assign(Object.assign({}, mov), { consolidacao: firestore_1.FieldValue.delete() }), proc: Object.assign(Object.assign(Object.assign({}, data), mov), { consolidacao: null }) };
}
/** A pendente é de outro grupo ou não comporta o item na sua folha: emite antes de juntar. */
const antesDeJuntar = (data, grupo, item) => {
    var _a;
    const cons = data.consolidacao;
    return !!((_a = cons === null || cons === void 0 ? void 0 : cons.itens) === null || _a === void 0 ? void 0 : _a.length) && (cons.grupo !== grupo || !(0, exigencias_1.cabeNaCertidao)(cons.itens, item));
};
/** Itens da certidão do grupo depois do ato (a emissão, se houve, zerou a pendente). */
const itensDepois = (proc, grupo, item) => { var _a; return ({ grupo, itens: [...(((_a = proc.consolidacao) === null || _a === void 0 ? void 0 : _a.itens) || []), item] }); };
const textoDispensa = (d) => (d.length ? ` Dispensado o que o rito exigia na fase: ${d.join('; ')}.` : '');
/** Valor informado ao cumprir a ação, conferido contra o que o rito pede. Lança HttpsError. */
async function valorDaAcao(c, regra, acao, bruto) {
    const pede = (0, exigencias_1.pedidoDaAcao)(regra);
    if (pede === 'confirmar' || pede === 'documento')
        return null;
    const rotulo = (regra === null || regra === void 0 ? void 0 : regra.rotulo) || acao;
    if (pede === 'formulario') {
        // Vários campos, conferidos como os do tipo de processo (registros relidos no servidor).
        const form = { campos: (regra === null || regra === void 0 ? void 0 : regra.campos) || [] };
        let campos = [];
        try {
            campos = (0, camposProcesso_1.validarCampos)(form, bruto, [], await (0, modulos_1.refsDoFormulario)(c.db, c.orgId, c.org, form, bruto));
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        if (!campos.length)
            throw new https_1.HttpsError('invalid-argument', `Preencha "${rotulo}"`);
        return (0, camposProcesso_1.dadoDoFormulario)(rotulo, campos);
    }
    if (pede === 'registro') {
        // Registro de outro módulo: o servidor lê e guarda só número e título; a parte vê só o número.
        const modulo = regra === null || regra === void 0 ? void 0 : regra.modulo;
        const id = (0, modulos_1.idEscolhido)(bruto);
        if (!id)
            throw new https_1.HttpsError('invalid-argument', `Escolha "${rotulo}"`);
        if (!modulos_1.MODULOS.includes(modulo) || !(0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(c.db))[modulo]) {
            throw new https_1.HttpsError('failed-precondition', `A integração com ${modulos_1.ROTULO_MODULO[modulo] || 'esse módulo'} está desligada neste órgão`);
        }
        const ref = await (0, modulos_1.resolverRegistro)(c.db, c.orgId, modulo, id);
        if (!ref)
            throw new https_1.HttpsError('invalid-argument', `"${rotulo}": registro não encontrado em ${modulos_1.ROTULO_MODULO[modulo]}`);
        return { rotulo, tipo: 'registro', valor: ref.numero, valor_texto: ref.numero, ref, refs: [ref], restrito: ref.restrito === true };
    }
    const tipo = pede;
    let valor = null;
    try {
        valor = (0, camposProcesso_1.valorDe)({ rotulo, tipo, opcoes: (regra === null || regra === void 0 ? void 0 : regra.opcoes) || [] }, bruto);
    }
    catch (e) {
        (0, context_1.erroUsuario)(e);
    }
    if (valor === null)
        throw new https_1.HttpsError('invalid-argument', tipo === 'sim_nao' ? `Responda sim ou não em "${rotulo}"` : `Informe "${rotulo}"`);
    return { rotulo, tipo, valor, valor_texto: (0, camposProcesso_1.valorTexto)({ tipo, valor }), ref: undefined, refs: [], restrito: false };
}
/** Registro pedido por uma ação entra nos vínculos (desfazer não tira: segue citado no histórico). */
// ponytail: os 50 primeiros; paginar se um registro passar disso.
const MAX_VINCULADOS = 50;
const vinculoDaAcao = (dado) => {
    if (!(dado === null || dado === void 0 ? void 0 : dado.refs.length))
        return {};
    const k = dado.refs.map((r) => `${r.modulo}:${r.id}`);
    return { vinculos: firestore_1.FieldValue.arrayUnion(...k), vinculos_acoes: firestore_1.FieldValue.arrayUnion(...k) };
};
/**
 * O registro ou processo de onde o processo nasce, relido no servidor: só
 * número e título (de outro processo, só o número, porque o assunto pode ser
 * sigiloso para quem vê o novo processo).
 */
async function refDaOrigem(c, bruto) {
    const r = (bruto && typeof bruto === 'object' ? bruto : {});
    const id = (0, modulos_1.idEscolhido)(r.id);
    if (!id)
        return null;
    if (!(0, modulos_1.ehModuloOrigem)(r.modulo))
        throw new https_1.HttpsError('invalid-argument', 'Origem inválida');
    if (r.modulo === 'pe') {
        const { data } = await (0, context_1.lerProcesso)(c, id);
        return { modulo: 'pe', id, numero: String(data.numero || '') };
    }
    const m = r.modulo;
    if (!(0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(c.db))[m]) {
        throw new https_1.HttpsError('failed-precondition', `A integração com ${modulos_1.ROTULO_MODULO[m]} está desligada. Peça ao administrador para ligá-la em "Integrações com outros módulos".`);
    }
    const ref = await (0, modulos_1.resolverRegistro)(c.db, c.orgId, m, id);
    if (!ref)
        throw new https_1.HttpsError('not-found', `Registro de origem não encontrado em ${modulos_1.ROTULO_MODULO[m]}`);
    return Object.assign({ modulo: m, id, numero: ref.numero }, (ref.titulo ? { titulo: ref.titulo } : {}));
}
function resumo(id, d) {
    var _a;
    return {
        id,
        numero: d.numero,
        assunto: d.assunto,
        status: d.status,
        sigilo: d.sigilo,
        urgente: d.urgente === true,
        urgencia: d.urgente === true ? d.urgencia || null : null,
        fase_atual: d.fase_atual,
        fase_nome: ((_a = (d.fases || []).find((f) => f.id === d.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || d.fase_atual,
        unidade_atual: d.unidade_atual,
        responsavel_uid: d.responsavel_uid || null,
        rito_nome: d.rito_nome,
        tipo_id: d.tipo_id || null,
        tipo_nome: d.tipo_nome || null,
        ultimo_movimento: d.ultimo_movimento || null,
        version: d.version,
        pendencias_abertas: d.pendencias_abertas || 0,
        fase_suspensa: d.fase_suspensa === true,
        proximo_vencimento: d.proximo_vencimento || null,
        comunicacoes_aguardando: d.comunicacoes_aguardando || 0,
        // Pesquisa e painéis.
        rito_id: d.rito_id || null,
        autuado_em: d.autuado_em || null,
        campos_resumo: (d.campos || []).map((x) => (0, camposProcesso_1.valorTexto)(x)).join(' · ').slice(0, 500),
        partes_resumo: (d.partes || []).map((x) => [x.nome, x.documento].filter(Boolean).join(' ')).join(' · ').slice(0, 500),
        pendencia_desde: (d.pendencias || [])
            .filter((x) => x.status === 'aberta').map((x) => String(x.aberta_em || '')).filter(Boolean).sort()[0] || null,
        // Fila de trabalho: quando chegou na unidade, pedidos de assinatura e orientação do gabinete.
        recebido_em: d.recebido_em || d.autuado_em || null,
        assinaturas_pendentes: d.assinaturas_pendentes || [],
        orientacao: d.orientacao || null,
    };
}
exports.secretariaProcesso = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a, _b, _d, _e, _f, _g, _h, _j, _k, _l;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    const { db, orgId } = c;
    if (p.action === 'listar' && p.limite) {
        // Paginado pelo servidor: do mais recente para o mais antigo por
        // updated_at (índice organization_id + updated_at), filtrando a posse
        // e o sigilo em memória; `cursor` é o updated_at (ms) do último lido.
        const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
        let q = db.collection(context_1.COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc');
        if (p.cursor)
            q = q.startAfter(firestore_1.Timestamp.fromMillis(Number(p.cursor)));
        const snap = await q.limit(limite).get();
        const processos = (0, autos_1.urgentesPrimeiro)(snap.docs
            .filter((d) => d.data().status !== 'excluido' && (0, secretaria_1.podeVer)(d.data(), c.ctx))
            .filter((d) => p.escopo !== 'caixa' || (0, secretaria_1.podeAgir)(d.data(), c.ctx))
            .map((d) => resumo(d.id, d.data())));
        const ultimo = snap.docs[snap.docs.length - 1];
        return { processos, cursor: ((_b = (_a = ultimo === null || ultimo === void 0 ? void 0 : ultimo.data().updated_at) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || null, mais: snap.size === limite };
    }
    if (p.action === 'vinculados') {
        // Processos ligados a um registro de outro módulo (ou derivados de outro
        // processo, 'pe'): os que a pessoa pode ver, sem dizer que há outros.
        const modulo = String(p.modulo || '');
        const id = (0, modulos_1.idEscolhido)(p.id);
        if (!(0, modulos_1.ehModuloOrigem)(modulo) || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
            throw new https_1.HttpsError('invalid-argument', 'Registro inválido');
        const ligada = modulo === 'pe' || (0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(db))[modulo];
        if (!ligada)
            return { ligada: false, pode_autuar: false, processos: [] };
        // O limite vale para o que a pessoa vê: lê em páginas e só diz "mais" se houver outro visível.
        const base = db.collection(context_1.COL.processos).where('organization_id', '==', orgId).where('vinculos', 'array-contains', `${modulo}:${id}`);
        const processos = [];
        let mais = false;
        let ultimo;
        // ponytail: até 4 páginas de 50 lidas; um registro com mais processos invisíveis que isso mostra só o que coube.
        for (let pag = 0; pag < 4 && !mais; pag++) {
            const snap = await (ultimo ? base.startAfter(ultimo) : base).limit(MAX_VINCULADOS).get();
            for (const d of snap.docs) {
                const x = d.data();
                if (x.status === 'excluido' || (0, secretaria_1.ehParte)(x, auth.uid) || !(0, secretaria_1.podeVer)(x, c.ctx))
                    continue;
                if (processos.length === MAX_VINCULADOS) {
                    mais = true;
                    break;
                }
                const r = resumo(d.id, x);
                processos.push({ id: r.id, numero: r.numero, assunto: r.assunto, fase_nome: r.fase_nome, status: r.status, sigilo: r.sigilo, origem: ((_e = (_d = x.origem) === null || _d === void 0 ? void 0 : _d.ref) === null || _e === void 0 ? void 0 : _e.id) === id });
            }
            if (snap.size < MAX_VINCULADOS)
                break;
            ultimo = snap.docs[snap.size - 1];
        }
        return { ligada: true, pode_autuar: c.ctx.unidadeIds.length > 0, processos, mais };
    }
    if (p.action === 'contadores') {
        // Carga por unidade (processos não arquivados) e totais, por contagem
        // no servidor: não traz documentos.
        const base = db.collection(context_1.COL.processos).where('organization_id', '==', orgId);
        const conta = async (q) => (await q.count().get()).data().count;
        const [total, arquivados, excluidos, porUnidade] = await Promise.all([
            conta(base),
            conta(base.where('status', '==', 'arquivado')),
            conta(base.where('status', '==', 'excluido')),
            Promise.all(c.unidades.map(async (u) => {
                const [t, a] = await Promise.all([conta(base.where('unidade_atual', '==', u.id)), conta(base.where('unidade_atual', '==', u.id).where('status', '==', 'arquivado'))]);
                return [u.id, t - a];
            })),
        ]);
        return { total: total - excluidos, arquivados, ativos: total - arquivados - excluidos, por_unidade: Object.fromEntries(porUnidade) };
    }
    if (p.action === 'indice') {
        // Para as listas dos outros módulos e a busca (Ctrl+K): os processos que a
        // pessoa vê (número, assunto, partes) e, por módulo ligado, os ids dos
        // registros que têm processo. Mesma regra de 'vinculados': quem é parte
        // não vê pelo órgão; restrito só para quem pode.
        // ponytail: uma leitura por processo do órgão a cada 5 min por pessoa; se pesar,
        // trocar por array-contains-any sobre os ids da página da tabela.
        if (!c.ctx.isAdmin && !c.ctx.unidadeIds.length)
            return { processos: [], com: {}, truncado: false };
        const base = db.collection(context_1.COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc')
            .select('numero', 'assunto', 'partes', 'status', 'sigilo', 'unidade_atual', 'unidades_historico', 'partes_uids', 'vinculos', 'updated_at');
        const docs = [];
        let q = base.limit(500);
        for (;;) {
            const snap = await q.get();
            docs.push(...snap.docs);
            if (snap.size < 500 || docs.length >= MAX_LISTA)
                break;
            q = base.startAfter(snap.docs[snap.size - 1]).limit(500);
        }
        const ligadas = (0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(db));
        const com = {};
        const processos = [];
        for (const d of docs.slice(0, MAX_LISTA)) {
            const x = d.data();
            if (x.status === 'excluido' || (0, secretaria_1.ehParte)(x, auth.uid) || !(0, secretaria_1.podeVer)(x, c.ctx))
                continue;
            const r = resumo(d.id, x);
            processos.push({ id: d.id, numero: r.numero, assunto: r.assunto, partes_resumo: r.partes_resumo });
            for (const v of (x.vinculos || [])) {
                const [m, id] = v.split(':');
                if (modulos_1.MODULOS.includes(m) && ligadas[m] && id)
                    (com[m] || (com[m] = [])).push(id);
            }
        }
        for (const m of Object.keys(com))
            com[m] = [...new Set(com[m])];
        return { processos, com, truncado: docs.length >= MAX_LISTA };
    }
    if (p.action === 'listar') {
        // Lista inteira (Meu trabalho, Mesa, Painel). A caixa lê só as unidades
        // da pessoa; "todos" percorre o órgão em páginas de 500. O teto evita
        // resposta grande demais e é avisado em `truncado`.
        const docs = [];
        const base = db.collection(context_1.COL.processos).where('organization_id', '==', orgId);
        if (p.escopo === 'caixa') {
            for (let i = 0; i < c.ctx.unidadeIds.length; i += 30) {
                docs.push(...(await base.where('unidade_atual', 'in', c.ctx.unidadeIds.slice(i, i + 30)).limit(MAX_LISTA).get()).docs);
            }
        }
        else {
            let q = base.orderBy('updated_at', 'desc').limit(500);
            for (;;) {
                const snap = await q.get();
                docs.push(...snap.docs);
                if (snap.size < 500 || docs.length >= MAX_LISTA)
                    break;
                q = base.orderBy('updated_at', 'desc').startAfter(snap.docs[snap.size - 1]).limit(500);
            }
        }
        const truncado = docs.length >= MAX_LISTA;
        const lista = docs.slice(0, MAX_LISTA)
            .filter((d) => d.data().status !== 'excluido' && (0, secretaria_1.podeVer)(d.data(), c.ctx))
            .filter((d) => p.escopo !== 'caixa' || (0, secretaria_1.podeAgir)(d.data(), c.ctx))
            .map((d) => { var _a, _b; return (Object.assign(Object.assign({}, resumo(d.id, d.data())), { _t: ((_b = (_a = d.data().updated_at) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0 })); })
            .sort((a, b) => b._t - a._t)
            .map((_a) => {
            var { _t } = _a, r = __rest(_a, ["_t"]);
            return r;
        });
        return { processos: (0, autos_1.urgentesPrimeiro)(lista), truncado };
    }
    if (p.action === 'excluidos') {
        (0, context_1.exigirAdmin)(c);
        const snap = await db.collection(context_1.COL.processos).where('organization_id', '==', orgId).where('status', '==', 'excluido').limit(500).get();
        return {
            processos: snap.docs.map((d) => {
                var _a, _b, _d, _e, _f, _g, _h;
                const x = d.data();
                return {
                    id: d.id, numero: x.numero, assunto: x.assunto, tipo_nome: x.tipo_nome || null,
                    em: ((_a = x.excluido) === null || _a === void 0 ? void 0 : _a.em) || null, por: ((_b = x.excluido) === null || _b === void 0 ? void 0 : _b.por_nome) || '', motivo: ((_d = x.excluido) === null || _d === void 0 ? void 0 : _d.motivo) || '',
                    unidade_anterior: ((_f = (_e = x.excluido) === null || _e === void 0 ? void 0 : _e.antes) === null || _f === void 0 ? void 0 : _f.unidade_atual) || null, status_anterior: ((_h = (_g = x.excluido) === null || _g === void 0 ? void 0 : _g.antes) === null || _h === void 0 ? void 0 : _h.status) || 'em_tramitacao',
                };
            }).sort((a, b) => String(b.em).localeCompare(String(a.em))),
        };
    }
    if (p.action === 'excluir' || p.action === 'restaurar') {
        const motivo = (0, secretaria_1.texto)(p.motivo, 500);
        if (p.action === 'excluir' && motivo.length < 5)
            throw new https_1.HttpsError('invalid-argument', 'Diga o motivo da exclusão (ao menos 5 letras)');
        if (p.action === 'restaurar')
            (0, context_1.exigirAdmin)(c);
        const ref = db.collection(context_1.COL.processos).doc(String(p.id || '_'));
        const numero = await db.runTransaction(async (tx) => {
            var _a;
            const snap = await tx.get(ref);
            const data = snap.data();
            if (!data || data.organization_id !== orgId)
                throw new https_1.HttpsError('not-found', 'Processo não encontrado');
            if (p.action === 'excluir') {
                (0, context_1.conferirVersao)(data, p.version);
                const movs = (await tx.get(ref.collection('movimentos').select('autor_uid'))).docs.map((d) => d.data());
                if (!(0, secretaria_1.podeExcluirProcesso)(data, movs, c.ctx)) {
                    throw new https_1.HttpsError('permission-denied', 'Só o admin do órgão exclui este processo. Quem autuou só exclui enquanto ninguém mais agiu nele.');
                }
                const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'exclusao', `Processo excluído. Motivo: ${motivo}`, { motivo });
                // O que tira o processo das listas, do portal e das rotinas diárias; a restauração devolve.
                const antes = {
                    status: data.status, unidade_atual: data.unidade_atual, responsavel_uid: data.responsavel_uid || null,
                    partes_uids: data.partes_uids || [], ciencia_limite: data.ciencia_limite || null, proximo_vencimento: data.proximo_vencimento || null,
                };
                tx.update(ref, Object.assign(Object.assign({}, mov), { status: 'excluido', unidade_atual: '', responsavel_uid: null, partes_uids: [], ciencia_limite: null, proximo_vencimento: null, excluido: { em: new Date().toISOString(), por_uid: c.ctx.uid, por_nome: c.userName, motivo, antes } }));
                return String(data.numero);
            }
            if (data.status !== 'excluido')
                throw new https_1.HttpsError('failed-precondition', 'O processo não está excluído');
            const antes = ((_a = data.excluido) === null || _a === void 0 ? void 0 : _a.antes) || {};
            const destinoId = String(p.unidade_destino || antes.unidade_atual || '');
            const destino = c.unidades.find((u) => u.id === destinoId && u.ativa !== false);
            if (!destino)
                throw new https_1.HttpsError('invalid-argument', 'A unidade de antes não está mais ativa. Escolha para qual unidade o processo volta.');
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, Object.assign(Object.assign({}, data), { unidade_atual: destino.id }), 'restauracao', `Processo restaurado na unidade ${destino.nome}.${motivo ? ` ${motivo}` : ''}`, Object.assign({ unidade: destino.id }, (motivo ? { motivo } : {})));
            tx.update(ref, Object.assign(Object.assign({}, mov), { status: antes.status || 'em_tramitacao', unidade_atual: destino.id, unidades_historico: firestore_1.FieldValue.arrayUnion(destino.id), responsavel_uid: destino.id === antes.unidade_atual ? antes.responsavel_uid || null : null, partes_uids: antes.partes_uids || [], ciencia_limite: antes.ciencia_limite || null, proximo_vencimento: antes.proximo_vencimento || null, excluido: firestore_1.FieldValue.delete(), recebido_em: new Date().toISOString() }));
            return String(data.numero);
        });
        await (0, config_1.auditar)(db, orgId, c.ctx.uid, c.userName, p.action === 'excluir' ? 'SECRETARIA_PROCESSO_EXCLUIDO' : 'SECRETARIA_PROCESSO_RESTAURADO', { processo_id: ref.id, numero, motivo });
        return { success: true };
    }
    if (p.action === 'obter') {
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.id);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            // Sem o conteúdo (pode ter imagens): só o que a lista mostra.
            ref.collection('documentos').select('titulo', 'tipo', 'origem', 'status', 'mime', 'nome_arquivo', 'tamanho', 'sha256', 'ordem', 'unidade_origem', 'autor_nome', 'criado_em', 'juntado_em', 'assinaturas', 'peticao', 'visivel_partes', 'paginas', 'folha_inicial', 'folha_final', 'codigo_verificacao', 'assinaturas_pedidas', 'peticao_tipo', 'modelo_id', 'unidades_acesso', 'guardado_em', 'guardado_por_nome').get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data());
        const posse = (0, secretaria_1.podeAgir)(data, c.ctx);
        const documentos = docs.docs
            .map((d) => (Object.assign({ id: d.id }, d.data())))
            // Minuta só é vista pela unidade que a redigiu; juntado = autos; controle = guardado fora dos autos (toda a equipe).
            .filter((d) => d.status === 'juntado' || d.status === 'controle' || (0, secretaria_1.minutaAcessivel)(d, c.ctx.unidadeIds))
            .map((d) => ({
            id: d.id, titulo: d.titulo, tipo: d.tipo, origem: d.origem, status: d.status,
            mime: d.mime || null, nome_arquivo: d.nome_arquivo || null, tamanho: d.tamanho || null,
            sha256: d.sha256, ordem: d.ordem || null, unidade_origem: d.unidade_origem,
            autor_nome: d.autor_nome, criado_em: d.criado_em, juntado_em: d.juntado_em || null,
            assinaturas: d.assinaturas || [], assinaturas_pedidas: d.assinaturas_pedidas || [],
            peticao: d.peticao === true, peticao_tipo: d.peticao_tipo || null, visivel_partes: d.visivel_partes !== false,
            paginas: d.paginas || null, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null, modelo_id: d.modelo_id || null, unidades_acesso: d.unidades_acesso || [],
            guardado_em: d.guardado_em || null, guardado_por: d.guardado_por_nome || null,
        }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        // Registro que hoje está restrito, anonimizado ou sumiu: marcado na resposta (nada é gravado),
        // para a capa avisar e os modelos não puxarem dado dele.
        const informacoes = (0, informacoes_1.informacoesDoAndamento)(movimentos, data.fases || []);
        const camposLidos = (data.campos || []);
        const origemLida = ((_f = data.origem) === null || _f === void 0 ? void 0 : _f.ref) ? data.origem : null;
        const fechadas = await (0, modulos_1.refsFechadas)(db, c.orgId, [origemLida === null || origemLida === void 0 ? void 0 : origemLida.ref, ...camposLidos.map((x) => x.ref), ...informacoes.flatMap((i) => [i.ref, ...(i.refs || [])])]);
        const fechada = (r) => !!r && fechadas.has(`${r.modulo}:${r.id}`);
        const marcar = (r) => (r && fechada(r) ? Object.assign(Object.assign({}, r), { restrito: true }) : r);
        return {
            processo: Object.assign(Object.assign({}, resumo(ref.id, data)), { descricao: data.descricao, campos: camposLidos.map((x) => (fechada(x.ref) ? Object.assign(Object.assign({}, x), { ref: Object.assign(Object.assign({}, x.ref), { restrito: true }) }) : x)), partes: (data.partes || []).map((_a) => {
                    var { convite_hash, uid, representantes } = _a, x = __rest(_a, ["convite_hash", "uid", "representantes"]);
                    return (Object.assign(Object.assign({}, x), { portal: uid ? 'ativo' : convite_hash ? 'convidado' : null, representantes: (representantes || []).map(({ convite_hash: ch, uid: u, nome, email }) => ({
                            nome, email: email || null, portal: u ? 'ativo' : ch ? 'convidado' : null,
                        })) }));
                }), fases: data.fases || [], unidades_historico: data.unidades_historico || [], 
                // A primeira unidade da lista é a que autuou (arrayUnion só acrescenta).
                unidade_autuacao: (data.unidades_historico || [])[0] || null, origem: origemLida && fechada(origemLida.ref) ? Object.assign(Object.assign({}, origemLida), { ref: Object.assign(Object.assign({}, origemLida.ref), { restrito: true }) }) : data.origem || null, autuado_em: data.autuado_em, autuado_por: data.autuado_por_nome, pendencias: data.pendencias || [], prazos: data.prazos || [], comunicacoes: data.comunicacoes || [], acoes_feitas: data.acoes_feitas || {}, acoes_respostas: data.acoes_respostas || {}, 
                // Atos aguardando a certidão conjunta (para "Emitir certidão agora").
                consolidacao: data.consolidacao || null, exigencias_cumpridas: data.exigencias_cumpridas || {}, campos_exigidos: data.campos_exigidos || {} }),
            hoje: (0, secretaria_1.hojeBrasil)(),
            movimentos: movimentos.map((m) => (Object.assign(Object.assign({}, m), (0, autos_1.extrasDoEvento)(m, new Map(documentos.map((d) => [d.id, d])))))),
            documentos,
            informacoes: informacoes.map((i) => ([i.ref, ...(i.refs || [])].some(fechada)
                ? Object.assign(Object.assign(Object.assign({}, i), { restrito: true, ref: marcar(i.ref) }), (i.refs ? { refs: i.refs.map(marcar) } : {})) : i)),
            cadeiaQuebradaEm: (0, secretaria_1.verificarCadeia)(movimentos),
            posse,
            pode_excluir: (0, secretaria_1.podeExcluirProcesso)(data, movimentos, c.ctx),
        };
    }
    if (p.action === 'autuar') {
        let unidadeId = String(p.unidade_id || '');
        // Unidade fixa pelo tipo: a sugerida, se quem autua está lotado nela; senão a escolhida (a de quem autua).
        if (p.tipo_id) {
            const t = (await db.collection(context_1.COL.tipos).doc(String(p.tipo_id)).get()).data();
            const sugerida = String((t === null || t === void 0 ? void 0 : t.unidade_inicial) || '');
            if ((t === null || t === void 0 ? void 0 : t.organization_id) === orgId && (0, camposProcesso_1.formularioDe)(t).unidade === 'oculto' && sugerida && c.ctx.unidadeIds.includes(sugerida)
                && c.unidades.some((u) => u.id === sugerida && u.ativa !== false))
                unidadeId = sugerida;
        }
        const unidade = c.unidades.find((u) => u.id === unidadeId && u.ativa !== false);
        if (!unidade)
            throw new https_1.HttpsError('invalid-argument', 'Escolha a unidade que autua o processo');
        if (!c.ctx.unidadeIds.includes(unidadeId)) {
            throw new https_1.HttpsError('permission-denied', 'Você só autua processos em unidade onde está lotado');
        }
        // Tipo de processo: define o rito e o sigilo padrão.
        let tipo = null;
        if (p.tipo_id) {
            tipo = (await db.collection(context_1.COL.tipos).doc(String(p.tipo_id)).get()).data() || null;
            if (!tipo || tipo.organization_id !== orgId || tipo.ativo === false || tipo.excluido === true)
                throw new https_1.HttpsError('invalid-argument', 'Escolha um tipo de processo ativo');
            if (tipo.orgao_id && tipo.orgao_id !== (unidade.orgao_id || null)) {
                const dono = (0, orgaos_1.nomeOrgao)(await (0, orgaos_2.lerOrgaos)(db, orgId), tipo.orgao_id);
                // Órgão removido deixa o tipo livre; órgão existente restringe.
                if (dono)
                    throw new https_1.HttpsError('failed-precondition', `${tipo.nome} é um tipo de processo de ${dono}. Autue por uma unidade desse órgão.`);
            }
        }
        const ritoSnap = await db.collection(context_1.COL.ritos).doc(String((tipo === null || tipo === void 0 ? void 0 : tipo.rito_id) || p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false || rito.excluido === true) {
            throw new https_1.HttpsError('invalid-argument', tipo ? 'O rito deste tipo de processo está inativo. Ajuste o tipo na Configuração.' : 'Escolha um rito ativo');
        }
        if (!tipo && rito.exigir_tipo === true)
            throw new https_1.HttpsError('failed-precondition', `O rito "${rito.nome}" só é autuado por um tipo de processo. Escolha o tipo.`);
        // Formulário do tipo: o que se pede, o que é obrigatório, o que não se usa e os campos próprios.
        const form = (0, camposProcesso_1.formularioDe)(tipo);
        // Sigilo e urgência fora do formulário valem o que o tipo define.
        const sigilo = (form.sigilo === 'oculto' ? tipo === null || tipo === void 0 ? void 0 : tipo.sigilo_padrao : p.sigilo || (tipo === null || tipo === void 0 ? void 0 : tipo.sigilo_padrao)) === 'restrito' ? 'restrito' : 'normal';
        const urgente = (form.urgencia !== 'oculto' && p.urgente === true) || (tipo === null || tipo === void 0 ? void 0 : tipo.urgente) === true;
        const motivoUrgencia = (0, secretaria_1.texto)(p.motivo_urgencia, secretaria_1.MAX_TEXTO_LONGO) || ((tipo === null || tipo === void 0 ? void 0 : tipo.urgente) === true ? `Tipo de processo urgente (${tipo.nome})` : '');
        if (urgente && !motivoUrgencia)
            throw new https_1.HttpsError('invalid-argument', 'Informe o motivo da urgência');
        const assuntoInformado = form.assunto === 'oculto' ? '' : (0, secretaria_1.texto)(p.assunto);
        const descricao = form.descricao === 'oculto' ? '' : (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
        const partes = form.partes === 'oculto' ? [] : sanitizePartes(p.partes, form.polos);
        // Nascido de outro registro: a origem vale mesmo que o formulário não a peça.
        const refOrigem = await refDaOrigem(c, (_g = p.origem) === null || _g === void 0 ? void 0 : _g.ref);
        const origemInformada = form.origem === 'oculto' ? null : (0, secretaria_1.sanitizeOrigem)(p.origem);
        const origem = refOrigem
            ? { tipo: (origemInformada === null || origemInformada === void 0 ? void 0 : origemInformada.tipo) || (refOrigem.modulo === 'pe' ? 'outro_processo' : 'outro'), descricao: (origemInformada === null || origemInformada === void 0 ? void 0 : origemInformada.descricao) || '', ref: refOrigem }
            : origemInformada;
        let campos = [];
        try {
            (0, camposProcesso_1.validarPadrao)(form, { assunto: assuntoInformado, descricao, partes, origem });
            campos = (0, camposProcesso_1.validarCampos)(form, p.campos, [], await (0, modulos_1.refsDoFormulario)(db, orgId, c.org, form, p.campos));
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        // Sem assunto pedido, o processo se chama pelo tipo.
        const assunto = assuntoInformado || (tipo === null || tipo === void 0 ? void 0 : tipo.nome) || rito.nome;
        // Numeração: a do tipo, a do órgão ou nenhuma (identificador SN-...).
        const numTipo = (0, numeracao_1.numeracaoTipoDe)(tipo === null || tipo === void 0 ? void 0 : tipo.numeracao);
        const numeracao = numTipo.modo === 'nenhuma' ? null
            : numTipo.modo === 'propria' ? { partes: numTipo.partes }
                : (0, numeracao_1.numeracaoDe)((_h = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _h === void 0 ? void 0 : _h.numeracao);
        const usaOrgao = numeracao === null || numeracao === void 0 ? void 0 : numeracao.partes.some((x) => x.t === 'sigla_orgao' || (x.t === 'seq' && x.escopo === 'orgao'));
        const orgao = usaOrgao && unidade.orgao_id ? (await (0, orgaos_2.lerOrgaos)(db, orgId)).find((o) => o.id === unidade.orgao_id) || null : null;
        const ctxNumero = { hoje: (0, secretaria_1.hojeBrasil)(), tipo: tipo ? { id: String(p.tipo_id), sigla: tipo.sigla, nome: tipo.nome } : null, unidade, orgao };
        const procRef = db.collection(context_1.COL.processos).doc();
        // Primeira fase com prazo automático: a contagem usa o calendário do órgão.
        const calendarioAutuacao = ((_j = rito.fases[0]) === null || _j === void 0 ? void 0 : _j.prazo_auto)
            ? (0, secretaria_1.sanitizeCalendario)((_k = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _k === void 0 ? void 0 : _k.calendario) : undefined;
        const contadorRef = numeracao ? db.collection(context_1.COL.contadores).doc((0, numeracao_1.chaveContador)(orgId, numeracao, ctxNumero)) : null;
        const numero = await db.runTransaction(async (tx) => {
            var _a;
            let numero = (0, numeracao_1.identificadorSemNumero)(procRef.id);
            if (numeracao && contadorRef) {
                const cont = await tx.get(contadorRef);
                let seq = (Number((_a = cont.data()) === null || _a === void 0 ? void 0 : _a.seq) || 0) + 1;
                // O número nunca se repete: se uma mudança de numeração fizer a
                // contagem cair num número já usado, pula para o próximo livre.
                // ponytail: até MAX_PULOS consultas; acima disso, pede ajuste da numeração.
                for (let i = 0;; i++, seq++) {
                    numero = (0, numeracao_1.formatarNumero)(numeracao, ctxNumero, seq);
                    const repetido = await tx.get(db.collection(context_1.COL.processos).where('organization_id', '==', orgId).where('numero', '==', numero).limit(1));
                    if (repetido.empty)
                        break;
                    if (i >= MAX_PULOS)
                        throw new https_1.HttpsError('failed-precondition', `Os números a partir de ${numero} já existem. Peça ao administrador para ajustar a numeração em Configuração, Tipos de processo.`);
                }
                tx.set(contadorRef, { organization_id: orgId, chave: contadorRef.id, seq, atualizado_em: new Date().toISOString() }, { merge: true });
            }
            const fases = rito.fases;
            // Campos que o tipo exige para sair de cada fase (cópia: mudar o tipo depois não muda este processo).
            const exigidos = (0, camposProcesso_1.camposExigidos)(form, fases.map((f) => f.id));
            const base = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ organization_id: orgId, numero }, (numeracao ? {} : { sem_numero: true })), { assunto,
                descricao,
                partes,
                campos }), (Object.keys(exigidos).length ? { campos_exigidos: exigidos } : {})), { sigilo }), (origem ? { origem } : {})), { 
                // Registros e processos ligados (origem e campos), para "Processos eletrônicos" no outro módulo.
                vinculos: (0, modulos_1.vinculosDe)(origem, campos) }), (urgente ? { urgente: true, urgencia: { motivo: motivoUrgencia, por: c.userName, em: new Date().toISOString() } } : {})), (tipo ? { tipo_id: String(p.tipo_id), tipo_nome: tipo.nome, tipo_versao: Number(tipo.versao) || 1 } : {})), { status: 'em_tramitacao', rito_id: ritoSnap.id, rito_nome: rito.nome, rito_versao: rito.versao || 1, fases, fase_atual: fases[0].id, unidade_atual: unidadeId, unidades_historico: [unidadeId], responsavel_uid: null, autuado_por: auth.uid, autuado_por_nome: c.userName, autuado_em: new Date().toISOString(), created_at: firestore_1.FieldValue.serverTimestamp(), mov_seq: 0, doc_seq: 0, ultimo_hash: '', version: 0, pendencias: [], prazos: [] }), (0, secretaria_1.derivados)([], []));
            const ef = efeitosDaMudanca(base, null, fases[0], calendarioAutuacao, c.userName);
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, base, 'autuacao', `Processo${tipo ? ` (${tipo.nome})` : ''} autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.${urgente ? ` Tramitação urgente: ${motivoUrgencia}` : ''}${ef.texto}`, Object.assign(Object.assign(Object.assign({ assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId }, (urgente ? { urgente: true } : {})), (origem ? { origem } : {})), (campos.length ? { campos: Object.fromEntries(campos.map((x) => [x.rotulo, (0, camposProcesso_1.valorTexto)(x)])) } : {})));
            const mi = registrarInternos(tx, c, procRef, Object.assign(Object.assign({}, base), mov), ef.interno);
            tx.set(procRef, Object.assign(Object.assign(Object.assign(Object.assign({}, base), ef.campos), mov), mi));
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }
    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = (0, secretaria_1.texto)(p.motivo, secretaria_1.MAX_TEXTO_LONGO);
    // Feriados locais e recesso do órgão entram na contagem de prazos.
    const calendario = ['abrirPrazo', 'tramitar', 'avancarFase'].includes(String(p.action))
        ? (0, secretaria_1.sanitizeCalendario)((_l = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _l === void 0 ? void 0 : _l.calendario)
        : undefined;
    const cfgCom = p.action === 'expedirComunicacao' ? await (0, comunicacoes_1.configComunicacoes)(db, orgId) : null;
    let expedidas = 1;
    const convite = { token: '', email: '', parte: '', numero: '', representaQuem: '' };
    let recebeu = null;
    let pendenciaAberta = null;
    const resultado = await db.runTransaction(async (tx) => {
        var _a, _b, _d, _e, _f, _g, _h, _j, _k;
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.id, tx);
        (0, context_1.conferirVersao)(data, p.version);
        (0, context_1.exigirPosse)(c, data);
        // Campos exigidos por fase: valem os que o tipo ainda pede (lido antes de qualquer escrita).
        const tipoAtual = data.campos_exigidos && data.tipo_id && ['tramitar', 'avancarFase', 'alterarStatus'].includes(String(p.action))
            ? (await tx.get(db.collection(context_1.COL.tipos).doc(String(data.tipo_id)))).data() : null;
        const formAtual = tipoAtual && tipoAtual.organization_id === orgId ? (0, camposProcesso_1.formularioDe)(tipoAtual) : null;
        if (data.status === 'arquivado' && p.action !== 'alterarStatus') {
            throw new https_1.HttpsError('failed-precondition', 'Processo arquivado: reative-o antes de movimentar');
        }
        if (p.action === 'tramitar') {
            const destino = c.unidades.find((u) => u.id === p.unidade_destino && u.ativa !== false);
            if (!destino)
                throw new https_1.HttpsError('invalid-argument', 'Unidade de destino inválida');
            if (destino.id === data.unidade_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa unidade');
            // Remessa a gabinete é conclusão: o processo vai para quem decide.
            const conclusao = destino.tipo === 'gabinete';
            // Opcional, num só ato: mudar a fase (quando a próxima corre em outra unidade)
            // e deixar uma orientação para a unidade que recebe (devolução do gabinete).
            const fases = (data.fases || []);
            const novaFase = p.fase_id ? fases.find((f) => f.id === p.fase_id) : null;
            if (p.fase_id && !novaFase)
                throw new https_1.HttpsError('invalid-argument', 'Fase inválida');
            if (novaFase && novaFase.id === data.fase_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (novaFase && data.fase_suspensa === true)
                throw new https_1.HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            const foraDoFluxo = !!novaFase && !(0, secretaria_1.fasesSeguintes)(fases, data.fase_atual).some((f) => f.id === novaFase.id);
            if (foraDoFluxo && !motivo)
                throw new https_1.HttpsError('invalid-argument', `${novaFase.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const contraCondicao = novaFase && !foraDoFluxo ? foraDaCondicao(data, novaFase.id) : null;
            if (contraCondicao && !motivo)
                throw new https_1.HttpsError('invalid-argument', `O rito leva a ${novaFase.nome} quando ${contraCondicao}. Informe o motivo para seguir por ela.`);
            const orientacao = (0, secretaria_1.texto)(p.orientacao, secretaria_1.MAX_TEXTO_LONGO);
            const faseDe = ((_a = fases.find((f) => f.id === data.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || data.fase_atual;
            // Remessa entre órgãos internos: o termo diz de qual órgão para qual.
            const orgaoDe = ((_b = c.unidades.find((u) => u.id === data.unidade_atual)) === null || _b === void 0 ? void 0 : _b.orgao_id) || null;
            const orgaoPara = destino.orgao_id || null;
            const entreOrgaos = orgaoDe !== orgaoPara;
            const orgaos = entreOrgaos ? await (0, orgaos_2.lerOrgaos)(db, orgId, tx) : [];
            const com = (nome, orgaoId) => ((0, orgaos_1.nomeOrgao)(orgaos, orgaoId) ? `${(0, orgaos_1.nomeOrgao)(orgaos, orgaoId)} › ${nome}` : nome);
            // Minutas que seguem com o processo (ex.: a da assessoria para o gabinete revisar e assinar).
            const idsMinutas = [...new Set((Array.isArray(p.minutas) ? p.minutas : []).map(String))].slice(0, secretaria_1.MAX_MINUTAS_REMESSA);
            const minutas = await Promise.all(idsMinutas.map((id) => tx.get(ref.collection('documentos').doc(id))));
            for (const s of minutas) {
                const d = s.data();
                if (!d || d.status !== 'minuta' || !(0, secretaria_1.minutaAcessivel)(d, [String(data.unidade_atual)])) {
                    throw new https_1.HttpsError('invalid-argument', 'Só seguem com o processo minutas que estão com a unidade que remete');
                }
            }
            const dispensadas = novaFase ? dispensarExigencias(data, motivo, formAtual) : [];
            // O rito pode deixar a remessa fora dos autos (ex.: distribuição a assessoria).
            // Remessa entre órgãos muda quem é competente: sempre nos autos.
            const destinoMov = entreOrgaos || dispensadas.length ? 'autos' : (0, exigencias_1.destinoDoMovimento)(fases, data.fase_atual, novaFase === null || novaFase === void 0 ? void 0 : novaFase.id);
            // Sair do grupo da certidão conjunta: a pendente é emitida antes da remessa.
            const em = emitirSe(!!novaFase && (0, exigencias_1.deveEmitir)(fases, data.consolidacao, data.fase_atual, novaFase.id), tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            // A remessa já tira o responsável: os efeitos não repetem isso.
            const ef = novaFase ? efeitosDaMudanca(Object.assign(Object.assign({}, data), { responsavel_uid: null }), String(data.fase_atual), novaFase, calendario, c.userName) : SEM_EFEITOS;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, conclusao ? 'conclusao' : 'tramitacao', `${conclusao ? 'Conclusos a' : 'Remetido de ' + com((0, context_1.nomeUnidade)(c, data.unidade_atual), orgaoDe) + ' para'} ${com(destino.nome, orgaoPara)}.`
                + `${novaFase ? ` Fase alterada de ${faseDe} para ${novaFase.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${ef.texto}` : ''}`
                + `${textoDispensa(dispensadas)}${motivo ? ` Motivo: ${motivo}` : ''}${orientacao ? ` Orientação: ${orientacao}` : ''}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ de: data.unidade_atual, para: destino.id }, (entreOrgaos ? { orgao_de: orgaoDe, orgao_para: orgaoPara } : {})), (novaFase ? Object.assign(Object.assign({ fase_de: data.fase_atual, fase_para: novaFase.id }, (foraDoFluxo ? { fora_do_fluxo: true } : {})), (contraCondicao ? { fora_da_condicao: true } : {})) : {})), (dispensadas.length ? { dispensadas } : {})), (0, exigencias_1.marcasDoDestino)(destinoMov)), (idsMinutas.length ? { minutas: idsMinutas } : {})));
            const mi = registrarInternos(tx, c, ref, Object.assign(Object.assign({}, em.proc), mov), ef.interno);
            if (ef.interno.length)
                expedidas += 1;
            minutas.forEach((s) => tx.update(s.ref, { unidades_acesso: firestore_1.FieldValue.arrayUnion(destino.id) }));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), { unidade_atual: destino.id, unidades_historico: firestore_1.FieldValue.arrayUnion(destino.id), responsavel_uid: null, recebido_em: new Date().toISOString() }), (novaFase ? Object.assign(Object.assign({ fase_atual: novaFase.id }, (0, exigencias_1.camposAoEntrarNaFase)(data, novaFase.id)), ef.campos) : {})), { orientacao: orientacao
                    ? { texto: orientacao, por: c.userName, em: new Date().toISOString(), de: (0, context_1.nomeUnidade)(c, data.unidade_atual) }
                    : firestore_1.FieldValue.delete() }));
            recebeu = { unidadeId: destino.id, proc: data };
            return mov;
        }
        if (p.action === 'alterarDados') {
            // Corrige a descrição e os campos próprios e, com motivo, retifica a
            // autuação (assunto, origem, sigilo e partes); o que mudou fica nos autos.
            const tipo = data.tipo_id ? (await tx.get(db.collection(context_1.COL.tipos).doc(String(data.tipo_id)))).data() : null;
            const antes = (data.campos || []);
            // Obrigatório criado depois da autuação não trava a correção de quem nunca o teve.
            const form = (0, camposProcesso_1.formParaCorrecao)((0, camposProcesso_1.formularioDe)(tipo && tipo.organization_id === orgId ? tipo : null), antes, String(data.descricao || ''));
            const descricao = form.descricao === 'oculto' || !('descricao' in p) ? String(data.descricao || '') : (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
            // Cada dado da autuação só muda se vier no pedido (cliente antigo segue igual).
            const vem = (k) => k in p && form[k] !== 'oculto';
            const assuntoInformado = vem('assunto') ? (0, secretaria_1.texto)(p.assunto) : '';
            const assunto = vem('assunto') ? assuntoInformado || String(data.tipo_nome || data.rito_nome || data.assunto) : String(data.assunto || '');
            const origemAntes = (data.origem || null);
            let origem = origemAntes;
            if (vem('origem')) {
                const o = (0, secretaria_1.sanitizeOrigem)(p.origem);
                // A ligação com o registro de origem nunca vem do cliente nem sai.
                origem = (origemAntes === null || origemAntes === void 0 ? void 0 : origemAntes.ref) ? { tipo: (o === null || o === void 0 ? void 0 : o.tipo) || origemAntes.tipo, descricao: (o === null || o === void 0 ? void 0 : o.descricao) || '', ref: origemAntes.ref } : o;
            }
            const sigilo = vem('sigilo') ? (p.sigilo === 'restrito' ? 'restrito' : 'normal') : data.sigilo;
            const partesAntes = (data.partes || []);
            let ret = { partes: partesAntes, mudou: [], retiradas: [], renomeadas: [] };
            let campos = [];
            try {
                if (vem('partes'))
                    ret = (0, camposProcesso_1.retificarPartes)(partesAntes, p.partes, form.polos, MAX_PARTES, { em: new Date().toISOString(), por: c.userName });
                (0, camposProcesso_1.validarPadrao)(Object.assign(Object.assign(Object.assign(Object.assign({}, form), (vem('assunto') ? {} : { assunto: 'opcional' })), (vem('partes') ? {} : { partes: 'opcional' })), (vem('origem') ? {} : { origem: 'opcional' })), { assunto: assuntoInformado, descricao, partes: ret.partes.filter((x) => !x.retirada), origem });
                campos = 'campos' in p ? (0, camposProcesso_1.validarCampos)(form, p.campos, antes, await (0, modulos_1.refsDoFormulario)(db, orgId, c.org, form, p.campos, antes)) : antes;
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            // Campo que o tipo deixou de ter continua no processo como foi gravado.
            const idsForm = new Set(form.campos.map((x) => x.id));
            if ('campos' in p)
                campos = [...campos, ...antes.filter((x) => !idsForm.has(x.id))];
            const retif = [];
            if (assunto !== String(data.assunto || ''))
                retif.push(`Assunto: "${data.assunto || ''}" → "${assunto}"`);
            if (sigilo !== data.sigilo)
                retif.push(`Sigilo: ${data.sigilo || 'normal'} → ${sigilo}`);
            if (JSON.stringify(origem ? { t: origem.tipo, d: origem.descricao } : null) !== JSON.stringify(origemAntes ? { t: origemAntes.tipo, d: origemAntes.descricao } : null))
                retif.push('Origem alterada');
            retif.push(...ret.mudou);
            const mudou = (0, camposProcesso_1.diferencasCampos)(antes, campos);
            if (descricao !== String(data.descricao || ''))
                mudou.unshift('Descrição alterada');
            if (!mudou.length && !retif.length)
                throw new https_1.HttpsError('invalid-argument', 'Nada foi alterado');
            const extra = {};
            if (retif.length) {
                if (motivo.replace(/[^\p{L}]/gu, '').length < 5)
                    throw new https_1.HttpsError('invalid-argument', 'Informe o motivo da retificação (ao menos 5 letras)');
                // Parte que sai com comunicação aguardando ciência: a ciência por decurso correria contra quem saiu.
                const pendente = (data.comunicacoes || []).find((x) => x.status === 'aguardando' && ret.retiradas.includes(x.parte_idx));
                if (pendente)
                    throw new https_1.HttpsError('failed-precondition', `${((_d = partesAntes[pendente.parte_idx]) === null || _d === void 0 ? void 0 : _d.nome) || 'A parte'} tem comunicação aguardando ciência. Torne sem efeito as comunicações pendentes antes de retirar a parte.`);
                const convites = db.collection(context_1.COL.convites);
                for (const i of ret.retiradas) {
                    // Quem sai perde o portal: convites revogados e contas desligadas, também dos representantes.
                    const _l = ret.partes[i], { uid: _u, convite_hash: hash } = _l, resto = __rest(_l, ["uid", "convite_hash"]);
                    if (hash)
                        tx.set(convites.doc(hash), { revogado: true }, { merge: true });
                    const reps = (resto.representantes || []).map((_a) => {
                        var { uid: _r, convite_hash: h } = _a, r = __rest(_a, ["uid", "convite_hash"]);
                        if (h)
                            tx.set(convites.doc(h), { revogado: true }, { merge: true });
                        return r;
                    });
                    ret.partes[i] = Object.assign(Object.assign({}, resto), (resto.representantes ? { representantes: reps } : {}));
                }
                // Quem mudou de nome continua com o que é seu: convite pendente,
                // prazo aberto, comunicação aguardando ciência e petição em aberto
                // (o portal casa prazos e petições pelo nome).
                let prazos = (data.prazos || []);
                let pendencias = (data.pendencias || []);
                let comunicacoes = (data.comunicacoes || []);
                for (const i of ret.renomeadas) {
                    const x = ret.partes[i];
                    const velho = partesAntes[i].nome;
                    if (x.convite_hash)
                        tx.set(convites.doc(x.convite_hash), { parte_nome: x.nome }, { merge: true });
                    for (const r of x.representantes || [])
                        if (r.convite_hash)
                            tx.set(convites.doc(r.convite_hash), { parte_nome: x.nome }, { merge: true });
                    prazos = prazos.map((q) => (q.status === 'aberto' && q.destinatario === velho ? Object.assign(Object.assign({}, q), { destinatario: x.nome }) : q));
                    pendencias = pendencias.map((q) => (q.status === 'aberta' && String(q.aberta_por || '').startsWith(`${velho} (`) ? Object.assign(Object.assign({}, q), { aberta_por: `${x.nome}${String(q.aberta_por).slice(velho.length)}` }) : q));
                    comunicacoes = comunicacoes.map((q) => (q.parte_idx === i && q.status === 'aguardando' ? Object.assign(Object.assign({}, q), { parte_nome: x.nome }) : q));
                }
                if (ret.renomeadas.length)
                    Object.assign(extra, { prazos, pendencias, comunicacoes });
                if (ret.retiradas.length) {
                    extra.partes_uids = [...new Set(ret.partes.filter((x) => !x.retirada).flatMap((x) => [x.uid, ...(x.representantes || []).map((r) => r.uid)]).filter((u) => !!u))];
                }
                extra.partes = ret.partes;
                extra.assunto = assunto;
                extra.sigilo = sigilo;
                extra.origem = origem;
            }
            // Retificação mexe na identificação do processo: sempre nos autos, com o termo próprio.
            const mov = retif.length
                ? (0, context_1.registrarMovimento)(tx, c, ref, data, 'retificacao', `Autuação retificada. Motivo: ${motivo}. ${[...retif, ...mudou].join('; ')}.`.slice(0, secretaria_1.MAX_TEXTO_LONGO), { motivo, campos: mudou.length, retificados: retif.length, visivel_partes: false })
                : (0, context_1.registrarMovimento)(tx, c, ref, data, 'dados', `Dados do processo alterados. ${mudou.join('; ')}.${motivo ? ` Motivo: ${motivo}` : ''}`.slice(0, secretaria_1.MAX_TEXTO_LONGO), Object.assign({ campos: mudou.length, visivel_partes: false }, (0, exigencias_1.marcasNaFase)(data, 'dados')));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { descricao, campos }), extra), { vinculos: (0, modulos_1.vinculosDe)(origem, campos, data.vinculos_acoes || []) }));
            return mov;
        }
        if (p.action === 'concluirOrientacao') {
            if (!data.orientacao)
                throw new https_1.HttpsError('failed-precondition', 'Não há orientação pendente');
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'orientacao_concluida', `Orientação de ${data.orientacao.de || 'outra unidade'} concluída: ${data.orientacao.texto}${motivo ? ` ${motivo}` : ''}`);
            tx.update(ref, Object.assign(Object.assign({}, mov), { orientacao: firestore_1.FieldValue.delete() }));
            return mov;
        }
        if (p.action === 'marcarAcao') {
            // Caixa de marcar das ações da fase: movimento interno leve, sem documento.
            const fase = (data.fases || []).find((f) => f.id === data.fase_atual);
            const idx = Number(p.acao_idx);
            const acao = (_e = fase === null || fase === void 0 ? void 0 : fase.acoes) === null || _e === void 0 ? void 0 : _e[idx];
            if (!fase || !acao)
                throw new https_1.HttpsError('invalid-argument', 'Ação da fase inválida');
            const regra = (_f = fase.acoes_regras) === null || _f === void 0 ? void 0 : _f[idx];
            const respostas = (0, exigencias_1.respostasDaFase)(data);
            // Ação condicional: só vale com a resposta que o rito pede.
            if (p.feita !== false && !(0, exigencias_1.acaoAtiva)(fase, idx, respostas)) {
                throw new https_1.HttpsError('failed-precondition', `"${acao}" só vale quando ${textoCondicao(fase, regra.se)}`);
            }
            // Quem pode cumprir: o rito pode reservar ao responsável designado ou a quem gere a unidade.
            if ((regra === null || regra === void 0 ? void 0 : regra.quem) && !c.ctx.isAdmin) {
                const pode = regra.quem === 'responsavel' ? data.responsavel_uid === c.ctx.uid : c.gestorDe.includes(String(data.unidade_atual));
                if (!pode) {
                    throw new https_1.HttpsError('permission-denied', regra.quem === 'responsavel'
                        ? `"${acao}" é do responsável pelo processo. Peça a atribuição ou a quem está designado.`
                        : `"${acao}" é de quem gere a unidade.`);
                }
            }
            // Ação que o rito liga a um documento se cumpre na juntada (ou guardando o documento), não aqui.
            if (regra === null || regra === void 0 ? void 0 : regra.documento) {
                throw new https_1.HttpsError('failed-precondition', regra.documento.destino
                    ? `"${acao}" se cumpre guardando o documento no processo. Redija ou envie o documento e use "Guardar fora dos autos".`
                    : `"${acao}" se cumpre com a juntada do documento. Redija ou envie o documento e junte-o aos autos.`);
            }
            const feita = p.feita !== false;
            const feitas = Object.assign({}, (data.acoes_feitas || {}));
            const lista = new Set(feitas[fase.id] || []);
            // Duas pessoas marcando a mesma caixa: a segunda não gera movimento repetido.
            if (lista.has(idx) === feita)
                throw new https_1.HttpsError('aborted', feita ? 'Esta ação já estava feita' : 'Esta ação já estava desfeita');
            // O dado que a ação pede (texto, número, data, escolha), conferido como num campo do processo.
            const dado = feita ? await valorDaAcao(c, regra, acao, p.valor) : null;
            // Registro de origem restrita: as partes nunca o veem.
            const vePartes = (0, exigencias_1.partesVeem)(regra) && !(dado === null || dado === void 0 ? void 0 : dado.restrito);
            if (feita)
                lista.add(idx);
            else
                lista.delete(idx);
            feitas[fase.id] = [...lista].sort((a, b) => a - b);
            // Resposta de escolha guardada na rodada da fase: as ações e saídas condicionadas a leem.
            const respondeu = (0, exigencias_1.opcoesDaResposta)(regra) !== null;
            const todasRespostas = Object.assign({}, (data.acoes_respostas || {}));
            if (respondeu) {
                const daFase = Object.assign({}, (todasRespostas[fase.id] || {}));
                if (feita && dado)
                    daFase[String(idx)] = (0, exigencias_1.chaveDaResposta)(dado.valor);
                else
                    delete daFase[String(idx)];
                todasRespostas[fase.id] = daFase;
            }
            const comResposta = respondeu ? { acoes_respostas: todasRespostas } : {};
            // O rito diz onde fica: certidão nos autos (com folha), evento no extrato, só no sistema ou sem evento.
            const dest = (0, exigencias_1.destinoDaAcao)(regra);
            const comDado = dado ? ` ${dado.rotulo}: ${dado.valor_texto}.` : '';
            if (dest === 'consolidar') {
                // Certidão conjunta: o ato fica oculto e entra como item da certidão do grupo.
                const grupo = (0, exigencias_1.grupoDe)(fase);
                const cons = data.consolidacao;
                const pendente = (cons === null || cons === void 0 ? void 0 : cons.grupo) === grupo ? (cons.itens || []) : [];
                const k = pendente.map((i) => i.fase_id === fase.id && i.acao_idx === idx).lastIndexOf(true);
                if (!feita && k < 0) {
                    // Já saiu em certidão emitida: desfazer precisa constar dos autos.
                    const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acao_fase', `Certifico que foi desfeita a providência "${acao}", da fase ${fase.nome}.`, { fase_id: fase.id, acao_idx: idx, feita, destino: 'autos', nos_autos: true, visivel_partes: (0, exigencias_1.partesVeem)(regra) });
                    tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { acoes_feitas: feitas }), comResposta));
                    return mov;
                }
                const item = {
                    seq: 0, fase_id: fase.id, acao_idx: idx,
                    texto: (0, exigencias_1.textoDoItem)(`"${acao}", da fase ${fase.nome}.${comDado}`.replace(/\.$/, '')),
                    autor: c.userName, em: new Date().toISOString(), partes: vePartes,
                };
                const em = emitirSe(feita && antesDeJuntar(data, grupo, item), tx, c, ref, data);
                if (em.proc !== data)
                    expedidas = 2;
                const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'acao_fase', `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado} ${feita ? 'Entra na' : 'Sai da'} certidão conjunta, ainda não emitida.`, Object.assign(Object.assign(Object.assign(Object.assign({ fase_id: fase.id, acao_idx: idx, feita }, (dado ? Object.assign({ rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto }, (dado.ref ? { ref: dado.ref } : {})) : {})), { 
                    // O ato fica oculto; o dado segue a regra (as partes o veem nas informações, se ela disser).
                    destino: dest, consolidada: true }), (0, exigencias_1.marcasDoDestino)('nenhum')), { visivel_partes: vePartes }));
                const consolidacao = feita
                    ? itensDepois(em.proc, grupo, Object.assign(Object.assign({}, item), { seq: Number(mov.mov_seq) }))
                    : { grupo, itens: pendente.filter((_, j) => j !== k) };
                tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), { acoes_feitas: feitas }), comResposta), { consolidacao: consolidacao.itens.length ? consolidacao : firestore_1.FieldValue.delete() }), vinculoDaAcao(dado)));
                return mov;
            }
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acao_fase', dest === 'autos'
                ? `Certifico que ${feita ? 'foi cumprida' : 'foi desfeita'} a providência "${acao}", da fase ${fase.nome}.${comDado}`
                : `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ fase_id: fase.id, acao_idx: idx, feita }, (dado ? Object.assign({ rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto }, (dado.ref ? { ref: dado.ref } : {})) : {})), { destino: dest }), (dest === 'autos' ? { nos_autos: true } : {})), (dest === 'informacao' ? { fora_impressao: true } : {})), { visivel_partes: vePartes }), (dest === 'nenhum' ? (0, exigencias_1.marcasDoDestino)('nenhum') : {})));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { acoes_feitas: feitas }), comResposta), vinculoDaAcao(dado)));
            return mov;
        }
        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !((unidade === null || unidade === void 0 ? void 0 : unidade.membros_uids) || []).includes(alvo)) {
                throw new https_1.HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? ((_g = (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()) === null || _g === void 0 ? void 0 : _g.user_name) || 'membro' : '';
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'atribuicao', alvo ? `Atribuído a ${nomeAlvo}.` : 'Atribuição removida.', Object.assign({ responsavel_uid: alvo }, (0, exigencias_1.marcasNaFase)(data, 'atribuicao')));
            tx.update(ref, Object.assign(Object.assign({}, mov), { responsavel_uid: alvo }));
            return mov;
        }
        if (p.action === 'avancarFase') {
            const fases = (data.fases || []);
            const alvo = p.fase_id
                ? fases.find((f) => f.id === p.fase_id)
                : (0, secretaria_1.proximaFase)({ nome: '', descricao: '', fases }, data.fase_atual);
            if (!alvo)
                throw new https_1.HttpsError('invalid-argument', 'Não há fase seguinte; escolha uma fase do rito');
            if (alvo.id === data.fase_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (data.fase_suspensa === true) {
                throw new https_1.HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            }
            // Sair do fluxo desenhado no rito é permitido, mas exige justificativa.
            const foraDoFluxo = !(0, secretaria_1.fasesSeguintes)(fases, data.fase_atual).some((f) => f.id === alvo.id);
            if (foraDoFluxo && !motivo)
                throw new https_1.HttpsError('invalid-argument', `${alvo.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const contraCondicao = foraDoFluxo ? null : foraDaCondicao(data, alvo.id);
            if (contraCondicao && !motivo)
                throw new https_1.HttpsError('invalid-argument', `O rito leva a ${alvo.nome} quando ${contraCondicao}. Informe o motivo para seguir por ela.`);
            const de = ((_h = fases.find((f) => f.id === data.fase_atual)) === null || _h === void 0 ? void 0 : _h.nome) || data.fase_atual;
            const dispensadas = dispensarExigencias(data, motivo, formAtual);
            const destinoMov = dispensadas.length ? 'autos' : (0, exigencias_1.destinoDoMovimento)(fases, data.fase_atual, alvo.id);
            // Certidão conjunta: sair do grupo emite a pendente; mudar dentro dele pode virar item dela
            // (nunca com dispensa, que vai aos autos, nem quando as duas fases pedem "sem evento").
            // Motivo longo não se resume numa certidão conjunta: a mudança tem termo próprio.
            const grupo = (0, exigencias_1.grupoDe)(alvo);
            const descricao = `Fase alterada de ${de} para ${alvo.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${textoDispensa(dispensadas)}${motivo ? ` ${motivo}` : ''}`;
            const junta = !dispensadas.length && destinoMov !== 'nenhum' && descricao.length <= exigencias_1.MAX_ITEM_CERTIDAO && (0, exigencias_1.mudancaNaCertidao)(fases, data.fase_atual, alvo.id);
            const item = { seq: 0, fase_id: data.fase_atual, texto: descricao.replace(/\.$/, ''), autor: c.userName, em: new Date().toISOString(), partes: destinoMov === 'autos' };
            const em = emitirSe((0, exigencias_1.deveEmitir)(fases, data.consolidacao, data.fase_atual, alvo.id) || (junta && antesDeJuntar(data, grupo, item)), tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            const ef = efeitosDaMudanca(data, String(data.fase_atual), alvo, calendario, c.userName);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'fase', `${descricao}${junta ? ' Entra na certidão conjunta.' : ''}${ef.texto}`, Object.assign(Object.assign(Object.assign(Object.assign({ de: data.fase_atual, para: alvo.id }, (foraDoFluxo ? { fora_do_fluxo: true } : {})), (contraCondicao ? { fora_da_condicao: true } : {})), (dispensadas.length ? { dispensadas } : {})), (junta ? Object.assign({ consolidada: true }, (0, exigencias_1.marcasDoDestino)('nenhum')) : (0, exigencias_1.marcasDoDestino)(destinoMov))));
            const consolidacao = junta
                ? { consolidacao: itensDepois(em.proc, grupo, Object.assign(Object.assign({}, item), { seq: Number(mov.mov_seq) })) }
                : {};
            const mi = registrarInternos(tx, c, ref, Object.assign(Object.assign(Object.assign({}, em.proc), mov), consolidacao), ef.interno);
            if (ef.interno.length)
                expedidas += 1;
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), consolidacao), { fase_atual: alvo.id }), (0, exigencias_1.camposAoEntrarNaFase)(data, alvo.id)), ef.campos));
            return mov;
        }
        if (p.action === 'urgencia') {
            const urgente = p.urgente === true;
            if (urgente === (data.urgente === true))
                throw new https_1.HttpsError('invalid-argument', urgente ? 'O processo já está marcado como urgente' : 'O processo não está marcado como urgente');
            if (!motivo)
                throw new https_1.HttpsError('invalid-argument', 'Informe o motivo');
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'urgencia', `${urgente ? 'Processo marcado como urgente' : 'Urgência retirada'}. Motivo: ${motivo}`, Object.assign({ urgente }, (0, exigencias_1.marcasNaFase)(data, 'urgencia')));
            tx.update(ref, Object.assign(Object.assign({}, mov), { urgente, urgencia: urgente ? { motivo, por: c.userName, em: new Date().toISOString() } : firestore_1.FieldValue.delete() }));
            return mov;
        }
        // ---- Comunicações às partes (intimação, notificação...) ---------------
        if (p.action === 'expedirComunicacao') {
            if (data.status !== 'em_tramitacao')
                throw new https_1.HttpsError('failed-precondition', 'O processo não está em tramitação');
            const lista = (_j = p.comunicacao) === null || _j === void 0 ? void 0 : _j.partes_idx;
            expedidas = Array.isArray(lista) ? new Set(lista).size || 1 : 1;
            return (0, comunicacoes_1.expedir)(tx, c, ref, data, p.comunicacao, cfgCom);
        }
        if (p.action === 'tornarSemEfeito')
            return (0, comunicacoes_1.tornarSemEfeito)(tx, c, ref, data, p.comunicacao_id, motivo);
        if (p.action === 'alterarStatus') {
            const status = String(p.status || '');
            if (!['em_tramitacao', 'sobrestado', 'arquivado'].includes(status)) {
                throw new https_1.HttpsError('invalid-argument', 'Situação inválida');
            }
            if (status === data.status)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa situação');
            if (!motivo)
                throw new https_1.HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            // Arquivar com documento exigido em aberto: o motivo vale como dispensa, e fica dito.
            const dispensadas = status === 'arquivado' ? exigenciasAbertas(data, formAtual).map((e) => e.descricao) : [];
            // Arquivar encerra a certidão conjunta pendente (sobrestar, não: o processo volta à mesma fase).
            const em = emitirSe(status === 'arquivado', tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            const ef = status === 'arquivado' ? efeitosDaMudanca(data, String(data.fase_atual), null, undefined, c.userName) : SEM_EFEITOS;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'situacao', `${rotulo}. Motivo: ${motivo}${dispensadas.length ? ` Exigências do rito não cumpridas: ${dispensadas.join('; ')}.` : ''}${ef.texto}`, Object.assign({ de: data.status, para: status }, (dispensadas.length ? { dispensadas } : {})));
            const mi = registrarInternos(tx, c, ref, Object.assign(Object.assign({}, em.proc), mov), ef.interno);
            if (ef.interno.length)
                expedidas += 1;
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), { status }), ef.campos));
            return mov;
        }
        if (p.action === 'emitirCertidao') {
            // "Emitir certidão agora": a pendente vai aos autos sem esperar o fim do grupo.
            const em = emitirSe(true, tx, c, ref, data);
            if (em.proc === data)
                throw new https_1.HttpsError('failed-precondition', 'Não há atos aguardando a certidão conjunta');
            tx.update(ref, em.mov);
            return em.mov;
        }
        // ---- Pendências: o que o decisor precisa apreciar --------------------
        const pendencias = (data.pendencias || []);
        const prazos = (data.prazos || []);
        const agora = new Date().toISOString();
        if (p.action === 'abrirPendencia') {
            const descricao = (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
            if (!descricao)
                throw new https_1.HttpsError('invalid-argument', 'Descreva o que precisa ser apreciado');
            if (pendencias.length >= secretaria_1.MAX_ITENS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de pendências do processo');
            const nova = {
                id: ref.collection('_').doc().id, tipo: 'manual', descricao, interrompe: p.interrompe === true,
                status: 'aberta', aberta_em: agora, aberta_por: c.userName,
            };
            const lista = [...pendencias, nova];
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'pendencia', `Pendência aberta para o decisor: ${descricao}${nova.interrompe ? ' (fase interrompida)' : ''}.`, Object.assign({ pendencia_id: nova.id, interrompe: nova.interrompe }, (0, exigencias_1.marcasNaFase)(data, 'pendencia')));
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { pendencias: lista }), (0, secretaria_1.derivados)(lista, prazos)));
            pendenciaAberta = { proc: data, descricao };
            return mov;
        }
        if (p.action === 'resolverPendencia') {
            // Apreciar é ato de decisão: só o gabinete que tem o processo.
            if (((_k = c.unidades.find((u) => u.id === data.unidade_atual)) === null || _k === void 0 ? void 0 : _k.tipo) !== 'gabinete') {
                throw new https_1.HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete. Faça a conclusão do processo antes.');
            }
            const alvo = pendencias.find((x) => x.id === p.pendencia_id && x.status === 'aberta');
            if (!alvo)
                throw new https_1.HttpsError('not-found', 'Pendência aberta não encontrada');
            const resolucao = (0, secretaria_1.texto)(p.resolucao, secretaria_1.MAX_TEXTO_LONGO);
            if (!resolucao)
                throw new https_1.HttpsError('invalid-argument', 'Registre a decisão sobre a pendência');
            const lista = pendencias.map((x) => (x.id === alvo.id
                ? Object.assign(Object.assign({}, x), { status: 'resolvida', resolvida_em: agora, resolvida_por: c.userName, resolucao }) : x));
            const der = (0, secretaria_1.derivados)(lista, prazos);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'pendencia_resolvida', `Pendência apreciada (${alvo.descricao}): ${resolucao}${alvo.interrompe && !der.fase_suspensa ? ' Fase retomada.' : ''}`, Object.assign({ pendencia_id: alvo.id }, (0, exigencias_1.marcasNaFase)(data, 'pendencia')));
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { pendencias: lista }), der));
            return mov;
        }
        // ---- Prazos -----------------------------------------------------------
        if (p.action === 'abrirPrazo') {
            const descricao = (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
            const dias = Number(p.dias);
            const contagem = p.contagem === 'corridos' ? 'corridos' : 'uteis';
            if (!descricao)
                throw new https_1.HttpsError('invalid-argument', 'Descreva o prazo');
            if (!Number.isInteger(dias) || dias < 1 || dias > secretaria_1.MAX_PRAZO_DIAS)
                throw new https_1.HttpsError('invalid-argument', 'Informe os dias do prazo');
            if (prazos.length >= secretaria_1.MAX_ITENS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de prazos do processo');
            const inicio = (0, secretaria_1.hojeBrasil)();
            const novo = {
                id: ref.collection('_').doc().id, descricao, destinatario: (0, secretaria_1.texto)(p.destinatario), dias, contagem,
                inicio, vence_em: (0, secretaria_1.calcularVencimento)(inicio, dias, contagem, calendario), status: 'aberto',
                aberto_em: agora, aberto_por: c.userName,
            };
            const lista = [...prazos, novo];
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'prazo', `Prazo de ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'} aberto: ${descricao}${novo.destinatario ? ` (${novo.destinatario})` : ''}. Vence em ${novo.vence_em.split('-').reverse().join('/')}.`, Object.assign({ prazo_id: novo.id, vence_em: novo.vence_em }, (0, exigencias_1.marcasNaFase)(data, 'prazo')));
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { prazos: lista }), (0, secretaria_1.derivados)(pendencias, lista)));
            return mov;
        }
        if (p.action === 'encerrarPrazo') {
            const alvo = prazos.find((x) => x.id === p.prazo_id && x.status === 'aberto');
            if (!alvo)
                throw new https_1.HttpsError('not-found', 'Prazo aberto não encontrado');
            const res = p.resultado === 'cancelado' ? 'cancelado' : 'cumprido';
            const hoje = (0, secretaria_1.hojeBrasil)();
            const lista = prazos.map((x) => (x.id === alvo.id ? Object.assign(Object.assign({}, x), { status: res, encerrado_em: hoje, encerrado_por: c.userName }) : x));
            const quando = res === 'cumprido' ? (hoje <= alvo.vence_em ? ' no prazo' : ' fora do prazo') : '';
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'prazo_encerrado', `Prazo ${res}${quando}: ${alvo.descricao}.${motivo ? ` ${motivo}` : ''}`, Object.assign({ prazo_id: alvo.id, resultado: res }, (alvo.automatico === true ? (0, exigencias_1.marcasDoDestino)('informacao') : (0, exigencias_1.marcasNaFase)(data, 'prazo'))));
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { prazos: lista }), (0, secretaria_1.derivados)(pendencias, lista)));
            return mov;
        }
        if (p.action === 'convidarParte' || p.action === 'revogarParte') {
            const idx = Number(p.parte_idx);
            const partes = [...(data.partes || [])];
            const parte = partes[idx];
            if (!Number.isInteger(idx) || !parte)
                throw new https_1.HttpsError('invalid-argument', 'Parte inválida');
            if (parte.retirada)
                throw new https_1.HttpsError('failed-precondition', `${parte.nome} foi retirada do processo`);
            const reps = [...(parte.representantes || [])];
            let ridx = p.representante_idx === undefined || p.representante_idx === null ? -1 : Number(p.representante_idx);
            const novoRep = p.action === 'convidarParte' && p.representante && typeof p.representante === 'object' ? p.representante : null;
            if (novoRep) {
                const nome = (0, secretaria_1.texto)(novoRep.nome, 120);
                if (!nome)
                    throw new https_1.HttpsError('invalid-argument', 'Informe o nome do representante');
                if (reps.length >= MAX_REPRESENTANTES)
                    throw new https_1.HttpsError('invalid-argument', `Até ${MAX_REPRESENTANTES} representantes por parte`);
                const emailRep = (0, secretaria_1.texto)(novoRep.email, 120);
                reps.push(Object.assign({ nome }, (emailRep ? { email: emailRep } : {})));
                ridx = reps.length - 1;
            }
            const alvo = ridx >= 0 ? reps[ridx] : parte;
            if (!alvo)
                throw new https_1.HttpsError('invalid-argument', 'Representante inválido');
            const rotulo = ridx >= 0 ? `${alvo.nome}, representante de ${parte.nome} (${parte.polo})` : `${parte.nome} (${parte.polo})`;
            const dadosMov = Object.assign({ parte_idx: idx }, (ridx >= 0 ? { representante: alvo.nome } : {}));
            // Convite anterior ainda não usado deixa de valer em qualquer dos dois casos.
            if (alvo.convite_hash)
                tx.set(db.collection(context_1.COL.convites).doc(alvo.convite_hash), { revogado: true }, { merge: true });
            if (p.action === 'revogarParte') {
                const antigo = alvo.uid;
                // A parte continua no processo; sem conta nem convite, não há o que revogar.
                if (ridx < 0 && !antigo && !alvo.convite_hash)
                    throw new https_1.HttpsError('failed-precondition', `${parte.nome} não tem acesso nem convite pendente no portal`);
                if (ridx >= 0) {
                    reps.splice(ridx, 1);
                    partes[idx] = Object.assign(Object.assign({}, parte), { representantes: reps });
                }
                else {
                    const { uid: _u, convite_hash: _c } = parte, resto = __rest(parte, ["uid", "convite_hash"]);
                    partes[idx] = resto;
                }
                const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acesso_revogado', antigo || alvo.convite_hash ? `Acesso de ${rotulo} ao portal das partes revogado.` : `${rotulo} retirado do processo.`, dadosMov);
                tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { partes }), (antigo ? { partes_uids: firestore_1.FieldValue.arrayRemove(antigo) } : {})));
                return mov;
            }
            if (alvo.uid)
                throw new https_1.HttpsError('failed-precondition', `${ridx >= 0 ? 'Este representante' : 'Esta parte'} já acompanha o processo. Revogue o acesso antes de convidar de novo.`);
            const email = (0, secretaria_1.texto)(p.email, 120) || alvo.email || '';
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                throw new https_1.HttpsError('invalid-argument', 'E-mail inválido');
            convite.token = (0, crypto_1.randomBytes)(24).toString('base64url');
            convite.email = email;
            convite.parte = alvo.nome;
            convite.representaQuem = ridx >= 0 ? parte.nome : '';
            convite.numero = data.numero;
            const hash = (0, secretaria_1.sha256)(convite.token);
            tx.set(db.collection(context_1.COL.convites).doc(hash), {
                organization_id: orgId, processo_id: ref.id, parte_idx: idx, parte_nome: parte.nome, email,
                representante_idx: ridx >= 0 ? ridx : null, representante_nome: ridx >= 0 ? alvo.nome : null,
                criado_por: c.ctx.uid, criado_em: new Date().toISOString(),
                expira_em: new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString(), usado_por: null, revogado: false,
            });
            const atualizado = Object.assign(Object.assign(Object.assign({}, alvo), { convite_hash: hash }), (email ? { email } : {}));
            if (ridx >= 0) {
                reps[ridx] = atualizado;
                partes[idx] = Object.assign(Object.assign({}, parte), { representantes: reps });
            }
            else
                partes[idx] = atualizado;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'convite', `${rotulo} convidado a acompanhar o processo pelo portal das partes${email ? ' (convite por e-mail)' : ''}.`, dadosMov);
            tx.update(ref, Object.assign(Object.assign({}, mov), { partes }));
            return mov;
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    // Partes habilitadas recebem e-mail dos movimentos públicos (fora da transação, sem travar o ato).
    void (0, portalAvisos_1.avisarPartesDoMovimento)(db, String(p.id), undefined, expedidas);
    const r = recebeu;
    if (r)
        void (0, avisosEquipe_1.avisarUnidadeRecebeu)(c, r.unidadeId, r.proc, String(p.id), motivo || (0, secretaria_1.texto)(p.orientacao, secretaria_1.MAX_TEXTO_LONGO));
    const pa = pendenciaAberta;
    if (pa)
        void (0, avisosEquipe_1.avisarPendencia)(c, pa.proc, String(p.id), pa.descricao);
    if (convite.token) {
        const link = `${APP_URL}/Portal?convite=${convite.token}`;
        const enviado = convite.email ? await (0, email_1.sendEmail)({
            to: convite.email,
            subject: `Convite para acompanhar o processo ${convite.numero}`,
            html: `<p>Olá, ${escapar(convite.parte)}.</p><p>Você foi habilitado a acompanhar o processo <b>${escapar(convite.numero)}</b>${convite.representaQuem ? ` como representante de <b>${escapar(convite.representaQuem)}</b>` : ''} e a peticionar nele pelo portal das partes.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false) : false;
        return { success: true, version: resultado.version, link, emailEnviado: enviado };
    }
    return { success: true, version: resultado.version };
});
//# sourceMappingURL=processos.js.map