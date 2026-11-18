// Parte externa: qualidade do representante, visibilidade por polo e tipos de
// petição do órgão. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../lib/shared/representacao');
const a = require('../lib/shared/autos');
const l = require('../lib/shared/listasOrgao');
const { formularioDe } = require('../lib/shared/camposProcesso');

test('representante: advogado informa a OAB e só entra com a procuração conferida', () => {
    assert.throws(() => r.sanitizeRepresentacao({ qualidade: 'advogado', poderes: true }), /OAB/);
    assert.throws(() => r.sanitizeRepresentacao({ qualidade: 'advogado', inscricao: 'OAB/RS 1' }), /procuração/);
    assert.throws(() => r.sanitizeRepresentacao({ qualidade: 'preposto' }), /procuração/);
    assert.deepEqual(r.sanitizeRepresentacao({ qualidade: 'advogado', inscricao: '  OAB/RS   12.345 ', poderes: true, uid: 'x' }), { qualidade: 'advogado', inscricao: 'OAB/RS 12.345', poderes: true });
    // Defensor público e procurador do ente atuam pelo cargo: sem procuração.
    assert.deepEqual(r.sanitizeRepresentacao({ qualidade: 'defensor' }), { qualidade: 'defensor' });
    assert.deepEqual(r.sanitizeRepresentacao({ qualidade: 'procurador', inscricao: 'Matrícula 9' }), { qualidade: 'procurador', inscricao: 'Matrícula 9' });
    // Sem qualidade (ou com uma desconhecida), o representante segue como antes.
    assert.deepEqual(r.sanitizeRepresentacao({ nome: 'Ana' }), {});
    assert.deepEqual(r.sanitizeRepresentacao({ qualidade: 'juiz', poderes: true }), {});
});

test('representante: a qualificação acompanha o nome', () => {
    assert.equal(r.nomeQualificado({ nome: 'Ana Lima', qualidade: 'advogado', inscricao: 'OAB/RS 12.345' }), 'Ana Lima (advogado(a), OAB/RS 12.345)');
    assert.equal(r.nomeQualificado({ nome: 'Rui', qualidade: 'defensor' }), 'Rui (defensor(a) público(a))');
    assert.equal(r.nomeQualificado({ nome: 'Rui' }), 'Rui');
    assert.equal(r.qualificacao({ qualidade: 'outro', inscricao: 'Curador' }), 'Curador');
});

test('documento restrito a um polo: só esse polo vê; sem polo, ninguém', () => {
    const livre = { visivel_partes: true };
    const restrito = { visivel_partes: true, visivel_polos: ['requerido'] };
    assert.equal(a.documentoVisivel(livre, 'interessado'), true);
    assert.equal(a.documentoVisivel(restrito, 'requerido'), true);
    assert.equal(a.documentoVisivel(restrito, 'interessado'), false);
    assert.equal(a.documentoVisivel(restrito, undefined), false);
    // Fora do portal vence qualquer lista de polos.
    assert.equal(a.documentoVisivel({ visivel_partes: false, visivel_polos: ['requerido'] }, 'requerido'), false);
    // Lista vazia ou inválida não restringe.
    assert.equal(a.documentoVisivel({ visivel_polos: [] }, 'interessado'), true);
    assert.equal(a.documentoVisivel({ visivel_polos: 'requerido' }, 'interessado'), true);
});

test('movimento restrito a um polo some do andamento geral e dos outros polos', () => {
    const mov = (dados) => ({ seq: 1, tipo: 'juntada', dados });
    assert.equal(a.visivelParaPartes(mov({})), true);
    assert.equal(a.visivelParaPartes(mov({ visivel_polos: ['requerido'] })), false);
    assert.equal(a.visivelParaPartes(mov({ visivel_polos: ['requerido'] }), 'requerido'), true);
    assert.equal(a.visivelParaPartes(mov({ visivel_polos: ['requerido'] }), 'interessado'), false);
    assert.equal(a.visivelParaPartes(mov({ visivel_partes: false, visivel_polos: ['requerido'] }), 'requerido'), false);
    // Movimento interno segue interno, com ou sem polo.
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'pendencia', dados: {} }, 'requerido'), false);
});

test('a escolha de "quem vê" só aceita polos do processo; todos é o mesmo que sem restrição', () => {
    const polos = ['requerido', 'interessado', 'requerido'];
    assert.deepEqual(a.polosEscolhidos(['requerido'], polos), ['requerido']);
    assert.equal(a.polosEscolhidos(['requerido', 'interessado'], polos), null);
    assert.equal(a.polosEscolhidos(['terceiro'], polos), null);
    assert.equal(a.polosEscolhidos(undefined, polos), null);
    assert.equal(a.polosEscolhidos(['requerido'], ['requerido']), null);
});

test('tipo de processo guarda "cada polo vê só as próprias petições"', () => {
    assert.equal(formularioDe({ formulario: { peticoes_por_polo: true } }).peticoes_por_polo, true);
    assert.equal('peticoes_por_polo' in formularioDe({ formulario: { peticoes_por_polo: 'sim' } }), false);
    assert.equal('peticoes_por_polo' in formularioDe({ formulario: {} }), false);
});

test('tipos de petição: os do sistema, os do órgão e "Outro" no fim', () => {
    const sistema = { comunicacao: [], audiencia: [], origem: [], peticao: l.TIPOS_PETICAO };
    const listas = l.sanitizeListas({ peticao: [{ nome: ' Comprovante de  cumprimento ' }, { nome: 'Proposta de acordo', m: true }] }, sistema);
    assert.deepEqual(listas.peticao.map((x) => x.nome), ['Comprovante de cumprimento', 'Proposta de acordo']);
    assert.equal('m' in listas.peticao[1], false, 'tipo de petição não tem gênero');
    const tipos = l.tiposDePeticao(listas);
    assert.equal(tipos[0], 'Manifestação');
    assert.deepEqual(tipos.slice(-3), ['Comprovante de cumprimento', 'Proposta de acordo', 'Outro']);
    assert.deepEqual(l.tiposDePeticao(undefined), l.TIPOS_PETICAO);
    assert.throws(() => l.sanitizeListas({ peticao: [{ nome: 'Recurso' }] }, sistema), /já existe/);
    assert.equal(l.listaDoTitulo('Tipos de petição:'), 'peticao');
});
