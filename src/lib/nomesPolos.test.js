import test from 'node:test';
import assert from 'node:assert/strict';
import { formularioDe, formularioPadrao, nomePolo, problemasFormulario } from './camposProcesso.js';

test('nome do polo: o do tipo ou o padrão pedido', () => {
    assert.equal(nomePolo({ requerido: 'Acusado' }, 'requerido'), 'Acusado');
    assert.equal(nomePolo({}, 'requerido'), 'requerido');
    assert.equal(nomePolo(undefined, 'requerido', 'Requerido'), 'Requerido');
    assert.deepEqual(formularioDe({ formulario: {} }).nomes_polos, {});
    assert.deepEqual(formularioDe({ formulario: { nomes_polos: { requerente: 'Denunciante' } } }).nomes_polos, { requerente: 'Denunciante' });
});

test('dois polos com o mesmo nome são apontados', () => {
    const f = { ...formularioPadrao(), nomes_polos: { requerente: 'Parte', requerido: 'parte' } };
    assert.ok(problemasFormulario(f).some((p) => /mesmo nome/.test(p)));
    assert.ok(!problemasFormulario({ ...f, polos: ['requerente', 'interessado'] }).some((p) => /mesmo nome/.test(p)));
});
