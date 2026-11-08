"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataHora = void 0;
exports.winAnsi = winAnsi;
exports.renderizarDocumento = renderizarDocumento;
exports.textoParaDoc = textoParaDoc;
const PdfPrinter = require("pdfmake");
const pdf_lib_1 = require("pdf-lib");
const documento_1 = require("../shared/documento");
/**
 * Converte o documento do editor em PDF (A4), com cabeçalho do órgão, rodapé
 * paginado e bloco de assinaturas. É o que entra nos autos na juntada.
 */
const vfsFontes = require("pdfmake/build/vfs_fonts");
const vfs = vfsFontes;
const ttf = (n) => Buffer.from(vfs[n], 'base64');
const printer = new PdfPrinter({
    Roboto: { normal: ttf('Roboto-Regular.ttf'), bold: ttf('Roboto-Medium.ttf'), italics: ttf('Roboto-Italic.ttf'), bolditalics: ttf('Roboto-MediumItalic.ttf') },
    Times: { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' },
    Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
});
const CM = 28.3465;
const A4_LARGURA = 595.28;
const MARGENS = [3 * CM, 0, 2 * CM, 0];
const AREA_UTIL = A4_LARGURA - MARGENS[0] - MARGENS[2];
const TITULOS = { 1: 18, 2: 15, 3: 13, 4: 12 };
/** Fontes padrão do PDF só codificam WinAnsi; Roboto cobre o resto. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function winAnsi(t) {
    return Array.from(t).map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?')).join('');
}
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
exports.dataHora = dataHora;
function inline(nos, fonte) {
    const out = [];
    for (const n of nos || []) {
        if (n.type === 'hardBreak') {
            out.push({ text: '\n' });
            continue;
        }
        if (n.type !== 'text' || !n.text)
            continue;
        const t = { text: n.text };
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
                f = 'Courier';
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
                if (a.fontFamily && documento_1.FONTES[String(a.fontFamily)])
                    f = documento_1.FONTES[String(a.fontFamily)];
            }
        }
        if (deco.length)
            t.decoration = deco.length === 1 ? deco[0] : deco;
        if (f !== fonte)
            t.font = f;
        if (f !== 'Roboto')
            t.text = winAnsi(String(t.text));
        out.push(t);
    }
    return out;
}
function bloco(n, fonte, largura) {
    const a = n.attrs || {};
    const filhos = (nos, l = largura) => (nos || []).map((c) => bloco(c, fonte, l)).filter(Boolean);
    switch (n.type) {
        case 'paragraph':
        case 'heading': {
            const textos = inline(n.content, fonte);
            const titulo = n.type === 'heading';
            return Object.assign({ text: textos.length ? textos : ' ', alignment: a.textAlign || 'left', leadingIndent: a.recuo ? Number(a.recuo) * CM : 0, lineHeight: Number(a.espacamento) || 1.15, margin: [a.margemEsq ? Number(a.margemEsq) * CM : 0, titulo ? 8 : 0, 0, titulo ? 6 : 6] }, (titulo ? { bold: true, fontSize: TITULOS[Number(a.level)] || 13 } : {}));
        }
        case 'bulletList':
            return { ul: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20) })), margin: [0, 0, 0, 6] };
        case 'orderedList':
            return { ol: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20) })), start: Number(a.start) || 1, margin: [0, 0, 0, 6] };
        case 'blockquote':
            return {
                table: { widths: ['*'], body: [[{ stack: filhos(n.content, largura - 24) }]] },
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
            return { image: String(a.src), width: w, margin: [0, 4, 0, 8] };
        }
        case 'table':
            return tabela(n, fonte, largura);
        default:
            return n.content ? { stack: filhos(n.content) } : null;
    }
}
/** Tabela do editor → pdfmake, respeitando células mescladas. */
function tabela(n, fonte, largura) {
    const linhas = n.content || [];
    const grade = linhas.map(() => []);
    let colunas = 0;
    linhas.forEach((tr, r) => {
        var _a, _b;
        let c = 0;
        for (const cel of tr.content || []) {
            while (grade[r][c] !== undefined)
                c++;
            const cs = Number((_a = cel.attrs) === null || _a === void 0 ? void 0 : _a.colspan) || 1;
            const rs = Number((_b = cel.attrs) === null || _b === void 0 ? void 0 : _b.rowspan) || 1;
            const cabec = cel.type === 'tableHeader';
            const conteudo = (cel.content || []).map((b) => bloco(b, fonte, largura / 2)).filter(Boolean);
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
    return {
        table: { widths: Array(colunas).fill('*'), body: grade.length ? grade : [[' ']], headerRows: cabecalhos > 0 ? cabecalhos : 0, dontBreakRows: false },
        layout: { hLineColor: () => '#94a3b8', vLineColor: () => '#94a3b8', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3 },
        margin: [0, 2, 0, 8],
    };
}
/** Documento do editor → PDF. Devolve os bytes e o número de páginas. */
async function renderizarDocumento(doc, cfg = {}, meta = {}) {
    const fonte = documento_1.FONTES[String(cfg.fonte_padrao || 'serif')] || 'Times';
    const linhas = meta.semCabecalho ? [] : (cfg.cabecalho_linhas || []).filter(Boolean);
    const brasao = meta.semCabecalho ? null : cfg.brasao || null;
    const temCabecalho = linhas.length > 0 || !!brasao;
    const topo = temCabecalho ? 40 + (brasao ? 50 : 0) + linhas.length * 13 : 2.5 * CM;
    const corpo = (doc.content || []).map((b) => bloco(b, fonte, AREA_UTIL)).filter(Boolean);
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
    const def = {
        pageSize: 'A4',
        pageMargins: [MARGENS[0], topo, MARGENS[2], 2.2 * CM],
        defaultStyle: { font: fonte, fontSize: Number(cfg.tamanho_padrao) || 12, lineHeight: 1.15 },
        info: { creator: 'SIGO — Secretaria Processual', producer: 'SIGO' },
        content: corpo.length ? corpo : [{ text: ' ' }],
        header: temCabecalho ? () => ({
            margin: [MARGENS[0], 24, MARGENS[2], 0],
            stack: [
                ...(brasao ? [{ image: brasao, fit: [46, 46], alignment: 'center', margin: [0, 0, 0, 4] }] : []),
                ...linhas.map((l, i) => ({ text: winAnsiSe(fonte, l), alignment: 'center', fontSize: i === 0 ? 11 : 9, bold: i === 0, font: fonte })),
            ],
        }) : undefined,
        footer: (atual, total) => ({
            margin: [MARGENS[0], 18, MARGENS[2], 0],
            columns: [
                { text: winAnsiSe(fonte, cfg.rodape || ''), fontSize: 7.5, color: '#64748b', font: fonte },
                { text: `Página ${atual} de ${total}`, alignment: 'right', fontSize: 7.5, color: '#64748b', width: 90, font: fonte },
            ],
        }),
        watermark: meta.marcaDagua ? { text: meta.marcaDagua, opacity: 0.08, bold: true, angle: -45 } : undefined,
    };
    const pdf = printer.createPdfKitDocument(def);
    const partes = [];
    const buffer = await new Promise((ok, erro) => {
        pdf.on('data', (b) => partes.push(b));
        pdf.on('end', () => ok(Buffer.concat(partes)));
        pdf.on('error', erro);
        pdf.end();
    });
    const paginas = (await pdf_lib_1.PDFDocument.load(buffer)).getPageCount();
    return { buffer, paginas };
}
function winAnsiSe(fonte, t) {
    return fonte === 'Roboto' ? t : winAnsi(t);
}
/** Texto simples (petição escrita, .txt) como documento do editor. */
function textoParaDoc(t) {
    return { type: 'doc', content: t.split(/\r?\n/).map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}
//# sourceMappingURL=pdfDocumento.js.map