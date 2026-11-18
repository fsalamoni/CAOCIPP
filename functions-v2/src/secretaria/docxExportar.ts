const jszip = () => require('jszip') as typeof import('jszip');
import { Marca, No } from '../shared/documento';
import type { ConfigDocumento } from './pdfDocumento';
import { ChaveEstilo, ESTILOS_PADRAO, Estilo, Layout, estiloDoBloco, folha, layoutDe, margens, numerosAutomaticos } from '../shared/layoutDocumento';

/**
 * Documento do editor → Word (.docx), para quem quer abrir a minuta no Word
 * ou no LibreOffice. Mesma página do PDF (A4, margens de 3 e 2 cm), timbrado
 * da unidade no cabeçalho, rodapé com "Página X de Y", e a formatação do
 * editor: fontes, tamanhos, cores, marca-texto, alinhamento, recuos,
 * espaçamentos, listas, tabelas (mescladas, larguras, sem bordas), imagens,
 * links, citações, linhas e quebras de página.
 */

const NOME_FONTE: Record<string, string> = {
    serif: 'Times New Roman', 'sans-serif': 'Arial', calibri: 'Calibri', cambria: 'Cambria', monospace: 'Courier New',
    georgia: 'Georgia', garamond: 'Garamond', 'open-sans': 'Open Sans', lato: 'Lato',
};
const LARGURA_UTIL_TW = 9071; // 16 cm (A4 com as margens de sempre)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Caracteres de controle não cabem no XML.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function hex(cor: unknown): string | null {
    const s = String(cor || '').trim();
    let m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) return m[1].toUpperCase();
    m = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (m) return `${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase();
    m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('').toUpperCase();
    return null;
}

/** Largura e altura (px) de PNG ou JPEG em data URL. */
export function dimensoesImagem(buf: Buffer): { w: number; h: number } | null {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
        let i = 2;
        while (i + 9 < buf.length) {
            if (buf[i] !== 0xff) { i++; continue; }
            const m = buf[i + 1];
            if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
            i += 2 + buf.readUInt16BE(i + 2);
        }
    }
    return null;
}

class Escritor {
    rels: string[] = [];
    midias: Array<{ nome: string; buf: Buffer }> = [];
    nums: string[] = [];
    /** Definições de numeração (abstractNum) por formato: marcadores, 1/a/A/i/I, parágrafos e títulos. */
    abstratos = new Map<string, { id: number; xml: string }>();
    proximoNum = 1;
    proximoDesenho = 1;
    proximaRel = 10;
    numParagrafos: number | null = null;
    numTitulos: number | null = null;
    numeros: Map<No, string>;

    constructor(public layout: Layout = {}, public larguraTw = LARGURA_UTIL_TW, doc?: No) {
        this.numeros = doc ? numerosAutomaticos(doc) : new Map();
    }

    abstrato(chave: string, nivel: (l: number) => string): number {
        const ja = this.abstratos.get(chave);
        if (ja) return ja.id;
        const id = this.abstratos.size + 1;
        this.abstratos.set(chave, { id, xml: `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${Array.from({ length: 9 }, (_, l) => nivel(l)).join('')}</w:abstractNum>` });
        return id;
    }

    novoNum(abstrato: number, inicio = 1): number {
        const id = this.proximoNum++;
        this.nums.push(`<w:num w:numId="${id}"><w:abstractNumId w:val="${abstrato}"/>${inicio > 1 ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${inicio}"/></w:lvlOverride>` : ''}</w:num>`);
        return id;
    }

    /** Numeração dos parágrafos marcados como numerados: uma só, contínua no documento. */
    numeroDoParagrafo(): number {
        if (this.numParagrafos !== null) return this.numParagrafos;
        const f = this.layout.numeracao_paragrafos || '1.';
        const txt = f === '1)' ? '%1)' : f === '1 –' ? '%1 –' : f === '1º' ? '%1º' : '%1.';
        const abs = this.abstrato(`par:${f}`, (l) => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="${l === 0 ? txt : ''}"/><w:lvlJc w:val="left"/><w:suff w:val="space"/><w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr></w:lvl>`);
        return (this.numParagrafos = this.novoNum(abs));
    }

    /** Numeração automática dos títulos (1., 1.1., … ou I., 1., 1.1.). */
    numeroDoTitulo(): number {
        if (this.numTitulos !== null) return this.numTitulos;
        const romano = this.layout.numeracao_titulos === 'romano';
        const abs = this.abstrato(`tit:${romano ? 'romano' : 'decimal'}`, (l) => {
            const de = romano ? (l === 0 ? 1 : 2) : 1;
            const txt = romano && l === 0 ? '%1.' : `${Array.from({ length: l + 1 - (de - 1) }, (_, i) => `%${i + de}`).join('.')}.`;
            return `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${romano && l === 0 ? 'upperRoman' : 'decimal'}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:suff w:val="space"/><w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr></w:lvl>`;
        });
        return (this.numTitulos = this.novoNum(abs));
    }


    rel(tipo: string, alvo: string, externo = false): string {
        const id = `rId${this.proximaRel++}`;
        this.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${esc(alvo)}"${externo ? ' TargetMode="External"' : ''}/>`);
        return id;
    }

    rPr(marks: Marca[] = []): string {
        const p: string[] = [];
        let estilo = '';
        for (const m of marks) {
            const a = m.attrs || {};
            if (m.type === 'textStyle') {
                const f = NOME_FONTE[String(a.fontFamily || '')];
                if (f) p.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`);
            }
            if (m.type === 'code') p.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>');
            if (m.type === 'link') estilo = '<w:rStyle w:val="Hyperlink"/>';
        }
        const tem = (t: string) => marks.some((m) => m.type === t);
        if (tem('bold')) p.push('<w:b/><w:bCs/>');
        if (tem('italic')) p.push('<w:i/><w:iCs/>');
        if (tem('strike')) p.push('<w:strike/>');
        const ts = marks.find((m) => m.type === 'textStyle')?.attrs || {};
        const cor = hex(ts.color);
        if (cor) p.push(`<w:color w:val="${cor}"/>`);
        if (ts.fontSize) { const pt = parseFloat(String(ts.fontSize)); if (pt > 0) p.push(`<w:sz w:val="${Math.round(pt * 2)}"/><w:szCs w:val="${Math.round(pt * 2)}"/>`); }
        const realce = hex(marks.find((m) => m.type === 'highlight')?.attrs?.color ?? (tem('highlight') ? '#fef08a' : null)) || hex(ts.backgroundColor);
        if (realce) p.push(`<w:shd w:val="clear" w:color="auto" w:fill="${realce}"/>`);
        if (tem('underline') || tem('link')) p.push('<w:u w:val="single"/>');
        if (tem('superscript')) p.push('<w:vertAlign w:val="superscript"/>');
        else if (tem('subscript')) p.push('<w:vertAlign w:val="subscript"/>');
        return estilo || p.length ? `<w:rPr>${estilo}${p.join('')}</w:rPr>` : '';
    }

    runs(nos: No[] = []): string {
        let out = '';
        for (const n of nos) {
            if (n.type === 'hardBreak') { out += '<w:r><w:br/></w:r>'; continue; }
            if (n.type !== 'text' || !n.text) continue;
            const r = `<w:r>${this.rPr(n.marks)}<w:t xml:space="preserve">${esc(n.text)}</w:t></w:r>`;
            const link = n.marks?.find((m) => m.type === 'link')?.attrs?.href;
            out += link ? `<w:hyperlink r:id="${this.rel('hyperlink', String(link), true)}" w:history="1">${r}</w:hyperlink>` : r;
        }
        return out;
    }

    pPr(n: No, extra: { estilo?: string; num?: { id: number; nivel: number }; esq?: number; citacao?: boolean; semRecuo?: boolean } = {}): string {
        const a = n.attrs || {};
        const titulo = n.type === 'heading';
        const p: string[] = [];
        const proprio = !titulo && a.estilo && this.layout.proprios?.some((x) => x.id === a.estilo) ? `Est-${a.estilo}` : null;
        const estilo = titulo ? `Ttulo${Number(a.level) || 1}` : proprio || extra.estilo;
        if (estilo) p.push(`<w:pStyle w:val="${estilo}"/>`);
        // O estilo do documento dá o padrão; o que o parágrafo tem vale mais (como no PDF).
        const e = estiloDoBloco(this.layout, n, extra.citacao);
        const numero = this.numeros.has(n) ? (titulo ? { id: this.numeroDoTitulo(), nivel: (Number(a.level) || 1) - 1 } : { id: this.numeroDoParagrafo(), nivel: 0 }) : null;
        const num = extra.num || numero;
        if (num) p.push(`<w:numPr><w:ilvl w:val="${num.nivel}"/><w:numId w:val="${num.id}"/></w:numPr>`);
        const antes = a.antes ?? e.antes ?? 0;
        const depois = a.depois ?? e.depois ?? 6;
        const linha = Math.round((Number(a.espacamento) || e.espacamento || 1.15) * 240);
        p.push(`<w:spacing w:before="${Math.round(Number(antes) * 20)}" w:after="${Math.round(Number(depois) * 20)}" w:line="${linha}" w:lineRule="auto"/>`);
        const esq = Math.round((Number(a.margemEsq ?? e.margemEsq) || 0) * 567) + (extra.esq || 0);
        const dir = Math.round((Number(a.margemDir ?? e.margemDir) || 0) * 567);
        const prim = Math.round((Number(a.recuo ?? (extra.semRecuo ? 0 : e.recuo)) || 0) * 567);
        if (extra.num) p.push(`<w:ind w:left="${720 * (extra.num.nivel + 1) + esq}" w:hanging="360"${dir ? ` w:right="${dir}"` : ''}/>`);
        else if (esq || prim || dir || numero) p.push(`<w:ind w:left="${esq}"${dir ? ` w:right="${dir}"` : ''} w:firstLine="${prim}"/>`);
        const jc = { center: 'center', right: 'right', justify: 'both' }[String(a.textAlign || e.alinhamento)];
        if (jc) p.push(`<w:jc w:val="${jc}"/>`);
        return `<w:pPr>${p.join('')}</w:pPr>`;
    }

    paragrafo(n: No, extra: Parameters<Escritor['pPr']>[1] = {}): string {
        return `<w:p>${this.pPr(n, extra)}${this.runs(n.content)}</w:p>`;
    }

    imagem(n: No): string {
        const src = String(n.attrs?.src || '');
        const m = src.match(/^data:image\/(png|jpeg);base64,(.+)$/);
        if (!m) return '';
        const buf = Buffer.from(m[2], 'base64');
        const dim = dimensoesImagem(buf) || { w: 600, h: 400 };
        const w = Math.min(Number(n.attrs?.width) || dim.w, Math.round(this.larguraTw / 15));
        const h = Math.round((w * dim.h) / Math.max(1, dim.w));
        const nome = `imagem${this.midias.length + 1}.${m[1] === 'png' ? 'png' : 'jpeg'}`;
        this.midias.push({ nome, buf });
        const rid = this.rel('image', `media/${nome}`);
        const id = this.proximoDesenho++;
        const cx = w * 9525;
        const cy = h * 9525;
        const jc = { center: 'center', right: 'right' }[String(n.attrs?.align)];
        return `<w:p><w:pPr><w:spacing w:before="80" w:after="160"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Imagem ${id}" descr="${esc(String(n.attrs?.alt || ''))}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${nome}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }

    chaveLista(n: No): string {
        const a = n.attrs || {};
        return n.type === 'orderedList' ? `ol:${a.formato || 'decimal'}:${a.separador || '.'}` : `ul:${a.marcador || ''}`;
    }

    /** Marcadores (•, ◦, ▪, –) e números (1, a, A, i, I com . ou )) como "Marcadores e numeração" do Word. */
    abstratoDaLista(n: No): number {
        const a = n.attrs || {};
        const ordenada = n.type === 'orderedList';
        const fmt = ({ 'lower-alpha': 'lowerLetter', 'upper-alpha': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman' } as Record<string, string>)[String(a.formato)] || 'decimal';
        const fixo = ({ circle: '◦', square: '▪', dash: '–' } as Record<string, string>)[String(a.marcador)];
        const marcadores = ['•', '◦', '▪'];
        const sep = a.separador === ')' ? ')' : '.';
        return this.abstrato(this.chaveLista(n), (l) => `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${ordenada ? fmt : 'bullet'}"/><w:lvlText w:val="${ordenada ? `%${l + 1}${sep}` : fixo || marcadores[l % 3]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (l + 1)}" w:hanging="360"/></w:pPr></w:lvl>`);
    }

    lista(n: No, nivel: number, numId: number | null): string {
        const ordenada = n.type === 'orderedList';
        let id = numId;
        if (id === null) id = this.novoNum(this.abstratoDaLista(n), ordenada ? Number(n.attrs?.start) || 1 : 1);
        let out = '';
        for (const li of n.content || []) {
            let primeiro = true;
            for (const b of li.content || []) {
                if (b.type === 'bulletList' || b.type === 'orderedList') {
                    // Lista de outro tipo ou formato dentro: numeração própria.
                    out += this.lista(b, nivel + 1, this.chaveLista(b) === this.chaveLista(n) ? id : null);
                } else if ((b.type === 'paragraph' || b.type === 'heading') && primeiro) {
                    out += this.paragrafo(b, { num: { id, nivel }, estilo: 'PargrafodaLista' });
                } else out += this.bloco(b, { esq: 720 * (nivel + 1), semRecuo: true });
                primeiro = false;
            }
        }
        return out;
    }

    tabela(n: No): string {
        const linhas = n.content || [];
        // Grade: posição de cada célula, com as mescladas na vertical.
        const ocupado: boolean[][] = [];
        type Cel = { no: No; r: number; c: number; cs: number; rs: number };
        const cels: Cel[] = [];
        let colunas = 0;
        linhas.forEach((tr, r) => {
            ocupado[r] ||= [];
            let c = 0;
            for (const cel of tr.content || []) {
                while (ocupado[r][c]) c++;
                const cs = Number(cel.attrs?.colspan) || 1;
                const rs = Number(cel.attrs?.rowspan) || 1;
                for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { (ocupado[r + i] ||= [])[c + j] = true; }
                cels.push({ no: cel, r, c, cs, rs });
                c += cs;
                colunas = Math.max(colunas, c);
            }
        });
        const px: Array<number | null> = Array(colunas).fill(null);
        for (const x of cels) {
            const cw = x.no.attrs?.colwidth as number[] | null | undefined;
            if (Array.isArray(cw)) cw.forEach((w, j) => { if (px[x.c + j] === null && Number(w) > 0) px[x.c + j] = Number(w); });
        }
        const conhecidas = px.filter((w): w is number => w !== null);
        const media = conhecidas.length ? conhecidas.reduce((s, w) => s + w, 0) / conhecidas.length : 1;
        const brutas = px.map((w) => w ?? media);
        const total = brutas.reduce((s, w) => s + w, 0) || 1;
        const escala = Math.min(15, this.larguraTw / total);
        const grade = brutas.map((w) => Math.max(200, Math.round(w * escala)));
        const semBordas = n.attrs?.semBordas === true;
        let out = `<w:tbl><w:tblPr><w:tblStyle w:val="${semBordas ? 'TabelaSemBordas' : 'TabeladeGrade'}"/><w:tblW w:w="${grade.reduce((s, w) => s + w, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/></w:tblPr>`;
        out += `<w:tblGrid>${grade.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
        linhas.forEach((tr, r) => {
            const cab = (tr.content || []).length > 0 && (tr.content || []).every((c) => c.type === 'tableHeader');
            out += `<w:tr>${cab ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
            for (let c = 0; c < colunas;) {
                const aqui = cels.find((x) => x.r === r && x.c === c);
                const deCima = aqui ? null : cels.find((x) => x.r < r && x.r + x.rs > r && x.c === c);
                const cs = aqui?.cs || deCima?.cs || 1;
                const w = grade.slice(c, c + cs).reduce((s, x) => s + x, 0);
                const tcPr = `<w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : ''}${aqui && aqui.rs > 1 ? '<w:vMerge w:val="restart"/>' : deCima ? '<w:vMerge/>' : ''}${aqui?.no.type === 'tableHeader' ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}</w:tcPr>`;
                let corpo = aqui ? (aqui.no.content || []).map((b) => this.bloco(b, aqui.no.type === 'tableHeader' ? { negrito: true, semRecuo: true } : { semRecuo: true })).join('') : '';
                if (!/<w:p[ >]/.test(corpo.slice(-400)) || !corpo.endsWith('</w:p>')) corpo += '<w:p/>';
                out += `<w:tc>${tcPr}${corpo}</w:tc>`;
                c += cs;
            }
            out += '</w:tr>';
        });
        return `${out}</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`;
    }

    bloco(n: No, extra: { esq?: number; negrito?: boolean; semRecuo?: boolean } = {}): string {
        switch (n.type) {
            case 'paragraph':
            case 'heading': {
                const no = extra.negrito ? { ...n, content: (n.content || []).map((t) => (t.type === 'text' ? { ...t, marks: [...(t.marks || []), { type: 'bold' }] } : t)) } : n;
                return this.paragrafo(no, { esq: extra.esq, semRecuo: extra.semRecuo });
            }
            case 'bulletList':
            case 'orderedList':
                return this.lista(n, 0, null);
            case 'blockquote':
                return (n.content || []).map((b) => (b.type === 'paragraph' || b.type === 'heading' ? this.paragrafo(b, { estilo: 'Citao', esq: extra.esq, citacao: true }) : this.bloco(b, extra))).join('');
            case 'horizontalRule':
                return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="64748B"/></w:pBdr><w:spacing w:before="120" w:after="200"/></w:pPr></w:p>';
            case 'pageBreak':
                return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
            case 'image':
                return this.imagem(n);
            case 'table':
                return this.tabela(n);
            default:
                return (n.content || []).map((b) => this.bloco(b, extra)).join('');
        }
    }
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

/** Letra do estilo (fonte, tamanho, negrito…) no XML do Word; só o que o documento mudou. */
function rPrDoEstilo(e: Estilo = {}): string {
    const p: string[] = [];
    const f = NOME_FONTE[String(e.fonte || '')];
    if (f) p.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`);
    if (e.negrito === true) p.push('<w:b/><w:bCs/>'); else if (e.negrito === false) p.push('<w:b w:val="0"/><w:bCs w:val="0"/>');
    if (e.italico) p.push('<w:i/><w:iCs/>');
    if (e.maiusculas) p.push('<w:caps/>');
    const cor = hex(e.cor);
    if (cor) p.push(`<w:color w:val="${cor}"/>`);
    if (e.tamanho) p.push(`<w:sz w:val="${Math.round(e.tamanho * 2)}"/><w:szCs w:val="${Math.round(e.tamanho * 2)}"/>`);
    if (e.sublinhado) p.push('<w:u w:val="single"/>');
    return p.length ? `<w:rPr>${p.join('')}</w:rPr>` : '';
}

function estilos(fonte: string, tamanho: number, layout: Layout = {}): string {
    const est = (k: ChaveEstilo) => ({ ...ESTILOS_PADRAO[k], ...(layout.estilos?.[k] || {}) });
    const titulo = (n: number) => `<w:style w:type="paragraph" w:styleId="Ttulo${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr>${rPrDoEstilo(est(`h${n}` as ChaveEstilo))}</w:style>`;
    const borda = (v: string) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((l) => `<w:${l} w:val="${v}" w:sz="4" w:space="0" w:color="94A3B8"/>`).join('');
    // Estilos próprios do documento ("Ementa", "Assinatura"…) aparecem com o nome na galeria do Word.
    const proprios = (layout.proprios || []).map((x) => `<w:style w:type="paragraph" w:customStyle="1" w:styleId="Est-${x.id}"><w:name w:val="${esc(x.nome)}"/><w:basedOn w:val="Normal"/><w:qFormat/>${rPrDoEstilo(x)}</w:style>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}" w:eastAsia="${fonte}" w:cs="${fonte}"/><w:sz w:val="${tamanho * 2}"/><w:szCs w:val="${tamanho * 2}"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>${rPrDoEstilo({ ...est('normal'), fonte: undefined, tamanho: undefined })}</w:style>
${[1, 2, 3, 4].map(titulo).join('')}
<w:style w:type="paragraph" w:styleId="PargrafodaLista"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Citao"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="94A3B8"/></w:pBdr><w:ind w:left="567"/></w:pPr>${rPrDoEstilo(est('citacao'))}</w:style>${proprios}
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1D4ED8"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TabelaSemBordas"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="TabeladeGrade"><w:name w:val="Table Grid"/><w:basedOn w:val="TabelaSemBordas"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders>${borda('single')}</w:tblBorders></w:tblPr></w:style>
</w:styles>`;
}

function numeracao(e: Escritor): string {
    // No Word, as definições (abstractNum) vêm antes das numerações (num).
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering ${NS}>${[...e.abstratos.values()].map((a) => a.xml).join('')}${e.nums.join('')}</w:numbering>`;
}

const TW = 1440 / 2.54; // twips por cm

/** Documento do editor → bytes de um .docx. */
export async function docParaDocx(doc: No, cfg: ConfigDocumento = {}, meta: { titulo?: string } = {}): Promise<Buffer> {
    const layout = layoutDe(doc);
    const normal = estiloDoBloco(layout, { type: 'paragraph' });
    const fonte = NOME_FONTE[String(normal.fonte || cfg.fonte_padrao || 'serif')] || 'Times New Roman';
    const tamanho = normal.tamanho || Number(cfg.tamanho_padrao) || 12;
    const pg = folha(layout);
    const mg = margens(layout);
    const LARGURA_UTIL_TW = Math.round((pg.w - mg.esq - mg.dir) * TW);
    const e = new Escritor(layout, LARGURA_UTIL_TW, doc);
    const corpo = (doc.content || []).map((b) => e.bloco(b)).join('') || '<w:p/>';

    // Cabeçalho (timbrado da unidade) e rodapé com a página.
    const cab = new Escritor();
    const linhas = (cfg.cabecalho_linhas || []).filter(Boolean);
    let cabecalho = '';
    if (cfg.brasao) cabecalho += cab.imagem({ type: 'image', attrs: { src: cfg.brasao, width: 61, align: 'center' } });
    cabecalho += linhas.map((l, i) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>${i === 0 ? '<w:b/>' : ''}<w:sz w:val="${i === 0 ? 22 : 18}"/></w:rPr><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join('');
    const rodapeTexto = esc(String(cfg.rodape || ''));
    const r = '<w:r><w:rPr><w:sz w:val="15"/></w:rPr>';
    const campo = (instr: string) => `${r}<w:fldChar w:fldCharType="begin"/></w:r>${r}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>${r}<w:fldChar w:fldCharType="separate"/></w:r>${r}<w:t>1</w:t></w:r>${r}<w:fldChar w:fldCharType="end"/></w:r>`;
    const rodape = `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${LARGURA_UTIL_TW}"/></w:tabs><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="15"/></w:rPr></w:pPr><w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="15"/></w:rPr><w:t xml:space="preserve">${rodapeTexto}</w:t></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:tab/><w:t xml:space="preserve">Página </w:t></w:r>${campo('PAGE')}${r}<w:t xml:space="preserve"> de </w:t></w:r>${campo('NUMPAGES')}</w:p>`;

    const zip = new (jszip())();
    const temCab = !!cabecalho;
    const ridCab = temCab ? e.rel('header', 'header1.xml') : '';
    const ridRod = e.rel('footer', 'footer1.xml');
    const pgSz = `<w:pgSz w:w="${Math.round(pg.w * TW)}" w:h="${Math.round(pg.h * TW)}"${layout.orientacao === 'paisagem' ? ' w:orient="landscape"' : ''}/>`;
    const sect = `<w:sectPr>${temCab ? `<w:headerReference w:type="default" r:id="${ridCab}"/>` : ''}<w:footerReference w:type="default" r:id="${ridRod}"/>${pgSz}<w:pgMar w:top="${temCab ? Math.max(2268, Math.round(mg.sup * 567)) : Math.round(mg.sup * 567)}" w:right="${Math.round(mg.dir * 567)}" w:bottom="${Math.round(mg.inf * 567)}" w:left="${Math.round(mg.esq * 567)}" w:header="567" w:footer="510" w:gutter="0"/></w:sectPr>`;
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${corpo}${sect}</w:body></w:document>`);
    zip.file('word/styles.xml', estilos(fonte, tamanho, layout));
    zip.file('word/numbering.xml', numeracao(e));
    zip.file('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings ${NS}><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    if (temCab) {
        zip.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${NS}>${cabecalho}</w:hdr>`);
        zip.file('word/_rels/header1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${cab.rels.join('')}</Relationships>`);
    }
    zip.file('word/footer1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${NS}>${rodape}</w:ftr>`);
    for (const m of [...e.midias, ...cab.midias]) zip.file(`word/media/${m.nome}`, m.buf);
    // Nomes das imagens do cabeçalho não podem colidir com as do corpo.
    if (cab.midias.length) {
        for (const m of cab.midias) { zip.remove(`word/media/${m.nome}`); zip.file(`word/media/cab-${m.nome}`, m.buf); }
        zip.file('word/_rels/header1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${cab.rels.join('').replace(/Target="media\//g, 'Target="media/cab-')}</Relationships>`);
        for (const m of e.midias) zip.file(`word/media/${m.nome}`, m.buf);
    }
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${e.rels.join('')}</Relationships>`);
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(meta.titulo || '')}</dc:title><dc:creator>SIGO</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created></cp:coreProperties>`);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${temCab ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ''}<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
