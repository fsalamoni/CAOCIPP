"use strict";
// ============================================================================
// Ação da fase ligada a um campo do processo ("Vem do processo"). Quando o
// campo do tipo de processo já tem valor (na autuação, ao entrar na fase ou
// quando alguém o preenche depois), a ação se cumpre sozinha com esse valor;
// se o campo for apagado, a ação cumprida assim é desfeita; se mudar, é
// registrada de novo com o valor novo. Na volta, quem cumpre a ação à mão
// preenche o campo do processo que estava vazio.
//
// Lógica pura, sem importar ./exigencias (que importa este arquivo). Testada
// em test/doProcesso.test.js. O cliente tem o espelho em src/lib/doProcesso.js.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ligada = exports.chaveDoValor = exports.podeLigar = exports.camposParaLigar = exports.LIGAVEL = void 0;
exports.sanitizeDoProcesso = sanitizeDoProcesso;
exports.valorPeloProcesso = valorPeloProcesso;
exports.passosPeloProcesso = passosPeloProcesso;
exports.camposPelaAcao = camposPelaAcao;
/** O que a ação pede e que tipos de campo do processo servem para cumpri-la. 'confirmar': qualquer campo preenchido. */
exports.LIGAVEL = {
    confirmar: ['texto', 'texto_longo', 'numero', 'data', 'lista', 'multipla', 'sim_nao', 'registro'],
    texto: ['texto'],
    texto_longo: ['texto', 'texto_longo'],
    numero: ['numero'],
    data: ['data'],
    lista: ['lista'],
    sim_nao: ['sim_nao'],
};
/** Campo do formulário de uma ação: os tipos de campo do processo que o preenchem (registro fica de fora: o servidor relê o registro). */
const LIGAVEL_NO_FORM = {
    texto: ['texto'], texto_longo: ['texto', 'texto_longo'], numero: ['numero'], data: ['data'], lista: ['lista'], multipla: ['multipla'], sim_nao: ['sim_nao'],
};
// Id do campo do tipo, ou '@assunto' e '@descricao' (campos padrão do "Novo processo").
const ID = /^@?[\w-]{1,40}$/;
/**
 * Os campos que a ligação lê no processo: os do tipo e, como campos de texto,
 * o assunto ('@assunto') e a descrição ('@descricao').
 */
const camposParaLigar = (proc) => [
    ...(Array.isArray(proc.campos) ? proc.campos : []),
    { id: '@assunto', tipo: 'texto', rotulo: 'Assunto', valor: typeof proc.assunto === 'string' ? proc.assunto.trim() : '' },
    { id: '@descricao', tipo: 'texto_longo', rotulo: 'Descrição', valor: typeof proc.descricao === 'string' ? proc.descricao.trim() : '' },
];
exports.camposParaLigar = camposParaLigar;
/** A regra (já saneada no resto) pode vir do processo? */
const podeLigar = (r) => !(r === null || r === void 0 ? void 0 : r.documento) && ((r === null || r === void 0 ? void 0 : r.pede) === undefined || r.pede === 'formulario' || r.pede in exports.LIGAVEL);
exports.podeLigar = podeLigar;
/**
 * Saneia a ligação da ação ao campo do processo. Só o id do campo do tipo é
 * guardado (o rito serve a vários tipos: vale o campo com esse id no processo).
 * No formulário, a ligação é por campo dele, e só entre os que existem.
 */
function sanitizeDoProcesso(raw, regra) {
    if (!(0, exports.podeLigar)(regra))
        return {};
    if (regra.pede === 'formulario') {
        const bruto = (raw.do_processo_campos && typeof raw.do_processo_campos === 'object' ? raw.do_processo_campos : {});
        const ids = new Set((regra.campos || []).filter((c) => c.tipo in LIGAVEL_NO_FORM).map((c) => c.id));
        const mapa = Object.fromEntries(Object.entries(bruto).filter(([k, v]) => ids.has(k) && typeof v === 'string' && ID.test(v)));
        return Object.keys(mapa).length ? { do_processo_campos: mapa } : {};
    }
    return typeof raw.do_processo === 'string' && ID.test(raw.do_processo) ? { do_processo: raw.do_processo } : {};
}
const preenchido = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length);
const valorDoCampo = (campos, id) => campos.find((c) => c.id === id && preenchido(c.valor));
/** Chave estável do valor, para saber se mudou desde que a ação foi cumprida sozinha. */
const chaveDoValor = (v) => (v === undefined ? '' : JSON.stringify(v));
exports.chaveDoValor = chaveDoValor;
/**
 * O valor que cumpre a ação, lido dos campos do processo, ou undefined se não
 * dá (campo vazio, tipo que não combina, opção que a ação não tem, campo
 * obrigatório do formulário sem ligação). Na ação que só confirma, `true`.
 */
