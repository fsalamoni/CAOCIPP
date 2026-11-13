// Retificação da autuação: partes que só crescem e saem por "retirada". Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('../lib/shared/camposProcesso');
const autos = require('../lib/shared/autos');

const POLOS = ['requerente', 'requerido', 'interessado'];
const quem = { em: '2026-11-13T10:00:00.000Z', por: 'Ana' };
const antes = [
    { nome: 'Fulano', documento: '123', email: 'f@x.dev', polo: 'requerente', uid: 'u1', convite_hash: 'h1', representantes: [{ nome: 'Adv', uid: 'u2' }] },
    { nome: 'Beltrano', documento: '', email: '', polo: 'terceiro' },
];

test('preserva conta, convites e posição; o cliente não muda o que vem do portal', () => {
    const r = cp.retificarPartes(antes, [{ ...antes[0], nome: 'Fulano de Tal', uid: 'outra', representantes: [] }, antes[1]], POLOS, 50, quem);
    assert.equal(r.partes[0].uid, 'u1');
    assert.equal(r.partes[0].convite_hash, 'h1');
    assert.equal(r.partes[0].representantes[0].uid, 'u2');
    assert.equal(r.partes[0].nome, 'Fulano de Tal');
    assert.deepEqual(r.renomeadas, [0]);
    assert.match(r.mudou[0], /Parte corrigida: Fulano → Fulano de Tal/);
    assert.equal(r.partes[1].polo, 'terceiro', 'polo antigo fora do tipo continua se não mudou');
});

test('não encolhe, não apaga o nome e não aceita polo novo fora do tipo', () => {
    assert.throws(() => cp.retificarPartes(antes, [antes[0]], POLOS, 50, quem), /Retirar/);
    assert.throws(() => cp.retificarPartes(antes, [{ ...antes[0], nome: '' }, antes[1]], POLOS, 50, quem), /nome da 1ª parte/);
    assert.throws(() => cp.retificarPartes(antes, [antes[0], { ...antes[1], polo: 'reu' }], POLOS, 50, quem), /não é aceito/);
    assert.throws(() => cp.retificarPartes(antes, [...antes, { nome: 'Novo', polo: 'terceiro' }], POLOS, 50, quem), /não é aceito/);
    assert.throws(() => cp.retificarPartes(antes, [...antes, { nome: 'X' }], POLOS, 2, quem), /Até 2 partes/);
});

test('retirada fica gravada, não volta atrás e parte nova não chega retirada', () => {
    const r = cp.retificarPartes(antes, [{ ...antes[0], retirada: true }, antes[1], { nome: 'Nova', polo: 'requerido', retirada: true }, { nome: '' }], POLOS, 50, quem);
    assert.deepEqual(r.partes[0].retirada, quem);
    assert.deepEqual(r.retiradas, [0]);
    assert.equal(r.partes.length, 3, 'linha nova em branco é descartada');
    assert.equal(r.partes[2].retirada, undefined);
    assert.match(r.mudou.join('; '), /Parte retirada: Fulano \(requerente\); Parte incluída: Nova \(requerido\)/);
    const de = cp.retificarPartes(r.partes, [{ ...r.partes[0], retirada: false, nome: 'Outro' }, ...r.partes.slice(1)], POLOS, 50, quem);
    assert.deepEqual(de.partes[0], r.partes[0], 'parte retirada não muda mais');
    assert.equal(de.mudou.length, 0);
});

test('retirar ignora a edição feita na mesma linha, até com o nome apagado', () => {
    const r = cp.retificarPartes(antes, [{ ...antes[0], nome: '', documento: '999', retirada: true }, antes[1]], POLOS, 50, quem);
    assert.equal(r.partes[0].nome, 'Fulano');
    assert.equal(r.partes[0].documento, '123');
    assert.deepEqual(r.renomeadas, []);
    assert.deepEqual(r.mudou, ['Parte retirada: Fulano (requerente)']);
});

test('o termo da retificação tem título próprio', () => {
    assert.equal(autos.tituloEvento({ tipo: 'retificacao', dados: {} }), 'Termo de retificação da autuação');
});
