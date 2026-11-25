// O que a fase faz sozinha: efeitos ao entrar, aviso, prazos das ações,
// antecedência do alerta e regra do vencimento.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const ef = require('../lib/shared/efeitosFase');
const pf = require('../lib/shared/prazosFase');

const rito = (fases) => s.sanitizeRito({ nome: 'R', fases }).fases;

test('rito: guarda os efeitos ao entrar, o aviso e as regras dos prazos; o que não vale sai', () => {
    const [a, b, c] = rito([
        { id: 'a', nome: 'Triagem', prazo_dias: 5, prazo_auto: true, prazo_alerta_dias: 5, prazo_vencido: { urgente: true, avisar_gestores: true, outro: 1 },
            ao_entrar: { sigilo: 'restrito', responsavel: 'atribuicao', responsavel_atribuicao: '  Promotor  ', pendencia: ' Decidir   a admissão ', pendencia_interrompe: true, x: 1 },
            aviso: { para: 'gestores', mensagem: '  Conferir a   distribuição ' } },
        { id: 'b', nome: 'Análise', prazo_alerta_dias: 7, prazo_vencido: { urgente: true }, ao_entrar: { sem_urgencia: true, responsavel: 'autor', sigilo: 'secreto' },
            aviso: { para: 'ninguem', mensagem: 'não vai' }, acoes: ['Parecer', 'Nota'], acoes_regras: [{ prazo_dias: 3, prazo_contagem: 'corridos' }, { pede: 'orientacao', prazo_dias: 3 }] },
        { id: 'c', nome: 'Fim', final: true, prazo_alerta_dias: 9, aviso: { mensagem: 'Arquivar a pasta' }, ao_entrar: { responsavel: 'ninguem' } },
    ]);
    assert.deepEqual(a.ao_entrar, { sigilo: 'restrito', responsavel: 'atribuicao', responsavel_atribuicao: 'Promotor', pendencia: 'Decidir a admissão', pendencia_interrompe: true });
    assert.deepEqual(a.aviso, { para: 'gestores', mensagem: 'Conferir a distribuição' });
    assert.equal(a.prazo_alerta_dias, 5);
    assert.deepEqual(a.prazo_vencido, { urgente: true, avisar_gestores: true });
    assert.deepEqual(b.ao_entrar, { sem_urgencia: true, responsavel: 'autor' });
    assert.deepEqual(b.aviso, { para: 'ninguem' }, 'sem aviso, não há mensagem');
    assert.deepEqual(b.acoes_regras, [{ prazo_dias: 3, prazo_contagem: 'corridos' }, { pede: 'orientacao' }], 'orientação não tem prazo');
    assert.equal(b.prazo_alerta_dias, 7, 'fase sem prazo próprio, mas com prazo de ação, guarda a antecedência');
    assert.deepEqual(b.prazo_vencido, { urgente: true });
    assert.equal(c.ao_entrar, undefined);
    assert.deepEqual(c.aviso, { mensagem: 'Arquivar a pasta' }, 'só a mensagem: os destinatários continuam os de sempre');
    assert.equal(c.prazo_alerta_dias, undefined, 'fase que não abre prazo não guarda antecedência');
});

test('rito: antecedência igual à padrão, negativa ou acima do limite não é gravada; zero é', () => {
    const com = (v) => rito([{ id: 'a', nome: 'A', prazo_dias: 5, prazo_auto: true, prazo_alerta_dias: v }])[0].prazo_alerta_dias;
    assert.equal(com(2), undefined);
    assert.equal(com(-1), undefined);
    assert.equal(com(31), undefined);
    assert.equal(com(''), undefined);
    assert.equal(com(0), 0, 'zero: só no dia do vencimento');
    assert.equal(com(30), 30);
});

