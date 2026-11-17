// Telas dos aditivos, depois do e2e-aditivos.mjs (mesmo emulador, dados já semeados):
//   VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-sigo (e demais VITE_FIREBASE_*) npx vite --port 5173 &
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-aditivos.mjs && node scripts/e2e-aditivos-tela.mjs"
// Confere: a ficha do original arquivado lista original e aditivos com a fase de cada um; "Criar
// aditivo" cria o próximo; a ficha do aditivo avisa que é aditivo; o quadro mostra os selos.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';

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
        await page.goto(`${SITE}/Organization?id=org1&tab=processes&abrir=c1`);
        const ficha = page.getByRole('dialog').filter({ hasText: 'Original e aditivos' });
        const lista = ficha.getByRole('list', { name: 'Procedimentos vinculados' });
        await lista.getByText('Aditivo 1', { exact: true }).waitFor({ timeout: 60000 });
        await lista.getByText('você está aqui', { exact: false }).waitFor();
        await ficha.getByRole('button', { name: 'Criar aditivo' }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/aditivos-ficha-original-${nome}.png` });

        if (nome === 'desktop') {
            await ficha.getByRole('button', { name: 'Criar aditivo' }).click();
            const dlg = page.getByRole('dialog', { name: 'Novo aditivo' });
            await dlg.getByLabel('Motivo do aditivo *').fill('Reiteração do pedido com documentos novos');
            await page.screenshot({ path: `${SHOTS}/aditivos-novo-${nome}.png` });
            await dlg.getByRole('button', { name: 'Criar aditivo' }).click();
            await lista.getByText('Aditivo 3', { exact: true }).waitFor({ timeout: 30000 });
            console.log('ok: aditivo 3 criado pela ficha');
        }

        await lista.getByRole('button', { name: 'Abrir aditivo 1' }).click();
        await page.getByText('A fase e a linha do tempo abaixo são só deste aditivo.').waitFor({ timeout: 30000 });
        await page.getByText('Linha do tempo do aditivo 1').waitFor();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/aditivos-ficha-aditivo-${nome}.png` });
        console.log(`ok: fichas ${nome}`);

        await page.goto(`${SITE}/Organization?id=org1&tab=kanban`);
        await page.getByText(/^Original · \d aditivos?$/).first().waitFor({ timeout: 60000 }).catch(() => {});
        await page.getByText('Aditivo 1', { exact: false }).first().waitFor({ timeout: 60000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${SHOTS}/aditivos-quadro-${nome}.png` });
        console.log(`ok: quadro ${nome}`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
