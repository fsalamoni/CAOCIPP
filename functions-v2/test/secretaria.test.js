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

test('número do processo', () => {
    assert.equal(s.numeroProcesso(2026, 42), '000042/2026');
});
