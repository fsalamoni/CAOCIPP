// Registro nos autos e documentos exigidos pelo rito. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const a = require('../lib/shared/autos');
const s = require('../lib/shared/secretaria');

test('sanitizeRegras alinha regras às ações e descarta lixo', () => {
    const r = x.sanitizeRegras({
        registro: 'interno',
        acoes_regras: [{ autos: true }, { documento: { forma: 'redigir', tipo: 'Despacho' } }, { autos: 'sim' }],
        documentos: [{ descricao: 'Parecer', forma: 'xyz' }, { descricao: '' }, ...Array(9).fill({ descricao: 'D' })],
    }, ['Certificar', 'Despachar', 'Outra']);
    assert.equal(r.registro, 'interno');
    assert.deepEqual(r.acoes_regras, [{ autos: true }, { documento: { descricao: 'Despachar', forma: 'redigir', tipo: 'Despacho' } }, null]);
    assert.equal(r.documentos.length, x.MAX_DOCUMENTOS_FASE);
    assert.equal(r.documentos[0].forma, 'qualquer');
    assert.deepEqual(x.sanitizeRegras({ registro: 'outro' }, ['A']), {});
});

test('sanitizeRito preserva as regras da fase', () => {
    const rito = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A'], registro: 'remessas_fora', acoes_regras: [{ autos: true }], documentos: [{ descricao: 'Parecer' }] }] });
    const f = rito.fases[0];
    assert.equal(f.registro, 'remessas_fora');
    assert.deepEqual(f.acoes_regras, [{ autos: true }]);
    assert.deepEqual(f.documentos, [{ descricao: 'Parecer', forma: 'qualquer' }]);
    // linha vazia entre as ações: a regra continua com a ação certa
    const r2 = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A', ' ', 'B'], acoes_regras: [null, null, { autos: true }] }] });
    assert.deepEqual(r2.fases[0].acoes, ['A', 'B']);
    assert.deepEqual(r2.fases[0].acoes_regras, [null, { autos: true }]);
});

test('pendências, reconhecimento e forma do documento', () => {
    const fase = { id: 'f1', acoes: ['Despachar'], documentos: [{ descricao: 'Parecer', forma: 'juntar', tipo: 'Parecer' }],
        acoes_regras: [{ documento: { descricao: 'Despachar', forma: 'redigir', modelo_id: 'm1' } }] };
    assert.deepEqual(x.pendentesDaFase(fase, {}).map((e) => e.chave), ['d0', 'a0']);
    assert.deepEqual(x.pendentesDaFase(fase, { f1: { d0: { documento_id: 'x', ordem: 1 } } }).map((e) => e.chave), ['a0']);
    const pend = x.pendentesDaFase(fase, {});
    // reconhece pelo modelo e pelo tipo, respeitando a forma
    assert.deepEqual(x.reconhecer(pend, { origem: 'editor', modelo_id: 'm1' }), ['a0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'parecer' }), ['d0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'editor', tipo: 'Parecer' }), []);
    // escolha explícita é validada
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload' }, ['d0']), ['d0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload' }, []), []);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload' }, ['a0']), /redigido/);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload' }, ['d9']), /não está pendente/);
});

test('movimentoInterno segue o registro das fases', () => {
    const fases = [{ id: 'a' }, { id: 'b', registro: 'interno' }, { id: 'c', registro: 'remessas_fora' }];
    assert.equal(x.movimentoInterno(fases, 'a', 'b'), true);
    assert.equal(x.movimentoInterno(fases, 'b', 'a'), true);
    assert.equal(x.movimentoInterno(fases, 'a', 'c'), false);
    assert.equal(x.movimentoInterno(fases, 'c', null), true);
    assert.equal(x.movimentoInterno(fases, 'a', 'a'), false);
});

test('origem do evento e visibilidade para as partes', () => {
    assert.equal(a.origemEvento({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), 'interno');
    assert.equal(a.origemEvento({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), 'usuario');
    assert.equal(a.origemEvento({ seq: 1, tipo: 'acao_fase' }), 'sistema');
    assert.equal(a.geraTermo({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), false);
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), 'Certidão de cumprimento');
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), 'Remessa (registro interno)');
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'fase', dados: { interno: true } }), 'Mudança de fase (registro interno)');
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'tramitacao' }), true);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'acao_fase' }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), true);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'juntada', dados: { visivel_partes: false } }), false);
});
