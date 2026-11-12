import test from 'node:test';
import assert from 'node:assert/strict';
import { NUMERACAO_PADRAO, formatarNumero, novaParte, problemasNumeracao, resumoContagem, siglaDe } from './numeracao.js';

const ctx = { hoje: '2026-11-12', tipo: { sigla: 'req' }, unidade: { nome: 'Secretaria de Consultas' }, orgao: null };

test('prévia da numeração igual à do servidor', () => {
    assert.equal(formatarNumero(NUMERACAO_PADRAO, ctx, 7), '000007/2026');
    const n = { partes: [{ t: 'sigla_tipo' }, novaParte('texto'), { t: 'seq', escopo: 'tipo', reinicia: 'mes', digitos: 3 }, { t: 'texto', v: '-' }, { t: 'mes' }, { t: 'ano', digitos: 2 }] };
    assert.equal(formatarNumero(n, ctx, 12), 'REQ/012-1126');
    assert.deepEqual(problemasNumeracao(n), []);
    assert.equal(siglaDe(ctx.unidade), 'SC');
    assert.equal(resumoContagem(n), 'Contagem por tipo de processo, recomeça a cada mês.');
});

test('problemas da numeração', () => {
    assert.match(problemasNumeracao({ partes: [] })[0], /exatamente um/);
    assert.match(problemasNumeracao({ partes: [novaParte('seq')] })[0], /inclua o ano/);
    assert.match(problemasNumeracao({ partes: [{ ...novaParte('seq'), escopo: 'unidade', reinicia: 'nunca' }] })[0], /sigla da unidade/);
    assert.match(problemasNumeracao({ partes: [{ ...novaParte('seq'), reinicia: 'nunca' }, { t: 'texto', v: '' }] })[0], /Texto fixo/);
});
