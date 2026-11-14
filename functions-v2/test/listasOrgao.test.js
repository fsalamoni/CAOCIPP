// Etapa 5: listas do órgão (espécies de comunicação e de audiência, origens) com o nome guardado.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const l = require('../lib/shared/listasOrgao');
const com = require('../lib/shared/comunicacoes');
const aud = require('../lib/shared/audiencias');
const cr = require('../lib/shared/comunicacaoRito');
const s = require('../lib/shared/secretaria');
const ex = require('../lib/shared/exigencias');

const SISTEMA = { comunicacao: Object.values(com.ESPECIES), audiencia: Object.values(aud.ESPECIES_AUDIENCIA), origem: Object.values(s.ROTULO_ORIGEM) };

test('listas: ids do órgão, nome limpo, gênero só nas espécies, id mantido ao renomear', () => {
    const r = l.sanitizeListas({
        comunicacao: [{ nome: '  Edital ', m: true }, { nome: '' }, { id: 'o_convoca', nome: 'Convocação nova' }],
        audiencia: [{ nome: 'Sessão de mediação' }],
        origem: [{ nome: 'Ouvidoria', m: true }],
    }, SISTEMA);
    assert.deepEqual(r.comunicacao, [{ id: 'o_edital', nome: 'Edital', m: true }, { id: 'o_convoca', nome: 'Convocação nova' }]);
    assert.deepEqual(r.audiencia, [{ id: 'o_sessao_de_mediacao', nome: 'Sessão de mediação' }]);
    assert.deepEqual(r.origem, [{ id: 'o_ouvidoria', nome: 'Ouvidoria' }]);
    // Lista vazia não se grava; lixo vira lista vazia.
    assert.deepEqual(l.sanitizeListas({ comunicacao: [], origem: 'x' }, SISTEMA), {});
    assert.deepEqual(l.listasDe(null, SISTEMA), {});
});

test('listas: nome repetido (mesmo sem acento ou caixa) ou do sistema não entra; limite de itens', () => {
    assert.throws(() => l.sanitizeListas({ comunicacao: [{ nome: 'Edital' }, { nome: 'EDITAL' }] }, SISTEMA), /"EDITAL" já existe/);
    assert.throws(() => l.sanitizeListas({ comunicacao: [{ nome: 'intimacao' }] }, SISTEMA), /Espécies de comunicação: "intimacao" já existe/);
    assert.throws(() => l.sanitizeListas({ origem: Array.from({ length: 31 }, (_, i) => ({ nome: `O${i}` })) }, SISTEMA), /no máximo 30/);
    // Gravado errado no banco: a tela recebe vazio, não quebra.
    assert.deepEqual(l.listasDe({ comunicacao: [{ nome: 'Ciência' }] }, SISTEMA), {});
});

test('espécie de comunicação do órgão: nome e gênero vão junto; sem nome não passa', () => {
    assert.deepEqual(com.especieValida('intimacao', 'X', true, 'erro'), { especie: 'intimacao' });
    assert.deepEqual(com.especieValida('o_edital', ' Edital ', true, 'erro'), { especie: 'o_edital', especie_nome: 'Edital', especie_m: true });
    assert.throws(() => com.especieValida('o_edital', '', false, 'Espécie'), /falta o nome/);
    assert.throws(() => com.especieValida('qualquer', 'X', false, 'Espécie desconhecida'), /Espécie desconhecida/);
    assert.equal(com.nomeDaEspecie({ especie: 'o_edital', especie_nome: 'Edital' }), 'Edital');
    assert.equal(com.nomeDaEspecie({ especie: 'citacao' }), 'Citação');
    assert.deepEqual(com.artigosDaEspecie({ especie: 'o_edital', especie_m: true }), { o: 'o', de: 'do', a: 'ao' });
    assert.deepEqual(com.artigosDaEspecie({ especie: 'intimacao' }), { o: 'a', de: 'da', a: 'à' });
});

