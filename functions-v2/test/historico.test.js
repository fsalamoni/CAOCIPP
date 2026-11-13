// Histórico da configuração do PE: quais ações entram e em que assunto.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const s = require('../lib/shared/secretaria');

test('histórico: todas as ações de configuração emitidas pelo código têm assunto; as de processo ficam fora', () => {
    const dir = path.join(__dirname, '../src');
    const arquivos = [];
    const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) andar(p); else if (p.endsWith('.ts')) arquivos.push(p);
    });
    andar(dir);
    const emitidas = new Set(arquivos.flatMap((f) => fs.readFileSync(f, 'utf8').match(/'SECRETARIA_[A-Z_]+'/g) || []).map((x) => x.slice(1, -1)));
    const fora = new Set(['SECRETARIA_PROCESSO_EXCLUIDO', 'SECRETARIA_PROCESSO_RESTAURADO', 'SECRETARIA_PDF_EXPORTADO']);
    for (const a of emitidas) {
        if (fora.has(a)) assert.equal(s.HISTORICO_CONFIG[a], undefined, a);
        else assert.ok(s.HISTORICO_CONFIG[a], `sem assunto: ${a}`);
    }
});

test('histórico: lotes de até 30, filtro por assunto e versão restaurada pelo que voltou', () => {
    const todas = s.acoesHistorico();
    assert.ok(todas.every((l) => l.length <= 30 && l.length > 0));
    assert.equal(todas.flat().length, Object.keys(s.HISTORICO_CONFIG).length);
    assert.deepEqual(s.acoesHistorico('xyz').flat().length, todas.flat().length, 'assunto desconhecido = todas');
    const ritos = s.acoesHistorico('ritos').flat();
    assert.ok(ritos.includes('SECRETARIA_RITO_SALVO') && ritos.includes('SECRETARIA_VERSAO_RESTAURADA') && !ritos.includes('SECRETARIA_TIPO_SALVO'));
    assert.ok(s.acoesHistorico('documentos').flat().includes('SECRETARIA_VERSAO_RESTAURADA'));
    assert.ok(!s.acoesHistorico('calendario').flat().includes('SECRETARIA_VERSAO_RESTAURADA'));
    assert.equal(s.assuntoHistorico('SECRETARIA_VERSAO_RESTAURADA', { colecao: 'modelo' }), 'documentos');
    assert.equal(s.assuntoHistorico('SECRETARIA_VERSAO_RESTAURADA', { colecao: 'rito' }), 'ritos');
    assert.equal(s.assuntoHistorico('SECRETARIA_PDF_EXPORTADO'), null);
});
