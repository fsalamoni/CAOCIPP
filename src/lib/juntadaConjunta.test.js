// Juntada em conjunto (botão Finalizar da fase). npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { alinharItens, moverItem, planoDaJuntada, rotuloFinalizar } from './juntadaConjunta.js';
import { resumoAndamento } from './andamentoFase.js';

const minutas = [
    { id: 'm', titulo: 'Parecer', assinaturas: [] },
    { id: 'a1', titulo: 'Anexo 1', assinaturas: [{ uid: 'gab' }] },
    { id: 'a2', titulo: 'Anexo 2', assinaturas: [] },
];

test('juntada em conjunto: rótulo, lista alinhada às minutas e ordem', () => {
    assert.equal(rotuloFinalizar({ nome: 'Revisão' }), 'Finalizar revisão');
    assert.equal(rotuloFinalizar({}), 'Finalizar a fase');
    const itens = alinharItens(null, minutas);
    assert.deepEqual(itens.map((x) => [x.id, x.incluir]), [['m', true], ['a1', true], ['a2', true]]);
    const trocada = moverItem(itens, 2, -1).map((x) => (x.id === 'a1' ? { ...x, incluir: false } : x));
    assert.deepEqual(trocada.map((x) => x.id), ['m', 'a2', 'a1']);
    assert.equal(moverItem(itens, 0, -1), itens, 'o primeiro não sobe');
    // Chega um anexo novo e some uma minuta: a ordem e as escolhas de antes ficam.
    const depois = alinharItens(trocada, [minutas[1], minutas[2], { id: 'novo', titulo: 'Anexo 3', assinaturas: [] }]);
    assert.deepEqual(depois.map((x) => [x.id, x.incluir]), [['a2', true], ['a1', false], ['novo', true]]);
});

test('juntada em conjunto: junta os escolhidos na ordem, assina o que falta e guarda o resto se pedido', () => {
    const itens = [{ id: 'a2', incluir: true, assinar: false }, { id: 'm', incluir: true, assinar: true }, { id: 'a1', incluir: false, assinar: true }, { id: 'sumiu', incluir: true }];
    assert.deepEqual(planoDaJuntada(itens, minutas, 'gab'), [
        { acao: 'juntar', docId: 'a2', titulo: 'Anexo 2', assinar: false },
        { acao: 'juntar', docId: 'm', titulo: 'Parecer', assinar: true },
    ]);
    const tudo = planoDaJuntada(itens.map((x) => ({ ...x, incluir: true })), minutas, 'gab', { guardarResto: true });
    assert.deepEqual(tudo.map((x) => [x.acao, x.docId, x.assinar]), [['juntar', 'a2', false], ['juntar', 'm', true], ['juntar', 'a1', false]], 'quem já assinou não assina de novo');
    assert.deepEqual(planoDaJuntada(itens, minutas, 'gab', { guardarResto: true }).at(-1), { acao: 'guardar', docId: 'a1', titulo: 'Anexo 1' });
});

test('juntada em conjunto: aparece no resumo da fase', () => {
    assert.deepEqual(resumoAndamento({ juntada_conjunta: true }), ['tem o botão Finalizar: escolher, ordenar, assinar e juntar os documentos de uma vez']);
});
