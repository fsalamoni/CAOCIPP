# Segurança, privacidade e LGPD

Como o SIGO autentica, autoriza e protege os dados — e quais limites existem
hoje. Este documento descreve o que o código faz; quando algo é só convenção
de interface, isso é dito.

---

## 1. Modelo em camadas

| Camada | Onde | O que garante |
|---|---|---|
| Autenticação | Firebase Authentication (Google) | Toda leitura e escrita exige usuário autenticado. |
| Regras do Firestore | `firestore.rules` | Leitura só para membros do órgão dono do documento; coleções sensíveis fechadas para escrita do cliente. |
| Cloud Functions | `functions-v2/src/**` | Validação de dados, papel, atribuições, fase, IDOR (o `organization_id` do documento é comparado ao da requisição) e auditoria. |
| Interface | `src/**` | Esconde o que o usuário não pode fazer. **Nunca é a garantia** — o servidor confere de novo. |

Regra geral do projeto: *a interface avisa, o servidor exige.*

---

## 2. Regras do Firestore

Auxiliares: `isAuthenticated()`, `isOwner(uid)`, `isMemberOf(orgId)` (existe
`userOrganizations/{uid}_{orgId}`), `hasRole(orgId, roles)` e
`isPlatformAdmin()` (claim `platformAdmin`).

| Coleção | Leitura | Escrita pelo cliente |
|---|---|---|
| `users/{uid}` | Só o próprio usuário ou super-admin (nomes de colegas vêm de `userOrganizations`) | Só o próprio usuário |
| `userPreferences/{uid}` | Só o próprio | Só o próprio |
| `organizations/{id}` | Membros | **Nenhuma** (só Functions) |
| `userOrganizations/{id}` | O próprio vínculo ou membros do mesmo órgão | **Nenhuma** |
| `processes`, `expedientes`, `parcerias` | Membros do órgão | **Nenhuma** (só Functions, que validam campos, permissões e gravam histórico). Subcoleções `history`, `aditivos`, `comments`: nenhuma. |
| `juris`, `jurimetriaTemplates`, `panoramaBases`, `panoramaRegistros`, `panoramaTemplates`, `entityTypes`, `customRecords` | Membros do órgão | **Nenhuma** |
| `auditLogs` | Só criador e admins do órgão | **Nenhuma** |
| `notifications` | Só o destinatário | Só marcar como lida (`read`, `read_at`) |
| `presence` | Membros do órgão | Só o próprio heartbeat |
| `otpCodes` | **Nenhuma** | **Nenhuma** |
| `platformConfig` | Qualquer autenticado | **Nenhuma** |
| `platformAdmins` | O próprio registro ou super-admin | **Nenhuma** |
| `platformStats` | Só super-admin | **Nenhuma** |
| `sec*` (Processo Eletrônico) | **Nenhuma** (tudo pelas Functions `secretaria*`) | **Nenhuma** |

Desde novembro de 2026 nenhuma coleção aceita escrita direta do cliente, exceto
o próprio perfil, as próprias preferências, a marcação de notificação lida e o
heartbeat de presença. Antes disso, Consultas, Expedientes e Parcerias aceitavam
escrita direta, o que pulava as validações das Functions; e `users` era legível
por qualquer conta autenticada, o que expunha e-mails (inclusive a partes do
Portal). As duas brechas foram fechadas e são cobertas pelo e2e nos emuladores.

---

## 3. LGPD e proteção de dados

### Que dados pessoais o sistema guarda

- **Usuários:** nome, e-mail e foto da conta Google, função, e-mail de
  notificação.
- **Registros:** nomes de consulentes, partes de parcerias, responsáveis,
  descrições de objeto e observações; no Panorama e na Jurimetria, o que vier
  nas planilhas importadas pelo órgão (números de processo, réus, vítimas,
  comarcas etc., conforme a base).
- **Trilhas:** histórico de cada registro, `auditLogs` (quem fez o quê e
  quando), presença em tempo real.

### Controles existentes

