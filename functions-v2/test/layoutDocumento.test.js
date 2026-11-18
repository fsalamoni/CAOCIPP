// Página e estilos do documento (doc.attrs.layout): validação, numeração
// automática, PDF dos autos e .docx. Documento sem layout sai como sempre.
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { PDFDocument } = require('pdf-lib');
const { sanitizeDoc, fonteEquivalente } = require('../lib/shared/documento');
const L = require('../lib/shared/layoutDocumento');
const { renderizarDocumento } = require('../lib/secretaria/pdfDocumento');
const { docParaDocx } = require('../lib/secretaria/docxExportar');

const p = (t, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: t }] });
const h = (n, t) => ({ type: 'heading', attrs: { level: n }, content: [{ type: 'text', text: t }] });
const LAYOUT = {
    papel: 'oficio', orientacao: 'paisagem', margens: { sup: 3, inf: 2, esq: 3, dir: 2 }, numeracao_titulos: 'decimal', numeracao_paragrafos: '1)',
    estilos: { normal: { alinhamento: 'justify', recuo: 1.25, fonte: 'georgia' }, h1: { maiusculas: true, tamanho: 14 } },
    proprios: [{ id: 'ementa', nome: 'Ementa', margemEsq: 6, italico: true, tamanho: 10 }],
};

test('sanitizeLayout guarda só o permitido e o que difere do padrão', () => {
    assert.equal(L.sanitizeLayout(null), undefined);
    assert.equal(L.sanitizeLayout({ papel: 'A4', orientacao: 'retrato', margens: L.MARGENS_PADRAO, numeracao_paragrafos: '1.' }), undefined, 'igual ao padrão: nada');
    const l = L.sanitizeLayout({
        ...LAYOUT, papel: 'oficio', extra: 'x',
        margens: { sup: 3, inf: 2, esq: 3, dir: 99 }, // fora do limite: margens inteiras descartadas
        estilos: { normal: { cor: 'red', tamanho: 200, negrito: false, fonte: 'Comic' }, h9: { negrito: true } },
        proprios: [{ id: 'Ementa!', nome: 'x' }, { id: 'ok', nome: '  Assinatura  ', alinhamento: 'center' }, { id: 'ok', nome: 'duplicado' }],
        numeracao_titulos: 'grego',
    });
    assert.deepEqual(l, {
        papel: 'oficio', orientacao: 'paisagem',
        estilos: { normal: { negrito: false } },
        proprios: [{ id: 'ok', nome: 'Assinatura', alinhamento: 'center' }],
        numeracao_paragrafos: '1)',
    });
});

test('sanitizeDoc leva o layout do documento e os novos atributos de parágrafo e lista', () => {
    const doc = sanitizeDoc({
        type: 'doc', attrs: { layout: LAYOUT, outro: 1 },
        content: [
            p('a', { estilo: 'ementa', numerado: true, margemDir: 2, x: 1 }),
            p('b', { estilo: '<script>', numerado: 'sim' }),
            { type: 'bulletList', attrs: { marcador: 'dash' }, content: [{ type: 'listItem', content: [p('i')] }] },
            { type: 'bulletList', attrs: { marcador: 'estrela' }, content: [{ type: 'listItem', content: [p('i')] }] },
            { type: 'orderedList', attrs: { formato: 'upper-roman', separador: ')', start: 3 }, content: [{ type: 'listItem', content: [p('i')] }] },
        ],
    });
    assert.deepEqual(Object.keys(doc.attrs), ['layout']);
    assert.equal(doc.attrs.layout.proprios[0].id, 'ementa');
    assert.deepEqual(doc.content[0].attrs, { estilo: 'ementa', numerado: true, margemDir: 2 });
    assert.equal(doc.content[1].attrs, undefined);
    assert.deepEqual(doc.content[2].attrs, { marcador: 'dash' });
    assert.equal(doc.content[3].attrs, undefined);
    assert.deepEqual(doc.content[4].attrs, { start: 3, formato: 'upper-roman', separador: ')' });
    assert.equal(sanitizeDoc({ type: 'doc', content: [p('x')] }).attrs, undefined, 'documento sem layout continua sem attrs');
});

test('numeração automática de títulos e parágrafos', () => {
    const doc = { type: 'doc', attrs: { layout: { numeracao_titulos: 'decimal' } }, content: [h(1, 'A'), h(2, 'B'), h(2, 'C'), p('x', { numerado: true }), h(1, 'D'), h(3, 'E'), p('y', { numerado: true })] };
    const n = L.numerosAutomaticos(doc);
    assert.deepEqual(doc.content.map((c) => n.get(c)), ['1.', '1.1.', '1.2.', '1.', '2.', '2.0.1.', '2.']);
    doc.attrs.layout = { numeracao_titulos: 'romano', numeracao_paragrafos: '1º' };
    const r = L.numerosAutomaticos(doc);
    assert.deepEqual(doc.content.map((c) => r.get(c)), ['I.', '1.', '2.', '1º', 'II.', '0.1.', '2º']);
    assert.equal(L.numerosAutomaticos({ type: 'doc', content: [h(1, 'A')] }).size, 0, 'sem opção, títulos sem número');
    assert.equal(L.marcadorLista(28, 'lower-alpha', ')'), 'ab)');
    assert.equal(L.marcadorLista(14, 'upper-roman'), 'XIV.');
});

