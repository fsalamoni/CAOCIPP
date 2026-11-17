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
await db.doc('organizations/org1').set({ name: 'Promotoria de Teste', created_by: adminUid });

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
} finally {
    await browser.close();
}
