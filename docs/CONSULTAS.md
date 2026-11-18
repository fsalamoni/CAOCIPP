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
Administrativo → Consultas*). Mesmo desligada, um registro que
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

**Pelo Processo Eletrônico (13/11/2026).** Com a integração ligada, o rito de
um processo pode mandar a consulta de coluna: ao entrar numa fase ou quando
alguém assume o processo, a consulta ligada vai para a situação que o rito
indica, com as mesmas datas que o quadro gravaria e uma entrada no histórico
("Situação "X" pelo processo eletrônico N"). Desde 18/11/2026 o rito também
preenche o que o diálogo pede a mais (pasta na rede, destinatário): a ação
que pede o dado tem "Leva ao painel" e grava o campo na ficha, com entrada no
histórico. O editor do rito mostra os nomes das colunas como no quadro (Em
Análise, Arquivados) e, em "Integração com o painel", o que cada coluna pede e
de onde vem, com as ligações sugeridas pelos nomes. O tipo de processo pode
criar a consulta na autuação ("Criar registro na autuação" → Consultas).
A fase de espera do rito (diligências externas) usa "Aguarda retorno de
terceiros" e, na volta, devolve a consulta à situação da fase de origem.
O mesmo vale para Expedientes. Detalhes em
[PROCESSO_ELETRONICO.md](PROCESSO_ELETRONICO.md), "Andamento automático da
fase". O modelo pronto "Rito Consultas CAOCIPP" (14/11/2026) já vem com
essas regras em cada fase; a consulta precisa estar ligada ao processo (ele
nasce dela, a tem num campo ou o tipo a cria na autuação). Sem consulta
ligada, a capa do processo avisa a equipe.

---

## 4. Campos principais

| Campo | Rótulo | Observação |
|---|---|---|
| `process_number` | Nº da Consulta - PGEA | Identificador da consulta (número do PGEA). |
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

### Conferência do nº do PGEA na criação

No **+ Adicionar Consulta**, o número digitado é conferido no servidor
(`verificarNumeroPgea`, em `functions-v2/src/registros/verificarNumero.ts`)
contra todas as consultas do órgão, arquivadas inclusive, cerca de meio
segundo depois de parar de digitar. A comparação ignora pontos, barras,
espaços e zeros à esquerda (`normalizarNumeroPgea` em
`functions-v2/src/shared/registrosPgea.ts`): `00021.000.125/2024` e
`21000125/2024` são o mesmo número.

- **Número novo:** sinal de certo verde no campo e o aviso "Número novo ... É
  um procedimento novo".
- **Número que já existe:** aviso com cada consulta que tem o número, sua fase,
  quem é (ou era, se arquivada) o responsável e a data de entrada, e o botão
  **Entrar na consulta**, que fecha o cadastro e abre a ficha dela. O cadastro
  não é bloqueado: o botão passa a dizer **Criar mesmo assim**.
- Se a conferência falhar (sem rede), o aviso diz que não foi possível
  conferir e o cadastro segue normal.

Só confere quem é membro ativo do órgão; o servidor devolve apenas número,
fase, responsável e entrada. Cada conferência lê os registros do órgão (só
esses campos); a importação por planilha não passa por ela.

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

- **Consultas** (seção do painel) — permissão `manage_matters`: lista de matérias
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
| Excluir | Quem tem `delete_records` (o criador sempre tem) — `deleteProcess`. Original com aditivos não é excluído (exclua antes os aditivos). |
| Criar aditivo | Qualquer membro ativo do órgão — `criarAditivo` |

---

## 8. Mapa dos arquivos

