# Histórico de mudanças

Principais entregas do SIGO, da mais recente para a mais antiga. O detalhe de
cada mudança está nas mensagens de commit (`git log`).

---

### 27/11/2026 — Processo Eletrônico: usabilidade das listas, do processo e das janelas
- **Listas** com uma linha só para todas (`LinhaProcesso.jsx`): número, assunto
  (link, abre em outra aba com Ctrl+clique), tipo e partes, fase, unidade e com
  quem está. A busca, os filtros e a ordem ficam guardados ao voltar de um
  processo, e a lista volta ao ponto em que estava. Ordenação nova (prazo mais
  próximo, há mais tempo na unidade, mais antigos), "/" para buscar e as
  situações "Comigo" e "Sem responsável".
- **Novo processo** abre com o tipo usado da última vez e na unidade da
  primeira fase do rito; arquivos com seletor em português e arrastar e soltar
  (também no Novo documento e no portal).
- **Dentro do processo**, a tela é só dele (sem a barra de páginas e o
  cabeçalho da lista). O menu "Mais" passou a rolar quando não cabe na tela:
  em telas baixas os primeiros itens ficavam fora de alcance.
- **Janelas de ação** dizem o que falta para confirmar, não fecham com texto
  digitado num clique fora, e confirmam com Ctrl+Enter.
- **Celular**: sem rolagem lateral no processo e no portal, abas numa linha,
  menos cabeçalho antes do conteúdo.
- **Segunda rodada, no mesmo dia:** fase interrompida por pendência mostra
  "Fase interrompida: ver a pendência" no lugar do botão que faltava; o Painel
  diz "hoje" e "há N dias", mostra o assunto inteiro no celular e tem
  calendário mais baixo; o editor de minuta pede confirmação antes de fechar
  a aba com texto não salvo; a configuração aberta por atalho cai direto nas
  abas.
- **Terceira rodada, no mesmo dia:** editor de rito no celular com cabeçalho
  numa linha e rodapé em duas (eram cinco); cartão do tipo de processo corta a
  descrição em três linhas; a prévia do papel timbrado cabe inteira na coluna;
  ações da fase e pauta da sessão deixam de espremer o texto no celular; a
  janela da audiência diz o que falta para registrar e não fecha com clique
  fora depois de preenchida; itens da disputa em duas colunas no celular.
- **Quarta rodada, no mesmo dia:** filtros da lista em duas linhas no celular
  (eram três); na janela de julgamento, quem ainda não votou é avisado antes de
  proclamar; na reunião, Abrir votação fica apagado até a presença ser
  registrada, com o motivo escrito; na proposta do fornecedor, o CNPJ ou CPF é
  conferido ao digitar e a linha "Para enviar, falta ..." diz o que falta; a
  proposta e a sala de lances ficam mais curtas no celular.
- **Quinta rodada, no mesmo dia (julgamento da disputa):** classificação
  alinhada no celular; o fornecedor recusado deixa de aparecer "em 1º" e lê a
  própria oferta e o motivo; o aviso do vencedor declarado sai um item por
  linha; os campos com tamanho mínimo dizem quantas letras faltam.
- **Sexta rodada, no mesmo dia (o computador em primeiro lugar):** na lista, a
  barra de páginas do órgão some enquanto o menu lateral está aberto e os
  botões sobem para a linha do título, e a lista começa cerca de 150 px mais
  acima no notebook; em Nesta fase, a explicação de cada ação vai para linha
  própria e, em tela larga, o botão fica perto do texto; nos autos, os botões
  dizem o que fazem; descrição longa do tipo recolhida em Novo processo; no
  portal, o assunto ocupa a largura toda.
- **Sétima rodada, no mesmo dia (tema escuro no computador):** os textos cinza
  que quase sumiam no fundo escuro (listas vazias, ação já cumprida,
  "Carregando...") ficam legíveis; a legenda do fluxo do rito usa as cores do
  desenho no tema escuro; pauta vazia diz por que não dá para publicar.
- Teste de tela: `scripts/e2e-usabilidade-pe.mjs`.

### 25/11/2026 — Exportar o rito: Bizagi (BPMN), imagem, PDF, SVG, planilha e Mermaid
- Em Ritos, o menu do rito ganhou "Exportar (imagem, Bizagi, planilha)", e a
  tela de edição o botão "Exportar o rito". Seis formatos, todos gerados no
  navegador (`src/lib/exportarRito.js`, janela em `ExportarRito.jsx`).
- **Imagem, PDF e SVG** saem com o rito inteiro numa faixa só, do tamanho que
  for preciso: uma raia por unidade, nenhuma dobra, condições por extenso nas
  setas, cada seta chegando na sua própria altura. Opção de mostrar ou não as
  ações dentro de cada fase. O PDF é uma página única do tamanho do desenho.
- **Bizagi e BPMN 2.0** (.bpmn): piscina, raias, tarefas, desvios exclusivos,
  início e fins, fluxos com a condição no nome e o desenho (BPMNDI) de tudo; a
  orientação, o prazo e as ações de cada fase vão na documentação da tarefa.
- **Mermaid** corrigido: todo rótulo vai entre aspas (nomes com parênteses,
  barras ou dois-pontos quebravam o diagrama), com arquivo .mmd e Copiar.
- **Planilha** completa: unidade, prazo e contagem, ações, saídas, condições e
  orientação, mais a aba "Ações em detalhe".
- Planilha, Mermaid e BPMN voltam iguais pela importação do rito; o teste
  confere isso nos 70 modelos da biblioteca. A importação por planilha passou a
  aceitar nome de fase com "e", vírgula ou barra em "Segue para" e fase chamada
  "Encerramento".

### 25/11/2026 — Modelos de rito: fiscalização de emendas parlamentares (MPRS)
- Dois modelos novos na biblioteca, âmbito MPRS, área Ministério Público,
  ligados entre si. "Emendas parlamentares: diagnóstico por município (MPRS)"
  é o procedimento administrativo preliminar: requisita informações à
  Prefeitura e à Câmara, confere as bases públicas, responde às três perguntas
  do panorama e traz o checklist do MPRS como formulários (Câmara, Prefeitura,
  entidades e sinais de alerta); termina em arquivamento, recomendação com
  cronograma ou abertura do inquérito. "Inquérito civil de emendas
  parlamentares (MPRS)" vai do registro da origem e do juízo de atribuição ao
  arquivamento revisto pelo Conselho Superior ou à ação civil pública, com
  recomendação, compromisso de ajustamento, apuração de responsabilidade em
  inquérito de improbidade próprio e comunicação a outros órgãos.
- Seguem a ADPF 854 do STF, a Informação Técnico-Jurídica do CAOCIPP de
  15/01/2026, a complementação de 13/10/2026 e o que outros Ministérios
  Públicos vêm fazendo. A biblioteca passa a 70 modelos.

### 25/11/2026 — Panorama: correção do "INTERNAL" e base a partir do órgão
- Corrigido: criar uma base nova pela importação (e pela tela de bases)
  falhava com "INTERNAL". A definição das colunas levava campos `undefined`
  (coluna sem lista de valores), que o Firestore recusa. A gravação passa a
  ir em lotes que respeitam o tamanho máximo, e falha inesperada mostra o
  motivo em português.
- Novo: além de dados externos (planilha), o Panorama pode analisar dados
  internos — Consultas, Expedientes e/ou Parcerias do órgão, juntas numa base
  (com a coluna "Funcionalidade") ou uma para cada. Essa base é **ligada**:
  nada é copiado, o Panorama lê a funcionalidade ao vivo e cada registro novo
  ou alterado entra na análise na hora. Clicar num registro o abre na
  funcionalidade; o servidor recusa importar ou editar registros nela.

### 19/11/2026 — Fase de elaboração e exclusão dos autos com justificativa
- Nova opção da fase, "Fase de elaboração: quem está nela só prepara
  minutas". O que se redige ou anexa entra como minuta (sem perguntar), já
  cumpre a ação de documento da fase e segue inteiro com o processo na
  remessa. Assinar, pedir assinatura, juntar, guardar fora dos autos e
  Finalizar somem da tela e o servidor recusa. Excluir a minuta antes de
  seguir devolve a ação a pendente.
- Rito Consultas CAOCIPP: a Análise passa a ser fase de elaboração, e
  "Redigir ou anexar a minuta do parecer" é cumprida pela minuta do tipo
  Parecer. A Revisão, no Gabinete, segue decidindo o que vai aos autos.
- Desentranhar documento juntado e tornar ato sem efeito, na aba Eventos,
  com justificativa obrigatória e termo próprio. Podem quem praticou, o
  gestor da unidade, o admin e a unidade que decide, com o processo. Nada
  se apaga: no PDF fica uma folha de aviso no lugar ("fls. 7 a 9"); o
  portal mostra o aviso e não entrega o arquivo; a conferência pública diz
  que o documento saiu dos autos; o ato sem efeito fica riscado, com o
  número da certidão. Folhas e números de evento não mudam.

### 19/11/2026 — Eventos numerados sem saltos para as partes
- Só o ato que as partes veem recebe número inteiro, em sequência (1, 2,
  3…). O registro interno leva o número do último ato público antes dele
  (5.1, 5.2…). Nem no portal nem no PDF aparece salto que sugira ato oculto
  ou excluído.
- Vale na aba Eventos, em "Ler os autos", na busca, na impressão interna e no
  PDF dos autos (folha de dados, termos, índice e extrato). Registro "sem
  evento" não tem número. A ordem e a cadeia de hash não mudam.

### 19/11/2026 — Ação dispensada pelo dado do processo some da tela
- Na ação que só se marca, "Vem do processo" virou **Dispensada pelo
  processo**: com o campo preenchido (ex.: número do PGEA informado na
  autuação), a ação não é precisa. Ela some da tela, não é cobrada e não gera
  registro, porque não houve ato. Apagado o campo, volta a valer.
- Ação condicional que não vale neste processo deixou de aparecer apagada:
  sai da lista. Se depende de resposta ainda não dada na fase, a tela diz
  quantas podem aparecer.
- Ação de dado cumprida sozinha com o valor do processo sai da lista e fica no
  resumo "ações já resolvidas pelos dados do processo".
- Condição por campo do processo passou a ler o campo de registro de outro
  módulo como preenchido (antes contava como vazio).

### 19/11/2026 — Envio de arquivo que parava em 0%
- **Correção:** o arquivo enviado (minuta, juntada, petição no portal,
  documento da disputa, Word aberto no editor) ia do navegador direto ao
  Storage, e em rede que barra esse endereço o aviso ficava em "Enviando: 0%"
  sem erro e sem como cancelar. Agora todo arquivo sobe pelas funções: até
  4 MB numa chamada, acima disso em partes de 4 MB com progresso (até 50 MB).
  Teste pela tela com o Storage barrado em `scripts/e2e-salvar-editor-tela.mjs`.

### 19/11/2026 — Salvar minutas, modelos e timbrado de novo
- **Correção:** salvar pelo editor (minuta, modelo, papel timbrado, cabeçalho
  e rodapé no editor completo) falhava com "hasOwnProperty is not a
  function" e nada era gravado. O editor monta atributos sem protótipo e o
  SDK do Firebase não os envia; `paraEnvio` (`src/lib/paraEnvio.js`) agora
  copia todo pedido do Processo Eletrônico para objetos comuns.
- **Leitura dos autos:** o leitor contínuo já busca o próximo documento
  enquanto o atual está aberto.
- Teste de tela `scripts/e2e-salvar-editor-tela.mjs` salva pelo editor de
  verdade (o `e2e-editor.mjs` chama as funções direto e não pegava o erro).

### 19/11/2026 — Ritos de parcerias e convênios, e biblioteca separada por âmbito
- **Seis modelos novos**, na área nova "Parcerias, convênios e cooperação"
  (`src/lib/modelos/parcerias.js`): um rito de **formalização** (contato com
  os partícipes, problema e solução, estudo técnico, plano de trabalho,
  minuta, pareceres, aprovação, assinatura e publicação, com o que muda em
  cada instrumento) e um de **acompanhamento** (execução, fiscalização,
  relatório anual, aditivo, renovação, irregularidade, prestação de contas e
  encerramento) para o MPRS (Provimento 59/2011-PGJ e IN CAGE 4/2024), para o
  Estado do RS (IN CAGE 4/2024 e Decreto 53.175/2016) e para a União
  (Decretos 11.531/2023 e 10.426/2020 e Portaria SEGES/MGI 3.506/2025). A
  biblioteca passa a 68 modelos.
- **Encaixe no Painel de Parcerias.** O rito de formalização do MPRS move a
  parceria pelas colunas e leva à ficha tudo o que cada coluna exige
  (`docs/PARCERIAS.md`, seção 9; Guia do rito, parte 22). Um teste falha se
  o rito deixar de cobrir o painel.
- **Biblioteca por âmbito.** Todo modelo tem âmbito (MPRS, Estado do RS,
  União, Ministério Público em geral, conselhos e entidades de classe,
  qualquer órgão), em `MODELOS_POR_AMBITO`. A tela agrupa por âmbito e,
  dentro dele, por área; há filtro de âmbito, a busca acha pelo âmbito e o
  "Qual modelo usar?" pergunta o órgão. A parceria com organização da
  sociedade civil passou para a área de parcerias.
- Catálogo regenerado, com tabela por âmbito. Pesquisa e pontos a conferir
  em `/mnt/project-files/modelos-rito/pesquisa-parcerias-convenios.md`.

### 18/11/2026 — Papel timbrado com as ferramentas dos modelos
- **Timbrado do órgão e da unidade** ganha o mesmo editor dos modelos:
  papel e margens, cabeçalho e rodapé completos (texto, imagens, tabelas,
  "fl. X de Y", em todas as páginas, só na primeira ou menos na primeira),
  número de página, estilos e numeração. As linhas simples continuam.
- **Vale por baixo de todo documento** (`documento.layout`, aplicado por
  `comTimbrado` no PDF dos autos, no Word e no editor): o modelo ou o
  documento muda só o que quiser; cabeçalho e rodapé "da unidade" seguem o
  do timbrado. A unidade com timbrado próprio não herda o layout do órgão.
- Prévia da folha com texto de exemplo e **Ver em PDF** antes de salvar
  (`previaModelo` aceita `timbrado`).
- O layout guarda valores explícitos iguais ao padrão (A4, todas as
  páginas…), para o documento poder voltar ao padrão por cima do timbrado.

### 18/11/2026 — Parte externa: representante qualificado, documento por polo e tipos de petição
- **Representante com qualidade e inscrição.** Ao convidar o representante
  de uma parte, a equipe informa se ele é advogado, defensor público,
  procurador do ente público, representante legal ou preposto, e a
  inscrição (a da OAB é obrigatória para advogado). Quem depende de
  procuração ou de ato de representação só recebe o acesso com a
  conferência marcada, que fica no registro. O que ele protocola sai
  assinado com a qualificação.
- **Documento visível só a um polo.** Na juntada, "Portal das partes" ganha
  "Só para" cada polo com parte no processo. As demais partes não veem o
  documento, o andamento da juntada nem o aviso por e-mail, e ele só
  acompanha comunicação a esse polo.
- **Cada polo vê só as próprias petições** (opção do tipo de processo, em
  Partes). Serve à negociação: a proposta de um lado não vai ao outro. O
  portal avisa a parte de que a petição é reservada.
- **Tipos de petição do órgão** (Listas do órgão): somam-se aos do sistema
  no portal. Também entram pela importação de arquivo.
- **Modelos atualizados**: as tratativas e o acordo completo (MPRS) passam a
  aceitar o ente lesado como parte, com as petições reservadas por polo.
- Guia do rito (parte 18) e tutorial atualizados.

### 18/11/2026 — Cronograma de obrigações (parcelas com alerta e comprovante pelo portal)
- **Nova opção em "O que pede"**, para qualquer rito: **Registrar um
  cronograma de obrigações**. Na tela do processo, "Montar cronograma" gera
  parcelas iguais (quantidade, primeiro vencimento, periodicidade, valor de
  cada uma ou total a dividir) e aceita obrigações avulsas, com ou sem
  valor. Cada uma vira um prazo do processo, com alerta de vencimento.
- **A parte comprova pelo portal**: vê o andamento do cronograma, o valor e
  o vencimento de cada obrigação e o botão "Enviar comprovante". A equipe
  confere e encerra a obrigação como cumprida.
