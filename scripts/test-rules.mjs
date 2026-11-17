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

// Sinal de mudança do órgão: o membro ativo lê o do seu órgão; ninguém mais, e ninguém escreve.
await semear(`secSinais/${org}`, { organization_id: org, processo_id: 's1' });
await semear(`secSinais/org2`, { organization_id: 'org2' });
assert.equal(await pedir(membro, 'GET', `secSinais/${org}`), 200, 'membro lê o sinal do órgão');
assert.equal(await pedir(estranho, 'GET', `secSinais/${org}`), 403, 'estranho não lê o sinal');
assert.equal(await pedir(membro, 'GET', 'secSinais/org2'), 403, 'membro não lê o sinal de outro órgão');
assert.equal(await pedir(membro, 'GET', 'secSinais'), 403, 'ninguém lista os sinais');
assert.equal(await pedir(criador, 'PATCH', `secSinais/${org}`, campos({ processo_id: 'x' })), 403, 'ninguém grava o sinal');
const inativo = await usuario('inativo@x.com');
await fetch(`${FS}/userOrganizations/${inativo.uid}_${org}`, {
    method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { organization_id: { stringValue: org }, active: { booleanValue: false } } }),
});
assert.equal(await pedir(inativo, 'GET', `secSinais/${org}`), 403, 'membro inativo não lê o sinal');

// Membro removido (vínculo com active == false) perde a leitura de tudo do órgão.
await semear('processes/p2', { organization_id: org, title: 'x' });
await semear('expedientes/e2', { organization_id: org });
await semear(`organizations/${org}`, { name: 'Órgão' });
assert.equal(await pedir(membro, 'GET', `organizations/${org}`), 200, 'membro ativo lê o órgão');
assert.equal(await pedir(inativo, 'GET', 'processes/p2'), 403, 'membro removido não lê registro');
assert.equal(await pedir(inativo, 'GET', 'expedientes/e2'), 403, 'membro removido não lê expediente');
assert.equal(await pedir(inativo, 'GET', `organizations/${org}`), 403, 'membro removido não lê o órgão');
assert.equal(await pedir(inativo, 'GET', `userOrganizations/${membro.uid}_${org}`), 403, 'membro removido não lê vínculos de colegas');
assert.equal(await pedir(membro, 'GET', 'processes/p2'), 200, 'membro ativo segue lendo');
// Listas (como as telas consultam): filtro por órgão.
const listar = (u) => fetch(`${FS}:runQuery`, {
    method: 'POST', headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'processes' }], where: { fieldFilter: { field: { fieldPath: 'organization_id' }, op: 'EQUAL', value: { stringValue: org } } } } }),
}).then((x) => x.status);
assert.equal(await listar(membro), 200, 'membro ativo lista os registros do órgão');
assert.equal(await listar(inativo), 403, 'membro removido não lista os registros do órgão');
const criadorRemovido = await usuario('ex-admin@x.com');
await semear(`userOrganizations/${criadorRemovido.uid}_${org}`, { user_id: criadorRemovido.uid, organization_id: org, role: 'admin', active: false });
assert.equal(await pedir(criadorRemovido, 'GET', 'auditLogs/l1'), 403, 'admin removido não lê auditoria');

// Órgão suspenso pela plataforma: o vínculo leva org_suspended e nada do órgão abre,
// nem para o criador; o próprio vínculo continua legível (a tela mostra o motivo).
const suspenso = await usuario('suspenso@x.com');
await semear(`userOrganizations/${suspenso.uid}_${org}`, { user_id: suspenso.uid, organization_id: org, role: 'creator', active: true, org_suspended: true });
assert.equal(await pedir(suspenso, 'GET', `organizations/${org}`), 403, 'órgão suspenso: não lê o órgão');
assert.equal(await pedir(suspenso, 'GET', 'processes/p2'), 403, 'órgão suspenso: não lê registro');
assert.equal(await listar(suspenso), 403, 'órgão suspenso: não lista registros');
assert.equal(await pedir(suspenso, 'GET', `userOrganizations/${suspenso.uid}_${org}`), 200, 'órgão suspenso: lê o próprio vínculo');

// Pessoa bloqueada pela plataforma: user_blocked no vínculo fecha o órgão; o
// bloqueio (platformBlocks) só a própria pessoa lê, e ninguém escreve pelo cliente.
const bloqueada = await usuario('bloqueada@x.com');
await semear(`userOrganizations/${bloqueada.uid}_${org}`, { user_id: bloqueada.uid, organization_id: org, role: 'admin', active: true, user_blocked: true });
await semear(`platformBlocks/${bloqueada.uid}`, { ativa: true, motivo: 'teste' });
assert.equal(await pedir(bloqueada, 'GET', `organizations/${org}`), 403, 'pessoa bloqueada: não lê o órgão');
assert.equal(await pedir(bloqueada, 'GET', 'processes/p2'), 403, 'pessoa bloqueada: não lê registro');
assert.equal(await pedir(bloqueada, 'GET', `userOrganizations/${bloqueada.uid}_${org}`), 200, 'pessoa bloqueada: lê o próprio vínculo');
assert.equal(await pedir(bloqueada, 'GET', `platformBlocks/${bloqueada.uid}`), 200, 'lê o próprio bloqueio');
assert.equal(await pedir(estranho, 'GET', `platformBlocks/${bloqueada.uid}`), 403, 'não lê bloqueio alheio');
assert.equal(await pedir(bloqueada, 'DELETE', `platformBlocks/${bloqueada.uid}`), 403, 'não apaga o próprio bloqueio');

// Config da plataforma: qualquer conta lê as flags; o resto só pelas Functions
// (o Auth é compartilhado com os outros apps do projeto Firebase).
await semear('platformConfig/featureFlags', { x: true });
await semear('platformConfig/emailProvider', { fromEmail: 'a@b.c' });
assert.equal(await pedir(estranho, 'GET', 'platformConfig/featureFlags'), 200, 'flags legíveis');
assert.equal(await pedir(estranho, 'GET', 'platformConfig/emailProvider'), 403, 'config de e-mail fechada');

console.log('REGRAS OK');
