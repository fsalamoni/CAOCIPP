// Importação de modelos (etapa 2): Word com cabeçalho, rodapé e imagem, PDF,
// texto, campos e preenchimento do DOCX original.
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const im = require('../lib/secretaria/importarModelo');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// PNG 1x1.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const p = (t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;

async function docx() {
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
        + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
        + '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
    // Campo quebrado pelo Word em dois trechos de formatação.
    z.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>`
        + `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>DESPACHO</w:t></w:r></w:p>`
        + `<w:p><w:r><w:t xml:space="preserve">Processo nº {{nu</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>mero}} – «Interessado».</w:t></w:r></w:p>`
        + p('Porto Alegre, [DATA POR EXTENSO]. Ver nota [1].')
        + p('Campo próprio: {{ Comarca de origem }}')
        + `<w:sectPr><w:headerReference w:type="default" r:id="rId7"/><w:footerReference w:type="default" r:id="rId8"/></w:sectPr></w:body></w:document>`);
    z.file('word/header1.xml', `<?xml version="1.0"?><w:hdr ${W} xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">`
        + `<w:p><w:r><w:drawing><a:blip r:embed="rIdImg"/></w:drawing></w:r></w:p>`
        + p('MINISTÉRIO PÚBLICO DO ESTADO') + p('Promotoria de Justiça &amp; Cidadania') + '</w:hdr>');
    z.file('word/_rels/header1.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>');
    z.file('word/media/image1.png', PNG);
    z.file('word/footer1.xml', `<?xml version="1.0"?><w:ftr ${W}>${p('Rua Andrade Neves, 106')}${p('3')}</w:ftr>`);
    z.file('word/styles.xml', `<?xml version="1.0"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
    return z.generateAsync({ type: 'nodebuffer' });
}

const textos = (doc) => JSON.stringify(doc).match(/"text":"[^"]*"/g).join(' ');

test('campos: variantes viram {{chave}}; [1] fica', () => {
    const a = new Set(); const d = new Set();
    assert.equal(im.normalizarCampos('Nº [NÚMERO DO PROCESSO], «Data», <<partes>>, ${Assunto}, nota [1]', a, d),
        'Nº {{numero}}, {{data}}, {{partes}}, {{assunto}}, nota [1]');
    assert.deepEqual([...a].sort(), ['assunto', 'data', 'numero', 'partes']);
    assert.equal(im.normalizarCampos('{{Vara X}}', a, d), '{{vara_x}}');
    assert.deepEqual([...d], ['Vara X']);
});

test('Word: corpo, cabeçalho com brasão, rodapé sem número de página, fonte', async () => {
    const r = await im.interpretarModelo(await docx(), DOCX);
    assert.deepEqual(r.timbrado.cabecalho_linhas, ['MINISTÉRIO PÚBLICO DO ESTADO', 'Promotoria de Justiça & Cidadania']);
    assert.match(r.timbrado.brasao, /^data:image\/png;base64,/);
    assert.equal(r.timbrado.rodape, 'Rua Andrade Neves, 106');
    assert.equal(r.timbrado.fonte_padrao, 'sans-serif');
    assert.equal(r.timbrado.tamanho_padrao, 12);
    const t = textos(r.conteudo);
    assert.match(t, /DESPACHO/);
    assert.match(t, /\{\{data_extenso\}\}/);
    assert.match(t, /\{\{partes\}\}/);
    assert.match(t, /\[1\]/);
    assert.ok(r.campos.includes('partes') && r.campos.includes('data_extenso'));
    assert.deepEqual(r.desconhecidos, ['Comarca de origem']);
});

test('Word original: preenche campo quebrado em trechos e mantém o XML válido', async () => {
    const out = await im.preencherDocx(await docx(), { numero: '000123/2026', partes: 'Ana & Bia', data_extenso: 'x' });
    const xml = await (await JSZip.loadAsync(out)).file('word/document.xml').async('string');
    // As marcações entre as chaves somem com o campo; os trechos continuam fechados.
    assert.match(xml, /<w:r><w:t xml:space="preserve">Processo nº 000123\/2026 – Ana &amp; Bia\.<\/w:t><\/w:r>/);
    assert.ok(!xml.includes('{{nu'));
    // [DATA POR EXTENSO] no original fica (colchetes só são campo no editor).
    assert.match(xml, /\[DATA POR EXTENSO\]/);
    // Continua legível pelo mammoth.
    const r = await im.interpretarModelo(out, DOCX);
    assert.match(textos(r.conteudo), /000123\/2026/);
});

test('PDF: cabeçalho e rodapé repetidos, parágrafos e campos', async () => {
    const d = await PDFDocument.create();
    const f = await d.embedFont(StandardFonts.Helvetica);
    for (let i = 1; i <= 2; i++) {
        const pg = d.addPage([595, 842]);
        pg.drawText('PROMOTORIA DE JUSTICA', { x: 50, y: 800, size: 12, font: f });
        pg.drawText(i === 1 ? 'OFICIO n. [NUMERO]' : 'continua', { x: 50, y: 700, size: 12, font: f });
        pg.drawText('Primeira linha do paragrafo', { x: 50, y: 686, size: 12, font: f });
        pg.drawText('que segue aqui', { x: 50, y: 672, size: 12, font: f });
        pg.drawText('Outro paragrafo depois do espaco', { x: 50, y: 630, size: 12, font: f });
        pg.drawText('Rua X, 1', { x: 50, y: 40, size: 9, font: f });
        pg.drawText(String(i), { x: 500, y: 20, size: 9, font: f });
    }
    const r = await im.interpretarModelo(Buffer.from(await d.save()), 'application/pdf');
    assert.deepEqual(r.timbrado.cabecalho_linhas, ['PROMOTORIA DE JUSTICA']);
    assert.equal(r.timbrado.rodape, 'Rua X, 1');
    const t = textos(r.conteudo);
    assert.match(t, /OFICIO n\. \{\{numero\}\}/);
    assert.match(t, /Primeira linha do paragrafo que segue aqui/);
    assert.ok(!/PROMOTORIA/.test(t) && !/Rua X/.test(t));
});

test('PDF sem texto e formato não aceito', async () => {
    const d = await PDFDocument.create(); d.addPage();
    await assert.rejects(im.interpretarModelo(Buffer.from(await d.save()), 'application/pdf'), /não tem texto/);
    await assert.rejects(im.interpretarModelo(Buffer.from('x'), 'image/png'), /Formato/);
});

test('TXT e HTML', async () => {
    const t = await im.interpretarModelo(Buffer.from('Linha um\ncontinua\n\nSegundo {{assunto}}'), 'text/plain');
    assert.equal(t.conteudo.content.length, 2);
    const h = await im.interpretarModelo(Buffer.from('<h1>Título</h1><script>alert(1)</script><p>Olá <b>«usuário»</b></p>'), 'text/html');
    assert.ok(!JSON.stringify(h.conteudo).includes('alert'));
    assert.match(textos(h.conteudo), /\{\{usuario\}\}/);
});
