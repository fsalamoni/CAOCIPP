/**
 * Formatação de página e de estilos do documento do editor (como "Configurar
 * página" e "Estilos" do Word). Fica em `doc.attrs.layout`, viaja com o texto
 * (modelo → minuta → PDF dos autos → .docx) e é opcional: documento sem layout
 * sai exatamente como antes. Sem dependência do Firebase, para testar direto.
 */
import { FONTES, No, sanitizeDoc } from './documento';

/** Papel em cm (largura × altura, em retrato). */
export const PAPEIS: Record<string, { nome: string; w: number; h: number }> = {
    A4: { nome: 'A4 (21 × 29,7 cm)', w: 21, h: 29.7 },
    oficio: { nome: 'Ofício (21,6 × 33 cm)', w: 21.6, h: 33 },
    carta: { nome: 'Carta (21,6 × 27,9 cm)', w: 21.59, h: 27.94 },
    A5: { nome: 'A5 (14,8 × 21 cm)', w: 14.8, h: 21 },
};
/** Margens de sempre do SIGO: as do PDF dos autos desde o início. */
export const MARGENS_PADRAO = { sup: 2.5, inf: 2.2, esq: 3, dir: 2 };

export interface Estilo {
    fonte?: string;
    tamanho?: number;
    negrito?: boolean;
    italico?: boolean;
    sublinhado?: boolean;
    maiusculas?: boolean;
    cor?: string;
    alinhamento?: 'left' | 'center' | 'right' | 'justify';
    recuo?: number;
    margemEsq?: number;
    margemDir?: number;
    espacamento?: number;
    antes?: number;
    depois?: number;
}
export interface EstiloProprio extends Estilo { id: string; nome: string }
export interface Layout {
    papel?: string;
    orientacao?: 'retrato' | 'paisagem';
    margens?: { sup: number; inf: number; esq: number; dir: number };
    estilos?: Partial<Record<ChaveEstilo, Estilo>>;
    proprios?: EstiloProprio[];
    /** '' (sem), 'decimal' (1., 1.1., 1.1.1.) ou 'romano' (I., depois 1., 1.1.). */
    numeracao_titulos?: string;
    /** Formato do número dos parágrafos marcados como numerados. */
    numeracao_paragrafos?: string;
    /** Sem: timbrado da unidade em todas as páginas (o de sempre). */
    cabecalho?: Faixa;
    /** Sem: rodapé da unidade em todas as páginas (o de sempre). */
    rodape?: Faixa;
    /** Sem: "Página X de Y" à direita do rodapé (o de sempre). */
    numero_pagina?: NumeroPagina;
}

/**
 * Cabeçalho ou rodapé: o da unidade (timbrado), um próprio do documento
 * (texto, imagens, tabelas, com {{pagina}} e {{paginas}}) ou nenhum; e em
 * quais páginas aparece (todas, só a primeira, todas menos a primeira).
 */
export interface Faixa { modo?: 'unidade' | 'proprio' | 'nenhum'; conteudo?: No[]; paginas?: 'todas' | 'primeira' | 'demais' }
export interface NumeroPagina { posicao?: string; formato?: string; tamanho?: number; primeira?: boolean }

export const MODOS_FAIXA = ['unidade', 'proprio', 'nenhum'];
export const PAGINAS_FAIXA = ['todas', 'primeira', 'demais'];
export const POSICOES_NUMERO = ['rodape-direita', 'rodape-centro', 'rodape-esquerda', 'cabecalho-direita', 'cabecalho-centro', 'cabecalho-esquerda', 'nenhum'];
export const FORMATOS_NUMERO = ['pagina-de', 'pagina', 'n', 'n-de', 'traco'];
/** Tamanho do número de página de sempre (pt). */
export const TAMANHO_NUMERO = 7.5;
/** Distância do cabeçalho à borda de cima e do rodapé à de baixo (cm), como no Word. */
export const DISTANCIA_FAIXA = 1.25;

/** Texto do número da página no formato escolhido. */
export function textoNumero(formato: string | undefined, n: number, total: number): string {
    if (formato === 'pagina') return `Página ${n}`;
    if (formato === 'n') return String(n);
    if (formato === 'n-de') return `${n}/${total}`;
    if (formato === 'traco') return `– ${n} –`;
    return `Página ${n} de ${total}`;
}