| Controle | Como funciona |
|---|---|
| **Isolamento por órgão** | Nenhum membro lê dados de órgão do qual não participa (regras + Functions). |
| **Mínimo privilégio na administração** | Configurações sensíveis exigem atribuição específica; retenção, webhooks, automação e IA são exclusivas do criador. |
| **Restrição de acesso** (`access_restriction` nas Consultas) | Marca o registro como sigiloso na interface e, ao abri-lo, grava um evento de acesso. |
| **Log de acesso e exportação** (`access_audit_log`, integrado) | `logAccess` registra aberturas de registros restritos e exportações de tabela em `auditLogs`; `getOrgAccessLog` permite ao criador ou a admins consultar e exportar o histórico. |
| **Retenção e anonimização** (`data_retention_policy`, integrado) | Duas etapas, sempre manuais e só pelo criador: `previewAnonymization` lista as Consultas arquivadas há mais de `retentionConfig.anonymizeAfterDays` (padrão 365 dias); `runAnonymization` anonimiza apenas os IDs confirmados (até 300 por vez), revalidando a elegibilidade no servidor. Substitui o campo **consulente** por "Consulente anonimizado (LGPD)" e registra em `auditLogs`. |
| **Exportações no navegador** | PDF, Excel, CSV, Word, JSON e Markdown são gerados localmente; nenhum dado vai a serviço externo. Valores de célula iniciados por `=`, `+`, `-`, `@` recebem `'` (proteção contra injeção de fórmulas). |
| **Preferências locais** | `localStorage` guarda só preferências de exibição (chaveadas por órgão), nunca dados de registros. |
| **Cabeçalhos HTTP** | `firebase.json`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (1 ano), `Permissions-Policy` (câmera, microfone, localização, pagamento e USB desligados). |
| **Localização do processamento** | Cloud Functions em `southamerica-east1` (São Paulo). A localização do banco Firestore é definida no projeto Firebase e não consta do repositório. |

### Limites conhecidos (importantes para a avaliação de conformidade)

1. **Hospedagem e identidade não institucionais.** O sistema roda num projeto
   Firebase mantido pela equipe, com contas Google, fora da infraestrutura e do
   login do MPRS, e não passou por homologação da TI institucional.
2. **"Restrição de acesso" não restringe leitura.** Todo membro do órgão lê
   todos os registros do órgão, inclusive os marcados como restritos. A
   marcação serve para sinalizar e auditar, não para bloquear.
3. **Dependência `xlsx` sem correção no npm.** A biblioteca de planilhas
   (SheetJS) tem vulnerabilidades altas conhecidas (poluição de protótipo e
   ReDoS ao ler arquivos maliciosos) e a versão corrigida só é distribuída
   fora do npm. O risco fica restrito a planilhas importadas por membros do
   órgão. Demais pendências do `npm audit` são altas ou moderadas em
   dependências internas do Firebase e de ferramentas de build; não há
   críticas (novembro de 2026).
4. **Anonimização parcial.** Só o campo consulente das Consultas é
   substituído. Objeto, observações, histórico e os demais módulos não são
   anonimizados.
5. **Sem criptografia em nível de campo** além da criptografia em repouso
   padrão do Google Cloud.
6. **Desenvolvimento sem `.env` usa produção.** `src/config/firebase.js` cai
   na configuração de produção quando não há variáveis `VITE_FIREBASE_*`.
   Para testar localmente, use os emuladores (`VITE_USE_EMULATORS=true`).
7. **Terceiros:** e-mails (código de 2FA e, quando reativados, relatórios)
   passam pelo provedor Resend; webhooks enviam dados do evento para a URL
   configurada pelo criador.

---

## 4. Autenticação

- **Google Sign-In** (`src/lib/FirebaseAuthContext.jsx`), com seleção de conta
  sempre exibida.
- **2FA por e-mail** (flag opcional `two_factor_auth`): não é o MFA nativo do
  Firebase. Código de 6 dígitos, válido por 5 minutos, guardado com hash em
  `otpCodes/{uid}` (inacessível ao cliente), com intervalo mínimo entre envios.
  **Falha aberta:** se o e-mail não puder ser enviado (provedor ausente),
  `TwoFactorGate` libera o acesso, para não trancar o usuário fora da conta.
