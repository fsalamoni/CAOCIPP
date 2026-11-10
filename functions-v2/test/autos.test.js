const test = require('node:test');
const assert = require('node:assert/strict');
const { origemEvento, geraTermo, documentoDoEvento, folhasDoEvento, extrasDoEvento, sanitizeSelecao, selecionar, tituloEvento } = require('../lib/shared/autos');

const movs = [
    { seq: 1, tipo: 'autuacao', dados: {}, folha: 1 },
    { seq: 2, tipo: 'atribuicao', dados: {} },
    { seq: 3, tipo: 'juntada', dados: { documento_id: 'd1', ordem: 1 } },
    { seq: 4, tipo: 'conclusao', dados: {}, folha: 5 },
    { seq: 5, tipo: 'prazo_vencido', dados: { automatico: true } },
    { seq: 6, tipo: 'tramitacao', dados: {} }, // processo antigo: termo sem folha
];
const docs = new Map([['d1', { folha_inicial: 2, folha_final: 4 }]]);

test('origem: controle interno e automáticos são do sistema; o resto é ato de usuário', () => {
    assert.deepEqual(movs.map(origemEvento), ['usuario', 'sistema', 'usuario', 'usuario', 'sistema', 'usuario']);
});

test('termo: só ato de usuário que não juntou documento', () => {
    assert.deepEqual(movs.map(geraTermo), [true, false, false, true, false, true]);
    assert.equal(documentoDoEvento(movs[2]), 'd1');
    // pendência aponta um documento, mas não o juntou: gera termo
    assert.equal(geraTermo({ seq: 9, tipo: 'pendencia', dados: { documento_id: 'd1' } }), true);
});

test('folhas do evento: as do documento ou a do termo', () => {
    assert.deepEqual(movs.map((m) => folhasDoEvento(m, docs)), [[1, 1], null, [2, 4], [5, 5], null, null]);
    assert.deepEqual(extrasDoEvento(movs[2], docs), { origem: 'usuario', titulo: 'Juntada de documento', folhas: [2, 4], documento_id: 'd1' });
    assert.equal(tituloEvento({ seq: 1, tipo: 'tipo_novo' }), 'Certidão');
});

test('seleção: integral, exceto, apenas e intervalo de folhas', () => {
    const inc = (raw) => [...selecionar(movs, docs, sanitizeSelecao(raw)).incluidos];
    assert.deepEqual(inc(null), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(inc({ modo: 'exceto', eventos: [2, 3] }), [1, 4, 5, 6]);
    assert.deepEqual(inc({ modo: 'apenas', eventos: [3, 3, 99] }), [3]);
    const r = selecionar(movs, docs, sanitizeSelecao({ modo: 'intervalo', folha_de: 3, folha_a: 5 }));
    assert.deepEqual([...r.incluidos], [3, 4]);
    assert.deepEqual(r.recorte.get(3), [3, 4]); // só as folhas 3 e 4 do documento
    assert.deepEqual(r.recorte.get(4), [5, 5]);
});

test('seleção inválida é recusada com mensagem', () => {
    assert.throws(() => sanitizeSelecao({ modo: 'apenas', eventos: [] }), /Marque ao menos um evento/);
    assert.throws(() => sanitizeSelecao({ modo: 'intervalo', folha_de: 5, folha_a: 2 }), /intervalo de folhas/);
    assert.throws(() => sanitizeSelecao({ modo: 'intervalo', folha_de: 'x' }), /intervalo de folhas/);
    assert.deepEqual(sanitizeSelecao({ modo: 'qualquer', eventos: ['a', -1, 2.5], capa: false }), { modo: 'integral', eventos: [], capa: false, indice: true });
});
