# Funcionalidades da plataforma

Referência das funcionalidades **comuns a todos os módulos**: órgãos, membros,
painéis, métricas, páginas personalizadas, colaboração, automação e a
administração da plataforma. Cada módulo de dados tem documento próprio:
[Consultas](./CONSULTAS.md), [Expedientes](./EXPEDIENTES.md),
[Parcerias](./PARCERIAS.md), [Jurimetria](./JURIMETRIA.md) e
[Panorama](./PANORAMA.md).

---

## 1. Acesso e conta

- **Login com Google** (Firebase Authentication, popup ou redirecionamento) na
  página inicial. Não há login por senha nem o login institucional do MPRS.
- **Perfil** (`/Profile`, coleção `users/{uid}`): nome, função, e-mail para
  notificações (`notification_email`) e preferências. As preferências de
  tabela (ordenação, colunas, densidade, filtros salvos) ficam em
  `userPreferences/{uid}`, com cópia no `localStorage`.
- **Verificação em duas etapas por e-mail** (flag opcional `two_factor_auth`,
  componente `TwoFactorGate`): código de 6 dígitos válido por 5 minutos. Ver
  [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md).

---

## 2. Órgãos e membros

| Ação | Como funciona | Quem pode |
|---|---|---|
| Criar órgão | `createOrganization`. Gera um **código de convite** de 8 caracteres. Opção de começar "mínimo" (só Informações Gerais e Painel Administrativo). | Qualquer usuário autenticado |
| Entrar num órgão | `joinOrganization` com o código de convite; entra como `member`. | Qualquer usuário com o código |
| Mudar papel ou função de um membro | `updateMember` (`admin` ↔ `member`; função em texto livre). O papel `creator` nunca é atribuído por aqui. | Criador ou admin |
| Delegar atribuições | `updateMember` com `permissions`. | Somente o criador |
| Remover membro | `removeMember`. O criador não pode ser removido. | Criador ou admin |
| Apagar todos os dados | `clearOrganizationData` (*Zona de Perigo*). | Somente o criador |
| Excluir o órgão | `deleteOrganization`, exige digitar o nome exato do órgão; apaga em cascata as coleções do órgão. | Criador ou super-admin |

Toda alteração dessas grava uma linha em `auditLogs`.

---

## 3. A página do órgão

As abas visíveis são calculadas em `getOrganizationTabs`
(`src/lib/organizationModules.js`) a partir dos módulos ligados e das flags:

| Aba | Conteúdo |
|---|---|
| **Informações Gerais** (`info`) | Dados do órgão e cartões de métricas configuráveis. Sempre presente. |
| Painel / lista de **Consultas**, **Expedientes**, **Parcerias** | Ver documentos dos módulos. |
| **Jurimetria**, **Panorama** | Só com a flag global ligada e o módulo ativo no órgão. |
| **Resumos Inteligentes** (`summary`) | Indicadores por período de Consultas e Expedientes (taxa de conclusão, tempo médio, urgentes, localidade, status, temporalidade em dias úteis, comparação com o período anterior). |
| **Calendário de Vencimentos** (`calendar`) | Prazos dos três módulos de fluxo. Aparece se ao menos um deles estiver ativo. |
| Páginas personalizadas (`cpanel:`/`clist:`) | Ver seção 5. |
| **Painel Administrativo** (`admin`) | Configuração do órgão (seção 4). |

**Ligar e desligar módulos.** `organization.moduleConfig.<módulo>.enabled`.
Órgão sem `moduleConfig` (legado) mostra todos os módulos; órgão com
`moduleConfig` mostra apenas os marcados como `true`. Exceção: o calendário
some só com `false` explícito. O servidor grava o `moduleConfig` módulo a
módulo, para não apagar módulos que uma versão antiga do site desconheça.

---

## 4. Painel Administrativo do órgão

`src/components/organization/admin/AdminManagement.jsx`. Cada aba exige uma
atribuição; o criador vê todas. O servidor (`updateOrganization`) confere a
mesma permissão campo a campo.

