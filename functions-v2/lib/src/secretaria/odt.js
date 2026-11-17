"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emCm = emCm;
exports.odtParaDoc = odtParaDoc;
const documento_1 = require("../shared/documento");
const conversaoComum_1 = require("./conversaoComum");
const docx_1 = require("./docx");
/**
 * LibreOffice/OpenOffice (.odt) → documento do editor, lendo o XML do
 * arquivo: estilos (com herança), fonte, tamanho, cor, fundo, alinhamento,
 * recuos, espaço antes e depois, entrelinha, listas, tabelas (mescladas,
 * larguras, sem bordas), imagens, links, notas e quebras de página.
 * Cabeçalho e rodapé do arquivo não entram (vale o timbrado da unidade).
 */
const LARGURA_UTIL_PX = 605;
/** Medida do ODF (cm, mm, in, pt, pc, px) em centímetros. */
function emCm(v) {
    const m = String(v || '').match(/^(-?[\d.]+)\s*(cm|mm|in|pt|pc|px)$/);
    if (!m)
        return undefined;
    const x = Number(m[1]);
    return { cm: x, mm: x / 10, in: x * 2.54, pt: (x / 72) * 2.54, pc: (x / 6) * 2.54, px: (x / 96) * 2.54 }[m[2]];
}
const emPt = (v) => { const c = emCm(v); return c === undefined ? undefined : (c / 2.54) * 72; };
const atributos = (el) => {
    const o = {};
    if (!el)
        return o;
    for (let i = 0; i < el.attributes.length; i++)
        o[el.attributes[i].name] = el.attributes[i].value;
    return o;
};
class LeitorOdt {
    constructor(zip) {
        this.zip = zip;
        this.estilos = {};
        this.padrao = { p: {}, t: {} };
        this.fontes = {};
        this.listas = {};
        this.contadores = {};
        this.notas = [];
        this.avisos = new Set();
        this.imagens = (0, conversaoComum_1.novoOrcamento)();
    }
    lerEstilos(raiz) {
        var _a, _b;
        if (!raiz)
            return;
        for (const s of (0, conversaoComum_1.filhos)(raiz)) {
            if (s.tagName === 'style:default-style' && s.getAttribute('style:family') === 'paragraph') {
                this.padrao = { p: atributos((0, conversaoComum_1.filho)(s, 'style:paragraph-properties')), t: atributos((0, conversaoComum_1.filho)(s, 'style:text-properties')) };
            }
            else if (s.tagName === 'style:style') {
                this.estilos[String(s.getAttribute('style:name'))] = {
                    pai: s.getAttribute('style:parent-style-name') || undefined,
                    lista: s.getAttribute('style:list-style-name') || undefined,
                    p: atributos((0, conversaoComum_1.filho)(s, 'style:paragraph-properties')),
                    t: atributos((0, conversaoComum_1.filho)(s, 'style:text-properties')),
                    col: ((_a = (0, conversaoComum_1.filho)(s, 'style:table-column-properties')) === null || _a === void 0 ? void 0 : _a.getAttribute('style:column-width')) || undefined,
                    celula: atributos((0, conversaoComum_1.filho)(s, 'style:table-cell-properties')),
                };
            }
            else if (s.tagName === 'text:list-style') {
                const niv = {};
                for (const l of (0, conversaoComum_1.filhos)(s)) {
                    const nivel = Number(l.getAttribute('text:level')) - 1;
                    niv[nivel] = {
                        bullet: l.tagName === 'text:list-level-style-bullet', formato: String((_b = l.getAttribute('style:num-format')) !== null && _b !== void 0 ? _b : '1'),
                        prefixo: String(l.getAttribute('style:num-prefix') || ''), sufixo: String(l.getAttribute('style:num-suffix') || ''),
                        inicio: Number(l.getAttribute('text:start-value')) || 1, mostrar: Number(l.getAttribute('text:display-levels')) || 1,
                    };
                }
                this.listas[String(s.getAttribute('style:name'))] = niv;
            }
        }
    }
    cadeia(nome, campo, vistos = new Set()) {
        const e = nome ? this.estilos[nome] : undefined;
        if (!e || vistos.has(nome))
            return {};
        vistos.add(nome);
        return Object.assign(Object.assign({}, this.cadeia(e.pai, campo, vistos)), e[campo]);
    }
    listaDoEstilo(nome, vistos = new Set()) {
        const e = nome ? this.estilos[nome] : undefined;
        if (!e || vistos.has(nome))
            return undefined;
        vistos.add(nome);
        return e.lista || this.listaDoEstilo(e.pai, vistos);
    }
    async carregar() {
        var _a, _b, _c, _d, _e, _f;
        const content = await ((_a = this.zip.file('content.xml')) === null || _a === void 0 ? void 0 : _a.async('string'));
        if (!content)
            throw new Error('Arquivo do LibreOffice sem conteúdo (content.xml)');
        const estilos = await ((_b = this.zip.file('styles.xml')) === null || _b === void 0 ? void 0 : _b.async('string'));
        const docs = [estilos ? (0, conversaoComum_1.xml)(estilos) : null, (0, conversaoComum_1.xml)(content)].filter(Boolean);
        for (const d of docs) {
            for (const ff of Array.from(d.getElementsByTagName('style:font-face'))) {
                this.fontes[String(ff.getAttribute('style:name'))] = String(ff.getAttribute('svg:font-family') || ff.getAttribute('style:name')).replace(/['"]/g, '');
            }
            this.lerEstilos(d.getElementsByTagName('office:styles')[0]);
            this.lerEstilos(d.getElementsByTagName('office:automatic-styles')[0]);
            if (((_d = (_c = d.getElementsByTagName('style:header')[0]) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || ((_f = (_e = d.getElementsByTagName('style:footer')[0]) === null || _e === void 0 ? void 0 : _e.textContent) === null || _f === void 0 ? void 0 : _f.trim())) {
                this.avisos.add('O cabeçalho e o rodapé do arquivo não entram: a minuta usa o timbrado da unidade.');
            }
        }
        return (0, conversaoComum_1.xml)(content).getElementsByTagName('office:text')[0];
    }
    marcas(t, extra) {
        const m = [];
        const peso = t['fo:font-weight'];
        if (peso === 'bold' || Number(peso) >= 600)
            m.push({ type: 'bold' });
        if (t['fo:font-style'] === 'italic' || t['fo:font-style'] === 'oblique')
            m.push({ type: 'italic' });
        if (t['style:text-underline-style'] && t['style:text-underline-style'] !== 'none')
            m.push({ type: 'underline' });
        if (t['style:text-line-through-style'] && t['style:text-line-through-style'] !== 'none')
            m.push({ type: 'strike' });
        const pos = String(t['style:text-position'] || '');
        if (/^super|^\d+%?\s/.test(pos) && !/^0%?(\s|$)/.test(pos) && !/^-/.test(pos))
            m.push({ type: 'superscript' });
        else if (/^sub|^-\d/.test(pos))
            m.push({ type: 'subscript' });
        const ts = {};
        const cor = t['fo:color'];
        if (cor && /^#[0-9a-f]{6}$/i.test(cor) && cor.toLowerCase() !== '#000000')
            ts.color = cor.toLowerCase();
        const fundo = t['fo:background-color'];
        if (fundo && /^#[0-9a-f]{6}$/i.test(fundo) && fundo.toLowerCase() !== '#ffffff')
            ts.backgroundColor = fundo.toLowerCase();
        const tam = emPt(t['fo:font-size']);
        if (tam)
            ts.fontSize = `${Math.max(6, Math.min(96, Math.round(tam * 2) / 2))}pt`;
        const f = (0, documento_1.fonteEquivalente)(this.fontes[t['style:font-name']] || t['style:font-name'] || t['fo:font-family']);
        if (f)
            ts.fontFamily = f;
        if (Object.keys(ts).length)
            m.push({ type: 'textStyle', attrs: ts });
        return [...m, ...extra];
    }
    texto(s, t, extra) {
        if (!s || t['text:display'] === 'none')
            return [];
        const marks = this.marcas(t, extra);
        const txt = t['fo:text-transform'] === 'uppercase' ? s.toLocaleUpperCase('pt-BR') : s;
        return [marks.length ? { type: 'text', text: txt, marks } : { type: 'text', text: txt }];
    }
    attrsParagrafo(p, t, emLista) {
        const a = {};
        const al = p['fo:text-align'];
        if (al === 'center')
            a.textAlign = 'center';
        else if (al === 'end' || al === 'right')
            a.textAlign = 'right';
        else if (al === 'justify')
            a.textAlign = 'justify';
        if (!emLista) {
            const esq = emCm(p['fo:margin-left']);
            if (esq && esq >= 0.05)
                a.margemEsq = Math.min(10, Math.round(esq * 100) / 100);
            const rec = emCm(p['fo:text-indent']);
            if (rec && rec >= 0.05)
                a.recuo = Math.min(5, Math.round(rec * 100) / 100);
        }
        const pt = (v) => { const x = emPt(v); return x === undefined ? 0 : Math.max(0, Math.min(72, Math.round(x * 10) / 10)); };
        // Espaçamento contextual (itens de lista seguidos): sem espaço entre eles, como no LibreOffice.
        const contextual = emLista && p['style:contextual-spacing'] === 'true';
        a.antes = contextual ? 0 : pt(p['fo:margin-top']);
        a.depois = contextual ? 0 : pt(p['fo:margin-bottom']);
        const lh = p['fo:line-height'];
        let ent = 1;
        if (lh === null || lh === void 0 ? void 0 : lh.endsWith('%'))
            ent = parseFloat(lh) / 100;
        else if (emPt(lh))
            ent = emPt(lh) / ((emPt(t['fo:font-size']) || 12) * 1.15);
        a.espacamento = Math.max(0.8, Math.min(3, Math.round(ent * 100) / 100));
        return a;
    }
    async blocos(el, lista) {
        const out = [];
        for (const c of (0, conversaoComum_1.filhos)(el)) {
            const tag = c.tagName;
            if (tag === 'text:p' || tag === 'text:h')
                out.push(...await this.paragrafo(c, lista));
            else if (tag === 'text:list') {
                const nome = c.getAttribute('text:style-name') || (lista === null || lista === void 0 ? void 0 : lista.nome) || '';
                const nivel = lista ? lista.nivel + 1 : 0;
                if (c.getAttribute('text:continue-numbering') !== 'true' && !lista && nome)
                    delete this.contadores[nome];
                for (const it of (0, conversaoComum_1.filhos)(c)) {
                    if (it.tagName === 'text:list-item' || it.tagName === 'text:list-header')
                        out.push(...await this.blocos(it, { nome, nivel }));
                }
            }
            else if (tag === 'table:table') {
                const t = await this.tabela(c);
                if (t)
                    out.push({ no: t });
            }
            else if (['text:section', 'text:index-body', 'text:table-of-content', 'text:alphabetical-index', 'text:illustration-index'].includes(tag))
                out.push(...await this.blocos(c, lista));
        }
        return out;
    }
    async paragrafo(el, lista) {
        var _a, _b;
        var _c;
        const nomeEstilo = el.getAttribute('text:style-name') || undefined;
        const p = Object.assign(Object.assign({}, this.padrao.p), this.cadeia(nomeEstilo, 'p'));
        const t = Object.assign(Object.assign({}, this.padrao.t), this.cadeia(nomeEstilo, 't'));
        const out = [];
        if (p['fo:break-before'] === 'page')
            out.push({ no: { type: 'pageBreak' } });
        const titulo = el.tagName === 'text:h' ? Math.min(4, Math.max(1, Number(el.getAttribute('text:outline-level')) || 1)) : null;
        let prefixo = '';
        let itemLista;
        // Lista sem estilo próprio (comum em arquivos gerados por outros programas): marcadores.
        const nomeLista = lista ? lista.nome || '(sem estilo)' : this.listaDoEstilo(nomeEstilo);
        if (lista && nomeLista) {
            const niv = this.listas[nomeLista] || [];
            const nivel = Math.min(9, lista.nivel);
            const lv = niv[nivel] || { bullet: true, formato: '', prefixo: '', sufixo: '', inicio: 1, mostrar: 1 };
            const cont = ((_c = this.contadores)[nomeLista] || (_c[nomeLista] = []));
            for (let k = 0; k <= nivel; k++)
                if (cont[k] === undefined)
                    cont[k] = ((_b = (_a = niv[k]) === null || _a === void 0 ? void 0 : _a.inicio) !== null && _b !== void 0 ? _b : 1) - 1;
            cont[nivel] += 1;
            cont.length = nivel + 1;
            if (lv.bullet)
                itemLista = { chave: `${nomeLista}:b`, ilvl: nivel, ordenada: false, inicio: 1 };
            else if (lv.formato) {
                if (lv.formato === '1' && lv.sufixo === '.' && !lv.prefixo && lv.mostrar <= 1 && !titulo)
                    itemLista = { chave: `${nomeLista}:o`, ilvl: nivel, ordenada: true, inicio: cont[nivel] };
                else {
                    const fmt = (f) => ({ a: 'lowerLetter', A: 'upperLetter', i: 'lowerRoman', I: 'upperRoman' }[f] || 'decimal');
                    const nums = cont.slice(Math.max(0, nivel - lv.mostrar + 1), nivel + 1).map((v, k, arr) => { var _a; return (0, docx_1.formatarNumero)(v, fmt(((_a = niv[nivel - arr.length + 1 + k]) === null || _a === void 0 ? void 0 : _a.formato) || '1')); });
                    prefixo = `${lv.prefixo}${nums.join('.')}${lv.sufixo}`;
                }
            }
        }
        const attrs = this.attrsParagrafo(p, t, !!itemLista);
        const novo = () => ({ type: titulo ? 'heading' : 'paragraph', attrs: Object.assign(Object.assign({}, attrs), (titulo ? { level: titulo } : {})), content: [] });
        let atual = novo();
        let emitiu = false;
        let listaUsada = false;
        const emitir = (it) => { out.push(it); emitiu = true; };
        const fechar = (forcar = false) => {
            if (atual.content.length || forcar) {
                if (!atual.content.length)
                    delete atual.content;
                emitir(itemLista && !listaUsada ? { no: atual, lista: itemLista } : { no: atual });
                listaUsada = true;
            }
            atual = novo();
        };
        if (prefixo)
            atual.content.push(...this.texto(`${prefixo} `, t, []));
        await this.inline(el, t, [], {
            corrente: () => atual,
            bloco: (b) => { fechar(); emitir({ no: b }); },
            alinhamento: attrs.textAlign,
        });
        fechar(!emitiu);
        if (p['fo:break-after'] === 'page')
            out.push({ no: { type: 'pageBreak' } });
        return out;
    }
    async inline(el, t, extra, cb) {
        const pos = (l) => cb.corrente().content.push(...l);
        for (let i = 0; i < el.childNodes.length; i++) {
            const c = el.childNodes[i];
            if (c.nodeType === 3) {
                pos(this.texto(String(c.data || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' '), t, extra));
                continue;
            }
            if (c.nodeType !== 1)
                continue;
            const tag = c.tagName;
            if (tag === 'text:span')
                await this.inline(c, Object.assign(Object.assign({}, t), this.cadeia(c.getAttribute('text:style-name') || undefined, 't')), extra, cb);
            else if (tag === 'text:a') {
                const href = String(c.getAttribute('xlink:href') || '');
                await this.inline(c, t, /^(https?:|mailto:)/i.test(href) ? [...extra, { type: 'link', attrs: { href } }] : extra, cb);
            }
            else if (tag === 'text:s')
                pos(this.texto(' '.repeat(Math.max(1, Math.min(50, Number(c.getAttribute('text:c')) || 1))), t, extra));
            else if (tag === 'text:tab')
                pos(this.texto(' '.repeat(Math.max(2, Math.min(12, Math.round(36 / ((emPt(t['fo:font-size']) || 12) * 0.25))))), t, extra));
            else if (tag === 'text:line-break')
                pos([{ type: 'hardBreak' }]);
            else if (tag === 'text:note') {
                const corpo = (0, conversaoComum_1.filho)(c, 'text:note-body');
                const numero = this.notas.length + 1;
                this.notas.push(corpo ? (0, conversaoComum_1.agruparListas)(await this.blocos(corpo)) : []);
                pos(this.texto(String(numero), Object.assign(Object.assign({}, t), { 'style:text-position': 'super 58%' }), extra));
            }
            else if (tag === 'draw:frame' || tag === 'draw:a')
                await this.desenho(c, cb);
            else if (['text:bookmark', 'text:bookmark-start', 'text:bookmark-end', 'text:soft-page-break', 'office:annotation', 'office:annotation-end', 'text:change', 'text:change-start', 'text:change-end', 'text:reference-mark'].includes(tag))
                continue;
            else
                await this.inline(c, t, extra, cb); // campos (data, página, sequência…): o texto que mostram
        }
    }
    async desenho(el, cb) {
        var _a;
        const caixa = el.getElementsByTagName('draw:text-box')[0];
        if (caixa)
            for (const b of (0, conversaoComum_1.agruparListas)(await this.blocos(caixa)))
                cb.bloco(b);
        const img = el.getElementsByTagName('draw:image')[0];
        const href = img === null || img === void 0 ? void 0 : img.getAttribute('xlink:href');
        if (!href || /^https?:/i.test(href))
            return;
        const buf = await ((_a = this.zip.file(href.replace(/^\.\//, ''))) === null || _a === void 0 ? void 0 : _a.async('nodebuffer'));
        if (!buf)
            return;
        const r = await this.imagens.incluir(buf, href);
        if (!r)
            return;
        const largCm = emCm(el.getAttribute('svg:width') || undefined);
        const w = Math.max(10, Math.min(LARGURA_UTIL_PX, largCm ? Math.round((largCm / 2.54) * 96) : r.largura));
        const align = cb.alinhamento === 'center' || cb.alinhamento === 'right' ? cb.alinhamento : undefined;
        cb.bloco({ type: 'image', attrs: Object.assign({ src: r.src, alt: String(el.getAttribute('draw:name') || '').slice(0, 300), width: w }, (align ? { align } : {})) });
    }
    async tabela(el) {
        var _a;
        const colunas = [];
        const juntar = (raiz) => {
            var _a;
            for (const c of (0, conversaoComum_1.filhos)(raiz)) {
                if (c.tagName === 'table:table-column') {
                    const rep = Math.min(50, Number(c.getAttribute('table:number-columns-repeated')) || 1);
                    const cm = emCm((_a = this.estilos[String(c.getAttribute('table:style-name'))]) === null || _a === void 0 ? void 0 : _a.col);
                    for (let k = 0; k < rep; k++)
                        colunas.push(cm ? Math.round((cm / 2.54) * 96) : 0);
                }
                else if (c.tagName === 'table:table-columns' || c.tagName === 'table:table-header-columns')
                    juntar(c);
            }
        };
        juntar(el);
        const linhasEl = [];
        const coletar = (raiz, cab) => {
            for (const c of (0, conversaoComum_1.filhos)(raiz)) {
                if (c.tagName === 'table:table-row') {
                    const rep = Math.min(50, Number(c.getAttribute('table:number-rows-repeated')) || 1);
                    for (let k = 0; k < rep && linhasEl.length < 400; k++)
                        linhasEl.push({ tr: c, cab });
                }
                else if (c.tagName === 'table:table-header-rows')
                    coletar(c, true);
                else if (c.tagName === 'table:table-rows' || c.tagName === 'table:table-row-group')
                    coletar(c, cab);
            }
        };
        coletar(el, false);
        let comBorda = false;
        const linhas = [];
        for (const { tr, cab } of linhasEl) {
            const cels = [];
            let col = 0;
            for (const tc of (0, conversaoComum_1.filhos)(tr)) {
                const rep = Math.min(30, Number(tc.getAttribute('table:number-columns-repeated')) || 1);
                if (tc.tagName === 'table:covered-table-cell') {
                    col += rep;
                    continue;
                }
                if (tc.tagName !== 'table:table-cell')
                    continue;
                const est = ((_a = this.estilos[String(tc.getAttribute('table:style-name'))]) === null || _a === void 0 ? void 0 : _a.celula) || {};
                if (Object.entries(est).some(([k, v]) => k.startsWith('fo:border') && v && v !== 'none' && !/^0(\.0+)?\w*\s/.test(v)))
                    comBorda = true;
                const span = Math.max(1, Number(tc.getAttribute('table:number-columns-spanned')) || 1);
                const rows = Math.max(1, Number(tc.getAttribute('table:number-rows-spanned')) || 1);
                for (let k = 0; k < rep; k++) {
                    const conteudo = (0, conversaoComum_1.agruparListas)(await this.blocos(tc));
                    const larg = colunas.slice(col, col + span);
                    cels.push({
                        type: cab ? 'tableHeader' : 'tableCell',
                        attrs: Object.assign({ colspan: span, rowspan: rows }, (larg.length === span && larg.every((w) => w >= 10) ? { colwidth: larg } : {})),
                        content: conteudo.length ? conteudo : [{ type: 'paragraph' }],
                    });
                    col += span;
                }
            }
            if (cels.length)
                linhas.push({ type: 'tableRow', content: cels });
        }
        if (!linhas.length)
            return null;
        return Object.assign(Object.assign({ type: 'table' }, (comBorda ? {} : { attrs: { semBordas: true } })), { content: linhas });
    }
    async converter() {
        const corpo = await this.carregar();
        if (!corpo)
            throw new Error('Arquivo do LibreOffice sem texto');
        const content = (0, conversaoComum_1.agruparListas)(await this.blocos(corpo));
        if (this.notas.length) {
            content.push({ type: 'horizontalRule' });
            this.notas.forEach((blocos, i) => {
                var _a;
                const p = ((_a = blocos[0]) === null || _a === void 0 ? void 0 : _a.type) === 'paragraph' ? blocos[0] : { type: 'paragraph', content: [] };
                p.content = [{ type: 'text', text: `${i + 1} `, marks: [{ type: 'superscript' }] }, ...(p.content || [])];
                content.push(p, ...blocos.slice(blocos[0] === p ? 1 : 0));
            });
        }
        return { doc: (0, documento_1.sanitizeDoc)({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }), avisos: [...this.avisos, ...this.imagens.avisos] };
    }
}
/** LibreOffice (.odt) → documento do editor, com os avisos do que não veio. */
async function odtParaDoc(buf) {
    let zip;
    zip = await (0, conversaoComum_1.abrirZip)(buf, 'Arquivo do LibreOffice danificado ou protegido por senha');
    return new LeitorOdt(zip).converter();
}
//# sourceMappingURL=odt.js.map