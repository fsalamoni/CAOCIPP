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
| Mudar papel ou função de um membro | `updateMember` (`admin` ↔ `member`; função em texto de até 60 caracteres, que o painel preenche a partir de uma lista fixa). O papel `creator` nunca é atribuído por aqui. | Criador ou admin |
| Delegar atribuições | `updateMember` com `permissions`. | Somente o criador |
| Remover membro | `removeMember`. O criador não pode ser removido. | Criador ou admin |
| Apagar todos os dados | `clearOrganizationData` (*Manutenção e zona de perigo*). | Somente o criador |
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
| **Processo Eletrônico** (`processo-eletronico`) | Página própria (`/ProcessoEletronico?org=`), listada aqui quando o módulo está ativo no órgão. Ver [PROCESSO_ELETRONICO.md](PROCESSO_ELETRONICO.md). |
| **Painel Administrativo** (`admin`) | Configuração do órgão (seção 4). |

**Ligar e desligar módulos.** `organization.moduleConfig.<módulo>.enabled`.
Órgão sem `moduleConfig` (legado) mostra todos os módulos; órgão com
`moduleConfig` mostra apenas os marcados como `true`, na ordem de
`moduleConfig.<módulo>.order` quando houver. Exceção: o calendário
some só com `false` explícito. O servidor grava o `moduleConfig` módulo a
módulo, para não apagar módulos que uma versão antiga do site desconheça.

---

## 4. Painel Administrativo do órgão

`src/components/organization/admin/AdminManagement.jsx` desenha o painel a
partir do mapa em `src/lib/adminSections.js` (seções, grupos, quem pode abrir
e de quais flags globais cada uma depende). O painel abre numa **Visão geral**
com as seções agrupadas por assunto e a situação de cada uma; no computador há
um menu lateral fixo com os mesmos grupos e, no celular, um seletor. A seção
aberta fica no endereço (`&secao=<chave>`), então dá para recarregar, voltar e
compartilhar o link. A busca do topo procura por nome, descrição e
palavras-chave das seções (sem acento e sem diferenciar maiúsculas).

Cada seção exige uma atribuição; o criador vê todas e, no título, lê se a
seção pode ser delegada e por qual atribuição. O servidor
(`updateOrganization`) confere a mesma permissão campo a campo.

| Grupo | Seção (`secao`) | Permissão | Grava em `organizations/{id}` |
|---|---|---|---|
| Órgão | Identidade e contato (`details`) | `edit_details` | `name`, `description`, `contactInfo` (sigla, e-mail, telefone, endereço, site) |
| Órgão | Páginas e módulos (`modules`) | `manage_modules` | `moduleConfig` (ligado e ordem), tipos de página personalizada |
| Órgão | Métricas das páginas (`metrics`) | `manage_metrics` | `dashboardConfig` |
| Pessoas e acesso | Membros e convite (`members`) | só o criador | (memberships) |
| Pessoas e acesso | Atribuições especiais (`permissions`) | só o criador | (memberships) |
| Módulos de trabalho | Consultas (`matters`) | `manage_matters` | `matterSettings`, `thirdPartiesSettingsConsultas`, `thirdPartyPhaseEnabledConsultas` |
| Módulos de trabalho | Expedientes (`expedientes`) | `configure_expedientes` | `expedienteSettings`, `thirdPartiesSettingsExpedientes` |
| Módulos de trabalho | Parcerias (`parcerias`) | `configure_parcerias` | `parceriaSettings`, `thirdPartiesSettingsParcerias` |
| Módulos de trabalho | Jurimetria (`jurimetria`) | `configure_jurimetria` | `jurimetriaSettings` |
| Módulos de trabalho | Panorama (`panorama`) | `configure_panorama` | coleção `panoramaBases` |
| Módulos de trabalho | Processo Eletrônico (`secretaria`) | `configure_secretaria` | ver [PROCESSO_ELETRONICO.md](PROCESSO_ELETRONICO.md) |
| Regras e automação | Indicador de tempo (`stagetime`) | `configure_automation` | `stageTimeConfig` |
| Regras e automação | Metas, alertas e relatórios (`automation`) | `configure_automation` | `goalsConfig`, `escalationConfig`, `reportsConfig` |
| Dados e segurança | Padronização em bloco (`padronizacao`) | `bulk_standardize` | registros (troca de valores em lote) |
| Dados e segurança | Auditoria, retenção e integrações (`security`) | só o criador | `retentionConfig`, `webhookConfig`; consulta do log de acesso |
| Dados e segurança | Manutenção e zona de perigo (`danger`) | só o criador | logs retroativos, apagar dados, excluir órgão |

- **Seções que dependem de flag global** (Páginas e módulos, Jurimetria,
  Panorama, Indicador de tempo, Metas/alertas/relatórios, Auditoria/retenção/
  integrações) somem quando a flag está desligada na plataforma.
- **Página desligada no órgão:** a seção do módulo continua no painel, marcada
  como "desligada", com atalho para Páginas e módulos. Consultas, Expedientes
  e Parcerias seguem configuráveis; Jurimetria e Panorama só mostram o aviso.
