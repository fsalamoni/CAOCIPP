import type { HTMLElement, Node } from 'node-html-parser';
// Bibliotecas pesadas carregadas só quando usadas (partida a frio das functions).
const mammoth = () => require('mammoth') as typeof import('mammoth');
const xlsx = () => require('xlsx') as typeof import('xlsx');
const htmlParser = () => require('node-html-parser') as typeof import('node-html-parser');
import { Marca, No, sanitizeDoc } from '../shared/documento';

/**
 * Converte arquivos do Office enviados aos autos em documento do editor, que
 * vira PDF com o mesmo renderizador dos textos redigidos. Word (DOCX) e
 * LibreOffice (ODT) são lidos direto do XML, com a formatação (docx.ts,
 * odt.ts); Word antigo (DOC) só dá o texto; planilhas (XLSX) viram tabelas,
 * uma por aba. Arquivo juntado antes de 16/11/2026 usa a conversão antiga
 * (mammoth) para não mudar as folhas já numeradas.
 */

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIME_ODT = 'application/vnd.oasis.opendocument.text';
export const MIME_DOC = 'application/msword';
/** Formatos que viram PDF pelo editor. `legado`: como era antes de 16/11/2026 (só Word novo e planilha). */
export const conversivel = (mime: string, legado = false) => mime === MIME_DOCX || mime === MIME_XLSX || (!legado && (mime === MIME_ODT || mime === MIME_DOC));

const MAX_ABAS = 10;
const MAX_LINHAS = 400;
const MAX_COLUNAS = 20;
const LARGURA_UTIL_PX = 605;

/** Largura em px de uma imagem PNG/JPEG em data URL (lida do cabeçalho). */
export function larguraImagem(dataUrl: string): number | null {
    const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 1 + 70000), 'base64');
    if (b[0] === 0x89 && b[1] === 0x50) return b.readUInt32BE(16);
    if (b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 9 < b.length) {
            if (b[i] !== 0xff) { i++; continue; }
            const m = b[i + 1];
            if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return b.readUInt16BE(i + 7);
            i += 2 + b.readUInt16BE(i + 2);
        }
    }
    return null;
}

const MARCAS: Record<string, Marca['type']> = {
    strong: 'bold', b: 'bold', em: 'italic', i: 'italic', u: 'underline', s: 'strike', del: 'strike', strike: 'strike',
    sup: 'superscript', sub: 'subscript', code: 'code',
};

function inline(n: Node, marcas: Marca[], saida: No[], imagens: No[]) {
    if (n.nodeType === htmlParser().NodeType.TEXT_NODE) {
        const t = n.text.replace(/\s+/g, ' ');
        if (t) saida.push(marcas.length ? { type: 'text', text: t, marks: marcas } : { type: 'text', text: t });
        return;
    }
    if (n.nodeType !== htmlParser().NodeType.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'br') { saida.push({ type: 'hardBreak' }); return; }
    if (tag === 'img') { imagens.push(imagem(el)); return; }
    let novas = marcas;
    if (MARCAS[tag]) novas = [...marcas, { type: MARCAS[tag] }];
    if (tag === 'a' && el.getAttribute('href')) novas = [...marcas, { type: 'link', attrs: { href: el.getAttribute('href') } }];
    el.childNodes.forEach((c) => inline(c, novas, saida, imagens));
}

function imagem(el: HTMLElement): No {
    const src = el.getAttribute('src') || '';
    const w = larguraImagem(src);
    return { type: 'image', attrs: { src, alt: el.getAttribute('alt') || '', ...(w ? { width: Math.max(10, Math.min(w, LARGURA_UTIL_PX)) } : {}) } };
}

/** Parágrafo (ou título) a partir dos filhos inline; imagens viram blocos à parte. */
function paragrafo(el: HTMLElement, tipo: 'paragraph' | 'heading' = 'paragraph', level?: number): No[] {
    const conteudo: No[] = [];
    const imagens: No[] = [];
    el.childNodes.forEach((c) => inline(c, [], conteudo, imagens));
    const limpo = conteudo.length && conteudo.every((x) => x.type === 'text' && !String(x.text).trim()) ? [] : conteudo;
    const bloco: No = { type: tipo, ...(level ? { attrs: { level } } : {}), ...(limpo.length ? { content: limpo } : {}) };
    return [...(limpo.length || !imagens.length ? [bloco] : []), ...imagens];
}

