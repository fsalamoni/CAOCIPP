// Uso e custos: séries diárias e limites do alerta. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const { somarPorDia, limitesPassados } = require('../lib/platform/uso');

test('séries do Monitoring somadas por dia', () => {
    const m = somarPorDia([
        { points: [{ interval: { endTime: '2026-11-16T00:00:00Z' }, value: { int64Value: '100' } }, { interval: { endTime: '2026-11-17T00:00:00Z' }, value: { int64Value: '5' } }] },
        { points: [{ interval: { endTime: '2026-11-16T00:00:00Z' }, value: { doubleValue: 50 } }] },
    ]);
    assert.deepEqual([...m.entries()].sort(), [['2026-11-16', 150], ['2026-11-17', 5]]);
    assert.equal(somarPorDia(undefined).size, 0);
});

test('alerta: só os limites definidos e ultrapassados', () => {
    assert.deepEqual(limitesPassados({ leituras: 60000, escritas: 100 }, { leiturasDia: 50000, escritasDia: 20000 }), ['leituras: 60000 (limite 50000)']);
    assert.deepEqual(limitesPassados({ leituras: 60000, escritas: 30000 }, { leiturasDia: 0, escritasDia: 20000 }), ['gravações: 30000 (limite 20000)']);
    assert.deepEqual(limitesPassados({ leituras: 1, escritas: 1 }, {}), []);
});
