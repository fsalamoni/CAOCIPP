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
exports.avancarSozinho = avancarSozinho;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const config_1 = require("./config");
const autos_1 = require("../shared/autos");
const exigencias_1 = require("../shared/exigencias");
const permissoesFase_1 = require("../shared/permissoesFase");
const efeitosFase_1 = require("../shared/efeitosFase");
const prazosFase_1 = require("../shared/prazosFase");
const comunicacaoRito_1 = require("../shared/comunicacaoRito");
const ajustePrazo_1 = require("../shared/ajustePrazo");
const audiencias_1 = require("../shared/audiencias");
const email_1 = require("../shared/email");
const camposProcesso_1 = require("../shared/camposProcesso");
const numeracao_1 = require("../shared/numeracao");
const informacoes_1 = require("../shared/informacoes");
const modulos_1 = require("../shared/modulos");
const situacaoRegistro_1 = require("../shared/situacaoRegistro");
const history_1 = require("../shared/history");
const normalization_1 = require("../shared/normalization");
const webhooks_1 = require("../shared/webhooks");
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
/** Texto da condição para mensagens: "Decisão" for Deferido ou Parcial (com as fases, diz de qual fase é a resposta). */
const textoCondicao = (f, c, fases) => (0, exigencias_1.textoDaCondicao)(f, c, (Array.isArray(fases) ? fases : undefined));
function efeitosDaMudanca(proc, deId, para, calendario, quem, opts = {}) {
    var _a;
    const hoje = (0, secretaria_1.hojeBrasil)();
    const agora = new Date().toISOString();
    const frases = [];
    const interno = [];
    const antes = (proc.prazos || []);
    const saida = (0, prazosFase_1.encerrarPrazosDaFase)(antes, deId, hoje, quem);
    let prazos = saida.prazos;
    interno.push(...saida.notas);
    const dias = Number(para === null || para === void 0 ? void 0 : para.prazo_dias);
    if ((para === null || para === void 0 ? void 0 : para.prazo_auto) && !((_a = para.ao_entrar) === null || _a === void 0 ? void 0 : _a.arquivar) && Number.isInteger(dias) && dias > 0 && dias <= secretaria_1.MAX_PRAZO_DIAS && prazos.length < secretaria_1.MAX_ITENS) {
        const contagem = para.prazo_contagem === 'corridos' ? 'corridos' : 'uteis';
        const vence = (0, secretaria_1.calcularVencimento)(hoje, dias, contagem, calendario);
        prazos = [...prazos, Object.assign({ id: (0, crypto_1.randomBytes)(10).toString('hex'), descricao: `Fase ${para.nome}`, fase_id: para.id, dias, contagem, inicio: hoje, vence_em: vence, status: 'aberto', aberto_em: agora, aberto_por: quem, automatico: true }, (0, prazosFase_1.marcasDoPrazo)(para))];
        interno.push(`Prazo interno da fase aberto: ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'}, vence em ${vence.split('-').reverse().join('/')}.`);
    }
    const campos = {};
    // Saída da fase (salvo para a espera, que volta a ela como estava): as comunicações da rodada deixam de contar.
    const comSaida = (para === null || para === void 0 ? void 0 : para.espera) ? null : (0, comunicacaoRito_1.encerrarComunicacoesDaFase)(proc.comunicacoes, deId);
    if (comSaida)
        campos.comunicacoes = comSaida;
    if (deId && !(para === null || para === void 0 ? void 0 : para.espera) && !opts.retomada && proc.aguarda_resposta === true)
        campos.aguarda_resposta = false;
    const ae = para === null || para === void 0 ? void 0 : para.ao_entrar;
    if (para && (ae === null || ae === void 0 ? void 0 : ae.urgente) && proc.urgente !== true) {
        campos.urgente = true;
        campos.urgencia = { motivo: `Regra da fase ${para.nome}`, por: quem, em: agora };
        frases.push('Tramitação urgente pela regra da fase.');
    }
    // Na autuação não há urgência anterior a tirar: vale o que quem autua (ou o tipo) disse.
    if ((ae === null || ae === void 0 ? void 0 : ae.sem_urgencia) && deId && proc.urgente === true) {
        campos.urgente = false;
        campos.urgencia = firestore_1.FieldValue.delete();
        frases.push('Urgência retirada pela regra da fase.');
    }
    if ((ae === null || ae === void 0 ? void 0 : ae.sigilo) && (proc.sigilo === 'restrito' ? 'restrito' : 'normal') !== ae.sigilo) {
        campos.sigilo = ae.sigilo;
        interno.push(`Sigilo do processo alterado para ${ae.sigilo} pela regra da fase.`);
    }
    const antesPend = (proc.pendencias || []);
    let pendencias = antesPend;
    let pendencia;
    if (para && !opts.retomada) {
        if ((ae === null || ae === void 0 ? void 0 : ae.sem_responsavel) && proc.responsavel_uid) {
            campos.responsavel_uid = null;
            interno.push('Responsável designado retirado pela regra da fase.');
        }
        const d = opts.designacao;
        if ((d === null || d === void 0 ? void 0 : d.uid) && d.uid !== proc.responsavel_uid) {
            campos.responsavel_uid = d.uid;
            interno.push(`Responsável designado pela regra da fase: ${d.nome || 'pessoa lotada na unidade'}.`);
        }
        else if (d && !d.uid)
            interno.push(d.nota);
        if ((ae === null || ae === void 0 ? void 0 : ae.pendencia) && !ae.arquivar && pendencias.length < secretaria_1.MAX_ITENS) {
            const interrompe = ae.pendencia_interrompe === true;
            pendencias = [...pendencias, {
                    id: (0, crypto_1.randomBytes)(10).toString('hex'), tipo: 'manual', descricao: ae.pendencia, interrompe,
                    status: 'aberta', aberta_em: agora, aberta_por: `Regra da fase ${para.nome}`,
                }];
            pendencia = ae.pendencia;
            interno.push(`Pendência aberta para o decisor pela regra da fase: ${ae.pendencia}${interrompe ? ' (fase interrompida)' : ''}.`);
        }
    }
    // Prazos das ações da fase que entra: os que já valem (na retomada, o que foi feito continua feito).
    if (para && !(ae === null || ae === void 0 ? void 0 : ae.arquivar)) {
        const depois = Object.assign(Object.assign(Object.assign(Object.assign({}, proc), campos), { prazos, fase_atual: para.id }), (opts.retomada ? {} : (0, exigencias_1.camposAoEntrarNaFase)(proc, para.id)));
        const pa = (0, prazosFase_1.prazosDasAcoes)(depois, para, hoje, agora, calendario, quem, () => (0, crypto_1.randomBytes)(10).toString('hex'));
        if (pa) {
            prazos = pa.prazos;
            interno.push(...pa.notas);
        }
    }
    if (prazos !== antes || pendencias !== antesPend) {
        Object.assign(campos, Object.assign(Object.assign(Object.assign({}, (prazos !== antes ? { prazos } : {})), (pendencias !== antesPend ? { pendencias } : {})), (0, secretaria_1.derivados)(pendencias, prazos)));
    }
    return Object.assign({ texto: frases.length ? ` ${frases.join(' ')}` : '', interno, campos }, (pendencia ? { pendencia } : {}));
}
/**
 * Quem a fase designa como responsável ao entrar, entre os lotados na unidade
 * que fica com o processo, com o nome (para o registro interno e para o
 * registro ligado). Null: a fase não designa.
 */
async function designadoPelaFase(c, fase, unidade) {
    const d = (0, efeitosFase_1.responsavelPelaFase)(fase === null || fase === void 0 ? void 0 : fase.ao_entrar, unidade ? (0, secretaria_1.lotacoesDe)(unidade) : [], c.ctx.uid);
    if (!(d === null || d === void 0 ? void 0 : d.uid))
        return d;
    if (d.uid === c.ctx.uid)
        return Object.assign(Object.assign({}, d), { nome: c.userName });
    const m = (await c.db.collection('userOrganizations').doc(`${d.uid}_${c.orgId}`).get()).data();
    return Object.assign(Object.assign({}, d), { nome: (0, normalization_1.formatPersonName)(String((m === null || m === void 0 ? void 0 : m.user_name) || (m === null || m === void 0 ? void 0 : m.user_email) || 'pessoa lotada na unidade')) });
}
/** O que a fase fez sozinha e só interessa à equipe: registro interno, sem termo, fora do portal. */
const SEM_EFEITOS = { texto: '', interno: [], campos: {} };
const SEM_REGISTROS = new Map();
/**
 * Lê, dentro da transação e antes de qualquer escrita, o registro ligado de
 * cada módulo que alguma fase do rito conduz (`situacao_registro`). Rito sem
 * essa regra não lê nada.
 */
