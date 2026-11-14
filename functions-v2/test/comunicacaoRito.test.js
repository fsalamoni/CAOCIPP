const test = require('node:test');
const assert = require('node:assert/strict');
const cr = require('../lib/shared/comunicacaoRito');
const { sanitizeRegras, opcoesDaResposta, respondeNaRodada } = require('../lib/shared/exigencias');

const partes = [
    { nome: 'Servidor A', polo: 'requerido' },
    { nome: 'Denunciante', polo: 'requerente' },
    { nome: 'Servidor B', polo: 'requerido' },
    { nome: 'Saiu', polo: 'requerido', retirada: { em: 'x' } },
];
const fase = {
    id: 'def', nome: 'Defesa', acoes: ['Citar os acusados', 'Aguardar a defesa'],
    acoes_regras: [
        { pede: 'comunicacao', obrigatoria: true, comunicacao: { especie: 'citacao', polos: ['requerido'], dias: 10, texto: 'Apresente defesa.' } },
        { pede: 'resposta', obrigatoria: true, resposta: { de: 0 } },
    ],
};
const com = (id, parte_idx, extra = {}) => ({ id, especie: 'citacao', texto: 't', parte_idx, parte_nome: partes[parte_idx].nome, dias: 10, contagem: 'uteis',
    expedida_em: '2026-11-02T12:00:00Z', expedida_por: 'Ana', unidade_id: 'u', limite_ciencia: null, status: 'ciente', fase_id: 'def', acao_idx: 0, ...extra });

test('rito: a ação comunica (espécie, polos, prazo, texto) e a outra espera a resposta dela', () => {
    const r = sanitizeRegras({ acoes_regras: [
        { pede: 'comunicacao', comunicacao: { especie: 'intimacao', polos: ['requerido'], dias: '15', contagem: 'corridos', texto: ' Manifeste-se. ' }, destino: 'autos', partes: true },
        { pede: 'resposta', resposta: { de: 0 } },
    ] }, ['Intimar', 'Aguardar']);
    assert.deepEqual(r.acoes_regras[0], { pede: 'comunicacao', comunicacao: { especie: 'intimacao', dias: 15, polos: ['requerido'], contagem: 'corridos', texto: 'Manifeste-se.' } },
        'o registro são as próprias comunicações: sem destino nem partes na regra');
    assert.deepEqual(r.acoes_regras[1], { pede: 'resposta', resposta: { de: 0 } });
    assert.deepEqual(cr.sanitizeComunicacaoDaAcao({ especie: 'notificacao', polos: ['requerente', 'requerido', 'interessado', 'terceiro'] }, 'X'), { especie: 'notificacao', dias: 0 }, 'todos os polos = todas as partes; sem prazo');
    assert.throws(() => cr.sanitizeComunicacaoDaAcao({ especie: 'carta' }, 'X'), /espécie/);
    assert.throws(() => cr.sanitizeComunicacaoDaAcao({ especie: 'citacao', polos: ['juiz'] }, 'X'), /polo desconhecido/);
    assert.throws(() => cr.sanitizeComunicacaoDaAcao({ especie: 'citacao', dias: 4000 }, 'X'), /prazo de resposta/);
    const espera = (regras) => () => sanitizeRegras({ acoes_regras: regras }, ['A', 'B']);
    assert.throws(espera([{ pede: 'comunicacao', comunicacao: { especie: 'ciencia', dias: 0 } }, { pede: 'resposta', resposta: { de: 0 } }]), /com prazo de resposta/, 'sem prazo não há o que esperar');
    assert.throws(espera([{ pede: 'resposta', resposta: { de: 1 } }, { pede: 'comunicacao', comunicacao: { especie: 'citacao', dias: 5 } }]), /ação anterior/);
    assert.throws(espera([{ pede: 'confirmar' }, { pede: 'resposta', resposta: { de: 0 } }]), /comunica/);
    assert.deepEqual(opcoesDaResposta(fase.acoes_regras[1]), ['Apresentada', 'Parcial', 'Sem manifestação']);
    assert.equal(respondeNaRodada(fase.acoes_regras[1]), true, 'a resposta vale nas condições e saídas');
    assert.equal(opcoesDaResposta(fase.acoes_regras[0]), null);
});

test('comunicação: alcança só o polo pedido, sem as partes retiradas; cumpre-se quando todas foram comunicadas', () => {
    assert.deepEqual(cr.alvosDaComunicacao(fase.acoes_regras[0].comunicacao, partes), [0, 2]);
    assert.deepEqual(cr.alvosDaComunicacao({ especie: 'ciencia', dias: 0 }, partes), [0, 1, 2]);
    const proc = { fase_atual: 'def', partes, comunicacoes: [com('c1', 0)] };
    assert.equal(cr.comunicacaoCumprida(fase, 0, partes, proc.comunicacoes), false, 'falta o Servidor B');
    assert.equal(cr.sincronizarComunicacoes(proc, fase, '2026-11-03'), null, 'nada a mudar');
    const ambas = { ...proc, comunicacoes: [com('c1', 0), com('c2', 2)] };
    const s = cr.sincronizarComunicacoes(ambas, fase, '2026-11-03');
    assert.deepEqual([s.acoes_feitas, s.novas], [{ def: [0] }, [0]]);
    assert.match(s.notas[0], /"Citar os acusados" cumprida: a comunicação alcançou todas as partes previstas/);
    // Tornada sem efeito uma delas: a ação volta a ficar por cumprir.
    const semEfeito = { ...ambas, acoes_feitas: s.acoes_feitas, comunicacoes: [com('c1', 0), com('c2', 2, { status: 'sem_efeito' })] };
    const v = cr.sincronizarComunicacoes(semEfeito, fase, '2026-11-03');
    assert.deepEqual(v.acoes_feitas, { def: [] });
    assert.match(v.notas[0], /voltou a ficar por cumprir/);
    // Comunicação de outra rodada (a fase foi deixada e voltou) não conta.
    assert.equal(cr.comunicacaoCumprida(fase, 0, partes, [com('c1', 0, { rodada_fim: true }), com('c2', 2)]), false);
});

