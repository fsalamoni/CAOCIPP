import type { Content, ContentText, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
// pdfmake e pdf-lib carregados só quando usados (partida a frio das functions).
const pdfLib = () => require('pdf-lib') as typeof import('pdf-lib');
import { FONTES, FONTES_LEGADO, No } from '../shared/documento';
import { Layout, estiloDoBloco, folha, layoutDe, margens, numerosAutomaticos } from '../shared/layoutDocumento';

/**
 * Converte o documento do editor em PDF (A4), com cabeçalho do órgão, rodapé
 * paginado e bloco de assinaturas. É o que entra nos autos na juntada.
 */

let impressora: import('pdfmake') | undefined;
function printer() {
    if (impressora) return impressora;
    const PdfPrinter = require('pdfmake') as typeof import('pdfmake');
    const vfs = require('pdfmake/build/vfs_fonts') as Record<string, string>;
    const ttf = (n: string) => Buffer.from(vfs[n], 'base64');
    // Arquivos TTF dos pacotes de fonte (o pdfkit embute só os caracteres usados).
    const familia = (nome: string, pacote = nome.toLowerCase()) => {
        const arq = (estilo: string) => require.resolve(`@expo-google-fonts/${pacote}/${estilo}/${nome}_${estilo}.ttf`);
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
    /** Documento juntado antes de 16/11/2026 refeito do conteúdo: fontes antigas, mesma paginação. */
    legado?: boolean;
}

const CM = 28.3465;

/** Fontes padrão do PDF só codificam WinAnsi; Roboto cobre o resto. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function winAnsi(t: string): string {
    return Array.from(t).map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?')).join('');
}
export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

/** Fontes padrão do PDF (sem arquivo embutido): só WinAnsi. */
const SO_WINANSI = new Set(['Times', 'Courier']);
type Mapa = Record<string, string>;

/** O que o desenho de cada bloco precisa saber do documento inteiro. */
interface Ctx { mapa: Mapa; layout: Layout; numeros: Map<No, string>; citacao?: boolean; semRecuo?: boolean }

function inline(nos: No[] | undefined, fonte: string, mapa: Mapa, maiusculas = false): ContentText[] {
    const out: ContentText[] = [];
    for (const n of nos || []) {
        if (n.type === 'hardBreak') { out.push({ text: '\n' }); continue; }
        if (n.type !== 'text' || !n.text) continue;
        const t: ContentText & Record<string, unknown> = { text: maiusculas ? n.text.toLocaleUpperCase('pt-BR') : n.text };
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
            else if (m.type === 'code') f = mapa.monospace;
            else if (m.type === 'highlight') t.background = String(a.color || '#fef08a');
            else if (m.type === 'link') { t.link = String(a.href); t.color = t.color || '#1d4ed8'; deco.push('underline'); }
            else if (m.type === 'textStyle') {
                if (a.color) t.color = String(a.color);
                if (a.backgroundColor) t.background = String(a.backgroundColor);
                if (a.fontSize) t.fontSize = parseFloat(String(a.fontSize));
                if (a.fontFamily && mapa[String(a.fontFamily)]) f = mapa[String(a.fontFamily)];
            }
        }
        if (deco.length) t.decoration = deco.length === 1 ? deco[0] : deco;
        if (f !== fonte) t.font = f;
        if (SO_WINANSI.has(f)) t.text = winAnsi(String(t.text));
        out.push(t);
    }
    return out;
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

function bloco(n: No, fonte: string, largura: number, ctx: Ctx): Content | null {
    const a = n.attrs || {};
    const { mapa } = ctx;
    const liCtx = { ...ctx, semRecuo: true };
    const filhos = (nos?: No[], l = largura, c = ctx) => (nos || []).map((x) => bloco(x, fonte, l, c)).filter(Boolean) as Content[];
    switch (n.type) {
        case 'paragraph':
        case 'heading': {
            // Estilo do documento (Normal, Título, Citação ou próprio); o que está no parágrafo vale mais.
            const e = estiloDoBloco(ctx.layout, n, ctx.citacao);
            const f = (e.fonte && mapa[e.fonte]) || fonte;
            const textos = inline(n.content, f, mapa, e.maiusculas);
            const numero = ctx.numeros.get(n);
            if (numero) textos.unshift({ text: winAnsiSe(f, `${numero} `) });
            const antes = num(a.antes) ?? e.antes ?? 0;
            const depois = num(a.depois) ?? e.depois ?? 6;
            const recuo = num(a.recuo) ?? (ctx.semRecuo ? 0 : e.recuo) ?? 0;
            const esq = num(a.margemEsq) ?? e.margemEsq ?? 0;
            const dir = num(a.margemDir) ?? e.margemDir ?? 0;
            return {
                text: textos.length ? textos : ' ',
                alignment: (a.textAlign as 'left' | 'center' | 'right' | 'justify') || e.alinhamento || 'left',
                leadingIndent: recuo * CM,
                lineHeight: num(a.espacamento) || e.espacamento || 1.15,
                margin: [esq * CM, antes, dir * CM, depois],
                ...(f !== fonte ? { font: f } : {}),
                ...(e.tamanho ? { fontSize: e.tamanho } : {}),
                ...(e.negrito ? { bold: true } : {}),
                ...(e.italico ? { italics: true } : {}),
                ...(e.sublinhado ? { decoration: 'underline' } : {}),
                ...(e.cor ? { color: e.cor } : {}),
            } as Content;
        }
        case 'bulletList': {
            // Marcador escolhido: •, ◦, ▪ ou travessão (desenhado à parte, como no Word).
            const travessao = a.marcador === 'dash';
            const itens = (n.content || []).map((li) => (travessao
                ? { columns: [{ text: '–', width: 12 }, { stack: filhos(li.content, largura - 32, liCtx), width: '*' }] }
                : { stack: filhos(li.content, largura - 20, liCtx) }));
            return { ul: itens, ...(travessao ? { type: 'none' } : a.marcador && a.marcador !== 'disc' ? { type: a.marcador } : {}), margin: [0, 0, 0, 6] } as Content;
        }
        case 'orderedList':
            return {
                ol: (n.content || []).map((li) => ({ stack: filhos(li.content, largura - 20, liCtx) })), start: Number(a.start) || 1, margin: [0, 0, 0, 6],
                ...(a.formato && a.formato !== 'decimal' ? { type: a.formato } : {}), ...(a.separador === ')' ? { separator: ')' } : {}),
            } as Content;
        case 'blockquote':
            return {
                table: { widths: ['*'], body: [[{ stack: filhos(n.content, largura - 24, { ...ctx, citacao: true }) }]] },
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
            return { image: String(a.src), width: w, margin: [0, 4, 0, 8], alignment: (a.align as 'left' | 'center' | 'right') || 'left' } as Content;
        }
        case 'table':
            return tabela(n, fonte, largura, ctx);
        default:
            return n.content ? { stack: filhos(n.content) } as Content : null;
    }
}

/** Tabela do editor → pdfmake, respeitando células mescladas. */
function tabela(n: No, fonte: string, largura: number, ctx: Ctx): Content {
    const linhas = n.content || [];
    const grade: TableCell[][] = linhas.map(() => []);
    const larguras: Array<number | null> = []; // px de tela por coluna, das células (colwidth)
    let colunas = 0;
    linhas.forEach((tr, r) => {
        let c = 0;
        for (const cel of tr.content || []) {
            while (grade[r][c] !== undefined) c++;
            const cs = Number(cel.attrs?.colspan) || 1;
            const rs = Number(cel.attrs?.rowspan) || 1;
            const cabec = cel.type === 'tableHeader';
            const cw = cel.attrs?.colwidth as number[] | null | undefined;
            if (Array.isArray(cw)) cw.forEach((w, j) => { if (larguras[c + j] == null && Number(w) > 0) larguras[c + j] = Number(w); });
            const conteudo = (cel.content || []).map((b) => bloco(b, fonte, largura / 2, { ...ctx, semRecuo: true })).filter(Boolean) as Content[];
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
    const linha = n.attrs?.semBordas ? 0 : 0.6;
    return {
        table: { widths: largurasColunas(larguras, colunas, largura), body: grade.length ? grade : [[' ']], headerRows: cabecalhos > 0 ? cabecalhos : 0, dontBreakRows: false },
        layout: { hLineColor: () => '#94a3b8', vLineColor: () => '#94a3b8', hLineWidth: () => linha, vLineWidth: () => linha, paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3 },
        margin: [0, 2, 0, 8],
    } as Content;
}

/**
 * Larguras das colunas no PDF: as que o editor guardou (arrastadas na tela ou
 * vindas do Word), na mesma proporção; sem nenhuma, colunas iguais.
 */
export function largurasColunas(px: Array<number | null>, colunas: number, largura: number): Array<number | '*'> {
    const lista = Array.from({ length: colunas }, (_, i) => px[i] ?? null);
    const conhecidas = lista.filter((w): w is number => w !== null);
    if (!conhecidas.length) return Array(colunas).fill('*');
    const media = conhecidas.reduce((s, w) => s + w, 0) / conhecidas.length;
    const todas = lista.map((w) => w ?? media);
    const total = todas.reduce((s, w) => s + w, 0);
    // Cabe na área útil, descontando o recheio das células (5 + 5 pt) e as linhas.
    const util = largura - colunas * 10 - (colunas + 1) * 0.6;
    const escala = Math.min(1, util / (total * 0.75));
    return todas.map((w) => Math.max(12, Math.round(w * 0.75 * escala * 100) / 100));
}

/** Documento do editor → PDF. Devolve os bytes e o número de páginas. */
export async function renderizarDocumento(doc: No, cfg: ConfigDocumento = {}, meta: MetaDocumento = {}): Promise<{ buffer: Buffer; paginas: number }> {
    const mapa = meta.legado ? FONTES_LEGADO : FONTES;
    // Papel, margens e estilos do documento (doc.attrs.layout); sem eles, A4 com 3/2/2,5/2,2 cm.
    const layout = layoutDe(doc);
    const normal = estiloDoBloco(layout, { type: 'paragraph' });
    const fonte = mapa[String(normal.fonte || cfg.fonte_padrao || 'serif')] || mapa.serif;
    const { w, h } = folha(layout);
    const mg = margens(layout);
    const MARGENS: [number, number, number, number] = [mg.esq * CM, 0, mg.dir * CM, 0];
    const areaUtil = w * CM - MARGENS[0] - MARGENS[2];
    const linhas = meta.semCabecalho ? [] : (cfg.cabecalho_linhas || []).filter(Boolean);
    const brasao = meta.semCabecalho ? null : cfg.brasao || null;
    const temCabecalho = linhas.length > 0 || !!brasao;
    // Com timbrado, o texto começa abaixo dele (como sempre); margem superior própria só se for maior.
    const altCab = 40 + (brasao ? 50 : 0) + linhas.length * 13;
    const topo = temCabecalho ? Math.max(altCab, layout.margens ? mg.sup * CM : 0) : mg.sup * CM;

    const ctx: Ctx = { mapa, layout, numeros: numerosAutomaticos(doc) };
    const corpo = (doc.content || []).map((b) => bloco(b, fonte, areaUtil, ctx)).filter(Boolean) as Content[];
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
        pageSize: { width: Math.round(w * CM * 100) / 100, height: Math.round(h * CM * 100) / 100 },
        pageMargins: [MARGENS[0], topo, MARGENS[2], mg.inf * CM],
        defaultStyle: { font: fonte, fontSize: normal.tamanho || Number(cfg.tamanho_padrao) || 12, lineHeight: 1.15 },
        info: { creator: 'SIGO — Processo Eletrônico', producer: 'SIGO' },
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
    const pdf = printer().createPdfKitDocument(def);
    const partes: Buffer[] = [];
    const buffer = await new Promise<Buffer>((ok, erro) => {
        pdf.on('data', (b: Buffer) => partes.push(b));
        pdf.on('end', () => ok(Buffer.concat(partes)));
        pdf.on('error', erro);
        pdf.end();
    });
    const paginas = (await pdfLib().PDFDocument.load(buffer)).getPageCount();
    return { buffer, paginas };
}

function winAnsiSe(fonte: string, t: string) {
    return SO_WINANSI.has(fonte) ? winAnsi(t) : t;
}

/** Texto simples (petição escrita, .txt) como documento do editor. */
export function textoParaDoc(t: string): No {
    return { type: 'doc', content: t.split(/\r?\n/).map((l) => (l ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) };
}
