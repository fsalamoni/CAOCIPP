# Arquitetura do SIGO

Como o sistema é montado: tecnologias, estrutura do repositório, fluxo de
dados, coleções do Firestore e implantação.

---

## 1. Visão de conjunto

```
Navegador (React SPA)
 ├─ Leitura ──────► Firestore (onSnapshot, em tempo real)   ◄── regras: firestore.rules
 ├─ Escrita ──────► Cloud Functions v2 (onCall)  ──────────► Firestore (Admin SDK)
 │                    região southamerica-east1 (São Paulo)
 └─ Login ────────► Firebase Authentication (Google)

Firebase Hosting
 ├─ site "sigo-caocipp" → dist/           (a aplicação)
 └─ site "consultascao" → 301 para sigo-caocipp.web.app
```

Princípios que se repetem em todo o código:

1. **O cliente lê direto do Firestore e escreve por Cloud Function.** As
   leituras usam ouvintes em tempo real (`src/hooks/useFirestore.js`,
   `useJuris.js`, `usePanorama.js`, `useCustomEntities.js`). Todas as gravações
   do app passam por funções `onCall` (`src/services/functionsService.js`),
   onde ficam validação, autorização, histórico e auditoria.
2. **Fase derivada de dados.** O status de Consultas e Expedientes é calculado a
   partir das datas preenchidas; o de Parcerias é validado contra os campos
   exigidos de cada fase. A mesma regra existe no servidor
   (`functions-v2/src/shared/`) e no cliente (`src/utils/`), e os comentários de
   cada arquivo apontam o espelho.
3. **Cálculo analítico no navegador.** Métricas, Resumos, relatórios da
   Jurimetria e do Panorama são calculados no cliente sobre os registros já
   carregados (`src/lib/metricsEngine.js`, `dashboardMetrics.js`,
   `jurimetriaEngine.js`, `panoramaEngine.js`). Exportações (PDF, Excel, Word,
   CSV, JSON, Markdown) também são geradas no navegador.
4. **Isolamento por órgão.** Todo documento de dados tem `organization_id`; as
   regras e as funções conferem o vínculo `userOrganizations/{uid}_{orgId}`.

---

## 2. Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 18, Vite 6, React Router 6, TanStack Query 5 |
| Componentes e estilo | Tailwind CSS 3, shadcn/ui (Radix UI), lucide-react, framer-motion |
| Gráficos | Recharts |
| Planilhas e documentos | SheetJS (`xlsx`), jsPDF + autotable |
| Arrastar e soltar | `@dnd-kit` |
| Backend | Firebase Cloud Functions v2 (Node 22, TypeScript), `firebase-admin` 13 |
| Banco | Cloud Firestore |
| Autenticação | Firebase Authentication (provedor Google) |
| Hospedagem | Firebase Hosting (dois sites) |
| E-mail | Resend (opcional; chave `EMAIL_API_KEY`) |
| Custos | Export do Cloud Billing para BigQuery (opcional) |

O `package.json` ainda lista dependências sem uso no código atual, herdadas do
protótipo original na plataforma Base44 (`@base44/sdk`, Stripe, `three`,
`react-leaflet`, `html2canvas`, `@hello-pangea/dnd`, entre outras). O
`@base44/vite-plugin` continua carregado em `vite.config.js`, mas o app não
usa o SDK da Base44 para dados.

---

## 3. Estrutura do repositório

```
CAOCIPP/
├── src/                      Aplicação React
│   ├── pages/                Páginas (Landing, Dashboard, Organization, Profile, Admin, Help, Terms)
│   ├── pages.config.js       Registro das páginas e página inicial
│   ├── Layout.jsx            Barra lateral, cabeçalho e navegação por órgão
│   ├── components/
│   │   ├── organization/     Módulos do órgão (Consultas, Expedientes, Parcerias…)
│   │   │   ├── admin/        Abas do Painel Administrativo
│   │   │   ├── custom/       Páginas personalizadas (componentes genéricos)
│   │   │   ├── jurimetria/   Módulo Jurimetria
│   │   │   └── panorama/     Módulo Panorama
│   │   ├── admin/            Administração da plataforma (super-admin)
│   │   └── ui/               Componentes shadcn/ui
│   ├── constants/            Flags, permissões, listas da Jurimetria e do Panorama
│   ├── hooks/                Leitura em tempo real do Firestore
│   ├── lib/                  Contextos (auth, flags, tema), motores de cálculo, utilitários
│   ├── services/             Chamadas às Cloud Functions e leituras pontuais
│   ├── utils/                Regras de domínio no cliente (status, aliases de campos)
│   └── config/firebase.js    Inicialização do Firebase
├── functions-v2/             Cloud Functions (TypeScript)
│   ├── src/                  Código-fonte (um diretório por domínio)
│   ├── lib/                  JavaScript compilado (versionado)
│   └── scripts/              Scripts administrativos (bootstrap de super-admin, backfill)
├── firestore.rules           Regras de segurança
├── firestore.indexes.json    Índices compostos
├── firebase.json             Hosting (dois sites), Functions e Firestore
├── .github/workflows/        CI (ci.yml) e deploy (deploy.yml)
├── public/                   Ícones, manifest e service worker (PWA)
├── dist-redirect/            Página do site de redirecionamento
└── docs/                     Esta documentação
```

