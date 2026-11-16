// E2E dos arquivos do Processo Eletrônico nos emuladores (auth, firestore, functions, storage):
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-arquivos.mjs"
// Confere: minuta com imagem pesada e com lista dentro de tabela salva (antes o banco recusava),
// nova redação guarda a anterior, envio direto de 20 MB vira documento com original intacto,
// regras do Storage barram envio na pasta de outra conta e de tipo não aceito.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const sharp = req('sharp');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');
const { getStorage, connectStorageEmulator, ref, uploadBytes } = raiz('firebase/storage');

const PROJ = 'demo-sigo';
const BUCKET = `${PROJ}.appspot.com`;
admin.initializeApp({ projectId: PROJ, storageBucket: BUCKET });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, storageBucket: BUCKET, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const st = getStorage(app); connectStorageEmulator(st, '127.0.0.1', 9199);
const call = (acao, extra) => httpsCallable(fns, 'secretariaDocumento', { timeout: 300000 })({ organizationId: 'org1', processoId: 'p1', action: acao, ...extra }).then((r) => r.data);

const { user } = await createUserWithEmailAndPassword(auth, 'equipe@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ user_id: uid, organization_id: 'org1', role: 'member', active: true, user_name: 'Equipe', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Secretaria', ativa: true, lotacoes: [{ uid }], membros_uids: [uid] });
await db.doc('secProcessos/p1').set({ organization_id: 'org1', numero: '1/2026', assunto: 'Teste', unidade_atual: 'u1', unidades_historico: ['u1'], status: 'em_tramitacao', partes: [], partes_uids: [], fases: [], version: 1, doc_seq: 0 });

// 1) Minuta com imagem de ~1,2 MB (o banco recusava acima de 1 MiB).
const foto = await sharp({ create: { width: 1000, height: 1000, channels: 3, noise: { type: 'gaussian', mean: 120, sigma: 60 } } }).jpeg({ quality: 100 }).toBuffer();
assert.ok(foto.length > 900_000 && foto.length < 1_450_000, `foto de ${foto.length}`);
const img = { type: 'image', attrs: { src: `data:image/jpeg;base64,${foto.toString('base64')}` } };
const r1 = await call('criarMinuta', { titulo: 'Com imagem', tipo: 'Despacho', conteudo: { type: 'doc', content: [img, { type: 'paragraph', content: [{ type: 'text', text: 'oi' }] }] } });
const d1 = (await db.doc(`secProcessos/p1/documentos/${r1.id}`).get()).data();
assert.ok(d1.conteudo_path && !d1.conteudo_json, 'texto grande vai ao Storage');
const b1 = await call('baixar', { docId: r1.id });
assert.equal(b1.conteudo.content[0].attrs.src.length, img.attrs.src.length);
console.log('ok 1: minuta com imagem pesada salva e volta igual');

// 2) Lista dentro de tabela (passava de 20 níveis no banco).
const p = { type: 'paragraph', content: [{ type: 'text', text: 'item', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] }] };
const ul = (c) => ({ type: 'bulletList', content: [{ type: 'listItem', content: c }] });
const tabela = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [ul([p, ul([p])])] }] }] }] };
const r2 = await call('criarMinuta', { titulo: 'Tabela', tipo: 'Despacho', conteudo: tabela });
const d2 = (await db.doc(`secProcessos/p1/documentos/${r2.id}`).get()).data();
assert.equal(typeof d2.conteudo_json, 'string');
// Outra pessoa revisa: a redação anterior fica guardada.
await db.doc(`secProcessos/p1/documentos/${r2.id}`).update({ editado_por: 'outra', autor_uid: 'outra' });
await call('editarMinuta', { docId: r2.id, conteudo: { type: 'doc', content: [img] } });
const vers = await db.collection(`secProcessos/p1/documentos/${r2.id}/versoes`).get();
assert.equal(vers.size, 1);
assert.equal(typeof vers.docs[0].data().conteudo_json, 'string');
const pdfV = await call('pdf', { docId: r2.id, versaoId: vers.docs[0].id });
assert.ok(pdfV.base64.length > 1000);
const atual = (await db.doc(`secProcessos/p1/documentos/${r2.id}`).get()).data();
assert.ok(atual.conteudo_path && !atual.conteudo_json, 'nova redação grande no Storage, sem o JSON antigo');
console.log('ok 2: lista dentro de tabela salva; revisão guarda a redação anterior');

