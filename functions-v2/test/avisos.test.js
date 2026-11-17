// Aviso para todos: validação do que o painel envia. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarAviso } = require('../lib/platform/avisos');

const base = { tom: 'info', titulo: 'Atualização' };

test('aviso mínimo vale, dispensável por padrão', () => {
    const a = validarAviso(base);
    assert.equal(a.dispensavel, true);
    assert.equal(a.inicio, null);
    assert.equal(a.link_rotulo, '');
});

test('tom e título obrigatórios', () => {
    assert.throws(() => validarAviso({ titulo: 'x' }), /tom/);
    assert.throws(() => validarAviso({ tom: 'vermelho', titulo: 'x' }), /tom/);
    assert.throws(() => validarAviso({ tom: 'info', titulo: ' ' }), /Título/);
});

test('link só https ou página do SIGO', () => {
    assert.equal(validarAviso({ ...base, link_url: '/Help' }).link_rotulo, 'Saiba mais');
    assert.throws(() => validarAviso({ ...base, link_url: 'javascript:alert(1)' }), /Link/);
    assert.throws(() => validarAviso({ ...base, link_url: 'http://x.com' }), /Link/);
});

test('período: datas válidas e fim depois do início', () => {
    assert.throws(() => validarAviso({ ...base, inicio: 'ontem' }), /Início/);
    assert.throws(() => validarAviso({ ...base, inicio: '2026-12-02T10:00', fim: '2026-12-01T10:00' }), /depois/);
    assert.ok(validarAviso({ ...base, inicio: '2026-12-01T10:00', fim: '2026-12-02T10:00' }).fim);
});
