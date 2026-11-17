// E2E da Administração da plataforma nos emuladores (auth, firestore, functions), com o site em modo dev:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (em outro terminal)
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-admin-plataforma.mjs"
// Confere: quem não é super-admin vê "Acesso restrito"; o super-admin vê a visão geral com as
// pendências, abre uma seção pelo menu e pelo link (?secao=), busca acha seção e o celular usa o seletor.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const admin = req('firebase-admin');
const { chromium } = createRequire(import.meta.url)('playwright');

const PROJ = 'demo-sigo';
const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();

const criar = async (email) => (await admin.auth().createUser({ email, password: 'segredo123', emailVerified: true, displayName: email.split('@')[0] })).uid;
const adminUid = await criar('super@teste.dev');
await criar('comum@teste.dev');
await db.doc(`platformAdmins/${adminUid}`).set({ active: true, email: 'super@teste.dev' });
await db.doc(`users/${adminUid}`).set({ email: 'super@teste.dev', full_name: 'Super Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Promotoria de Teste', created_by: 'dono' });
// Órgão com criador e um membro (o membro é o "comum", que não é super-admin).
const comumUid = (await admin.auth().getUserByEmail('comum@teste.dev')).uid;
await db.doc(`users/${comumUid}`).set({ email: 'comum@teste.dev', full_name: 'Maria Membro', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
const donoUid = await criar('dono@teste.dev');
const vinculo = (uid, nome, role) => db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', user_name: nome, user_email: `${nome}@teste.dev`, role, active: true, joined_at: new Date() });
await vinculo(donoUid, 'Dono', 'creator');
await vinculo(comumUid, 'Maria Membro', 'member');
await db.doc('processes/pp1').set({ organization_id: 'org1', title: 'Consulta' });

// Entra pelo mesmo módulo do Firebase que o app usa (o Vite serve as deps com hash na URL).
async function entrar(page, email) {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async ([e]) => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const url = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(url);
        await signInWithEmailAndPassword(cfg.auth, e, 'segredo123');
    }, [email]);
}