- **Outra opção nova: Esperar o cumprimento do cronograma.** A ação mostra
  quantas obrigações foram cumpridas, quantas estão atrasadas e a próxima,
  e se cumpre sozinha quando a última é cumprida. Obrigatória, segura a
  fase até o cumprimento integral.
- **Botão "Cronograma"** em "Pendências e prazos", para processo de qualquer
  rito, mesmo sem a ação (um parcelamento, um ajustamento de conduta).
- **Modelos atualizados**: o acompanhamento do acordo de não persecução
  civil e o acordo completo (MPRS) registram o cronograma no início e só
  chegam ao "Cumprimento integral" com todas as obrigações cumpridas.
- Guia do rito (parte 3), tutorial e filtro "Cronograma de obrigações" na
  biblioteca de modelos.

### 18/11/2026 — Ação "Abrir um processo derivado" no rito
- **Nova opção em "O que pede"**, para qualquer rito: **Abrir um processo
  derivado**. Na tela do processo, a ação mostra o botão "Abrir processo",
  que leva ao "Novo processo" com o processo atual como origem e, se o rito
  sugerir, o tipo já escolhido (pelo nome do tipo ou do rito que ele usa).
- **Cumpre-se sozinha.** Criado o processo, a ação fica cumprida no
  processo de origem, com o número do derivado. Com duas ações destas na
  fase, a sugestão diz qual delas o processo novo cumpre. "Já existe"
  registra um processo que já estava ligado; processo sem ligação é
  recusado.
- **Modelos atualizados** para usar a ação: Inquérito Civil, inquérito de
  improbidade e tratativas do acordo (MPRS), gestão contratual e contrato
  do MPRS (apuração de infração e descumprimento contratual).
- Guia do rito (parte 3), tutorial e filtro "Processo derivado" na
  biblioteca de modelos.

### 18/11/2026 — Acordo de não persecução civil e inquérito de improbidade (MPRS)
- **Quatro modelos novos na biblioteca (agora 62)**, pelo Provimento
  27/2026-PGJ e pela Resolução CNMP 306/2025, lidos na íntegra: "tratativas
  e celebração" (da sinalização à homologação judicial, em sigilo, com
  recusa e pedido de revisão, oitiva do ente lesado e aprovação do Conselho
  Superior em até 60 dias); "acompanhamento do cumprimento" (do registro do
  acordo firmado ao cumprimento integral, ou ao vencimento antecipado com
  execução, ação ou remessa ao órgão de execução responsável); "das
  tratativas ao cumprimento" (os dois num processo só); e "Inquérito civil
  de improbidade administrativa (MPRS)", com a prescrição, os 365 dias
  prorrogáveis uma vez e a manifestação do investigado da Lei 8.429/1992.
- **Inquérito Civil geral ligado ao acordo.** A instrução ganhou a saída
  "Acordo de não persecução civil", que manda abrir os processos derivados
  de tratativas e de acompanhamento. O modelo de ajustamento de conduta
  avisa que, em improbidade, o instrumento é o acordo (a Resolução CNMP
  306/2025 revogou o art. 1º, § 2º, da Resolução 179).
- **Partes externas.** O celebrante é parte, o advogado ou defensor é
  representante dele, e o ente lesado é interessado só no acompanhamento:
  as tratativas são confidenciais até a homologação.
- **Próximas etapas do plano:** cronograma
  de obrigações com comprovação pelo portal e visibilidade por polo.

### 18/11/2026 — Cabeçalho, rodapé, número de página e imagens nos modelos (etapa 2 de 2)
- Nova aba **Cabeçalho e rodapé** em Página: cada um pode ser o timbrado da
  unidade, um **próprio do documento** (texto, logotipo, tabela, com fonte,
  tamanho e alinhamento livres) ou nenhum, e aparecer em todas as páginas, só
  na primeira ou em todas menos a primeira. "Número da página" e "Total de
  páginas" entram como campos ({{pagina}}, {{paginas}}).
- **Número de página** no rodapé ou no cabeçalho, à esquerda, ao centro ou à
  direita, em "Página 1 de 5", "Página 1", "1", "1/5" ou "– 1 –", com tamanho
  e a opção de não numerar a primeira página.
- **Imagens**: arrastar os cantos redimensiona; largura exata em cm.
- **Prévia em PDF** e **Word** do modelo, direto do editor de modelo, sem
  salvar.
- PDF dos autos e Word saem como a tela; no Word, cabeçalho e rodapé são os
  nativos, com "Primeira página diferente". Documento sem essas opções não muda.

### 18/11/2026 — Página e estilos nos modelos de documento (etapa 1 de 2)
- O editor de modelos e minutas ganhou o botão **Página**: papel (A4, Ofício,
  Carta, A5), retrato ou paisagem e margens em cm, com margens prontas (SIGO,
  ABNT, Word, estreitas) e prévia da folha.
- **Estilos** como no Word: Texto normal, Títulos 1 a 4 e Citação se ajustam
  (fonte, tamanho, negrito, itálico, sublinhado, maiúsculas, cor,
  alinhamento, recuos, espaços) e o documento pode ter estilos próprios
  ("Ementa", "Assinatura"), criados a partir do parágrafo atual.
- **Numeração automática** de títulos (1., 1.1. ou I., 1.) e de parágrafos
  (botão #, em 1., 1), 1 – ou 1º); **listas** com marcador •, ◦, ▪ ou
  travessão e numeração 1, a, A, i, I com ponto ou parêntese e início
  escolhido; **recuos exatos** em cm, inclusive à direita.
- Fontes novas: Georgia, Garamond, Open Sans e Lato.
- A formatação fica no próprio texto: o modelo passa para a minuta e o PDF
  dos autos e o Word (.docx) saem iguais à tela. Documento sem essas opções
  não muda.

### 18/11/2026 — Versões federal e do Estado do RS dos ritos de sanção e de bens
- **Três modelos novos na biblioteca (agora 58).** "Sanção a fornecedor no
  Estado do RS: apuração e registro no CFIL/RS" (Lei 14.133 com a Lei
  estadual 11.389/1999, o Decreto 42.250/2003 e a IN CAGE 2/2003); "Bens
  móveis inservíveis no Estado do RS" (Decretos 57.408/2023 e 58.685/2026,
  com o Programa Sustentare); e "Bens móveis inservíveis na administração
  federal" (Decreto 12.785/2025, que revogou o 9.373/2018).
- **Modelos gerais revistos.** A sanção a fornecedor explica o registro no
  CEIS e no CNEP pelo Decreto 11.129/2022 (quem registra, quando e o quê).
  Os modelos de gestão de contrato dizem que o Decreto 11.246/2022 e as
  instruções da SEGES são do Executivo federal e servem de referência aos
  outros entes. O de bens patrimoniais aponta os modelos por esfera.
- **O que não foi criado, e por quê.** Gestão de contrato estadual: o
  Executivo do RS não tem regulamento de gestor e fiscal, só os decretos de
  licitação e de contratação direta. Gestão de contrato e sanção federais:
  os modelos gerais já seguem as normas federais. O Decreto estadual
  57.916/2024 (leilão) não pôde ser lido e está marcado para conferir.

### 18/11/2026 — Data de entrada própria do aditivo
- A data de entrada do aditivo é a dele (dia em que chegou a informação que
  o originou, ou hoje), nunca a do original. O servidor recusa data anterior
  à entrada do original e data futura, na criação e na edição do aditivo; a
  tela de criação explica a regra e limita o calendário. O padrão "hoje"
  passa a ser o dia em Brasília.

### 18/11/2026 — Ritos do MPRS para contratos e bens, e painel em todo modelo
- Três modelos novos na biblioteca (agora 55), pelas normas internas do
  Ministério Público do RS. **Gestão de contrato no MPRS** (Provimentos
  104/2023 e 05/2023-PGJ): empenho, Unidade de Contratos, assinatura
  eletrônica, Diário Eletrônico, Licitacon e PNCP, gestor e fiscais,
  pagamento com lista de checagem, aditivo aprovado pelo Diretor-Geral,
  prorrogação pedida 45 dias antes, reajuste por apostila, verificação anual
  da habilitação, extinção e encerramento. **Descumprimento contratual no
  MPRS** (arts. 89 a 98): instauração pelo fiscal, defesa em 15 dias úteis ou
  comissão processante, decisão do Diretor-Geral ou do Subprocurador-Geral
  para Assuntos Administrativos, recurso, CFIL/RS, CEIS e cobrança, com a
  multa de até R$ 250,00 sobrestada. **Bens móveis no MPRS** (Provimentos
  55/2022 e 02/2009): tombamento, Termo de Responsabilidade, inventário com
  as datas de 31/07 a 31/10, conferência de 30 dias do novo titular,
  movimentação, perda, furto ou dano com a tabela de indenização, triagem,
  cessão de uso, Comissão Permanente de Avaliação e baixa.
- **Todo modelo com painel e planilha opcionais.** Cada um dos 55 modelos
  traz o nome sugerido do painel. Na revisão de um rito novo, um quadro em
  destaque pergunta se o órgão quer ligar: "Ligar: criar painel e planilha"
  ou "Seguir sem painel", com o que cada escolha faz e como ligar depois.
- O painel gerado na revisão já recebe os processos: o tipo de processo
  criado com o rito nasce com "Criar registro na autuação" apontando para a
  página gerada (número e assunto), conferido no servidor ao implantar.
- **Revisão no mesmo dia.** No contrato do MPRS, o descumprimento apontado
  na verificação anual da habilitação volta à fiscalização (antes ia ao
  ateste de um período); a equipe ganhou a fiscalização administrativa e o
  fiscal público usuário; a análise do gestor explica a diferença entre os
  Provimentos 05/2023 e 104/2023 sobre a advertência. Os modelos gerais de
  contrato continuado e de sanção a fornecedor apontam para os do MPRS. O
  tutorial ganhou três receitas (contrato, bens e painel), e o Guia do rito
  (parte 16), o Guia de implantação e o glossário falam do painel opcional.
  Novo `scripts/e2e-painel-modelo.mjs`, com a tela, do modelo à autuação.
- **Decreto 57.408/2023 e manual do CFIL/RS lidos.** Os dois textos que
  estavam marcados "conferir" entraram nos ritos do MPRS. No descumprimento
  contratual, a fase de publicação diz o que o CFIL/RS pede (procedimento,
  contrato ou empenho, inciso do art. 155, data e página da publicação), quem
  cadastra, a carga mensal ao CEIS e a baixa automática ao fim do prazo, e
  ganhou a juntada do comprovante. No contrato, a consulta ao CFIL/RS antes
  da assinatura vem com a regra e o comprovante. Nos bens móveis, o decreto
  do Executivo entra como referência: o antieconômico, a preferência por
  outro órgão público, os motivos de doação e a ata da eliminação.

### 18/11/2026 — Gestão contratual completa e gestão de bens patrimoniais
- Dois modelos novos na biblioteca (agora 52). **Gestão contratual completa:
  da assinatura à extinção** (Lei 14.133): assinatura, garantia, PNCP,
  designação, fiscalização, recebimento, pagamento e, a partir de cada
  pagamento, os eventos do contrato (aditivo, apostila, prorrogação,
  reequilíbrio, subcontratação, controvérsia e extinção), com remessa a
  processo derivado de apuração de infração, avaliação de desempenho e
  encerramento.
- **Gestão de bens patrimoniais: do tombamento à baixa**: entrada,
  tombamento, carga, inventário, movimentação, manutenção, reavaliação,
  cessão, extravio ou dano, inservível, reaproveitamento, alienação e baixa.
- Todo modelo da biblioteca gera um painel que o servidor aceita (teste).

### 18/11/2026 — Painel e planilha gerados a partir do rito
- Em "Integração com o painel", **Gerar painel e planilha**: o SIGO monta uma
  página própria com uma coluna por fase do rito e um campo por dado que as
  ações pedem, mostra antes de criar e liga o rito a ela (cada fase move o
  cartão, cada ação leva o dado à ficha).

### 18/11/2026 — Integração do rito com o painel
- O editor do rito mostra as colunas com o nome do quadro (Em Análise,
  Aguarda Terceiros, Arquivados), não mais o nome interno da situação.
- **Integração com o painel**, no editor do rito: coluna por coluna, a fase
  que põe o cartão nela e de onde vem cada informação que ela pede (o
  sistema, uma ação ou falta), com as ligações reconhecidas pelos nomes e o
  botão Aplicar. O que falta vira uma ação obrigatória na fase certa.
- **Leva ao painel**, em cada ação que pede um dado: o dado vai para a ficha
  da consulta, do expediente, da parceria ou do registro da página, com
  entrada no histórico.
- **Criar registro na autuação** agora cria também a consulta ou o
  expediente, com os dados do processo.
- A capa do processo avisa quando o rito conduz um painel e nenhum registro
  dele está ligado. Guia do rito, parte 21.

### 17/11/2026 — Aditivos em Consultas e Expedientes
- **Criar aditivo** na ficha de qualquer consulta ou expediente, em qualquer
  fase, ou direto do aviso de número já existente no cadastro. Pode haver
  vários por procedimento.
- O aditivo é um card novo, com o mesmo nº do PGEA e a identificação copiada,
  que entra em **Pendente** e percorre todas as fases com linha do tempo
  própria. O original não muda: se arquivado, continua arquivado; se em
  andamento, os dois tramitam em paralelo.
- Selos **Original · N aditivos** e **Aditivo N** nos cards, na tabela e na
  exportação; na ficha, a seção *Original e aditivos* mostra a fase e o
  responsável de cada um e abre qualquer deles.
- O número do aditivo acompanha o do original; original com aditivos não é
  excluído antes deles.

### 17/11/2026 — Nº do PGEA em Consultas e Expedientes
- O campo passa a se chamar **Nº da Consulta - PGEA** e **Nº do Expediente -
  PGEA** (cadastro, edição, tabela, quadro e exportação); o botão das
  Consultas agora é **+ Adicionar Consulta**.
- Ao digitar o número num cadastro novo, o SIGO confere no servidor se ele já
  existe no banco do órgão, arquivados inclusive. Número novo ganha o sinal de
  certo verde; número existente mostra a fase, o responsável e o botão para
  entrar no procedimento.

### 17/11/2026 — Listas do órgão por arquivo e exclusão de vez na lixeira
- **Listas do órgão › Importar de arquivo**: texto, CSV, JSON, Word,
  LibreOffice, Excel ou PDF (até 5 MB), ou texto colado. O servidor lê o
  arquivo, separa os itens de cada lista (por título, coluna, aba ou chave do
  JSON) e mostra uma prévia: dá para corrigir o nome, trocar a lista, marcar
  o gênero e desmarcar. Itens que já existem ou se repetem não entram; nada
  é gravado antes de "Inserir".
- **Lixeira › Excluir de vez** (só o admin): apaga para sempre ritos, tipos,
  modelos e processos que já estão na lixeira. Processo pede o número
  digitado. O sistema recusa o que ainda é usado (tipo com processos,
  processo citado em ata de sessão, com certame ou que deu origem a outro).
  Cada exclusão fica no Histórico, assunto "Lixeira".

### 17/11/2026 — Códigos numéricos na numeração dos processos
- A numeração própria aceita **Código do tipo**, **Código da unidade** e
  **Código do órgão interno** no lugar das siglas, cada um com 1 a 6 dígitos e
  zeros à esquerda. Ex.: `000007.001.002/2026` (sequencial, órgão, tipo, ano).
- Nova tela **Tipos de processo › Códigos**: um código fixo por item em cada
  seção, sem repetição, com a forma como sai no número, avisos de item sem
  código ou longo demais e um botão que numera os vazios em ordem.
- Processo cujo tipo, unidade ou órgão ainda não tem código não é autuado: a
  pessoa recebe o aviso para pedir o cadastro. Mudar um código não muda o
  número de processos já autuados.
- Os códigos aparecem nos cartões de tipos, unidades e órgãos internos e no
  histórico da configuração.

### 17/11/2026 — Custos e uso (etapa 10 de 10)
- **Uso do banco por dia** (leituras, gravações) nos últimos 30 dias contra a
  cota gratuita, com média, pico e dias acima; **chamadas às funções** do SIGO
  por dia.
- **Uso por órgão** em 30 dias, pelas ações registradas.
- **Alerta diário por e-mail** aos administradores da plataforma quando o dia
  anterior passa dos limites (nova rotina das 6h, acompanhada no diagnóstico).
- Custo em reais do faturamento na mesma tela, com passo a passo para criar
  um orçamento com aviso no Google Cloud.

