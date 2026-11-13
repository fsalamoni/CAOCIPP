// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRito, diffTipo, igual } from './versoes.js';

const atual = {
    id: 'r1', nome: 'Rito comum', descricao: 'Padrão', versao: 3, ativo: true, exigir_tipo: false,
    fases: [
        { id: 'autuacao', nome: 'Autuação', prazo_dias: 5, acoes: ['Conferir', 'Certificar'], acoes_regras: [null, { destino: 'autos' }] },
        { id: 'instrucao', nome: 'Instrução', acoes: ['Intimar'] },
        { id: 'fim', nome: 'Encerramento', final: true },
    ],
};

test('versões: mesmo conteúdo com dados antigos (vazios, ordem das chaves) é igual', () => {
    assert.ok(igual({ a: 1, b: '' }, { a: 1 }));
    assert.ok(igual({ x: [], y: false }, {}));
    const versao = { nome: 'Rito comum', descricao: 'Padrão', exigir_tipo: false, fases: atual.fases.map((f) => ({ ...f, orientacao: '', final: f.final || false })) };
    assert.equal(diffRito(versao, atual).iguais, true);
});

test('versões: fases e ações acrescentadas, removidas e alteradas', () => {
    const versao = {
        nome: 'Rito comum (antigo)', descricao: 'Padrão', exigir_tipo: false,
        fases: [
            { id: 'autuacao', nome: 'Autuação', prazo_dias: 10, acoes: ['Conferir', 'Certificar', 'Notificar'], acoes_regras: [null, { destino: 'evento' }, null] },
            { id: 'fim', nome: 'Encerramento', final: true },
            { id: 'recurso', nome: 'Recurso' },
        ],
    };
    const d = diffRito(versao, atual);
    assert.equal(d.iguais, false);
    assert.deepEqual(d.rito, ['nome']);
    assert.deepEqual(d.fases.adicionadas.map((x) => x.id), ['recurso']);
    assert.deepEqual(d.fases.removidas.map((x) => x.id), ['instrucao']);
    const a = d.fases.alteradas.find((x) => x.id === 'autuacao');
    assert.deepEqual(a.mudou, ['prazo']);
    assert.deepEqual(a.acoes.adicionadas, ['Notificar']);
    assert.deepEqual(a.acoes.alteradas, [{ texto: 'Certificar', mudou: ['onde fica'] }]);
    assert.ok(!d.fases.alteradas.some((x) => x.id === 'fim'));
});

test('versões: ordem das fases conta como mudança', () => {
    const versao = { ...atual, fases: [atual.fases[1], atual.fases[0], atual.fases[2]] };
    assert.deepEqual(diffRito(versao, atual).rito, ['ordem das fases']);
});

test('versões do tipo: dados, campos fixos e campos próprios', () => {
    const tAtual = {
        id: 't1', nome: 'Representação', sigla: 'REP', rito_id: 'r1', ativo: true, versao: 2, urgente: false,
        formulario: { assunto: 'obrigatorio', polos: ['requerente'], campos: [{ id: 'c1', rotulo: 'Valor', tipo: 'numero' }, { id: 'c2', rotulo: 'Data', tipo: 'data' }] },
    };
    const tVersao = {
        nome: 'Representação', sigla: 'REP', rito_id: 'r2', urgente: false,
        formulario: { assunto: 'opcional', polos: ['requerente'], campos: [{ id: 'c1', rotulo: 'Valor da causa', tipo: 'numero', obrigatorio: true }, { id: 'c3', rotulo: 'Comarca', tipo: 'texto' }] },
    };
    const d = diffTipo(tVersao, tAtual);
    assert.deepEqual(d.dados, ['rito']);
    assert.deepEqual(d.formulario, ['Assunto']);
    assert.deepEqual(d.campos.adicionados.map((x) => x.id), ['c3']);
    assert.deepEqual(d.campos.removidos.map((x) => x.id), ['c2']);
    assert.deepEqual(d.campos.alterados, [{ id: 'c1', rotulo: 'Valor da causa', mudou: ['nome', 'obrigatório'] }]);
    assert.equal(diffTipo({ ...tAtual, id: undefined }, tAtual).iguais, true);
});
