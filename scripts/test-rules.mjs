// Testa firestore.rules no emulador com tokens de usuários reais do emulador de Auth.
// Uso: npm run test:rules  (sobe auth + firestore, roda e derruba)
import assert from 'node:assert/strict';

const PROJ = process.env.GCLOUD_PROJECT || 'demo-sigo';
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1/projects/${PROJ}/databases/(default)/documents`;

async function usuario(email) {
    const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'segredo123', returnSecureToken: true }),
    }).then((x) => x.json());
    return { uid: r.localId, token: r.idToken };
}

const valor = (v) => (typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) });
const campos = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, valor(v)])) });

// "Bearer owner" ignora as regras: é como o Admin SDK das Functions grava.
const semear = (caminho, o) => fetch(`${FS}/${caminho}`, {
    method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify(campos(o)),
}).then((x) => assert.ok(x.ok, `semear ${caminho}`));

const pedir = (u, metodo, caminho, corpo) => fetch(`${FS}/${caminho}`, {
    method: metodo, headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
}).then((x) => x.status);

const criador = await usuario('criador@x.com');
const membro = await usuario('membro@x.com');
const estranho = await usuario('estranho@x.com');
const org = 'org1';
await semear(`userOrganizations/${criador.uid}_${org}`, { user_id: criador.uid, organization_id: org, role: 'creator' });
await semear(`userOrganizations/${membro.uid}_${org}`, { user_id: membro.uid, organization_id: org, role: 'member' });
await semear(`users/${criador.uid}`, { email: 'criador@x.com' });
await semear(`users/${membro.uid}`, { email: 'membro@x.com' });

// Perfis: só o próprio (o e-mail de colegas não vaza, nem para partes do Portal).
assert.equal(await pedir(criador, 'GET', `users/${criador.uid}`), 200, 'lê o próprio perfil');
assert.equal(await pedir(criador, 'GET', `users/${membro.uid}`), 403, 'não lê perfil de colega');
assert.equal(await pedir(estranho, 'GET', `users/${membro.uid}`), 403, 'não lê perfil de terceiro');

// Registros: leitura por membros; escrita só pelas Functions.
for (const col of ['processes', 'expedientes', 'parcerias']) {
    assert.equal(await pedir(criador, 'POST', col, campos({ organization_id: org })), 403, `criação direta em ${col}`);
}
await semear('processes/p1', { organization_id: org, responsible_user_id: membro.uid, title: 'x' });
assert.equal(await pedir(membro, 'GET', 'processes/p1'), 200, 'membro lê registro do órgão');
assert.equal(await pedir(estranho, 'GET', 'processes/p1'), 403, 'estranho não lê registro');
assert.equal(await pedir(membro, 'PATCH', 'processes/p1?updateMask.fieldPaths=title', campos({ title: 'y' })), 403, 'responsável não edita direto');
assert.equal(await pedir(criador, 'DELETE', 'processes/p1'), 403, 'criador não apaga direto');

// Auditoria: só criador e admins.
await semear('auditLogs/l1', { organization_id: org, action: 'TESTE' });
assert.equal(await pedir(membro, 'GET', 'auditLogs/l1'), 403, 'membro comum não lê auditoria');
assert.equal(await pedir(criador, 'GET', 'auditLogs/l1'), 200, 'criador lê auditoria');

// Secretaria: tudo fechado ao cliente.
await semear('secProcessos/s1', { organization_id: org });
assert.equal(await pedir(criador, 'GET', 'secProcessos/s1'), 403, 'secretaria só por Function');
await semear('secUnidadeConfig/u1', { organization_id: org });
assert.equal(await pedir(criador, 'GET', 'secUnidadeConfig/u1'), 403, 'timbrado de unidade só por Function');
await semear('secConvitesEquipe/c1', { organization_id: org });
assert.equal(await pedir(criador, 'GET', 'secConvitesEquipe/c1'), 403, 'convites de equipe só por Function');

// Config da plataforma: qualquer conta lê as flags; o resto só pelas Functions
// (o Auth é compartilhado com os outros apps do projeto Firebase).
await semear('platformConfig/featureFlags', { x: true });
await semear('platformConfig/emailProvider', { fromEmail: 'a@b.c' });
assert.equal(await pedir(estranho, 'GET', 'platformConfig/featureFlags'), 200, 'flags legíveis');
assert.equal(await pedir(estranho, 'GET', 'platformConfig/emailProvider'), 403, 'config de e-mail fechada');

console.log('REGRAS OK');
