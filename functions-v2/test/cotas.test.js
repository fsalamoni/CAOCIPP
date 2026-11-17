// Cotas da plataforma: leitura com padrão, recusa e teto de importação. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { lerCota, exigirDentroDaCota, limiteImportacao, limparCacheCotas, QUOTA_DEFS } = require('../lib/shared/cotas');

const banco = (values) => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => (values ? { values } : undefined) }) }) }) });

test('sem nada gravado, vale o padrão', async () => {
    limparCacheCotas();
    assert.equal(await lerCota('max_members_per_org', banco(null)), 500);
});

test('valor gravado vale; fora da faixa volta ao padrão', async () => {
    limparCacheCotas();
    assert.equal(await lerCota('max_members_per_org', banco({ max_members_per_org: 40 })), 40);
    limparCacheCotas();
    assert.equal(await lerCota('max_members_per_org', banco({ max_members_per_org: 1 })), 500);
});

test('passar do limite é recusado com resource-exhausted', async () => {
    limparCacheCotas();
    const db = banco({ max_orgs_per_user: 2 });
    await exigirDentroDaCota('max_orgs_per_user', 1, 1, db);
    await assert.rejects(exigirDentroDaCota('max_orgs_per_user', 2, 1, db), (e) => e.code === 'resource-exhausted' && /máximo 2/.test(e.message));
});

test('importação nunca passa do teto técnico', async () => {
    limparCacheCotas();
    assert.equal(await limiteImportacao(5000, banco({ max_import_rows: 20000 })), 5000);
    limparCacheCotas();
    assert.equal(await limiteImportacao(20000, banco({ max_import_rows: 300 })), 300);
});

test('toda cota do catálogo é conferida em alguma Function', () => {
    const src = path.join(__dirname, '..', 'src');
    const codigo = [];
    const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) andar(p); else if (p.endsWith('.ts') && !p.endsWith('cotas.ts') && !p.endsWith('quotas.ts')) codigo.push(fs.readFileSync(p, 'utf8'));
    });
    andar(src);
    const tudo = codigo.join('\n');
    for (const q of QUOTA_DEFS) {
        const usada = q.key === 'max_import_rows' ? tudo.includes('limiteImportacao(') : tudo.includes(`'${q.key}'`);
        assert.ok(usada, `cota ${q.key} não é aplicada em nenhuma Function`);
    }
});