async function lerRegistrosDoRito(tx, c, proc) {
    const regras = (proc.fases || []).map((f) => f.situacao_registro).filter((s) => !!(s === null || s === void 0 ? void 0 : s.modulo));
    if (!regras.length)
        return SEM_REGISTROS;
    const ligadas = (0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(c.db));
    const lidos = new Map();
    const paginas = [...new Set(regras.filter((s) => s.modulo === 'paginas').map((s) => String(s.pagina)))];
    if (paginas.length)
        await lerPaginasDoRito(tx, c, proc, paginas, ligadas.paginas, lidos);
    for (const m of [...new Set(regras.map((s) => s.modulo))].filter((x) => x !== 'paginas')) {
        const nome = modulos_1.ROTULO_MODULO[m];
        const alvo = (0, situacaoRegistro_1.registroDoProcesso)(proc, m);
        if (!ligadas[m])
            lidos.set(m, { falta: `a integração com ${nome} está desligada` });
        else if ('falta' in alvo)
            lidos.set(m, { falta: alvo.falta === 'varios' ? `o processo tem mais de um registro de ${nome} ligado e não nasceu de nenhum deles` : `o processo não tem registro de ${nome} ligado` });
        else {
            const ref = c.db.collection(modulos_1.COLECAO[m]).doc(alvo.id);
            const d = (await tx.get(ref)).data();
            if (!d || d.organization_id !== c.orgId)
                lidos.set(m, { falta: `o registro de ${nome} ligado não existe mais` });
            else if (d.anonymized === true)
                lidos.set(m, { falta: `o registro de ${nome} ligado foi anonimizado` });
            else
                lidos.set(m, { ref, doc: d, modulo: m, numero: (0, modulos_1.refDe)(m, alvo.id, d).numero });
        }
    }
    return lidos;
}
/**
 * Páginas próprias que o rito conduz: de cada página, o registro de onde o
 * processo nasceu ou o único dela ligado ao processo, com o tipo (as fases e as
 * regras de transição). Chave `paginas:<id do tipo>`.
 */
async function lerPaginasDoRito(tx, c, proc, paginas, ligada, lidos) {
    var _a, _b;
    const nome = modulos_1.ROTULO_MODULO.paginas;
    if (!ligada) {
        for (const p of paginas)
            lidos.set(`paginas:${p}`, { falta: `a integração com ${nome} está desligada` });
        return;
    }
    const origem = ((_b = (_a = proc.origem) === null || _a === void 0 ? void 0 : _a.ref) === null || _b === void 0 ? void 0 : _b.modulo) === 'paginas' ? String(proc.origem.ref.id || '') : '';
    // ponytail: lê até 20 registros de páginas ligados ao processo; além disso a regra não acha o registro e avisa.
    const ids = [...new Set([origem, ...(Array.isArray(proc.vinculos) ? proc.vinculos : []).map(String).filter((v) => v.startsWith('paginas:')).map((v) => v.slice(8))])]
        .filter((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id)).slice(0, 20);
    const docs = [];
    for (const id of ids) {
        const ref = c.db.collection(modulos_1.COLECAO.paginas).doc(id);
        const d = (await tx.get(ref)).data();
        if (d && d.organization_id === c.orgId)
            docs.push({ ref, d });
    }
    for (const p of paginas) {
        const chave = `paginas:${p}`;
        const tipo = /^[A-Za-z0-9_-]{1,128}$/.test(p) ? (await tx.get(c.db.collection('entityTypes').doc(p))).data() : undefined;
        if (!tipo || tipo.organization_id !== c.orgId) {
            lidos.set(chave, { falta: 'a página própria não existe mais' });
            continue;
        }
        const plural = String(tipo.label_plural || tipo.label_singular || nome);
        const daPagina = docs.filter((x) => x.d.entity_type_id === p);
        const alvo = daPagina.find((x) => x.ref.id === origem) || (daPagina.length === 1 ? daPagina[0] : null);
        if (!alvo)
            lidos.set(chave, { falta: daPagina.length ? `o processo tem mais de um registro de ${plural} ligado e não nasceu de nenhum deles` : `o processo não tem registro de ${plural} ligado` });
        else
            lidos.set(chave, { ref: alvo.ref, doc: alvo.d, modulo: 'paginas', numero: (0, modulos_1.refDePagina)(alvo.ref.id, alvo.d, tipo).numero, tipo, rotulo: String(tipo.label_singular || 'Registro') });
    }
}
/** Entrada do histórico do registro conduzido (mesmo formato dos módulos). */
function gravarNoRegistro(tx, c, r, campos, action) {
    const agora = new Date();
    const entrada = { date: agora.toISOString().split('T')[0], time: agora.toTimeString().split(' ')[0], user_id: c.ctx.uid, user_name: c.userName, action, timestamp: agora.toISOString() };
    // `set` com `merge`: registros importados têm campos com ponto no nome, que `update` leria como caminho.
    tx.set(r.ref, Object.assign(Object.assign({}, campos), { updated_at: firestore_1.FieldValue.serverTimestamp(), updated_by: c.ctx.uid, activity_log: firestore_1.FieldValue.arrayUnion(entrada) }), { merge: true });
    tx.set(r.ref.collection('history').doc((0, history_1.historyEntryId)(entrada)), Object.assign(Object.assign({}, entrada), { created_at: firestore_1.FieldValue.serverTimestamp() }));
}
/**
 * Põe o registro ligado na situação que a fase pede (ao entrar nela ou quando
 * alguém assume o processo). Vai na mesma transação do ato: a fase do processo
 * e a coluna do registro nunca ficam diferentes. Devolve o que dizer à equipe
 * no registro interno e, se o registro foi arquivado, os dados para o webhook.
 */
function aplicarSituacao(tx, c, registros, fase, gatilho, proc, quem) {
    const cfg = fase === null || fase === void 0 ? void 0 : fase.situacao_registro;
    const alvo = cfg === null || cfg === void 0 ? void 0 : cfg[gatilho];
    if (!fase || !cfg || !alvo)
        return { notas: [], arquivou: null };
    const nome = modulos_1.ROTULO_MODULO[cfg.modulo];
    const r = registros.get((0, situacaoRegistro_1.chaveDoRegistro)(cfg));
    if (!r || 'falta' in r)
        return { notas: [`Situação em ${nome} não alterada: ${r ? r.falta : 'o registro ligado não foi lido'}.`], arquivou: null };
    if (cfg.modulo === 'paginas') {
        // A mudança passa pelas regras de transição da página, com quem pratica o ato no processo.
        const pg = (0, situacaoRegistro_1.mudancasDaPagina)(r.tipo, r.doc, alvo, { userId: c.ctx.uid, userRole: c.papel || 'member' }, (0, secretaria_1.hojeBrasil)());
        if (!pg)
            return { notas: [], arquivou: null };
        if ('motivo' in pg)
            return { notas: [`${r.rotulo} ${r.numero}: a fase não mudou para "${pg.para}". ${pg.motivo}`], arquivou: null };
        gravarNoRegistro(tx, c, r, pg.campos, `Fase: ${pg.de} → ${pg.para} (pelo processo eletrônico ${proc.numero}, fase ${fase.nome})`);
        return { notas: [`${r.rotulo} ${r.numero}: fase "${pg.para}" pela regra da fase.`], arquivou: null };
    }
    const m = (0, situacaoRegistro_1.mudancasDaSituacao)(r.doc, alvo, (0, secretaria_1.hojeBrasil)(), quem);
    if (!m)
        return { notas: [], arquivou: null };
    gravarNoRegistro(tx, c, r, m, `Situação "${alvo}" pelo processo eletrônico ${proc.numero} (fase ${fase.nome})`);
    return {
        notas: [`${nome} ${r.numero}: situação "${alvo}" pela regra da fase.`],
        arquivou: m.archived_date ? { modulo: r.modulo, id: r.ref.id, numero: r.numero } : null,
    };
}
/**
 * Fase de espera: entrar nela guarda de onde o processo veio (fase, unidade e
 * responsável); sair dela apaga. A volta para a fase de origem é a retomada.
 */
function camposDaEspera(proc, de, para) {
    if (para.espera) {
        if (de === null || de === void 0 ? void 0 : de.espera)
            return {};
        const espera = { fase: String(proc.fase_atual), unidade: String(proc.unidade_atual), responsavel_uid: proc.responsavel_uid || null, desde: new Date().toISOString() };
        return { espera };
    }
    return (de === null || de === void 0 ? void 0 : de.espera) && proc.espera ? { espera: firestore_1.FieldValue.delete() } : {};
}
/** O processo está voltando da espera para a fase de onde veio? Ela é retomada como estava. */
const ehRetomada = (proc, de, para) => { var _a; return !!para && (de === null || de === void 0 ? void 0 : de.espera) === true && ((_a = proc.espera) === null || _a === void 0 ? void 0 : _a.fase) === para.id; };
const marcaEspera = (retomada, para) => (retomada ? ' (retomada depois da espera)' : para.espera ? ' (fase de espera)' : '');
/** Fase que arquiva ao entrar: o arquivamento é um ato próprio, logo depois da mudança de fase. */
function arquivarPelaFase(tx, c, ref, proc, fase) {
    const mov = (0, context_1.registrarMovimento)(tx, c, ref, proc, 'situacao', `Arquivado pela regra da fase ${fase.nome}.`, { de: proc.status, para: 'arquivado', automatico: true });
    return Object.assign(Object.assign({}, mov), { status: 'arquivado' });
}
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
    return textoCondicao(fase, cond, proc.fases);
}
function dispensarExigencias(c, proc, motivo, form) {
    const abertas = exigenciasAbertas(proc, form).map((e) => e.descricao);
    exigirDispensa(c, proc, abertas);
    if (abertas.length && !motivo) {
        throw new https_1.HttpsError('failed-precondition', `O rito exige nesta fase: ${abertas.join('; ')}. Cumpra o que falta ou informe o motivo da dispensa.`);
    }
    return abertas;
}
/**
 * Quem pratica o ato, como o rito o enxerga na unidade que tem o processo:
 * administração, gestão da unidade, responsável designado e a atribuição que a
 * pessoa tem na lotação (shared/permissoesFase.ts).
 */
