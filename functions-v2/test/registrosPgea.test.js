// Nº do PGEA e aditivos (Consultas e Expedientes). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarNumeroPgea, resumoRegistro, ordenarResumos, moduloPgea } = require('../lib/shared/registrosPgea');

test('mesmo número escrito de jeitos diferentes', () => {
    const n = normalizarNumeroPgea('00021.000.125/2024');
    assert.equal(n, '210001252024');
    assert.equal(normalizarNumeroPgea('21.000.125/2024'), n);
    assert.equal(normalizarNumeroPgea(' 000210001252024 '), n);
    assert.notEqual(normalizarNumeroPgea('00021.000.126/2024'), n);
    assert.equal(normalizarNumeroPgea('exp-ábc 12'), 'EXPABC12');
    assert.equal(normalizarNumeroPgea(null), '');
});

test('módulo só consultas ou expedientes', () => {
    assert.equal(moduloPgea('consultas').colecao, 'processes');
    assert.equal(moduloPgea('expedientes').campoNumero, 'expediente_number');
    assert.equal(moduloPgea('parcerias'), null);
    assert.equal(moduloPgea('__proto__'), null);
});

test('resumo traz fase, responsável e vínculo', () => {
    const r = resumoRegistro('a', { process_number: '1/2024', archived_date: '2024-05-01', responsible_user_name: 'Ana' }, 'process_number');
    assert.equal(r.fase, 'Na pasta');
    assert.equal(r.arquivado, true);
    assert.equal(r.responsavel, 'Ana');
    assert.equal(r.aditivo_de, null);
    const ad = resumoRegistro('b', { process_number: '1/2024', aditivo_de: 'a', aditivo_numero: 2 }, 'process_number');
    assert.equal(ad.fase, 'Pendente');
    assert.equal(ad.aditivo_numero, 2);
});

test('original antes dos aditivos', () => {
    const lista = [
        { id: 'c', aditivo_de: 'a', aditivo_numero: 2 },
        { id: 'a', aditivo_de: null, aditivo_numero: null },
        { id: 'b', aditivo_de: 'a', aditivo_numero: 1 },
    ];
    assert.deepEqual(ordenarResumos(lista).map((r) => r.id), ['a', 'b', 'c']);
});
