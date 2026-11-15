const test = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeDadosSessao, sanitizeRegrasSessao, dataMinimaDaSessao, problemaDaAntecedencia, julgamentoPendente, textoDaInclusao, textoDaRetirada, reordenar,
} = require('../lib/shared/sessoes');
const { sanitizeOrgao } = require('../lib/shared/orgaos');

test('sessão: dados conferidos, título padrão e modo decide local e link', () => {
    assert.throws(() => sanitizeDadosSessao({ hora: '14:00', local: 'Sala' }), /data da sessão/);
    assert.throws(() => sanitizeDadosSessao({ data: '2026-12-01', hora: '25:00', local: 'Sala' }), /hora da sessão/);
    assert.throws(() => sanitizeDadosSessao({ data: '2026-12-01', hora: '14:00' }), /local da sessão/);
    assert.throws(() => sanitizeDadosSessao({ data: '2026-12-01', hora: '14:00', modo: 'virtual' }), /link ou a sala virtual/);
    const s = sanitizeDadosSessao({ data: '2026-12-01', hora: '14:00', local: 'Sala 2', link: 'https://x', modo: 'presencial' });
    assert.equal(s.titulo, 'Sessão ordinária de 01/12/2026');
    assert.equal(s.link, '', 'presencial não guarda link');
    const v = sanitizeDadosSessao({ data: '2026-12-01', hora: '09:30', local: 'Sala', link: 'https://meet', modo: 'virtual', carater: 'extraordinaria' });
    assert.equal(v.local, '');
    assert.equal(v.titulo, 'Sessão extraordinária de 01/12/2026');
});

test('sessão: antecedência do colegiado (ausente = sem mínimo)', () => {
    assert.deepEqual(sanitizeRegrasSessao(undefined), { antecedencia: 0, contagem: 'uteis' });
    assert.deepEqual(sanitizeRegrasSessao({ antecedencia: 999, contagem: 'corridos' }), { antecedencia: 60, contagem: 'corridos' });
    assert.equal(sanitizeOrgao({ nome: 'Conselho', decisao: 'colegiada' }, 'c').pauta.antecedencia, 0, 'órgão antigo fica sem regra');
    const sem = { antecedencia: 0, contagem: 'uteis' };
    assert.equal(problemaDaAntecedencia('2026-11-16', '2026-11-16', sem), '');
    assert.match(problemaDaAntecedencia('2026-11-16', '2026-11-15', sem), /já passou/);
    // Segunda, 16/11/2026: 5 dias úteis, pulando o fim de semana e o feriado de 20/11, vencem em 24/11.
    const uteis = { antecedencia: 5, contagem: 'uteis' };
    assert.equal(dataMinimaDaSessao('2026-11-16', uteis), '2026-11-24');
    assert.match(problemaDaAntecedencia('2026-11-16', '2026-11-20', uteis), /5 dias úteis.*a partir de 24\/11\/2026.*extrapauta ou em mesa/);
    assert.equal(problemaDaAntecedencia('2026-11-16', '2026-11-24', uteis), '');
    assert.equal(dataMinimaDaSessao('2026-11-16', { antecedencia: 3, contagem: 'corridos' }), '2026-11-19');
});

test('pauta: apto só com julgamento pendente e ativo na fase atual, em tramitação', () => {
    const fase = { id: 'f1', nome: 'Julgamento', acoes: ['Relatar', 'Julgar'], acoes_regras: [null, { pede: 'julgamento' }] };
    const proc = { status: 'em_tramitacao', fase_atual: 'f1', fases: [fase], acoes_feitas: {} };
    assert.equal(julgamentoPendente(proc), 1);
    assert.equal(julgamentoPendente({ ...proc, acoes_feitas: { f1: [1] } }), -1, 'já julgado');
    assert.equal(julgamentoPendente({ ...proc, status: 'arquivado' }), -1);
    assert.equal(julgamentoPendente({ ...proc, fase_atual: 'outra' }), -1);
    assert.equal(julgamentoPendente({ ...proc, fases: [{ ...fase, acoes_regras: [null, null] }] }), -1, 'fase sem julgamento');
});

test('pauta: certidões de inclusão e retirada, e a ordem do dia', () => {
    const s = sanitizeDadosSessao({ data: '2026-12-01', hora: '14:00', local: 'Sala 2', modo: 'hibrida', link: 'https://sala' });
    assert.equal(textoDaInclusao(s, 'Conselho de Ética', { inclusao: 'pauta', motivo: '' }),
        'Incluído em pauta para julgamento na Sessão ordinária de 01/12/2026 do Conselho de Ética, em 01/12/2026, às 14:00, em Sala 2 e por videoconferência (https://sala).');
    assert.match(textoDaInclusao(s, '', { inclusao: 'mesa', motivo: 'urgência' }), /^Apresentado em mesa .* Motivo: urgência\.$/);
    assert.equal(textoDaRetirada(s, 'pedido do relator'), 'Retirado da pauta da Sessão ordinária de 01/12/2026, de 01/12/2026. Motivo: pedido do relator.');
    assert.match(textoDaRetirada(s, 'feriado', true), /foi cancelada, e o processo saiu da pauta\. Motivo: feriado\./);
    const pauta = ['a', 'b', 'c'].map((id, i) => ({ processo_id: id, ordem: i + 1 }));
    assert.deepEqual(reordenar(pauta, ['c', 'a']).map((x) => [x.processo_id, x.ordem]), [['c', 1], ['a', 2], ['b', 3]]);
});
