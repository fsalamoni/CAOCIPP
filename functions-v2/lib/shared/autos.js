"use strict";
/**
 * Eventos e autos do processo: o que é ato de usuário (gera termo de uma
 * folha) e o que é registro do sistema (sai reunido num extrato), e a seleção
 * de partes dos autos para o PDF. Lógica pura, sem Firebase.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODOS_SELECAO = exports.geraTermo = exports.documentoDoEvento = exports.visivelParaPartes = exports.MOVIMENTOS_INTERNOS = exports.TIPOS_SISTEMA = void 0;
exports.origemEvento = origemEvento;
exports.tituloEvento = tituloEvento;
exports.folhasDoEvento = folhasDoEvento;
exports.extrasDoEvento = extrasDoEvento;
exports.urgentesPrimeiro = urgentesPrimeiro;
exports.sanitizeSelecao = sanitizeSelecao;
exports.selecionar = selecionar;
/** Registros de controle interno ou automáticos: não geram termo próprio. */
exports.TIPOS_SISTEMA = ['atribuicao', 'acao_fase', 'orientacao_concluida', 'convite'];
/**
 * usuario: ato do processo (termo com folha, salvo se juntou documento);
 * interno: ato que o rito manda deixar fora dos autos (`dados.interno`);
 * sistema: controle interno ou automático. Ação da fase marcada como
 * "certidão nos autos" no rito (`dados.nos_autos`) é ato de usuário.
 */
