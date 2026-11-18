// E2E do cronograma de obrigações (pede 'cronograma' e 'quitacao'), nos emuladores (auth, firestore, functions), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-cronograma.mjs"
// Confere: a ação gera as parcelas e cada uma vira um prazo com `obrigacao`; as obrigações sobrevivem à saída da
// fase; a parte as vê no portal com "Enviar comprovante"; a ação que espera o cronograma não se marca à mão e se
// cumpre sozinha com a última obrigação cumprida; desfazer o cronograma cancela as abertas; o botão "Cronograma"
// serve a processo sem a ação. Capturas em E2E_SHOTS (padrão: /tmp).
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
const proc = (action, extra) => httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const lido = async (id) => (await db.doc(`secProcessos/${id}`).get()).data();
const mov = async (action, id, extra) => proc(action, { id, version: (await lido(id)).version, ...extra });
const espera = async (cond) => { for (let i = 0; i < 60 && !(await cond()); i++) await new Promise((r) => setTimeout(r, 500)); };

// A parte (conta do portal) e a equipe do órgão.
const parteUid = (await createUserWithEmailAndPassword(auth, 'parte@teste.dev', 'segredo123')).user.uid;
await db.doc(`users/${parteUid}`).set({ email: 'parte@teste.dev', full_name: 'Construtora Alfa', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
const uid = (await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123')).user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Promotoria', sigla: 'PJ', tipo: 'secretaria', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Acompanhamento do acordo', ativo: true, versao: 1, fases: [
    { id: 'f1', nome: 'Início do acompanhamento', unidade_id: 'u1', proximas: ['f2'], acoes: ['Registrar o cronograma das obrigações'], acoes_regras: [{ pede: 'cronograma', destino: 'autos', obrigatoria: true, ajuda: 'Gere as parcelas e inclua as demais obrigações.' }] },
    { id: 'f2', nome: 'Cumprimento', unidade_id: 'u1', proximas: ['f3'], acoes: ['Todas as obrigações do cronograma cumpridas'], acoes_regras: [{ pede: 'quitacao', obrigatoria: true }] },
    { id: 'f3', nome: 'Arquivamento', unidade_id: 'u1', final: true, acoes: [] },
] });
await db.doc('secRitos/r2').set({ organization_id: 'org1', nome: 'Rito simples', ativo: true, versao: 1, fases: [{ id: 'f1', nome: 'Única', unidade_id: 'u1', acoes: [] }] });
await db.doc('secTipos/t1').set({ organization_id: 'org1', nome: 'Acompanhamento de acordo', sigla: 'ACO', rito_id: 'r1', ativo: true, versao: 1, unidade_inicial: 'u1' });
await db.doc('secTipos/t2').set({ organization_id: 'org1', nome: 'Ofício avulso', sigla: 'OF', rito_id: 'r2', ativo: true, versao: 1, unidade_inicial: 'u1' });

