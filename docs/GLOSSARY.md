# Glossário

Termos de negócio e técnicos usados no SIGO, na interface e no código.

---

## Plataforma

### SIGO
Sistema Interno de Gestão Operacional. Nome atual da plataforma, antes chamada
"Consultas CAO" (daí o site legado `consultascao.web.app` e nomes como
`consultasCaoClient` no código).

### CAOCIPP
Centro de Apoio Operacional Cível e de Proteção do Patrimônio Público do MPRS,
unidade onde o SIGO nasceu.

### Órgão (organização)
Espaço de trabalho de uma unidade. Documento `organizations/{id}`; todo
registro tem `organization_id`.

### Código de convite
Código de 8 caracteres (`invite_code`) que permite a um usuário entrar num
órgão como membro.

### Membro / vínculo (membership)
Ligação entre usuário e órgão, em `userOrganizations/{uid}_{orgId}`, com
`role`, `function` e `permissions`.

### Papel (`role`)
`creator` (Criador), `admin` ou `member`. Governa autorização.

### Função (`function`)
Texto livre que descreve a atividade da pessoa no órgão (Assessoria,
Secretaria, Decisória, Promotor…). Personaliza o painel inicial; não concede
permissão.

### Atribuições
Permissões especiais delegadas pelo criador (`edit_details`,
`manage_matters`, `configure_*`, `manage_metrics`, `manage_modules`,
`bulk_standardize`, `delete_records`).

### Super-admin
Administrador da plataforma inteira (claim `platformAdmin`). Acessa
*Administração & Custos*.

### Módulo
Conjunto de abas do órgão (Consultas, Expedientes, Parcerias, Jurimetria,
Panorama, Resumos, Calendário). Ligado por órgão em `moduleConfig`.

### Feature flag
Interruptor global em `platformConfig/featureFlags`. **Integrada**: ligada por
padrão (um `false` explícito desliga, como válvula de emergência).
**Opcional**: desligada por padrão, ligada pelo super-admin.

### Página personalizada
Tipo de registro criado pelo próprio órgão (`entityTypes` + `customRecords`),
com campos, fases, Kanban e lista genéricos.

### Métrica
Indicador configurável sem código em *Painel Administrativo → Métricas das páginas*
(`dashboardConfig`), exibido em *Informações Gerais*.

---

## Fluxo de Consultas e Expedientes

### Consulta (processo)
Consulta jurídica recebida pela unidade. Coleção `processes`; no código,
"process".

### Expediente
Expediente administrativo, com fluxo paralelo ao das Consultas. Coleção
`expedientes`.

### Consulente
Quem fez a consulta (`consultant`).

### Matéria
Classificação da consulta em matéria geral e específica
(`matter_category` / `matter_subcategory`). Ver
[MATTER_CLASSIFICATION.md](./MATTER_CLASSIFICATION.md).

### Sistema / Origem
Nos Expedientes, o sistema por onde chegou (SIM, SGP, SPU, e-mail…) e a origem
(SUBINST, SUBADM, Gabinete PGJ…).

### Pedido de urgência
Marca de prioridade (`urgency_request`). Urgentes ficam no topo das colunas do
Kanban (exceto na de arquivados) e entram nas métricas de urgentes.

### Distribuição
Atribuição do registro a um assessor responsável (`distribution_date`,
`responsible_user_id`).

### Fases
Pendente → Em elaboração → (Aguarda retorno de terceiros) → Em revisão →
Revisadas → Na pasta. Derivadas das datas preenchidas.

### Remessa a terceiros
Envio do registro a perícia, delegacia ou outro órgão
(`third_party_referral_date`); fase opcional.

### Remessa p/ revisão / Revisão concluída / Devolução após revisão
Envio para revisão (`review_submission_date`), conclusão da revisão
(`reviewed_date`) e devolução ao consulente após a revisão
(`review_return_date`).