| Camada | Arquivos |
|---|---|
| Página | `src/components/organization/ProcessControl.jsx`, `ProcessTable.jsx`, `KanbanBoard.jsx`, `KanbanCard.jsx`, `KanbanTransitionDialog.jsx` |
| Formulários | `CreateProcessDialog.jsx`, `EditProcessDialog.jsx`, `ProcessForm.jsx`, `ProcessDetailSheet.jsx`, `ProcessLogDialog.jsx` |
| Regras no cliente | `src/utils/processUtils.js`, `src/config/processStatus.js` (cores por fase), `src/lib/stageTime.js` |
| Cloud Functions | `functions-v2/src/processes/*`, `functions-v2/src/import/fromExcel.ts` |
| Regras compartilhadas | `functions-v2/src/shared/status.ts`, `fields.ts`, `phaseDates.ts`, `history.ts` |
| Nº do PGEA e aditivos | `functions-v2/src/registros/verificarNumero.ts`, `registros/aditivos.ts`, `shared/registrosPgea.ts`; no cliente `src/lib/registrosPgea.js`, `VerificacaoNumeroPgea.jsx`, `NovoAditivoDialog.jsx`, `ProcedimentosVinculados.jsx`, `SeloVinculo.jsx` |

---

## 9. Aditivos

Um aditivo é uma nova tramitação de uma consulta já cadastrada (fato novo,
reiteração, complementação), sem mexer no que já foi feito. Vale igual para
[Expedientes](./EXPEDIENTES.md).

**Como se cria.** Na ficha da consulta (qualquer fase, inclusive "Na pasta"),
seção *Original e aditivos* → **Criar aditivo**; ou no **+ Adicionar
Consulta**, quando o número digitado já existe, pelo botão **Criar aditivo**
do aviso. Pede o motivo (obrigatório), a data de entrada (hoje, por padrão),
o assessor (opcional; se escolhido, a distribuição fica com a data de
entrada) e a urgência. Cloud Function `criarAditivo`
(`functions-v2/src/registros/aditivos.ts`).

**O que o aditivo é.** Um documento novo em `processes/`, com:
- o mesmo `process_number` do original e os dados de identificação copiados
  (consulente, local, matérias, objeto, restrição de acesso);
- a tramitação em branco: entra em **Pendente** e percorre todas as fases,
  com datas, pasta na rede, observações e histórico próprios;
- `aditivo_de` (id do original), `aditivo_numero` (1, 2, ...) e
  `aditivo_motivo`.

Aditivo criado a partir de outro aditivo vira o próximo aditivo do original
(não há aditivo de aditivo). Pode haver quantos forem necessários.

**O que acontece com o original.** Nada na fase, nas datas, no responsável ou
na ordem da lista (`updated_at` não muda): se estava arquivado, segue
arquivado; se estava em andamento, os dois tramitam em paralelo, cada um no
seu card. Ele só ganha `aditivos_seq` (numeração, nunca diminui),
`aditivos_count` (quantos existem) e uma entrada no histórico ("Aditivo nº N
criado").

**Como cada um se mostra.**
- Cards do quadro e tabela: selo **Aditivo N** ou **Original · N aditivos**
  (registro sem aditivos não tem selo). Na exportação, o número sai como
  `00021.000.125/2024 (Aditivo 1)`.
- Ficha: o selo no título; no aditivo, o aviso "Aditivo nº N ..., com
  tramitação própria" e a *Linha do tempo do aditivo N*; a seção *Original e
  aditivos* lista todos, ao vivo, com fase, responsável, entrada e motivo,
  marca "você está aqui" e abre qualquer um deles.
- Edição: no aditivo o nº do PGEA fica travado (acompanha o original). Mudar
  o número do original muda também o dos aditivos, com entrada no histórico
  de cada um.
- Processo Eletrônico: ao ligar um processo a um aditivo, o registro aparece
  como `número (Aditivo N)`.

**Regras no servidor.** `updateProcess` ignora `aditivo_de`,
`aditivo_numero`, `aditivo_motivo`, `aditivos_seq` e `aditivos_count` vindos
do cliente e, num aditivo, o `process_number`. `deleteProcess` recusa o
original que ainda tem aditivos e, ao excluir um aditivo, desconta
`aditivos_count` do original. As métricas contam cada aditivo como uma
consulta (cada tramitação conta). A importação por planilha não cria nem
reconhece aditivos.

Testes: `functions-v2/test/registrosPgea.test.js`; e2e
`scripts/e2e-aditivos.mjs` e `scripts/e2e-aditivos-tela.mjs`.
