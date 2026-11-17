import test from 'node:test';
import assert from 'node:assert/strict';
import { avisoVisivel, situacaoAviso, bloqueadoPorManutencao } from './platformAvisos.js';

const agora = new Date('2026-12-01T12:00:00Z');
const aviso = { id: 'a1', ativo: true, titulo: 'Atualização', dispensavel: true };

test('aviso ativo aparece; encerrado não', () => {
    assert.equal(avisoVisivel(aviso, agora), true);
    assert.equal(avisoVisivel({ ...aviso, ativo: false }, agora), false);
    assert.equal(avisoVisivel(null, agora), false);
});

test('período: antes do início e depois do fim não aparece', () => {
    assert.equal(avisoVisivel({ ...aviso, inicio: '2026-12-01T13:00:00Z' }, agora), false);
    assert.equal(avisoVisivel({ ...aviso, fim: '2026-12-01T12:00:00Z' }, agora), false);
    assert.equal(avisoVisivel({ ...aviso, inicio: '2026-12-01T11:00:00Z', fim: '2026-12-02T00:00:00Z' }, agora), true);
});

test('dispensado some, a menos que não seja dispensável', () => {
    assert.equal(avisoVisivel(aviso, agora, ['a1']), false);
    assert.equal(avisoVisivel({ ...aviso, dispensavel: false }, agora, ['a1']), true);
    assert.equal(avisoVisivel({ ...aviso, id: 'a2' }, agora, ['a1']), true);
});

test('situação do aviso para o painel', () => {
    assert.equal(situacaoAviso(null, agora), 'nenhum');
    assert.equal(situacaoAviso(aviso, agora), 'no_ar');
    assert.equal(situacaoAviso({ ...aviso, ativo: false }, agora), 'encerrado');
    assert.equal(situacaoAviso({ ...aviso, inicio: '2026-12-05T00:00:00Z' }, agora), 'agendado');
    assert.equal(situacaoAviso({ ...aviso, fim: '2026-11-30T00:00:00Z' }, agora), 'expirado');
});

test('manutenção barra todos menos o super-admin', () => {
    assert.equal(bloqueadoPorManutencao({ ativa: true }, false), true);
    assert.equal(bloqueadoPorManutencao({ ativa: true }, true), false);
    assert.equal(bloqueadoPorManutencao({ ativa: false }, false), false);
    assert.equal(bloqueadoPorManutencao(undefined, false), false);
});
