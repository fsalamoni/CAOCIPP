"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATOS_QUE_MUDAM = exports.COL = exports.REGION = void 0;
exports.sinalizarMudanca = sinalizarMudanca;
exports.comSinal = comSinal;
exports.exigirAuth = exigirAuth;
exports.carregarContexto = carregarContexto;
exports.contextoDoSistema = contextoDoSistema;
exports.administraOrgao = administraOrgao;
exports.exigirAdminDoOrgao = exigirAdminDoOrgao;
exports.exigirAdmin = exigirAdmin;
exports.exigirGestor = exigirGestor;
exports.julgadorLe = julgadorLe;
exports.lerProcesso = lerProcesso;
exports.equipeLe = equipeLe;
exports.exigirPosse = exigirPosse;
exports.exigirAprovar = exigirAprovar;
exports.atorDe = atorDe;
exports.conferirVersao = conferirVersao;
exports.registrarMovimento = registrarMovimento;
exports.registrarInternos = registrarInternos;
exports.calendarioDasAcoes = calendarioDasAcoes;
exports.nomeUnidade = nomeUnidade;
exports.erroUsuario = erroUsuario;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const autos_1 = require("../shared/autos");
const orgaos_1 = require("../shared/orgaos");
const secretaria_2 = require("../shared/secretaria");
const sessoes_1 = require("../shared/sessoes");
const exigencias_1 = require("../shared/exigencias");
const prazosFase_1 = require("../shared/prazosFase");
const permissoesFase_1 = require("../shared/permissoesFase");
const vinculo_1 = require("../shared/vinculo");
exports.REGION = 'southamerica-east1';
exports.COL = {
    processos: 'secProcessos',
    unidades: 'secUnidades',
    ritos: 'secRitos',
    contadores: 'secContadores',
    convites: 'secConvites',
    tipos: 'secTipos',
    config: 'secConfig',
    verificacao: 'secVerificacao',
    modelos: 'secModelos',
    unidadeConfig: 'secUnidadeConfig',
    convitesEquipe: 'secConvitesEquipe',
    /** Contadores de uso das chamadas públicas, por hora (apagáveis por TTL em `expira_em`). */
    limites: 'secLimites',
    /** Um documento por órgão com a hora da última mudança: as telas abertas o escutam em tempo real. */
    sinais: 'secSinais',
};
/**
 * Atos que mudam processos. Depois de cada um, o sinal do órgão avisa as telas
 * abertas (listas e o processo aberto) para se atualizarem sozinhas. Leituras
 * nunca sinalizam: a atualização que o sinal provoca é uma leitura, e assim
 * não há laço entre telas.
 */
exports.ATOS_QUE_MUDAM = new Set([
    // secretariaProcesso
    'autuar', 'tramitar', 'atribuir', 'avancarFase', 'alterarStatus', 'abrirPendencia', 'resolverPendencia', 'abrirPrazo', 'abrirCronograma', 'encerrarPrazo',
    'prorrogarPrazo', 'devolverPrazo', 'convidarParte', 'revogarParte', 'marcarAcao', 'concluirOrientacao', 'alterarDados', 'urgencia',
    'expedirComunicacao', 'tornarSemEfeito', 'excluir', 'restaurar', 'emitirCertidao',
    // secretariaDocumento
    'criarMinuta', 'upload', 'editarMinuta', 'excluirMinuta', 'assinar', 'pedirAssinatura', 'juntar', 'guardar',
    // secretariaPortal (o órgão vem do processo)
    'peticionar', 'darCiencia', 'pedidoSessao',
]);
/**
 * Grava o sinal do órgão (sem dado do processo além do id, que só abre algo
 * para quem já pode ver). Falha aqui nunca desfaz o ato: as telas se
 * atualizam na próxima ação de quem as usa, como antes.
 */
