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
exports.numeroParagrafo = exports.margens = exports.layoutDe = exports.FORMATOS_LISTA = exports.MARCADORES = exports.FORMATOS_TITULO = exports.FORMATOS_PARAGRAFO = exports.ESTILOS_PADRAO = exports.CHAVES_ESTILO = exports.TOKEN_PAGINA = exports.faixaNaPagina = exports.DISTANCIA_FAIXA = exports.TAMANHO_NUMERO = exports.FORMATOS_NUMERO = exports.POSICOES_NUMERO = exports.PAGINAS_FAIXA = exports.MODOS_FAIXA = exports.MARGENS_PADRAO = exports.PAPEIS = void 0;
exports.textoNumero = textoNumero;
exports.trocarPagina = trocarPagina;
exports.sanitizeLayout = sanitizeLayout;
exports.folha = folha;
exports.estiloDoBloco = estiloDoBloco;
exports.marcadorLista = marcadorLista;
exports.numerosAutomaticos = numerosAutomaticos;
/**
 * Formatação de página e de estilos do documento do editor (como "Configurar
 * página" e "Estilos" do Word). Fica em `doc.attrs.layout`, viaja com o texto
 * (modelo → minuta → PDF dos autos → .docx) e é opcional: documento sem layout
 * sai exatamente como antes. Sem dependência do Firebase, para testar direto.
 */
