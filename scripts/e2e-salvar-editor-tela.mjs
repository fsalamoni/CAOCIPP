// Salvar pelo editor de verdade (na tela), nos emuladores, com o site em modo emulador:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-salvar-editor-tela.mjs"
// Confere: a minuta redigida no editor é salva; o papel timbrado com cabeçalho em "Editor completo" é salvo.
// O e2e-editor.mjs chama as funções direto e não passa pelo editor: foi assim que escapou o erro
// "hasOwnProperty is not a function" (atributos do editor sem protótipo), corrigido em src/lib/paraEnvio.js.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');
const { chromium } = raiz('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const proc = (action, extra) => httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);

const uid = (await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123')).user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Promotoria', sigla: 'PJ', tipo: 'secretaria', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Rito simples', ativo: true, versao: 1, fases: [{ id: 'f1', nome: 'Única', unidade_id: 'u1', acoes: [] }] });
await db.doc('secTipos/t1').set({ organization_id: 'org1', nome: 'Ofício avulso', sigla: 'OF', rito_id: 'r1', ativo: true, versao: 1, unidade_inicial: 'u1' });
const p = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Teste de documentos', partes: [] });

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const erros = [];
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
try {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async () => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const u = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(u);
        await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
    });

    // 1) Minuta redigida no editor.
    await page.goto(`${SITE}/ProcessoEletronico?org=org1&p=${p.id}`);
    await page.getByRole('button', { name: /Novo documento/ }).first().click({ timeout: 90000 });
    await page.getByRole('button', { name: /^Redigir/ }).first().click();
    const ed = page.locator('.ProseMirror').first();
    await ed.waitFor({ timeout: 30000 });
    await page.getByLabel('Título do documento').fill('Despacho de teste');
    await ed.click();
    await page.keyboard.type('Texto redigido no editor para testar o salvamento.');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByText('Minuta salva').first().waitFor({ timeout: 60000 });
    await page.screenshot({ path: `${SHOTS}/salvar-minuta.png` });
    const docs = (await db.collection(`secProcessos/${p.id}/documentos`).get()).docs.map((d) => d.data());
    assert.equal(docs.length, 1);
    assert.equal(docs[0].origem, 'editor');
    console.log('ok 1: minuta redigida no editor salva');

    // 2) Papel timbrado com cabeçalho no editor completo.
    await page.goto(`${SITE}/Organization?id=org1&tab=admin&secao=secretaria&aba=documentos`);
    await page.getByRole('button', { name: 'Cabeçalho, rodapé e número' }).first().click({ timeout: 90000 });
    const dlg = page.getByRole('dialog').last();
    await dlg.getByText('Editor completo').first().click();
    await dlg.locator('.ProseMirror').first().click();
    await page.keyboard.type('MINISTÉRIO PÚBLICO');
    await page.keyboard.press('Escape');
    const salvar = page.getByRole('button', { name: 'Salvar', exact: true }).first();
    await salvar.scrollIntoViewIfNeeded();
    await salvar.click();
    let cfg;
    for (let i = 0; i < 60 && !cfg?.documento; i++) { cfg = (await db.doc('secConfig/org1').get()).data(); await page.waitForTimeout(500); }
    assert.match(JSON.stringify(cfg.documento.layout.cabecalho), /MINISTÉRIO PÚBLICO/);
    await page.screenshot({ path: `${SHOTS}/salvar-timbrado.png` });
    console.log('ok 2: papel timbrado com cabeçalho no editor completo salvo');
    assert.equal(erros.filter((e) => /hasOwnProperty/.test(e)).length, 0);
} finally {
    await browser.close();
}
