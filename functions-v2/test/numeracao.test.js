// Numeração única do processo. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('../lib/shared/numeracao');

const ctx = { hoje: '2026-11-12', tipo: { id: 't1', sigla: 'req', nome: 'Requerimento' }, unidade: { id: 'u1', sigla: '', nome: 'Secretaria de Consultas' }, orgao: { id: 'o1', sigla: 'CAO', nome: 'Centro' } };

test('numeração padrão: mesmo formato e mesmo contador de sempre', () => {
    assert.equal(n.formatarNumero(n.NUMERACAO_PADRAO, ctx, 7), '000007/2026');
    assert.equal(n.chaveContador('org', n.NUMERACAO_PADRAO, ctx), 'org_2026');
    assert.deepEqual(n.numeracaoDe(undefined), n.NUMERACAO_PADRAO);
    assert.deepEqual(n.numeracaoDe({ partes: [] }), n.NUMERACAO_PADRAO, 'gravada inválida volta à padrão');
});

test('numeração composta por partes: siglas, datas, texto e contagem por escopo', () => {
    const cfg = n.sanitizeNumeracao({ partes: [
        { t: 'sigla_tipo' }, { t: 'texto', v: '-' }, { t: 'seq', escopo: 'tipo', reinicia: 'mes', digitos: 3 }, { t: 'texto', v: '/' }, { t: 'mes' }, { t: 'ano', digitos: 2 },
    ] });
    assert.equal(n.formatarNumero(cfg, ctx, 12), 'REQ-012/1126');
    assert.equal(n.chaveContador('org', cfg, ctx), 'org_tipo_REQ_2026-11', 'conta pela sigla impressa');
    const un = n.sanitizeNumeracao({ partes: [{ t: 'sigla_unidade' }, { t: 'seq', escopo: 'unidade', reinicia: 'nunca', digitos: 99 }] });
    assert.equal(un.partes[1].digitos, 10);
    assert.equal(n.formatarNumero(un, ctx, 5), 'SC0000000005', 'sem sigla, as iniciais do nome');
    assert.equal(n.chaveContador('org', un, ctx), 'org_unidade_SC_sempre');
    const og = n.sanitizeNumeracao({ partes: [{ t: 'sigla_orgao' }, { t: 'texto', v: '.' }, { t: 'seq', escopo: 'orgao', reinicia: 'ano', digitos: 4 }, { t: 'texto', v: '.' }, { t: 'ano', digitos: 4 }, { t: 'dia' }] });
    assert.equal(n.formatarNumero(og, ctx, 1), 'CAO.0001.202612');
    assert.equal(n.chaveContador('org', og, { ...ctx, orgao: null }), 'org_orgao_sem-orgao_2026');
});

test('numeração: recusa o que repetiria números ou não tem contagem', () => {
    const seq = (o) => ({ t: 'seq', escopo: 'geral', reinicia: 'ano', digitos: 6, ...o });
    assert.throws(() => n.sanitizeNumeracao({ partes: [] }), /ao menos o número/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [{ t: 'ano', digitos: 4 }] }), /exatamente um/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq(), seq(), { t: 'ano' }] }), /exatamente um/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq()] }), /inclua o ano/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ reinicia: 'mes' }), { t: 'ano' }] }), /inclua o mês/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ escopo: 'tipo', reinicia: 'nunca' })] }), /sigla do tipo/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ escopo: 'unidade', reinicia: 'nunca' })] }), /sigla da unidade/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ escopo: 'orgao', reinicia: 'nunca' })] }), /sigla do órgão/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ reinicia: 'nunca' }), { t: 'texto', v: '<b>' }] }), /Texto fixo/);
    assert.throws(() => n.sanitizeNumeracao({ partes: [seq({ reinicia: 'nunca' }), { t: 'xx' }] }), /desconhecida/);
    assert.ok(n.sanitizeNumeracao({ partes: [seq({ reinicia: 'nunca' })] }));
    const longo = [...Array(6)].map(() => ({ t: 'texto', v: 'ABCDEFGHIJ' }));
    assert.throws(() => n.sanitizeNumeracao({ partes: [...longo, seq({ reinicia: 'nunca' })] }), /60 caracteres/);
});

test('numeração do tipo: do órgão, própria ou nenhuma; arquivo sem barras', () => {
    assert.deepEqual(n.numeracaoTipoDe(undefined), { modo: 'orgao' });
    assert.deepEqual(n.numeracaoTipoDe({ modo: 'nenhuma', partes: [1] }), { modo: 'nenhuma' });
    assert.deepEqual(n.numeracaoTipoDe({ modo: 'propria', partes: [] }), { modo: 'orgao' });
    assert.equal(n.sanitizeNumeracaoTipo({ modo: 'propria', partes: [{ t: 'seq', escopo: 'geral', reinicia: 'nunca', digitos: 2 }] }).partes.length, 1);
    assert.throws(() => n.sanitizeNumeracaoTipo({ modo: 'propria', partes: [] }), /ao menos/);
    assert.equal(n.identificadorSemNumero('abcdefghijkl'), 'SN-ABCDEFGH');
    assert.equal(n.numeroArquivo('REQ 12/2026'), 'REQ-12-2026');
    assert.equal(n.numeroArquivo('///'), 'processo');
});
