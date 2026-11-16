'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Partida a frio: a instância de cada function carrega o index e o módulo da
// função. Bibliotecas de PDF, Word e Excel só entram quando o ato as usa.
const PESADAS = ['pdf-lib', 'pdfmake', 'qrcode', 'mammoth', 'jszip', 'xlsx', 'node-html-parser', '@google-cloud/bigquery'];

function pacotesAoCarregar(arquivo, exportado) {
    const codigo = `
        const m = require(${JSON.stringify(arquivo)});
        ${exportado ? `void m[${JSON.stringify(exportado)}];` : ''}
        const pacotes = new Set(Object.keys(require.cache).map((f) => (f.match(/node_modules\\/((@[^/]+\\/)?[^/]+)/) || [])[1]).filter(Boolean));
        process.stdout.write(JSON.stringify([...pacotes]));`;
    return JSON.parse(execFileSync(process.execPath, ['-e', codigo], { cwd: path.join(__dirname, '..') }).toString());
}

test('o index não carrega módulo nenhum antes de a função ser chamada', () => {
    const pacotes = pacotesAoCarregar('./lib/index.js');
    for (const p of PESADAS) assert.ok(!pacotes.includes(p), `${p} carregado só por abrir o index`);
});

test('as funções do Processo Eletrônico partem sem as bibliotecas de PDF, Word e Excel', () => {
    for (const nome of ['secretariaProcesso', 'secretariaConfig', 'secretariaDocumento', 'secretariaPortal']) {
        const pacotes = pacotesAoCarregar('./lib/index.js', nome);
        for (const p of PESADAS) assert.ok(!pacotes.includes(p), `${nome} carregou ${p} na partida`);
    }
});

test('os exports do index continuam sendo as functions (descoberta do deploy)', () => {
    const codigo = `
        const m = require('./lib/index.js');
        const nomes = Object.keys(m).filter((k) => typeof m[k] === 'function' && m[k].__endpoint);
        process.stdout.write(JSON.stringify(nomes));`;
    const nomes = JSON.parse(execFileSync(process.execPath, ['-e', codigo], { cwd: path.join(__dirname, '..') }).toString());
    for (const n of ['secretariaProcesso', 'secretariaConfig', 'secretariaDocumento', 'secretariaExportarPdf', 'secretariaPortal', 'createOrganization', 'getUserOrganizations']) {
        assert.ok(nomes.includes(n), `${n} sumiu do index`);
    }
    assert.ok(nomes.length >= 80, `só ${nomes.length} functions no index`);
});