function atorDe(c, proc) {
    var _a;
    const un = c.unidades.find((u) => u.id === proc.unidade_atual);
    return {
        isAdmin: c.ctx.isAdmin, gestor: c.gestorDe.includes(String(proc.unidade_atual)), responsavel: !!proc.responsavel_uid && proc.responsavel_uid === c.ctx.uid,
        atribuicao: un ? ((_a = (0, secretaria_1.lotacoesDe)(un).find((l) => l.uid === c.ctx.uid)) === null || _a === void 0 ? void 0 : _a.atribuicao) || '' : '',
    };
}
const faseDoProcesso = (proc) => (proc.fases || []).find((f) => f.id === proc.fase_atual);
/** O rito pode reservar a dispensa do que a fase exige a quem gere a unidade ou à administração. Lança HttpsError. */
function exigirDispensa(c, proc, abertas) {
    var _a;
    const fase = faseDoProcesso(proc);
    const r = (_a = fase === null || fase === void 0 ? void 0 : fase.permissoes) === null || _a === void 0 ? void 0 : _a.dispensar;
    if (abertas.length && r && !(0, permissoesFase_1.podeReserva)(r, atorDe(c, proc))) {
        throw new https_1.HttpsError('permission-denied', `O rito exige nesta fase: ${abertas.join('; ')}. Cumpra o que falta: na fase ${fase.nome}, só ${(0, permissoesFase_1.textoReserva)(r)} pode dispensar.`);
    }
}
/**
 * Reservas do rito para sair da fase: quem a conclui (ir para a fase de espera
 * não conclui) e quem segue por caminho diferente do previsto (fase fora do
 * fluxo, ou saída sem a resposta que o rito pede). Lança HttpsError.
 */
