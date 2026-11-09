# Histórico de mudanças

Principais entregas do SIGO, da mais recente para a mais antiga. O detalhe de
cada mudança está nas mensagens de commit (`git log`).

---

### 09/11/2026 — Documentação, segurança e usabilidade
- **Documentação reorganizada** em português: visão geral, um guia por módulo,
  glossário, histórico e guias antigos movidos para `docs/historico/`.
- **Regras do Firestore endurecidas:** perfis (`users`) legíveis só pelo
  próprio usuário (antes qualquer conta autenticada, inclusive partes do
  Portal, lia e-mails); Consultas, Expedientes e Parcerias sem escrita direta
  do cliente (só pelas Functions, que validam e registram histórico);
  `auditLogs` só para criador e admins. Teste automático `npm run test:rules`
  no CI.
- **Cabeçalhos HTTP:** `Strict-Transport-Security` e `Permissions-Policy`.
- **Dependências:** `npm audit fix` zerou as vulnerabilidades críticas; resta
  o `xlsx` sem correção no npm (ver [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md)).
- Removidos o backfill de matérias pelo navegador (`window.runBackfill`) e os
  auxiliares de escrita direta não usados de `firestoreService.js`.
- **Celular:** painel inicial, listas, Kanban (colunas com largura mínima e
  rolagem própria) e perfil sem rolagem lateral.
- **Acessibilidade:** rótulos ligados aos campos de filtro, cartões do Kanban
  abríveis pelo teclado, números copiáveis como botões, menu lateral fecha com
  Esc, tooltips dos selos de urgência voltaram a funcionar.
- Papéis exibidos em português (Criador, Administrador, Membro) no perfil, na
  página do órgão e na gestão de membros.

### 08/11/2026 — Secretaria Processual (fases 1 a 6)
- Processo eletrônico do órgão com ritos e tipos de processo configuráveis,
  conclusão, pendências e prazos, portal das partes, editor completo de
  documentos, folhas dos autos, busca, painel, calendário, conferência de
  autenticidade e exportação Word/Excel/PDF. Ver [SECRETARIA.md](./SECRETARIA.md).

### 23/09/2026 — Panorama, calendário configurável e ajustes de fluxo
- **Módulo Panorama** (flag `panorama_enabled`, padrão desligado): bases
  analíticas cujo esquema vem da planilha importada, com papéis semânticos,
  painel, relatórios, relatórios dinâmicos, prescrição e regiões. Permissão
  `configure_panorama`. Ver [PANORAMA.md](./PANORAMA.md).
- **Calendário de Vencimentos** passa a ser ligado/desligado por órgão em
  *Páginas e Módulos* (ausente = ligado).
- **Observações opcionais** ao enviar para revisão em Consultas, Expedientes e
  Parcerias (a pasta na rede continua obrigatória).
- **Arquivados ordenados pela data de arquivamento**, sem prioridade de
  urgência (`src/lib/archivedSort.js`).
- Servidor grava `moduleConfig` módulo a módulo.
- Correção: páginas desligadas não aparecem mais por um instante na barra
  lateral.

### 16–17/09/2026 — Módulo Jurimetria
- Base de júris do órgão incorporada do aplicativo do CAOJúri (flag
  `jurimetria_enabled`, padrão desligado): importação idempotente, cadastro,
  edição em massa, realização da sessão, duração e expediente, cores por
  espécie, relatórios estáticos e dinâmicos, exportação em seis formatos.
  Permissão `configure_jurimetria`. Ver [JURIMETRIA.md](./JURIMETRIA.md).

### 11/09/2026 — Parcerias
- O seletor de status do modal salva de verdade, avisa o que falta e alimenta
  a linha do tempo.

### 12–19/08/2026 — Parcerias: aditivos e avisos
- Aditivos como procedimentos paralelos, por escopo (prorrogação/objeto),
  DEMP próprio da original e de cada aditivo, "Sem número", vigência a contar
  da assinatura ou do DEMP, termo final automático.
- Avisos automáticos de renovação e revisão com a função agendada
  `checkPartnershipNoticeDeadlines`.
- **Integração permanente das funcionalidades**: as flags em uso passam a ser
  integradas (ligadas por padrão), com `false` explícito como válvula de
  emergência; ficam opcionais apenas as listadas em `OPTIONAL_FLAG_KEYS`.

### 11/08/2026 — Rebranding para SIGO
- "Consultas CAO" passa a se chamar **SIGO**; aplicação publicada em
  `sigo-caocipp.web.app`, com `consultascao.web.app` redirecionando (301).
- Logotipo oficial.

---

## Versões anteriores

O registro abaixo vem do antigo README (até a v1.16.0).