### 17/11/2026 — Cópias e exportação (etapa 9 de 10)
- **Cópia de segurança diária do banco** ligada por um botão no painel, com
  retenção de 7, 14 ou 30 dias, e a lista das cópias guardadas. Passo a passo
  do console para ligar (se faltar permissão) e para restaurar, que sempre
  cria um banco novo.
- **Proteção contra exclusão do banco** por botão (sem custo).
- **Exportação de um órgão em .json** (todas as coleções, inclusive Processo
  Eletrônico e auditoria, com o histórico de cada registro) e **da
  configuração da plataforma**. Botão *Exportar dados* na ficha do órgão.
- Nada nesta seção apaga dado; cada ação entra na auditoria da plataforma.

### 17/11/2026 — Diagnóstico e saúde (etapa 8 de 10)
- **Rotinas agendadas com resultado:** cada uma das 5 rotinas automáticas
  grava início, duração e falha; o painel mostra se está em dia, atrasada ou
  falhou, com as 10 últimas execuções. A rotina de prazos das parcerias
  passou a registrar a falha em vez de engolir o erro.
- **Erros reais do servidor nas últimas 24 h**, lidos do Cloud Logging e
  agrupados por função, só das funções do SIGO. Antes, o painel adivinhava
  erros pelo nome das ações da auditoria.
- **Versão no ar** (commit do site e revisão das funções), tempo de resposta
  do banco e espaço dos arquivos enviados.
- Saiu a função antiga `getSystemHealth`.

### 17/11/2026 — Central de segurança (etapa 7 de 10)
- **Checklist com nota de 0 a 100:** quem administra (quantas pessoas, sem
  entrar há 90 dias, e-mail confirmado, código por e-mail), acesso por e-mail
  fixo, cópia diária do banco, recuperação dos últimos 7 dias e proteção
  contra exclusão (lidas do próprio Firestore), termos publicados, e App Check
  e chave de API, que a administração confirma depois de fazer no console.
- **Revisão de acessos:** último login, código por e-mail e e-mail confirmado
  de cada super-admin, e os acessos já retirados.
- **Auditoria da administração** com filtro por ação e período e exportação em CSV.
- **Retirar o acesso de super-admin vale na hora** (Functions e regras), sem
  revogar os tokens da pessoa, o que a desconectava dos outros apps do mesmo
  Firebase. A exclusão de órgão por super-admin passa a entrar nessa auditoria.

### 17/11/2026 — Cotas que valem de fato (etapa 6 de 10)
- **Cotas conferidas no servidor:** órgãos criados por pessoa, membros
  ativos por órgão (o convite para de aceitar entradas no limite) e linhas por
  importação de planilha. Antes, as cotas eram só gravadas e nada as aplicava.
- **Uso atual ao lado de cada limite**, com aviso a partir de 80%.
- Saíram do painel quatro valores que nunca eram aplicados (tamanho de página,
  retenção de auditoria, histórico embutido e ouvintes por sessão).
- Um teste trava o catálogo: toda cota precisa ser conferida em alguma Function.

### 17/11/2026 — Aviso para todos e modo manutenção (etapa 5 de 10)
- **Aviso para todos:** faixa no topo das telas e na tela de entrada, com
  tom, link, período agendado, prévia e opção de não poder ser fechada.
- **Modo manutenção:** com uma mensagem e a previsão de volta, só a
  administração da plataforma usa o sistema; os demais veem a tela de
  manutenção, que some sozinha quando a manutenção é desligada.

### 17/11/2026 — Identidade da plataforma e termos de uso com aceite (etapa 4 de 10)
- **Nome, cor e logo** da plataforma editáveis em *Identidade e termos*, com
  prévia ao vivo e conferência de contraste; valem no topo das telas, na tela
  de entrada e no nome da aba.
- **Tela de entrada:** título, texto de apresentação, rodapé e contato de
  suporte configuráveis.
- **Termos de uso versionados:** cada publicação ganha número e fica guardada;
  com aceite obrigatório, a pessoa vê os termos antes de qualquer tela e o
  aceite (versão e data) aparece na ficha dela.

### 17/11/2026 — Ficha de cada pessoa e bloqueio no SIGO (etapa 3 de 10)
- **Usuários só do SIGO:** a lista antes trazia todas as contas do login
  compartilhado (inclusive de outros sistemas). Agora mostra só quem tem
  vínculo com órgão, perfil no SIGO ou é super-admin, com busca e filtros
  (bloqueadas, sem órgão, sem acesso há 90 dias, super-admins).
- **Ficha da pessoa** (link próprio): órgãos e papéis (cada um leva à ficha
  do órgão), forma de entrada, e-mail confirmado, verificação em duas etapas,
  último acesso, termos aceitos e atividade recente. Na ficha do órgão, o
  nome do membro leva à ficha dele.
- **Bloquear e desbloquear no SIGO**, com motivo que a pessoa lê: não abre
  nenhum órgão, não usa o Portal das partes, não cria órgão nem entra por
  convite. O login não é desativado, porque é o mesmo de outros sistemas.
  Não bloqueia a si mesmo nem outro super-admin. Auditado.

### 17/11/2026 — Ficha completa de cada órgão (etapa 2 de 10)
- **Órgãos com busca e filtros** (todos, suspensos, com Processo Eletrônico,
  sem registros), em lista que cabe no celular. Antes, um órgão sem data de
  criação não aparecia na lista.
- **Ficha do órgão** (link próprio): situação, volumes de cada módulo,
  membros com papel e datas, páginas ligadas, contato e atividade recente.
- **Suspender e reativar o órgão inteiro**, com motivo que os membros leem:
  ninguém do órgão abre nem grava nada, as partes perdem o Portal e o convite
  para de funcionar; nenhum dado é apagado. Vale nas regras do banco e em
  todas as Functions (helper único `vinculoBloqueado`, travado por teste).
- **Trocar o criador** por um membro ativo; o anterior fica como
  administrador.
- Tudo auditado na plataforma e no órgão. Guia com receitas em
  `docs/ADMIN_PLATAFORMA.md`.

### 17/11/2026 — Administração da plataforma reorganizada (etapa 1 de 10)
- **Nova casa do painel do super-admin:** as 14 abas soltas viraram um menu
  lateral em cinco grupos (Plataforma; Órgãos e pessoas; Módulos; Operação e
  diagnóstico; Dados e custos), com seletor no celular, busca por palavra e
  link próprio para cada seção (`/Admin?secao=`).
- **Visão geral com pendências:** avisa o que falta na configuração inicial
  (chave e remetente de e-mail, faturamento, e-mail de recuperação do
  super-admin) e leva direto à seção que resolve; seguem os totais e um
  cartão por seção.
- Sete seções que dependiam das flags `admin_wave_2` e `admin_wave_3`
  aparecem sempre. A página passa a se chamar *Administração da plataforma*.
- Mapa único das seções em `src/lib/platformAdminSections.js`, com teste;
  guia novo em `docs/ADMIN_PLATAFORMA.md`.

### 16/11/2026 — Revisão de segurança após as entregas do dia
- **Membro removido perde o acesso na hora:** as regras e as Functions
  conferiam só se o vínculo existia, e quem era removido do órgão seguia
  lendo processos, expedientes, parcerias, bases e o órgão, e podia criar e
  editar registros pelas Functions (o admin removido, também a auditoria e as
  configurações). Agora vale só o vínculo ativo, em todas as regras e em
  todas as Functions que conferem o vínculo; o órgão some da lista de quem
  saiu.
- **Word, LibreOffice e planilha seguros ao abrir:** o pacote ZIP é
  conferido antes de ler (até 3.000 partes, 120 MB por parte, 300 MB no
  total), com cada parte descompactada sob teto. Um arquivo pequeno enviado
  no Portal podia esconder gigabytes e derrubar a função.
- **Super-admin por e-mail só com e-mail confirmado** (`email_verified`): o
  Portal aceita criar conta de e-mail e senha com qualquer endereço.
- **Dependências:** `sharp` 0.35.5 (falhas da libvips, libheif e librsvg ao
  tratar imagens enviadas) e `xlsx` 0.20.3 do CDN oficial da SheetJS
  (poluição de protótipo e ReDoS da versão do npm), no site e nas Functions.
- Cabeçalho `Content-Security-Policy` (`base-uri 'self'; frame-ancestors
  'none'`) e correção do nome do claim na migração `migrateMemberFunctions`.
- Documentação: segurança (regras, arquivos, dependências, limites abertos:
  área de espera dos envios e App Check), arquitetura, Processo Eletrônico,
  guia de desenvolvimento e funcionalidades.

### 16/11/2026 — Revisão de minutas no editor, como no Word
- **Qualquer minuta abre no editor:** Word (.docx), LibreOffice (.odt),
  .doc, PDF com texto e imagem são convertidos com fontes, cores, recuos,
  espaçamentos, listas, tabelas e imagens. Ao salvar, o arquivo original fica
  intacto em Versões.
- **Minuta assinada:** "Revisar" retira as assinaturas ao salvar, pede de novo
  a quem assinou e guarda a redação assinada em Versões.
- **Editor:** fontes com as medidas de Times, Arial, Calibri, Cambria e
  Courier (iguais no editor, no PDF e no Word), espaço antes e depois do
  parágrafo, imagem centralizada ou à direita, tabela sem bordas, estimativa
  de páginas, "Abrir arquivo" e "Word" (.docx).
- Documentos já juntados não mudam: o PDF continua com as fontes de antes.

### 16/11/2026 — Processo Eletrônico mais rápido e atualizado sozinho
- **Site em partes:** cada página e as abas pesadas são baixadas só quando
  abertas. A primeira visita deixa de baixar um arquivo único de ~1,6 MB
  (gzip): o comum a todas as páginas tem ~257 KB, a página do órgão ~433 KB
  e a lista do Processo Eletrônico ~600 KB. Firebase e React ficam em
  arquivos próprios, que seguem no cache entre um deploy e outro.
- **Servidor mais leve:** cada function carrega só o próprio módulo e as
  bibliotecas de PDF, Word e Excel só quando o ato as usa. Medido: a partida
  a frio do `secretariaProcesso` caiu de ~520 ms para ~150 ms e a memória
  de 131 MB para 77 MB.
- **Abrir processo:** pelo link, os autos são pedidos junto com a
  configuração do órgão; no servidor, movimentos, documentos e leituras são
  lidos em paralelo.
- **Atualização sozinha:** o que um colega ou uma parte faz (novo processo,
  tramitação, ato, documento, petição) aparece nas listas e no processo
  aberto em cerca de 2 segundos, sem recarregar. Novo documento
  `secSinais/{orgId}`, lido pelos membros do órgão.

### 16/11/2026 — "Vem do processo" em qualquer rito
- O editor do rito avisa a ação ligada a um campo que o tipo não tem (rito
  de outro órgão, campo removido ou de outro tipo de dado).
- O editor do tipo mostra, na aba Formulário, as ações do rito que vêm de
  cada campo, avisa o que deixou de funcionar e leva ao rito para aplicar
  as ligações sugeridas.
- A prévia do rito simula os campos ligados e mostra a ação cumprida
  sozinha. Guia do rito (partes 3, 5 e 17) explica tudo.

### 16/11/2026 — Ações que vêm do processo e documentos detalhados na entrada
- Ação da fase pode **vir do processo**: ligada a um campo do tipo de
  processo (ex.: "Informar o número do PGEA"), ela se cumpre sozinha quando
  o campo está preenchido, na criação ou depois, com registro nos autos.
  Apagar o campo desfaz; mudar refaz com o valor novo; o que a pessoa
  desfaz à mão o sistema respeita.
- Condição "campo preenchido / vazio": dispensa a ação que deixou de ser
  preciso (ex.: "Converter em PGEA" quando o número já veio).
- No editor do rito, **Ligações sugeridas** propõe as ligações pelo nome.
- Arquivo enviado na criação ou no processo abre na hora o detalhe: tipo,
  do que se trata, data do documento, juntar, guardar ou minuta, assinatura
  e portal. Entra na ordem, com a data e a hora do ato.

### 16/11/2026 — Juntada de documentos: arquivos maiores, original intacto e PDF no celular
- Envio de até **50 MB** por arquivo (era 5 MB), direto ao armazenamento,
  com barra de progresso; vale para o processo, o Novo processo, a petição
  do portal e a disputa de preços.
- O **original** fica exatamente como foi enviado (prova, com SHA-256), e
  compactado sem perda quando isso economiza espaço. As folhas dos autos usam
  uma **versão de leitura** leve: foto reduzida a 300 dpi e recomprimida sem
  perda perceptível, PDF reorganizado sem perda, Word já convertido. O
  conteúdo do arquivo precisa bater com o tipo informado.
- **PDF no celular:** o leitor dos autos, a prévia do editor e o documento
  da pendência desenham as páginas no próprio aparelho, com zoom e Baixar.
  PDF grande (mais de 15 MB) sai por link temporário.
- **Redigir documento:** a minuta com imagem pesada ou com lista dentro de
  tabela não salvava (limites do banco); o texto passa a ser gravado em JSON
  e, se grande, no armazenamento. O editor reduz as fotos coladas.

### 16/11/2026 — Tutorial completo para montar ritos
- O Guia do rito abre no **Tutorial**: passo a passo em 12 etapas, do
  planejamento à implantação, com perguntas e respostas em cada etapa e o
  que conferir antes de seguir.
- **Quero fazer…**: 58 situações com a ferramenta a usar, onde ela fica e o
  modelo da biblioteca que já faz assim, com busca e temas.
- **Qual modelo usar?**: indica os modelos da biblioteca pelo assunto, pelo
  contraditório, pela forma de decidir e pelo tamanho.
- Cada resposta leva à parte da **Referência** que explica a opção em
  detalhe. A Central de Ajuda descreve o tutorial.

### 16/11/2026 — Documentação de referência revista
- Visão geral, funcionalidades, arquitetura, segurança, glossário, guia de
  desenvolvimento, lógica processual, guia de implantação, catálogo de
  modelos, índice e README passam a cobrir sessões de julgamento e reuniões,
  disputa de preços, biblioteca da plataforma × cópia do órgão e pacote para
  outro órgão, com as rotas `/Portal`, `/Disputas`, `/Conferir` e
  `/MeusProcessosEletronicos` e as coleções novas.
- Na plataforma, a Central de Ajuda ganha "Sessões e colegiados", "Disputa
  de preços" e "Ritos e modelos do órgão", e o guia de implantação da tela
  explica como trazer o rito de outro órgão.

### 16/11/2026 — Levar rito e modelo de documento a outro órgão
- Em Ritos, "Exportar para outro órgão" baixa o rito inteiro, com todas as
  regras, as unidades e os modelos de documento que usa (com o texto) e o
  tipo de processo. No outro órgão, "Importar de outro órgão" abre a mesma
  revisão dos modelos da biblioteca: o que tem o mesmo nome é usado, o que
  falta é proposto para criar. O arquivo não leva nada que identifique o
  órgão de origem, e o servidor confere tudo de novo ao implantar.
- Em Documentos, cada modelo do editor também se exporta e se importa.
- Os modelos da biblioteca seguem sendo da plataforma: usar um cria uma
  cópia só do órgão, que não muda quando a biblioteca muda. Guia do rito,
  parte 20.

### 16/11/2026 — Relatório do colegiado, guia da secretaria e modelos com sessão
- Na aba Sessões, o Relatório do colegiado mostra, no período escolhido, as
  sessões realizadas e canceladas, os processos julgados por resultado e por
  relator, o que saiu da pauta sem julgamento, as vistas em atraso e o tempo
  médio até o acórdão, com download da lista em CSV ou Excel.
- A secretaria de cada colegiado vê um guia que confere o que já está pronto
  (composição, unidade, primeira sessão, pauta publicada, sessão realizada)
  e diz onde fazer o que falta.
- Biblioteca de ritos: novos modelos de recurso administrativo julgado por
  colegiado e de proposta de ato normativo ao conselho; a revisão de
  arquivamento do Conselho Superior e a comissão de ética pública passam a
  julgar em sessão; a contratação direta e a compra privada usam a disputa
  de preços. O filtro "Usa" mostra os modelos com sessão, disputa ou
  audiência.

### 16/11/2026 — Equipe da disputa e acompanhamento público
- Quem tem o processo designa, nos autos, o agente de contratação (ou
  pregoeiro), a equipe de apoio e a autoridade superior. Cada um recebe
  aviso e encontra a disputa em "Disputas em que você atua", no Processo
  Eletrônico, mesmo sem estar lotado na unidade.
