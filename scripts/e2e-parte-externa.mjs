// E2E da parte externa, nos emuladores (auth, firestore, functions, storage), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-parte-externa.mjs"
// Confere: representante com qualidade, OAB e procuração conferida (o servidor recusa sem isso); documento juntado
// "só para" um polo fica fora da vista do outro (lista, download); em tipo com "cada polo vê só as próprias
// petições", a petição de um polo não aparece para o outro; o tipo de petição do órgão vale no portal.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = raiz('firebase/auth');
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
const chamar = (nome, dados) => httpsCallable(fns, nome, { timeout: 300000 })(dados).then((r) => r.data);
const proc = (action, extra) => chamar('secretariaProcesso', { organizationId: 'org1', action, ...extra });
const lido = async (id) => (await db.doc(`secProcessos/${id}`).get()).data();
const como = (email) => signInWithEmailAndPassword(auth, email, 'segredo123');
const conta = async (email, nome) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, 'segredo123');
    await db.doc(`users/${user.uid}`).set({ email, full_name: nome, accepted_terms: true, terms_accepted_at: new Date().toISOString() });
    return user.uid;
};

const celebrante = await conta('celebrante@teste.dev', 'Construtora Alfa');
const ente = await conta('ente@teste.dev', 'Município de Exemplo');
const uid = await conta('admin@teste.dev', 'Admin');
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Promotoria', sigla: 'PJ', tipo: 'secretaria', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
await db.doc('secConfig/org1').set({ organization_id: 'org1', listas: { peticao: [{ id: 'o_proposta_de_acordo', nome: 'Proposta de acordo' }] } });
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Tratativas', ativo: true, versao: 1, fases: [{ id: 'f1', nome: 'Negociação', unidade_id: 'u1', acoes: [] }] });
await db.doc('secTipos/t1').set({
    organization_id: 'org1', nome: 'Tratativas de acordo', sigla: 'TRA', rito_id: 'r1', ativo: true, versao: 1, unidade_inicial: 'u1',
    formulario: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Celebrante', interessado: 'Ente lesado' }, peticoes_por_polo: true },
});

const p = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Tratativas com a Construtora Alfa', partes: [] });
assert.equal((await lido(p.id)).peticoes_por_polo, true);
await db.doc(`secProcessos/${p.id}`).update({
    partes: [{ nome: 'Construtora Alfa', polo: 'requerido', uid: celebrante }, { nome: 'Município de Exemplo', polo: 'interessado', uid: ente }],
    partes_uids: [celebrante, ente],
});
const mov = async (action, extra) => proc(action, { id: p.id, version: (await lido(p.id)).version, ...extra });
const documento = (action, extra) => chamar('secretariaDocumento', { organizationId: 'org1', processoId: p.id, action, ...extra });
const portal = (action, extra) => chamar('secretariaPortal', { processoId: p.id, action, ...extra });

