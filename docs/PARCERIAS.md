# Módulo de Parcerias

**Coleção:** `parcerias/{parceriaId}`, com subcoleções `aditivos/{aditivoId}` (cada um com `history/`), `history/` e `comments/`
**Abas do órgão:** *Painel de Parcerias* (`tab=kanban-parcerias`) e *Parcerias* (`tab=parcerias`)
**Chave do módulo:** `moduleConfig.parcerias` · **Permissão de configuração:** `configure_parcerias`

---

## 1. O que é

Controle dos instrumentos de parceria firmados pelo MPRS — **Convênio**,
**Termo de Cooperação** e **Termo de Fomento** — desde o pedido (PGEA) até a
formalização, a vigência, os aditivos e a extinção.

A flag `parcerias_enabled` está **integrada** (ligada por padrão). O módulo
aparece em todo órgão que o tiver ligado em *Páginas e Módulos*.

---

## 2. Fases e requisitos

Diferente das Consultas, a autoridade da fase é o campo `status`, gravado nas
transições. `calculateParceriaStatus` (`functions-v2/src/shared/status.ts`)
serve de recálculo defensivo. Ao **entrar** numa fase, o servidor exige os
campos abaixo (`PARCERIA_PHASE_REQUIREMENTS` em
`functions-v2/src/shared/validators.ts`, espelhado em
`src/utils/parceriaPhases.js`). Se faltar algo, a Cloud Function recusa com a
mensagem "Para entrar em "X", preencha: …".

| Fase | Campos exigidos ao entrar |
|---|---|
| **Pendente** | PGEA, assunto, partes |
| **Em análise** | Assessor responsável, data de responsabilidade |
| **Em revisão** | Data de início da revisão (automática), pasta na rede. Observações são opcionais. |
| **Revisadas** | Data de conclusão da revisão |
| **Aguarda Terceiros** *(opcional)* | Data da remessa a terceiros, "remetido para" |
| **Parcerias** (vigente) | Data de retorno de terceiros, tipo, data de assinatura, publicação no DEMP, vigência, objeto, termo final, data do aviso de renovação. O número é opcional ("Sem número"). |
| **Extintos** | Confirmação de extinção |

A fase "Aguarda Terceiros" pode ser desligada pelo órgão
(`parceriaSettings.thirdPartyPhaseEnabled`).

---

## 3. Aditivos

Cada Parceria pode ter quantos aditivos forem necessários
(`parcerias/{id}/aditivos/{addId}`). Um aditivo tem escopo de
**prorrogação** (estende a vigência), de **objeto** (altera o objeto) ou ambos,
e percorre as mesmas fases da Parceria.

- Ao criar o primeiro aditivo, os campos de substância da Parceria original
  (PGEA, assunto, objeto, partes, tipo, número, assinatura, vigência, termo
  final, aviso de renovação) ficam **congelados**. A Cloud Function
  `updateParceria` recusa alterá-los quando `aditivo_count > 0`; a interface
  mostra um cadeado.
- O Kanban mostra a fase do **aditivo corrente** (`current_additive_id`). O
  seletor *Original / Aditivo #N* no painel lateral alterna entre as versões.
- `concludeAditivo` conclui o aditivo e, se for prorrogação, recalcula o termo
  final e a próxima data de aviso.

---

## 4. Avisos automáticos de renovação e revisão

- **Aviso de renovação** (`renewal_notice_date`) = termo final **menos** o
  período de aviso configurado (`renewal_notice_period` + unidade). Calculado
  no formulário e no servidor; editar a data à mão desliga o recálculo até o
  período mudar.
- **Aviso de revisão** (`review_notice_date`) vale para Parcerias de vigência
  indeterminada com período de revisão configurado.

A Cloud Function agendada `checkPartnershipNoticeDeadlines` roda uma vez por
dia às 03:00 (horário de Brasília). Quando uma dessas datas é atingida, cria um
aditivo automático (de prorrogação ou de objeto) em "Pendente", com urgência
ligada. Depende do Cloud Scheduler (ver
[CI-DEPLOY-PERMISSIONS.md](./CI-DEPLOY-PERMISSIONS.md)).

---

## 5. Extinção

`extinguishParceria` marca a Parceria como extinta e propaga para todos os
aditivos, inteiramente no servidor. A interface exige digitar **EXTINGUIR** e o
servidor confere a confirmação. Extinguir é a decisão de **não renovar**; é
diferente do arquivamento das Consultas.

---

## 6. Importação

*Parcerias → Importar* (`importParceriasFromExcel`) reconhece as colunas
**PGEA**, **TIPO DE PARCERIA**, **NÚMERO**, **DATA DA ASSINATURA**,
**VIGÊNCIA**, **TERMO FINAL**, **ASSUNTO**, **OBJETO**, **PARTES** e
**ASSESSOR RESPONSÁVEL**. Linhas com o mesmo PGEA atualizam o registro
existente (preferindo o que tiver a mesma data de assinatura). Um tipo fora de
Convênio / Termo de Cooperação / Termo de Fomento é rejeitado com mensagem.

---

## 7. Configuração

*Painel Administrativo → Parcerias* grava `organization.parceriaSettings`:

| Chave | Conteúdo |
|---|---|
| `tipos` | Tipos de parceria aceitos |
| `aditivoTipos` | Tipos de aditivo |
| `vigenciaOptions` | Sugestões de vigência (6, 12, 24, 36, 60 meses, indeterminado) |
| `categorias` | Etiquetas opcionais (lista vazia esconde o campo) |
| `thirdPartyPhaseEnabled` | Liga/desliga a fase "Aguarda Terceiros" |
| `autoExtinguishOnEnd` | Preferência de extinguir ao fim da vigência |

A lista de terceiros fica em `thirdPartiesSettingsParcerias`.

---

## 8. Permissões e integrações

| Ação | Quem pode |
|---|---|
| Ver | Qualquer membro do órgão |
| Criar, editar, mover de fase, criar aditivo | Qualquer membro do órgão (Cloud Functions validam fase e congelamento) |
| Excluir Parceria ou aditivo | Quem tem `delete_records` |
| Configurar o módulo | Quem tem `configure_parcerias` |

Com webhooks configurados (*Painel Administrativo → Segurança*), o módulo
dispara os eventos `parceria_created` e `parceria_extinguished`.

---

## 9. Mapa dos arquivos

| Camada | Arquivos |
|---|---|
| Página | `src/components/organization/ParceriaControl.jsx`, `ParceriaTable.jsx`, `ParceriaKanbanBoard.jsx`, `ParceriaKanbanCard.jsx`, `ParceriaKanbanTransitionDialog.jsx` |
| Formulários | `CreateParceriaDialog.jsx`, `EditParceriaDialog.jsx`, `ParceriaDetailSheet.jsx`, `CreateAditivoDialog.jsx`, `ConcludeAditivoDialog.jsx`, `ExtinguishConfirmDialog.jsx` |
| Regras no cliente | `src/utils/parceriaPhases.js`, `src/utils/parceriaUtils.js`, `src/lib/dateUtils.js` |
| Cloud Functions | `functions-v2/src/parcerias/*`, `functions-v2/src/import/fromExcelParcerias.ts`, `functions-v2/src/scheduled/checkPartnershipNoticeDeadlines.ts` |
