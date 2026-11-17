// Telas do nº do PGEA, depois do e2e-pgea.mjs (mesmo emulador, dados já semeados):
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (em outro terminal)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-pgea.mjs && node scripts/e2e-pgea-tela.mjs"
// Confere: botão "+ Adicionar Consulta"; número novo com check verde; número existente com fase,
// responsável e "Entrar na consulta", que abre a ficha da arquivada. Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';

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
        await page.goto(`${SITE}/Organization?id=org1&tab=processes`);
        await page.getByRole('button', { name: /Adicionar Consulta/ }).first().click({ timeout: 60000 })
            .catch(async (e) => { await page.screenshot({ path: `${SHOTS}/pgea-erro-${nome}.png` }); throw e; });
        const dlg = page.getByRole('dialog', { name: 'Nova Consulta' });
        const campo = dlg.getByLabel('Nº da Consulta - PGEA *');
        await campo.fill('00021.000.126/2024');
        await dlg.getByText('Número novo').waitFor({ timeout: 30000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/pgea-novo-${nome}.png` });
        await campo.fill('21.000.125/2024');
        await dlg.getByText('Já existe uma consulta com este número.').waitFor({ timeout: 30000 });
        await dlg.getByText('Era responsável: Beatriz Lima').waitFor();
        await dlg.getByRole('button', { name: 'Criar mesmo assim' }).waitFor();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/pgea-existe-${nome}.png` });
        await dlg.getByRole('button', { name: 'Entrar na consulta' }).click();
        await page.getByRole('dialog').getByText('Contratação direta de transporte escolar').waitFor({ timeout: 30000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/pgea-abriu-${nome}.png` });
        console.log(`ok: consultas ${nome}`);

        await page.goto(`${SITE}/Organization?id=org1&tab=expedientes`);
        await page.getByRole('button', { name: /Novo Expediente|Adicionar Expediente/ }).first().click({ timeout: 60000 });
        const dlgE = page.getByRole('dialog', { name: 'Novo Expediente Administrativo' });
        await dlgE.getByLabel('Nº do Expediente - PGEA *').fill('1234.000.001/2025');
        await dlgE.getByText('Já existe um expediente com este número.').waitFor({ timeout: 30000 });
        await page.screenshot({ path: `${SHOTS}/pgea-expediente-${nome}.png` });
        console.log(`ok: expedientes ${nome}`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