function origemEvento(m) {
    var _a, _b, _c;
    if (((_a = m.dados) === null || _a === void 0 ? void 0 : _a.interno) === true)
        return 'interno';
    if (m.tipo === 'acao_fase' && ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.nos_autos) === true)
        return 'usuario';
    return exports.TIPOS_SISTEMA.includes(m.tipo) || ((_c = m.dados) === null || _c === void 0 ? void 0 : _c.automatico) === true ? 'sistema' : 'usuario';
}
/** Movimentos que o portal nunca mostra às partes (além dos marcados `visivel_partes: false`). */
exports.MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia', 'acao_fase', 'orientacao_concluida', 'guarda', 'efeitos_fase'];
/** A parte vê o evento? Registros internos e de controle, não; certidão de ação no rito, sim. */
const visivelParaPartes = (m) => {
    var _a, _b;
    return ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false && origemEvento(m) !== 'interno'
        // Pendência aberta à mão é assunto entre a equipe e o decisor, mesmo com termo nos autos.
        && (!exports.MOVIMENTOS_INTERNOS.includes(m.tipo) || (m.tipo === 'acao_fase' && ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.nos_autos) === true));
};
exports.visivelParaPartes = visivelParaPartes;
/** Id do documento que o evento juntou aos autos (juntada, petição). */
const documentoDoEvento = (m) => { var _a, _b; return (typeof ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.documento_id) === 'string' && typeof ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.ordem) === 'number' ? m.dados.documento_id : null); };
exports.documentoDoEvento = documentoDoEvento;
/** Ato de usuário sem documento: a página dele é o termo. */
const geraTermo = (m) => origemEvento(m) === 'usuario' && !(0, exports.documentoDoEvento)(m);
exports.geraTermo = geraTermo;
const TITULOS = {
    autuacao: 'Termo de autuação',
    tramitacao: 'Termo de remessa',
    conclusao: 'Termo de conclusão',
    fase: 'Certidão de mudança de fase',
    situacao: 'Certidão de mudança de situação',
    pendencia: 'Certidão de pendência',
    pendencia_resolvida: 'Certidão de apreciação',
    prazo: 'Certidão de abertura de prazo',
    prazo_encerrado: 'Certidão de encerramento de prazo',
    habilitacao: 'Termo de habilitação',
    acesso_revogado: 'Certidão de revogação de acesso',
    dados: 'Certidão de alteração de dados',
    urgencia: 'Certidão de urgência',
    comunicacao: 'Certidão de comunicação',
    ciencia: 'Termo de ciência',
    ciencia_decurso: 'Certidão de ciência por decurso',
    comunicacao_sem_efeito: 'Certidão de comunicação sem efeito',
    juntada: 'Juntada de documento',
    peticao: 'Petição',
    atribuicao: 'Atribuição',
    acao_fase: 'Ação da fase',
    orientacao_concluida: 'Orientação concluída',
    convite: 'Convite',
    guarda: 'Documento guardado fora dos autos',
    exclusao: 'Termo de exclusão',
    restauracao: 'Termo de restauração',
    certidao_fase: 'Certidão conjunta',
    efeitos_fase: 'O que a fase fez sozinha',
};
function tituloEvento(m) {
    var _a, _b, _c;
    if (m.tipo === 'acao_fase' && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.nos_autos) === true)
        return 'Certidão de cumprimento';
    if (m.tipo === 'certidao_fase' && typeof ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.titulo) === 'string' && m.dados.titulo)
        return m.dados.titulo;
    const t = TITULOS[m.tipo] || 'Certidão';
    // Fora dos autos não há termo nem certidão: "Termo de remessa" vira "Remessa (registro interno)".
    if (((_c = m.dados) === null || _c === void 0 ? void 0 : _c.interno) !== true)
        return t;
    const ato = t.replace(/^(Certidão|Termo) de /, '');
    return `${ato.charAt(0).toUpperCase()}${ato.slice(1)} (registro interno)`;
}
/** Folhas que o evento ocupa nos autos: as do documento juntado ou a do termo. */
function folhasDoEvento(m, docs) {
    const id = (0, exports.documentoDoEvento)(m);
    if (id) {
        const d = docs.get(id);
        const ini = d === null || d === void 0 ? void 0 : d.folha_inicial;
        return typeof ini === 'number' ? [ini, typeof (d === null || d === void 0 ? void 0 : d.folha_final) === 'number' ? d.folha_final : ini] : null;
    }
    return typeof m.folha === 'number' ? [m.folha, m.folha] : null;
}
/** O que a tela precisa saber de cada evento, além do movimento gravado. */
function extrasDoEvento(m, docs) {
    return { origem: origemEvento(m), titulo: tituloEvento(m), folhas: folhasDoEvento(m, docs), documento_id: (0, exports.documentoDoEvento)(m) };
}
/** Urgentes primeiro, mantendo a ordem que a lista já tinha. */
function urgentesPrimeiro(lista) {
    return [...lista.filter((x) => x.urgente === true), ...lista.filter((x) => x.urgente !== true)];
}
exports.MODOS_SELECAO = ['integral', 'exceto', 'apenas', 'intervalo'];
const MAX_EVENTOS = 5000;
function sanitizeSelecao(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const modo = exports.MODOS_SELECAO.includes(String(r.modo)) ? r.modo : 'integral';
    const eventos = Array.isArray(r.eventos)
        ? [...new Set(r.eventos.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_EVENTOS) : [];
    const s = { modo, eventos, capa: r.capa !== false, indice: r.indice !== false };
    if (modo === 'apenas' && !eventos.length)
        throw new Error('Marque ao menos um evento para gerar o PDF');
    if (modo === 'intervalo') {
        const de = Number(r.folha_de), a = Number(r.folha_a);
        if (!Number.isInteger(de) || !Number.isInteger(a) || de < 1 || a < de)
            throw new Error('Informe o intervalo de folhas: a primeira e a última');
        s.folha_de = de;
        s.folha_a = a;
    }
    return s;
}
/**
 * Eventos que entram no PDF. No intervalo de folhas, só os que têm folha
 * dentro dele; `recorte` devolve as folhas a manter de cada evento.
 */
function selecionar(movs, docs, s) {
    const marcados = new Set(s.eventos);
    const incluidos = new Set();
    const recorte = new Map();
    for (const m of movs) {
        if (s.modo === 'integral' || (s.modo === 'exceto' && !marcados.has(m.seq)) || (s.modo === 'apenas' && marcados.has(m.seq)))
            incluidos.add(m.seq);
        if (s.modo !== 'intervalo')
            continue;
        const f = folhasDoEvento(m, docs);
        if (!f || f[1] < s.folha_de || f[0] > s.folha_a)
            continue;
        incluidos.add(m.seq);
        recorte.set(m.seq, [Math.max(f[0], s.folha_de), Math.min(f[1], s.folha_a)]);
    }
    return { incluidos, recorte };
}
//# sourceMappingURL=autos.js.map