async function sinalizarMudanca(db, orgId, processoId) {
    if (typeof orgId !== 'string' || !orgId)
        return;
    try {
        await db.collection(exports.COL.sinais).doc(orgId).set({
            organization_id: orgId,
            em: firestore_1.FieldValue.serverTimestamp(),
            processo_id: typeof processoId === 'string' ? processoId : null,
        });
    }
    catch ( /* sinal é conveniência */_a) { /* sinal é conveniência */ }
}
/** Envolve o handler de uma callable: depois de um ato que muda processo, grava o sinal do órgão. */
function comSinal(fn) {
    return async (request) => {
        var _a, _b;
        const r = await fn(request);
        const p = (request.data || {});
        if (!exports.ATOS_QUE_MUDAM.has(String(p.action)))
            return r;
        const db = admin.firestore();
        const procId = (_b = (_a = p.processoId) !== null && _a !== void 0 ? _a : p.id) !== null && _b !== void 0 ? _b : r === null || r === void 0 ? void 0 : r.id;
        let orgId = p.organizationId;
        // Portal das partes não manda o órgão: vem do processo.
        if (!orgId && typeof procId === 'string' && procId) {
            orgId = await db.collection(exports.COL.processos).doc(procId).get().then((s) => s.get('organization_id')).catch(() => null);
        }
        await sinalizarMudanca(db, orgId, procId);
        return r;
    };
}
function exigirAuth(request) {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'É preciso estar autenticado');
    return request.auth;
}
/**
 * Carrega quem é o usuário dentro da Secretaria do órgão. Exige vínculo com o
 * órgão e, salvo `permitirInativa`, a Secretaria ligada pelo admin do órgão.
 */
