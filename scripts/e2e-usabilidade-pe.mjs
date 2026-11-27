// E2E da usabilidade do Processo Eletrônico, nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-usabilidade-pe.mjs"
// Confere: a linha da lista mostra tipo e partes e abre por link; a busca e a ordem ficam guardadas ao
// voltar de um processo, com a linha destacada; "/" leva à busca; o Novo processo abre com o tipo e a
// unidade da primeira fase do rito e o seletor de arquivos em português; dentro do processo o menu Mais
// cabe na tela, a janela de ação diz o que falta, não fecha com texto digitado e confirma com Ctrl+Enter;
// no celular não há rolagem lateral. Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const proc = (action, extra) => httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const lido = async (id) => (await db.doc(`secProcessos/${id}`).get()).data();

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
const unidade = (nome, sigla, tipo) => ({ organization_id: 'org1', nome, sigla, tipo, ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
// O gabinete vem antes na ordem alfabética: sem a regra nova, o Novo processo abriria nele.
await db.doc('secUnidades/u0').set(unidade('Assessoria do Gabinete', 'GAB', 'gabinete'));
await db.doc('secUnidades/u1').set(unidade('Secretaria', 'SEC', 'secretaria'));
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Inquérito', ativo: true, versao: 1, fases: [
    { id: 'f1', nome: 'Recebimento', unidade_id: 'u1', proximas: ['f2'], acoes: ['Registrar a origem'], acoes_regras: [{ obrigatoria: true }] },
    { id: 'f2', nome: 'Análise', unidade_id: 'u1', acoes: [] },
] });
// O tipo não indica unidade inicial: vale a da primeira fase do rito.
await db.doc('secTipos/t1').set({ organization_id: 'org1', nome: 'Inquérito civil', sigla: 'IC', rito_id: 'r1', ativo: true, versao: 1 });

