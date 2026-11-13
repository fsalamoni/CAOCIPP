import test from 'node:test';
import assert from 'node:assert/strict';
import { acaoAtiva, pendentesDaFase, problemaDaCondicao, remapearCondicoes, saidasComCondicao, textoCondicao } from './exigencias.js';

const fase = {
    id: 'a', nome: 'Análise', proximas: ['b', 'c'],
    acoes: ['Decidir', 'Juntar laudo', 'Avisar'],
    acoes_regras: [
        { pede: 'lista', opcoes: ['Deferido', 'Indeferido'], rotulo: 'Decisão' },
        { documento: { tipo: 'Laudo', nivel: 'obrigatorio' }, se: { acao: 0, valores: ['Deferido'] } },
        { pede: 'confirmar', obrigatoria: true },
    ],
    condicoes_regra: { b: { acao: 0, valores: ['Deferido'] } },
};
const fases = [fase, { id: 'b', nome: 'Execução' }, { id: 'c', nome: 'Arquivo' }];

test('ação condicional vale só com a resposta marcada', () => {
    assert.equal(acaoAtiva(fase, 1, {}), false);
    assert.equal(acaoAtiva(fase, 1, { 0: 'Indeferido' }), false);
    assert.equal(acaoAtiva(fase, 1, { 0: 'Deferido' }), true);
    assert.equal(acaoAtiva(fase, 2, {}), true);
    assert.equal(textoCondicao(fase, fase.acoes_regras[1].se), '"Decisão" for Deferido');
});

test('saída indicada pela resposta; as outras ficam livres', () => {
    const [b, c] = saidasComCondicao(fases, fase, { 0: 'Deferido' });
    assert.deepEqual([b.fase.id, b.indicada, b.contra], ['b', true, false]);
    assert.deepEqual([c.fase.id, c.indicada, c.contra], ['c', false, false]);
    assert.equal(saidasComCondicao(fases, fase, { 0: 'Indeferido' })[0].contra, true);
});

test('pendências ignoram a ação que não vale', () => {
    const doc = (p) => p.some((x) => /Laudo/.test(JSON.stringify(x)));
    assert.equal(doc(pendentesDaFase(fase, [], {})), false);
    assert.equal(doc(pendentesDaFase(fase, [], { 0: 'Deferido' })), true);
});

test('problemas da condição', () => {
    assert.equal(problemaDaCondicao(fase, { acao: 0, valores: [] }), null);
    assert.equal(problemaDaCondicao(fase, { acao: 0, valores: ['Talvez'] }), 'nenhuma das respostas escolhidas existe mais');
    assert.match(problemaDaCondicao(fase, { acao: 2, valores: ['sim'] }), /não é mais de escolha/);
    assert.match(problemaDaCondicao(fase, { acao: 0, valores: ['Deferido'] }, 0), /não vem antes/);
});

test('condições acompanham a ação ao mover e saem quando ela é removida', () => {
    // Insere uma ação nova no início: a decisão passa a ser a 1.
    const r1 = remapearCondicoes(fase, [-1, 0, 1, 2], [null, ...fase.acoes_regras]);
    assert.deepEqual(r1.acoes_regras[2].se, { acao: 1, valores: ['Deferido'] });
    assert.deepEqual(r1.condicoes_regra, { b: { acao: 1, valores: ['Deferido'] } });
    // Remove a decisão: a ação condicional perde a condição, a saída perde a regra.
    const r2 = remapearCondicoes(fase, [1, 2], fase.acoes_regras.slice(1));
    assert.equal(r2.acoes_regras[0].se, undefined);
    assert.equal(r2.condicoes_regra, undefined);
});

test('condições em cadeia: resposta escondida não indica saída', () => {
    const f = { id: 'a', proximas: ['b'], acoes: ['Recurso?', 'Decisão', 'Notificar'],
        acoes_regras: [{ pede: 'sim_nao' }, { pede: 'lista', opcoes: ['A'], se: { acao: 0, valores: ['sim'] } }, { se: { acao: 1, valores: ['A'] } }],
        condicoes_regra: { b: { acao: 1, valores: ['A'] } } };
    const fs = [f, { id: 'b', nome: 'B' }];
    assert.equal(acaoAtiva(f, 2, { 1: 'A' }), false);
    assert.equal(saidasComCondicao(fs, f, { 1: 'A' })[0].contra, true);
    assert.equal(saidasComCondicao(fs, f, { 0: 'sim', 1: 'A' })[0].indicada, true);
});
