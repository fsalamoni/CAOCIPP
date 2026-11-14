"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chaveDoRegistro = exports.MODULOS_SITUACAO = exports.SITUACOES = void 0;
exports.sanitizeSituacaoRegistro = sanitizeSituacaoRegistro;
exports.fasesDePaginaInvalidas = fasesDePaginaInvalidas;
exports.mudancasDaPagina = mudancasDaPagina;
exports.mudancasDaSituacao = mudancasDaSituacao;
exports.registroDoProcesso = registroDoProcesso;
// Situação do registro ligado ao processo (Consultas, Expedientes e páginas
// próprias), conduzida pelo rito: a fase diz em que coluna do quadro o
// registro fica quando o processo entra nela ou quando alguém o assume.
//
// Em Consultas e Expedientes a situação é derivada das datas preenchidas
// (`calculateStatus`). Mudar a situação é preencher a data da fase de destino
// e, na volta, apagar as datas das fases seguintes: a mesma regra do quadro
// (`handleDialogConfirm` e `rollbackByStatus` em KanbanBoard.jsx).
//
// Numa página própria a situação é a fase do registro (`phase`), e a mudança
// passa pelas regras de transição do tipo (`evaluatePhaseTransition`), como no
// quadro da página (`updateRecord`).
const transitions_1 = require("../customEntities/transitions");
const fields_1 = require("./fields");
exports.SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'];
exports.MODULOS_SITUACAO = ['consultas', 'expedientes', 'paginas'];
const ID_PAGINA = /^[A-Za-z0-9_-]{1,128}$/;
const CHAVE_FASE = /^[a-z][a-z0-9_]{0,39}$/; // mesma regra das fases do tipo (SLUG_RE em customEntities/schema.ts)
function sanitizeSituacaoRegistro(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const modulo = exports.MODULOS_SITUACAO.find((m) => m === r.modulo);
    if (!modulo)
        return null;
    const pagina = modulo === 'paginas' && typeof r.pagina === 'string' && ID_PAGINA.test(r.pagina) ? r.pagina : '';
    if (modulo === 'paginas' && !pagina)
        return null;
    const de = (v) => (modulo === 'paginas'
        ? (typeof v === 'string' && CHAVE_FASE.test(v) ? v : undefined)
        : exports.SITUACOES.find((s) => s === v));
    const entrar = de(r.ao_entrar);
    const assumir = de(r.ao_assumir);
    if (!entrar && !assumir)
        return null;
    return Object.assign(Object.assign(Object.assign({ modulo }, (pagina ? { pagina } : {})), (entrar ? { ao_entrar: entrar } : {})), (assumir ? { ao_assumir: assumir } : {}));
}
/** Chave do registro conduzido: uma por módulo e, nas páginas próprias, uma por página. */
const chaveDoRegistro = (s) => (s.modulo === 'paginas' ? `paginas:${s.pagina || ''}` : s.modulo);
exports.chaveDoRegistro = chaveDoRegistro;
/** Fases de páginas próprias que o rito cita e o tipo não tem (ou a página não existe). `tipos`: id -> tipo da página. */
function fasesDePaginaInvalidas(fases, tipos) {
    const erros = [];
    for (const f of fases) {
        const s = f.situacao_registro;
        if ((s === null || s === void 0 ? void 0 : s.modulo) !== 'paginas')
            continue;
        const tipo = tipos[String(s.pagina)];
        if (!tipo) {
            erros.push(`A fase "${f.nome || ''}" conduz o registro de uma página própria que não existe mais.`);
            continue;
        }
        const chaves = new Set((tipo.phases || []).map((p) => p.key));
        for (const alvo of [s.ao_entrar, s.ao_assumir]) {
            if (alvo && !chaves.has(alvo))
                erros.push(`A fase "${f.nome || ''}" manda o registro da página para a fase "${alvo}", que a página não tem.`);
        }
    }
    return erros;
}
/**
 * Página própria: o que gravar no registro para ele ir à fase `alvo`, pelas
 * regras de transição do tipo, com quem pratica o ato no processo. `motivo`: a
 * regra do tipo não deixa (campo faltando, aprovação de outra pessoa). `null`:
 * já está na fase.
 */
function mudancasDaPagina(tipo, doc, alvo, quem, hoje) {
    var _a, _b;
    const atual = String(doc.phase || '');
    if (atual === alvo)
        return null;
    const rotulo = (k) => { var _a; return ((_a = (tipo.phases || []).find((p) => p.key === k)) === null || _a === void 0 ? void 0 : _a.label) || k || 'sem fase'; };
    const valores = Object.assign({}, (doc.values && typeof doc.values === 'object' ? doc.values : {}));
    const r = (0, transitions_1.evaluatePhaseTransition)(tipo, atual, alvo, valores, quem);
    if (!r.allowed)
        return { motivo: r.reason || 'A regra da página não permite a mudança.', para: rotulo(alvo) };
    const fixos = ((_b = (_a = r.rule) === null || _a === void 0 ? void 0 : _a.on_success) === null || _b === void 0 ? void 0 : _b.set_fields) || [];
    for (const sf of fixos)
        valores[sf.field] = sf.value === 'now' ? hoje : sf.value;
    return { campos: Object.assign({ phase: alvo }, (fixos.length ? { values: valores } : {})), de: rotulo(atual), para: rotulo(alvo) };
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
function mudancasDaSituacao(doc, alvoPedido, hoje, quem) {
    const alvo = exports.SITUACOES.find((s) => s === alvoPedido);
    if (!alvo)
        return null;
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