| Aba | Permissão | Grava em `organizations/{id}` |
|---|---|---|
| Detalhes | `edit_details` | `name`, `description` |
| Membros, Atribuições | só o criador | (memberships) |
| Classificação (Matérias) | `manage_matters` | `matterSettings`, `thirdPartiesSettingsConsultas`, `thirdPartyPhaseEnabledConsultas` |
| Páginas e Módulos | `manage_modules` | `moduleConfig`, tipos de página personalizada |
| Métricas | `manage_metrics` | `dashboardConfig` |
| Expedientes | `configure_expedientes` | `expedienteSettings`, `thirdPartiesSettingsExpedientes` |
| Parcerias | `configure_parcerias` | `parceriaSettings`, `thirdPartiesSettingsParcerias` |
| Jurimetria | `configure_jurimetria` | `jurimetriaSettings` |
| Panorama | `configure_panorama` | coleção `panoramaBases` |
| Padronização em Bloco | `bulk_standardize` | registros (troca de valores em lote) |
| Automação | só o criador | `goalsConfig`, `escalationConfig`, `reportsConfig` |
| Segurança | só o criador | `retentionConfig`, `webhookConfig`; consulta do log de acesso |
| Indicador de Tempo | só o criador | `stageTimeConfig` |
| Inteligência Artificial | só o criador | `summarySettings` (apenas preferências; nenhuma IA é chamada) |
| Zona de Perigo | só o criador | apagar dados / excluir órgão |

---

## 5. Métricas e páginas personalizadas

**Métricas configuráveis** (`dashboardConfig`, motor em
`src/lib/metricsEngine.js` e `src/lib/dashboardMetrics.js`). Para cada página
ativa, o admin cria indicadores sem código: contagem, soma, média, mínimo,
máximo ou percentual, com filtros por coluna e fase (E lógico), ícone, cor e
tamanho. Desligar um módulo esconde as métricas dele.

**Páginas personalizadas** (flag integrada `custom_entities`, coleções
`entityTypes` e `customRecords`). O órgão define um tipo de registro (nome,
campos, fases) e ganha painel Kanban, lista, formulário, importação e resumo
genéricos (`src/components/organization/custom/`). Tipos de campo: texto curto
e longo, número, valor (R$), data, sim/não, lista de uma ou várias opções,
pessoa (membro), município do RS e link. Toda escrita passa por Cloud
Functions (`upsertEntityType`, `createRecord`, `updateRecord`,
`deleteRecord`, `importRecords`), que validam contra o esquema do tipo.

---

## Processo Eletrônico

Módulo de processo eletrônico, ligado pelo admin do órgão (Painel
Administrativo → Processo Eletrônico). Fase 1: unidades (secretarias e
gabinetes) com lotação, ritos versionados, autuação com numeração anual,
tramitação por posse, atribuição, mudança de fase, sobrestamento e
arquivamento, minutas redigidas no editor ou enviadas, assinatura eletrônica
simples, juntada com número de ordem, linha do tempo com cadeia de hash e PDF
dos autos em ordem cronológica. Fase 2: conclusão ao gabinete, pendências
para o decisor (com ou sem interrupção da fase) e prazos em dias úteis ou
corridos com vencimento pelo CPC, com selos e filtros na lista. Fase 3:
portal das partes (`/Portal`), com convite por link ou e-mail, login próprio
(Google ou e-mail e senha), consulta aos documentos visíveis às partes e
petição a qualquer tempo, juntada na hora com pendência para o decisor. Fase 4:
tipos de processo (rito, sigilo e unidade sugerida), ritos com ramificações,
fase final e orientação por fase, editor visual com diagrama ao vivo, modelos
prontos, importação e exportação por planilha (.xlsx/.csv) e diagrama Mermaid,
e mudança de fase guiada pelo fluxo (fora do fluxo exige motivo). Fase 5:
editor de documentos completo (folha A4, fontes, tabelas, imagens, quebra de
página, localizar e substituir), papel timbrado do órgão, modelos com campos
automáticos, prévia em PDF, juntada com numeração de folhas e PDF carimbado
de cada documento (também no portal), índice de folhas nos autos e controle
da Secretaria por órgão no painel da plataforma (suspensão com motivo). Fase 6:
busca por parte e CPF com filtros avançados, aba Painel com indicadores,
feriados locais e recessos na contagem de prazos, alerta diário de prazos
por e-mail, código de conferência com QR em cada folha e página pública
`/Conferir`, e conversão de Word (DOCX) e Excel (XLSX) em folhas dos autos
(inclusive petição em Word no portal). Reestruturação (nov/2026): o módulo
passou a se chamar Processo Eletrônico, toda a configuração foi para o Painel
Administrativo do órgão, e as unidades de lotação (secretaria, gabinete,
assessoria, outra) ganharam equipe com atribuições e gestores, inserção de
membros, convite por e-mail, pedidos de lotação, papel timbrado, tipos de
documento e modelos próprios. Modelos podem ser importados de Word, PDF, HTML
ou TXT (com cabeçalho, rodapé e imagens) ou guardados no arquivo original. Ver
[PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md).

---

## 6. Recursos de uso diário

