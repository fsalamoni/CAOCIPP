// E2E da biblioteca por âmbito e dos ritos de parcerias, nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-biblioteca-ambito.mjs"
// Confere: a biblioteca abre agrupada por âmbito e, dentro dele, por área; o filtro de âmbito e de área
// acha os dois ritos de parcerias do MPRS; o de formalização chega com a integração ao Painel de
// Parcerias pronta (sem o convite do painel gerado) e é implantado com as regras de coluna gravadas;
// num órgão sem a integração de Parcerias, o mesmo modelo chega sem a ligação e sem pendência.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
const FORMALIZACAO = 'Convênio, termo de cooperação ou parceria no MPRS: da proposta à publicação';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('platformConfig/featureFlags').set({ flags: { custom_entities: true } });
const orgs = { org1: { paginas: true, parcerias: true }, org2: { paginas: true } };
for (const [id, integracoes] of Object.entries(orgs)) {
    await db.doc(`organizations/${id}`).set({ name: `Órgão ${id}`, created_by: uid, secretariaConfig: { enabled: true, integracoes } });
    await db.doc(`userOrganizations/${uid}_${id}`).set({ id: `${uid}_${id}`, user_id: uid, organization_id: id, role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
}

let logado = false;
const abrir = async (page, org) => {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    if (!logado) {
        await page.evaluate(async () => {
            const cfg = await import('/src/config/firebase.js');
            const fonte = await (await fetch('/src/config/firebase.js')).text();
            const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
            const { signInWithEmailAndPassword } = await import(url);
            await signInWithEmailAndPassword(cfg.auth, 'admin@teste.dev', 'segredo123');
        });
    }
    await page.goto(`${SITE}/Organization?id=${org}&tab=admin&secao=secretaria&aba=ritos`);
    await page.getByRole('button', { name: 'Novo rito' }).click({ timeout: 60000 });
    const dlg = page.getByRole('dialog', { name: 'Novo rito' });
    const busca = dlg.getByLabel('Buscar modelo');
    if (!(await busca.isVisible().catch(() => false))) await dlg.getByRole('button', { name: /Biblioteca de modelos/ }).first().click();
    await busca.waitFor();
    return dlg;
};

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) Computador: grupos por âmbito, com as áreas dentro; filtro de âmbito e de área.
    let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    let page = await ctx.newPage();
    let dlg = await abrir(page, 'org1');
    for (const nome of ['Ministério Público do RS', 'Estado do Rio Grande do Sul', 'União e órgãos federais', 'Ministério Público em geral', 'Conselhos e entidades de classe', 'Qualquer órgão ou entidade']) {
        await dlg.getByRole('button', { name: new RegExp(`^${nome}`) }).waitFor();
    }
    await dlg.getByText(/70 modelos em 6 âmbitos e 11 áreas/).waitFor();
    await dlg.getByRole('button', { name: /^Ministério Público do RS/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/biblioteca-ambitos.png` });
    await dlg.getByRole('button', { name: /^Estado do Rio Grande do Sul/ }).click();
    await dlg.getByRole('heading', { name: /Parcerias, convênios e cooperação/ }).waitFor();
    await page.screenshot({ path: `${SHOTS}/biblioteca-ambito-rs.png` });
    await dlg.getByLabel('Âmbito').selectOption('mprs');
    await dlg.getByLabel('Área').selectOption('parcerias');
    await dlg.getByText('2 de 70 modelos').waitFor();
    await dlg.getByRole('button', { name: new RegExp(`^${FORMALIZACAO}`) }).click();
    await dlg.getByText(/Âmbito:/).first().waitFor();
    await page.screenshot({ path: `${SHOTS}/biblioteca-parcerias-mprs.png` });
    console.log('ok 1: biblioteca agrupada por âmbito e área; filtro acha os dois ritos de parcerias do MPRS');

    // 2) Usar o rito de formalização: integração com o Painel de Parcerias pronta, sem convite de painel gerado.
    await dlg.getByRole('button', { name: `Usar o modelo ${FORMALIZACAO}` }).click();
    const integ = dlg.getByRole('button', { name: /Integração com o painel/ });
    await integ.waitFor();
    assert.match(await integ.innerText(), /Pronto/);
    assert.equal(await dlg.getByRole('heading', { name: 'Painel e planilha de acompanhamento: ligar ou não?' }).count(), 0);
    await integ.scrollIntoViewIfNeeded();
    const quadro = dlg.getByRole('list', { name: 'Colunas do Painel de Parcerias' });
    await quadro.waitFor();
    assert.equal(await quadro.getByText('Nenhuma fase põe o registro aqui.').count(), 0);
    await quadro.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/parcerias-integracao.png` });
    await dlg.getByRole('button', { name: 'Implantar rito' }).click();
    await dlg.getByRole('button', { name: 'Confirmar implantação' }).click();
    await page.getByText('Rito implantado').first().waitFor({ timeout: 60000 });
    const salvo = (await db.collection('secRitos').where('organization_id', '==', 'org1').get()).docs[0].data();
    const colunas = salvo.fases.filter((f) => f.situacao_registro).map((f) => f.situacao_registro.ao_assumir || f.situacao_registro.ao_entrar);
    assert.deepEqual(colunas, ['Em análise', 'Em revisão', 'Revisadas', 'Aguarda Terceiros', 'Aguarda Terceiros', 'Parcerias']);
    const levados = salvo.fases.flatMap((f) => (f.acoes_regras || []).filter((r) => r?.ao_registro)).length;
    assert.equal(levados, 5);
    console.log(`ok 2: rito implantado com ${colunas.length} fases movendo a parceria e ${levados} ações levando dados à ficha`);
    await ctx.close();

    // 3) Celular, tema escuro, órgão sem a integração de Parcerias: o modelo chega sem a ligação e sem pendência grave.
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
    page = await ctx.newPage();
    logado = false;
    dlg = await abrir(page, 'org2');
    await dlg.getByRole('button', { name: /^Ministério Público do RS/ }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/biblioteca-ambitos-celular.png` });
    await dlg.getByLabel('Buscar modelo').fill('parceria no MPRS proposta');
    await dlg.getByRole('button', { name: `Usar o modelo ${FORMALIZACAO}` }).click();
    await page.getByText(/essa integração está desligada neste órgão/).waitFor();
    await dlg.getByRole('heading', { name: 'Painel e planilha de acompanhamento: ligar ou não?' }).waitFor();
    assert.equal(await dlg.getByText(/muda a situação em/).count(), 0, 'pendência de integração desligada');
    await page.screenshot({ path: `${SHOTS}/parcerias-sem-integracao-celular.png` });
    await dlg.getByRole('button', { name: 'Seguir sem painel' }).click();
    await dlg.getByRole('button', { name: 'Implantar rito' }).click();
    await dlg.getByRole('button', { name: 'Confirmar implantação' }).click();
    await page.getByText('Rito implantado').first().waitFor({ timeout: 60000 });
    const semPainel = (await db.collection('secRitos').where('organization_id', '==', 'org2').get()).docs[0].data();
    assert.ok(semPainel.fases.every((f) => !f.situacao_registro));
    console.log('ok 3: órgão sem a integração implanta o mesmo modelo, sem ligação com o painel');
    await ctx.close();
} finally {
    await browser.close();
}
process.exit(0);