// 3) Envio direto de ~20 MB (antes: 5 MB) — PNG grande vira versão de leitura leve; original intacto.
const grande = await sharp({ create: { width: 3600, height: 2400, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).png({ compressionLevel: 0 }).toBuffer();
assert.ok(grande.length > 20 * 1024 * 1024, `png de ${grande.length}`);
const envio = `secretaria-envios/${uid}/${'a'.repeat(32)}`;
await uploadBytes(ref(st, envio), grande, { contentType: 'image/png' });
const r3 = await call('upload', { titulo: 'Foto da vistoria', envio, mime: 'image/png', nomeArquivo: 'vistoria.png' });
const d3 = (await db.doc(`secProcessos/p1/documentos/${r3.id}`).get()).data();
assert.equal(d3.tamanho, grande.length);
assert.equal(d3.sha256, createHash('sha256').update(grande).digest('hex'));
assert.ok(d3.leitura_path && d3.leitura_tamanho < grande.length / 4, `leitura de ${d3.leitura_tamanho}`);
const [espera] = await admin.storage().bucket().file(envio).exists();
assert.equal(espera, false, 'a cópia de espera foi apagada');
const orig = await call('baixar', { docId: r3.id });
assert.ok(orig.url && !orig.base64, 'original de 20 MB sai por link');
const baixado = Buffer.from(await (await fetch(orig.url)).arrayBuffer());
assert.equal(createHash('sha256').update(baixado).digest('hex'), d3.sha256, 'o original baixado confere com o hash');
console.log(`ok 3: envio de ${(grande.length / 1048576).toFixed(1)} MB; leitura de ${(d3.leitura_tamanho / 1048576).toFixed(2)} MB; original confere`);

// 4) Texto puro compactado sem perda no Storage; volta byte a byte.
const txt = Buffer.from('Termo de declaração. '.repeat(20000));
const envioTxt = `secretaria-envios/${uid}/${'b'.repeat(32)}`;
await uploadBytes(ref(st, envioTxt), txt, { contentType: 'text/plain' });
const r4 = await call('upload', { titulo: 'Termo', envio: envioTxt, mime: 'text/plain', nomeArquivo: 'termo.txt' });
const d4 = (await db.doc(`secProcessos/p1/documentos/${r4.id}`).get()).data();
assert.equal(d4.compactado, 'gzip');
assert.ok(d4.tamanho_armazenado < txt.length / 10);
const b4 = await call('baixar', { docId: r4.id });
assert.ok(Buffer.from(b4.base64, 'base64').equals(txt));
console.log(`ok 4: texto guardado com ${d4.tamanho_armazenado} de ${txt.length} bytes, volta igual`);

// 5) Regras e conferências.
await assert.rejects(uploadBytes(ref(st, `secretaria-envios/outra-conta/${'c'.repeat(32)}`), Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' }), 'pasta de outra conta');
await assert.rejects(uploadBytes(ref(st, `secretaria-envios/${uid}/${'d'.repeat(32)}`), Buffer.from('MZ'), { contentType: 'application/x-msdownload' }), 'tipo não aceito');
await assert.rejects(uploadBytes(ref(st, `secretaria/org1/p1/${r3.id}`), Buffer.from('x'), { contentType: 'image/png' }), 'pasta definitiva');
const falso = `secretaria-envios/${uid}/${'e'.repeat(32)}`;
await uploadBytes(ref(st, falso), Buffer.from('MZ executável'), { contentType: 'application/pdf' });
await assert.rejects(call('upload', { titulo: 'x', envio: falso, mime: 'application/pdf', nomeArquivo: 'x.pdf' }), /não confere/);
await assert.rejects(call('upload', { titulo: 'x', envio: `secretaria-envios/outra-conta/${'f'.repeat(32)}`, mime: 'application/pdf', nomeArquivo: 'x.pdf' }), /inválido/);
console.log('ok 5: regras do Storage e conferência do conteúdo');

// 7) Juntada: o PDF do documento e o dos autos usam a versão de leitura, carimbada.
const foto2 = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#d0e0f0' } }).jpeg({ quality: 100 }).toBuffer();
const envioJ = `secretaria-envios/${uid}/${'g'.repeat(32)}`;
await uploadBytes(ref(st, envioJ), foto2, { contentType: 'image/jpeg' });
const r7 = await call('upload', { titulo: 'Laudo', envio: envioJ, mime: 'image/jpeg', nomeArquivo: 'laudo.jpg' });
await call('juntar', { docId: r7.id, version: 1 });
const pdf7 = await call('pdf', { docId: r7.id });
assert.ok(pdf7.base64, 'PDF do documento juntado');
const autos = (await httpsCallable(fns, 'secretariaExportarPdf', { timeout: 300000 })({ organizationId: 'org1', processoId: 'p1', selecao: { modo: 'integral', capa: true, indice: true } })).data;
assert.ok(autos.base64 && autos.nome.endsWith('.pdf'));
console.log(`ok 7: juntada e PDF dos autos (${(Buffer.from(autos.base64, 'base64').length / 1024).toFixed(0)} KB)`);

// 6) Excluir a minuta apaga original, versão de leitura e textos grandes.
await call('excluirMinuta', { docId: r1.id });
await call('excluirMinuta', { docId: r3.id });
const [resto] = await admin.storage().bucket().getFiles({ prefix: 'secretaria/org1/p1/' });
const sobras = resto.map((f) => f.name).filter((n) => n.includes(r1.id) || n.includes(r3.id));
assert.deepEqual(sobras, []);
console.log('ok 6: exclusão não deixa arquivo para trás');
process.exit(0);