- **Super-admin:** custom claim `platformAdmin`, documento ativo em
  `platformAdmins/{uid}` ou e-mail em `PLATFORM_ADMIN_EMAILS` (bootstrap).
  Concessão por `grantPlatformAdmin` ou pelo script
  `functions-v2/scripts/bootstrap-platform-admin.js`.

#### Processo Eletrônico (`secProcessos/**`, `secUnidades`, `secUnidadeConfig`, `secConvitesEquipe`, `secRitos`, `secTipos`, `secContadores`, `secConvites`, `secVerificacao`) e Cloud Storage

- Regras: `allow read, write: if false` em todas. As Cloud Functions `secretaria*`
  aplicam a autorização: vínculo com o órgão, módulo ativo, posse (só a unidade
  que tem o processo movimenta), lotação, sigilo restrito e minutas visíveis só
  à unidade de origem. Id de outro órgão responde "não encontrado".
- `storage.rules` (novo) nega todo acesso do navegador ao bucket; upload e
  download passam por `secretariaDocumento`, que valida tipo (lista fechada) e
  tamanho (5 MB) e grava o SHA-256.
- Conteúdo redigido é guardado como JSON do ProseMirror, não como HTML.
  `sanitizeDoc` (`functions-v2/src/shared/documento.ts`) descarta nós, marcas e
  atributos fora da lista fechada: link só `http(s)`/`mailto`, imagem só data
  URL PNG/JPEG, cor e tamanho validados por padrão, limites de 4 MB por
  documento e 1,5 MB por imagem. Isso fecha XSS no editor e na visualização.
- `secConfig` e `secModelos` também são fechadas; só o admin do órgão grava
  (brasão PNG/JPG até 300 KB); qualquer membro lê modelos via `obterModelo`.
- A ação `pdf` usa a mesma checagem de acesso de `baixar`: minuta só para a
  unidade de origem; documento juntado para quem vê o processo; no portal, só
  documentos visíveis às partes.
- `secretariaPlataforma` exige administrador da plataforma (claim,
  `platformAdmins/{uid}.active` ou `PLATFORM_ADMIN_EMAILS`). A suspensão por
  órgão bloqueia equipe e partes no servidor, sem apagar dados, e é auditada.
- Movimentos encadeados por SHA-256: alteração direta no banco é detectada na
  consulta e na exportação. Detalhes em [PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md).
- Portal das partes (`secretariaPortal`, `secConvites` fechada): a parte é
  usuário autenticado sem vínculo em `userOrganizations`; o acesso vem só de
  `processo.partes_uids`, gravado no aceite do convite. O convite guarda apenas
  o SHA-256 do token (24 bytes aleatórios), vale 7 dias, é aceito por uma única
  conta e é invalidado na revogação ou em novo convite. A parte vê somente
  documentos juntados marcados como visíveis e movimentos públicos; petição
  aceita só PDF/DOCX/PNG/JPG até 5 MB.
- Conferência pública (`secretariaConferir`, sem login): responde só a cópia
  dos metadados da juntada gravada em `secVerificacao` (fechada ao cliente),
  nunca o conteúdo nem o arquivo. O código tem 80 bits aleatórios
  (`crypto.randomBytes`), o que torna inviável adivinhar códigos; ele só sai
  impresso nas folhas do próprio documento. Quem tem o código vê título e
  número do processo mesmo em processo restrito (aceito: já tem o documento).
- Word e Excel são lidos no servidor (mammoth, xlsx) e o resultado passa por
  `sanitizeDoc`, como o texto do editor: links só http(s)/mailto, imagens só
  PNG/JPEG. Arquivo inválido vira folha de referência, sem derrubar a juntada.
- Alerta de prazos: e-mail só para quem está lotado na unidade que tem o
  processo, com número e assunto escapados em HTML; não vai para partes.

---

## 5. Autorização dentro do órgão