test('estilo do bloco: padrão, documento, próprio; Georgia e Garamond têm fonte própria', () => {
    const l = L.sanitizeLayout(LAYOUT);
    assert.deepEqual(L.estiloDoBloco(l, h(2, 'x')), L.ESTILOS_PADRAO.h2);
    assert.equal(L.estiloDoBloco(l, h(1, 'x')).maiusculas, true);
    assert.equal(L.estiloDoBloco(l, h(1, 'x')).negrito, true, 'herda o padrão do título');
    const em = L.estiloDoBloco(l, p('x', { estilo: 'ementa' }));
    assert.equal(em.italico, true);
    assert.equal(em.alinhamento, 'justify', 'estilo próprio por cima do Normal');
    assert.equal(fonteEquivalente('Georgia'), 'georgia');
    assert.equal(fonteEquivalente('EB Garamond'), 'garamond');
    assert.equal(fonteEquivalente('Open Sans'), 'open-sans');
    assert.equal(fonteEquivalente('Lato Light'), 'lato');
});

test('PDF: papel, orientação e margens do layout; sem layout, A4 de sempre', async () => {
    const conteudo = [h(1, 'Relatório'), p('Ementa', { estilo: 'ementa' }), p('Primeiro', { numerado: true }), { type: 'orderedList', attrs: { formato: 'lower-alpha', separador: ')' }, content: [{ type: 'listItem', content: [p('item')] }] }, { type: 'bulletList', attrs: { marcador: 'dash' }, content: [{ type: 'listItem', content: [p('item')] }] }];
    const tam = async (doc) => (await PDFDocument.load((await renderizarDocumento(doc, { cabecalho_linhas: ['MP'] })).buffer)).getPage(0).getSize();
    const a4 = await tam({ type: 'doc', content: conteudo });
    assert.equal(Math.round(a4.width), 595);
    assert.equal(Math.round(a4.height), 842);
    const of = await tam(sanitizeDoc({ type: 'doc', attrs: { layout: LAYOUT }, content: conteudo }));
    assert.equal(Math.round(of.width), Math.round(33 * 28.3465), 'ofício em paisagem: 33 cm de largura');
    assert.equal(Math.round(of.height), Math.round(21.6 * 28.3465));
});

test('Word (.docx): papel, margens, estilos próprios, numeração e listas', async () => {
    const doc = sanitizeDoc({
        type: 'doc', attrs: { layout: LAYOUT },
        content: [h(1, 'Relatório'), p('Ementa', { estilo: 'ementa' }), p('Primeiro', { numerado: true }),
            { type: 'orderedList', attrs: { formato: 'lower-alpha', separador: ')' }, content: [{ type: 'listItem', content: [p('item')] }] },
            { type: 'bulletList', attrs: { marcador: 'dash' }, content: [{ type: 'listItem', content: [p('item')] }] }],
    });
    const z = await JSZip.loadAsync(await docParaDocx(doc, {}));
    const corpo = await z.file('word/document.xml').async('string');
    const estilos = await z.file('word/styles.xml').async('string');
    const num = await z.file('word/numbering.xml').async('string');
    assert.match(corpo, /<w:pgSz w:w="18709" w:h="12246" w:orient="landscape"\/>/);
    assert.match(corpo, /<w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701"/);
    assert.match(corpo, /<w:pStyle w:val="Est-ementa"\/>/);
    assert.match(estilos, /w:styleId="Est-ementa"><w:name w:val="Ementa"\/>/);
    assert.match(estilos, /<w:rFonts w:ascii="Georgia"/, 'fonte do Normal no padrão do documento');
    assert.match(estilos, /<w:caps\/>/, 'Título 1 em maiúsculas');
    assert.match(num, /<w:numFmt w:val="lowerLetter"\/><w:lvlText w:val="%1\)"\/>/);
    assert.match(num, /<w:lvlText w:val="–"\/>/);
    assert.match(num, /<w:lvlText w:val="%1\)"\/><w:lvlJc w:val="left"\/><w:suff w:val="space"\/>/, 'parágrafo numerado com 1)');
    assert.match(num, /<w:lvlText w:val="%1.%2."\/>/, 'títulos 1.1.');
    // Toda numeração (num) aponta para uma definição (abstractNum) que existe.
    const abs = new Set([...num.matchAll(/abstractNumId="(\d+)"/g)].map((m) => m[1]));
    for (const m of num.matchAll(/<w:abstractNumId w:val="(\d+)"\/>/g)) assert.ok(abs.has(m[1]));
});

test('Word sem layout: a página de sempre (A4, 3/2 cm, timbrado)', async () => {
    const z = await JSZip.loadAsync(await docParaDocx({ type: 'doc', content: [p('x'), { type: 'orderedList', content: [{ type: 'listItem', content: [p('i')] }] }] }, { cabecalho_linhas: ['MP'] }));
    const corpo = await z.file('word/document.xml').async('string');
    assert.match(corpo, /<w:pgSz w:w="11906" w:h="16838"\/><w:pgMar w:top="2268" w:right="1134" w:bottom="1247" w:left="1701"/);
    assert.doesNotMatch(corpo, /Est-|<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="2"/);
    const num = await z.file('word/numbering.xml').async('string');
    assert.match(num, /<w:numFmt w:val="decimal"\/><w:lvlText w:val="%1."\/>/);
});