### Na pasta (arquivamento)
Registro concluído e arquivado (`archived_date`).

### Pasta na rede
Caminho, na rede do MPRS, dos documentos do registro (`network_folder`).
Obrigatória ao enviar para revisão.

### Restrição de acesso
Marca de sigilo da Consulta (`access_restriction`). Gera registro de acesso
ao abrir; não oculta o registro dos demais membros.

### Temporalidade
Médias de tempo do fluxo em **dias úteis**, arredondadas para cima: tempo
total (entrada → devolução), análise (distribuição → remessa) e revisão
(remessa → devolução).

### Histórico (`activity_log`)
Lista de alterações de um registro, espelhada na subcoleção `history/`.

---

## Processo Eletrônico

### Processo Eletrônico (módulo)
Módulo de processo eletrônico do órgão (ver [PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md)). Até nov/2026 se chamava Secretaria Processual; os nomes internos (`secretaria*`, coleções `sec*`) foram mantidos.

### Unidade de lotação (Processo Eletrônico)
Secretaria (autua, movimenta e cumpre), gabinete (decide), assessoria (estuda e minuta) ou outra. Tem equipe, papel timbrado, tipos de documento e modelos próprios.

### Lotação / Atribuição / Gestor da unidade
Lotação é o vínculo de uma pessoa com a unidade. Atribuição é a função dela ali (ex.: Chefe de secretaria, Assessor). O gestor da unidade monta a equipe, admite pedidos, convida pessoas e ajusta o timbrado, os tipos e os modelos da unidade.

### Posse
A unidade que está com o processo. Só quem está lotado nela o movimenta.

### Rito
Sequência de fases de um processo. Versionado; o processo guarda as fases com que foi autuado.

### Minuta / Juntada
Minuta é o documento em preparo, visível só à unidade que o redigiu. Juntada é a entrada nos autos, com número de ordem, sem volta.

### Conclusão / Pendência
Conclusão é a remessa do processo ao gabinete para decidir. Pendência é algo que o decisor precisa apreciar; pode interromper a fase até ser apreciada.

### Cadeia de hash
Cada movimento leva o SHA-256 do anterior; alterar um movimento antigo quebra a cadeia e é detectado.

### Portal das partes / Habilitação
Página pública `/Portal` onde a parte, com conta própria, acompanha os processos em que foi habilitada e peticiona. Habilitação é o aceite do convite enviado pela secretaria; a parte nunca vira membro do órgão.

### Tipo de processo (Processo Eletrônico)
Modelo de autuação definido pelo admin do órgão: nome, sigla, rito, sigilo padrão e unidade sugerida.

### Fluxo do rito / Ramificação
Ordem em que as fases se sucedem. Uma fase pode seguir para a próxima da lista, para uma de várias fases escolhidas (ramificação) ou encerrar o fluxo (fase final). Sair do fluxo exige motivo.

### Folhas (fls.)
Numeração contínua das páginas dos autos. Cada documento juntado recebe a faixa de folhas que ocupa (ex.: fls. 3 a 5), carimbada no PDF.

### Papel timbrado
Cabeçalho (linhas e brasão), rodapé, fonte e tamanho padrão definidos pelo admin do órgão e aplicados aos documentos redigidos na Secretaria.

### Código de conferência
Código de 16 caracteres (`XXXX-XXXX-XXXX-XXXX`) criado na juntada e impresso, com QR, em cada folha do documento. Em `/Conferir`, qualquer pessoa confirma que o documento está nos autos, em que folhas, quando e com quais assinaturas.

### Calendário do órgão
Feriados locais e recessos definidos pelo admin do órgão na Secretaria. Feriado prorroga o vencimento; recesso suspende a contagem do prazo, inclusive em dias corridos.

### Modelo de documento
Texto pronto criado pelo admin do órgão, com campos como `{{numero}}` e `{{partes}}` que se preenchem com os dados do processo ao começar a redigir.