const p = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Acordo com a Construtora Alfa', partes: [] });
await db.doc(`secProcessos/${p.id}`).update({ partes: [{ nome: 'Construtora Alfa', polo: 'requerido', uid: parteUid }], partes_uids: [parteUid] });
const obrig = async (id = p.id) => ((await lido(id)).prazos || []).filter((x) => x.obrigacao === true);
const feitas = async (fase) => ((await lido(p.id)).acoes_feitas || {})[fase] || [];

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
const emSeisMeses = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
// Celular no tema escuro (o tema do SIGO fica no localStorage, não segue só o do sistema).
const escuro = async () => {
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
    await pg.addInitScript(() => localStorage.setItem('theme', 'dark'));
    return pg;
};
try {
    // 1) Desktop: "Montar cronograma" gera 6 parcelas de um total; cada uma vira um prazo com obrigação.
    let page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: 2 });
    await entrar(page, 'admin@teste.dev', `/ProcessoEletronico?org=org1&p=${p.id}`, 'Registrar o cronograma das obrigações');
    await page.getByRole('button', { name: 'Montar cronograma' }).click();
    const dlg = page.getByRole('dialog', { name: 'Registrar o cronograma das obrigações' });
    await dlg.getByLabel('Quantidade').fill('6');
    await dlg.getByLabel('Primeiro vencimento').fill(emSeisMeses);
    await dlg.getByLabel('Ou valor total a dividir (R$)').fill('100.000,00');
    await dlg.getByRole('button', { name: 'Gerar e incluir na lista' }).click();
    await dlg.getByRole('button', { name: 'Incluir uma' }).click();
    await dlg.getByLabel('Descrição da obrigação 7').fill('Entregar o relatório de integridade');
    await dlg.getByLabel('Vencimento da obrigação 7').fill(emSeisMeses);
    await dlg.getByLabel('A cargo de').fill('Construtora Alfa');
    await dlg.getByText('Obrigações (7) · total de R$ 100.000,00').waitFor();
    await page.screenshot({ path: `${SHOTS}/cronograma-montar.png` });
    await dlg.getByRole('button', { name: 'Registrar o cronograma' }).click();
    await espera(async () => (await obrig()).length === 7);
    const lista = await obrig();
    assert.equal(lista.length, 7);
    assert.equal(Math.round(lista.reduce((s, x) => s + (x.valor || 0), 0) * 100), 10000000);
    assert.equal(lista.every((x) => x.status === 'aberto' && x.destinatario === 'Construtora Alfa' && !x.fase_id && x.cronograma_de === 'f1:0'), true);
    assert.deepEqual(await feitas('f1'), [0]);
    await page.getByText('Cronograma de obrigações', { exact: true }).first().waitFor({ timeout: 30000 });
    await page.getByText(/0 de 7 obrigações cumpridas/).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/cronograma-processo.png` });
    console.log('ok 1: a ação gerou 6 parcelas (R$ 100.000,00) e 1 obrigação sem valor; 7 prazos com alerta, a cargo da parte');
    await page.close();

    // 2) As obrigações sobrevivem à saída da fase; a ação de espera não se marca à mão.
    await mov('avancarFase', p.id, { fase_id: 'f2', motivo: 'Cronograma registrado' });
    assert.equal((await obrig()).every((x) => x.status === 'aberto'), true);
    await assert.rejects(mov('marcarAcao', p.id, { acao_idx: 0, feita: true }), /se cumpre sozinha/);
    // Sem motivo, a fase não termina com a espera pendente (com motivo, a dispensa fica registrada, como em toda ação obrigatória).
    await assert.rejects(mov('avancarFase', p.id, { fase_id: 'f3' }));
    console.log('ok 2: obrigações seguem abertas na fase seguinte; a espera não se marca à mão e segura a fase');

    // 3) Portal da parte, celular e tema escuro: resumo, valor e "Enviar comprovante".
    for (const x of (await obrig()).slice(0, 2)) await mov('encerrarPrazo', p.id, { prazo_id: x.id, resultado: 'cumprido', motivo: 'Comprovante conferido' });
    page = await escuro();
    await entrar(page, 'parte@teste.dev', `/Portal?p=${p.id}`, /2 de 7 obrigações cumpridas/);
    await page.getByRole('button', { name: 'Enviar comprovante' }).first().waitFor();
    await page.getByText('Cronograma de obrigações:').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/cronograma-portal-celular.png` });
    console.log('ok 3: a parte vê o andamento e as obrigações no portal, com "Enviar comprovante"');
    await page.close();

    // 4) Celular escuro, equipe: a ação de espera mostra o andamento; cumprida a última, ela se cumpre sozinha.
    page = await escuro();
    await entrar(page, 'admin@teste.dev', `/ProcessoEletronico?org=org1&p=${p.id}`, 'Todas as obrigações do cronograma cumpridas');
    await page.getByText(/Cumpre-se sozinha quando todas estiverem cumpridas/).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/cronograma-espera-celular.png` });
    await page.close();
    await signInWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
    for (const x of (await obrig()).filter((q) => q.status === 'aberto')) await mov('encerrarPrazo', p.id, { prazo_id: x.id, resultado: 'cumprido', motivo: 'Comprovante conferido' });
    await espera(async () => (await feitas('f2')).includes(0));
    assert.deepEqual(await feitas('f2'), [0]);
    await mov('avancarFase', p.id, { fase_id: 'f3', motivo: 'Acordo cumprido' });
    console.log('ok 4: com a última obrigação cumprida, a ação de espera se cumpriu sozinha e a fase pôde terminar');

    // 5) Processo sem a ação: o botão "Cronograma" (abrirCronograma) registra; itens inválidos são recusados.
    const q = await proc('autuar', { tipo_id: 't2', rito_id: 'r2', unidade_id: 'u1', assunto: 'Parcelamento avulso', partes: [] });
    await assert.rejects(mov('abrirCronograma', q.id, { itens: [{ descricao: 'Parcela', vence_em: '2027-02-30' }] }), /vencimento/);
    await assert.rejects(mov('abrirCronograma', q.id, { itens: [] }), /ao menos uma/);
    await mov('abrirCronograma', q.id, { itens: [{ descricao: 'Parcela 1', vence_em: '2027-01-10', valor: 500 }, { descricao: 'Parcela 2', vence_em: '2027-02-10', valor: 500 }] });
    assert.equal((await obrig(q.id)).length, 2);
    assert.equal((await lido(q.id)).proximo_vencimento, '2027-01-10');
    console.log('ok 5: "Cronograma" registra obrigações em processo sem a ação; cronograma inválido é recusado');

    // 6) Desfazer a ação do cronograma cancela as obrigações que ela abriu e seguem em aberto (as cumpridas ficam).
    const r = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Outro acordo', partes: [] });
    await mov('marcarAcao', r.id, { acao_idx: 0, feita: true, valor: { itens: [{ descricao: 'A', vence_em: '2027-01-10' }, { descricao: 'B', vence_em: '2027-02-10' }], destinatario: '' } });
    await mov('encerrarPrazo', r.id, { prazo_id: (await obrig(r.id))[0].id, resultado: 'cumprido', motivo: 'Feito' });
    await mov('marcarAcao', r.id, { acao_idx: 0, feita: false });
    assert.deepEqual((await obrig(r.id)).map((x) => x.status), ['cumprido', 'cancelado']);
    console.log('ok 6: desfazer o cronograma cancela só as obrigações em aberto');
} finally {
    await browser.close();
}
process.exit(0);
