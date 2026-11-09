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
    // Quem é parte no processo não o vê nem age como equipe, nem sendo admin.
    const comParte = { ...proc, sigilo: 'normal', partes_uids: ['p1'] };
    assert.ok(s.ehParte(comParte, 'p1'));
    assert.ok(!s.podeVer(comParte, { uid: 'p1', isAdmin: true, unidadeIds: ['sec'] }));
    assert.ok(!s.podeAgir(comParte, { uid: 'p1', isAdmin: false, unidadeIds: ['sec'] }));
    assert.ok(s.podeVer(comParte, { uid: 'outro', isAdmin: false, unidadeIds: ['sec'] }));
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

test('rito com ramificações: próximas por id do cliente, orientação e validação', () => {
    const r = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'tmp1', nome: 'Análise', orientacao: 'Conferir documentos', proximas: ['tmp3', 'tmp2'] },
        { id: 'tmp2', nome: 'Diligência', proximas: ['tmp1'] },
        { id: 'tmp3', nome: 'Decisão' },
    ] });
    assert.deepEqual(r.fases.map((f) => f.id), ['tmp1', 'tmp2', 'tmp3']);
    assert.deepEqual(r.fases[0].proximas, ['tmp3', 'tmp2']);
    assert.equal(r.fases[0].orientacao, 'Conferir documentos');
    assert.deepEqual(s.fasesSeguintes(r.fases, 'tmp1').map((f) => f.nome), ['Decisão', 'Diligência']);
    assert.deepEqual(s.fasesSeguintes(r.fases, 'tmp2').map((f) => f.nome), ['Análise']);
    assert.deepEqual(s.fasesSeguintes(r.fases, 'tmp3'), []);
    const r3 = s.sanitizeRito({ nome: 'R', fases: [{ id: 'a', nome: 'A', proximas: ['c', 'b'] }, { id: 'b', nome: 'B', final: true, proximas: ['c'] }, { id: 'c', nome: 'C' }] });
    assert.equal(r3.fases[1].final, true);
    assert.equal(r3.fases[1].proximas, undefined);
    assert.deepEqual(s.fasesSeguintes(r3.fases, 'b'), []);
    assert.equal(s.proximaFase(r, 'tmp1').nome, 'Decisão');
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ id: 'a', nome: 'A', proximas: ['zz'] }] }), /não existe/);
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ id: 'a', nome: 'A', proximas: ['a'] }] }), /ela mesma/);
    // Ids com caracteres estranhos viram slug, e as referências acompanham.
    const r2 = s.sanitizeRito({ nome: 'R', fases: [{ id: 'Nova Fase!', nome: 'A', proximas: ['X/Y'] }, { id: 'X/Y', nome: 'B' }] });
    assert.deepEqual(r2.fases.map((f) => f.id), ['nova_fase', 'x_y']);
    assert.deepEqual(r2.fases[0].proximas, ['x_y']);
});

test('número do processo', () => {
    assert.equal(s.numeroProcesso(2026, 42), '000042/2026');
});

test('unidades: tipos, lotações e migração de membros_uids', () => {
    assert.equal(s.tipoUnidade('assessoria'), 'assessoria');
    assert.equal(s.tipoUnidade('xyz'), 'secretaria');
    const l = s.sanitizeLotacoes([{ uid: 'a', atribuicao: ' Chefe ', gestor: true }, { uid: 'a' }, { uid: '' }, 'lixo', { uid: 'b', gestor: 'sim' }]);
    assert.deepEqual(l, [{ uid: 'a', atribuicao: 'Chefe', gestor: true }, { uid: 'b', atribuicao: '', gestor: false }]);
    // Unidade antiga (só membros_uids) vira lotações sem atribuição nem gestão.
    assert.deepEqual(s.lotacoesDe({ membros_uids: ['x', 'y'] }), [{ uid: 'x', atribuicao: '', gestor: false }, { uid: 'y', atribuicao: '', gestor: false }]);
    assert.deepEqual(s.lotacoesDe({ lotacoes: [{ uid: 'z', gestor: true }], membros_uids: ['x'] }), [{ uid: 'z', atribuicao: '', gestor: true }]);
});

test('timbrado efetivo: próprio da unidade ou do órgão; tipos somados', () => {
    const orgao = { cabecalho_linhas: ['MP'], rodape: 'R', tipos_documento: ['Despacho', 'Ofício'] };
    assert.deepEqual(s.documentoEfetivo(orgao, null), orgao);
    const herdado = s.documentoEfetivo(orgao, { timbrado_proprio: false, documento: { cabecalho_linhas: ['Gab'] }, tipos_documento: ['Parecer', 'Ofício'] });
    assert.deepEqual(herdado.cabecalho_linhas, ['MP']);
    assert.deepEqual(herdado.tipos_documento, ['Despacho', 'Ofício', 'Parecer']);
    const proprio = s.documentoEfetivo(orgao, { timbrado_proprio: true, documento: { cabecalho_linhas: ['Gab'], tipos_documento: [] } });
    assert.deepEqual(proprio.cabecalho_linhas, ['Gab']);
    assert.deepEqual(proprio.tipos_documento, ['Despacho', 'Ofício']);
});
