"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULOS_SITUACAO = exports.SITUACOES = void 0;
exports.sanitizeSituacaoRegistro = sanitizeSituacaoRegistro;
exports.mudancasDaSituacao = mudancasDaSituacao;
exports.registroDoProcesso = registroDoProcesso;
// Situação do registro ligado ao processo (Consultas e Expedientes), conduzida
// pelo rito: a fase diz em que coluna do quadro o registro fica quando o
// processo entra nela ou quando alguém o assume.
//
// Nos dois módulos a situação é derivada das datas preenchidas
// (`calculateStatus`). Mudar a situação é preencher a data da fase de destino
// e, na volta, apagar as datas das fases seguintes: a mesma regra do quadro
// (`handleDialogConfirm` e `rollbackByStatus` em KanbanBoard.jsx).
const fields_1 = require("./fields");
exports.SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'];
exports.MODULOS_SITUACAO = ['consultas', 'expedientes'];
function sanitizeSituacaoRegistro(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const modulo = exports.MODULOS_SITUACAO.find((m) => m === r.modulo);
    const de = (v) => exports.SITUACOES.find((s) => s === v);
    const entrar = de(r.ao_entrar);
    const assumir = de(r.ao_assumir);
    if (!modulo || (!entrar && !assumir))
        return null;
    return Object.assign(Object.assign({ modulo }, (entrar ? { ao_entrar: entrar } : {})), (assumir ? { ao_assumir: assumir } : {}));
}
/** Data que põe o registro em cada situação ("Pendente" é a falta de todas). */
const MARCADOR = {
    'Pendente': null,
    'Em elaboração': 'analysis_start_date',
    'Aguarda retorno de terceiros': 'third_party_referral_date',
    'Em revisão': 'review_submission_date',
    'Revisadas': 'reviewed_date',
    'Na pasta': 'archived_date',
};
/** O que se apaga para o registro voltar a cada situação (datas das fases seguintes). */
const DEPOIS = {
    'Pendente': ['analysis_start_date', 'third_party_referral_date', 'third_party_recipient', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Em elaboração': ['third_party_referral_date', 'third_party_recipient', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Aguarda retorno de terceiros': ['review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Em revisão': ['reviewed_date', 'review_return_date', 'archived_date'],
    'Revisadas': ['review_return_date', 'archived_date'],
    'Na pasta': [],
};
const normal = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const preenchido = (v) => v !== undefined && v !== null && String(v).trim() !== '';
/** Chaves do documento que guardam o campo (registros importados usam nomes antigos). */
function chavesCom(doc, campo) {
    const nomes = (fields_1.FIELD_ALIASES[campo] || [campo]).map(normal);
    return Object.keys(doc).filter((k) => nomes.includes(normal(k)) && preenchido(doc[k]));
}
/**
 * Campos a gravar no registro para ele ficar na situação `alvo`. `quem`:
 * a pessoa que assumiu o processo, que vira a responsável ao entrar em
 * elaboração. Datas já preenchidas ficam como estão. `null`: nada muda.
 */
function mudancasDaSituacao(doc, alvo, hoje, quem) {
    const m = {};
    for (const campo of DEPOIS[alvo])
        for (const k of chavesCom(doc, campo))
            m[k] = null;
    const falta = (campo) => !(0, fields_1.getSmartField)(doc, campo);
    const marcador = MARCADOR[alvo];
    if (marcador && falta(marcador))
        m[marcador] = hoje;
    if (alvo === 'Em elaboração') {
        if (falta('distribution_date'))
            m.distribution_date = hoje;
        if (quem && doc.responsible_user_id !== quem.uid) {
            m.responsible_user_id = quem.uid;
            m.responsible_user_name = quem.nome;
        }
    }
    if (alvo === 'Na pasta' && falta('review_return_date'))
        m.review_return_date = hoje;
    if (doc.status !== alvo)
        m.status = alvo;
    return Object.keys(m).length ? m : null;
}
/**
 * O registro do módulo que o processo conduz: aquele de onde ele nasceu ou,
 * sem origem nesse módulo, o único registro dele ligado ao processo.
 */
function registroDoProcesso(proc, modulo) {
    var _a;
    const o = (_a = proc.origem) === null || _a === void 0 ? void 0 : _a.ref;
    if ((o === null || o === void 0 ? void 0 : o.modulo) === modulo && o.id)
        return { id: String(o.id) };
    const ids = [...new Set((Array.isArray(proc.vinculos) ? proc.vinculos : []).map(String)
            .filter((v) => v.startsWith(`${modulo}:`)).map((v) => v.slice(modulo.length + 1)))];
    return ids.length === 1 ? { id: ids[0] } : { falta: ids.length ? 'varios' : 'nenhum' };
}
//# sourceMappingURL=situacaoRegistro.js.map