Todos integrados ao produto, salvo indicação:

- **Kanban com arrastar e soltar** e **listas** com colunas fixas, ordenação
  por tipo de dado, paginação e filtros salvos (visões nomeadas).
- **Ações em massa**, **exportação para PDF e Excel**, **densidade de tabela**
  ajustável, **copiar número ao clicar**.
- **Paleta de comandos** (Ctrl/Cmd + K).
- **Indicador de tempo na etapa atual** (dias úteis, limites em
  `stageTimeConfig`).
- **Comentários internos com @menção** (`addComment`); a menção gera uma
  notificação na central de notificações (coleção `notifications`).
- **Presença em tempo real** ("quem está vendo este registro", coleção
  `presence`).
- **Histórico** de cada registro (`activity_log` + subcoleção `history/`).
- **Painel inicial** (`/Dashboard`) com KPIs e atividade dos órgãos do usuário,
  ajustado à função (assessoria, secretaria, decisória).
- **Tema claro/escuro** e **design V2** (ver
  [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md)).
- Opcionais (flag desligada por padrão): **busca global entre órgãos**
  (`global_search`), **metas por assessor** (`assessor_goals`), **tour de
  primeiro acesso** (`onboarding_tour`).

---

## 7. Automação e integrações

| Recurso | Estado |
|---|---|
| Avisos de renovação/revisão das Parcerias (`checkPartnershipNoticeDeadlines`, diária 03:00) | **Ativo** |
| Escalonamento automático de urgentes parados (`autoEscalateStalledUrgent`) | Código pronto, **exportação comentada** em `functions-v2/src/index.ts` — não roda |
| Resumo diário e relatório semanal por e-mail (`sendDailyUrgentSummary`, `sendWeeklyOrgReport`) | Código pronto, **exportação comentada** — não roda |
| Webhooks de saída (`outbound_webhooks`) | Ativo. Eventos `urgent_created`, `archived`, `parceria_created`, `parceria_extinguished`; teste por `testOrgWebhook`. |
| E-mail transacional (2FA) | Resend, com chave `EMAIL_API_KEY` ou configurada em *Administração & Custos → E-mail* |

As configurações de automação continuam editáveis no Painel Administrativo,
mas, enquanto as funções agendadas estiverem comentadas, não produzem efeito.

---

## 8. Administração da plataforma (super-admin)

Página `/Admin` (*Administração & Custos*), acessível a quem tem o custom claim
`platformAdmin`, um documento ativo em `platformAdmins/{uid}` ou o e-mail
listado na variável `PLATFORM_ADMIN_EMAILS` das Cloud Functions (usada para
conceder o primeiro acesso).

| Aba | Para quê | Function |
|---|---|---|
| Visão geral | Totais da plataforma | `getPlatformOverview` |
| Configuração | Passo a passo dos segredos e integrações | `getSetupStatus` |
| Custos | Custos reais via export do Cloud Billing no BigQuery | `getCostReport` |
| Funcionalidades | Liga/desliga as flags opcionais | `getFeatureFlags`, `setFeatureFlag` |
| Administradores | Concede/revoga super-admin | `grantPlatformAdmin`, `revokePlatformAdmin`, `listPlatformAdmins` |
| E-mail | Provedor de e-mail | `getEmailProviderConfig`, `setEmailProviderConfig` |
| Órgãos, Usuários, Movimentações, Armazenamento | Relatórios da plataforma | `getOrgsReport`, `listPlatformUsers`, `getActivityFeed`, `getStorageFootprint` |
| Cotas, Saúde, Ferramentas de dados | Limites, saúde, auditoria de integridade, recálculo de estatísticas, backfill de histórico | `getPlatformQuotas`, `setPlatformQuota`, `getSystemHealth`, `runIntegrityAudit`, `recalcOrgStats`, `backfillHistory` |

---

## 9. Feature flags

Catálogo em `src/constants/featureFlags.js`; valores em
`platformConfig/featureFlags` (lidos em tempo real por
`src/lib/FeatureFlagsContext.jsx`).

- **Integradas** (todas as que não estão em `OPTIONAL_FLAG_KEYS`): ligadas por
  padrão e fora da tela de administração. Um `false` explícito gravado no
  Firestore ainda as desliga, como válvula de emergência.
- **Opcionais** (desligadas por padrão, ligadas pelo super-admin):
  `global_search`, `assessor_goals`, `two_factor_auth`, `onboarding_tour`,
  `jurimetria_enabled`, `panorama_enabled`.

As flags são globais (valem para todos os órgãos). A ativação por órgão é
feita pelo `moduleConfig`.
