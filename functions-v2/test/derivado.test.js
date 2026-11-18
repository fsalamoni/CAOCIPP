// Ação "Abrir um processo derivado" (pede 'derivado'): o que o rito guarda e
// qual ação pendente o processo recém-aberto cumpre na fase de origem.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');

const sempre = () => true;

test('a regra guarda o pedido e a sugestão de tipo, e descarta o resto', () => {
    const { regras } = { regras: x.sanitizeRegras({ acoes_regras: [
        { pede: 'derivado', derivado: { tipo: '  Tratativas de acordo  ', outro: 1 }, obrigatoria: true },
        { pede: 'derivado', derivado: { tipo: '' } },
    ] }, ['Abrir as tratativas', 'Abrir outro']).acoes_regras };
    assert.deepEqual(regras[0], { pede: 'derivado', derivado: { tipo: 'Tratativas de acordo' }, obrigatoria: true });
    assert.deepEqual(regras[1], { pede: 'derivado' });
});

test('o processo novo cumpre a ação que sugere o tipo ou o rito dele', () => {
    const fase = { acoes_regras: [null, { pede: 'derivado', derivado: { tipo: 'Tratativas de acordo' } }, { pede: 'derivado', derivado: { tipo: 'Acompanhamento do acordo' } }] };
    assert.equal(x.derivadoPendente(fase, [], ['acompanhamento do acôrdo', 'Rito X'], sempre), 2);
    assert.equal(x.derivadoPendente(fase, [], ['Tipo Y', 'Tratativas de Acordo'], sempre), 1);
    // Duas pendentes e nenhum nome casa: fica para a equipe escolher.
    assert.equal(x.derivadoPendente(fase, [], ['Outro tipo', 'Outro rito'], sempre), -1);
    // Já cumprida ou fora da condição não conta: sobra uma só, que vale mesmo sem o nome casar.
    assert.equal(x.derivadoPendente(fase, [1], ['Outro tipo'], sempre), 2);
    assert.equal(x.derivadoPendente(fase, [], ['Outro tipo'], (i) => i !== 2), 1);
    assert.equal(x.derivadoPendente(fase, [1, 2], ['Tratativas de acordo'], sempre), -1);
});

test('ação sem sugestão aceita qualquer processo derivado', () => {
    const fase = { acoes_regras: [{ pede: 'derivado', derivado: { tipo: 'Apuração' } }, { pede: 'derivado' }] };
    assert.equal(x.derivadoPendente(fase, [], ['Qualquer', ''], sempre), 1);
    assert.equal(x.derivadoPendente(fase, [], ['apuracao'], sempre), 0);
    assert.equal(x.derivadoPendente(null, [], ['x'], sempre), -1);
});
