# ⚖️ Módulo de Jurimetria

**Flag:** `jurimetria_enabled` (opcional, **default OFF**)
**Coleção:** `juris/{juriId}`
**Origem:** incorporação do aplicativo "Jurimetria CAOJúri" (MP/RS) à plataforma SIGO

---

## 1. O que é

Base própria de **júris** por órgão, com importação de planilha, cadastro manual,
relatórios estáticos, tabela dinâmica multi-nível, relatório descritivo e
exportação em seis formatos.

Substitui o aplicativo local do CAOJúri (HTML + localStorage + pasta de rede)
por um módulo da plataforma: os dados passam a viver no **banco do SIGO**, por
órgão, com as mesmas regras de acesso, histórico e permissões dos demais módulos.

### Diferenças em relação ao aplicativo de origem

| Aplicativo CAOJúri | Módulo na plataforma |
|---|---|
| `localStorage` / pasta de rede compartilhada | Firestore, isolado por órgão |
| Lock file + polling de 4s para multi-PC | Tempo real nativo (`onSnapshot`) |
| Sem controle de acesso | Membros do órgão + permissões delegáveis |
| Listas fixas em `listas.json` | Listas configuráveis por órgão |
| Visual próprio | Design e componentes do SIGO |
| Templates em `localStorage` | Modelos em `localStorage` (mantido: é preferência de quem usa) |

---

## 2. Ativação (duas chaves)

O módulo só aparece quando **as duas** condições são verdadeiras:

1. **Plataforma** — o super-admin liga `jurimetria_enabled` em
   *Administração & Custos → Funcionalidades*.
2. **Órgão** — o administrador liga **Jurimetria** em
   *Painel Administrativo → Páginas e Módulos* (exige a flag `custom_entities`,
   que é o que habilita essa tela).

Essa é a mesma **defesa em profundidade** do módulo de Parcerias: com a flag
global desligada, `getOrganizationTabs`, `getActiveDataPages` e
`AdminManagement` escondem tudo, mesmo que `moduleConfig.jurimetria.enabled`
esteja `true` no órgão.

> Órgãos **sem** `moduleConfig` (os legados) são tratados como "tudo ligado",
> então basta a flag global para o módulo aparecer neles.

---

## 3. Modelo de dados

### `juris/{juriId}`

| Campo | Tipo | Observações |
|---|---|---|
| `organization_id` | string | Órgão dono do registro |
| `numero_processo` | string | Número CNJ, como digitado/importado |
| `numero_processo_norm` | string | Só os dígitos — **chave natural** do órgão |
| `data_juri` | string | `YYYY-MM-DD`. Fica **vazio** quando a sessão é cancelada |
| `realizacao` | string | `realizado` \| `redesignado` \| `cancelado`. Ausente = `realizado` |
| `realizacao_justificativa` | string | Motivo da redesignação/cancelamento (até 1000 caracteres) |
| `date_history` | array | Histórico de datas — ver seção 5 |
| `comarca` | string | Lista oficial do órgão |
| `tipo` | string | **Sigla** da matéria (CM, CP, D, F, FC, PP, T…) |
| `resultado` | string | Espécie de resultado (lista oficial do órgão) |
| `promotor` | string | Texto livre |
| `horario_inicio` | string | Início da sessão, normalizado para `HHhMM` |
| `horario` | string | **Conclusão** da sessão, `HHhMM`. Sempre foi isso — ver seção 6 |
| `vara` | string | Vara / órgão julgador |
| `observacoes` | string | Até 2000 caracteres |
| `values` | map | Valores das **colunas do órgão** |
| `responsible_user_id` / `_name` | string | Membro do órgão atribuído |
| `source` | string | `manual` \| `import` |
| `imported_from` | string | Nome do arquivo de origem |
| `activity_log` | array | Histórico (espelhado em `juris/{id}/history`) |

**Unicidade:** `numero_processo_norm` é único por órgão. É o que torna a
importação idempotente e impede o cadastro duplicado.

