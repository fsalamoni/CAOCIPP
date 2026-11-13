// Campo próprio do tipo pré-preenchido com um dado do registro escolhido.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/shared/camposProcesso');
const ex = require('../lib/shared/exigencias');

const reg = { id: 'cons', rotulo: 'Consulta', tipo: 'registro', modulo: 'consultas' };
const imp = (extra) => c.sanitizeCampos([reg, { id: 'x', rotulo: 'Consulente', tipo: 'texto', visivel_partes: true, ...extra }]);

test('importar: guarda origem e dado, e nunca vai às partes', () => {
    const ok = imp({ importar: { de: 'cons', dado: 'consulente' } })[1];
    assert.deepEqual(ok.importar, { de: 'cons', dado: 'consulente' });
    assert.equal(ok.visivel_partes, false);
    assert.equal(c.sanitizeCampos([reg, { id: 'd', rotulo: 'Entrada', tipo: 'data', importar: { de: 'cons', dado: 'entrada' } }])[1].importar.dado, 'entrada');
    assert.equal(c.sanitizeCampos([reg, { id: 'l', rotulo: 'Fatos', tipo: 'texto_longo', importar: { de: 'cons', dado: 'local' } }])[1].importar.dado, 'local');
});

test('importar: recusa origem que não é registro, dado fora do catálogo e tipo que não combina', () => {
    assert.throws(() => imp({ importar: { de: 'nada', dado: 'consulente' } }), /campo de registro deste formulário/);
    assert.throws(() => c.sanitizeCampos([{ id: 't', rotulo: 'T', tipo: 'texto' }, { id: 'x', rotulo: 'X', tipo: 'texto', importar: { de: 't', dado: 'consulente' } }]), /campo de registro/);
    assert.throws(() => imp({ importar: { de: 'cons', dado: 'comarca' } }), /não tem esse dado/);
    assert.throws(() => imp({ importar: { de: 'cons', dado: 'entrada' } }), /uma data só vai para campo de data/);
    assert.throws(() => imp({ formato: 'email', importar: { de: 'cons', dado: 'consulente' } }), /texto livre ou de texto longo/);
    assert.throws(() => c.sanitizeCampos([reg, { id: 'n', rotulo: 'N', tipo: 'numero', importar: { de: 'cons', dado: 'consulente' } }]), /não combina/);
});

test('importar: formulário de ação não importa dados', () => {
    const r = ex.sanitizeRegras({ acoes_regras: [{ pede: 'formulario', campos: [reg, { id: 'x', rotulo: 'X', tipo: 'texto', importar: { de: 'cons', dado: 'consulente' } }] }] }, ['Instruir']);
    assert.equal(r.acoes_regras[0].campos[1].importar, undefined);
});