| Papel | Poderes |
|---|---|
| `creator` | Todos, implicitamente. Atribuído só em `createOrganization`; não pode ser removido nem rebaixado. |
| `admin` | Muda papel/função de membros, remove membros, consulta o log de acesso, testa webhooks, gerencia páginas personalizadas. Pelas regras, também edita e exclui Consultas/Expedientes/Parcerias diretamente. |
| `member` | Lê tudo do órgão; cria e edita registros pelas Cloud Functions. |

**Atribuições delegáveis** (só o criador concede; chaves sincronizadas entre
`src/constants/orgPermissions.js` e `functions-v2/src/shared/permissions.ts`):
`edit_details`, `manage_matters`, `configure_expedientes`,
`configure_parcerias`, `configure_jurimetria`, `configure_panorama`,
`manage_metrics`, `manage_modules`, `bulk_standardize`, `delete_records`.
Chaves desconhecidas são descartadas e qualquer valor diferente de `true` vira
`false` (`sanitizePermissions`).

`updateOrganization` exige, para cada campo enviado, a atribuição
correspondente (mapa `FIELD_PERMISSION`); campos de automação, segurança e IA
são só do criador. A exclusão de registros em todos os módulos exige
`delete_records`.

---

## 6. Proteções específicas

- **Webhooks:** bloqueio de SSRF (endereços internos e de metadados do GCP),
  timeout curto e falha silenciosa — um destino fora do ar não derruba a
  operação que o disparou (`functions-v2/src/shared/webhooks.ts`).
- **Exclusão do órgão:** exige o nome exato do órgão, verificado no servidor, e
  apaga em cascata as coleções do órgão (`ORG_SCOPED_COLLECTIONS` em
  `organizations/delete.ts`).
- **`logAccess`:** limita o tamanho do campo livre `details`.
- **Segredos:** `.env`, `functions-v2/.env` e chaves de conta de serviço são
  ignorados pelo git. No deploy, os segredos vêm do GitHub Actions. A
  configuração web do Firebase embutida em `src/config/firebase.js` é pública
  por natureza (identifica o projeto, não concede acesso).

---

## 7. Parcerias — decisões de segurança

### Lock de campos quando a Parceria tem aditivos

Após o primeiro aditivo ser criado, os campos da Parceria **original** ficam congelados. Isso garante que:

1. O aditivo não fique "órfão" se o usuário editar dados do original.
2. A hierarquia temporal (original → aditivos) seja preservada.
3. Não haja dois lugares com a "verdade" sobre os mesmos dados.

**Implementação:** a Cloud Function `updateParceria` (em `functions-v2/src/parcerias/update.ts`) bloqueia mudanças nos campos `FROZEN_WHEN_HAS_ADITIVO` quando `parceria.aditivo_count > 0`, lançando `HttpsError('failed-precondition', ...)`. A UI espelha com um cadeado 🔒 no DetailSheet e inputs `disabled` no EditDialog.

### Cascade de extinção

A função `extinguishParceria` marca a Parceria pai como extinta E cascadeia para todos os aditivos. Nenhuma operação do cliente é permitida nessa cascade — é 100% server-side, com `recursiveUpdate` em batch.

### Validação de transição de fase

Toda mudança de `status` passa por `validateParceriaPhaseTransition(target, mergedRecord)` que verifica os campos obrigatórios da fase-alvo. Se faltar algo, o servidor lança `HttpsError('failed-precondition', 'Para entrar em "X", preencha: A, B, C')`. Defesa em profundidade: cliente AVISA, servidor EXIGE.

### Permissão `configure_parcerias`

Nova chave delegável no `OrgPermissionKey` (em `functions-v2/src/shared/permissions.ts`). Membro com essa permissão pode editar TODO o objeto `parceriaSettings` (tipos, tipos de aditivo, vigência, categorias, toggles `thirdPartyPhaseEnabled` e `autoExtinguishOnEnd`) e `thirdPartiesSettingsParcerias` do órgão. O criador sempre tem. Membro sem essa permissão NÃO consegue modificar a configuração do módulo de Parcerias, mesmo sendo admin do órgão.

### Flag `parcerias_enabled`

