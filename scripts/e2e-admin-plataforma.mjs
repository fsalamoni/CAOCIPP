// E2E da Administração da plataforma nos emuladores (auth, firestore, functions), com o site em modo dev:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (em outro terminal)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-admin-plataforma.mjs"
// Confere: quem não é super-admin vê "Acesso restrito"; o super-admin vê a visão geral com as
// pendências, abre uma seção pelo menu e pelo link (?secao=), busca acha seção e o celular usa o seletor.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const admin = req('firebase-admin');
const { chromium } = createRequire(import.meta.url)('playwright');

const PROJ = 'demo-sigo';
const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();

const criar = async (email) => (await admin.auth().createUser({ email, password: 'segredo123', emailVerified: true, displayName: email.split('@')[0] })).uid;
const adminUid = await criar('super@teste.dev');
await criar('comum@teste.dev');
await db.doc(`platformAdmins/${adminUid}`).set({ active: true, email: 'super@teste.dev' });
await db.doc(`users/${adminUid}`).set({ email: 'super@teste.dev', full_name: 'Super Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Promotoria de Teste', created_by: 'dono' });
// Órgão com criador e um membro (o membro é o "comum", que não é super-admin).
const comumUid = (await admin.auth().getUserByEmail('comum@teste.dev')).uid;
await db.doc(`users/${comumUid}`).set({ email: 'comum@teste.dev', full_name: 'Maria Membro', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
const donoUid = await criar('dono@teste.dev');
const vinculo = (uid, nome, role) => db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', user_name: nome, user_email: `${nome}@teste.dev`, role, active: true, joined_at: new Date() });
await vinculo(donoUid, 'Dono', 'creator');
await vinculo(comumUid, 'Maria Membro', 'member');
await db.doc('processes/pp1').set({ organization_id: 'org1', title: 'Consulta' });

// Entra pelo mesmo módulo do Firebase que o app usa (o Vite serve as deps com hash na URL).
async function entrar(page, email) {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async ([e]) => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(url);
        await signInWithEmailAndPassword(cfg.auth, e, 'segredo123');
    }, [email]);
}

