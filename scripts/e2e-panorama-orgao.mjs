// E2E do Panorama a partir das funcionalidades do órgão, nos emuladores (auth, firestore, functions):
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-sigo "node scripts/e2e-panorama-orgao.mjs"
// Confere: a prévia lê Consultas, Expedientes e Parcerias do órgão (nunca de outro), junta os três com
// as mesmas colunas, usa o registro no SIGO como identificador (o aditivo não vira "repetido"), recusa
// quem não é do órgão e a criação da base nova não cai mais em "INTERNAL".
// Depois rode scripts/e2e-panorama-orgao-tela.mjs (mesmo emulador).
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
const call = (dados) => httpsCallable(fns, 'importPanorama', { timeout: 120000 })({ organizationId: 'org1', ...dados }).then((r) => r.data);

await createUserWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc('platformConfig/featureFlags').set({ flags: { panorama_enabled: true } });
await db.doc(`users/${uid}`).set({ email: 'admin@teste.dev', full_name: 'Admin', accepted_terms: true, terms_accepted_at: new Date().toISOString() });
await db.doc('organizations/org1').set({ name: 'CAOCIPP', created_by: uid, stats: {} });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
const comarcas = ['Caxias do Sul', 'Canoas', 'Esteio', 'Pelotas'];
for (let i = 0; i < 12; i++) {
    await db.doc(`processes/c${i}`).set({ organization_id: 'org1', process_number: `00021.000.${100 + i}/2026`, consultant: `PJ ${comarcas[i % 4]}`, location: comarcas[i % 4], entry_date: `2026-0${1 + (i % 9)}-10`, matter_category: i % 2 ? 'Cível' : 'Patrimônio público', matter_object: 'Objeto '.repeat(400), analysis_start_date: i % 3 ? '2026-02-01' : null, status: 'Pendente', responsible_user_name: i % 2 ? 'Ana' : 'Bruno' });
}
// Aditivo: mesmo número do original. Pela planilha, virava "identificador repetido".
await db.doc('processes/c0a').set({ organization_id: 'org1', process_number: '00021.000.100/2026', aditivo_de: 'c0', consultant: 'PJ Caxias do Sul', entry_date: '2026-06-01', status: 'Pendente' });
await db.doc('expedientes/e1').set({ organization_id: 'org1', expediente_number: '01234.000.001/2026', system: 'SIM', origin: 'SUBADM', entry_date: '2026-01-15', object: 'Pedido de informações', status: 'Pendente' });
await db.doc('parcerias/p1').set({ organization_id: 'org1', pgea: '00500.000.001/2026', subject: 'Cooperação técnica', parties: 'MPRS e TCE', partnership_type: 'Termo de Cooperação', aditivo_count: 1 });
await db.doc('processes/x1').set({ organization_id: 'org2', process_number: '00021.000.999/2026', consultant: 'Outro órgão', status: 'Pendente' });

// 1) Prévia só de Consultas: 13 novos (o aditivo entra), nenhum inválido, identificador = registro.
let r = await call({ modulos: ['consultas'], mode: 'preview' });
assert.equal(r.total, 13);
assert.equal(r.counts.novo, 13);
assert.equal(r.counts.invalido, 0);
assert.equal(r.fileName, 'Consultas');
const id = r.colunas.find((c) => c.role === 'identificador');
assert.equal(id.label, 'Registro no SIGO');
assert.equal(r.colunas.filter((c) => c.role === 'identificador').length, 1);
assert.ok(!r.colunas.some((c) => c.label === 'Funcionalidade'), 'uma funcionalidade só: sem a coluna Funcionalidade');
console.log('ok 1: Consultas do órgão, aditivo incluído, registro no SIGO como identificador');

// 2) Os três juntos: 15 linhas, coluna Funcionalidade, colunas comuns sem repetição.
r = await call({ modulos: ['parcerias', 'consultas', 'expedientes'], mode: 'preview' });
assert.equal(r.total, 15);
assert.equal(r.fileName, 'Consultas + Expedientes + Parcerias');
const rotulos = r.colunas.map((c) => c.label);
for (const c of ['Funcionalidade', 'Número PGEA', 'Situação', 'Entrada', 'Responsável', 'Consulente', 'Sistema', 'Partes']) assert.ok(rotulos.includes(c), c);
assert.equal(new Set(rotulos).size, rotulos.length);
console.log('ok 2: três funcionalidades juntas numa base, com as mesmas colunas');

// 3) Criação da base nova (o que dava "INTERNAL"). No emulador de Functions o FieldValue pode vir
// indefinido; nesse caso a mensagem tem de ser clara, nunca só "INTERNAL".
try {
    r = await call({ modulos: ['consultas'], mode: 'commit', baseNome: 'Consultas CAOCIPP', columns: (await call({ modulos: ['consultas'], mode: 'preview' })).colunas });
    assert.equal(r.ligados, 13);
    const base = (await db.doc(`panoramaBases/${r.baseId}`).get()).data();
    assert.equal(base.vinculada, true);
    assert.deepEqual(base.fonte_modulos, ['consultas']);
    const n = (await db.collection('panoramaRegistros').where('base_id', '==', r.baseId).count().get()).data().count;
    assert.equal(n, 0);
    console.log('ok 3: base ligada às Consultas, sem cópia');
} catch (e) {
    assert.notEqual(e.message, 'INTERNAL');
    assert.match(e.message, /A importação não pôde ser concluída/);
    console.log(`ok 3 (emulador): gravação recusada com mensagem clara: ${e.message.slice(0, 140)}`);
}

// 4) Quem não é do órgão não lê os registros.
await signInWithEmailAndPassword(auth, 'outro@teste.dev', 'segredo123');
await assert.rejects(call({ modulos: ['consultas'], mode: 'preview' }), /não é membro/);
console.log('ok 4: pessoa de fora recusada');
await signInWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
process.exit(0);
