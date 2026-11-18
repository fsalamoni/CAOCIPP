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

// Cabeçalho, rodapé e número de página (sem nada: timbrado e rodapé da unidade, "Página X de Y" à direita).
export const MODOS_FAIXA = [['unidade', 'Timbrado da unidade'], ['proprio', 'Próprio deste documento'], ['nenhum', 'Nenhum']];
export const PAGINAS_FAIXA = [['todas', 'Todas as páginas'], ['primeira', 'Só na primeira página'], ['demais', 'Todas, menos a primeira']];
export const POSICOES_NUMERO = [
    ['rodape-direita', 'Rodapé, à direita'], ['rodape-centro', 'Rodapé, ao centro'], ['rodape-esquerda', 'Rodapé, à esquerda'],
    ['cabecalho-direita', 'Cabeçalho, à direita'], ['cabecalho-centro', 'Cabeçalho, ao centro'], ['cabecalho-esquerda', 'Cabeçalho, à esquerda'], ['nenhum', 'Sem número de página'],
];
export const FORMATOS_NUMERO = [['pagina-de', 'Página 1 de 5'], ['pagina', 'Página 1'], ['n', '1'], ['n-de', '1/5'], ['traco', '– 1 –']];
export const TAMANHO_NUMERO = 7.5;
export const CAMPOS_PAGINA = [['pagina', 'Número da página'], ['paginas', 'Total de páginas']];

export function textoNumero(formato, n, total) {
    if (formato === 'pagina') return `Página ${n}`;
    if (formato === 'n') return String(n);
    if (formato === 'n-de') return `${n}/${total}`;
    if (formato === 'traco') return `– ${n} –`;
    return `Página ${n} de ${total}`;
}
export const faixaNaPagina = (f, primeira) => !f?.paginas || f.paginas === 'todas' || (f.paginas === 'primeira') === primeira;
export function trocarPagina(nos = [], n, total) {
    const andar = (x) => (x.type === 'text' && x.text
        ? { ...x, text: x.text.replace(/\{\{\s*(pagina|paginas)\s*\}\}/g, (_m, k) => String(k === 'paginas' ? total : n)) }
        : x.content ? { ...x, content: x.content.map(andar) } : x);
    return nos.map(andar);
}

/** Cabeçalho/rodapé inicial do modo próprio: o timbrado da unidade em texto, para ajustar. */
export function faixaDoTimbrado(cfg = {}, tipo = 'cabecalho') {
    if (tipo === 'rodape') {
        return [{ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: cfg.rodape || 'Endereço · telefone · e-mail', marks: [{ type: 'textStyle', attrs: { fontSize: '8pt', color: '#64748b' } }] }] }];
    }
    const linhas = (cfg.cabecalho_linhas || []).filter(Boolean);
    return [
        ...(cfg.brasao ? [{ type: 'image', attrs: { src: cfg.brasao, width: 61, align: 'center' } }] : []),
        ...(linhas.length ? linhas : ['Nome do órgão']).map((l, i) => ({
            type: 'paragraph', attrs: { textAlign: 'center', depois: 0 },
            content: [{ type: 'text', text: l, marks: [...(i === 0 ? [{ type: 'bold' }] : []), { type: 'textStyle', attrs: { fontSize: i === 0 ? '11pt' : '9pt' } }] }],
        })),
    ];
}

export const layoutDe = (doc) => doc?.attrs?.layout || {};

/** Folha em cm, já virada se for paisagem. */
export function folhaCm(l = {}) {
    const p = PAPEIS[l.papel || 'A4'] || PAPEIS.A4;
    return l.orientacao === 'paisagem' ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}
export const margensDe = (l = {}) => l.margens || MARGENS_PADRAO;
export const estiloEfetivo = (l = {}, chave) => ({ ...ESTILOS_PADRAO[chave], ...(l.estilos?.[chave] || {}) });

/**
 * Layout do papel timbrado (órgão ou unidade) por baixo do layout do
 * documento: o que o documento define vale mais; estilos se somam por chave.
 * Cabeçalho e rodapé "da unidade" seguem os do timbrado. Igual ao do servidor.
 */
export function comTimbrado(l = {}, t = null) {
    if (!t) return l;
    const out = { ...t, ...l };
    if (t.estilos || l.estilos) {
        const e = { ...t.estilos };
        for (const k of Object.keys(l.estilos || {})) e[k] = { ...(t.estilos?.[k] || {}), ...l.estilos[k] };
        out.estilos = e;
    }
    if (t.proprios || l.proprios) {
        const ids = new Set((l.proprios || []).map((p) => p.id));
        out.proprios = [...(t.proprios || []).filter((p) => !ids.has(p.id)), ...(l.proprios || [])];
    }
    if (t.numero_pagina || l.numero_pagina) out.numero_pagina = { ...t.numero_pagina, ...l.numero_pagina };
    for (const k of ['cabecalho', 'rodape']) {
        const fd = l[k];
        const ft = t[k];
        if (fd?.modo) out[k] = fd;
        else if (ft || fd?.paginas) out[k] = { ...ft, ...(fd?.paginas ? { paginas: fd.paginas } : {}) };
        else delete out[k];
    }
    return out;
}

/**
 * Tira os vazios e o que é igual ao herdado (o padrão do SIGO ou, com
 * `base`, o layout do papel timbrado), para o documento guardar só o que mudou.
 */
export function limparLayout(l = {}, base = null) {
    const b = base || {};
    const out = { ...l };
    if (!out.papel || out.papel === (b.papel || 'A4')) delete out.papel;
    if (!out.orientacao || out.orientacao === (b.orientacao || 'retrato')) delete out.orientacao;
    const mb = margensDe(b);
    if (out.margens && Object.keys(MARGENS_PADRAO).every((k) => Number(out.margens[k]) === mb[k])) delete out.margens;
    if (out.estilos) {
        const e = {};
        for (const [k, v] of Object.entries(out.estilos)) {
            const x = Object.fromEntries(Object.entries(v || {}).filter(([, y]) => y !== undefined && y !== null && y !== ''));
            if (Object.keys(x).length) e[k] = x;
        }
        if (Object.keys(e).length) out.estilos = e; else delete out.estilos;
    }
    if (!out.proprios?.length) delete out.proprios;
    if ((out.numeracao_titulos ?? null) === null || out.numeracao_titulos === (b.numeracao_titulos || '')) delete out.numeracao_titulos;
    if (!out.numeracao_paragrafos || out.numeracao_paragrafos === (b.numeracao_paragrafos || '1.')) delete out.numeracao_paragrafos;
    for (const k of ['cabecalho', 'rodape']) {
        const f = { ...(out[k] || {}) };
        if (!f.modo || f.modo === 'unidade') delete f.modo;
        if (!f.paginas || f.paginas === (b[k]?.paginas || 'todas')) delete f.paginas;
        if (!f.conteudo?.length) delete f.conteudo;
        if (Object.keys(f).length) out[k] = f; else delete out[k];
    }
    const np = { ...(out.numero_pagina || {}) };
    const nb = b.numero_pagina || {};
    if (!np.posicao || np.posicao === (nb.posicao || 'rodape-direita')) delete np.posicao;
    if (!np.formato || np.formato === (nb.formato || 'pagina-de')) delete np.formato;
    if (!np.tamanho || np.tamanho === (nb.tamanho || TAMANHO_NUMERO)) delete np.tamanho;
    if (typeof np.primeira !== 'boolean' || np.primeira === (nb.primeira !== false)) delete np.primeira;
    if (Object.keys(np).length) out.numero_pagina = np; else delete out.numero_pagina;
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
