# Guia de desenvolvimento

Como preparar o ambiente, rodar o SIGO localmente, fazer uma alteração
completa e publicar.

---

## 1. Pré-requisitos

- **Node.js 22** (mesma versão do CI e do runtime das Cloud Functions).
- **npm** (o repositório usa `package-lock.json`).
- **Firebase CLI**: já vem como dependência (`npx firebase …`); a instalação
  global é opcional.
- **Java 11+**, só se for usar os emuladores do Firestore.
- Uma conta Google com acesso ao projeto Firebase, para deploy manual ou para
  usar a base real.

---

## 2. Instalação

```bash
git clone https://github.com/fsalamoni/CAOCIPP.git
cd CAOCIPP
npm install
npm --prefix functions-v2 install
cp .env.example .env      # opcional, ver abaixo
```

### Variáveis do frontend (`.env`)

| Variável | Uso |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Configuração web do Firebase |
| `VITE_USE_EMULATORS` | `true` liga os emuladores locais (só em `npm run dev`) |
| `VITE_CONSULTAS_CAO_*` | Opcionais, legado da versão Base44 |

> **Atenção.** Sem `.env` (ou com os valores de exemplo), `src/config/firebase.js`
> usa a configuração do **projeto de produção**. Qualquer gravação feita no
> `npm run dev` vai para a base real. Para testar sem risco, use os emuladores.

### Variáveis das Cloud Functions (`functions-v2/.env`, nunca versionado)

| Variável | Uso |
|---|---|
| `EMAIL_API_KEY` | Chave do Resend (2FA e relatórios por e-mail) |
| `PLATFORM_ADMIN_EMAILS` | E-mails com acesso de super-admin garantido (bootstrap) |
| `BILLING_BQ_PROJECT`, `BILLING_BQ_DATASET`, `BILLING_BQ_TABLE` | Export do Cloud Billing para a aba Custos |

Todas são opcionais: sem elas, a funcionalidade correspondente fica inativa e
nada quebra.

---

## 3. Rodando localmente

```bash
npm run dev                                   # Vite em http://localhost:5173
```

Com emuladores (base isolada):

```bash
npm --prefix functions-v2 run build:local
npx firebase emulators:start --only auth,firestore,functions
# em outro terminal, com VITE_USE_EMULATORS=true no .env:
npm run dev
```

O app se conecta a Auth em `localhost:9099`, Firestore em `localhost:8080` e
Functions em `localhost:5001`.

---

## 4. Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run typecheck` | `tsc` sobre o frontend (`jsconfig.json`) |
| `npm --prefix functions-v2 run build:local` | Compila as functions para `functions-v2/lib/` |
| `npm --prefix functions-v2 run serve` | Compila e sobe só o emulador de functions |

**Verificação antes de abrir um PR** (o mesmo que o CI roda):

```bash
npm run lint && npm run typecheck && npm --prefix functions-v2 run build:local
npm --prefix functions-v2 test && npm run test:lib && npm run test:rules && npm run build
```

### Testes

| Comando | O que cobre |
|---|---|
| `npm --prefix functions-v2 test` | Regras de negócio das Functions do Processo Eletrônico (`functions-v2/test/*.test.js`, `node:test`). |
| `npm run test:lib` | Motores puros do frontend (`src/lib/*.test.js`), como o motor de ritos. |
| `npm run test:rules` | `firestore.rules` no emulador (precisa de Java 21+): perfis só do próprio usuário, nenhuma escrita direta em registros, auditoria só para criador e admins, coleções da Secretaria fechadas. |

Os três rodam no CI. Ao mudar uma regra do Firestore, acrescente o caso em
`scripts/test-rules.mjs`. As portas dos emuladores ficam em `firebase.json`
(`emulators`).

> **Atenção:** no emulador de Functions, `admin.firestore.FieldValue` chega
> indefinido para as funções que o usam (o emulador embrulha `admin.firestore`).
> Em produção funciona normalmente. Para testes locais com dados, semeie o
> Firestore direto (token `Bearer owner` na API REST do emulador), como faz
> `scripts/test-rules.mjs`.

---

## 5. Convenções do código

- **Idioma.** Interface, mensagens de erro e comentários em português.
- **Escrita sempre por Cloud Function.** Nova operação de gravação = nova
  função `onCall` em `functions-v2/src/<domínio>/`, exportada em
  `functions-v2/src/index.ts`, com wrapper em `src/services/functionsService.js`.
  Toda função começa conferindo `request.auth`, o vínculo
  `userOrganizations/{uid}_{orgId}`, a atribuição necessária e se o
  `organization_id` do documento é o da requisição.
- **Regras espelhadas.** Cálculo de fase, aliases de campos, requisitos de fase
  e atribuições existem no servidor e no cliente. Ao mudar um lado, mude o
  outro; os comentários no topo de cada arquivo apontam o espelho
  (ex.: `shared/validators.ts` ↔ `src/utils/parceriaPhases.js`,
  `shared/permissions.ts` ↔ `src/constants/orgPermissions.js`).