- O agente conduz os lances e o julgamento; a equipe de apoio conversa com
  os licitantes; a autoridade superior adjudica e homologa. Sem equipe, tudo
  segue com quem tem o processo.
- Recurso em duas instâncias: o agente reconsidera ou mantém a decisão e
  encaminha à autoridade superior, que decide. As duas manifestações vão aos
  autos e à ata.
- Na dispensa eletrônica, qualquer pessoa com conta acompanha a sessão
  pública pelo link do aviso: o melhor lance de cada item, os avisos do
  agente, o julgamento e a ata, sem nomes até a declaração do vencedor.

### 15/11/2026 — Julgamento e resultado da disputa de preços
- Depois dos lances (ou da abertura, sem lances), a unidade julga item por
  item: desempate de microempresa e empresa de pequeno porte a até 5% da
  primeira, com 5 minutos para cobrir; negociação; pedido de proposta
  ajustada e de documentos, que o licitante envia pela própria disputa;
  aceitação e habilitação, ou recusa e inabilitação com motivo, chamando o
  próximo classificado.
- Declarado o vencedor (nos autos), abre a intenção de recurso por 10 a 60
  minutos, com razões e contrarrazões em 3 dias úteis cada e decisão
  fundamentada; provido o recurso, a unidade refaz o que ele alcançou.
- Adjudicar e homologar (ou declarar deserta ou fracassada) põe a ata da
  disputa nos autos e cumpre a ação do rito sozinho, com a certidão.
- A conversa da sala segue aberta durante o julgamento, também na disputa
  sem lances, e se encerra com o resultado.

### 15/11/2026 — Sala de lances da disputa de preços
- Na hora da abertura, abre a sala de lances, que fecha sozinha no fim do
  prazo pelo relógio do servidor. Quem cotou dá lances sucessivos, cada um
  melhor que o seu último e com o intervalo mínimo do aviso; todos veem o
  melhor valor e a própria posição, sem nomes.
- O licitante desfaz o último lance uma vez por item, em até 15 segundos. A
  unidade vê os licitantes por apelido, exclui com motivo o lance que
  compromete a disputa (todos recebem o aviso) e troca mensagens com eles.
- No fim, a classificação traz os nomes e o encerramento dos lances vai aos
  autos, com o melhor valor de cada item ou lote.
- A classificação mostra o desconto em percentual (antes saía como moeda).

### 15/11/2026 — Disputa de preços: cotação privada e dispensa eletrônica
- Décima primeira etapa do plano de sessões de julgamento, reuniões e pregão: a primeira da contratação.
- **Nova ação do rito, "Disputa de preços":** o rito escolhe cotação privada (só convidados) ou dispensa eletrônica (link público, IN SEGES/ME 67/2021). A ação se cumpre com o resultado (Homologada, Deserta ou Fracassada), que decide o caminho do rito.
- **Aviso:** objeto, itens (com valor estimado, lote e exclusividade para ME/EPP; dá para colar da planilha), menor preço ou maior desconto, por item ou por lote, orçamento sigiloso, abertura, intervalo entre lances, condições e habilitação. Publicado, vai aos autos; adiamento e cancelamento também, com motivo e e-mail a quem participa.
- **Prazo mínimo conferido no servidor:** 3 dias úteis na dispensa (IN 67/2021, art. 6º), 1 na cotação, em dia útil e horário comercial, com os feriados do órgão.
- **Página Disputas, do fornecedor:** convite por e-mail ou código do aviso, cadastro com CNPJ ou CPF conferidos, proposta por item, declarações e recibo. Até a abertura, atualiza ou retira; o órgão só sabe quantas propostas chegaram.
- Sem lances, a abertura mostra a classificação; com lances, a sala de lances vem na próxima etapa.

### 15/11/2026 — Sala da audiência
- Décima etapa do plano de sessões de julgamento, reuniões e pregão.
- **A audiência designada pelo rito agora acontece na plataforma:** no dia, quem tem o processo abre a sala pelo aviso no alto do processo.
- **Presença:** partes, quem as representa e os participantes da designação (testemunha, perito...), mais quem compareceu sem convocação (membro do Ministério Público, defensor nomeado, intérprete).
- **Registros em ordem:** manifestação, depoimento, requerimento, proposta de acordo, acordo, sem acordo, deliberação de quem conduz, documento apresentado, suspensão e retomada, cada um com a hora e quem registrou. A fala só vale para quem está presente.
- **Termo de audiência:** ao encerrar, o sistema lavra o termo (presentes, ausentes, cada registro e a hora do fim) e o manda à lista de documentos como minuta assinada, para a juntada. Se a audiência não se realizou, o termo diz o motivo. Excluir a minuta reabre a sala para corrigir.
- Encerrada, a audiência sai das próximas (também no portal) e não se cancela mais desfazendo a designação.

### 15/11/2026 — Reunião deliberativa
- Nona etapa do plano de sessões de julgamento, reuniões e pregão.
- **Reunião do colegiado sem processo:** ao marcar, escolha "Reunião deliberativa". A pauta é de assuntos (plano de trabalho, eleição, proposta), cada um com proponente, forma de votação (nominal, simbólica, secreta ou sem votação) e maioria exigida (simples, absoluta ou dois terços). Assunto incluído depois da convocação exige motivo; o adiado de outra reunião pode ser trazido para a pauta.
- **Na reunião síncrona:** presença, inscrição para a palavra com cronômetro, chamada do assunto, impedimento declarado pelo membro, abertura e apuração da votação, voto de qualidade do presidente no empate e encaminhamento de cada deliberação. A secretaria pode registrar o voto nominal dado de viva voz.
- **Voto secreto:** o sistema guarda só quem votou e a contagem, nunca o voto de cada um.
- **Na virtual:** cada membro vota no seu tempo; ao encerrar, o sistema apura, e o empate ou o assunto sem quórum vão para a próxima reunião.
- **Regras do colegiado:** quórum para deliberar e o que fazer no empate, na tela de Órgãos. A ata da reunião sai com a presença, o placar e o resultado de cada assunto; o painel ao vivo também serve à reunião.

### 15/11/2026 — Ata da sessão, painel ao vivo, presença e avisos
- Oitava etapa do plano de sessões de julgamento, reuniões e pregão.
- **No dia da sessão:** a secretaria marca a presença da composição, e o presidente ou a secretaria chamam cada processo. A tela da sessão de todos do colegiado se atualiza sozinha a cada voto, chamada ou resultado.
- **Painel ao vivo:** tela cheia para acompanhar ou projetar na sala, com o processo em julgamento, a ordem do dia e os resultados proclamados. Mostra quantos votaram, nunca o voto antes da proclamação, e não mostra o assunto de processo restrito. A parte não lê o painel.
- **Encerrar a sessão síncrona:** o que não foi julgado vai para a sessão seguinte, com os votos já dados e a certidão nos autos.
- **Ata:** ao encerrar (síncrona ou virtual), o sistema lavra a ata com a presença (na virtual, quem votou), o desfecho de cada processo, as sustentações orais e o redator de cada acórdão. A secretaria confere e ajusta; o presidente e a secretaria assinam, e depois da primeira assinatura o texto não muda. Dá para imprimir ou salvar em PDF.
- **Avisos e agenda:** a composição recebe aviso (sino e e-mail, conforme a preferência) da pauta publicada, do cancelamento e lembretes: véspera da sessão, abertura e último dia da votação virtual (este só para quem ainda deve voto). O botão "Adicionar à agenda" baixa o arquivo para o calendário, também no portal das partes.

### 15/11/2026 — Sessão virtual, destaque, sustentação oral e preferência
- Sétima etapa do plano de sessões de julgamento, reuniões e pregão.
- **Sessão virtual assíncrona:** a secretaria marca o primeiro e o último dia da votação, e cada membro vota no seu tempo. No dia seguinte ao último, às 7h, o sistema apura cada processo e encerra a sessão; o que fica sem resultado (sem o voto do relator, sem quórum) é adiado para a sessão seguinte. O presidente ou a secretaria podem apurar antes, logo depois do fim.
- **Destaque:** qualquer membro tira o processo da sessão virtual para uma sessão síncrona, onde o julgamento recomeça com o mesmo relator. A parte também pode pedir, até 48 horas antes do início, e o relator decide. O destaque vai aos autos.
- **Pedidos das partes pelo portal:** sustentação oral (na sessão virtual, gravada, pelo link), preferência, destaque e, durante a votação virtual, esclarecimento de fato. A parte acompanha a decisão e o motivo. Os julgadores veem os pedidos no julgamento; a secretaria confere e o relator decide o destaque.
- **Ordem do CPC:** um botão na pauta põe à frente os processos com sustentação oral, depois os com preferência e os que começaram em sessão anterior (CPC, art. 936).

### 15/11/2026 — Voto divergente, voto condutor e acórdão
- Sexta etapa do plano de sessões de julgamento, reuniões e pregão.
- Quem diverge pode escrever o **voto divergente fundamentado**, e quem acompanha com ressalva, a **declaração de voto**. Os pares leem durante a votação.
- Proclamado o resultado, o sistema define o **voto condutor**: o do relator, se venceu, ou o de quem primeiro divergiu para o resultado vencedor. O autor dele é o **redator do acórdão**, e o presidente pode designar outro.
- O redator escreve a **ementa e o acórdão** no prazo do colegiado (30 dias por padrão, ajustável no órgão), com um texto sugerido. Ao enviar, o sistema monta o documento com o relatório, o voto condutor, os **votos vencidos** e as declarações, assinado pelo redator, e a unidade junta aos autos.
- Na aba Sessões, cada julgador vê os **acórdãos que redige**, com o prazo. A pauta e a capa do processo mostram em que pé está o acórdão.

### 15/11/2026 — Vista, adiamento e conversão em diligência
- Quinta etapa do plano de sessões de julgamento, reuniões e pregão.
- Depois que o relator libera o voto, o membro do colegiado pode **pedir vista**. O julgamento fica suspenso, com o prazo do colegiado (10 dias por padrão, ajustável no órgão). Outros membros podem se juntar ao pedido, que fica coletivo.
- Com a **devolução da vista**, o processo vai sozinho para a próxima sessão do colegiado, com o mesmo relator e os votos já dados. Vencido o prazo, a secretaria ou o presidente requisita o processo.
- O presidente pode **adiar o julgamento**, com o motivo, e o processo segue para a próxima sessão. Pode também **convertê-lo em diligência**: o processo volta à unidade com a orientação na capa e, depois, vai a nova pauta com o mesmo relator.
- Cada um desses atos vai aos autos como certidão, e as partes recebem o aviso por e-mail. A pauta, a lista de aptos e a capa do processo mostram a vista e o adiamento.

### 15/11/2026 — Votação na sessão: relator, vogais e proclamação
- Quarta etapa do plano de sessões de julgamento, reuniões e pregão.
- A secretaria **designa o relator** de cada processo da pauta, entre o presidente e os titulares.
- O relator escreve o **relatório e o voto**, que só ele vê até **liberar aos pares**.
- Cada membro **vota na própria conta**: acompanha o relator, com ou sem ressalva, diverge ou se declara impedido ou suspeito. Dá para mudar o voto até a proclamação, e todos acompanham o placar ao vivo.
- O presidente **proclama o resultado** no dia da sessão. O sistema apura com a regra do rito, registra o julgamento no processo com a certidão nos autos, e a fase segue sozinha quando o rito manda.
- A pauta mostra o relator e a situação de cada julgamento, e avisa quem ainda não votou.

### 15/11/2026 — Julgador lê os autos pela pauta e anotações privadas
- Terceira etapa do plano de sessões de julgamento, reuniões e pregão.
- Quem compõe o colegiado **lê os autos** do processo pautado numa sessão dele, mesmo sem lotação, tocando no número do processo na pauta. A leitura vale até o acórdão, enquanto o processo segue no colegiado.
- O julgador vê os documentos juntados; minutas e documentos guardados fora dos autos não aparecem, e ele não pratica atos no processo.
- **Cada leitura fica registrada** (quem, quando, o quê), fora dos autos, e a unidade vê a lista em "Leituras pelos julgadores", na capa.
- **Minhas anotações**: todo mundo que lê um processo pode anotar para si. Só a própria pessoa vê; nunca vai aos autos nem às partes. A pauta marca onde você anotou.
- Quem só compõe o colegiado abre o Processo Eletrônico direto na aba Sessões.

### 15/11/2026 — Sessões de julgamento e pauta
- Segunda etapa do plano de sessões de julgamento, reuniões e pregão.
- Nova aba **Sessões** no Processo Eletrônico: a agenda dos colegiados, com as próximas sessões, as que você compõe, os rascunhos da secretaria e as realizadas ou canceladas.
- A secretaria do colegiado **marca a sessão** (data, hora, presencial, por vídeo ou híbrida), inclui os processos com julgamento pendente, organiza a **ordem do dia** arrastando e **publica a pauta**.
- Publicada a pauta, cada processo recebe a **certidão de inclusão em pauta** e as partes são avisadas por e-mail e veem o **julgamento marcado** no portal. Depois disso, só entra processo em **extrapauta** ou **em mesa**, com o motivo.
- Retirar da pauta e cancelar a sessão também deixam certidão com o motivo e avisam as partes. Registrado o julgamento, o processo aparece como julgado na pauta.
- O colegiado pode exigir uma **antecedência mínima** da pauta, em dias úteis ou corridos (Configurações, Estrutura).
- Quem compõe o colegiado vê a sessão publicada e a pauta, mesmo sem lotação; o rascunho fica só com a secretaria.

### 15/11/2026 — Composição dos colegiados
- Primeira etapa do plano de sessões de julgamento, reuniões e pregão.
- O órgão que decide em colegiado passa a ter a **composição**: presidente, vice, titulares e suplentes, cada um com a sua conta, o mandato e o que representa.
- Mandatos encerrados ficam guardados, como histórico de quem compôs o colegiado em cada data. O sistema recusa dois presidentes ao mesmo tempo e a mesma pessoa duas vezes no mesmo período.
- O **Registrar julgamento** já vem com os membros do dia do colegiado da unidade.

### 15/11/2026 — Julgamento colegiado no rito
- Nova opção de ação, **Julgar em colegiado (votos)**, para turma, câmara, comissão, conselho ou plenário.
- O rito diz os resultados possíveis, o quórum e quem desempata (o presidente, ou o resultado mais favorável à parte).
- Na tela do processo, **Registrar julgamento** pede a data da sessão e o nome, a função e o voto de cada membro; impedido, suspeito, ausente e abstenção não contam.
- O sistema apura o resultado, que decide a saída da fase, e emite a certidão de julgamento nos autos, com placar, relator e vencidos, vista pelas partes.
- 13 decisões de colegiado da biblioteca de modelos passaram a usar a nova ação.

### 15/11/2026 — 20 novos modelos de rito e biblioteca em grupos
- A biblioteca passou de 28 para 48 modelos. Os novos foram pesquisados nas normas de cada instituição:
  - OAB/RS: processo disciplinar no TED, revisão e reabilitação;
  - CAU: processo ético-disciplinar e fiscalização;
  - CNMP e MPRS: ajustamento de conduta, recomendação, audiência pública, revisão de arquivamento pelo Conselho Superior, destinação de valores, cadastro de entidade, triagem de patrimônio público e correição;
  - AGU: conciliação na CCAF, acordo e dívida ativa não tributária;
  - CGU: leniência, sindicância patrimonial, admissibilidade correcional e disciplinar de empregado público.
- Nova área: Advocacia pública e consultoria.
- Cada modelo diz em que instituição ou lei se inspira.
- A biblioteca em Novo rito:
  - virou uma seção que abre e fecha, com grupos por área;
  - ganhou busca sem acentos e com destaque, filtros por área, porte e inspiração, e cinco ordens;
  - mostra cada modelo numa linha compacta que se expande com os detalhes.

### 15/11/2026 — Guia do rito para todos
- O Guia do rito agora fica no alto da tela do Processo Eletrônico, para toda a equipe.
- Também fica na Central de Ajuda (link direto `#guia-do-rito`), para qualquer usuário da plataforma.
- Antes, ele só aparecia no editor de rito.

### 14/11/2026 — Tipo de processo que cria o registro
- O tipo de processo pode **criar um registro numa página própria** ao autuar
  (aba Dados, "Criar registro na autuação"): escolhe a página, a fase em que
  o registro nasce e de onde vem cada campo (número, assunto, descrição, data
  da autuação, unidade, tipo, partes, campo do formulário ou valor fixo).
