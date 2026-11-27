"use strict";
// ============================================================================
// Quem pode praticar cada ato, pelo rito: cumprir uma ação, concluir a fase,
// dispensar o que ela exige, seguir por caminho fora do previsto e mudar a
// situação do processo. Ausente = como sempre foi: quem tem o processo (com
// motivo, quando o ato pede). A administração do Processo Eletrônico sempre
// pode. Lógica pura, testada em test/permissoesFase.test.js; o cliente tem o
// espelho em src/lib/permissoesFase.js (só para a tela; quem decide é o
// servidor).
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.textoReserva = exports.textoQuem = exports.podeReserva = exports.mesmaAtribuicao = exports.MAX_ATRIBUICAO = exports.RESERVAS = exports.QUEM = void 0;
exports.sanitizeQuem = sanitizeQuem;
exports.sanitizePermissoes = sanitizePermissoes;
exports.podeQuem = podeQuem;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** Quem pode, além da administração: o responsável designado, quem gere a unidade ou quem tem certa atribuição na lotação. */
exports.QUEM = ['responsavel', 'gestor', 'atribuicao'];
/** Ato reservado a quem gere a unidade que tem o processo, ou só à administração. */
exports.RESERVAS = ['gestor', 'admin'];
exports.MAX_ATRIBUICAO = 80;
const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** A mesma atribuição, sem contar acento, caixa e espaços a mais ("Promotor de Justiça" = "promotor de justica"). */
const mesmaAtribuicao = (a, b) => {
    const x = sem(String(a !== null && a !== void 0 ? a : ''));
    return !!x && x === sem(String(b !== null && b !== void 0 ? b : ''));
};
exports.mesmaAtribuicao = mesmaAtribuicao;
/** Reserva saneada. Com 'atribuicao', o nome dela é obrigatório. Lança Error com mensagem para o usuário. */
function sanitizeQuem(quem, atribuicao, onde) {
    if (!exports.QUEM.includes(quem))
        return {};
    if (quem !== 'atribuicao')
        return { quem: quem };
    const a = texto(atribuicao, exports.MAX_ATRIBUICAO);
    if (!a)
        throw new Error(`${onde}: informe a atribuição de quem pode, como está na lotação (ex.: Promotor)`);
    return { quem: 'atribuicao', atribuicao: a };
}
/** Permissões da fase saneadas; `undefined` quando nada foi reservado. Lança Error com mensagem para o usuário. */
function sanitizePermissoes(raw, nomeFase) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    const c = sanitizeQuem(o.concluir, o.concluir_atribuicao, `Em "${nomeFase}", quem conclui a fase`);
    const ap = sanitizeQuem(o.aprovar, o.aprovar_atribuicao, `Em "${nomeFase}", quem aprova a minuta`);
    const reserva = (v) => (exports.RESERVAS.includes(v) ? v : undefined);
    const out = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (c.quem ? { concluir: c.quem } : {})), (c.atribuicao ? { concluir_atribuicao: c.atribuicao } : {})), (ap.quem ? { aprovar: ap.quem } : {})), (ap.atribuicao ? { aprovar_atribuicao: ap.atribuicao } : {})), (reserva(o.dispensar) ? { dispensar: reserva(o.dispensar) } : {})), (reserva(o.desviar) ? { desviar: reserva(o.desviar) } : {})), (reserva(o.situacao) ? { situacao: reserva(o.situacao) } : {}));
    return Object.keys(out).length ? out : undefined;
}
/** A pessoa atende à reserva? Sem reserva, sempre; a administração, sempre. */
function podeQuem(quem, atribuicao, a) {
    if (!quem || a.isAdmin)
        return true;
    if (quem === 'responsavel')
        return a.responsavel;
    if (quem === 'gestor')
        return a.gestor;
    return (0, exports.mesmaAtribuicao)(atribuicao, a.atribuicao);
}
const podeReserva = (r, a) => !r || a.isAdmin || (r === 'gestor' && a.gestor);
exports.podeReserva = podeReserva;
/** "só <quem>" para as mensagens. */
const textoQuem = (quem, atribuicao) => (quem === 'responsavel' ? 'o responsável pelo processo' : quem === 'gestor' ? 'quem gere a unidade' : `quem tem a atribuição "${atribuicao || ''}"`);
exports.textoQuem = textoQuem;
const textoReserva = (r) => (r === 'gestor' ? 'quem gere a unidade' : 'a administração do Processo Eletrônico');
exports.textoReserva = textoReserva;
//# sourceMappingURL=permissoesFase.js.map