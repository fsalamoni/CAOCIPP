// E2E da revisão de minutas no editor, nos emuladores (auth, firestore, functions, storage):
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-editor.mjs"
// Confere: minuta enviada em Word abre no editor convertida; ao salvar passa a ser do editor e o
// arquivo original fica intacto em Versões; minuta assinada só é revista com confirmação, e as
// assinaturas são retiradas e pedidas de novo; o texto sai em .docx; arquivo do computador
// (LibreOffice) entra no editor sem gravar nada; a juntada da minuta convertida gera o PDF.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const JSZip = req('jszip');
const { docParaDocx } = req('./lib/secretaria/docxExportar');
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
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const textoDe = (n) => (n.type === 'text' ? n.text : (n.content || []).map(textoDe).join(' '));

const { user } = await createUserWithEmailAndPassword(auth, 'gabinete@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ user_id: uid, organization_id: 'org1', role: 'member', active: true, user_name: 'Gabinete', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Gabinete', ativa: true, lotacoes: [{ uid }, { uid: 'assessor' }], membros_uids: [uid, 'assessor'] });
await db.doc('secProcessos/p1').set({ organization_id: 'org1', numero: '1/2026', assunto: 'Teste', unidade_atual: 'u1', unidades_historico: ['u1'], status: 'em_tramitacao', partes: [], partes_uids: [], fases: [], version: 1, doc_seq: 0 });

// Word "da assessoria": título, parágrafo justificado com recuo, tabela e lista.
const p = (t, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text: t }] });
const word = await docParaDocx({
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parecer da assessoria' }] },
        p('Trata-se de expediente que analisa a regularidade do procedimento.', { textAlign: 'justify', recuo: 1.25, espacamento: 1.5 }),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('Primeiro ponto')] }] },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [p('Célula')] }] }] },
    ],
}, {}, {});
const envio = `secretaria-envios/${uid}/${'1'.repeat(32)}`;
await uploadBytes(ref(st, envio), word, { contentType: MIME_DOCX });
const { id } = await call('upload', { titulo: 'Parecer', tipo: 'Parecer', envio, mime: MIME_DOCX, nomeArquivo: 'parecer.docx' });
const hashWord = createHash('sha256').update(word).digest('hex');

// 1) Abrir no editor: conteúdo convertido, nada muda no documento ainda.
const aberto = await call('paraEditor', { docId: id });
assert.equal(aberto.nomeArquivo, 'parecer.docx');
const par = aberto.conteudo.content.find((n) => n.type === 'paragraph' && textoDe(n).startsWith('Trata-se'));
assert.equal(par.attrs.textAlign, 'justify');
assert.equal(par.attrs.recuo, 1.25);
assert.equal(par.attrs.espacamento, 1.5);
assert.ok(aberto.conteudo.content.some((n) => n.type === 'table') && aberto.conteudo.content.some((n) => n.type === 'bulletList'));
assert.equal((await db.doc(`secProcessos/p1/documentos/${id}`).get()).data().origem, 'upload');
console.log('ok 1: minuta em Word abre no editor com a formatação, sem mudar nada');

// 2) Salvar a revisão: vira minuta do editor, o Word fica intacto como versão.
const revisto = { ...aberto.conteudo, content: [...aberto.conteudo.content, p('Acrescentado pelo gabinete.')] };
await call('editarMinuta', { docId: id, titulo: 'Parecer revisto', tipo: 'Parecer', conteudo: revisto });
const d = (await db.doc(`secProcessos/p1/documentos/${id}`).get()).data();
assert.equal(d.origem, 'editor');
assert.equal(d.convertido_de, 'parecer.docx');
assert.equal(d.fontes, 2);
assert.ok(!d.storage_path && !d.mime && !d.sha256 && !d.nome_arquivo, 'campos do arquivo saem do documento');
const vers = await db.collection(`secProcessos/p1/documentos/${id}/versoes`).get();
assert.equal(vers.size, 1);
const v = { id: vers.docs[0].id, ...vers.docs[0].data() };
assert.equal(v.origem, 'upload');
assert.equal(v.nome_arquivo, 'parecer.docx');
const original = await call('baixar', { docId: id, versaoId: v.id });
assert.equal(original.origem, 'upload');
const bytes = original.base64 ? Buffer.from(original.base64, 'base64') : Buffer.from(await (await fetch(original.url)).arrayBuffer());
assert.equal(createHash('sha256').update(bytes).digest('hex'), hashWord, 'o Word original volta byte a byte');
const pdfOriginal = await call('pdf', { docId: id, versaoId: v.id });
assert.ok(pdfOriginal.base64 || pdfOriginal.url, 'PDF da versão em Word');
const lista = await call('versoes', { docId: id });
assert.equal(lista.versoes[0].origem, 'upload');
console.log('ok 2: ao salvar, a minuta passa ao editor e o Word original fica em Versões, intacto');

