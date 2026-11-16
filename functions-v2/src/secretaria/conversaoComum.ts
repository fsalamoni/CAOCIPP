// Peças comuns dos conversores de Word e LibreOffice para o editor.
const xmldom = () => require('@xmldom/xmldom') as typeof import('@xmldom/xmldom');
const sharp = (...a: Parameters<typeof import('sharp')>) => (require('sharp') as typeof import('sharp'))(...a);
import { MAX_DOC_BYTES, MAX_IMAGEM_BYTES, No } from '../shared/documento';

/** XML → documento (sem avisos no console por XML imperfeito). */
export function xml(s: string): Document {
    const silencio = { warning: () => undefined, error: () => undefined, fatalError: (e: unknown) => { throw new Error(`XML inválido: ${String(e)}`); } };
    return new (xmldom().DOMParser)({ errorHandler: silencio } as never).parseFromString(s, 'text/xml');
}

/** Filhos-elemento (todos, ou só os de um nome). */
export function filhos(el: Element | null | undefined, nome?: string): Element[] {
    const out: Element[] = [];
    if (!el) return out;
    for (let i = 0; i < el.childNodes.length; i++) {
        const c = el.childNodes[i] as Element;
        if (c.nodeType === 1 && (!nome || c.tagName === nome)) out.push(c);
    }
    return out;
}
export const filho = (el: Element | null | undefined, nome: string): Element | null => filhos(el, nome)[0] || null;

/** Liga/desliga do Word (<w:b/>, <w:b w:val="0"/>); undefined se o elemento não existe. */
export function ligado(el: Element | null): boolean | undefined {
    if (!el) return undefined;
    const v = el.getAttribute('w:val');
    return v === null || v === '' || !['0', 'false', 'off', 'none'].includes(v);
}

export interface ImagensDoc {
    avisos: string[];
    incluir(buf: Buffer, nome: string): Promise<{ src: string; largura: number } | null>;
}

/**
 * Imagens do arquivo como PNG/JPEG embutidos, dentro do limite do editor:
 * cada uma até 1,4 MB e todas juntas cabendo no documento (as primeiras com
 * mais qualidade; se o total apertar, as seguintes saem menores).
 */
export function novoOrcamento(): ImagensDoc {
    const TOTAL = Math.floor(MAX_DOC_BYTES * 0.7 * 0.75); // base64 cresce 4/3; sobra espaço para o texto
    const POR_IMAGEM = Math.min(MAX_IMAGEM_BYTES * 0.93, 1.4 * 1024 * 1024);
    let usado = 0;
    const avisos = new Set<string>();
    return {
        get avisos() { return [...avisos]; },
        async incluir(buf, nome) {
            if (/\.(emf|wmf|emz|wmz)$/i.test(nome)) { avisos.add('Desenhos em formato antigo do Office (EMF/WMF) não vieram; copie-os como imagem se precisar.'); return null; }
            try {
                const meta = await sharp(buf, { failOn: 'none' }).metadata();
                const alfa = !!meta.hasAlpha;
                const restante = TOTAL - usado;
                if (restante < 30 * 1024) { avisos.add('Algumas imagens não vieram: o documento chegou ao limite de imagens do editor.'); return null; }
                const limite = Math.min(POR_IMAGEM, restante);
                for (const [lado, q] of [[1600, 85], [1200, 75], [900, 65], [600, 55]] as Array<[number, number]>) {
                    const base = () => sharp(buf, { failOn: 'none' }).rotate().resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true });
                    const png = alfa || meta.format === 'png' ? await base().png({ compressionLevel: 9, palette: false }).toBuffer() : null;
                    const jpg = alfa ? null : await base().flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
                    const melhor = [png && { b: png, m: 'png' }, jpg && { b: jpg, m: 'jpeg' }].filter(Boolean).sort((a, b) => a!.b.length - b!.b.length)[0]!;
                    if (melhor.b.length <= limite) {
                        usado += melhor.b.length;
                        const largura = (await sharp(melhor.b).metadata()).width || lado;
                        return { src: `data:image/${melhor.m};base64,${melhor.b.toString('base64')}`, largura };
                    }
                }
                avisos.add('Uma imagem muito grande não coube no editor.');
                return null;
            } catch {
                avisos.add('Alguma imagem do arquivo não pôde ser lida.');
                return null;
            }
        },
    };
}

/** Bloco convertido; o parágrafo numerado traz a lista de onde veio. */
export type Item = { no: No; lista?: { chave: string; ilvl: number; ordenada: boolean; inicio: number } };

/** Parágrafos numerados seguidos viram listas (aninhadas pelo nível). */
export function agruparListas(itens: Item[]): No[] {
    const out: No[] = [];
    let i = 0;
    const construir = (nivel: number, chave: string): No => {
        const primeiro = itens[i].lista!;
        const lista: No = { type: primeiro.ordenada ? 'orderedList' : 'bulletList', content: [] };
        if (primeiro.ordenada && primeiro.inicio > 1) lista.attrs = { start: primeiro.inicio };
        while (i < itens.length && itens[i].lista && itens[i].lista!.ilvl >= nivel) {
            const l = itens[i].lista!;
            if (l.ilvl === nivel) {
                if (l.chave !== chave) break;
                const no = itens[i].no.type === 'paragraph' ? itens[i].no : { type: 'paragraph', content: itens[i].no.content };
                lista.content!.push({ type: 'listItem', content: [no] });
                i++;
            } else {
                const ultimo = lista.content![lista.content!.length - 1] || (lista.content!.push({ type: 'listItem', content: [{ type: 'paragraph' }] }), lista.content![0]);
                ultimo.content!.push(construir(l.ilvl, l.chave));
            }
        }
        return lista;
    };
    while (i < itens.length) {
        const it = itens[i];
        if (!it.lista) { out.push(it.no); i++; continue; }
        out.push(construir(it.lista.ilvl, it.lista.chave));
    }
    return out;
}

