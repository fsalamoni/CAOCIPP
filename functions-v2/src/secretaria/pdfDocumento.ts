import PdfPrinter = require('pdfmake');
import type { Content, ContentText, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { PDFDocument } from 'pdf-lib';
import { FONTES, No } from '../shared/documento';

/**
 * Converte o documento do editor em PDF (A4), com cabeçalho do órgão, rodapé
 * paginado e bloco de assinaturas. É o que entra nos autos na juntada.
 */

import vfsFontes = require('pdfmake/build/vfs_fonts');
const vfs = vfsFontes as unknown as Record<string, string>;
const ttf = (n: string) => Buffer.from(vfs[n], 'base64');
const printer = new PdfPrinter({
    Roboto: { normal: ttf('Roboto-Regular.ttf'), bold: ttf('Roboto-Medium.ttf'), italics: ttf('Roboto-Italic.ttf'), bolditalics: ttf('Roboto-MediumItalic.ttf') },
    Times: { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' },
    Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
});

export interface ConfigDocumento {
    cabecalho_linhas?: string[];
    brasao?: string | null;
    rodape?: string;
    fonte_padrao?: string;
    tamanho_padrao?: number;
}
export interface MetaDocumento {
    assinaturas?: Array<{ nome: string; em: string }>;
    sha256?: string;
    marcaDagua?: string;
    semCabecalho?: boolean;
}

const CM = 28.3465;
const A4_LARGURA = 595.28;
const MARGENS: [number, number, number, number] = [3 * CM, 0, 2 * CM, 0];
const AREA_UTIL = A4_LARGURA - MARGENS[0] - MARGENS[2];
const TITULOS: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 12 };

/** Fontes padrão do PDF só codificam WinAnsi; Roboto cobre o resto. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function winAnsi(t: string): string {
    return Array.from(t).map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?')).join('');
}
export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

function inline(nos: No[] | undefined, fonte: string): ContentText[] {
    const out: ContentText[] = [];
    for (const n of nos || []) {
        if (n.type === 'hardBreak') { out.push({ text: '\n' }); continue; }
        if (n.type !== 'text' || !n.text) continue;
        const t: ContentText & Record<string, unknown> = { text: n.text };
        const deco: Array<'underline' | 'lineThrough'> = [];
        let f = fonte;
        for (const m of n.marks || []) {
            const a = m.attrs || {};
            if (m.type === 'bold') t.bold = true;
            else if (m.type === 'italic') t.italics = true;
            else if (m.type === 'underline') deco.push('underline');
            else if (m.type === 'strike') deco.push('lineThrough');
            else if (m.type === 'subscript') t.sub = true;
            else if (m.type === 'superscript') t.sup = true;
            else if (m.type === 'code') f = 'Courier';
            else if (m.type === 'highlight') t.background = String(a.color || '#fef08a');
            else if (m.type === 'link') { t.link = String(a.href); t.color = t.color || '#1d4ed8'; deco.push('underline'); }
            else if (m.type === 'textStyle') {
                if (a.color) t.color = String(a.color);
                if (a.backgroundColor) t.background = String(a.backgroundColor);
                if (a.fontSize) t.fontSize = parseFloat(String(a.fontSize));
                if (a.fontFamily && FONTES[String(a.fontFamily)]) f = FONTES[String(a.fontFamily)];
            }
        }
        if (deco.length) t.decoration = deco.length === 1 ? deco[0] : deco;
        if (f !== fonte) t.font = f;
        if (f !== 'Roboto') t.text = winAnsi(String(t.text));
        out.push(t);
    }
    return out;
}

function bloco(n: No, fonte: string, largura: number): Content | null {
    const a = n.attrs || {};
    const filhos = (nos?: No[], l = largura) => (nos || []).map((c) => bloco(c, fonte, l)).filter(Boolean) as Content[];
    switch (n.type) {
        case 'paragraph':
        case 'heading': {
            const textos = inline(n.content, fonte);
            const titulo = n.type === 'heading';
            return {
                text: textos.length ? textos : ' ',
                alignment: (a.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left',
                leadingIndent: a.recuo ? Number(a.recuo) * CM : 0,
                lineHeight: Number(a.espacamento) || 1.15,
                margin: [a.margemEsq ? Number(a.margemEsq) * CM : 0, titulo ? 8 : 0, 0, titulo ? 6 : 6],
                ...(titulo ? { bold: true, fontSize: TITULOS[Number(a.level)] || 13 } : {}),
            } as Content;
        }
        case 'bulletList':
            return { ul: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20) })), margin: [0, 0, 0, 6] } as Content;
        case 'orderedList':
            return { ol: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20) })), start: Number(a.start) || 1, margin: [0, 0, 0, 6] } as Content;
        case 'blockquote':
            return {
                table: { widths: ['*'], body: [[{ stack: filhos(n.content, largura - 24) }]] },
                layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 2 : 0), vLineColor: () => '#94a3b8', paddingLeft: () => 12, paddingRight: () => 0 },
                margin: [12, 0, 0, 8],
            } as Content;
        case 'horizontalRule':
            return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.6, lineColor: '#64748b' }], margin: [0, 6, 0, 10] } as Content;
        case 'pageBreak':
            return { text: '', pageBreak: 'after' } as Content;
        case 'image': {
            // Largura vem em px de tela (96 dpi); o PDF mede em pontos (72 por polegada).
            const w = Math.min(Number(a.width) ? Number(a.width) * 0.75 : largura, largura);
            return { image: String(a.src), width: w, margin: [0, 4, 0, 8] } as Content;
        }
        case 'table':
            return tabela(n, fonte, largura);
        default:
            return n.content ? { stack: filhos(n.content) } as Content : null;
    }
}

/** Tabela do editor → pdfmake, respeitando células mescladas. */
function tabela(n: No, fonte: string, largura: number): Content {
    const linhas = n.content || [];
    const grade: TableCell[][] = linhas.map(() => []);
    let colunas = 0;
    linhas.forEach((tr, r) => {
        let c = 0;
        for (const cel of tr.content || []) {
            while (grade[r][c] !== undefined) c++;
            const cs = Number(cel.attrs?.colspan) || 1;
            const rs = Number(cel.attrs?.rowspan) || 1;
            const cabec = cel.type === 'tableHeader';
            const conteudo = (cel.content || []).map((b) => bloco(b, fonte, largura / 2)).filter(Boolean) as Content[];
            grade[r][c] = { stack: conteudo.length ? conteudo : [' '], colSpan: cs, rowSpan: rs, ...(cabec ? { bold: true, fillColor: '#f1f5f9' } : {}) } as TableCell;
            for (let i = 0; i < rs; i++) {
                for (let j = 0; j < cs; j++) {
                    if ((i || j) && grade[r + i]) grade[r + i][c + j] = {} as TableCell;
                }
            }
            c += cs;
            colunas = Math.max(colunas, c);
        }
    });
    for (const linha of grade) for (let c = 0; c < colunas; c++) if (linha[c] === undefined) linha[c] = ' ';
    const cabecalhos = linhas.findIndex((tr) => !(tr.content || []).every((c) => c.type === 'tableHeader'));
    return {
        table: { widths: Array(colunas).fill('*'), body: grade.length ? grade : [[' ']], headerRows: cabecalhos > 0 ? cabecalhos : 0, dontBreakRows: false },
        layout: { hLineColor: () => '#94a3b8', vLineColor: () => '#94a3b8', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3 },
        margin: [0, 2, 0, 8],
    } as Content;
}

/** Documento do editor → PDF. Devolve os bytes e o número de páginas. */
export async function renderizarDocumento(doc: No, cfg: ConfigDocumento = {}, meta: MetaDocumento = {}): Promise<{ buffer: Buffer; paginas: number }> {
    const fonte = FONTES[String(cfg.fonte_padrao || 'serif')] || 'Times';
    const linhas = meta.semCabecalho ? [] : (cfg.cabecalho_linhas || []).filter(Boolean);
    const brasao = meta.semCabecalho ? null : cfg.brasao || null;
    const temCabecalho = linhas.length > 0 || !!brasao;
    const topo = temCabecalho ? 40 + (brasao ? 50 : 0) + linhas.length * 13 : 2.5 * CM;

    const corpo = (doc.content || []).map((b) => bloco(b, fonte, AREA_UTIL)).filter(Boolean) as Content[];
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
                            text: winAnsiSe(fonte, `Documento assinado eletronicamente por ${s.nome}, em ${dataHora(s.em)}, com assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I).`),
                            fontSize: 8.5, margin: [0, 0, 0, 3],
                        })),
                        ...(assinaturas.length ? [] : [{ text: 'Documento sem assinatura.', fontSize: 8.5 }]),
                        ...(meta.sha256 ? [{ text: `Código de integridade do conteúdo (SHA-256): ${meta.sha256}`, fontSize: 7, color: '#475569' }] : []),
                    ],
                }]],
            },
            layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
        } as Content);
    }

    const def: TDocumentDefinitions = {
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
        } as Content) : undefined,
        footer: (atual: number, total: number) => ({
            margin: [MARGENS[0], 18, MARGENS[2], 0],
            columns: [
                { text: winAnsiSe(fonte, cfg.rodape || ''), fontSize: 7.5, color: '#64748b', font: fonte },
                { text: `Página ${atual} de ${total}`, alignment: 'right', fontSize: 7.5, color: '#64748b', width: 90, font: fonte },
            ],
        }),
        watermark: meta.marcaDagua ? { text: meta.marcaDagua, opacity: 0.08, bold: true, angle: -45 } : undefined,
    };
    const pdf = printer.createPdfKitDocument(def);
    const partes: Buffer[] = [];
    const buffer = await new Promise<Buffer>((ok, erro) => {
        pdf.on('data', (b: Buffer) => partes.push(b));
        pdf.on('end', () => ok(Buffer.concat(partes)));
        pdf.on('error', erro);
        pdf.end();
    });
    const paginas = (await PDFDocument.load(buffer)).getPageCount();
    return { buffer, paginas };
}

function winAnsiSe(fonte: string, t: string) {
    return fonte === 'Roboto' ? t : winAnsi(t);
}

/** Texto simples (petição escrita, .txt) como documento do editor. */
export function textoParaDoc(t: string): No {
    return { type: 'doc', content: t.split(/\r?\n/).map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}
