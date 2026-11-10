import test from 'node:test';
import assert from 'node:assert/strict';
import { faltando, formularioDe, novoCampo, problemasFormulario, valorTexto, valoresDe } from './camposProcesso.js';

const form = {
    descricao: 'obrigatorio', partes: 'obrigatorio',
    campos: [
        { id: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true },
        { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['A', 'B'] },
    ],
};

test('formularioDe: tipo antigo recebe o padrão', () => {
    assert.deepEqual(formularioDe({}), { descricao: 'opcional', partes: 'opcional', campos: [] });
    assert.equal(formularioDe({ formulario: { partes: 'oculto' } }).partes, 'oculto');
    assert.match(novoCampo().id, /^[a-z0-9_]{1,24}$/);
});

test('faltando: aponta padrões e campos obrigatórios e número inválido', () => {
    assert.deepEqual(faltando(form, { descricao: ' ', partes: [{ nome: '' }], campos: {} }),
        ['Preencha a descrição', 'Informe ao menos uma parte ou interessado', 'Preencha "Valor"']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: 'dez' } }), ['"Valor" precisa ser um número']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: '1.234,5' } }), []);
});

test('problemasFormulario: nome vazio, repetido, padrão e lista curta', () => {
    assert.deepEqual(problemasFormulario(form), []);
    const p = problemasFormulario({ campos: [{ rotulo: '' }, { rotulo: 'Origem' }, { rotulo: 'origem ' }, { rotulo: 'Partes' }, { rotulo: 'Via', tipo: 'lista', opcoes: ['a', 'a'] }] });
    assert.equal(p.length, 4);
});

test('valorTexto e valoresDe', () => {
    assert.equal(valorTexto({ tipo: 'sim_nao', valor: false }), 'Não');
    assert.equal(valorTexto({ tipo: 'data', valor: '2026-03-01' }), '01/03/2026');
    assert.equal(valorTexto({ tipo: 'texto', valor: 'abc' }), 'abc');
    assert.deepEqual(valoresDe([{ id: 'a', tipo: 'sim_nao', valor: true }, { id: 'b', tipo: 'numero', valor: 1.5 }, { id: 'c', tipo: 'data', valor: '2026-03-01' }]),
        { a: 'sim', b: '1,5', c: '2026-03-01' });
});
