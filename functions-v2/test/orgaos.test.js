const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeOrgao, orgaosDe, validarEstrutura, emArvore, nomeOrgao, sanitizeProposta, sanitizeCompetencias, MAX_NIVEIS } = require('../lib/shared/orgaos');

const o = (id, nome, pai_id = null, extra = {}) => sanitizeOrgao({ nome, pai_id, ...extra }, id);

test('órgão: nome obrigatório, natureza e decisão caem no padrão', () => {
    assert.throws(() => sanitizeOrgao({ nome: '  ' }, 'a'), /precisa de um nome/);
    const x = sanitizeOrgao({ nome: ' Presidência ', natureza: 'xx', decisao: 'qualquer', competencias: ['Representar', 'Representar', ' ', 7] }, 'a');
    assert.equal(x.nome, 'Presidência');
    assert.equal(x.natureza, 'outro');
    assert.equal(x.decisao, 'singular');
    assert.deepEqual(x.competencias, ['Representar']);
    assert.equal(x.pai_id, null);
});

test('estrutura: recusa ciclo, superior inexistente, nome repetido no mesmo nível e níveis demais', () => {
    assert.throws(() => validarEstrutura([o('a', 'A', 'b'), o('b', 'B', 'a')]), /abaixo de si mesmo/);
    assert.throws(() => validarEstrutura([o('a', 'A', 'a')]), /abaixo de si mesmo/);
    assert.throws(() => validarEstrutura([o('a', 'A', 'zz')]), /não existe/);
    assert.throws(() => validarEstrutura([o('a', 'Diretoria'), o('b', 'diretoria')]), /Já existe/);
    assert.equal(validarEstrutura([o('a', 'Diretoria'), o('p', 'Presidência'), o('b', 'Diretoria', 'p')]).length, 3);
    const fundo = Array.from({ length: MAX_NIVEIS + 1 }, (_, i) => o(`n${i}`, `Nível ${i}`, i ? `n${i - 1}` : null));
    assert.throws(() => validarEstrutura(fundo), /níveis/);
});

test('organograma: cada órgão seguido dos subordinados, com o nível', () => {
    const lista = [o('dt', 'Diretoria Técnica', 'pres'), o('cg', 'Conselho Geral', null, { ordem: 0 }), o('pres', 'Presidência', 'cg'), o('cf', 'Conselho Fiscal', null, { ordem: 1 })];
    assert.deepEqual(emArvore(lista).map((x) => `${x.nivel}:${x.nome}`), ['1:Conselho Geral', '2:Presidência', '3:Diretoria Técnica', '1:Conselho Fiscal']);
    assert.equal(nomeOrgao(lista, 'pres'), 'Presidência');
    assert.equal(nomeOrgao(lista, null), '');
});

test('leitura tolera lixo gravado', () => {
    assert.deepEqual(orgaosDe([{ id: 'a', nome: 'A' }, { nome: 'sem id' }, null, 'x']).map((x) => x.id), ['a']);
    assert.deepEqual(orgaosDe(undefined), []);
});

test('proposta do assistente: chaves únicas, unidades sem nome saem', () => {
    assert.throws(() => sanitizeProposta([]), /ao menos um/);
    assert.throws(() => sanitizeProposta([{ chave: 'a', nome: 'A' }, { chave: 'a', nome: 'B' }]), /repetidos/);
    const p = sanitizeProposta([{ chave: 'a', nome: 'A', unidades: [{ nome: 'Secretaria', tipo: 'secretaria' }, { nome: '' }, { nome: 'Plenário', tipo: 'inventado' }] }, { chave: 'b', pai_chave: 'a', nome: 'B' }]);
    assert.deepEqual(p[0].unidades.map((u) => `${u.nome}:${u.tipo}`), ['Secretaria:secretaria', 'Plenário:secretaria']);
    assert.equal(p[1].pai_chave, 'a');
    assert.equal(sanitizeCompetencias(Array.from({ length: 40 }, (_, i) => `c${i}`)).length, 20);
});