const entrar = async (page, email, url, texto) => {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async (e) => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const u = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword: entrarCom } = await import(u);
        await entrarCom(cfg.auth, e, 'segredo123');
    }, email);
    await page.goto(`${SITE}${url}`);
    await page.getByText(texto).first().waitFor({ timeout: 60000 });
};

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    // 1) O servidor recusa advogado sem OAB ou sem a procuração conferida.
    await assert.rejects(mov('convidarParte', { parte_idx: 0, representante: { nome: 'Ana Lima', qualidade: 'advogado', poderes: true } }), /OAB/);
    await assert.rejects(mov('convidarParte', { parte_idx: 0, representante: { nome: 'Ana Lima', qualidade: 'advogado', inscricao: 'OAB/RS 12.345' } }), /procuração/);
    console.log('ok 1: advogado sem OAB ou sem procuração conferida é recusado');

    // 2) Desktop: convidar o advogado pela tela; "Confirmar" só libera com a OAB e a conferência.
    let page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    await entrar(page, 'admin@teste.dev', `/ProcessoEletronico?org=org1&p=${p.id}`, 'Partes no portal');
    await page.getByRole('button', { name: 'Representante' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Nome do representante').fill('Ana Lima');
    await dlg.getByLabel('Representa a parte como').selectOption('advogado');
    const confirmar = dlg.getByRole('button', { name: 'Confirmar' });
    assert.equal(await confirmar.isDisabled(), true);
    await dlg.getByLabel(/Inscrição na OAB/).fill('OAB/RS 12.345');
    assert.equal(await confirmar.isDisabled(), true);
    await dlg.getByRole('checkbox').check();
    await page.screenshot({ path: `${SHOTS}/parte-externa-representante.png` });
    await confirmar.click();
    for (let i = 0; i < 40 && !((await lido(p.id)).partes[0].representantes || []).length; i++) await new Promise((r) => setTimeout(r, 500));
    const rep = (await lido(p.id)).partes[0].representantes[0];
    assert.deepEqual({ nome: rep.nome, qualidade: rep.qualidade, inscricao: rep.inscricao, poderes: rep.poderes }, { nome: 'Ana Lima', qualidade: 'advogado', inscricao: 'OAB/RS 12.345', poderes: true });
    await page.getByText('Ana Lima, advogado(a), OAB/RS 12.345').first().waitFor({ timeout: 30000 });
    console.log('ok 2: representante convidado pela tela, com qualidade, OAB e procuração conferida');
    await page.close();

    // 3) Documento juntado só para o Celebrante: o Ente lesado não o vê nem baixa.
    await como('admin@teste.dev');
    const texto = (t) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
    const m1 = await documento('criarMinuta', { titulo: 'Proposta do Ministério Público', tipo: 'Despacho', conteudo: texto('Proposta reservada.') });
    await documento('juntar', { docId: m1.id, version: (await lido(p.id)).version, pendencia: 'nao', visivel_partes: true, visivel_polos: ['requerido'], assinar: true });
    const m2 = await documento('criarMinuta', { titulo: 'Despacho de abertura', tipo: 'Despacho', conteudo: texto('Aberto.') });
    await documento('juntar', { docId: m2.id, version: (await lido(p.id)).version, pendencia: 'nao', visivel_partes: true, assinar: true });
    assert.deepEqual((await db.doc(`secProcessos/${p.id}/documentos/${m1.id}`).get()).data().visivel_polos, ['requerido']);
    await como('celebrante@teste.dev');
    const visaoC = await portal('obter');
    assert.deepEqual(visaoC.documentos.map((d) => d.titulo).sort(), ['Despacho de abertura', 'Proposta do Ministério Público']);
    assert.ok(visaoC.tipos_peticao.includes('Proposta de acordo'));
    await como('ente@teste.dev');
    const visaoE = await portal('obter');
    assert.deepEqual(visaoE.documentos.map((d) => d.titulo), ['Despacho de abertura']);
    assert.equal(visaoE.movimentos.some((x) => /Proposta do Ministério Público/.test(x.descricao)), false);
    await assert.rejects(portal('baixar', { docId: m1.id }), /não encontrado/);
    console.log('ok 3: documento "só para" o Celebrante some da lista, do andamento e do download do Ente lesado');

    // 4) Petição do Celebrante, com o tipo do órgão: reservada ao polo dele.
    await como('celebrante@teste.dev');
    await portal('peticionar', { titulo: 'Proposta de pagamento', texto: 'Proponho pagar em 12 parcelas.', tipo: 'Proposta de acordo' });
    const pet = (await db.collection(`secProcessos/${p.id}/documentos`).where('peticao', '==', true).get()).docs[0].data();
    assert.equal(pet.peticao_tipo, 'Proposta de acordo');
    assert.deepEqual(pet.visivel_polos, ['requerido']);
    await como('ente@teste.dev');
    assert.equal((await portal('obter')).documentos.some((d) => d.titulo === 'Proposta de pagamento'), false);
    await como('admin@teste.dev');
    assert.equal((await proc('obter', { id: p.id })).documentos.some((d) => d.titulo === 'Proposta de pagamento'), true);
    console.log('ok 4: a petição do Celebrante leva o tipo do órgão e não aparece para o Ente lesado; a equipe vê');

    // 5) Celular, tema escuro: o portal do Celebrante avisa que a petição é reservada e oferece o tipo do órgão.
    page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await entrar(page, 'celebrante@teste.dev', `/Portal?p=${p.id}`, 'Tratativas com a Construtora Alfa');
    await page.getByRole('button', { name: 'Manifestar-se' }).click();
    await page.getByText(/fica visível só para você/).waitFor({ timeout: 30000 });
    await page.getByText(/fica visível só para você/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/parte-externa-portal-celular.png` });
    await page.close();

    // 6) Desktop: a equipe vê o selo "No portal, só Celebrante" nos autos.
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    await entrar(page, 'admin@teste.dev', `/ProcessoEletronico?org=org1&p=${p.id}`, 'Partes no portal');
    await page.getByRole('tab', { name: /Autos/ }).click();
    await page.getByText('No portal, só Celebrante').first().waitFor({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/parte-externa-autos.png` });
    console.log('ok 5: o portal avisa a reserva; os autos mostram o selo do polo');
    await page.close();
} finally {
    await browser.close();
}
process.exit(0);
