// Tela do Panorama ligado às funcionalidades do órgão, depois do e2e-panorama-orgao.mjs
// (mesmo emulador, dados já semeados; vite com VITE_USE_EMULATORS=true e os VITE_FIREBASE_* do demo-sigo).
// Confere: a escolha "Dados internos", as caixas de Consultas/Expedientes/Parcerias, o "juntas ou
// separadas", a confirmação "Criar o panorama ligado" e, numa base ligada, a leitura AO VIVO: uma
// consulta nova gravada no órgão aparece no Panorama sem importar nada. Capturas em E2E_SHOTS.
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const admin = req('firebase-admin');
admin.initializeApp({ projectId: 'demo-sigo' });
const db = admin.firestore();

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';

// Base ligada pronta (a criação pela tela passa pelo emulador de Functions, que não grava).
await db.doc('panoramaBases/ligada1').set({
    organization_id: 'org1', nome: 'Consultas ao vivo', vinculada: true, fonte_modulos: ['consultas'],
    columns: [
        { key: 'registro', label: 'Registro no SIGO', origem: 'Registro no SIGO', type: 'texto', role: 'identificador', visivel: true, ordem: 0 },
        { key: 'numero', label: 'Número PGEA', origem: 'Número PGEA', type: 'texto', visivel: true, ordem: 1 },
        { key: 'situacao', label: 'Situação', origem: 'Situação', type: 'lista', role: 'situacao', visivel: true, ordem: 2 },
        { key: 'consulente', label: 'Consulente', origem: 'Consulente', type: 'lista', visivel: true, ordem: 3 },
        { key: 'entrada', label: 'Entrada', origem: 'Entrada', type: 'data', role: 'data_referencia', visivel: true, ordem: 4 },
    ],
});
const contarConsultas = async () => (await db.collection('processes').where('organization_id', '==', 'org1').count().get()).data().count;

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

        // 1) Criação: dados internos, sem destino nem política.
        await page.getByRole('tab', { name: /Importa/ }).first().click({ timeout: 60000 })
            .catch(async (e) => { await page.screenshot({ path: `${SHOTS}/panorama-erro-${nome}.png` }); throw e; });
        await page.getByText('Dados internos (funcionalidades do órgão)').click();
        await page.getByText('Separadas, uma base para cada').waitFor();
        if (await page.getByText('Política para dados divergentes').count()) throw new Error('política não devia aparecer');
        await page.getByRole('button', { name: 'Montar o panorama' }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/panorama-orgao-escolha-${nome}.png` });
        await page.getByRole('button', { name: 'Montar o panorama' }).click();
        const criar = page.getByRole('button', { name: 'Criar o panorama ligado' });
        await criar.waitFor({ timeout: 60000 });
        if (await page.getByText('3. O que será feito com cada linha').count()) throw new Error('base ligada não copia linhas');
        await criar.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/panorama-orgao-confirmar-${nome}.png` });

        // 2) Base ligada: lê ao vivo.
        await page.getByRole('tab', { name: /Dados/ }).first().click();
        await page.getByRole('combobox').first().click();
        await page.getByRole('option', { name: 'Consultas ao vivo' }).click();
        await page.getByText(/Ligada a Consultas · ao vivo/).waitFor({ timeout: 30000 });
        const antes = await contarConsultas();
        await page.getByText(`${antes} registro`).first().waitFor({ timeout: 30000 })
            .catch(async (e) => { await page.screenshot({ path: `${SHOTS}/panorama-ligada-erro-${nome}.png` }); throw e; });
        await page.screenshot({ path: `${SHOTS}/panorama-ligada-${nome}.png` });
        await db.doc(`processes/novo-${nome}`).set({ organization_id: 'org1', process_number: `NOVA-${nome}`, consultant: 'Entrou agora', entry_date: '2026-11-25', status: 'Pendente' });
        await page.getByText(`${antes + 1} registro`).first().waitFor({ timeout: 30000 });
        await page.screenshot({ path: `${SHOTS}/panorama-ligada-nova-${nome}.png` });
        console.log(`ok: panorama ligado ${nome} (${antes} → ${antes + 1} ao vivo)`);
        await page.close();
    }
} finally {
    await browser.close();
}
process.exit(0);