function exigirSaida(c, proc, faseSai, alvo, desvio) {
    const pm = faseSai === null || faseSai === void 0 ? void 0 : faseSai.permissoes;
    if (!pm)
        return;
    const a = atorDe(c, proc);
    if (pm.concluir && !alvo.espera && !(0, permissoesFase_1.podeQuem)(pm.concluir, pm.concluir_atribuicao, a)) {
        throw new https_1.HttpsError('permission-denied', `Pelo rito, só ${(0, permissoesFase_1.textoQuem)(pm.concluir, pm.concluir_atribuicao)} conclui a fase ${faseSai.nome}.`);
    }
    if (desvio && pm.desviar && !(0, permissoesFase_1.podeReserva)(pm.desviar, a)) {
        throw new https_1.HttpsError('permission-denied', `${alvo.nome} não é o caminho que o rito prevê agora. Na fase ${faseSai.nome}, só ${(0, permissoesFase_1.textoReserva)(pm.desviar)} segue por outro caminho.`);
    }
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
    const fases = (data.fases || []);
    const titulo = (0, exigencias_1.tituloCertidao)(fases, cons.grupo);
    const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'certidao_fase', (0, exigencias_1.textoCertidao)(cons.itens, (0, exigencias_1.aberturaCertidao)(fases, cons.grupo)), { grupo: cons.grupo, itens: cons.itens.map((i) => i.seq), titulo, visivel_partes: (0, exigencias_1.visivelCertidao)(cons.itens) });
    return { mov: Object.assign(Object.assign({}, mov), { consolidacao: firestore_1.FieldValue.delete() }), proc: Object.assign(Object.assign(Object.assign({}, data), mov), { consolidacao: null }) };
}
/** A pendente é de outro grupo ou não comporta o item na sua folha: emite antes de juntar. */
const antesDeJuntar = (data, grupo, item) => {
    var _a;
    const cons = data.consolidacao;
    return !!((_a = cons === null || cons === void 0 ? void 0 : cons.itens) === null || _a === void 0 ? void 0 : _a.length) && (cons.grupo !== grupo || !(0, exigencias_1.cabeNaCertidao)(cons.itens, item, (0, exigencias_1.aberturaCertidao)((data.fases || []), grupo)));
};
/** Itens da certidão do grupo depois do ato (a emissão, se houve, zerou a pendente). */
const itensDepois = (proc, grupo, item) => { var _a; return ({ grupo, itens: [...(((_a = proc.consolidacao) === null || _a === void 0 ? void 0 : _a.itens) || []), item] }); };
const textoDispensa = (d) => (d.length ? ` Dispensado o que o rito exigia na fase: ${d.join('; ')}.` : '');
/** Valor informado ao cumprir a ação, conferido contra o que o rito pede. Lança HttpsError. */
async function valorDaAcao(c, regra, acao, bruto) {
    const pede = (0, exigencias_1.pedidoDaAcao)(regra);
    if (pede === 'confirmar' || pede === 'documento' || pede === 'orientacao' || pede === 'comunicacao')
        return null;
    const rotulo = (regra === null || regra === void 0 ? void 0 : regra.rotulo) || acao;
    if (pede === 'audiencia') {
        let d = null;
        try {
            d = (0, audiencias_1.dadosDaAudiencia)(bruto, (0, secretaria_1.hojeBrasil)());
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        const t = (0, audiencias_1.textoDaAudiencia)(d);
        const nome = `${(0, audiencias_1.nomeDaAudiencia)(regra === null || regra === void 0 ? void 0 : regra.audiencia)} ${(0, audiencias_1.designadaDe)(regra === null || regra === void 0 ? void 0 : regra.audiencia)}`;
        return { rotulo: (regra === null || regra === void 0 ? void 0 : regra.rotulo) || nome, tipo: 'texto', valor: t, valor_texto: t, ref: undefined, refs: [], restrito: false, audiencia: d };
    }
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
        if (!ref || ((regra === null || regra === void 0 ? void 0 : regra.pagina) && ref.pagina !== regra.pagina))
            throw new https_1.HttpsError('invalid-argument', `"${rotulo}": registro não encontrado em ${modulos_1.ROTULO_MODULO[modulo]}`);
        // Página própria é interna: a informação nunca vai às partes.
        return { rotulo, tipo: 'registro', valor: ref.numero, valor_texto: ref.numero, ref, refs: [ref], restrito: ref.restrito === true || (0, modulos_1.ehInterno)(ref) };
    }
    const tipo = (pede === 'resposta' ? 'lista' : pede);
    let valor = null;
    try {
        valor = (0, camposProcesso_1.valorDe)({ rotulo, tipo, opcoes: pede === 'resposta' ? [...comunicacaoRito_1.RESPOSTAS] : (regra === null || regra === void 0 ? void 0 : regra.opcoes) || [] }, bruto);
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
    return Object.assign(Object.assign({ modulo: m, id, numero: ref.numero }, (ref.titulo ? { titulo: ref.titulo } : {})), (ref.pagina ? { pagina: ref.pagina } : {}));
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
        // Em fase de espera: a fase e a unidade para onde o processo volta.
        espera: d.espera ? { fase: String(d.espera.fase || ''), unidade: String(d.espera.unidade || ''), desde: String(d.espera.desde || '') } : null,
        proximo_vencimento: d.proximo_vencimento || null,
        // Calendário: até 5 prazos abertos (data e descrição curta), só em tramitação. Sem destinatário.
        prazos_abertos: d.status === 'em_tramitacao'
            ? (d.prazos || []).filter((x) => x.status === 'aberto' && x.vence_em)
                .sort((a, b) => String(a.vence_em).localeCompare(String(b.vence_em))).slice(0, 5)
                .map((x) => ({ vence_em: x.vence_em, descricao: String(x.descricao || '').slice(0, 60) }))
            : [],
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
    var _a, _b, _d, _e, _f, _g, _h, _j, _k;
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
            ref.collection('documentos').select('titulo', 'tipo', 'origem', 'status', 'mime', 'nome_arquivo', 'tamanho', 'sha256', 'ordem', 'unidade_origem', 'autor_nome', 'criado_em', 'juntado_em', 'assinaturas', 'peticao', 'visivel_partes', 'paginas', 'folha_inicial', 'folha_final', 'codigo_verificacao', 'assinaturas_pedidas', 'peticao_tipo', 'modelo_id', 'unidades_acesso', 'guardado_em', 'guardado_por_nome', 'versoes_qtd').get(),
        ]);
        // Dado reservado a quem gere a unidade: sai o valor para quem não pode vê-lo.
        const quemLe = { uid: c.ctx.uid, isAdmin: c.ctx.isAdmin, gestorDe: c.gestorDe };
        const movsBrutos = movs.docs.map((d) => d.data());
        const movimentos = movsBrutos.map((m) => (0, informacoes_1.semReservado)(m, quemLe));
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
            guardado_em: d.guardado_em || null, guardado_por: d.guardado_por_nome || null, versoes: Number(d.versoes_qtd) || 0,
        }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        // Registro que hoje está restrito, anonimizado ou sumiu: marcado na resposta (nada é gravado),
        // para a capa avisar e os modelos não puxarem dado dele.
        const informacoes = (0, informacoes_1.informacoesDoAndamento)(movsBrutos, data.fases || []).map((i) => (0, informacoes_1.informacaoVisivel)(i, quemLe));
        const camposLidos = (data.campos || []);
        const origemLida = ((_f = data.origem) === null || _f === void 0 ? void 0 : _f.ref) ? data.origem : null;
        const fechadas = await (0, modulos_1.refsFechadas)(db, c.orgId, [origemLida === null || origemLida === void 0 ? void 0 : origemLida.ref, ...camposLidos.map((x) => x.ref), ...informacoes.flatMap((i) => [i.ref, ...(i.refs || [])])]);
        // Página própria é sempre fechada para as partes, mas a equipe a vê normalmente.
        const fechada = (r) => !!r && !(0, modulos_1.ehInterno)(r) && fechadas.has(`${r.modulo}:${r.id}`);
        const marcar = (r) => (r && fechada(r) ? Object.assign(Object.assign({}, r), { restrito: true }) : r);
        return {
            processo: Object.assign(Object.assign({}, resumo(ref.id, data)), { descricao: data.descricao, campos: camposLidos.map((x) => (fechada(x.ref) ? Object.assign(Object.assign({}, x), { ref: Object.assign(Object.assign({}, x.ref), { restrito: true }) }) : x)), partes: (data.partes || []).map((_a) => {
                    var { convite_hash, uid, representantes } = _a, x = __rest(_a, ["convite_hash", "uid", "representantes"]);
                    return (Object.assign(Object.assign({}, x), { portal: uid ? 'ativo' : convite_hash ? 'convidado' : null, representantes: (representantes || []).map(({ convite_hash: ch, uid: u, nome, email }) => ({
                            nome, email: email || null, portal: u ? 'ativo' : ch ? 'convidado' : null,
                        })) }));
                }), fases: data.fases || [], unidades_historico: data.unidades_historico || [], 
                // A primeira unidade da lista é a que autuou (arrayUnion só acrescenta).
                unidade_autuacao: (data.unidades_historico || [])[0] || null, origem: origemLida && fechada(origemLida.ref) ? Object.assign(Object.assign({}, origemLida), { ref: Object.assign(Object.assign({}, origemLida.ref), { restrito: true }) }) : data.origem || null, autuado_em: data.autuado_em, autuado_por: data.autuado_por_nome, pendencias: data.pendencias || [], prazos: data.prazos || [], comunicacoes: data.comunicacoes || [], audiencias: data.audiencias || [], nomes_polos: data.nomes_polos || {}, acoes_feitas: data.acoes_feitas || {}, acoes_respostas: data.acoes_respostas || {}, 
                // Atos aguardando a certidão conjunta (para "Emitir certidão agora").
                consolidacao: data.consolidacao || null, exigencias_cumpridas: data.exigencias_cumpridas || {}, 
                // Em fase de espera: a fase e a unidade para onde o processo volta.
                espera: data.espera ? { fase: String(data.espera.fase || ''), unidade: String(data.espera.unidade || ''), desde: String(data.espera.desde || '') } : null, campos_exigidos: data.campos_exigidos || {} }),
            hoje: (0, secretaria_1.hojeBrasil)(),
            movimentos: movimentos.map((m) => (Object.assign(Object.assign({}, m), (0, autos_1.extrasDoEvento)(m, new Map(documentos.map((d) => [d.id, d])))))),
            documentos,
            informacoes: informacoes.map((i) => ([i.ref, ...(i.refs || [])].some(fechada)
                ? Object.assign(Object.assign(Object.assign({}, i), { restrito: true, ref: marcar(i.ref) }), (i.refs ? { refs: i.refs.map(marcar) } : {})) : i)),
            cadeiaQuebradaEm: (0, secretaria_1.verificarCadeia)(movsBrutos),
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
            ? Object.assign(Object.assign({ tipo: (origemInformada === null || origemInformada === void 0 ? void 0 : origemInformada.tipo) || (refOrigem.modulo === 'pe' ? 'outro_processo' : 'outro') }, ((origemInformada === null || origemInformada === void 0 ? void 0 : origemInformada.nome) ? { nome: origemInformada.nome } : {})), { descricao: (origemInformada === null || origemInformada === void 0 ? void 0 : origemInformada.descricao) || '', ref: refOrigem }) : origemInformada;
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
        const fase1 = rito.fases[0];
        const calendarioAutuacao = (fase1 === null || fase1 === void 0 ? void 0 : fase1.prazo_auto) || ((fase1 === null || fase1 === void 0 ? void 0 : fase1.acoes_regras) || []).some((r) => r === null || r === void 0 ? void 0 : r.prazo_dias)
            ? (0, secretaria_1.sanitizeCalendario)((_j = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _j === void 0 ? void 0 : _j.calendario) : undefined;
        const contadorRef = numeracao ? db.collection(context_1.COL.contadores).doc((0, numeracao_1.chaveContador)(orgId, numeracao, ctxNumero)) : null;
        // A primeira fase pode designar o responsável e avisar a equipe já na autuação.
        const designacaoInicial = await designadoPelaFase(c, fase1, unidade);
        let autuado = null;
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
            const base = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ organization_id: orgId, numero }, (numeracao ? {} : { sem_numero: true })), { assunto,
                descricao,
                partes,
                campos }), (Object.keys(exigidos).length ? { campos_exigidos: exigidos } : {})), { sigilo }), (origem ? { origem } : {})), { 
                // Registros e processos ligados (origem e campos), para "Processos eletrônicos" no outro módulo.
                vinculos: (0, modulos_1.vinculosDe)(origem, campos) }), (urgente ? { urgente: true, urgencia: { motivo: motivoUrgencia, por: c.userName, em: new Date().toISOString() } } : {})), (tipo ? { tipo_id: String(p.tipo_id), tipo_nome: tipo.nome, tipo_versao: Number(tipo.versao) || 1 } : {})), (tipo && Object.keys((0, camposProcesso_1.formularioDe)(tipo).nomes_polos).length ? { nomes_polos: (0, camposProcesso_1.formularioDe)(tipo).nomes_polos } : {})), { status: 'em_tramitacao', rito_id: ritoSnap.id, rito_nome: rito.nome, rito_versao: rito.versao || 1, fases, fase_atual: fases[0].id, unidade_atual: unidadeId, unidades_historico: [unidadeId], responsavel_uid: null, autuado_por: auth.uid, autuado_por_nome: c.userName, autuado_em: new Date().toISOString(), created_at: firestore_1.FieldValue.serverTimestamp(), mov_seq: 0, doc_seq: 0, ultimo_hash: '', version: 0, pendencias: [], prazos: [] }), (0, secretaria_1.derivados)([], []));
            const ef = efeitosDaMudanca(base, null, fases[0], calendarioAutuacao, c.userName, { designacao: designacaoInicial });
            autuado = Object.assign({ proc: Object.assign(Object.assign({}, base), ef.campos) }, (ef.pendencia ? { pendencia: ef.pendencia } : {}));
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, base, 'autuacao', `Processo${tipo ? ` (${tipo.nome})` : ''} autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.${urgente ? ` Tramitação urgente: ${motivoUrgencia}` : ''}${ef.texto}`, Object.assign(Object.assign(Object.assign({ assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId }, (urgente ? { urgente: true } : {})), (origem ? { origem } : {})), (campos.length ? { campos: Object.fromEntries(campos.map((x) => [x.rotulo, (0, camposProcesso_1.valorTexto)(x)])) } : {})));
            const mi = (0, context_1.registrarInternos)(tx, c, procRef, Object.assign(Object.assign({}, base), mov), ef.interno);
            tx.set(procRef, Object.assign(Object.assign(Object.assign(Object.assign({}, base), ef.campos), mov), mi));
            return numero;
        });
        const au = autuado;
        if (au && ((_k = fase1 === null || fase1 === void 0 ? void 0 : fase1.aviso) === null || _k === void 0 ? void 0 : _k.para))
            void (0, avisosEquipe_1.avisarEntradaNaFase)(c, fase1, unidadeId, au.proc, procRef.id, false, '');
        if (au === null || au === void 0 ? void 0 : au.pendencia)
            void (0, avisosEquipe_1.avisarPendencia)(c, au.proc, procRef.id, au.pendencia);
        return { success: true, id: procRef.id, numero };
    }
    return movimentar(c, p);
});
/**
 * Avanço automático da fase (`avanco: 'auto'`): cumprido o último item
 * obrigatório (ação marcada, documento juntado ou guardado), o processo segue
 * para a saída do rito, com a remessa à unidade
 * da fase de destino quando ela é outra. É o mesmo ato do botão "Concluir e
 * seguir", com as mesmas conferências; se ele não couber (algo em aberto, mais
 * de uma saída, o processo mudou), nada acontece e o botão continua na tela.
 */
