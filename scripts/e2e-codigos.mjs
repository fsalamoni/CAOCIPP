// E2E dos códigos numéricos da numeração nos emuladores (auth, firestore, functions):
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-codigos.mjs"
// Confere: numeração com código do órgão interno e do tipo; autuação recusada sem código;
// código repetido recusado; salvar o órgão interno não apaga o código; número com zeros à
// esquerda; mudar o código não renumera o processo já autuado.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');

const PROJ = 'demo-sigo';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const cfg = (action, extra) => httpsCallable(fns, 'secretariaConfig')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const proc = (action, extra) => httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const falha = async (p, re) => { await assert.rejects(p, (e) => { assert.match(e.message, re); return true; }); };

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
await db.doc('secConfig/org1').set({ organization_id: 'org1', orgaos: [{ id: 'org_gab', nome: 'Gabinete', sigla: 'GAB' }, { id: 'org_ass', nome: 'Assessoria', sigla: 'ASS' }] });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Secretaria do Gabinete', sigla: 'SG', tipo: 'secretaria', orgao_id: 'org_gab', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
await db.doc('secUnidades/u2').set({ organization_id: 'org1', nome: 'Secretaria da Assessoria', sigla: 'SA', tipo: 'secretaria', orgao_id: 'org_ass', ativa: true, lotacoes: [{ uid }], membros_uids: [uid] });
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Rito simples', ativo: true, versao: 1, fases: [{ id: 'f1', nome: 'Entrada', acoes: [] }] });
await db.doc('secTipos/t1').set({ organization_id: 'org1', nome: 'Requerimento', sigla: 'REQ', rito_id: 'r1', ativo: true, versao: 1 });
await db.doc('secTipos/t2').set({ organization_id: 'org1', nome: 'Representação', sigla: 'REP', rito_id: 'r1', ativo: true, versao: 1 });

// 1) Numeração 000000.000.000/0000: sequencial por tipo, código do órgão interno, código do tipo, ano.
const numeracao = { partes: [
    { t: 'seq', escopo: 'tipo', reinicia: 'ano', digitos: 6 }, { t: 'texto', v: '.' }, { t: 'cod_orgao', digitos: 3 },
    { t: 'texto', v: '.' }, { t: 'cod_tipo', digitos: 3 }, { t: 'texto', v: '/' }, { t: 'ano', digitos: 4 },
] };
await cfg('salvarNumeracao', { numeracao });
const autuar = (tipo, unidade = 'u1') => proc('autuar', { tipo_id: tipo, rito_id: 'r1', unidade_id: unidade, assunto: 'Teste de numeração', partes: [] });
await falha(autuar('t1'), /Requerimento" ainda não tem código|Gabinete" ainda não tem código/);
console.log('ok 1: sem código, a autuação é recusada com o nome do que falta');

// 2) Código repetido na mesma seção é recusado; em seções diferentes pode.
await falha(cfg('salvarCodigos', { codigos: { tipos: { t1: 1, t2: 1 } } }), /código 1 se repete em tipos de processo: (Requerimento e Representação|Representação e Requerimento)/);
await falha(cfg('salvarCodigos', { codigos: { tipos: { t1: 'abc' } } }), /só números/);
await cfg('salvarCodigos', { codigos: { tipos: { t1: 2, t2: 5 }, unidades: { u1: 1 }, orgaos: { org_gab: 1, org_ass: 2 } } });
assert.equal((await db.doc('secTipos/t1').get()).data().codigo, 2);
assert.equal((await db.doc('secUnidades/u1').get()).data().codigo, 1);
console.log('ok 2: códigos gravados; repetido e não numérico recusados');

// 3) Salvar o órgão interno pela tela dele não apaga o código (nem o aceita do formulário).
await cfg('salvarOrgao', { id: 'org_gab', orgao: { nome: 'Gabinete do Titular', sigla: 'GAB', codigo: 99 } });
const orgs = (await db.doc('secConfig/org1').get()).data().orgaos;
assert.equal(orgs.find((o) => o.id === 'org_gab').codigo, 1);
assert.equal(orgs.find((o) => o.id === 'org_gab').nome, 'Gabinete do Titular');
const est = await cfg('estado');
assert.equal(est.tipos.find((t) => t.id === 't1').codigo, 2);
assert.equal(est.unidades.find((u) => u.id === 'u1').codigo, 1);
assert.equal(est.orgaos.find((o) => o.id === 'org_ass').codigo, 2);
console.log('ok 3: o órgão interno salvo mantém o código; estado devolve os códigos');

// 4) Número com zeros à esquerda; contagem por tipo; outro órgão interno muda o código no meio.
const ano = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4);
const a = await autuar('t1');
const b = await autuar('t1', 'u2');
const c = await autuar('t2');
const num = async (r) => (await db.doc(`secProcessos/${r.id}`).get()).data().numero;
assert.equal(await num(a), `000001.001.002/${ano}`);
assert.equal(await num(b), `000002.002.002/${ano}`);
assert.equal(await num(c), `000001.001.005/${ano}`);
console.log('ok 4: números', await num(a), await num(b), await num(c));

// 5) Mudar o código não renumera o que já foi autuado; o próximo sai com o código novo.
await cfg('salvarCodigos', { codigos: { tipos: { t1: 7 } } });
assert.equal(await num(a), `000001.001.002/${ano}`);
const d = await autuar('t1');
assert.equal(await num(d), `000001.001.007/${ano}`);
console.log('ok 5: mudança de código não renumera; novo número', await num(d));

// 6) Código maior que os dígitos da parte: recusa.
await cfg('salvarCodigos', { codigos: { tipos: { t1: 1234 } } });
await falha(autuar('t1'), /1234, maior que 3/);
console.log('ok 6: código maior que os dígitos é recusado na autuação');
process.exit(0);
