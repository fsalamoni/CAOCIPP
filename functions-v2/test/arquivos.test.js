const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { envioDaConta, conteudoConfere, conteudoParaGravar, conteudoGravado, MAX_CONTEUDO_NO_BANCO } = require('../lib/shared/arquivo');
const { otimizarImagem } = require('../lib/secretaria/imagem');
const { versaoDeLeitura } = require('../lib/secretaria/autos');

test('envio: só da própria conta e no formato do navegador', () => {
    assert.equal(envioDaConta('secretaria-envios/u1/abcdefghijklmnop1234', 'u1'), true);
    assert.equal(envioDaConta('secretaria-envios/u2/abcdefghijklmnop1234', 'u1'), false);
    assert.equal(envioDaConta('secretaria-envios/u1/../u2/abcdefghijklmnop', 'u1'), false);
    assert.equal(envioDaConta('secretaria/org/proc/doc', 'u1'), false);
    assert.equal(envioDaConta('secretaria-envios/u1/curto', 'u1'), false);
    assert.equal(envioDaConta(null, 'u1'), false);
});

test('conteúdo confere com o tipo declarado', () => {
    assert.equal(conteudoConfere(Buffer.from('%PDF-1.7\n...'), 'application/pdf'), true);
    assert.equal(conteudoConfere(Buffer.from('MZ\x90\x00executavel'), 'application/pdf'), false);
    assert.equal(conteudoConfere(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]), 'image/png'), true);
    assert.equal(conteudoConfere(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
    assert.equal(conteudoConfere(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/png'), false);
    assert.equal(conteudoConfere(Buffer.from('PK\x03\x04'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true);
    assert.equal(conteudoConfere(Buffer.from('texto simples'), 'text/plain'), true);
    assert.equal(conteudoConfere(Buffer.from([0x61, 0x00, 0x62]), 'text/plain'), false);
    assert.equal(conteudoConfere(Buffer.alloc(0), 'text/plain'), false);
});

test('texto do editor: JSON no banco até o limite, Storage acima; lê as formas antigas', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'oi' }] }] };
    const r = conteudoParaGravar(doc);
    assert.equal(r.noBanco, true);
    assert.deepEqual(conteudoGravado({ conteudo_json: r.json }), doc);
    assert.deepEqual(conteudoGravado({ conteudo: doc }), doc); // mapa gravado antes
    assert.equal(conteudoGravado({}), null);
    const grande = { type: 'doc', content: [{ type: 'image', attrs: { src: `data:image/jpeg;base64,${'A'.repeat(MAX_CONTEUDO_NO_BANCO)}` } }] };
    assert.equal(conteudoParaGravar(grande).noBanco, false);
});

test('imagem: foto grande fica menor, sem passar de 300 dpi numa A4; o original não muda', async () => {
    const original = await sharp({ create: { width: 4000, height: 3000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 30 } } }).png().toBuffer();
    const copia = Buffer.from(original);
    const r = await otimizarImagem(original, 'image/png');
    assert.ok(r, 'deveria otimizar');
    assert.ok(r.buf.length < original.length / 2, `${r.buf.length} >= ${original.length / 2}`);
    const meta = await sharp(r.buf).metadata();
    assert.ok(meta.width <= 2480 && meta.height <= 3508);
    assert.ok(original.equals(copia));
});

test('imagem: captura de tela em PNG continua PNG, pixel a pixel igual', async () => {
    const tela = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } }).png({ compressionLevel: 0 }).toBuffer();
    const r = await otimizarImagem(tela, 'image/png');
    assert.equal(r.mime, 'image/png');
    const [a, b] = await Promise.all([sharp(tela).raw().toBuffer(), sharp(r.buf).raw().toBuffer()]);
    assert.ok(a.equals(b));
});

test('imagem: foto de celular deitada (EXIF) sai na orientação certa', async () => {
    const deitada = await sharp({ create: { width: 300, height: 100, channels: 3, background: '#808080' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const r = await otimizarImagem(deitada, 'image/jpeg');
    assert.ok(r);
    const meta = await sharp(r.buf).metadata();
    assert.equal(meta.width, 100);
    assert.equal(meta.height, 300);
});

test('versão de leitura: imagem vira uma folha A4; PDF já enxuto fica como está', async () => {
    const foto = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#336699' } }).jpeg({ quality: 95 }).toBuffer();
    const folha = await versaoDeLeitura(foto, { mime: 'image/jpeg', titulo: 'Foto', sha256: 'x' });
    const pdf = await PDFDocument.load(folha);
    assert.equal(pdf.getPageCount(), 1);
    const p = await PDFDocument.create();
    p.addPage();
    const enxuto = Buffer.from(await p.save({ useObjectStreams: true }));
    assert.equal(await versaoDeLeitura(enxuto, { mime: 'application/pdf', titulo: 'PDF' }), null);
});

test('pacote ZIP (Word, LibreOffice, planilha): barra a bomba de descompressão antes de abrir', async () => {
    const JSZip = require('jszip');
    const { abrirZip, MAX_ZIP_ENTRADA } = require('../lib/secretaria/conversaoComum');
    const { officeParaDoc } = require('../lib/secretaria/conversao');
    const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    // Parte declarada acima do teto: poucos KB de arquivo, mais de 120 MB descompactado.
    const z = new JSZip();
    z.file('word/document.xml', Buffer.alloc(MAX_ZIP_ENTRADA + 1024));
    const bomba = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    assert.ok(bomba.length < 1024 * 1024);
    await assert.rejects(abrirZip(bomba), /grande demais/);
    await assert.rejects(officeParaDoc(bomba, MIME_DOCX), /grande demais/);
    // Cabeçalho que mente (declara 1 KB e esconde 2 MB): descompacta com teto e recusa.
    const z2 = new JSZip();
    z2.file('word/document.xml', Buffer.alloc(2 * 1024 * 1024));
    const mente = await z2.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    for (const [sig, off] of [[0x04034b50, 22], [0x02014b50, 24]]) {
        for (let i = 0; i < mente.length - 4; i++) if (mente.readUInt32LE(i) === sig) mente.writeUInt32LE(1024, i + off);
    }
    await assert.rejects(abrirZip(mente), /grande demais|estrutura interna/);
    // Pacote normal abre.
    const ok = new JSZip();
    ok.file('word/document.xml', '<w:document/>');
    assert.ok(await abrirZip(await ok.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })));
});
