// Regras puras da Secretaria Processual. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');

test('cadeia de movimentos detecta adulteração', () => {
    const movs = [];
    let anterior = '';
    for (let seq = 1; seq <= 3; seq++) {
        const m = { seq, tipo: 't', descricao: `m${seq}`, autor_uid: 'u', autor_nome: 'U', unidade_id: 'a', em: '2026-01-01T00:00:00Z', dados: { x: seq }, hash_anterior: anterior };
        m.hash = s.hashMovimento(m);
        anterior = m.hash;
        movs.push(m);
    }
    assert.equal(s.verificarCadeia(movs), null);
    movs[1].descricao = 'alterado';
    assert.equal(s.verificarCadeia(movs), 2);
});

test('jsonCanonico independe da ordem das chaves', () => {
    assert.equal(s.jsonCanonico({ b: 1, a: { d: 2, c: 3 } }), s.jsonCanonico({ a: { c: 3, d: 2 }, b: 1 }));
});

test('acesso: posse, sigilo restrito e admin', () => {
    const proc = { unidade_atual: 'sec', unidades_historico: ['sec'], sigilo: 'restrito' };
    const lotadoSec = { uid: 'u', isAdmin: false, unidadeIds: ['sec'] };
    const lotadoGab = { uid: 'v', isAdmin: false, unidadeIds: ['gab'] };
    const semLotacao = { uid: 'w', isAdmin: false, unidadeIds: [] };
    assert.ok(s.podeAgir(proc, lotadoSec));
    assert.ok(!s.podeAgir(proc, lotadoGab));
    assert.ok(!s.podeVer(proc, lotadoGab));
    assert.ok(s.podeVer({ ...proc, sigilo: 'normal' }, lotadoGab));
    assert.ok(!s.podeVer({ ...proc, sigilo: 'normal' }, semLotacao));
    assert.ok(s.podeVer(proc, { uid: 'x', isAdmin: true, unidadeIds: [] }));
});

test('rito: saneamento e fase seguinte', () => {
    const r = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'Autuação' }, { nome: 'Autuação' }, { nome: 'Fim', prazo_dias: 10 }] });
    assert.deepEqual(r.fases.map((f) => f.id), ['autuacao', 'autuacao_1', 'fim']);
    assert.equal(r.fases[2].prazo_dias, 10);
    assert.equal(s.proximaFase(r, 'autuacao').id, 'autuacao_1');
    assert.equal(s.proximaFase(r, 'fim'), null);
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [] }));
});

test('delta do editor descarta embeds e atributos fora da lista', () => {
    const ops = s.sanitizeDelta({ ops: [
        { insert: 'Olá ', attributes: { bold: true, script: 'x', link: 'javascript:alert(1)' } },
        { insert: { image: 'data:...' } },
        { insert: 'mundo\n', attributes: { header: 9 } },
    ] });
    assert.deepEqual(ops, [{ insert: 'Olá ', attributes: { bold: true } }, { insert: 'mundo\n' }]);
    assert.equal(s.deltaParaTexto(ops), 'Olá mundo\n');
});

test('Páscoa e feriados móveis', () => {
    assert.equal(s.pascoa(2026).toISOString().slice(0, 10), '2026-04-05');
    assert.equal(s.pascoa(2027).toISOString().slice(0, 10), '2027-03-28');
    const f = s.feriadosNacionais(2026);
    for (const d of ['2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04', '2026-11-20', '2026-12-25']) assert.ok(f.has(d), d);
});

test('vencimento de prazos (CPC art. 224)', () => {
    // Sexta 06/11/2026 + 5 úteis: 09,10,11,12,13 -> sexta 13/11.
    assert.equal(s.calcularVencimento('2026-11-06', 5, 'uteis'), '2026-11-13');
    // Feriado de 20/11 (sexta) pula: quinta 19/11 + 1 útil -> segunda 23/11.
    assert.equal(s.calcularVencimento('2026-11-19', 1, 'uteis'), '2026-11-23');
    // Corridos que caem no sábado prorrogam para segunda.
    assert.equal(s.calcularVencimento('2026-11-04', 3, 'corridos'), '2026-11-09');
    // Corridos atravessando fim de semana sem cair nele.
    assert.equal(s.calcularVencimento('2026-11-06', 5, 'corridos'), '2026-11-11');
});

test('derivados de pendências e prazos', () => {
    const d = s.derivados(
        [{ id: 'a', status: 'aberta', interrompe: false }, { id: 'b', status: 'aberta', interrompe: true }, { id: 'c', status: 'resolvida', interrompe: true }],
        [{ id: 'x', status: 'aberto', vence_em: '2026-12-01' }, { id: 'y', status: 'aberto', vence_em: '2026-11-20' }, { id: 'z', status: 'cumprido', vence_em: '2026-01-01' }],
    );
    assert.deepEqual(d, { pendencias_abertas: 2, fase_suspensa: true, proximo_vencimento: '2026-11-20' });
});

test('número do processo', () => {
    assert.equal(s.numeroProcesso(2026, 42), '000042/2026');
});
