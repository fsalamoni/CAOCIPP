// npm run test:lib
// Parceria conduzida pelo rito e regra da primeira fase na autuação, no editor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comRegistroConduzido, comSituacao, nomeDoRegistro, resumoAndamento, situacoesDaRegra } from './andamentoFase.js';

test('parceria: situações próprias, e trocar de quadro zera as escolhidas', () => {
    const p = { modulo: 'parcerias', ao_entrar: 'Em análise' };
    assert.deepEqual(situacoesDaRegra(p).map(([v]) => v), ['Pendente', 'Em análise', 'Em revisão', 'Revisadas', 'Aguarda Terceiros', 'Parcerias']);
    assert.equal(nomeDoRegistro(p), 'a parceria');
    assert.deepEqual(comRegistroConduzido({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, 'parcerias'), { modulo: 'parcerias' });
    assert.deepEqual(comRegistroConduzido({ situacao_registro: p }, 'consultas'), { modulo: 'consultas' });
    assert.deepEqual(comRegistroConduzido({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, 'expedientes'), { modulo: 'expedientes', ao_entrar: 'Pendente' });
});

test('valer já na autuação: entra e sai da regra, e o resumo diz', () => {
    const f = { situacao_registro: { modulo: 'parcerias', ao_entrar: 'Pendente' } };
    const com = comSituacao(f, { na_autuacao: true });
    assert.deepEqual(com, { modulo: 'parcerias', ao_entrar: 'Pendente', na_autuacao: true });
    assert.ok(resumoAndamento({ situacao_registro: com }).includes('a regra do registro vale já na autuação'));
    assert.deepEqual(comSituacao({ situacao_registro: com }, { na_autuacao: false }), { modulo: 'parcerias', ao_entrar: 'Pendente' });
});
