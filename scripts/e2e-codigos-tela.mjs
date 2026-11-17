// Capturas da tela de Códigos numéricos, depois do e2e-codigos.mjs (mesmo emulador, dados já semeados):
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (em outro terminal)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-codigos.mjs && node scripts/e2e-codigos-tela.mjs"
// Confere: o botão Códigos abre a tela com as três seções, o repetido trava o salvar e aparece o
// número com zeros à esquerda. Capturas em E2E_SHOTS (padrão: /tmp).
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
// O e2e terminou com um código longo demais; volta a um válido para a captura.
await db.doc('secTipos/t1').update({ codigo: 2 });

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    for (const [nome, vp, esquema] of [['desktop', { width: 1280, height: 900 }, 'light'], ['celular', { width: 390, height: 844 }, 'dark']]) {
        const page = await browser.newPage({ viewport: vp, colorScheme: esquema, deviceScaleFactor: 2 });
        await page.goto(`${SITE}/`);
        await page.waitForLoadState('load');
        await page.evaluate(async () => {
            const cfg = await import('/src/config/firebase.js');
            const fonte = await (await fetch('/src/config/firebase.js')).text();
            const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
            const { signInWithEmailAndPassword } = await import(url);
            await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
        });
        await page.goto(`${SITE}/Organization?id=org1&tab=admin&secao=secretaria&aba=tipos`);
        await page.getByRole('button', { name: 'Códigos' }).click({ timeout: 60000 });
        const dlg = page.getByRole('dialog', { name: 'Códigos numéricos' });
        await dlg.getByText('Órgãos internos').waitFor();
        assert.equal(await dlg.getByLabel('Requerimento').inputValue(), '002');
        // Repetir um código trava o salvar e explica.
        await dlg.getByLabel('Representação').fill('2');
        await dlg.getByText('Há códigos repetidos').waitFor();
        assert.ok(await dlg.getByRole('button', { name: 'Salvar códigos' }).isDisabled());
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/codigos-${nome}.png`, fullPage: false });
        console.log(`ok: captura ${nome}`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