---

## Siglas

| Sigla | Significado |
|---|---|
| MPRS | Ministério Público do Estado do Rio Grande do Sul |
| CAO | Centro de Apoio Operacional |
| CAOJúri | Centro de Apoio Operacional do Júri (origem da Jurimetria) |
| PGJ | Procurador-Geral de Justiça |
| PGEA | Número do procedimento administrativo que identifica a Parceria |
| DEMP | Diário Eletrônico do Ministério Público |
| LGPD | Lei Geral de Proteção de Dados (Lei 13.709/2018) |
| 2FA | Verificação em duas etapas |
| IDOR | Acesso indevido a objeto de outro órgão pela troca de um identificador |
| SSRF | Requisição forjada do servidor para endereço interno |

---

## Módulo Parcerias

### Parceria
Convênio, Termo de Cooperação ou Termo de Fomento firmado entre o MP/RS e outro ente. Entidade de primeiro nível na coleção `parcerias/`. Tem 7 fases (ordem canônica em `PARCERIA_VALID_STATUSES`): Pendente, Em análise, Em revisão, Revisadas, Aguarda Terceiros, Parcerias, Extintos.

### PGEA
Número do "Procedimento de Gestão Estratégica e Administrativa" — identificador único da Parceria no órgão. Equivalente ao número de processo das Consultas. Pode ser gerado automaticamente pelo MP (formato livre).

### Tipo de Parceria
Classificação jurídica: **Convênio**, **Termo de Cooperação** ou **Termo de Fomento**. Configurável por órgão (lista customizável em `parceriaSettings.tipos`).

### Configurações do módulo de Parcerias (por órgão)
O objeto `parceriaSettings` no documento da organização guarda:
- `tipos`: tipos de Parceria aceitos (default: Convênio, Termo de Cooperação, Termo de Fomento).
- `aditivoTipos`: tipos de Aditivo aceitos (default: Prazo, Valor, Alteração, Reequilíbrio, Execução).
- `vigenciaOptions`: opções pré-definidas de vigência (default: 6, 12, 24, 36, 60 meses, Indeterminado). O usuário pode digitar valor livre; o sistema oferece como autocomplete.
- `categorias`: tags opcionais para classificar Parcerias (ex.: Saúde, Educação). Lista vazia = campo não exibido.
- `thirdPartyPhaseEnabled` (default true): liga/desliga a coluna "Aguarda Terceiros" no Kanban. Quando desligada, parcerias vão direto de "Revisão" para "Parcerias".
- `autoExtinguishOnEnd` (default false): preferência por extinguir Parcerias automaticamente quando passam a data final. Lógica de execução é feita por Cloud Function.

A lista de terceiros fica em `thirdPartiesSettingsParcerias` (mesmo padrão de Consultas/Expedientes, com permissão `configure_parcerias` separada).

### Vigência
Período de validade da Parceria (ex.: "12 meses", "2 anos"). Campo texto livre; o sistema calcula o termo final a partir da data de assinatura quando cabível.

### Termo Final
Data de encerramento da Parceria. Quando a data atual passa do termo final e a Parceria não foi extinta, o sistema recomenda a criação de um aditivo (renovação).

### Aviso de Renovação
Data sugerida para início do processo de renovação. Usado para alertas de prazo no calendário de vencimentos. É calculada automaticamente a partir do **Termo Final MENOS o período de aviso** (`renewal_notice_period` + unidade) — o aviso acontece *antes* do fim da vigência. O cálculo é feito no modal de edição (`calculateRenewalNoticeDate`) e espelhado no backend (`updateParceria`, `concludeAditivo`, `checkPartnershipNoticeDeadlines`). Editar a data à mão desliga o recálculo automático até que o período mude.

### Aditivo
Documento complementar à Parceria original. Pode ser **Renovação/Prorrogação** (estende a vigência) ou **Qualitativo (Objeto)** (altera o objeto sem mudar prazo). Vive em subcoleção `parcerias/{id}/aditivos/{addId}`. Cada Parceria pode ter N aditivos.

