import test from 'node:test';
import assert from 'node:assert/strict';
import { atende, pendentesDaFase, realinharRegras, situacaoDaFase, sugeridas } from './exigencias.js';

const fase = { id: 'f1', acoes: ['Despachar', 'Certificar'], documentos: [{ descricao: 'Parecer', forma: 'juntar', tipo: 'Parecer' }],
    acoes_regras: [{ documento: { descricao: 'Despachar', forma: 'redigir', modelo_id: 'm1' } }, { autos: true }] };

test('situação e pendências da fase', () => {
    const cumpridas = { f1: { d0: { documento_id: 'x', ordem: 3 } } };
    assert.deepEqual(situacaoDaFase(fase, cumpridas).map((e) => [e.chave, e.cumprida?.ordem ?? null]), [['d0', 3], ['a0', null]]);
    assert.deepEqual(pendentesDaFase(fase, cumpridas).map((e) => e.chave), ['a0']);
    assert.deepEqual(pendentesDaFase(undefined, {}), []);
});

test('sugere pelo modelo ou tipo, respeitando a forma', () => {
    const pend = pendentesDaFase(fase, {});
    assert.deepEqual(sugeridas(pend, { origem: 'editor', modelo_id: 'm1' }), ['a0']);
    assert.deepEqual(sugeridas(pend, { origem: 'upload', tipo: 'PARECER' }), ['d0']);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor' }), false);
    assert.equal(atende({ forma: 'qualquer' }, { origem: 'upload' }), true);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor', peticao: true }), true);
});

test('regras seguem o texto da ação ao editar a lista', () => {
    const r = [{ autos: true }, null, { documento: { descricao: 'C' } }];
    // apagar a primeira linha: a regra de "C" continua em "C"
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['B', 'C']), [null, r[2]]);
    // reordenar
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['C', 'A', 'B']), [r[2], r[0], null]);
    // corrigir o texto de uma linha mantém a posição
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['Ax', 'B', 'C']), r);
    // linha nova em branco no fim
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['A', 'B', 'C', '']), [...r, null]);
    assert.equal(realinharRegras(['A'], undefined, ['B']), undefined);
    assert.equal(realinharRegras(['A', 'B'], [{ autos: true }, null], ['B']), undefined);
});

test('ação: o que pede, onde fica e troca de pedido sem perder destino', async () => {
    const m = await import('./exigencias.js');
    assert.equal(m.destinoDaAcao(null), 'evento');
    assert.equal(m.destinoDaAcao({ autos: true }), 'autos');
    assert.equal(m.partesVeem({ autos: true }), true);
    assert.deepEqual(m.regraComPedido({ destino: 'informacao', obrigatoria: true }, 'numero', 'Registrar'), { pede: 'numero', destino: 'informacao', obrigatoria: true });
    assert.deepEqual(m.regraComPedido(null, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer' } });
    assert.deepEqual(m.regraComPedido({ destino: 'informacao' }, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer', destino: 'informacao' } });
    assert.equal(m.regraComPedido(null, 'confirmar', 'A'), null);
    assert.match(m.resumoDaAcao({ pede: 'numero', rotulo: 'Nº SIM', destino: 'autos', partes: true }), /número \(Nº SIM\); certidão nos autos; partes veem/);
    assert.deepEqual(m.niveisDaFase({ registro: 'remessas_fora' }), { fase: 'autos', remessas: 'evento' });
    // Sem evento: as partes nunca veem; documento não fica sem evento; valor desconhecido vira o padrão.
    assert.equal(m.partesVeem({ pede: 'texto', destino: 'nenhum', partes: true }), false);
    assert.deepEqual(m.regraComPedido({ destino: 'nenhum' }, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer' } });
    assert.equal(m.destinoDaAcao({ destino: 'xx' }), 'evento');
    assert.match(m.resumoDaAcao({ destino: 'nenhum' }), /sem evento/);
    // Espelho do servidor: mesma regra de transição.
    for (const [a, b, r] of [['nenhum', 'autos', 'autos'], ['evento', 'nenhum', 'evento'], ['nenhum', 'nenhum', 'nenhum'], ['informacao', 'evento', 'informacao'], ['autos', 'evento', 'evento']]) {
        assert.equal(m.destinoTransicao(a, b), r, `${a}+${b}`);
    }
    const fs = [{ id: 'a' }, { id: 'b', proximas: ['a'] }, { id: 'c', final: true }];
    assert.deepEqual(m.saidasDaFase(fs, fs[0]).map((x) => x.id), ['b']);
    assert.deepEqual(m.saidasDaFase(fs, fs[1]).map((x) => x.id), ['a']);
    assert.deepEqual(m.saidasDaFase(fs, fs[2]), []);
    const f = { id: 'f', acoes: ['A', 'B'], acoes_regras: [{ obrigatoria: true }, { documento: { descricao: 'B', forma: 'qualquer', destino: 'evento' } }] };
    assert.deepEqual(m.faltaNaFase(f, {}, []).map((e) => e.descricao), ['B', 'A']);
    assert.equal(m.atende({ forma: 'qualquer', destino: 'evento' }, { origem: 'upload' }), false);
    assert.equal(m.atende({ forma: 'qualquer', destino: 'evento' }, { origem: 'upload', controle: true }), true);
});