- **Compatibilidade de dados.** Campos novos são aditivos; registros antigos
  sem o campo precisam continuar funcionando (padrão "ausente = comportamento
  atual"). Nunca reescrever ou apagar dados existentes numa migração sem
  autorização explícita.
- **Novos recursos atrás de flag.** Cadastre a flag em
  `src/constants/featureFlags.js`. Para nascer desligada, inclua a chave em
  `OPTIONAL_FLAG_KEYS`; tirar de lá torna a flag integrada (ligada para todos).
- **Novo módulo do órgão.** Registrar em `BUILTIN_MODULES`,
  `BUILTIN_MODULE_META`, `resolveBuiltinModules` e `getOrganizationTabs`
  (`src/lib/organizationModules.js`); acrescentar a coleção a
  `ORG_SCOPED_COLLECTIONS` (`organizations/delete.ts`), às regras e aos índices.
- **`functions-v2/lib/` é versionado.** Depois de mudar `functions-v2/src`,
  rode `npm --prefix functions-v2 run build:local` e inclua o `lib/` no commit.
- **Documentação no mesmo PR.** Toda mudança de comportamento, dados, telas,
  permissões ou estrutura atualiza os documentos correspondentes em `docs/`
  (ver o índice em [README.md](./README.md)).

---

## 6. Deploy

### Fluxo

1. Trabalhe num branch e abra um pull request para `main`.
2. O **CI** (`.github/workflows/ci.yml`) roda lint, typecheck e os dois builds.
3. Ao fazer merge em `main`, o workflow **Deploy to Firebase**
   (`.github/workflows/deploy.yml`) publica hosting, functions, regras e índices
   no projeto `protagonista-rpg`. Também pode ser disparado à mão
   (*Actions → Deploy to Firebase → Run workflow*).
4. Confira em <https://sigo-caocipp.web.app>.

### Segredos do repositório (GitHub → Settings → Secrets and variables → Actions)

| Segredo | Obrigatório | Uso |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` (recomendado) ou `FIREBASE_TOKEN` | Sim | Autenticação do deploy |
| `VITE_FIREBASE_*` (seis variáveis) | Sim | Configuração do frontend publicado |
| `EMAIL_API_KEY`, `PLATFORM_ADMIN_EMAILS`, `BILLING_BQ_*` | Não | Viram `functions-v2/.env` durante o deploy |
| `VITE_CONSULTAS_CAO_*` | Não | Legado |

Sem os obrigatórios, o deploy termina verde **sem publicar nada**.

### Particularidades

- **ID do site.** `firebase.json` declara o site `sigo`, que é reservado por
  outro projeto. O workflow tenta `sigo`, `sigo-caocipp`, `sigo-mp-rs` e
  `sigo-protagonista`, usa o primeiro disponível (hoje `sigo-caocipp`) e
  reescreve o `firebase.json` só durante o deploy
  (`.github/scripts/update-firebase-site.cjs`).
- **Projeto compartilhado.** `protagonista-rpg` hospeda outros apps. As
  functions do SIGO usam o codebase `sigo` e o deploy roda em dois passos:
  hosting, functions e storage com `--force`; regras e índices do Firestore
  sem `--force`, para não apagar índices de outros apps. Riscos e limites em
  [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md#projeto-firebase-compartilhado-isolamento).
- **Site legado.** `consultascao` serve `dist-redirect/` e redireciona tudo
  (301) para `https://sigo-caocipp.web.app`.
- **Função agendada.** Antes do deploy, o workflow remove a função
  `checkPartnershipNoticeDeadlines` e o job do Cloud Scheduler, se estiverem
  órfãos, e o deploy os recria. A conta de serviço precisa do papel *Cloud
  Scheduler Admin* — ver [CI-DEPLOY-PERMISSIONS.md](./CI-DEPLOY-PERMISSIONS.md).
- **Domínio próprio.** `*.web.app` não pode ser domínio personalizado de outro
  site. Para um endereço como `sigo.mp.rs.gov.br`, é preciso registrar o
  domínio e associá-lo ao site `sigo-caocipp` no console do Firebase, além de
  incluí-lo nos domínios autorizados do Firebase Auth e nas origens do OAuth.

### Deploy manual (emergência)

```bash
npx firebase login
npm --prefix functions-v2 run build:local && npm run build
CREATED_SITE=sigo-caocipp node .github/scripts/update-firebase-site.cjs   # troca "sigo" no firebase.json
npx firebase deploy --only hosting,functions,firestore --project protagonista-rpg
git checkout firebase.json                                                # não commitar a troca
```

---

## 7. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Listas vazias logo após publicar índices | Índices do Firestore ainda em construção; aguarde alguns minutos. |
| "useAuth must be used within an AuthProvider" | Import de `@/lib/AuthContext` em vez de `@/lib/FirebaseAuthContext`. |
| Página de módulo não aparece | Flag global desligada ou módulo desligado em *Páginas e Módulos* (`moduleConfig`). |
| Login falha num domínio novo | Domínio não incluído em *Firebase Auth → Authorized domains* e nas origens do OAuth no Google Cloud. |
| Mudança nas functions não chegou ao deploy | `functions-v2/lib` desatualizado no commit — recompile. O deploy também compila no `predeploy`. |
