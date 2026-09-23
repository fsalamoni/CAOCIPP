# 🔭 Módulo Panorama — análise de dados de qualquer área

**Flag:** `panorama_enabled` (opcional, **default OFF**)
**Coleções:** `panoramaBases/{baseId}`, `panoramaRegistros/{registroId}`, `panoramaTemplates/{templateId}`
**Permissão do órgão:** `configure_panorama`

---

## Sumário

**Parte I — Para quem vai configurar** (não exige conhecimento técnico)
1. [O que este módulo faz](#1-o-que-este-módulo-faz)
2. [A ideia central: papéis, não colunas fixas](#2-a-ideia-central-papéis-não-colunas-fixas)
3. [Os dez papéis, um por um](#3-os-dez-papéis-um-por-um)
4. [Passo a passo: da planilha ao painel](#4-passo-a-passo-da-planilha-ao-painel)
5. [O que a plataforma descobre sozinha e o que você precisa dizer](#5-o-que-a-plataforma-descobre-sozinha-e-o-que-você-precisa-dizer)
6. [Três exemplos completos](#6-três-exemplos-completos)
7. [Como preparar a planilha](#7-como-preparar-a-planilha)
8. [Perguntas frequentes e problemas comuns](#8-perguntas-frequentes-e-problemas-comuns)

**Parte II — Referência técnica**
9. [Ativação (duas chaves)](#9-ativação-duas-chaves)
10. [Modelo de dados](#10-modelo-de-dados)
11. [Inferência de colunas](#11-inferência-de-colunas)
12. [Importação](#12-importação)
13. [Motor de cálculo](#13-motor-de-cálculo)
14. [Permissões e segurança](#14-permissões-e-segurança)
15. [Mapa dos arquivos](#15-mapa-dos-arquivos)
16. [Limites conhecidos](#16-limites-conhecidos)

---
---

# Parte I — Para quem vai configurar

## 1. O que este módulo faz

O SIGO já tinha a **Jurimetria**: um módulo feito sob medida para o Centro de Apoio
Operacional do Júri entender o cenário estadual dos processos de júri. Ele funciona
muito bem — e só serve ao júri, porque tudo nele é fixo: comarca, promotor,
espécie de resultado, tipo de crime.

O **Panorama** é o mesmo poder analítico, sem as colunas fixas.

Cada órgão cria as suas **bases**. O formato de cada base **vem da planilha que o
órgão importa**. Se a planilha do CAO do Patrimônio Público tem as colunas *Nº do
IC, Data de instauração, Comarca, Promotor natural, Tipo de improbidade, Valor do
dano, Situação, Desfecho*, a base terá exatamente essas colunas. Se a planilha do
CAO da Infância tem *Procedimento, Município, Acolhimento, Unidade de acolhimento,
Data de entrada, Situação da reintegração*, a base terá essas.

A partir daí o módulo entrega, para **qualquer** área:

- **Painel** com números, gráficos e rankings;
- **Dados** — a tabela completa, com filtros e edição;
- **Importação** de planilhas, reconhecendo o que é novo e o que é atualização;
- **Relatórios** reagrupáveis (a mesma base lida por território, por assunto, por
  responsável, por mês);
- **Relatórios dinâmicos** — tabela cruzada configurável e relatório descritivo
  pronto para instruir expediente, em três estilos;
- **Prescrição** — o que já venceu, o que está crítico, o que está em alerta;
- **Gargalos** — onde os casos se acumulam e há quanto tempo;
- **Concentração** — se poucos pontos respondem por muito, ou se a demanda é
  espalhada (é a leitura que orienta força-tarefa *versus* política estrutural);
- **Exportação** em Excel, CSV, PDF, Word, Markdown e JSON.

Nada disso foi escrito para improbidade, nem para infância, nem para consumidor.
Foi escrito para **papéis** — e é isso que faz o módulo servir aos três.

---

## 2. A ideia central: papéis, não colunas fixas

Esta é a única ideia que você precisa entender. O resto decorre dela.

A Jurimetria pergunta: **"qual é a comarca deste júri?"** — e por isso só serve
ao júri.

O Panorama pergunta: **"qual das suas colunas faz o papel de unidade
territorial?"** — e quem responde é o órgão.

Para o CAO do Patrimônio Público, a resposta é a coluna *Comarca*. Para um órgão
que trabalha por regional, é a coluna *Regional*. Para outro, é *Município*. Os
três respondem a mesma pergunta com colunas de nomes diferentes, e os três
recebem o mesmo ranking territorial, o mesmo agrupamento por região, o mesmo
cruzamento território × assunto.

Um **papel** é, portanto, um significado que você atribui a uma coluna sua. São
dez papéis. Nenhum é obrigatório. **Cada papel que você preenche destrava um
conjunto de análises; cada papel que fica vazio simplesmente não aparece na
tela** — o painel não mostra blocos quebrados nem números vazios, ele mostra
menos blocos.

Isso tem uma consequência prática importante: **você pode começar pequeno**.
Mapeie o identificador, uma data e a unidade territorial, importe, veja o
resultado. Depois volte e mapeie o desfecho. Reconfigurar não perde dado nenhum:
a configuração é uma *lente* sobre os registros gravados, não uma alteração
neles.

---

## 3. Os dez papéis, um por um

| Papel | Exemplos de coluna | O que destrava | O que se perde sem ele |
|---|---|---|---|
| **Identificador do registro** | Número do processo, do IC, do procedimento, protocolo | Reimportar a mesma planilha deixa de duplicar registros | Cada importação acrescenta tudo de novo — a base dobra de tamanho a cada envio |
| **Data principal** | Data de instauração, de autuação, de distribuição | Evolução mensal e anual, filtros por período, gráfico de série temporal | O módulo não consegue mostrar evolução no tempo |
| **Data de referência (fato)** | Data do fato, da ocorrência, do evento que originou o caso | Contagem de prescrição quando o prazo corre do fato, não da instauração | A prescrição passa a contar da data principal |
| **Unidade territorial** | Comarca, município, promotoria, regional | Ranking territorial, agrupamento por região, concentração da demanda | Não há como saber onde a demanda se concentra |
| **Responsável / membro** | Promotor de justiça, membro designado, titular | Distribuição de carga por pessoa, identificação de sobrecarga | Não há leitura de distribuição de trabalho |
| **Assunto / matéria** | Tipo de improbidade, tema, classe, natureza do caso | Distribuição temática, o que mais gera atuação, assunto × território | Não há leitura do que gera a demanda |
| **Desfecho / resultado** | Ação ajuizada, arquivado, acordo, TAC, declinado | Espécies de resultado, aproveitamento ponderado, cores na tabela | Não há leitura de efetividade |
| **Situação / fase** | Instaurado, em diligências, relatório final, encerrado | Funil de tramitação e identificação de gargalos: onde os casos param | Não há como ver onde a tramitação emperra |
| **Valor monetário** | Valor do dano, do contrato, da multa, do prejuízo | Somatórios financeiros, valor médio, concentração de valor por território | Não há leitura financeira |
| **Data-limite / prescrição** | Data da prescrição já calculada na planilha | Alerta de prescrição e ordenação por urgência | A prescrição ainda pode ser calculada por um prazo em anos, na configuração |

**Cada papel é único dentro de uma base**: duas colunas não podem ser ambas a
"data principal". Se você marcar uma segunda, a primeira é liberada — e isso é
proposital, porque senão a série temporal dependeria da ordem em que as colunas
foram gravadas.

**Colunas sem papel continuam existindo.** Elas aparecem na tabela, entram nos
filtros e podem ser usadas como dimensão de agrupamento nos relatórios. O papel
só é necessário para as análises que dependem de um *significado* — não dá para
calcular prescrição sem saber qual coluna é a data.

---

## 4. Passo a passo: da planilha ao painel

### Passo 0 — Ligar o módulo (uma vez por instalação e por órgão)

1. Um administrador da plataforma liga a flag **Módulo Panorama** em
   *Administração → Feature Flags*.
2. O criador do órgão ativa **Panorama** em *Painel Administrativo → Gerenciar
   Páginas e Módulos*.

Só com as duas chaves a aba aparece. Enquanto a flag está desligada, nada do
módulo existe na interface — e nenhum dado de outro módulo é afetado.

### Passo 1 — Importar a primeira planilha

Vá à página **Panorama → Importação** e envie o arquivo (`.xlsx`, `.xls` ou
`.csv`). A importação tem quatro etapas, e você vê o que vai acontecer **antes**
de qualquer coisa ser gravada:

1. **Arquivo** — o sistema lê a planilha e mostra quantas linhas e colunas achou.
2. **Colunas e papéis** — o sistema propõe um tipo e um papel para cada coluna.
   *Esta é a tela mais importante do módulo.* Revise cada linha: o nome da
   coluna, uma amostra do conteúdo real, o tipo detectado e o papel proposto.
   Corrija o que estiver errado. A tela explica, para cada papel, o que ele
   destrava e o que se perde sem ele.
3. **Conferência** — cada linha da planilha é classificada como **nova**,
   **atualização**, **sem mudança**, **conflito** ou **inválida**, com a lista do
   que exatamente mudaria em cada caso.
4. **Confirmação** — só agora os dados são gravados.

### Passo 2 — Ajustar o que só você sabe

Vá a **Painel Administrativo → Panorama**. São seis abas:

- **Identificação** — nome e descrição da base; e a exclusão da base (que exige
  digitar o nome exato, porque apaga também todos os registros).
- **Colunas e papéis** — a mesma tela do passo 2 da importação, para revisar a
  qualquer momento. Renomear uma coluna é livre: a ligação com os dados é pela
  chave interna, não pelo rótulo.
- **Desfechos** — a lista dos desfechos que **de fato aparecem** nos seus
  registros, com quantos registros cada um tem. Para cada um você define:
  - **peso** de 0 a 1 — quanto aquele desfecho vale como sucesso;
  - **cor** — a etiqueta colorida que aparece na tabela e nos gráficos;
  - **sem mérito** — marque quando o desfecho não é solução de mérito
    (declínio de atribuição, arquivamento por ilegitimidade). Ele continua
    contando no total de casos, mas sai do cálculo de efetividade.
- **Regiões** — agrupe as unidades territoriais em regiões nomeadas. Uma unidade
  pertence a uma única região. Feito isso, "Região" vira uma dimensão como
  qualquer outra em todos os relatórios.
- **Prescrição** — três modos: desligada; ler de uma coluna que já traz a data
  limite; ou calcular a partir de um prazo em anos (com prazo padrão e prazos
  diferentes por assunto). Você também define as faixas de alerta em dias.
- **Importação** — política para dados divergentes e rigor da correção automática.

### Passo 3 — Usar

As abas da página Panorama são: **Painel**, **Dados**, **Importação**,
**Relatórios** e **Relatórios dinâmicos**. Os filtros no topo valem para todas —
o recorte analisado é sempre o mesmo, inclusive nas exportações.

---

## 5. O que a plataforma descobre sozinha e o que você precisa dizer

Esta separação é o ponto em que a expectativa costuma escorregar. Vale ser
explícito.

### O que ela descobre sozinha

- **O tipo de cada coluna** — data, número, dinheiro, sim/não, lista de valores
  ou texto livre — olhando o conteúdo real, não o nome.
- **Datas em qualquer formato** — `15/03/2024`, `2024-03-15` e o número serial
  interno do Excel são todos reconhecidos.
- **Números em formato brasileiro e americano** — `1.234,56` e `1,234.56`,
  com `R$`, com sinal, com parênteses para negativo.
- **Quantos valores distintos cada coluna tem**, e com isso se ela é uma
  categoria (serve para agrupar) ou texto livre (não serve).
- **Um papel provável para cada coluna**, combinando duas evidências: o **nome**
  da coluna e o **conteúdo** dela. Uma coluna chamada "Comarca" cujo conteúdo são
  40 valores repetidos é quase certamente a unidade territorial; uma coluna
  chamada "Observações" com 900 textos longos e distintos não é identificador,
  por mais que o nome sugira alguma coisa.
- **Números de processo no formato CNJ**, que recebem tratamento próprio.
- **Grafias divergentes do mesmo valor** — "PORTO ALEGRE", "Porto Alegre" e
  "porto alegre" viram um grupo só.

### O que só você pode dizer

- **O que é um bom resultado.** A plataforma vê que existem os desfechos "Ação
  ajuizada", "TAC firmado" e "Arquivado". Ela não tem como saber se o TAC é um
  sucesso ou uma frustração para a política do seu órgão. Isso é o **peso**.
- **O que não é mérito.** Um declínio de atribuição não deveria derrubar o
  índice de efetividade — mas também não deveria sumir da contagem. Isso é a
  marcação **sem mérito**.
- **Os prazos de prescrição da sua matéria.** São definição jurídica, não dado.
- **Quais comarcas formam uma região.** Não há como deduzir do dado.
- **Qual coluna é a chave natural** dos registros, quando houver mais de uma
  candidata.
- **O que os números significam.** O módulo mostra que três comarcas concentram
  70% da demanda. Se isso é um problema de estrutura, de subnotificação nas
  outras ou de perfil da região — isso é leitura sua.

### O que ela não faz, e é bom saber de antemão

- Não lê petições nem documentos: ela lê **planilhas**.
- Não classifica o mérito de um caso nem sugere providências.
- Não busca dados em sistemas externos — os dados chegam pela planilha que você
  envia.
- Não inventa dado que não está lá. Se a planilha não tem a data do fato, não há
  como contar prescrição a partir do fato.

---

## 6. Três exemplos completos

### Exemplo A — CAO do Patrimônio Público (improbidade)

Planilha com: *Nº do IC · Data de instauração · Data do fato · Comarca ·
Promotor natural · Tipo de improbidade · Valor do dano · Situação · Desfecho*

| Coluna | Papel |
|---|---|
| Nº do IC | Identificador do registro |
| Data de instauração | Data principal |
| Data do fato | Data de referência (fato) |
| Comarca | Unidade territorial |
| Promotor natural | Responsável / membro |
| Tipo de improbidade | Assunto / matéria |
| Valor do dano | Valor monetário |
| Situação | Situação / fase |
| Desfecho | Desfecho / resultado |

Configuração: pesos (Ação ajuizada = 1; Acordo de não persecução = 0,7;
Arquivamento = 0); *sem mérito* em "Declinado a outro ramo"; prescrição no modo
**prazo**, contando da **data de referência**, padrão 5 anos, com 3 anos para
"Licitação"; regiões montadas a partir das comarcas.

Resultado: onde o dano se concentra, qual tipo de improbidade mais gera atuação
em cada região, quais ICs estão perto da prescrição, em que fase os casos param
e por quanto tempo, e quanto de valor está represado em cada gargalo.

### Exemplo B — CAO da Infância e Juventude (acolhimento)

Planilha com: *Procedimento · Município · Unidade de acolhimento · Data de
entrada · Motivo do acolhimento · Situação · Data-limite de reavaliação*

| Coluna | Papel |
|---|---|
| Procedimento | Identificador do registro |
| Data de entrada | Data principal |
| Município | Unidade territorial |
| Unidade de acolhimento | *(sem papel — segue servindo de dimensão e filtro)* |
| Motivo do acolhimento | Assunto / matéria |
| Situação | Situação / fase |
| Data-limite de reavaliação | Data-limite / prescrição |

Sem coluna de desfecho, a base não mostra aproveitamento — e nenhum bloco
quebrado aparece na tela. A prescrição fica no modo **coluna**: a data-limite já
vem pronta da planilha, e o módulo apenas conta os dias e classifica a urgência.
O "prazo vencido" aqui não é prescrição penal: é reavaliação atrasada. O módulo
não precisa saber a diferença — o cálculo é o mesmo.

### Exemplo C — CAO do Consumidor (reclamações)

Planilha com: *Protocolo · Data da reclamação · Município · Empresa · Assunto ·
Valor envolvido · Resultado*

| Coluna | Papel |
|---|---|
| Protocolo | Identificador do registro |
| Data da reclamação | Data principal |
| Município | Unidade territorial |
| Empresa | *(sem papel — vira dimensão de agrupamento)* |
| Assunto | Assunto / matéria |
| Valor envolvido | Valor monetário |
| Resultado | Desfecho / resultado |

Aqui a coluna mais interessante é justamente uma **sem papel**: cruzar *Empresa ×
Assunto* no relatório dinâmico mostra qual fornecedor gera qual tipo de problema,
e cruzar *Empresa × Município* mostra se é um problema nacional ou de uma praça.

---

## 7. Como preparar a planilha

Não há formato obrigatório, mas estas cinco coisas evitam quase todo retrabalho:

1. **Uma linha de cabeçalho, na primeira linha.** Sem título do relatório acima,
   sem linha em branco, sem células mescladas no cabeçalho.
2. **Uma coluna que identifique o registro sem ambiguidade** — número do
   processo, do IC, protocolo. É ela que faz a reimportação atualizar em vez de
   duplicar.
3. **Uma informação por coluna.** "Comarca/Promotor" numa coluna só impede as
   duas leituras.
4. **Datas como data, valores como número.** Se a planilha guarda a data como
   texto, o sistema ainda reconhece os formatos usuais — mas guardar como data é
   mais seguro.
5. **Grafia consistente nas categorias.** O sistema aproxima grafias parecidas,
   e você controla o rigor disso; ainda assim, "Improbidade", "improb." e "IMP"
   na mesma coluna produzem três categorias onde deveria haver uma.

> **Responsabilidade sobre o conteúdo.** O módulo foi pensado para dados de
> processo e estatística. Antes de importar, confira se a planilha não carrega
> dados pessoais sensíveis que não precisam estar ali — e lembre que os registros
> ficam visíveis a todos os membros do órgão.

---

## 8. Perguntas frequentes e problemas comuns

**Posso ter mais de uma base?**
Sim, quantas o órgão quiser, cada uma com suas colunas e sua configuração. Uma
base por matéria costuma funcionar melhor do que uma base gigante com colunas
que só valem para parte dos registros.

**Reimportar a mesma planilha duplica tudo?**
Não, desde que exista uma coluna no papel de **identificador**. O sistema
reconhece o registro pelo identificador normalizado e classifica a linha como
*sem mudança*, *atualização* ou *conflito*. Sem identificador, duplica — e é por
isso que a tela de mapeamento insiste nesse ponto.

**Mudei os pesos. Os dados anteriores se perderam?**
Não. Peso, cor, região e regra de prescrição são configuração, não dado. Mudar
qualquer um deles recalcula os relatórios na hora, sem tocar em um único
registro gravado.

**A planilha ganhou uma coluna nova. Preciso recriar a base?**
Não. Na importação seguinte, a coluna nova é detectada e acrescentada à base. Os
registros antigos ficam com ela vazia, o que é o comportamento correto: eles
realmente não têm esse dado.

**Mudei o nome de uma coluna na planilha. O que acontece?**
O sistema tenta casar pela origem e pelo nome normalizado. Se não reconhecer,
trata como coluna nova — e aí você tem duas colunas para a mesma informação. Se
isso acontecer, o caminho é ajustar o cabeçalho da planilha para o nome anterior
e reimportar.

**Meu painel está quase vazio.**
Faltam papéis. Cada bloco do painel depende de um papel específico; sem ele o
bloco não aparece. Vá a *Painel Administrativo → Panorama → Colunas e papéis* e
veja quantos dos dez estão preenchidos.

**Os relatórios dinâmicos não mostram nada.**
Eles só calculam quando você clica em **Gerar tabela** ou **Gerar relatório**.
Isso é proposital: numa base grande, recalcular a cada clique travaria a tela.

**O que são os modelos de relatório?**
Configurações salvas de tabela dinâmica ou de relatório descritivo. Todo o órgão
enxerga e usa os modelos de todos; **editar e excluir, só o autor e o
administrador do órgão** — e essa regra é verificada no servidor, não só na tela.

**Qual o tamanho máximo de uma base?**
O cálculo é feito no navegador, e o limite prático é de **20 mil registros por
base**. A página avisa ao se aproximar disso. Acima, o caminho é dividir por
período ou por matéria.

**Excluí uma base por engano. Dá para recuperar?**
Não. A exclusão apaga a base e todos os seus registros, e por isso exige digitar
o nome exato da base. Os dados precisariam ser importados de novo.

---
---

# Parte II — Referência técnica

## 9. Ativação (duas chaves)

| Chave | Onde | Efeito |
|---|---|---|
| `panorama_enabled` | Administração → Feature Flags | Default **OFF**. Desligada, nada do módulo existe na interface |
| `moduleConfig.panorama.enabled` | Painel Administrativo → Páginas e Módulos | Ativa o módulo neste órgão |

Defesa em profundidade idêntica à da Jurimetria e das Parcerias: a aba da página
e a aba de configuração exigem as duas. As Cloud Functions validam a permissão do
órgão independentemente da interface.

## 10. Modelo de dados

### `panoramaBases/{baseId}`

```jsonc
{
  "organization_id": "org123",
  "nome": "Improbidade administrativa",
  "descricao": "Ações e ICs de improbidade no estado.",
  "columns": [
    {
      "key": "n_do_ic",          // chave interna, estável; o rótulo pode mudar
      "label": "Nº do IC",
      "type": "texto",           // texto | lista | numero | moeda | data | booleano
      "role": "identificador",   // um dos dez papéis, ou null
      "lista": ["..."],          // valores conhecidos, quando type === 'lista'
      "cardinalidade": 812,      // distintos vistos na última importação
      "amostra": ["..."],
      "vazios": 3,
      "visivel": true,
      "ordem": 0,
      "origem": "Nº do IC"       // cabeçalho original, para casar reimportações
    }
  ],
  "desfechos": {
    "pesos":   { "Ação ajuizada": 1, "TAC": 0.7, "Arquivado": 0 },
    "cores":   { "Ação ajuizada": "#93ffc4" },
    "neutros": ["Declinado a outro ramo"]
  },
  "regioes": { "Metropolitana": ["Porto Alegre", "Canoas"] },
  "prescricao": {
    "modo": "prazo",             // desligado | coluna | prazo
    "anosPadrao": 5,
    "anosPorAssunto": { "Licitação": 3 },
    "contarDe": "data_referencia",
    "alertas": [90, 180, 365]
  },
  "importPolicy": "preserve",    // preserve | update
  "fuzzyThreshold": 0.85
}
```

### `panoramaRegistros/{registroId}`

```jsonc
{
  "organization_id": "org123",
  "base_id": "base456",
  "values": { "n_do_ic": "1.23.0001", "comarca": "Porto Alegre" },
  "chave_norm": "1230001",       // identificador normalizado (idempotência)
  "created_at": "...", "updated_at": "...", "created_by": "uid"
}
```

### `panoramaTemplates/{templateId}`

Modelos de relatório, por base. `tipo` é `pivot` ou `descritivo`; `config` guarda
a configuração inteira. Edição e exclusão exigem ser o autor (`created_by`) ou
ter `configure_panorama`.

## 11. Inferência de colunas

`functions-v2/src/shared/panorama.ts` é a autoridade — a interface apenas espelha
os rótulos.

1. **`analyzeColumn`** mede cada coluna: preenchidos, vazios, distintos, amostra,
   e quantos valores se parseiam como data, número ou booleano.
2. **`inferColumnType`** decide o tipo. Texto vira `lista` quando tem no máximo
   300 distintos **e** no máximo 50% de proporção de distintos — o teto absoluto
   sozinho classificaria mal tanto 167 comarcas em 20 mil linhas quanto 167
   valores em 200 linhas.
3. **`suggestRole`** combina duas evidências independentes, **nome** e
   **conteúdo**, e devolve o papel com uma confiança. Três decisões que custaram
   correção e valem registro:
   - entre dicas de nome que casam, vence a **mais longa** — senão "Data do
     Fato" seria capturada pela dica genérica "data" e viraria a data principal;
   - `identificador` exige **forma de identificador**: média de até 40
     caracteres e até 2 espaços por valor. Sem isso, uma coluna "Observações"
     seria proposta como chave e quebraria a idempotência da importação;
   - `normalizeIdentifier` só descarta letras quando **não há nenhuma**:
     `NF-2025-00001` e `PP-2025-00001` colidiriam se ambos virassem `202500001`.

## 12. Importação

`importPanorama` (`functions-v2/src/panorama/importar.ts`) roda em duas fases —
`preview` e `commit` — e nunca grava na primeira.

**Casamento de colunas:** por `origem`, depois por rótulo normalizado. A
configuração do admin é preservada; colunas novas são acrescentadas. Conflito de
papel único é resolvido pela confiança da inferência.

**Classificação de cada linha:**

| Classe | Significado |
|---|---|
| `novo` | Identificador inexistente na base |
| `sem_mudanca` | Idêntico ao gravado |
| `atualizacao` | Só completa campos vazios (`fills`) |
| `conflito` | Diverge de dado já gravado (`diffs`) — a política decide |
| `invalido` | Sem identificador utilizável |

**Política:** `preserve` (padrão) lista os conflitos e mantém o banco;
`update` sobrescreve, com registro no histórico. Em ambas, campos vazios no banco
são completados.

## 13. Motor de cálculo

`src/lib/panoramaEngine.js` — funções puras, sem React e sem Firebase. Tudo
calcula **por papel**, nunca por nome de campo.

| Função | Entrega |
|---|---|
| `computeTotais` | Quantidade, efetivos, neutros, aproveitamento, valores |
| `computeDistribuicao` | Distribuição por qualquer dimensão (substitui os rankings fixos da Jurimetria) |
| `computeSerieMensal` | Série temporal pela data principal |
| `computePrescricao` | Faixas de urgência e lista dos mais urgentes |
| `computeGargalos` | Acúmulo por situação, com idade média, mediana e mais antigo |
| `computeConcentracao` | Top 3, top 10, quantos grupos para metade do volume, leitura |
| `buildPivot` | Tabela dinâmica multi-nível nos dois eixos |
| `crossTab` | Cruzamento de duas dimensões |
| `buildDescritivo` | Relatório em markdown, nos três estilos |

**Dimensões derivadas** aparecem sozinhas quando o papel correspondente existe:
`__mes`, `__ano`, `__trimestre` (data principal), `__regiao` (regiões definidas)
e `__prescricao` (prescrição ligada).

Duas exclusões deliberadas em `dimensoesDaBase`: a coluna no papel de
**identificador** (agrupar por ela dá uma linha por registro) e colunas de texto
com cardinalidade acima de 300 (texto livre). Sem elas, todo cruzamento do
relatório analítico seria dominado por ruído.

**Estilos do descritivo**, sobre a mesma base de teste de 480 registros:

| Estilo | Palavras | Tabelas | Conteúdo |
|---|---|---|---|
| Formal | ~590 | 0 | Texto corrido, para instruir expediente |
| Executivo | ~2.200 | 15 | Síntese + as tabelas que a sustentam |
| Analítico | ~5.200 | 34 | Cruzamentos entre todas as dimensões, com leitura de cada um, e síntese final |

## 14. Permissões e segurança

| Ação | Exige |
|---|---|
| Ver a página | Ser membro do órgão |
| Criar/editar registro | Ser membro do órgão |
| Excluir registros / excluir base | `delete_records` (base: + nome digitado) |
| Configurar bases, papéis, pesos, regiões, prescrição | `configure_panorama` |
| Editar/excluir modelo de relatório | Ser o autor **ou** ter `configure_panorama` |

**`firestore.rules`**: as três coleções são `allow write: if false`. Toda escrita
passa por Cloud Function, que valida organização, permissão e integridade. A
leitura exige ser membro do órgão dono do documento.

**Guardas de IDOR**: toda função confere `organization_id` e, nos registros,
também `base_id`, antes de qualquer operação.

**Exclusão de órgão**: `functions-v2/src/organizations/delete.ts` limpa as três
coleções.

## 15. Mapa dos arquivos

### Frontend

```
src/constants/panorama.js                              papéis, tipos, defaults, cores
src/lib/panoramaEngine.js                              todo o cálculo
src/services/panoramaService.js                        chamadas às Cloud Functions
src/hooks/usePanorama.js                               bases, registros, modelos
src/components/organization/PanoramaControl.jsx        a página (5 abas)
src/components/organization/panorama/
    PanoramaMapeamento.jsx                             mapeamento de papéis
    PanoramaImport.jsx                                 importação em 4 etapas
    PanoramaDashboard.jsx                              painel
    PanoramaTable.jsx                                  tabela de dados
    PanoramaFilters.jsx                                filtros da base
    PanoramaFormDialog.jsx                             cadastro manual
    PanoramaReports.jsx                                relatórios reagrupáveis
    PanoramaDynamicReports.jsx                         tabela dinâmica + descritivo
    PanoramaBadge.jsx                                  etiqueta colorida
src/components/organization/admin/PanoramaConfiguration.jsx   configuração do órgão
```

### Backend (`functions-v2/src`)

```
shared/panorama.ts          papéis, tipos, inferência, normalização (autoridade)
panorama/bases.ts           managePanoramaBase
panorama/registros.ts       managePanoramaRegistro
panorama/importar.ts        importPanorama (preview + commit)
panorama/templates.ts       managePanoramaTemplate
```

## 16. Limites conhecidos

- **20 mil registros por base.** O cálculo é client-side; acima disso a página
  avisa e a recomendação é dividir a base.
- **Uma linha de cabeçalho.** Planilhas com cabeçalho em duas linhas ou células
  mescladas precisam ser ajustadas antes.
- **Até 120 colunas** por base.
- **Renomear coluna na origem** sem ajustar a base cria coluna nova.
- **Sem importação automática**: não há integração com sistemas externos; os
  dados chegam por planilha enviada por uma pessoa.
- **Uma unidade pertence a uma única região.**