const documento_1 = require("./documento");
/** Papel em cm (largura × altura, em retrato). */
exports.PAPEIS = {
    A4: { nome: 'A4 (21 × 29,7 cm)', w: 21, h: 29.7 },
    oficio: { nome: 'Ofício (21,6 × 33 cm)', w: 21.6, h: 33 },
    carta: { nome: 'Carta (21,6 × 27,9 cm)', w: 21.59, h: 27.94 },
    A5: { nome: 'A5 (14,8 × 21 cm)', w: 14.8, h: 21 },
};
/** Margens de sempre do SIGO: as do PDF dos autos desde o início. */
exports.MARGENS_PADRAO = { sup: 2.5, inf: 2.2, esq: 3, dir: 2 };
exports.MODOS_FAIXA = ['unidade', 'proprio', 'nenhum'];
exports.PAGINAS_FAIXA = ['todas', 'primeira', 'demais'];
exports.POSICOES_NUMERO = ['rodape-direita', 'rodape-centro', 'rodape-esquerda', 'cabecalho-direita', 'cabecalho-centro', 'cabecalho-esquerda', 'nenhum'];
exports.FORMATOS_NUMERO = ['pagina-de', 'pagina', 'n', 'n-de', 'traco'];
/** Tamanho do número de página de sempre (pt). */
exports.TAMANHO_NUMERO = 7.5;
/** Distância do cabeçalho à borda de cima e do rodapé à de baixo (cm), como no Word. */
exports.DISTANCIA_FAIXA = 1.25;
/** Texto do número da página no formato escolhido. */
function textoNumero(formato, n, total) {
    if (formato === 'pagina')
        return `Página ${n}`;
    if (formato === 'n')
        return String(n);
    if (formato === 'n-de')
        return `${n}/${total}`;
    if (formato === 'traco')
        return `– ${n} –`;
    return `Página ${n} de ${total}`;
}
/** A faixa aparece nesta página? */
const faixaNaPagina = (f, primeira) => !(f === null || f === void 0 ? void 0 : f.paginas) || f.paginas === 'todas' || (f.paginas === 'primeira') === primeira;
exports.faixaNaPagina = faixaNaPagina;
/** {{pagina}} e {{paginas}} nos textos do cabeçalho/rodapé próprio. */
exports.TOKEN_PAGINA = /\{\{\s*(pagina|paginas)\s*\}\}/g;
function trocarPagina(nos, n, total) {
    const andar = (x) => (x.type === 'text' && x.text
        ? Object.assign(Object.assign({}, x), { text: x.text.replace(exports.TOKEN_PAGINA, (_m, k) => String(k === 'paginas' ? total : n)) }) : x.content ? Object.assign(Object.assign({}, x), { content: x.content.map(andar) }) : x);
    return (nos || []).map(andar);
}
/** Conteúdo próprio passa pela mesma lista fechada do documento. */
function limparConteudo(v) {
    if (!Array.isArray(v) || !v.length)
        return undefined;
    const d = (0, documento_1.sanitizeDoc)({ type: 'doc', content: v.slice(0, 60) });
    const vazio = (d.content || []).every((b) => b.type === 'paragraph' && !b.content);
    return vazio ? undefined : d.content;
}
function sanitizeFaixa(v) {
    if (!v || typeof v !== 'object')
        return undefined;
    const o = v;
    const f = {};
    if (exports.MODOS_FAIXA.includes(String(o.modo)) && o.modo !== 'unidade')
        f.modo = o.modo;
    // O texto próprio fica guardado mesmo com outro modo: voltar a ele não perde nada.
    const c = limparConteudo(o.conteudo);
    if (c)
        f.conteudo = c;
    if (exports.PAGINAS_FAIXA.includes(String(o.paginas)) && o.paginas !== 'todas')
        f.paginas = o.paginas;
    return Object.keys(f).length ? f : undefined;
}
function sanitizeNumero(v) {
    if (!v || typeof v !== 'object')
        return undefined;
    const o = v;
    const n = {};
    if (exports.POSICOES_NUMERO.includes(String(o.posicao)) && o.posicao !== 'rodape-direita')
        n.posicao = String(o.posicao);
    if (exports.FORMATOS_NUMERO.includes(String(o.formato)) && o.formato !== 'pagina-de')
        n.formato = String(o.formato);
    const t = num(o.tamanho, 6, 16, 1);
    if (t !== undefined && t !== exports.TAMANHO_NUMERO)
        n.tamanho = t;
    if (o.primeira === false)
        n.primeira = false;
    return Object.keys(n).length ? n : undefined;
}
exports.CHAVES_ESTILO = ['normal', 'h1', 'h2', 'h3', 'h4', 'citacao'];
/** Como os estilos saem quando o documento não muda nada (o de sempre). */
exports.ESTILOS_PADRAO = {
    normal: { antes: 0, depois: 6 },
    h1: { tamanho: 18, negrito: true, antes: 8, depois: 6 },
    h2: { tamanho: 15, negrito: true, antes: 8, depois: 6 },
    h3: { tamanho: 13, negrito: true, antes: 8, depois: 6 },
    h4: { tamanho: 12, negrito: true, antes: 8, depois: 6 },
    citacao: { antes: 0, depois: 6 },
};
exports.FORMATOS_PARAGRAFO = ['1.', '1)', '1 –', '1º'];
exports.FORMATOS_TITULO = ['', 'decimal', 'romano'];
var documento_2 = require("./documento");
Object.defineProperty(exports, "MARCADORES", { enumerable: true, get: function () { return documento_2.MARCADORES; } });
Object.defineProperty(exports, "FORMATOS_LISTA", { enumerable: true, get: function () { return documento_2.FORMATOS_LISTA; } });
const num = (v, min, max, casas = 2) => {
    const n = typeof v === 'number' ? v : Number.NaN;
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10 ** casas) / 10 ** casas : undefined;
};
const cor = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined);
const sim = (v) => (v === true ? true : v === false ? false : undefined);
function sanitizeEstilo(v) {
    if (!v || typeof v !== 'object')
        return undefined;
    const o = v;
    const e = {
        fonte: documento_1.FONTES[String(o.fonte)] ? String(o.fonte) : undefined,
        tamanho: num(o.tamanho, 6, 96, 1),
        negrito: sim(o.negrito),
        italico: sim(o.italico),
        sublinhado: sim(o.sublinhado),
        maiusculas: sim(o.maiusculas),
        cor: cor(o.cor),
        alinhamento: ['left', 'center', 'right', 'justify'].includes(String(o.alinhamento)) ? o.alinhamento : undefined,
        recuo: num(o.recuo, 0, 5),
        margemEsq: num(o.margemEsq, 0, 10),
        margemDir: num(o.margemDir, 0, 10),
        espacamento: num(o.espacamento, 0.8, 3),
        antes: num(o.antes, 0, 72, 1),
        depois: num(o.depois, 0, 72, 1),
    };
    for (const k of Object.keys(e))
        if (e[k] === undefined)
            delete e[k];
    return Object.keys(e).length ? e : undefined;
}
/** Lista fechada do layout; devolve undefined quando nada difere do padrão. */
function sanitizeLayout(v) {
    if (!v || typeof v !== 'object')
        return undefined;
    const o = v;
    const l = {};
    if (exports.PAPEIS[String(o.papel)] && o.papel !== 'A4')
        l.papel = String(o.papel);
    if (o.orientacao === 'paisagem')
        l.orientacao = 'paisagem';
    const m = o.margens;
    if (m && typeof m === 'object') {
        const mm = { sup: num(m.sup, 0.5, 8), inf: num(m.inf, 0.5, 8), esq: num(m.esq, 0.5, 8), dir: num(m.dir, 0.5, 8) };
        if (Object.values(mm).every((x) => x !== undefined)) {
            const ok = mm;
            if (Object.keys(exports.MARGENS_PADRAO).some((k) => ok[k] !== exports.MARGENS_PADRAO[k]))
                l.margens = ok;
        }
    }
    const est = o.estilos;
    if (est && typeof est === 'object') {
        const out = {};
        for (const k of exports.CHAVES_ESTILO) {
            const e = sanitizeEstilo(est[k]);
            if (e)
                out[k] = e;
        }
        if (Object.keys(out).length)
            l.estilos = out;
    }
    if (Array.isArray(o.proprios)) {
        const vistos = new Set();
        const lista = o.proprios.slice(0, 30).map((p) => {
            const x = (p && typeof p === 'object' ? p : {});
            const id = String(x.id || '');
            const nome = String(x.nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            if (!/^[a-z0-9-]{1,30}$/.test(id) || !nome || vistos.has(id))
                return null;
            vistos.add(id);
            return Object.assign({ id, nome }, (sanitizeEstilo(x) || {}));
        }).filter(Boolean);
        if (lista.length)
            l.proprios = lista;
    }
    if (exports.FORMATOS_TITULO.includes(String(o.numeracao_titulos)) && o.numeracao_titulos)
        l.numeracao_titulos = String(o.numeracao_titulos);
    if (exports.FORMATOS_PARAGRAFO.includes(String(o.numeracao_paragrafos)) && o.numeracao_paragrafos !== '1.')
        l.numeracao_paragrafos = String(o.numeracao_paragrafos);
    const cab = sanitizeFaixa(o.cabecalho);
    if (cab)
        l.cabecalho = cab;
    const rod = sanitizeFaixa(o.rodape);
    if (rod)
        l.rodape = rod;
    const np = sanitizeNumero(o.numero_pagina);
    if (np)
        l.numero_pagina = np;
    return Object.keys(l).length ? l : undefined;
}
const layoutDe = (doc) => { var _a; return (((_a = doc === null || doc === void 0 ? void 0 : doc.attrs) === null || _a === void 0 ? void 0 : _a.layout) || {}); };
exports.layoutDe = layoutDe;
/** Tamanho da folha em cm, já virada se for paisagem. */
function folha(l) {
    const p = exports.PAPEIS[l.papel || 'A4'] || exports.PAPEIS.A4;
    return l.orientacao === 'paisagem' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
const margens = (l) => l.margens || exports.MARGENS_PADRAO;
exports.margens = margens;
/**
 * Estilo do bloco: padrão do SIGO, depois o do documento, depois o estilo
 * próprio (por cima do Normal). O que estiver no parágrafo vale mais (quem
 * desenha aplica por cima).
 */
function estiloDoBloco(l, n, dentroDeCitacao = false) {
    var _a, _b, _c, _d;
    const chave = n.type === 'heading' ? `h${Math.min(4, Math.max(1, Number((_a = n.attrs) === null || _a === void 0 ? void 0 : _a.level) || 1))}` : dentroDeCitacao ? 'citacao' : 'normal';
    const base = Object.assign(Object.assign({}, exports.ESTILOS_PADRAO[chave]), (((_b = l.estilos) === null || _b === void 0 ? void 0 : _b[chave]) || {}));
    const proprio = n.type === 'paragraph' && ((_c = n.attrs) === null || _c === void 0 ? void 0 : _c.estilo) ? (_d = l.proprios) === null || _d === void 0 ? void 0 : _d.find((p) => p.id === n.attrs.estilo) : undefined;
    if (!proprio)
        return base;
    const { id: _id, nome: _nome } = proprio, e = __rest(proprio, ["id", "nome"]);
    return Object.assign(Object.assign({}, base), e);
}
const romano = (n) => {
    const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of t)
        while (n >= v) {
            s += r;
            n -= v;
        }
    return s;
};
const numeroParagrafo = (n, formato = '1.') => (formato === '1)' ? `${n})` : formato === '1 –' ? `${n} –` : formato === '1º' ? `${n}º` : `${n}.`);
exports.numeroParagrafo = numeroParagrafo;
/** Marcador da lista numerada (1, a, A, i, I) com o separador. */
function marcadorLista(n, formato = 'decimal', sep = '.') {
    const letra = (k) => { let s = ''; for (let x = k; x > 0; x = Math.floor((x - 1) / 26))
        s = String.fromCharCode(97 + ((x - 1) % 26)) + s; return s; };
    const v = formato === 'lower-alpha' ? letra(n) : formato === 'upper-alpha' ? letra(n).toUpperCase() : formato === 'lower-roman' ? romano(n).toLowerCase() : formato === 'upper-roman' ? romano(n) : String(n);
    return `${v}${sep}`;
}
/**
 * Números automáticos de títulos e de parágrafos numerados, na ordem do
 * documento (o mesmo que o editor mostra com contadores do CSS).
 */
function numerosAutomaticos(doc) {
    const l = (0, exports.layoutDe)(doc);
    const out = new Map();
    const t = [0, 0, 0, 0];
    let p = 0;
    const andar = (n) => {
        var _a, _b;
        if (n.type === 'heading' && l.numeracao_titulos) {
            const nivel = Math.min(4, Math.max(1, Number((_a = n.attrs) === null || _a === void 0 ? void 0 : _a.level) || 1)) - 1;
            t[nivel]++;
            for (let i = nivel + 1; i < 4; i++)
                t[i] = 0;
            if (l.numeracao_titulos === 'romano') {
                out.set(n, nivel === 0 ? `${romano(t[0])}.` : `${t.slice(1, nivel + 1).join('.')}.`);
            }
            else
                out.set(n, `${t.slice(0, nivel + 1).join('.')}.`);
        }
        else if (n.type === 'paragraph' && ((_b = n.attrs) === null || _b === void 0 ? void 0 : _b.numerado) === true) {
            out.set(n, (0, exports.numeroParagrafo)(++p, l.numeracao_paragrafos));
        }
        for (const c of n.content || [])
            andar(c);
    };
    andar(doc);
    return out;
}
//# sourceMappingURL=layoutDocumento.js.map