// Papéis da unidade no processo: quem decide (recebe a conclusão e aprecia
// pendências) e quem expede comunicação às partes. O tipo dá o padrão.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');

test('unidade: sem escolha própria, o gabinete decide e a secretaria expede', () => {
    assert.equal(s.unidadeDecide({ tipo: 'gabinete' }), true);
    assert.equal(s.unidadeExpede({ tipo: 'gabinete' }), false);
    assert.equal(s.unidadeDecide({ tipo: 'secretaria' }), false);
    assert.equal(s.unidadeExpede({ tipo: 'secretaria' }), true);
    for (const tipo of ['assessoria', 'outra']) {
        assert.equal(s.unidadeDecide({ tipo }), false);
        assert.equal(s.unidadeExpede({ tipo }), false);
    }
    // Unidade que não existe (ou sem tipo) não decide nem expede, como antes.
    assert.equal(s.unidadeDecide(undefined), false);
    assert.equal(s.unidadeExpede(undefined), false);
    assert.equal(s.unidadeExpede({}), false);
});

test('unidade: a escolha própria vale sobre o tipo, nos dois sentidos', () => {
    const comissao = { tipo: 'outra', papeis: { decide: true, expede: true } };
    assert.equal(s.unidadeDecide(comissao), true);
    assert.equal(s.unidadeExpede(comissao), true);
    assert.equal(s.unidadeExpede({ tipo: 'secretaria', papeis: { expede: false } }), false);
    assert.equal(s.unidadeDecide({ tipo: 'gabinete', papeis: { decide: false } }), false);
    // Valor que não é sim ou não não conta: vale o tipo.
    assert.equal(s.unidadeDecide({ tipo: 'gabinete', papeis: { decide: 'não' } }), true);
    assert.equal(s.unidadeDecide({ tipo: 'outra', papeis: null }), false);
});

test('unidade: só se guarda o papel que difere do padrão do tipo', () => {
    assert.equal(s.sanitizePapeis({ decide: true, expede: false }, 'gabinete'), null);
    assert.equal(s.sanitizePapeis({ decide: false, expede: true }, 'secretaria'), null);
    assert.equal(s.sanitizePapeis(undefined, 'outra'), null);
    assert.equal(s.sanitizePapeis('x', 'outra'), null);
    assert.deepEqual(s.sanitizePapeis({ decide: true, expede: true }, 'outra'), { decide: true, expede: true });
    assert.deepEqual(s.sanitizePapeis({ decide: true, expede: true }, 'gabinete'), { expede: true });
    assert.deepEqual(s.sanitizePapeis({ decide: false, expede: false }, 'secretaria'), { expede: false });
    assert.deepEqual(s.sanitizePapeis({ decide: 1, expede: true, outro: true }, 'assessoria'), { expede: true });
});
