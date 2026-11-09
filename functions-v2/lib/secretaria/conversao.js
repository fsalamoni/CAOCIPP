"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversivel = exports.MIME_XLSX = exports.MIME_DOCX = void 0;
exports.larguraImagem = larguraImagem;
exports.htmlParaDoc = htmlParaDoc;
exports.xlsxParaDoc = xlsxParaDoc;
exports.officeParaDoc = officeParaDoc;
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const node_html_parser_1 = require("node-html-parser");
const documento_1 = require("../shared/documento");
/**
 * Converte arquivos do Office enviados aos autos em documento do editor, que
 * vira PDF com o mesmo renderizador dos textos redigidos. Word (DOCX) passa
 * por HTML (mammoth); planilhas (XLSX) viram tabelas, uma por aba.
 * ponytail: DOC e ODT antigos continuam como folha de referência; converter
 * esses exige LibreOffice num serviço à parte.
 */
exports.MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
exports.MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const conversivel = (mime) => mime === exports.MIME_DOCX || mime === exports.MIME_XLSX;
exports.conversivel = conversivel;
const MAX_ABAS = 10;
const MAX_LINHAS = 400;
const MAX_COLUNAS = 20;
const LARGURA_UTIL_PX = 605;
/** Largura em px de uma imagem PNG/JPEG em data URL (lida do cabeçalho). */
function larguraImagem(dataUrl) {
    const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 1 + 70000), 'base64');
    if (b[0] === 0x89 && b[1] === 0x50)
        return b.readUInt32BE(16);
    if (b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 9 < b.length) {
            if (b[i] !== 0xff) {
                i++;
                continue;
            }
            const m = b[i + 1];
            if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
                return b.readUInt16BE(i + 7);
            i += 2 + b.readUInt16BE(i + 2);
        }
    }
    return null;
}
const MARCAS = {
    strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', del: 'strike', strike: 'strike',
    sup: 'superscript', sub: 'subscript', code: 'code',
};
function inline(n, marcas, saida, imagens) {
    var _a;
    if (n.nodeType === node_html_parser_1.NodeType.TEXT_NODE) {
        const t = n.text.replace(/\s+/g, ' ');
        if (t)
            saida.push(marcas.length ? { type: 'text', text: t, marks: marcas } : { type: 'text', text: t });
        return;
    }
    if (n.nodeType !== node_html_parser_1.NodeType.ELEMENT_NODE)
        return;
    const el = n;
    const tag = (_a = el.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (tag === 'br') {
        saida.push({ type: 'hardBreak' });
        return;
    }
    if (tag === 'img') {
        imagens.push(imagem(el));
        return;
    }
    let novas = marcas;
    if (MARCAS[tag])
        novas = [...marcas, { type: MARCAS[tag] }];
    if (tag === 'a' && el.getAttribute('href'))
        novas = [...marcas, { type: 'link', attrs: { href: el.getAttribute('href') } }];
    el.childNodes.forEach((c) => inline(c, novas, saida, imagens));
}
function imagem(el) {
    const src = el.getAttribute('src') || '';
    const w = larguraImagem(src);
    return { type: 'image', attrs: Object.assign({ src, alt: el.getAttribute('alt') || '' }, (w ? { width: Math.max(10, Math.min(w, LARGURA_UTIL_PX)) } : {})) };
}
/** Parágrafo (ou título) a partir dos filhos inline; imagens viram blocos à parte. */
function paragrafo(el, tipo = 'paragraph', level) {
    const conteudo = [];
    const imagens = [];
    el.childNodes.forEach((c) => inline(c, [], conteudo, imagens));
    const limpo = conteudo.length && conteudo.every((x) => x.type === 'text' && !String(x.text).trim()) ? [] : conteudo;
    const bloco = Object.assign(Object.assign({ type: tipo }, (level ? { attrs: { level } } : {})), (limpo.length ? { content: limpo } : {}));
    return [...(limpo.length || !imagens.length ? [bloco] : []), ...imagens];
}
function blocos(el) {
    const out = [];
    let soltos = [];
    const fecharSoltos = () => {
        if (soltos.some((x) => x.nodeType === node_html_parser_1.NodeType.ELEMENT_NODE || x.text.trim())) {
            const wrapper = (0, node_html_parser_1.parse)('<p></p>').firstChild;
            soltos.forEach((x) => wrapper.appendChild(x));
            out.push(...paragrafo(wrapper));
        }
        soltos = [];
    };
    for (const n of el.childNodes) {
        const tag = n.nodeType === node_html_parser_1.NodeType.ELEMENT_NODE ? n.tagName.toLowerCase() : '';
        const e = n;
        if (/^h[1-6]$/.test(tag)) {
            fecharSoltos();
            out.push(...paragrafo(e, 'heading', Math.min(Number(tag[1]), 4)));
            continue;
        }
        if (tag === 'p') {
            fecharSoltos();
            out.push(...paragrafo(e));
            continue;
        }
        if (tag === 'ul' || tag === 'ol') {
            fecharSoltos();
            const itens = e.childNodes.filter((x) => x.nodeType === node_html_parser_1.NodeType.ELEMENT_NODE && x.tagName.toLowerCase() === 'li')
                .map((li) => ({ type: 'listItem', content: blocosOuVazio(li) }));
            if (itens.length)
                out.push({ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: itens });
            continue;
        }
        if (tag === 'table') {
            fecharSoltos();
            const t = tabelaHtml(e);
            if (t)
                out.push(t);
            continue;
        }
        if (tag === 'blockquote') {
            fecharSoltos();
            out.push({ type: 'blockquote', content: blocosOuVazio(e) });
            continue;
        }
        if (tag === 'hr') {
            fecharSoltos();
            out.push({ type: 'horizontalRule' });
            continue;
        }
        if (['div', 'section', 'article', 'body', 'thead', 'tbody'].includes(tag)) {
            fecharSoltos();
            out.push(...blocos(e));
            continue;
        }
        soltos.push(n);
    }
    fecharSoltos();
    return out;
}
const blocosOuVazio = (el) => {
    const b = blocos(el);
    return b.length ? b : [{ type: 'paragraph' }];
};
function tabelaHtml(el) {
    const linhas = el.querySelectorAll('tr').slice(0, MAX_LINHAS).map((tr) => ({
        type: 'tableRow',
        content: tr.childNodes
            .filter((x) => x.nodeType === node_html_parser_1.NodeType.ELEMENT_NODE && ['td', 'th'].includes(x.tagName.toLowerCase()))
            .slice(0, MAX_COLUNAS)
            .map((c) => {
            const ce = c;
            const colspan = Number(ce.getAttribute('colspan')) || 1;
            const rowspan = Number(ce.getAttribute('rowspan')) || 1;
            return {
                type: ce.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'tableCell',
                attrs: { colspan, rowspan },
                content: blocosOuVazio(ce),
            };
        }),
    })).filter((r) => r.content.length);
    return linhas.length ? { type: 'table', content: linhas } : null;
}
/** HTML simples (do mammoth) em documento do editor, já saneado. */
function htmlParaDoc(html) {
    const raiz = (0, node_html_parser_1.parse)(`<div>${html}</div>`).firstChild;
    const content = blocos(raiz);
    return (0, documento_1.sanitizeDoc)({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
}
const celula = (v, cab = false) => ({
    type: cab ? 'tableHeader' : 'tableCell',
    content: [Object.assign({ type: 'paragraph' }, (v === '' || v == null ? {} : { content: [{ type: 'text', text: String(v) }] }))],
});
/** Planilha: cada aba vira um título e uma tabela (primeira linha como cabeçalho). */
function xlsxParaDoc(buf) {
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true, dense: true });
    const content = [];
    for (const nome of wb.SheetNames.slice(0, MAX_ABAS)) {
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, blankrows: false, defval: '' });
        content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: `Planilha: ${nome}` }] });
        if (!linhas.length) {
            content.push({ type: 'paragraph', content: [{ type: 'text', text: '(aba vazia)' }] });
            continue;
        }
        const cols = Math.min(MAX_COLUNAS, Math.max(...linhas.map((l) => l.length)));
        const corte = linhas.slice(0, MAX_LINHAS);
        content.push({
            type: 'table',
            content: corte.map((l, i) => ({ type: 'tableRow', content: Array.from({ length: cols }, (_, j) => celula(l[j], i === 0)) })),
        });
        if (linhas.length > MAX_LINHAS || linhas.some((l) => l.length > MAX_COLUNAS)) {
            content.push({ type: 'paragraph', content: [{ type: 'text', text: `Mostradas até ${MAX_LINHAS} linhas e ${MAX_COLUNAS} colunas; o arquivo original completo está nos autos eletrônicos.`, marks: [{ type: 'italic' }] }] });
        }
    }
    if (wb.SheetNames.length > MAX_ABAS)
        content.push({ type: 'paragraph', content: [{ type: 'text', text: `Mostradas ${MAX_ABAS} de ${wb.SheetNames.length} abas.` }] });
    return (0, documento_1.sanitizeDoc)({ type: 'doc', content });
}
/** Documento do editor equivalente ao arquivo, ou null se não for conversível. */
async function officeParaDoc(buf, mime) {
    if (mime === exports.MIME_DOCX)
        return htmlParaDoc((await mammoth.convertToHtml({ buffer: buf })).value);
    if (mime === exports.MIME_XLSX)
        return xlsxParaDoc(buf);
    return null;
}
//# sourceMappingURL=conversao.js.map