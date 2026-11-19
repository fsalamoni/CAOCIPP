// Cronograma de obrigações: a conferência das parcelas, os prazos que nascem
// delas, o andamento e a ação que espera o cumprimento (pede 'quitacao').
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/shared/cronograma');
const x = require('../lib/shared/exigencias');
const { encerrarPrazosDaFase } = require('../lib/shared/prazosFase');

const HOJE = '2026-11-18';
let n = 0;
const ops = { hoje: HOJE, agora: `${HOJE}T12:00:00.000Z`, quem: 'Ana', novoId: () => `p${++n}` };

test('confere as obrigações, ordena por vencimento e arredonda o valor', () => {
    const itens = c.sanitizeObrigacoes([
        { descricao: ' Parcela 2 ', vence_em: '2027-01-10', valor: '1000.005' },
        { descricao: 'Parcela 1', vence_em: '2026-12-10', valor: 1000 },
        { descricao: 'Entregar o relatório', vence_em: '2026-12-10' },
    ]);
    assert.deepEqual(itens, [
        { descricao: 'Parcela 1', vence_em: '2026-12-10', valor: 1000 },
        { descricao: 'Entregar o relatório', vence_em: '2026-12-10' },
        { descricao: 'Parcela 2', vence_em: '2027-01-10', valor: 1000.01 },
    ]);
    assert.equal(c.resumoDoCronograma(itens), '3 obrigações, de 10/12/2026 a 10/01/2027, no total de R$ 2.000,01');
});

test('recusa cronograma vazio, grande demais, sem data válida ou com valor inválido', () => {
    assert.throws(() => c.sanitizeObrigacoes([]), /ao menos uma/);
    assert.throws(() => c.sanitizeObrigacoes('x'), /ao menos uma/);
    assert.throws(() => c.sanitizeObrigacoes(Array.from({ length: c.MAX_OBRIGACOES + 1 }, () => ({ descricao: 'a', vence_em: '2027-01-01' }))), /até 120/);
    assert.throws(() => c.sanitizeObrigacoes([{ descricao: '', vence_em: '2027-01-01' }]), /Descreva a obrigação 1/);
    assert.throws(() => c.sanitizeObrigacoes([{ descricao: 'a', vence_em: '2027-02-30' }]), /vencimento/);
    assert.throws(() => c.sanitizeObrigacoes([{ descricao: 'a', vence_em: '2027-01-01', valor: -5 }]), /inválido/);
    assert.throws(() => c.sanitizeObrigacoes([{ descricao: 'a', vence_em: '2027-01-01', valor: 'abc' }]), /inválido/);
});

test('cada obrigação vira um prazo aberto, que sobrevive à saída da fase', () => {
    const itens = c.sanitizeObrigacoes([{ descricao: 'Parcela 1', vence_em: '2026-12-18', valor: 500 }, { descricao: 'Relatório', vence_em: '2027-01-18' }]);
    const prazos = c.prazosDoCronograma(itens, { ...ops, destinatario: 'Fulano', cronograma_de: 'f1:0' });
    assert.equal(prazos.length, 2);
    assert.deepEqual(
        { ...prazos[0], id: '' },
        { id: '', descricao: 'Parcela 1', destinatario: 'Fulano', dias: 30, contagem: 'corridos', inicio: HOJE, vence_em: '2026-12-18', status: 'aberto', aberto_em: ops.agora, aberto_por: 'Ana', obrigacao: true, valor: 500, cronograma_de: 'f1:0' },
    );
    assert.equal('valor' in prazos[1], false);
    // O prazo próprio de uma ação se cancela na saída da fase; a obrigação, não.
    const saida = encerrarPrazosDaFase(prazos, 'f1', HOJE, 'Ana');
    assert.equal(saida.prazos.every((p) => p.status === 'aberto'), true);
    assert.deepEqual(saida.notas, []);
});

test('andamento: cumpridas, atrasadas, próxima e valores; canceladas ficam fora do total', () => {
    const p = (descricao, vence_em, status, valor) => ({ id: descricao, descricao, vence_em, status, obrigacao: true, ...(valor ? { valor } : {}) });
    const prazos = [
        p('P1', '2026-10-10', 'cumprido', 100), p('P2', '2026-11-10', 'aberto', 100), p('P3', '2026-12-10', 'aberto', 100), p('P4', '2027-01-10', 'cancelado', 100),
        { id: 'comum', descricao: 'Prazo comum', vence_em: '2026-11-01', status: 'aberto' },
    ];
    assert.deepEqual(c.situacaoDasObrigacoes(prazos, HOJE), {
        total: 3, cumpridas: 1, abertas: 2, atrasadas: 1, canceladas: 1, proxima: { descricao: 'P2', vence_em: '2026-11-10' }, valor_total: 300, valor_cumprido: 100,
    });
    assert.equal(c.quitado(prazos), false);
    const fim = prazos.map((q) => (q.status === 'aberto' && q.obrigacao ? { ...q, status: 'cumprido' } : q));
    // O prazo comum em aberto não impede: só as obrigações contam.
    assert.equal(c.quitado(fim), true);
    assert.equal(c.textoDaQuitacao(fim, HOJE), '3 de 3 obrigações cumpridas (R$ 300,00)');
    // Sem cronograma, ou com tudo cancelado, nada está quitado.
    assert.equal(c.quitado([]), false);
    assert.equal(c.quitado(undefined), false);
    assert.equal(c.quitado([p('P1', '2026-10-10', 'cancelado')]), false);
});

test('lista "para você": só as obrigações vencidas ou dos próximos 30 dias; sem nenhuma, a próxima', () => {
    const o = (id, vence_em) => ({ id, vence_em, obrigacao: true });
    const lista = [o('a', '2026-11-01'), o('b', '2026-12-18'), o('c', '2026-12-19'), o('d', '2027-06-01'), { id: 'comum', vence_em: '2027-09-01' }];
    assert.deepEqual(c.prazosEmFoco(lista, HOJE).map((q) => q.id), ['comum', 'a', 'b']);
    assert.deepEqual(c.prazosEmFoco([o('d', '2027-06-01'), o('c', '2027-03-01')], HOJE).map((q) => q.id), ['c']);
    assert.deepEqual(c.prazosEmFoco([], HOJE), []);
});

test('o rito guarda os dois pedidos; o de esperar fica só com o nível', () => {
    const { acoes_regras: r } = x.sanitizeRegras({ acoes_regras: [
        { pede: 'cronograma', destino: 'autos', obrigatoria: true, rotulo: 'Parcelas' },
        { pede: 'quitacao', destino: 'autos', rotulo: 'x', partes: true, folha_dados: true, obrigatoria: true },
    ] }, ['Registrar o cronograma', 'Tudo cumprido']);
    assert.equal(r[0].pede, 'cronograma');
    assert.equal(r[0].destino, 'autos');
    assert.equal(r[0].obrigatoria, true);
    assert.equal(r[1].pede, 'quitacao');
    assert.equal(r[1].obrigatoria, true);
    for (const k of ['destino', 'rotulo', 'partes', 'folha_dados']) assert.equal(k in r[1], false, k);
});