### Aditivo de Renovação/Prorrogação
Tipo de aditivo que renova ou estende a vigência da Parceria. Mantém os mesmos campos de formalização (tipo, número, vigência, termo final).

### Aditivo Qualitativo
Tipo de aditivo que altera o **objeto** da Parceria sem necessariamente mudar a vigência. Usado para aditivos que modificam escopo.

### Extinção
Ação terminal que marca a Parceria como finda sem renovação. Requer confirmação textual (digitar "EXTINGUIR") e cascateia para todos os aditivos. Diferente de "arquivamento" de Consultas/Expedientes — é uma decisão consciente de NÃO renovar.

### Aditivo corrente
O aditivo que está sendo processado no momento (`parceria.current_additive_id`). Quando uma Parceria tem aditivos, o Kanban mostra o status do aditivo corrente, não do original.

### Lock de campos
Quando uma Parceria tem 1+ aditivos, os campos do documento original (PGEA, assunto, objeto, partes, partnership_type, partnership_number, signature_date, validity_period, end_date, renewal_notice_date) ficam **read-only**. Edições subsequentes vão para o aditivo corrente. O backend (Cloud Function `updateParceria`) recusa mudanças nesses campos quando `aditivo_count > 0`.

O lock vale para a *substância* da Parceria, não para a **fase**: com um aditivo em andamento (`current_additive_id` preenchido), o seletor de status do modal move o **aditivo corrente** (o backend espelha a fase de volta na Parceria pai); sem aditivo em andamento (o último já concluído), o modal move a própria Parceria enviando apenas os campos de fase (`PHASE_ONLY_FIELDS` em `EditParceriaDialog`).

---
## Módulo Jurimetria (flag `jurimetria_enabled`)

Documentação completa em `JURIMETRIA.md`.

### Júri
Sessão do Tribunal do Júri registrada na base do órgão. Entidade de primeiro nível na coleção `juris/`. Diferente de Consultas/Expedientes/Parcerias, **não tem fases de fluxo**: o eixo natural de análise é a espécie de resultado.

### Número do processo (chave natural)
O número CNJ do júri é a chave do registro dentro do órgão. É guardado duas vezes: `numero_processo` (como digitado) e `numero_processo_norm` (só os dígitos). A comparação é sempre pelo normalizado — é o que torna a importação idempotente e impede cadastro duplicado.

### Espécie de resultado
Desfecho do julgamento (PROCEDÊNCIA, IMPROCEDÊNCIA, DESCLASSIFICAÇÃO, DISSOLUÇÃO etc.). Lista configurável por órgão em `jurimetriaSettings.resultados`; 9 espécies canônicas por padrão.

### Matéria / Tipo de júri
Classificação do caso, gravada pela **sigla** (CM, CP, D, F, FC, PP, T por padrão). A importação reconhece a sigla, a descrição ou as duas juntas ("FC — FATOS DO COTIDIANO").

### Horário de início e de conclusão
Dois campos: `horario_inicio` e `horario`. O `horario` sempre significou o horário em que a sessão **terminou** — é o que as planilhas do CAOJúri registravam —, e o rótulo passou a dizer isso. A diferença entre os dois é a **duração**.

### Duração da sessão
`horario − horario_inicio`, em minutos. Vale `null` — nunca zero — quando falta um dos dois: "durou 0 minuto" e "não sabemos quanto durou" são coisas diferentes, e só a primeira entra numa média. Os relatórios sempre dizem sobre quantos júris a média foi calculada. Uma sessão que termina de madrugada é lida como tendo virado o dia.