/** A faixa aparece nesta página? */
export const faixaNaPagina = (f: Faixa | undefined, primeira: boolean) => !f?.paginas || f.paginas === 'todas' || (f.paginas === 'primeira') === primeira;

/** {{pagina}} e {{paginas}} nos textos do cabeçalho/rodapé próprio. */
export const TOKEN_PAGINA = /\{\{\s*(pagina|paginas)\s*\}\}/g;
export function trocarPagina(nos: No[] | undefined, n: number, total: number): No[] {
    const andar = (x: No): No => (x.type === 'text' && x.text
        ? { ...x, text: x.text.replace(TOKEN_PAGINA, (_m, k) => String(k === 'paginas' ? total : n)) }
        : x.content ? { ...x, content: x.content.map(andar) } : x);
    return (nos || []).map(andar);
}

/** Conteúdo próprio passa pela mesma lista fechada do documento. */
function limparConteudo(v: unknown): No[] | undefined {
    if (!Array.isArray(v) || !v.length) return undefined;
    const d = sanitizeDoc({ type: 'doc', content: v.slice(0, 60) });
    const vazio = (d.content || []).every((b) => b.type === 'paragraph' && !b.content);
    return vazio ? undefined : d.content;
}

function sanitizeFaixa(v: unknown): Faixa | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const f: Faixa = {};
    if (MODOS_FAIXA.includes(String(o.modo)) && o.modo !== 'unidade') f.modo = o.modo as Faixa['modo'];
    // O texto próprio fica guardado mesmo com outro modo: voltar a ele não perde nada.
    const c = limparConteudo(o.conteudo);
    if (c) f.conteudo = c;
    if (PAGINAS_FAIXA.includes(String(o.paginas))) f.paginas = o.paginas as Faixa['paginas'];
    return Object.keys(f).length ? f : undefined;
}

function sanitizeNumero(v: unknown): NumeroPagina | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const n: NumeroPagina = {};
    // Valores iguais ao padrão também ficam: o documento pode voltar ao padrão por cima do timbrado.
    if (POSICOES_NUMERO.includes(String(o.posicao))) n.posicao = String(o.posicao);
    if (FORMATOS_NUMERO.includes(String(o.formato))) n.formato = String(o.formato);
    const t = num(o.tamanho, 6, 16, 1);
    if (t !== undefined) n.tamanho = t;
    if (typeof o.primeira === 'boolean') n.primeira = o.primeira;
    return Object.keys(n).length ? n : undefined;
}

export const CHAVES_ESTILO = ['normal', 'h1', 'h2', 'h3', 'h4', 'citacao'] as const;
export type ChaveEstilo = typeof CHAVES_ESTILO[number];

/** Como os estilos saem quando o documento não muda nada (o de sempre). */
export const ESTILOS_PADRAO: Record<ChaveEstilo, Estilo> = {
    normal: { antes: 0, depois: 6 },
    h1: { tamanho: 18, negrito: true, antes: 8, depois: 6 },
    h2: { tamanho: 15, negrito: true, antes: 8, depois: 6 },
    h3: { tamanho: 13, negrito: true, antes: 8, depois: 6 },
    h4: { tamanho: 12, negrito: true, antes: 8, depois: 6 },
    citacao: { antes: 0, depois: 6 },
};
export const FORMATOS_PARAGRAFO = ['1.', '1)', '1 –', '1º'];
export const FORMATOS_TITULO = ['', 'decimal', 'romano'];
export { MARCADORES, FORMATOS_LISTA } from './documento';

const num = (v: unknown, min: number, max: number, casas = 2) => {
    const n = typeof v === 'number' ? v : Number.NaN;
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10 ** casas) / 10 ** casas : undefined;
};
const cor = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined);
const sim = (v: unknown) => (v === true ? true : v === false ? false : undefined);

