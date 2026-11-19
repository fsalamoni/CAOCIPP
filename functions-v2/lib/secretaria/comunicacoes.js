"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configComunicacoes = configComunicacoes;
exports.acertarAcoesDoRito = acertarAcoesDoRito;
exports.expedir = expedir;
exports.registrarCiencia = registrarCiencia;
exports.tornarSemEfeito = tornarSemEfeito;
exports.certificarDecursos = certificarDecursos;
exports.cienciaPorDecurso = cienciaPorDecurso;
const camposProcesso_1 = require("../shared/camposProcesso");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const comunicacoes_1 = require("../shared/comunicacoes");
const context_1 = require("./context");
const comunicacaoRito_1 = require("../shared/comunicacaoRito");
/**
 * Comunicações processuais no Firestore: ficam em `processo.comunicacoes[]`,
 * cada ato vira um evento dos autos e o prazo de resposta só abre na ciência.
 */
// Data no fuso do Brasil (um instante ISO à noite cairia no dia seguinte em UTC).
const br = (iso) => (iso.length > 10 ? (0, secretaria_1.hojeBrasil)(new Date(iso)) : iso).split('-').reverse().join('/');
/** O texto entra no meio da certidão: sem o ponto final dele, para não dobrar. */
const semPonto = (s) => s.replace(/[.\s]+$/, '');
/** Calendário do órgão (para o prazo) e dias até a ciência por decurso. */
async function configComunicacoes(db, orgId) {
    const d = (await db.collection(context_1.COL.config).doc(orgId).get()).data() || {};
    return { calendario: (0, secretaria_1.sanitizeCalendario)(d.calendario), dias: (0, comunicacoes_1.cienciaDias)(d.ciencia_dias) };
}
/**
 * Depois de mexer nas comunicações: acerta as ações de comunicação e de
 * resposta da fase que espera (ver shared/comunicacaoRito.ts) e registra, em
 * movimento interno, o que a regra fez. `proc`: o processo como vai ficar.
 * Devolve os campos a gravar, quantos movimentos internos entraram e as
 * ações que o rito deu por cumpridas.
 */
function acertarAcoesDoRito(tx, c, ref, proc, extra = []) {
    const fase = (0, comunicacaoRito_1.faseQueEspera)(proc);
    const s = (0, comunicacaoRito_1.sincronizarComunicacoes)(proc, fase, (0, secretaria_1.hojeBrasil)());
    const depois = s ? Object.assign(Object.assign({}, proc), { acoes_feitas: s.acoes_feitas, acoes_respostas: s.acoes_respostas }) : proc;
    const espera = (0, comunicacaoRito_1.aguardaResposta)(depois, fase);
    const notas = [...extra, ...((s === null || s === void 0 ? void 0 : s.notas) || [])];
    const mi = (0, context_1.registrarInternos)(tx, c, ref, proc, notas);
    const campos = Object.assign(Object.assign(Object.assign({}, mi), (s ? { acoes_feitas: s.acoes_feitas, acoes_respostas: s.acoes_respostas } : {})), ((proc.aguarda_resposta === true) !== espera ? { aguarda_resposta: espera } : {}));
    return { campos, internos: notas.length ? 1 : 0, cumpridas: !!(s === null || s === void 0 ? void 0 : s.novas.length) };
}
/** Campos do processo depois de mexer em comunicações e prazos. */
function gravar(lista, prazos, proc) {
    return Object.assign(Object.assign(Object.assign({ comunicacoes: lista }, (0, comunicacoes_1.derivadosComunicacoes)(lista)), { prazos }), (0, secretaria_1.derivados)((proc.pendencias || []), prazos));
}
/**
 * A secretaria expede uma comunicação a uma ou mais partes. Pela plataforma,
 * fica aguardando a ciência; por outro meio, a ciência já é registrada com a
 * data informada e o prazo abre na hora. Roda dentro da transação.
 */
