// E2E do nº do PGEA (Consultas e Expedientes) nos emuladores (auth, firestore, functions):
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-pgea.mjs"
// Confere: o número é achado escrito de outro jeito e entre os arquivados; cada módulo no seu
// banco; quem não é do órgão não confere. Depois rode scripts/e2e-pgea-tela.mjs (mesmo emulador).
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');

const PROJ = 'demo-sigo';
admin.initializeApp({ projectId: PROJ });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const call = (nome, dados) => httpsCallable(fns, nome)(dados).then((r) => r.data);
const falha = async (p, re) => { await assert.rejects(p, (e) => { assert.match(e.message, re); return true; }); };

const { user: outro } = await createUserWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, stats: {} });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
const agora = admin.firestore.FieldValue.serverTimestamp();
await db.doc('processes/c1').set({ organization_id: 'org1', process_number: '00021.000.125/2024', consultant: 'Prefeitura de Canoas', location: 'Canoas', entry_date: '2024-03-04', matter_object: 'Contratação direta de transporte escolar', archived_date: '2024-06-10', reviewed_date: '2024-06-01', analysis_start_date: '2024-03-10', status: 'Na pasta', responsible_user_name: 'Beatriz Lima', created_at: agora, updated_at: agora });
await db.doc('processes/c2').set({ organization_id: 'org1', process_number: '00021.000.300/2024', consultant: 'Câmara de Esteio', location: 'Esteio', entry_date: '2024-08-01', matter_object: 'Diárias de vereadores', analysis_start_date: '2024-08-02', status: 'Em elaboração', responsible_user_name: 'Carlos Souza', responsible_user_id: uid, created_at: agora, updated_at: agora });
await db.doc('expedientes/e1').set({ organization_id: 'org1', expediente_number: '01234.000.001/2025', system: 'SIM', origin: 'SUBADM', entry_date: '2025-01-15', object: 'Pedido de informações', status: 'Pendente', created_at: agora, updated_at: agora });
await db.doc('processes/x1').set({ organization_id: 'org2', process_number: '00021.000.999/2024', consultant: 'Outro órgão', status: 'Pendente', created_at: agora, updated_at: agora });

const conferir = (modulo, numero) => call('verificarNumeroPgea', { organizationId: 'org1', modulo, numero });

// 1) Arquivada é achada, mesmo escrita sem zeros à esquerda e sem pontos.
let r = await conferir('consultas', '21000125/2024');
assert.equal(r.existe, true);
assert.equal(r.registros.length, 1);
assert.equal(r.registros[0].id, 'c1');
assert.equal(r.registros[0].fase, 'Na pasta');
assert.equal(r.registros[0].arquivado, true);
assert.equal(r.registros[0].responsavel, 'Beatriz Lima');
console.log('ok 1: arquivada achada com o número escrito de outro jeito, com fase e responsável');

// 2) Número novo; número de outro órgão não conta.
r = await conferir('consultas', '00021.000.126/2024');
assert.equal(r.existe, false);
r = await conferir('consultas', '00021.000.999/2024');
assert.equal(r.existe, false);
console.log('ok 2: número novo e número de outro órgão dão "novo"');

// 3) Cada módulo no seu banco.
r = await conferir('expedientes', '01234.000.001/2025');
assert.equal(r.existe, true);
assert.equal(r.registros[0].id, 'e1');
r = await conferir('consultas', '01234.000.001/2025');
assert.equal(r.existe, false);
console.log('ok 3: expediente achado só nos expedientes');

// 4) Entradas inválidas e quem não é do órgão.
await falha(conferir('parcerias', '1'), /Informe/);
await falha(conferir('consultas', ' ./- '), /Informe/);
await signInWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
assert.ok(outro.uid);
await falha(conferir('consultas', '00021.000.125/2024'), /não faz parte/);
console.log('ok 4: módulo inválido, número vazio e pessoa de fora recusados');
process.exit(0);
