const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizePedido, aplicarCiencia, derivadosComunicacoes, destinatario, limiteCiencia, cienciaDias, textoPrazo } = require('../lib/shared/comunicacoes');

const HOJE = '2026-11-10'; // terça-feira
const base = { especie: 'intimacao', texto: 'Manifeste-se sobre o laudo', partes_idx: [0], dias: 5 };

test('pedido: o prazo precisa ser dito (dias ou "sem prazo")', () => {
    assert.throws(() => sanitizePedido({ ...base, dias: undefined }, HOJE), /prazo em dias/);
    assert.equal(sanitizePedido({ ...base, dias: undefined, sem_prazo: true }, HOJE).dias, 0);
    const p = sanitizePedido({ ...base, partes_idx: [1, 1, 0, -1, 'x'] }, HOJE);
    assert.deepEqual([p.partes_idx, p.dias, p.contagem, p.outro_meio], [[1, 0], 5, 'uteis', '']);
});

test('pedido inválido é recusado com mensagem', () => {
    assert.throws(() => sanitizePedido({ ...base, especie: 'bilhete' }, HOJE), /espécie/);
    assert.throws(() => sanitizePedido({ ...base, texto: ' ' }, HOJE), /Escreva/);
    assert.throws(() => sanitizePedido({ ...base, partes_idx: [] }, HOJE), /destinatário/);
    assert.throws(() => sanitizePedido({ ...base, meio: 'outro' }, HOJE), /qual meio/);
    assert.throws(() => sanitizePedido({ ...base, meio: 'outro', outro_meio: 'Correio', ciencia_data: '2026-11-11' }, HOJE), /até hoje/);
    assert.equal(sanitizePedido({ ...base, meio: 'outro', outro_meio: 'Correio', ciencia_data: '2026-11-09' }, HOJE).ciencia_data, '2026-11-09');
});

const com = (o = {}) => ({
    id: 'c1', especie: 'intimacao', texto: 't', parte_idx: 0, parte_nome: 'Ana', dias: 5, contagem: 'uteis',
    expedida_em: '2026-11-10T12:00:00Z', expedida_por: 'Sec', unidade_id: 'u', limite_ciencia: '2026-11-20', status: 'aguardando', ...o,
});

test('ciência abre o prazo a contar do dia seguinte', () => {
    const r = aplicarCiencia(com(), HOJE, '2026-11-10T15:00:00Z', 'Ana (parte)', 'plataforma', 'p1');
    assert.equal(r.comunicacao.status, 'ciente');
    assert.equal(r.prazo.vence_em, '2026-11-17'); // 5 dias úteis depois de terça, 10/11
    assert.deepEqual([r.prazo.destinatario, r.prazo.comunicacao_id, r.comunicacao.prazo_id], ['Ana', 'c1', 'p1']);
    assert.throws(() => aplicarCiencia(r.comunicacao, HOJE, '', '', 'plataforma', 'p2'), /não está mais aguardando/);
});

test('decurso e comunicação sem prazo', () => {
    const d = aplicarCiencia(com({ contagem: 'corridos' }), HOJE, 'x', 'Sistema', 'decurso', 'p1');
    assert.deepEqual([d.comunicacao.status, d.prazo.vence_em], ['decurso', '2026-11-16']); // dia 15 é domingo: prorroga
    assert.equal(aplicarCiencia(com({ dias: 0 }), HOJE, 'x', 'Ana', 'plataforma', 'p1').prazo, null);
});

test('derivados, destinatário e limite de ciência', () => {
    const l = [com(), com({ id: 'c2', limite_ciencia: '2026-11-15' }), com({ id: 'c3', status: 'ciente', limite_ciencia: '2026-11-01' })];
    assert.deepEqual(derivadosComunicacoes(l), { comunicacoes_aguardando: 2, ciencia_limite: '2026-11-15' });
    assert.deepEqual(derivadosComunicacoes([]), { comunicacoes_aguardando: 0, ciencia_limite: null });
    const partes = [{ uid: 'a', representantes: [{ uid: 'r' }] }, { uid: 'b' }];
    assert.deepEqual(['a', 'r', 'b'].map((u) => destinatario(com(), partes, u)), [true, true, false]);
    assert.deepEqual([limiteCiencia(HOJE, 10), limiteCiencia(HOJE, 0)], ['2026-11-20', null]);
    assert.deepEqual([cienciaDias(undefined), cienciaDias(0), cienciaDias(500), cienciaDias('x')], [10, 0, 90, 10]);
    assert.deepEqual([textoPrazo({ dias: 1, contagem: 'uteis' }), textoPrazo({ dias: 3, contagem: 'corridos' }), textoPrazo({ dias: 0, contagem: 'uteis' })], ['1 dia útil', '3 dias corridos', '']);
});
