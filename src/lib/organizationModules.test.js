// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOrganizationTabs, orgTabUrl, PROCESSO_ELETRONICO_TAB } from './organizationModules.js';

const chaves = (org, opts) => getOrganizationTabs(org, opts).map((t) => t.key);

test('Processo Eletrônico entra nas abas do órgão só quando o módulo está ligado', () => {
    assert.ok(!chaves({}).includes(PROCESSO_ELETRONICO_TAB));
    assert.ok(!chaves({ secretariaConfig: { enabled: false } }).includes(PROCESSO_ELETRONICO_TAB));
    const ligado = chaves({ secretariaConfig: { enabled: true } });
    assert.ok(ligado.includes(PROCESSO_ELETRONICO_TAB));
    // Fica antes do Painel Administrativo, que segue sendo a última.
    assert.equal(ligado.at(-1), 'admin');
    assert.equal(ligado.at(-2), PROCESSO_ELETRONICO_TAB);
    // Independe do moduleConfig e da flag de páginas personalizadas.
    assert.ok(chaves({ secretariaConfig: { enabled: true }, moduleConfig: {} }, { customEntitiesOn: true }).includes(PROCESSO_ELETRONICO_TAB));
});

test('orgTabUrl leva o Processo Eletrônico à página própria e as demais a /Organization', () => {
    const [pe] = getOrganizationTabs({ secretariaConfig: { enabled: true } }).filter((t) => t.key === PROCESSO_ELETRONICO_TAB);
    assert.equal(orgTabUrl(pe, 'o1'), '/ProcessoEletronico?org=o1');
    assert.equal(orgTabUrl({ key: 'kanban' }, 'o1'), '/Organization?id=o1&tab=kanban');
});

test('calendário aparece só com o Processo Eletrônico ativo (sem Consultas/Expedientes/Parcerias)', () => {
    const org = { moduleConfig: {}, secretariaConfig: { enabled: true } };
    const tem = (o, on = true) => getOrganizationTabs(o, { customEntitiesOn: true, deadlineCalendarOn: on }).some((t) => t.key === 'calendar');
    assert.equal(tem(org), true);
    assert.equal(tem({ moduleConfig: {} }), false);
    assert.equal(tem(org, false), false);
    assert.equal(tem({ moduleConfig: {}, secretariaConfig: { enabled: true, suspensa_plataforma: true } }), false);
});
