import test from 'node:test';
import assert from 'node:assert/strict';
import { fraseDoCronograma, gerarParcelas, problemasDoCronograma, situacaoDasObrigacoes, somarMeses, valorDe } from './cronograma.js';
import { PEDIDOS, pedeDado, regraComPedido, resumoDaAcao } from './exigencias.js';
import { anpcAcompanhamento, anpcCompleto } from './modelos/improbidade.js';

test('somar meses não pula de mês no dia 31', () => {
    assert.equal(somarMeses('2027-01-31', 1), '2027-02-28');
    assert.equal(somarMeses('2028-01-31', 1), '2028-02-29');
    assert.equal(somarMeses('2026-11-30', 3), '2027-02-28');
    assert.equal(somarMeses('2026-12-10', 12), '2027-12-10');
});

test('valor digitado à brasileira', () => {
    assert.equal(valorDe('1.234,56'), 1234.56);
    assert.equal(valorDe('8,5'), 8.5);
    assert.equal(valorDe('1000'), 1000);
    assert.equal(valorDe(''), undefined);
    assert.ok(Number.isNaN(valorDe('abc')));
});

test('gera parcelas iguais; com total, os centavos que sobram vão na última', () => {
    const p = gerarParcelas({ descricao: 'Parcela', quantidade: 3, primeira: '2026-12-31', intervalo: 'mensal', total: 100 });
    assert.deepEqual(p, [
        { descricao: 'Parcela 1 de 3', vence_em: '2026-12-31', valor: 33.33 },
        { descricao: 'Parcela 2 de 3', vence_em: '2027-01-31', valor: 33.33 },
        { descricao: 'Parcela 3 de 3', vence_em: '2027-02-28', valor: 33.34 },
    ]);
    assert.equal(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100), 10000);
    assert.deepEqual(gerarParcelas({ descricao: 'Relatório', quantidade: 2, primeira: '2027-01-10', intervalo: 'semestral' }),
        [{ descricao: 'Relatório 1 de 2', vence_em: '2027-01-10' }, { descricao: 'Relatório 2 de 2', vence_em: '2027-07-10' }]);
    assert.deepEqual(gerarParcelas({ descricao: 'Multa', quantidade: 1, primeira: '2027-01-10', valor: 50 }), [{ descricao: 'Multa', vence_em: '2027-01-10', valor: 50 }]);
    assert.deepEqual(gerarParcelas({ quantidade: 0, primeira: '2027-01-10' }), []);
    assert.deepEqual(gerarParcelas({ quantidade: 2, primeira: '' }), []);
    assert.equal(gerarParcelas({ quantidade: 999, primeira: '2027-01-10' }).length, 120);
});

test('aponta o que impede o envio', () => {
    assert.deepEqual(problemasDoCronograma([]), ['Inclua ao menos uma obrigação.']);
    assert.deepEqual(problemasDoCronograma([{ descricao: 'a', vence_em: '2027-01-01', valor: 1 }]), []);
    assert.deepEqual(problemasDoCronograma([{ descricao: '', vence_em: '2027-01-01' }, { descricao: 'b', vence_em: '' }, { descricao: 'c', vence_em: '2027-01-01', valor: NaN }]),
        ['Descreva a obrigação 1.', 'Informe o vencimento de "b".', 'O valor de "c" é inválido.']);
});

test('frase do andamento', () => {
    const o = (vence_em, status, valor) => ({ descricao: 'P', vence_em, status, obrigacao: true, valor });
    const s = situacaoDasObrigacoes([o('2026-10-10', 'cumprido', 100), o('2026-11-10', 'aberto', 100), o('2026-12-10', 'aberto', 100), { vence_em: '2026-01-01', status: 'aberto' }], '2026-11-18');
    assert.equal(fraseDoCronograma(s), '1 de 3 obrigações cumpridas (R$ 100,00 de R$ 300,00); 1 atrasada; próxima em 10/11/2026');
    assert.equal(fraseDoCronograma(situacaoDasObrigacoes([], '2026-11-18')), '');
});

test('no editor: os dois pedidos existem; o de esperar não leva destino, nome nem folha de dados', () => {
    assert.ok(PEDIDOS.some(([p]) => p === 'cronograma'));
    assert.ok(PEDIDOS.some(([p]) => p === 'quitacao'));
    const q = regraComPedido({ pede: 'texto', rotulo: 'x', destino: 'autos', partes: true, folha_dados: true, obrigatoria: true, ajuda: 'Dica' }, 'quitacao', 'Tudo cumprido');
    assert.deepEqual(q, { pede: 'quitacao', obrigatoria: true, ajuda: 'Dica' });
    assert.equal(pedeDado(q), false);
    assert.match(resumoDaAcao(q), /cumpre-se sozinha.*obrigatória/);
    const c = regraComPedido({ pede: 'texto', destino: 'autos', obrigatoria: true }, 'cronograma', 'Registrar o cronograma');
    assert.deepEqual(c, { pede: 'cronograma', destino: 'autos', obrigatoria: true });
    assert.match(resumoDaAcao(c), /cronograma de obrigações/);
});

test('o acompanhamento do acordo registra o cronograma e só termina com tudo cumprido', () => {
    for (const m of [anpcAcompanhamento(), anpcCompleto()]) {
        const id = m.id;
        const pedidos = (nome) => m.fases.find((f) => f.nome === nome).acoes_regras.map((r) => r?.pede);
        assert.ok(pedidos('Início do acompanhamento').includes('cronograma'), id);
        const fim = m.fases.find((f) => f.nome === 'Cumprimento integral');
        const i = fim.acoes_regras.findIndex((r) => r?.pede === 'quitacao');
        assert.equal(fim.acoes_regras[i].obrigatoria, true, id);
    }
});
