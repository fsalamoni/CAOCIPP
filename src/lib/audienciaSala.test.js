// Rodar: node --test src/lib/audienciaSala.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { audienciasParaSala, horaBrasil, linhaDaOcorrencia } from './audienciaSala.js';
import { audienciasFuturas } from './audiencias.js';

test('sala: linha do termo e hora de Brasília', () => {
    assert.equal(horaBrasil('2026-11-20T17:05:00.000Z'), '14:05');
    assert.equal(linhaDaOcorrencia({ tipo: 'depoimento', quem: 'João', texto: 'Viu o fato' }), 'Depoimento de João: Viu o fato.');
    assert.equal(linhaDaOcorrencia({ tipo: 'suspensao', texto: '', em: '2026-11-20T17:20:00.000Z' }), 'Suspensa a audiência às 14:20.');
    assert.equal(linhaDaOcorrencia({ tipo: 'sem_acordo', texto: '' }), 'Não houve acordo.');
});

test('sala: quais audiências vão à sala e quais seguem como próximas', () => {
    const a = { id: '1', status: 'designada', data: '2026-11-20', hora: '14:00' };
    const lista = [a, { ...a, id: '2', data: '2026-11-25' }, { ...a, id: '3', data: '2026-11-19', realizada_em: 'x' }, { ...a, id: '4', status: 'cancelada', data: '2026-11-18' }];
    assert.deepEqual(audienciasParaSala(lista, '2026-11-20').map((x) => x.id), ['1']);
    assert.deepEqual(audienciasFuturas(lista, '2026-11-20').map((x) => x.id), ['1', '2']);
    assert.deepEqual(audienciasFuturas([{ ...a, realizada_em: 'x' }], '2026-11-20'), []);
});
