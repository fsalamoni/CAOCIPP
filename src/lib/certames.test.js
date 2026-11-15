// Rodar: node --test src/lib/certames.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { alertasDaProposta, faltaPara, lotesIncompletos, numero, quandoBr, unidadesDeDisputa, valorEstimado, valorNaUnidade } from './certames.js';

const aviso = {
    criterio: 'menor_preco', unidade_disputa: 'lote',
    itens: [
        { id: 'i1', numero: 1, quantidade: 100, valor_estimado: 25.9, lote: 1 },
        { id: 'i2', numero: 2, quantidade: 10, valor_estimado: 40, lote: 1 },
        { id: 'i3', numero: 3, quantidade: 2, lote: 2 },
    ],
};

test('disputa: números brasileiros, lotes e valor estimado', () => {
    assert.equal(numero('1.234,5'), 1234.5);
    assert.ok(Number.isNaN(numero('')));
    assert.deepEqual(unidadesDeDisputa(aviso).map((u) => [u.nome, u.itens.length]), [['Lote 1', 2], ['Lote 2', 1]]);
    assert.deepEqual(unidadesDeDisputa({ ...aviso, unidade_disputa: 'item' }).map((u) => u.nome), ['Item 1', 'Item 2', 'Item 3']);
    assert.equal(valorEstimado(aviso.itens), 2990);
    assert.equal(valorNaUnidade([{ item_id: 'i1', valor: '20' }, { item_id: 'i2', valor: 30 }], unidadesDeDisputa(aviso)[0], 'menor_preco'), 2300);
    assert.equal(valorNaUnidade([{ item_id: 'i1', valor: '20' }], unidadesDeDisputa(aviso)[0], 'menor_preco'), null);
});

test('disputa: alertas da proposta e lote incompleto', () => {
    assert.deepEqual(alertasDaProposta([{ item_id: 'i1', valor: '10' }], aviso), ['Item 1: o valor está abaixo da metade do estimado']);
    assert.deepEqual(alertasDaProposta([{ item_id: 'i1', valor: '10' }], { ...aviso, orcamento_sigiloso: true }), []);
    assert.deepEqual(lotesIncompletos([{ item_id: 'i1', valor: '10' }, { item_id: 'i3', valor: '' }], aviso), ['Lote 1']);
});

test('disputa: horário de Brasília e contagem até a abertura', () => {
    assert.equal(quandoBr('2026-11-23T12:00:00.000Z'), '23/11/2026, às 09:00');
    const t = Date.parse('2026-11-23T12:00:00.000Z');
    assert.equal(faltaPara('2026-11-23T12:00:00.000Z', t + 1), 'encerrado');
    assert.equal(faltaPara('2026-11-23T12:00:00.000Z', t - 45 * 60000), '45 min');
    assert.equal(faltaPara('2026-11-23T12:00:00.000Z', t - (2 * 1440 + 180) * 60000), '2 dias e 3 h');
});
