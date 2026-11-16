'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ATOS_QUE_MUDAM } = require('../lib/secretaria/context');

// O sinal faz as telas abertas relerem listas e autos. Se uma leitura
// sinalizasse, uma tela relendo provocaria a releitura das outras, sem fim.
test('nenhuma leitura grava o sinal do órgão', () => {
    const leituras = ['listar', 'obter', 'indice', 'contadores', 'vinculados', 'excluidos', 'baixar', 'pdf', 'versoes', 'meusProcessos', 'comunicacoes', 'estado', 'anotacao'];
    for (const a of leituras) assert.ok(!ATOS_QUE_MUDAM.has(a), `${a} não pode sinalizar`);
});

test('os atos do dia a dia sinalizam', () => {
    for (const a of ['autuar', 'tramitar', 'avancarFase', 'marcarAcao', 'juntar', 'assinar', 'peticionar']) assert.ok(ATOS_QUE_MUDAM.has(a), a);
});