Integrada ao produto (ligada por padrão, fora da tela de flags). Cada órgão liga ou desliga Parcerias em *Páginas e Módulos* (`moduleConfig.parcerias.enabled`).

**Defesa em profundidade**: a flag global continua sendo checada em `getOrganizationTabs` e `getActiveDataPages` — se for desligada como válvula de emergência (`false` explícito em `platformConfig/featureFlags`), as abas e métricas de Parcerias somem mesmo com `moduleConfig.parcerias.enabled = true`. Ver `src/lib/organizationModules.js` e `src/lib/dashboardMetrics.js`.

## 8. Jurimetria — decisões de segurança

### Coleção `juris/` — escrita 100% servidor

Diferente de `processes`, `expedientes` e `parcerias` (que permitem escrita direta do cliente sob condições), `juris/{juriId}` tem `allow write: if false`. Leitura segue o padrão: `isMemberOf(resource.data.organization_id)`.

Razão: só as Cloud Functions aplicam a normalização contra as listas oficiais do órgão, a checagem de duplicidade por `numero_processo_norm` e a permissão de exclusão. Escrita direta permitiria gravar um júri fora das listas do órgão, duplicar a chave natural ou apagar registros sem a permissão `delete_records`.

A subcoleção `juris/{id}/history` também é leitura-para-membros e escrita-só-servidor.

### Permissão `configure_jurimetria`

Nova chave delegável em `OrgPermissionKey` (`functions-v2/src/shared/permissions.ts` e `src/constants/orgPermissions.js`). Membro com essa permissão pode editar todo o objeto `jurimetriaSettings` (listas de comarcas/matérias/espécies, tabela de pontuação, colunas do órgão, política e rigor de importação, exigência de responsável). O criador sempre tem. Membro sem ela não altera a configuração do módulo, mesmo sendo admin do órgão.

A exclusão de júris reusa `delete_records` (a mesma de Consultas/Expedientes/Parcerias), verificada no servidor em `deleteJuris`.

### IDOR e tetos por chamada

Toda função do módulo confere o `organization_id` do documento contra o `organizationId` da requisição antes de alterar ou apagar — inclusive nas operações em massa, que **ignoram silenciosamente** ids de outros órgãos e reportam a contagem em `skipped`.

Tetos: 500 júris por `deleteJuris`/`bulkUpdateJuris`, 20.000 linhas por importação, 10 MB por arquivo.

### Feature flag `jurimetria_enabled`

Default OFF (zero impacto em produção). O painel "Administração & Custos" liga/desliga globalmente. Com a flag ligada e `custom_entities` também ligada, cada órgão ativa o módulo em *Páginas e Módulos* (`moduleConfig.jurimetria.enabled`).

**Defesa em profundidade**: a flag global é checada em `getOrganizationTabs`, `getActiveDataPages`, `AdminManagement`, `ModulesManager`, `Organization.jsx` (guarda de aba e assinatura de dados) e no `CommandPalette` — mesmo com `moduleConfig.jurimetria.enabled = true`, a flag global OFF esconde tudo e **nenhuma leitura** da coleção `juris` é feita.

### Trilha das alterações de data (`date_history`)

Toda mudança da data de um júri — redesignação, cancelamento, correção manual ou em massa, e alteração vinda de importação — grava uma entrada imutável em `date_history` (data anterior, nova data, realização, justificativa, autor, momento) **e** uma linha no `activity_log`/`history`. A regra vive numa única função de servidor (`resolveRealizacaoChange`), usada pelos três caminhos de escrita, para que nenhum deles possa gravar uma data nova sem deixar rastro. A justificativa é exigida pelo servidor ao entrar em `redesignado` ou `cancelado` — a validação da interface é conveniência, não a garantia.

`date_history` só é escrito por Admin SDK: como toda a coleção `juris/` tem `allow write: if false`, não há caminho de cliente que reescreva ou apague o histórico.

### Exclusão do órgão

