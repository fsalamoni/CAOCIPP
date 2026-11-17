import test from 'node:test';
import assert from 'node:assert/strict';
import { NUMERACAO_PADRAO, codigoDe, codigosFaltando, codigosRepetidos, digitosCodigos, formatarNumero, novaParte, problemasNumeracao, resumoContagem, siglaDe } from './numeracao.js';

test('códigos numéricos na prévia: zeros à esquerda, ??? sem código, repetidos e dígitos por seção', () => {
    const n = { partes: [{ t: 'seq', escopo: 'unidade', reinicia: 'ano', digitos: 6 }, { t: 'texto', v: '.' }, novaParte('cod_unidade'), { t: 'texto', v: '/' }, { t: 'ano', digitos: 4 }] };
    const c = { hoje: '2026-11-12', unidade: { nome: 'Gabinete', codigo: 1 } };
    assert.deepEqual(problemasNumeracao(n), []);
    assert.equal(formatarNumero(n, c, 7), '000007.001/2026');
    assert.equal(formatarNumero(n, { ...c, unidade: { nome: 'Gabinete' } }, 7), '000007.???/2026');
    assert.deepEqual(codigosFaltando(n, c), []);
    assert.deepEqual(codigosFaltando(n, { ...c, unidade: { nome: 'Gabinete', codigo: 1000 } }), ['Gabinete']);
    assert.deepEqual([...codigosRepetidos([{ nome: 'A', codigo: '01' }, { nome: 'B', codigo: 1 }, { nome: 'C', codigo: '' }])], [[1, ['A', 'B']]]);
    assert.deepEqual(digitosCodigos([n, { partes: [{ t: 'cod_tipo', digitos: 2 }] }]), { tipo: 2, unidade: 3, orgao: 0 });
    assert.equal(codigoDe('007'), 7);
    assert.equal(codigoDe('x'), null);
});

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
    assert.match(problemasNumeracao({ partes: [{ ...novaParte('seq'), escopo: 'unidade', reinicia: 'nunca' }] })[0], /sigla ou o código da unidade/);
    assert.match(problemasNumeracao({ partes: [{ ...novaParte('seq'), reinicia: 'nunca' }, { t: 'texto', v: '' }] })[0], /Texto fixo/);
});
