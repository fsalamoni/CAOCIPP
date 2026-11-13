import test from 'node:test';
import assert from 'node:assert/strict';
import { camposDaOrigem, copiarCampos, importarDados, opcoesImportar, problemasFormulario } from './camposProcesso.js';

const form = { campos: [
    { id: 'cons', rotulo: 'Consulta', tipo: 'registro', modulo: 'consultas' },
    { id: 'quem', rotulo: 'Consulente', tipo: 'texto', importar: { de: 'cons', dado: 'consulente' } },
    { id: 'ent', rotulo: 'Entrada', tipo: 'data', importar: { de: 'cons', dado: 'entrada' } },
    { id: 'mail', rotulo: 'E-mail', tipo: 'texto', formato: 'email' },
] };
const A = { id: 'a', numero: '1/2026', titulo: 'A', dados: { consulente: 'Ana', entrada: '2026-01-02' } };
const B = { id: 'b', numero: '2/2026', titulo: 'B', dados: { consulente: 'Bia' } };

test('importarDados: preenche o vazio, guarda o digitado e troca só o que veio do anterior', () => {
    const v1 = importarDados(form, {}, 'cons', A);
    assert.equal(v1.quem, 'Ana');
    assert.equal(v1.ent, '2026-01-02');
    const v2 = importarDados(form, { ...v1, ent: '2026-05-05' }, 'cons', B);
    assert.equal(v2.quem, 'Bia');
    assert.equal(v2.ent, '2026-05-05');
    assert.equal(importarDados(form, { quem: 'Digitado' }, 'cons', A).quem, 'Digitado');
    // Registro restrito (sem dados) não traz nada e limpa o que veio do anterior.
    assert.equal(importarDados(form, v1, 'cons', { id: 'r', numero: '3', titulo: '' }).quem, '');
    assert.equal(importarDados(form, {}, 'cons', null).quem, '');
    // Texto curto cabe em 200, e o cortado ainda conta como "veio do registro".
    const longo = { id: 'l', numero: '4', titulo: '', dados: { consulente: 'x'.repeat(300) } };
    const v4 = importarDados(form, {}, 'cons', longo);
    assert.equal(v4.quem.length, 200);
    assert.equal(importarDados(form, v4, 'cons', B).quem, 'Bia');
});

test('camposDaOrigem traz os dados importados', () => {
    const v = camposDaOrigem(form, { modulo: 'consultas', id: 'a', numero: '1/2026', dados: A.dados });
    assert.equal(v.cons.id, 'a');
    assert.equal(v.quem, 'Ana');
    assert.deepEqual(camposDaOrigem(form, { modulo: 'expedientes', id: 'e' }), {});
    const r = camposDaOrigem(form, { modulo: 'consultas', id: 'a', numero: '1', restrito: true });
    assert.equal(r.cons.restrito, true);
    assert.equal(r.quem, '');
});

test('opções, cópia e problemas do campo que importa', () => {
    assert.deepEqual(opcoesImportar(form.campos, form.campos[2]).map(([k]) => k), ['cons|entrada']);
    assert.deepEqual(opcoesImportar(form.campos, form.campos[3]), []);
    const copia = copiarCampos(form.campos);
    assert.equal(copia[1].importar.de, copia[0].id);
    assert.notEqual(copia[0].id, 'cons');
    assert.equal(copiarCampos([form.campos[1]])[0].importar, undefined);
    assert.ok(JSON.stringify(problemasFormulario({ campos: [form.campos[1]] })).includes('escolha o dado de novo'));
});
