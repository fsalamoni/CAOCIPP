// Documento do editor: lista fechada, conversão do formato antigo e PDF.
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../lib/shared/documento');
const { renderizarDocumento } = require('../lib/secretaria/pdfDocumento');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const t = (text, marks) => (marks ? { type: 'text', text, marks } : { type: 'text', text });

test('sanitizeDoc mantém o permitido e descarta o resto', () => {
    const doc = d.sanitizeDoc({
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 2, textAlign: 'center', onclick: 'x' }, content: [t('Título')] },
            { type: 'paragraph', attrs: { recuo: 1.25, espacamento: 1.5, textAlign: 'justify' }, content: [
                t('negrito', [{ type: 'bold' }, { type: 'script' }]),
                t('link', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
                t('ok', [{ type: 'link', attrs: { href: 'https://x.org' } }, { type: 'textStyle', attrs: { color: '#ff0000', fontFamily: 'Comic', fontSize: '14pt' } }]),
            ] },
            { type: 'iframe', attrs: { src: 'https://mal' } },
            { type: 'image', attrs: { src: 'https://rastreador/x.png' } },
            { type: 'image', attrs: { src: PNG, width: 100 } },
            { type: 'doc', content: [] },
        ],
    });
    assert.equal(doc.content.length, 3);
    assert.deepEqual(doc.content[0].attrs, { level: 2, textAlign: 'center' });
    const [neg, lnk, ok] = doc.content[1].content;
    assert.deepEqual(neg.marks, [{ type: 'bold' }]);
    assert.equal(lnk.marks, undefined, 'link javascript: cai fora');
    assert.deepEqual(ok.marks[1], { type: 'textStyle', attrs: { color: '#ff0000', fontSize: '14pt' } });
    assert.equal(doc.content[2].type, 'image');
    assert.throws(() => d.sanitizeDoc({ type: 'doc', content: [{ type: 'paragraph', content: [t('x'.repeat(700000))] }] }), /grande demais/);
    assert.deepEqual(d.sanitizeDoc(null), { type: 'doc', content: [{ type: 'paragraph' }] });
});

test('documento antigo (Delta) vira o formato novo', () => {
    const doc = d.deltaParaDoc([
        { insert: 'Título' }, { insert: '\n', attributes: { header: 1 } },
        { insert: 'a', attributes: { bold: true } }, { insert: ' b\n' },
        { insert: 'um' }, { insert: '\n', attributes: { list: 'bullet' } },
        { insert: 'dois' }, { insert: '\n', attributes: { list: 'bullet' } },
        { insert: 'fim\n' },
    ]);
    assert.deepEqual(doc.content.map((n) => n.type), ['heading', 'paragraph', 'bulletList', 'paragraph']);
    assert.equal(doc.content[2].content.length, 2);
    assert.deepEqual(doc.content[1].content[0], { type: 'text', text: 'a', marks: [{ type: 'bold' }] });
    assert.equal(d.docParaTexto(doc), 'Título\na b\num\ndois\nfim');
});

test('PDF do documento: formatação, tabela mesclada, imagem, quebra de página e assinatura', async () => {
    const doc = d.sanitizeDoc({
        type: 'doc',
        content: [
            { type: 'paragraph', attrs: { textAlign: 'justify', recuo: 1.25 }, content: [t('Ação civil — “aspas” e ✓ símbolo', [{ type: 'bold' }, { type: 'underline' }, { type: 'strike' }]), t('2', [{ type: 'superscript' }])] },
            { type: 'table', content: [
                { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 2 }, content: [{ type: 'paragraph', content: [t('Cabeçalho')] }] }] },
                { type: 'tableRow', content: [{ type: 'tableCell', attrs: { rowspan: 2 }, content: [{ type: 'paragraph', content: [t('A')] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [t('B')] }] }] },
                { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [t('C')] }] }] },
            ] },
            { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [t('item')] }] }] },
            { type: 'image', attrs: { src: PNG, width: 80 } },
            { type: 'pageBreak' },
            { type: 'blockquote', content: [{ type: 'paragraph', content: [t('citação', [{ type: 'textStyle', attrs: { fontFamily: 'sans-serif' } }])] }] },
        ],
    });
    const { buffer, paginas } = await renderizarDocumento(doc, { cabecalho_linhas: ['Órgão', 'Secretaria'], brasao: PNG, rodape: 'Rua X' }, {
        assinaturas: [{ nome: 'Fulana', em: '2026-11-08T12:00:00Z' }], sha256: 'abc',
    });
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    assert.equal(paginas, 2);
});
