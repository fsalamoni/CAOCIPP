// "Sem evento" (destino nenhum) nas ações e fases do rito. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const a = require('../lib/shared/autos');
const i = require('../lib/shared/informacoes');

test('sem evento: ações e fases aceitam, documento não; marcas ocultas; partes nunca veem', () => {
    const r = x.sanitizeRegras({
        registro_atos: { fase: 'nenhum', remessas: 'nenhum' },
        acoes_regras: [{ destino: 'nenhum', partes: true }, { pede: 'texto', destino: 'nenhum', partes: true }, { pede: 'documento', documento: { destino: 'nenhum' } }],
    }, ['Conferir', 'Anotar', 'Anexar']);
    assert.deepEqual(r.registro_atos, { fase: 'nenhum', remessas: 'nenhum' });
    assert.deepEqual(r.acoes_regras[0], { destino: 'nenhum' });
    assert.deepEqual(r.acoes_regras[1], { pede: 'texto', destino: 'nenhum' });
    assert.equal(r.acoes_regras[2].documento.destino, undefined, 'documento sem evento vira juntado aos autos');
    assert.equal(x.partesVeem({ pede: 'texto', destino: 'nenhum', partes: true }), false);
    assert.deepEqual(x.marcasDoDestino('nenhum'), { interno: true, fora_impressao: true, oculto: true, visivel_partes: false });
});

test('valor desconhecido (cópia antiga, dado mexido) vira o padrão', () => {
    assert.equal(x.destinoDaAcao({ destino: 'qualquer' }), 'evento');
    assert.equal(x.destinoDaAcao({ documento: { descricao: 'D', forma: 'qualquer', destino: 'nenhum' } }), 'autos');
    assert.deepEqual(x.niveisDaFase({ id: 'f', registro_atos: { fase: 'qualquer' } }), { fase: 'autos', remessas: 'autos' });
});

test('transição: sem evento numa só fase não apaga o registro da outra', () => {
    assert.equal(x.destinoTransicao('nenhum', 'autos'), 'autos');
    assert.equal(x.destinoTransicao('evento', 'nenhum'), 'evento');
    assert.equal(x.destinoTransicao('nenhum', 'nenhum'), 'nenhum');
    assert.equal(x.destinoTransicao('informacao', 'evento'), 'informacao');
    const fases = [{ id: 'a' }, { id: 'b', registro_atos: { fase: 'nenhum' } }, { id: 'c', registro_atos: { fase: 'nenhum', remessas: 'nenhum' } }];
    assert.equal(x.destinoDoMovimento(fases, 'a', 'b'), 'autos');
    assert.equal(x.destinoDoMovimento(fases, 'b', 'c'), 'nenhum');
    assert.equal(x.destinoDoMovimento(fases, 'c', null), 'nenhum');
});

test('informação do andamento lê o destino gravado no movimento', () => {
    const movs = [{ seq: 1, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 0, rotulo: 'Nº', valor: 'X', destino: 'nenhum', ...x.marcasDoDestino('nenhum') } }];
    assert.equal(i.informacoesDoAndamento(movs, [{ id: 'f', nome: 'F' }])[0].destino, 'nenhum');
    assert.equal(i.informacoesDoAndamento(movs, [{ id: 'f', nome: 'F' }], true).length, 0);
});

test('registro oculto: interno, sem folha, fora do portal', () => {
    const m = { seq: 1, tipo: 'fase', dados: { de: 'a', para: 'b', ...x.marcasDoDestino('nenhum') } };
    assert.equal(a.origemEvento(m), 'interno');
    assert.equal(a.geraTermo(m), false);
    assert.equal(a.visivelParaPartes(m), false);
});
