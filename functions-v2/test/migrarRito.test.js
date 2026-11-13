const test = require('node:test');
const assert = require('node:assert/strict');
const { migrarEstado, gruposDaMigracao } = require('../lib/shared/migrarRito');
const { visivelParaPartes, tituloEvento } = require('../lib/shared/autos');

const v1 = [
    { id: 'f1', nome: 'Triagem', acoes: ['Conferir', 'Certificar', 'Despachar'], documentos: [{ descricao: 'Inicial' }, { descricao: 'Procuração' }] },
    { id: 'f2', nome: 'Instrução', acoes: ['Ouvir'] },
    { id: 'f3', nome: 'Antiga' },
];
const v2 = [
    { id: 'f1', nome: 'Triagem', acoes: ['Despachar', 'Conferir', 'Nova'], documentos: [{ descricao: 'Procuração' }] },
    { id: 'f2', nome: 'Instrução', acoes: ['Ouvir'] },
];

test('migrarEstado: ações, respostas e documentos seguem pelo texto; o que sumiu sai', () => {
    const proc = {
        fases: v1, fase_atual: 'f1',
        acoes_feitas: { f1: [0, 1, 2], f3: [0] },
        acoes_respostas: { f1: { 2: 'sim', 1: 'x' } },
        exigencias_cumpridas: { f1: { d0: { documento_id: 'a' }, d1: { documento_id: 'b' }, a2: { documento_id: 'c' } } },
    };
    const r = migrarEstado(proc, v2, 'f1');
    assert.equal(r.mudou_de_fase, false);
    assert.equal(r.fase_atual, 'f1');
    assert.deepEqual(r.acoes_feitas, { f1: [0, 1] }, 'Conferir 0->1, Despachar 2->0, Certificar some; fase f3 sai');
    assert.deepEqual(r.acoes_respostas, { f1: { 0: 'sim' } });
    assert.deepEqual(r.exigencias_cumpridas, { f1: { d0: { documento_id: 'b' }, a0: { documento_id: 'c' } } }, 'Procuração vira d0; Inicial sai');
    assert.equal(r.fases, v2);
});

test('migrarEstado: fase que sumiu vai para o destino, que começa do zero', () => {
    const proc = { fases: v1, fase_atual: 'f3', acoes_feitas: { f2: [0], f1: [0] } };
    const r = migrarEstado(proc, v2, 'f2');
    assert.equal(r.mudou_de_fase, true);
    assert.deepEqual(r.acoes_feitas, { f1: [1] }, 'o destino f2 recomeça; f1 mantém Conferir na posição nova');
    assert.throws(() => migrarEstado(proc, v2, 'f9'));
});

test('migrarEstado: processo antigo sem estado não quebra', () => {
    const r = migrarEstado({ fase_atual: 'f2' }, v2, 'f2');
    assert.deepEqual([r.acoes_feitas, r.acoes_respostas, r.exigencias_cumpridas], [{}, {}, {}]);
});

test('gruposDaMigracao: por versão e fase, marcando a que não existe mais', () => {
    const g = gruposDaMigracao([
        { rito_versao: 1, fase_atual: 'f1', fases: v1 }, { rito_versao: 1, fase_atual: 'f1', fases: v1 },
        { rito_versao: 2, fase_atual: 'f3', fases: v1 }, { fase_atual: 'f2', fases: v1 },
    ], v2);
    assert.deepEqual(g.map((x) => [x.versao, x.fase_nome, x.processos, x.existe]), [[1, 'Instrução', 1, true], [1, 'Triagem', 2, true], [2, 'Antiga', 1, false]]);
});

test('registro da atualização fica fora do portal e não vira termo', () => {
    const m = { tipo: 'rito_atualizado', dados: { interno: true, fora_impressao: true, visivel_partes: false } };
    assert.equal(visivelParaPartes(m), false);
    assert.equal(tituloEvento(m), 'Atualização do rito (registro interno)');
});
