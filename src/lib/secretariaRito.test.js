// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    modelosDeRito, niveisDoFluxo, ritoDeMermaid, ritoDeTabela, ritoParaMermaid, ritoParaTabela, seguintes, simplificar,
} from './secretariaRito.js';

const nomesSeg = (fases, i) => seguintes(fases, i).map((id) => fases.find((f) => f.id === id).nome);

test('planilha com cabeçalho em qualquer ordem, próximas por nome e por número, fim', () => {
    const { fases, avisos } = ritoDeTabela([
        ['Orientação', 'Fase', 'Prazo (dias)', 'Segue para'],
        ['Conferir', 'Protocolo', '2', ''],
        ['', 'Análise', '10', 'Decisão; 3'],
        ['', 'Complementação', 'x', 'análise'],
        ['', 'Indeferimento', '', 'fim'],
        ['', 'Decisão', '5', 'Arquivo'],
        [],
    ]);
    assert.deepEqual(fases.map((f) => f.nome), ['Protocolo', 'Análise', 'Complementação', 'Indeferimento', 'Decisão']);
    assert.equal(fases[0].prazo_dias, 2);
    assert.equal(fases[0].orientacao, 'Conferir');
    assert.equal(fases[2].prazo_dias, undefined);
    assert.deepEqual(nomesSeg(fases, 0), ['Análise']);
    assert.deepEqual(nomesSeg(fases, 1), ['Decisão', 'Complementação']);
    assert.deepEqual(nomesSeg(fases, 2), ['Análise']);
    assert.deepEqual(nomesSeg(fases, 3), []);
    assert.equal(fases[0].proximas, undefined, 'fluxo linear não precisa de próximas');
    assert.equal(avisos.length, 1);
    assert.match(avisos[0], /Arquivo/);
});

test('planilha sem cabeçalho usa a ordem padrão', () => {
    const { fases } = ritoDeTabela([['A', '3'], ['B', '', '1']]);
    assert.deepEqual(fases.map((f) => [f.nome, f.prazo_dias]), [['A', 3], ['B', undefined]]);
    assert.deepEqual(nomesSeg(fases, 1), ['A']);
});

test('planilha: ida e volta preservam o fluxo', () => {
    const { fases } = modelosDeRito()[2];
    const volta = ritoDeTabela(ritoParaTabela(fases)).fases;
    fases.forEach((f, i) => assert.deepEqual(nomesSeg(volta, i), nomesSeg(fases, i), f.nome));
});

test('mermaid: rótulos, cadeias, setas com texto, fim no meio e comentários', () => {
    const { fases, avisos } = ritoDeMermaid(`flowchart TD
        %% comentário
        A[Protocolo] --> B{Análise}
        B -->|falta documento| C(Complementação) --> B
        B -- ok --> D[Decisão]
        D --> E[Indeferido]
        D --> F[Deferido] --> G[Arquivo]
        style A fill:#fff`);
    assert.deepEqual(avisos, []);
    assert.deepEqual(fases.map((f) => f.nome), ['Protocolo', 'Análise', 'Complementação', 'Decisão', 'Indeferido', 'Deferido', 'Arquivo']);
    assert.deepEqual(nomesSeg(fases, 1), ['Complementação', 'Decisão']);
    assert.deepEqual(nomesSeg(fases, 2), ['Análise']);
    assert.deepEqual(nomesSeg(fases, 3), ['Indeferido', 'Deferido']);
    assert.equal(fases[4].final, true);
    assert.deepEqual(nomesSeg(fases, 4), []);
    assert.deepEqual(nomesSeg(fases, 5), ['Arquivo']);
});

test('mermaid: ida e volta preservam o fluxo de todos os modelos', () => {
    for (const m of modelosDeRito()) {
        const volta = ritoDeMermaid(ritoParaMermaid(m.fases)).fases;
        assert.equal(volta.length, m.fases.length, m.nome);
        assert.deepEqual(volta.map((f) => [f.nome, f.prazo_dias]), m.fases.map((f) => [f.nome, f.prazo_dias]));
        m.fases.forEach((f, i) => assert.deepEqual(nomesSeg(volta, i), nomesSeg(m.fases, i), `${m.nome}: ${f.nome}`));
    }
});

test('níveis do diagrama: ramos lado a lado, voltas não empurram, inalcançáveis ao fim', () => {
    const fases = simplificar([
        { id: 'a', nome: 'A', proximas: ['b', 'c'] }, { id: 'b', nome: 'B', proximas: ['a'] },
        { id: 'c', nome: 'C', final: true }, { id: 'd', nome: 'D' },
    ]);
    const n = niveisDoFluxo(fases);
    assert.deepEqual([...n.entries()], [['a', 0], ['b', 1], ['c', 1], ['d', 2]]);
    // Fase que fecha dois ramos de tamanhos diferentes fica abaixo do mais longo.
    const m = modelosDeRito()[2].fases;
    const nm = niveisDoFluxo(m);
    const nv = (nome) => nm.get(m.find((f) => f.nome === nome).id);
    assert.ok(nv('Arquivamento') > nv('Julgamento do recurso'));
    assert.equal(nv('Recurso'), nv('Decisão') + 1);
});

test('modelos têm ids únicos e fluxo válido', () => {
    for (const m of modelosDeRito()) {
        const ids = new Set(m.fases.map((f) => f.id));
        assert.equal(ids.size, m.fases.length);
        m.fases.forEach((f) => (f.proximas || []).forEach((p) => assert.ok(ids.has(p), `${m.nome}: ${f.nome}`)));
    }
});
