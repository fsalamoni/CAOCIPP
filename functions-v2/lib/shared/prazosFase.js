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
exports.faseComPrazoDeAcao = void 0;
exports.marcasDoPrazo = marcasDoPrazo;
exports.prazosDasAcoes = prazosDasAcoes;
exports.camposDosPrazosDasAcoes = camposDosPrazosDasAcoes;
exports.encerrarPrazosDaFase = encerrarPrazosDaFase;
exports.prazosEmAlerta = prazosEmAlerta;
exports.vencidosATratar = vencidosATratar;
// ============================================================================
// Prazos que a fase abre sozinha além do dela: o prazo de cada ação, a
// antecedência do alerta e o que fazer quando vencem. Lógica pura, testada em
// test/efeitosFase.test.js.
// ============================================================================
const crypto_1 = require("crypto");
const secretaria_1 = require("./secretaria");
const exigencias_1 = require("./exigencias");
const efeitosFase_1 = require("./efeitosFase");
const br = (iso) => iso.split('-').reverse().join('/');
/** O que todo prazo aberto pela fase leva: a antecedência do alerta e a regra do vencimento, como estavam no rito. */
function marcasDoPrazo(f) {
    return Object.assign(Object.assign({}, (typeof f.prazo_alerta_dias === 'number' ? { alerta_dias: f.prazo_alerta_dias } : {})), (f.prazo_vencido ? { ao_vencer: f.prazo_vencido } : {}));
}
/**
 * Prazos das ações da fase em que o processo está, conforme o que já foi
 * feito e respondido: abre o da ação que vale e ainda não foi cumprida, encerra
 * o da cumprida, cancela o da que deixou de valer e reabre (com o vencimento
 * original) o da ação desfeita. Prazo que alguém encerrou à mão fica como está.
 * Devolve null quando nada muda.
 */
function prazosDasAcoes(proc, fase, hoje, agora, calendario, quem, novoId) {
    const regras = (fase === null || fase === void 0 ? void 0 : fase.acoes_regras) || [];
    if (!fase || !regras.some((r) => r === null || r === void 0 ? void 0 : r.prazo_dias))
        return null;
    const feitas = new Set((proc.acoes_feitas || {})[fase.id] || []);
    const resp = (0, exigencias_1.respostasDaFase)(proc);
    let prazos = (Array.isArray(proc.prazos) ? proc.prazos : []);
    const notas = [];
    regras.forEach((r, i) => {
        var _a;
        const acao = (_a = fase.acoes) === null || _a === void 0 ? void 0 : _a[i];
        const dias = Number(r === null || r === void 0 ? void 0 : r.prazo_dias);
        if (!acao || !Number.isInteger(dias) || dias < 1 || dias > secretaria_1.MAX_PRAZO_DIAS)
            return;
        const feita = feitas.has(i);
        const quer = !feita && (0, exigencias_1.acaoAtiva)(fase, i, resp) && !(0, exigencias_1.alternativaCumprida)(fase, i, feitas, resp);
        const daRodada = prazos.filter((x) => x.fase_id === fase.id && x.acao_idx === i && x.rodada_fim !== true);
        const aberto = daRodada.find((x) => x.status === 'aberto');
        if (aberto && !quer) {
            const status = feita ? 'cumprido' : 'cancelado';
            prazos = prazos.map((x) => (x === aberto ? Object.assign(Object.assign({}, x), { status, encerrado_em: hoje, encerrado_por: quem, pela_regra: true }) : x));
            notas.push(feita
                ? `Prazo da ação "${acao}" cumprido ${hoje <= aberto.vence_em ? 'no prazo' : 'fora do prazo'}.`
                : `Prazo da ação "${acao}" cancelado: ela deixou de valer.`);
            return;
        }
        if (aberto || !quer)
            return;
        const anterior = daRodada[daRodada.length - 1];
        if (anterior) {
            // Encerrado à mão: a decisão de quem encerrou vale.
            if (anterior.pela_regra !== true)
                return;
            // Desfeito o cumprimento, vale o vencimento de antes; a ação que deixou de valer e volta conta de novo.
            const recontar = anterior.status === 'cancelado';
            const cont = anterior.contagem === 'corridos' ? 'corridos' : 'uteis';
            const novoVence = recontar ? (0, secretaria_1.calcularVencimento)(hoje, Number(anterior.dias) || dias, cont, calendario) : anterior.vence_em;
            prazos = prazos.map((x) => {
                if (x !== anterior)
                    return x;
                const { encerrado_em: _e, encerrado_por: _p, pela_regra: _r, vencido_tratado_em: _v } = x, resto = __rest(x, ["encerrado_em", "encerrado_por", "pela_regra", "vencido_tratado_em"]);
                return Object.assign(Object.assign(Object.assign({}, resto), { status: 'aberto' }), (recontar ? { inicio: hoje, vence_em: novoVence } : {}));
            });
            notas.push(`Prazo da ação "${acao}" reaberto: vence em ${br(novoVence)}.`);
            return;
        }
        if (prazos.length >= secretaria_1.MAX_ITENS)
            return;
        const contagem = (r === null || r === void 0 ? void 0 : r.prazo_contagem) === 'corridos' ? 'corridos' : 'uteis';
        const vence = (0, secretaria_1.calcularVencimento)(hoje, dias, contagem, calendario);
        prazos = [...prazos, Object.assign({ id: novoId(), descricao: `Ação "${acao}" da fase ${fase.nome}`, fase_id: fase.id, acao_idx: i, dias, contagem, inicio: hoje, vence_em: vence, status: 'aberto', aberto_em: agora, aberto_por: quem, automatico: true }, marcasDoPrazo(fase))];
        notas.push(`Prazo da ação "${acao}" aberto: ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'}, vence em ${br(vence)}.`);
    });
    return notas.length ? { prazos, notas } : null;
}
/** A fase atual tem ação com prazo próprio: só então o ato por documento precisa do calendário do órgão. */
const faseComPrazoDeAcao = (proc) => { var _a, _b; return ((_b = (_a = (proc.fases || []).find((f) => f.id === proc.fase_atual)) === null || _a === void 0 ? void 0 : _a.acoes_regras) === null || _b === void 0 ? void 0 : _b.some((r) => Number(r === null || r === void 0 ? void 0 : r.prazo_dias) > 0)) === true; };
exports.faseComPrazoDeAcao = faseComPrazoDeAcao;
/**
 * Quando um cumprimento por documento (juntada, guarda, petição) mexe nos
 * prazos das ações: `campos` traz `prazos` e os derivados, `notas` o que vai ao
 * registro interno. `campos` de entrada: o que o ato já vai gravar (ações
 * feitas); `pendencias`: a lista que o mesmo ato grava, se ele mexe nelas.
 */