async function expedir(tx, c, ref, data, raw, cfg, saida = { internos: 0, cumpridas: false }) {
    var _a, _b;
    if (!(0, secretaria_1.unidadeExpede)(c.unidades.find((u) => u.id === data.unidade_atual))) {
        throw new https_1.HttpsError('permission-denied', 'Esta unidade não expede comunicações às partes. Remeta o processo à secretaria (ou a outra unidade que expeça) para cumprir.');
    }
    const hoje = (0, secretaria_1.hojeBrasil)();
    let ped;
    try {
        ped = (0, comunicacoes_1.sanitizePedido)(raw, hoje);
    }
    catch (e) {
        (0, context_1.erroUsuario)(e);
    }
    const partes = (data.partes || []);
    let lista = [...(data.comunicacoes || [])];
    let prazos = [...(data.prazos || [])];
    if (lista.length + ped.partes_idx.length > comunicacoes_1.MAX_COMUNICACOES)
        throw new https_1.HttpsError('resource-exhausted', 'Limite de comunicações do processo');
    // Expedida pela ação do rito: só às partes que ela alcança, e fica ligada à ação (na rodada da fase).
    const bruto = (raw && typeof raw === 'object' ? raw : {});
    let ligacao = null;
    if (bruto.acao_idx !== undefined && bruto.acao_idx !== null) {
        const fase = (data.fases || []).find((f) => f.id === data.fase_atual);
        const i = Number(bruto.acao_idx);
        const regra = (_a = fase === null || fase === void 0 ? void 0 : fase.acoes_regras) === null || _a === void 0 ? void 0 : _a[i];
        if (!fase || (regra === null || regra === void 0 ? void 0 : regra.pede) !== 'comunicacao')
            throw new https_1.HttpsError('invalid-argument', 'Esta ação da fase não comunica as partes');
        const alvos = (0, comunicacaoRito_1.alvosDaComunicacao)(regra.comunicacao, partes);
        const fora = ped.partes_idx.filter((x) => !alvos.includes(x));
        if (fora.length)
            throw new https_1.HttpsError('invalid-argument', `"${(_b = fase.acoes) === null || _b === void 0 ? void 0 : _b[i]}" comunica só ${alvos.map((x) => { var _a; return (_a = partes[x]) === null || _a === void 0 ? void 0 : _a.nome; }).join(', ') || 'partes de outro polo'}`);
        ligacao = { fase_id: fase.id, acao_idx: i };
    }
    let docTitulo = '';
    if (ped.documento_id) {
        const d = (await tx.get(ref.collection('documentos').doc(ped.documento_id))).data();
        if (!d || d.status !== 'juntado' || d.visivel_partes === false)
            throw new https_1.HttpsError('invalid-argument', 'Escolha um documento juntado e visível às partes');
        // Documento restrito a alguns polos só acompanha comunicação a partes desses polos.
        const so = Array.isArray(d.visivel_polos) && d.visivel_polos.length ? d.visivel_polos : null;
        if (so && ped.partes_idx.some((x) => { var _a; return !so.includes(String((_a = partes[x]) === null || _a === void 0 ? void 0 : _a.polo)); }))
            throw new https_1.HttpsError('invalid-argument', 'O documento escolhido é restrito a outro polo: os destinatários não podem vê-lo');
        docTitulo = `Doc. nº ${d.ordem}: ${d.titulo}`;
    }
    const agora = new Date().toISOString();
    const nomeEspecie = (0, comunicacoes_1.nomeDaEspecie)(ped);
    // Espécie do órgão de nome masculino ("Edital"): "expedido", "realizado".
    const fim = ped.especie_m ? 'o' : 'a';
    let atual = data;
    let campos = {};
    for (const idx of ped.partes_idx) {
        const parte = partes[idx];
        if (!parte)
            throw new https_1.HttpsError('invalid-argument', 'Destinatário inválido');
        if (parte.retirada)
            throw new https_1.HttpsError('failed-precondition', `${parte.nome} foi retirada do processo`);
        const temConta = !!parte.uid || (parte.representantes || []).some((r) => r.uid);
        if (!ped.outro_meio && !temConta) {
            throw new https_1.HttpsError('failed-precondition', `${parte.nome} ainda não tem conta habilitada no portal. Convide a parte (ou um representante) ou registre a comunicação feita por outro meio.`);
        }
        let com = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id: ref.collection('_').doc().id, especie: ped.especie }, (ped.especie_nome ? { especie_nome: ped.especie_nome } : {})), (ped.especie_m ? { especie_m: true } : {})), { texto: ped.texto, parte_idx: idx, parte_nome: parte.nome }), (ped.documento_id ? { documento_id: ped.documento_id, documento_titulo: docTitulo } : {})), { dias: ped.dias, contagem: ped.contagem, expedida_em: agora, expedida_por: c.userName, unidade_id: String(data.unidade_atual), limite_ciencia: ped.outro_meio ? null : (0, comunicacoes_1.limiteCiencia)(hoje, cfg.dias), status: 'aguardando' }), (ligacao || {}));
        const prazoTxt = com.dias ? `Prazo de ${(0, comunicacoes_1.textoPrazo)(com)}` : 'Sem prazo de resposta';
        let descricao;
        if (ped.outro_meio) {
            const r = (0, comunicacoes_1.aplicarCiencia)(com, ped.ciencia_data, agora, c.userName, ped.outro_meio, ref.collection('_').doc().id, cfg.calendario);
            com = r.comunicacao;
            if (r.prazo)
                prazos = [...prazos, r.prazo];
            descricao = `${nomeEspecie} de ${parte.nome} (${(0, camposProcesso_1.nomeDoPolo)(data.nomes_polos, parte.polo)}) realizad${fim} por ${ped.outro_meio}, com ciência em ${br(ped.ciencia_data)}: ${semPonto(ped.texto)}${docTitulo ? ` (${docTitulo})` : ''}. ${r.prazo ? `${prazoTxt}, vence em ${br(r.prazo.vence_em)}.` : `${prazoTxt}.`}`;
        }
        else {
            descricao = `${nomeEspecie} expedid${fim} a ${parte.nome} (${(0, camposProcesso_1.nomeDoPolo)(data.nomes_polos, parte.polo)}) pela plataforma: ${semPonto(ped.texto)}${docTitulo ? ` (${docTitulo})` : ''}. ${com.dias ? `${prazoTxt}, a contar da ciência` : prazoTxt}.${com.limite_ciencia ? ` Sem ciência até ${br(com.limite_ciencia)}, ela se dá por decurso.` : ''}`;
        }
        lista = [...lista, com];
        const mov = (0, context_1.registrarMovimento)(tx, c, ref, atual, 'comunicacao', descricao.slice(0, secretaria_1.MAX_TEXTO_LONGO), { comunicacao_id: com.id, especie: com.especie, parte_idx: idx });
        campos = Object.assign(Object.assign({}, campos), mov);
        atual = Object.assign(Object.assign({}, atual), mov);
    }
    const gravado = gravar(lista, prazos, data);
    const ac = acertarAcoesDoRito(tx, c, ref, Object.assign(Object.assign({}, atual), gravado));
    saida.internos = ac.internos;
    saida.cumpridas = ac.cumpridas;
    tx.update(ref, Object.assign(Object.assign(Object.assign({}, campos), gravado), ac.campos));
    return Object.assign(Object.assign({}, campos), ac.campos);
}
/**
 * Ciência de uma comunicação: pela parte (`meio` "plataforma") ou por decurso.
 * Grava a certidão como evento e abre o prazo. Roda dentro da transação.
 */
