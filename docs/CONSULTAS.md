# Módulo de Consultas

**Coleção:** `processes/{processId}` (com subcoleções `history/` e `comments/`)
**Abas do órgão:** *Painel de Consultas* (`tab=kanban`) e *Consultas* (`tab=processes`)
**Chave do módulo:** `moduleConfig.processes`

> No código, uma Consulta é chamada de **processo** (`process`). Os dois termos
> se referem à mesma coisa.

---

## 1. O que é

Controle das consultas jurídicas que chegam à unidade: quem consultou, de onde,
sobre o quê, quem está analisando, em que fase está e quanto tempo levou cada
etapa. É o módulo original do SIGO e o modelo seguido por Expedientes e
Parcerias.

---

## 2. Fases e como são calculadas

A fase de uma Consulta **não é escolhida à mão**: é derivada das datas
preenchidas, sempre da mais avançada para a menos avançada
(`calculateStatus` em `functions-v2/src/shared/status.ts`, espelhada em
`src/utils/processUtils.js`).

| Ordem | Fase | Marcador (campo preenchido) |
|---|---|---|
| 1 | **Pendente** | nenhum dos abaixo (fallback) |
| 2 | **Em elaboração** | `analysis_start_date` (Início da Análise) |
| 3 | **Aguarda retorno de terceiros** *(opcional)* | `third_party_referral_date` (Remessa a Terceiros) |
| 4 | **Em revisão** | `review_submission_date` (Remessa p/ Revisão) |
| 5 | **Revisadas** | `reviewed_date` (Revisão Concluída) |
| 6 | **Na pasta** | `archived_date` (Arquivamento) |

A fase "Aguarda retorno de terceiros" pode ser desligada pelo órgão
(`organization.thirdPartyPhaseEnabledConsultas = false`, em *Painel
Administrativo → Classificação (Matérias)*). Mesmo desligada, um registro que
já tenha a data preenchida continua mostrando a etapa — dado gravado nunca é
escondido.

### Linha do tempo de uma Consulta

Entrada no CAO → Distribuição → Início da Análise → (Remessa a Terceiros) →
Remessa p/ Revisão → Revisão Concluída → Devolução após Revisão → Arquivamento.

---

## 3. Kanban e transições

No *Painel de Consultas*, arrastar um cartão de coluna abre um diálogo que pede
o que a nova fase exige (`KanbanTransitionDialog.jsx`):

| Movimento | O que o diálogo pede |
|---|---|
| Pendente → Em elaboração | Assessor responsável (a distribuição) |
| Em elaboração → Aguarda terceiros | Data da remessa e destinatário (lista de terceiros do órgão) |
| → Em revisão | Pasta na rede (obrigatória); observações opcionais |
| Em revisão → Revisadas | Data de conclusão da revisão |
| Revisadas → Na pasta | Confirmação (data de arquivamento) |

Para avançar, o cartão só pode ir para a coluna seguinte. O movimento para trás
também é aceito e desfaz os marcadores da fase abandonada. Urgentes ficam no topo de cada coluna, exceto em "Na pasta", que é
ordenada pela data de arquivamento, a mais recente primeiro
(`src/lib/archivedSort.js`).

---

## 4. Campos principais

| Campo | Rótulo | Observação |
|---|---|---|
| `process_number` | Número | Identificador da consulta. |
| `consultant` | Consulente | Quem fez a consulta. |
| `location` | Local | Município (lista do RS em `src/utils/cities.js`). |
| `entry_date` | Data de entrada | |
| `matter_object` | Matéria e objeto | Texto livre. |
| `matter_category` / `matter_subcategory` | Matéria geral / específica | Ver [MATTER_CLASSIFICATION.md](./MATTER_CLASSIFICATION.md). |
| `urgency_request` | Pedido de urgência | Prioriza o cartão e entra nas métricas de urgentes. |
| `responsible_user_id` / `responsible_user_name` | Assessor responsável | |
| `distribution_date`, `analysis_start_date`, `third_party_referral_date`, `review_submission_date`, `reviewed_date`, `review_return_date`, `archived_date` | Datas das etapas | Determinam a fase. |
| `network_folder` | Pasta na rede | Caminho dos documentos na rede do MPRS. |
| `access_restriction` | Restrição de acesso | Rótulo de sigilo; ver limite em [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md#3-lgpd-e-proteção-de-dados). |
| `decision`, `observations` | Decisão, Observações | |
| `activity_log` | Histórico | Espelhado em `processes/{id}/history`. |

Os nomes de campo aceitam variações (planilhas antigas, nomes em português)
graças aos aliases de `getProcessField` em `src/utils/processUtils.js` e
`getSmartField` em `functions-v2/src/shared/fields.ts`.

---

## 5. Importação por planilha

*Consultas → Importar* aceita `.xlsx`, `.xls`, `.csv` e `.json`. A Cloud
Function `importProcessesFromExcel` reconhece cabeçalhos como **NÚMERO**,
**CONSULENTE**, **LOCAL**, **DATA ENTRADA**, **MATÉRIA E OBJETO DA CONSULTA**,
**PEDIDO DE URGÊNCIA**, **DISTRIBUIÇÃO**, **REMESSA PARA REVISÃO**,
**DEVOLUÇÃO APÓS REVISÃO** (ou "RETORNO DA REVISÃO"), **RESTRIÇÃO DE ACESSO** e
**PASTA NA REDE**.

A importação faz **upsert**: uma linha com o mesmo número e a mesma data de
entrada atualiza o registro existente; as demais criam registros novos. Linhas
totalmente vazias são ignoradas.

---

## 6. Configuração (Painel Administrativo)

- **Classificação (Matérias)** — permissão `manage_matters`: lista de matérias
  gerais e específicas do órgão (`organization.matterSettings`), lista de
  terceiros (`thirdPartiesSettingsConsultas`) e o liga/desliga da fase de
  terceiros.
- **Padronização em Bloco** — permissão `bulk_standardize`: troca em lote um
  valor de campo por outro (`bulkReplaceFieldValues`), útil para unificar
  grafias de consulentes ou locais.
- **Métricas** — permissão `manage_metrics`: indicadores das Consultas em
  *Informações Gerais*.

---

## 7. Permissões

| Ação | Quem pode |
|---|---|
| Ver | Qualquer membro do órgão |
| Criar, editar, importar | Qualquer membro do órgão (Cloud Functions `createProcess`, `updateProcess`, `importProcessesFromExcel`) |
| Excluir | Quem tem `delete_records` (o criador sempre tem) — `deleteProcess` |

---

## 8. Mapa dos arquivos

| Camada | Arquivos |
|---|---|
| Página | `src/components/organization/ProcessControl.jsx`, `ProcessTable.jsx`, `KanbanBoard.jsx`, `KanbanCard.jsx`, `KanbanTransitionDialog.jsx` |
| Formulários | `CreateProcessDialog.jsx`, `EditProcessDialog.jsx`, `ProcessForm.jsx`, `ProcessDetailSheet.jsx`, `ProcessLogDialog.jsx` |
| Regras no cliente | `src/utils/processUtils.js`, `src/config/processStatus.js` (cores por fase), `src/lib/stageTime.js` |
| Cloud Functions | `functions-v2/src/processes/*`, `functions-v2/src/import/fromExcel.ts` |
| Regras compartilhadas | `functions-v2/src/shared/status.ts`, `fields.ts`, `phaseDates.ts`, `history.ts` |
