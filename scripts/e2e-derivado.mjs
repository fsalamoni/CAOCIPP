// E2E da ação "Abrir um processo derivado" (pede 'derivado'), nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-derivado.mjs"
// Confere: o botão da ação abre o "Novo processo" com a origem e o tipo sugerido (pelo nome do tipo ou do rito);
// criado o processo, a ação certa se cumpre sozinha no processo de origem; "Já existe" registra um processo
// ligado; processo que não nasceu deste é recusado. Capturas em E2E_SHOTS (padrão: /tmp).
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
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Promotoria', sigla: 'PJ', tipo: 'secretaria', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
const rito = (nome, fases) => ({ organization_id: 'org1', nome, ativo: true, versao: 1, fases });
await db.doc('secRitos/r1').set(rito('Inquérito', [{
    id: 'f1', nome: 'Acordo', unidade_id: 'u1',
    acoes: ['Abrir o processo de tratativas', 'Abrir o processo de acompanhamento'],
    acoes_regras: [
        { pede: 'derivado', derivado: { tipo: 'Tratativas de acordo' }, obrigatoria: true, ajuda: 'O botão abre o novo processo já ligado a este.' },
        { pede: 'derivado', derivado: { tipo: 'Acompanhamento do acordo' } },
    ],
}]));
await db.doc('secRitos/r2').set(rito('Tratativas de acordo', [{ id: 'f1', nome: 'Negociação', unidade_id: 'u1', acoes: [] }]));
await db.doc('secRitos/r3').set(rito('Rito de acompanhamento', [{ id: 'f1', nome: 'Cumprimento', unidade_id: 'u1', acoes: [] }]));
const tipo = (nome, sigla, rito_id) => ({ organization_id: 'org1', nome, sigla, rito_id, ativo: true, versao: 1, unidade_inicial: 'u1' });
await db.doc('secTipos/t1').set(tipo('Inquérito civil', 'IC', 'r1'));
// O tipo de tratativas tem outro nome: a sugestão casa pelo nome do rito que ele usa.
await db.doc('secTipos/t2').set(tipo('Negociação de acordo', 'NEG', 'r2'));
await db.doc('secTipos/t3').set(tipo('Acompanhamento do acordo', 'ACO', 'r3'));
await db.doc('secTipos/t4').set(tipo('Ofício avulso', 'OF', 'r3'));

const pai = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Improbidade na obra da escola', partes: [] });
const feitas = async () => ((await lido(pai.id)).acoes_feitas || {}).f1 || [];

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
    await page.goto(`${SITE}/ProcessoEletronico?org=org1&p=${pai.id}`);
    await page.getByText('Abrir o processo de tratativas').first().waitFor({ timeout: 60000 });
};

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) Desktop: a ação mostra o botão; ele abre o "Novo processo" com a origem e o tipo sugerido pelo rito.
    let page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    await entrar(page);
    await page.getByText('Sugestão de tipo: Tratativas de acordo').waitFor();
    await page.getByText('Abrir o processo de tratativas').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/derivado-acao.png` });
    await page.getByRole('button', { name: 'Abrir processo' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Autuar processo' });
    await dlg.getByText(/Nasce de/).waitFor({ timeout: 30000 });
    assert.equal(await dlg.locator('select:has(option[value="t2"])').first().inputValue(), 't2');
    await dlg.getByLabel(/^Assunto/).fill('Tratativas com a construtora');
    await page.screenshot({ path: `${SHOTS}/derivado-novo.png` });
    await dlg.getByRole('button', { name: 'Autuar', exact: true }).last().click();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 60000 });
    for (let i = 0; i < 40 && !(await feitas()).includes(0); i++) await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(await feitas(), [0]);
    const filhos = (await db.collection('secProcessos').where('vinculos', 'array-contains', `pe:${pai.id}`).get()).docs;
    assert.equal(filhos.length, 1);
    assert.equal(filhos[0].data().tipo_id, 't2');
    console.log(`ok 1: o botão abriu o novo processo com o tipo do rito sugerido; criado ${filhos[0].data().numero}, a ação das tratativas se cumpriu sozinha`);
    await page.goto(`${SITE}/ProcessoEletronico?org=org1&p=${pai.id}`);
    await page.getByText(`Processo derivado: ${filhos[0].data().numero}`).first().waitFor({ timeout: 60000 }).catch(() => page.getByText(filhos[0].data().numero).first().waitFor({ timeout: 30000 }));
    await page.getByText('Abrir o processo de tratativas').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/derivado-cumprida.png` });
    await page.close();

    // 2) Processo de outro tipo, com uma só ação pendente: cumpre a que sobrou. Desfeita, "Já existe" registra de novo.
    const outro = await proc('autuar', { tipo_id: 't4', rito_id: 'r3', unidade_id: 'u1', assunto: 'Acompanhamento do acordo firmado', partes: [], origem: { ref: { modulo: 'pe', id: pai.id } } });
    assert.deepEqual(await feitas(), [0, 1]);
    await proc('marcarAcao', { id: pai.id, version: (await lido(pai.id)).version, acao_idx: 1, feita: false });
    assert.deepEqual(await feitas(), [0]);
    console.log('ok 2: com uma só ação pendente, o derivado a cumpre mesmo sem o nome casar; desfazer volta a pendência');

    // 3) Celular, tema escuro: "Já existe" lista os processos ligados e registra o escolhido.
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
    await entrar(page);
    await page.getByRole('button', { name: 'Já existe' }).click();
    const reg = page.getByRole('dialog', { name: 'Abrir o processo de acompanhamento' });
    await reg.getByLabel('Processo já aberto').selectOption(outro.id);
    await page.screenshot({ path: `${SHOTS}/derivado-ja-existe-celular.png` });
    await reg.getByRole('button', { name: 'Registrar' }).click();
    for (let i = 0; i < 40 && !(await feitas()).includes(1); i++) await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(await feitas(), [0, 1]);
    console.log('ok 3: "Já existe" registrou o processo ligado');
    await page.close();

    // 4) Processo que não nasceu deste é recusado.
    const solto = await proc('autuar', { tipo_id: 't4', rito_id: 'r3', unidade_id: 'u1', assunto: 'Sem ligação', partes: [] });
    await proc('marcarAcao', { id: pai.id, version: (await lido(pai.id)).version, acao_idx: 1, feita: false });
    await assert.rejects(proc('marcarAcao', { id: pai.id, version: (await lido(pai.id)).version, acao_idx: 1, feita: true, valor: solto.id }), /não nasceu deste nem está ligado/);
    await assert.rejects(proc('marcarAcao', { id: pai.id, version: (await lido(pai.id)).version, acao_idx: 1, feita: true }), /se cumpre com o processo aberto a partir deste/);
    console.log('ok 4: processo sem ligação e ação sem processo são recusados');
} finally {
    await browser.close();
}
process.exit(0);
