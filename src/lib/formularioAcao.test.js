import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CAMPOS_ACAO, PEDIDOS, regraComPedido, resumoDaAcao } from './exigencias.js';
import { faltando, problemasFormulario, registrosLigados } from './camposProcesso.js';

test('pedir um formulário começa com um campo e mantém destino e partes', () => {
    assert.ok(PEDIDOS.some(([p]) => p === 'formulario'));
    assert.equal(MAX_CAMPOS_ACAO, 10);
    const r = regraComPedido({ pede: 'texto', destino: 'autos', partes: true }, 'formulario', 'Marcar audiência');
    assert.equal(r.pede, 'formulario');
    assert.equal(r.campos.length, 1);
    assert.equal(r.destino, 'autos');
    assert.equal(r.partes, true);
    assert.match(resumoDaAcao(r), /^formulário de 1 campo; certidão nos autos; partes veem/);
    // Voltar a um pedido simples tira os campos.
    assert.equal(regraComPedido(r, 'texto', 'A').campos, undefined);
});

test('formulário da ação: nomes padrão do tipo são livres; obrigatório confere', () => {
    assert.deepEqual(problemasFormulario({ campos: [{ id: 'a', rotulo: 'Assunto', tipo: 'texto' }] }), []);
    const form = { campos: [{ id: 'd', rotulo: 'Data', tipo: 'data', obrigatorio: true }, { id: 'o', rotulo: 'Obs', tipo: 'texto' }] };
    assert.deepEqual(faltando(form, { campos: { o: 'x' } }), ['Preencha "Data"']);
    assert.deepEqual(faltando(form, { campos: { d: '2026-11-20' } }), []);
});

test('registros escolhidos num formulário aparecem nos vínculos', () => {
    const l = registrosLigados({ campos: [] }, [{ rotulo: 'Sessão', fase_nome: 'F', refs: [{ modulo: 'juri', id: 'j1', numero: 'J-1' }] }]);
    assert.equal(l.length, 1);
    assert.deepEqual(l[0].de, ['Sessão (F)']);
});
