// Tela do Panorama a partir das funcionalidades do órgão, depois do e2e-panorama-orgao.mjs
// (mesmo emulador, dados já semeados; vite com VITE_USE_EMULATORS=true e os VITE_FIREBASE_* do demo-sigo).
// Confere: a escolha "Funcionalidades do órgão", as caixas de Consultas/Expedientes/Parcerias, o
// "juntas ou separadas" e a prévia com o registro no SIGO como identificador. Capturas em E2E_SHOTS.
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
        await page.goto(`${SITE}/Organization?id=org1&tab=panorama`);
        await page.getByText('Funcionalidades do órgão').first().click({ timeout: 60000 })
            .catch(async (e) => { await page.screenshot({ path: `${SHOTS}/panorama-erro-${nome}.png` }); throw e; });
        await page.getByText('Separadas, uma base para cada').waitFor();
        await page.getByText('Funcionalidades do órgão').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/panorama-orgao-escolha-${nome}.png` });
        await page.getByRole('button', { name: 'Ler os registros do órgão' }).click();
        await page.getByText('Consultas + Expedientes + Parcerias —').waitFor({ timeout: 60000 });
        await page.getByText('3. O que será feito com cada linha').scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/panorama-orgao-previa-${nome}.png` });
        console.log(`ok: panorama do órgão ${nome}`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