function blocos(el: HTMLElement): No[] {
    const out: No[] = [];
    let soltos: Node[] = [];
    const fecharSoltos = () => {
        if (soltos.some((x) => x.nodeType === htmlParser().NodeType.ELEMENT_NODE || x.text.trim())) {
            const wrapper = htmlParser().parse('<p></p>').firstChild as HTMLElement;
            soltos.forEach((x) => wrapper.appendChild(x));
            out.push(...paragrafo(wrapper));
        }
        soltos = [];
    };
    for (const n of el.childNodes) {
        const tag = n.nodeType === htmlParser().NodeType.ELEMENT_NODE ? (n as HTMLElement).tagName.toLowerCase() : '';
        const e = n as HTMLElement;
        if (/^h[1-6]$/.test(tag)) { fecharSoltos(); out.push(...paragrafo(e, 'heading', Math.min(Number(tag[1]), 4))); continue; }
        if (tag === 'p') { fecharSoltos(); out.push(...paragrafo(e)); continue; }
        if (tag === 'ul' || tag === 'ol') {
            fecharSoltos();
            const itens = e.childNodes.filter((x) => x.nodeType === htmlParser().NodeType.ELEMENT_NODE && (x as HTMLElement).tagName.toLowerCase() === 'li')
                .map((li) => ({ type: 'listItem', content: blocosOuVazio(li as HTMLElement) }));
            if (itens.length) out.push({ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: itens });
            continue;
        }
        if (tag === 'table') { fecharSoltos(); const t = tabelaHtml(e); if (t) out.push(t); continue; }
        if (tag === 'blockquote') { fecharSoltos(); out.push({ type: 'blockquote', content: blocosOuVazio(e) }); continue; }
        if (tag === 'hr') { fecharSoltos(); out.push({ type: 'horizontalRule' }); continue; }
        if (['div', 'section', 'article', 'body', 'thead', 'tbody'].includes(tag)) { fecharSoltos(); out.push(...blocos(e)); continue; }
        soltos.push(n);
    }
    fecharSoltos();
    return out;
}

const blocosOuVazio = (el: HTMLElement): No[] => {
    const b = blocos(el);
    return b.length ? b : [{ type: 'paragraph' }];
};

function tabelaHtml(el: HTMLElement): No | null {
    const linhas = el.querySelectorAll('tr').slice(0, MAX_LINHAS).map((tr) => ({
        type: 'tableRow',
        content: tr.childNodes
            .filter((x) => x.nodeType === htmlParser().NodeType.ELEMENT_NODE && ['td', 'th'].includes((x as HTMLElement).tagName.toLowerCase()))
            .slice(0, MAX_COLUNAS)
            .map((c) => {
                const ce = c as HTMLElement;
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
export function htmlParaDoc(html: string): No {
    const raiz = htmlParser().parse(`<div>${html}</div>`).firstChild as HTMLElement;
    const content = blocos(raiz);
    return sanitizeDoc({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
}

const celula = (v: unknown, cab = false): No => ({
    type: cab ? 'tableHeader' : 'tableCell',
    content: [{ type: 'paragraph', ...(v === '' || v == null ? {} : { content: [{ type: 'text', text: String(v) }] }) }],
});

/** Planilha: cada aba vira um título e uma tabela (primeira linha como cabeçalho). */
export function xlsxParaDoc(buf: Buffer): No {
    const wb = xlsx().read(buf, { type: 'buffer', cellDates: true, dense: true });
    const content: No[] = [];
    for (const nome of wb.SheetNames.slice(0, MAX_ABAS)) {
        const linhas = xlsx().utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: false, blankrows: false, defval: '' });
        content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: `Planilha: ${nome}` }] });
        if (!linhas.length) { content.push({ type: 'paragraph', content: [{ type: 'text', text: '(aba vazia)' }] }); continue; }
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
    if (wb.SheetNames.length > MAX_ABAS) content.push({ type: 'paragraph', content: [{ type: 'text', text: `Mostradas ${MAX_ABAS} de ${wb.SheetNames.length} abas.` }] });
    return sanitizeDoc({ type: 'doc', content });
}

/** Texto de um Word antigo (.doc, binário): só o texto, parágrafo a parágrafo. */
export async function docParaDoc(buf: Buffer): Promise<No> {
    const Extrator = require('word-extractor') as new () => { extract(b: Buffer): Promise<{ getBody(): string; getFootnotes(): string }> };
    const d = await new Extrator().extract(buf);
    const paras = d.getBody().replace(/\r/g, '\n').split('\n').map((l) => l.replace(/\t/g, '    ').trimEnd());
    while (paras.length && !paras[paras.length - 1]) paras.pop();
    const notas = d.getFootnotes().trim();
    const content: No[] = paras.map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' }));
    if (notas) content.push({ type: 'horizontalRule' }, ...notas.split(/\n+/).map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })));
    return sanitizeDoc({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
}

/**
 * Documento do editor equivalente ao arquivo, ou null se não for conversível.
 * `legado`: a conversão de antes de 16/11/2026 (mammoth), para refazer as
 * folhas de um arquivo juntado antes sem mudar a paginação.
 */
export async function officeParaDoc(buf: Buffer, mime: string, legado = false): Promise<No | null> {
    if (mime === MIME_XLSX) return xlsxParaDoc(buf);
    if (legado) return mime === MIME_DOCX ? htmlParaDoc((await mammoth().convertToHtml({ buffer: buf })).value) : null;
    if (mime === MIME_DOCX) return (await (require('./docx') as typeof import('./docx')).docxParaDoc(buf)).doc;
    if (mime === MIME_ODT) return (await (require('./odt') as typeof import('./odt')).odtParaDoc(buf)).doc;
    if (mime === MIME_DOC) return docParaDoc(buf);
    return null;
}
