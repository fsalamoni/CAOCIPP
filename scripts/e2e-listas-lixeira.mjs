// E2E de "Listas do órgão por arquivo" e "Excluir de vez" na lixeira, nos emuladores:
//   npx firebase emulators:exec --only auth,firestore,functions,storage --project demo-sigo "node scripts/e2e-listas-lixeira.mjs"
// Confere: leitura de CSV e JSON sem gravar; salvar com o nome do arquivo na auditoria; exclusão
// de vez de tipo, modelo e processo (só da lixeira, com as travas) e o registro no histórico.
import { createRequire } from 'module';
import assert from 'node:assert/strict';
const req = createRequire(new URL('../functions-v2/package.json', import.meta.url));
const raiz = createRequire(new URL('../package.json', import.meta.url));
const admin = req('firebase-admin');
const { initializeApp } = raiz('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = raiz('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = raiz('firebase/functions');

const PROJ = 'demo-sigo';
admin.initializeApp({ projectId: PROJ, storageBucket: `${PROJ}.appspot.com` });
const db = admin.firestore();
const app = initializeApp({ apiKey: 'demo', projectId: PROJ, appId: 'x' });
const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const fns = getFunctions(app, 'southamerica-east1'); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
const cfg = (action, extra) => httpsCallable(fns, 'secretariaConfig')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const proc = (action, extra) => httpsCallable(fns, 'secretariaProcesso')({ organizationId: 'org1', action, ...extra }).then((r) => r.data);
const falha = async (p, re) => { await assert.rejects(p, (e) => { assert.match(e.message, re); return true; }); };
const b64 = (t) => Buffer.from(t).toString('base64');

const { user } = await createUserWithEmailAndPassword(auth, 'admin@teste.dev', 'segredo123');
const uid = user.uid;
await db.doc('organizations/org1').set({ name: 'Órgão de Teste', created_by: uid, secretariaConfig: { enabled: true } });
await db.doc(`userOrganizations/${uid}_org1`).set({ id: `${uid}_org1`, user_id: uid, organization_id: 'org1', role: 'creator', active: true, user_name: 'Admin', joined_at: new Date().toISOString() });
await db.doc('secUnidades/u1').set({ organization_id: 'org1', nome: 'Secretaria', sigla: 'SEC', tipo: 'secretaria', ativa: true, lotacoes: [{ uid, gestor: true }], membros_uids: [uid] });
await db.doc('secRitos/r1').set({ organization_id: 'org1', nome: 'Rito simples', ativo: true, versao: 1, fases: [{ id: 'f1', nome: 'Entrada', acoes: [] }] });
await db.doc('secTipos/t1').set({ organization_id: 'org1', nome: 'Requerimento', sigla: 'REQ', rito_id: 'r1', ativo: true, versao: 1 });
await db.doc('secTipos/t2').set({ organization_id: 'org1', nome: 'Representação', sigla: 'REP', rito_id: 'r1', ativo: true, versao: 1 });
await db.doc('secTipos/t2/versoes/000001').set({ versao: 1, nome: 'Representação' });
await db.doc('secModelos/m1').set({ organization_id: 'org1', nome: 'Despacho velho', excluido: true, ativo: false, formato: 'editor' });

// 1) Ler CSV e JSON: devolve a proposta e não grava nada.
const csv = await cfg('lerListas', { arquivo: { base64: b64('Comunicação;Origem\nEdital;Ouvidoria\nConvocação;\n'), mime: 'text/csv', nome: 'listas.csv' } });
assert.deepEqual(csv.itens.map((i) => [i.lista, i.nome]), [['comunicacao', 'Edital'], ['comunicacao', 'Convocação'], ['origem', 'Ouvidoria']]);
const json = await cfg('lerListas', { arquivo: { base64: b64('{"audiencia":[{"nome":"Sessão de mediação"}]}'), mime: 'application/json', nome: 'l.json' } });
assert.deepEqual(json.itens, [{ lista: 'audiencia', nome: 'Sessão de mediação' }]);
await falha(cfg('lerListas', { arquivo: { base64: b64('x'), mime: 'image/png', nome: 'a.png' } }), /Formato de arquivo não aceito/);
assert.equal((await db.doc('secConfig/org1').get()).data()?.listas, undefined, 'ler não grava');
console.log('ok 1: CSV e JSON lidos, formato estranho recusado, nada gravado');

// 2) Inserir = salvarListas com o nome do arquivo na auditoria.
await cfg('salvarListas', { listas: { comunicacao: [{ nome: 'Edital', m: true }, { nome: 'Convocação' }], origem: [{ nome: 'Ouvidoria' }] }, arquivo_nome: 'listas.csv', itens_importados: 3 });
const listas = (await cfg('estado')).listas;
assert.deepEqual(listas.comunicacao.map((x) => x.id), ['o_edital', 'o_convocacao']);
const aud = (await db.collection('auditLogs').where('action', '==', 'SECRETARIA_LISTAS').get()).docs[0].data();
assert.equal(aud.details.importado_de, 'listas.csv');
assert.equal(aud.details.itens_importados, 3);
console.log('ok 2: listas salvas com o arquivo de origem no histórico');

// 3) Tipo: fora da lixeira não; com processo não; sem processo, some com as versões.
const a = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Processo de teste', partes: [] });
await falha(cfg('excluirDefinitivo', { colecao: 'tipo', id: 't2' }), /já está na lixeira/);
await cfg('excluirTipo', { id: 't1' });
await cfg('excluirTipo', { id: 't2' });
await falha(cfg('excluirDefinitivo', { colecao: 'tipo', id: 't1' }), /Há processos deste tipo/);
await cfg('excluirDefinitivo', { colecao: 'tipo', id: 't2' });
assert.equal((await db.doc('secTipos/t2').get()).exists, false);
assert.equal((await db.collection('secTipos/t2/versoes').get()).size, 0);
await cfg('excluirDefinitivo', { colecao: 'modelo', id: 'm1' });
assert.equal((await db.doc('secModelos/m1').get()).exists, false);
console.log('ok 3: tipo e modelo da lixeira apagados; tipo com processo e item fora da lixeira recusados');

// 4) Processo: com número digitado; pauta de sessão trava; apaga códigos e anotações.
const pa = db.doc(`secProcessos/${a.id}`);
const numA = (await pa.get()).data().numero;
await pa.collection('documentos').doc('d1').set({ titulo: 'Despacho', status: 'juntado', codigo_verificacao: 'ABC123' });
await db.doc('secVerificacao/ABC123').set({ organization_id: 'org1', processo_id: a.id });
await db.doc(`secAnotacoes/${uid}_${a.id}`).set({ organization_id: 'org1', uid, processo_id: a.id, texto: 'nota' });
await falha(proc('excluirDefinitivo', { id: a.id, confirmacao: numA }), /já está na lixeira/);
await proc('excluir', { id: a.id, motivo: 'Autuado por engano', version: (await pa.get()).data().version });
await falha(proc('excluirDefinitivo', { id: a.id, confirmacao: 'errado' }), /Digite o número/);
const b = await proc('autuar', { tipo_id: 't1', rito_id: 'r1', unidade_id: 'u1', assunto: 'Pautado', partes: [] }).catch(() => null);
// O tipo t1 está na lixeira: o segundo processo é semeado direto, já excluído e numa pauta.
await db.doc('secProcessos/pb').set({ organization_id: 'org1', numero: 'PB-1', status: 'excluido', assunto: 'Pautado', excluido: { motivo: 'x' } });
await db.doc('secSessoes/s1').set({ organization_id: 'org1', titulo: '1ª Sessão', pauta: [{ processo_id: 'pb', numero: 'PB-1' }] });
await falha(proc('excluirDefinitivo', { id: 'pb', confirmacao: 'PB-1' }), /pauta da sessão "1ª Sessão"/);
assert.equal(b, null, 'tipo na lixeira não autua');
await proc('excluirDefinitivo', { id: a.id, confirmacao: numA.toLowerCase() });
assert.equal((await pa.get()).exists, false);
assert.equal((await pa.collection('movimentos').get()).size, 0);
assert.equal((await pa.collection('documentos').get()).size, 0);
assert.equal((await db.doc('secVerificacao/ABC123').get()).exists, false);
assert.equal((await db.doc(`secAnotacoes/${uid}_${a.id}`).get()).exists, false);
console.log('ok 4: processo apagado com subcoleções, códigos e anotações; pautado e número errado recusados');

// 5) Histórico: as exclusões de vez no assunto "lixeira".
const h = (await cfg('historico', { assunto: 'lixeira' })).itens.map((e) => e.action).sort();
assert.deepEqual(h, ['SECRETARIA_MODELO_EXCLUIDO_DEFINITIVO', 'SECRETARIA_PROCESSO_EXCLUIDO_DEFINITIVO', 'SECRETARIA_TIPO_EXCLUIDO_DEFINITIVO']);
const hp = (await cfg('historico', { assunto: 'lixeira' })).itens.find((e) => e.action === 'SECRETARIA_PROCESSO_EXCLUIDO_DEFINITIVO');
assert.equal(hp.details.numero, numA);
assert.equal(hp.details.motivo_exclusao, 'Autuado por engano');
console.log('ok 5: histórico com assunto Lixeira');
process.exit(0);
