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

test('acórdão: voto condutor, votos vencidos, declarações e o documento (S6)', () => {
    const { votoCondutor, votosDoAcordao, documentoDoAcordao, prazoDoAcordao, modeloDoAcordao, sanitizeVoto } = require('../lib/shared/sessoes');
    const { sanitizeDoc, docParaTexto: textoPuro } = require('../lib/shared/documento');
    const R = ['Procedente', 'Improcedente'];
    assert.equal(sanitizeVoto({ modo: 'diverge', resultado: 'Improcedente', fundamentos: '  Fundamento longo.  ' }, R, 'Procedente').fundamentos, 'Fundamento longo.');
    assert.equal(sanitizeVoto({ modo: 'acompanha', fundamentos: 'x' }, R, 'Procedente').fundamentos, undefined, 'quem só acompanha não declara voto');
    const v = {
        relator_uid: 'r', relator_nome: 'Rel', resultado: 'Procedente', fundamentos: 'Voto do relator.', votos: {
            b: { nome: 'Bia', modo: 'diverge', resultado: 'Improcedente', nota: '', fundamentos: 'Divergência da Bia.', em: '2026-11-20T10:05', divergiu_em: '2026-11-20T10:01' },
            a: { nome: 'Ana', modo: 'diverge', resultado: 'Improcedente', nota: 'Sem prova.', em: '2026-11-20T10:02', divergiu_em: '2026-11-20T10:02' },
            c: { nome: 'Caio', modo: 'ressalva', resultado: 'Procedente', nota: 'Pena mínima.', em: '2026-11-20T10:03' },
        },
    };
    assert.deepEqual(votoCondutor(v, 'Procedente'), { uid: 'r', nome: 'Rel', relator: true });
    assert.deepEqual(votoCondutor(v, 'Improcedente'), { uid: 'b', nome: 'Bia', relator: false }, 'conduz quem divergiu primeiro, mesmo que mude o texto depois');
    const { vencidos, declaracoes } = votosDoAcordao(v, 'Improcedente', 'b');
    assert.deepEqual(vencidos.map((x) => x.nome), ['Rel', 'Caio'], 'o relator vencido e quem o acompanhou');
    assert.deepEqual(declaracoes.map((x) => `${x.nome}:${x.texto}`), ['Ana:Sem prova.']);
    const doc = sanitizeDoc(documentoDoAcordao({ numero: '1/2026', colegiado: 'Conselho', sessao: '1ª Sessão', ementa: 'Ementa.\n\nSegundo parágrafo.', texto: 'Acordam.', relatorio: 'Relatório.', relator: 'Rel',
        condutor: { nome: 'Bia', relator: false }, fundamentosCondutor: 'Divergência da Bia.', vencidos, declaracoes }));
    const t = textoPuro(doc);
    for (const s of ['ACÓRDÃO', 'Ementa', 'Segundo parágrafo.', 'Voto condutor (Bia)', 'Voto vencido de Rel (Procedente)', 'Declaração de Ana (Improcedente)']) assert.ok(t.includes(s), s);
    assert.equal(prazoDoAcordao('2026-11-16', { antecedencia: 0, contagem: 'corridos' }), '2026-12-16');
    assert.match(modeloDoAcordao('1/2026', 'Conselho', { titulo: '1ª Sessão', data: '2026-11-20' }, 'Improcedente, por maioria (2 a 1).', { nome: 'Bia', relator: false }),
        /acordam os membros do Conselho, na 1ª Sessão, de 20\/11\/2026, no seguinte resultado: Improcedente, por maioria \(2 a 1\), nos termos do voto condutor de Bia\.$/);
    const { leituraDeJulgador } = require('../lib/shared/sessoes');
    const base = { status: 'em_tramitacao', unidade_atual: 'uC', ultima_sessao: { orgao_id: 'c' } };
    assert.equal(leituraDeJulgador(base, ['c'], () => 'c'), true);
    assert.equal(leituraDeJulgador({ ...base, acordao: { juntado_em: '2026-11-21' } }, ['c'], () => 'c'), false, 'juntado o acórdão, a leitura pela pauta acaba');
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

test('sessão virtual assíncrona: período de votação, pedidos das partes e destaque (S7)', () => {
    const S = require('../lib/shared/sessoes');
    const base = { modo: 'assincrona', data: '2026-12-07', hora: '09:00' };
    assert.throws(() => S.sanitizeDadosSessao(base), /último dia da votação/);
    assert.throws(() => S.sanitizeDadosSessao({ ...base, fim: '2026-12-06' }), /antes do primeiro/);
    assert.throws(() => S.sanitizeDadosSessao({ ...base, fim: '2027-02-01' }), /no máximo 30 dias/);
    const d = S.sanitizeDadosSessao({ ...base, fim: '2026-12-14', local: 'Sala 1' });
    assert.equal(d.fim, '2026-12-14');
    assert.equal(d.local, '');
    assert.equal(S.sanitizeDadosSessao({ modo: 'presencial', data: '2026-12-07', hora: '09:00', local: 'Sala', fim: '2026-12-14' }).fim, undefined);
    assert.match(S.textoDaInclusao({ ...d, titulo: '1ª Sessão Virtual' }, 'Conselho', { inclusao: 'pauta', motivo: '' }), /Sessão Virtual do Conselho, em sessão virtual, com votação de 07\/12\/2026 a 14\/12\/2026\.$/);
    assert.equal(S.votacaoAberta(d, '2026-12-06'), false);
    assert.equal(S.votacaoAberta(d, '2026-12-07'), true);
    assert.equal(S.votacaoAberta(d, '2026-12-14'), true);
    assert.equal(S.votacaoAberta(d, '2026-12-15'), false);
    assert.equal(S.votacaoAberta({ modo: 'presencial', data: '2026-12-07' }, '2026-12-01'), true);
    assert.equal(S.virtualEncerrou(d, '2026-12-14'), false);
    assert.equal(S.virtualEncerrou(d, '2026-12-15'), true);
    // Até 48 horas antes do início: sustentação gravada e destaque; preferência, até o início; esclarecimento, durante.
    assert.equal(S.problemaDoPedido(d, 'destaque', '2026-12-05'), '');
    assert.match(S.problemaDoPedido(d, 'destaque', '2026-12-06'), /terminou em 05\/12\/2026/);
    assert.match(S.problemaDoPedido(d, 'sustentacao', '2026-12-06'), /terminou/);
    assert.equal(S.problemaDoPedido(d, 'preferencia', '2026-12-07'), '');
    assert.match(S.problemaDoPedido(d, 'esclarecimento', '2026-12-05'), /durante a votação/);
    assert.equal(S.problemaDoPedido(d, 'esclarecimento', '2026-12-10'), '');
    const sinc = { modo: 'presencial', data: '2026-12-07' };
    assert.match(S.problemaDoPedido(sinc, 'destaque', '2026-12-01'), /só da sessão virtual/);
    assert.equal(S.problemaDoPedido(sinc, 'sustentacao', '2026-12-07'), '');
    assert.match(S.problemaDoPedido(sinc, 'sustentacao', '2026-12-08'), /terminou/);
    assert.throws(() => S.sanitizePedido({ tipo: 'x' }, d), /Escolha/);
    assert.throws(() => S.sanitizePedido({ tipo: 'sustentacao' }, d), /link do áudio ou do vídeo/);
    assert.throws(() => S.sanitizePedido({ tipo: 'sustentacao', link: 'http://x' }, d), /https/);
    assert.deepEqual(S.sanitizePedido({ tipo: 'sustentacao', link: 'https://v.org/a', texto: ' Resumo ' }, d), { tipo: 'sustentacao', texto: 'Resumo', link: 'https://v.org/a' });
    assert.deepEqual(S.sanitizePedido({ tipo: 'sustentacao' }, sinc), { tipo: 'sustentacao', texto: '', link: '' });
    assert.throws(() => S.sanitizePedido({ tipo: 'destaque', texto: 'curto' }, d), /por que/);
    assert.equal(S.sanitizePedido({ tipo: 'preferencia', link: 'https://x.org' }, d).link, '');
    assert.match(S.textoDoDestaque({ titulo: '1ª Sessão Virtual', data: '2026-12-07' }, 'Eva', null), /^Destacado da 1ª Sessão Virtual, de 07\/12\/2026, por Eva, .*recomeça\. Será incluído na próxima sessão síncrona/);
});

test('ata da sessão: presença, desfecho de cada processo e assinaturas (S8)', () => {
    const S = require('../lib/shared/sessoes');
    const s = { titulo: '3ª Sessão Ordinária', carater: 'ordinaria', modo: 'presencial', data: '2026-12-07', hora: '14:00', local: 'Sala 2', link: '', observacoes: '' };
    const itens = [
        { numero: '000001/2026', assunto: 'Falta funcional', situacao: 'pautado', motivo: '', relator: 'Julia', proclamado: 'Improcedente, por maioria (2 a 1), em sessão de 07/12/2026. Relator: Julia', redator: 'Julia', sustentacoes: ['Maria Souza (requerido)'] },
        { numero: '000002/2026', assunto: '', situacao: 'vista', motivo: '', relator: 'Hugo', vista: { nomes: ['Eva', 'Hugo'], prazo: '2026-12-17' } },
        { numero: '000003/2026', assunto: 'Outro', situacao: 'adiado', motivo: 'não foi julgado na sessão', relator: '' },
        { numero: '000004/2026', assunto: 'Mais um', situacao: 'pautado', motivo: '', relator: 'Hugo' },
    ];
    const t = S.textoDaAta(s, 'Conselho de Ética', { presidente: 'Eva', presentes: ['Hugo', 'Julia'], ausentes: ['Dora'], registrada: true }, itens, '2026-12-07');
    assert.match(t, /^ATA DA 3ª SESSÃO ORDINÁRIA DO CONSELHO DE ÉTICA\n\n/);
    assert.match(t, /Em 07\/12\/2026, às 14:00, em Sala 2, reuniu-se o Conselho de Ética em sessão ordinária, sob a presidência de Eva, presentes Hugo e Julia; ausente Dora\./);
    assert.match(t, /1\. Processo 000001\/2026 \(Falta funcional\)\. Sustentação oral por Maria Souza \(requerido\)\. Improcedente, por maioria .*Relator: Julia\. Redator do acórdão: Julia\./);
    assert.match(t, /2\. Processo 000002\/2026, relator Hugo\. Pedido de vista de Eva e Hugo, com prazo até 17\/12\/2026; julgamento suspenso\./);
    assert.match(t, /3\. Processo 000003\/2026 \(Outro\)\. Adiado: não foi julgado na sessão\./);
    assert.match(t, /4\. Processo 000004\/2026 \(Mais um\), relator Hugo\. Não julgado nesta sessão\./);
    assert.match(t, /Encerrada a sessão em 07\/12\/2026\. Esta ata, lavrada pela secretaria do colegiado, vai assinada pelo presidente e pela secretaria\.$/);
    const sem = S.textoDaAta(s, 'Conselho', { presidente: 'Eva', presentes: ['Hugo'], ausentes: [], registrada: false }, [], '2026-12-07');
    assert.match(sem, /com a composição do dia: Hugo \(a presença não foi registrada no sistema\)\.\n\nNão houve processos na pauta\./);
    const v = S.textoDaAta({ ...s, modo: 'assincrona', fim: '2026-12-11' }, 'Conselho', { presidente: 'Eva', presentes: ['Eva', 'Julia'], ausentes: [], registrada: true }, [], '2026-12-12');
    assert.match(v, /Sessão ordinária virtual do Conselho, com votação de 07\/12\/2026 a 11\/12\/2026, sob a presidência de Eva\. Votaram Eva e Julia\./);
    assert.equal(S.desfechoNaAta({ situacao: 'destacado', motivo: 'destacado por Hugo.' }), 'Destacado para julgamento em sessão síncrona (destacado por Hugo).');
    assert.equal(S.ataAssinada({ assinaturas: [{ papel: 'presidente' }] }), false);
    assert.equal(S.ataAssinada({ assinaturas: [{ papel: 'presidente' }, { papel: 'secretaria' }] }), true);
    assert.equal(S.ataAssinada(null), false);
});

test('relatório do colegiado: sessões, julgados, pauta, vistas e acórdãos (S15)', () => {
    const { relatorioDoColegiado } = require('../lib/shared/sessoes');
    const item = (pid, situacao, extra = {}) => ({ processo_id: pid, numero: `N-${pid}`, assunto: '', ordem: 1, inclusao: 'pauta', motivo: '', situacao, incluido_em: '', ...extra });
    const sessoes = [
        { id: 's1', titulo: '1ª Sessão', data: '2026-03-02', tipo: 'julgamento', situacao: 'encerrada', pauta: [item('a', 'pautado'), item('b', 'pautado'), item('c', 'vista', { vista: { nomes: ['Ana'], prazo: '2026-03-12' } }), item('d', 'retirado')] },
        { id: 's2', titulo: '2ª Sessão', data: '2026-04-06', tipo: 'julgamento', situacao: 'encerrada', pauta: [item('e', 'pautado'), item('f', 'adiado'), item('g', 'vista', { vista: { nomes: ['Bia'], prazo: '2026-12-01', devolvida: true } })] },
        { id: 's3', titulo: '3ª Sessão', data: '2026-05-04', tipo: 'julgamento', situacao: 'cancelada', pauta: [item('h', 'pautado')] },
        { id: 's4', titulo: '4ª Sessão', data: '2026-12-07', tipo: 'julgamento', situacao: 'publicada', pauta: [item('i', 'pautado')] },
        { id: 'r1', titulo: 'Reunião', data: '2026-06-01', tipo: 'reuniao', situacao: 'encerrada', pauta: [] },
    ];
    const votacoes = [
        { sessao_id: 's1', processo_id: 'a', relator_nome: 'Ana', proclamado: { resultado: 'Provido', data: '2026-03-02' } },
        { sessao_id: 's1', processo_id: 'b', relator_nome: 'Bia', proclamado: { resultado: 'Desprovido', data: '2026-03-02' } },
        { sessao_id: 's2', processo_id: 'e', relator_nome: 'Ana', proclamado: { resultado: 'Provido', data: '2026-04-06' } },
        { sessao_id: 's1', processo_id: 'c', relator_nome: 'Caio', proclamado: null },
        { sessao_id: 's3', processo_id: 'h', relator_nome: 'Caio', proclamado: { resultado: 'Provido', data: '2026-05-04' } },
    ];
    const acordaos = [
        { sessao_id: 's1', processo_id: 'a', prazo: '2026-04-01', pendente: false, juntado_em: '2026-03-12T15:00:00.000Z', redator_nome: 'Ana' },
        { sessao_id: 's1', processo_id: 'b', prazo: '2026-04-01', pendente: false, juntado_em: '2026-04-11T10:00:00.000Z', redator_nome: 'Bia' },
        { sessao_id: 's2', processo_id: 'e', prazo: '2026-05-06', pendente: true, juntado_em: null, redator_nome: 'Ana' },
    ];
    const r = relatorioDoColegiado(sessoes, votacoes, acordaos, '2026-11-16');
    assert.deepEqual(r.sessoes, { realizadas: 3, canceladas: 1, por_realizar: 1, reunioes: 1 });
    // A sessão cancelada não conta julgados nem pauta.
    assert.equal(r.julgados.total, 3);
    assert.deepEqual(r.julgados.por_resultado, [['Provido', 2], ['Desprovido', 1]]);
    assert.deepEqual(r.julgados.por_relator, [['Ana', 2], ['Bia', 1]]);
    assert.deepEqual(r.pauta, { pautados: 8, retirados: 1, adiados: 1, diligencias: 0, destacados: 0, vistas: 2 });
    // A vista devolvida não conta; a de Ana venceu em março.
    assert.equal(r.vistas.abertas, 1);
    assert.equal(r.vistas.atrasadas, 1);
    assert.deepEqual(r.vistas.lista[0].nomes, ['Ana']);
    // Acórdãos: 10 e 40 dias (média 25), um no prazo; o terceiro pendente e atrasado.
    assert.equal(r.acordaos.juntados, 2);
    assert.equal(r.acordaos.media_dias, 25);
    assert.equal(r.acordaos.no_prazo, 1);
    assert.equal(r.acordaos.pendentes, 1);
    assert.equal(r.acordaos.atrasados, 1);
    assert.equal(r.linhas[0].numero, 'N-a');
    assert.equal(r.linhas[0].dias_ate_acordao, 10);
    assert.equal(r.linhas[2].acordao_pendente, true);
    // Sem nada no período.
    const vazio = relatorioDoColegiado([], [], [], '2026-11-16');
    assert.equal(vazio.acordaos.media_dias, null);
    assert.equal(vazio.julgados.total, 0);
});