- **Ordem das páginas:** em Páginas e módulos, as setas definem a ordem dos
  módulos na navegação (`moduleConfig.<módulo>.order`, lida por
  `getModuleOrder`/`getOrganizationTabs`). Informações Gerais vem sempre
  primeiro; páginas personalizadas, Processo Eletrônico e Painel
  Administrativo, sempre depois. Vale só com a flag `custom_entities` ligada.
- **Identidade e contato:** o servidor apara e limita os textos, recusa nome
  vazio e descarta e-mail ou site inválidos (site precisa começar com
  `http://` ou `https://`). O que for preenchido aparece em Informações Gerais.
- **Membros e convite:** código de convite com botão de copiar, busca por nome
  ou e-mail, filtro Ativos / Ex-membros / Todos, função escolhida numa lista
  fixa (Secretaria, Assessoria, Decisória ou sem função; os painéis usam a
  função para saber quem é assessor) e remoção com confirmação. Remover não
  apaga o histórico: a pessoa vira ex-membro.
- **Atribuições especiais:** as 12 atribuições são agrupadas por área (Órgão,
  Módulos de trabalho, Regras e automação, Dados), com "marcar a área toda" e
  "todas". A tabela mostra, por pessoa, quantas ela tem em cada área.
- O papel `admin` existe no servidor (ver seção 2), mas o painel não oferece
  trocar o papel de um membro; o que distingue os membros na prática são as
  atribuições especiais.
- A antiga aba "Inteligência Artificial" foi retirada: ela só gravava
  `summarySettings`, que nenhuma parte do sistema lê. O campo continua aceito
  pelo servidor e os dados gravados não foram tocados.

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
órgãos internos da entidade (estrutura em árvore com organograma, competências, titular, unidades por órgão, assistente com estruturas de exemplo, remessa entre órgãos e tipos de processo por órgão),
página Meus Processos Eletrônicos (planilha dos processos em que a pessoa é parte ou representante, com o que fazer agora e cores para prazo vencido, aberto e por abrir),
comunicações às partes (intimação, notificação, citação, ciência e comunicação expedidas pela secretaria; aviso ao entrar com botão de ciência; prazo aberto na ciência; ciência por decurso configurável; registro de comunicação feita por outro meio),
urgência do processo (com motivo, na autuação, depois ou por padrão do tipo; selo, urgentes primeiro nas listas, filtro e pedido de urgência pela parte),
tabela de eventos numerados do processo (atos de usuários e registros do sistema, com filtros e busca), termo de uma folha para cada ato de usuário, leitura dos autos evento a evento e PDF integral ou parcial (apenas os marcados, todos exceto os marcados, intervalo de folhas),
tipos de processo (rito, sigilo, unidade sugerida e formulário próprio do "Novo processo", com campos padrão e campos do órgão gravados nos dados do processo), ritos com ramificações,
fase final e orientação por fase, editor visual com diagrama ao vivo, modelos
prontos, importação e exportação por planilha (.xlsx/.csv) e diagrama Mermaid,
e mudança de fase guiada pelo fluxo (fora do fluxo exige motivo). Importação
de ritos (etapa 3): planilha (todas as abas), Word, PDF, Bizagi (.bpm, todas as
páginas), BPMN, XPDL, draw.io ou Mermaid viram proposta completa (fases,
unidades, quem faz, ações, modelos, alternativas com condição; subprocessos
abertos em etapas, ramos paralelos em sequência e diagramas de páginas
separadas unidos onde um termina e o outro começa), revisada e implantada de
uma vez pelo admin. O fluxo de todo rito é desenhado na notação do Bizagi
(raias, início, tarefas, desvios, fim), inteiro na tela, com zoom e tela
cheia. Fase 5:
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
ou TXT (com cabeçalho, rodapé e imagens) ou guardados no arquivo original.
Portal das partes completo (nov/2026): entrada por link no e-mail, "Para
você" com prazos e novidades, processo completo em PDF, impressão, certidão
de andamento, leitor contínuo dos documentos, manifestação guiada com
comprovante e avisos por e-mail configuráveis. Equipe e decisor (nov/2026):
cartão "Nesta fase" com botão único, Novo documento unificado, pedido de
assinatura, aba Meu trabalho, Mesa de decisão com decisão por despacho,
devolução com orientação e e-mail de processo recebido. Avisos, celular e
acessibilidade (nov/2026): avisos da equipe no sino da plataforma com
preferência por pessoa (sino; e-mail a cada evento, resumo diário ou nenhum),
barra fixa e foto de documento no celular, contraste e "Tentar de novo",
seção na Central de Ajuda. Admin e escala (nov/2026): primeiros passos com
indicador, prévia "ver como a equipe e a parte", pendências, rascunho e
resumo na importação de ritos, versões de ritos e modelos com restaurar,
duplicar modelo, repetir recessos, histórico de configuração, lista paginada
no servidor e contadores por unidade. Parte e membro, dois papéis (nov/2026):
quem é parte num processo não o alcança como equipe (impedimento no servidor,
sem avisos da equipe), "Processos em que sou parte" no menu, portal separado
por órgão, representante da parte (advogado, procurador) com conta própria
que assina pela parte. Ver
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
