"use strict";
/**
 * Eventos e autos do processo: o que é ato de usuário (gera termo de uma
 * folha) e o que é registro do sistema (sai reunido num extrato), e a seleção
 * de partes dos autos para o PDF. Lógica pura, sem Firebase.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentoInterno = exports.registroInterno = exports.MAX_DOCS_INTERNOS = exports.MODOS_SELECAO = exports.numeroDoEvento = exports.geraTermo = exports.podeFicarSemEfeito = exports.documentoDoEvento = exports.visivelParaPartes = exports.documentoVisivel = exports.polosQueVeem = exports.MOVIMENTOS_INTERNOS = exports.TIPOS_SISTEMA = void 0;
exports.origemEvento = origemEvento;
exports.polosEscolhidos = polosEscolhidos;
exports.podeExcluirDosAutos = podeExcluirDosAutos;
exports.eventosSemEfeito = eventosSemEfeito;
exports.tituloEvento = tituloEvento;
exports.folhasDoEvento = folhasDoEvento;
exports.numerarEventos = numerarEventos;
exports.extrasDoEvento = extrasDoEvento;
exports.urgentesPrimeiro = urgentesPrimeiro;
exports.sanitizeSelecao = sanitizeSelecao;
exports.sanitizeSelecaoInterna = sanitizeSelecaoInterna;
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
exports.MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia', 'acao_fase', 'orientacao_concluida', 'guarda', 'efeitos_fase', 'rito_atualizado'];
/** A parte vê o evento? Registros internos e de controle, não; certidão de ação no rito, sim. */
/** Polos que veem o item no portal, quando ele é restrito a alguns (null = todos os polos). */
const polosQueVeem = (x) => {
    const l = Array.isArray(x === null || x === void 0 ? void 0 : x.visivel_polos) ? x.visivel_polos.filter((p) => typeof p === 'string' && !!p) : [];
    return l.length ? l : null;
};
exports.polosQueVeem = polosQueVeem;
/** Saneia a escolha de "quem vê": só polos que o processo tem; todos (ou nenhum) = sem restrição. */
function polosEscolhidos(bruto, polosDoProcesso) {
    const l = [...new Set((Array.isArray(bruto) ? bruto : []).filter((p) => typeof p === 'string' && polosDoProcesso.includes(p)))];
    return l.length && l.length < new Set(polosDoProcesso).size ? l : null;
}
/** O polo vê o documento juntado? (fora do portal, ninguém; restrito, só os polos indicados) */
const documentoVisivel = (d, polo) => {
    if (d.visivel_partes === false)
        return false;
    const so = (0, exports.polosQueVeem)(d);
    return !so || (!!polo && so.includes(polo));
};
exports.documentoVisivel = documentoVisivel;
/**
 * A parte vê o evento? Com `polo`, responde para aquele polo; sem ele, só é
 * visível o que todos os polos veem (o "último andamento" e os avisos gerais
 * nunca levam o que é restrito a um polo).
 */
const visivelParaPartes = (m, polo) => {
    var _a, _b;
    return (!(0, exports.polosQueVeem)(m.dados) || (!!polo && (0, exports.polosQueVeem)(m.dados).includes(polo)))
        && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false && origemEvento(m) !== 'interno'
        // Pendência aberta à mão é assunto entre a equipe e o decisor, mesmo com termo nos autos.
        && (!exports.MOVIMENTOS_INTERNOS.includes(m.tipo) || (m.tipo === 'acao_fase' && ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.nos_autos) === true));
};
exports.visivelParaPartes = visivelParaPartes;
/** Id do documento que o evento juntou aos autos (juntada, petição). */
const documentoDoEvento = (m) => { var _a, _b; return (typeof ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.documento_id) === 'string' && typeof ((_b = m.dados) === null || _b === void 0 ? void 0 : _b.ordem) === 'number' ? m.dados.documento_id : null); };
exports.documentoDoEvento = documentoDoEvento;
/**
 * Quem pode desentranhar um documento juntado ou tornar um ato sem efeito:
 * quem o praticou, o admin do órgão, o gestor da unidade onde foi praticado
 * (o admin delegado do órgão interno conta como gestor) e a unidade que
 * decide, enquanto está com o processo.
 */
