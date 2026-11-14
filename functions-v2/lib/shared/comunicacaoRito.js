"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TEXTO_COMUNICACAO = exports.RESPOSTAS = void 0;
exports.sanitizeComunicacaoDaAcao = sanitizeComunicacaoDaAcao;
exports.sanitizeRespostaDaAcao = sanitizeRespostaDaAcao;
exports.alvosDaComunicacao = alvosDaComunicacao;
exports.comunicacoesDaAcao = comunicacoesDaAcao;
exports.comunicacaoCumprida = comunicacaoCumprida;
exports.situacaoDaResposta = situacaoDaResposta;
exports.respondidasPela = respondidasPela;
exports.sincronizarComunicacoes = sincronizarComunicacoes;
exports.faseQueEspera = faseQueEspera;
exports.aguardaResposta = aguardaResposta;
exports.encerrarComunicacoesDaFase = encerrarComunicacoesDaFase;
exports.decursosACertificar = decursosACertificar;
/**
 * Comunicação e resposta conduzidas pelo rito (processos com partes):
 *
 * - ação `pede: 'comunicacao'`: o rito diz a espécie, a quem (polos), o prazo e
 *   o texto. Cumpre-se expedindo, pela própria ação, a todas as partes que ela
 *   alcança na rodada da fase.
 * - ação `pede: 'resposta'`: espera a manifestação das partes comunicadas por
 *   uma ação anterior. Cumpre-se sozinha quando cada uma se manifestou no prazo
 *   ou o prazo dela decorreu sem manifestação; a resposta ("Apresentada",
 *   "Parcial", "Sem manifestação") vale nas condições e nos desvios do rito.
 *
 * Lógica pura; o servidor grava e registra. Ver docs/PROCESSO_ELETRONICO.md.
 */
const comunicacoes_1 = require("./comunicacoes");
const camposProcesso_1 = require("./camposProcesso");
const secretaria_1 = require("./secretaria");
exports.RESPOSTAS = ['Apresentada', 'Parcial', 'Sem manifestação'];
exports.MAX_TEXTO_COMUNICACAO = 2000;
/** Valida o que o rito pede ao comunicar. Lança com mensagem. */
function sanitizeComunicacaoDaAcao(raw, acao) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const esp = (0, comunicacoes_1.especieValida)(r.especie, r.especie_nome, r.especie_m, `A ação "${acao}" comunica as partes: escolha a espécie (intimação, notificação, citação...)`);
    const polos = [...new Set((Array.isArray(r.polos) ? r.polos : []).map(String))];
    if (polos.some((p) => !camposProcesso_1.POLOS.includes(p)))
        throw new Error(`A ação "${acao}": polo desconhecido`);
    const dias = r.dias === undefined || r.dias === null || r.dias === '' ? 0 : Number(r.dias);
    if (!Number.isInteger(dias) || dias < 0 || dias > secretaria_1.MAX_PRAZO_DIAS)
        throw new Error(`A ação "${acao}": o prazo de resposta vai de 0 (sem prazo) a ${secretaria_1.MAX_PRAZO_DIAS} dias`);
    const txt = (0, secretaria_1.texto)(r.texto, exports.MAX_TEXTO_COMUNICACAO);
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, esp), { dias }), (polos.length && polos.length < camposProcesso_1.POLOS.length ? { polos } : {})), (dias && r.contagem === 'corridos' ? { contagem: 'corridos' } : {})), (txt ? { texto: txt } : {}));
}
/** Valida a espera: aponta para uma comunicação anterior da fase que abre prazo. */
function sanitizeRespostaDaAcao(raw, regras, acoes, i, mapa) {
    var _a;
    const r = (raw && typeof raw === 'object' ? raw : {});
    const bruto = Number(r.de);
    const de = mapa ? mapa.get(bruto) : bruto;
    const alvo = de === undefined ? undefined : regras[de];
    if (de === undefined || !Number.isInteger(de) || de < 0 || de >= i || (alvo === null || alvo === void 0 ? void 0 : alvo.pede) !== 'comunicacao' || !((_a = alvo.comunicacao) === null || _a === void 0 ? void 0 : _a.dias)) {
        throw new Error(`A ação "${acoes[i]}" espera a resposta das partes: escolha uma ação anterior da fase que comunica com prazo de resposta`);
    }
    return { de };
}
/** Partes (índices) que a comunicação da ação alcança: as do polo pedido, sem as retiradas. */
function alvosDaComunicacao(cfg, partes) {
    if (!cfg)
        return [];
    return (partes || []).map((p, i) => ({ p, i }))
        .filter(({ p }) => p && !p.retirada && (!cfg.polos || cfg.polos.includes(String(p.polo))))
        .map(({ i }) => i);
}
/** Comunicações expedidas pela ação na rodada atual da fase (sem as tornadas sem efeito). */
function comunicacoesDaAcao(lista, faseId, idx) {
    return (lista || []).filter((c) => c.fase_id === faseId && c.acao_idx === idx && c.rodada_fim !== true && c.status !== 'sem_efeito');
}
/** A ação de comunicação alcançou todas as partes que devia? (sem ninguém a comunicar, não se cumpre sozinha) */
function comunicacaoCumprida(f, idx, partes, lista) {
    var _a, _b;
    const alvos = alvosDaComunicacao((_b = (_a = f.acoes_regras) === null || _a === void 0 ? void 0 : _a[idx]) === null || _b === void 0 ? void 0 : _b.comunicacao, partes);
    const feitas = new Set(comunicacoesDaAcao(lista, f.id, idx).map((c) => c.parte_idx));
    return alvos.length > 0 && alvos.every((i) => feitas.has(i));
}
/** Prazo da resposta já decorreu? (vence no dia; decorre no seguinte) */
const decorreu = (c, hoje) => !!c.vence_em && hoje > c.vence_em;
/**
 * Como está a espera: quem respondeu, quem deixou decorrer e quem ainda pode
 * responder. `valor` só existe quando ninguém mais pode responder.
 */
