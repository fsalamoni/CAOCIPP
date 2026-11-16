const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const sharp = require('sharp');
const { sanitizeDoc, fonteEquivalente, FONTES, FONTES_LEGADO } = require('../lib/shared/documento');
const { docxParaDoc, formatarNumero } = require('../lib/secretaria/docx');
const { odtParaDoc } = require('../lib/secretaria/odt');
const { docParaDocx, dimensoesImagem } = require('../lib/secretaria/docxExportar');
const { arquivoParaEditor } = require('../lib/secretaria/paraEditor');
const { renderizarDocumento, largurasColunas } = require('../lib/secretaria/pdfDocumento');
const { ehLegado, FONTES_ATUAIS } = require('../lib/secretaria/autos');

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_ODT = 'application/vnd.oasis.opendocument.text';

/** Todos os nós de um tipo, em profundidade. */
function todos(n, tipo, acc = []) {
    if (n.type === tipo) acc.push(n);
    (n.content || []).forEach((c) => todos(c, tipo, acc));
    return acc;
}
const textoDe = (n) => (n.type === 'text' ? n.text : (n.content || []).map(textoDe).join(''));
const marcaDe = (doc, trecho) => todos(doc, 'text').find((t) => t.text.includes(trecho))?.marks || [];
const p = (texto, attrs, marks) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: texto, ...(marks ? { marks } : {}) }] });

async function documentoRico() {
    const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#1d4ed8' } }).png().toBuffer();
    const cel = (t, attrs = {}) => ({ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [p(t)] });
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fundamentação' }] },
            p('Parágrafo justificado com recuo', { textAlign: 'justify', recuo: 1.25, espacamento: 1.5, antes: 12, depois: 0 }),
            p('Margem de dois', { margemEsq: 2 }),
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'negrito', marks: [{ type: 'bold' }] },
                    { type: 'text', text: ' vermelho', marks: [{ type: 'textStyle', attrs: { color: '#b91c1c', fontFamily: 'calibri', fontSize: '14pt' } }] },
                    { type: 'text', text: ' marcado', marks: [{ type: 'highlight', attrs: { color: '#fef08a' } }] },
                    { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
                    { type: 'text', text: ' site', marks: [{ type: 'link', attrs: { href: 'https://www.mprs.mp.br' } }] },
                ],
            },
            {
                type: 'bulletList',
                content: [
                    { type: 'listItem', content: [p('Item A'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('Subitem')] }] }] },
                    { type: 'listItem', content: [p('Item B')] },
                ],
            },
            { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('Terceiro')] }, { type: 'listItem', content: [p('Quarto')] }] },
            {
                type: 'table',
                content: [
                    { type: 'tableRow', content: [cel('Mesclada', { colspan: 2, colwidth: [100, 300] }), cel('Alta', { rowspan: 2, colwidth: [200] })] },
                    { type: 'tableRow', content: [cel('A2', { colwidth: [100] }), cel('B2', { colwidth: [300] })] },
                ],
            },
            { type: 'table', attrs: { semBordas: true }, content: [{ type: 'tableRow', content: [cel('Local e data'), cel('Assinatura')] }] },
            { type: 'image', attrs: { src: `data:image/png;base64,${png.toString('base64')}`, width: 200, align: 'center' } },
            { type: 'blockquote', content: [p('Citação')] },
            { type: 'horizontalRule' },
            { type: 'pageBreak' },
            p('Depois da quebra'),
        ],
    };
}