test('rito: escolhas que se contradizem são recusadas com a fase no texto', () => {
    const ruim = (ao_entrar) => { try { rito([{ id: 'a', nome: 'Triagem', ao_entrar }]); return ''; } catch (e) { return e.message; } };
    assert.match(ruim({ urgente: true, sem_urgencia: true }), /"Triagem" marca e tira a urgência/);
    assert.match(ruim({ sem_responsavel: true, responsavel: 'gestor' }), /"Triagem" tira e designa o responsável/);
    assert.match(ruim({ responsavel: 'atribuicao' }), /informe a atribuição/);
    assert.match(ruim({ arquivar: true, pendencia: 'Decidir' }), /arquiva o processo ao entrar/);
    assert.match(ruim({ arquivar: true, responsavel: 'autor' }), /arquiva o processo ao entrar/);
});

test('rito antigo: sem nada novo, a fase fica como era', () => {
    const [a] = rito([{ id: 'a', nome: 'A', prazo_dias: 5, prazo_auto: true, ao_entrar: { urgente: true, sem_responsavel: true }, acoes: ['X'] }]);
    assert.deepEqual(a, { id: 'a', nome: 'A', prazo_dias: 5, prazo_auto: true, ao_entrar: { urgente: true, sem_responsavel: true }, acoes: ['X'] });
});

test('responsável pela fase: quem moveu, quem gere ou a atribuição, só entre os lotados', () => {
    const lot = [{ uid: 'ana', atribuicao: 'Promotora de Justiça', gestor: true }, { uid: 'bia', atribuicao: 'Analista', gestor: false }, { uid: 'caio', atribuicao: 'analista ', gestor: false }];
    assert.equal(ef.responsavelPelaFase(undefined, lot, 'bia'), null);
    assert.equal(ef.responsavelPelaFase({ urgente: true }, lot, 'bia'), null);
    assert.deepEqual(ef.responsavelPelaFase({ responsavel: 'autor' }, lot, 'bia'), { uid: 'bia', nota: '' });
    assert.match(ef.responsavelPelaFase({ responsavel: 'autor' }, lot, 'dora').nota, /não está lotada na unidade/);
    assert.equal(ef.responsavelPelaFase({ responsavel: 'autor' }, lot, 'dora').uid, undefined);
    assert.deepEqual(ef.responsavelPelaFase({ responsavel: 'gestor' }, lot, 'bia'), { uid: 'ana', nota: '' });
    assert.deepEqual(ef.responsavelPelaFase({ responsavel: 'atribuicao', responsavel_atribuicao: 'promotora de justica' }, lot, 'bia'), { uid: 'ana', nota: '' });
    assert.match(ef.responsavelPelaFase({ responsavel: 'atribuicao', responsavel_atribuicao: 'Analista' }, lot, 'ana').nota, /há 2 pessoas assim na unidade: designe pela tela/);
    assert.match(ef.responsavelPelaFase({ responsavel: 'atribuicao', responsavel_atribuicao: 'Perito' }, lot, 'ana').nota, /não há ninguém assim/);
    assert.match(ef.responsavelPelaFase({ responsavel: 'gestor' }, lot.slice(1), 'bia').nota, /quem gere a unidade, e não há ninguém/);
});

test('aviso da fase: a unidade, quem a gere ou o responsável (sem ele, a unidade)', () => {
    const lot = [{ uid: 'ana', atribuicao: '', gestor: true }, { uid: 'bia', atribuicao: '', gestor: false }];
    assert.deepEqual(ef.destinatariosDoAviso('unidade', lot, 'bia'), ['ana', 'bia']);
    assert.deepEqual(ef.destinatariosDoAviso('gestores', lot, 'bia'), ['ana']);
    assert.deepEqual(ef.destinatariosDoAviso('responsavel', lot, 'bia'), ['bia']);
    assert.deepEqual(ef.destinatariosDoAviso('responsavel', lot, null), ['ana', 'bia']);
    assert.deepEqual(ef.destinatariosDoAviso('responsavel', lot, 'fora'), ['ana', 'bia'], 'responsável que saiu da unidade não recebe: vai à unidade');
    assert.deepEqual(ef.destinatariosDoAviso('ninguem', lot, 'bia'), []);
    assert.deepEqual(ef.destinatariosDoAviso('gestores', lot.map((l) => ({ ...l, gestor: false })), null), ['ana', 'bia'], 'unidade sem gestor: o aviso vai à unidade');
});