function situacaoDaResposta(f, idx, lista, hoje) {
    var _a, _b, _c;
    const de = (_c = (_b = (_a = f.acoes_regras) === null || _a === void 0 ? void 0 : _a[idx]) === null || _b === void 0 ? void 0 : _b.resposta) === null || _c === void 0 ? void 0 : _c.de;
    const coms = typeof de === 'number' ? comunicacoesDaAcao(lista, f.id, de) : [];
    const apresentadas = coms.filter((c) => !!c.respondida_em);
    const decursos = coms.filter((c) => !c.respondida_em && decorreu(c, hoje));
    const pendentes = coms.filter((c) => !c.respondida_em && !decorreu(c, hoje));
    const valor = !coms.length || pendentes.length ? null
        : !decursos.length ? 'Apresentada' : !apresentadas.length ? 'Sem manifestação' : 'Parcial';
    return { comunicacoes: coms, apresentadas, decursos, pendentes, valor };
}
/**
 * Comunicações que a manifestação da parte `parteIdx` responde agora: as da
 * fase atual, ligadas a uma ação que alguém espera, ainda não respondidas e
 * com o prazo em curso (ou ainda por abrir). A que chega depois do prazo não
 * conta: a parte perdeu a oportunidade, e o decurso é certificado.
 */
function respondidasPela(f, parteIdx, lista, hoje) {
    if (!f || parteIdx < 0)
        return [];
    const esperadas = new Set((f.acoes_regras || []).map((r) => { var _a; return ((r === null || r === void 0 ? void 0 : r.pede) === 'resposta' ? (_a = r.resposta) === null || _a === void 0 ? void 0 : _a.de : undefined); }).filter((x) => typeof x === 'number'));
    return (lista || []).filter((c) => c.fase_id === f.id && typeof c.acao_idx === 'number' && esperadas.has(c.acao_idx) && c.rodada_fim !== true
        && c.status !== 'sem_efeito' && c.parte_idx === parteIdx && !c.respondida_em && !decorreu(c, hoje)).map((c) => c.id);
}
/**
 * Acerta as ações de comunicação e de resposta da fase atual com o que
 * aconteceu: comunicação que alcançou todos fica cumprida (e deixa de ficar
 * se uma foi tornada sem efeito); espera que ninguém mais pode responder fica
 * cumprida com a resposta. Devolve só o que mudou, ou null.
 */
