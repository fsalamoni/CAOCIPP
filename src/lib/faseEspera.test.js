// Fase de espera no editor e nas telas (espelho de functions-v2/test/faseEspera.test.js). npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { copiarFases, ehEspera, niveisDoFluxo, origensDaEspera, problemasDoFluxo, saidasDoProcesso, seguintes, simplificar } from './secretariaRito.js';
import { saidasDaFase } from './exigencias.js';
import { desenharFluxo } from './fluxoBpmn.js';
import { resumoAndamento } from './andamentoFase.js';

const fases = [
    { id: 'rec', nome: 'Recebimento' },
    { id: 'anl', nome: 'Análise', proximas: ['rev', 'dil'] },
    { id: 'rev', nome: 'Revisão', proximas: ['dev', 'dil'] },
    { id: 'dev', nome: 'Devolução' },
    { id: 'dil', nome: 'Diligências externas', espera: true },
    { id: 'arq', nome: 'Arquivamento', final: true },
];
const idx = (id) => fases.findIndex((f) => f.id === id);

test('fase de espera: a seguinte da lista pula a espera e a espera volta para quem leva a ela', () => {
    assert.equal(ehEspera(fases, idx('dil')), true);
    assert.equal(ehEspera([{ id: 'a', espera: true }], 0), false, 'a primeira fase nunca é de espera');
    assert.deepEqual(seguintes(fases, idx('dev')), ['arq']);
    assert.deepEqual(seguintes(fases, idx('dil')), ['anl', 'rev']);
    assert.deepEqual(origensDaEspera(fases, 'dil'), ['anl', 'rev']);
    assert.deepEqual(saidasDaFase(fases, fases[idx('dev')]).map((f) => f.id), ['arq']);
    assert.deepEqual(saidasDaFase(fases, fases[idx('dil')]).map((f) => f.id), ['anl', 'rev']);
    assert.deepEqual(problemasDoFluxo(fases), { soltas: [], presas: [] });
    const solta = fases.map((f) => ({ ...f, proximas: (f.proximas || []).filter((id) => id !== 'dil') }));
    assert.deepEqual(problemasDoFluxo(solta).soltas, ['dil'], 'espera a que nenhuma fase leva fica solta');
});

test('fase de espera: saídas do processo, na fase comum e durante a espera', () => {
    const p = { fases, fase_atual: 'anl' };
    const s = saidasDoProcesso(p);
    assert.deepEqual([s.caminho.map((f) => f.id), s.esperas.map((f) => f.id), s.volta], [['rev'], ['dil'], null]);
    const e = saidasDoProcesso({ fases, fase_atual: 'dil', espera: { fase: 'rev', unidade: 'gab' } });
    assert.deepEqual([e.caminho.map((f) => f.id), e.esperas, e.volta?.id], [['rev'], [], 'rev']);
    const semOrigem = saidasDoProcesso({ fases, fase_atual: 'dil' });
    assert.deepEqual([semOrigem.caminho, semOrigem.volta], [[], null]);
});

test('fase de espera: simplificar, copiar, desenho e resumo', () => {
    const simples = simplificar(fases.map((f) => (f.id === 'dev' ? { ...f, proximas: ['arq'] } : f.id === 'dil' ? { ...f, proximas: ['anl'] } : f)));
    assert.equal(simples[idx('dev')].proximas, undefined, 'Devolução → Arquivamento é a seguinte da lista (pulando a espera)');
    assert.equal(simples[idx('dil')].proximas, undefined, 'a espera não guarda saídas');
    assert.equal(simples[idx('dil')].espera, true);
    const copias = copiarFases(fases, new Set(), fases);
    const c = copias[idx('dil')];
    assert.equal(c.espera, true);
    assert.equal(c.proximas, undefined);
    assert.equal(c.final, undefined, 'a cópia da espera não vira final');
    assert.ok(copias[idx('anl')].proximas.includes(c.id));
    const nivel = niveisDoFluxo(fases);
    assert.ok(nivel.get('dil') > nivel.get('rev'), 'a espera fica depois de quem leva a ela');
    assert.ok(nivel.get('arq') > nivel.get('dev'));
    const d = desenharFluxo(fases);
    const voltas = d.setas.filter((x) => x.de === 'dil' && x.para !== 'dil');
    assert.deepEqual(voltas.map((x) => [x.para, x.tipo, x.rotulo]), [['anl', 'volta', 'volta'], ['rev', 'volta', 'volta']]);
    assert.ok(!d.fins.some((x) => x.id === 'dil'), 'a espera não é fim do fluxo');
    assert.deepEqual(resumoAndamento({ espera: true, avanco: 'auto' }), ['é de espera: ao concluir, o processo volta para a fase de onde veio', 'volta sozinha ao cumprir o que a fase exige']);
});
