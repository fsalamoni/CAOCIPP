"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataHora = void 0;
exports.winAnsi = winAnsi;
exports.largurasColunas = largurasColunas;
exports.renderizarDocumento = renderizarDocumento;
exports.textoParaDoc = textoParaDoc;
// pdfmake e pdf-lib carregados só quando usados (partida a frio das functions).
const pdfLib = () => require('pdf-lib');
const documento_1 = require("../shared/documento");
const layoutDocumento_1 = require("../shared/layoutDocumento");
/**
 * Converte o documento do editor em PDF (A4), com cabeçalho do órgão, rodapé
 * paginado e bloco de assinaturas. É o que entra nos autos na juntada.
 */
let impressora;
function printer() {
    if (impressora)
        return impressora;
    const PdfPrinter = require('pdfmake');
    const vfs = require('pdfmake/build/vfs_fonts');
    const ttf = (n) => Buffer.from(vfs[n], 'base64');
    // Arquivos TTF dos pacotes de fonte (o pdfkit embute só os caracteres usados).
    const familia = (nome, pacote = nome.toLowerCase()) => {
        const arq = (estilo) => require.resolve(`@expo-google-fonts/${pacote}/${estilo}/${nome}_${estilo}.ttf`);
        return { normal: arq('400Regular'), bold: arq('700Bold'), italics: arq('400Regular_Italic'), bolditalics: arq('700Bold_Italic') };
    };
    return (impressora = new PdfPrinter({
        Tinos: familia('Tinos'), Arimo: familia('Arimo'), Carlito: familia('Carlito'), Caladea: familia('Caladea'), Cousine: familia('Cousine'),
        Gelasio: familia('Gelasio'), EBGaramond: familia('EBGaramond', 'eb-garamond'), OpenSans: familia('OpenSans', 'open-sans'), Lato: familia('Lato'),
        Roboto: { normal: ttf('Roboto-Regular.ttf'), bold: ttf('Roboto-Medium.ttf'), italics: ttf('Roboto-Italic.ttf'), bolditalics: ttf('Roboto-MediumItalic.ttf') },
        Times: { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' },
        Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
    }));
}
const CM = 28.3465;
/** Fontes padrão do PDF só codificam WinAnsi; Roboto cobre o resto. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function winAnsi(t) {
    return Array.from(t).map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?')).join('');
}
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
exports.dataHora = dataHora;
/** Fontes padrão do PDF (sem arquivo embutido): só WinAnsi. */
const SO_WINANSI = new Set(['Times', 'Courier']);
function inline(nos, fonte, mapa, maiusculas = false) {
    const out = [];
    for (const n of nos || []) {
        if (n.type === 'hardBreak') {
            out.push({ text: '\n' });
            continue;
        }
        if (n.type !== 'text' || !n.text)
            continue;
        const t = { text: maiusculas ? n.text.toLocaleUpperCase('pt-BR') : n.text };
        const deco = [];
        let f = fonte;
        for (const m of n.marks || []) {
            const a = m.attrs || {};
            if (m.type === 'bold')
                t.bold = true;
            else if (m.type === 'italic')
                t.italics = true;
            else if (m.type === 'underline')
                deco.push('underline');
            else if (m.type === 'strike')
                deco.push('lineThrough');
            else if (m.type === 'subscript')
                t.sub = true;
            else if (m.type === 'superscript')
                t.sup = true;
            else if (m.type === 'code')
                f = mapa.monospace;
            else if (m.type === 'highlight')
                t.background = String(a.color || '#fef08a');
            else if (m.type === 'link') {
                t.link = String(a.href);
                t.color = t.color || '#1d4ed8';
                deco.push('underline');
            }
            else if (m.type === 'textStyle') {
                if (a.color)
                    t.color = String(a.color);
                if (a.backgroundColor)
                    t.background = String(a.backgroundColor);
                if (a.fontSize)
                    t.fontSize = parseFloat(String(a.fontSize));
                if (a.fontFamily && mapa[String(a.fontFamily)])
                    f = mapa[String(a.fontFamily)];
            }
        }
        if (deco.length)
            t.decoration = deco.length === 1 ? deco[0] : deco;
        if (f !== fonte)
            t.font = f;
        if (SO_WINANSI.has(f))
            t.text = winAnsi(String(t.text));
        out.push(t);
    }
    return out;
}
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
function bloco(n, fonte, largura, ctx) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const a = n.attrs || {};
    const { mapa } = ctx;
    const liCtx = Object.assign(Object.assign({}, ctx), { semRecuo: true });
    const filhos = (nos, l = largura, c = ctx) => (nos || []).map((x) => bloco(x, fonte, l, c)).filter(Boolean);
    switch (n.type) {
        case 'paragraph':
        case 'heading': {
            // Estilo do documento (Normal, Título, Citação ou próprio); o que está no parágrafo vale mais.
            const e = (0, layoutDocumento_1.estiloDoBloco)(ctx.layout, n, ctx.citacao);
            const f = (e.fonte && mapa[e.fonte]) || fonte;
            const textos = inline(n.content, f, mapa, e.maiusculas);
            const numero = ctx.numeros.get(n);
            if (numero)
                textos.unshift({ text: winAnsiSe(f, `${numero} `) });
            const antes = (_b = (_a = num(a.antes)) !== null && _a !== void 0 ? _a : e.antes) !== null && _b !== void 0 ? _b : 0;
            const depois = (_d = (_c = num(a.depois)) !== null && _c !== void 0 ? _c : e.depois) !== null && _d !== void 0 ? _d : 6;
            const recuo = (_f = (_e = num(a.recuo)) !== null && _e !== void 0 ? _e : (ctx.semRecuo ? 0 : e.recuo)) !== null && _f !== void 0 ? _f : 0;
            const esq = (_h = (_g = num(a.margemEsq)) !== null && _g !== void 0 ? _g : e.margemEsq) !== null && _h !== void 0 ? _h : 0;
            const dir = (_k = (_j = num(a.margemDir)) !== null && _j !== void 0 ? _j : e.margemDir) !== null && _k !== void 0 ? _k : 0;
            return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ text: textos.length ? textos : ' ', alignment: a.textAlign || e.alinhamento || 'left', leadingIndent: recuo * CM, lineHeight: num(a.espacamento) || e.espacamento || 1.15, margin: [esq * CM, antes, dir * CM, depois] }, (f !== fonte ? { font: f } : {})), (e.tamanho ? { fontSize: e.tamanho } : {})), (e.negrito ? { bold: true } : {})), (e.italico ? { italics: true } : {})), (e.sublinhado ? { decoration: 'underline' } : {})), (e.cor ? { color: e.cor } : {}));
        }
        case 'bulletList': {
            // Marcador escolhido: •, ◦, ▪ ou travessão (desenhado à parte, como no Word).
            const travessao = a.marcador === 'dash';
            const itens = (n.content || []).map((li) => (travessao
                ? { columns: [{ text: '–', width: 12 }, { stack: filhos(li.content, largura - 32, liCtx), width: '*' }] }
                : { stack: filhos(li.content, largura - 20, liCtx) }));
            return Object.assign(Object.assign({ ul: itens }, (travessao ? { type: 'none' } : a.marcador && a.marcador !== 'disc' ? { type: a.marcador } : {})), { margin: [0, 0, 0, 6] });
        }
        case 'orderedList':
            return Object.assign(Object.assign({ ol: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20, liCtx) })), start: Number(a.start) || 1, margin: [0, 0, 0, 6] }, (a.formato && a.formato !== 'decimal' ? { type: a.formato } : {})), (a.separador === ')' ? { separator: ')' } : {}));
        case 'blockquote':
            return {
                table: { widths: ['*'], body: [[{ stack: filhos(n.content, largura - 24, Object.assign(Object.assign({}, ctx), { citacao: true })) }]] },
                layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 2 : 0), vLineColor: () => '#94a3b8', paddingLeft: () => 12, paddingRight: () => 0 },
                margin: [12, 0, 0, 8],
            };
        case 'horizontalRule':
            return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }], margin: [0, 6, 0, 10] };
        case 'pageBreak':
            return { text: '', pageBreak: 'after' };
        case 'image': {
            // Largura vem em px de tela (96 dpi); o PDF mede em pontos (72 por polegada).
            const w = Math.min(Number(a.width) ? Number(a.width) * 0.75 : largura, largura);
            return { image: String(a.src), width: w, margin: [0, 4, 0, 8], alignment: a.align || 'left' };
        }
        case 'table':
            return tabela(n, fonte, largura, ctx);
        default:
            return n.content ? { stack: filhos(n.content) } : null;
    }
}
/** Tabela do editor → pdfmake, respeitando células mescladas. */
function tabela(n, fonte, largura, ctx) {
    var _a;
    const linhas = n.content || [];
    const grade = linhas.map(() => []);
    const larguras = []; // px de tela por coluna, das células (colwidth)
    let colunas = 0;
    linhas.forEach((tr, r) => {
        var _a, _b, _c;
        let c = 0;
        for (const cel of tr.content || []) {
            while (grade[r][c] !== undefined)
                c++;
            const cs = Number((_a = cel.attrs) === null || _a === void 0 ? void 0 : _a.colspan) || 1;
            const rs = Number((_b = cel.attrs) === null || _b === void 0 ? void 0 : _b.rowspan) || 1;
            const cabec = cel.type === 'tableHeader';
            const cw = (_c = cel.attrs) === null || _c === void 0 ? void 0 : _c.colwidth;
            if (Array.isArray(cw))
                cw.forEach((w, j) => { if (larguras[c + j] == null && Number(w) > 0)
                    larguras[c + j] = Number(w); });
            const conteudo = (cel.content || []).map((b) => bloco(b, fonte, largura / 2, Object.assign(Object.assign({}, ctx), { semRecuo: true }))).filter(Boolean);
            grade[r][c] = Object.assign({ stack: conteudo.length ? conteudo : [' '], colSpan: cs, rowSpan: rs }, (cabec ? { bold: true, fillColor: '#f1f5f9' } : {}));
            for (let i = 0; i < rs; i++) {
                for (let j = 0; j < cs; j++) {
                    if ((i || j) && grade[r + i])
                        grade[r + i][c + j] = {};
                }
            }
            c += cs;
            colunas = Math.max(colunas, c);
        }
    });
    for (const linha of grade)
        for (let c = 0; c < colunas; c++)
            if (linha[c] === undefined)
                linha[c] = ' ';
    const cabecalhos = linhas.findIndex((tr) => !(tr.content || []).every((c) => c.type === 'tableHeader'));
    const linha = ((_a = n.attrs) === null || _a === void 0 ? void 0 : _a.semBordas) ? 0 : 0.6;
    return {
        table: { widths: largurasColunas(larguras, colunas, largura, ctx.faixa), body: grade.length ? grade : [[' ']], headerRows: cabecalhos > 0 ? cabecalhos : 0, dontBreakRows: false },
        layout: { hLineColor: () => '#94a3b8', vLineColor: () => '#94a3b8', hLineWidth: () => linha, vLineWidth: () => linha, paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3 },
        margin: [0, 2, 0, 8],
    };
}
/**
 * Larguras das colunas no PDF: as que o editor guardou (arrastadas na tela ou
 * vindas do Word), na mesma proporção; sem nenhuma, colunas iguais.
 */
