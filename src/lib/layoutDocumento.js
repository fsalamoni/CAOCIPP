/**
 * Página e estilos do documento do editor, na tela (espelho de
 * functions-v2/src/shared/layoutDocumento.ts, que valida e desenha o PDF e o
 * .docx). Fica em `doc.attrs.layout`; documento sem layout sai como sempre.
 */

export const PAPEIS = {
    A4: { nome: 'A4 (21 × 29,7 cm)', w: 21, h: 29.7 },
    oficio: { nome: 'Ofício (21,6 × 33 cm)', w: 21.6, h: 33 },
    carta: { nome: 'Carta (21,6 × 27,9 cm)', w: 21.59, h: 27.94 },
    A5: { nome: 'A5 (14,8 × 21 cm)', w: 14.8, h: 21 },
};
export const MARGENS_PADRAO = { sup: 2.5, inf: 2.2, esq: 3, dir: 2 };
/** Margens prontas, como em "Margens" do Word. */
export const MARGENS_PRONTAS = [
    ['SIGO (padrão)', MARGENS_PADRAO],
    ['ABNT (3 e 2 cm)', { sup: 3, inf: 2, esq: 3, dir: 2 }],
    ['Normal do Word (2,5 e 3 cm)', { sup: 2.5, inf: 2.5, esq: 3, dir: 3 }],
    ['Moderadas', { sup: 2.54, inf: 2.54, esq: 1.91, dir: 1.91 }],
    ['Estreitas', { sup: 1.27, inf: 1.27, esq: 1.27, dir: 1.27 }],
];

export const CHAVES_ESTILO = [['normal', 'Texto normal'], ['h1', 'Título 1'], ['h2', 'Título 2'], ['h3', 'Título 3'], ['h4', 'Título 4'], ['citacao', 'Citação']];
export const ESTILOS_PADRAO = {
    normal: { antes: 0, depois: 6 },
    h1: { tamanho: 18, negrito: true, antes: 8, depois: 6 },
    h2: { tamanho: 15, negrito: true, antes: 8, depois: 6 },
    h3: { tamanho: 13, negrito: true, antes: 8, depois: 6 },
    h4: { tamanho: 12, negrito: true, antes: 8, depois: 6 },
    citacao: { antes: 0, depois: 6 },
};
export const FORMATOS_PARAGRAFO = [['1.', '1.  2.  3.'], ['1)', '1)  2)  3)'], ['1 –', '1 –  2 –  3 –'], ['1º', '1º  2º  3º']];
export const FORMATOS_TITULO = [['', 'Sem numeração'], ['decimal', '1.  1.1.  1.1.1.'], ['romano', 'I.  1.  1.1.']];
export const MARCADORES = [['disc', '•', 'Círculo cheio'], ['circle', '◦', 'Círculo vazado'], ['square', '▪', 'Quadrado'], ['dash', '–', 'Travessão']];
export const FORMATOS_LISTA = [['decimal', '1, 2, 3'], ['lower-alpha', 'a, b, c'], ['upper-alpha', 'A, B, C'], ['lower-roman', 'i, ii, iii'], ['upper-roman', 'I, II, III']];

export const layoutDe = (doc) => doc?.attrs?.layout || {};

