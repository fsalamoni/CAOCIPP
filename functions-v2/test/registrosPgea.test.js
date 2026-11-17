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

const { montarAditivo, protegerVinculo } = require('../lib/registros/aditivos');

test('aditivo herda a identificação e começa em Pendente', () => {
    const raiz = { id: 'r', process_number: '1/2024', consultant: 'Prefeitura', matter_object: 'Objeto', archived_date: '2024-06-01', access_restriction: true, network_folder: 'X:/pasta' };
    const a = montarAditivo('consultas', raiz, raiz, { id: 'n', orgId: 'o', numero: 2, motivo: 'Novo pedido', entrada: '2026-11-17', urgente: false, responsavelId: null, responsavelNome: null, uid: 'u', log: { action: 'x' } });
    assert.equal(a.process_number, '1/2024');
    assert.equal(a.consultant, 'Prefeitura');
    assert.equal(a.access_restriction, true);
    assert.equal(a.archived_date, null);
    assert.equal(a.network_folder, '');
    assert.equal(a.status, 'Pendente');
    assert.equal(a.aditivo_de, 'r');
    assert.equal(a.aditivo_numero, 2);
    assert.equal(a.distribution_date, null);
    const e = montarAditivo('expedientes', { id: 'r', expediente_number: '9', system: 'SIM', origin: 'SUBADM', object: 'Obj' }, { id: 'r', expediente_number: '9' }, { id: 'n', orgId: 'o', numero: 1, motivo: 'm', entrada: '2026-11-17', urgente: true, responsavelId: 'u2', responsavelNome: 'ana souza', uid: 'u', log: {} });
    assert.equal(e.expediente_number, '9');
    assert.equal(e.system, 'SIM');
    assert.equal(e.distribution_date, '2026-11-17');
    assert.equal(e.urgency_request, true);
    assert.equal(e.consultant, undefined);
});

test('edição não mexe no vínculo nem no número do aditivo', () => {
    const ch = { aditivo_de: 'x', aditivos_count: 9, aditivo_numero: 5, process_number: '2/2024', consultant: 'Y' };
    protegerVinculo(ch, { aditivo_de: 'r' }, 'process_number');
    assert.deepEqual(ch, { consultant: 'Y' });
    const ch2 = { process_number: '2/2024' };
    protegerVinculo(ch2, {}, 'process_number');
    assert.deepEqual(ch2, { process_number: '2/2024' });
});

test('original antes dos aditivos', () => {
    const lista = [
        { id: 'c', aditivo_de: 'a', aditivo_numero: 2 },
        { id: 'a', aditivo_de: null, aditivo_numero: null },
        { id: 'b', aditivo_de: 'a', aditivo_numero: 1 },
    ];
    assert.deepEqual(ordenarResumos(lista).map((r) => r.id), ['a', 'b', 'c']);
});