// ---- Prazos das ações -------------------------------------------------------
const HOJE = '2026-11-16'; // segunda-feira
const AGORA = '2026-11-16T12:00:00.000Z';
let n = 0;
const id = () => `p${++n}`;
const faseP = () => rito([
    { id: 'a', nome: 'Admissão', acoes: ['Rito'], acoes_regras: [{ pede: 'lista', opcoes: ['Ordinário', 'Sumário'] }] },
    { id: 'b', nome: 'Instrução', prazo_alerta_dias: 5, prazo_vencido: { urgente: true },
        acoes: ['Parecer', 'Perícia', 'Ofício', 'E-mail'],
        acoes_regras: [{ prazo_dias: 3 }, { prazo_dias: 10, prazo_contagem: 'corridos', se: { fase: 'a', acao: 0, valores: ['Ordinário'] } }, { prazo_dias: 2 }, { prazo_dias: 2, ou: 2 }] },
])[1];
const sinc = (proc, fase = faseP()) => pf.prazosDasAcoes(proc, fase, HOJE, AGORA, undefined, 'Ana', id);

test('prazo por ação: abre o da ação que vale, com a antecedência e a regra do vencimento da fase', () => {
    const r = sinc({ fase_atual: 'b', prazos: [], acoes_respostas: { a: { 0: 'Sumário' } } });
    assert.deepEqual(r.prazos.map((x) => [x.acao_idx, x.vence_em, x.contagem, x.status, x.alerta_dias, x.ao_vencer, x.automatico]), [
        [0, '2026-11-19', 'uteis', 'aberto', 5, { urgente: true }, true],
        [2, '2026-11-18', 'uteis', 'aberto', 5, { urgente: true }, true],
        [3, '2026-11-18', 'uteis', 'aberto', 5, { urgente: true }, true],
    ], 'a perícia é só do rito ordinário');
    assert.equal(r.prazos[0].descricao, 'Ação "Parecer" da fase Instrução');
    assert.match(r.notas[0], /Prazo da ação "Parecer" aberto: 3 dias úteis, vence em 19\/11\/2026\./);
    const ord = sinc({ fase_atual: 'b', prazos: [], acoes_respostas: { a: { 0: 'Ordinário' } } });
    assert.deepEqual(ord.prazos.map((x) => [x.acao_idx, x.vence_em, x.contagem]).find((x) => x[0] === 1), [1, '2026-11-26', 'corridos']);
});

test('prazo por ação: cumprir encerra, desfazer reabre com o vencimento original, alternativa cumprida cancela', () => {
    const base = { fase_atual: 'b', acoes_respostas: { a: { 0: 'Sumário' } } };
    const abertos = sinc({ ...base, prazos: [] }).prazos;
    assert.equal(sinc({ ...base, prazos: abertos }), null, 'nada mudou, nada a gravar');
    const feito = sinc({ ...base, prazos: abertos, acoes_feitas: { b: [0, 2] } });
    assert.deepEqual(feito.prazos.map((x) => [x.acao_idx, x.status, x.pela_regra === true]), [[0, 'cumprido', true], [2, 'cumprido', true], [3, 'cancelado', true]]);
    assert.match(feito.notas.join(' '), /"Parecer" cumprido no prazo\..*"E-mail" cancelado: ela deixou de valer\./);
    const desfeito = sinc({ ...base, prazos: feito.prazos, acoes_feitas: { b: [2] } });
    assert.deepEqual(desfeito.prazos.map((x) => [x.acao_idx, x.status, x.vence_em, x.encerrado_em]), [[0, 'aberto', '2026-11-19', undefined], [2, 'cumprido', '2026-11-18', HOJE], [3, 'cancelado', '2026-11-18', HOJE]]);
    assert.match(desfeito.notas[0], /"Parecer" reaberto: vence em 19\/11\/2026/);
    assert.equal(desfeito.prazos.length, 3, 'reabrir não cria prazo novo');
});