### Expediente (janela do órgão)
Faixa de horário (padrão 12h às 19h), dias da semana e feriados que definem quando o órgão funciona, configuráveis em *Painel Administrativo → Jurimetria → Expediente*. Os feriados nacionais entram automaticamente, inclusive os móveis derivados da Páscoa (Carnaval, Sexta-feira Santa, Corpus Christi). Classifica cada sessão em: dentro, prolongou, antecipou, dia sem expediente ou horário não informado. É informação de gestão — escala, sobreaviso, carga do plenário —, não de mérito.

### Cor da espécie de resultado
Cor de fundo da etiqueta de cada espécie, editável por órgão. Vale na tabela, na ficha, nos relatórios e no gráfico de espécies. O administrador escolhe uma cor; texto, borda e a variante de tema escuro são calculados a partir dela, de modo que qualquer escolha continue legível.

### Modelo de relatório dinâmico
Desenho salvo de uma tabela dinâmica ou de um relatório descritivo (`jurimetriaTemplates`). É do **órgão**: qualquer membro aplica qualquer modelo, mas só quem criou — ou quem tem `configure_jurimetria` — pode editar ou excluir. Antes ficava no `localStorage` de cada navegador.

### Realização (da sessão)
Se a sessão **aconteceu**: `realizado`, `redesignado` (remarcada para nova data) ou `cancelado` (sem nova data). É um plano anterior ao da espécie de resultado, que diz o que o julgamento produziu. Por padrão, painel e relatórios contam **apenas as realizadas** — os demais continuam na base e na tabela. Júri gravado antes do campo é lido como `realizado`.

### Histórico de datas (`date_history`)
Registro, dentro do próprio júri, de toda alteração da data da sessão: data anterior, nova data, realização que a motivou, justificativa, autor e momento. Gerado por qualquer caminho que mude a data (edição, redesignação, cancelamento, correção em massa, importação). Visível na ficha do júri e no modal de edição.

### Opções de análise
Como o recorte é **contado**, em oposição aos filtros, que definem o que **entra** no recorte: "somente sessões realizadas" (ligada por padrão) e "ignorar (não informado)". Valem no Painel, nos Relatórios e nos Relatórios dinâmicos; nunca escondem um registro da tabela de júris. Ficam gravadas por órgão no navegador e a legenda dos documentos exportados declara o critério usado.

### Atualização (importação)
Linha cujo processo **já existe** no órgão e cuja planilha preenche campos que estavam **vazios** no banco. É ganho puro de informação: aplica-se sob qualquer política, ao contrário do *conflito*, em que a planilha traz valor diferente de um já gravado.

### Dissolução
Sessão desfeita sem julgamento de mérito (conselho dissolvido). **Conta no total** de júris do período, mas **fica fora** do cálculo de espécies, matérias e aproveitamento. Quais espécies são tratadas assim é configurável (`dissolucaoResultados`); marcá-las fixa o peso em 0.

### Júris efetivos
Total de júris menos os dissolvidos. É o denominador de todos os percentuais de espécie e do aproveitamento.

### Aproveitamento (ponderado)
`Σ peso[resultado] / nº de júris efetivos`. Cada espécie tem um peso de 0 a 1 na tabela de pontuação do órgão (`jurimetriaSettings.pontuacao`). Sem efetivos, o resultado é `null` (exibido como "—"), que é diferente de 0%.

### Tabela de pontuação
Mapa espécie → peso (0 a 1), editável em *Painel Administrativo → Jurimetria → Pontuação*. Alterá-la recalcula todos os relatórios na hora, sem tocar em nenhum júri gravado.

### Colunas do órgão (Jurimetria)
Campos próprios criados pelo admin além dos nativos (`jurimetriaSettings.customFields`). Os valores ficam em `juris/{id}.values`. Aparecem no cadastro, na tabela, nas exportações, como dimensão nos relatórios dinâmicos, e a importação passa a reconhecer colunas da planilha com o mesmo nome.

