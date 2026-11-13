// Andamento automático da fase, arquivar ao entrar e situação do registro
// ligado (Consultas e Expedientes). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const sr = require('../lib/shared/situacaoRegistro');
const { calculateStatus } = require('../lib/shared/status');

const rito = (fases) => s.sanitizeRito({ nome: 'R', fases }).fases;

test('rito: guarda o avanço automático, o arquivar ao entrar e a situação do registro; descarta o que não vale', () => {
    const [a, b, c] = rito([
        { nome: 'Recebimento', avanco: 'auto', situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente', ao_assumir: 'Em elaboração' } },
        { nome: 'Análise', avanco: 'sempre', situacao_registro: { modulo: 'parcerias', ao_entrar: 'Em revisão' } },
        { nome: 'Arquivamento', final: true, avanco: 'auto', ao_entrar: { arquivar: true }, situacao_registro: { modulo: 'expedientes', ao_entrar: 'Na pasta', ao_assumir: 'xpto' } },
    ]);
    assert.equal(a.avanco, 'auto');
    assert.deepEqual(a.situacao_registro, { modulo: 'consultas', ao_entrar: 'Pendente', ao_assumir: 'Em elaboração' });
    assert.equal(b.avanco, undefined, 'valor desconhecido não entra');
    assert.equal(b.situacao_registro, undefined, 'só Consultas e Expedientes têm essas situações');
    assert.equal(c.avanco, undefined, 'fase final não tem para onde seguir');
    assert.deepEqual(c.ao_entrar, { arquivar: true });
    assert.deepEqual(c.situacao_registro, { modulo: 'expedientes', ao_entrar: 'Na pasta' });
    assert.equal(sr.sanitizeSituacaoRegistro({ modulo: 'consultas' }), null, 'sem situação, não há regra');
});

test('saída automática: uma saída só, ou a única que a resposta indica; nunca com fase parada', () => {
    const fases = rito([
        { nome: 'Recebimento', avanco: 'auto' },
        { nome: 'Análise', unidade_id: 'assessoria', avanco: 'auto', acoes: ['Parecer'], acoes_regras: [{ pede: 'lista', opcoes: ['Responder', 'Diligência'] }],
            proximas: ['revisao', 'diligencias'], condicoes_regra: { revisao: { acao: 0, valores: ['Responder'] }, diligencias: { acao: 0, valores: ['Diligência'] } } },
        { nome: 'Revisão', id: 'revisao' },
        { nome: 'Diligências', id: 'diligencias', final: true },
    ]);
    const proc = (extra) => ({ fases, fase_atual: fases[0].id, status: 'em_tramitacao', unidade_atual: 'secretaria', ...extra });
    assert.deepEqual(s.saidaAutomatica(proc(), ['secretaria', 'assessoria']), { fase_id: fases[1].id, unidade_destino: 'assessoria' });
    assert.deepEqual(s.saidaAutomatica(proc(), ['secretaria']), { fase_id: fases[1].id }, 'unidade inativa: só muda a fase');
    assert.deepEqual(s.saidaAutomatica(proc({ unidade_atual: 'assessoria' }), ['assessoria']), { fase_id: fases[1].id }, 'já está na unidade da fase');
    assert.equal(s.saidaAutomatica(proc({ status: 'sobrestado' }), []), null);
    assert.equal(s.saidaAutomatica(proc({ fase_suspensa: true }), []), null);
    // Duas saídas: só segue com a resposta que indica uma delas.
    const analise = (resp) => proc({ fase_atual: fases[1].id, unidade_atual: 'assessoria', acoes_respostas: resp ? { [fases[1].id]: resp } : undefined });
    assert.equal(s.saidaAutomatica(analise(), []), null, 'sem resposta, quem decide é a pessoa');
    assert.deepEqual(s.saidaAutomatica(analise({ 0: 'Responder' }), []), { fase_id: 'revisao' });
    assert.deepEqual(s.saidaAutomatica(analise({ 0: 'Diligência' }), []), { fase_id: 'diligencias' });
    // Fase sem a marca e fase final não seguem.
    assert.equal(s.saidaAutomatica(proc({ fase_atual: 'revisao' }), []), null);
    assert.equal(s.saidaAutomatica(proc({ fase_atual: 'diligencias' }), []), null);
});

test('saída automática: saída única com condição só segue com a resposta que ela pede', () => {
    const fases = rito([
        { nome: 'Triagem', avanco: 'auto', acoes: ['Cabe?'], acoes_regras: [{ pede: 'sim_nao' }], condicoes_regra: { analise: { acao: 0, valores: ['sim'] } } },
        { nome: 'Análise', id: 'analise' },
    ]);
    const proc = (resp) => ({ fases, fase_atual: fases[0].id, status: 'em_tramitacao', unidade_atual: 'u', acoes_respostas: { [fases[0].id]: resp } });
    assert.equal(s.saidaAutomatica(proc({ 0: 'nao' }), []), null);
    assert.deepEqual(s.saidaAutomatica(proc({ 0: 'sim' }), []), { fase_id: 'analise' });
});

const HOJE = '2026-11-13';
const aplicar = (doc, alvo, quem) => ({ ...doc, ...(sr.mudancasDaSituacao(doc, alvo, HOJE, quem) || {}) });

test('situação do registro: de qualquer situação para qualquer outra, o quadro mostra a pedida', () => {
    for (const de of sr.SITUACOES) {
        const origem = aplicar({ status: 'Pendente' }, de);
        assert.equal(calculateStatus(origem), de, `chega a ${de}`);
        for (const para of sr.SITUACOES) {
            const depois = aplicar(origem, para);
            assert.equal(calculateStatus(depois), para, `${de} -> ${para}`);
            assert.equal(depois.status, para);
            assert.equal(sr.mudancasDaSituacao(depois, para, HOJE), null, `${para} de novo não grava nada`);
        }
    }
});

test('situação do registro: preserva datas já preenchidas, apaga as das fases seguintes na volta e marca o responsável ao assumir', () => {
    const doc = { status: 'Em elaboração', analysis_start_date: '2026-11-01', distribution_date: '2026-10-30', responsible_user_id: 'u1', responsible_user_name: 'Ana' };
    assert.deepEqual(sr.mudancasDaSituacao(doc, 'Em revisão', HOJE), { review_submission_date: HOJE, status: 'Em revisão' });
    assert.deepEqual(sr.mudancasDaSituacao({ ...doc, status: 'Na pasta', review_submission_date: '2026-11-05', reviewed_date: '2026-11-06', review_return_date: '2026-11-07', archived_date: '2026-11-08' }, 'Em revisão', HOJE),
        { reviewed_date: null, review_return_date: null, archived_date: null, status: 'Em revisão' });
    assert.deepEqual(sr.mudancasDaSituacao({ status: 'Revisadas', reviewed_date: '2026-11-06' }, 'Na pasta', HOJE), { archived_date: HOJE, review_return_date: HOJE, status: 'Na pasta' });
    // Assumir: entra em elaboração com a data, a distribuição e o responsável.
    assert.deepEqual(sr.mudancasDaSituacao({ status: 'Pendente' }, 'Em elaboração', HOJE, { uid: 'u2', nome: 'Bruno Lima' }),
        { analysis_start_date: HOJE, distribution_date: HOJE, responsible_user_id: 'u2', responsible_user_name: 'Bruno Lima', status: 'Em elaboração' });
    assert.deepEqual(sr.mudancasDaSituacao(doc, 'Em elaboração', HOJE, { uid: 'u2', nome: 'Bruno Lima' }), { responsible_user_id: 'u2', responsible_user_name: 'Bruno Lima' }, 'só troca o responsável');
    assert.equal(sr.mudancasDaSituacao(doc, 'Em elaboração', HOJE, { uid: 'u1', nome: 'Ana' }), null);
    assert.equal(sr.mudancasDaSituacao(doc, 'Em elaboração', HOJE), null, 'sem quem assume, o responsável fica');
    // Registro importado: a data mora num campo de nome antigo e também é apagada na volta.
    const antigo = { status: 'Na pasta', 'NA PASTA\nARQUIVADO\n(DATA)': '2025-01-10', 'REVISÃO CONCLUÍDA (DATA)': '2025-01-08' };
    const voltou = aplicar(antigo, 'Revisadas');
    assert.equal(voltou['NA PASTA\nARQUIVADO\n(DATA)'], null);
    assert.equal(voltou.reviewed_date, undefined, 'a revisão concluída já estava preenchida');
    assert.equal(calculateStatus(voltou), 'Revisadas');
});

test('registro que o processo conduz: a origem ou, sem ela, o único ligado do módulo', () => {
    const origem = { ref: { modulo: 'consultas', id: 'c1' } };
    assert.deepEqual(sr.registroDoProcesso({ origem, vinculos: ['consultas:c1', 'consultas:c2'] }, 'consultas'), { id: 'c1' });
    assert.deepEqual(sr.registroDoProcesso({ origem, vinculos: ['consultas:c1', 'expedientes:e9'] }, 'expedientes'), { id: 'e9' });
    assert.deepEqual(sr.registroDoProcesso({ vinculos: ['consultas:c1', 'consultas:c2'] }, 'consultas'), { falta: 'varios' });
    assert.deepEqual(sr.registroDoProcesso({ vinculos: ['pe:x'] }, 'consultas'), { falta: 'nenhum' });
    assert.deepEqual(sr.registroDoProcesso({}, 'consultas'), { falta: 'nenhum' });
});
