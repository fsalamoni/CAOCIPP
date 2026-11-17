import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarItens, faixaPontuacao, OPCOES_ACAO, rotuloAcao, resumoDetalhes, diasDesde } from './platformSecurity.js';

test('risco vem primeiro, mantendo a ordem dentro do mesmo estado', () => {
    const r = ordenarItens([{ key: 'a', estado: 'ok' }, { key: 'b', estado: 'atencao' }, { key: 'c', estado: 'risco' }, { key: 'd', estado: 'atencao' }]);
    assert.deepEqual(r.map((i) => i.key), ['c', 'b', 'd', 'a']);
});

test('faixas da pontuação', () => {
    assert.equal(faixaPontuacao(90).tom, 'ok');
    assert.equal(faixaPontuacao(70).tom, 'atencao');
    assert.equal(faixaPontuacao(40).tom, 'risco');
});

test('filtro de ação sem rótulos repetidos', () => {
    const rotulos = OPCOES_ACAO.map((o) => o.rotulo);
    assert.equal(new Set(rotulos).size, rotulos.length);
    assert.equal(rotuloAcao('GRANT_PLATFORM_ADMIN'), 'Concedeu acesso de super-admin');
    assert.equal(rotuloAcao('X_NOVA'), 'X_NOVA');
});

test('resumo dos detalhes usa só campos conhecidos', () => {
    assert.equal(resumoDetalhes({ flagKey: 'tour', enabled: false, target_uid: 'abc' }), 'flagKey: tour · enabled: não');
    assert.equal(resumoDetalhes(null), '');
    assert.equal(diasDesde('2026-11-07T00:00:00Z', Date.parse('2026-11-17T00:00:00Z')), 10);
});