- O registro nasce na mesma transação da autuação, validado pelas regras da
  página, ligado ao processo ("Criado na autuação" em Registros ligados) e é
  o que o rito conduz para essa página. Nada disso chega às partes.
- Tipo antigo segue igual. Guia do rito, parte 19.

### 14/11/2026 — Parcerias pelo rito e regra na autuação
- A fase do rito pode **conduzir a parceria ligada** pelo quadro de Parcerias
  (Pendente a Parcerias), com as regras do módulo: datas automáticas,
  responsável em "Em análise" e campos exigidos de cada fase. Se faltar algo,
  a parceria fica onde está e a equipe vê o motivo no processo. Parceria
  formalizada não volta pelo rito; a extinção continua no módulo.
- Na primeira fase, **Valer já na autuação**: a consulta, o expediente, a
  parceria ou o registro da página mudam de situação no momento da autuação.
- Rito antigo segue igual. Guia do rito, parte 8.

### 14/11/2026 — Listas do órgão
- Nova aba **Listas do órgão** na configuração: espécies de comunicação
  (edital, notificação extrajudicial), espécies de audiência (sessão de
  mediação) e origens do processo (ouvidoria, corregedoria) a mais, além das
  do sistema.
- Elas aparecem ao expedir comunicação, nos textos prontos, nas ações do rito
  que pedem comunicação ou audiência, na autuação, na retificação, na capa,
  no portal e nas condições do rito ("Origem é Ouvidoria").