const base = { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1' };
const a = await proc('autuar', { ...base, assunto: 'Emendas sem plano de trabalho', partes: [{ nome: 'Prefeitura de Exemplo', polo: 'requerido' }, { nome: 'Câmara de Vereadores', polo: 'interessado' }] });
const b = await proc('autuar', { ...base, assunto: 'Obra paralisada na escola', partes: [{ nome: 'Construtora Alfa', polo: 'requerido' }] });
const c = await proc('autuar', { ...base, assunto: 'Transparência do portal', partes: [] });

const entrar = async (page, url) => {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async () => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const u = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(u);
        await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
    });
    await page.goto(`${SITE}${url}`);
};
const foto = async (page, nome) => { await page.waitForTimeout(700); await page.screenshot({ path: `${SHOTS}/usabilidade-${nome}.png` }); };
const linhas = (page) => page.locator('[data-processo]');
const semRolagemLateral = async (page, onde) => {
    const m = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(m[0] <= m[1], `${onde}: a página tem ${m[0]} px numa tela de ${m[1]} px`);
};

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) Computador, tela baixa (1366x768): a lista.
    let page = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: 'light', deviceScaleFactor: 2 });
    await entrar(page, '/ProcessoEletronico?org=org1&aba=caixa');
    await linhas(page).first().waitFor({ timeout: 60000 });
    assert.equal(await linhas(page).count(), 3);
    const linhaA = page.locator(`[data-processo="${a.id}"]`);
    assert.match(await linhaA.innerText(), /Inquérito civil · Prefeitura de Exemplo, Câmara de Vereadores/);
    assert.match(await linhaA.getByRole('link').getAttribute('href'), new RegExp(`p=${a.id}`));
    await foto(page, 'lista');

    // Ordem: do mais antigo para o mais novo, e de volta.
    await page.getByLabel('Ordenar a lista').selectOption('antigos');
    assert.equal(await linhas(page).first().getAttribute('data-processo'), a.id);
    await page.getByLabel('Ordenar a lista').selectOption('recentes');
    assert.equal(await linhas(page).first().getAttribute('data-processo'), c.id);

    // "/" leva à busca; a busca acha pela parte; ao voltar do processo, ela continua e a linha fica marcada.
    await page.locator('body').click({ position: { x: 700, y: 760 } });
    await page.keyboard.press('/');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Buscar processos');
    await page.keyboard.type('alfa');
    assert.equal(await linhas(page).count(), 1);
    await linhas(page).first().getByRole('link').click();
    await page.getByRole('tab', { name: /^Andamento/ }).waitFor({ timeout: 60000 });
    // Dentro do processo, a tela é dele: sem as abas da lista.
    assert.equal(await page.getByRole('tab', { name: /Caixa da unidade/ }).count(), 0);
    await page.getByRole('button', { name: 'Processos' }).first().click();
    await linhas(page).first().waitFor();
    assert.equal(await page.getByLabel('Buscar processos').inputValue(), 'alfa');
    assert.equal(await page.locator(`[data-processo="${b.id}"]`).getAttribute('data-voltou'), '1');
    await page.getByLabel('Buscar processos').press('Escape');
    assert.equal(await linhas(page).count(), 3);

    // 2) Novo processo: o único tipo já vem escolhido, na unidade da primeira fase; arquivos em português.
    await page.getByRole('button', { name: 'Novo processo' }).click();
    const novo = page.getByRole('dialog', { name: 'Autuar processo' });
    await novo.waitFor();
    assert.equal(await novo.locator('select:has(option[value="t1"])').first().inputValue(), 't1');
    assert.equal(await novo.locator('select:has(option[value="u1"])').first().inputValue(), 'u1');
    await novo.getByText('Escolher arquivos').scrollIntoViewIfNeeded();
    await novo.getByText('ou arraste e solte aqui').waitFor();
    await foto(page, 'novo-processo');
    await page.keyboard.press('Escape');

    // 3) Dentro do processo: o menu Mais cabe na tela baixa e o primeiro item é alcançável.
    await page.goto(`${SITE}/ProcessoEletronico?org=org1&p=${a.id}`);
    await page.getByRole('button', { name: 'Mais ações' }).click({ timeout: 60000 });
    const primeiro = page.getByRole('menuitem', { name: /^Enviar para outra unidade/ });
    const caixa = await primeiro.boundingBox();
    assert.ok(caixa && caixa.y >= 0 && caixa.y + caixa.height <= 768, 'o primeiro item do menu Mais ficou fora da tela');
    await foto(page, 'menu-mais');
    await page.keyboard.press('Escape');

    // A janela de ação diz o que falta; com texto digitado, o clique fora não a fecha; Ctrl+Enter confirma.
    await page.getByRole('button', { name: /^Concluir e seguir para Análise/ }).first().click();
    const janela = page.getByRole('dialog');
    await janela.getByText(/Para confirmar: preencha "Motivo da dispensa do que o rito exige"/).waitFor();
    assert.ok(await janela.getByRole('button', { name: 'Confirmar' }).isDisabled());
    await janela.getByRole('button', { name: 'Fechar e cumprir agora' }).waitFor();
    await foto(page, 'janela-o-que-falta');
    await janela.getByLabel(/Motivo da dispensa/).fill('Origem já consta da representação juntada.');
    assert.equal(await janela.getByText(/Para confirmar:/).count(), 0);
    await page.mouse.click(8, 400);
    await page.waitForTimeout(400);
    assert.ok(await janela.isVisible(), 'a janela fechou com texto digitado');
    await janela.getByLabel(/Motivo da dispensa/).press('Control+Enter');
    await page.getByText('Fase alterada').first().waitFor({ timeout: 30000 });
    assert.equal((await lido(a.id)).fase_atual, 'f2');
    await page.close();

    // 4) Celular (390x844), claro e escuro: sem rolagem lateral na lista e no processo.
    for (const escuro of [false, true]) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: escuro ? 'dark' : 'light', deviceScaleFactor: 2 });
        page = await ctx.newPage();
        if (escuro) await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
        await entrar(page, '/ProcessoEletronico?org=org1&aba=caixa');
        await linhas(page).first().waitFor({ timeout: 60000 });
        await semRolagemLateral(page, 'lista no celular');
        await foto(page, `lista-celular${escuro ? '-escuro' : ''}`);
        await page.locator(`[data-processo="${b.id}"]`).getByRole('link').click();
        await page.getByRole('tab', { name: /^Andamento/ }).waitFor({ timeout: 60000 });
        await page.getByText('Pendências e prazos').waitFor();
        await semRolagemLateral(page, 'processo no celular');
        await foto(page, `processo-celular${escuro ? '-escuro' : ''}`);
        await ctx.close();
    }
    console.log('e2e usabilidade do Processo Eletrônico: ok');
} finally {
    await browser.close();
}
process.exit(0);