function sanitizeEstilo(v: unknown): Estilo | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const e: Estilo = {
        fonte: FONTES[String(o.fonte)] ? String(o.fonte) : undefined,
        tamanho: num(o.tamanho, 6, 96, 1),
        negrito: sim(o.negrito),
        italico: sim(o.italico),
        sublinhado: sim(o.sublinhado),
        maiusculas: sim(o.maiusculas),
        cor: cor(o.cor),
        alinhamento: ['left', 'center', 'right', 'justify'].includes(String(o.alinhamento)) ? o.alinhamento as Estilo['alinhamento'] : undefined,
        recuo: num(o.recuo, 0, 5),
        margemEsq: num(o.margemEsq, 0, 10),
        margemDir: num(o.margemDir, 0, 10),
        espacamento: num(o.espacamento, 0.8, 3),
        antes: num(o.antes, 0, 72, 1),
        depois: num(o.depois, 0, 72, 1),
    };
    for (const k of Object.keys(e) as Array<keyof Estilo>) if (e[k] === undefined) delete e[k];
    return Object.keys(e).length ? e : undefined;
}

/** Lista fechada do layout; devolve undefined quando nada difere do padrão. */
export function sanitizeLayout(v: unknown): Layout | undefined {
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    const l: Layout = {};
    // O que veio explícito fica, mesmo igual ao padrão (vale por cima do timbrado); quem edita já tira o que é herdado.
    if (PAPEIS[String(o.papel)]) l.papel = String(o.papel);
    if (o.orientacao === 'paisagem' || o.orientacao === 'retrato') l.orientacao = o.orientacao;
    const m = o.margens as Record<string, unknown> | undefined;
    if (m && typeof m === 'object') {
        const mm = { sup: num(m.sup, 0.5, 8), inf: num(m.inf, 0.5, 8), esq: num(m.esq, 0.5, 8), dir: num(m.dir, 0.5, 8) };
        if (Object.values(mm).every((x) => x !== undefined)) l.margens = mm as Layout['margens'] & object;
    }
    const est = o.estilos as Record<string, unknown> | undefined;
    if (est && typeof est === 'object') {
        const out: Layout['estilos'] = {};
        for (const k of CHAVES_ESTILO) { const e = sanitizeEstilo(est[k]); if (e) out[k] = e; }
        if (Object.keys(out).length) l.estilos = out;
    }
    if (Array.isArray(o.proprios)) {
        const vistos = new Set<string>();
        const lista = o.proprios.slice(0, 30).map((p) => {
            const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
            const id = String(x.id || '');
            const nome = String(x.nome || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            if (!/^[a-z0-9-]{1,30}$/.test(id) || !nome || vistos.has(id)) return null;
            vistos.add(id);
            return { id, nome, ...(sanitizeEstilo(x) || {}) };
        }).filter(Boolean) as EstiloProprio[];
        if (lista.length) l.proprios = lista;
    }
    if (typeof o.numeracao_titulos === 'string' && FORMATOS_TITULO.includes(o.numeracao_titulos)) l.numeracao_titulos = o.numeracao_titulos;
    if (FORMATOS_PARAGRAFO.includes(String(o.numeracao_paragrafos))) l.numeracao_paragrafos = String(o.numeracao_paragrafos);
    const cab = sanitizeFaixa(o.cabecalho);
    if (cab) l.cabecalho = cab;
    const rod = sanitizeFaixa(o.rodape);
    if (rod) l.rodape = rod;
    const np = sanitizeNumero(o.numero_pagina);
    if (np) l.numero_pagina = np;
    return Object.keys(l).length ? l : undefined;
}

export const layoutDe = (doc: No | null | undefined): Layout => ((doc?.attrs?.layout || {}) as Layout);

/**
 * Layout do papel timbrado (órgão ou unidade) por baixo do layout do
 * documento: o que o documento define vale mais; estilos se somam por chave.
 * Cabeçalho e rodapé "da unidade" seguem os do timbrado (simples ou próprio).
 */
export function comTimbrado(l: Layout, t?: Layout | null): Layout {
    if (!t) return l;
    const out: Layout = { ...t, ...l };
    if (t.estilos || l.estilos) {
        const e: NonNullable<Layout['estilos']> = { ...t.estilos };
        for (const k of Object.keys(l.estilos || {}) as ChaveEstilo[]) e[k] = { ...(t.estilos?.[k] || {}), ...l.estilos![k] };
        out.estilos = e;
    }
    if (t.proprios || l.proprios) {
        const ids = new Set((l.proprios || []).map((p) => p.id));
        out.proprios = [...(t.proprios || []).filter((p) => !ids.has(p.id)), ...(l.proprios || [])];
    }
    if (t.numero_pagina || l.numero_pagina) out.numero_pagina = { ...t.numero_pagina, ...l.numero_pagina };
    for (const k of ['cabecalho', 'rodape'] as const) {
        const fd = l[k];
        const ft = t[k];
        if (fd?.modo) out[k] = fd;
        else if (ft || fd?.paginas) out[k] = { ...ft, ...(fd?.paginas ? { paginas: fd.paginas } : {}) };
        else delete out[k];
    }
    return out;
}

/** O documento com o layout do timbrado por baixo (PDF e Word). */
export const docComTimbrado = (doc: No, t?: Layout | null): No => (t ? { ...doc, attrs: { ...(doc.attrs || {}), layout: comTimbrado(layoutDe(doc), t) } } : doc);

/** Tamanho da folha em cm, já virada se for paisagem. */
export function folha(l: Layout): { w: number; h: number } {
    const p = PAPEIS[l.papel || 'A4'] || PAPEIS.A4;
    return l.orientacao === 'paisagem' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
export const margens = (l: Layout) => l.margens || MARGENS_PADRAO;

/**
 * Estilo do bloco: padrão do SIGO, depois o do documento, depois o estilo
 * próprio (por cima do Normal). O que estiver no parágrafo vale mais (quem
 * desenha aplica por cima).
 */
export function estiloDoBloco(l: Layout, n: No, dentroDeCitacao = false): Estilo {
    const chave: ChaveEstilo = n.type === 'heading' ? (`h${Math.min(4, Math.max(1, Number(n.attrs?.level) || 1))}` as ChaveEstilo) : dentroDeCitacao ? 'citacao' : 'normal';
    const base = { ...ESTILOS_PADRAO[chave], ...(l.estilos?.[chave] || {}) };
    const proprio = n.type === 'paragraph' && n.attrs?.estilo ? l.proprios?.find((p) => p.id === n.attrs!.estilo) : undefined;
    if (!proprio) return base;
    const { id: _id, nome: _nome, ...e } = proprio;
    return { ...base, ...e };
}

const romano = (n: number) => {
    const t: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
    return s;
};
export const numeroParagrafo = (n: number, formato = '1.') => (formato === '1)' ? `${n})` : formato === '1 –' ? `${n} –` : formato === '1º' ? `${n}º` : `${n}.`);
/** Marcador da lista numerada (1, a, A, i, I) com o separador. */
export function marcadorLista(n: number, formato = 'decimal', sep = '.') {
    const letra = (k: number) => { let s = ''; for (let x = k; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(97 + ((x - 1) % 26)) + s; return s; };
    const v = formato === 'lower-alpha' ? letra(n) : formato === 'upper-alpha' ? letra(n).toUpperCase() : formato === 'lower-roman' ? romano(n).toLowerCase() : formato === 'upper-roman' ? romano(n) : String(n);
    return `${v}${sep}`;
}

/**
 * Números automáticos de títulos e de parágrafos numerados, na ordem do
 * documento (o mesmo que o editor mostra com contadores do CSS).
 */
export function numerosAutomaticos(doc: No): Map<No, string> {
    const l = layoutDe(doc);
    const out = new Map<No, string>();
    const t = [0, 0, 0, 0];
    let p = 0;
    const andar = (n: No) => {
        if (n.type === 'heading' && l.numeracao_titulos) {
            const nivel = Math.min(4, Math.max(1, Number(n.attrs?.level) || 1)) - 1;
            t[nivel]++;
            for (let i = nivel + 1; i < 4; i++) t[i] = 0;
            if (l.numeracao_titulos === 'romano') {
                out.set(n, nivel === 0 ? `${romano(t[0])}.` : `${t.slice(1, nivel + 1).join('.')}.`);
            } else out.set(n, `${t.slice(0, nivel + 1).join('.')}.`);
        } else if (n.type === 'paragraph' && n.attrs?.numerado === true) {
            out.set(n, numeroParagrafo(++p, l.numeracao_paragrafos));
        }
        for (const c of n.content || []) andar(c);
    };
    andar(doc);
    return out;
}