function valorPeloProcesso(r, campos) {
    if (!r)
        return undefined;
    if (r.pede === 'formulario') {
        const mapa = r.do_processo_campos || {};
        if (!Object.keys(mapa).length)
            return undefined;
        const out = {};
        for (const c of r.campos || []) {
            const alvo = mapa[c.id] ? valorDoCampo(campos, mapa[c.id]) : undefined;
            if (alvo && (LIGAVEL_NO_FORM[c.tipo] || []).includes(String(alvo.tipo))
                && (c.tipo !== 'lista' || (c.opcoes || []).includes(String(alvo.valor))))
                out[c.id] = alvo.valor;
            else if (c.obrigatorio)
                return undefined;
        }
        return Object.keys(out).length ? out : undefined;
    }
    if (!r.do_processo)
        return undefined;
    const pede = r.pede || 'confirmar';
    const alvo = valorDoCampo(campos, r.do_processo);
    if (!alvo || !(exports.LIGAVEL[pede] || []).includes(String(alvo.tipo)))
        return undefined;
    if (pede === 'confirmar')
        return true;
    if (pede === 'lista' && !(r.opcoes || []).includes(String(alvo.valor)))
        return undefined;
    return alvo.valor;
}
/** A ação está ligada a algum campo do processo? */
const ligada = (r) => !!r && (!!r.do_processo || Object.keys(r.do_processo_campos || {}).length > 0);
exports.ligada = ligada;
/**
 * O que o sistema faz agora na fase atual, um passo por ação ligada:
 * - não feita, valendo, sem recusa e com valor: cumpre (`feita: true`);
 * - cumprida sozinha e o campo ficou vazio: desfaz (`feita: false`);
 * - cumprida sozinha e o valor mudou: desfaz para cumprir de novo (o passo
 *   seguinte, na próxima leitura, cumpre com o novo).
 * `auto`: { idx: chave do valor } das cumpridas sozinhas nesta rodada.
 * `recusadas`: as que alguém desfez à mão (o sistema não as cumpre de novo
 * nesta rodada). `ativa(idx)`: a ação vale agora (condição atendida).
 */
function passosPeloProcesso(fase, campos, feitas, auto, recusadas, ativa) {
    const out = [];
    const feitasSet = new Set(feitas);
    ((fase === null || fase === void 0 ? void 0 : fase.acoes) || []).forEach((_a, i) => {
        var _b;
        const r = (_b = fase === null || fase === void 0 ? void 0 : fase.acoes_regras) === null || _b === void 0 ? void 0 : _b[i];
        if (!(0, exports.ligada)(r))
            return;
        const valor = valorPeloProcesso(r, campos);
        if (!feitasSet.has(i)) {
            if (valor !== undefined && !recusadas.includes(i) && ativa(i))
                out.push({ idx: i, feita: true, valor });
        }
        else if (String(i) in auto && (valor === undefined || (0, exports.chaveDoValor)(valor) !== auto[String(i)])) {
            out.push({ idx: i, feita: false });
        }
    });
    return out;
}
/**
 * Na volta: o que a ação cumprida à mão preenche nos campos do processo.
 * Só campo do tipo que existe, do mesmo tipo do dado e ainda vazio no
 * processo (nunca sobrescreve o que já foi informado).
 * `defs`: os campos do formulário do tipo de hoje.
 */
function camposPelaAcao(r, valor, campos, defs) {
    if (!r || valor === undefined || valor === null)
        return [];
    const pares = r.pede === 'formulario'
        ? Object.entries(r.do_processo_campos || {}).map(([k, alvo]) => { var _b; return [alvo, ((_b = (r.campos || []).find((c) => c.id === k)) === null || _b === void 0 ? void 0 : _b.tipo) || '', valor === null || valor === void 0 ? void 0 : valor[k]]; })
        : r.do_processo && r.pede && r.pede in exports.LIGAVEL && r.pede !== 'confirmar' ? [[r.do_processo, r.pede, valor]] : [];
    return pares.flatMap(([alvo, tipo, v]) => {
        const def = defs.find((d) => d.id === alvo);
        if (!def || def.tipo !== tipo || !preenchido(v) || valorDoCampo(campos, alvo))
            return [];
        if (def.tipo === 'lista' && !(def.opcoes || []).includes(String(v)))
            return [];
        return [{ def, valor: v }];
    });
}
//# sourceMappingURL=doProcesso.js.map