- **Nome masculino**: os textos saem certos ("Responder ao edital", "ciência
  do edital", "edital expedido").
- Cada registro guarda o nome do item: renomear ou tirar um item não muda o
  que já foi feito. Guia do rito, parte 18; guia de implantação, passo 6.

### 14/11/2026 — Documentos e textos do rito
- Documento exigido (da fase ou da ação) com **assinaturas exigidas** (1 a 5)
  e, se quiser, **uma assinatura de quem tem certa atribuição** (ex.:
  Promotor). Sem elas, o documento não cumpre a exigência; quem a marca na
  juntada recebe o aviso do que falta. "Assinar antes de juntar" conta.
- Documento exigido que **fica fora do portal das partes**: juntado para
  cumprir a exigência, não aparece às partes, mesmo que quem junta escolha
  "Visível às partes". Só esconde, nunca mostra.
- **Frase de abertura da certidão conjunta**, no lugar de "Certifico que
  foram cumpridos os seguintes atos:".
- **Nome do botão que conclui a fase** (ex.: "Enviar ao relator") e
  **explicação para as partes**, que aparece no portal sob o nome da fase.
- Rito e processo antigos seguem como estavam. Guia do rito, parte 17.

### 14/11/2026 — Guia de implantação
- Novo botão **Guia de implantação** em Painel Administrativo > Processo
  Eletrônico: como mapear o processo real, escolher o modelo da biblioteca,
  a ordem de configuração (com atalho para cada aba), as garantias do
  contraditório e da ampla defesa e como o rito garante cada uma, cuidados
  do processo sancionador, processo interno sem partes, teste antes de usar,
  versões e a lista final antes de ativar.
- Mesmo texto em docs/GUIA_IMPLANTACAO.md.

### 14/11/2026 — Biblioteca de modelos de processo
- Em **Novo rito**, uma biblioteca de processos completos, com base na lei de
  cada área: administrativo geral, disciplinar (sindicância, PAD ordinário e
  sumário, TAC), ético (conselho profissional, entidade de classe, comissão de
  ética pública), sancionador (PAR, sanção a fornecedor, auto de infração,
  processo fiscal, multa de trânsito), contratações (licitação, contratação
  direta, compra privada), contratos (gestão e fiscalização, recebimento e
  pagamento, parceria com OSC), ouvidoria, acesso à informação, tomada de
  contas especial, consulta interna, benefício a servidor e procedimentos
  extrajudiciais do Ministério Público. Nenhum é penal.
- Cada modelo tem descrição explicativa, quando usar, base legal, partes e
  fases. Filtro por área e porte (curto, médio, longo) e busca.
- Usar um modelo abre a revisão de sempre; se ele tem partes, o tipo de
  processo nasce com os polos e os nomes (Denunciante, Acusado, Licitante).
- Catálogo em docs/MODELOS_DE_RITO.md; guia do rito ganha a parte 16.

### 14/11/2026 — Nomes dos polos por tipo de processo
- No formulário do tipo de processo, cada polo das partes pode ter um nome
  próprio: Denunciante e Acusado, Licitante, Contratante e Contratada,
  Reclamante e Reclamado.
- O nome aparece na autuação, na tela e na capa do processo, nas certidões,
  nas comunicações e no portal ("Você participa como Acusado").
- O processo guarda os nomes da autuação. Tipos já gravados não mudam.

### 14/11/2026 — Prorrogação e devolução de prazo
- Cada prazo aberto ganha **Prorrogar** (enquanto corre: soma dias ao
  vencimento) e **Devolver** (depois de vencido: corre de novo a contar de
  hoje), sempre com motivo e certidão nos autos.
- Prazo de resposta de comunicação: a parte vê o novo vencimento no portal;
  na devolução, o decurso deixa de valer e a espera do rito reabre.
- Guia do rito, parte 15.

### 14/11/2026 — Audiência como ação do rito
- **Designar audiência ou sessão** passa a ser uma ação do rito: na tela do
  processo, o botão Designar pede data, hora, modo (presencial, por
  videoconferência ou híbrido), local ou link e quem participa além das
  partes (testemunha, perito e outros).
- A designação é certidão nos autos, as partes a veem no portal em
  "Audiências designadas" e o processo mostra a próxima audiência.
  Desfazer cancela, também com certidão.
- `{audiencia}` no texto da comunicação vira a data, a hora e o local.
- Guia do rito, parte 15, com exemplo de instrução com testemunhas.
- Ritos já gravados não mudam.

### 14/11/2026 — Comunicação às partes e espera da resposta no rito
- **Comunicar as partes** passa a ser uma ação do rito: espécie (intimação,
  notificação, citação, ciência ou comunicação), a quem (os polos), prazo de
  resposta e texto proposto. Na tela do processo, o botão **Expedir** abre a
  comunicação já preenchida, só com as partes que faltam. A ação se cumpre
  quando todas foram comunicadas.
- **Esperar a resposta das partes**: a ação se cumpre sozinha quando cada
  parte se manifesta no prazo pelo portal, ou quando o prazo acaba. A
  resposta (Apresentada, Parcial, Sem manifestação) guia condições e saídas.
- **Certidão de decurso de prazo** nos autos, pública, no dia seguinte ao
  fim do prazo sem manifestação; a parte é avisada.
- A fase com andamento automático segue sozinha quando a espera termina,
  salvo se o rito reservou a conclusão a alguém.
- Guia do rito, parte 15, com exemplo de processo disciplinar.
- Ritos já gravados não mudam.

### 14/11/2026 — O que a fase faz ao entrar, quem ela avisa e prazo por ação
- **Ao entrar na fase**, além de marcar urgente e tirar o responsável, o
  rito agora pode: tirar a urgência, mudar o sigilo (restrito ou normal),
  **designar o responsável** (quem moveu o processo, quem gere a unidade ou
  quem tem certa atribuição na lotação) e **abrir uma pendência** para quem
  decide, que pode interromper a fase.
- **Quem é avisado** quando o processo entra na fase: toda a unidade, só
  quem gere, só o responsável ou ninguém, com mensagem própria. Sem
  escolha, vale o aviso de sempre (a unidade, na remessa).
- **Prazo próprio da ação**: abre quando a ação passa a valer, encerra
  quando ela é cumprida, reabre se for desfeita e termina com a fase.
- **Antecedência do alerta** dos prazos que a fase abre (0 a 30 dias; o
  padrão continua 2) e **regra do vencimento**: marcar urgente e avisar
  quem gere a unidade, uma vez por prazo.
- Tudo o que a fase faz sozinha fica em registro interno; prazos de fase e
  de ação não aparecem para as partes.
- **Menos coisa interna para as partes**: o motivo da urgência sai só na
  folha de dados da equipe, e a apreciação de pendência aberta à mão ou pela
  fase não repete o texto da pendência no ato público.
- A ação que deixa de valer e volta conta o prazo de novo a partir do dia em
  que voltou; a atualização de rito leva os prazos das ações junto com elas;
  a juntada, a guarda e a petição contam o prazo com o calendário do órgão.
- Ritos já gravados não mudam: sem as opções novas, tudo vale como antes.
- Guia do rito, parte 14, explica cada opção, com um exemplo.

### 14/11/2026 — Desvios que leem outra fase e dados do processo; saída padrão
- A condição de uma ação (**Quando vale**) e a de uma saída (**Regra desta
  saída**) agora também leem a resposta dada em **outra fase** e **dados do
  processo**: urgente, sigilo, se tem partes, origem, tipo de processo e os
  campos de lista ou sim/não do formulário do tipo.
- **E também** soma até três condições à primeira; todas precisam valer.
- **Saída padrão**: em Encaminhamentos, "Se nenhuma regra indicar outra
  saída" diz por onde seguir nesse caso. No processo ela aparece como a
  indicada, e a fase que segue sozinha vai por ela.
- A prévia do rito simula as respostas de fases anteriores e os dados do
  processo. Mover ações leva junto as condições das outras fases que leem
  as respostas delas.
- Ritos já gravados não mudam: sem as opções novas, tudo vale como antes.

### 14/11/2026 — Cada unidade diz se decide e se expede comunicação
- Em **Dados** da unidade, sob "Papel no processo", duas caixas novas:
  **Decide** (recebe a conclusão, aprecia pendências e petições, tem a Mesa
  de decisão) e **Expede** (intima, notifica e cita as partes).
- O tipo continua dando o padrão: o gabinete decide e a secretaria expede.
  Agora uma comissão processante, um pregoeiro ou um fiscal de contrato
  podem fazer as duas coisas sem serem criados como gabinete ou secretaria.
- O servidor confere o papel em cada ato (comunicação, apreciação de
  pendência, decisão por despacho, conclusão e avisos).
- Nada muda para unidade que não mexer nas caixas.
- Guia do rito explica quando mudar.

### 14/11/2026 — O rito diz quem pode fazer o quê
- Nova seção **Quem pode nesta fase**, em cada fase do rito: quem conclui
  a fase (quem tem o processo, o responsável, quem gere a unidade ou quem
  tem certa atribuição), quem dispensa o que ela exige, quem segue por
  caminho fora do previsto e quem arquiva, sobresta ou reativa.
- A ação também pode ser reservada a quem tem certa atribuição (ex.:
  Promotor), a que a pessoa tem na lotação da unidade que está com o
  processo.
- O servidor confere cada ato e diz a quem ele cabe. Na tela do processo,
  a fase mostra o que está reservado, e quem não pode vê o motivo antes de
  tentar. A administração do Processo Eletrônico sempre pode.
- Nada muda para rito que não usar as opções novas.
- Guia do rito, parte 7, explica cada opção.

### 14/11/2026 — O rito conduz registros de páginas próprias
- Em **Andamento automático**, "A fase conduz" passa a listar também as
  páginas próprias do órgão. Escolhida a página, as situações são as fases
  dela: o registro muda de coluna quando o processo entra na fase ou quando
  alguém o assume.
- As regras da página continuam valendo, com quem pratica o ato no
  processo. Se ela exige um campo ou a aprovação de outra pessoa, o registro
  fica onde está, o processo segue e a equipe vê o motivo.
- O rito não é salvo se citar página ou fase que não existe.
- Parcerias e Júri continuam fora: não são conduzidos pelo rito.

### 14/11/2026 — Recursos do Rito Consultas em qualquer rito
- **Seguir sozinha** passa a valer também quando o que faltava era um
  documento: juntado (ou guardado) o último documento exigido, a fase
  segue. Com o botão Finalizar, segue depois do último documento. Fase que
  não exige nada continua seguindo só pelo botão.
- No modelo Rito Consultas CAOCIPP, a Revisão agora segue sozinha para a
  Secretaria quando o parecer é juntado.
- Guia do rito, parte 13: onde ligar, em qualquer rito, cada recurso que o
  exemplo usa.
- O aviso do editor sobre fase que "segue sozinha" sem nada exigido passou
  a considerar os documentos obrigatórios.

### 14/11/2026 — Modelo pronto: Rito Consultas CAOCIPP
- Em **Novo rito**, o modelo **Rito Consultas CAOCIPP** cria as seis fases
  já configuradas: Recebimento, Análise, Revisão, Devolução, Arquivamento e
  Diligências externas (fase de espera).
- As unidades Secretaria, Assessoria e Gabinete são casadas pelo nome com
  as do órgão; a que não existir é proposta para criação.
- O Guia do rito ganhou a parte 12, com o exemplo completo: o desenho, o
  que conferir antes de usar e cada fase com as suas ações.
- Pede a integração com Consultas ligada e uma consulta ligada ao processo.
- Documento guardado fora dos autos numa fase que o rito deixa só no sistema
  não aparece mais no extrato impresso; sai na impressão interna.

### 14/11/2026 — Impressão interna (o que fica fora dos autos)
- Na tela do processo, **Impressão interna** gera um PDF de uso da equipe
  com o que for marcado: registros internos e do sistema, minutas,
  documentos guardados fora dos autos e redações anteriores.
- O PDF não tem folhas dos autos e leva a marca de uso interno em toda
  página. Não é cópia do processo e não vai às partes.
- O que o rito marcou "sem evento" continua fora de qualquer impressão.
- Guia do rito, parte 11.

### 13/11/2026 — Revisão: redação original guardada e botão Finalizar
- Quando outra pessoa altera uma minuta (ex.: o gabinete revisa a minuta
  da assessoria), a **redação de quem escreveu antes fica guardada**. O
  botão **Versões** ao lado do documento abre as redações anteriores, só
  para leitura. Só a equipe vê; nunca as partes.
- No rito, a fase pode ter o **botão Finalizar** (ex.: Finalizar revisão):
  escolher quais minutas e anexos entram nos autos, pôr em ordem, anexar o
  que faltar, assinar e juntar tudo de uma vez. O que fica de fora continua
  como minuta ou é guardado fora dos autos.
- Com duas ou mais minutas, qualquer fase oferece **Juntar em conjunto**.
- Guia do rito, parte 10.

### 13/11/2026 — Fase de espera (diligências externas)
- No rito, uma fase pode ser marcada como **Fase de espera**: o processo
  entra nela vindo de outra fase, aguarda e **volta para a fase de onde
  veio**, que é retomada como estava (ações já cumpridas continuam
  cumpridas; quem respondia pelo processo continua respondendo).
- Ir para a espera não conclui a fase de origem e não pede dispensa do que
  falta nela. Da espera, a saída prevista é só a volta.
- Tela do processo: botão **Aguardar** nas fases que levam à espera e
  **Encerrar a espera e voltar** durante ela.
- A espera pode pôr a consulta ligada em "Aguarda retorno de terceiros" e,
  com "Seguir sozinha", termina quando o retorno é registrado.
- Desenho do rito, Prévia e Guia do rito (parte 9) mostram a espera e a
  volta.

### 13/11/2026 — Andamento automático da fase
- No rito, cada fase ganhou a seção **Andamento automático**: **seguir
  sozinha** quando as ações obrigatórias são cumpridas (enviando o processo
  para a unidade da fase seguinte, se for outra) e **arquivar ao entrar**,
  para a última fase.
- A fase pode **conduzir a consulta ou o expediente ligado** ao processo:
  ao entrar na fase ou quando alguém assume, o registro vai para a coluna
  escolhida (Pendente, Em elaboração, Em revisão, Revisadas, Na pasta…), com
  data e histórico, na mesma transação do ato.
- Tela do processo: botão **Assumir** para quem é da unidade, enquanto o
  processo não tem responsável, e aviso de para onde o processo foi quando a
  fase segue sozinha.
- O que a fase faz sozinha fica em registro interno; nada disso vai às
  partes. Se faltar documento exigido ou houver mais de uma saída, a fase
  espera o botão.
- Guia do rito: nova parte 8, com a tabela do exemplo de consultas.

### 13/11/2026 — Capa simples e folha de dados no PDF do processo
- A **primeira página** do PDF traz só o órgão, o número do processo, a data
  da autuação e se está ativo ou arquivado.
- A **segunda página** é a folha de dados, que é a folha do evento 1: termo de
  autuação, assunto, rito, partes, campos do processo e a situação atual. O
  índice vem depois dela.
- No rito, a ação que pede um dado ganhou **"Entra na folha de dados do
  processo"**: o dado registrado depois (ex.: número do PGEA) completa a
  folha, sem criar outra. Dado reservado não entra.
- A cópia das partes mostra só o que o órgão marcou para elas.

### 13/11/2026 — Ações do rito com mais opções
- **Condição por campo do formulário**: "Quando vale" e a regra da saída
  aceitam um campo de lista ou de sim ou não do formulário de uma ação da
  fase. Ex.: "Registrar no SIM" só vale se o campo "Sistema utilizado" dos
  dados básicos não for SIM.
- **Ações alternativas** ("Alternativa a"): faça isto ou aquilo. Cumprida uma,
  a outra deixa de ser cobrada; sem nenhuma, a fase pede "A ou B".
- **Ação que só orienta**: lembrete na tela do processo, sem caixa de marcar,
  sem registro e sem cobrança.
- Prévia, desenho do fluxo e guia do rito acompanham as três opções.

### 13/11/2026 — Fluxo do rito por ações e desvios, e guia do rito
- O desenho do fluxo passa a seguir a leitura do BPMN: a **fase é a moldura**,
  cada **ação é uma caixa** dentro dela e cada "Quando vale" vira um **losango**
  com a condição, mostrando o caminho que pula as ações condicionais. Ação
  opcional tem borda tracejada. Vale no editor de rito, na prévia, nas versões,
  no tipo e na tela do processo. No portal das partes nada muda.
- **Guia do rito**, no editor: explica as peças do rito com um exemplo
  desenhado, o passo a passo para montar e o que cada opção da ação faz.

### 13/11/2026 — Editor de rito: fase aberta em destaque
- No editor de rito, a fase aberta ganha fundo e borda próprios, e termina
  numa linha **Fim da fase** com o botão **Recolher**: dá para ver onde os
  dados de cada fase começam e acabam.

### 13/11/2026 — Dado da ação só para quem gere a unidade
- Na configuração de cada ação do rito que pede um dado (texto, número,
  data ou formulário), **Quem vê o dado na equipe** pode ser "Só quem gere a
  unidade". Quem registrou e a administração também veem; o resto da equipe
  vê que a ação foi feita, sem o dado. O dado reservado nunca vai aos autos,
  ao portal nem às listas.

### 13/11/2026 — Selo PE nas páginas próprias
- A lista e o painel de cada página própria mostram o selo **PE** nos
  registros que têm processo eletrônico, e a lista ganhou o filtro
  **Processo eletrônico** (qualquer, com ou sem), como em Consultas,
  Expedientes, Parcerias e Júri.

### 13/11/2026 — Páginas próprias ligadas aos processos
- Em **Integrações**, as páginas próprias do órgão (as páginas personalizadas
  com tabela, formulário e fases) entram como mais um módulo. Ligada, o tipo
  de processo pode ter um campo e o rito uma ação que pedem um registro de
  uma página escolhida ("De qual página"), procurado pelo nome.
- A ficha do registro mostra os processos ligados e o botão **Criar processo
  eletrônico**; a Capa do processo abre o registro na página dele.
- Registro de página própria fica só com a equipe: as partes nunca o veem, no
  portal nem nos modelos.

### 13/11/2026 — Admin delegado por órgão interno
- Cada órgão interno pode ter até 10 pessoas que o administram (**Quem
  administra este órgão**, no cadastro do órgão). Elas configuram o órgão, os
  que ficam abaixo dele e as unidades deles: dados da unidade, equipe,
  pedidos de lotação, convites, papel timbrado e modelos; criam órgãos
  subordinados e unidades e excluem subordinados levando o conteúdo para outro
  órgão que administram.
- No órgão que lhe foi delegado, quem administra não muda o órgão superior
  nem a lista de admins; isso fica com o admin da entidade. Ritos, tipos de
  processo, integrações e preferências seguem só com o admin da entidade, e
  administrar não dá acesso a processos de unidades em que a pessoa não está
  lotada.
- Na aba **Unidades** do Processo Eletrônico, o cartão "Órgãos que você
  administra" e as unidades desses órgãos em "Unidades que você gere".

### 13/11/2026 — Levar processos para a versão nova do rito
- No menu de um rito com mais de uma versão, **Atualizar processos** mostra
  quantos processos em andamento ou sobrestados estão em versões anteriores,
  por versão e fase, e os leva para a versão atual. Quem está numa fase que
  deixou de existir vai para a fase que o admin escolher.
- O que já foi feito na fase (ações, respostas, documentos exigidos) segue
  pelo texto da ação e pela descrição do documento. Nada dos autos muda; cada
  processo ganha um registro interno, fora do portal das partes.
- Só o admin do órgão; até 300 processos por vez.

### 13/11/2026 — Processo Eletrônico mais claro e mais fácil no celular
- **Glossário**: botão "?" ao lado de autos, autuar, certidão conjunta,
  ciência por decurso, dispensa, juntada, remessa e sobrestar, com uma
  definição curta (teclado e toque); seção Glossário na Central de Ajuda.
  O portal das partes não mostra o "?".
- **Celular**: ao abrir um processo, cabeçalho e barra do órgão saem da
  frente e fica uma barra fina com "Processos" e o número. Em "Meu
  trabalho", tocar em qualquer parte da linha abre o processo.
- **Toques de 44px** no celular para caixas de marcar, chaves, filtros de
  eventos, o X que tira modelo da fase e os botões de voltar. No computador
  nada muda de tamanho.
- **Excluir unidade**: o diálogo mostra os tipos de processo que entram por
  ela e as fases de rito que correm nela; modelos, tipos e fases passam
  para a unidade escolhida (ou, sem escolha, modelos inativos no órgão,
  tipos pela unidade de quem autua e fases pela unidade que estiver com o
  processo). Tipos e ritos que apontavam para unidade excluída voltam a
  salvar.
- **Excluir órgão interno**: aviso de que não se desfaz e a opção
  "Desativar em vez de excluir".
- **Textos prontos**: Duplicar e Desfazer depois de excluir.

### 13/11/2026 — Configuração do Processo Eletrônico organizada
- **Abas próprias** para Integrações e Preferências; a barra de abas fica no
  topo e rola no celular; a aba vai para o endereço e a página abre no passo
  que falta (ou em Ritos).
- **Lixeira**: ritos, tipos, modelos e processos excluídos numa só lista, com
  quem excluiu, quando, busca e Restaurar.
- **Histórico** completo: todas as alterações com nome claro, as mais
  recentes de verdade, sem eventos de processo, filtro por assunto, busca e
  "Abrir" no item. Quem tem só a permissão de configurar também vê.
- **Versões**: "Ver" compara a versão com a atual (fases, ações e campos que
  entram, saem ou mudam) e mostra a prévia antes de restaurar.

### 13/11/2026 — Prazos do Processo Eletrônico no calendário
- **Painel do PE** com o calendário do mês: os prazos abertos dos processos
  que a pessoa vê; clicar abre o processo. Aviso quando a lista foi cortada.
- **Calendário de Vencimentos do órgão** mostra também os prazos do PE e
  aparece no órgão que só usa o PE (não com o PE suspenso). Legenda só com o
  que há no mês, aviso enquanto os prazos carregam ou se falharem, dias com
  rótulo para leitor de tela.
- **Atalho para ativar** o PE e ligar a integração direto da ficha de
  Consultas, Expedientes, Parcerias e Júris (só para quem configura o PE), e
  "Ativar agora" na página do PE desativado.

### 13/11/2026 — Processo Eletrônico nas listas e na busca
- **Selo "PE"** nas listas de Consultas, Expedientes, Parcerias e Júris,
  ao lado do número do registro que tem processo eletrônico.
- **Filtro "Processo eletrônico"** (com ou sem) nas quatro listas, também
  nas visões salvas e no cabeçalho dos relatórios do Júri.
- **Busca rápida (Ctrl+K)** acha processos eletrônicos pelo número, assunto
  ou partes e abre o processo.

### 13/11/2026 — Processo Eletrônico: dados do registro e variáveis nos modelos
- **Campo preenchido com dado do registro**: no tipo, um campo pode vir
  pré-preenchido com o consulente, a matéria, o objeto, a comarca, as datas
  e outros dados do registro escolhido. Fica editável, nunca vai às partes e
  não vem de registro restrito.
- **Mais variáveis nos modelos**: campos do tipo, informações das ações e
  partes por polo preenchem o modelo, no editor e no Word. Só entra o que as
  partes podem ver.
- **Selo de restrito atual**: a capa e os modelos passam a saber se o
  registro ligado ficou restrito depois de escolhido.

### 13/11/2026 — Processo Eletrônico: retificar a autuação
- **Retificação da autuação**: assunto, origem, sigilo e partes corrigidos
  com motivo, num termo próprio nos autos.
- **Partes retiradas, nunca apagadas**: quem sai do processo perde o portal
  (também os representantes), fica riscado e no histórico.
- **Arquivos ao autuar**: entram como minutas do processo novo.
- **Celular**: Novo processo e a correção em tela cheia, com os botões
  sempre à vista.

### 13/11/2026 — Processo Eletrônico: tipos com versões
- **Versões do tipo de processo**: cada salvamento guarda a anterior; uma
  versão antiga abre no editor e só vale ao salvar.
- **Nada se perde sem querer**: fechar o editor do tipo com alterações pede
  confirmação.
- **Copiar campos de outro tipo**, com as condições e as fases ajustadas.
- **Rito só por tipo**: o rito pode exigir que se autue por um tipo de
  processo (com o formulário e a numeração dele).
- **Correção sem trava**: um campo obrigatório criado depois no tipo não
  impede corrigir os dados de processos antigos.

### 13/11/2026 — Processo Eletrônico: ação com formulário
- **Uma ação pode pedir vários dados de uma vez**: o rito ganha "Um
  formulário (vários campos)", com até 10 campos montados como os do tipo de
  processo (data, lista, sim ou não, registro de outro módulo, campos que só
  aparecem com certa resposta, obrigatórios). Quem cumpre preenche tudo num
  diálogo, e o que foi preenchido vai num só registro: certidão, evento ou
  certidão conjunta, com as partes vendo se a ação disser.

### 13/11/2026 — Processo Eletrônico: a fase age sozinha
- **Prazo da fase que abre e fecha sozinho**: ao entrar na fase, o processo
  ganha o prazo da fase (dias úteis ou corridos, com o calendário do órgão);
  ao sair ou arquivar, ele se encerra. É prazo da equipe: as partes não o veem.
- **Nome da fase para as partes**: o portal pode mostrar um nome mais claro
  (ex.: "Pedido recebido" em vez de "Triagem interna").
- **Ao entrar na fase**: marcar o processo como urgente e tirar o
  responsável designado, conforme o rito. O que é só da equipe (prazo
  interno, responsável) fica nos eventos da equipe, fora do portal.

### 13/11/2026 — Processo Eletrônico: o rito decide pela resposta
- **Ação que só vale com certa resposta**: numa fase com uma ação de escolha
  (por exemplo, "Decisão: Deferido ou Indeferido"), outras ações podem valer
  só para algumas respostas. Sem a resposta, aparecem apagadas e não são
  cobradas.
- **Saída indicada pela resposta**: cada encaminhamento pode ter uma regra. O
  botão principal já leva à fase indicada; ir por outra saída com regra pede
  motivo, que fica registrado.
- **Quem pode cumprir** cada ação: qualquer pessoa da equipe, só o
  responsável designado ou só quem gere a unidade.
- **Simular o rito na prévia**: escolha respostas, veja o que passa a valer e
  ande pelas fases, sem gravar nada. O fluxograma mostra as regras nas setas.

### 13/11/2026 — Processo Eletrônico: registros ligados na Capa
- **Registros ligados** na Capa do processo: consultas, expedientes,
  parcerias e júris citados na origem, nos campos ou nas ações do rito, com
  de onde veio, aviso de acesso restrito e o botão **Abrir**.
- **Abrir direto a ficha**: o link leva à aba do módulo e já abre o registro
  (também na busca rápida, Ctrl+K), mesmo fora da página carregada.
- **Avisos do sistema aparecem de novo em todo o SIGO**: as mensagens de
  sucesso e de erro (como "Processo remetido" ou "Você não tem acesso") não
  apareciam, porque o componente que as mostra não estava montado. Agora
  aparecem no canto superior direito, com botão de fechar; clicar num aviso
  (por exemplo, "Desfazer") não fecha o diálogo aberto.

### 13/11/2026 — Processo Eletrônico: editor de rito mais livre e seguro
- **Arrastar** fases e ações para mudar a ordem (mouse, toque ou teclado,
  com anúncios para leitor de tela) e menu de cada fase: inserir abaixo,
  duplicar, mover para o início ou o fim, remover.
- **Copiar fases de outro rito** do órgão, com tudo o que têm.
- **Desfazer e refazer** (botões e Ctrl+Z / Ctrl+Shift+Z); remover uma fase
  mostra o aviso com "Desfazer".
- **Obrigatório, recomendado ou opcional** para documentos e ações:
  recomendado avisa ao sair da fase, sem exigir motivo; opcional só lembra.
  Documento antigo continua obrigatório.
- **Orientação a quem cumpre** em toda ação; opções da escolha uma por linha.
- **Pendências novas**: fase que nada alcança, ciclo sem saída (também
  marcados no fluxo), registro de módulo com integração desligada, ação sem
  texto, modelos demais. "Salvar" leva até o que impede.

### 13/11/2026 — Processo Eletrônico: criar processo a partir dos outros módulos
- **"Processos eletrônicos" na ficha** de cada consulta, expediente, parceria
  e júri (com a integração ligada): os processos ligados ao registro e o botão
  **Criar processo eletrônico**, que abre o "Novo processo" já com a origem,
  o assunto, o campo do registro e o tipo sugerido.
- **Tipo sugerido por origem**: na aba Dados do tipo, "Sugerir este tipo ao
  criar um processo a partir de" (outro processo ou cada módulo).
- **Processo derivado**: na Capa, "Processos derivados" e "Novo processo
  derivado" (também no menu Mais). A Capa mostra "Nasceu de".
- A origem é conferida no servidor e nunca vai às partes; nada é escrito nos
  outros módulos.

### 13/11/2026 — Processo Eletrônico: integração com Consultas, Expedientes, Parcerias e Júri
- **Integrações com outros módulos**, no Painel Administrativo do Processo
  Eletrônico: o admin liga cada módulo ativo do órgão aos processos. Desligado,
  tudo segue como antes.
- **Campo "Registro de outro módulo"** no formulário do tipo e **ação que pede
  um registro** no rito: quem preenche procura pelo número ou assunto e
  escolhe. O processo guarda só o número e o título, lidos pelo servidor; as
  partes veem só o número, nunca o de acesso restrito. Nada é escrito nos
  outros módulos.
- Desligar a integração não apaga o que já foi guardado nem trava a correção
  de dados.

### 12/11/2026 — Processo Eletrônico: formulário do tipo mais livre
- **Novos recursos nos campos próprios** do "Novo processo" (agora até 40):
  lista em que se marcam várias opções; formatos de e-mail, telefone, CPF ou
  CNPJ (com dígitos verificadores), endereço da internet e valor em reais;
  seções para agrupar os campos.
- **Campos condicionais**: "Mostrar este campo só quando" outro campo (lista ou
  sim ou não) tiver um valor. Escondido, não é pedido nem gravado.
- **Exigir para sair das fases**: o campo pode ficar em branco na autuação e
  ser cobrado numa fase do rito. O cartão da fase mostra "Falta preencher" com
  o botão Preencher; sair sem ele pede o motivo da dispensa, registrado.
- **Editor do tipo em tela cheia**, com abas Dados, Formulário e Numeração e a
  prévia ao lado (no celular, no botão Prévia), que também mostra o que as
  partes veem no portal.
- CPF e CNPJ conferem os dígitos verificadores, inclusive o CNPJ alfanumérico.
  Processos antigos não travam na correção de dados quando o tipo passa a
  pedir um formato.
- O texto do arquivamento com pendências passou a ser "Exigências do rito não
  cumpridas", porque inclui também ações e campos.

### 12/11/2026 — Processo Eletrônico: onde ficam prazo, pendência, urgência, dados e atribuição
- **Outros atos durante a fase**, no editor do rito: para cada fase, escolha se
  abrir e encerrar prazo, abrir e apreciar pendência, marcar urgência, alterar
  os dados do processo e atribuir a uma pessoa ficam nos autos, no extrato, só
  no sistema ou sem evento. "Aplicar a todas as fases" copia a escolha para o
  rito inteiro.
- Sem mudar nada, tudo continua como antes. Autuação, juntada, petição,
  comunicação, situação, exclusão e restauração seguem sempre nos autos.
- A prévia do rito mostra esses atos em "Como fica nos autos".

### 12/11/2026 — Processo Eletrônico: certidão conjunta da fase
- **Na certidão conjunta**: novo destino para as ações da fase. Em vez de uma
  certidão para cada ato, os atos viram itens de uma só certidão, com folha,
  com quem fez e quando.
- **Grupo de fases**: no editor do rito, "Dividir a certidão com" junta fases
  numa só certidão, com título próprio. Opcionalmente, as mudanças entre essas
  fases entram nela, em vez de termo próprio.
- A certidão sai sozinha quando o processo deixa o grupo ou é arquivado. Na
  tela do processo, "Emitir certidão agora" mostra quantos atos aguardam.
- As partes veem a certidão só quando podem ver todos os itens. A prévia do
  rito mostra a certidão na aba "Como fica nos autos".

### 12/11/2026 — Processo Eletrônico: "sem evento" e prévia do rito antes de salvar
- **Sem evento**: cada ação da fase, a entrada e saída da fase e as remessas
  podem não gerar evento. Fica só um registro oculto, para auditoria, que não
  vira último andamento e nunca aparece às partes. Na aba Eventos, filtro
  "Registros ocultos".
- Mudança entre uma fase "sem evento" e outra que pede registro segue a
  outra: o termo não some.
- **Editor**: o destino da ação em cartões, com a consequência e a amostra do
  texto; a lista de como ficam as mudanças com as fases vizinhas.
- **Prévia** no editor do rito, antes de salvar, com a nova aba "Como fica nos
  autos" e a aba "Como a parte vê" montada pelas regras do rito.

### 12/11/2026 — Processo Eletrônico: excluir, restaurar e duplicar ritos, tipos e modelos
- **Menu ⋯ em cada rito, tipo de processo e modelo**: Editar, Duplicar e
  Excluir. Processos já autuados não mudam.
- **Excluídos**: no fim de cada lista, com Restaurar. O item volta inativo; tipo
  cujo rito foi excluído volta com outro rito, escolhido na hora.
- **Tipo de processo agora se exclui**, e tipo excluído deixa de prender o
  rito. Quando o rito não pode sair, o aviso lista os tipos com o botão
  "Abrir o tipo".
- Limites contam só o que não foi excluído (até 100 tipos de processo).
- O PDF dos autos baixado no portal das partes deixa de mostrar o CPF/CNPJ das
  partes.

### 12/11/2026 — Processo Eletrônico: o tipo de processo configura todo o "Novo processo" e a numeração
- **Todos os campos do "Novo processo" configuráveis no tipo**: assunto,
  descrição, origem e partes (obrigatório, opcional ou não usar), unidade,
  sigilo e urgência (quem autua escolhe ou fica fixo pelo tipo), com nome e
  orientação próprios e os polos permitidos. Sem assunto, o processo se chama
  pelo tipo. A prévia no editor é a própria tela de autuação.
- **Numeração única montada pelo admin**: número sequencial (no órgão todo,
  por tipo, por unidade ou por órgão interno; recomeça por ano, mês ou nunca),
  ano, mês, dia, siglas e texto fixo, com prévia ao vivo. O órgão tem a sua e
  cada tipo usa a do órgão, uma própria ou fica sem número (identificador
  SN-…). Quem não mexe continua com 000001/2026 do mesmo contador. Número
  repetido nunca é gravado: a contagem pula o que já existe.

### 12/11/2026 — Processo Eletrônico: uma só tela para criar e editar rito; excluir rito
- **Editar usa a tela de criar**: clicar num rito abre a mesma tela do "Novo
  rito", com o fluxo desenhado, as fases em cartões, as ações e suas regras,
  unidades e modelos novos, exportar e versões. Salvar gera nova versão;
  processos em andamento seguem com a versão com que foram autuados.
- **Novo rito** começa em branco, de um modelo pronto ou de um arquivo, tudo
  no mesmo lugar (o botão "Importar de arquivo" foi unido a ele).
- **Excluir rito**: some das listas e não autua mais; recusado enquanto algum
  tipo de processo o usa. Os processos já autuados não mudam.
- Rascunho guardado no navegador para cada rito em edição, com a opção de
  recuperar ou descartar ao reabrir.

### 12/11/2026 — Processo Eletrônico: cada ação do rito pede o que precisa e fica onde deve
- **Ações da fase com dado**: no rito, cada ação diz o que pede (só confirmar,
  texto, texto longo, número, data, escolha numa lista, sim ou não, ou um
  documento), com o nome do dado (ex.: "Número no SIM") e uma orientação.
  Na tela do processo, a ação que pede um dado tem "Registrar"; o valor fica
  nas informações do processo, na Capa.
- **Onde fica cada ato**: nos autos (certidão com folha, sai na impressão),
  evento no extrato (sai ao fim do PDF, sem folha) ou só no sistema (fica nas
  informações e na aba Eventos, não sai em impressão). Vale para cada ação,
  para entrar e sair da fase e para as remessas durante a fase.
- **Quem vê**: o rito diz se as partes veem a informação e a certidão no
  portal.
- **Ação obrigatória**: a fase só segue com ela feita ou com motivo de
  dispensa, como os documentos exigidos.
- **Documento guardado fora dos autos**: quando o rito pede um documento só
  para controle, a minuta é guardada no processo (a equipe vê, as partes não,
  sem folha e fora do PDF). Botão "Guardar fora dos autos" na minuta e seção
  própria na aba Autos.
- O editor do rito passa a ter uma linha por ação, com a configuração dela.

### 12/11/2026 — Processo Eletrônico: excluir órgão, unidade e processo
- **Excluir processo** (Mais › Excluir processo): o admin do órgão exclui
  qualquer um; quem autuou exclui o próprio enquanto ninguém mais agiu nele.
  Pede motivo, deixa termo nos autos e tira o processo das listas, da caixa,
  do portal das partes e dos alertas. Nada se apaga: o admin vê os excluídos
  em Processos › Todos › Excluídos e restaura.
- **Excluir unidade**: mostra antes o que muda; se houver processos, o admin
  escolhe a unidade que os recebe (com termo de remessa e as minutas). O
  nome continua nos autos. Quem criou a unidade exclui a que está vazia.
- **Excluir órgão interno**: o que está nele (unidades, subordinados, tipos e
  modelos) vai para o destino escolhido, por padrão o órgão superior.
- Equipe salva por duas pessoas ao mesmo tempo não perde ninguém; quem sai da
  equipe deixa de ser responsável pelos processos da unidade.
- Listas de Meu trabalho, Mesa e Painel sem o teto de 1000 processos; processo
  aparece uma vez só em Meu trabalho (os outros motivos viram selos).
- E-mail diário de prazos respeita "Nenhum e-mail"; conferência pública com
  limite de 60 consultas por hora; pedido de assinatura gravado de uma vez;
  envio de arquivo que falha não deixa arquivo solto.

### 11/11/2026 — Pente fino do Processo Eletrônico, etapa 5: unidades e modelos
- **Desativar unidade**: o servidor recusa enquanto a unidade tiver processo
  em andamento ou sobrestado (antes o processo ficava preso numa unidade que
  não movimenta). A mensagem diz quantos são e pede para enviá-los antes.
- **Privacidade**: membro sem nome cadastrado aparecia para os colegas com o
  e-mail no lugar do nome. Agora o e-mail só serve de nome para quem já pode
  vê-lo (admin e gestor); os demais veem "Membro".
- **Editor de modelo**: fechar com o texto alterado e não salvo pede
  confirmação.
- No celular, as janelas de versões, importação de modelo, modelo em arquivo,
  seleção de eventos dos autos, comunicações pendentes, textos prontos, avisos
  da equipe, convite da parte e novo documento passam a caber na tela e rolar
  por dentro.

### 11/11/2026 — Pente fino do Processo Eletrônico, etapa 4: configuração
- **Editor de rito**: fechar com alteração não salva e carregar um modelo,
  planilha ou diagrama por cima das fases já montadas agora pedem
  confirmação (antes o trabalho se perdia sem aviso). O campo de ações cresce
  com a lista.
- **Equipe da unidade**: voltar à aba do navegador não apaga mais a edição não
  salva (a tela só ressincroniza quando a equipe mudou de fato no servidor);
  admitir ou recusar pedido de lotação pede para salvar a equipe antes.
- Ritos e Tipos de processo ganharam orientação quando estão vazios.
- No celular, o cabeçalho dos cartões de Modelos, Textos prontos, Unidades e
  Tipos não espreme mais o título nem cria rolagem lateral.
- Copiar link (convite, conferência, diagrama do rito) usa uma função única
  (`copiarTexto`, em `secretaria/comum.jsx`): quando o navegador não deixa
  copiar, mostra o texto para copiar à mão em vez de dizer que copiou.

### 11/11/2026 — Pente fino do Processo Eletrônico, etapa 3: portal e diálogos
- **Portal no celular**: a parte de processo sobrestado ou arquivado voltou a
  ter o PDF do processo, a certidão de andamento e a impressão ao alcance (a
  barra inferior sumia fora da tramitação), e pode se manifestar, com aviso de
  que o pedido vai para quem decide. O servidor já aceitava; a tela escondia.
- O resumo "Últimos andamentos" só aparece no celular quando há novidade (a
  lista completa vem logo abaixo); filtro "Sobrestados" na lista da parte;
  copiar o link de conferência não quebra em navegador sem área de
  transferência.
- **Diálogos da equipe**: ato recusado pelo servidor (por exemplo, outra pessoa
  movimentou o processo antes) não apaga mais o que foi digitado; todo diálogo
  de ação rola por dentro no celular; "Abrir prazo" sugere as partes como
  destinatário (é pelo nome que o portal reconhece o prazo da parte) e não
  confirma com dias inválidos.
- O contador da aba "Mesa de decisão" passou a incluir o arquivado com
  pendência, como a própria Mesa.

### 11/11/2026 — Pente fino do Processo Eletrônico
- **Sigilo do trabalho interno no portal das partes**: a pendência aberta à
  mão para o decisor voltou a ficar fora do portal, e a lista de processos da
  parte só mostra como "último andamento" um ato que ela pode ver (antes
  aparecia qualquer movimento, inclusive atribuição e remessa interna).
- **Celular**: a lista de eventos e a lista dos autos cabem na tela sem cortar
  texto; título do processo menor; atalhos de teclado só no computador.
- **Confirmação** antes de excluir minuta, revogar acesso ao portal e retirar
  representante.
- Minuta que seguiu com o processo só pode ser excluída quando ele volta à
  unidade que a redigiu. Marcar a mesma ação duas vezes não repete o registro.
  Revogar acesso de quem não tem acesso nem convite é recusado.
- A Mesa do decisor mostra também processo arquivado com pendência aberta
  (petição que chegou depois do arquivamento).
- Portal: até 20 petições por conta, por processo, em 24 horas; órgão suspenso
  pela plataforma some das listas da parte.
- Sino de prazo avisa até o dia seguinte ao vencimento (o e-mail diário
  continua listando os atrasos). Textos das certidões sem ponto dobrado.

### 10/11/2026 — Ajustes nas exigências do rito
- Petição da parte do tipo pedido (ex.: "Manifestação") cumpre o documento
  que a fase exige receber de fora.
- Fase que volta recomeça: o que ela exige e as ações marcadas valem para a
  nova rodada; a anterior continua nos autos.
- No editor do rito, apagar ou reordenar ações não troca a regra de ação.
- Arquivar com documento exigido em aberto avisa, no diálogo, que a falta
  fica registrada.

### 10/11/2026 — Minutas seguem com o processo
- Na remessa, as minutas da unidade aparecem marcadas em "Minutas que seguem
  com o processo". A unidade que recebe (ex.: o gabinete) lê, revisa, assina
  e junta a minuta da assessoria; só quem redigiu pode excluí-la. O termo de
  remessa não cita minutas, que continuam fora dos autos até a juntada.

### 10/11/2026 — Rito decide o que vai aos autos e que documentos exige
- **Registro nos autos por fase**: no editor do rito, cada fase pode deixar
  tudo nos autos (padrão), deixar fora as remessas internas da fase ou ficar
  inteira no registro interno (ex.: distribuição entre assessorias). O ato
  continua registrado, com autor e hora, na aba Eventos (filtro Internos),
  sem termo nem folha e fora do portal das partes.
- **Ação com certidão**: uma ação da fase pode gerar certidão de cumprimento
  nos autos ao ser marcada.
- **Documento exigido**: a fase (até 5) ou uma ação pode exigir documento,
  redigido no órgão, recebido de fora ou qualquer um, com tipo e modelo
  indicados. A juntada cumpre a exigência (reconhecida pelo modelo ou tipo,
  ou marcada no diálogo de juntar). Para sair da fase sem ele, é preciso
  informar o motivo da dispensa, que fica registrado.

### 10/11/2026 — Capa do processo e guia de lógica processual
- **Guia de domínio** [LOGICA_PROCESSUAL.md](./LOGICA_PROCESSUAL.md): o que é
  ato do processo e o que é trabalho interno, o que vai para os autos, o que a
  capa deve mostrar. Leitura obrigatória antes de mexer no Processo Eletrônico.
- **Tela do processo em abas**: Capa (só informação, sem botões de ato),
  Andamento (onde se age: fase, minutas, pendências, prazos, intimações,
  partes no portal), Autos e Eventos. Quem tem o processo abre no Andamento;
  os demais, na Capa.
- **Origem do processo** no "Novo processo" (requerimento, representação,
  ofício, de ofício, derivado de outro processo), com referência. A capa
  mostra a origem, a unidade de autuação e quem solicitou; o PDF da equipe
  também.

### 10/11/2026 — Acabamento: órgão para a equipe, modelos por órgão e textos prontos
- **Estrutura visível para a equipe**: a aba Unidades do Processo Eletrônico
  mostra o organograma com as competências de cada órgão, o titular e as
  unidades; cada unidade mostra o órgão e as atribuições.
- **Painel**: gráfico "Em tramitação por órgão interno" e unidades com o
  nome do órgão.
- **Modelos de documento por órgão**: no formulário do órgão, a seção
  "Modelos de documento deste órgão". Só as unidades dele usam esses modelos,
  além dos da entidade e dos próprios de cada unidade.
- **Textos prontos de intimações e comunicações** (aba Documentos e modelos):
  nome, espécie, texto e prazo sugerido. Ao intimar ou comunicar, a secretaria
  escolhe o texto pronto, ajusta e expede.

### 10/11/2026 — Órgãos internos da entidade
- Nova aba **Estrutura** na configuração do Processo Eletrônico. A entidade
  pode continuar singular (só com as suas unidades) ou ser composta por
  **órgãos internos** em árvore (conselhos, presidência, diretorias,
  comissões), cada um com natureza, órgão superior, quem decide (titular ou
  colegiado), cargo e pessoa titular, competências e as próprias unidades.
- **Organograma** em lista recuada, com as unidades de cada órgão e aviso de
  órgão sem unidade. **Assistente "Montar estrutura"**: parte de um exemplo
  (federação ou associação, colegiado com câmaras, instituição com
  departamentos, ou em branco), ajusta os órgãos vendo a prévia e cria órgãos
  e unidades de uma vez.
- Unidades: campo **Órgão interno a que pertence** e **Atribuições da
  unidade**. A aba Unidades e equipes agrupa por órgão.
- **Remessa entre órgãos**: o destino aparece como "Órgão › Unidade", a tela
  avisa quando a remessa sai de um órgão para outro e o termo registra os
  dois. Listas, filtros e o processo mostram a unidade com o órgão.
- **Tipo de processo de um órgão**: só as unidades daquele órgão autuam; o
  "Novo processo" já filtra tipos e unidades.
- Órgão só é removido quando vazio (sem unidades e sem subordinados); pode
  ser desativado. Nada muda para quem não cria órgãos internos.

### 10/11/2026 — Meus Processos Eletrônicos
- Nova página **Meus Processos Eletrônicos**, logo abaixo de Meu Perfil no
  menu, para quem é parte ou representante em algum processo (de qualquer
  órgão ou entidade). O que a pessoa faz como membro de um órgão continua na
  página do órgão. O item some do menu quando a pessoa não tem processos.
- Planilha com situação, processo e fase, órgão e posição (parte ou
  representante, com o polo), prazo com contagem de dias, **o que fazer
  agora** em uma frase, último andamento e o botão da ação (Dar ciência,
  Responder ou Abrir). No celular vira lista de cartões.
- Cores, sempre com ícone e texto: vermelho para prazo vencido, azul para
  prazo por abrir (comunicação aguardando ciência), âmbar para prazo aberto e
  cinza para o que não pede nada. Ordem: o que pede ação primeiro. Filtros por
  situação e por órgão, e busca.
- Substitui o item "Processos em que sou parte". O processo abre no portal
  das partes, como antes.
- Corrigido o selo "Urgente" que aparecia duas vezes na lista do portal.

### 10/11/2026 — Intimações e demais comunicações, com ciência e prazo
- A secretaria **intima, notifica, cita, dá ciência ou comunica** uma ou mais
  partes pelo processo (cartão "Comunicações às partes" ou Mais → Intimar ou
  comunicar uma parte). O formulário pede a espécie, a quem, o texto, o
  documento a que se refere (opcional), o prazo e o meio.
- **Prazo:** vem sugerido da fase do rito quando ela tem prazo; se não tem,
  quem expede precisa dizer os dias ou marcar "não abre prazo".
- **Pela plataforma:** a parte (ou o representante) vê um aviso ao entrar no
  SIGO ou no portal, com o texto, o prazo que será aberto e a data limite, e
  clica em **Dar ciência**. A ciência é certificada nos autos (Termo de
  ciência) e o prazo de resposta abre nessa hora. "Ver depois" adia o aviso
  só naquela sessão. A parte também recebe e-mail.
- **Ciência por decurso:** sem ciência em 10 dias corridos (o órgão muda o
  número, ou desliga com zero, em Painel Administrativo → Processo
  Eletrônico), a rotina diária certifica a ciência e abre o prazo.
- **Por outro meio:** comunicação já feita por correio, pessoalmente ou
  edital é registrada com o meio e a data da ciência; o prazo abre na hora,
  contado dessa data. Serve para parte sem conta no portal.
- Antes da ciência, a secretaria pode **tornar a comunicação sem efeito**,
  com motivo certificado.

### 10/11/2026 — Urgência nos processos
- O processo pode ser **urgente**, sempre com motivo: na autuação, depois
  (Mais → Marcar como urgente / Retirar a urgência, pela unidade que tem o
  processo) ou por padrão do tipo de processo ("todo processo deste tipo é
  urgente"). Cada marcação vira evento nos autos (Certidão de urgência).
- Urgentes aparecem primeiro na caixa, em Todos e no Meu trabalho (grupo
  "Urgentes"), com selo vermelho; há o filtro "Urgentes". O selo aparece
  também no processo, no portal da parte e na capa do PDF. O aviso de
  processo recebido sai com "URGENTE" no assunto.
- No portal, a parte tem o tipo de manifestação "Pedido de urgência", que
  segue para apreciação do decisor.

### 10/11/2026 — Eventos do processo, termos com folha e PDF integral ou parcial
- O processo ganhou a tabela **Eventos**: tudo o que aconteceu, numerado, com
  o que foi feito, por quem, em que unidade, data, hora e as folhas que ocupa.
  Filtros (todos, atos de usuários, sistema, com documentos), busca e ordem.
- Cada ato de usuário tem a sua página nos autos: o documento juntado ou um
  **termo** de uma folha (termo de autuação, de conclusão, certidão de
  abertura de prazo...). O termo passa a ocupar folha dos autos. Os registros
  do sistema saem reunidos num extrato ao fim.
- **Ler os autos** abre evento por evento, na ordem, com anterior e próximo.
- **Gerar PDF**: processo inteiro, apenas os eventos marcados, tudo menos os
  marcados ou um intervalo de folhas, com ou sem capa e índice. O PDF parcial
  diz na capa que é cópia parcial. Vale também para a parte, no portal, só
  com o que ela pode ver.

### 10/11/2026 — Tipo de processo define os campos do "Novo processo"
- Em cada tipo de processo, o admin define o formulário de autuação:
  Descrição e Partes opcionais, obrigatórias ou não usadas, e até 20 campos
  próprios (texto, texto longo, número, data, lista de opções, sim ou não),
  com obrigatório, orientação e "mostrar às partes no portal". Há prévia.
- O "Novo processo" mostra os campos do tipo escolhido e diz o que falta; o
  servidor valida de novo.
- Os valores ficam nos dados do processo, entram no movimento de autuação,
  contam na busca e podem ser corrigidos em "Editar dados", com o que mudou
  registrado no histórico. As partes veem no portal só o que o órgão marcar.

### 10/11/2026 — Rito: diagramas unidos e fluxo no formato do Bizagi
- Importação: diagramas desenhados em páginas separadas são unidos sozinhos
  onde um termina e o outro começa (atividade com o nome do outro diagrama,
  eventos de fim, início e ligação com o mesmo nome, fim que cita o outro
  diagrama e, sem pista nenhuma, o fim principal do anterior). Cada união
  aparece nas observações da revisão.
- Fluxo do rito desenhado na notação do Bizagi em todas as telas: raias por
  unidade, início, tarefas, losango de desvio, fim, condição escrita na seta e
  voltas tracejadas. O fluxo longo muda de linha para caber inteiro na tela;
  há zoom e tela cheia.
- Revisão da importação: fluxo inteiro no alto, fases em cartões recolhíveis
  (clicar na fase do desenho abre o cartão) e observações agrupadas.

### 10/11/2026 — Importação de rito por arquivo
- PDF: o texto saía colado ("2.Nome", "1.Autuação") e as fases numeradas não
  eram achadas; agora os pedaços separados ganham espaço, "1.Nome" abre fase e
  cabeçalho e rodapé repetidos (data de impressão, endereço) saem. PDF
  digitalizado ou sem fases explica o que enviar no lugar.
- Bizagi: o pacote do Bizagi Modeler (.bpm) é aceito, com todas as páginas;
  também XPDL (.xpdl), a exportação do Bizagi e de outras ferramentas.
- Planilha: todas as abas são lidas (antes, só a primeira com fases). A aba
  com o nome de uma fase detalha essa fase; colunas novas Fase principal,
  Subprocesso e Paralela; "Segue para" pode citar outra aba. Word com várias
  tabelas: todas são lidas.
- Diagramas: subprocessos (embutidos ou em outra página) se abrem em etapas no
  lugar da atividade; mensagens entre piscinas ligam os processos; ramos
  paralelos ficam em sequência com anotação, porque o processo anda uma fase
  por vez.
- Rito aceita até 60 fases (antes 30).

### 10/11/2026 — Painel Administrativo reorganizado
- O painel abre numa visão geral, com as seções agrupadas em Órgão, Pessoas e
  acesso, Módulos de trabalho, Regras e automação e Dados e segurança. Menu
  lateral fixo no computador, seletor no celular, busca de configuração e a
  seção aberta no endereço (`&secao=`).
- Cada seção tem título, explicação e, para o criador, a indicação de quem
  pode acessá-la. Módulo com a página desligada aparece marcado, com atalho
  para ligar.
- Identidade e contato: sigla, e-mail, telefone, endereço e site do órgão,
  exibidos em Informações Gerais.
- Páginas e módulos: setas para definir a ordem das páginas na navegação.
- Membros e convite: código de convite com copiar, busca, filtro de
  ex-membros, função escolhida numa lista explicada e remoção com confirmação.
- Atribuições especiais agrupadas por área, com "marcar a área toda", e nova
  atribuição "Configurar regras e automação" (indicador de tempo, metas,
  escalonamento e relatórios), antes exclusivas do criador.
- A aba "Inteligência Artificial" saiu do painel: só gravava uma preferência
  que nenhuma parte do sistema usava.

### 10/11/2026 — Navegação do Processo Eletrônico
- O Processo Eletrônico entrou na barra de páginas do órgão (no alto da
  página), antes do Painel Administrativo.
- Dentro do módulo, o sub-menu lateral do órgão continua aberto, com o
  Processo Eletrônico marcado, e a barra de páginas aparece também ali.
- Abas internas do módulo no endereço (`&aba=`): recarregar, voltar de um
  processo ou compartilhar o link mantém a aba.
- Módulo desligado: "Ir para o órgão" leva quem não é admin à página inicial
  do órgão (antes ia para o Painel Administrativo, que essa pessoa não vê).
  Erro ao carregar o módulo ganhou "Tentar de novo".
- Celular: a barra de páginas do órgão virou uma faixa com rolagem lateral
  (antes ocupava a primeira tela inteira); o topo mostra o nome da página em
  vez de "Processos"; a área invisível dos avisos (toasts) não bloqueia mais
  o toque no menu e no sino.
- Ajuda e Termos abrem com o menu lateral para quem está logado (antes a
  pessoa ficava sem menu); o link de ajuda do módulo não esconde mais o
  título sob a barra do topo.
- Paleta de comandos (Ctrl+K): atalho "Processo Eletrônico · órgão".
- Portal das partes: botão de tema claro/escuro, como no resto do SIGO.

### 09/11/2026 — Convivência com outros apps do projeto Firebase
- Functions no codebase `sigo`: o deploy do SIGO não apaga mais functions de
  outros apps do projeto.
- Regras e índices do Firestore publicados sem `--force`: índices de outros
  apps ficam.
- `platformConfig`: contas de outros apps (Auth compartilhado) só leem as
  flags; `emailProvider` e `quotas` fechados ao cliente.
- Riscos do projeto compartilhado documentados em SECURITY_REFERENCE.

### 09/11/2026 — Parte e membro: dois papéis
- **Impedimento:** quem é parte (ou representante) num processo não o vê nem
  age nele como equipe, mesmo admin ou lotado na unidade; a tela do órgão
  mostra "Você é parte neste processo" com atalho para o portal. Avisos à
  equipe pulam quem é parte.
- **Menu "Processos em que sou parte"** no SIGO para quem aceitou um convite;
  "Ir para o SIGO" no portal para quem é membro de algum órgão.
- **Portal por órgão:** com processos em mais de um órgão ou entidade, a
  lista vem separada por órgão, com filtro.
- **Representante da parte:** a equipe convida advogado, procurador ou
  preposto (até 5 por parte), que entra com a própria conta e protocola em
  nome da parte, assinando como "Fulana, representante de X".

### 09/11/2026 — Admin e escala (etapa 7)
- **Primeiros passos** no Painel Administrativo: "Configuração: N de 4" com
  atalho para o que falta (unidade, equipe, rito, tipo).
- **Ver como a equipe e a parte**: prévia de um processo de exemplo, fase a
  fase, sem gravar nada.
- Importação de ritos: **pendências** no alto da revisão (as que impedem e as
  que só avisam), **rascunho** guardado no navegador, **resumo** do que foi
  criado com atalhos para montar equipes e completar modelos, planilha de
  exemplo.
- **Versões** de ritos e modelos (até 20), com restaurar; **Duplicar** modelo;
  cartões de modelo mostram em que fases são indicados.
- Calendário: **repetir os recessos** do último ano no seguinte.
- Aba **Histórico** da configuração: quem mudou o quê e quando.
- Escala: lista de processos **paginada no servidor** com "Carregar mais";
  contadores por unidade nos cartões, sem carregar processos.

### 09/11/2026 — Avisos, celular e acessibilidade (etapa 6)
- Avisos da equipe no **sino da plataforma** (processo recebido, assinatura
  pedida, pendência, petição da parte, prazo), abrindo o processo ao clicar.
- Diálogo **Avisos** com preferência por pessoa: sino ligado ou não; e-mail a
  cada evento, um **resumo por dia** ou nenhum.
- Celular: barra fixa com o botão principal e Novo documento; **fotografar um
  documento** na equipe e no portal.
- Acessibilidade: contraste do texto auxiliar, **Tentar de novo** nos erros
  de carregamento, glossário nos termos técnicos.
- Seção **Processo Eletrônico** na Central de Ajuda, por perfil, com atalho
  "?" no módulo.

### 09/11/2026 — Equipe e decisor (etapa 5)
- Cartão **Nesta fase** com ações marcáveis, modelos da fase como botões e um
  **botão único** que segue o rito (inclusive enviar e mudar a fase num ato).
- **Novo documento** unificado; **Pedir assinatura** a colega da unidade e
  **Assinar e juntar** num passo.
- Aba **Meu trabalho** (pediram sua assinatura, orientação do gabinete,
  comigo, vencendo, chegaram hoje, sem responsável) e aba **Mesa de decisão**
  para o gabinete; apreciação com a petição ao lado e **decisão por
  despacho**; decisões anteriores.
- **Devolver à secretaria com orientação**, em destaque até ser concluída.
- E-mail a quem está lotado quando um processo chega na unidade; o envio
  mostra quem vai receber.
- Leitor contínuo dos autos na tela da equipe; atalhos N, T e J.

### 09/11/2026 — Portal das partes completo (etapa 4)
- Entrada sem senha por link no e-mail, além de Google e e-mail/senha.
- Bloco **Para você** (prazos, manifestações aguardando, novidades), marca de
  novo em movimentos e documentos desde o último acesso, busca e filtro.
- **Processo completo em PDF**, Imprimir, **Certidão de andamento**, leitor
  contínuo dos documentos com marca de lido e link de conferência.
- "Em que ponto está" com etapas que faltam; prazos da parte em destaque com
  **Responder**.
- Manifestação guiada por tipo, com prazo respondido, rascunho no navegador,
  **comprovante de protocolo** e lista "Minhas manifestações" com a decisão.
- **Avisos por e-mail** às partes (tudo, só prazos e decisões, nenhum) a cada
  movimento público e lembrete de prazo 3 dias antes e no dia.
- Celular: barra fixa com as duas ações principais.

### 09/11/2026 — Importação de ritos (etapa 3)
- **Importar de arquivo** em Ritos: planilha, Word, PDF, BPMN, draw.io ou
  Mermaid viram uma proposta de rito completa, com fases, unidades, quem faz,
  ações, modelos, encaminhamentos e alternativas com condição.
- Tela de revisão com diagrama ao vivo; o admin edita tudo e decide se
  implanta. Implantar cria de uma vez as unidades, os modelos (esqueleto), o
  rito e, se marcado, o tipo de processo.
- No processo: a fase mostra unidade, ações, modelos e alternativas, e sugere
  tramitar para a unidade da fase.
- Sem IA: leitura estruturada.

### 09/11/2026 — Importação de modelos de documento (etapa 2)
- **Importar de arquivo** em Modelos (órgão e unidades): Word, PDF, HTML ou
  TXT viram modelo do editor, com cabeçalho, rodapé, brasão, fonte e imagens
  do Word e cabeçalho e rodapé repetidos do PDF.
- Campos como `{{numero}}`, `«Número»` e `[NÚMERO DO PROCESSO]` viram campos
  automáticos; o timbrado achado pode virar o da unidade ou do órgão.
- Opção de **manter o arquivo original** (Word ou PDF): no processo, cria a
  minuta com o arquivo, e o Word sai com os campos preenchidos.
- Sem IA: leitura estruturada (mammoth, pdfjs, XML do Word).

### 09/11/2026 — Processo Eletrônico por unidades (etapa 1)
- **Novo nome:** a Secretaria Processual passou a se chamar **Processo
  Eletrônico** (página `/ProcessoEletronico`; links antigos `/Secretaria`
  redirecionam). Nomes internos e dados não mudaram.
- **Configuração no Painel Administrativo** do órgão, aba Processo Eletrônico:
  ativação, preferências, unidades e equipes, tipos de processo, ritos,
  documentos e modelos e calendário. A aba Configuração saiu da página do
  processo (o admin tem o botão Configurar).
- **Unidades de lotação:** secretaria, gabinete, assessoria ou outra, com
  descrição; equipe com atribuição e gestor por pessoa; inserir membros do
  órgão, convidar por e-mail quem ainda não é do órgão (entra já lotado) e
  admitir ou recusar pedidos de lotação.
- **Gestor da unidade** (na nova aba Unidades do Processo Eletrônico): monta a
  equipe, define o papel timbrado próprio (ou usa o do órgão), soma tipos de
  documento aos do órgão e cria modelos da unidade.
- Documentos redigidos saem com o timbrado da unidade que os redigiu.
- Ex-membros do órgão (vínculo inativo) deixam de acessar o módulo.

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

