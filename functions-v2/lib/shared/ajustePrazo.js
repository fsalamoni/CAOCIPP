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
exports.MAX_AJUSTES = void 0;
exports.ajustarPrazo = ajustarPrazo;
exports.ajustarComunicacao = ajustarComunicacao;
/**
 * Prorrogação e devolução de prazo. Lógica pura.
 *
 * - Prorrogar: o prazo ainda corre; soma dias ao vencimento.
 * - Devolver (restituir): o prazo já venceu; corre de novo, a contar de hoje.
 *
 * O prazo guarda a história em `ajustes`. Se é o prazo de resposta de uma
 * comunicação, a comunicação acompanha o novo vencimento; na devolução, o
 * decurso já certificado deixa de valer e a espera do rito reabre.
 */
const secretaria_1 = require("./secretaria");
exports.MAX_AJUSTES = 10;
const br = (d) => d.split('-').reverse().join('/');
/** Novo estado do prazo e o texto da certidão. Lança com mensagem. */
function ajustarPrazo(prazo, tipo, diasBruto, motivo, hoje, cal, quem) {
    const dias = Number(diasBruto);
    if (!Number.isInteger(dias) || dias < 1 || dias > secretaria_1.MAX_PRAZO_DIAS)
        throw new Error('Informe os dias');
    if (!motivo)
        throw new Error('Diga o motivo');
    if (prazo.status !== 'aberto')
        throw new Error('Só prazo aberto pode ser prorrogado ou devolvido');
    const ajustes = (Array.isArray(prazo.ajustes) ? prazo.ajustes : []);
    if (ajustes.length >= exports.MAX_AJUSTES)
        throw new Error(`Este prazo já teve ${exports.MAX_AJUSTES} ajustes. Abra um prazo novo.`);
    const vencido = hoje > prazo.vence_em;
    if (tipo === 'prorrogacao' && vencido)
        throw new Error('O prazo já venceu: use a devolução');
    if (tipo === 'devolucao' && !vencido)
        throw new Error('O prazo ainda corre: use a prorrogação');
    const contagem = prazo.contagem === 'corridos' ? 'corridos' : 'uteis';
    const para = (0, secretaria_1.calcularVencimento)(tipo === 'prorrogacao' ? prazo.vence_em : hoje, dias, contagem, cal);
    const de = prazo.vence_em;
    const unidade = `${dias} dia${dias === 1 ? '' : 's'} ${contagem === 'uteis' ? (dias === 1 ? 'útil' : 'úteis') : (dias === 1 ? 'corrido' : 'corridos')}`;
    const quemPrazo = `${prazo.descricao}${prazo.destinatario ? ` (${prazo.destinatario})` : ''}`;
    const texto = tipo === 'prorrogacao'
        ? `Prazo prorrogado por ${unidade}: ${quemPrazo}. Vencia em ${br(de)}; passa a vencer em ${br(para)}. Motivo: ${motivo}`
        : `Prazo devolvido: ${quemPrazo}, vencido em ${br(de)}. Corre de novo por ${unidade}, a contar de hoje, e vence em ${br(para)}. Motivo: ${motivo}`;
    return { prazo: Object.assign(Object.assign({}, prazo), { vence_em: para, ajustes: [...ajustes, Object.assign({ tipo, dias, de, para, motivo }, quem)] }), texto };
}
/**
 * A comunicação cujo prazo mudou acompanha o novo vencimento. Na devolução,
 * se a resposta ainda não veio, o decurso deixa de valer e, sendo da fase que
 * espera, a ação de resposta que o rito já dera por cumprida volta a esperar.
 */
function ajustarComunicacao(proc, prazoId, venceEm, tipo, fase) {
    const lista = (proc.comunicacoes || []);
    const alvo = lista.find((c) => c.prazo_id === prazoId);
    if (!alvo)
        return null;
    const devolve = tipo === 'devolucao' && !alvo.respondida_em;
    const comunicacoes = lista.map((c) => {
        if (c !== alvo)
            return c;
        const _a = c, { decurso_certificado: _d } = _a, resto = __rest(_a, ["decurso_certificado"]);
        return Object.assign(Object.assign({}, (devolve ? resto : c)), { vence_em: venceEm });
    });
    if (!devolve || !fase || alvo.fase_id !== fase.id || alvo.rodada_fim === true || typeof alvo.acao_idx !== 'number')
        return { comunicacoes, reabertas: [] };
    const todasFeitas = (proc.acoes_feitas || {});
    const feitas = todasFeitas[fase.id] || [];
    const reabertas = (fase.acoes_regras || []).map((r, i) => { var _a; return ((r === null || r === void 0 ? void 0 : r.pede) === 'resposta' && ((_a = r.resposta) === null || _a === void 0 ? void 0 : _a.de) === alvo.acao_idx && feitas.includes(i) ? i : -1); }).filter((i) => i >= 0);
    if (!reabertas.length)
        return { comunicacoes, reabertas };
    const todasResp = (proc.acoes_respostas || {});
    const resp = Object.assign({}, (todasResp[fase.id] || {}));
    for (const i of reabertas)
        delete resp[String(i)];
    return {
        comunicacoes, reabertas,
        acoes_feitas: Object.assign(Object.assign({}, todasFeitas), { [fase.id]: feitas.filter((i) => !reabertas.includes(i)) }),
        acoes_respostas: Object.assign(Object.assign({}, todasResp), { [fase.id]: resp }),
    };
}
//# sourceMappingURL=ajustePrazo.js.map