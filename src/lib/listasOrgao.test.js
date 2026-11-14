// npm run test:lib
// Etapa 5: listas do órgão nas telas (espécies e origens a mais, com o nome guardado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camposDaEspecie, especiesParaEscolher, nomeEspecie } from './comunicacaoRito.js';
import { audienciasParaEscolher, camposDaAudiencia, nomeAudiencia } from './audiencias.js';
import { opcoesDaParte, parteDaFonte } from './exigencias.js';

const lista = [{ id: 'o_edital', nome: 'Edital', m: true }, { id: 'o_convocacao', nome: 'Convocação' }];

test('espécies de comunicação: sistema, lista do órgão e a do rito que saiu da lista', () => {
    const op = especiesParaEscolher(lista, { especie: 'o_antiga', especie_nome: 'Notificação antiga' });
    assert.deepEqual(op.slice(-3).map(([id, nome, , m]) => [id, nome, m]), [['o_edital', 'Edital', true], ['o_convocacao', 'Convocação', false], ['o_antiga', 'Notificação antiga', false]]);
    assert.equal(especiesParaEscolher([], { especie: 'intimacao' }).length, 5);
    assert.deepEqual(camposDaEspecie('o_edital', op), { especie: 'o_edital', especie_nome: 'Edital', especie_m: true });
    assert.deepEqual(camposDaEspecie('o_convocacao', op), { especie: 'o_convocacao', especie_nome: 'Convocação' });
    assert.deepEqual(camposDaEspecie('citacao', op), { especie: 'citacao' });
    assert.equal(nomeEspecie('o_edital', 'Edital'), 'Edital');
    assert.equal(nomeEspecie('citacao'), 'Citação');
});

test('espécies de audiência: o mesmo, com nome e gênero', () => {
    const op = audienciasParaEscolher([{ id: 'o_mediacao', nome: 'Sessão de mediação' }], { especie: 'o_velha', especie_nome: 'Reunião velha', especie_m: true });
    assert.deepEqual(op.slice(-2), [['o_mediacao', 'Sessão de mediação', false], ['o_velha', 'Reunião velha', true]]);
    assert.deepEqual(camposDaAudiencia('o_velha', op), { especie: 'o_velha', especie_nome: 'Reunião velha', especie_m: true });
    assert.deepEqual(camposDaAudiencia('oitiva', op), { especie: 'oitiva' });
    assert.equal(nomeAudiencia('o_mediacao', 'Sessão de mediação'), 'Sessão de mediação');
    assert.equal(nomeAudiencia('oitiva'), 'Oitiva');
});

test('condição por origem: as do órgão entram e o nome vai junto, mesmo fora da lista', () => {
    const c = { dado: 'origem', valores: ['o_sumida'], nomes: ['Sumida'] };
    const op = opcoesDaParte({}, c, { origens: [{ id: 'o_ouvidoria', nome: 'Ouvidoria' }] });
    assert.ok(op.some(([v]) => v === 'oficio'));
    assert.deepEqual(op.slice(-2), [['o_ouvidoria', 'Ouvidoria'], ['o_sumida', 'Sumida']]);
    assert.deepEqual(parteDaFonte({ acao: -1, dado: 'origem', nome: 'Origem' }, ['o_ouvidoria', 'oficio'], op),
        { acao: -1, dado: 'origem', valores: ['o_ouvidoria', 'oficio'], nomes: ['Ouvidoria', 'Ofício'] });
    // Só as do sistema: como antes, sem nomes.
    assert.deepEqual(parteDaFonte({ acao: -1, dado: 'origem', nome: 'Origem' }, ['oficio'], op), { acao: -1, dado: 'origem', valores: ['oficio'] });
});
