const test = require('node:test');
const assert = require('node:assert/strict');
const { situacaoDaParte } = require('../lib/shared/meusProcessos');

const HOJE = '2026-11-10';
const s = (o) => situacaoDaParte({ status: 'em_tramitacao', prazos: [], aguardando: [], peticoes: 0, ...o }, HOJE);
const intimacao = { especie_nome: 'Intimação', prazo: '5 dias úteis', limite_ciencia: '2026-11-20' };

test('ordem do que pede ação: vencido, ciência, prazo aberto, o resto', () => {
    const vencido = s({ prazos: [{ descricao: 'Defesa', vence_em: '2026-11-12' }, { descricao: 'Laudo', vence_em: '2026-11-09' }], aguardando: [intimacao] });
    assert.deepEqual([vencido.situacao, vencido.prioridade, vencido.data], ['vencido', 0, '2026-11-09']);
    const ciencia = s({ aguardando: [intimacao] });
    assert.deepEqual([ciencia.situacao, ciencia.prioridade, ciencia.data], ['ciencia', 1, '2026-11-20']);
    assert.match(ciencia.frase, /Dê ciência da intimação: abre prazo de 5 dias úteis \(vale por decurso em 20\/11\/2026\)/);
    const prazo = s({ prazos: [{ descricao: 'Defesa', vence_em: '2026-11-12' }], aguardando: [intimacao] });
    assert.deepEqual([prazo.situacao, prazo.data], ['prazo', '2026-11-12']);
    assert.match(prazo.frase, /Prazo até 12\/11\/2026: Defesa\. Há também intimação aguardando/);
    assert.match(s({ prazos: [{ descricao: 'Defesa', vence_em: HOJE }] }).frase, /^Prazo vence hoje/);
});

test('sem pendência: apreciação, acompanhar, sobrestado e arquivado', () => {
    assert.deepEqual([s({ peticoes: 2 }).situacao, s({}).situacao, s({ status: 'arquivado', peticoes: 1 }).situacao], ['apreciacao', 'acompanhar', 'encerrado']);
    assert.match(s({ peticoes: 1 }).frase, /sua manifestação está para apreciação/);
    assert.match(s({ status: 'sobrestado' }).frase, /sobrestado/);
    // arquivado com prazo aberto ainda mostra o prazo
    assert.equal(s({ status: 'arquivado', prazos: [{ descricao: 'x', vence_em: '2026-11-30' }] }).situacao, 'prazo');
});