`juris` foi acrescentada a `ORG_SCOPED_COLLECTIONS` em `functions-v2/src/organizations/delete.ts`: a base e os históricos são removidos recursivamente junto com o órgão, sem deixar documentos órfãos com dados de processos. Na mesma revisão, `parcerias` (com as subcoleções `aditivos/` e `history/`) foi acrescentada à mesma lista — estava de fora desde a criação daquele módulo, o que deixava convênios órfãos acessíveis por consulta direta após a exclusão do órgão.

### Modelos de relatório compartilhados (`jurimetriaTemplates/`)

Coleção de primeiro nível com `allow write: if false`, como `juris/`: leitura para membros do órgão dono do documento, toda escrita pela Cloud Function `manageJurimetriaTemplate`. É lá que a autoria é verificada — só `created_by === uid` ou quem tem `configure_jurimetria` edita ou exclui —, além da checagem de IDOR (o `organization_id` do documento é comparado ao da requisição antes de qualquer alteração, e um id de outro órgão devolve `not-found`). Escrita direta permitiria sobrescrever ou apagar o modelo de outro membro.

A configuração do modelo é **opaca** para o servidor — quem a interpreta é a engine no cliente, e ela muda a cada evolução do módulo. O que o servidor garante é que não vira depósito: objeto serializável, reserializado a partir do texto (o que derruba `undefined`, funções e protótipos exóticos), com teto de 20 KB por modelo e 300 modelos por órgão.

### Cores configuráveis e injeção em CSS

A cor de cada espécie é escolhida pelo administrador do órgão e chega ao DOM como variável CSS no `style` do elemento (é o único jeito de uma cor dinâmica ainda responder ao tema escuro). Por isso ela é validada nas duas pontas contra `^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$` — `normalizeHexColor` no cliente, `sanitizeHexColor` no servidor — e qualquer outro valor cai no cinza neutro. Texto, borda e a variante escura são **derivados por cálculo** da cor validada, não recebidos do cliente, de modo que nenhuma string arbitrária alcança a folha de estilo. O mapa de cores também só aceita chaves que sejam espécies do próprio órgão, para não virar depósito de chaves arbitrárias.

### Preferências de exibição no `localStorage`

As opções de análise, o tamanho de página das tabelas e o desenho dos relatórios dinâmicos ficam no `localStorage`, **chaveados por órgão** (`caocipp_jurimetria_<escopo>_<orgId>`), de modo que o recorte montado num órgão não vaze para outro no mesmo navegador. São preferências de apresentação: nenhum dado de júri é guardado ali, toda leitura é embrulhada em `try/catch` (modo privado, armazenamento bloqueado) e o padrão de fábrica sempre funciona sem elas.

### Exportação

Todos os seis formatos são gerados no navegador — nenhum dado de júri trafega para serviço externo. Os valores de texto passam por `sanitizeCellValue` (prefixo `'` em células iniciadas por `=`, `+`, `-`, `@`), mitigando injeção de fórmulas em planilhas (OWASP CSV Injection).

### Leitura de `.docx` no cliente

O arquivo é descompactado com a API nativa `DecompressionStream` e interpretado com `DOMParser` em modo `application/xml` — sem `innerHTML`, sem execução de script e sem biblioteca de terceiros. Apenas `word/document.xml` é lido; o restante do pacote é ignorado.

---

## 9. Panorama — decisões de segurança

O Panorama guarda **dados de processo definidos pelo próprio órgão**: o esquema
de cada base vem da planilha importada, e não do código. Isso muda o que precisa
ser validado — não há lista fixa de campos para conferir —, mas não muda o
perímetro: as três coleções são fechadas para escrita direta e tudo passa por
Cloud Function.

### Permissão `configure_panorama`

Nova chave delegável em `OrgPermissionKey` (`functions-v2/src/shared/permissions.ts`
e `src/constants/orgPermissions.js`). Quem a tem cria e configura bases: colunas,
papéis, pesos e cores dos desfechos, regiões, regra de prescrição, política de
importação e rigor da correção automática. O criador sempre tem. Um membro sem
ela usa o módulo e cadastra registros, mas não altera a definição da base — e,
como a definição é a **lente** sobre todos os números do órgão, alterá-la muda
todo relatório sem tocar em nenhum dado.

### Feature flag `panorama_enabled`

