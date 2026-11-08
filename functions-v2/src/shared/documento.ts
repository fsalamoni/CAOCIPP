/**
 * Documento redigido no editor da Secretaria (formato ProseMirror/TipTap em
 * JSON). Aqui ficam a lista fechada do que o editor pode gravar, a conversão
 * dos documentos antigos (Delta do Quill) e o texto puro. Sem dependência do
 * Firebase, para testar direto.
 */
import { DeltaOp } from './secretaria';

export interface Marca { type: string; attrs?: Record<string, unknown> }
export interface No {
    type: string;
    attrs?: Record<string, unknown>;
    content?: No[];
    text?: string;
    marks?: Marca[];
}

export const MAX_DOC_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGEM_BYTES = 1.5 * 1024 * 1024;
export const MAX_TEXTO_DOC = 600_000;
const MAX_PROFUNDIDADE = 40;

/** Fontes que o editor oferece; o PDF usa a equivalente. */
export const FONTES: Record<string, string> = { 'sans-serif': 'Roboto', serif: 'Times', monospace: 'Courier' };
export const ESPACAMENTOS = [1, 1.15, 1.5, 2, 2.5, 3];

const cor = (v: unknown) => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i.test(v);
const tamanhoFonte = (v: unknown) => typeof v === 'string' && /^\d{1,2}(\.\d)?pt$/.test(v) && parseFloat(v) >= 6 && parseFloat(v) <= 96;
const entre = (min: number, max: number) => (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const inteiro = (min: number, max: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const umDe = (...ops: unknown[]) => (v: unknown) => ops.includes(v);
const linkSeguro = (v: unknown) => typeof v === 'string' && v.length <= 2000 && /^(https?:\/\/|mailto:)/i.test(v);
const imagemSegura = (v: unknown) => typeof v === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v)
    && v.length * 0.75 <= MAX_IMAGEM_BYTES;

const ATTRS_BLOCO = {
    textAlign: umDe('left', 'center', 'right', 'justify'),
    recuo: entre(0, 5),
    margemEsq: entre(0, 10),
    espacamento: umDe(...ESPACAMENTOS),
};

/** Nó → atributos permitidos (validador por atributo). */
const NOS: Record<string, Record<string, (v: unknown) => boolean>> = {
    doc: {},
    paragraph: ATTRS_BLOCO,
    heading: { ...ATTRS_BLOCO, level: inteiro(1, 4) },
    text: {},
    hardBreak: {},
    bulletList: {},
    orderedList: { start: inteiro(1, 9999) },
    listItem: {},
    blockquote: {},
    horizontalRule: {},
    pageBreak: {},
    table: {},
    tableRow: {},
    tableHeader: { colspan: inteiro(1, 30), rowspan: inteiro(1, 100), colwidth: (v) => v === null || (Array.isArray(v) && v.every(entre(10, 2000))) },
    tableCell: { colspan: inteiro(1, 30), rowspan: inteiro(1, 100), colwidth: (v) => v === null || (Array.isArray(v) && v.every(entre(10, 2000))) },
    image: { src: imagemSegura, alt: (v) => typeof v === 'string' && v.length <= 300, width: entre(10, 2000), height: entre(10, 3000) },
};

const MARCAS: Record<string, Record<string, (v: unknown) => boolean>> = {
    bold: {},
    italic: {},
    underline: {},
    strike: {},
    code: {},
    subscript: {},
    superscript: {},
    link: { href: linkSeguro },
    highlight: { color: cor },
    textStyle: { color: cor, fontFamily: umDe(...Object.keys(FONTES)), fontSize: tamanhoFonte, backgroundColor: cor },
};

function filtrarAttrs(src: unknown, regras: Record<string, (v: unknown) => boolean>) {
    if (!src || typeof src !== 'object') return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        if (regras[k] && v !== null && v !== undefined && regras[k](v)) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
}

/**
 * Lista fechada: nó, marca ou atributo fora dela é descartado. Link sem
 * http(s)/mailto e imagem que não seja PNG/JPEG embutida caem fora. Lança
 * Error (mensagem para o usuário) se o documento passar dos limites.
 */
export function sanitizeDoc(input: unknown): No {
    let chars = 0;
    const limpar = (n: unknown, prof: number): No | null => {
        if (prof > MAX_PROFUNDIDADE) throw new Error('Documento com estrutura aninhada demais');
        if (!n || typeof n !== 'object') return null;
        const o = n as Record<string, unknown>;
        const tipo = String(o.type || '');
        const regras = NOS[tipo];
        if (!regras || (tipo === 'doc' && prof > 0)) return null;
        if (tipo === 'text') {
            if (typeof o.text !== 'string' || !o.text) return null;
            chars += o.text.length;
            if (chars > MAX_TEXTO_DOC) throw new Error('Documento grande demais para o editor');
            const marks = (Array.isArray(o.marks) ? o.marks : [])
                .map((m) => {
                    const mm = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
                    const r = MARCAS[String(mm.type)];
                    if (!r) return null;
                    const attrs = filtrarAttrs(mm.attrs, r);
                    if (mm.type === 'link' && !attrs?.href) return null;
                    if (mm.type === 'textStyle' && !attrs) return null;
                    return attrs ? { type: String(mm.type), attrs } : { type: String(mm.type) };
                })
                .filter(Boolean) as Marca[];
            return marks.length ? { type: 'text', text: o.text, marks } : { type: 'text', text: o.text };
        }
        const out: No = { type: tipo };
        const attrs = filtrarAttrs(o.attrs, regras);
        if (tipo === 'image' && !attrs?.src) return null;
        if (attrs) out.attrs = attrs;
        if (Array.isArray(o.content)) {
            const filhos = o.content.map((c) => limpar(c, prof + 1)).filter(Boolean) as No[];
            if (filhos.length) out.content = filhos;
        }
        return out;
    };
    const tamanho = JSON.stringify(input ?? null).length;
    if (tamanho > MAX_DOC_BYTES) throw new Error('Documento grande demais (imagens somam mais de 4 MB)');
    const doc = limpar(input, 0);
    if (!doc || doc.type !== 'doc') return { type: 'doc', content: [{ type: 'paragraph' }] };
    if (!doc.content) doc.content = [{ type: 'paragraph' }];
    return doc;
}

/** Texto puro, um bloco por linha (busca, contagem e documentos antigos). */
export function docParaTexto(n: No): string {
    if (n.type === 'text') return n.text || '';
    if (n.type === 'hardBreak') return '\n';
    const filhos = (n.content || []).map(docParaTexto);
    if (n.type === 'tableRow') return filhos.join('\t');
    const bloco = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'table', 'tableCell', 'tableHeader'].includes(n.type);
    return bloco ? filhos.join('\n') : filhos.join('');
}