test('editor → Word → editor: a formatação volta igual e passa no validador', async () => {
    const original = await documentoRico();
    const buf = await docParaDocx(original, { cabecalho_linhas: ['MINISTÉRIO PÚBLICO'], rodape: 'Rodapé' }, { titulo: 'Teste' });
    const zip = await JSZip.loadAsync(buf);
    assert.ok(zip.file('word/header1.xml') && zip.file('word/footer1.xml') && zip.file('word/numbering.xml'));
    assert.match(await zip.file('word/footer1.xml').async('string'), /NUMPAGES/);

    const { doc } = await docxParaDoc(buf);
    assert.deepEqual(sanitizeDoc(doc), doc, 'nada fora do que o editor aceita');
    const h = todos(doc, 'heading')[0];
    assert.equal(h.attrs.level, 2);
    assert.equal(textoDe(h), 'Fundamentação');
    const just = todos(doc, 'paragraph').find((n) => textoDe(n) === 'Parágrafo justificado com recuo');
    assert.equal(just.attrs.textAlign, 'justify');
    assert.equal(just.attrs.recuo, 1.25);
    assert.equal(just.attrs.espacamento, 1.5);
    assert.equal(just.attrs.antes, 12);
    assert.equal(just.attrs.depois, 0);
    assert.equal(todos(doc, 'paragraph').find((n) => textoDe(n) === 'Margem de dois').attrs.margemEsq, 2);

    assert.ok(marcaDe(doc, 'negrito').some((m) => m.type === 'bold'));
    const ts = marcaDe(doc, 'vermelho').find((m) => m.type === 'textStyle').attrs;
    assert.equal(ts.color.toLowerCase(), '#b91c1c');
    assert.equal(ts.fontFamily, 'calibri');
    assert.equal(ts.fontSize, '14pt');
    assert.ok(marcaDe(doc, 'marcado').some((m) => m.type === 'highlight' || (m.type === 'textStyle' && m.attrs.backgroundColor)));
    assert.ok(marcaDe(doc, '2').some((m) => m.type === 'superscript'));
    assert.equal(marcaDe(doc, 'site').find((m) => m.type === 'link').attrs.href, 'https://www.mprs.mp.br');

    const bl = todos(doc, 'bulletList');
    assert.ok(bl.length >= 2, 'lista dentro de lista');
    const ol = todos(doc, 'orderedList')[0];
    assert.equal(ol.attrs?.start, 3);
    assert.deepEqual(ol.content.map(textoDe), ['Terceiro', 'Quarto']);

    const [t1, t2] = todos(doc, 'table');
    const c1 = t1.content[0].content;
    assert.equal(c1[0].attrs.colspan, 2);
    assert.equal(c1[1].attrs.rowspan, 2);
    assert.equal(t1.content[1].content.length, 2, 'a célula de baixo da mesclada não duplica');
    assert.equal(t2.attrs?.semBordas, true);
    assert.ok(!t1.attrs?.semBordas);

    const img = todos(doc, 'image')[0];
    assert.equal(img.attrs.align, 'center');
    assert.ok(Math.abs(img.attrs.width - 200) <= 1);
    assert.ok(todos(doc, 'pageBreak').length === 1);
    assert.ok(todos(doc, 'horizontalRule').length === 1);
    assert.ok(textoDe(doc).includes('Depois da quebra'));
});

test('ODT: estilos, listas, tabelas e espaçamento viram o mesmo do editor', async () => {
    const zip = new JSZip();
    zip.file('mimetype', MIME_ODT);
    zip.file('META-INF/manifest.xml', '<?xml version="1.0"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>');
    zip.file('styles.xml', `<?xml version="1.0"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"><office:styles><style:default-style style:family="paragraph"><style:text-properties style:font-name="Liberation Serif" fo:font-size="12pt"/></style:default-style></office:styles></office:document-styles>`);
    zip.file('content.xml', `<?xml version="1.0"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
<office:automatic-styles>
 <style:style style:name="P1" style:family="paragraph"><style:paragraph-properties fo:text-align="justify" fo:text-indent="1.25cm" fo:line-height="150%" fo:margin-top="0.212cm" fo:margin-bottom="0cm"/></style:style>
 <style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold" fo:color="#c9211e"/></style:style>
</office:automatic-styles>
<office:body><office:text>
 <text:h text:outline-level="1">Relatório</text:h>
 <text:p text:style-name="P1">Texto <text:span text:style-name="T1">forte</text:span> no ODT.</text:p>
 <text:list><text:list-item><text:p>Um</text:p></text:list-item><text:list-item><text:p>Dois</text:p></text:list-item></text:list>
 <table:table><table:table-column table:number-columns-repeated="2"/>
  <table:table-row><table:table-cell table:number-columns-spanned="2"><text:p>Junto</text:p></table:table-cell><table:covered-table-cell/></table:table-row>
  <table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row>
 </table:table>
</office:text></office:body></office:document-content>`);
    const { doc } = await odtParaDoc(await zip.generateAsync({ type: 'nodebuffer' }));
    assert.deepEqual(sanitizeDoc(doc), doc);
    assert.equal(textoDe(todos(doc, 'heading')[0]), 'Relatório');
    const par = todos(doc, 'paragraph').find((n) => textoDe(n).startsWith('Texto'));
    assert.equal(par.attrs.textAlign, 'justify');
    assert.equal(par.attrs.recuo, 1.25);
    assert.equal(par.attrs.espacamento, 1.5);
    assert.equal(par.attrs.antes, 6);
    assert.equal(par.attrs.depois, 0);
    const forte = marcaDe(doc, 'forte');
    assert.ok(forte.some((m) => m.type === 'bold'));
    assert.equal(forte.find((m) => m.type === 'textStyle').attrs.color.toLowerCase(), '#c9211e');
    assert.deepEqual(todos(doc, 'bulletList')[0].content.map(textoDe), ['Um', 'Dois']);
    const tab = todos(doc, 'table')[0];
    assert.equal(tab.content[0].content.length, 1);
    assert.equal(tab.content[0].content[0].attrs.colspan, 2);
});

