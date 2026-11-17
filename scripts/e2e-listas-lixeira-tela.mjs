// Capturas de "Importar de arquivo" (Listas do órgão) e "Excluir de vez" (Lixeira), depois do
// e2e-listas-lixeira.mjs (mesmo emulador, dados já semeados):
//   VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-sigo (e as outras VITE_FIREBASE_* com valores quaisquer) npx vite --port 5173 &
//   (sem o projeto demo-sigo no site, o navegador lê outro banco do emulador e não acha o órgão)
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-listas-lixeira.mjs && node scripts/e2e-listas-lixeira-tela.mjs"
// Confere: a prévia mostra os itens com lista e gênero, "Já existe" no repetido e o botão com a
// contagem; o "Excluir de vez" do processo só libera com o número digitado. Capturas em E2E_SHOTS.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const admin = req('firebase-admin');
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
admin.initializeApp({ projectId: 'demo-sigo' });
const db = admin.firestore();
const uid = (await admin.auth().getUserByEmail('admin@teste.dev')).uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('secSessoes/s1').delete();

const csv = 'Lista;Nome;Masculino\nComunicação;Edital;sim\nComunicação;Notificação extrajudicial;\nAudiência;Sessão de mediação;\nOrigem;Corregedoria;\n;Disque 100;\n';
const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    for (const [nome, vp, esquema] of [['desktop', { width: 1280, height: 900 }, 'light'], ['celular', { width: 390, height: 844 }, 'dark']]) {
        const page = await browser.newPage({ viewport: vp, colorScheme: esquema, deviceScaleFactor: 2 });
        if (process.env.E2E_DEBUG) page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 300)));
        await page.goto(`${SITE}/`);
        await page.waitForLoadState('load');
        await page.evaluate(async () => {
            const cfg = await import('/src/config/firebase.js');
            const fonte = await (await fetch('/src/config/firebase.js')).text();
            const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
            const { signInWithEmailAndPassword } = await import(url);
            await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
        });
        if (process.env.E2E_DEBUG) console.log('debug:', uid, await page.evaluate(async () => { const c = await import('/src/config/firebase.js'); return [c.auth.currentUser?.uid, c.db.app.options.projectId]; }));
        await page.goto(`${SITE}/Organization?id=org1&tab=admin&secao=secretaria&aba=listas`);
        await page.getByRole('button', { name: 'Importar de arquivo' }).click({ timeout: 60000 })
            .catch(async (e) => { await page.screenshot({ path: `${SHOTS}/erro-${nome}.png` }); throw e; });
        const dlg = page.getByRole('dialog', { name: 'Importar listas de um arquivo' });
        await dlg.locator('input[type=file]').setInputFiles({ name: 'listas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
        await dlg.getByText('5 itens achados').waitFor({ timeout: 60000 });
        await dlg.getByText('Já existe', { exact: true }).waitFor(); // Edital já está na lista
        await dlg.getByText('Escolha a lista', { exact: false }).first().waitFor();
        assert.ok(await dlg.getByRole('button', { name: 'Inserir 3 itens' }).isEnabled());
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/listas-importar-${nome}.png` });
        await dlg.getByRole('button', { name: 'Cancelar' }).click();

        await page.goto(`${SITE}/Organization?id=org1&tab=admin&secao=secretaria&aba=lixeira`);
        await page.getByRole('button', { name: 'Excluir de vez o processo PB-1' }).click({ timeout: 60000 });
        const conf = page.getByRole('alertdialog');
        const botao = conf.getByRole('button', { name: 'Excluir de vez' });
        assert.ok(await botao.isDisabled(), 'sem o número, não libera');
        await conf.getByLabel(/digite o número do processo/).fill('PB-1');
        assert.ok(await botao.isEnabled());
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/lixeira-excluir-de-vez-${nome}.png` });
        console.log(`ok: capturas ${nome}`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
