// E2E da exportação do rito, nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-exportar-rito.mjs"
// Implanta um rito da biblioteca, abre "Exportar" pelo menu do rito e baixa TODOS os formatos, conferindo
// cada arquivo: BPMN, Mermaid e planilha voltam pela importação com as mesmas fases; a imagem (PNG) tem o
// tamanho do desenho inteiro; o SVG não corta texto; o PDF é um PDF. Depois abre a mesma janela pela tela
// de edição e pelo celular. Arquivos e capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { propostaDeAbas, propostaDeBpmn, propostaDeMermaid } from '../src/lib/propostaRito.js';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const XLSX = raiz('xlsx');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
const MODELO = 'Inquérito civil de emendas parlamentares (MPRS)';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('platformConfig/featureFlags').set({ flags: { custom_entities: true } });
await db.doc('organizations/org1').set({ name: 'Órgão org1', created_by: uid, secretariaConfig: { enabled: true, integracoes: { paginas: true } } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });

const entrar = async (page) => {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async () => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(url);
        await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
    });
    await page.goto(`${SITE}/Organization?id=org1&tab=admin&secao=secretaria&aba=ritos`);
    await page.getByRole('button', { name: 'Novo rito' }).waitFor({ timeout: 60000 });
};
const abrirExportar = async (page, nome) => {
    await page.getByRole('button', { name: `Mais opções: ${nome}` }).click();
    await page.getByRole('menuitem', { name: /^Exportar \(imagem, Bizagi, planilha\)/ }).click();
    const dlg = page.getByRole('dialog', { name: 'Exportar o rito' });
    await dlg.waitFor();
    await page.waitForTimeout(600); // fim da animação, para a captura
    return dlg;
};
const baixar = async (page, dlg, formato) => {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), dlg.getByRole('button', { name: `Baixar em ${formato}` }).click()]);
    const caminho = `${SHOTS}/${d.suggestedFilename()}`;
    await d.saveAs(caminho);
    return caminho;
};
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const nomes = (fases) => fases.map((f) => sem(f.nome)).sort();

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) Computador: implanta o modelo da biblioteca.
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2, acceptDownloads: true });
    let page = await ctx.newPage();
    await entrar(page);
    await page.getByRole('button', { name: 'Novo rito' }).click();
    const novo = page.getByRole('dialog', { name: 'Novo rito' });
    const busca = novo.getByLabel('Buscar modelo');
    if (!(await busca.isVisible().catch(() => false))) await novo.getByRole('button', { name: /Biblioteca de modelos/ }).first().click();
    await busca.fill('inquérito emendas parlamentares');
    await novo.getByRole('button', { name: `Usar o modelo ${MODELO}` }).click();
    await novo.getByRole('button', { name: 'Implantar rito' }).waitFor();
    const semPainel = novo.getByRole('button', { name: 'Seguir sem painel' });
    if (await semPainel.isVisible().catch(() => false)) await semPainel.click();
    // A mesma janela abre de dentro da edição, antes de implantar.
    await novo.getByRole('button', { name: 'Exportar o rito' }).click();
    const daEdicao = page.getByRole('dialog', { name: 'Exportar o rito' });
    await daEdicao.getByRole('button', { name: 'Baixar em Bizagi e BPMN 2.0' }).waitFor();
    await page.screenshot({ path: `${SHOTS}/exportar-da-edicao.png` });
    await page.keyboard.press('Escape');
    await daEdicao.waitFor({ state: 'hidden' });
    await novo.getByRole('button', { name: 'Implantar rito' }).click();
    await novo.getByRole('button', { name: 'Confirmar implantação' }).click();
    await page.getByText('Rito implantado').first().waitFor({ timeout: 60000 });
    const rito = (await db.collection('secRitos').where('organization_id', '==', 'org1').get()).docs[0].data();
    const unidades = new Set(rito.fases.map((f) => f.unidade_id || '').filter(Boolean));
    assert.ok(rito.fases.length >= 8 && unidades.size >= 2, 'rito implantado com fases e unidades');
    console.log(`ok 1: rito implantado (${rito.fases.length} fases, ${unidades.size} unidades); a exportação abre de dentro da edição`);

    // 2) Menu do rito → Exportar: baixa todos os formatos e confere cada arquivo.
    if (await novo.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    const dlg = await abrirExportar(page, rito.nome);
    await page.screenshot({ path: `${SHOTS}/exportar-rito.png` });

    const bpmn = fs.readFileSync(await baixar(page, dlg, 'Bizagi e BPMN 2.0'), 'utf8');
    assert.match(bpmn, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    const lidoBpmn = propostaDeBpmn(bpmn);
    assert.deepEqual(nomes(lidoBpmn.fases), nomes(rito.fases));
    assert.equal((bpmn.match(/<lane /g) || []).length, new Set(lidoBpmn.fases.map((f) => f.unidade)).size);
    assert.ok((bpmn.match(/<lane /g) || []).length >= unidades.size, 'uma raia por unidade');
    assert.equal((bpmn.match(/<bpmndi:BPMNEdge /g) || []).length, (bpmn.match(/<sequenceFlow /g) || []).length);
    console.log(`ok 2a: BPMN com ${lidoBpmn.fases.length} fases em ${(bpmn.match(/<lane /g) || []).length} raias, lido de volta pela importação`);

    const mmd = fs.readFileSync(await baixar(page, dlg, 'Mermaid'), 'utf8');
    assert.match(mmd, /^flowchart LR/);
    assert.deepEqual(nomes(propostaDeMermaid(mmd).fases), nomes(rito.fases).map((n) => n.replace(/"/g, "'")));
    console.log('ok 2b: Mermaid lido de volta pela importação');

    const wb = XLSX.read(fs.readFileSync(await baixar(page, dlg, 'Planilha (Excel)')));
    assert.deepEqual(wb.SheetNames.slice(0, 1), ['Rito']);
    const abas = wb.SheetNames.map((n) => ({ nome: n, linhas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) }));
    assert.deepEqual(nomes(propostaDeAbas(abas).fases), nomes(rito.fases));
    console.log(`ok 2c: planilha com as abas ${wb.SheetNames.join(' e ')}, lida de volta pela importação`);

    const svg = fs.readFileSync(await baixar(page, dlg, 'Imagem vetorial (SVG)'), 'utf8');
    const [, lw, lh] = svg.match(/<svg[^>]* width="(\d+)" height="(\d+)"/);
    assert.ok(!svg.includes('…'), 'SVG sem texto cortado');
    for (const f of rito.fases) assert.ok(svg.includes(String(f.nome).split(' ')[0]), `fase no desenho: ${f.nome}`);

    const png = fs.readFileSync(await baixar(page, dlg, 'Imagem (PNG)'));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [pw, ph] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    // A imagem tem a proporção do desenho inteiro e pelo menos o seu tamanho (até o dobro, para ampliar).
    assert.ok(pw >= Number(lw) && ph >= Number(lh), `PNG ${pw}x${ph} menor que o desenho ${lw}x${lh}`);
    assert.ok(Math.abs(pw / ph - lw / lh) < 0.01, 'proporção do desenho');
    console.log(`ok 2d: imagem de ${pw} x ${ph} pixels (desenho de ${lw} x ${lh}), o rito inteiro numa faixa`);

    const pdf = fs.readFileSync(await baixar(page, dlg, 'PDF'));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 20000, 'PDF com a imagem dentro');
    const caixa = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
    assert.ok(caixa && Math.abs(Number(caixa[1]) / Number(caixa[2]) - lw / lh) < 0.01, 'PDF de uma página, do tamanho do desenho');
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1, 'uma página só');
    console.log(`ok 2e: PDF de uma página (${caixa[1]} x ${caixa[2]} pontos)`);

    // Sem as ações, o desenho sai mais baixo.
    await dlg.getByRole('checkbox').click();
    const svgSem = fs.readFileSync(await baixar(page, dlg, 'Imagem vetorial (SVG)'), 'utf8');
    assert.ok(Number(svgSem.match(/<svg[^>]* height="(\d+)"/)[1]) < Number(lh), 'sem ações, desenho mais baixo');
    console.log('ok 2f: sem as ações, o desenho sai mais baixo');
    await ctx.close();

    // 3) Celular: a janela cabe e baixa.
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, acceptDownloads: true });
    page = await ctx.newPage();
    await entrar(page);
    const cel = await abrirExportar(page, rito.nome);
    await page.screenshot({ path: `${SHOTS}/exportar-rito-celular.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sem rolagem lateral');
    const png2 = fs.readFileSync(await baixar(page, cel, 'Imagem (PNG)'));
    assert.ok(png2.readUInt32BE(16) >= Number(lw));
    console.log('ok 3: no celular, a janela cabe na tela e a imagem sai inteira');
    await ctx.close();
} finally {
    await browser.close();
}
process.exit(0);