/** Documento antigo (Delta do Quill) → mesmo formato do editor atual. */
export function deltaParaDoc(ops: DeltaOp[]): No {
    const blocos: No[] = [];
    let linha: No[] = [];
    const fecharLinha = (attrs: Record<string, unknown> = {}) => {
        const inline = linha;
        linha = [];
        const alinhar = attrs.align ? { textAlign: attrs.align } : undefined;
        const base: No = attrs.header
            ? { type: 'heading', attrs: { level: attrs.header, ...alinhar } }
            : { type: 'paragraph', ...(alinhar ? { attrs: alinhar } : {}) };
        if (inline.length) base.content = inline;
        if (attrs.blockquote) {
            blocos.push({ type: 'blockquote', content: [base] });
            return;
        }
        if (attrs.list === 'ordered' || attrs.list === 'bullet') {
            const tipo = attrs.list === 'ordered' ? 'orderedList' : 'bulletList';
            const ultimo = blocos[blocos.length - 1];
            const item: No = { type: 'listItem', content: [base] };
            if (ultimo?.type === tipo) ultimo.content!.push(item);
            else blocos.push({ type: tipo, content: [item] });
            return;
        }
        blocos.push(base);
    };
    for (const op of ops || []) {
        if (typeof op.insert !== 'string') continue;
        const a = op.attributes || {};
        const partes = op.insert.split('\n');
        partes.forEach((t, i) => {
            if (i > 0) fecharLinha(a);
            if (!t) return;
            const marks = ['bold', 'italic', 'underline'].filter((k) => a[k] === true).map((type) => ({ type }));
            linha.push(marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t });
        });
    }
    if (linha.length) fecharLinha();
    return { type: 'doc', content: blocos.length ? blocos : [{ type: 'paragraph' }] };
}