function registrarCiencia(tx, c, ref, proc, comId, meio, cfg, rotulo) {
    const lista = (proc.comunicacoes || []);
    const alvo = lista.find((x) => x.id === comId);
    if (!alvo)
        throw new https_1.HttpsError('not-found', 'Comunicação não encontrada');
    if (alvo.status !== 'aguardando')
        throw new https_1.HttpsError('failed-precondition', 'A ciência desta comunicação já foi registrada');
    const agora = new Date().toISOString();
    const r = (0, comunicacoes_1.aplicarCiencia)(alvo, (0, secretaria_1.hojeBrasil)(), agora, c.userName, meio, ref.collection('_').doc().id, cfg.calendario);
    const nova = lista.map((x) => (x.id === comId ? r.comunicacao : x));
    const prazos = r.prazo ? [...(proc.prazos || []), r.prazo] : (proc.prazos || []);
    const esp = (0, comunicacoes_1.nomeDaEspecie)(alvo).toLowerCase();
    const art = (0, comunicacoes_1.artigosDaEspecie)(alvo);
    const fim = alvo.especie_m ? 'o' : 'a';
    const cabeca = meio === 'decurso'
        ? `Ciência por decurso: ${alvo.parte_nome} não acessou ${art.o} ${esp} expedid${fim} em ${br(alvo.expedida_em)} até ${br(String(alvo.limite_ciencia))}.`
        : `${rotulo} deu ciência ${art.de} ${esp} expedid${fim} em ${br(alvo.expedida_em)}.`;
    const mov = (0, context_1.registrarMovimento)(tx, c, ref, proc, meio === 'decurso' ? 'ciencia_decurso' : 'ciencia', `${cabeca}${r.prazo ? ` Prazo de ${(0, comunicacoes_1.textoPrazo)(alvo)} aberto, vence em ${br(r.prazo.vence_em)}.` : ''}`, Object.assign({ comunicacao_id: comId }, (r.prazo ? { prazo_id: r.prazo.id, vence_em: r.prazo.vence_em } : {})));
    const campos = Object.assign(Object.assign({}, mov), gravar(nova, prazos, proc));
    tx.update(ref, campos);
    return { proc: Object.assign(Object.assign({}, proc), campos), comunicacao: r.comunicacao };
}
/** Antes da ciência, a secretaria pode tornar a comunicação sem efeito. */
function tornarSemEfeito(tx, c, ref, data, comId, motivo) {
    const lista = (data.comunicacoes || []);
    const alvo = lista.find((x) => x.id === comId);
    if (!alvo)
        throw new https_1.HttpsError('not-found', 'Comunicação não encontrada');
    if (alvo.status !== 'aguardando')
        throw new https_1.HttpsError('failed-precondition', 'Só se torna sem efeito a comunicação que ainda aguarda ciência');
    if (!motivo)
        throw new https_1.HttpsError('invalid-argument', 'Informe o motivo');
    const nova = lista.map((x) => (x.id === alvo.id ? Object.assign(Object.assign({}, x), { status: 'sem_efeito', sem_efeito_motivo: (0, secretaria_1.texto)(motivo, 500), limite_ciencia: null }) : x));
    const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'comunicacao_sem_efeito', `${(0, comunicacoes_1.nomeDaEspecie)(alvo)} a ${alvo.parte_nome}, expedid${alvo.especie_m ? 'o' : 'a'} em ${br(alvo.expedida_em)}, tornad${alvo.especie_m ? 'o' : 'a'} sem efeito. Motivo: ${motivo}`, { comunicacao_id: alvo.id });
    const ac = acertarAcoesDoRito(tx, c, ref, Object.assign(Object.assign(Object.assign({}, data), mov), { comunicacoes: nova }));
    tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { comunicacoes: nova }), (0, comunicacoes_1.derivadosComunicacoes)(nova)), ac.campos));
    return Object.assign(Object.assign({}, mov), ac.campos);
}
/**
 * Rotina diária, processo a processo: o prazo de resposta que o rito espera
 * decorreu sem manifestação. Certifica o decurso nos autos (ato público, a
 * parte é avisada) e acerta as ações do rito. Devolve se a fase, que segue
 * sozinha, pode ter ficado pronta para seguir.
 */