const browser = await chromium.launch();
try {
    // 1) Usuário comum.
    const c = await browser.newPage();
    await entrar(c, 'comum@teste.dev');
    await c.goto(`${SITE}/Admin`);
    await c.getByText('Acesso restrito').waitFor({ timeout: 30000 });
    console.log('ok 1: quem não é super-admin vê "Acesso restrito"');
    await c.close();

    // 2) Super-admin no computador.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await entrar(p, 'super@teste.dev');
    await p.goto(`${SITE}/Admin`);
    await p.getByText('Tudo o que vale para o SIGO inteiro').waitFor({ timeout: 30000 });
    await p.getByText(/pendências? de configuração/).waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${SHOTS}/admin-visao-geral.png`, fullPage: true });
    console.log('ok 2: visão geral com pendências');

    await p.getByRole('navigation', { name: 'Seções da administração da plataforma' }).getByRole('button', { name: 'Diagnóstico e saúde' }).click();
    await p.getByRole('heading', { name: 'Diagnóstico e saúde', level: 2 }).waitFor();
    assert.match(p.url(), /secao=health/);
    await p.reload();
    await p.getByRole('heading', { name: 'Diagnóstico e saúde', level: 2 }).waitFor({ timeout: 30000 });
    console.log('ok 3: seção abre pelo menu e volta pelo link');

    await p.getByLabel('Buscar seção da administração da plataforma').fill('bigquery');
    await p.getByText('2 seções encontradas').waitFor();
    await p.screenshot({ path: `${SHOTS}/admin-busca.png` });
    console.log('ok 4: busca acha seção');
    await ctx.close();

    // 3) Celular, tema escuro.
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true });
    const mp = await m.newPage();
    await entrar(mp, 'super@teste.dev');
    await mp.goto(`${SITE}/Admin`);
    await mp.getByLabel('Seção da administração da plataforma', { exact: true }).selectOption('orgs');
    await mp.getByRole('heading', { name: 'Órgãos', level: 2 }).waitFor({ timeout: 30000 });
    await mp.waitForTimeout(1500);
    await mp.screenshot({ path: `${SHOTS}/admin-celular-orgaos.png`, fullPage: true });
    const larg = await mp.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(larg <= 390, `rolagem lateral no celular: ${larg}px`);
    console.log('ok 5: celular usa o seletor, sem rolagem lateral');

    // 4) Ficha do órgão no celular: lista mostra o órgão, a ficha abre pelo link.
    await mp.getByRole('button', { name: /Promotoria de Teste/ }).click();
    await mp.getByRole('heading', { name: 'Promotoria de Teste', level: 3 }).waitFor({ timeout: 60000 });
    assert.match(mp.url(), /orgao=org1/);
    await mp.getByText('Maria Membro').first().waitFor();
    await mp.screenshot({ path: `${SHOTS}/admin-celular-ficha.png`, fullPage: true });
    assert.ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'ficha sem rolagem lateral');
    console.log('ok 6: lista mostra o órgão e a ficha abre no celular');
    await m.close();

    // 5) Suspender no computador; o membro vê o aviso e não lê o órgão; reativar devolve.
    const d = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const dp = await d.newPage();
    await entrar(dp, 'super@teste.dev');
    await dp.goto(`${SITE}/Admin?secao=orgs&orgao=org1`);
    await dp.getByRole('button', { name: 'Suspender' }).click();
    await dp.getByLabel('Motivo (os membros vão ler este texto)').fill('Órgão em reestruturação.');
    await dp.getByRole('dialog').getByRole('button', { name: 'Suspender' }).click();
    await dp.getByText('Motivo mostrado aos membros: Órgão em reestruturação.').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-ficha-suspensa.png`, fullPage: true });
    const v = (await db.doc(`userOrganizations/${comumUid}_org1`).get()).data();
    assert.equal(v.org_suspended, true);
    console.log('ok 7: suspensão marca os vínculos e aparece na ficha');

    const mb = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const mbp = await mb.newPage();
    await entrar(mbp, 'comum@teste.dev');
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste está suspenso').waitFor({ timeout: 60000 });
    await mbp.getByText('Órgão em reestruturação.').waitFor();
    await mbp.screenshot({ path: `${SHOTS}/membro-orgao-suspenso.png` });
    console.log('ok 8: membro vê o aviso de órgão suspenso com o motivo');

    await dp.getByRole('button', { name: 'Reativar' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Reativar' }).click();
    await dp.getByText('Ativo', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().org_suspended, undefined);
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste', { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(await mbp.getByText('está suspenso').count(), 0);
    console.log('ok 9: reativar devolve o acesso');

    // Trocar criador: o membro vira criador e o anterior vira administrador.
    await dp.getByRole('button', { name: 'Trocar criador' }).click();
    await dp.getByLabel('Novo criador').selectOption(comumUid);
    await dp.getByRole('dialog').getByRole('button', { name: 'Trocar criador' }).click();
    await dp.getByText('criador: Maria Membro').waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${donoUid}_org1`).get()).data().role, 'admin');
    assert.equal((await db.doc('organizations/org1').get()).data().created_by, comumUid);
    console.log('ok 10: trocar criador');

    // Pessoas: só quem é do SIGO aparece (conta de outro sistema, não).
    await criar('outroapp@teste.dev');
    await dp.goto(`${SITE}/Admin?secao=users`);
    await dp.getByRole('button', { name: /Maria Membro/ }).waitFor({ timeout: 60000 });
    assert.equal(await dp.getByText('outroapp@teste.dev').count(), 0, 'conta de outro sistema não aparece');
    await dp.screenshot({ path: `${SHOTS}/admin-pessoas.png`, fullPage: true });
    console.log('ok 11: lista só pessoas do SIGO');

    // Super-admin não bloqueia a si mesmo.
    await dp.goto(`${SITE}/Admin?secao=users&pessoa=${adminUid}`);
    await dp.getByText('Esta é a sua conta: você não pode bloquear a si mesmo.').waitFor({ timeout: 60000 });
    assert.equal(await dp.getByRole('button', { name: 'Bloquear no SIGO' }).isDisabled(), true);

    // Bloquear a Maria: vínculos marcados, ela vê o aviso; desbloquear devolve.
    await dp.goto(`${SITE}/Admin?secao=users&pessoa=${comumUid}`);
    await dp.getByRole('button', { name: 'Bloquear no SIGO' }).click();
    await dp.getByLabel('Motivo (a pessoa vai ler este texto)').fill('Desligada da instituição.');
    await dp.getByRole('dialog').getByRole('button', { name: 'Bloquear' }).click();
    await dp.getByText('Motivo mostrado à pessoa: Desligada da instituição.').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-pessoa-bloqueada.png`, fullPage: true });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().user_blocked, true);
    assert.equal((await db.doc(`platformBlocks/${comumUid}`).get()).data().ativa, true);
    console.log('ok 12: bloqueio marca os vínculos e aparece na ficha');

    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Seu acesso ao SIGO está bloqueado').waitFor({ timeout: 60000 });
    await mbp.getByText('Desligada da instituição.').waitFor();
    await mbp.screenshot({ path: `${SHOTS}/pessoa-bloqueada.png` });
    console.log('ok 13: a pessoa bloqueada vê o aviso com o motivo');

    await dp.getByRole('button', { name: 'Desbloquear' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Desbloquear' }).click();
    await dp.getByText('Ativa', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal((await db.doc(`userOrganizations/${comumUid}_org1`).get()).data().user_blocked, undefined);
    await mbp.goto(`${SITE}/Organization?id=org1`);
    await mbp.getByText('Promotoria de Teste', { exact: true }).first().waitFor({ timeout: 60000 });
    assert.equal(await mbp.getByText('está bloqueado').count(), 0);
    console.log('ok 14: desbloquear devolve o acesso');

    // Identidade: cor clara demais não salva; nome e cor novos valem na tela de entrada.
    await dp.goto(`${SITE}/Admin?secao=branding`);
    await dp.getByLabel('Nome curto').fill('CAO Teste');
    await dp.getByLabel('Cor principal', { exact: true }).fill('#FFD966');
    await dp.getByText('Escolha um tom mais escuro').waitFor();
    assert.equal(await dp.getByRole('button', { name: 'Salvar identidade' }).isDisabled(), true);
    await dp.getByLabel('Cor principal', { exact: true }).fill('#1F4E79');
    await dp.getByLabel('E-mail', { exact: true }).fill('suporte@teste.dev');
    await dp.getByRole('button', { name: 'Salvar identidade' }).click();
    await dp.getByText('Tudo salvo.').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-identidade.png`, fullPage: true });
    assert.equal((await db.doc('platformConfig/branding').get()).data().nome_curto, 'CAO Teste');
    const anon = await browser.newPage();
    await anon.goto(`${SITE}/`);
    await anon.getByText('Suporte: suporte@teste.dev').waitFor({ timeout: 60000 });
    assert.match(await anon.title(), /^CAO Teste - /);
    await anon.close();
    console.log('ok 15: identidade salva vale na tela de entrada e na aba');

    // Termos com aceite: publicar pede aceite de todos, inclusive de quem publicou.
    await dp.getByLabel('Texto dos termos').fill('Termos de uso do teste. '.repeat(5));
    await dp.getByRole('button', { name: 'Publicar versão 1' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Publicar' }).click();
    await mbp.goto(`${SITE}/Dashboard`);
    await mbp.getByRole('heading', { name: 'Termos de uso' }).waitFor({ timeout: 60000 });
    await mbp.screenshot({ path: `${SHOTS}/termos-aceite.png` });
    await mbp.getByRole('button', { name: 'Li e aceito os termos' }).click();
    await mbp.getByRole('heading', { name: 'Termos de uso' }).waitFor({ state: 'detached', timeout: 60000 });
    assert.equal((await db.doc(`users/${comumUid}`).get()).data().termos_versao_aceita, 1);
    console.log('ok 16: termos publicados pedem aceite e o aceite fica no perfil');

    // Aviso para todos: aparece para o membro e some ao dispensar.
    await dp.goto(`${SITE}/Admin?secao=avisos`);
    const gate = dp.getByRole('button', { name: 'Li e aceito os termos' });
    await gate.click({ timeout: 60000 }); // quem publicou os termos também aceita
    await dp.getByLabel('Título', { exact: true }).fill('Nova versão no ar');
    await dp.getByLabel('Texto (opcional)').fill('Confira as novidades na Central de Ajuda.');
    await dp.getByLabel('Link (opcional)').fill('/Help');
    await dp.getByRole('button', { name: 'Publicar aviso' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await dp.getByText('No ar', { exact: true }).waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-avisos.png`, fullPage: true });
    await mbp.goto(`${SITE}/Dashboard`);
    await mbp.getByRole('status', { name: 'Aviso: Nova versão no ar' }).waitFor({ timeout: 60000 });
    await mbp.screenshot({ path: `${SHOTS}/aviso-membro.png` });
    await mbp.getByRole('button', { name: 'Dispensar aviso' }).click();
    assert.equal(await mbp.getByRole('status', { name: 'Aviso: Nova versão no ar' }).count(), 0);
    console.log('ok 17: aviso aparece para todos e pode ser dispensado');

    // Manutenção: o membro vê a tela de manutenção; o super-admin segue usando; desligar devolve.
    await dp.getByLabel('Mensagem para quem tentar entrar').fill('Atualização do banco. Volta em 30 minutos.');
    await dp.getByRole('button', { name: 'Ligar manutenção' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await dp.getByText('Modo manutenção ligado.').first().waitFor({ timeout: 60000 });
    await mbp.getByRole('heading', { name: /em manutenção/ }).waitFor({ timeout: 60000 });
    await mbp.getByText('Atualização do banco. Volta em 30 minutos.').waitFor();
    await mbp.screenshot({ path: `${SHOTS}/manutencao-membro.png` });
    await dp.getByRole('button', { name: 'Desligar manutenção' }).click();
    await dp.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await mbp.getByRole('heading', { name: /em manutenção/ }).waitFor({ state: 'detached', timeout: 60000 });
    console.log('ok 18: manutenção barra o membro, não o super-admin, e desligar devolve');

    // Cota de membros: o painel mostra o uso; com limite 2 (já há 2 ativos), o convite recusa.
    await dp.goto(`${SITE}/Admin?secao=quotas`);
    await dp.getByText('Maior uso hoje: 2 membros (Promotoria de Teste)').waitFor({ timeout: 60000 });
    await dp.getByLabel('Limite (membros)').fill('2');
    await dp.getByRole('button', { name: 'Salvar' }).nth(1).click();
    await dp.getByText('100% do limite').waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-cotas.png`, fullPage: true });
    await db.doc('organizations/org1').set({ invite_code: 'COTA22' }, { merge: true });
    await criar('novo@teste.dev');
    const login = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'novo@teste.dev', password: 'segredo123', returnSecureToken: true }),
    })).json();
    const r = await (await fetch(`http://127.0.0.1:5001/${PROJ}/southamerica-east1/joinOrganization`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${login.idToken}` }, body: JSON.stringify({ data: { inviteCode: 'COTA22' } }),
    })).json();
    assert.equal(r.error?.status, 'RESOURCE_EXHAUSTED', JSON.stringify(r));
    console.log('ok 19: cota de membros vale no convite e o painel mostra o uso');

    // Central de segurança: checklist, confirmação de item de console, auditoria e exportação.
    await dp.goto(`${SITE}/Admin?secao=seguranca`);
    await dp.getByRole('img', { name: /Pontuação de segurança: \d+ de 100/ }).waitFor({ timeout: 60000 });
    await dp.getByText('Só uma pessoa. Se ela perder o acesso, ninguém administra a plataforma.').waitFor();
    await dp.getByText('Não foi possível consultar o banco agora.').first().waitFor();
    await dp.getByRole('button', { name: 'Já está feito no console' }).first().click();
    await dp.getByText(/Confirmado por /).waitFor({ timeout: 60000 });
    await dp.getByText(/confirmou item de segurança/).waitFor({ timeout: 60000 });
    await dp.getByText(/suspendeu órgão/).first().waitFor();
    await dp.getByLabel('Ação', { exact: true }).selectOption('PLATFORM_USER_BLOCKED');
    await dp.getByText(/bloqueou pessoa no sigo/).first().waitFor({ timeout: 60000 });
    assert.equal(await dp.getByText(/suspendeu órgão/).count(), 0, 'filtro por ação');
    const baixar = dp.waitForEvent('download');
    await dp.getByRole('button', { name: /Exportar .*em CSV/ }).click();
    assert.match((await baixar).suggestedFilename(), /^auditoria-plataforma-.*\.csv$/);
    await dp.getByLabel('Ação', { exact: true }).selectOption('');
    await dp.screenshot({ path: `${SHOTS}/admin-seguranca.png`, fullPage: true });
    const m2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true });
    const mp2 = await m2.newPage();
    await entrar(mp2, 'super@teste.dev');
    await mp2.goto(`${SITE}/Admin?secao=seguranca`);
    await mp2.getByRole('img', { name: /Pontuação de segurança/ }).waitFor({ timeout: 60000 });
    await mp2.screenshot({ path: `${SHOTS}/admin-seguranca-celular.png`, fullPage: true });
    await m2.close();
    console.log('ok 20: central de segurança com checklist, confirmação, auditoria filtrada e CSV');

    // Acesso de super-admin retirado vale na hora, mesmo com o claim no token já emitido.
    const saUid = await criar('sa2@teste.dev');
    await admin.auth().setCustomUserClaims(saUid, { platformAdmin: true });
    const saLogin = await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sa2@teste.dev', password: 'segredo123', returnSecureToken: true }),
    })).json();
    const painelSa = async () => (await fetch(`http://127.0.0.1:5001/${PROJ}/southamerica-east1/platformSecurity`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${saLogin.idToken}` }, body: JSON.stringify({ data: { action: 'painel' } }),
    })).json();
    assert.ok((await painelSa()).result?.itens, 'com claim, entra');
    await db.doc(`platformAdmins/${saUid}`).set({ active: false, email: 'sa2@teste.dev' });
    assert.equal((await painelSa()).error?.status, 'PERMISSION_DENIED', 'retirado, não entra mais');
    console.log('ok 21: acesso retirado vale na hora, sem revogar tokens');

    // Diagnóstico: rotina com falha registrada aparece, sem registro também; erros do Google Cloud ficam "não disponível" no emulador.
    const falha = { em: new Date().toISOString(), duracao_ms: 1200, status: 'erro', erro: 'Falha de teste ao enviar e-mail' };
    await db.doc('platformRoutines/secretariaAlertaPrazos').set({ ultima: falha, ultimo_erro: falha, historico: [falha, { ...falha, status: 'ok', erro: undefined, em: new Date(Date.now() - 864e5).toISOString() }].map((h) => JSON.parse(JSON.stringify(h))) });
    await dp.goto(`${SITE}/Admin?secao=health`);
    await dp.getByText(/pontos? para olhar|Tudo funcionando/).waitFor({ timeout: 60000 });
    await dp.getByText('Falhou', { exact: true }).first().waitFor();
    await dp.getByText('Falha de teste ao enviar e-mail').waitFor();
    assert.ok(await dp.getByText('Sem registro ainda').count() >= 1, 'rotina sem registro');
    await dp.getByText(/Não disponível agora: o registro do Google Cloud/).waitFor();
    await dp.screenshot({ path: `${SHOTS}/admin-diagnostico.png`, fullPage: true });
    console.log('ok 22: diagnóstico mostra rotinas com falha e sem registro');

    // Cópias e exportação: o órgão vem escolhido pelo link da ficha; o .json leva os registros e a configuração.
    await db.doc('processes/pp1/history/h1').set({ action: 'criado', organization_id: 'org1' });
    await dp.goto(`${SITE}/Admin?secao=copias&orgao=org1`);
    await dp.getByText(/Não foi possível consultar a configuração do banco agora/).waitFor({ timeout: 60000 });
    await dp.getByLabel('Órgão', { exact: true }).locator('option[value="org1"]').waitFor({ state: 'attached', timeout: 60000 });
    assert.equal(await dp.getByLabel('Órgão', { exact: true }).inputValue(), 'org1');
    const baixarOrg = dp.waitForEvent('download', { timeout: 120000 });
    await dp.getByRole('button', { name: 'Exportar em JSON' }).click();
    const arqOrg = await baixarOrg;
    const json = JSON.parse(fs.readFileSync(await arqOrg.path(), 'utf8'));
    assert.equal(json.orgao.id, 'org1');
    assert.equal(json.colecoes.processes[0]._id, 'pp1');
    assert.equal(json.colecoes.processes[0]._subcolecoes.history[0].action, 'criado');
    assert.equal(json.colecoes.configuracao[0].name, 'Promotoria de Teste');
    assert.ok(json.colecoes.userOrganizations.length >= 2);
    const baixarCfg = dp.waitForEvent('download', { timeout: 60000 });
    await dp.getByRole('button', { name: 'Exportar configuração' }).click();
    const cfg = JSON.parse(fs.readFileSync(await (await baixarCfg).path(), 'utf8'));
    assert.ok(cfg.platformConfig.branding, 'configuração com a identidade');
    await dp.screenshot({ path: `${SHOTS}/admin-copias.png`, fullPage: true });
    console.log('ok 23: exportação do órgão e da configuração em JSON');

    // Custos e uso: no emulador não há monitoramento; uso por órgão vem da auditoria; alerta salvo.
    await dp.goto(`${SITE}/Admin?secao=costs`);
    await dp.getByText(/Não disponível agora: o monitoramento/).waitFor({ timeout: 60000 });
    await dp.getByRole('link', { name: 'Promotoria de Teste' }).first().waitFor();
    await dp.getByLabel('Leituras por dia').fill('1000');
    await dp.getByRole('button', { name: 'Salvar' }).click();
    await dp.getByText('Alerta salvo. A conferência é todo dia às 6h.').waitFor({ timeout: 60000 });
    await dp.getByText(/Última alteração em/).waitFor({ timeout: 60000 });
    // Gráfico com dados de exemplo (a resposta da função é trocada só nesta tela), para conferir o desenho.
    const dias = Array.from({ length: 30 }, (_, i) => ({ dia: new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10), leituras: 20000 + ((i * 7919) % 45000), escritas: 3000 + ((i * 3571) % 9000), exclusoes: 10 }));
    await dp.route('**/platformUso', async (route) => {
        const real = await (await route.fetch()).json();
        if (real.result) Object.assign(real.result, { banco: dias, funcoes: dias.map((d) => ({ dia: d.dia, chamadas: Math.round(d.leituras / 40) })) });
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(real) });
    });
    await dp.reload();
    await dp.getByRole('img', { name: /Leituras: média de/ }).waitFor({ timeout: 60000 });
    await dp.screenshot({ path: `${SHOTS}/admin-custos.png`, fullPage: true });
    await dp.unroute('**/platformUso');
    console.log('ok 24: custos e uso com uso por órgão, alerta salvo e gráfico');
} finally {
    await browser.close();
}
