"use strict";
// ============================================================================
// Informações do andamento: os dados que as ações da fase pediram (texto,
// número, data, escolha) e que ficam nas informações do processo, para quem
// o rito disse. Derivadas dos movimentos (a fonte é a cadeia de eventos, não
// uma cópia no processo). Lógica pura, testada em test/exigencias.test.js.
// ============================================================================
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
exports.informacoesDaFolha = void 0;
exports.podeVerReservado = podeVerReservado;
exports.semReservado = semReservado;
exports.informacaoVisivel = informacaoVisivel;
exports.informacoesDoAndamento = informacoesDoAndamento;
exports.linhasDaInformacao = linhasDaInformacao;
const camposProcesso_1 = require("./camposProcesso");
/** Quem lê pode ver o dado reservado do movimento? */
function podeVerReservado(d, autorUid, quem) {
    if (!(d === null || d === void 0 ? void 0 : d.reservado))
        return true;
    return quem.isAdmin || (!!autorUid && autorUid === quem.uid) || quem.gestorDe.includes(String(d.ve_unidade || ''));
}
/** Tira o dado do que quem lê não pode ver (o movimento e a informação seguem, sem o valor). */
function semReservado(m, quem) {
    var _a;
    if (!((_a = m.dados) === null || _a === void 0 ? void 0 : _a.reservado) || podeVerReservado(m.dados, m.autor_uid, quem))
        return m;
    const _b = m.dados, { valor, valor_texto, ref } = _b, dados = __rest(_b, ["valor", "valor_texto", "ref"]);
    void valor;
    void valor_texto;
    void ref;
    return Object.assign(Object.assign({}, m), { dados: Object.assign(Object.assign({}, dados), { oculta: true }) });
}
function informacaoVisivel(i, quem) {
    if (!i.reservado || podeVerReservado(i, i.autor_uid, quem))
        return i;
    const { ref, refs } = i, resto = __rest(i, ["ref", "refs"]);
    void ref;
    void refs;
    return Object.assign(Object.assign({}, resto), { valor: null, valor_texto: '', oculta: true });
}
/**
 * Cada ação cumprida com um dado gera uma informação; desfazer a ação tira a
 * última informação dela. Voltar à fase e cumprir de novo acrescenta outra
 * (a anterior continua: é a história do processo).
 */
function informacoesDoAndamento(movs, fases, soPartes = false) {
    var _a;
    const nomes = new Map(fases.map((f) => [f.id, f.nome]));
    const pilhas = new Map();
    const ordem = [];
    for (const m of [...movs].sort((a, b) => a.seq - b.seq)) {
        if (m.tipo !== 'acao_fase' || !m.dados)
            continue;
        const d = m.dados;
        const chave = `${d.fase_id}:${d.acao_idx}`;
        const pilha = pilhas.get(chave) || [];
        pilhas.set(chave, pilha);
        if (d.feita === false) {
            const tirada = pilha.pop();
            if (tirada)
                ordem.splice(ordem.indexOf(tirada), 1);
            continue;
        }
        if (d.valor === undefined || typeof d.rotulo !== 'string')
            continue;
        const info = Object.assign(Object.assign(Object.assign(Object.assign({ fase_id: String(d.fase_id), fase_nome: nomes.get(String(d.fase_id)) || String(d.fase_id), acao_idx: Number(d.acao_idx), rotulo: d.rotulo, tipo: String(d.tipo_valor || 'texto'), valor: d.valor, valor_texto: String((_a = d.valor_texto) !== null && _a !== void 0 ? _a : d.valor), por: m.autor_nome || '', em: m.em || '', seq: m.seq, destino: ['autos', 'evento', 'informacao', 'nenhum', 'consolidar'].includes(String(d.destino))
                ? d.destino
                : d.nos_autos === true ? 'autos' : d.fora_impressao === true ? 'informacao' : 'evento', visivel_partes: d.visivel_partes === true }, (d.ref && typeof d.ref === 'object' ? { ref: d.ref } : {})), (Array.isArray(d.valor) && d.valor.some((x) => x === null || x === void 0 ? void 0 : x.ref) ? { refs: d.valor.map((x) => x === null || x === void 0 ? void 0 : x.ref).filter(Boolean) } : {})), (d.reservado === 'gestor' ? { reservado: 'gestor', ve_unidade: String(d.ve_unidade || ''), autor_uid: m.autor_uid || '' } : {})), (d.folha_dados === true ? { folha_dados: true } : {}));
        pilha.push(info);
        ordem.push(info);
    }
    return soPartes ? ordem.filter((i) => i.visivel_partes) : ordem;
}
/** O dado em linhas "Rótulo: valor": o formulário abre um campo por linha (registro só pelo número, como na certidão). */
function linhasDaInformacao(i) {
    if (i.tipo === 'formulario' && Array.isArray(i.valor)) {
        return i.valor.map((c) => `${c.rotulo}: ${c.tipo === 'registro' ? c.valor : (0, camposProcesso_1.valorTexto)(c)}`);
    }
    return [`${i.rotulo}: ${i.valor_texto}`];
}
/** As informações que vão à folha de dados: as marcadas pelo rito, nunca as reservadas. */
const informacoesDaFolha = (infos) => infos.filter((i) => i.folha_dados === true && !i.reservado);
exports.informacoesDaFolha = informacoesDaFolha;
//# sourceMappingURL=informacoes.js.map