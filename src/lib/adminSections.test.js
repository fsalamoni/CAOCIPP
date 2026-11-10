// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_GROUPS, ADMIN_SECTIONS, resolveAdminSections, searchAdminSections } from './adminSections.js';
import { ORG_PERMISSION_KEYS, ORG_PERMISSIONS, ORG_PERMISSION_GROUPS } from '../constants/orgPermissions.js';
import { getOrganizationTabs, getModuleOrder } from './organizationModules.js';

const TODAS = {
    customEntities: true, jurimetria: true, panorama: true, stageTime: true, goals: true,
    escalation: true, reports: true, accessLog: true, retention: true, webhooks: true,
};
const chaves = (args) => resolveAdminSections(args).map((s) => s.key);

test('toda seção pertence a um grupo conhecido e toda permissão usada existe', () => {
    const grupos = ADMIN_GROUPS.map((g) => g.key);
    for (const s of ADMIN_SECTIONS) {
        assert.ok(grupos.includes(s.group), s.key);
        if (s.permission) assert.ok(ORG_PERMISSION_KEYS.includes(s.permission), s.key);
    }
    const gruposPerm = ORG_PERMISSION_GROUPS.map((g) => g.key);
    for (const p of ORG_PERMISSIONS) assert.ok(gruposPerm.includes(p.group), p.key);
});

test('criador vê tudo; quem não tem atribuição não vê nada', () => {
    assert.equal(chaves({ membership: { role: 'creator' }, organization: {}, flags: TODAS }).length, ADMIN_SECTIONS.length);
    assert.deepEqual(chaves({ membership: { role: 'member' }, organization: {}, flags: TODAS }), []);
    assert.deepEqual(chaves({ membership: null, organization: {}, flags: TODAS }), []);
});

test('membro delegado vê só as áreas liberadas e nunca as exclusivas do criador', () => {
    const membership = { role: 'member', permissions: { configure_automation: true, manage_matters: true } };
    assert.deepEqual(chaves({ membership, organization: {}, flags: TODAS }), ['matters', 'stagetime', 'automation']);
    const tudo = { role: 'member', permissions: Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, true])) };
    const vistas = chaves({ membership: tudo, organization: {}, flags: TODAS });
    for (const exclusiva of ['members', 'permissions', 'security', 'danger']) assert.ok(!vistas.includes(exclusiva), exclusiva);
});

test('flag global desligada esconde a seção; módulo desligado só marca moduleOff', () => {
    const criador = { role: 'creator' };
    const semFlags = chaves({ membership: criador, organization: {}, flags: {} });
    for (const k of ['modules', 'jurimetria', 'panorama', 'stagetime', 'automation', 'security']) assert.ok(!semFlags.includes(k), k);
    assert.ok(chaves({ membership: criador, organization: {}, flags: { reports: true } }).includes('automation'));

    const org = { moduleConfig: { processes: { enabled: true }, expedientes: { enabled: false } } };
    const por = Object.fromEntries(resolveAdminSections({ membership: criador, organization: org, flags: TODAS }).map((s) => [s.key, s]));
    assert.equal(por.matters.moduleOff, false);
    assert.equal(por.expedientes.moduleOff, true);
    assert.equal(por.jurimetria.moduleOff, true);
    // Órgão legado (sem moduleConfig) e flag de páginas desligada: nada desligado.
    assert.ok(resolveAdminSections({ membership: criador, organization: {}, flags: TODAS }).every((s) => !s.moduleOff));
    assert.ok(resolveAdminSections({ membership: criador, organization: org, flags: { ...TODAS, customEntities: false } }).every((s) => !s.moduleOff));
});

test('busca ignora acento e caixa e olha palavras-chave', () => {
    const todas = resolveAdminSections({ membership: { role: 'creator' }, organization: {}, flags: TODAS });
    assert.deepEqual(searchAdminSections(todas, 'CONVITE').map((s) => s.key), ['members']);
    assert.ok(searchAdminSections(todas, 'materias').some((s) => s.key === 'matters'));
    assert.deepEqual(searchAdminSections(todas, 'xyzzy'), []);
    assert.equal(searchAdminSections(todas, '  ').length, todas.length);
});

test('ordem dos módulos: padrão sem config, e moduleConfig.order reordena as abas', () => {
    assert.deepEqual(getModuleOrder({}), ['processes', 'expedientes', 'parcerias', 'jurimetria', 'panorama', 'summary', 'calendar']);
    const org = { moduleConfig: {
        processes: { enabled: true, order: 1 }, expedientes: { enabled: true, order: 0 }, summary: { enabled: true },
    } };
    assert.deepEqual(getModuleOrder(org).slice(0, 2), ['expedientes', 'processes']);
    const abas = getOrganizationTabs(org, { customEntitiesOn: true }).map((t) => t.key);
    assert.deepEqual(abas, ['info', 'kanban-expedientes', 'expedientes', 'kanban', 'processes', 'summary', 'admin']);
    // Com a flag de páginas personalizadas desligada, a ordem gravada é ignorada.
    assert.deepEqual(getOrganizationTabs(org).map((t) => t.key).slice(0, 3), ['info', 'kanban', 'processes']);
});