### `organization.jurimetriaSettings`

```js
{
  comarcas: string[],            // default: 167 comarcas do RS
  tipos: [{ sigla, descricao }], // default: 7 matérias do CAOJúri
  resultados: string[],          // default: 9 espécies canônicas
  pontuacao: { [especie]: 0..1 },
  dissolucaoResultados: string[],// espécies tratadas como dissolução
  customFields: [{ key, label, type, options, required }],
  labelOverrides: { [campo]: 'novo rótulo' },
  hiddenFields: string[],
  importPolicy: 'preserve' | 'update',
  fuzzyThreshold: 0.4..1,        // rigor da correção automática
  requireResponsible: boolean,
}
```

Sanitizado por `sanitizeJurimetriaSettings` (servidor) e resolvido com defaults
por `resolveJurimetriaSettings` (cliente e servidor). Um órgão que nunca
configurou nada funciona com as listas padrão do CAOJúri.

---

## 4. Regra de negócio central — dissoluções

Um júri **dissolvido** é uma sessão desfeita sem julgamento de mérito. Ele:

- **conta** no total de júris do período;
- **não conta** nas espécies de resultado, nas matérias nem no aproveitamento.

O "aproveitamento" de qualquer recorte é:

```
aproveitamento = Σ peso[resultado] / nº de júris EFETIVOS
```

onde *efetivos* = total − dissolvidos, e os pesos vêm da tabela de pontuação do
órgão. Quando não há efetivos, o aproveitamento é `null` (exibido como "—"),
que é diferente de 0%.

Quais espécies contam como dissolução é **configurável** por órgão
(`dissolucaoResultados`); marcar uma espécie como dissolução fixa seu peso em 0.

---

## 5. Realização da sessão (`realizacao`)

A dissolução responde *"o julgamento deu em quê?"*. A **realização** responde a
pergunta anterior: *"a sessão aconteceu?"*. São dois planos independentes, e
confundi-los distorce todo indicador.

| Valor | Significado | Data do júri |
|---|---|---|
| `realizado` (padrão) | A sessão ocorreu e produziu um resultado | obrigatória |
| `redesignado` | Não ocorreu na data prevista; foi remarcada | a **nova** data |
| `cancelado` | Foi cancelada e não tem nova data | fica **vazia** |

**Compatibilidade:** um júri gravado antes deste campo não tem `realizacao`, e
é lido como `realizado` em todo lugar (`getRealizacao`). Nenhum número muda
por causa da migração, e nenhuma migração de dados é necessária.

### Regra de transição

Toda a lógica vive numa função só — `resolveRealizacaoChange`
(`functions-v2/src/shared/jurimetria.ts`) — usada pelo cadastro, pela edição e
pela importação, para que os três caminhos não divirjam:

- entrar em `redesignado` exige uma **nova data**, diferente da anterior, e uma
  **justificativa**;
- entrar em `cancelado` esvazia a data e exige uma **justificativa**;
- voltar para `realizado` exige uma data e limpa a justificativa;
- **toda** alteração de data — por qualquer caminho, inclusive correção simples
  e atualização em massa — gera uma entrada em `date_history` e uma linha no
  `activity_log`/`history` do júri.

### `date_history[]`

```js
{
  from: '2026-03-10',        // data anterior ('' quando não havia)
  to: '2026-04-15',          // nova data ('' quando cancelado)
  realizacao: 'redesignado', // desfecho que motivou a mudança
  justificativa: 'Réu não intimado',
  user_id: 'uid', user_name: 'Promotor X',
  changed_at: '2026-03-01T12:00:00.000Z',
}
```

Aparece para o usuário na ficha do júri e dentro do modal de edição — quem está
prestes a redesignar vê quantas vezes aquele processo já foi adiado.

### Efeito nos números