### 04/08/2026 - Módulo Parcerias (v1.16.0)
- **Novo módulo Parcerias** (Convênio, Termo de Cooperação, Termo de Fomento) com 6 fases próprias: Pendentes, Em Análise, Revisão, Aguarda Terceiros, Parcerias, Extintos.
- **Painel Kanban + Lista de Parcerias**, com drag-and-drop e todas as obrigatoriedades por fase validadas no servidor.
- **Aditivos**: cada Parceria pode ter N aditivos (renovação/prorrogação ou qualitativo) sem limite. Ao incluir um aditivo, a Parceria original é congelada (campos read-only) e o aditivo segue o fluxo. Toggle "Original / Aditivo #N" no DetailSheet.
- **Importação por planilha** (Excel/CSV/JSON): colunas PGEA, TIPO DE PARCERIA, NÚMERO, DATA DA ASSINATURA, VIGÊNCIA, TERMO FINAL, ASSUNTO, OBJETO, PARTES, ASSESSOR RESPONSÁVEL. UPSERT por PGEA + data de assinatura.
- **Lista de terceiros dedicada** (`thirdPartiesSettingsParcerias`) editável em Painel Administrativo → Parcerias.
- **Permissão `configure_parcerias`** delegável pelo Criador, em paralelo a `configure_expedientes`.
- **Flag `parcerias_enabled`** (default OFF) — liga/desliga o módulo em todos os órgãos via Administração & Custos.
- **Convive com `custom_entities`**: o admin pode ligar/desligar Parcerias por órgão via Páginas e Módulos (`moduleConfig.parcerias.enabled`).
- **Métricas default** no GeneralInfo (Total, Ativas, Extintas, Com aditivo) — editáveis como todas as outras.
- **Webhooks** `parceria_created` e `parceria_extinguished` (com `outbound_webhooks`).

### 05/06/2026 - Métricas Configuráveis por Página (v1.15.0)
- **Painel de Métricas (no-code)**: Nova aba **Métricas** no Painel Administrativo permite ao admin criar, editar, reordenar, redimensionar e excluir indicadores (KPIs) para **cada página habilitada** — Consultas, Expedientes ou páginas personalizadas — usando as **colunas e fases** de cada uma.
- **Informações Gerais dinâmico**: As métricas exibidas em *Informações Gerais* passam a respeitar as páginas habilitadas. Ao **desligar Consultas ou Expedientes**, suas métricas também somem; **páginas criadas pelo admin** exibem suas métricas automaticamente, conforme as definições do admin.
- **Motor de cálculo flexível**: Contagem, soma, média, mínimo, máximo e percentual, com filtros por coluna/fase (E lógico), além de ícone, cor e tamanho (redimensionável) por card.
- **Persistência por organização**: Tudo é salvo em `organization.dashboardConfig`, saneado no servidor pela Cloud Function `updateOrganization`. Com a flag *Páginas e processos personalizados* **desligada**, o comportamento permanece **idêntico ao atual** (zero quebra).

### 11/03/2026 - Módulo de Expedientes Administrativos (v1.14.0)
- **Novo Controle de Expedientes**: Criação de fluxos independentes de Consultas, com tela de visualização, formulários e banco de dados próprios.
- **Dois Kanbans**: A visualização em Kanban agora engloba um painel para as Consultas e um painel apartado para os Expedientes.
- **Métricas Duplas**: Integração de KPIs analíticos dedicados aos Expedientes dentro do `GeneralInfo` e do `IntelligentSummary`.
- **Importação Anti-lixo**: Nova verificação nas Cloud Functions de importação do Excel para ignorar linhas integralmente vazias nas planilhas.

### 20/02/2026 - Refinamento de Rótulos (v1.13.1)
- **Nomenclatura Formal**: Ajuste dos nomes das guias no sidebar global para nomes descritivos completos: "Informações Gerais", "Painel de Controle", "Resumos Inteligentes" e "Painel Administrativo".

### 20/02/2026 - Navegação Unificada & UI/UX Pro Max (v1.13.0)
- **Sidebar Global Contextual**: Migração da navegação interna dos órgãos para o sidebar principal da plataforma. Sub-itens (Info, Kanban, Consultas, IA, Admin) agora aparecem de forma subordinada ao órgão ativo.
- **Sincronização via URL**: Estado da página (tabs) agora é totalmente controlado por `searchParams` (`?tab=...`), permitindo compartilhamento de links e persistência ao recarregar.
- **Layouts Aderentes (Sticky)**: Cabeçalhos de tabela e barras de paginação fixados no topo/base da tela para navegação sem perda de contexto em listas longas.
- **Feedback Visual de Validação**: Implementação de sinais de validação inline (ícones de check verde) em formulários de edição para campos obrigatórios preenchidos.
- **Humanização de Estados Vazios**: Substituição de telas em branco por ilustrações e mensagens contextuais para buscas sem resultado e colunas de Kanban vazias.

