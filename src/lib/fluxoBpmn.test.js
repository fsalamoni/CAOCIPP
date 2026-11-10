import test from 'node:test';
import assert from 'node:assert/strict';
import { TW, caminho, desenharFluxo, quebrar } from './fluxoBpmn.js';

const fases = [
    { id: 'a', nome: 'Receber', unidade: 'Protocolo', proximas: ['b', 'c'], condicoes: { b: 'Sim', c: 'Não' } },
    { id: 'b', nome: 'Analisar', unidade: 'Assessoria', proximas: ['d'] },
    { id: 'c', nome: 'Devolver', unidade: 'Protocolo', proximas: [], final: true },
    { id: 'd', nome: 'Revisar', unidade: 'Assessoria', proximas: ['b', 'e'], condicoes: { b: 'Com ajustes' } },
    { id: 'e', nome: 'Arquivar', unidade: 'Protocolo', proximas: [], final: true },
];
const raia = (f) => f.unidade;

test('quebrar: divide em linhas e corta o excesso com reticências', () => {
    assert.deepEqual(quebrar('Solicitar pesquisa de jurisprudência', 19, 3), ['Solicitar pesquisa', 'de jurisprudência']);
    const l = quebrar('um dois três quatro cinco seis sete oito nove dez', 8, 2);
    assert.equal(l.length, 2);
    assert.ok(l[1].endsWith('…'));
    assert.deepEqual(quebrar('', 10, 2), []);
});

test('caminho: começa no primeiro ponto, termina no último e arredonda os cantos', () => {
    const d = caminho([[0, 0], [20, 0], [20, 30]]);
    assert.ok(d.startsWith('M0,0'));
    assert.ok(d.endsWith('L20,30'));
    assert.match(d, /Q20,0/);
});

test('desenharFluxo: raias por unidade, desvio com mais de uma saída, fim sem saída', () => {
    const g = desenharFluxo(fases, raia);
    assert.deepEqual(g.raias.map((r) => r.nome), ['Protocolo', 'Assessoria']);
    assert.deepEqual(g.desvios.map((d) => d.id), ['a', 'd']);
    assert.deepEqual(g.fins.map((f) => f.id), ['c', 'e']);
    assert.equal(g.tarefas.length, 5);
    // Cada tarefa fica dentro da sua raia e do desenho.
    for (const t of g.tarefas) {
        const r = g.raias.find((x) => x.nome === fases[t.indice].unidade);
        assert.ok(t.y >= r.y && t.y + 60 <= r.y + r.altura, `${t.nome} fora da raia`);
        assert.ok(t.x > 0 && t.x + TW < g.largura, `${t.nome} fora do desenho`);
    }
    // Uma seta por ligação, mais a do início, as dos fins e as que levam ao losango.
    assert.equal(g.setas.filter((s) => s.tipo === 'inicio').length, 1);
    assert.equal(g.setas.filter((s) => s.tipo === 'fim').length, 2);
    assert.equal(g.setas.filter((s) => s.tipo === 'desvio').length, 2);
    assert.equal(g.setas.filter((s) => s.tipo === 'fluxo' || s.tipo === 'volta').length, 5);
});

test('desenharFluxo: volta é tracejada (tipo volta) e leva a condição escrita', () => {
    const g = desenharFluxo(fases, raia);
    const volta = g.setas.find((s) => s.de === 'd' && s.para === 'b');
    assert.equal(volta.tipo, 'volta');
    assert.equal(volta.rotulo, 'Com ajustes');
    assert.equal(g.setas.find((s) => s.de === 'a' && s.para === 'b').rotulo, 'Sim');
    // Duas entradas na mesma tarefa: as condições não ficam na mesma altura.
    const ida = g.setas.find((s) => s.de === 'a' && s.para === 'b');
    assert.notEqual(ida.ry, volta.ry);
});

test('desenharFluxo: sem unidades não há cabeçalho de raia; vazio não quebra', () => {
    const g = desenharFluxo(fases.map(({ unidade, ...f }) => f));
    assert.equal(g.raias.length, 1);
    assert.equal(g.raias[0].cab, 0);
    assert.deepEqual(desenharFluxo([]).tarefas, []);
    assert.equal(desenharFluxo(null).largura, 0);
});

test('desenharFluxo: fluxo longo muda de faixa e cabe na largura pedida', () => {
    const longas = Array.from({ length: 9 }, (_x, i) => ({ id: `f${i}`, nome: `Fase ${i}`, unidade: i < 4 ? 'A' : 'B', proximas: i < 8 ? [`f${i + 1}`] : [] }));
    const uma = desenharFluxo(longas, raia);
    const g = desenharFluxo(longas, raia, 3);
    assert.equal(uma.faixas, 1);
    assert.equal(g.faixas, 3);
    assert.ok(g.largura < uma.largura / 2);
    assert.ok(g.altura > uma.altura);
    // A 4ª fase volta para a esquerda, abaixo da 1ª; cada faixa só tem as raias que usa.
    assert.equal(g.tarefas[3].x, g.tarefas[0].x);
    assert.ok(g.tarefas[3].y > g.tarefas[0].y);
    assert.deepEqual(g.raias.map((r) => `${r.faixa}:${r.nome}`), ['0:A', '1:A', '1:B', '2:B']);
    for (const t of g.tarefas) assert.ok(t.x + TW < g.largura);
    assert.equal(g.setas.filter((s) => s.tipo === 'fluxo').length, 8);
});

test('desenharFluxo: fases da mesma coluna e raia se empilham sem se sobrepor', () => {
    const g = desenharFluxo([
        { id: 'a', nome: 'A', proximas: ['b', 'c'] },
        { id: 'b', nome: 'B', proximas: ['d'] },
        { id: 'c', nome: 'C', proximas: ['d'] },
        { id: 'd', nome: 'D', proximas: [] },
    ]);
    const [b, c] = [g.tarefas[1], g.tarefas[2]];
    assert.equal(b.x, c.x);
    assert.ok(Math.abs(b.y - c.y) >= 60);
});