/** Folha em cm, já virada se for paisagem. */
export function folhaCm(l = {}) {
    const p = PAPEIS[l.papel || 'A4'] || PAPEIS.A4;
    return l.orientacao === 'paisagem' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
export const margensDe = (l = {}) => l.margens || MARGENS_PADRAO;
export const estiloEfetivo = (l = {}, chave) => ({ ...ESTILOS_PADRAO[chave], ...(l.estilos?.[chave] || {}) });

/** Tira os vazios e o que é igual ao padrão, para o documento guardar só o que mudou. */
export function limparLayout(l = {}) {
    const out = { ...l };
    if (!out.papel || out.papel === 'A4') delete out.papel;
    if (out.orientacao !== 'paisagem') delete out.orientacao;
    if (out.margens && Object.keys(MARGENS_PADRAO).every((k) => Number(out.margens[k]) === MARGENS_PADRAO[k])) delete out.margens;
    if (out.estilos) {
        const e = {};
        for (const [k, v] of Object.entries(out.estilos)) {
            const x = Object.fromEntries(Object.entries(v || {}).filter(([, y]) => y !== undefined && y !== null && y !== ''));
            if (Object.keys(x).length) e[k] = x;
        }
        if (Object.keys(e).length) out.estilos = e; else delete out.estilos;
    }
    if (!out.proprios?.length) delete out.proprios;
    if (!out.numeracao_titulos) delete out.numeracao_titulos;
    if (!out.numeracao_paragrafos || out.numeracao_paragrafos === '1.') delete out.numeracao_paragrafos;
    return Object.keys(out).length ? out : null;
}

const aspas = (s) => `"${String(s).replace(/["\\]/g, '')}"`;
const altura = (esp) => Math.round((Number(esp) || 1.15) * 1.15 * 10000) / 10000;

/** Declarações CSS de um estilo (o que o parágrafo tiver na linha vale mais). */
export function cssDoEstilo(e = {}, cssFonte = {}) {
    const d = [];
    if (e.fonte && cssFonte[e.fonte]) d.push(`font-family: ${cssFonte[e.fonte]}`);
    if (e.tamanho) d.push(`font-size: ${e.tamanho}pt`);
    if (e.negrito === true) d.push('font-weight: 700'); else if (e.negrito === false) d.push('font-weight: 400');
    if (e.italico) d.push('font-style: italic');
    if (e.sublinhado) d.push('text-decoration: underline');
    if (e.maiusculas) d.push('text-transform: uppercase');
    if (e.cor) d.push(`color: ${e.cor}`);
    if (e.alinhamento) d.push(`text-align: ${e.alinhamento}`);
    if (e.recuo !== undefined) d.push(`text-indent: ${e.recuo}cm`);
    if (e.margemEsq !== undefined) d.push(`margin-left: ${e.margemEsq}cm`);
    if (e.margemDir !== undefined) d.push(`margin-right: ${e.margemDir}cm`);
    if (e.espacamento) d.push(`line-height: ${altura(e.espacamento)}`);
    if (e.antes !== undefined) d.push(`margin-top: ${e.antes}pt`);
    if (e.depois !== undefined) d.push(`margin-bottom: ${e.depois}pt`);
    return d.join('; ');
}

/**
 * CSS da folha: estilos (Normal, Títulos, Citação e próprios) e numeração
 * automática com contadores, os mesmos números do PDF e do Word.
 */
export function cssDoLayout(l = {}, escopo, cssFonte = {}) {
    const pm = `${escopo} .ProseMirror`;
    const r = [];
    r.push(`${pm} p { ${cssDoEstilo(estiloEfetivo(l, 'normal'), cssFonte)} }`);
    for (const n of [1, 2, 3, 4]) r.push(`${pm} h${n} { ${cssDoEstilo(estiloEfetivo(l, `h${n}`), cssFonte)} }`);
    r.push(`${pm} blockquote > p { ${cssDoEstilo(estiloEfetivo(l, 'citacao'), cssFonte)} }`);
    for (const p of l.proprios || []) {
        const { id, nome: _n, ...e } = p;
        if (/^[a-z0-9-]{1,30}$/.test(id)) r.push(`${pm} p[data-estilo="${id}"] { ${cssDoEstilo(e, cssFonte)} }`);
    }
    r.push(`${pm} { counter-reset: sigo-t1 sigo-t2 sigo-t3 sigo-t4 sigo-np; }`);
    if (l.numeracao_titulos) {
        const romano = l.numeracao_titulos === 'romano';
        r.push(`${pm} h1 { counter-increment: sigo-t1; counter-set: sigo-t2 0 sigo-t3 0 sigo-t4 0; }`);
        r.push(`${pm} h2 { counter-increment: sigo-t2; counter-set: sigo-t3 0 sigo-t4 0; }`);
        r.push(`${pm} h3 { counter-increment: sigo-t3; counter-set: sigo-t4 0; }`);
        r.push(`${pm} h4 { counter-increment: sigo-t4; }`);
        const c = (k) => `counter(sigo-t${k})`;
        const niveis = romano
            ? ['counter(sigo-t1, upper-roman) ". "', `${c(2)} ". "`, `${c(2)} "." ${c(3)} ". "`, `${c(2)} "." ${c(3)} "." ${c(4)} ". "`]
            : [`${c(1)} ". "`, `${c(1)} "." ${c(2)} ". "`, `${c(1)} "." ${c(2)} "." ${c(3)} ". "`, `${c(1)} "." ${c(2)} "." ${c(3)} "." ${c(4)} ". "`];
        niveis.forEach((v, i) => r.push(`${pm} h${i + 1}::before { content: ${v}; }`));
    }
    const fp = l.numeracao_paragrafos || '1.';
    const depois = fp === '1)' ? ') ' : fp === '1 –' ? ' – ' : fp === '1º' ? 'º ' : '. ';
    r.push(`${pm} p[data-numerado] { counter-increment: sigo-np; }`);
    r.push(`${pm} p[data-numerado]::before { content: counter(sigo-np) ${aspas(depois)}; }`);
    return r.join('\n');
}

/** Texto curto da página para a barra de status: "A4 retrato · margens 2,5 / 2 / 2,2 / 3 cm". */
export function resumoPagina(l = {}) {
    const v = (n) => String(n).replace('.', ',');
    const m = margensDe(l);
    const papel = (PAPEIS[l.papel || 'A4'] || PAPEIS.A4).nome.split(' (')[0];
    return `${papel} ${l.orientacao === 'paisagem' ? 'paisagem' : 'retrato'} · margens ${v(m.sup)} / ${v(m.dir)} / ${v(m.inf)} / ${v(m.esq)} cm`;
}

/** Id para estilo próprio novo, a partir do nome ("Ementa" → "ementa", "ementa-2"…). */
export function idDeEstilo(nome, existentes = []) {
    const base = String(nome || 'estilo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'estilo';
    let id = base;
    for (let i = 2; existentes.includes(id); i++) id = `${base}-${i}`;
    return id;
}
