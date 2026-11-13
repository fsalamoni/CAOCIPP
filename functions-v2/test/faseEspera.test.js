// Fase de espera (ex.: diligência externa): entra por saída escrita e volta
// para a fase de onde o processo veio. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');

const rito = (fases) => s.sanitizeRito({ nome: 'R', fases }).fases;
const consultas = () => rito([
    { id: 'rec', nome: 'Recebimento' },
    { id: 'anl', nome: 'Análise', proximas: ['rev', 'dil'], avanco: 'auto' },
    { id: 'rev', nome: 'Revisão', proximas: ['dev', 'dil'] },
    { id: 'dev', nome: 'Devolução' },
    { id: 'dil', nome: 'Diligências externas', espera: true, proximas: ['rec'], final: false, avanco: 'auto', condicoes: { rec: 'x' } },
    { id: 'arq', nome: 'Arquivamento', final: true },
]);
const nomes = (fs) => fs.map((f) => f.nome);

test('rito: a fase de espera não guarda saídas; nunca é a primeira nem a final', () => {
    const fases = consultas();
    const dil = fases.find((f) => f.id === 'dil');
    assert.equal(dil.espera, true);
    assert.equal(dil.proximas, undefined, 'a volta depende de onde o processo veio');
    assert.equal(dil.condicoes, undefined);
    assert.equal(dil.avanco, 'auto', 'pode voltar sozinha ao cumprir as obrigatórias');
    const [a, b] = rito([{ nome: 'A', espera: true }, { nome: 'B', espera: true, final: true }]);
    assert.equal(a.espera, undefined, 'a primeira fase não pode ser de espera');
    assert.equal(b.espera, undefined, 'fase final não é de espera');
    assert.equal(b.final, true);
});

test('saídas: a seguinte da lista pula a fase de espera; só se entra nela por saída escrita', () => {
    const fases = consultas();
    assert.deepEqual(nomes(s.fasesSeguintes(fases, 'dev')), ['Arquivamento'], 'Devolução segue para Arquivamento, não para a espera');
    assert.deepEqual(nomes(s.fasesSeguintes(fases, 'anl')), ['Revisão', 'Diligências externas']);
    assert.deepEqual(s.fasesSeguintes(fases, 'dil'), [], 'a espera não tem saída no rito');
    assert.equal(s.proximaFase({ nome: 'R', descricao: '', fases }, 'anl').nome, 'Revisão');
    const so = rito([{ nome: 'A' }, { nome: 'Espera', espera: true }]);
    assert.deepEqual(s.fasesSeguintes(so, so[0].id), [], 'sem outra fase depois, A é o fim');
});

test('processo em espera volta para a fase de onde veio', () => {
    const fases = consultas();
    const proc = { fases, fase_atual: 'dil', status: 'em_tramitacao', unidade_atual: 'gab', espera: { fase: 'rev', unidade: 'gab' } };
    assert.deepEqual(nomes(s.saidasDoProcesso(proc)), ['Revisão']);
    assert.deepEqual(nomes(s.saidasDoProcesso({ ...proc, espera: { fase: 'anl', unidade: 'ass' } })), ['Análise']);
    assert.deepEqual(s.saidasDoProcesso({ ...proc, espera: null }), [], 'sem origem guardada, qualquer saída pede motivo');
    assert.deepEqual(s.saidasDoProcesso({ ...proc, espera: { fase: 'sumiu', unidade: 'x' } }), []);
    assert.deepEqual(nomes(s.saidasDoProcesso({ ...proc, fase_atual: 'anl' })), ['Revisão', 'Diligências externas'], 'fora da espera valem as saídas do rito');
});

test('seguir sozinha: a espera não conta como caminho e, cumprida, volta para a origem', () => {
    const fases = consultas();
    const base = { fases, status: 'em_tramitacao', unidade_atual: 'ass' };
    assert.deepEqual(s.saidaAutomatica({ ...base, fase_atual: 'anl' }, ['ass', 'gab']), { fase_id: 'rev' }, 'Análise tem uma saída só de verdade');
    const emEspera = { ...base, fase_atual: 'dil', unidade_atual: 'sec', espera: { fase: 'anl', unidade: 'ass' } };
    assert.deepEqual(s.saidaAutomatica(emEspera, ['ass', 'sec']), { fase_id: 'anl', unidade_destino: 'ass' }, 'volta para a unidade em que estava');
    assert.deepEqual(s.saidaAutomatica({ ...emEspera, unidade_atual: 'ass' }, ['ass']), { fase_id: 'anl' });
    assert.deepEqual(s.saidaAutomatica(emEspera, ['sec']), { fase_id: 'anl' }, 'unidade de origem desativada: volta só a fase');
    assert.equal(s.saidaAutomatica({ ...emEspera, espera: null }, ['ass']), null);
});
