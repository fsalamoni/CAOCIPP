// Fase de elaboração (a minuta entra sozinha e segue) e exclusão dos autos
// (desentranhamento e ato sem efeito). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const x = require('../lib/shared/exigencias');
const a = require('../lib/shared/autos');

const fase = (extra) => s.sanitizeRito({ nome: 'R', fases: [
    { id: 'f1', nome: 'Análise', acoes: ['Minuta'], acoes_regras: [{ documento: { forma: 'qualquer', tipo: 'Parecer' } }], proximas: ['f2'], ...extra },
    { id: 'f2', nome: 'Fim', final: true },
] }).fases[0];

test('elaboração: o rito guarda a marca, mas não com o Finalizar nem na fase final', () => {
    assert.equal(fase({ elaboracao: true }).elaboracao, true);
    assert.equal(fase({ elaboracao: true, juntada_conjunta: true }).elaboracao, undefined);
    assert.equal(fase({}).elaboracao, undefined);
    const fim = s.sanitizeRito({ nome: 'R', fases: [{ id: 'f', nome: 'Fim', final: true, elaboracao: true }] }).fases[0];
    assert.equal(fim.elaboracao, undefined);
});

test('elaboração: a minuta cumpre o documento da ação; excluída, volta a faltar', () => {
    const f = fase({ elaboracao: true });
    const pend = x.pendentesDaFase(f, {}, {});
    const parecer = { titulo: 'Parecer', tipo: 'Parecer', origem: 'editor' };
    const e = x.cumpridaPelaMinuta(pend, parecer);
    assert.ok(e, 'o parecer cumpre');
    assert.equal(x.cumpridaPelaMinuta(pend, { titulo: 'Ofício', tipo: 'Ofício', origem: 'editor' }), null, 'outro tipo não cumpre');
    const proc = { fases: [f], fase_atual: 'f1', ...x.camposDoCumprimento({}, 'f1', [e], 'doc1', null) };
    assert.equal(x.pendentesDaFase(f, proc.exigencias_cumpridas, {}).length, 0);
    const desfeito = x.semCumprimentoDaMinuta(proc, 'f1', 'doc1');
    assert.equal(x.pendentesDaFase(f, desfeito.exigencias_cumpridas, {}).length, 1);
    assert.deepEqual(x.semCumprimentoDaMinuta(proc, 'f1', 'outro'), {});
});

test('exclusão dos autos: quem pode', () => {
    const ato = { autor_uid: 'u1', unidade_id: 'un1' };
    assert.equal(a.podeExcluirDosAutos({ uid: 'u1' }, ato), true, 'quem praticou');
    assert.equal(a.podeExcluirDosAutos({ uid: 'u2', gestorDe: ['un1'] }, ato), true, 'gestor da unidade');
    assert.equal(a.podeExcluirDosAutos({ uid: 'u2', isAdmin: true }, ato), true, 'admin');
    assert.equal(a.podeExcluirDosAutos({ uid: 'u2', decisorComPosse: true }, ato), true, 'quem decide, com o processo');
    assert.equal(a.podeExcluirDosAutos({ uid: 'u2', gestorDe: ['un9'] }, ato), false, 'outro');
});

test('ato sem efeito: o que pode, a marca e a numeração sem saltos', () => {
    assert.equal(a.podeFicarSemEfeito({ seq: 1, tipo: 'autuacao' }), false);
    assert.equal(a.podeFicarSemEfeito({ seq: 2, tipo: 'tramitacao' }), false);
    assert.equal(a.podeFicarSemEfeito({ seq: 3, tipo: 'juntada', dados: { documento_id: 'd', ordem: 1 } }), false, 'documento sai por desentranhamento');
    assert.equal(a.podeFicarSemEfeito({ seq: 4, tipo: 'acao_fase', dados: { nos_autos: true } }), true);
    const movs = [
        { seq: 1, tipo: 'autuacao' },
        { seq: 2, tipo: 'acao_fase', dados: { nos_autos: true } },
        { seq: 3, tipo: 'juntada', dados: { documento_id: 'd1', ordem: 1 } },
        { seq: 4, tipo: 'sem_efeito', dados: { alvo_seq: 2 } },
        { seq: 5, tipo: 'desentranhamento', dados: { documento_alvo: 'd1' } },
    ];
    const anulados = a.eventosSemEfeito(movs);
    assert.deepEqual([...anulados], [[2, 4]]);
    const nums = a.numerarEventos(movs);
    assert.deepEqual(movs.map((m) => nums.get(m.seq)), ['1', '2', '3', '4', '5']);
    const docs = new Map([['d1', { folha_inicial: 3, folha_final: 5, desentranhado: { motivo: 'x' } }]]);
    assert.equal(a.extrasDoEvento(movs[1], docs, nums, anulados).sem_efeito, '4');
    assert.equal(a.extrasDoEvento(movs[1], docs, nums, anulados).pode_sem_efeito, false, 'já está sem efeito');
    assert.equal(a.extrasDoEvento(movs[2], docs, nums, anulados).desentranhado, true);
    assert.deepEqual(a.extrasDoEvento(movs[2], docs, nums, anulados).folhas, [3, 5], 'as folhas não mudam');
    assert.equal(a.tituloEvento(movs[4]), 'Termo de desentranhamento');
});
