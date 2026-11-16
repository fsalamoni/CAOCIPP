"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatarNumero = formatarNumero;
exports.docxParaDoc = docxParaDoc;
// Bibliotecas carregadas só quando usadas (partida a frio das functions).
const jszip = () => require('jszip');
const documento_1 = require("../shared/documento");
const conversaoComum_1 = require("./conversaoComum");
/**
 * Word (.docx) → documento do editor, lendo o próprio XML do arquivo para
 * manter o que o mammoth descartava: fonte, tamanho, cor, marca-texto,
 * alinhamento, recuos, espaço antes e depois, entrelinha, listas (com a
 * numeração do Word), tabelas com células mescladas e larguras, bordas,
 * imagens (com tamanho e alinhamento), links, quebras de página, notas de
 * rodapé e caixas de texto. Estilos do documento (Normal, Título 1, estilo
 * de tabela) e fontes do tema entram na conta, como no Word. Alterações
 * controladas são aceitas (o inserido entra, o excluído sai).
 *
 * Não vêm (o editor não tem): cabeçalho e rodapé do arquivo (a minuta usa o
 * timbrado da unidade), paradas de tabulação, colunas de texto, formas e
 * comentários.
 */
const TWIP_CM = 567;
const LARGURA_UTIL_PX = 605;
const MAX_LINHAS_TABELA = 400;
const MAX_COLUNAS = 30;
const definidos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const mesclar = (...ps) => Object.assign({}, ...ps.map((p) => definidos(p || {})));
const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const REALCE = {
    yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080',
    darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080',
    lightGray: '#c0c0c0', black: '#000000',
};
function lerPPr(el) {
    var _a, _b, _c, _d;
    if (!el)
        return {};
    const ind = (0, conversaoComum_1.filho)(el, 'w:ind');
    const sp = (0, conversaoComum_1.filho)(el, 'w:spacing');
    const num = (0, conversaoComum_1.filho)(el, 'w:numPr');
    const ol = (0, conversaoComum_1.filho)(el, 'w:outlineLvl');
    return definidos({
        jc: ((_a = (0, conversaoComum_1.filho)(el, 'w:jc')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val')) || undefined,
        esq: n((_b = ind === null || ind === void 0 ? void 0 : ind.getAttribute('w:left')) !== null && _b !== void 0 ? _b : ind === null || ind === void 0 ? void 0 : ind.getAttribute('w:start')),
        primeira: n(ind === null || ind === void 0 ? void 0 : ind.getAttribute('w:firstLine')),
        deslocada: n(ind === null || ind === void 0 ? void 0 : ind.getAttribute('w:hanging')),
        antes: (sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:beforeAutospacing')) === '1' ? 14 * 20 : n(sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:before')),
        depois: (sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:afterAutospacing')) === '1' ? 14 * 20 : n(sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:after')),
        linha: n(sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:line')),
        regra: (sp === null || sp === void 0 ? void 0 : sp.getAttribute('w:lineRule')) || undefined,
        numId: num ? ((_c = (0, conversaoComum_1.filho)(num, 'w:numId')) === null || _c === void 0 ? void 0 : _c.getAttribute('w:val')) || undefined : undefined,
        ilvl: num ? n((_d = (0, conversaoComum_1.filho)(num, 'w:ilvl')) === null || _d === void 0 ? void 0 : _d.getAttribute('w:val')) : undefined,
        nivelTitulo: n(ol === null || ol === void 0 ? void 0 : ol.getAttribute('w:val')),
        quebraAntes: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:pageBreakBefore')),
        contextual: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:contextualSpacing')),
    });
}
function lerRPr(el, tema) {
    var _a, _b, _c, _d, _e, _f;
    if (!el)
        return {};
    const u = (_a = (0, conversaoComum_1.filho)(el, 'w:u')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val');
    const cor = (_b = (0, conversaoComum_1.filho)(el, 'w:color')) === null || _b === void 0 ? void 0 : _b.getAttribute('w:val');
    const shd = (_c = (0, conversaoComum_1.filho)(el, 'w:shd')) === null || _c === void 0 ? void 0 : _c.getAttribute('w:fill');
    const f = (0, conversaoComum_1.filho)(el, 'w:rFonts');
    const fonte = f ? (f.getAttribute('w:ascii') || f.getAttribute('w:hAnsi') || tema[f.getAttribute('w:asciiTheme') || f.getAttribute('w:hAnsiTheme') || ''] || undefined) : undefined;
    const strike = (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:strike'));
    const dstrike = (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:dstrike'));
    return definidos({
        b: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:b')),
        i: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:i')),
        u: u === undefined || u === null ? ((0, conversaoComum_1.filho)(el, 'w:u') ? true : undefined) : u !== 'none',
        strike: strike === undefined && dstrike === undefined ? undefined : !!(strike || dstrike),
        vert: ((_d = (0, conversaoComum_1.filho)(el, 'w:vertAlign')) === null || _d === void 0 ? void 0 : _d.getAttribute('w:val')) || undefined,
        cor: cor && /^[0-9a-f]{6}$/i.test(cor) ? `#${cor.toLowerCase()}` : cor === 'auto' ? '' : undefined,
        realce: ((_e = (0, conversaoComum_1.filho)(el, 'w:highlight')) === null || _e === void 0 ? void 0 : _e.getAttribute('w:val')) || undefined,
        fundo: shd && /^[0-9a-f]{6}$/i.test(shd) ? `#${shd.toLowerCase()}` : shd === 'auto' ? '' : undefined,
        sz: n((_f = (0, conversaoComum_1.filho)(el, 'w:sz')) === null || _f === void 0 ? void 0 : _f.getAttribute('w:val')),
        fonte,
        caps: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:caps')),
        oculto: (0, conversaoComum_1.ligado)((0, conversaoComum_1.filho)(el, 'w:vanish')),
    });
}
function bordasDaTabela(tblPr) {
    const b = tblPr ? (0, conversaoComum_1.filho)(tblPr, 'w:tblBorders') : null;
    if (!b)
        return null;
    return (0, conversaoComum_1.filhos)(b).some((x) => !['nil', 'none'].includes(String(x.getAttribute('w:val'))));
}
/** Formata o número de um nível de lista (decimal, letra, romano). */
function formatarNumero(v, formato) {
    if (formato === 'lowerLetter' || formato === 'upperLetter') {
        let s = '';
        let x = v;
        while (x > 0) {
            x--;
            s = String.fromCharCode(97 + (x % 26)) + s;
            x = Math.floor(x / 26);
        }
        return formato === 'upperLetter' ? s.toUpperCase() : s;
    }
    if (formato === 'lowerRoman' || formato === 'upperRoman') {
        const tab = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
        let s = '';
        let x = v;
        for (const [k, r] of tab)
            while (x >= k) {
                s += r;
                x -= k;
            }
        return formato === 'upperRoman' ? s.toUpperCase() : s;
    }
    if (formato === 'ordinal')
        return `${v}º`;
    if (formato === 'decimalZero')
        return v < 10 ? `0${v}` : String(v);
    return String(v);
}
class Leitor {
    constructor(zip) {
        this.zip = zip;
        this.estilos = {};
        this.padraoP = {};
        this.padraoR = {};
        this.estiloParagrafo = '';
        this.tema = {};
        this.rels = {};
        this.niveis = {};
        this.contadores = {};
        this.notas = {};
        this.notasUsadas = [];
        this.avisos = new Set();
        this.imagens = (0, conversaoComum_1.novoOrcamento)();
    }
    async carregar() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const ler = async (p) => { var _a; return (await ((_a = this.zip.file(p)) === null || _a === void 0 ? void 0 : _a.async('string'))) || ''; };
        const temaXml = await ler('word/theme/theme1.xml');
        if (temaXml) {
            const t = (0, conversaoComum_1.xml)(temaXml);
            const maior = t.getElementsByTagName('a:majorFont')[0];
            const menor = t.getElementsByTagName('a:minorFont')[0];
            const latin = (e) => { var _a; return (e ? ((_a = (0, conversaoComum_1.filho)(e, 'a:latin')) === null || _a === void 0 ? void 0 : _a.getAttribute('typeface')) || '' : ''); };
            this.tema = { majorHAnsi: latin(maior), majorAscii: latin(maior), minorHAnsi: latin(menor), minorAscii: latin(menor) };
        }
        const relXml = await ler('word/_rels/document.xml.rels');
        if (relXml) {
            for (const r of Array.from((0, conversaoComum_1.xml)(relXml).getElementsByTagName('Relationship'))) {
                this.rels[String(r.getAttribute('Id'))] = { alvo: String(r.getAttribute('Target') || ''), externo: r.getAttribute('TargetMode') === 'External' };
            }
        }
        const estXml = await ler('word/styles.xml');
        if (estXml) {
            const d = (0, conversaoComum_1.xml)(estXml);
            const dd = d.getElementsByTagName('w:docDefaults')[0];
            if (dd) {
                this.padraoP = lerPPr(dd.getElementsByTagName('w:pPr')[0] || null);
                this.padraoR = lerRPr(dd.getElementsByTagName('w:rPr')[0] || null, this.tema);
            }
            for (const s of Array.from(d.getElementsByTagName('w:style'))) {
                const id = String(s.getAttribute('w:styleId'));
                const tblPr = (0, conversaoComum_1.filho)(s, 'w:tblPr');
                this.estilos[id] = {
                    tipo: String(s.getAttribute('w:type')), base: ((_a = (0, conversaoComum_1.filho)(s, 'w:basedOn')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val')) || undefined,
                    nome: String(((_b = (0, conversaoComum_1.filho)(s, 'w:name')) === null || _b === void 0 ? void 0 : _b.getAttribute('w:val')) || id), p: lerPPr((0, conversaoComum_1.filho)(s, 'w:pPr')), r: lerRPr((0, conversaoComum_1.filho)(s, 'w:rPr'), this.tema),
                    tblBordas: bordasDaTabela(tblPr), padrao: s.getAttribute('w:default') === '1',
                };
                if (this.estilos[id].padrao && this.estilos[id].tipo === 'paragraph')
                    this.estiloParagrafo = id;
            }
        }
        const numXml = await ler('word/numbering.xml');
        if (numXml) {
            const d = (0, conversaoComum_1.xml)(numXml);
            const abstratos = {};
            for (const a of Array.from(d.getElementsByTagName('w:abstractNum'))) {
                const niv = {};
                for (const l of (0, conversaoComum_1.filhos)(a, 'w:lvl')) {
                    niv[Number(l.getAttribute('w:ilvl'))] = {
                        formato: String(((_c = (0, conversaoComum_1.filho)(l, 'w:numFmt')) === null || _c === void 0 ? void 0 : _c.getAttribute('w:val')) || 'decimal'),
                        texto: String((_e = (_d = (0, conversaoComum_1.filho)(l, 'w:lvlText')) === null || _d === void 0 ? void 0 : _d.getAttribute('w:val')) !== null && _e !== void 0 ? _e : '%1.'),
                        inicio: (_g = n((_f = (0, conversaoComum_1.filho)(l, 'w:start')) === null || _f === void 0 ? void 0 : _f.getAttribute('w:val'))) !== null && _g !== void 0 ? _g : 1,
                        p: lerPPr((0, conversaoComum_1.filho)(l, 'w:pPr')),
                    };
                }
                abstratos[String(a.getAttribute('w:abstractNumId'))] = niv;
            }
            for (const num of Array.from(d.getElementsByTagName('w:num'))) {
                const base = abstratos[String((_h = (0, conversaoComum_1.filho)(num, 'w:abstractNumId')) === null || _h === void 0 ? void 0 : _h.getAttribute('w:val'))] || {};
                const niv = Object.assign({}, base);
                for (const o of (0, conversaoComum_1.filhos)(num, 'w:lvlOverride')) {
                    const ilvl = Number(o.getAttribute('w:ilvl'));
                    const ini = n((_j = (0, conversaoComum_1.filho)(o, 'w:startOverride')) === null || _j === void 0 ? void 0 : _j.getAttribute('w:val'));
                    if (niv[ilvl] && ini !== undefined)
                        niv[ilvl] = Object.assign(Object.assign({}, niv[ilvl]), { inicio: ini });
                }
                this.niveis[String(num.getAttribute('w:numId'))] = niv;
            }
        }
        for (const parte of ['word/footnotes.xml', 'word/endnotes.xml']) {
            const x = await ler(parte);
            if (!x)
                continue;
            for (const nota of [...Array.from((0, conversaoComum_1.xml)(x).getElementsByTagName('w:footnote')), ...Array.from((0, conversaoComum_1.xml)(x).getElementsByTagName('w:endnote'))]) {
                const tipo = nota.getAttribute('w:type');
                if (!tipo || tipo === 'normal')
                    this.notas[`${parte}:${nota.getAttribute('w:id')}`] = nota;
            }
        }
        const cab = Object.values(this.rels).some((r) => /^(header|footer)\d*\.xml$/.test(r.alvo));
        if (cab)
            this.avisos.add('O cabeçalho e o rodapé do arquivo não entram: a minuta usa o timbrado da unidade.');
    }
    cadeia(id, campo, vistos = new Set()) {
        const e = id ? this.estilos[id] : undefined;
        if (!e || vistos.has(id))
            return {};
        vistos.add(id);
        return mesclar(this.cadeia(e.base, campo, vistos), e[campo]);
    }
    nivelDeTitulo(estiloId, p) {
        const e = estiloId ? this.estilos[estiloId] : undefined;
        const nome = ((e === null || e === void 0 ? void 0 : e.nome) || '').toLowerCase();
        if (/^(title|t[ií]tulo)$/.test(nome))
            return 1;
        const m = nome.match(/^(heading|t[ií]tulo)\s*(\d)$/);
        if (m)
            return Math.min(4, Number(m[2]));
        if (p.nivelTitulo !== undefined && p.nivelTitulo < 9)
            return Math.min(4, p.nivelTitulo + 1);
        return null;
    }
    async corpo() {
        var _a, _b;
        const docXml = await ((_a = this.zip.file('word/document.xml')) === null || _a === void 0 ? void 0 : _a.async('string'));
        if (!docXml)
            throw new Error('Arquivo Word sem conteúdo (document.xml)');
        const body = (0, conversaoComum_1.xml)(docXml).getElementsByTagName('w:body')[0];
        if (!body)
            throw new Error('Arquivo Word sem corpo de texto');
        const itens = await this.blocos(body, {});
        const content = (0, conversaoComum_1.agruparListas)(itens);
        if (this.notasUsadas.length) {
            content.push({ type: 'horizontalRule' });
            for (const { n: numero, el } of this.notasUsadas) {
                const its = await this.blocos(el, {});
                const primeiros = (0, conversaoComum_1.agruparListas)(its);
                const p = ((_b = primeiros[0]) === null || _b === void 0 ? void 0 : _b.type) === 'paragraph' ? primeiros[0] : { type: 'paragraph', content: [] };
                p.content = [{ type: 'text', text: `${numero} `, marks: [{ type: 'superscript' }] }, ...(p.content || [])];
                content.push(p, ...primeiros.slice(primeiros[0] === p ? 1 : 0));
            }
        }
        const doc = (0, documento_1.sanitizeDoc)({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
        return { doc, avisos: [...this.avisos, ...this.imagens.avisos] };
    }
    async blocos(el, ctx) {
        const out = [];
        for (const c of (0, conversaoComum_1.filhos)(el)) {
            if (c.tagName === 'w:p')
                out.push(...await this.paragrafo(c, ctx));
            else if (c.tagName === 'w:tbl') {
                const t = await this.tabela(c);
                if (t)
                    out.push({ no: t });
            }
            else if (c.tagName === 'w:sdt') {
                const sc = (0, conversaoComum_1.filho)(c, 'w:sdtContent');
                if (sc)
                    out.push(...await this.blocos(sc, ctx));
            }
            else if (['w:customXml', 'w:ins', 'w:moveTo', 'w:smartTag'].includes(c.tagName))
                out.push(...await this.blocos(c, ctx));
            else if (c.tagName === 'w:altChunk')
                this.avisos.add('Parte do arquivo veio de outro documento embutido e não pôde ser lida.');
        }
        return out;
    }
    async paragrafo(el, ctx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var _l;
        const pPrEl = (0, conversaoComum_1.filho)(el, 'w:pPr');
        const direto = lerPPr(pPrEl);
        const estiloId = pPrEl ? ((_a = (0, conversaoComum_1.filho)(pPrEl, 'w:pStyle')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val')) || this.estiloParagrafo : this.estiloParagrafo;
        // Na tabela, o estilo da tabela vale sobre o estilo Normal (como o Word faz); estilo próprio do parágrafo vale sobre ele.
        const estiloPadrao = estiloId === this.estiloParagrafo;
        const pEstilo = this.cadeia(estiloId, 'p');
        const rEstilo = this.cadeia(estiloId, 'r');
        const pp = estiloPadrao
            ? mesclar(this.padraoP, pEstilo, (_b = ctx.tabela) === null || _b === void 0 ? void 0 : _b.p, direto)
            : mesclar(this.padraoP, (_c = ctx.tabela) === null || _c === void 0 ? void 0 : _c.p, pEstilo, direto);
        const rBase = estiloPadrao ? mesclar(this.padraoR, rEstilo, (_d = ctx.tabela) === null || _d === void 0 ? void 0 : _d.r) : mesclar(this.padraoR, (_e = ctx.tabela) === null || _e === void 0 ? void 0 : _e.r, rEstilo);
        const titulo = this.nivelDeTitulo(estiloId, pp);
        const out = [];
        if (pp.quebraAntes)
            out.push({ no: { type: 'pageBreak' } });
        // Numeração do Word: lista de verdade (marcador ou 1., 2., 3.) ou o número como texto (a), I -, 1.1).
        let prefixo = '';
        let lista;
        const numId = pp.numId && pp.numId !== '0' ? pp.numId : undefined;
        if (numId && this.niveis[numId]) {
            const ilvlWord = Math.max(0, Math.min(8, (_f = pp.ilvl) !== null && _f !== void 0 ? _f : 0));
            const niv = this.niveis[numId];
            const cont = ((_l = this.contadores)[numId] || (_l[numId] = []));
            for (let k = 0; k <= ilvlWord; k++)
                if (cont[k] === undefined)
                    cont[k] = ((_h = (_g = niv[k]) === null || _g === void 0 ? void 0 : _g.inicio) !== null && _h !== void 0 ? _h : 1) - 1;
            cont[ilvlWord] += 1;
            cont.length = ilvlWord + 1;
            const lv = niv[ilvlWord] || { formato: 'decimal', texto: '%1.', inicio: 1, p: {} };
            // Recuo do nível da lista vale sobre o do estilo; o direto do parágrafo, sobre os dois.
            for (const [k, v] of Object.entries(lv.p))
                if (direto[k] === undefined)
                    pp[k] = v;
            // Nível visual: o do Word ou o do recuo (listas "Marcador 2" do Word usam outra lista, não outro nível).
            const nivel = pp.esq !== undefined ? Math.round(pp.esq / 360) : ilvlWord * 2;
            if (lv.formato === 'bullet')
                lista = { chave: `${numId}:b`, ilvl: nivel, ordenada: false, inicio: 1 };
            else if (lv.formato !== 'none') {
                const simples = lv.formato === 'decimal' && lv.texto === `%${ilvlWord + 1}.` && !titulo;
                if (simples)
                    lista = { chave: `${numId}:o`, ilvl: nivel, ordenada: true, inicio: cont[ilvlWord] };
                else
                    prefixo = lv.texto.replace(/%(\d)/g, (_m, d) => { var _a, _b; return formatarNumero((_a = cont[Number(d) - 1]) !== null && _a !== void 0 ? _a : 1, ((_b = niv[Number(d) - 1]) === null || _b === void 0 ? void 0 : _b.formato) || 'decimal'); });
            }
        }
        const attrs = this.atributos(pp, !!lista, !!prefixo, rBase);
        const blocoTipo = titulo ? 'heading' : 'paragraph';
        const novo = () => ({ type: blocoTipo, attrs: Object.assign(Object.assign({}, attrs), (titulo ? { level: titulo } : {})), content: [] });
        // Um parágrafo do Word pode virar vários blocos: texto, imagem, quebra de página.
        let atual = novo();
        let emitiu = false;
        let listaUsada = false;
        const emitir = (it) => { out.push(it); emitiu = true; };
        const fechar = (forcar = false) => {
            if (atual.content.length || forcar) {
                if (!atual.content.length)
                    delete atual.content;
                emitir(lista && !listaUsada ? { no: atual, lista } : { no: atual });
                listaUsada = true;
            }
            atual = novo();
        };
        if (prefixo)
            atual.content.push(...this.texto(`${prefixo} `, rBase, []));
        await this.inline(el, rBase, [], {
            quebraPagina: () => { fechar(); emitir({ no: { type: 'pageBreak' } }); },
            bloco: (b) => { fechar(); emitir({ no: b }); },
            alinhamento: attrs.textAlign,
        }, () => atual);
        // Parágrafo vazio só com borda de baixo é a linha horizontal do Word ("---" + Enter).
        const borda = pPrEl ? (_j = (0, conversaoComum_1.filho)((0, conversaoComum_1.filho)(pPrEl, 'w:pBdr'), 'w:bottom')) === null || _j === void 0 ? void 0 : _j.getAttribute('w:val') : null;
        if (!emitiu && !atual.content.length && borda && !['nil', 'none'].includes(borda)) {
            emitir({ no: { type: 'horizontalRule' } });
            return out;
        }
        // Parágrafo vazio fica (é a linha em branco do Word); o que só tinha imagem, não.
        fechar(!emitiu);
        // Fim de seção (salvo a contínua) começa página nova no Word.
        const sect = pPrEl ? (0, conversaoComum_1.filho)(pPrEl, 'w:sectPr') : null;
        if (sect && ((_k = (0, conversaoComum_1.filho)(sect, 'w:type')) === null || _k === void 0 ? void 0 : _k.getAttribute('w:val')) !== 'continuous')
            out.push({ no: { type: 'pageBreak' } });
        return out;
    }
    atributos(pp, emLista, comPrefixo, r) {
        const a = {};
        const jc = pp.jc;
        if (jc === 'center')
            a.textAlign = 'center';
        else if (jc === 'right' || jc === 'end')
            a.textAlign = 'right';
        else if (jc === 'both' || jc === 'distribute' || jc === 'justify' || jc === 'lowKashida' || jc === 'mediumKashida' || jc === 'highKashida')
            a.textAlign = 'justify';
        const cm = (tw) => (tw === undefined ? 0 : Math.round((tw / TWIP_CM) * 100) / 100);
        if (!emLista) {
            // Com número no texto, o parágrafo começa onde o Word põe o número (recuo menos o deslocamento).
            const esq = cm((pp.esq || 0) - (comPrefixo ? pp.deslocada || 0 : 0));
            if (esq >= 0.05)
                a.margemEsq = Math.min(10, esq);
            const prim = cm(pp.primeira);
            if (prim >= 0.05 && !comPrefixo)
                a.recuo = Math.min(5, prim);
        }
        const pt = (tw) => Math.max(0, Math.min(72, Math.round(((tw || 0) / 20) * 10) / 10));
        a.antes = pp.contextual && emLista ? 0 : pt(pp.antes);
        a.depois = pp.contextual && emLista ? 0 : pt(pp.depois);
        if (pp.linha) {
            let ent = 1;
            if (!pp.regra || pp.regra === 'auto')
                ent = pp.linha / 240;
            else
                ent = (pp.linha / 20) / (((r.sz || 24) / 2) * 1.15);
            a.espacamento = Math.max(0.8, Math.min(3, Math.round(ent * 100) / 100));
        }
        else
            a.espacamento = 1;
        return a;
    }
    marcas(r, extra) {
        const m = [];
        if (r.b)
            m.push({ type: 'bold' });
        if (r.i)
            m.push({ type: 'italic' });
        if (r.u)
            m.push({ type: 'underline' });
        if (r.strike)
            m.push({ type: 'strike' });
        if (r.vert === 'superscript')
            m.push({ type: 'superscript' });
        if (r.vert === 'subscript')
            m.push({ type: 'subscript' });
        if (r.realce && REALCE[r.realce])
            m.push({ type: 'highlight', attrs: { color: REALCE[r.realce] } });
        const ts = {};
        if (r.cor)
            ts.color = r.cor;
        if (r.fundo && r.fundo !== '#ffffff')
            ts.backgroundColor = r.fundo;
        if (r.sz)
            ts.fontSize = `${Math.max(6, Math.min(96, Math.round(r.sz * 5) / 10))}pt`.replace('.0pt', 'pt');
        const f = (0, documento_1.fonteEquivalente)(r.fonte);
        if (f)
            ts.fontFamily = f;
        if (Object.keys(ts).length)
            m.push({ type: 'textStyle', attrs: ts });
        return [...m, ...extra];
    }
    texto(t, r, extra) {
        if (!t || r.oculto)
            return [];
        const marks = this.marcas(r, extra);
        const txt = r.caps ? t.toLocaleUpperCase('pt-BR') : t;
        return [marks.length ? { type: 'text', text: txt, marks } : { type: 'text', text: txt }];
    }
    /** Percorre runs, links, campos e alterações controladas, juntando o texto no parágrafo atual. */
    async inline(el, rBase, extra, cb, corrente, campo = { pilha: [] }) {
        var _a;
        // O parágrafo corrente muda depois de uma imagem ou quebra de página no meio do texto.
        const pos = (lista) => corrente().content.push(...lista);
        for (const c of (0, conversaoComum_1.filhos)(el)) {
            const tag = c.tagName;
            if (tag === 'w:pPr' || tag === 'w:del' || tag === 'w:moveFrom' || tag === 'w:commentRangeStart' || tag === 'w:bookmarkStart')
                continue;
            if (tag === 'w:hyperlink') {
                const rel = this.rels[String(c.getAttribute('r:id'))];
                const href = (rel === null || rel === void 0 ? void 0 : rel.externo) ? rel.alvo : '';
                await this.inline(c, rBase, /^(https?:|mailto:)/i.test(href) ? [...extra, { type: 'link', attrs: { href } }] : extra, cb, corrente, campo);
                continue;
            }
            if (['w:ins', 'w:moveTo', 'w:smartTag', 'w:customXml', 'w:fldSimple', 'w:dir', 'w:bdo'].includes(tag)) {
                let ex = extra;
                if (tag === 'w:fldSimple') {
                    const m = String(c.getAttribute('w:instr') || '').match(/HYPERLINK\s+"([^"]+)"/);
                    if (m && /^(https?:|mailto:)/i.test(m[1]))
                        ex = [...extra, { type: 'link', attrs: { href: m[1] } }];
                }
                await this.inline(c, rBase, ex, cb, corrente, campo);
                continue;
            }
            if (tag === 'w:sdt') {
                const sc = (0, conversaoComum_1.filho)(c, 'w:sdtContent');
                if (sc)
                    await this.inline(sc, rBase, extra, cb, corrente, campo);
                continue;
            }
            if (tag === 'mc:AlternateContent') {
                const ch = (0, conversaoComum_1.filho)(c, 'mc:Choice') || (0, conversaoComum_1.filho)(c, 'mc:Fallback');
                if (ch)
                    await this.inline(ch, rBase, extra, cb, corrente, campo);
                continue;
            }
            if (tag !== 'w:r')
                continue;
            const rPrEl = (0, conversaoComum_1.filho)(c, 'w:rPr');
            const estiloR = rPrEl ? (_a = (0, conversaoComum_1.filho)(rPrEl, 'w:rStyle')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val') : undefined;
            const r = mesclar(rBase, this.cadeia(estiloR || undefined, 'r'), lerRPr(rPrEl, this.tema));
            // Campos complexos: a instrução não aparece; o resultado sim (com link, se for HYPERLINK).
            for (const x of (0, conversaoComum_1.filhos)(c)) {
                const t = x.tagName;
                const topo = campo.pilha[campo.pilha.length - 1];
                const linkCampo = campo.pilha.map((y) => { var _a; return (_a = y.instr.match(/HYPERLINK\s+"([^"]+)"/)) === null || _a === void 0 ? void 0 : _a[1]; }).filter((h) => !!h && /^(https?:|mailto:)/i.test(h)).pop();
                const ex = linkCampo ? [...extra, { type: 'link', attrs: { href: linkCampo } }] : extra;
                if (t === 'w:fldChar') {
                    const tipo = x.getAttribute('w:fldCharType');
                    if (tipo === 'begin')
                        campo.pilha.push({ instr: '', resultado: false });
                    else if (tipo === 'separate' && campo.pilha.length)
                        campo.pilha[campo.pilha.length - 1].resultado = true;
                    else if (tipo === 'end')
                        campo.pilha.pop();
                    continue;
                }
                if (t === 'w:instrText') {
                    if (topo)
                        topo.instr += x.textContent || '';
                    continue;
                }
                if (topo && !topo.resultado)
                    continue;
                if (t === 'w:t')
                    pos(this.texto(x.textContent || '', r, ex));
                else if (t === 'w:tab')
                    pos(this.texto(' '.repeat(Math.max(2, Math.min(12, Math.round(36 / (((r.sz || 24) / 2) * 0.25))))), r, ex));
                else if (t === 'w:br') {
                    if (x.getAttribute('w:type') === 'page')
                        cb.quebraPagina();
                    else
                        pos([{ type: 'hardBreak' }]);
                }
                else if (t === 'w:cr')
                    pos([{ type: 'hardBreak' }]);
                else if (t === 'w:noBreakHyphen')
                    pos(this.texto('-', r, ex));
                else if (t === 'w:sym') {
                    const code = parseInt(String(x.getAttribute('w:char') || ''), 16);
                    const fonteSym = String(x.getAttribute('w:font') || '');
                    const ch = /symbol|wingdings/i.test(fonteSym) ? (code === 0xf0b7 || code === 0xf0a7 ? '•' : code === 0xf0fc ? '✓' : '') : Number.isFinite(code) ? String.fromCharCode(code) : '';
                    if (ch)
                        pos(this.texto(ch, r, ex));
                }
                else if (t === 'w:footnoteReference' || t === 'w:endnoteReference') {
                    const parte = t === 'w:footnoteReference' ? 'word/footnotes.xml' : 'word/endnotes.xml';
                    const nota = this.notas[`${parte}:${x.getAttribute('w:id')}`];
                    if (nota) {
                        const numero = this.notasUsadas.length + 1;
                        this.notasUsadas.push({ n: numero, el: nota });
                        pos(this.texto(String(numero), Object.assign(Object.assign({}, r), { vert: 'superscript' }), ex));
                    }
                }
                else if (t === 'w:drawing' || t === 'w:pict' || t === 'w:object' || t === 'mc:AlternateContent') {
                    await this.desenho(x, cb);
                }
            }
        }
    }
    /** Imagem (inline ou flutuante) e caixa de texto dentro de um desenho. */
    async desenho(el, cb) {
        var _a, _b;
        let alvo = el;
        if (el.tagName === 'mc:AlternateContent')
            alvo = (0, conversaoComum_1.filho)(el, 'mc:Choice') || (0, conversaoComum_1.filho)(el, 'mc:Fallback') || el;
        const caixas = Array.from(alvo.getElementsByTagName('w:txbxContent'));
        for (const cx of caixas)
            for (const it of (0, conversaoComum_1.agruparListas)(await this.blocos(cx, {})))
                cb.bloco(it);
        const blip = alvo.getElementsByTagName('a:blip')[0];
        const vml = alvo.getElementsByTagName('v:imagedata')[0];
        const rid = (blip === null || blip === void 0 ? void 0 : blip.getAttribute('r:embed')) || (vml === null || vml === void 0 ? void 0 : vml.getAttribute('r:id'));
        if (!rid)
            return;
        const rel = this.rels[rid];
        if (!rel || rel.externo)
            return;
        const caminho = rel.alvo.startsWith('/') ? rel.alvo.slice(1) : `word/${rel.alvo}`.replace(/[^/]+\/\.\.\//g, '');
        const buf = await ((_a = this.zip.file(caminho)) === null || _a === void 0 ? void 0 : _a.async('nodebuffer'));
        if (!buf)
            return;
        const ext = alvo.getElementsByTagName('wp:extent')[0];
        const cxEmu = Number(ext === null || ext === void 0 ? void 0 : ext.getAttribute('cx')) || 0;
        const largura = cxEmu ? Math.round(cxEmu / 9525) : null;
        const alt = String(((_b = alvo.getElementsByTagName('wp:docPr')[0]) === null || _b === void 0 ? void 0 : _b.getAttribute('descr')) || '').slice(0, 300);
        const img = await this.imagens.incluir(buf, caminho);
        if (!img)
            return;
        const w = Math.max(10, Math.min(LARGURA_UTIL_PX, largura || img.largura));
        const align = cb.alinhamento === 'center' || cb.alinhamento === 'right' ? cb.alinhamento : undefined;
        cb.bloco({ type: 'image', attrs: Object.assign({ src: img.src, alt, width: w }, (align ? { align } : {})) });
    }
    async tabela(el) {
        var _a, _b, _c, _d, _e;
        const tblPr = (0, conversaoComum_1.filho)(el, 'w:tblPr');
        const estiloId = tblPr ? ((_a = (0, conversaoComum_1.filho)(tblPr, 'w:tblStyle')) === null || _a === void 0 ? void 0 : _a.getAttribute('w:val')) || undefined : undefined;
        const cadeiaEstilos = (id, vistos = new Set()) => {
            const e = id ? this.estilos[id] : undefined;
            if (!e || vistos.has(id))
                return [];
            vistos.add(id);
            return [...cadeiaEstilos(e.base, vistos), e];
        };
        const est = cadeiaEstilos(estiloId);
        const bordas = (_c = (_b = bordasDaTabela(tblPr)) !== null && _b !== void 0 ? _b : [...est].reverse().map((e) => e.tblBordas).find((b) => b !== null && b !== undefined)) !== null && _c !== void 0 ? _c : false;
        const ctx = { tabela: { p: mesclar(...est.map((e) => e.p)), r: mesclar(...est.map((e) => e.r)) } };
        const grade = (0, conversaoComum_1.filhos)((0, conversaoComum_1.filho)(el, 'w:tblGrid') || el, 'w:gridCol').map((g) => Math.max(10, Math.round((Number(g.getAttribute('w:w')) || 0) / 15)));
        const linhas = [];
        const abertas = {}; // coluna → célula mesclada na vertical
        let algumaBorda = false;
        for (const tr of (0, conversaoComum_1.filhos)(el, 'w:tr').slice(0, MAX_LINHAS_TABELA)) {
            const trPr = (0, conversaoComum_1.filho)(tr, 'w:trPr');
            const cab = !!(trPr && (0, conversaoComum_1.filho)(trPr, 'w:tblHeader'));
            const cels = [];
            let col = n(trPr ? (_d = (0, conversaoComum_1.filho)(trPr, 'w:gridBefore')) === null || _d === void 0 ? void 0 : _d.getAttribute('w:val') : null) || 0;
            const tcs = (0, conversaoComum_1.filhos)(tr).flatMap((x) => (x.tagName === 'w:sdt' ? (0, conversaoComum_1.filhos)((0, conversaoComum_1.filho)(x, 'w:sdtContent') || x, 'w:tc') : x.tagName === 'w:tc' ? [x] : []));
            for (const tc of tcs) {
                const tcPr = (0, conversaoComum_1.filho)(tc, 'w:tcPr');
                const span = Math.max(1, n(tcPr ? (_e = (0, conversaoComum_1.filho)(tcPr, 'w:gridSpan')) === null || _e === void 0 ? void 0 : _e.getAttribute('w:val') : null) || 1);
                const vm = tcPr ? (0, conversaoComum_1.filho)(tcPr, 'w:vMerge') : null;
                const tb = tcPr ? (0, conversaoComum_1.filho)(tcPr, 'w:tcBorders') : null;
                if (tb && (0, conversaoComum_1.filhos)(tb).some((x) => !['nil', 'none'].includes(String(x.getAttribute('w:val')))))
                    algumaBorda = true;
                if (vm && vm.getAttribute('w:val') !== 'restart' && abertas[col]) {
                    const orig = abertas[col];
                    orig.no.attrs.rowspan = Number(orig.no.attrs.rowspan || 1) + 1;
                    col += span;
                    continue;
                }
                const conteudo = (0, conversaoComum_1.agruparListas)(await this.blocos(tc, ctx));
                // Largura: a da célula (tcW, em twips) ou a da grade da tabela.
                const tcW = tcPr ? (0, conversaoComum_1.filho)(tcPr, 'w:tcW') : null;
                const wCel = (tcW === null || tcW === void 0 ? void 0 : tcW.getAttribute('w:type')) === 'dxa' ? Number(tcW.getAttribute('w:w')) / 15 : 0;
                const larguras = wCel >= 10 ? Array(span).fill(Math.round(wCel / span))
                    : grade.length >= col + span ? grade.slice(col, col + span) : null;
                const no = {
                    type: cab ? 'tableHeader' : 'tableCell',
                    attrs: Object.assign({ colspan: span, rowspan: 1 }, (larguras ? { colwidth: larguras } : {})),
                    content: conteudo.length ? conteudo : [{ type: 'paragraph' }],
                };
                const cel = { no, col, span };
                if (vm)
                    abertas[col] = cel;
                else
                    delete abertas[col];
                cels.push(cel);
                col += span;
                if (col >= MAX_COLUNAS)
                    break;
            }
            if (cels.length)
                linhas.push({ cab, cels });
        }
        if (!linhas.length)
            return null;
        if ((0, conversaoComum_1.filhos)(el, 'w:tr').length > MAX_LINHAS_TABELA)
            this.avisos.add(`Tabela com mais de ${MAX_LINHAS_TABELA} linhas: só as primeiras vieram.`);
        return Object.assign(Object.assign({ type: 'table' }, (bordas || algumaBorda ? {} : { attrs: { semBordas: true } })), { content: linhas.map((l) => ({ type: 'tableRow', content: l.cels.map((c) => c.no) })) });
    }
}
/** Word (.docx) → documento do editor, com os avisos do que não veio. */
async function docxParaDoc(buf) {
    let zip;
    try {
        zip = await jszip().loadAsync(buf);
    }
    catch (_a) {
        throw new Error('Arquivo Word danificado ou protegido por senha');
    }
    const l = new Leitor(zip);
    await l.carregar();
    return l.corpo();
}
//# sourceMappingURL=docx.js.map