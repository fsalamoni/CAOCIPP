const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeOrgao, orgaosAdministrados, conferirDelegado, MAX_ADMINS_ORGAO } = require('../lib/shared/orgaos');

const o = (id, pai_id = null, admins_uids = []) => sanitizeOrgao({ nome: id, pai_id, admins_uids }, id);
// Entidade -> pres -> dir -> setor; cons fica ao lado de pres.
const base = () => [o('pres', null, ['ana']), o('dir', 'pres'), o('setor', 'dir', ['bia']), o('cons')];

test('admins delegados: só textos, sem repetição e até o limite', () => {
    const x = sanitizeOrgao({ nome: 'A', admins_uids: ['u1', 'u1', '', 7, ...Array.from({ length: 20 }, (_, i) => `x${i}`)] }, 'a');
    assert.equal(x.admins_uids[0], 'u1');
    assert.equal(x.admins_uids.length, MAX_ADMINS_ORGAO);
    assert.deepEqual(sanitizeOrgao({ nome: 'B' }, 'b').admins_uids, []);
});

test('quem administra um órgão administra os subordinados, não os vizinhos', () => {
    assert.deepEqual(orgaosAdministrados(base(), 'ana').sort(), ['dir', 'pres', 'setor']);
    assert.deepEqual(orgaosAdministrados(base(), 'bia'), ['setor']);
    assert.deepEqual(orgaosAdministrados(base(), 'zé'), []);
});

test('delegado: na raiz não muda superior nem admins; abaixo, tudo dentro do que administra', () => {
    const at = base();
    const editar = (id, mud) => ({ ...at.find((x) => x.id === id), ...mud });
    // Raiz da delegação de bia é setor: pode mudar nome, não o superior nem os admins.
    assert.doesNotThrow(() => conferirDelegado(at, 'bia', editar('setor', { nome: 'Setor novo' })));
    assert.throws(() => conferirDelegado(at, 'bia', editar('setor', { pai_id: 'pres' })), /órgão superior/);
    assert.throws(() => conferirDelegado(at, 'bia', editar('setor', { admins_uids: ['bia', 'carla'] })), /quem administra/);
    // Fora do que administra.
    assert.throws(() => conferirDelegado(at, 'bia', editar('dir', { nome: 'X' })), /não administra/);
    assert.throws(() => conferirDelegado(at, 'ana', editar('cons', { nome: 'X' })), /não administra/);
    // Ana: dir fica abaixo da raiz (pres), então move e indica admins dentro de pres.
    assert.doesNotThrow(() => conferirDelegado(at, 'ana', editar('dir', { admins_uids: ['carla'] })));
    assert.throws(() => conferirDelegado(at, 'ana', editar('dir', { pai_id: null })), /superior um órgão que você administra/);
    assert.throws(() => conferirDelegado(at, 'ana', editar('dir', { pai_id: 'cons' })), /superior um órgão que você administra/);
    // Órgão novo: só abaixo do que administra.
    assert.doesNotThrow(() => conferirDelegado(at, 'bia', o('novo', 'setor')));
    assert.throws(() => conferirDelegado(at, 'bia', o('novo', null)), /superior um órgão que você administra/);
});