test('prazo por ação: a que deixou de valer e volta conta de novo a partir de hoje', () => {
    const ord = { fase_atual: 'b', acoes_respostas: { a: { 0: 'Ordinário' } } };
    const abertos = sinc({ ...ord, prazos: [] }).prazos;
    const cancel = sinc({ ...ord, prazos: abertos, acoes_respostas: { a: { 0: 'Sumário' } } });
    assert.deepEqual(cancel.prazos.find((x) => x.acao_idx === 1).status, 'cancelado');
    const volta = pf.prazosDasAcoes({ ...ord, prazos: cancel.prazos.map((x) => (x.acao_idx === 1 ? { ...x, vencido_tratado_em: '2026-11-20' } : x)) }, faseP(), '2026-11-30', AGORA, undefined, 'Ana', id);
    const p = volta.prazos.find((x) => x.acao_idx === 1);
    assert.deepEqual([p.status, p.inicio, p.vence_em, p.vencido_tratado_em], ['aberto', '2026-11-30', '2026-12-10', undefined], 'não volta já vencido');
    assert.match(volta.notas[0], /"Perícia" reaberto: vence em 10\/12\/2026/);
    assert.equal(volta.prazos.length, abertos.length, 'reabre o mesmo, sem criar outro');
});

test('prazo por ação: encerrado à mão fica como está; fora do prazo é dito', () => {
    const base = { fase_atual: 'b', acoes_respostas: { a: { 0: 'Sumário' } } };
    const abertos = sinc({ ...base, prazos: [] }).prazos;
    const aMao = abertos.map((x) => (x.acao_idx === 0 ? { ...x, status: 'cancelado', encerrado_em: HOJE, encerrado_por: 'Bia' } : x));
    assert.equal(sinc({ ...base, prazos: aMao }), null, 'não reabre o que alguém encerrou');
    const tarde = pf.prazosDasAcoes({ ...base, prazos: abertos, acoes_feitas: { b: [0] } }, faseP(), '2026-11-25', AGORA, undefined, 'Ana', id);
    assert.match(tarde.notas[0], /"Parecer" cumprido fora do prazo/);
});

test('sair da fase: o prazo dela é cumprido, o de ação por fazer é cancelado e a rodada se encerra', () => {
    const base = { fase_atual: 'b', acoes_respostas: { a: { 0: 'Sumário' } } };
    const comFeita = sinc({ ...base, prazos: sinc({ ...base, prazos: [] }).prazos, acoes_feitas: { b: [0] } }).prazos;
    const daFase = { id: 'f1', descricao: 'Fase Instrução', fase_id: 'b', vence_em: '2026-11-30', status: 'aberto' };
    const outra = { id: 'x', descricao: 'Manual', vence_em: '2026-11-30', status: 'aberto' };
    const r = pf.encerrarPrazosDaFase([...comFeita, daFase, outra], 'b', HOJE, 'Ana');
    assert.deepEqual(r.prazos.map((x) => [x.id, x.status, x.rodada_fim === true]), [
        [comFeita[0].id, 'cumprido', true], [comFeita[1].id, 'cancelado', true], [comFeita[2].id, 'cancelado', true], ['f1', 'cumprido', false], ['x', 'aberto', false],
    ]);
    assert.deepEqual(r.notas.filter((t) => /Prazo interno da fase encerrado no prazo: Fase Instrução\./.test(t)).length, 1);
    assert.equal(r.notas.filter((t) => /encerrado sem cumprimento, com a saída da fase/.test(t)).length, 2);
    // Nova rodada: os prazos antigos não contam, abrem novos.
    const nova = sinc({ ...base, prazos: r.prazos });
    assert.equal(nova.prazos.filter((x) => x.status === 'aberto' && x.fase_id === 'b' && typeof x.acao_idx === 'number').length, 3);
    assert.equal(pf.encerrarPrazosDaFase([outra], 'b', HOJE, 'Ana').prazos[0], outra, 'nada da fase: a lista é a mesma');
    assert.deepEqual(pf.encerrarPrazosDaFase([daFase], null, HOJE, 'Ana').notas, [], 'autuação: não há fase de saída');
});