### Política de importação
O que fazer quando o mesmo processo chega com dados **divergentes**: `preserve` (padrão — o banco vence, a divergência só é listada) ou `update` (a planilha vence, campo a campo, com registro no histórico). Não se aplica às *atualizações* (lacunas preenchidas), que valem em qualquer política. Célula vazia na planilha nunca apaga dado gravado.

### Rigor da correção automática (`fuzzyThreshold`)
Similaridade mínima (0,4 a 1) para a importação corrigir um valor para a lista oficial do órgão — ex.: "PORTO ALEGRE" → "Porto Alegre (0001)". Em 1, só a grafia exata é aceita.

## Módulo Panorama (flag `panorama_enabled`)

Documentação completa em `PANORAMA.md`.

### Base (Panorama)
Conjunto analítico de um órgão, em `panoramaBases/`. Diferente de todos os outros módulos, **o esquema não é fixo**: as colunas da base vêm da planilha importada. Um órgão tem quantas bases quiser, cada uma com suas colunas, seus pesos e sua regra de prescrição.

### Papel semântico
O significado que o órgão atribui a uma coluna sua. É a ideia central do módulo: a Jurimetria pergunta "qual é a comarca?" e por isso só serve ao júri; o Panorama pergunta "qual coluna faz o **papel** de unidade territorial?" — e aí serve a qualquer matéria. São dez: `identificador`, `data_principal`, `data_referencia`, `unidade`, `responsavel`, `assunto`, `desfecho`, `situacao`, `valor`, `prazo`. Nenhum é obrigatório; cada um destrava um conjunto de análises, e o que não foi mapeado simplesmente não aparece na tela.

### Inferência de colunas
Leitura automática da planilha que mede cada coluna (tipo, quantos distintos, quantos vazios, amostra) e propõe um papel combinando **nome** e **conteúdo**. É proposta, não decisão: a tela de mapeamento existe para o órgão corrigir. Mora em `functions-v2/src/shared/panorama.ts`.

### Dimensão derivada
Eixo de análise que não é coluna: `__mes`, `__ano`, `__trimestre` (existem quando há data principal), `__regiao` (quando há regiões definidas) e `__prescricao` (quando a prescrição está ligada).

### Desfecho sem mérito (`desfechos.neutros`)
Desfecho que o órgão marcou como não sendo solução de mérito — declínio de atribuição, arquivamento por ilegitimidade. Conta no total de casos e fica **fora** do cálculo de efetividade. É o análogo genérico da dissolução na Jurimetria, mas definido por cada órgão, não pelo código.

### Região (Panorama)
Agrupamento nomeado de unidades territoriais (`base.regioes`), montado pelo órgão no painel administrativo. Uma unidade pertence a uma única região. Qual comarca está em qual região é decisão do órgão — não há como deduzir do dado.

### Prescrição (Panorama)
Três modos: `desligado`; `coluna` (a planilha já traz a data-limite); ou `prazo` (calculada a partir de um prazo em anos, com prazo padrão e prazos por assunto, contando da data principal ou da data de referência). As faixas de alerta em dias definem o que é crítico, em alerta e atenção. Os prazos são definição jurídica do órgão, não dado inferível.

### Gargalo (Panorama)
Acúmulo de registros na mesma `situacao`, com idade média, mediana e o mais antigo. Responde ao que o painel não mostra sozinho: não "quantos casos existem", e sim "quantos estão parados na mesma etapa, e há quanto tempo".

### Concentração (Panorama)
Quanto do volume está nas primeiras posições de uma dimensão: top 3, top 10 e quantos grupos são precisos para chegar à metade. É a leitura que separa "força-tarefa em três comarcas resolve" de "o problema é estrutural e está espalhado".

### Modelo de relatório (Panorama)
Desenho salvo de tabela dinâmica ou de relatório descritivo (`panoramaTemplates`), por base. Todo o órgão usa os modelos de todos; só o autor e quem tem `configure_panorama` edita ou exclui — verificado no servidor.

---

