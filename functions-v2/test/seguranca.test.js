// Central de segurança: checklist e pontuação. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { montarChecklist } = require('../lib/platform/security');

const agora = Date.parse('2026-11-17T12:00:00Z');
const adm = (o = {}) => ({ uid: 'a', email: 'a@x', nome: 'Ana', ultimo_acesso: '2026-11-10T00:00:00Z', email_verificado: true, dois_fatores: true, ...o });
const base = (o = {}) => ({
    admins: [adm(), adm({ uid: 'b', nome: 'Bia' })], bootstrap: false, flag2fa: true, emailKey: true,
    banco: { pitr: true, protecaoExclusao: true, copiaDiaria: true, retencaoDias: 14 }, termosVersao: 2,
    confirmados: { app_check: { por: 'Ana' }, chave_api: { por: 'Ana' } }, agora, ...o,
});
const item = (r, k) => r.itens.find((i) => i.key === k);

test('tudo em ordem dá 100', () => {
    const r = montarChecklist(base());
    assert.equal(r.pontuacao, 100);
    assert.ok(r.itens.every((i) => i.estado === 'ok'));
});

test('um só administrador e inativo há mais de 90 dias pedem atenção', () => {
    const r = montarChecklist(base({ admins: [adm({ ultimo_acesso: '2026-07-01T00:00:00Z' })] }));
    assert.equal(item(r, 'super_admins').estado, 'atencao');
    assert.equal(item(r, 'admins_inativos').estado, 'atencao');
    assert.match(item(r, 'admins_inativos').detalhe, /Ana/);
});

test('2FA desligado ou sem chave de e-mail é risco; alguém sem 2FA é atenção', () => {
    assert.equal(item(montarChecklist(base({ flag2fa: false })), 'dois_fatores').estado, 'risco');
    assert.equal(item(montarChecklist(base({ emailKey: false })), 'dois_fatores').estado, 'risco');
    const r = montarChecklist(base({ admins: [adm(), adm({ uid: 'b', nome: 'Bia', dois_fatores: false })] }));
    assert.equal(item(r, 'dois_fatores').estado, 'atencao');
    assert.match(item(r, 'dois_fatores').detalhe, /Bia/);
});

test('sem cópia diária é risco; banco não consultado fica fora da conta', () => {
    assert.equal(item(montarChecklist(base({ banco: { pitr: false, protecaoExclusao: false, copiaDiaria: false, retencaoDias: null } })), 'copia_diaria').estado, 'risco');
    const r = montarChecklist(base({ banco: null }));
    assert.equal(item(r, 'copia_diaria').estado, 'desconhecido');
    assert.equal(r.pontuacao, 100, 'desconhecido não pesa');
});

test('itens de console sem confirmação pedem atenção', () => {
    const r = montarChecklist(base({ confirmados: {} }));
    assert.equal(item(r, 'app_check').estado, 'atencao');
    assert.equal(item(r, 'app_check').manual, true);
    assert.ok(r.pontuacao < 100);
});

test('nenhuma Function revoga tokens do Auth compartilhado', () => {
    const raiz = path.join(__dirname, '..', 'src');
    const achados = [];
    const varrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) varrer(p);
        else if (p.endsWith('.ts') && /revokeRefreshTokens\(|disabled:\s*true/.test(fs.readFileSync(p, 'utf8'))) achados.push(p);
    });
    varrer(raiz);
    assert.deepEqual(achados, []);
});
