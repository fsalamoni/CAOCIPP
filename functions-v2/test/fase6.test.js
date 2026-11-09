// Calendário do órgão, código de verificação e conversão de Office.
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const autos = require('../lib/secretaria/autos');
const conv = require('../lib/secretaria/conversao');
const { renderizarDocumento } = require('../lib/secretaria/pdfDocumento');

test('feriado local prorroga e recesso suspende o prazo', () => {
    // 2026-03-02 (segunda) + 5 úteis = 2026-03-09.
    assert.equal(s.calcularVencimento('2026-03-02', 5, 'uteis'), '2026-03-09');
    const cal = s.sanitizeCalendario({ feriados: [{ data: '2026-03-04', descricao: 'Aniversário da cidade' }, { data: 'lixo' }] });
    assert.equal(cal.feriados.length, 1);
    assert.equal(s.calcularVencimento('2026-03-02', 5, 'uteis', cal), '2026-03-10');
    // Corridos: o feriado local não suspende, só prorroga se cair nele.
    assert.equal(s.calcularVencimento('2026-03-02', 2, 'corridos', cal), '2026-03-05');
    // Recesso: dias não contam nem em corridos.
    const rec = s.sanitizeCalendario({ recessos: [{ inicio: '2026-07-01', fim: '2026-07-10' }, { inicio: '2026-08-10', fim: '2026-08-01' }] });
    assert.equal(rec.recessos.length, 1, 'período invertido descartado');
    assert.equal(s.calcularVencimento('2026-06-29', 5, 'corridos', rec), '2026-07-14'); // conta 30/06 e 11 a 14/07
    // Recesso forense (20/12 a 20/01).
    const forense = s.sanitizeCalendario({ recesso_forense: true });
    assert.equal(s.calcularVencimento('2026-12-18', 1, 'uteis', forense), '2027-01-21');
    assert.equal(s.somarDias('2026-12-31', 1), '2027-01-01');
});

test('código de verificação: formato, unicidade e normalização', () => {
    const c = autos.novoCodigo();
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    assert.notEqual(c, autos.novoCodigo());
    assert.equal(autos.normalizarCodigo(c.toLowerCase().replace(/-/g, ' ')), c);
    assert.equal(autos.normalizarCodigo('ABCD-EFGH-JKMN-PQRO'), 'ABCD-EFGH-JKMN-PQR0', 'O vira 0');
    assert.equal(autos.normalizarCodigo('curto'), '');
    assert.equal(autos.normalizarCodigo('UUUU-UUUU-UUUU-UUUU'), '', 'U não pertence ao alfabeto');
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('HTML do Word vira documento do editor saneado', () => {
    const doc = conv.htmlParaDoc(`<h1>Título</h1><p>Texto <strong>forte</strong> e <a href="javascript:x">link</a><br/>linha</p>
        <ul><li>um</li><li><p>dois</p></li></ul><table><tr><th>A</th><th>B</th></tr><tr><td colspan="2">C</td></tr></table>
        <p><img src="${PNG}" alt="logo"/></p><script>alert(1)</script>`);
    const tipos = doc.content.map((n) => n.type);
    assert.deepEqual(tipos, ['heading', 'paragraph', 'bulletList', 'table', 'image', 'paragraph']);
    assert.equal(doc.content[1].content[1].marks[0].type, 'bold');
    assert.equal(doc.content[1].content[3].marks, undefined, 'link javascript: removido');
    assert.equal(doc.content[1].content[4].type, 'hardBreak');
    assert.equal(doc.content[3].content[1].content[0].attrs.colspan, 2);
    assert.equal(doc.content[4].attrs.width, 10, 'largura lida do PNG (mínimo 10)');
    assert.equal(conv.larguraImagem(PNG), 1);
});

test('planilha vira tabela e Word real vira PDF', async () => {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nome', 'Valor'], ['A', 10], ['B', 20]]), 'Custas');
    const doc = conv.xlsxParaDoc(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    assert.equal(doc.content[0].content[0].text, 'Planilha: Custas');
    assert.equal(doc.content[1].content.length, 3);
    assert.equal(doc.content[1].content[0].content[0].type, 'tableHeader');

    // DOCX mínimo montado à mão (o JSZip vem com o mammoth).
    const JSZip = require('jszip');
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    z.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Parecer técnico</w:t></w:r></w:p><w:p><w:r><w:t>Conclusão.</w:t></w:r></w:p></w:body></w:document>');
    const buf = await z.generateAsync({ type: 'nodebuffer' });
    const docx = await conv.officeParaDoc(buf, conv.MIME_DOCX);
    assert.equal(docx.content[0].content[0].text, 'Parecer técnico');
    assert.equal(docx.content[0].content[0].marks[0].type, 'bold');
    const pdf = await renderizarDocumento(docx, {}, { semCabecalho: true });
    assert.equal(pdf.paginas, 1);
    assert.equal(await autos.paginasDeArquivo(buf, conv.MIME_DOCX), 1);
});
