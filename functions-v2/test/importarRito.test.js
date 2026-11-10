// Importação de rito por arquivo (servidor): texto de PDF com várias páginas
// e pacote do Bizagi (.bpm) com páginas em ZIP aninhado.
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const im = require('../lib/secretaria/importarModelo');

test('PDF do rito: número separado do nome ganha espaço, cabeçalho e rodapé repetidos saem', async () => {
    const d = await PDFDocument.create();
    const f = await d.embedFont(StandardFonts.Helvetica);
    const fases = [['1.', 'Autuacao'], ['2.', 'Decisao']];
    fases.forEach(([n, nome], i) => {
        const pg = d.addPage([595, 842]);
        pg.drawText(`10/11/2026, 15:0${i} Manual do rito`, { x: 40, y: 815, size: 9, font: f });
        // Número e nome desenhados separados, como sai de formulários e do Word.
        pg.drawText(n, { x: 60, y: 700, size: 12, font: f });
        pg.drawText(nome, { x: 86, y: 700, size: 12, font: f });
        pg.drawText('Unidade: Secretaria', { x: 86, y: 680, size: 12, font: f });
        pg.drawText(`https://exemplo.org/manual ${i + 1}/2`, { x: 40, y: 20, size: 9, font: f });
    });
    const r = await im.textoParaRito(Buffer.from(await d.save()), 'application/pdf');
    assert.match(r.texto, /^1\. Autuacao$/m);
    assert.match(r.texto, /^2\. Decisao$/m);
    assert.ok(!/Manual do rito|exemplo\.org/.test(r.texto), r.texto);
});

test('PDF digitalizado (sem texto) explica o motivo', async () => {
    const d = await PDFDocument.create(); d.addPage();
    await assert.rejects(im.textoParaRito(Buffer.from(await d.save()), 'application/pdf'), /não tem texto selecionável/);
});

const XPDL = (id) => `<?xml version="1.0"?><Package xmlns="http://www.wfmc.org/2009/XPDL2.2" Id="${id}"><WorkflowProcesses><WorkflowProcess Id="${id}"/></WorkflowProcesses></Package>`;

test('pacote do Bizagi: abre os .diag aninhados e devolve só os diagramas', async () => {
    const diag1 = new JSZip();
    diag1.file('Diagram.xml', XPDL('p1'));
    diag1.file('Actions.xml', '<Actions/>');
    const diag2 = new JSZip();
    diag2.file('Diagram.xml', XPDL('p2'));
    const bpm = new JSZip();
    bpm.file('ModelInfo.xml', '<ModelInfo/>');
    bpm.file('aaa.diag', await diag1.generateAsync({ type: 'nodebuffer' }));
    bpm.file('bbb.diag', await diag2.generateAsync({ type: 'nodebuffer' }));
    bpm.file('imagem.png', Buffer.from([1, 2, 3]));
    const r = await im.textoParaRito(await bpm.generateAsync({ type: 'nodebuffer' }), im.MIME_BIZAGI);
    assert.deepEqual(r.diagramas.map((x) => x.nome), ['aaa.diag/Diagram.xml', 'bbb.diag/Diagram.xml']);
    assert.match(r.diagramas[1].xml, /Id="p2"/);
});

test('pacote do Bizagi sem diagrama ou corrompido avisa como exportar', async () => {
    const z = new JSZip();
    z.file('leia.txt', 'nada');
    await assert.rejects(im.diagramasDoPacote(await z.generateAsync({ type: 'nodebuffer' })), /Exportar > BPMN ou XPDL/);
    await assert.rejects(im.diagramasDoPacote(Buffer.from('PK nada')), /não pôde ser aberto/);
});
