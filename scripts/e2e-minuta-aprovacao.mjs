// E2E da minuta com aprovação e devolução para correção, nos emuladores (auth, firestore, functions, storage), com a tela:
//   VITE_USE_EMULATORS=true npx vite --port 5173 &   (com os VITE_FIREBASE_* do projeto demo-sigo)
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-minuta-aprovacao.mjs"
// Três contas na mesma unidade: quem cadastra a demanda, a assessora que redige e a decisora que gere a unidade.
// Confere, com o modelo "Demanda com minuta e aprovação" implantado pelo servidor: a demanda fica Pendente sem
// responsável; quem assume leva o processo sozinho para Em análise; ali só se elaboram minutas (ninguém junta);
// "Enviar para aprovação" leva à Revisão com a decisora como responsável; a assessora não aprova nem devolve
// (reserva do rito, no servidor e na tela); a decisora devolve com o motivo e o processo volta à assessora, na
// fase em que a minuta foi redigida, com o pedido no alto da tela e fora dos autos; reenviada, a minuta volta
// para quem pediu, com o pedido atendido à vista; aprovada, vira documento dos autos e a assessora é avisada.
// Capturas em E2E_SHOTS (padrão: /tmp).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');
const { chromium } = createRequire(import.meta.url)('playwright');
const { modelosDeRito } = await import('../src/lib/secretariaRito.js');
const { deRito, montarPayload } = await import('../src/lib/propostaRito.js');

const SITE = process.env.E2E_SITE || 'http://localhost:5173';
const SHOTS = process.env.E2E_SHOTS || '/tmp';
const PROJ = 'demo-sigo';
const BUCKET = `${PROJ}.appspot.com`;
admin.initializeApp({ projectId: PROJ, storageBucket: BUCKET });
const db = admin.firestore();

// Uma sessão por pessoa: cada uma chama o servidor com a própria conta.
const pessoa = async (email, nome) => {
    const app = initializeApp({ apiKey: 'demo', projectId: PROJ, storageBucket: BUCKET, appId: 'x' }, email);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(auth, email, 'segredo123');
    await db.doc(`users/${user.uid}`).set({ email, full_name: nome, accepted_terms: true, terms_accepted_at: new Date().toISOString() });
    const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    const chamar = (fn) => (action, extra) => httpsCallable(fns, fn, { timeout: 300000 })({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
    return { uid: user.uid, email, nome, proc: chamar('secretariaProcesso'), cfg: chamar('secretariaConfig'), doc: chamar('secretariaDocumento') };
};
const cadastro = await pessoa('cadastro@teste.dev', 'Carlos Cadastro');
const ana = await pessoa('ana@teste.dev', 'Ana Assessora');
const dra = await pessoa('dra@teste.dev', 'Paula Decisora');
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: cadastro.uid, secretariaConfig: { enabled: true } });
for (const [x, role] of [[cadastro, 'creator'], [ana, 'member'], [dra, 'member']]) {
    await db.doc(`userOrganizations/${x.uid}_org1`).set({ id: `${x.uid}_org1`, user_id: x.uid, organization_id: 'org1', role, active: true, user_name: x.nome, joined_at: new Date().toISOString() });
}
// Uma só unidade: quem redige e quem decide trabalham juntos; só a decisora gere a unidade.
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'PROCREC', sigla: 'PRC', tipo: 'gabinete', ativa: true,
    lotacoes: [{ uid: cadastro.uid }, { uid: ana.uid, atribuicao: 'Assessor' }, { uid: dra.uid, gestor: true, atribuicao: 'Procuradora' }], membros_uids: [cadastro.uid, ana.uid, dra.uid] });

