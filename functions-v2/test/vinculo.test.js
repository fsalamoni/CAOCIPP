// Vínculo e suspensão do órgão pela plataforma. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { vinculoBloqueado, orgSuspensa, peSuspensoPlataforma } = require('../lib/shared/vinculo');

test('vínculo bloqueia quando não existe, foi removido ou o órgão está suspenso', () => {
    assert.equal(vinculoBloqueado(undefined), true);
    assert.equal(vinculoBloqueado({ active: false }), true);
    assert.equal(vinculoBloqueado({ active: true, org_suspended: true }), true);
    assert.equal(vinculoBloqueado({ role: 'member' }), false);
    assert.equal(vinculoBloqueado({ active: true, org_suspended: false }), false);
    assert.equal(vinculoBloqueado({ active: true, user_blocked: true }), true);
    assert.equal(vinculoBloqueado({ active: true, user_blocked: false }), false);
});

test('Processo Eletrônico sai do ar com o módulo ou o órgão suspenso', () => {
    assert.equal(orgSuspensa({ platform_suspension: { ativa: true } }), true);
    assert.equal(orgSuspensa({}), false);
    assert.equal(peSuspensoPlataforma({ secretariaConfig: { suspensa_plataforma: true } }), true);
    assert.equal(peSuspensoPlataforma({ platform_suspension: { ativa: true }, secretariaConfig: { enabled: true } }), true);
    assert.equal(peSuspensoPlataforma({ secretariaConfig: { enabled: true } }), false);
});

test('nenhuma Function confere o vínculo de quem pede sem o helper', () => {
    // Quem pede: membershipSnap, requesterMembershipSnap, memSnap ou snap (helpers por módulo).
    const raiz = path.join(__dirname, '..', 'src');
    const achados = [];
    const varrer = (dir) => {
        for (const nome of fs.readdirSync(dir)) {
            const p = path.join(dir, nome);
            if (fs.statSync(p).isDirectory()) varrer(p);
            else if (p.endsWith('.ts') && /\b(membershipSnap|requesterMembershipSnap|memSnap|snap)\.data\(\)\?\.active === false/.test(fs.readFileSync(p, 'utf8'))) achados.push(p);
        }
    };
    varrer(raiz);
    assert.deepEqual(achados, []);
});