function camposDosPrazosDasAcoes(proc, campos, fase, quem, pendencias, calendario) {
    const pz = prazosDasAcoes(Object.assign(Object.assign({}, proc), campos), fase, (0, secretaria_1.hojeBrasil)(), new Date().toISOString(), calendario, quem, () => (0, crypto_1.randomBytes)(10).toString('hex'));
    return pz
        ? { campos: Object.assign({ prazos: pz.prazos }, (0, secretaria_1.derivados)(pendencias !== null && pendencias !== void 0 ? pendencias : (proc.pendencias || []), pz.prazos)), notas: pz.notas }
        : { campos: {}, notas: [] };
}
/**
 * Sair da fase encerra a rodada: o prazo dela é dado por cumprido (como sempre
 * foi), o de ação que ficou por fazer é cancelado, e os das ações deixam de
 * contar para a próxima vez que o processo entrar na fase.
 */
function encerrarPrazosDaFase(prazos, faseId, hoje, quem) {
    if (!faseId)
        return { prazos, notas: [] };
    const notas = [];
    let mudou = false;
    const out = prazos.map((x) => {
        if (!x.fase_id || x.fase_id !== faseId)
            return x;
        const deAcao = typeof x.acao_idx === 'number';
        if (x.status !== 'aberto') {
            if (!deAcao || x.rodada_fim === true)
                return x;
            mudou = true;
            return Object.assign(Object.assign({}, x), { rodada_fim: true });
        }
        mudou = true;
        if (deAcao) {
            notas.push(`Prazo encerrado sem cumprimento, com a saída da fase: ${x.descricao}.`);
            return Object.assign(Object.assign({}, x), { status: 'cancelado', encerrado_em: hoje, encerrado_por: quem, rodada_fim: true });
        }
        notas.push(`Prazo interno da fase encerrado ${hoje <= x.vence_em ? 'no prazo' : 'fora do prazo'}: ${x.descricao}.`);
        return Object.assign(Object.assign({}, x), { status: 'cumprido', encerrado_em: hoje, encerrado_por: quem });
    });
    return { prazos: mudou ? out : prazos, notas };
}
const antecedencia = (x) => (typeof x.alerta_dias === 'number' && x.alerta_dias >= 0 ? x.alerta_dias : efeitosFase_1.ALERTA_PADRAO);
/** Prazos abertos que pedem alerta hoje: vencidos ou dentro da antecedência de cada um. Do mais próximo ao mais distante. */
function prazosEmAlerta(prazos, hoje) {
    return (Array.isArray(prazos) ? prazos : [])
        .filter((x) => x.status === 'aberto' && x.vence_em <= (0, secretaria_1.somarDias)(hoje, antecedencia(x)))
        .sort((a, b) => a.vence_em.localeCompare(b.vence_em));
}
/** Prazos vencidos cuja regra de vencimento (urgência, aviso a quem gere) ainda não foi aplicada. */
function vencidosATratar(prazos, hoje) {
    return (Array.isArray(prazos) ? prazos : [])
        .filter((x) => x.status === 'aberto' && x.vence_em < hoje && !x.vencido_tratado_em && !!x.ao_vencer && typeof x.ao_vencer === 'object'
        && (x.ao_vencer.urgente === true || x.ao_vencer.avisar_gestores === true));
}
//# sourceMappingURL=prazosFase.js.map