# Módulo de Expedientes Administrativos

**Coleção:** `expedientes/{expedienteId}` (com subcoleções `history/` e `comments/`)
**Abas do órgão:** *Painel de Expedientes* (`tab=kanban-expedientes`) e *Expedientes* (`tab=expedientes`)
**Chave do módulo:** `moduleConfig.expedientes`

---

## 1. O que é

Controle dos expedientes administrativos da unidade (demandas que chegam por
SIM, SGP, SPU, e-mail etc., vindas da Subprocuradoria, do Gabinete do PGJ ou
de outras origens). Funciona como as [Consultas](./CONSULTAS.md), com banco,
formulários, Kanban e métricas próprios.

---

## 2. Fases

Mesma regra das Consultas: a fase é derivada das datas preenchidas
(`calculateExpedienteDerivedStatus` em `src/utils/expedienteUtils.js`; no
servidor, as funções de Expedientes reutilizam `calculateStatus` de
`functions-v2/src/shared/status.ts`).

| Ordem | Fase | Marcador |
|---|---|---|
| 1 | **Pendente** | fallback |
| 2 | **Em elaboração** | `analysis_start_date` |
| 3 | **Aguarda retorno de terceiros** *(opcional)* | `third_party_referral_date` |
| 4 | **Em revisão** | `review_submission_date` |
| 5 | **Revisadas** | `reviewed_date` |
| 6 | **Na pasta** | `archived_date` |

As transições do *Painel de Expedientes* seguem as mesmas exigências das
Consultas (assessor ao distribuir, pasta na rede ao enviar para revisão,
observações opcionais), em `ExpedienteKanbanTransitionDialog.jsx`.

---

## 3. Campos principais

| Campo | Rótulo |
|---|---|
| `expediente_number` | Número do expediente |
| `system` | Sistema (lista do órgão) |
| `origin` | Origem (lista do órgão) |
| `entry_date` | Data de entrada |
| `object` | Objeto / assunto |
| `urgency_request` | Pedido de urgência |
| `responsible_user_id` / `responsible_user_name` | Assessor responsável |
| `distribution_date`, `analysis_start_date`, `third_party_referral_date`, `third_party_recipient`, `review_submission_date`, `reviewed_date`, `review_return_date`, `archived_date` | Datas e destinatário das etapas |
| `network_folder`, `observations` | Pasta na rede, observações |

Aliases de nomes de coluna em `EXPEDIENTE_FIELD_ALIASES`
(`src/utils/expedienteUtils.js`).

---

## 4. Importação

*Expedientes → Importar* (Cloud Function `importExpedientesFromExcel`) reconhece
cabeçalhos como **EXPEDIENTE/NÚMERO**, **SISTEMA**, **ORIGEM**,
**OBJETO/ASSUNTO**, **DATA DE ENTRADA**, **DISTRIBUIÇÃO**,
**REMESSA P/ REVISÃO**, **DEVOLUÇÃO APÓS REVISÃO**, **ARQUIVAMENTO** e
**PASTA NA REDE**. Faz upsert por número do expediente + data de entrada e
ignora linhas vazias.

---

## 5. Configuração

*Painel Administrativo → Expedientes* (permissão `configure_expedientes`):

- **Sistemas** (`expedienteSettings.systems`) — padrão: SIM, SGP, SPU, E-mail.
- **Origens** (`expedienteSettings.origins`) — padrão: SUBINST, SUBADM,
  Gabinete PGJ, SUBGES, Outros.
- **Terceiros** (`thirdPartiesSettingsExpedientes`) — padrão: Perícia,
  Delegacia de Polícia, Outro Órgão Público, Terceiro.

---

## 6. Permissões

| Ação | Quem pode |
|---|---|
| Ver | Qualquer membro do órgão |
| Criar, editar, importar | Qualquer membro do órgão (`createExpediente`, `updateExpediente`, `importExpedientesFromExcel`) |
| Excluir | Quem tem `delete_records` — `deleteExpediente` |

---

## 7. Mapa dos arquivos

| Camada | Arquivos |
|---|---|
| Página | `src/components/organization/ExpedienteControl.jsx`, `ExpedienteTable.jsx`, `ExpedienteKanbanBoard.jsx`, `ExpedienteKanbanCard.jsx`, `ExpedienteKanbanTransitionDialog.jsx` |
| Formulários | `CreateExpedienteDialog.jsx`, `EditExpedienteDialog.jsx`, `ExpedienteDetailSheet.jsx` |
| Configuração | `src/components/organization/admin/ExpedienteConfiguration.jsx` |
| Cloud Functions | `functions-v2/src/expedientes/*`, `functions-v2/src/import/fromExcelExpedientes.ts` |