function sincronizarComunicacoes(proc, f, hoje) {
    if (!f)
        return null;
    const regras = f.acoes_regras || [];
    if (!regras.some((r) => (r === null || r === void 0 ? void 0 : r.pede) === 'comunicacao' || (r === null || r === void 0 ? void 0 : r.pede) === 'resposta'))
        return null;
    const lista = (proc.comunicacoes || []);
    const partes = (proc.partes || []);
    const todasFeitas = Object.assign({}, (proc.acoes_feitas || {}));
    const todasResp = Object.assign({}, (proc.acoes_respostas || {}));
    const feitas = new Set(todasFeitas[f.id] || []);
    const resp = Object.assign({}, (todasResp[f.id] || {}));
    const notas = [];
    const novas = [];
    let mudou = false;
    regras.forEach((r, i) => {
        var _a;
        const acao = ((_a = f.acoes) === null || _a === void 0 ? void 0 : _a[i]) || `ação ${i + 1}`;
        if ((r === null || r === void 0 ? void 0 : r.pede) === 'comunicacao') {
            const ok = comunicacaoCumprida(f, i, partes, lista);
            if (ok && !feitas.has(i)) {
                feitas.add(i);
                novas.push(i);
                mudou = true;
                notas.push(`Ação "${acao}" cumprida: a comunicação alcançou todas as partes previstas.`);
            }
            if (!ok && feitas.has(i)) {
                feitas.delete(i);
                mudou = true;
                notas.push(`Ação "${acao}" voltou a ficar por cumprir: falta comunicar parte prevista.`);
            }
        }
        if ((r === null || r === void 0 ? void 0 : r.pede) === 'resposta' && !feitas.has(i)) {
            const s = situacaoDaResposta(f, i, lista, hoje);
            if (s.valor) {
                feitas.add(i);
                resp[String(i)] = s.valor;
                mudou = true;
                novas.push(i);
                notas.push(`Ação "${acao}" cumprida pela regra do rito: ${s.valor.toLowerCase()}.`);
            }
        }
    });
    if (!mudou)
        return null;
    todasFeitas[f.id] = [...feitas].sort((a, b) => a - b);
    todasResp[f.id] = resp;
    return { acoes_feitas: todasFeitas, acoes_respostas: todasResp, notas, novas };
}
/**
 * Fase cujas comunicações o processo espera: a atual ou, durante a fase de
 * espera, a de origem (que é retomada como estava).
 */
function faseQueEspera(proc) {
    var _a;
    const fases = (Array.isArray(proc.fases) ? proc.fases : []);
    const origem = (_a = proc.espera) === null || _a === void 0 ? void 0 : _a.fase;
    return fases.find((f) => f.id === (typeof origem === 'string' && origem ? origem : proc.fase_atual));
}
/** Alguma ação de resposta da fase ainda espera parte comunicada? (marca o processo para a rotina diária) */
function aguardaResposta(proc, f) {
    if (!f)
        return false;
    const feitas = new Set((proc.acoes_feitas || {})[f.id] || []);
    const lista = (proc.comunicacoes || []);
    return (f.acoes_regras || []).some((r, i) => {
        var _a;
        return (r === null || r === void 0 ? void 0 : r.pede) === 'resposta' && !feitas.has(i) && typeof ((_a = r.resposta) === null || _a === void 0 ? void 0 : _a.de) === 'number'
            && comunicacoesDaAcao(lista, f.id, r.resposta.de).some((c) => !c.respondida_em);
    });
}
/** Saída da fase: as comunicações dela deixam de contar para a próxima rodada. */
function encerrarComunicacoesDaFase(lista, faseId) {
    if (!faseId || !(lista || []).some((c) => c.fase_id === faseId && c.rodada_fim !== true))
        return null;
    return (lista || []).map((c) => (c.fase_id === faseId && c.rodada_fim !== true ? Object.assign(Object.assign({}, c), { rodada_fim: true }) : c));
}
/** Decursos a certificar: comunicações esperadas pela fase atual cujo prazo decorreu sem manifestação e ainda sem certidão. */
function decursosACertificar(f, lista, hoje) {
    if (!f)
        return [];
    const esperadas = new Set((f.acoes_regras || []).map((r) => { var _a; return ((r === null || r === void 0 ? void 0 : r.pede) === 'resposta' ? (_a = r.resposta) === null || _a === void 0 ? void 0 : _a.de : undefined); }).filter((x) => typeof x === 'number'));
    return (lista || []).filter((c) => c.fase_id === f.id && typeof c.acao_idx === 'number' && esperadas.has(c.acao_idx) && c.rodada_fim !== true
        && c.status !== 'sem_efeito' && !c.respondida_em && decorreu(c, hoje) && !c.decurso_certificado);
}
//# sourceMappingURL=comunicacaoRito.js.map