test('resposta: espera enquanto corre o prazo; apresentada, sem manifestação ou parcial quando ninguém mais pode responder', () => {
    const s = (lista, hoje = '2026-11-20') => cr.situacaoDaResposta(fase, 1, lista, hoje);
    const aguardando = com('c2', 2, { status: 'aguardando' }); // sem ciência: o prazo nem abriu
    assert.equal(s([com('c1', 0, { vence_em: '2026-11-25' }), aguardando]).valor, null);
    assert.equal(s([com('c1', 0, { vence_em: '2026-11-20' })]).valor, null, 'vence hoje: ainda pode responder');
    assert.equal(s([com('c1', 0, { vence_em: '2026-11-19' })]).valor, 'Sem manifestação');
    assert.equal(s([com('c1', 0, { vence_em: '2026-11-25', respondida_em: 'x' }), com('c2', 2, { vence_em: '2026-11-25', respondida_em: 'y' })]).valor, 'Apresentada');
    assert.equal(s([com('c1', 0, { vence_em: '2026-11-19', respondida_em: 'x' }), com('c2', 2, { vence_em: '2026-11-19' })]).valor, 'Parcial');
    assert.equal(s([]).valor, null, 'sem comunicação, não há o que esperar');
    const proc = { fase_atual: 'def', partes, acoes_feitas: { def: [0] }, comunicacoes: [com('c1', 0, { vence_em: '2026-11-19' }), com('c2', 2, { vence_em: '2026-11-19', respondida_em: 'y' })] };
    const r = cr.sincronizarComunicacoes(proc, fase, '2026-11-20');
    assert.deepEqual([r.acoes_feitas, r.acoes_respostas, r.novas], [{ def: [0, 1] }, { def: { 1: 'Parcial' } }, [1]]);
    assert.match(r.notas[0], /"Aguardar a defesa" cumprida pela regra do rito: parcial/);
    assert.equal(cr.sincronizarComunicacoes({ ...proc, acoes_feitas: r.acoes_feitas, acoes_respostas: r.acoes_respostas }, fase, '2026-11-21'), null, 'uma vez só');
});

test('manifestação da parte: responde no prazo à comunicação esperada; depois do prazo, não', () => {
    const lista = [com('c1', 0, { vence_em: '2026-11-19' }), com('c2', 2, { vence_em: '2026-11-25' }), com('c3', 2, { acao_idx: 5, vence_em: '2026-11-25' })];
    assert.deepEqual(cr.respondidasPela(fase, 2, lista, '2026-11-20'), ['c2'], 'só a da ação que alguém espera');
    assert.deepEqual(cr.respondidasPela(fase, 0, lista, '2026-11-20'), [], 'perdeu o prazo');
    assert.deepEqual(cr.respondidasPela(fase, 2, [com('c2', 2, { status: 'aguardando' })], '2026-11-20'), ['c2'], 'antes da ciência também vale');
    assert.deepEqual(cr.respondidasPela(fase, -1, lista, '2026-11-20'), []);
    assert.deepEqual(cr.decursosACertificar(fase, lista, '2026-11-20').map((x) => x.id), ['c1']);
    assert.deepEqual(cr.decursosACertificar(fase, [com('c1', 0, { vence_em: '2026-11-19', decurso_certificado: '2026-11-20' })], '2026-11-21'), [], 'certidão uma vez só');
});

test('espera e saída da fase: a fase de origem segue esperando; ao sair, a rodada termina', () => {
    const espera = { id: 'dil', espera: true };
    const proc = { fase_atual: 'dil', espera: { fase: 'def' }, fases: [fase, espera] };
    assert.equal(cr.faseQueEspera(proc).id, 'def');
    assert.equal(cr.faseQueEspera({ ...proc, espera: null, fase_atual: 'def' }).id, 'def');
    const lista = [com('c1', 0, { vence_em: '2026-11-25' })];
    assert.equal(cr.aguardaResposta({ comunicacoes: lista }, fase), true);
    assert.equal(cr.aguardaResposta({ comunicacoes: lista, acoes_feitas: { def: [1] } }, fase), false, 'já cumprida');
    assert.equal(cr.aguardaResposta({ comunicacoes: [] }, fase), false, 'ninguém comunicado ainda');
    const fim = cr.encerrarComunicacoesDaFase([...lista, com('x', 1, { fase_id: 'outra' })], 'def');
    assert.deepEqual(fim.map((x) => x.rodada_fim === true), [true, false]);
    assert.equal(cr.encerrarComunicacoesDaFase(fim, 'def'), null, 'nada mais a encerrar');
    assert.equal(cr.encerrarComunicacoesDaFase(lista, null), null, 'autuação');
});