### 13/02/2026 - Solução Definitiva de Temporalidade (v1.11.6)
- **Coorte Unificada**: O quadro de Temporalidade agora utiliza uma amostra sincronizada de processos (Entry, Dist, Sub, Return), garantindo que a hierarquia logica (Total >= Etapas) seja mantida em 100% dos casos.
- **Capitalização Rigorosa**: Padronização de "Devolução após Revisão" (Capital R) em toda a interface e lógica de sistema.

### 13/02/2026 - Hierarquia e Padronização de Termos (v1.11.2)
- **Sincronização de Métricas**: As médias agora são calculadas exclusivamente sobre o conjunto de processos finalizados (com Devolução), garantindo que o **Tempo Total** seja logicamente superior ou igual às fases parciais (Análise e Revisão).
- **Padronização Global**: Termino "Devolução após Revisão" (Capital R) aplicado de forma rigorosa em toda a interface, timeline e motor de importação.
- **Precisão Operacional**: Descritivos ajustados para refletir exatamente os marcos solicitados na imagem de auditoria do fluxo.

### 13/02/2026 - Correção de Lógica Temporal (v1.11.1)
- **Ajuste de Marcos Temporais**: A métrica de análise agora é calculada corretamente a partir da **Distribuição** até a **Remessa**.
- **Descritivos Exatos**: Atualização dos subtextos das métricas para as definições operacionais precisas solicitadas (Entrada->Devolução, Distribuição->Remessa, Remessa->Devolução).

### 13/02/2026 - Precisão Temporal (Dias Úteis) (v1.11.0)
- **Cálculo de Dias Úteis**: As médias de temporalidade agora consideram apenas dias úteis (segunda a sexta), proporcionando uma visão mais realista do desempenho.
- **Arredondamento Conservador**: Todas as médias são agora arredondadas para cima (Math.ceil), garantindo que tempos parciais sejam contabilizados como dias inteiros de trabalho.
- **Identificação Visual**: Título do quadro atualizado para "Temporalidade das Consultas (dias úteis)".

### 13/02/2026 - Métricas de Temporalidade & Terminology Fix (v1.10.0)
- **Quadro de Temporalidade**: Novo componente modular na aba de Resumos Inteligentes exibindo médias de:
    - Tempo total (Entrada → Devolução)
    - Tempo de Análise (Início → Remessa)
    - Tempo de Revisão (Remessa → Devolução)
- **Padronização de Termos**: Substituição global de "Retorno da Revisão" por **"Devolução após revisão"** para alinhamento com os fluxos originais de trabalho.
- **Importação Robusta**: Mapeador de Excel atualizado para detectar automaticamente variações do novo termo ("DEVOLUÇÃO APÓS REVISÃO", "RETORNO DA REVISÃO", etc).

### 12/02/2026 - Persistência, Real-time & UI Premium (v1.8.9)
- **Correção de Persistência**: Alinhamento definitivo de campos (snake_case/camelCase) entre Frontend e Cloud Functions.
- **Real-time Synchronization**: Listagem de processos agora utiliza `onSnapshot` para atualizações instantâneas.
- **UI Hover Consistente**: Refinamento visual com `group-hover` estático para garantir destaque uniforme em colunas fixas.
- **Service Layer Robustness**: Padronização dos serviços de Deletar e Arquivar com contexto organizacional.

### 12/02/2026 - Dashboard User-Centric & Multi-Filter (v1.5.0)
- **Dashboard v2**: Interface per-organ automatizada, exibindo apenas o que é relevante para sua função atual.
- **Lógica de Roles**: Assessoria, Secretaria e Decisória agora possuem KPIs e feeds de atividade distintos.
- **Filtro Avançado**: Implementado seletor de Ano e Mês nos Resumos Inteligentes para análise histórica precisa.
- **Filtro de Ano por Órgão**: Controle temporal individualizado para cada card do Dashboard.
- **Rebranding Final**: Nome oficial consolidado em todo o ecossistema como **SIGO** (Sistema Interno de Gestão Operacional).

### 12/02/2026 - UX Pro Max & Zero Problems (v1.4.0)
- **Zero Problems (IDE)**: Otimização total do ambiente de desenvolvimento (jsconfig.json) para eliminar falsos-positivos de tipos.
- **Filtros Dinâmicos**: O filtro de "Responsável" agora é extraído automaticamente dos dados da planilha.
- **UX Improvements**: Implementação de Loading Skeletons modernos e estados vazios interativos.
- **Limpeza de Build**: Resolução de 100% dos avisos de ESLint e erros de parsing.

### 12/02/2026 - Persistência Definitiva & Novo Domínio (v1.3.0)
- **Novo URL**: Aplicação migrada para [consultascao.web.app](https://consultascao.web.app) (atualmente redirecionando para [sigo-caocipp.web.app](https://sigo-caocipp.web.app) — ver rebranding 11/08/2026)
- **Persistência Bulletproof**: Itens por página e ordenação agora usam localStorage como cache instantâneo + Firestore como backup.
- **Ordenação Type-Aware**: Registro de tipos por coluna com parser universal de datas.