async function avancarSozinho(c, id) {
    var _a, _b;
    try {
        const d = (await c.db.collection(context_1.COL.processos).doc(id).get()).data();
        if (!d)
            return null;
        const tipo = d.campos_exigidos && d.tipo_id ? (await c.db.collection(context_1.COL.tipos).doc(String(d.tipo_id)).get()).data() : null;
        const form = tipo && tipo.organization_id === c.orgId ? (0, camposProcesso_1.formularioDe)(tipo) : null;
        if (exigenciasAbertas(d, form).length)
            return null;
        // O sistema (regra do rito, sem ninguém no ato) não conclui fase cuja conclusão o rito reservou a alguém.
        const atualF = (d.fases || []).find((f) => f.id === d.fase_atual);
        if (c.ctx.uid === 'sistema' && ((_a = atualF === null || atualF === void 0 ? void 0 : atualF.permissoes) === null || _a === void 0 ? void 0 : _a.concluir))
            return null;
        const saida = (0, secretaria_1.saidaAutomatica)(d, c.unidades.filter((u) => u.ativa !== false).map((u) => String(u.id)));
        if (!saida)
            return null;
        const r = await movimentar(c, Object.assign({ organizationId: c.orgId, id, version: d.version, fase_id: saida.fase_id }, (saida.unidade_destino ? { action: 'tramitar', unidade_destino: saida.unidade_destino } : { action: 'avancarFase' })), { automatico: true });
        const fase = (d.fases || []).find((f) => f.id === saida.fase_id);
        return Object.assign(Object.assign({}, r), { avancou: { fase: (fase === null || fase === void 0 ? void 0 : fase.nome) || '', unidade: saida.unidade_destino ? (0, context_1.nomeUnidade)(c, saida.unidade_destino) : '', arquivado: ((_b = fase === null || fase === void 0 ? void 0 : fase.ao_entrar) === null || _b === void 0 ? void 0 : _b.arquivar) === true } });
    }
    catch (e) {
        console.warn('[secretaria] avanço automático não aplicado', id, e === null || e === void 0 ? void 0 : e.message);
        return null;
    }
}
/**
 * Movimentação de um processo existente. `opcoes.automatico`: chamada do
 * próprio servidor (avanço automático da fase); nunca vem do cliente.
 */
