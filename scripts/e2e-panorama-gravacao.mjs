// Gravação da importação do Panorama (o passo que dava "INTERNAL"), direto contra o emulador do
// Firestore. O emulador de Functions entrega `admin.firestore.FieldValue` indefinido, então a função
// roda aqui no próprio processo, com `.run()`:
//   npx firebase emulators:exec --only firestore --project demo-sigo "node scripts/e2e-panorama-gravacao.mjs"
// Confere: base nova criada a partir de uma planilha com coluna sem lista (o caso do erro) e a partir
// das Consultas do órgão, com texto longo; releitura sem duplicar; base guarda a origem.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
process.env.GCLOUD_PROJECT = 'demo-sigo';
const admin = req('firebase-admin');
admin.initializeApp({ projectId: 'demo-sigo' });
const XLSX = req('xlsx');
const { importPanorama } = req('./lib/panorama/importar');
const db = admin.firestore();
const run = (data) => importPanorama.run({ auth: { uid: 'u1', token: { name: 'Admin' } }, data: { organizationId: 'org1', ...data } });

await db.doc('userOrganizations/u1_org1').set({ user_id: 'u1', organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin' });
for (let i = 0; i < 489; i++) {
    await db.doc(`processes/c${i}`).set({ organization_id: 'org1', process_number: `00021.000.${String(i).padStart(3, '0')}/2026`, consultant: `PJ ${i % 40}`, entry_date: '2026-02-10', matter_object: 'Texto longo da consulta. '.repeat(80), observations: 'Obs. '.repeat(300), status: 'Pendente' });
}

// 1) Planilha (como a exportada das Consultas), base nova.
const linhas = Array.from({ length: 300 }, (_, i) => ({ 'Nº da Consulta - PGEA': `00021.000.${i}/2026`, 'Consulente': `PJ ${i}`, 'Objeto da Consulta': 'x'.repeat(1900), 'Entrada': '10/02/2026' }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Dados');
const fileData = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
const prev = await run({ fileData, fileName: 'consultas.xlsx', mode: 'preview' });
let r = await run({ fileData, fileName: 'consultas.xlsx', mode: 'commit', columns: prev.colunas, baseNome: 'Planilha' });
assert.equal(r.criados, 300);
console.log('ok 1: base nova pela planilha gravada (antes: INTERNAL)');

// 2) Consultas do órgão, base nova, texto longo em lotes.
const p2 = await run({ modulos: ['consultas'], mode: 'preview' });
r = await run({ modulos: ['consultas'], mode: 'commit', columns: p2.colunas, baseNome: 'Consultas do órgão' });
assert.equal(r.criados, 489);
const base = (await db.doc(`panoramaBases/${r.baseId}`).get()).data();
assert.deepEqual(base.fonte_modulos, ['consultas']);
assert.equal(base.columns.find((c) => c.role === 'identificador').label, 'Registro no SIGO');
console.log('ok 2: 489 consultas do órgão numa base nova, com a origem guardada');

// 3) Releitura depois de uma mudança no órgão: só a mudança, nada duplicado.
await db.doc('processes/c5').update({ analysis_start_date: '2026-03-01', responsible_user_name: 'Ana' });
const p3 = await run({ baseId: r.baseId, modulos: ['consultas'], mode: 'preview', policy: 'update' });
assert.equal(p3.counts.novo, 0);
assert.equal(p3.counts.conflito + p3.counts.atualizacao, 1);
const r3 = await run({ baseId: r.baseId, modulos: ['consultas'], mode: 'commit', policy: 'update', columns: p3.colunas });
assert.equal(r3.criados, 0);
assert.equal((await db.collection('panoramaRegistros').where('base_id', '==', r.baseId).count().get()).data().count, 489);
console.log('ok 3: releitura trouxe só a consulta que mudou, sem duplicar');
process.exit(0);
