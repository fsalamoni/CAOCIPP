"use strict";
// ============================================================================
// Quem representa a parte no processo: advogado, defensor público, procurador
// do ente público, representante legal, preposto. A qualidade e a inscrição
// (OAB, matrícula) ficam no representante e acompanham tudo o que ele assina
// no portal. Lógica pura, testada em test/representacao.test.js; espelho no
// cliente em src/lib/representacao.js.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUALIDADES = void 0;
exports.sanitizeRepresentacao = sanitizeRepresentacao;
exports.qualificacao = qualificacao;
exports.nomeQualificado = nomeQualificado;
exports.QUALIDADES = [
    // [id, nome, exige procuração ou ato de representação]
    ['advogado', 'Advogado(a)', true],
    ['defensor', 'Defensor(a) público(a)', false],
    ['procurador', 'Procurador(a) do ente público', false],
    ['legal', 'Representante legal', true],
    ['preposto', 'Preposto(a)', true],
    ['outro', 'Outro', false],
];
const ACHAR = (id) => exports.QUALIDADES.find(([q]) => q === id);
const limpo = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/**
 * Qualidade, inscrição e a conferência dos poderes de um representante novo.
 * Advogado informa a inscrição na OAB; quem depende de procuração ou de ato
 * de representação só entra com os poderes conferidos. Lança Error.
 */
function sanitizeRepresentacao(bruto) {
    const o = (bruto && typeof bruto === 'object' ? bruto : {});
    const q = ACHAR(o.qualidade);
    if (!q)
        return {};
    const inscricao = limpo(o.inscricao, 40);
    if (q[0] === 'advogado' && !inscricao)
        throw new Error('Informe a inscrição do advogado na OAB');
    if (q[2] && o.poderes !== true)
        throw new Error('Confira a procuração ou o ato de representação antes de dar o acesso');
    return Object.assign(Object.assign({ qualidade: q[0] }, (inscricao ? { inscricao } : {})), (o.poderes === true ? { poderes: true } : {}));
}
/** "advogado(a), OAB/RS 12.345" (vazio quando o representante não tem qualidade registrada). */
function qualificacao(r) {
    const q = ACHAR(r === null || r === void 0 ? void 0 : r.qualidade);
    if (!q || q[0] === 'outro')
        return (r === null || r === void 0 ? void 0 : r.inscricao) || '';
    return `${q[1].toLowerCase()}${(r === null || r === void 0 ? void 0 : r.inscricao) ? `, ${r.inscricao}` : ''}`;
}
/** "Maria Souza (advogado(a), OAB/RS 12.345)" ou só o nome. */
function nomeQualificado(r) {
    const q = qualificacao(r);
    return q ? `${r.nome} (${q})` : r.nome;
}
//# sourceMappingURL=representacao.js.map