Default OFF. Defesa em profundidade idêntica à da Jurimetria: com a flag global
desligada, nenhuma leitura das coleções `panorama*` é feita, mesmo que
`moduleConfig.panorama.enabled` seja `true` em algum órgão.

### Coleções fechadas para escrita

`panoramaBases/`, `panoramaRegistros/` e `panoramaTemplates/` são
`allow write: if false` em `firestore.rules`. Leitura apenas para membros do
órgão dono do documento. Toda escrita passa por `managePanoramaBase`,
`managePanoramaRegistro`, `importPanorama` ou `managePanoramaTemplate`.

### Guardas de IDOR

Toda função compara o `organization_id` do documento com o da requisição antes de
qualquer operação, e devolve `not-found` (não `permission-denied`) para id de
outro órgão — que não confirma a existência do documento. Nos registros, o
`base_id` é conferido junto: um registro de outra base do mesmo órgão não pode
ser editado a partir da base errada.

### Exclusão de base

Apagar uma base apaga todos os seus registros em cascata. Por isso a função exige
`delete_records` **e** o nome exato da base digitado pelo usuário (`confirmName`),
validado no servidor — não só na tela.

### Escrita em massa contida

A edição em massa recusa alterar a coluna marcada como **identificador**:
reescrevê-la em lote fundiria registros distintos sob a mesma chave, e a
importação seguinte trataria o resultado como atualização legítima. A importação
grava em lotes de 400 e a exclusão em cascata também.

### Sanitização de um esquema que o órgão define

Como as colunas vêm da planilha, `sanitizeBaseDef` e `sanitizeRecordValues`
(`functions-v2/src/shared/panorama.ts`) limitam o que pode entrar: no máximo 120
colunas, rótulos de até 120 caracteres, chaves de até 60, listas de até 2000
valores, e apenas os tipos e papéis conhecidos. Papel único é respeitado no
servidor — o primeiro a reivindicar fica com ele.

### O esquema da importação não vem do cliente

As colunas efetivas de uma importação não decidem só o que será gravado na
definição da base: decidem a **conversão de cada valor** (pelo tipo), **qual
coluna é o identificador** — e portanto a chave natural e o casamento com o que
já existe — e **quais campos o patch toca**. Aceitar o mapeamento de qualquer
membro deixaria um membro comum remapear o papel de identificador para outra
coluna e, por essa via, sobrescrever o número do processo de registros
existentes: exatamente o que `managePanoramaRegistro` recusa ("O identificador
não pode ser alterado em massa").

Por isso, para quem **não** tem `configure_panorama` e importa numa base já
existente, o tipo, o papel e o rótulo de cada coluna vêm da definição gravada, e
coluna que a base não conhece fica de fora. A planilha alimenta o esquema que o
órgão definiu; estendê-lo exige a permissão. A tela de mapeamento entra em modo
somente-leitura nesse caso, com a explicação do porquê.

### Chave de coluna como caminho de campo

A chave de cada coluna vira **caminho de campo no Firestore** (`values.${key}`
no patch da importação) e **índice de objeto** nos valores do registro. Por isso
ela não pode ser o que o cliente mandar: `sanitizeColumns` só aceita a forma que
`slugColumnKey` produz (`^[a-z0-9_]{1,60}$`) e recusa `__proto__`,
`constructor` e `prototype`; qualquer outra coisa é reescrita a partir do
rótulo. Sem isso, uma chave com ponto criaria um mapa aninhado no lugar do
campo, e `__proto__` mexeria no protótipo em vez de criar um valor.

### Modelos de relatório compartilhados (`panoramaTemplates/`)

Mesma regra dos modelos da Jurimetria: só `created_by === uid` ou quem tem
`configure_panorama` edita ou exclui, verificado na Cloud Function.

### Volume e limite client-side

O cálculo roda no navegador, com teto prático de 20 mil registros por base. O
hook avisa ao se aproximar. Não é controle de segurança, é limite de recurso —
mas está documentado aqui porque é o ponto em que uma base grande degrada a
experiência em vez de falhar visivelmente.