test('qualquer arquivo abre no editor: texto, imagem; PDF digitalizado explica o motivo', async () => {
    const txt = await arquivoParaEditor(Buffer.from('Primeira linha\n\nSegunda linha'), 'text/plain', 't');
    assert.deepEqual(todos(txt.conteudo, 'paragraph').map(textoDe).filter(Boolean), ['Primeira linha', 'Segunda linha']);
    const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#fff' } }).png().toBuffer();
    const img = await arquivoParaEditor(png, 'image/png', 'foto');
    assert.equal(todos(img.conteudo, 'image').length, 1);
    assert.ok(img.avisos.length >= 1);
    const word = await arquivoParaEditor(await docParaDocx(await documentoRico(), {}, {}), MIME_DOCX, 'w');
    assert.ok(todos(word.conteudo, 'table').length === 2);
    // PDF sem texto (só imagem): erro com mensagem para o usuário, não um documento vazio.
    const { PDFDocument } = require('pdf-lib');
    const vazio = await PDFDocument.create();
    vazio.addPage();
    await assert.rejects(arquivoParaEditor(Buffer.from(await vazio.save()), 'application/pdf', 'scan'), /texto|digitaliz/i);
});

test('numeração do Word, fontes equivalentes e larguras de colunas', () => {
    assert.equal(formatarNumero(4, 'upperRoman'), 'IV');
    assert.equal(formatarNumero(27, 'lowerLetter'), 'aa');
    assert.equal(formatarNumero(2, 'ordinal'), '2º');
    assert.equal(formatarNumero(7, 'decimalZero'), '07');
    assert.equal(fonteEquivalente('Times New Roman'), 'serif');
    assert.equal(fonteEquivalente('Liberation Sans'), 'sans-serif');
    assert.equal(fonteEquivalente('Calibri Light'), 'calibri');
    assert.equal(fonteEquivalente('Cambria'), 'cambria');
    assert.equal(fonteEquivalente('Consolas'), 'monospace');
    assert.equal(fonteEquivalente('Fonte Desconhecida'), null);
    assert.deepEqual(Object.keys(FONTES).sort(), Object.keys(FONTES_LEGADO).sort());
    const l = largurasColunas([100, 300], 2, 400);
    assert.equal(l.length, 2);
    assert.ok(Math.abs(l[0] * 3 - l[1]) < 0.01 && l[0] + l[1] <= 400.01);
    assert.deepEqual(dimensoesImagem(Buffer.from('89504e470d0a1a0a0000000d4948445200000010000000080806000000', 'hex')), { w: 16, h: 8 });
});

test('documento antigo continua com as fontes de antes; o novo usa as do Office', async () => {
    assert.equal(ehLegado({}), true);
    assert.equal(ehLegado({ fontes: FONTES_ATUAIS }), false);
    const doc = { type: 'doc', content: [p('Texto com acentuação: ação, “aspas” e — travessão; ≥ fora do WinAnsi.')] };
    const novo = await renderizarDocumento(doc, { fonte_padrao: 'calibri' }, {});
    const antigo = await renderizarDocumento(doc, { fonte_padrao: 'calibri' }, { legado: true });
    assert.ok(novo.paginas === 1 && antigo.paginas === 1);
    const fontesDo = (b) => [...new Set(b.toString('latin1').match(/\/BaseFont\s*\/[A-Z]{6}\+?([A-Za-z-]+)|\/BaseFont\s*\/([A-Za-z-]+)/g) || [])].join(' ');
    assert.match(fontesDo(novo.buffer), /Carlito/);
    assert.doesNotMatch(fontesDo(antigo.buffer), /Carlito/);
});