test('alerta: cada prazo com a sua antecedência; o derivado aponta o dia do alerta antecipado', () => {
    const prazos = [
        { id: '1', vence_em: '2026-11-18', status: 'aberto' }, // padrão (2): em alerta
        { id: '2', vence_em: '2026-11-19', status: 'aberto' }, // padrão: ainda não
        { id: '3', vence_em: '2026-11-25', status: 'aberto', alerta_dias: 10 }, // antecipado: em alerta
        { id: '4', vence_em: '2026-11-17', status: 'aberto', alerta_dias: 0 }, // só no dia: ainda não
        { id: '5', vence_em: '2026-11-10', status: 'aberto', alerta_dias: 0 }, // vencido: em alerta
        { id: '6', vence_em: '2026-11-10', status: 'cumprido' },
    ];
    assert.deepEqual(pf.prazosEmAlerta(prazos, HOJE).map((x) => x.id), ['5', '1', '3']);
    assert.deepEqual(pf.prazosEmAlerta(undefined, HOJE), []);
    const d = s.derivados([], prazos);
    assert.equal(d.proximo_vencimento, '2026-11-10');
    assert.equal(d.proximo_alerta, '2026-11-15', 'vencimento menos a antecedência do único prazo antecipado');
    assert.equal(s.derivados([], prazos.slice(0, 2)).proximo_alerta, null);
});

test('vencimento: só o prazo aberto, vencido, com regra e ainda não tratado', () => {
    const prazos = [
        { id: '1', vence_em: '2026-11-13', status: 'aberto', ao_vencer: { urgente: true } },
        { id: '2', vence_em: '2026-11-13', status: 'aberto', ao_vencer: { avisar_gestores: true }, vencido_tratado_em: '2026-11-14' },
        { id: '3', vence_em: '2026-11-16', status: 'aberto', ao_vencer: { urgente: true } }, // vence hoje: ainda não venceu
        { id: '4', vence_em: '2026-11-13', status: 'aberto' },
        { id: '5', vence_em: '2026-11-13', status: 'cumprido', ao_vencer: { urgente: true } },
        { id: '6', vence_em: '2026-11-13', status: 'aberto', ao_vencer: {} },
    ];
    assert.deepEqual(pf.vencidosATratar(prazos, HOJE).map((x) => x.id), ['1']);
    assert.deepEqual(pf.vencidosATratar(null, HOJE), []);
});

test('cumprimento por documento: fecha o prazo da ação e recalcula os derivados', () => {
    const base = { fase_atual: 'b', acoes_respostas: { a: { 0: 'Sumário' } } };
    // Abre os prazos "hoje" de verdade: camposDosPrazosDasAcoes confere o
    // cumprimento pela data real, e com a data fixa o teste vencia sozinho.
    const abertos = pf.prazosDasAcoes({ ...base, prazos: [] }, faseP(), s.hojeBrasil(), new Date().toISOString(), undefined, 'Ana', id).prazos;
    const { campos, notas } = pf.camposDosPrazosDasAcoes({ ...base, prazos: abertos, pendencias: [] }, { acoes_feitas: { b: [0, 2] } }, faseP(), 'Ana');
    assert.equal(campos.prazos.filter((x) => x.status === 'aberto').length, 0);
    assert.equal(campos.proximo_vencimento, null);
    assert.match(notas.join(' '), /"Parecer" cumprido no prazo/, 'o registro interno diz o que a regra fez');
    assert.deepEqual(pf.camposDosPrazosDasAcoes({ ...base, prazos: abertos }, {}, faseP(), 'Ana'), { campos: {}, notas: [] }, 'nada cumprido: nada a gravar');
    assert.deepEqual(pf.camposDosPrazosDasAcoes({ prazos: [] }, {}, undefined, 'Ana'), { campos: {}, notas: [] });
    assert.equal(pf.faseComPrazoDeAcao({ fase_atual: 'b', fases: [faseP()] }), true);
    assert.equal(pf.faseComPrazoDeAcao({ fase_atual: 'b', fases: [{ id: 'b', acoes: ['x'] }] }), false, 'rito antigo: não lê o calendário');
});
