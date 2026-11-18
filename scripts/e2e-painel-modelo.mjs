// E2E do painel opcional dos modelos da biblioteca, nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-painel-modelo.mjs"
// Confere: usar um modelo mostra a escolha "ligar ou não" com o nome sugerido; ligar cria a página,
// liga o rito e o tipo nasce criando o registro na autuação; autuar cria o registro no painel;
// "Seguir sem painel" não cria nada. Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');
const { chromium } = createRequire(import.meta.url)('playwright');
const { sanitizeEntityTypeDefinition } = req('./lib/customEntities/schema.js');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
const MODELO = 'Bens móveis no MPRS: do tombamento à baixa';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('platformConfig/featureFlags').set({ flags: { custom_entities: true } });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true, integracoes: { paginas: true } } });
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
    await page.getByRole('button', { name: 'Novo rito' }).click({ timeout: 60000 });
    const dlg = page.getByRole('dialog', { name: 'Novo rito' });
    const busca = dlg.getByLabel('Buscar modelo');
    if (!(await busca.isVisible().catch(() => false))) await dlg.getByRole('button', { name: /Biblioteca de modelos/ }).first().click();
    await busca.fill('Bens móveis no MPRS');
    await dlg.getByRole('button', { name: `Usar o modelo ${MODELO}` }).click();
    await dlg.getByRole('heading', { name: 'Painel e planilha de acompanhamento: ligar ou não?' }).waitFor();
    return dlg;
};
const paginas = async () => (await db.collection('entityTypes').where('organization_id', '==', 'org1').get()).docs;

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) Celular, tema escuro: seguir sem painel não cria nada e deixa a integração para depois.
    let page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
    let dlg = await entrar(page);
    await dlg.getByRole('heading', { name: 'Painel e planilha de acompanhamento: ligar ou não?' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/painel-modelo-celular.png` });
    await dlg.getByRole('button', { name: 'Seguir sem painel' }).click();
    await dlg.getByRole('button', { name: /Integração com o painel/ }).waitFor();
    assert.equal((await paginas()).length, 0);
    console.log('ok 1: seguir sem painel não cria página e mantém a integração disponível');
    await page.close();

    // 2) Desktop: ligar cria a página com o nome sugerido e o tipo passa a criar o registro.
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    // No emulador de Functions, admin.firestore.FieldValue vem indefinido e a upsertEntityType falha
    // (só no emulador). A chamada é atendida aqui com o mesmo saneamento do servidor.
    await page.route('**/upsertEntityType', async (rota) => {
        const { organizationId, entityType } = rota.request().postDataJSON().data;
        const def = sanitizeEntityTypeDefinition(entityType);
        const ref = db.collection('entityTypes').doc();
        await ref.set({ ...def, id: ref.id, organization_id: organizationId, created_by: uid });
        await rota.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ result: { success: true, entityTypeId: ref.id } }) });
    });
    dlg = await entrar(page);
    await dlg.getByRole('heading', { name: 'Painel e planilha de acompanhamento: ligar ou não?' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/painel-modelo-escolha.png` });
    await dlg.getByRole('button', { name: 'Ligar: criar painel e planilha' }).click();
    assert.equal(await dlg.getByLabel('Nome do painel (plural)').inputValue(), 'Bens móveis');
    assert.equal(await dlg.getByLabel('Nome de um registro').inputValue(), 'Bem móvel');
    await page.screenshot({ path: `${SHOTS}/painel-modelo-nomes.png` });
    await dlg.getByRole('button', { name: 'Criar painel e ligar ao rito' }).click();
    await dlg.getByText('Cada processo autuado neste tipo cria um registro no painel gerado').waitFor({ timeout: 30000 });
    const [pg] = await paginas();
    assert.equal(pg.data().label_plural, 'Bens móveis');
    console.log(`ok 2: página criada com ${pg.data().phases.length} colunas e ${pg.data().fields.length} campos`);
    await dlg.getByText('Cada processo autuado neste tipo cria um registro no painel gerado').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/painel-modelo-tipo.png` });
    await dlg.getByRole('button', { name: 'Implantar rito' }).click();
    await dlg.getByRole('button', { name: 'Confirmar implantação' }).click();
    await page.getByText('Rito implantado').first().waitFor({ timeout: 60000 });
    await page.close();

    // 3) O tipo nasceu criando o registro; autuar põe o processo no painel.
    const tipo = (await db.collection('secTipos').where('organization_id', '==', 'org1').get()).docs[0];
    assert.deepEqual(tipo.data().cria_registro, { pagina: pg.id, valores: [{ campo: 'processo', de: 'numero' }, { campo: 'assunto', de: 'assunto' }] });
    // A unidade nasceu com o rito, sem ninguém lotado: lota o admin para autuar.
    await db.doc(`secUnidades/${tipo.data().unidade_inicial}`).update({ lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
    const r = (await httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action: 'autuar', tipo_id: tipo.id, rito_id: tipo.data().rito_id, unidade_id: tipo.data().unidade_inicial, assunto: 'Notebook do gabinete', partes: [] })).data;
    const regs = (await db.collection('customRecords').where('organization_id', '==', 'org1').get()).docs.map((d) => d.data());
    assert.equal(regs.length, 1);
    assert.equal(regs[0].values?.assunto ?? regs[0].assunto, 'Notebook do gabinete');
    console.log(`ok 3: tipo com "Criar registro na autuação"; a autuação ${r.numero || ''} criou o registro no painel`);
} finally {
    await browser.close();
}
process.exit(0);