// O rito sai do modelo pronto, pelo mesmo caminho do editor (o servidor saneia e cria o tipo de processo).
const modelo = modelosDeRito().find((m) => m.nome === 'Demanda com minuta e aprovação');
const proposta = deRito({ ...modelo, nome: 'Demandas PROCREC' });
proposta.fases = proposta.fases.map((f) => ({ ...f, unidade_ref: 'u1' }));
const implantado = await cadastro.cfg('aplicarPropostaRito', { proposta: montarPayload(proposta, { criar: true, nome: 'Demanda PROCREC', sigla: 'DP' }) });
const rito = (await db.doc(`secRitos/${implantado.rito_id}`).get()).data();
const fase = Object.fromEntries(rito.fases.map((f) => [f.nome, f.id]));
assert.deepEqual(Object.keys(fase), ['Pendente', 'Em análise', 'Revisão', 'Arquivamento']);

const { id } = await cadastro.proc('autuar', { tipo_id: implantado.tipo_id, rito_id: implantado.rito_id, unidade_id: 'u1', assunto: 'Agravo em recurso especial: contrarrazões', partes: [] });
const lido = async () => (await db.doc(`secProcessos/${id}`).get()).data();
const docs = async () => (await db.collection(`secProcessos/${id}/documentos`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const mov = async (x, action, extra) => x.proc(action, { id, version: (await lido()).version, ...extra });
let p = await lido();
assert.equal(p.fase_atual, fase.Pendente);
assert.ok(!p.responsavel_uid, 'a demanda cadastrada espera sem responsável');

const entrar = async (page, email, url) => {
    await page.goto(`${SITE}/`);
    await page.waitForLoadState('load');
    await page.evaluate(async (e) => {
        const cfg = await import('/src/config/firebase.js');
        const fonte = await (await fetch('/src/config/firebase.js')).text();
        const u = fonte.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)[1];
        const { signInWithEmailAndPassword } = await import(u);
        await signInWithEmailAndPassword(cfg.auth, e, 'segredo123');
    }, email);
    await page.goto(`${SITE}${url}`);
};
const foto = async (page, nome) => { await page.waitForTimeout(800); await page.screenshot({ path: `${SHOTS}/minuta-${nome}.png` }); };
// A mesma tela no celular: nada pode sair pela lateral.
const celular = async (page, nome, alvo) => {
    const antes = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText(alvo).first().scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nome}: sem rolagem lateral no celular`);
    await foto(page, nome);
    await page.setViewportSize(antes);
};
const URL_PROC = `/ProcessoEletronico?org=org1&p=${id}`;
const paragrafo = (t) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
try {
    const tela = async (x, { w = 1366, h = 768, escuro = false } = {}) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: escuro ? 'dark' : 'light', deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        if (escuro) await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
        await entrar(page, x.email, URL_PROC);
        await page.getByRole('tab', { name: /^Andamento/ }).waitFor({ timeout: 90000 });
        return page;
    };

    // 1) Pendente: o botão da fase é assumir, e o processo segue sozinho para Em análise.
    let pa = await tela(ana);
    const assumir = pa.getByRole('button', { name: 'Assumir e seguir para Em análise' }).first();
    await assumir.waitFor({ timeout: 60000 });
    await pa.getByText(/e ele segue sozinho para/).waitFor();
    await foto(pa, '1-pendente');
    await assumir.click();
    await pa.getByText(/o processo seguiu para Em análise/).first().waitFor({ timeout: 60000 });
    p = await lido();
    assert.equal(p.fase_atual, fase['Em análise']);
    assert.equal(p.responsavel_uid, ana.uid, 'quem assumiu responde pelo processo na fase seguinte');

    // 2) Em análise (elaboração): a assessora redige a minuta e um anexo; ninguém junta nesta fase.
    const minuta = await ana.doc('criarMinuta', { processoId: id, titulo: 'Contrarrazões ao agravo', tipo: 'Petição', conteudo: paragrafo('Egrégio Tribunal, o agravo não merece provimento.') });
    const anexo = await ana.doc('criarMinuta', { processoId: id, titulo: 'Quadro de precedentes', tipo: 'Anexo', conteudo: paragrafo('Precedentes do tribunal sobre o tema.') });
    assert.ok(minuta.cumpre, 'a minuta cumpre a ação de documento da fase de elaboração');
    assert.equal((await docs()).find((d) => d.id === minuta.id).fase_id, fase['Em análise'], 'a minuta guarda a fase em que foi redigida');
    await assert.rejects(ana.doc('juntar', { processoId: id, docId: minuta.id }), /só se elaboram minutas/);
    await pa.reload();
    await pa.getByText('Contrarrazões ao agravo').first().waitFor({ timeout: 60000 });
    assert.ok(await pa.getByText('Minuta', { exact: true }).count() >= 2, 'cada documento da fase leva o selo Minuta');
    assert.equal(await pa.getByRole('button', { name: /^(Aprovar e juntar|Juntar)$/ }).count(), 0);
    await pa.getByText('Contrarrazões ao agravo').first().scrollIntoViewIfNeeded();
    await foto(pa, '2-em-analise');

    // Enviar para aprovação: o botão leva o nome que o rito deu.
    await pa.getByRole('button', { name: 'Enviar para aprovação' }).first().click();
    await pa.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await pa.getByText('Fase alterada').first().waitFor({ timeout: 60000 });
    p = await lido();
    assert.equal(p.fase_atual, fase['Revisão']);
    assert.equal(p.responsavel_uid, dra.uid, 'a Revisão entrega o processo a quem gere a unidade');

    // 3) Revisão: quem redigiu não aprova nem devolve (o rito reserva a quem decide), na tela e no servidor.
    await pa.reload();
    await pa.getByText(/só quem gere a unidade aprova a minuta/).first().waitFor({ timeout: 60000 });
    await pa.getByRole('note').first().scrollIntoViewIfNeeded();
    assert.ok(await pa.getByRole('button', { name: 'Juntar', exact: true }).first().isDisabled(), 'quem não decide vê o botão apagado, com o motivo');
    await foto(pa, '3-revisao-quem-redigiu');
    await assert.rejects(mov(ana, 'avancarFase', {}), /só quem gere a unidade conclui a fase/);
    await assert.rejects(ana.doc('juntar', { processoId: id, docId: minuta.id }), /só quem gere a unidade aprova a minuta/);
    await assert.rejects(mov(ana, 'devolverMinuta', { docId: minuta.id, correcao: 'Faltou o pedido final.' }), /minuta é sua/);
    await pa.context().close();

    // A decisora lê, devolve para correção e diz o que falta.
    let pd = await tela(dra);
    await pd.getByText('Minutas para aprovar').waitFor({ timeout: 60000 });
    await pd.getByText('Minutas para aprovar').scrollIntoViewIfNeeded();
    await foto(pd, '4-revisao-quem-decide');
    await celular(pd, '4b-revisao-celular', 'Minutas para aprovar');
    await pd.getByRole('button', { name: 'Devolver para correção' }).first().click();
    const janela = pd.getByRole('dialog');
    await janela.getByText(/volta para a fase/).waitFor();
    assert.match(await janela.innerText(), /Em análise[\s\S]*Ana Assessora/);
    assert.ok(await janela.getByRole('button', { name: 'Confirmar' }).isDisabled(), 'sem dizer o que corrigir, não confirma');
    const PEDIDO = 'Incluir o pedido de não conhecimento do agravo e citar a súmula aplicável.';
    await janela.getByLabel(/O que precisa ser corrigido ou complementado/).fill(PEDIDO);
    await foto(pd, '5-devolver-para-correcao');
    await janela.getByRole('button', { name: 'Confirmar' }).click();
    await pd.getByText('Minuta devolvida para correção').first().waitFor({ timeout: 60000 });
    p = await lido();
    assert.equal(p.fase_atual, fase['Em análise'], 'volta para a fase em que a minuta foi redigida');
    assert.equal(p.responsavel_uid, ana.uid, 'com quem redigiu como responsável');
    let d = (await docs()).find((x) => x.id === minuta.id);
    assert.equal(d.status, 'minuta');
    assert.equal(d.correcao.motivo, PEDIDO);
    assert.equal(d.correcao.por_uid, dra.uid);
    // O motivo fica com a equipe: nenhum movimento que vai aos autos ou às partes o repete.
    const movs = (await db.collection(`secProcessos/${id}/movimentos`).get()).docs.map((x) => x.data());
    const comMotivo = movs.filter((m) => String(m.descricao || '').includes('súmula'));
    assert.ok(comMotivo.length >= 1, 'o pedido fica num registro interno');
    assert.ok(comMotivo.every((m) => m.dados?.interno === true && m.dados?.fora_impressao === true), 'o pedido de correção não vai aos autos nem ao portal');
    assert.ok(movs.some((m) => /Devolução para correção de minuta/.test(m.descricao || '')), 'a mudança de fase diz que é devolução para correção, sem o motivo');
    await pd.context().close();

    // 4) A assessora vê o pedido no alto da tela, corrige e reenvia.
    pa = await tela(ana);
    await pa.getByText('Minuta devolvida para correção: Contrarrazões ao agravo').waitFor({ timeout: 60000 });
    await pa.getByText(PEDIDO).first().waitFor();
    await pa.getByText('Em correção').first().waitFor();
    await foto(pa, '6-pedido-de-correcao');
    await celular(pa, '6b-pedido-de-correcao-celular', 'Minuta devolvida para correção: Contrarrazões ao agravo');
    await ana.doc('editarMinuta', { processoId: id, docId: minuta.id, conteudo: paragrafo('Egrégio Tribunal, o agravo não deve ser conhecido (súmula aplicável); no mérito, não merece provimento.') }).catch((e) => { throw new Error(`salvar a minuta corrigida: ${e.message}`); });
    await pa.reload();
    await pa.getByRole('button', { name: 'Enviar para aprovação' }).first().click({ timeout: 60000 });
    await pa.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await pa.getByText('Fase alterada').first().waitFor({ timeout: 60000 });
    p = await lido();
    assert.equal(p.fase_atual, fase['Revisão']);
    assert.equal(p.responsavel_uid, dra.uid, 'a minuta corrigida volta para quem pediu a correção');
    assert.ok(!p.minutas_em_correcao?.length);
    d = (await docs()).find((x) => x.id === minuta.id);
    assert.ok(!d.correcao && d.correcao_anterior.motivo === PEDIDO, 'o pedido atendido continua à vista de quem aprova');
    await pa.context().close();

    // 5) A decisora vê que a minuta voltou, aprova e junta; o anexo fica de fora. Tela larga.
    pd = await tela(dra, { w: 1920, h: 1080 });
    await pd.getByText(/Voltou depois da correção/).first().waitFor({ timeout: 60000 });
    await pd.getByText(/Voltou depois da correção/).first().scrollIntoViewIfNeeded();
    await foto(pd, '7-voltou-corrigida-1920');
    await pd.getByRole('button', { name: 'Aprovar e juntar' }).first().click();
    const aprovar = pd.getByRole('dialog', { name: /Aprovar e juntar aos autos: Contrarrazões ao agravo/ });
    await aprovar.waitFor();
    await foto(pd, '8-aprovar-e-juntar-1920');
    await aprovar.getByRole('button', { name: 'Confirmar' }).click();
    for (let i = 0; i < 240 && (await docs()).find((x) => x.id === minuta.id).status !== 'juntado'; i += 1) await pd.waitForTimeout(500);
    d = (await docs()).find((x) => x.id === minuta.id);
    assert.equal(d.status, 'juntado', 'aprovada, a minuta vira documento definitivo dos autos');
    assert.ok(d.ordem >= 1);
    assert.equal((await docs()).find((x) => x.id === anexo.id).status, 'minuta', 'o anexo não escolhido continua minuta');
    await pd.context().close();

    // Tema escuro, no computador: a tela de quem decide com o anexo que sobrou.
    pd = await tela(dra, { escuro: true });
    await pd.getByText('Quadro de precedentes').first().waitFor({ timeout: 60000 });
    await pd.getByText('Quadro de precedentes').first().scrollIntoViewIfNeeded();
    await foto(pd, '9-revisao-escuro');
    await pd.context().close();

    // Concluir com o anexo ainda como minuta: a janela avisa antes; confirmado, o processo é arquivado.
    pd = await tela(dra);
    await pd.getByRole('button', { name: 'Concluir e seguir para Arquivamento' }).first().click({ timeout: 60000 });
    const concluir = pd.getByRole('dialog');
    await concluir.getByText(/A minuta "Quadro de precedentes" ainda não foi aprovada/).waitFor();
    await foto(pd, '10-concluir-com-aviso');
    await concluir.getByRole('button', { name: 'Confirmar' }).click();
    for (let i = 0; i < 120 && (await lido()).status !== 'arquivado'; i += 1) await pd.waitForTimeout(500);
    p = await lido();
    assert.equal(p.fase_atual, fase.Arquivamento);
    assert.equal(p.status, 'arquivado', 'a última fase arquiva o processo ao entrar');
    await pd.context().close();

    // 6) Editor do rito: a seção da minuta diz o papel de cada fase e quem aprova.
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: 'light', deviceScaleFactor: 2 });
    const pe = await ctx.newPage();
    await entrar(pe, cadastro.email, '/Organization?id=org1&tab=admin&secao=secretaria&aba=ritos');
    await pe.getByRole('button', { name: /^Editar o rito Demandas PROCREC/ }).click({ timeout: 90000 });
    await pe.getByRole('button', { name: 'Adicionar elaboração e aprovação de minuta' }).waitFor({ timeout: 60000 });
    const secoes = pe.locator('details').filter({ has: pe.locator('summary', { hasText: 'Minuta: elaboração e aprovação' }) });
    assert.ok(await secoes.count() >= 1, 'cada fase aberta tem a seção da minuta');
    await pe.getByText('Revisão').first().click().catch(() => {});
    const daRevisao = pe.locator('details').filter({ has: pe.locator('summary', { hasText: /é de aprovação da minuta/ }) }).first();
    await daRevisao.locator('summary').click({ timeout: 30000 });
    await daRevisao.getByText('Aprovação: aqui se aprova a minuta ou se devolve para correção').waitFor();
    await daRevisao.scrollIntoViewIfNeeded();
    await foto(pe, '11-editor-secao-minuta');
    // O botão insere as duas fases prontas, antes da fase final.
    await pe.getByRole('button', { name: 'Adicionar elaboração e aprovação de minuta' }).click();
    await pe.getByText(/Fases de elaboração e de aprovação da minuta adicionadas/).waitFor({ timeout: 30000 });
    assert.ok(await pe.locator('input[value="Elaboração da minuta"]').count() >= 1, 'a fase de elaboração entra com nome');
    await foto(pe, '12-editor-par-de-fases');
    // 7) O Guia do rito explica o fluxo, na parte 23.
    await pe.goto(`${SITE}/Help#guia-do-rito`);
    await pe.getByRole('tab', { name: /Referência \(23 partes\)/ }).click({ timeout: 60000 });
    const parte = pe.locator('#guia-parte-23');
    await parte.locator('summary').click();
    await parte.getByText('Devolver para correção.').waitFor();
    await parte.scrollIntoViewIfNeeded();
    await foto(pe, '13-guia-parte-23');
    await ctx.close();
    console.log('e2e minuta com aprovação: ok');
} finally {
    await browser.close();
}
process.exit(0);