async function certificarDecursos(db, ref, hoje) {
    return db.runTransaction(async (tx) => {
        const proc = (await tx.get(ref)).data();
        if (!proc || proc.status !== 'em_tramitacao')
            return null;
        const fase = (0, comunicacaoRito_1.faseQueEspera)(proc);
        const vencidas = (0, comunicacaoRito_1.decursosACertificar)(fase, proc.comunicacoes, hoje);
        const c = { db, orgId: String(proc.organization_id), org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        let atual = proc;
        let campos = {};
        for (const x of vencidas) {
            const esp = (0, comunicacoes_1.nomeDaEspecie)(x).toLowerCase();
            const art = (0, comunicacoes_1.artigosDaEspecie)(x);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, atual, 'decurso_prazo', `Certifico que o prazo de ${(0, comunicacoes_1.textoPrazo)(x)} de ${x.parte_nome} para responder ${art.a} ${esp} expedid${x.especie_m ? 'o' : 'a'} em ${br(x.expedida_em)}, encerrado em ${br(String(x.vence_em))}, decorreu sem manifestação.`, { comunicacao_id: x.id, parte_idx: x.parte_idx });
            campos = Object.assign(Object.assign({}, campos), mov);
            atual = Object.assign(Object.assign({}, atual), mov);
        }
        const ids = new Set(vencidas.map((x) => x.id));
        const nova = (proc.comunicacoes || []).map((x) => (ids.has(x.id) ? Object.assign(Object.assign({}, x), { decurso_certificado: hoje }) : x));
        const ac = acertarAcoesDoRito(tx, c, ref, Object.assign(Object.assign({}, atual), { comunicacoes: nova }));
        if (!vencidas.length && !Object.keys(ac.campos).length)
            return null;
        tx.update(ref, Object.assign(Object.assign(Object.assign({}, campos), (vencidas.length ? { comunicacoes: nova } : {})), ac.campos));
        return { orgId: c.orgId, avancar: ac.cumpridas && (fase === null || fase === void 0 ? void 0 : fase.avanco) === 'auto' && fase.id === proc.fase_atual, movimentos: vencidas.length + ac.internos };
    });
}
/** Rotina diária: comunicações sem ciência além do limite têm a ciência registrada por decurso. */
async function cienciaPorDecurso(db) {
    const hoje = (0, secretaria_1.hojeBrasil)();
    const snap = await db.collection(context_1.COL.processos).where('ciencia_limite', '<', hoje).limit(500).get();
    const cfgs = new Map();
    let feitas = 0;
    for (const d of snap.docs) {
        const orgId = String(d.data().organization_id);
        if (!cfgs.has(orgId))
            cfgs.set(orgId, configComunicacoes(db, orgId));
        const cfg = await cfgs.get(orgId);
        const c = { db, orgId, org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        feitas += await db.runTransaction(async (tx) => {
            let proc = (await tx.get(d.ref)).data();
            if (!proc)
                return 0;
            const vencidas = (proc.comunicacoes || []).filter((x) => x.status === 'aguardando' && x.limite_ciencia && x.limite_ciencia < hoje);
            for (const x of vencidas)
                proc = registrarCiencia(tx, c, d.ref, proc, x.id, 'decurso', cfg, '').proc;
            return vencidas.length;
        }).catch(() => 0);
    }
    return feitas;
}
//# sourceMappingURL=comunicacoes.js.map