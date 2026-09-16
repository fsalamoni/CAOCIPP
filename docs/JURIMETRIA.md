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
| `data_juri` | string | `YYYY-MM-DD` |
| `comarca` | string | Lista oficial do órgão |
| `tipo` | string | **Sigla** da matéria (CM, CP, D, F, FC, PP, T…) |
| `resultado` | string | Espécie de resultado (lista oficial do órgão) |
| `promotor` | string | Texto livre |
| `horario` | string | Normalizado para `HHhMM` quando reconhecível |
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

## 5. Importação

Duas etapas, sempre — nada é gravado sem confirmação:

1. **Análise** (`mode: 'preview'`) — lê o arquivo, normaliza e classifica cada
   linha, devolvendo o relatório. Nenhuma escrita.
2. **Confirmação** (`mode: 'commit'`) — grava apenas o que foi aprovado.

### Classificação de cada linha

| Situação | Resultado |
|---|---|
| Número novo no órgão | **novo** — será adicionado |
| Número existente, dados idênticos | **sem mudança** — nada é feito |
| Número existente, dados divergentes | **conflito** — depende da política |
| Número vazio, sem dígitos, repetido no arquivo, ou data inválida | **inválido** |

**Política de conflito** (`importPolicy`, sobreponível a cada importação):

- `preserve` (padrão) — o banco vence; a divergência é apenas listada.
- `update` — a planilha vence, campo a campo, com registro no histórico.

Em ambos os casos, **célula vazia na planilha nunca apaga** um dado já gravado.

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

## 6. Abas da página

| Aba | O que faz |
|---|---|
| **Painel** | KPIs, evolução mensal, espécies, comarcas e promotores |
| **Júris** | Tabela com ordenação, seleção de colunas, paginação, CRUD e ações em massa |
| **Importação** | Assistente de duas etapas descrito acima |
| **Relatórios** | Totais/dissoluções, espécies, matérias, ranking de comarcas, atuação por promotor e série mensal |
| **Relatórios dinâmicos** | Tabela dinâmica multi-nível, relatório descritivo e modelos salvos |

Os **filtros do topo valem para todas as abas** — inclusive para o que é
exportado, de modo que o arquivo gerado é sempre igual ao que está na tela.

### Tabela dinâmica

- Até **3 dimensões em Linhas** e **3 em Colunas**, aninhadas
- Até **2 medidas lado a lado**: quantidade, aproveitamento, pontos, dissoluções
- **Mostrar como**: valor, % da linha, % da coluna, % do total geral
- **Subtotais**: automático / só linhas / só total geral / nenhum
- Dimensões incluem as **colunas do órgão**

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

## 7. Permissões

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

## 8. Segurança

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

## 9. Integração com o resto da plataforma

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

## 10. Mapa dos arquivos

### Frontend

```
src/constants/jurimetria.js                             listas, pesos, campos, helpers
src/lib/jurimetriaEngine.js                             cálculos (funções puras)
src/lib/jurimetriaExport.js                             geração dos 6 formatos
src/lib/jurimetriaFile.js                               base64 + leitura de .docx
src/hooks/useJuris.js                                   leitura em tempo real
src/services/jurimetriaService.js                       chamadas às Cloud Functions
src/components/organization/JurimetriaControl.jsx       página (abas + filtros)
src/components/organization/jurimetria/…                dashboard, tabela, diálogos,
                                                        importação, relatórios
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
```

---

## 11. Limites conhecidos

- A leitura carrega **todos** os júris do órgão (sem paginação): os relatórios
  e a tabela dinâmica precisam do conjunto completo para os totais fecharem.
  Acima de ~20.000 júris por órgão vale reavaliar.
- Os **modelos** de relatório dinâmico ficam no `localStorage` do navegador,
  como no aplicativo de origem — não são compartilhados entre usuários.
- A leitura de `.docx` depende de `DecompressionStream` (Chrome/Edge 103+,
  Firefox 113+). Safari mais antigo cai no aviso da interface.