const browser = await chromium.launch();
try {
    // 1) Usuário comum.
    const c = await browser.newPage();
    await entrar(c, 'comum@teste.dev');
    await c.goto(`${SITE}/Admin`);
    await c.getByText('Acesso restrito').waitFor({ timeout: 30000 });
    console.log('ok 1: quem não é super-admin vê "Acesso restrito"');
    await c.close();

    // 2) Super-admin no computador.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await entrar(p, 'super@teste.dev');
    await p.goto(`${SITE}/Admin`);
    await p.getByText('Tudo o que vale para o SIGO inteiro').waitFor({ timeout: 30000 });
    await p.getByText(/pendências? de configuração/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${SHOTS}/admin-visao-geral.png`, fullPage: true });
    console.log('ok 2: visão geral com pendências');

    await p.getByRole('navigation', { name: 'Seções da administração da plataforma' }).getByRole('button', { name: 'Saúde do sistema' }).click();
    await p.getByRole('heading', { name: 'Saúde do sistema', level: 2 }).waitFor();
    assert.match(p.url(), /secao=health/);
    await p.reload();
    await p.getByRole('heading', { name: 'Saúde do sistema', level: 2 }).waitFor({ timeout: 30000 });
    console.log('ok 3: seção abre pelo menu e volta pelo link');

    await p.getByLabel('Buscar seção da administração da plataforma').fill('bigquery');
    await p.getByText('2 seções encontradas').waitFor();
    await p.screenshot({ path: `${SHOTS}/admin-busca.png` });
    console.log('ok 4: busca acha seção');
    await ctx.close();

    // 3) Celular, tema escuro.
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true });
    const mp = await m.newPage();
    await entrar(mp, 'super@teste.dev');
    await mp.goto(`${SITE}/Admin`);
    await mp.getByLabel('Seção da administração da plataforma', { exact: true }).selectOption('orgs');
    await mp.getByRole('heading', { name: 'Órgãos', level: 2 }).waitFor({ timeout: 30000 });
    await mp.waitForTimeout(1500);
    await mp.screenshot({ path: `${SHOTS}/admin-celular-orgaos.png`, fullPage: true });
    const larg = await mp.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(larg <= 390, `rolagem lateral no celular: ${larg}px`);
    console.log('ok 5: celular usa o seletor, sem rolagem lateral');

    // 4) Ficha do órgão no celular: lista mostra o órgão, a ficha abre pelo link.
    await mp.getByRole('button', { name: /Promotoria de Teste/ }).click();
    await mp.getByRole('heading', { name: 'Promotoria de Teste', level: 3 }).waitFor({ timeout: 60000 });
    assert.match(mp.url(), /orgao=org1/);
    await mp.getByText('Maria Membro').first().waitFor();
    await mp.screenshot({ path: `${SHOTS}/admin-celular-ficha.png`, fullPage: true });
    assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'ficha sem rolagem lateral');
    console.log('ok 6: lista mostra o órgão e a ficha abre no celular');
    await m.close();

    // 5) Suspender no computador; o membro vê o aviso e não lê o órgão; reativar devolve.
    const d = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const dp = await d.newPage();
    await entrar(dp, 'super@teste.dev');
    await dp.goto(`${SITE}/Admin?secao=orgs&orgao=org1`);
    await dp.getByRole('button', { name: 'Suspender' }).click();
    await dp.getByLabel('Motivo (os membros vão ler este texto)').fill('Órgão em reestruturação.');
    await dp.getByRole('dialog').getByRole('button', { name: 'Suspender' }).click();
    await dp.getByText('Motivo mostrado aos membros: Órgão em reestruturação.').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-ficha-suspensa.png`, fullPage: true });
    const v = (await db.doc(`userOrganizations/${comumUid}_org1`).get()).data();
    assert.equal(v.org_suspended, true);
    console.log('ok 7: suspensão marca os vínculos e aparece na ficha');

    const mb = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const mbp = await mb.newPage();
    await entrar(mbp, 'comum@teste.dev');
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste está suspenso').waitFor({ timeout: 60000 });
    await mbp.getByText('Órgão em reestruturação.').waitFor();
    await mbp.screenshot({ path: `${SHOTS}/membro-orgao-suspenso.png` });
    console.log('ok 8: membro vê o aviso de órgão suspenso com o motivo');

    await dp.getByRole('button', { name: 'Reativar' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Reativar' }).click();
    await dp.getByText('Ativo', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().org_suspended, undefined);
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste', { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(await mbp.getByText('está suspenso').count(), 0);
    console.log('ok 9: reativar devolve o acesso');

    // Trocar criador: o membro vira criador e o anterior vira administrador.
    await dp.getByRole('button', { name: 'Trocar criador' }).click();
    await dp.getByLabel('Novo criador').selectOption(comumUid);
    await dp.getByRole('dialog').getByRole('button', { name: 'Trocar criador' }).click();
    await dp.getByText('criador: Maria Membro').waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${donoUid}_org1`).get()).data().role, 'admin');
    assert.equal((await db.doc('organizations/org1').get()).data().created_by, comumUid);
    console.log('ok 10: trocar criador');

    // Pessoas: só quem é do SIGO aparece (conta de outro sistema, não).
    await criar('outroapp@teste.dev');
    await dp.goto(`${SITE}/Admin?secao=users`);
    await dp.getByRole('button', { name: /Maria Membro/ }).waitFor({ timeout: 60000 });
    assert.equal(await dp.getByText('outroapp@teste.dev').count(), 0, 'conta de outro sistema não aparece');
    await dp.screenshot({ path: `${SHOTS}/admin-pessoas.png`, fullPage: true });
    console.log('ok 11: lista só pessoas do SIGO');

    // Super-admin não bloqueia a si mesmo.
    await dp.goto(`${SITE}/Admin?secao=users&pessoa=${adminUid}`);
    await dp.getByText('Esta é a sua conta: você não pode bloquear a si mesmo.').waitFor({ timeout: 60000 });
    assert.equal(await dp.getByRole('button', { name: 'Bloquear no SIGO' }).isDisabled(), true);

    // Bloquear a Maria: vínculos marcados, ela vê o aviso; desbloquear devolve.
    await dp.goto(`${SITE}/Admin?secao=users&pessoa=${comumUid}`);
    await dp.getByRole('button', { name: 'Bloquear no SIGO' }).click();
    await dp.getByLabel('Motivo (a pessoa vai ler este texto)').fill('Desligada da instituição.');
    await dp.getByRole('dialog').getByRole('button', { name: 'Bloquear' }).click();
    await dp.getByText('Motivo mostrado à pessoa: Desligada da instituição.').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-pessoa-bloqueada.png`, fullPage: true });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().user_blocked, true);
    assert.equal((await db.doc(`platformBlocks/${comumUid}`).get()).data().ativa, true);
    console.log('ok 12: bloqueio marca os vínculos e aparece na ficha');

    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Seu acesso ao SIGO está bloqueado').waitFor({ timeout: 60000 });
    await mbp.getByText('Desligada da instituição.').waitFor();
    await mbp.screenshot({ path: `${SHOTS}/pessoa-bloqueada.png` });
    console.log('ok 13: a pessoa bloqueada vê o aviso com o motivo');

    await dp.getByRole('button', { name: 'Desbloquear' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Desbloquear' }).click();
    await dp.getByText('Ativa', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().user_blocked, undefined);
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste', { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(await mbp.getByText('está bloqueado').count(), 0);
    console.log('ok 14: desbloquear devolve o acesso');
} finally {
    await browser.close();
}