// 3) Minuta assinada: revisão só com confirmação; assinaturas retiradas e pedidas de novo.
await db.doc(`secProcessos/p1/documentos/${id}`).update({ assinaturas: [{ uid: 'assessor', nome: 'Assessor', em: new Date().toISOString() }] });
await assert.rejects(call('editarMinuta', { docId: id, conteudo: revisto }), /assinad/i);
const r3 = await call('editarMinuta', { docId: id, conteudo: { ...revisto, content: [...revisto.content, p('Ajuste final.')] }, revisarAssinada: true });
assert.equal(r3.assinaturasRetiradas, 1);
const d3 = (await db.doc(`secProcessos/p1/documentos/${id}`).get()).data();
assert.deepEqual(d3.assinaturas, []);
assert.ok((d3.assinaturas_pedidas || []).some((x) => x.uid === 'assessor'), 'pede de novo a quem tinha assinado');
const proc3 = (await db.doc('secProcessos/p1').get()).data();
assert.ok((proc3.assinaturas_pendentes || []).some((x) => x.uid === 'assessor' && x.docId === id));
const vers3 = (await db.collection(`secProcessos/p1/documentos/${id}/versoes`).get()).docs.map((x) => x.data());
assert.ok(vers3.some((x) => (x.assinaturas || []).some((a) => a.uid === 'assessor')), 'a redação assinada fica em Versões');
console.log('ok 3: revisão da minuta assinada retira as assinaturas, pede de novo e guarda a redação assinada');

// 4) Word (.docx) do texto do editor.
const docx = await call('docx', { docId: id });
const zipBuf = docx.base64 ? Buffer.from(docx.base64, 'base64') : Buffer.from(await (await fetch(docx.url)).arrayBuffer());
const xmlDoc = await (await JSZip.loadAsync(zipBuf)).file('word/document.xml').async('string');
assert.match(xmlDoc, /Ajuste final\./);
assert.match(xmlDoc, /w:jc w:val="both"/);
console.log('ok 4: a minuta sai em .docx com a formatação');

// 5) Arquivo do computador (LibreOffice) entra no editor sem gravar nada.
const zip = new JSZip();
zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
zip.file('content.xml', '<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>Do LibreOffice</text:p></office:text></office:body></office:document-content>');
const odt = await zip.generateAsync({ type: 'nodebuffer' });
const envioOdt = `secretaria-envios/${uid}/${'2'.repeat(32)}`;
await uploadBytes(ref(st, envioOdt), odt, { contentType: 'application/vnd.oasis.opendocument.text' });
const antes = (await db.collection('secProcessos/p1/documentos').get()).size;
const conv = await call('converter', { envio: envioOdt, mime: 'application/vnd.oasis.opendocument.text', nomeArquivo: 'nota.odt' });
assert.equal(textoDe(conv.conteudo).trim(), 'Do LibreOffice');
assert.equal((await db.collection('secProcessos/p1/documentos').get()).size, antes, 'nada gravado no processo');
console.log('ok 5: arquivo do LibreOffice entra no editor sem gravar nada');

// 6) A minuta convertida vai aos autos com o PDF das fontes novas.
await db.doc(`secProcessos/p1/documentos/${id}`).update({ assinaturas_pedidas: [] });
await db.doc('secProcessos/p1').update({ assinaturas_pendentes: [] });
await call('juntar', { docId: id, version: (await db.doc('secProcessos/p1').get()).data().version });
const j = (await db.doc(`secProcessos/p1/documentos/${id}`).get()).data();
assert.equal(j.status, 'juntado');
assert.equal(j.fontes, 2);
const pdf = await call('pdf', { docId: id });
assert.ok(pdf.base64 || pdf.url);
console.log('ok 6: juntada da minuta revista, PDF com as fontes do Office');
process.exit(0);