function podeExcluirDosAutos(quem, ato) {
    return quem.isAdmin === true || quem.decisorComPosse === true
        || (!!ato.autor_uid && ato.autor_uid === quem.uid)
        || (!!ato.unidade_id && (quem.gestorDe || []).includes(String(ato.unidade_id)));
}
/** Atos que não se tornam sem efeito por certidão: mudam o estado do processo, têm caminho próprio ou já são a própria anulação. */
const SEM_EFEITO_NAO = ['autuacao', 'tramitacao', 'conclusao', 'fase', 'situacao', 'exclusao', 'restauracao', 'retificacao', 'desentranhamento', 'sem_efeito'];
/** O ato pode ficar sem efeito? Documento juntado sai por desentranhamento; registro do sistema não é ato de ninguém. */
const podeFicarSemEfeito = (m) => origemEvento(m) !== 'sistema' && !SEM_EFEITO_NAO.includes(m.tipo) && !(0, exports.documentoDoEvento)(m);
exports.podeFicarSemEfeito = podeFicarSemEfeito;
/** Eventos que outro evento tornou sem efeito: seq do alvo → seq da certidão. */
function eventosSemEfeito(movs) {
    var _a;
    const r = new Map();
    for (const m of movs)
        if (m.tipo === 'sem_efeito' && typeof ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.alvo_seq) === 'number')
            r.set(m.dados.alvo_seq, m.seq);
    return r;
}
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
    prazo_prorrogado: 'Certidão de prorrogação de prazo',
    prazo_devolvido: 'Certidão de devolução de prazo',
    habilitacao: 'Termo de habilitação',
    acesso_revogado: 'Certidão de revogação de acesso',
    dados: 'Certidão de alteração de dados',
    retificacao: 'Termo de retificação da autuação',
    urgencia: 'Certidão de urgência',
    comunicacao: 'Certidão de comunicação',
    ciencia: 'Termo de ciência',
    ciencia_decurso: 'Certidão de ciência por decurso',
    decurso_prazo: 'Certidão de decurso de prazo',
    comunicacao_sem_efeito: 'Certidão de comunicação sem efeito',
    juntada: 'Juntada de documento',
    peticao: 'Petição',
    atribuicao: 'Atribuição',
    acao_fase: 'Ação da fase',
    orientacao_concluida: 'Orientação concluída',
    convite: 'Convite',
    guarda: 'Documento guardado fora dos autos',
    exclusao: 'Termo de exclusão',
    desentranhamento: 'Termo de desentranhamento',
    sem_efeito: 'Certidão de ato sem efeito',
    restauracao: 'Termo de restauração',
    certidao_fase: 'Certidão conjunta',
    efeitos_fase: 'O que a fase fez sozinha',
    rito_atualizado: 'Certidão de atualização do rito',
    pauta: 'Certidão de inclusão em pauta',
    pauta_retirada: 'Certidão de retirada de pauta',
    vista: 'Certidão de pedido de vista',
    vista_devolvida: 'Certidão de devolução de vista',
    adiamento: 'Certidão de adiamento do julgamento',
    diligencia: 'Certidão de conversão em diligência',
    destaque: 'Certidão de destaque da sessão virtual',
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
/**
 * Número de cada evento, como se lê nos autos. Só o que todas as partes veem
 * ganha número inteiro, em sequência (1, 2, 3…): quem lê de fora não encontra
 * salto que sugira ato oculto ou excluído. O ato interno (registro da equipe,
 * do sistema, o que é restrito a um polo) ganha número subsidiário do último
 * evento público antes dele (5.1, 5.2…); antes do primeiro público, 0.1. O
 * registro "sem evento" (`oculto`) não tem número. A ordem e a cadeia de hash
 * continuam pelo `seq`, que não muda.
 */
function numerarEventos(movs) {
    var _a;
    const out = new Map();
    let pub = 0;
    let sub = 0;
    for (const m of [...movs].sort((a, b) => a.seq - b.seq)) {
        if (((_a = m.dados) === null || _a === void 0 ? void 0 : _a.oculto) === true)
            continue;
        if ((0, exports.visivelParaPartes)(m)) {
            pub += 1;
            sub = 0;
            out.set(m.seq, String(pub));
        }
        else {
            sub += 1;
            out.set(m.seq, `${pub}.${sub}`);
        }
    }
    return out;
}
/** Número do evento para mostrar (o subsidiário, o público ou, sem nenhum, o seq). */
const numeroDoEvento = (numeros, seq) => { var _a; return (_a = numeros === null || numeros === void 0 ? void 0 : numeros.get(seq)) !== null && _a !== void 0 ? _a : String(seq); };
exports.numeroDoEvento = numeroDoEvento;
/** O que a tela precisa saber de cada evento, além do movimento gravado. `numeros`: de numerarEventos, sobre todos os eventos do processo. */
function extrasDoEvento(m, docs, numeros, anulados) {
    var _a, _b, _c;
    const doc = (0, exports.documentoDoEvento)(m);
    const se = anulados === null || anulados === void 0 ? void 0 : anulados.get(m.seq);
    return Object.assign(Object.assign(Object.assign({ origem: origemEvento(m), titulo: tituloEvento(m), folhas: folhasDoEvento(m, docs), documento_id: doc, numero: numeros ? (_a = numeros.get(m.seq)) !== null && _a !== void 0 ? _a : null : String(m.seq) }, (doc && ((_b = docs.get(doc)) === null || _b === void 0 ? void 0 : _b.desentranhado) ? { desentranhado: true } : {})), (se !== undefined ? { sem_efeito: numeros ? (_c = numeros.get(se)) !== null && _c !== void 0 ? _c : null : String(se) } : {})), { pode_sem_efeito: (0, exports.podeFicarSemEfeito)(m) && se === undefined });
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
exports.MAX_DOCS_INTERNOS = 60;
function sanitizeSelecaoInterna(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const ids = (v) => [...new Set((Array.isArray(v) ? v : []).filter((x) => typeof x === 'string' && /^[\w-]{1,60}$/.test(x)))].slice(0, exports.MAX_DOCS_INTERNOS);
    const s = {
        registros: Array.isArray(r.registros) ? [...new Set(r.registros.filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_EVENTOS) : [],
        documentos: ids(r.documentos), versoes: ids(r.versoes),
    };
    if (!s.registros.length && !s.documentos.length && !s.versoes.length)
        throw new Error('Marque ao menos um registro ou documento para a impressão interna');
    return s;
}
/**
 * Registro que pode sair na impressão interna: tudo o que não é peça dos autos
 * (registro interno, de controle ou do sistema). O que o rito marcou "sem
 * evento" (`oculto`) não sai em impressão nenhuma.
 */
const registroInterno = (m) => { var _a; return origemEvento(m) !== 'usuario' && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.oculto) !== true; };
exports.registroInterno = registroInterno;
/** Documento que pode sair na impressão interna: minuta que a pessoa vê ou documento guardado fora dos autos. */
const documentoInterno = (d, minutaVisivel) => d.status === 'controle' || (d.status === 'minuta' && minutaVisivel);
exports.documentoInterno = documentoInterno;
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