### Pastas legadas

Mantidas apenas por histórico; **não fazem parte do build nem do deploy**:

| Pasta | O que é |
|---|---|
| `functions/` | Funções Deno da versão Base44 (`npm:@base44/sdk`). Substituídas por `functions-v2/`. |
| `Repositório original/` | Cópia de segurança da versão anterior do repositório. |
| `.agent/` | Kit de agentes, skills e workflows usados no desenvolvimento assistido. |
| `Proposta de redesign frontend minimalista.zip` | Protótipo que originou o design V2. |
| `Municípios do RS.*` | Fonte da lista de municípios em `src/utils/cities.js`. |

---

## 4. Cloud Functions

Todas exportadas em `functions-v2/src/index.ts`, região `southamerica-east1`.

| Domínio | Funções |
|---|---|
| Órgãos e membros (`organizations/`) | `createOrganization`, `getUserOrganizations`, `joinOrganization`, `updateMember`, `removeMember`, `updateOrganization`, `bulkReplaceFieldValues`, `clearOrganizationData`, `deleteOrganization` |
| Consultas (`processes/`, `import/fromExcel.ts`) | `createProcess`, `updateProcess`, `deleteProcess`, `calculateProcessStatus`, `backfillProcessLogs`, `importProcessesFromExcel` |
| Expedientes | `createExpediente`, `updateExpediente`, `deleteExpediente`, `importExpedientesFromExcel` |
| Parcerias | `createParceria`, `updateParceria`, `deleteParceria`, `addAditivo`, `updateAditivo`, `concludeAditivo`, `deleteAditivo`, `extinguishParceria`, `importParceriasFromExcel` |
| Jurimetria | `createJuri`, `updateJuri`, `deleteJuris`, `bulkUpdateJuris`, `importJurisFromExcel`, `manageJurimetriaTemplate` |
| Panorama | `managePanoramaBase`, `managePanoramaRegistro`, `importPanorama`, `managePanoramaTemplate` |
| Páginas personalizadas | `upsertEntityType`, `deleteEntityType`, `createRecord`, `updateRecord`, `deleteRecord`, `importRecords` |
| Usuário | `updateProfile`, `migrateMemberFunctions` |
| Colaboração | `addComment` |
| Segurança | `logAccess`, `getOrgAccessLog`, `previewAnonymization`, `runAnonymization`, `sendLoginOtp`, `verifyLoginOtp`, `testOrgWebhook` |
| Plataforma (super-admin) | ver [FEATURES_REFERENCE.md §8](./FEATURES_REFERENCE.md#8-administração-da-plataforma-super-admin) |
| Agendadas | `checkPartnershipNoticeDeadlines` (ativa). `autoEscalateStalledUrgent`, `sendDailyUrgentSummary` e `sendWeeklyOrgReport` estão comentadas. |

Módulos compartilhados em `functions-v2/src/shared/`: `status.ts` (cálculo de
fase), `validators.ts` (requisitos de fase das Parcerias), `permissions.ts`
(atribuições), `fields.ts` (aliases de campos), `phaseDates.ts`, `history.ts`,
`normalization.ts`, `webhooks.ts`, `email.ts`, `jurimetria.ts`, `panorama.ts`.

#### Processo Eletrônico (`secUnidades`, `secUnidadeConfig`, `secConvitesEquipe`, `secRitos`, `secTipos`, `secContadores`, `secConvites`, `secConfig`, `secModelos`, `secVerificacao`, `secProcessos` + subcoleções `movimentos` e `documentos`)
**Purpose:** Processo eletrônico do órgão. Fechadas ao cliente; tudo passa pelas
functions `secretaria*`. Arquivos no Cloud Storage em
`secretaria/{org}/{processo}/{documento}` (e `.pdf` ao lado, para textos
juntados). PDFs gerados no servidor com `pdfmake` (documento) e `pdf-lib`
(carimbo de folhas e autos, com QR do código de conferência via `qrcode`);
Word e Excel convertidos no servidor com `mammoth` e `xlsx`; editor no
navegador com TipTap. Página pública `/Conferir` e alerta diário de prazos
(`secretariaAlertaPrazos`, Cloud Scheduler). Modelo completo em
[PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md).

---

## 5. Coleções do Firestore

| Coleção | Conteúdo |
|---|---|
| `users/{uid}` | Perfil do usuário |
| `userPreferences/{uid}` | Preferências de interface |
| `organizations/{orgId}` | Órgão: nome, código de convite, `moduleConfig`, configurações de cada módulo, `dashboardConfig`, configurações de automação e segurança, `stats` |
| `userOrganizations/{uid}_{orgId}` | Vínculo usuário ↔ órgão: `role`, `function`, `permissions` |
| `processes/{id}` (+ `history`, `comments`) | Consultas |
| `expedientes/{id}` (+ `history`, `comments`) | Expedientes |
| `parcerias/{id}` (+ `aditivos/{id}/history`, `history`, `comments`) | Parcerias e aditivos |
| `juris/{id}` (+ `history`), `jurimetriaTemplates/{id}` | Jurimetria |
| `panoramaBases/{id}`, `panoramaRegistros/{id}`, `panoramaTemplates/{id}` | Panorama |
| `entityTypes/{id}`, `customRecords/{id}` (+ `history`) | Páginas personalizadas |
| `auditLogs/{id}` | Auditoria (ações administrativas, acessos e exportações) |
| `notifications/{id}` | Notificações por usuário |
| `presence/{id}` | Presença em tempo real |
| `otpCodes/{uid}` | Códigos de 2FA (hash), inacessíveis ao cliente |
| `platformConfig/{doc}` | Feature flags e configuração global |
| `platformAdmins/{uid}`, `platformStats/{doc}` | Super-admins e estatísticas da plataforma |

As regras de cada coleção estão em [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md#2-regras-do-firestore).

---

## 6. Frontend: inicialização e navegação

`src/main.jsx` → `src/App.jsx`, que monta, nesta ordem: `ErrorBoundary`,
`FirebaseAuthProvider` (`src/lib/FirebaseAuthContext.jsx`),
`FeatureFlagsProvider`, tema V2 e alternância de tema, `QueryClientProvider`,
roteador, `NavigationTracker` e `TwoFactorGate`.

As rotas são geradas de `src/pages.config.js` (uma rota `/<NomeDaPágina>` por
página). Dentro do órgão, a aba ativa vive em `?tab=`, o que permite
compartilhar links e recarregar sem perder o lugar. A lista de abas vem de
`getOrganizationTabs` (`src/lib/organizationModules.js`), lida pelo hook
`useOrganizationTabs` (`src/hooks/useOrganizationTabs.js`, que aplica as flags
e o filtro do Painel Administrativo). A mesma lista alimenta a barra
horizontal (`OrgTabBar`), o sub-menu lateral e o tour. Uma aba pode ter página
própria (`page`): hoje só o Processo Eletrônico, cujo endereço `orgTabUrl`
devolve; no `Layout`, essa página conta como página do órgão (sub-menu aberto,
órgão ativo vindo de `?org=`).

Ajuda e Termos são públicas, mas para quem está logado abrem dentro do
`Layout`, com o menu. Landing, Portal e Conferir seguem sem o menu.

> Use sempre `useAuth` de `@/lib/FirebaseAuthContext`. O arquivo
> `src/lib/AuthContext.jsx` é um resto da versão Base44 e seu provider não é
> montado pelo App.

### Configuração do Firebase no cliente

`src/config/firebase.js` lê as variáveis `VITE_FIREBASE_*`. Se estiverem
ausentes ou com valores de exemplo, usa a **configuração do projeto de
produção** embutida no arquivo. Ou seja: `npm run dev` sem `.env` conecta à
base real. Para trabalhar isolado, use os emuladores
(`VITE_USE_EMULATORS=true`; ver [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)).

---

## 7. Implantação

- **CI** (`.github/workflows/ci.yml`): em push para `main`/`development` e em
  todo pull request — instala dependências, `npm run lint`, `npm run
  typecheck`, compila as functions e faz o build do frontend.
- **Deploy** (`.github/workflows/deploy.yml`): a cada push em `main` (ou
  manualmente) publica hosting, functions, regras e índices no projeto Firebase
  `protagonista-rpg`. O `firebase.json` declara o site `sigo`; como esse ID é
  reservado globalmente, o workflow usa o primeiro disponível de uma lista
  (hoje `sigo-caocipp`) e reescreve o `firebase.json` durante o deploy. Sem os
  segredos de deploy, o job termina verde sem publicar.
- Os segredos e a configuração do Cloud Scheduler estão em
  [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md#6-deploy) e
  [CI-DEPLOY-PERMISSIONS.md](./CI-DEPLOY-PERMISSIONS.md).
