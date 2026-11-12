import test from 'node:test';
import assert from 'node:assert/strict';
import { faltando, formularioDe, formularioPadrao, novoCampo, problemasFormulario, rotuloDe, valorTexto, valoresDe } from './camposProcesso.js';

const form = {
    ...formularioPadrao(), assunto: 'opcional', descricao: 'obrigatorio', partes: 'obrigatorio',
    campos: [
        { id: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true },
        { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['A', 'B'] },
    ],
};

test('formularioDe: tipo antigo recebe o padrão', () => {
    assert.deepEqual(formularioDe({}), formularioPadrao());
    assert.equal(formularioDe({}).assunto, 'obrigatorio', 'assunto segue obrigatório nos tipos antigos');
    assert.equal(formularioDe({ formulario: { partes: 'oculto' } }).partes, 'oculto');
    assert.match(novoCampo().id, /^[a-z0-9_]{1,24}$/);
});

test('faltando: aponta padrões e campos obrigatórios e número inválido', () => {
    assert.deepEqual(faltando(form, { descricao: ' ', partes: [{ nome: '' }], campos: {} }),
        ['Preencha "Descrição"', 'Informe ao menos um item em "Partes e interessados"', 'Preencha "Valor"']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: 'dez' } }), ['"Valor" precisa ser um número']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: '1.234,5' } }), []);
});

test('problemasFormulario: nome vazio, repetido, padrão e lista curta', () => {
    assert.deepEqual(problemasFormulario(form), []);
    const p = problemasFormulario({ ...formularioPadrao(), campos: [{ rotulo: '' }, { rotulo: 'Origem' }, { rotulo: 'origem ' }, { rotulo: 'Partes' }, { rotulo: 'Via', tipo: 'lista', opcoes: ['a', 'a'] }] });
    assert.equal(p.length, 4);
});

test('valorTexto e valoresDe', () => {
    assert.equal(valorTexto({ tipo: 'sim_nao', valor: false }), 'Não');
    assert.equal(valorTexto({ tipo: 'data', valor: '2026-03-01' }), '01/03/2026');
    assert.equal(valorTexto({ tipo: 'texto', valor: 'abc' }), 'abc');
    assert.deepEqual(valoresDe([{ id: 'a', tipo: 'sim_nao', valor: true }, { id: 'b', tipo: 'numero', valor: 1.5 }, { id: 'c', tipo: 'data', valor: '2026-03-01' }]),
        { a: 'sim', b: '1,5', c: '2026-03-01' });
});

test('campos padrão configuráveis: nome próprio, assunto e origem obrigatórios', () => {
    const f = { ...formularioPadrao(), origem: 'obrigatorio', rotulos: { assunto: 'Objeto', partes: 'Envolvidos' }, campos: [] };
    assert.equal(rotuloDe(f, 'assunto'), 'Objeto');
    assert.equal(rotuloDe(f, 'descricao'), 'Descrição');
    assert.deepEqual(faltando(f, { assunto: '', origem: { tipo: '', descricao: '' }, partes: [], campos: {} }), ['Preencha "Objeto"', 'Informe "Origem"']);
    assert.deepEqual(faltando(f, { assunto: 'x', origem: { tipo: 'oficio', descricao: '' }, partes: [], campos: {} }), []);
    assert.match(problemasFormulario({ ...f, campos: [{ rotulo: 'envolvidos', tipo: 'texto' }] })[0], /campo padrão/);
    assert.match(problemasFormulario({ ...f, assunto: 'oculto', descricao: 'oculto', partes: 'oculto' })[0], /identificar/);
    assert.match(problemasFormulario({ ...f, polos: [] })[0], /polo/);
});