async function movimentar(c, p, opcoes = {}) {
    var _a, _b, _d;
    const { db, orgId } = c;
    const textoAuto = opcoes.automatico ? ' Avanço automático: o que a fase exigia foi cumprido.' : '';
    let tentarAuto = false;
    let registroArquivado = null;
    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = (0, secretaria_1.texto)(p.motivo, secretaria_1.MAX_TEXTO_LONGO);
    // Feriados locais e recesso do órgão entram na contagem de prazos.
    const calendario = ['abrirPrazo', 'prorrogarPrazo', 'devolverPrazo', 'tramitar', 'avancarFase', 'marcarAcao'].includes(String(p.action))
        ? (0, secretaria_1.sanitizeCalendario)((_a = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _a === void 0 ? void 0 : _a.calendario)
        : undefined;
    const cfgCom = p.action === 'expedirComunicacao' ? await (0, comunicacoes_1.configComunicacoes)(db, orgId) : null;
    let expedidas = 1;
    const convite = { token: '', email: '', parte: '', numero: '', representaQuem: '' };
    let recebeu = null;
    let pendenciaAberta = null;
    // Entrada em fase (com ou sem remessa): a fase diz quem é avisado.
    let entrou = null;
    const resultado = await db.runTransaction(async (tx) => {
        var _a, _b, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _s, _v;
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
        // Registro ligado (consulta, expediente) cuja situação o rito conduz: lido antes de qualquer escrita.
        const registros = ['tramitar', 'avancarFase', 'atribuir'].includes(String(p.action)) ? await lerRegistrosDoRito(tx, c, data) : SEM_REGISTROS;
        if (p.action === 'tramitar') {
            const destino = c.unidades.find((u) => u.id === p.unidade_destino && u.ativa !== false);
            if (!destino)
                throw new https_1.HttpsError('invalid-argument', 'Unidade de destino inválida');
            if (destino.id === data.unidade_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa unidade');
            // Remessa a quem decide (o gabinete, por padrão) é conclusão.
            const conclusao = (0, secretaria_1.unidadeDecide)(destino);
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
            const foraDoFluxo = !!novaFase && !(0, secretaria_1.saidasDoProcesso)(data).some((f) => f.id === novaFase.id);
            const faseSai = fases.find((f) => f.id === data.fase_atual);
            const retomada = ehRetomada(data, faseSai, novaFase);
            // De volta à unidade em que estava: quem respondia pelo processo volta a responder, se ainda estiver lotado nela.
            const esp = data.espera;
            const responsavelDeVolta = retomada && (esp === null || esp === void 0 ? void 0 : esp.responsavel_uid) && destino.id === esp.unidade && (destino.membros_uids || []).includes(esp.responsavel_uid) ? esp.responsavel_uid : null;
            if (novaFase)
                exigirSaida(c, data, faseSai, novaFase, foraDoFluxo || !!foraDaCondicao(data, novaFase.id));
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
            // Ir para a espera não conclui a fase: o que falta nela fica para a volta, sem dispensa.
            const dispensadas = novaFase && !novaFase.espera ? dispensarExigencias(c, data, motivo, formAtual) : [];
            // A fase pode designar o responsável entre os lotados na unidade que recebe (na retomada, volta quem respondia).
            const designacao = novaFase && !retomada ? await designadoPelaFase(c, novaFase, destino) : null;
            // O rito pode deixar a remessa fora dos autos (ex.: distribuição a assessoria).
            // Remessa entre órgãos muda quem é competente: sempre nos autos.
            const destinoMov = entreOrgaos || dispensadas.length ? 'autos' : (0, exigencias_1.destinoDoMovimento)(fases, data.fase_atual, novaFase === null || novaFase === void 0 ? void 0 : novaFase.id);
            // Sair do grupo da certidão conjunta: a pendente é emitida antes da remessa.
            // A fase de destino pode arquivar ao entrar: a certidão pendente sai antes.
            const arquiva = ((_d = novaFase === null || novaFase === void 0 ? void 0 : novaFase.ao_entrar) === null || _d === void 0 ? void 0 : _d.arquivar) === true;
            const em = emitirSe(!!novaFase && (arquiva || (0, exigencias_1.deveEmitir)(fases, data.consolidacao, data.fase_atual, novaFase.id)), tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            // A remessa já tira o responsável: os efeitos não repetem isso.
            const efFase = novaFase ? efeitosDaMudanca(Object.assign(Object.assign({}, data), { responsavel_uid: null }), String(data.fase_atual), novaFase, calendario, c.userName, { retomada, designacao }) : SEM_EFEITOS;
            // Designado pela fase: para o registro ligado, é alguém assumindo.
            const sit = aplicarSituacao(tx, c, registros, novaFase, (responsavelDeVolta || (designacao === null || designacao === void 0 ? void 0 : designacao.uid)) && ((_e = novaFase === null || novaFase === void 0 ? void 0 : novaFase.situacao_registro) === null || _e === void 0 ? void 0 : _e.ao_assumir) ? 'ao_assumir' : 'ao_entrar', data, (designacao === null || designacao === void 0 ? void 0 : designacao.uid) ? { uid: designacao.uid, nome: designacao.nome || '' } : undefined);
            registroArquivado = sit.arquivou;
            const ef = Object.assign(Object.assign({}, efFase), { interno: [...efFase.interno, ...sit.notas] });
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, conclusao ? 'conclusao' : 'tramitacao', `${conclusao ? 'Conclusos a' : 'Remetido de ' + com((0, context_1.nomeUnidade)(c, data.unidade_atual), orgaoDe) + ' para'} ${com(destino.nome, orgaoPara)}.`
                + `${novaFase ? ` Fase alterada de ${faseDe} para ${novaFase.nome}${marcaEspera(retomada, novaFase)}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${ef.texto}` : ''}`
                + `${textoDispensa(dispensadas)}${motivo ? ` Motivo: ${motivo}` : ''}${orientacao ? ` Orientação: ${orientacao}` : ''}${textoAuto}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ de: data.unidade_atual, para: destino.id }, (opcoes.automatico ? { automatico: true } : {})), (entreOrgaos ? { orgao_de: orgaoDe, orgao_para: orgaoPara } : {})), (novaFase ? Object.assign(Object.assign(Object.assign({ fase_de: data.fase_atual, fase_para: novaFase.id }, (retomada ? { retomada: true } : {})), (foraDoFluxo ? { fora_do_fluxo: true } : {})), (contraCondicao ? { fora_da_condicao: true } : {})) : {})), (dispensadas.length ? { dispensadas } : {})), (0, exigencias_1.marcasDoDestino)(destinoMov)), (idsMinutas.length ? { minutas: idsMinutas } : {})));
            const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, em.proc), mov), ef.interno);
            if (ef.interno.length)
                expedidas += 1;
            const ma = arquiva ? arquivarPelaFase(tx, c, ref, Object.assign(Object.assign(Object.assign({}, em.proc), mov), mi), novaFase) : {};
            if (arquiva)
                expedidas += 1;
            minutas.forEach((s) => tx.update(s.ref, { unidades_acesso: firestore_1.FieldValue.arrayUnion(destino.id) }));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), ma), { unidade_atual: destino.id, unidades_historico: firestore_1.FieldValue.arrayUnion(destino.id), responsavel_uid: responsavelDeVolta, recebido_em: new Date().toISOString() }), (novaFase ? Object.assign(Object.assign(Object.assign({ fase_atual: novaFase.id }, (retomada ? {} : (0, exigencias_1.camposAoEntrarNaFase)(data, novaFase.id))), ef.campos), camposDaEspera(data, faseSai, novaFase)) : {})), { orientacao: orientacao
                    ? { texto: orientacao, por: c.userName, em: new Date().toISOString(), de: (0, context_1.nomeUnidade)(c, data.unidade_atual) }
                    : firestore_1.FieldValue.delete() }));
            recebeu = { unidadeId: destino.id, proc: data };
            const depois = Object.assign(Object.assign(Object.assign({}, data), ef.campos), { unidade_atual: destino.id, responsavel_uid: 'responsavel_uid' in ef.campos ? ef.campos.responsavel_uid : responsavelDeVolta });
            if (novaFase && !retomada)
                entrou = { fase: novaFase, unidadeId: destino.id, proc: depois, remessa: true };
            if (efFase.pendencia)
                pendenciaAberta = { proc: depois, descricao: efFase.pendencia };
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
                const nome = o ? o.nome : origemAntes === null || origemAntes === void 0 ? void 0 : origemAntes.nome;
                origem = (origemAntes === null || origemAntes === void 0 ? void 0 : origemAntes.ref) ? Object.assign(Object.assign({ tipo: (o === null || o === void 0 ? void 0 : o.tipo) || origemAntes.tipo }, (nome ? { nome } : {})), { descricao: (o === null || o === void 0 ? void 0 : o.descricao) || '', ref: origemAntes.ref }) : o;
            }
            const sigilo = vem('sigilo') ? (p.sigilo === 'restrito' ? 'restrito' : 'normal') : data.sigilo;
            const partesAntes = (data.partes || []);
            let ret = { partes: partesAntes, mudou: [], retiradas: [], renomeadas: [] };
            let campos = [];
            try {
                if (vem('partes'))
                    ret = (0, camposProcesso_1.retificarPartes)(partesAntes, p.partes, form.polos, MAX_PARTES, { em: new Date().toISOString(), por: c.userName }, data.nomes_polos);
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
                    throw new https_1.HttpsError('failed-precondition', `${((_f = partesAntes[pendente.parte_idx]) === null || _f === void 0 ? void 0 : _f.nome) || 'A parte'} tem comunicação aguardando ciência. Torne sem efeito as comunicações pendentes antes de retirar a parte.`);
                const convites = db.collection(context_1.COL.convites);
                for (const i of ret.retiradas) {
                    // Quem sai perde o portal: convites revogados e contas desligadas, também dos representantes.
                    const _w = ret.partes[i], { uid: _u, convite_hash: hash } = _w, resto = __rest(_w, ["uid", "convite_hash"]);
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
            const acao = (_g = fase === null || fase === void 0 ? void 0 : fase.acoes) === null || _g === void 0 ? void 0 : _g[idx];
            if (!fase || !acao)
                throw new https_1.HttpsError('invalid-argument', 'Ação da fase inválida');
            const regra = (_h = fase.acoes_regras) === null || _h === void 0 ? void 0 : _h[idx];
            if ((regra === null || regra === void 0 ? void 0 : regra.pede) === 'orientacao')
                throw new https_1.HttpsError('failed-precondition', `"${acao}" é só orientação: não se marca.`);
            if ((regra === null || regra === void 0 ? void 0 : regra.pede) === 'comunicacao') {
                throw new https_1.HttpsError('failed-precondition', `"${acao}" se cumpre expedindo a comunicação pela própria ação, a todas as partes que ela alcança.`);
            }
            // Fase que segue sozinha: cumprida uma ação obrigatória, o servidor confere, depois deste ato, se era a última.
            tentarAuto = fase.avanco === 'auto' && p.feita !== false && (regra === null || regra === void 0 ? void 0 : regra.obrigatoria) === true && !opcoes.automatico;
            const respostas = (0, exigencias_1.respostasDaFase)(data);
            // Ação condicional: só vale com a resposta que o rito pede.
            if (p.feita !== false && !(0, exigencias_1.acaoAtiva)(fase, idx, respostas)) {
                throw new https_1.HttpsError('failed-precondition', `"${acao}" só vale quando ${textoCondicao(fase, regra.se, data.fases)}`);
            }
            // Quem pode cumprir: o rito pode reservar ao responsável designado ou a quem gere a unidade.
            if ((regra === null || regra === void 0 ? void 0 : regra.quem) && !(0, permissoesFase_1.podeQuem)(regra.quem, regra.atribuicao, atorDe(c, data))) {
                throw new https_1.HttpsError('permission-denied', regra.quem === 'responsavel'
                    ? `"${acao}" é do responsável pelo processo. Peça a atribuição ou a quem está designado.`
                    : `"${acao}" é de ${(0, permissoesFase_1.textoQuem)(regra.quem, regra.atribuicao)}.`);
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
            // Resposta registrada à mão (manifestação por outro meio): "sem manifestação" ou "parcial" só depois de
            // decorrido o prazo de quem foi comunicado. Contraditório: ninguém perde a vez antes da hora.
            if ((regra === null || regra === void 0 ? void 0 : regra.pede) === 'resposta' && dado && dado.valor !== 'Apresentada'
                && (0, comunicacaoRito_1.situacaoDaResposta)(fase, idx, data.comunicacoes, (0, secretaria_1.hojeBrasil)()).pendentes.length) {
                throw new https_1.HttpsError('failed-precondition', `Ainda corre o prazo de resposta de parte comunicada: só "Apresentada" pode ser registrada antes do fim do prazo.`);
            }
            // Dado reservado: só quem gere a unidade (e quem registra, e a administração) o vê.
            // Fica fora da descrição do movimento, que vai às listas, ao extrato e aos autos.
            const reservado = !!dado && (regra === null || regra === void 0 ? void 0 : regra.ve) === 'gestor';
            // Registro de origem restrita: as partes nunca o veem.
            const vePartes = (0, exigencias_1.partesVeem)(regra) && !(dado === null || dado === void 0 ? void 0 : dado.restrito) && !reservado;
            if (feita)
                lista.add(idx);
            else
                lista.delete(idx);
            feitas[fase.id] = [...lista].sort((a, b) => a - b);
            // Resposta de escolha guardada na rodada da fase: as ações e saídas condicionadas a leem.
            // No formulário, cada campo de escolha preenchido responde por si ('2.sistema').
            const respondeu = (0, exigencias_1.respondeNaRodada)(regra);
            const todasRespostas = Object.assign({}, (data.acoes_respostas || {}));
            if (respondeu) {
                const daFase = Object.fromEntries(Object.entries(todasRespostas[fase.id] || {}).filter(([k]) => !(0, exigencias_1.respostaDaAcao)(k, idx)));
                if (feita && dado)
                    Object.assign(daFase, (0, exigencias_1.respostasDaAcao)(regra, idx, dado.valor));
                todasRespostas[fase.id] = daFase;
            }
            const comResposta = respondeu ? { acoes_respostas: todasRespostas } : {};
            // Prazos das ações: encerra o da cumprida, reabre o da desfeita e acompanha a ação condicional que passou a valer (ou deixou).
            const pz = (0, prazosFase_1.prazosDasAcoes)(Object.assign(Object.assign(Object.assign({}, data), { acoes_feitas: feitas }), comResposta), fase, (0, secretaria_1.hojeBrasil)(), new Date().toISOString(), calendario, c.userName, () => (0, crypto_1.randomBytes)(10).toString('hex'));
            const comPrazos = pz ? Object.assign({ prazos: pz.prazos }, (0, secretaria_1.derivados)((data.pendencias || []), pz.prazos)) : {};
            const notasPrazo = (pz === null || pz === void 0 ? void 0 : pz.notas) || [];
            if (notasPrazo.length)
                expedidas += 1;
            // Audiência: designar grava a audiência no processo; desfazer a cancela (fica na lista, para a história).
            let comAudiencia = {};
            let cancelada = '';
            if ((regra === null || regra === void 0 ? void 0 : regra.pede) === 'audiencia') {
                const ad = dado && 'audiencia' in dado ? dado.audiencia : null;
                const antes = (data.audiencias || []);
                const nova = feita && ad ? Object.assign(Object.assign(Object.assign(Object.assign({ id: (0, crypto_1.randomBytes)(8).toString('hex'), fase_id: fase.id, acao_idx: idx, especie: ((_j = regra.audiencia) === null || _j === void 0 ? void 0 : _j.especie) || 'audiencia' }, (((_k = regra.audiencia) === null || _k === void 0 ? void 0 : _k.especie_nome) ? { especie_nome: regra.audiencia.especie_nome } : {})), (((_l = regra.audiencia) === null || _l === void 0 ? void 0 : _l.especie_m) ? { especie_m: true } : {})), ad), { designada_em: new Date().toISOString(), designada_por: c.userName, status: 'designada' }) : null;
                const lista = (0, audiencias_1.aplicarAudiencia)(antes, fase.id, idx, nova);
                const sai = !feita ? antes.filter((a, k) => { var _a; return a.status === 'designada' && ((_a = lista[k]) === null || _a === void 0 ? void 0 : _a.status) === 'cancelada'; })[0] : undefined;
                if (sai)
                    cancelada = ` Fica cancelada a audiência designada para ${(0, audiencias_1.textoDaAudiencia)(sai, false)}.`;
                const prox = (0, audiencias_1.audienciasFuturas)(lista, (0, secretaria_1.hojeBrasil)())[0];
                comAudiencia = { audiencias: lista, proxima_audiencia: prox ? `${prox.data}T${prox.hora}` : null };
            }
            // O rito diz onde fica: certidão nos autos (com folha), evento no extrato, só no sistema ou sem evento.
            const dest = (0, exigencias_1.destinoDaAcao)(regra);
            const comDado = (!dado ? '' : reservado ? ` ${dado.rotulo}: reservado a quem gere a unidade.` : ` ${dado.rotulo}: ${dado.valor_texto}.`) + cancelada;
            if (dest === 'consolidar') {
                // Certidão conjunta: o ato fica oculto e entra como item da certidão do grupo.
                const grupo = (0, exigencias_1.grupoDe)(fase);
                const cons = data.consolidacao;
                const pendente = (cons === null || cons === void 0 ? void 0 : cons.grupo) === grupo ? (cons.itens || []) : [];
                const k = pendente.map((i) => i.fase_id === fase.id && i.acao_idx === idx).lastIndexOf(true);
                if (!feita && k < 0) {
                    // Já saiu em certidão emitida: desfazer precisa constar dos autos.
                    const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acao_fase', `Certifico que foi desfeita a providência "${acao}", da fase ${fase.nome}.`, { fase_id: fase.id, acao_idx: idx, feita, destino: 'autos', nos_autos: true, visivel_partes: (0, exigencias_1.partesVeem)(regra) });
                    const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, data), mov), notasPrazo);
                    tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, mov), mi), { acoes_feitas: feitas }), comResposta), comPrazos));
                    return Object.assign(Object.assign({}, mov), mi);
                }
                const item = {
                    seq: 0, fase_id: fase.id, acao_idx: idx,
                    texto: (0, exigencias_1.textoDoItem)(`"${acao}", da fase ${fase.nome}.${comDado}`.replace(/\.$/, '')),
                    autor: c.userName, em: new Date().toISOString(), partes: vePartes,
                };
                const em = emitirSe(feita && antesDeJuntar(data, grupo, item), tx, c, ref, data);
                if (em.proc !== data)
                    expedidas += 1;
                const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'acao_fase', `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado} ${feita ? 'Entra na' : 'Sai da'} certidão conjunta, ainda não emitida.`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ fase_id: fase.id, acao_idx: idx, feita }, (dado ? Object.assign({ rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto }, (dado.ref ? { ref: dado.ref } : {})) : {})), (dado && (regra === null || regra === void 0 ? void 0 : regra.folha_dados) ? { folha_dados: true } : {})), { 
                    // O ato fica oculto; o dado segue a regra (as partes o veem nas informações, se ela disser).
                    destino: dest, consolidada: true }), (0, exigencias_1.marcasDoDestino)('nenhum')), { visivel_partes: vePartes }));
                const consolidacao = feita
                    ? itensDepois(em.proc, grupo, Object.assign(Object.assign({}, item), { seq: Number(mov.mov_seq) }))
                    : { grupo, itens: pendente.filter((_, j) => j !== k) };
                const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, em.proc), mov), notasPrazo);
                tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), { acoes_feitas: feitas }), comResposta), comPrazos), { consolidacao: consolidacao.itens.length ? consolidacao : firestore_1.FieldValue.delete() }), vinculoDaAcao(dado)));
                return Object.assign(Object.assign({}, mov), mi);
            }
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acao_fase', dest === 'autos'
                ? `Certifico que ${feita ? 'foi cumprida' : 'foi desfeita'} a providência "${acao}", da fase ${fase.nome}.${comDado}`
                : `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ fase_id: fase.id, acao_idx: idx, feita }, (dado ? Object.assign({ rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto }, (dado.ref ? { ref: dado.ref } : {})) : {})), (reservado ? { reservado: 'gestor', ve_unidade: String(data.unidade_atual || '') } : {})), (dado && (regra === null || regra === void 0 ? void 0 : regra.folha_dados) && !reservado ? { folha_dados: true } : {})), { destino: dest }), (dest === 'autos' ? { nos_autos: true } : {})), (dest === 'informacao' ? { fora_impressao: true } : {})), { visivel_partes: vePartes }), (dest === 'nenhum' ? (0, exigencias_1.marcasDoDestino)('nenhum') : {})));
            const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, data), mov), notasPrazo);
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, mov), mi), { acoes_feitas: feitas }), comResposta), comPrazos), comAudiencia), vinculoDaAcao(dado)));
            return Object.assign(Object.assign({}, mov), mi);
        }
        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !((unidade === null || unidade === void 0 ? void 0 : unidade.membros_uids) || []).includes(alvo)) {
                throw new https_1.HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? ((_m = (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()) === null || _m === void 0 ? void 0 : _m.user_name) || 'membro' : '';
            // A fase pode mudar a situação do registro ligado quando alguém assume (ex.: a consulta entra em elaboração).
            const faseAtual = (data.fases || []).find((f) => f.id === data.fase_atual);
            const sit = alvo ? aplicarSituacao(tx, c, registros, faseAtual, 'ao_assumir', data, { uid: String(alvo), nome: (0, normalization_1.formatPersonName)(String(nomeAlvo)) }) : { notas: [], arquivou: null };
            registroArquivado = sit.arquivou;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'atribuicao', alvo ? `Atribuído a ${nomeAlvo}.` : 'Atribuição removida.', Object.assign({ responsavel_uid: alvo }, (0, exigencias_1.marcasNaFase)(data, 'atribuicao')));
            const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, data), mov), sit.notas);
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), mi), { responsavel_uid: alvo }));
            return Object.assign(Object.assign({}, mov), mi);
        }
        if (p.action === 'avancarFase') {
            const fases = (data.fases || []);
            const alvo = p.fase_id
                ? fases.find((f) => f.id === p.fase_id)
                : (0, secretaria_1.saidasDoProcesso)(data).find((f) => !f.espera) || null;
            if (!alvo)
                throw new https_1.HttpsError('invalid-argument', 'Não há fase seguinte; escolha uma fase do rito');
            if (alvo.id === data.fase_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (data.fase_suspensa === true) {
                throw new https_1.HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            }
            // Sair do fluxo desenhado no rito é permitido, mas exige justificativa.
            const foraDoFluxo = !(0, secretaria_1.saidasDoProcesso)(data).some((f) => f.id === alvo.id);
            const faseSai = fases.find((f) => f.id === data.fase_atual);
            const retomada = ehRetomada(data, faseSai, alvo);
            exigirSaida(c, data, faseSai, alvo, foraDoFluxo || !!foraDaCondicao(data, alvo.id));
            if (foraDoFluxo && !motivo)
                throw new https_1.HttpsError('invalid-argument', `${alvo.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const contraCondicao = foraDoFluxo ? null : foraDaCondicao(data, alvo.id);
            if (contraCondicao && !motivo)
                throw new https_1.HttpsError('invalid-argument', `O rito leva a ${alvo.nome} quando ${contraCondicao}. Informe o motivo para seguir por ela.`);
            const de = ((_o = fases.find((f) => f.id === data.fase_atual)) === null || _o === void 0 ? void 0 : _o.nome) || data.fase_atual;
            // Ir para a espera não conclui a fase: o que falta nela fica para a volta, sem dispensa.
            const dispensadas = alvo.espera ? [] : dispensarExigencias(c, data, motivo, formAtual);
            // A fase pode designar o responsável entre os lotados na unidade que tem o processo.
            const designacao = retomada ? null : await designadoPelaFase(c, alvo, c.unidades.find((u) => u.id === data.unidade_atual));
            const destinoMov = dispensadas.length ? 'autos' : (0, exigencias_1.destinoDoMovimento)(fases, data.fase_atual, alvo.id);
            // Certidão conjunta: sair do grupo emite a pendente; mudar dentro dele pode virar item dela
            // (nunca com dispensa, que vai aos autos, nem quando as duas fases pedem "sem evento").
            // Motivo longo não se resume numa certidão conjunta: a mudança tem termo próprio.
            const grupo = (0, exigencias_1.grupoDe)(alvo);
            const descricao = `Fase alterada de ${de} para ${alvo.nome}${marcaEspera(retomada, alvo)}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${textoDispensa(dispensadas)}${motivo ? ` ${motivo}` : ''}${textoAuto}`;
            // A fase de destino pode arquivar ao entrar: a certidão pendente sai antes e a mudança tem termo próprio.
            const arquiva = ((_p = alvo.ao_entrar) === null || _p === void 0 ? void 0 : _p.arquivar) === true;
            const junta = !arquiva && !dispensadas.length && destinoMov !== 'nenhum' && descricao.length <= exigencias_1.MAX_ITEM_CERTIDAO && (0, exigencias_1.mudancaNaCertidao)(fases, data.fase_atual, alvo.id);
            const item = { seq: 0, fase_id: data.fase_atual, texto: descricao.replace(/\.$/, ''), autor: c.userName, em: new Date().toISOString(), partes: destinoMov === 'autos' };
            const em = emitirSe(arquiva || (0, exigencias_1.deveEmitir)(fases, data.consolidacao, data.fase_atual, alvo.id) || (junta && antesDeJuntar(data, grupo, item)), tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            // Retomada: quem respondia pelo processo continua, mesmo que a fase tire ou designe o responsável ao entrar.
            const efFase = efeitosDaMudanca(data, String(data.fase_atual), alvo, calendario, c.userName, { retomada, designacao });
            const sit = aplicarSituacao(tx, c, registros, alvo, ((retomada && data.responsavel_uid) || (designacao === null || designacao === void 0 ? void 0 : designacao.uid)) && ((_q = alvo.situacao_registro) === null || _q === void 0 ? void 0 : _q.ao_assumir) ? 'ao_assumir' : 'ao_entrar', data, (designacao === null || designacao === void 0 ? void 0 : designacao.uid) ? { uid: designacao.uid, nome: designacao.nome || '' } : undefined);
            registroArquivado = sit.arquivou;
            const ef = Object.assign(Object.assign({}, efFase), { interno: [...efFase.interno, ...sit.notas] });
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'fase', `${descricao}${junta ? ' Entra na certidão conjunta.' : ''}${ef.texto}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ de: data.fase_atual, para: alvo.id }, (opcoes.automatico ? { automatico: true } : {})), (retomada ? { retomada: true } : {})), (foraDoFluxo ? { fora_do_fluxo: true } : {})), (contraCondicao ? { fora_da_condicao: true } : {})), (dispensadas.length ? { dispensadas } : {})), (junta ? Object.assign({ consolidada: true }, (0, exigencias_1.marcasDoDestino)('nenhum')) : (0, exigencias_1.marcasDoDestino)(destinoMov))));
            const consolidacao = junta
                ? { consolidacao: itensDepois(em.proc, grupo, Object.assign(Object.assign({}, item), { seq: Number(mov.mov_seq) })) }
                : {};
            const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign(Object.assign({}, em.proc), mov), consolidacao), ef.interno);
            if (ef.interno.length)
                expedidas += 1;
            const ma = arquiva ? arquivarPelaFase(tx, c, ref, Object.assign(Object.assign(Object.assign({}, em.proc), mov), mi), alvo) : {};
            if (arquiva)
                expedidas += 1;
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, em.mov), mov), mi), ma), consolidacao), { fase_atual: alvo.id }), (retomada ? {} : (0, exigencias_1.camposAoEntrarNaFase)(data, alvo.id))), ef.campos), camposDaEspera(data, faseSai, alvo)));
            const depois = Object.assign(Object.assign({}, data), ef.campos);
            if (!retomada)
                entrou = { fase: alvo, unidadeId: String(data.unidade_atual), proc: depois, remessa: false };
            if (efFase.pendencia)
                pendenciaAberta = { proc: depois, descricao: efFase.pendencia };
            return Object.assign(Object.assign(Object.assign({}, mov), mi), ma);
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
            const lista = (_s = p.comunicacao) === null || _s === void 0 ? void 0 : _s.partes_idx;
            const saida = { internos: 0, cumpridas: false };
            const r = await (0, comunicacoes_1.expedir)(tx, c, ref, data, p.comunicacao, cfgCom, saida);
            expedidas = (Array.isArray(lista) ? new Set(lista).size || 1 : 1) + saida.internos;
            // Comunicação que cumpre ação do rito numa fase que segue sozinha: confere, depois, se era o que faltava.
            const faseCom = (data.fases || []).find((f) => f.id === data.fase_atual);
            tentarAuto = saida.cumpridas && (faseCom === null || faseCom === void 0 ? void 0 : faseCom.avanco) === 'auto' && !opcoes.automatico;
            return r;
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
            // O rito pode reservar a mudança de situação, na fase, a quem gere a unidade ou à administração.
            const faseSit = faseDoProcesso(data);
            const reservaSit = (_v = faseSit === null || faseSit === void 0 ? void 0 : faseSit.permissoes) === null || _v === void 0 ? void 0 : _v.situacao;
            if (reservaSit && !(0, permissoesFase_1.podeReserva)(reservaSit, atorDe(c, data))) {
                throw new https_1.HttpsError('permission-denied', `Pelo rito, na fase ${faseSit.nome} só ${(0, permissoesFase_1.textoReserva)(reservaSit)} arquiva, sobresta ou reativa o processo.`);
            }
            if (!motivo)
                throw new https_1.HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            // Arquivar com documento exigido em aberto: o motivo vale como dispensa, e fica dito.
            const dispensadas = status === 'arquivado' ? exigenciasAbertas(data, formAtual).map((e) => e.descricao) : [];
            exigirDispensa(c, data, dispensadas);
            // Arquivar encerra a certidão conjunta pendente (sobrestar, não: o processo volta à mesma fase).
            const em = emitirSe(status === 'arquivado', tx, c, ref, data);
            if (em.proc !== data)
                expedidas = 2;
            const ef = status === 'arquivado' ? efeitosDaMudanca(data, String(data.fase_atual), null, undefined, c.userName) : SEM_EFEITOS;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, em.proc, 'situacao', `${rotulo}. Motivo: ${motivo}${dispensadas.length ? ` Exigências do rito não cumpridas: ${dispensadas.join('; ')}.` : ''}${ef.texto}`, Object.assign({ de: data.status, para: status }, (dispensadas.length ? { dispensadas } : {})));
            const mi = (0, context_1.registrarInternos)(tx, c, ref, Object.assign(Object.assign({}, em.proc), mov), ef.interno);
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
            // Apreciar é ato de decisão: só a unidade que decide (o gabinete, por padrão) e tem o processo.
            if (!(0, secretaria_1.unidadeDecide)(c.unidades.find((u) => u.id === data.unidade_atual))) {
                throw new https_1.HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete ou por outra unidade que decida. Faça a conclusão do processo antes.');
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
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'pendencia_resolvida', `Pendência apreciada${alvo.tipo === 'manual' ? '' : ` (${alvo.descricao})`}: ${resolucao}${alvo.interrompe && !der.fase_suspensa ? ' Fase retomada.' : ''}`, Object.assign({ pendencia_id: alvo.id }, (0, exigencias_1.marcasNaFase)(data, 'pendencia')));
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
        // Prorrogar (o prazo corre) ou devolver (já venceu): certidão nos autos e, se é
        // o prazo de resposta de uma comunicação, ela acompanha; a devolução reabre a espera.
        if (p.action === 'prorrogarPrazo' || p.action === 'devolverPrazo') {
            const tipo = p.action === 'prorrogarPrazo' ? 'prorrogacao' : 'devolucao';
            const alvo = prazos.find((x) => x.id === p.prazo_id);
            if (!alvo)
                throw new https_1.HttpsError('not-found', 'Prazo não encontrado');
            let aj;
            try {
                aj = (0, ajustePrazo_1.ajustarPrazo)(alvo, tipo, p.dias, motivo, (0, secretaria_1.hojeBrasil)(), calendario, { em: agora, por: c.userName });
            }
            catch (e) {
                throw new https_1.HttpsError('invalid-argument', e.message);
            }
            const lista = prazos.map((x) => (x.id === alvo.id ? aj.prazo : x));
            const com = (0, ajustePrazo_1.ajustarComunicacao)(data, alvo.id, aj.prazo.vence_em, tipo, (0, comunicacaoRito_1.faseQueEspera)(data));
            // Prazo da parte (de comunicação) é ato público; o interno da fase fica nas informações.
            const marcas = com ? {} : alvo.automatico === true ? (0, exigencias_1.marcasDoDestino)('informacao') : (0, exigencias_1.marcasNaFase)(data, 'prazo');
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, tipo === 'prorrogacao' ? 'prazo_prorrogado' : 'prazo_devolvido', aj.texto, Object.assign({ prazo_id: alvo.id, vence_em: aj.prazo.vence_em }, marcas));
            const comCampos = com ? Object.assign({ comunicacoes: com.comunicacoes }, (com.acoes_feitas ? { acoes_feitas: com.acoes_feitas, acoes_respostas: com.acoes_respostas } : {})) : {};
            const notas = (com === null || com === void 0 ? void 0 : com.reabertas.length) ? [`Com a devolução do prazo, a espera da resposta volta a correr (${com.reabertas.length === 1 ? 'uma ação' : `${com.reabertas.length} ações`} do rito).`] : [];
            const ac = com ? (0, comunicacoes_1.acertarAcoesDoRito)(tx, c, ref, Object.assign(Object.assign(Object.assign({}, data), mov), comCampos), notas) : { campos: {} };
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { prazos: lista }), (0, secretaria_1.derivados)(pendencias, lista)), comCampos), ac.campos));
            return Object.assign(Object.assign({}, mov), ac.campos);
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
            const np = (0, camposProcesso_1.nomeDoPolo)(data.nomes_polos, parte.polo);
            const rotulo = ridx >= 0 ? `${alvo.nome}, representante de ${parte.nome} (${np})` : `${parte.nome} (${np})`;
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
    // Registro ligado arquivado pela regra da fase: mesmo webhook de quando se arquiva no quadro.
    const ra = registroArquivado;
    if (ra) {
        void (0, webhooks_1.fireOrgWebhook)(orgId, 'archived', ra.modulo === 'consultas'
            ? { entity_type: 'process', entity_id: ra.id, process_number: ra.numero }
            : { entity_type: 'expediente', entity_id: ra.id, expediente_number: ra.numero }).catch(() => undefined);
    }
    const r = recebeu;
    const en = entrou;
    const recado = motivo || (0, secretaria_1.texto)(p.orientacao, secretaria_1.MAX_TEXTO_LONGO);
    // A fase que diz quem avisar decide o aviso da entrada (inclusive nenhum); sem isso, vale o de sempre: a unidade que recebe a remessa.
    if ((_b = en === null || en === void 0 ? void 0 : en.fase.aviso) === null || _b === void 0 ? void 0 : _b.para)
        void (0, avisosEquipe_1.avisarEntradaNaFase)(c, en.fase, en.unidadeId, en.proc, String(p.id), en.remessa, recado);
    else if (r)
        void (0, avisosEquipe_1.avisarUnidadeRecebeu)(c, r.unidadeId, r.proc, String(p.id), recado, (_d = en === null || en === void 0 ? void 0 : en.fase.aviso) === null || _d === void 0 ? void 0 : _d.mensagem);
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
    if (tentarAuto) {
        const auto = await avancarSozinho(c, String(p.id));
        if (auto)
            return auto;
    }
    return { success: true, version: resultado.version };
}
//# sourceMappingURL=processos.js.map