test('pedido de comunicação com espécie do órgão: prazo "Responder ao edital"', () => {
    const p = com.sanitizePedido({ especie: 'o_edital', especie_nome: 'Edital', especie_m: true, texto: 'Fica o interessado chamado.', partes_idx: [0], dias: 5 }, '2026-11-16');
    assert.equal(p.especie, 'o_edital');
    assert.equal(p.especie_nome, 'Edital');
    assert.equal(p.especie_m, true);
    const c = { ...p, id: 'c1', parte_idx: 0, parte_nome: 'Fulano', status: 'aguardando' };
    const r = com.aplicarCiencia(c, '2026-11-17', '2026-11-17T12:00:00Z', 'u1', 'portal', 'p1');
    assert.equal(r.prazo.descricao, 'Responder ao edital');
    const f = com.aplicarCiencia({ ...c, especie: 'intimacao', especie_nome: undefined, especie_m: undefined }, '2026-11-17', '2026-11-17T12:00:00Z', 'u1', 'portal', 'p2');
    assert.equal(f.prazo.descricao, 'Responder à intimação');
});

test('ação do rito: comunicação e audiência do órgão guardam nome e gênero', () => {
    const c = cr.sanitizeComunicacaoDaAcao({ especie: 'o_edital', especie_nome: 'Edital', especie_m: true, dias: 0 }, 'Publicar edital');
    assert.equal(c.especie, 'o_edital');
    assert.equal(c.especie_nome, 'Edital');
    assert.equal(c.especie_m, true);
    assert.throws(() => cr.sanitizeComunicacaoDaAcao({ especie: 'o_edital' }, 'Publicar edital'), /falta o nome/);
    assert.deepEqual(aud.sanitizeAudienciaDaAcao({ especie: 'o_sessao', especie_nome: 'Sessão de mediação' }, 'Designar'), { especie: 'o_sessao', especie_nome: 'Sessão de mediação' });
    assert.deepEqual(aud.sanitizeAudienciaDaAcao({ especie: 'oitiva', especie_nome: 'X' }, 'Designar'), { especie: 'oitiva' });
    assert.throws(() => aud.sanitizeAudienciaDaAcao({ especie: 'nada' }, 'Designar'), /espécie desconhecida/);
    assert.equal(aud.nomeDaAudiencia({ especie: 'o_sessao', especie_nome: 'Sessão de mediação' }), 'Sessão de mediação');
    assert.equal(aud.designadaDe({ especie_m: true }), 'designado');
    assert.equal(aud.designadaDe({ especie: 'oitiva' }), 'designada');
});

test('origem do órgão: guarda o nome; texto e condição do rito a usam', () => {
    assert.deepEqual(s.sanitizeOrigem({ tipo: 'o_ouvidoria', nome: 'Ouvidoria', descricao: 'Manifestação 12/2026' }), { tipo: 'o_ouvidoria', nome: 'Ouvidoria', descricao: 'Manifestação 12/2026' });
    assert.throws(() => s.sanitizeOrigem({ tipo: 'o_ouvidoria' }), /falta o nome/);
    // As de sempre seguem iguais.
    assert.deepEqual(s.sanitizeOrigem({ tipo: 'oficio', nome: 'X', descricao: '' }), { tipo: 'oficio', descricao: '' });
    assert.match(s.textoOrigem({ tipo: 'o_ouvidoria', nome: 'Ouvidoria', descricao: 'Manifestação 12/2026' }), /^Ouvidoria/);
    const f = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'a', nome: 'A', acoes: ['X'], proximas: ['b', 'c'], condicoes_regra: { b: { dado: 'origem', valores: ['o_ouvidoria', 'oficio', 'nao_existe'], nomes: ['Ouvidoria', 'Ofício', 'Y'] } } },
        { id: 'b', nome: 'B' }, { id: 'c', nome: 'C' },
    ] }).fases;
    const cond = f[0].condicoes_regra.b;
    assert.deepEqual(cond.valores, ['o_ouvidoria', 'oficio']);
    assert.match(ex.textoDaCondicao(f[0], cond, f), /Ouvidoria/);
    assert.equal(ex.respostasDaFase({ fase_atual: 'a', origem: { tipo: 'o_ouvidoria', nome: 'Ouvidoria' } })['@origem'], 'o_ouvidoria');
});

test('histórico: salvar listas tem assunto próprio', () => {
    assert.equal(s.assuntoHistorico('SECRETARIA_LISTAS', {}), 'listas');
});
