// E2E dos aditivos de Consultas e Expedientes nos emuladores (auth, firestore, functions):
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-aditivos.mjs"
// Confere: o original arquivado fica arquivado e intacto; o aditivo nasce em Pendente com o mesmo
// número e a identificação copiada; aditivo de aditivo vira aditivo do original; o número do
// aditivo acompanha o original; original com aditivos não é excluído; expedientes iguais.
// Depois rode scripts/e2e-aditivos-tela.mjs (mesmo emulador).
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
const ler = async (c, id) => (await db.doc(`${c}/${id}`).get()).data();

await createUserWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, stats: {} });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Ana Admin', joined_at: new Date().toISOString() });
const agora = admin.firestore.FieldValue.serverTimestamp();
const c1 = { organization_id: 'org1', process_number: '00021.000.125/2024', consultant: 'Prefeitura de Canoas', location: 'Canoas', entry_date: '2024-03-04', matter_category: 'Licitações', matter_object: 'Contratação direta de transporte escolar', analysis_start_date: '2024-03-10', review_submission_date: '2024-05-20', reviewed_date: '2024-06-01', archived_date: '2024-06-10', network_folder: 'X:/CAO/2024/125', status: 'Na pasta', responsible_user_name: 'Beatriz Lima', activity_log: [{ action: 'Processo criado manualmente' }], created_at: agora, updated_at: agora };
await db.doc('processes/c1').set(c1);
await db.doc('processes/c2').set({ organization_id: 'org1', process_number: '00021.000.300/2024', consultant: 'Câmara de Esteio', location: 'Esteio', entry_date: '2024-08-01', matter_object: 'Diárias de vereadores', analysis_start_date: '2024-08-02', status: 'Em elaboração', responsible_user_name: 'Carlos Souza', created_at: agora, updated_at: agora });
await db.doc('expedientes/e1').set({ organization_id: 'org1', expediente_number: '01234.000.001/2025', system: 'SIM', origin: 'SUBADM', entry_date: '2025-01-15', object: 'Pedido de informações', analysis_start_date: '2025-01-20', status: 'Em elaboração', created_at: agora, updated_at: agora });
const antes = await ler('processes', 'c1');

const aditivo = (modulo, origemId, extra = {}) => call('criarAditivo', { organizationId: 'org1', modulo, origemId, motivo: 'Novo pedido de complementação', entryDate: '2026-11-17', ...extra });

// 1) Aditivo do original arquivado.
const a1 = await aditivo('consultas', 'c1', { responsibleUserId: uid });
assert.equal(a1.aditivo_numero, 1);
const d1 = await ler('processes', a1.id);
assert.equal(d1.process_number, c1.process_number);
assert.equal(d1.consultant, c1.consultant);
assert.equal(d1.matter_object, c1.matter_object);
assert.equal(d1.status, 'Pendente');
assert.equal(d1.archived_date, null);
assert.equal(d1.network_folder, '');
assert.equal(d1.aditivo_de, 'c1');
assert.equal(d1.responsible_user_name, 'Ana Admin');
assert.equal(d1.distribution_date, '2026-11-17');
const depois = await ler('processes', 'c1');
for (const k of ['archived_date', 'status', 'reviewed_date', 'responsible_user_name', 'network_folder', 'entry_date']) assert.equal(depois[k], antes[k], k);
assert.equal(depois.updated_at.toMillis(), antes.updated_at.toMillis());
assert.equal(depois.aditivos_count, 1);
assert.equal(depois.activity_log.length, 2);
assert.match(depois.activity_log[1].action, /Aditivo nº 1 criado/);
console.log('ok 1: aditivo em Pendente; original arquivado intacto, com o vínculo no histórico');

// 2) Aditivo de aditivo vira aditivo 2 do original.
const a2 = await aditivo('consultas', a1.id);
assert.equal(a2.aditivo_numero, 2);
assert.equal(a2.aditivo_de, 'c1');
assert.equal((await ler('processes', 'c1')).aditivos_count, 2);
const conf = await call('verificarNumeroPgea', { organizationId: 'org1', modulo: 'consultas', numero: '21.000.125/2024' });
assert.deepEqual(conf.registros.map((r) => r.aditivo_numero), [null, 1, 2]);
console.log('ok 2: aditivo de aditivo numerado no original; conferência lista original e aditivos');

// 3) Número: o do aditivo não muda sozinho; o do original leva os aditivos junto.
await call('updateProcess', { id: a1.id, organizationId: 'org1', changes: { process_number: '999/2024', aditivo_de: 'c2', aditivos_count: 50, observations: 'ok' } });
let x = await ler('processes', a1.id);
assert.equal(x.process_number, c1.process_number);
assert.equal(x.aditivo_de, 'c1');
assert.equal(x.observations, 'ok');
await call('updateProcess', { id: 'c1', organizationId: 'org1', changes: { process_number: '00021.000.125/2024-A' } });
assert.equal((await ler('processes', a1.id)).process_number, '00021.000.125/2024-A');
assert.equal((await ler('processes', a2.id)).process_number, '00021.000.125/2024-A');
assert.equal((await ler('processes', 'c1')).aditivos_count, 2);
console.log('ok 3: número do aditivo protegido; número do original propagado');

// 4) Andamento do aditivo não mexe no original.
await call('updateProcess', { id: a1.id, organizationId: 'org1', changes: { analysis_start_date: '2026-11-18' } });
assert.equal((await ler('processes', a1.id)).status, 'Em elaboração');
assert.equal((await ler('processes', 'c1')).status, 'Na pasta');
console.log('ok 4: tramitação paralela');

// 5) Exclusão: original com aditivos recusado; aditivo excluído desconta.
await falha(call('deleteProcess', { id: 'c1', organizationId: 'org1' }), /tem aditivos/);
await call('deleteProcess', { id: a2.id, organizationId: 'org1' });
assert.equal((await ler('processes', 'c1')).aditivos_count, 1);
console.log('ok 5: original com aditivos protegido; exclusão do aditivo atualiza o original');

// 6) Expediente em andamento: os dois seguem paralelos.
const e = await aditivo('expedientes', 'e1');
const de = await ler('expedientes', e.id);
assert.equal(de.expediente_number, '01234.000.001/2025');
assert.equal(de.system, 'SIM');
assert.equal(de.status, 'Pendente');
assert.equal((await ler('expedientes', 'e1')).status, 'Em elaboração');
console.log('ok 6: aditivo de expediente');

// 7) Recusas.
await falha(aditivo('consultas', 'c2', { motivo: '  ' }), /motivo/);
await falha(aditivo('consultas', 'c2', { responsibleUserId: 'ninguem' }), /responsável/);
await falha(aditivo('consultas', 'e1'), /não encontrad/);
await falha(aditivo('parcerias', 'c2'), /incompleto/);
await signInWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
await falha(aditivo('consultas', 'c2'), /não faz parte/);
console.log('ok 7: motivo vazio, responsável de fora, módulo errado e pessoa de fora recusados');
process.exit(0);
