const test = require('node:test');
const assert = require('node:assert/strict');
const { ajustarPrazo, ajustarComunicacao, MAX_AJUSTES } = require('../lib/shared/ajustePrazo');

const quem = { em: '2026-11-14T12:00:00Z', por: 'Hugo' };
// 2026-11-20 é sexta; 2026-11-23, segunda.
const pz = { id: 'p1', descricao: 'Responder à citação', destinatario: 'Maria', dias: 10, contagem: 'uteis', vence_em: '2026-11-20', status: 'aberto' };

test('prorrogar soma dias úteis ao vencimento e guarda a história', () => {
    const r = ajustarPrazo(pz, 'prorrogacao', 5, 'Pedido deferido', '2026-11-14', undefined, quem);
    assert.equal(r.prazo.vence_em, '2026-11-27');
    assert.deepEqual(r.prazo.ajustes, [{ tipo: 'prorrogacao', dias: 5, de: '2026-11-20', para: '2026-11-27', motivo: 'Pedido deferido', ...quem }]);
    assert.equal(r.texto, 'Prazo prorrogado por 5 dias úteis: Responder à citação (Maria). Vencia em 20/11/2026; passa a vencer em 27/11/2026. Motivo: Pedido deferido');
});

test('devolver corre de novo a contar de hoje; só depois do vencimento', () => {
    const r = ajustarPrazo(pz, 'devolucao', 1, 'Sistema fora do ar', '2026-11-23', undefined, quem);
    assert.equal(r.prazo.vence_em, '2026-11-24');
    assert.match(r.texto, /^Prazo devolvido: Responder à citação \(Maria\), vencido em 20\/11\/2026\. Corre de novo por 1 dia útil, a contar de hoje, e vence em 24\/11\/2026\./);
    assert.throws(() => ajustarPrazo(pz, 'devolucao', 5, 'x', '2026-11-20', undefined, quem), /ainda corre/);
    assert.throws(() => ajustarPrazo(pz, 'prorrogacao', 5, 'x', '2026-11-21', undefined, quem), /já venceu/);
});

test('recusas: dias, motivo, prazo encerrado e limite de ajustes', () => {
    assert.throws(() => ajustarPrazo(pz, 'prorrogacao', 0, 'x', '2026-11-14', undefined, quem), /dias/);
    assert.throws(() => ajustarPrazo(pz, 'prorrogacao', 5, '', '2026-11-14', undefined, quem), /motivo/);
    assert.throws(() => ajustarPrazo({ ...pz, status: 'cumprido' }, 'prorrogacao', 5, 'x', '2026-11-14', undefined, quem), /Só prazo aberto/);
    const cheio = { ...pz, ajustes: Array.from({ length: MAX_AJUSTES }, () => ({})) };
    assert.throws(() => ajustarPrazo(cheio, 'prorrogacao', 5, 'x', '2026-11-14', undefined, quem), /ajustes/);
});

test('a comunicação acompanha; a devolução tira o decurso e reabre a espera do rito', () => {
    const fase = { id: 'f1', acoes_regras: [{ pede: 'comunicacao' }, { pede: 'resposta', resposta: { de: 0 } }] };
    const proc = {
        comunicacoes: [{ id: 'c1', prazo_id: 'p1', fase_id: 'f1', acao_idx: 0, vence_em: '2026-11-20', decurso_certificado: '2026-11-21' }, { id: 'c2', prazo_id: 'p2' }],
        acoes_feitas: { f1: [0, 1] }, acoes_respostas: { f1: { 1: 'Sem manifestação' } },
    };
    const pr = ajustarComunicacao(proc, 'p1', '2026-11-27', 'prorrogacao', fase);
    assert.equal(pr.comunicacoes[0].vence_em, '2026-11-27');
    assert.equal(pr.comunicacoes[0].decurso_certificado, '2026-11-21');
    assert.equal(pr.acoes_feitas, undefined);
    const dv = ajustarComunicacao(proc, 'p1', '2026-11-30', 'devolucao', fase);
    assert.equal(dv.comunicacoes[0].decurso_certificado, undefined);
    assert.equal(dv.comunicacoes[0].vence_em, '2026-11-30');
    assert.deepEqual(dv.reabertas, [1]);
    assert.deepEqual(dv.acoes_feitas, { f1: [0] });
    assert.deepEqual(dv.acoes_respostas, { f1: {} });
    // Já respondida, ou de outra rodada: só o vencimento muda.
    const resp = ajustarComunicacao({ ...proc, comunicacoes: [{ ...proc.comunicacoes[0], respondida_em: 'x' }] }, 'p1', '2026-11-30', 'devolucao', fase);
    assert.deepEqual(resp.reabertas, []);
    assert.equal(ajustarComunicacao(proc, 'p9', '2026-11-30', 'devolucao', fase), null);
});
