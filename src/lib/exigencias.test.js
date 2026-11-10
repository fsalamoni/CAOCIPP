import test from 'node:test';
import assert from 'node:assert/strict';
import { atende, pendentesDaFase, realinharRegras, situacaoDaFase, sugeridas } from './exigencias.js';

const fase = { id: 'f1', acoes: ['Despachar', 'Certificar'], documentos: [{ descricao: 'Parecer', forma: 'juntar', tipo: 'Parecer' }],
    acoes_regras: [{ documento: { descricao: 'Despachar', forma: 'redigir', modelo_id: 'm1' } }, { autos: true }] };

test('situação e pendências da fase', () => {
    const cumpridas = { f1: { d0: { documento_id: 'x', ordem: 3 } } };
    assert.deepEqual(situacaoDaFase(fase, cumpridas).map((e) => [e.chave, e.cumprida?.ordem ?? null]), [['d0', 3], ['a0', null]]);
    assert.deepEqual(pendentesDaFase(fase, cumpridas).map((e) => e.chave), ['a0']);
    assert.deepEqual(pendentesDaFase(undefined, {}), []);
});

test('sugere pelo modelo ou tipo, respeitando a forma', () => {
    const pend = pendentesDaFase(fase, {});
    assert.deepEqual(sugeridas(pend, { origem: 'editor', modelo_id: 'm1' }), ['a0']);
    assert.deepEqual(sugeridas(pend, { origem: 'upload', tipo: 'PARECER' }), ['d0']);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor' }), false);
    assert.equal(atende({ forma: 'qualquer' }, { origem: 'upload' }), true);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor', peticao: true }), true);
});

test('regras seguem o texto da ação ao editar a lista', () => {
    const r = [{ autos: true }, null, { documento: { descricao: 'C' } }];
    // apagar a primeira linha: a regra de "C" continua em "C"
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['B', 'C']), [null, r[2]]);
    // reordenar
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['C', 'A', 'B']), [r[2], r[0], null]);
    // corrigir o texto de uma linha mantém a posição
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['Ax', 'B', 'C']), r);
    // linha nova em branco no fim
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['A', 'B', 'C', '']), [...r, null]);
    assert.equal(realinharRegras(['A'], undefined, ['B']), undefined);
    assert.equal(realinharRegras(['A', 'B'], [{ autos: true }, null], ['B']), undefined);
});