async function carregarContexto(auth, orgId, opts = {}) {
    var _a, _b, _c;
    if (typeof orgId !== 'string' || !orgId) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    }
    const db = admin.firestore();
    const [memSnap, orgSnap, unSnap, cfgSnap] = await Promise.all([
        db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`).get(),
        db.collection('organizations').doc(orgId).get(),
        // ponytail: lê todas as unidades do órgão e filtra em memória (dezenas,
        // não milhares); trocar por um índice de lotação se passar de centenas.
        db.collection(exports.COL.unidades).where('organization_id', '==', orgId).get(),
        db.collection(exports.COL.config).doc(orgId).get(),
    ]);
    if (!memSnap.exists || !orgSnap.exists || (0, vinculo_1.vinculoBloqueado)(memSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const mem = memSnap.data() || {};
    const org = orgSnap.data() || {};
    const isAdmin = mem.role === 'creator' || ((_a = mem.permissions) === null || _a === void 0 ? void 0 : _a.configure_secretaria) === true;
    if (!opts.permitirInativa && ((_b = org.secretariaConfig) === null || _b === void 0 ? void 0 : _b.enabled) !== true) {
        throw new https_1.HttpsError('failed-precondition', 'O Processo Eletrônico não está ativo neste órgão');
    }
    if (!opts.permitirInativa && (0, vinculo_1.peSuspensoPlataforma)(org)) {
        throw new https_1.HttpsError('failed-precondition', 'O Processo Eletrônico deste órgão está suspenso pela administração da plataforma');
    }
    const unidades = unSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const ativas = unidades.filter((u) => u.ativa !== false);
    const unidadeIds = ativas.filter((u) => (0, secretaria_1.lotacoesDe)(u).some((l) => l.uid === auth.uid)).map((u) => u.id);
    const orgaos = (0, orgaos_1.orgaosDe)((_c = cfgSnap.data()) === null || _c === void 0 ? void 0 : _c.orgaos);
    const adminOrgaos = (0, orgaos_1.orgaosAdministrados)(orgaos, auth.uid);
    const hoje = (0, secretaria_2.hojeBrasil)();
    const compoe = orgaos.filter((o) => o.decisao === 'colegiada' && o.ativo && (0, orgaos_1.composicaoEm)(o.composicao, hoje).some((m) => m.uid === auth.uid)).map((o) => o.id);
    const gestorDe = unidades.filter((u) => !u.excluida && ((u.ativa !== false && (0, secretaria_1.lotacoesDe)(u).some((l) => l.uid === auth.uid && l.gestor)) || (!!u.orgao_id && adminOrgaos.includes(String(u.orgao_id))))).map((u) => u.id);
    return {
        db,
        orgId,
        org,
        ctx: { uid: auth.uid, isAdmin, unidadeIds },
        papel: String(mem.role || 'member'),
        userName: String(auth.token.name || mem.user_name || mem.user_email || 'Usuário'),
        unidades,
        gestorDe,
        adminOrgaos,
        compoe,
    };
}
/**
 * Quem age quando a regra do rito move o processo sem ninguém da equipe no ato
 * (manifestação da parte, decurso do prazo): o sistema, com as unidades
 * ativas do órgão. Só o avanço automático usa, e ele segue a única saída que o
 * rito indica; com quem conclui reservado pelo rito, o sistema não conclui.
 */
async function contextoDoSistema(db, orgId) {
    var _a;
    const [orgSnap, unSnap] = await Promise.all([
        db.collection('organizations').doc(orgId).get(),
        db.collection(exports.COL.unidades).where('organization_id', '==', orgId).get(),
    ]);
    const org = orgSnap.data() || {};
    if (((_a = org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) !== true || (0, vinculo_1.peSuspensoPlataforma)(org))
        return null;
    const unidades = unSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    return {
        db, orgId, org, ctx: { uid: 'sistema', isAdmin: true, unidadeIds: unidades.filter((u) => u.ativa !== false).map((u) => u.id) },
        papel: 'sistema', userName: 'Sistema (regra do rito)', unidades, gestorDe: [], adminOrgaos: [],
    };
}
/** Admin da entidade ou admin delegado do órgão interno `orgaoId`. */
function administraOrgao(c, orgaoId) {
    return c.ctx.isAdmin || (!!orgaoId && (c.adminOrgaos || []).includes(String(orgaoId)));
}
/** Admin da entidade, ou admin delegado quando há órgão interno (vazio = só a entidade). */
function exigirAdminDoOrgao(c, orgaoId) {
    if (!administraOrgao(c, orgaoId)) {
        throw new https_1.HttpsError('permission-denied', orgaoId
            ? 'Só o admin da entidade ou quem administra este órgão interno pode fazer isso'
            : 'É preciso a permissão "Configurar Processo Eletrônico"');
    }
}
function exigirAdmin(c) {
    if (!c.ctx.isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Configurar Processo Eletrônico"');
    }
}
/** Admin do órgão ou gestor da unidade. */
function exigirGestor(c, unidadeId) {
    const u = c.unidades.find((x) => x.id === unidadeId && !x.excluida);
    if (!u)
        throw new https_1.HttpsError('not-found', 'Unidade não encontrada');
    if (!c.ctx.isAdmin && !c.gestorDe.includes(u.id)) {
        throw new https_1.HttpsError('permission-denied', 'Só a gestão da unidade ou o admin do órgão podem fazer isso');
    }
    return u;
}
/**
 * Julgador que compõe o colegiado e não vê o processo pela lotação: lê os
 * autos enquanto o processo está pautado numa sessão do colegiado e, depois
 * do julgamento, enquanto segue numa unidade dele (até o acórdão sair).
 */
function julgadorLe(c, proc) {
    return (0, sessoes_1.leituraDeJulgador)(proc, c.compoe || [], (u) => { var _a; return ((_a = c.unidades.find((x) => x.id === u && !x.excluida)) === null || _a === void 0 ? void 0 : _a.orgao_id) || null; });
}
/**
 * Lê o processo garantindo que é do órgão (sem vazar existência de outro).
 * `julgador`: aceita a leitura do julgador do colegiado (só nas leituras;
 * `julgador` volta true quando foi por ela).
 */
async function lerProcesso(c, id, tx, opts = {}) {
    if (typeof id !== 'string' || !id)
        throw new https_1.HttpsError('invalid-argument', 'processoId é obrigatório');
    const ref = c.db.collection(exports.COL.processos).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const data = snap.data();
    // Membro que é parte neste processo: aqui ele não é o órgão; só pelo portal.
    if (data && data.organization_id === c.orgId && (0, secretaria_1.ehParte)(data, c.ctx.uid)) {
        throw new https_1.HttpsError('failed-precondition', 'Você é parte neste processo. Acompanhe-o pelo Portal das partes.');
    }
    // Excluído só reaparece pela lista de excluídos do admin (restaurar).
    if (!snap.exists || !data || data.organization_id !== c.orgId || data.status === 'excluido') {
        throw new https_1.HttpsError('not-found', 'Processo não encontrado');
    }
    if ((0, secretaria_1.podeVer)(data, c.ctx))
        return { ref, data, julgador: false };
    if (opts.julgador && julgadorLe(c, data))
        return { ref, data, julgador: true };
    // Equipe da disputa de outra unidade: lê como o julgador (juntados, sem restritos, leitura registrada).
    if ((opts.julgador || opts.equipe) && equipeLe(c, data))
        return { ref, data, julgador: true };
    throw new https_1.HttpsError('not-found', 'Processo não encontrado');
}
/**
 * Membro da equipe da disputa de preços (S14) que não vê o processo pela
 * lotação: lê os autos e age na disputa enquanto ela é a do processo (até o
 * resultado, quando vira `ultimo_certame`).
 */
function equipeLe(c, proc) {
    var _a;
    return (((_a = proc.certame) === null || _a === void 0 ? void 0 : _a.equipe_uids) || []).includes(c.ctx.uid);
}
function exigirPosse(c, proc) {
    if (!(0, secretaria_1.podeAgir)(proc, c.ctx)) {
        throw new https_1.HttpsError('permission-denied', 'O processo não está com uma unidade em que você esteja lotado');
    }
}
/** Aprovar a minuta (juntar aos autos) ou devolvê-la para correção: a fase pode reservar a quem decide. */
function exigirAprovar(c, proc) {
    const fase = (Array.isArray(proc.fases) ? proc.fases : []).find((f) => f.id === proc.fase_atual);
    const pm = fase === null || fase === void 0 ? void 0 : fase.permissoes;
    if ((pm === null || pm === void 0 ? void 0 : pm.aprovar) && !(0, permissoesFase_1.podeQuem)(pm.aprovar, pm.aprovar_atribuicao, atorDe(c, proc))) {
        throw new https_1.HttpsError('permission-denied', `Pelo rito, na fase ${fase.nome} só ${(0, permissoesFase_1.textoQuem)(pm.aprovar, pm.aprovar_atribuicao)} aprova a minuta: junta aos autos ou devolve para correção.`);
    }
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
function conferirVersao(proc, esperada) {
    if (typeof esperada === 'number' && esperada !== proc.version) {
        throw new https_1.HttpsError('aborted', 'O processo foi movimentado por outra pessoa. Recarregue e tente de novo.');
    }
}
/**
 * Grava um movimento encadeado. Deve rodar DENTRO da transação que leu o
 * processo; devolve os campos a gravar no processo junto.
 */
function registrarMovimento(tx, c, procRef, proc, tipo, descricao, dados = {}) {
    const seq = (Number(proc.mov_seq) || 0) + 1;
    const base = {
        seq,
        tipo,
        descricao,
        autor_uid: c.ctx.uid,
        autor_nome: c.userName,
        unidade_id: String(proc.unidade_atual || ''),
        em: new Date().toISOString(),
        dados,
        hash_anterior: String(proc.ultimo_hash || ''),
    };
    const hash = (0, secretaria_1.hashMovimento)(base);
    // Ato de usuário sem documento ocupa uma folha dos autos (o termo). Processo
    // antigo, com documentos e sem contagem de folhas, fica sem folha no termo.
    const semContagem = typeof proc.folhas_seq !== 'number' && Number(proc.doc_seq) > 0;
    const folha = (0, autos_1.geraTermo)(base) && !semContagem ? (Number(proc.folhas_seq) || 0) + 1 : null;
    tx.set(procRef.collection('movimentos').doc(String(seq).padStart(6, '0')), Object.assign(Object.assign(Object.assign({}, base), { hash }), (folha ? { folha } : {})));
    return Object.assign(Object.assign(Object.assign({}, (folha ? { folhas_seq: folha } : {})), { mov_seq: seq, ultimo_hash: hash, version: (Number(proc.version) || 0) + 1, updated_at: firestore_1.FieldValue.serverTimestamp() }), (dados.oculto === true ? {} : Object.assign({ 
        // `publico` deixa o portal saber se pode usar este movimento quando falta o último público.
        ultimo_movimento: { tipo, descricao, em: base.em, publico: (0, autos_1.visivelParaPartes)(base) } }, ((0, autos_1.visivelParaPartes)(base) ? { ultimo_movimento_publico: { tipo, descricao, em: base.em } } : {}))));
}
/** O que a regra fez sozinha (efeitos da fase, prazos das ações): um movimento interno logo depois do ato. */
function registrarInternos(tx, c, ref, proc, interno) {
    if (!interno.length)
        return {};
    return registrarMovimento(tx, c, ref, proc, 'efeitos_fase', interno.join(' '), (0, exigencias_1.marcasDoDestino)('informacao'));
}
/** Calendário do órgão para o ato por documento, lido só quando a fase atual tem prazo de ação. */
async function calendarioDasAcoes(db, orgId, proc) {
    var _a;
    return (0, prazosFase_1.faseComPrazoDeAcao)(proc) ? (0, secretaria_2.sanitizeCalendario)((_a = (await db.collection(exports.COL.config).doc(orgId).get()).data()) === null || _a === void 0 ? void 0 : _a.calendario) : undefined;
}
function nomeUnidade(c, id) {
    const u = c.unidades.find((x) => x.id === id);
    return u ? String(u.nome) : id;
}
function erroUsuario(e) {
    if (e instanceof https_1.HttpsError)
        throw e;
    throw new https_1.HttpsError('invalid-argument', e instanceof Error ? e.message : 'Dados inválidos');
}
//# sourceMappingURL=context.js.map