function largurasColunas(px, colunas, largura, livres = false) {
    const lista = Array.from({ length: colunas }, (_, i) => { var _a; return (_a = px[i]) !== null && _a !== void 0 ? _a : null; });
    const conhecidas = lista.filter((w) => w !== null);
    if (!conhecidas.length)
        return Array(colunas).fill('*');
    // Cabeçalho/rodapé: coluna sem largura ocupa o resto, como na tela (logotipo fixo, texto ao lado).
    // ponytail: o corpo segue com a média, para não mudar a paginação de documentos já juntados.
    if (livres && conhecidas.length < colunas)
        return lista.map((w) => (w === null ? '*' : Math.round(w * 75) / 100));
    const media = conhecidas.reduce((s, w) => s + w, 0) / conhecidas.length;
    const todas = lista.map((w) => w !== null && w !== void 0 ? w : media);
    const total = todas.reduce((s, w) => s + w, 0);
    // Cabe na área útil, descontando o recheio das células (5 + 5 pt) e as linhas.
    const util = largura - colunas * 10 - (colunas + 1) * 0.6;
    const escala = Math.min(1, util / (total * 0.75));
    return todas.map((w) => Math.max(12, Math.round(w * 0.75 * escala * 100) / 100));
}
/** Documento do editor → PDF. Devolve os bytes e o número de páginas. */
async function renderizarDocumento(doc, cfg = {}, meta = {}) {
    var _a, _b;
    const mapa = meta.legado ? documento_1.FONTES_LEGADO : documento_1.FONTES;
    // Papel, margens e estilos do documento (doc.attrs.layout); sem eles, A4 com 3/2/2,5/2,2 cm.
    const layout = (0, layoutDocumento_1.layoutDe)(doc);
    const normal = (0, layoutDocumento_1.estiloDoBloco)(layout, { type: 'paragraph' });
    const fonte = mapa[String(normal.fonte || cfg.fonte_padrao || 'serif')] || mapa.serif;
    const { w, h } = (0, layoutDocumento_1.folha)(layout);
    const mg = (0, layoutDocumento_1.margens)(layout);
    const MARGENS = [mg.esq * CM, 0, mg.dir * CM, 0];
    const areaUtil = w * CM - MARGENS[0] - MARGENS[2];
    const linhas = meta.semCabecalho ? [] : (cfg.cabecalho_linhas || []).filter(Boolean);
    const brasao = meta.semCabecalho ? null : cfg.brasao || null;
    // Cabeçalho, rodapé e número de página (layout.cabecalho/rodape/numero_pagina); sem eles, o de sempre.
    const fCab = layout.cabecalho || {};
    const fRod = layout.rodape || {};
    const np = layout.numero_pagina || {};
    const posNum = np.posicao || 'rodape-direita';
    const timbrado = (fCab.modo || 'unidade') === 'unidade' && (linhas.length > 0 || !!brasao);
    const cabProprio = fCab.modo === 'proprio' && !!((_a = fCab.conteudo) === null || _a === void 0 ? void 0 : _a.length);
    const rodProprio = fRod.modo === 'proprio' && !!((_b = fRod.conteudo) === null || _b === void 0 ? void 0 : _b.length);
    const rodUnidade = (fRod.modo || 'unidade') === 'unidade';
    const numCab = posNum.startsWith('cabecalho');
    const numRod = posNum.startsWith('rodape');
    // O de sempre: rodapé da unidade e "Página X de Y" à direita na mesma linha.
    const rodapeClassico = rodUnidade && posNum === 'rodape-direita' && !np.formato && !np.tamanho;
    const DIST = layoutDocumento_1.DISTANCIA_FAIXA * CM;
    const tamNum = np.tamanho || layoutDocumento_1.TAMANHO_NUMERO;
    const altNum = tamNum * 1.3;
    const comNumero = (n) => posNum !== 'nenhum' && !(n === 1 && np.primeira === false);
    const numero = (n, total) => ({
        text: (0, layoutDocumento_1.textoNumero)(np.formato, n, total), fontSize: tamNum, color: '#64748b', font: fonte,
        alignment: posNum.endsWith('centro') ? 'center' : posNum.endsWith('esquerda') ? 'left' : 'right',
    });
    const ctxFaixa = { mapa, layout, numeros: new Map(), faixa: true };
    const desenhar = (nos, n, total) => (0, layoutDocumento_1.trocarPagina)(nos, n, total).map((b) => bloco(b, fonte, areaUtil, ctxFaixa)).filter(Boolean);
    const base = { defaultStyle: { font: fonte, fontSize: normal.tamanho || Number(cfg.tamanho_padrao) || 12, lineHeight: 1.15 } };
    // Altura real do cabeçalho/rodapé próprio: o texto do corpo começa abaixo dele, como no Word.
    const altCabProprio = cabProprio ? alturaDe(desenhar(fCab.conteudo, 999, 999), areaUtil, base) : 0;
    const altRodProprio = rodProprio ? alturaDe(desenhar(fRod.conteudo, 999, 999), areaUtil, base) : 0;
    const temCabecalho = timbrado || cabProprio || numCab;
    // Com timbrado, o texto começa abaixo dele (como sempre); margem superior própria só se for maior.
    const altCab = 40 + (brasao ? 50 : 0) + linhas.length * 13;
    const topo = timbrado ? Math.max(altCab, layout.margens ? mg.sup * CM : 0)
        : temCabecalho ? Math.max(mg.sup * CM, DIST + altCabProprio + (numCab ? altNum : 0) + 8) : mg.sup * CM;
    const inferior = rodProprio ? Math.max(mg.inf * CM, DIST + altRodProprio + (numRod ? altNum : 0) + 6) : mg.inf * CM;
    const ctx = { mapa, layout, numeros: (0, layoutDocumento_1.numerosAutomaticos)(doc) };
    const corpo = (doc.content || []).map((b) => bloco(b, fonte, areaUtil, ctx)).filter(Boolean);
    const assinaturas = meta.assinaturas || [];
    if (assinaturas.length || meta.sha256) {
        corpo.push({
            margin: [0, 18, 0, 0],
            unbreakable: true,
            table: {
                widths: ['*'],
                body: [[{
                            stack: [
                                ...assinaturas.map((s) => ({
                                    text: winAnsiSe(fonte, `Documento assinado eletronicamente por ${s.nome}, em ${(0, exports.dataHora)(s.em)}, com assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I).`),
                                    fontSize: 8.5, margin: [0, 0, 0, 3],
                                })),
                                ...(assinaturas.length ? [] : [{ text: 'Documento sem assinatura.', fontSize: 8.5 }]),
                                ...(meta.sha256 ? [{ text: `Código de integridade do conteúdo (SHA-256): ${meta.sha256}`, fontSize: 7, color: '#475569' }] : []),
                            ],
                        }]],
            },
            layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
        });
    }
    const def = Object.assign(Object.assign({ pageSize: { width: Math.round(w * CM * 100) / 100, height: Math.round(h * CM * 100) / 100 }, pageMargins: [MARGENS[0], topo, MARGENS[2], inferior] }, base), { info: { creator: 'SIGO — Processo Eletrônico', producer: 'SIGO' }, content: corpo.length ? corpo : [{ text: ' ' }], header: temCabecalho ? (atual, total) => {
            const partes = [];
            if ((0, layoutDocumento_1.faixaNaPagina)(fCab, atual === 1)) {
                if (timbrado) {
                    if (brasao)
                        partes.push({ image: brasao, fit: [46, 46], alignment: 'center', margin: [0, 0, 0, 4] });
                    linhas.forEach((l, i) => partes.push({ text: winAnsiSe(fonte, l), alignment: 'center', fontSize: i === 0 ? 11 : 9, bold: i === 0, font: fonte }));
                }
                else if (cabProprio)
                    partes.push(...desenhar(fCab.conteudo, atual, total));
            }
            if (numCab && comNumero(atual))
                partes.push(numero(atual, total));
            return { margin: [MARGENS[0], timbrado ? 24 : DIST, MARGENS[2], 0], stack: partes.length ? partes : [{ text: '' }] };
        } : undefined, footer: (atual, total) => {
            const naPagina = (0, layoutDocumento_1.faixaNaPagina)(fRod, atual === 1);
            const textoUnidade = { text: winAnsiSe(fonte, naPagina && rodUnidade ? cfg.rodape || '' : ''), fontSize: 7.5, color: '#64748b', font: fonte };
            if (rodapeClassico) {
                return {
                    margin: [MARGENS[0], 18, MARGENS[2], 0],
                    columns: [textoUnidade, { text: comNumero(atual) ? `Página ${atual} de ${total}` : '', alignment: 'right', fontSize: 7.5, color: '#64748b', width: 90, font: fonte }],
                };
            }
            const partes = [];
            if (naPagina && rodProprio)
                partes.push(...desenhar(fRod.conteudo, atual, total));
            else if (naPagina && rodUnidade && cfg.rodape)
                partes.push(textoUnidade);
            if (numRod && comNumero(atual))
                partes.push(numero(atual, total));
            const alt = (rodProprio ? altRodProprio : 10) + (numRod ? altNum : 0);
            return { margin: [MARGENS[0], Math.max(4, inferior - DIST - alt), MARGENS[2], 0], stack: partes.length ? partes : [{ text: '' }] };
        }, watermark: meta.marcaDagua ? { text: meta.marcaDagua, opacity: 0.08, bold: true, angle: -45 } : undefined });
    const pdf = printer().createPdfKitDocument(def);
    const partes = [];
    const buffer = await new Promise((ok, erro) => {
        pdf.on('data', (b) => partes.push(b));
        pdf.on('end', () => ok(Buffer.concat(partes)));
        pdf.on('error', erro);
        pdf.end();
    });
    const paginas = (await pdfLib().PDFDocument.load(buffer)).getPageCount();
    return { buffer, paginas };
}
/** Altura (pt) que um conteúdo ocupa na largura dada: o pdfmake diagrama e conta onde acaba. */
function alturaDe(conteudo, largura, base) {
    let fim = 0;
    const pdf = printer().createPdfKitDocument(Object.assign(Object.assign({}, base), { pageSize: { width: largura, height: 14400 }, pageMargins: [0, 0, 0, 0], content: [...conteudo, { text: ' ', id: '__fim' }], pageBreakBefore: (n) => { if (n.id === '__fim')
            fim = n.startPosition.top; return false; } }));
    pdf.end();
    return fim;
}
function winAnsiSe(fonte, t) {
    return SO_WINANSI.has(fonte) ? winAnsi(t) : t;
}
/** Texto simples (petição escrita, .txt) como documento do editor. */
function textoParaDoc(t) {
    return { type: 'doc', content: t.split(/\r?\n/).map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}
//# sourceMappingURL=pdfDocumento.js.map