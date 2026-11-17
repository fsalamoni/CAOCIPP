// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    PLATFORM_GROUPS, PLATFORM_SECTIONS, findPlatformSection, platformAlerts, searchPlatformSections,
} from './platformAdminSections.js';

test('toda seção tem grupo conhecido, chave única e componente na página', () => {
    const grupos = PLATFORM_GROUPS.map((g) => g.key);
    const chaves = PLATFORM_SECTIONS.map((s) => s.key);
    assert.equal(new Set(chaves).size, chaves.length);
    const pagina = readFileSync(new URL('../pages/Admin.jsx', import.meta.url), 'utf8');
    for (const s of PLATFORM_SECTIONS) {
        assert.ok(grupos.includes(s.group), s.key);
        assert.ok(s.label && s.description && s.icon, s.key);
        assert.match(pagina, new RegExp(`\\b${s.key}: [A-Z]`), `${s.key} sem componente em Admin.jsx`);
    }
    for (const g of PLATFORM_GROUPS) assert.ok(PLATFORM_SECTIONS.some((s) => s.group === g.key), `grupo ${g.key} vazio`);
});

test('busca acha por palavra-chave, sem acento e sem caixa', () => {
    assert.deepEqual(searchPlatformSections(PLATFORM_SECTIONS, 'BIGQUERY').map((s) => s.key).sort(), ['costs', 'setup']);
    assert.ok(searchPlatformSections(PLATFORM_SECTIONS, 'organizacoes').some((s) => s.key === 'orgs'));
    assert.equal(searchPlatformSections(PLATFORM_SECTIONS, '').length, PLATFORM_SECTIONS.length);
    assert.equal(searchPlatformSections(PLATFORM_SECTIONS, 'xyzinexistente').length, 0);
});

test('seção desconhecida no endereço cai na visão geral', () => {
    assert.equal(findPlatformSection('nada'), null);
    assert.equal(findPlatformSection(null), null);
    assert.equal(findPlatformSection('costs').label, 'Custos e uso');
});

test('pendências apontam para seções que existem', () => {
    assert.deepEqual(platformAlerts(null), []);
    const tudoOk = { emailApiKeyConfigured: true, emailFromConfigured: true, billingExportConfigured: true, platformAdminBootstrapConfigured: true };
    assert.deepEqual(platformAlerts(tudoOk), []);
    const nada = platformAlerts({});
    assert.equal(nada.length, 4);
    for (const a of nada) assert.ok(findPlatformSection(a.section), a.key);
    assert.deepEqual(nada.filter((a) => a.tone === 'warn').map((a) => a.key), ['emailKey', 'emailFrom']);
});
