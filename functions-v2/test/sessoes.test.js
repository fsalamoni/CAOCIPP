const test = require('node:test');
const assert = require('node:assert/strict');
const {
    sanitizeDadosSessao, sanitizeRegrasSessao, dataMinimaDaSessao, problemaDaAntecedencia, julgamentoPendente, textoDaInclusao, textoDaRetirada, reordenar,
} = require('../lib/shared/sessoes');
const { sanitizeOrgao } = require('../lib/shared/orgaos');
const { leituraDeJulgador } = require('../lib/shared/sessoes');

test('leitura do julgador: pautado no colegiado que compõe; julgado, enquanto segue no colegiado', () => {
    const orgao = (u) => ({ uC: 'c', uX: 'x' })[u] || null;
    const base = { status: 'em_tramitacao', unidade_atual: 'uC' };
    assert.equal(leituraDeJulgador({ ...base, sessao: { orgao_id: 'c' } }, ['c'], orgao), true);
    assert.equal(leituraDeJulgador({ ...base, sessao: { orgao_id: 'c' } }, ['outro'], orgao), false, 'não compõe');
    assert.equal(leituraDeJulgador({ ...base }, ['c'], orgao), false, 'sem pauta, nada');
    assert.equal(leituraDeJulgador({ ...base, ultima_sessao: { orgao_id: 'c' } }, ['c'], orgao), true, 'julgado, o acórdão segue no colegiado');
    assert.equal(leituraDeJulgador({ ...base, unidade_atual: 'uX', ultima_sessao: { orgao_id: 'c' } }, ['c'], orgao), false, 'saiu do colegiado');
    assert.equal(leituraDeJulgador({ ...base, status: 'arquivado', ultima_sessao: { orgao_id: 'c' } }, ['c'], orgao), false, 'arquivado');
});

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

test('votação na sessão: quem vota, voto do vogal, votos para o registro e placar', () => {
    const { votantes, sanitizeVoto, votosDaSessao, placarParcial } = require('../lib/shared/sessoes');
    const { dadosDoJulgamento, textoDoJulgamento } = require('../lib/shared/julgamento');
    const comp = [{ uid: 'p', funcao: 'presidente' }, { uid: 'r', funcao: 'titular' }, { uid: 't', funcao: 'titular' }, { uid: 's', funcao: 'suplente' }, { uid: 'v', funcao: 'titular', fim: '2020-01-01' }];
    const m = votantes(comp, '2026-11-20', (u) => ({ p: 'Pres', r: 'Rel', t: 'Tit' })[u] || '');
    assert.deepEqual(m.map((x) => `${x.uid}:${x.funcao}`), ['p:presidente', 'r:membro', 't:membro'], 'suplente e mandato encerrado não votam');
    const R = ['Procedente', 'Improcedente'];
    assert.deepEqual(sanitizeVoto({ modo: 'acompanha', nota: 'x' }, R, 'Procedente'), { modo: 'acompanha', resultado: 'Procedente', nota: '' });
    assert.throws(() => sanitizeVoto({ modo: 'diverge', resultado: 'Procedente' }, R, 'Procedente'), /acompanhe o relator/);
    assert.throws(() => sanitizeVoto({ modo: 'ressalva' }, R, 'Procedente'), /ressalva/);
    assert.throws(() => sanitizeVoto({ modo: 'outro' }, R, 'Procedente'), /Escolha como vota/);
    assert.equal(sanitizeVoto({ modo: 'impedido' }, R, 'Procedente').resultado, '');
    const v = { relator_uid: 'r', relator_nome: 'Rel', resultado: 'Procedente', votos: { p: { nome: 'Pres', modo: 'diverge', resultado: 'Improcedente' } } };
    const votos = votosDaSessao(v, m);
    assert.deepEqual(votos.map((x) => `${x.nome}:${x.funcao}:${x.voto}`), ['Rel:relator:Procedente', 'Pres:presidente:Improcedente', 'Tit:membro:ausente'], 'quem não votou fica ausente');
    assert.deepEqual(placarParcial(R, votos), [['Procedente', 1], ['Improcedente', 1]]);
    const cfg = { resultados: R, desempate: 'presidente' };
    assert.match(textoDoJulgamento(cfg, dadosDoJulgamento(cfg, { data: '2026-11-20', votos }, '2026-11-20')), /^Improcedente, pelo voto de desempate do presidente \(1 a 1\).*Ausente: Tit/);
});

test('vista, adiamento e diligência: prazo do colegiado e certidões (S5)', () => {
    const { prazoDaVista, textoDaVista, textoDaDevolucao, textoDoAdiamento, textoDaDiligencia } = require('../lib/shared/sessoes');
    // Ausente = 10 dias (padrão do CPC); só se guarda o que difere.
    assert.equal(sanitizeRegrasSessao({ antecedencia: 2, vista_dias: 10 }).vista_dias, undefined);
    assert.equal(sanitizeRegrasSessao({ vista_dias: 15 }).vista_dias, 15);
    assert.equal(sanitizeRegrasSessao({ vista_dias: 500 }).vista_dias, undefined);
    assert.equal(prazoDaVista('2026-11-16', { antecedencia: 0, contagem: 'corridos' }), '2026-11-26');
    assert.equal(prazoDaVista('2026-11-16', { antecedencia: 0, contagem: 'corridos', vista_dias: 3 }), '2026-11-19');
    const s = { titulo: '1ª Sessão Ordinária', data: '2026-11-16' };
    assert.match(textoDaVista(s, ['Ana', 'Bruno'], '2026-11-26'), /^Pedido de vista por Ana e Bruno na 1ª Sessão Ordinária, de 16\/11\/2026\. .*até 26\/11\/2026\.$/);
    assert.match(textoDaDevolucao(['Ana'], { titulo: '2ª Sessão', data: '2026-12-01' }), /continua na 2ª Sessão, de 01\/12\/2026\.$/);
    assert.match(textoDaDevolucao(['Ana'], null), /próxima sessão do colegiado\.$/);
    assert.match(textoDoAdiamento(s, 'falta de quórum'), /Motivo: falta de quórum\.$/);
    assert.match(textoDaDiligencia(s, 'Ouvir a testemunha indicada.'), /em diligência .*: Ouvir a testemunha indicada\.$/);
});