O painel, os relatórios e os relatórios dinâmicos contam, **por padrão, apenas
as sessões realizadas** ("em regra, o que importa são os Júris que contam com
realizado"). Isso é uma *opção de análise*, não um filtro: os júris
redesignados e cancelados continuam visíveis na aba Júris e exportáveis.

Duas opções ficam no botão **Análise**, ao lado dos filtros:

| Opção | Padrão | O que faz |
|---|---|---|
| Somente sessões realizadas | ligada | Exclui redesignados e cancelados dos cálculos |
| Ignorar "(não informado)" | desligada | Remove dos gráficos e tabelas os grupos sem valor |

As duas ficam gravadas por órgão no navegador e a legenda de cada relatório
exportado declara o critério usado.

---

## 6. Horários, duração e expediente

### Os dois horários

O campo `horario` sempre significou o horário em que a sessão **terminou** — é o
que as planilhas do CAOJúri registravam. O rótulo agora diz isso ("Horário de
conclusão") e o início entra como campo próprio, `horario_inicio`.

Nenhum dado gravado foi tocado: quem já tinha `horario` continua tendo a
conclusão, e a duração só passa a existir quando alguém preencher o início.

### Duração

```
duração = horario − horario_inicio
```

Devolve `null` — nunca zero — quando falta um dos dois: "durou 0 minuto" e "não
sabemos quanto durou" são coisas diferentes, e só a primeira pode entrar numa
média. Todos os relatórios dizem sobre quantos júris a média foi calculada.

Uma sessão que termina de madrugada (conclusão anterior ao início no relógio) é
lida como tendo virado o dia.

### Expediente

Configurável em *Painel Administrativo → Jurimetria → Expediente*: janela
(padrão 12h–19h), dias da semana, feriados nacionais (ligáveis, incluindo os
móveis derivados da Páscoa — Carnaval, Sexta-feira Santa e Corpus Christi) e
uma lista de datas próprias do órgão.

| Situação | Quando |
|---|---|
| `dentro` | Começou e terminou dentro da janela |
| `prolongou` | Terminou depois do fim da janela |
| `antecipou` | Começou antes do início da janela |
| `sem_expediente` | Fim de semana, feriado ou data marcada pelo órgão |
| `sem_horario` | Falta início ou conclusão para classificar |

Só cabe **um** rótulo por sessão, e `antecipou` tem precedência. Mas o tempo que
uma sessão avançou além do encerramento é contado à parte
(`minutosAlemDoExpediente`), inclusive para as rotuladas `antecipou` — o rótulo
é um só, o tempo excedido não deixa de existir.

Os júris `sem_horario` ficam **fora do denominador** dos percentuais: incluí-los
faria o índice de "dentro do expediente" cair por um problema de preenchimento,
não de pauta.

---

## 7. Cores das espécies de resultado

Cada espécie tem uma cor de etiqueta, editável por órgão em *Painel
Administrativo → Jurimetria → Cores*. Ela vale na tabela de júris, na ficha do
processo, nos relatórios e nas fatias do gráfico de espécies — o leitor não
reaprende a legenda ao mudar de aba.

O administrador escolhe **uma** cor; texto, borda e a variante de tema escuro
saem dela por cálculo (`resultadoTheme`), de modo que qualquer cor continue
legível. As nove cores padrão ficam entre 7,9:1 e 15,7:1 de contraste nos dois
temas, bem acima do mínimo AA.

Uma cor inválida nunca chega ao CSS: `normalizeHexColor` só aceita
`#rgb`/`#rrggbb` e cai no cinza neutro em qualquer outro caso, no cliente e no
servidor.

---

## 8. Importação

Duas etapas, sempre — nada é gravado sem confirmação:

1. **Análise** (`mode: 'preview'`) — lê o arquivo, normaliza e classifica cada
   linha, devolvendo o relatório. Nenhuma escrita.
2. **Confirmação** (`mode: 'commit'`) — grava apenas o que foi aprovado.

### Classificação de cada linha

O reconhecimento é feito pelo **número do processo normalizado** (só os
dígitos), de modo que a mesma sessão importada de novo — com ou sem pontuação —
nunca vira um segundo registro.

| Situação | Resultado |
|---|---|
| Número novo no órgão | **novo** — será adicionado |
| Número existente, dados idênticos | **sem mudança** — nada é feito |
| Número existente, a planilha preenche campos **vazios** no banco | **atualização** — o registro é completado |
| Número existente, a planilha traz valor **diferente** do gravado | **conflito** — depende da política |
| Número vazio, sem dígitos, repetido no arquivo, ou data inválida (salvo cancelados) | **inválido** |

A distinção entre **atualização** e **conflito** é o que permite reimportar uma
planilha mais completa sem transformar todo o arquivo em conflito: preencher
uma lacuna é ganho puro de informação e acontece sob qualquer política;
substituir um valor existente é divergência e só acontece sob `update`.

**Política de conflito** (`importPolicy`, sobreponível a cada importação):

- `preserve` (padrão) — o banco vence na **divergência**; lacunas continuam
  sendo preenchidas.
- `update` — a planilha vence, campo a campo, com registro no histórico.

Em ambos os casos, **célula vazia na planilha nunca apaga** um dado já gravado,
e uma data alterada pela importação também entra no `date_history`.

### Formatos aceitos

- `.xlsx` / `.xls` — todas as abas são lidas
- `.csv`
- `.json` — array de objetos
- `.docx` — tabelas do Word, lidas **no navegador**

> O `.docx` é descompactado no cliente com `DecompressionStream` (nativo,
> Chrome/Edge 103+) e as tabelas viram JSON antes de ir para a função — sem
> nenhuma biblioteca nova no projeto. Onde a API não existe, o restante
> continua funcionando e a interface avisa.

### Normalização automática

- **Comarca / Matéria / Espécie** — correspondência exata → prefixo → distância
  de Levenshtein acima do `fuzzyThreshold` do órgão. Sem correspondência, o
  valor original é mantido (o dado do usuário nunca é descartado).
- **Data** — `dd/mm/aaaa` (com `/`, `-` ou `.`), ISO e serial do Excel.
- **Matéria** — aceita sigla, descrição ou "SIGLA — DESCRIÇÃO"; grava a sigla.

Toda correção aparece na aba *Correções* do relatório, antes da confirmação.

---

## 9. Abas da página

| Aba | O que faz |
|---|---|
| **Painel** | KPIs, evolução mensal, espécies, realização das sessões, comarcas e promotores |
| **Júris** | Tabela com ordenação, seleção de colunas, paginação, CRUD e ações em massa |
| **Importação** | Assistente de duas etapas descrito acima |
| **Relatórios** | Totais/dissoluções, espécies, matérias, ranking de comarcas, atuação por promotor, série mensal, **duração das sessões** e **expediente** |
| **Relatórios dinâmicos** | Tabela dinâmica multi-nível, relatório descritivo e modelos do órgão |

Os relatórios de **duração** e de **expediente** são reagrupáveis pelo usuário —
comarca, promotor, espécie, matéria, mês, ano, vara ou responsável —, porque a
mesma base lida por ângulos diferentes conta histórias diferentes.

Os **filtros do topo valem para todas as abas** — inclusive para o que é
exportado, de modo que o arquivo gerado é sempre igual ao que está na tela.

Ao lado deles fica o botão **Análise**, com as opções da seção 5. A diferença
importa: *filtro* é o que entra no recorte (vale em todas as abas, inclusive na
tabela de júris); *análise* é como o recorte é contado (vale no Painel, nos
Relatórios e nos Relatórios dinâmicos, sem esconder registro nenhum).

Todas as tabelas de relatório são paginadas em **20, 50 ou 100 linhas**, com
navegação entre páginas; a exportação sempre leva o recorte **inteiro**, não
apenas a página aberta.

### Tabela dinâmica

- Até **3 dimensões em Linhas** e **3 em Colunas**, aninhadas
- Até **2 medidas lado a lado**: quantidade, aproveitamento, pontos, dissoluções
- **Mostrar como**: valor, % da linha, % da coluna, % do total geral
- **Subtotais**: automático / só linhas / só total geral / nenhum
- Dimensões incluem **realização**, **expediente**, **faixa de duração**, **hora
  de início**, **turno** e as **colunas do órgão**
- Medidas incluem **duração média** e **tempo total de sessão**
- O desenho do relatório fica **gravado por órgão** no navegador e volta pronto
  no próximo acesso; "Restaurar padrão" desfaz
- A tabela e o descritivo são gerados **sob demanda**, no botão *Gerar*: mexer
  numa dimensão recalculava uma pivot de milhares de células a cada clique, e o
  usuário via o recorte intermediário em vez do que pediu. Quando a configuração
  muda depois da geração, um aviso diz que o que está na tela é o anterior.
  Filtros e opções de análise continuam refluindo na hora — eles dizem QUAIS
  júris entram, e um relatório que ignorasse o filtro em vigor estaria errado.

### Modelos

Um modelo guarda o desenho de um relatório (o cruzamento da tabela dinâmica ou
as opções do descritivo) para reaplicar com um clique. Vivem no Firestore, por
órgão: **qualquer membro usa qualquer modelo**, mas só quem criou — ou quem tem
`configure_jurimetria` — pode editar ou excluir. A checagem é do servidor; a
interface apenas esconde o botão que iria falhar.

Modelos que ficaram no `localStorage` de antes desta mudança são detectados e
oferecidos para migração, um a um, de modo que uma falha no meio não duplique o
que já subiu.

### Estilos do relatório descritivo

Três leitores diferentes, três documentos diferentes — não é só o tamanho:

| Estilo | Para quem | O que produz |
|---|---|---|
| **Formal e objetivo** | quem vai citar o relatório num expediente | prosa em registro formal, frases completas, uma tabela por seção onde ela substitui o parágrafo |
| **Executivo (resumido)** | quem tem trinta segundos | abre com a síntese numérica e entrega tabelas por todos os ângulos, partindo das comarcas |
| **Analítico (detalhado)** | quem vai investigar | cruza as dimensões entre si (comarca × espécie, comarca × matéria, matéria × espécie, promotor × espécie, promotor × matéria, comarca × matéria × espécie e outros) e comenta concentração, dispersão e casos extremos |

Sobre a mesma base de teste, os três produzem respectivamente 752 / 1.055 /
2.057 palavras e 7 / 14 / 19 tabelas.

O cálculo (`buildPivot`) contabiliza cada grupo **uma vez** e propaga para os
prefixos de linha e coluna, então os subtotais de todos os níveis saem sem
varrer os dados de novo.

### Exportação

Seis formatos, todos gerados no navegador e sem dependência nova:

| Formato | Como |
|---|---|
| Excel `.xlsx` | `xlsx` (já usado na plataforma) |
| PDF `.pdf` | `jspdf` + `jspdf-autotable` |
| Word `.doc` | HTML com media type do Word — abre editável |
| Markdown `.md` | Tabela em texto |
| CSV `.csv` | Separador `;`, com BOM |
| JSON `.json` | Dados brutos |

Todo texto exportado passa por `sanitizeCellValue`, que neutraliza injeção de
fórmulas em planilhas (mesma mitigação de `lib/tableExport.js`).

---

## 10. Permissões

| Ação | Quem pode |
|---|---|
| Ver a página, cadastrar, editar, importar | Qualquer membro do órgão |
| Excluir júris (individual ou em massa) | `delete_records` (criador sempre) |
| Configurar listas, pontuação e colunas | `configure_jurimetria` (criador sempre) |
| Ligar/desligar o módulo no órgão | `manage_modules` |
| Ligar/desligar a flag na plataforma | Super-admin |

`configure_jurimetria` é delegável pelo criador em
*Painel Administrativo → Atribuições*, como as demais permissões.

---

## 11. Segurança

- **Nenhuma escrita direta do cliente.** `firestore.rules` permite apenas
  leitura de `juris/{id}` para membros do órgão; `allow write: if false`. Todo
  CRUD passa por Cloud Functions, que são as únicas que aplicam a normalização,
  a checagem de duplicidade e a permissão de exclusão.
- **IDOR**: toda função confere `organization_id` do documento contra o
  `organizationId` da requisição antes de alterar ou apagar.
- **Exclusão do órgão**: `juris` entrou em `ORG_SCOPED_COLLECTIONS`
  (`organizations/delete.ts`), então a base e os históricos são removidos junto
  com o órgão, sem deixar documentos órfãos.
- **Teto por chamada**: 500 júris por exclusão/atualização em massa e 20.000
  linhas por importação.

---

## 12. Integração com o resto da plataforma

- **Informações Gerais** — a página de Jurimetria vira uma fonte de métricas
  (`getJurisPageSchema`), com a espécie de resultado no lugar da "fase". O
  admin monta cartões próprios em *Painel Administrativo → Métricas*.
- **Busca global** (`global_search`) — encontra júris por número do processo,
  comarca ou promotor, e leva direto à aba. Só consulta a coleção quando a flag
  do módulo está ligada.
- **Administração da plataforma** — a visão geral conta os júris junto com as
  demais coleções.
- **Carregamento por aba** (`per_tab_loading`) — os júris só são assinados nas
  abas que precisam deles (*Informações Gerais* e *Jurimetria*).

---

## 13. Mapa dos arquivos

### Frontend

```
src/constants/jurimetria.js                             listas, pesos, campos, helpers
src/lib/jurimetriaEngine.js                             cálculos (funções puras)
src/lib/jurimetriaExport.js                             geração dos 6 formatos
src/lib/jurimetriaFile.js                               base64 + leitura de .docx
src/hooks/useJuris.js                                   leitura em tempo real
src/hooks/useJurimetriaPrefs.js                         preferências por órgão (análise,
                                                        paginação, relatórios dinâmicos)
src/services/jurimetriaService.js                       chamadas às Cloud Functions
src/components/organization/JurimetriaControl.jsx       página (abas + filtros)
src/components/organization/jurimetria/…                dashboard, tabela, diálogos,
                                                        importação, relatórios,
                                                        paginação, histórico de datas,
                                                        duração, expediente,
                                                        etiqueta de espécie
src/components/organization/admin/JurimetriaConfiguration.jsx  configuração do órgão
```

### Backend (`functions-v2/src`)

```
shared/jurimetria.ts        defaults, normalização, fuzzy, sanitização
juris/create.ts             cadastro manual (valida duplicidade)
juris/update.ts             edição parcial com histórico
juris/delete.ts             exclusão individual e em massa
juris/bulkUpdate.ts         atribuição/padronização em massa
import/fromExcelJuris.ts    importação (preview + commit)
jurimetriaTemplates/manage.ts  modelos de relatório compartilhados no órgão
```

---

## 14. Limites conhecidos

- A leitura carrega **todos** os júris do órgão (sem paginação): os relatórios
  e a tabela dinâmica precisam do conjunto completo para os totais fecharem.
  Acima de ~20.000 júris por órgão vale reavaliar.
- As **preferências de exibição** (opções de análise, tamanho de página, último
  desenho do relatório) ficam no `localStorage` do navegador — não são
  compartilhadas entre usuários nem entre dispositivos. Os **modelos**, ao
  contrário, vivem no banco e são do órgão.
- A **duração** e o **expediente** dependem dos dois horários preenchidos. Numa
  base importada de planilha antiga só existe a conclusão, então esses
  relatórios só ganham densidade à medida que os inícios forem informados — o
  que cada relatório declara abertamente, em vez de fingir uma média sobre três
  registros.
- A leitura de `.docx` depende de `DecompressionStream` (Chrome/Edge 103+,
  Firefox 113+). Safari mais antigo cai no aviso da interface.
