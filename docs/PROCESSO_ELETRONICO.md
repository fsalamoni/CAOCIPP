# Processo Eletrônico

Processo eletrônico do órgão: autuação com rito, tramitação entre unidades,
documentos redigidos na plataforma ou enviados, assinatura, juntada, linha do
tempo com integridade por hash e exportação dos autos em PDF.

O módulo é independente: serve a qualquer pessoa física ou jurídica, pública
ou privada, que use o SIGO com sua equipe. Não substitui nenhum sistema
processual externo e não altera os demais módulos do órgão.

Até nov/2026 o módulo se chamava **Secretaria Processual**. Os nomes internos
(functions `secretaria*`, coleções `sec*`, permissão `configure_secretaria`)
foram mantidos para não migrar dados; só o nome visível mudou.

O projeto completo e as decisões estão no documento de projeto (fora do
repositório). **Antes de mudar o módulo, leia o
[guia de lógica processual](./LOGICA_PROCESSUAL.md)**: ele explica o que é
ato do processo e o que é trabalho interno, e por que a tela e os autos são
organizados assim.

## Ativação

- Quem ativa: o **admin do órgão** (criador ou quem tem a permissão
  `configure_secretaria`), em Painel Administrativo → Processo Eletrônico.
  Ali fica **toda a configuração**: ativação e, em abas, estrutura, unidades e
  equipes, tipos de processo, ritos, documentos e modelos, calendário,
  integrações, preferências, lixeira e histórico. A aba fica no endereço
  (`&aba=`); sem ela, a página abre no primeiro dos 4 passos pendentes, ou em
  Ritos (`src/lib/passosConfiguracao.js`, `abaInicial`). A barra de abas fica
  fixa no topo e, no celular, rola na horizontal.
- Não depende de flag da plataforma. O estado fica em
  `organizations/{id}.secretariaConfig.enabled`, gravado só pela function
  `secretariaConfig` (ação `ativar`). Órgãos sem o campo ficam desligados.
- Na primeira ativação, se o órgão não tiver unidade nem rito, a plataforma cria
  a unidade "Secretaria" (com o admin lotado como gestor) e o "Rito comum" (Autuação →
  Instrução → Decisão → Cumprimento → Encerramento).
- Desativar esconde a página e bloqueia as functions. Nada é apagado.
- Página: `/ProcessoEletronico?org=<id>`; aba interna: `&aba=meu|caixa|mesa|todos|painel|unidades`
  (sem ela, ou com uma aba que a pessoa não tem, abre a padrão do perfil);
  processo aberto: `&p=<processoId>`. Links antigos `/Secretaria?...` redirecionam,
  e `/Organization?id=<id>&tab=processo-eletronico` também leva à página.
- Navegação: com o módulo ativo, o Processo Eletrônico é uma das páginas do
  órgão em `getOrganizationTabs` (chave `processo-eletronico`, antes do Painel
  Administrativo), com endereço próprio dado por `orgTabUrl`. Por isso aparece
  na barra horizontal (`OrgTabBar`) e no sub-menu lateral, e as duas continuam
  visíveis e com o item marcado dentro do módulo (o `Layout` trata
  `?org=` da página como o órgão ativo). Também aparece na paleta de comandos
  (Ctrl+K) como "Processo Eletrônico · órgão", e a busca da paleta (flag
  `global_search`) acha processos pelo número, assunto ou partes (nome ou
  CPF/CNPJ) e abre direto (`?org=…&p=id`); as partes ajudam a achar mas não
  aparecem no resultado. Na página, o admin tem o botão
  **Configurar**, que abre o Painel Administrativo na aba do módulo; quem não
  é admin, com o módulo desligado, é levado à página inicial do órgão.

## Perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| Organização | Admin do órgão (`configure_secretaria` ou criador) | Ativa, cria e edita unidades, define ritos, tipos de processo, timbrado e modelos do órgão, consulta todos os processos |
| Gestor da unidade | Lotado com a marca de gestor | Monta a equipe da unidade (insere membros, convida por e-mail, admite pedidos, define atribuições e outros gestores), escolhe o timbrado, os tipos de documento e os modelos da unidade |
| Secretaria | Lotado em unidade do tipo `secretaria` | Autua, junta, tramita, muda fase, atribui, sobrestá e arquiva quando tem o processo |
| Decisão | Lotado em unidade que decide (o tipo `gabinete`, por padrão; ver Papéis da unidade) | Os mesmos atos quando o processo está no gabinete (ex.: minuta de decisão, assinatura, juntada, devolução) |
| Assessoria e outras | Lotado em unidade do tipo `assessoria` ou `outra` | Os mesmos atos de movimentação quando tem o processo (ex.: estudo e minuta) |
| Partes e representantes | Qualquer conta (externa **ou de membro do órgão**), habilitada por convite; o vínculo é por processo, nunca por `userOrganizations` | Pelo portal (`/Portal`): acompanham os processos em que foram habilitadas e peticionam a qualquer tempo. Um representante (advogado, procurador, preposto) tem a própria conta e fala pela parte. Quem é parte num processo **não é o órgão nele**: veja "Parte e membro: dois papéis" |

O poder de movimentar vem da **posse**: o processo está sempre com uma unidade
(`unidade_atual`) e só quem está lotado nela age sobre ele.

## Visibilidade

- **Sigilo normal:** qualquer membro lotado em alguma unidade do órgão lê.
- **Sigilo restrito:** só unidades por onde o processo passou
  (`unidades_historico`) e o admin.
- **Minutas:** só a unidade que as redigiu, até a juntada, e as unidades para
  onde seguiram junto com o processo numa remessa (`unidades_acesso`,
  `minutaAcessivel` em `functions-v2/src/shared/secretaria.ts`).
- Membro do órgão sem lotação não vê processo nenhum (salvo o admin). A página
  mostra a ele a aba Unidades, de onde pode pedir lotação.
- Membro com vínculo inativo no órgão não acessa o módulo.

## Unidades de lotação e equipes

Cada unidade tem tipo (`secretaria`, `gabinete`, `assessoria`, `outra`), nome,
sigla, descrição e uma **equipe**: cada pessoa lotada tem uma atribuição (texto
livre, ex.: "Chefe de secretaria") e pode ser **gestora** da unidade.

**Papéis da unidade** (`papeis`, nov/2026): além do tipo, cada unidade diz o
que faz no processo.

- **Decide** (`papeis.decide`): recebe a conclusão (a remessa a ela grava o
  movimento `conclusao`), aprecia pendências e petições, decide por despacho
  ligado à pendência, tem a Mesa de decisão e recebe os avisos de pendência.
- **Expede** (`papeis.expede`): intima, notifica e cita as partes
  (`expedirComunicacao`); na tela, é também quem torna sem efeito a
  comunicação que ainda aguarda ciência.

O tipo dá o padrão: o gabinete decide e a secretaria expede, como sempre
foi. A unidade muda o padrão em **Dados** (só quem cuida da estrutura), nas
duas caixas sob "Papel no processo": uma comissão processante que intima e
decide, um pregoeiro, um fiscal de contrato, uma secretaria que não expede.
O servidor guarda só o que difere do padrão do tipo (`sanitizePapeis`), de
modo que trocar o tipo volta ao padrão do novo tipo, e resolve o papel com
`unidadeDecide` e `unidadeExpede` (`functions-v2/src/shared/secretaria.ts`;
espelho da tela em `src/lib/permissoesFase.js`). O estado devolve `decide` e
`expede` já resolvidos em cada unidade. Unidade sem escolha própria e
processo já autuado não mudam. A lista de unidades mostra "Decide" e
"Expede" quando o papel vai além do tipo.

- **Onde se gerencia:** o admin, no Painel Administrativo (aba Unidades e
  equipes); o gestor, na aba **Unidades** da página do Processo Eletrônico.
  As abas da unidade são Equipe, Timbrado e tipos, Modelos e Dados (só admin).
- **Inserir:** o gestor escolhe um membro ativo do órgão e o lota.
- **Convidar:** o gestor informa um e-mail; a plataforma envia um link
  (`/ProcessoEletronico?equipe=<token>`, vale 7 dias, uso único) e mostra o
  link para copiar. Quem aceita precisa entrar com o mesmo e-mail; vira membro
  do órgão (ou tem o vínculo reativado) e já entra lotado com a atribuição
  indicada. Convites pendentes podem ser revogados.
- **Pedir lotação:** qualquer membro do órgão vê o diretório de unidades e pede
  lotação com uma mensagem. O gestor ou o admin admite (com atribuição) ou
  recusa.
- O gestor não cria nem desativa unidades, não muda tipo, nome ou sigla e não
  retira a própria marca de gestor (evita unidade sem gestor por engano).
- **Equipe salva por duas pessoas ao mesmo tempo:** a tela manda a equipe de
  onde a edição partiu (`lotacoes_base`) e o servidor aplica só o que a pessoa
  mudou sobre a equipe atual (`mesclarLotacoes`), sem desfazer admissões
  feitas no meio-tempo. Quem sai da equipe deixa de ser responsável pelos
  processos da unidade (registro de controle "Atribuição removida").
- **Desativar unidade** (admin): só passa quando a unidade não tem processo em
  andamento nem sobrestado; processos arquivados não impedem. O servidor
  informa quantos processos precisam ser enviados a outra unidade antes.
- **Timbrado e tipos da unidade:** a unidade usa o papel timbrado do órgão ou
  um próprio (cabeçalho, brasão, rodapé, fonte). Os tipos de documento da
  unidade se somam aos do órgão. O documento redigido sai com o timbrado da
  unidade que o redigiu (`unidade_origem`), inclusive no PDF dos autos.
- **Modelos da unidade:** aparecem para quem redige na unidade, junto com os
  modelos do órgão.
- Unidades antigas, só com `membros_uids`, continuam valendo: as atribuições
  ficam vazias e ninguém é gestor até o admin marcar. Ao salvar a equipe, a
  plataforma grava `lotacoes` e mantém `membros_uids` em sincronia.

## Importação de modelos (etapa 2)

Em Modelos (do órgão ou da unidade), **Importar de arquivo** aceita Word
(.docx), PDF, HTML e TXT até 5 MB. A leitura é estruturada, sem IA
(`functions-v2/src/secretaria/importarModelo.ts`), e nada é gravado até a
pessoa confirmar.

- **Word:** o corpo vem pelo mammoth, com títulos, negrito, itálico, listas,
  tabelas, links e imagens. Do pacote do Word saem o **cabeçalho** (até 4
  linhas), a primeira imagem PNG/JPG do cabeçalho até 300 KB como **brasão**, o
  **rodapé** (sem o número de página) e a **fonte e o tamanho** padrão.
- **PDF:** o texto é lido por linha (pdfjs) e reagrupado em parágrafos pelo
  espaçamento. O que se repete no alto e no pé das páginas vira cabeçalho e
  rodapé. Imagens, negrito e tabelas do PDF não vêm. PDF digitalizado (sem
  texto) só pode ser guardado como original.
- **Campos:** `{{numero}}`, `${numero}`, `«Número»`, `<<data>>` e
  `[NÚMERO DO PROCESSO]` viram campos automáticos quando o nome é conhecido
  (número, assunto, tipo, partes, unidade, fase, órgão, usuário, data e data por
  extenso, com sinônimos como "interessado", "signatário" ou "data por
  extenso"). Nomes desconhecidos entre chaves ou aspas angulares ficam como
  campo para preencher à mão; colchetes com nome desconhecido (ex.: `[1]`)
  ficam como texto.
- **Papel timbrado achado:** a tela mostra a prévia e oferece usá-lo como
  timbrado da unidade (vira timbrado próprio) ou do órgão. Só muda se a pessoa
  marcar.
- **Como guardar:**
  - *Modelo editável:* abre no editor para revisar e salvar (formato
    `editor`). Modelos com imagens que passem de ~900 KB no total precisam de
    imagens menores ou do formato original (teto do Firestore).
  - *Arquivo original* (Word ou PDF): o arquivo fica no Storage
    (`secretaria/{org}/modelos/{id}`, formato `original`). No processo, a lista
    **Modelo em arquivo…** das minutas cria uma minuta com o arquivo; no Word, os
    campos saem preenchidos com os dados do processo, mesmo quando o Word
    quebrou o campo em trechos de formatação diferentes. A ficha do modelo
    permite baixar e trocar o arquivo.

## Importação de ritos (etapa 3)

Em Ritos, **Importar de arquivo** lê o desenho do rito e propõe o rito
completo: fases, unidade de cada fase, quem faz, ações, modelos de documento,
encaminhamentos e alternativas com condição. Nada é gravado até o admin
revisar e confirmar. A leitura é estruturada, sem IA
(`src/lib/propostaRito.js`, testada em `src/lib/propostaRito.test.js` e
`src/lib/propostaRitoNiveis.test.js`; a parte do servidor em
`functions-v2/test/importarRito.test.js`).

- **Planilha** (.xlsx, .xlsm, .xls, .ods, .csv, lida no navegador): colunas com
  cabeçalho (na 1ª linha ou até a 5ª, abaixo de um título), em qualquer ordem,
  entre Fase/Etapa, Unidade/Setor, Responsável/Quem faz, Ações,
  Documentos/Modelos, Segue para, Condição, Prazo, Orientação, Fase principal
  (ou Macroetapa), Subprocesso e Paralela. Linhas seguidas com o mesmo nome de
  fase são juntadas (uma linha por encaminhamento ou por ação). "Segue para"
  aceita nome ou número da linha, "Se X: Fase Y", fase de outra aba ou o nome
  de uma aba (vai para a primeira fase dela).
  **Todas as abas são lidas** (`propostaDeAbas`); abas sem a coluna de fase
  (legenda, instruções) são puladas. Níveis: a aba com o nome de uma fase de
  outra aba (ou citada na coluna Subprocesso) detalha essa fase, e as etapas
  dela entram no lugar da fase; a coluna Fase principal faz o mesmo dentro da
  aba. As etapas herdam unidade e quem faz do grupo, as saídas do grupo passam
  para a última etapa e a orientação diz "Parte de "Instrução › Requisições"".
  Abas principais sem ligação entre si ficam em sequência, na ordem, com aviso.
- **Word e PDF** (texto extraído pela function `extrairTextoRito`): se o Word
  tem tabelas com coluna de fase, todas são lidas como abas de uma planilha.
  Senão, o texto: "Fase 1 – Nome", "1. Nome" (também "1.Nome", como o PDF
  costuma sair) ou títulos abrem fase; "1.1 Nome" e marcadores viram ações;
  linhas "Unidade:", "Responsável:", "Documentos:", "Segue para:", "Prazo:" e
  "Orientação:" preenchem a fase; "Se X, segue para Y" vira alternativa. A
  primeira linha antes de qualquer fase vira o nome do rito. No PDF (todas as
  páginas, até 30), pedaços de texto separados por um vão ganham espaço e o
  cabeçalho e o rodapé que se repetem nas páginas (data de impressão, endereço,
  "1/8") saem. PDF sem texto (digitalizado) e PDF sem fases dão mensagem que diz
  o que enviar no lugar.
- **Diagramas:** BPMN 2.0 (.bpmn, Camunda, Bizagi, bpmn.io), XPDL 2.x (.xpdl,
  exportação do Bizagi e de outras ferramentas) e o **pacote do Bizagi Modeler
  (.bpm)**: a function `extrairTextoRito` abre o ZIP e os ZIPs das páginas
  (`.diag`, até 3 níveis, até 500 entradas, 40 diagramas e 6 MB de XML) e
  devolve os `Diagram.xml`; o navegador lê **todas as páginas juntas**
  (`propostaDeDiagramas`). Raias viram unidades, tarefas viram fases, desvios
  exclusivos e inclusivos viram alternativas com o rótulo da seta como
  condição, objetos de dados viram modelos, anotações e descrições viram
  orientação. Níveis e páginas (`propostaDeModelos`): subprocesso embutido
  (`subProcess`, `BlockActivity`) e chamada de subprocesso de outra página
  (`callActivity`, `SubFlow`) se abrem no lugar da atividade (entra pelo
  início de dentro, sai pelo fim de dentro, com "Parte do subprocesso" na
  orientação); mensagens entre piscinas ligam um processo ao outro. Diagramas
  desenhados em páginas separadas são unidos sozinhos, nesta ordem: atividade
  com o nome de outro diagrama (ou piscina) abre esse diagrama no lugar;
  evento de fim ou de ligação com o mesmo nome de um evento de início ou de
  ligação de outro diagrama liga os dois; evento de fim que cita o nome de
  outro diagrama leva ao início dele; e, sem nenhuma dessas pistas, o diagrama
  que ninguém alcança começa onde o anterior termina (com vários fins, só o
  principal, o mais distante do início, é ligado; os outros continuam
  encerrando o processo). Cada união aparece nas observações da revisão. A
  piscina dá nome ao diagrama quando o processo tem nome genérico
  ("Processo 1"). Também: draw.io (.drawio,
  inclusive comprimido; raias, losangos de decisão, formas de documento) e
  Mermaid (`subgraph` vira unidade, `{}` vira decisão, rótulo da seta vira
  condição). Também dá para colar o texto ou o XML.
- **Etapas paralelas:** o processo eletrônico anda uma fase por vez, então
  ramos paralelos (desvio paralelo/AND no diagrama, coluna Paralela na
  planilha) ficam em sequência: o fim de cada ramo segue para o começo do
  próximo e o último segue para depois da junção. A fase ganha "corre em
  paralelo com: …" na orientação e a revisão mostra um aviso.

**Uma só tela para criar e editar** (`PropostaRito.jsx`, nov/2026). "Novo
rito" abre o início: em branco, um modelo pronto, um arquivo ou texto colado.
Clicar num rito da lista abre o mesmo rito nesta tela (`deRito` converte
`unidade_id` e `modelos` em referências). O antigo `RitoEditor.jsx` saiu.
Na edição, o lado mostra a situação (disponível para novas autuações, tipos
de processo que usam o rito, versões anteriores), exportar (ver abaixo) e, como na criação, unidades e modelos novos e a opção de criar um
tipo. Salvar chama `aplicarPropostaRito` com `rito_id` e `ativo`: o servidor
guarda a versão atual em `versoes/`, grava `versao + 1` e cria, no mesmo
lote, as unidades e os modelos novos citados. O rascunho fica no navegador,
um por rito (`rito-rascunho-{org}-{id}`; o de rito novo segue
`rito-rascunho-{org}`); ao reabrir, a tela oferece recuperar ou descartar, e
avisa se o rascunho foi feito sobre outra versão. Mexer no rito sem recuperar
conta como descartar. Recuperar mantém a versão atual, então salvar sempre
gera a versão seguinte. "Substituir fases" (só na edição) reabre o início para
trocar as fases por um modelo, arquivo ou texto, mantendo nome, situação e
versões. O rito precisa de ao menos uma fase: a última não pode ser removida.

**Exportar o rito** (`src/lib/exportarRito.js`, janela `ExportarRito.jsx`,
nov/2026). Abre pelo menu do rito, "Exportar (imagem, Bizagi, planilha)", e
pelo botão "Exportar o rito" da tela de edição. Tudo é gerado no navegador,
sem chamada ao servidor; quem vê a aba Ritos (admin do órgão) exporta.

| Formato | Função | O que leva |
| --- | --- | --- |
| Bizagi e BPMN 2.0 (.bpmn) | `ritoParaBpmn` | `collaboration` com uma piscina, `laneSet` com uma raia por unidade, `startEvent`, uma `task` por fase (nome com o prazo; `documentation` com orientação, prazo e ações), um `exclusiveGateway` por fase com mais de uma saída, `endEvent`, `sequenceFlow` com a condição no nome e BPMNDI (formas, pontos das setas e rótulos). No Bizagi Modeler: Importar, BPMN. |
| Imagem (.png), PDF, SVG | `ritoParaSvg` | O desenho de `desenharFluxo` com `porFaixa = Infinity` e `opcoes.completo`: uma faixa só, sem dobra, sem texto cortado, uma raia por unidade, cada seta chegando na sua altura. O PNG sai até no dobro do tamanho (limite de 16.000 px de lado); o PDF tem uma página do tamanho do desenho. Opção de mostrar as ações dentro das fases. |
| Planilha (.xlsx) | `ritoParaAbas` | Aba "Rito" (Nº, Fase, Unidade, Prazo, Contagem, Tipo, Ações, Segue para, Condição, Orientação) e aba "Ações em detalhe". |
| Mermaid (.mmd) | `ritoParaMermaid` | `flowchart LR`, um `subgraph` por unidade, todo rótulo entre aspas, condição na seta. |

Planilha, Mermaid e BPMN voltam pela importação do rito
(`propostaDeAbas`, `propostaDeMermaid`, `propostaDeBpmn`).
`exportarRito.test.js` confere, nos 70 modelos da biblioteca, que cada formato
volta com as mesmas fases, caminhos, prazos e unidades, e que o desenho sai
numa faixa, com uma raia por unidade e sem texto cortado.
`scripts/e2e-exportar-rito.mjs` baixa os seis formatos pela tela e confere os
arquivos. Estes formatos levam o fluxo; o pacote completo para outro órgão
(modelos de documento, regras, tipo) continua em "Exportar para outro órgão".

**Excluir rito** (`excluirRito`, só admin): exclusão suave (`excluido: true`,
`ativo: false`, `excluido_em`, `excluido_por`). Recusada enquanto algum tipo
de processo não excluído usa o rito, ativo ou inativo (a mensagem cita os
tipos; na tela, cada tipo tem o botão "Abrir o tipo"). O rito some de `estado`,
não autua, não aceita `salvarRito`, `versoes` nem `salvarTipo`, e não conta
no limite de ritos. Processos já autuados seguem com a cópia das fases.
Restaurar e duplicar: ver "Excluir, restaurar e duplicar" abaixo.

**Revisão** (`PropostaRito.jsx`): no alto, o fluxo inteiro desenhado na
notação do Bizagi (ver "Diagrama do fluxo" abaixo), atualizado ao vivo; clicar
numa fase do desenho abre o cartão dela. Abaixo, cada fase em cartão
recolhível (o cabeçalho resume unidade, prazo e saída), com nome, prazo,
unidade (existente, nova ou nenhuma), quem faz, ações (cada uma com o que
pede, onde fica e quem vê, ver "Registro nos autos e documentos exigidos"),
registro da fase, documentos exigidos, modelos, encaminhamentos com condição,
fase final e orientação. Ação de lista com menos de duas opções impede salvar. As observações da leitura do arquivo
ficam num bloco que abre e fecha. Ao lado: unidades novas (renomear, tipo ou trocar por uma existente), modelos novos
(renomear, tipo de documento ou trocar por um existente) e a opção de criar o
tipo de processo. Unidades e modelos com o mesmo nome dos já existentes são
ligados a eles, sem duplicar.

**Implantar** (`aplicarPropostaRito`, só admin) grava tudo num lote atômico:
as unidades novas (equipe vazia, para o gestor ou admin lotar), os modelos
novos como esqueleto no editor (título, número, assunto, partes, local e data,
signatário) na unidade da fase, o rito (`origem: 'importacao'` quando novo) e, se pedido, o
tipo de processo com a unidade inicial da primeira fase. Referências a unidade
ou modelo que não sejam do órgão são descartadas, também em `salvarRito`.

**No processo:** a fase atual mostra unidade, quem faz, a lista de ações, os
modelos indicados e as alternativas. Se a fase corre noutra unidade, aparece
**Tramitar para lá**, com o destino já escolhido. Em Mudar fase, cada opção
mostra a condição. O editor de ritos também edita unidade, quem faz, ações e
condições. O portal das partes recebe só nome, prazo e ligações das fases.

## Modelo de dados

Todas as coleções são fechadas ao cliente (`allow read, write: if false`). Leitura
e escrita passam pelas functions, que aplicam posse, lotação, sigilo e minutas.

| Coleção | Conteúdo |
|---|---|
| `secUnidades/{id}` | `organization_id, nome, sigla, tipo (secretaria\|gabinete\|assessoria\|outra), papeis{decide?, expede?} (só o que difere do padrão do tipo), descricao, lotacoes[{uid, atribuicao, gestor}], membros_uids[]` (espelho de `lotacoes`), `pedidos[{uid, nome, email, mensagem, em}], ativa` |
| `secUnidadeConfig/{unidadeId}` | `organization_id, timbrado_proprio, documento` (mesmo formato do timbrado do órgão), `tipos_documento[]` |
| `secConvitesEquipe/{sha256 do token}` | `organization_id, unidade_id, email, atribuicao, criado_por, criado_por_nome, expira_em, usado_por, revogado` |
| `secRitos/{id}` | `organization_id, nome, descricao, fases[{id, nome, prazo_dias?, orientacao?, proximas?[], final?, unidade_id?, agente?, acoes?[] (até 20), modelos?[] (até 10), condicoes?{fase_id: texto}, registro_atos?{fase?, remessas?, outros?{prazo?, pendencia?, urgencia?, dados?, atribuicao?}} (evento \| informacao \| nenhum; ausente = autos, atribuição = evento; o antigo registro? remessas_fora \| interno ainda é lido), certidao?{grupo?, titulo?, incluir_mudancas?}, acoes_regras?[{pede?, rotulo?, ajuda?, opcoes?[], modulo? (pede registro: consultas \| expedientes \| parcerias \| juri), destino? (autos \| informacao \| nenhum \| consolidar; ausente = evento), partes?, obrigatoria?, documento?} \| null] (alinhadas a acoes), documentos?[{descricao, forma (redigir \| juntar \| qualquer), tipo?, modelo_id?, destino? (evento \| informacao = guardado fora dos autos)}] (até 5)}], versao, ativo, origem? ('importacao'), excluido?, excluido_em?, excluido_por?` |
| `secRitos/{id}/versoes/{000n}`, `secModelos/{id}/versoes/{000n}` e `secTipos/{id}/versoes/{000n}` | versão anterior (até 20 por item): `versao, salvo_em, salvo_por` e os campos de conteúdo (`nome, descricao, fases, exigir_tipo`, `nome, tipo_documento, descricao, conteudo` ou os `CAMPOS_TIPO`) |
| `secTipos/{id}` | `organization_id, nome, sigla, descricao, rito_id, sigilo_padrao, unidade_inicial, ativo, formulario{assunto, descricao, partes, origem ("opcional" \| "obrigatorio" \| "oculto"), sigilo, urgencia, unidade ("opcional" \| "oculto"), rotulos{}, ajudas{}, polos[], campos[{id, rotulo, tipo, obrigatorio, ajuda, opcoes[], visivel_partes, formato?, secao?, condicao?{campo_id, valor}, exigir_em?[], modulo? (tipo registro), importar?{de (id do campo registro), dado} (visivel_partes sempre falso)}]} (até 40 campos), numeracao{modo: "orgao" \| "propria" \| "nenhuma", partes[]?}?` |
| `secContadores/{chave}` | `seq` de cada contagem: `{org}_{ano}` (a de sempre, `000001/2026`) ou `{org}_{escopo}_{alvo}_{período}` |
| `secProcessos/{id}` | `numero, assunto, descricao, partes[], campos[{id, rotulo, tipo, valor (lista de textos na múltipla; número no registro), visivel_partes, formato?, ref?{modulo, id, numero, titulo?, restrito?} (registro)}], campos_exigidos?{fase_id: [{id, rotulo, condicao?}]}, origem{tipo, descricao}?, sigilo, status, tipo_id?, tipo_nome?, rito_id, rito_versao, fases[]` (cópia), `fase_atual, unidade_atual, unidades_historico[], responsavel_uid, mov_seq, doc_seq, folhas_seq, ultimo_hash, version, recebido_em, acoes_feitas{faseId: [idx]}, exigencias_cumpridas{faseId: {chave: {documento_id, ordem}}}?, orientacao{texto, por, em, de}?, assinaturas_pendentes[{docId, uid, titulo}]` |
| `secProcessos/{id}/movimentos/{seq}` | `seq, tipo, descricao, autor_uid, autor_nome, unidade_id, em, dados, hash_anterior, hash` |
| `secProcessos/{id}/documentos/{id}` | `titulo, tipo, origem (editor\|upload), status (minuta\|juntado), unidade_origem, conteudo` (ou `delta` legado) ou `storage_path, mime, tamanho`, `sha256, assinaturas[], assinaturas_pedidas[{uid, nome, por, em}]?, ordem, juntado_em, visivel_partes, peticao?, peticao_tipo?, modelo_id?, unidades_acesso?[], paginas, folha_inicial, folha_final, pdf_path?, pdf_sha256?, codigo_verificacao?` |
| `secConfig/{org}` | `documento: {cabecalho_linhas[], brasao, rodape, fonte_padrao, tamanho_padrao, layout, tipos_documento[]}` (papel timbrado; `layout` como o `doc.attrs.layout`, ou null), `calendario: {feriados[{data, descricao}], recessos[{inicio, fim, descricao}], recesso_forense}`, `alerta_prazos` |
| `secVerificacao/{código}` | cópia pública da juntada: `organization_id, processo_id, documento_id, orgao, numero, ordem, titulo, tipo, origem, nome_arquivo, juntado_em, juntado_por, folha_inicial, folha_final, paginas, assinaturas[{nome, em, nivel}], sha256, pdf_sha256, peticao` |
| `secModelos/{id}` | `organization_id, unidade_id?` (vazio = modelo do órgão), `nome, tipo_documento, descricao, ativo, versao, formato (editor\|original)`, `conteudo` (editor) ou `storage_path, arquivo_nome, arquivo_mime, tamanho` (original) |
| `secConvites/{sha256 do token}` | `organization_id, processo_id, parte_idx, parte_nome, email, expira_em, usado_por, revogado` |
| `secPortalAcessos/{uid da parte}` | `avisos` (`tudo`, `prazos`, `nenhum`), `email`, `processos{processoId: último acesso ISO}` — fechada ao cliente; só o portal grava |
| `notifications/{id}` (coleção da plataforma) | avisos da equipe: `user_id, type: 'processo_eletronico', subtype, title, message, organization_id, entity_type: 'processo_eletronico', entity_id (processo), read, created_at` — gravada só pelas functions; o dono lê e marca como lida |
| `userPreferences/{uid}.notificationPreferences.processo_eletronico` | `{ sino, email }` — preferência de aviso da pessoa, gravada pelo cliente |

No processo, cada item de `partes[]` pode ter `uid` (conta habilitada),
`convite_hash` (último convite) e `representantes[]` (até 5 por parte, cada um
`{ nome, email?, uid?, convite_hash?, habilitada_em?, conta? }`) e, se a parte
saiu do processo pela retificação, `retirada { em, por }` (a parte fica na lista,
na mesma posição, sem conta nem convite);
`partes_uids[]` lista todas as contas habilitadas (partes e representantes) e
é o que o portal consulta e o que impede o acesso como equipe. No aceite, a
function grava `users/{uid}.portal_partes = true` (só para o menu do SIGO
oferecer o portal a quem também é membro).

O processo guarda a **cópia das fases** do rito com que foi autuado. Editar o
rito incrementa `versao` e só vale para os próximos processos.

Arquivos ficam no Cloud Storage em `secretaria/{org}/{processo}/{documento}`;
modelos guardados no original, em `secretaria/{org}/modelos/{modelo}`.
`storage.rules` nega todo acesso do navegador; o Admin SDK das functions
ignora as regras.

## Functions

| Function | Ações |
|---|---|
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade` (admin; gestor só equipe e descrição), `obterUnidadeDocumento`, `salvarUnidadeDocumento` (gestor), `convidarEquipe`, `revogarConviteEquipe`, `convitesPendentes`, `pedirLotacao`, `decidirPedido` (gestor), `verConviteEquipe` e `aceitarConviteEquipe` (quem tem o link), `salvarRito`, `salvarTipo`, `salvarPreferencias`, `salvarIntegracoes {integracoes}` (admin), `salvarDocumentoConfig`, `salvarModelo` (admin; gestor para modelo da unidade; aceita `formato: 'original'` com o arquivo), `importarModelo` (mesma permissão; só interpreta e devolve a proposta), `obterModelo` e `baixarModelo` (qualquer membro; `baixarModelo` com `valores` devolve o Word preenchido), `extrairTextoRito` e `aplicarPropostaRito` (admin; com `rito_id` edita; ver Importação de ritos), `excluirRito` (admin), `salvarCalendario`, `versoes` (`colecao: 'rito' \| 'modelo' \| 'tipo'`; com `versao`, no tipo, devolve o conteúdo) e `restaurarVersao` (`colecao: 'rito' \| 'modelo'`; admin, ou gestor para modelo da unidade) |
| `secretariaProcesso` | `listar` (com `limite` e `cursor`, paginado), `contadores`, `obter`, `autuar` (opcional `origem`, com `origem.ref {modulo, id}` quando nasce de outro registro), `indice` (processos que a pessoa vê e ids com processo, para o selo e a busca), `vinculados {modulo, id}` (processos ligados a um registro de outro módulo ou derivados de outro processo, `modulo: 'pe'`), `tramitar` (opcionais `fase_id`, `orientacao` e `minutas`, as que seguem com o processo; com `fase_id` e documento exigido em aberto, `motivo` vira a dispensa), `atribuir`, `avancarFase` (idem), `alterarStatus`, `abrirPendencia`, `resolverPendencia`, `abrirPrazo`, `encerrarPrazo`, `convidarParte`, `revogarParte`, `marcarAcao`, `concluirOrientacao`, `alterarDados` (descrição e campos próprios do tipo; com `assunto`, `origem`, `sigilo` ou `partes`, retificação com `motivo` obrigatório) |
| `secretariaPortal` | (partes, sem vínculo com o órgão) `aceitarConvite`, `preferencias`, `meusProcessos`, `obter`, `baixar`, `pdf`, `peticionar`, `exportar`, `certidao`, `comprovante` |
| `secretariaDocumento` | `criarMinuta` e `upload` (opcional `modelo_id`), `editarMinuta`, `assinar`, `pedirAssinatura`, `juntar` (opcionais `assinar`, `resolve_pendencia_id` e `atende`, as exigências do rito que o documento cumpre), `excluirMinuta`, `baixar`, `pdf` (prévia da minuta com marca d'água ou documento juntado carimbado) |
| `secretariaExportarPdf` | gera o PDF dos autos |
| `secretariaPlataforma` | (só administração da plataforma) `resumo`, `suspender` |
| `secretariaConferir` | (pública, sem login) consulta um documento juntado pelo código de conferência |
| `secretariaAlertaPrazos` | (agendada, todo dia às 7h de Brasília) e-mail de prazos vencidos ou que vencem em até 2 dias |

Regras comuns:

- Toda movimentação roda em transação, confere `version` (o cliente manda a
  versão que viu; se outra pessoa movimentou antes, a resposta é `aborted`) e
  grava um movimento encadeado.
- **Cadeia de hash:** cada movimento leva `hash = SHA-256(JSON canônico do
  movimento + hash_anterior)`. `obter` e a exportação reconferem a cadeia e
  apontam o primeiro movimento adulterado.
- Lógica pura em `functions-v2/src/shared/secretaria.ts`, testada em
  `functions-v2/test/secretaria.test.js` (`npm --prefix functions-v2 test`).
- **Atualização sozinha das telas (16/11/2026).** Depois de cada ato que muda
  processo (lista `ATOS_QUE_MUDAM` em `secretaria/context.ts`: autuar,
  tramitar, marcar ação, juntar, assinar, expedir, peticionar, dar ciência e
  os demais), `comSinal` grava `secSinais/{orgId}` com a hora e o id do
  processo. A página do Processo Eletrônico escuta esse documento
  (`useSinalProcessos`) e relê as listas e, se for o processo aberto, os
  autos dele, juntando atos seguidos em uma releitura (1,5 s) e esperando a
  aba voltar ao primeiro plano. Quem fez o ato não relê duas vezes: o que já
  foi relido depois de o sinal chegar fica como está. Leituras nunca
  sinalizam (teste `functions-v2/test/sinal.test.js`), então uma tela que
  relê não provoca a releitura das outras. Se o sinal falhar, nada do ato se
  perde: a tela se atualiza como antes, na próxima ação de quem a usa.
- **Carregamento (16/11/2026).** Com link direto para um processo
  (`?p=`), os autos e a tela do processo são pedidos junto com o
  `estado` do órgão, não depois dele. `obter` lê movimentos, documentos e
  leituras do processo em paralelo. O `estado` fica 60 s sem ser relido ao
  voltar à página e os autos 15 s (todo ato invalida na hora).

## Documentos

- Todo documento nasce **minuta** da unidade que tem o processo, redigido no
  editor ou enviado (PDF, PNG, JPG, TXT, DOC, DOCX, ODT, XLSX; até 50 MB).
- **Envio de arquivo** (19/11/2026): todo arquivo sobe pelas próprias
  funções, o mesmo caminho do resto da tela (`prepararEnvio` em
  `secretariaService.js`). Até 4 MB vai em `base64` na chamada. Acima disso
  vai em partes de 4 MB, com progresso, pela ação `enviarParte` de
  `secretariaPortal` (qualquer conta liberada; grava só em
  `secretaria-envios/{uid}/{id}.NN`), e a chamada final leva `envio` no lugar
  do `base64`. A função (`secretaria/arquivos.ts`, `lerArquivoEnviado`) junta
  as partes, confere o dono pelo caminho, o tamanho e se o conteúdo bate com
  o tipo (assinatura do arquivo: um executável chamado .pdf é recusado),
  guarda no lugar definitivo e apaga as partes. **Não voltar ao envio direto
  do navegador ao Storage** (usado de 16 a 19/11/2026): redes de órgãos
  públicos barram `firebasestorage.googleapis.com` e o envio ficava em 0%
  sem erro. A regra de `storage.rules` para a área de espera segue aberta só
  para as abas abertas antes da troca.
- **Limite de descompressão:** Word, LibreOffice e planilha são pacotes ZIP.
  Antes de ler, a função confere o pacote (`abrirZip` em
  `secretaria/conversaoComum.ts`): até 3.000 partes, 120 MB por parte e
  300 MB descompactados no total, com cada parte descompactada sob teto para
  conferir o tamanho que declara. Arquivo acima disso não abre no editor nem
  é convertido ("envie em PDF"); na juntada, vira folha de referência e o
  original segue nos autos.
- **Original intacto e versão de leitura:** o arquivo enviado é a prova e
  nunca é alterado: fica byte a byte, com o SHA-256 calculado sobre ele. Se o
  gzip economizar ao menos 5%, é guardado compactado sem perda
  (`compactado: 'gzip'`, `tamanho_armazenado`; texto e alguns PDFs; foto e
  Word já vêm compactados) e volta igual ao baixar. Além dele, o envio gera a
  **versão de leitura** (`leitura_path`, `{arquivo}.leitura.pdf`), que é
  o que vai às folhas carimbadas, à tela e ao PDF do processo: foto reduzida
  a no máximo 300 dpi numa A4 e recomprimida sem perda perceptível (JPEG de
  qualidade 85 sem subamostragem de cor, ou PNG sem perda, o menor; já na
  orientação da câmera), PDF reorganizado sem perda quando fica ao menos 10%
  menor, e Word, planilha e texto já convertidos para PDF. "Baixar original"
  entrega sempre o arquivo como foi enviado. Documentos enviados antes desta
  mudança continuam como estavam (sem versão de leitura).
- **Arquivo grande na resposta:** até 15 MB volta em base64; acima disso a
  função grava uma cópia em `secretaria-temp/{uid}/` com token aleatório e
  devolve um link (`entregar`), que o navegador baixa. As cópias são
  apagadas a cada nova entrega da mesma conta (as de mais de uma hora) e na
  rotina diária `secretariaAlertaPrazos`, com os envios abandonados.
- **Visor de PDF:** no computador com leitor de PDF embutido, a tela usa o do
  navegador; no celular e no tablet (onde o PDF num quadro não aparecia no
  Android e mostrava só a 1ª página no iPhone) usa o pdf.js
  (`VisorPdf.jsx`, carregado só quando preciso), página a página, com zoom
  e Baixar. Vale para o leitor dos autos, a prévia do editor e o documento da
  pendência.
- O **editor** (TipTap) mostra uma folha A4 com o papel timbrado e tem as
  ferramentas de um processador de texto: estilos (títulos, citação), fonte e
  tamanho, negrito, itálico, sublinhado, tachado, sobrescrito, subscrito, cor
  e realce, alinhamento, espaçamento entre linhas, recuo de primeira linha e
  de parágrafo, listas, tabelas (mesclar, dividir, cabeçalho), imagem PNG/JPG,
  link, linha horizontal, quebra de página (Ctrl+Enter), caracteres
  especiais, localizar e substituir, limpar formatação, desfazer/refazer, zoom
  e contagem de palavras. Ctrl+S salva.
- **Editor como o Word/LibreOffice (16/11/2026):**
  - *Fontes de mesma medida:* Times New Roman, Arial, Calibri, Cambria e
    Courier New aparecem e são impressas com Tinos, Arimo, Carlito, Caladea e
    Cousine (livres, com as mesmas larguras de letra). A linha quebra no mesmo
    lugar no editor (`@fontsource/*`, `fontesDocumento.js`), no PDF dos autos
    (`@expo-google-fonts/*` em `pdfDocumento.ts`) e no Word. Documento gravado
    antes disso (sem `fontes: 2`) é refeito com as fontes de antes
    (`FONTES_LEGADO`, `ehLegado`), para as folhas já numeradas não mudarem.
  - *Espaçamento como no Word:* `espacamento` é o "múltiplo" do Word (1,15 =
    simples do Word); no editor vira `line-height` = espaçamento × 1,15. Antes
    e depois do parágrafo em pontos (`antes`, `depois`, 0 a 72), no menu ↕.
  - Imagem à esquerda, centralizada ou à direita (`image.align`); tabela sem
    bordas (`table.semBordas`, tracejada só no editor); larguras de coluna
    (`colwidth`) respeitadas no PDF e no Word.
  - Texto colado do Word, do LibreOffice ou de páginas mantém fonte, recuos,
    espaçamentos e alinhamento.
  - Estimativa de páginas no rodapé do editor (a paginação exata é a da prévia
    em PDF).
  - **Abrir arquivo:** traz para o editor um .docx, .odt, .doc, .pdf ou .txt do
    computador (ação `converter`; nada é gravado no processo). Com o documento
    em branco, entra inteiro; com texto, entra onde está o cursor.
  - **Word:** baixa a minuta em .docx (ação `docx`, `docxExportar.ts`), com o
    timbrado no cabeçalho e "Página X de Y" no rodapé.
- **Página e estilos do documento (18/11/2026):** botão **Página** (régua) do
  editor, ou "Modificar estilos…" na lista de estilos, abre
  `LayoutDocumento.jsx` com três abas. Tudo fica em `doc.attrs.layout` (o
  próprio texto do modelo ou da minuta), então viaja do modelo para a minuta
  (`preencherCampos` preserva), para o pacote de outro órgão, para o PDF dos
  autos e para o .docx. Documento sem `layout` sai exatamente como antes.
  - *Papel e margens:* A4, Ofício (21,6 × 33), Carta ou A5, retrato ou
    paisagem; margens de 0,5 a 8 cm, com prontas (SIGO 2,5/2,2/3/2, ABNT,
    Word, moderadas, estreitas). Com timbrado, o texto começa abaixo dele e a
    margem superior só vale se for maior.
  - *Estilos:* Texto normal, Títulos 1 a 4 e Citação editáveis (fonte,
    tamanho, negrito, itálico, sublinhado, maiúsculas, cor, alinhamento,
    recuos de primeira linha, esquerda e direita, entre linhas, antes e
    depois) e até 30 estilos próprios (`proprios`, parágrafo com `estilo`).
    "Usar o parágrafo atual" copia a formatação de onde está o cursor. O que
    está no parágrafo vale mais que o estilo; em listas e tabelas o recuo de
    primeira linha do estilo não vale.
  - *Numeração automática:* títulos em 1./1.1./1.1.1. ou I./1./1.1.
    (`numeracao_titulos`); parágrafos marcados com o botão # (`numerado`)
    contam pelo documento em 1., 1), 1 – ou 1º (`numeracao_paragrafos`). Na
    tela são contadores do CSS; no PDF, `numerosAutomaticos`; no Word,
    numeração nativa (o Word renumera ao editar).
  - *Listas:* barra "Lista" aparece com o cursor numa lista: marcador •, ◦, ▪
    ou – (`bulletList.marcador`); 1, a, A, i, I (`orderedList.formato`) com
    "." ou ")" (`separador`) e "Começar em".
  - *Recuo exato:* primeira linha, esquerda e direita (`margemDir`, novo) em cm
    no menu ↕.
  - *Fontes novas:* Georgia (Gelasio, mesma medida), Garamond (EB Garamond),
    Open Sans e Lato, no editor, no PDF e no papel timbrado.
  - Servidor: `shared/layoutDocumento.ts` (`sanitizeLayout`, lista fechada e só
    o que difere do padrão; `estiloDoBloco`; `numerosAutomaticos`). Tela:
    `src/lib/layoutDocumento.js` (espelho conferido em teste; `cssDoLayout`).
  - *Cabeçalho e rodapé (etapa 2, 18/11/2026):* quarta aba da janela. Cada
    um pode ser o da unidade (timbrado e rodapé de sempre), **próprio do
    documento** (`layout.cabecalho/rodape.modo = 'proprio'`, `conteudo` com
    os mesmos blocos do texto: parágrafos, imagens, tabelas, sem bordas para
    logotipo ao lado do texto) ou nenhum; e aparecer em todas as páginas, só
    na primeira ou em todas menos a primeira (`paginas`). O próprio nasce do
    timbrado ("Recomeçar do timbrado") e é editado num editor compacto
    (`EditorDocumento` com `faixa`). `{{pagina}}` e `{{paginas}}` (em Campos)
    saem com o número de cada folha; os outros campos do modelo se preenchem
    na minuta como no texto. O texto próprio fica guardado mesmo voltando ao
    timbrado. No PDF, o corpo começa abaixo do cabeçalho próprio (altura
    medida pelo pdfmake, `alturaDe`), como no Word; a margem de cima é a mesma
    em todas as folhas. No Word, viram cabeçalhos/rodapés nativos com campos
    PAGE e NUMPAGES e "Primeira página diferente" (`titlePg`).
  - *Número de página:* posição (rodapé ou cabeçalho, à esquerda, ao centro
    ou à direita, ou sem número), formato (Página 1 de 5, Página 1, 1, 1/5,
    – 1 –), tamanho e "mostrar na primeira página" (`layout.numero_pagina`).
    Sem nada, "Página X de Y" à direita do rodapé, como sempre.
  - *Imagens:* arrastar os cantos redimensiona (proporção mantida); largura
    exata em cm na barra "Imagem", além de 25/50/75/100% da área útil da
    página escolhida; posição à esquerda, ao centro ou à direita.
  - *Prévia do modelo:* no editor de modelo, **Prévia em PDF** (como sai nos
    autos, com marca d'água MODELO) e **Word** (.docx), sem salvar (ação
    `previaModelo` de `secretariaConfig`, mesma permissão de salvar o modelo).
  - *Papel timbrado com as mesmas ferramentas:* o timbrado do órgão e o da
    unidade (Configurações › Documentos) têm, além das linhas simples, o
    botão para papel e margens, cabeçalho e rodapé completos (modos Simples,
    Editor completo ou Nenhum), número de página, estilos e numeração
    (`documento.layout`, validado por `sanitizeLayout`, até 600 KB). Esse
    layout fica **por baixo** de todo documento com o timbrado
    (`comTimbrado`, igual no servidor e no cliente): o documento muda só o
    que define; cabeçalho/rodapé "da unidade" seguem o do timbrado. A janela
    Página do documento mostra o que vale e guarda só o que difere do
    timbrado (`limparLayout(l, herdado)`); por isso o layout aceita valores
    explícitos iguais ao padrão (A4, "todas as páginas"). Unidade com
    timbrado próprio não herda o layout do órgão (`documentoEfetivo`).
    Petição da parte (`semCabecalho`) não leva nada do timbrado. A tela tem
    prévia da folha com texto de exemplo e **Ver em PDF** antes de salvar
    (`previaModelo` com `timbrado`).
  - Limites: texto contornando imagem (imagem flutuante) não existe; a
    importação de .docx não traz o layout, o cabeçalho nem o rodapé do Word.
- **Revisar no editor qualquer minuta:** a minuta enviada como arquivo tem
  "Abrir no editor" (ação `paraEditor`). A conversão é feita no servidor, sem
  programa externo: Word .docx (`docx.ts`: estilos e herança, fontes do tema,
  numeração e listas, recuos, espaçamentos, tabelas com mescla e larguras,
  imagens, links, notas de rodapé, controle de alterações aceito), LibreOffice
  .odt (`odt.ts`), Word 97 .doc (só o texto), PDF com texto (parágrafos),
  texto e imagem. O cabeçalho e o rodapé do arquivo não entram (a minuta usa o
  timbrado da unidade) e o editor avisa. Nada muda até salvar; ao salvar, a
  minuta passa a `origem: editor` (`convertido_de`, `fontes: 2`) e o arquivo
  original fica intacto em Versões (`origem: upload`, mesmo `storage_path` e
  `sha256`), para baixar.
- **Minuta assinada:** abre para leitura com "Revisar". Ao salvar a revisão
  (`revisarAssinada: true`; sem ele o servidor recusa), as assinaturas são
  retiradas, pedidas de novo a quem tinha assinado (menos quem revisa) e a
  redação assinada fica em Versões com as assinaturas.
- O conteúdo é gravado como JSON do ProseMirror, em texto, no campo
  `conteudo_json` (até 700 KB) ou, maior que isso, num arquivo do Storage
  (`conteudo_path`, `{arquivo}.conteudo.{hash}.json.gz`, um por redação).
  Até 16/11/2026 ia como mapa em `conteudo`, e o banco recusava a minuta com
  imagem pesada (documento acima de 1 MiB) ou com lista dentro de tabela (mais
  de 20 níveis): era o erro ao salvar. Os documentos antigos continuam abrindo
  (`conteudoDoDocumento`). Os modelos também passam a gravar `conteudo_json`.
  O editor reduz a foto colada (até 1600 px, JPEG) quando passa de 400 KB. O servidor
  (`shared/documento.ts`, `sanitizeDoc`) mantém só uma lista fechada de nós,
  marcas e atributos: link só `http(s)`/`mailto`, imagem só data URL PNG/JPEG
  (até 1,5 MB cada), documento até 4 MB. Nada é interpretado como HTML.
  Minutas antigas em Delta continuam abrindo (`deltaParaDoc`).
- **Envio do texto do editor:** o ProseMirror monta os `attrs` dos nós sem
  protótipo (`Object.create(null)`) e o SDK do Firebase não sabe enviá-los
  ("hasOwnProperty is not a function"). Toda chamada de `secretariaService.js`
  passa o pedido por `paraEnvio` (`src/lib/paraEnvio.js`), que copia para
  objetos comuns. Vale para minuta, modelo, timbrado e portal. Teste de tela:
  `scripts/e2e-salvar-editor-tela.mjs`.
- **Modelos:** o admin cria textos prontos com campos (`{{numero}}`,
  `{{partes}}`, `{{data_extenso}}` etc.) que se preenchem ao começar a redigir
  (no editor e no Word original). Além dos fixos, cada campo do tipo e cada
  informação de ação vira `{{slug_do_rótulo}}` (`chaveCampo`, igual à regra
  da importação de Word), e há `{{partes_requerente}}`, `{{partes_requerido}}`,
  `{{partes_interessado}}` e `{{partes_terceiro}}`. O botão "Campo" do editor
  do modelo lista todos, por grupo, e a importação de Word reconhece o nome
  de campo de tipo ou de informação. Só entra o que as partes podem ver, porque a minuta
  juntada vai aos autos que elas leem: campo ou informação marcada para as
  partes, registro só pelo número e só se não estiver restrito hoje (o
  `obter` relê com `refsFechadas` e marca `restrito` na resposta, sem
  gravar). A origem é dado interno e não vira variável. Precedência: fixos,
  depois polos, depois campos do tipo, depois informações (a mais recente). Variável sem valor fica `{{x}}` para preencher à mão. No Word,
  um nome que é apelido de fixo ("Tipo", "Objeto") vale o fixo.
- **Visualizar PDF:** a minuta pode ser vista como ficará nos autos, com a
  marca d'água "MINUTA".
- **Assinatura eletrônica simples** (Lei 14.063/2020, art. 4º, I): registra
  quem assinou, quando e o SHA-256 do conteúdo. Minuta assinada não se edita.
- **Juntada:** a minuta entra nos autos com número de ordem, **folhas** e
  movimento encadeado ("Juntado o documento nº 2 … fls. 3 a 5"). Documento
  juntado não se edita nem se apaga.
- **Folhas:** cada processo numera as folhas em sequência (`folhas_seq`). Na
  juntada de um texto redigido, o PDF é gerado antes da transação (cabeçalho
  do órgão, rodapé "Página x de y", bloco de assinaturas com o SHA-256) e
  guardado em `{storage_path}.pdf`; a transação confere que o hash e as
  assinaturas não mudaram e grava `paginas`, `folha_inicial`, `folha_final`.
  PDFs enviados contam as próprias páginas; imagens e demais arquivos, uma.
  Petições das partes ganham folhas do mesmo jeito (texto vira PDF sem timbre).
- **Ver nos autos:** cada documento abre como PDF carimbado: "Processo nº X ·
  fls. N" no canto e, no pé, número do documento, título, data da juntada,
  autor e hash. A parte vê o mesmo no portal.

## Eventos e autos (nov/2026)

Inspirado na capa de eventos do eproc e no "Gerar PDF" do SEI.

- **Evento** é o movimento gravado (`movimentos/{seq}`, cadeia de hash
  inalterada). `shared/autos.ts` classifica cada um pela origem
  (`origemEvento`): **interno** (`dados.interno === true`: ato que o rito
  manda deixar fora dos autos), **sistema** (`TIPOS_SISTEMA`: `atribuicao`,
  `acao_fase`, `orientacao_concluida`, `convite`, ou
  `dados.automatico === true`) ou **usuário** (todo o resto, e também a
  `acao_fase` com `dados.nos_autos`, a certidão de cumprimento). Interno e
  sistema não ganham termo nem folha, saem no extrato do PDF e não aparecem
  às partes (`visivelParaPartes`).
- **Termo.** Ato de usuário que não juntou documento (`geraTermo`) tem como
  página um termo de uma folha, gerado do próprio movimento (título por tipo
  em `tituloEvento`, descrição, autor, unidade, data, hora e hash). A partir
  desta versão, `registrarMovimento` reserva a folha: grava `folha` no
  movimento e avança `folhas_seq` do processo. Movimentos antigos não têm
  `folha`: o termo sai sem número de folha e nada é renumerado. Processo
  antigo com documentos e sem `folhas_seq` também fica sem folha no termo.
- **Tela.** `EventosAutos.jsx` (equipe e portal): tabela com nº, data e hora,
  evento, quem e folhas; filtros Todos, Atos de usuários, Internos, Sistema e
  Com documentos (Internos e Sistema só quando há eventos assim); busca; ordem. `obter` devolve em cada movimento `origem`,
  `titulo`, `folhas` e `documento_id` (`extrasDoEvento`). "Ler os autos"
  usa o `LeitorAutos` evento a evento. A tabela fica na aba **Eventos** da
  tela do processo; a **Capa** mostra a cronologia dos atos dos autos.
- **Número do evento** (desde 19/11/2026; `numerarEventos` e
  `numeroDoEvento` em `shared/autos.ts`, `numero` em `extrasDoEvento`).
  Calculado na leitura, sobre todos os movimentos do processo, sem gravar
  nada: só o que todas as partes veem (`visivelParaPartes` sem polo) ganha
  número inteiro, em sequência; o resto ganha o número do último público
  antes dele mais um subsidiário (5.1, 5.2; antes do primeiro público,
  0.1). O registro "sem evento" (`oculto`) fica sem número ("—" na tabela).
  Vale na tabela de Eventos, no leitor, na busca, na impressão interna e no
  PDF (folha de dados, termos, índice, extrato e aviso de cadeia quebrada).
  No portal a parte vê os inteiros sem salto; o que é restrito ao polo dela
  aparece com o número subsidiário. A seleção do PDF continua por `seq`.
  Processos antigos passam a mostrar a numeração nova (o `seq` não muda).
- **Seleção** (`selecao` em `secretariaExportarPdf` e em `secretariaPortal`
  ação `exportar`; `sanitizeSelecao` e `selecionar`): `modo` `integral`,
  `apenas` ou `exceto` (com `eventos`: lista de `seq`) ou `intervalo`
  (`folha_de`, `folha_a`: entram só as folhas pedidas, inclusive parte de
  um documento); `capa` e `indice` ligam ou desligam essas páginas. A
  parte só alcança o que já vê: o servidor filtra movimentos e documentos
  antes de aplicar a seleção.

## Tela do processo: Capa, Andamento, Autos e Eventos (nov/2026)

A tela do processo (`ProcessoView.jsx`) separa o que **informa** do que
**age**, como explica o [guia de lógica processual](./LOGICA_PROCESSUAL.md)
(seções 3 e 4). O cabeçalho (número, assunto, fase, situação, com quem está,
urgência, sigilo, integridade) aparece em todas as abas.

Com um processo aberto, o cabeçalho da página e a barra de páginas do órgão
saem, no computador e no celular: a tela é do processo, com "Processos" como
caminho de volta (as outras páginas seguem no menu lateral). No celular
(abaixo de 640px) fica uma barra presa no alto, encostada no cabeçalho do
site, com "Processos" e o número. Nas listas a linha inteira abre o processo
("Assumir" não abre); o assunto é um link de verdade, que é o caminho pelo
teclado e abre em outra aba com Ctrl+clique.

**Glossário:** `src/lib/glossario.js` (oito termos, texto público) e o botão
"?" `AjudaTermo.jsx` (popover Radix) ao lado de autos, autuar, certidão
conjunta, ciência por decurso, dispensa, juntada, remessa e sobrestar nas
telas da equipe; a Central de Ajuda tem a seção `#glossario`. Nenhuma tela do
portal usa o "?" (`glossario.test.js` confere). Alvos de toque de 44px no
celular: regra em `src/index.css` para rótulos com caixa de marcar ou chave,
área invisível no `Switch` e filtros e caixas da aba Eventos.

| Aba | Conteúdo | Ações |
|---|---|---|
| **Capa** (`CapaProcesso.jsx`) | Identificação (número, tipo, assunto, rito, autuação, descrição, campos do tipo); origem e quem solicitou (origem, referência, unidade de autuação, requerentes com representantes, ou "De ofício"); tramitação (situação, fase, com quem está e desde quando, responsável, urgência com motivo, sigilo); partes por polo, com representantes e quem acompanha pelo portal; cronologia dos atos dos autos (só eventos de origem `usuario`, com folhas; título que abre o documento no leitor) e a conferência da cadeia | Nenhuma |
| **Andamento** | Orientação recebida, Nesta fase, minutas, pendências e prazos, comunicações às partes, **Partes no portal** (convidar, representante, revogar) e os atalhos | Barra de ações (botão da fase, Novo documento, Mais), só nesta aba |
| **Autos** | Documentos juntados com folhas, assinaturas e conferência | Ler em sequência, ver nos autos, baixar original, PDF dos autos |
| **Eventos** | `EventosAutos.jsx` | Filtros e PDF com seleção |

- **Aba inicial:** Andamento para quem tem o processo e pode movimentá-lo;
  Capa para os demais (consulta, processo arquivado). A escolha não vai para
  o endereço.
- **Mais** ganhou "Corrigir os dados do processo" (abre o mesmo diálogo de
  `alterarDados`); antes, o botão ficava no cartão de dados.
- O atalho `J` abre o Andamento e rola até as pendências. A linha de contexto
  do gabinete e a barra fixa do celular aparecem só no Andamento.
- **Origem do processo.** No "Novo processo", campo **Origem** (opcional):
  requerimento do interessado, representação ou denúncia, ofício ou
  comunicação de outro órgão, de ofício, derivado de outro processo ou outra,
  com **referência** livre (até 200 caracteres). O servidor grava
  `secProcessos.origem` (`{ tipo, descricao }`, `sanitizeOrigem` em
  `functions-v2/src/shared/secretaria.ts`; tipo desconhecido vira `outro`, nada
  informado não grava o campo) e o põe nos `dados` do movimento de autuação,
  não na descrição. `obter` devolve `origem` e `unidade_autuacao` (primeira
  unidade de `unidades_historico`). O PDF da equipe traz a linha "Origem" na
  capa; o portal das partes não mostra a origem. Processos antigos não têm
  origem: a capa mostra "Não informado".
- **Registros ligados (13/11/2026).** A Capa junta, sem repetir, os registros
  de consultas, expedientes, parcerias e júri citados no processo: a origem,
  os campos do tipo e as ações do rito que pediram um registro
  (`registrosLigados` em `src/lib/camposProcesso.js`). Cada um diz de onde
  veio, marca "acesso restrito" e tem **Abrir**, que leva à aba do módulo com
  `?abrir=<id>`; com a integração desligada, aparece sem o botão. Só a equipe
  vê a Capa; nada disso vai ao portal.
- **`?abrir=<id>` nos módulos.** As abas de consultas, expedientes, parcerias
  e júri abrem a ficha do registro pedido (`useAbrirDaUrl` em
  `src/hooks/useAbrirDaUrl.js`): procura na lista carregada e, se não estiver
  (paginação), lê o documento, conferindo o órgão; as regras do Firestore
  continuam decidindo quem lê. Sem acesso, avisa. Espera a aba estar com o
  órgão do endereço (busca em outro órgão), tira o parâmetro antes de abrir
  (o mesmo registro pode ser pedido de novo) e recusa id com barra. A busca
  rápida (Ctrl+K) usa o mesmo caminho e abre a ficha do resultado.
- **Avisos (`toast` do sonner).** O `Toaster` do sonner passou a ser montado
  em `App.jsx` (antes, nenhum aviso do sonner aparecia). `DialogContent` e
  `SheetContent` ignoram o clique num aviso (`naoFecharNoAviso` em
  `src/lib/utils.js`), para o "Desfazer" do aviso não fechar o editor.

### Usabilidade: listas, tela do processo e janelas (27/11/2026)

Rodada feita percorrendo as telas como usuário, no computador (1366x768) e no
celular (390x844), claro e escuro. O teste de tela é
`scripts/e2e-usabilidade-pe.mjs`.

**Listas (Meu trabalho, Caixa da unidade, Mesa de decisão, Todos).** Uma
linha só para todas: `LinhaProcesso.jsx`. Lê-se como a capa: número (seleciona
para copiar, sem abrir), assunto (link), tipo e partes, depois fase, unidade,
há quanto tempo e com quem está, e à direita os selos (urgente, comigo,
situação, restrito, pautado, pendências, prazo). O resumo do servidor
(`resumo` em `processos.ts`, ação `listar`) ganhou `partes_nomes` (até três
nomes, 80 caracteres cada) e `partes_total`; não leva documento nem contato
da parte. Na Caixa e em Todos:

- a busca, os filtros e a ordem ficam guardados por órgão e por lista enquanto
  a aba do navegador está aberta (`sessionStorage`, chave
  `pe-filtros-<órgão>-<lista>`): voltar de um processo não desfaz a busca;
- ao voltar, a lista rola até o processo que estava aberto e a linha fica
  destacada por dois segundos e meio (`lembrarProcesso`);
- ordem: mais recentes, prazo mais próximo (sem prazo no fim), há mais tempo
  na unidade, mais antigos. Vale sobre o que já foi carregado, como os filtros;
- "/" leva o cursor à busca; Esc limpa a busca; "Mais filtros" mostra quantos
  estão ligados; situações novas "Comigo" e "Sem responsável".

**Novo processo.** Abre com o tipo usado da última vez naquele órgão
(`localStorage`, `pe-ultimo-tipo-<órgão>`; `-` quando foi sem tipo) ou, sem
isso, com o único tipo que existe. A unidade sugerida é a que o tipo indica;
sem indicação, a da primeira fase do rito, se a pessoa está lotada nela.
Quando a unidade escolhida não é a da primeira fase, um aviso explica e
oferece trocar com um clique. O servidor continua decidindo quem pode autuar
onde: nada disso muda permissão.

**Arquivos.** `EscolherArquivo.jsx` substitui o botão do navegador (que
aparecia em inglês) no Novo processo, no Novo documento e na manifestação do
portal: texto em português, arrastar e soltar, nome e tamanho do arquivo
escolhido. O `<input type="file">` de verdade continua lá, com o mesmo `id`.

**Tela do processo.**

- O menu "Mais" rola por dentro quando não cabe na tela
  (`dropdown-menu.jsx`, vale para todos os menus do SIGO). Antes, numa tela de
  768 px de altura, os primeiros itens ficavam fora da tela, sem alcance.
- Janela de ação (`AcaoDialog`): uma linha "Para confirmar: ..." diz o que
  falta enquanto o botão está apagado (destino, fase, dias, o texto
  obrigatório); com texto digitado, o clique fora não fecha a janela (Esc e
  Cancelar fecham); Ctrl+Enter no campo de texto confirma; "Fechar e cumprir
  agora" no aviso de exigência em aberto fecha a janela e leva ao cartão
  "Nesta fase"; no celular os botões ocupam a largura.
- No destino da remessa, o tipo da unidade só aparece quando diz algo além do
  nome ("Gabinete", não "Gabinete (gabinete)"). Na escolha da fase, a
  orientação da fase de destino aparece em três linhas.
- Minutas da unidade: o título ocupa a linha e os botões vêm embaixo.
- No celular: sem rolagem lateral (a grade passou a `grid-cols-1` com
  `min-w-0`, e os cabeçalhos de cartão quebram linha), abas do processo e da
  página numa linha só, que rola para o lado, e o título da página some (já
  está na barra do site).

**Segunda rodada (27/11/2026).** Percorridos Meu trabalho com pendência e
prazo, Mesa de decisão, Painel, portal das partes, editor de minuta e a
configuração.

- Fase interrompida por pendência, fora do gabinete: no lugar do botão da
  fase (que não existe nesse estado) aparece "Fase interrompida: ver a
  pendência", que leva ao cartão de pendências. No celular, na barra de baixo.
- Painel: "hoje", "há 1 dia", "há N dias" no lugar de "há 0 dia(s)"; no
  celular a linha quebra e mostra o assunto inteiro; o calendário usa dias
  mais baixos em telas largas (`compacto` no `DeadlineCalendar`), porque um
  mês sem prazos ocupava a tela toda.
- Editor de minuta (`RedacaoDocumento.jsx`): com texto não salvo, fechar a aba
  do navegador ou recarregar a página pede confirmação (`beforeunload`); o
  estado "Alterações não salvas" passou a aparecer também no celular.
- Configuração: quem chega por um endereço que já diz a aba (`&aba=ritos`,
  atalhos da Ajuda e do Guia) cai nas abas, e não no topo do Painel
  Administrativo.

**Terceira rodada (27/11/2026).** Percorridos a configuração (editor de rito,
editor de tipo, documentos e modelos, unidades, calendário, Guia do rito),
Sessões e reuniões, a pauta, a janela de julgamento, a designação e a sala de
audiência e a disputa de preços (montagem e aviso publicado).

- Editor de rito no celular (`PropostaRito.jsx`): o cabeçalho cabe numa linha
  (o nome corta com reticências) e o rodapé caiu de cinco linhas para duas:
  Excluir e Substituir fases viram ícones (com nome para leitor de tela e
  `title`), e o resumo "Será salvo como versão N" fica ao lado de Salvar. O
  aviso "Rascunho salvo neste navegador" some no celular (segue na tela larga).
- Tipos de processo: a descrição do tipo no cartão corta em três linhas (o
  texto inteiro fica no `title` e no editor). Um tipo vindo da biblioteca
  trazia um parágrafo de vinte linhas no cartão.
- Papel timbrado: a prévia da folha se ajusta à largura da coluna
  (`ResizeObserver`, de 20% a 50%); com 50% fixo, a margem direita da folha
  ficava cortada em telas de notebook.
- Ações da fase (`AcoesNoProcesso.jsx`): no celular o texto da ação ocupa a
  linha inteira e os botões (Designar, Registrar, Desfazer, Montar a disputa)
  descem alinhados ao texto; antes o texto se espremia numa coluna estreita.
- Janela de registrar a ação: na audiência, a linha "Para registrar, informe a
  data, a hora e o local" diz o que falta enquanto o botão está apagado; depois
  de preenchida, a janela não fecha com clique fora (fecha por Cancelar, X ou
  Esc).
- Pauta da sessão (`Sessoes.jsx`) no celular: o número e o assunto ocupam a
  linha e os botões descem; Chamar e Julgamento ganham o nome ao lado do ícone.
- Disputa de preços: no celular, Unidade e Quantidade (e Valor e Lote) ficam
  lado a lado em cada item.

Não percorridos nesta rodada: a sala de lances com fornecedores e lances em
curso, o julgamento da disputa, a votação com relator e votos lançados e a
reunião com assuntos em votação (pedem várias contas agindo ao mesmo tempo).
A quarta rodada percorreu todos, menos o julgamento da disputa.

**Quarta rodada (27/11/2026).** Percorridos, com várias contas: a lista no
celular, a votação com relator e voto liberado, a reunião com assuntos na
pauta, e a disputa do começo ao fim dos lances (dois fornecedores mandam
proposta, a sala abre, um dá lance, os dois escrevem ao órgão, o órgão
acompanha).

- Lista de processos no celular (`ProcessoEletronico.jsx`): os filtros caíram
  de três linhas para duas. A busca divide a primeira com "Mais filtros" (só o
  ícone, com nome para leitor de tela e `title`); situação e ordem dividem a
  segunda. A contagem "N processos" só aparece no celular quando há filtro
  ligado ou mais páginas a carregar.
- Janela de julgamento (`VotacaoSessao.jsx`): quem preside e ainda não votou vê
  "Você ainda não votou. Registre o seu voto acima antes de proclamar, ou
  constará como ausente", e o botão Proclamar o resultado deixa de ser o botão
  principal da janela até o voto. Antes, o botão de maior destaque era
  justamente o que deixava o presidente ausente. No celular, o título não
  encosta no X e o cabeçalho "Votos dos vogais" quebra a linha sem espremer.
- Reunião (`Reuniao.jsx`): sem presença registrada (em reunião que conta
  quórum), o botão Abrir votação fica apagado e a pauta diz "Registre a
  presença para abrir as votações: o quórum se conta pelos presentes". Antes o
  botão aceitava o clique e o servidor devolvia o erro. A regra continua no
  servidor (`reunioes.ts`); a tela só avisa antes.
- Proposta do fornecedor (`Disputas.jsx`): o CNPJ ou CPF é conferido enquanto
  se digita (`cpfCnpjValido`, o mesmo cálculo do servidor), com o aviso
  "Confira o número" embaixo do campo; antes o erro só vinha depois de
  preencher tudo e enviar. A linha "Para enviar, falta ..." diz o que ainda
  falta enquanto o botão está apagado. No celular, os quatro campos de cada
  item ficam em duas colunas (duas linhas de campos por item, em vez de
  quatro).
- Sala de lances (`SalaLances.jsx`) no celular: melhor oferta, a sua oferta e a
  sua posição ficam lado a lado em cada item (eram três linhas), e o relógio
  "Termina em" não quebra no meio.

Não percorridos: o julgamento da disputa (classificação, habilitação, recurso
e resultado) e o fim dos lances com o relógio zerando. Sessões, reunião e sala
de lances seguem sem teste de tela automático; a lista no celular e a proposta
do fornecedor entraram em `scripts/e2e-usabilidade-pe.mjs`.

**Quinta rodada (27/11/2026).** Percorrido o julgamento da disputa, pelo órgão
e pelo fornecedor, no computador e no celular, tema claro e escuro, em três
momentos: propostas em análise; uma aceita e habilitada e outra recusada (com
o segundo colocado chamado); vencedor declarado, com a intenção de recurso
aberta.

- Classificação no celular (`JulgamentoDisputa.jsx`): cada licitante ocupa duas
  linhas sempre iguais (nome e CNPJ em cima; valor e selos embaixo, alinhados
  ao nome). Antes o valor ora ficava ao lado do nome, ora descia, conforme o
  tamanho do nome.
- Fornecedor com proposta recusada: a tela dizia "Sua posição: 1º" logo acima
  de "Sua proposta foi recusada". Agora diz "Sua oferta: R$ ..." e o motivo, sem
  posição.
- Mensagens da sala (`SalaLances.jsx`): o aviso do vencedor declarado saía num
  bloco só ("... R$ 12.200,00 Item 2: ..."). As quebras de linha do texto
  passam a valer: um item por linha, e os prazos de recurso na linha seguinte.
- Textos com tamanho mínimo (motivo da recusa, contraproposta, reabertura,
  intenção, razões, contrarrazões e fundamentos da decisão do recurso): embaixo
  do campo, "Escreva ao menos N letras" e, começado o texto, "Faltam N letras
  (mínimo de N)". Antes o botão ficava apagado sem dizer por quê; o prazo da
  intenção de recurso é de minutos.

Não percorridos: o desempate de ME/EPP, a negociação, o envio de arquivos pelo
fornecedor convocado, as razões e a decisão do recurso (pedem o prazo vencer) e
o resultado com a ata. O tema escuro foi fotografado só no julgamento da
disputa. `scripts/e2e-usabilidade-pe.mjs` ganhou o fornecedor recusado.

## Registro nos autos e documentos exigidos (nov/2026)

Quem monta o rito decide, fase a fase, o que vira ato dos autos e que
documento a fase ou uma ação exige. Fundamento: [guia de lógica
processual](./LOGICA_PROCESSUAL.md), seções 5 e 6. A lógica pura está em
`functions-v2/src/shared/exigencias.ts` (testes em
`functions-v2/test/exigencias.test.js`); o espelho da tela, em
`src/lib/exigencias.js`.

- **Destinos de cada ato** (`Destino` em `shared/exigencias.ts`; ações e
  atos da fase aceitam também `nenhum`, em `DestinoAto`):
  - `autos`: termo ou certidão com folha; sai na impressão dos autos e as
    partes veem (salvo se o rito disser que não);
  - `evento`: registro interno, sem folha (`dados.interno`); aparece na aba
    Eventos e no extrato ao fim do PDF; as partes não veem;
  - `informacao`: só no sistema (`dados.interno` e `dados.fora_impressao`);
    aparece na aba Eventos (selo "só no sistema") e, se for um dado, nas
    informações do processo; **não sai em impressão nenhuma** (o extrato do
    PDF o pula e o leitor da aba Eventos não o abre);
  - `nenhum` ("Sem evento", só ações e atos da fase; documento não): o
    movimento é gravado com `dados.oculto`, `interno`, `fora_impressao` e
    `visivel_partes: false`. Continua na cadeia de hash (auditoria), mas não
    vira `ultimo_movimento` nem `ultimo_movimento_publico`
    (`registrarMovimento`), some de "Todos" na aba Eventos (filtro "Registros
    ocultos", que é só de tela: quem vê o processo recebe os registros) e as
    partes nunca o veem (`partesVeem` é falso e o saneamento tira `partes`).
    O dado que a ação pediu vai para as informações do processo, só para a
    equipe.
  - `consolidar` ("Na certidão conjunta", só ações da fase, em
    `DestinoAcao`): ver **Certidão conjunta** abaixo.
  - Valor desconhecido numa cópia antiga lê como o padrão: `evento` para
    ações, `autos` para fases.
- **Registro dos atos de tramitação da fase** (`fase.registro_atos =
  {fase?, remessas?}`, ausente = `autos`): `fase` vale para entrar e sair da
  fase, `remessas` para as remessas entre unidades durante ela.
  `destinoDoMovimento`: mudança de fase fica no destino mais reservado entre
  a fase de onde sai e a para onde vai (`destinoTransicao`: "sem evento" numa
  só delas não apaga o registro que a outra pede; fica oculto só quando as
  duas dizem "sem evento"); remessa sem mudar de fase segue
  `remessas`. Remessa entre órgãos e dispensa de exigência vão sempre aos
  autos. O formato antigo `fase.registro` (`remessas_fora`, `interno`) ainda
  é lido nos processos autuados antes (`niveisDaFase`) e é convertido ao
  salvar o rito.
- **Outros atos durante a fase** (`fase.registro_atos.outros`, só o que
  difere do padrão; `destinoDoAto` e `marcasDoAto` em
  `shared/exigencias.ts`): `prazo` (abrir e encerrar), `pendencia` (abrir e
  apreciar), `urgencia`, `dados` (alterar os dados do processo) e
  `atribuicao`. Padrão: como era antes, termo nos autos; atribuição é
  registro de controle (`evento`) e nunca vai aos autos. Cada um aceita
  `evento`, `informacao` ou `nenhum`; a pendência e o prazo continuam
  valendo (a pendência segue aberta para o decisor) mesmo sem evento. Vale o
  que a fase atual diz. Ficam sempre nos autos: autuação, juntada, petição,
  comunicação e ciência, situação, exclusão e restauração. No editor, "Outros
  atos durante a fase", com "Aplicar a todas as fases".
- **Certidão conjunta** (`fase.certidao = {grupo?, titulo?,
  incluir_mudancas?}`; processo: `consolidacao = {grupo, itens[]}`):
  - A ação com `destino: 'consolidar'` não gera certidão própria. O ato é
    gravado como registro oculto (`dados.consolidada`, mais as marcas de
    "sem evento") e vira um item (`{seq, fase_id, acao_idx, texto, autor, em,
    partes}`) da certidão pendente em `proc.consolidacao`.
  - `grupo`: fases com o mesmo grupo dividem uma certidão. O editor guarda o
    id de outra fase; `sanitizeRito` troca pelo id final e sempre pela fase
    raiz (cadeia A → B → C vira tudo C; em ciclo, cada fase fica só). Sem
    grupo, a fase é o próprio grupo (`grupoDe`).
  - A certidão é emitida (movimento `certidao_fase`, com folha, título em
    `dados.titulo` e os `seq` dos itens em `dados.itens`) antes do ato que
    a encerra: sair do grupo (`avancarFase`, ou `tramitar` mudando de
    fase), arquivar, juntar o 101º item (`MAX_ITENS_CERTIDAO`) ou a ação
    `emitirCertidao` ("Emitir certidão agora", na tela do processo, para
    quem tem a posse). Sobrestar não emite. Os dois movimentos ficam
    encadeados na mesma transação.
  - Texto: "Certifico que foram cumpridos os seguintes atos: 1) "X", da
    fase Y. Dado: valor (autor, data e hora); 2) ...". Título: o
    `certidao.titulo` de uma fase do grupo ou "Certidão da(s) fase(s) ...".
  - As partes veem a certidão só se puderem ver todos os itens
    (`visivelCertidao`); confirmação simples conta como visível se a ação
    marcar `partes`.
  - Desfazer um ato ainda pendente tira o item (registro oculto). Desfazer
    depois da emissão gera certidão de desfazimento nos autos.
  - `incluir_mudancas` (numa fase do grupo): a mudança entre ela e outra
    fase do mesmo grupo, em `avancarFase`, vira item em vez de termo
    próprio. Com dispensa de exigência, ou quando as duas fases pedem "sem
    evento", não entra. A remessa entre unidades (`tramitar`) continua com
    termo próprio.
- **Ações da fase** (`fase.acoes_regras`, alinhadas a `acoes`; o editor
  guarda cada regra junto da sua ação, então apagar ou reordenar não troca
  as regras):
  - `pede`: o que a ação pede. Ausente = só confirmar (caixa de marcar);
    `texto`, `texto_longo`, `numero`, `data`, `lista` (com `opcoes`, 2 a
    30) ou `sim_nao`: um dado, com `rotulo` (nome do dado; ausente = o texto
    da ação) e `ajuda` opcionais; ou `documento` (ver abaixo).
  - `destino`: onde fica o cumprimento (ausente = `evento`). Em `autos`, o
    cumprimento é **Certidão de cumprimento** com folha
    (`dados.nos_autos`), que leva o dado: "Certifico que foi cumprida a
    providência "X", da fase Y. Número no SIM: 123.".
  - `partes: true`: as partes veem a certidão (se nos autos) e o dado nas
    informações do processo no portal. Ação de só confirmar fora dos autos
    não tem o que mostrar, então ali a opção não aparece (`partesVeem`). Regra antiga `autos: true` conta
    como `destino: 'autos', partes: true`.
  - `obrigatoria: true`: a fase só segue com a ação feita ou com motivo de
    dispensa (`acoesObrigatoriasPendentes`, junto com os documentos).
  - `documento`: a ação não se marca à mão (`marcarAcao` recusa); ela se
    cumpre com o documento e fica marcada em `acoes_feitas`. Com
    `documento.destino` ausente, pela juntada aos autos; com `evento` ou
    `informacao`, guardando o documento fora dos autos (abaixo). Ação com
    documento é sempre exigida.
  - `marcarAcao {acao_idx, feita, valor?}` confere o dado com a mesma regra
    dos campos do processo (`valorDe` em `shared/camposProcesso.ts`) e grava
    no movimento `rotulo`, `tipo_valor`, `valor`, `valor_texto`,
    `visivel_partes`. Desfazer (`feita: false`) também fica registrado.
- **Informações do andamento** (`shared/informacoes.ts`,
  `informacoesDoAndamento`): derivadas dos movimentos `acao_fase` com dado
  (desfazer tira a última da ação; voltar à fase e cumprir de novo acrescenta
  outra). `obter` devolve `informacoes` (a Capa as mostra em "Informações
  registradas no andamento", com fase, autor, data, destino e se as partes
  veem); o portal devolve só as com `visivel_partes` em
  `processo.informacoes`.
- **Documento guardado fora dos autos** (documento de controle):
  `secretariaDocumento` `guardar {docId, version, atende?}` muda a minuta da
  unidade para `status: 'controle'`, sem número de ordem nem folha, e grava o
  movimento `guarda` ("Documento guardado fora dos autos", interno, sem
  `ordem`, `visivel_partes: false`; só no sistema quando tudo o que ele
  cumpre é `informacao`). Toda a equipe que vê o processo o lê
  (`obter`, `baixar`, `pdf` com marca d'água "FORA DOS AUTOS"); as partes,
  o PDF dos autos, a conferência e as comunicações não o veem, porque só
  usam `status == 'juntado'`. Não se edita nem se apaga. Cumpre só
  exigência com `destino` (`atende` com `controle: true`); a juntada cumpre
  só as sem `destino`. Tela: botão "Guardar fora dos autos" na minuta e
  seção "Documentos guardados fora dos autos" na aba Autos.
- **Documentos exigidos na fase** (`fase.documentos`, até 5): descrição,
  forma (`redigir`: produzido no órgão, pelo editor ou por modelo; `juntar`:
  arquivo recebido; `qualquer`), tipo de documento, modelo indicado
  (opcionais) e `destino` (ausente = juntado aos autos; `evento` ou
  `informacao` = guardado fora dos autos). Modelo de fora do órgão é
  retirado ao salvar (`filtrarRefsRito`).
- **Cumprimento.** Na juntada (`juntar`), o servidor calcula as exigências
  pendentes da fase atual (chaves `d0..d4` da fase e `a{idx}` das ações) e
  reconhece as que o documento cumpre (`reconhecer`): com `atende` (as
  marcadas no diálogo "Este documento cumpre o que o rito exige?"), valida
  cada uma (pendente e da forma certa); sem `atende`, reconhece pelo modelo
  usado (`modelo_id`, gravado por `criarMinuta` e `upload` quando a minuta
  nasce de modelo) ou pelo tipo do documento. Grava
  `exigencias_cumpridas[faseId][chave] = {documento_id, ordem}` e acrescenta
  à juntada "Cumpre o exigido pelo rito: …" (`camposDoCumprimento`).
  A **petição da parte** (`peticionar` no portal) também cumpre: conta como
  documento recebido de fora (`peticao: true` em `atende`), então atende
  exigência `juntar` ou `qualquer` cujo tipo seja o tipo da petição (ex.:
  "Manifestação"), nunca a `redigir`.
- **Fase que volta.** Ao entrar numa fase (`avancarFase` ou `tramitar` com
  `fase_id`), inclusive voltando a uma já percorrida, as marcas de
  `exigencias_cumpridas` e `acoes_feitas` dessa fase são apagadas
  (`camposAoEntrarNaFase`): a nova rodada exige de novo. A rodada anterior
  continua nos autos e nos movimentos.
- **Editor do rito** (`RegrasDaFase.jsx`: `AcoesDaFase` e
  `RegistroEDocumentos`). Cada ação é uma linha com a sua configuração
  (o que pede, onde fica, quem vê, se é obrigatória), resumida em uma frase
  ("Pede número (Número no SIM); certidão nos autos; partes veem"). Colar
  várias linhas numa ação cria uma ação por linha.
- **Dispensa.** Sair da fase (`avancarFase`, ou `tramitar` com `fase_id`) com
  exigência pendente (documento ou ação obrigatória) exige `motivo`: sem
  ele, `failed-precondition` com a lista do que falta. Com ele, o movimento
  registra "Dispensado o que o rito exigia na fase: …", o motivo e
  `dados.dispensadas`, e vai sempre aos
  autos, mesmo que a fase seja de registro interno. Arquivar com exigência pendente
  registra os documentos não produzidos no próprio movimento (o motivo já é
  obrigatório); o diálogo de situação avisa antes, ao escolher "Arquivado".
- **Tela.** Em "Nesta fase", a ação de confirmar é uma caixa de marcar; a
  que pede um dado tem "Registrar" (diálogo com o campo certo, dizendo onde o
  registro fica e quem vê) e, feita, mostra o valor e "Desfazer" (com
  confirmação); a que exige documento mostra a situação (pendente, com
  "Redigir {modelo}" ou "Novo documento"; ou cumprida). Selos dizem
  "certidão nos autos", "só no sistema", "partes veem", "obrigatória". Os
  documentos da fase aparecem em "Documentos exigidos nesta fase"; o registro
  da fase aparece numa nota. O diálogo de mudar a
  fase (e o de remeter mudando de fase) mostra o que falta e pede o "Motivo
  da dispensa". A prévia do rito mostra as regras.
- **Editor (nov/2026).** O destino da ação é escolhido em cartões, cada um
  com a consequência e a amostra do texto gravado; "As partes veem" fica
  visível e desligado, com o motivo, quando não cabe. Sob "Onde ficam os atos
  de tramitação", a lista mostra como ficam, de fato, as mudanças com as
  fases vizinhas. O rodapé do editor tem "Prévia", que abre a prévia do rito
  ainda não salvo, com três abas: como a equipe vê, como a parte vê (o que da
  fase chega ao portal, tirado das regras) e como fica nos autos (folha,
  extrato, só na tela ou oculto, ato por ato). Rótulos num só mapa,
  `DESTINO_INFO` em `src/lib/exigencias.js`.
- **Compatibilidade.** Ritos e processos antigos não têm esses campos e
  funcionam como antes. Processo guarda a cópia das fases da autuação: mudar
  o rito vale para os próximos processos.

### Obrigatório, recomendado ou opcional (13/11/2026)

Cada documento da fase e cada ação diz se é preciso para a fase seguir:

| Nível | Onde fica | Na tela do processo | Ao sair da fase |
|---|---|---|---|
| Obrigatório | documento: sem `nivel`; ação: `obrigatoria: true` | "exige documento" / selo "obrigatória" | sem ele, só com motivo de dispensa (nos autos) |
| Recomendado | documento: `nivel: 'recomendado'`; ação: `recomendada: true` | "documento recomendado" / selo "recomendada" | aviso azul "O rito recomenda nesta fase…", sem motivo |
| Opcional | documento: `nivel: 'opcional'`; ação: nenhum dos dois | "documento opcional" | nada |

- Documento sem `nivel` continua obrigatório (compatível com ritos antigos);
  ação sem marca continua opcional. Na ação que pede documento, o nível fica
  em `documento.nivel`.
- Servidor: `sanitizeExigencia` guarda `nivel` (`NIVEIS` em
  `shared/exigencias.ts`); `documentosQueFaltam` (só os obrigatórios) é o que
  `exigenciasAbertas` cobra para a dispensa. `pendentesDaFase` continua com
  todos, para a juntada reconhecer também o recomendado e o opcional.
- Cliente: `nivelDaAcao`, `regraComNivel`, `faltaNaFase` (só obrigatórios) e
  `recomendadosNaFase` em `src/lib/exigencias.js`.
- **Orientação a quem cumpre** (`ajuda`, até 200 caracteres) vale para toda
  ação, inclusive a de só confirmar e a que pede documento; aparece abaixo da
  ação em "Nesta fase" e no diálogo de registrar.
- **Opções da escolha** se escrevem uma por linha (ponto e vírgula colado
  também separa), com o contador "N de 30 opções".

### Editor de rito: ordem, cópias, desfazer e pendências (13/11/2026)

- **Arrastar** (`Ordenavel.jsx`, dnd-kit): fases e ações têm uma alça; mouse,
  toque (segurar) ou teclado (espaço pega, setas movem, espaço solta, Esc
  cancela), com anúncios em português para leitor de tela.
- **Menu de cada fase** (⋮): inserir fase abaixo, duplicar, mover para o
  início, subir, descer, mover para o fim e remover.
- **Duplicar** (`copiarFases` em `secretariaRito.js`): a cópia entra logo
  abaixo, com ids novos e as mesmas saídas; se a original seguia para a de
  baixo sem dizer, passa a dizer (e, se era a última sem saída, vira final),
  para a cópia não entrar no caminho. Nenhuma fase segue para a cópia até a
  pessoa ligar.
- **Copiar fases de outro rito**: escolhe o rito e as fases; entram no fim,
  com ações, regras, documentos, modelos e unidade. As saídas implícitas da
  origem viram explícitas antes da cópia; caminhos entre as copiadas são
  mantidos, os que levavam a fases não copiadas saem, e a cópia que fica sem
  saída vira final (o aviso diz quais). A última fase deste rito, se terminava
  sem dizer, passa a ser final, para não seguir para as cópias.
- Ao arrastar, Esc cancela o arrasto sem fechar o editor. O atalho de
  desfazer não age com outro diálogo aberto por cima (prévia, versões).
- **Desfazer e refazer** (até 30 passos; Ctrl+Z e Ctrl+Shift+Z ou Ctrl+Y
  fora dos campos de texto, que têm o desfazer deles). Digitação seguida
  vira um passo; mudança de estrutura, um passo cada. Remover uma fase mostra
  o aviso com "Desfazer", que só desfaz se nada mudou depois. O histórico não
  vai ao rascunho do navegador.
- **Pendências novas** (`pendenciasDaProposta(p, ligadas)`): fase que nenhum
  caminho alcança e fase num ciclo sem saída (`problemasDoFluxo`, também
  marcadas em âmbar tracejado no fluxo); ação que pede registro de módulo com
  a integração desligada (impede); ação ou documento sem texto (descartados
  ao salvar); mais de 10 modelos na fase.
- **Implantar/Salvar** responde sempre: com pendência que impede, leva até a
  primeira fase com problema e diz o que falta; sem nome, foca o nome.
- Fases com mais de 10: "Ir para a fase…". O bloco "Registros, certidão
  conjunta e documentos" do cartão abre e fecha. Botões de ícone com 44 px
  no celular.
- "Criar tipo de processo com este rito" vem desmarcado quando o órgão já
  tem tipos ativos (marcado no primeiro rito).

### Prazo automático, nome para as partes e efeitos ao entrar (13/11/2026)

Seção "Prazo, nome para as partes e ao entrar" em cada fase do editor:

- **Prazo automático** (`prazo_auto`, com `prazo_dias`; `prazo_contagem:
  'corridos'` ou úteis, padrão): ao entrar na fase (autuação, mudança de fase
  ou remessa com mudança de fase), o processo ganha um prazo "Fase X" com
  `fase_id` e `automatico: true`, contado com o calendário do órgão. Ao sair
  da fase ou arquivar, ele se encerra sozinho (no prazo ou fora do prazo).
  Vale para processos autuados depois de salvar o rito (a fase vai copiada no
  processo). É prazo **interno**: não aparece no portal, na certidão de
  andamento nem nos lembretes às partes; para a equipe, entra nas listas de
  vencimento como qualquer prazo.
- **Nome para as partes** (`nome_publico`): o portal (lista, "Em que ponto
  está", fluxo e certidão de andamento) usa esse nome. Os termos nos autos
  usam sempre o nome oficial da fase.
- **Ao entrar** (`ao_entrar`): `urgente` marca o processo como urgente
  (motivo "Regra da fase X") se ainda não estiver; `sem_responsavel` tira o
  responsável designado (a remessa a outra unidade já faz isso).
- Registro: a urgência vai no termo da mudança (ou da autuação), que as
  partes leem. O prazo interno e a retirada do responsável vão num registro
  **só da equipe** (`efeitos_fase`, sem termo, fora do portal e dos e-mails),
  gravado logo depois na mesma operação, por exemplo: "Prazo interno da fase
  encerrado no prazo: Fase Triagem. Prazo interno da fase aberto: 3 dias
  corridos, vence em 16/11/2026. Responsável designado retirado pela regra da
  fase." Encerrar à mão um prazo automático também fica só para a equipe. A
  prévia do rito mostra esses efeitos e o nome para as partes.

### Condições pela resposta, quem cumpre e simulação (13/11/2026)

A resposta de uma ação **de escolha** da fase (lista de opções ou sim/não)
passa a decidir o resto da fase:

- **Ação condicional** ("Quando vale", na configuração da ação): a ação só
  aparece e só é cobrada quando a resposta de uma ação de escolha **anterior**
  da mesma fase for uma das marcadas. Ação que não vale não aparece na tela
  do processo (desde 19/11/2026; antes ficava apagada, com "vale só se …");
  se ela depende de resposta ainda não dada na fase, a tela diz quantas ações
  ainda podem aparecer. O servidor recusa cumprir ação que não vale e
  não a conta nas exigências da fase. Documento condicional já juntado fica
  registrado se a resposta mudar ("cumprida antes de a resposta mudar").
- **Regra da saída** ("Regra desta saída", em Encaminhamentos): a saída é
  indicada quando a resposta for uma das marcadas. O botão principal do
  processo já leva à saída indicada, e o diálogo de fase a mostra como
  "Indicada pela resposta". Seguir por uma saída com regra sem a resposta é
  permitido, mas exige motivo; o movimento registra `fora_da_condicao` e a
  descrição diz "(sem a resposta que o rito pede para esta saída)". Saídas
  sem regra seguem livres. A condição escrita (texto) continua valendo como
  orientação.
- **Quem pode cumprir** (ações que não são documento): qualquer pessoa da
  equipe (padrão), só o **responsável designado**, só **quem gere a
  unidade** ou só **quem tem certa atribuição** (`quem: 'atribuicao'` com
  `atribuicao: 'Promotor'`, nov/2026). A atribuição é a da lotação da
  pessoa na unidade que tem o processo (Unidades, coluna Atribuição) e é
  comparada sem contar acento, caixa e espaços a mais; gerir a unidade não
  dá a atribuição de outra pessoa. A administração do órgão sempre pode.
  Para os demais, a ação mostra o aviso e o servidor recusa
  (`permission-denied`).
- **Quem pode nesta fase** (`fases[].permissoes`, nov/2026): a fase reserva
  os atos que mudam o andamento. Ausente, vale o de sempre (quem tem o
  processo, com motivo quando o ato pede).
  - `concluir` (`'responsavel'`, `'gestor'` ou `'atribuicao'` com
    `concluir_atribuicao`): quem leva o processo a outra fase, por
    `avancarFase` ou por `tramitar` com fase. Ir para uma fase de espera
    não conclui e continua livre; sair da espera é concluir a fase de
    espera.
  - `dispensar` (`'gestor'` ou `'admin'`): quem dispensa o que a fase exige
    e ficou em aberto (ação ou documento obrigatório, campo exigido), ao
    sair da fase ou ao arquivar. Os demais precisam cumprir tudo.
  - `desviar` (`'gestor'` ou `'admin'`): quem segue por fase fora do fluxo
    ou por saída sem a resposta que a regra dela pede.
  - `situacao` (`'gestor'` ou `'admin'`): quem arquiva, sobresta ou reativa
    enquanto o processo está na fase. O arquivamento automático
    (`ao_entrar.arquivar`) não passa por aqui.

  `'gestor'` é quem gere a unidade que tem o processo; `'admin'`, só a
  administração do Processo Eletrônico, que sempre pode tudo. O servidor
  confere em `exigirSaida`, `exigirDispensa` e `alterarStatus`
  (`functions-v2/src/secretaria/processos.ts`) e recusa com
  `permission-denied`, dizendo a quem o ato cabe. A lógica pura está em
  `functions-v2/src/shared/permissoesFase.ts` (espelho da tela em
  `src/lib/permissoesFase.js`). Com **Seguir sozinha**, a fase só segue
  sozinha quando quem cumpre o último item pode concluí-la; senão o botão
  fica para quem pode. Na tela do processo, o cartão da fase diz o que está
  reservado, e o diálogo de mudar a fase, enviar ou alterar a situação
  mostra o motivo e não deixa confirmar. No editor, a seção **Quem pode
  nesta fase** tem "Aplicar a todas as fases"; reserva por atribuição sem
  dizer qual é pendência grave, e atribuição que ninguém da unidade da fase
  tem é avisada (só a administração poderia).
- **Quem vê o dado na equipe** (`acoes_regras[i].ve`, nov/2026): toda a
  equipe do processo (padrão) ou só **quem gere a unidade** (`'gestor'`).
  Reservado, o dado só chega a quem gere a unidade onde foi registrado
  (`ve_unidade`, gravado no movimento), a quem o registrou e à administração
  (inclusive o admin delegado do órgão interno, que entra em `gestorDe`). Os
  demais veem que a ação foi feita, sem o valor: `obter` tira `valor`,
  `valor_texto` e `ref` do movimento (`semReservado`) e devolve a informação
  com `oculta: true` (`informacaoVisivel`). A descrição do movimento, que vai
  às listas (`ultimo_movimento`), ao extrato e ao PDF, diz só "reservado a
  quem gere a unidade". Só pode ser reservado dado digitado (texto, texto
  longo, número, data ou formulário sem registro de outro módulo), fora dos
  autos e da certidão conjunta; escolha (lista, sim/não) fica de fora porque
  condiciona outras ações. Reservado nunca vai ao portal nem aos modelos
  (`partes` sai na gravação do rito). A cadeia de eventos é conferida sobre
  os movimentos completos.
- Respostas ficam em `acoes_respostas[faseId][idx]` (lista e sim/não; campo de
  escolha de formulário em `[idx.campo]`, ver "Ações com mais opções"), são
  apagadas ao desfazer a ação e ao reentrar na fase. Regras em
  `acoes_regras[i].se = { acao, valores }`, `acoes_regras[i].quem` e
  `fases[].condicoes_regra[faseDestino] = { acao, valores }`. Desde
  14/11/2026 a condição também aceita `fase`, `dado` e `e` (ver "Condições
  amplas e saída padrão").
- **Editor**: mover, inserir ou remover ações leva as condições junto; a que
  dependia de ação removida sai. Pendências graves: condição sem resposta
  marcada, que depende de ação que não é mais de escolha ou que não vem antes.
  O servidor valida o mesmo ao salvar.
- **Prévia com simulação**: na prévia do rito, escolha a resposta de cada
  ação de escolha para ver quais ações passam a valer e qual saída fica
  indicada; "Ir para …" anda a simulação para a fase seguinte. O fluxograma
  e a lista do fluxo mostram "quando …" nas setas com regra. A parte nunca vê
  condições.

### Condições amplas e saída padrão (14/11/2026)

A condição de uma ação ("Quando vale") e a de uma saída ("Regra desta saída")
deixaram de ler só a rodada da própria fase. Sem os campos novos, a condição
é a de sempre: nenhum rito gravado muda.

- **Resposta de outra fase** (`fase`): `{ fase: 'adm', acao: 0, valores }` lê
  a resposta da ação 0 da fase `adm`, como ficou quando o processo passou por
  lá (a rodada de uma fase só recomeça quando o processo volta a ela). Se o
  processo ainda não passou pela fase, a condição não vale. Na ação
  condicional, a regra "só ação anterior" vale para as partes que leem a
  própria fase; a que lê outra fase pode apontar para qualquer ação dela.
- **Dado do processo** (`dado`, com `acao: -1`): `urgente` (`sim`/`nao`),
  `sigilo` (`normal`/`restrito`), `partes` (`sim` quando há parte não
  retirada), `origem` (as de `ORIGENS`), `tipo` (id do tipo de processo) e
  `campo:<id>` (campo de lista ou sim/não do formulário do tipo). Nos dois
  últimos, o valor vem do cadastro: a condição guarda também `rotulo` (nome
  do campo) e `nomes` (nome de cada valor), para as mensagens do processo.
- **Várias ao mesmo tempo** (`e`): até 3 condições a mais
  (`MAX_CONDICOES_E`), sem aninhar. Todas precisam valer. "Ou" continua
  sendo marcar mais de uma resposta na mesma condição.
- **Saída padrão** (`fases[].saida_padrao`): o "senão" do desvio. Vale em
  fase com mais de um caminho (as saídas que não são fase de espera) e só
  para saída sem regra própria. No processo, quando nenhuma regra indica
  outra saída, ela é a indicada (botão principal, diálogo de fase e lista de
  saídas dizem "saída padrão do rito"). Com **Seguir sozinha**,
  `saidaAutomatica` vai por ela nesse caso; sem saída padrão, a fase com
  várias saídas e nenhuma indicada continua esperando o botão. Seguir por
  outra saída sem regra continua livre.
- **Onde se lê**: `respostasDaFase(proc)` (`shared/exigencias.ts`) monta uma
  só tabela para tudo o que uma condição lê: a rodada da fase atual (`'2'`,
  `'2.sistema'`), as respostas das outras fases (`'adm/0'`) e os dados do
  processo (`'@urgente'`, `'@tipo'`, `'@campo:gravidade'`). O que se grava em
  `acoes_respostas` não muda. O espelho da tela é `respostasDoProcesso(p)`
  (`src/lib/exigencias.js`).
- **Validação ao salvar o rito** (`sanitizeCondicaoAmpla`): as condições
  amplas são saneadas numa segunda passada, com todas as fases prontas. A
  parte cuja fase ou ação saiu do rito sai com ela; dado que não existe,
  ação que não é de escolha e condição sem resposta marcada são recusados
  com mensagem. A referência à própria fase em `fase` vira condição comum.
- **Editor**: a lista de onde a condição lê traz as respostas desta fase, as
  de cada outra fase ("na fase …") e os dados do processo; "Tipo de
  processo" só aparece quando mais de um tipo usa o rito, e os campos do
  tipo, depois que algum tipo usa o rito. "E também" soma condições. Em
  Encaminhamentos, "Se nenhuma regra indicar outra saída" escolhe a saída
  padrão. Mover ou remover ações leva junto as condições das **outras**
  fases que leem as respostas dela (`remapearDeOutraFase`); copiar fases
  leva as condições entre as copiadas e tira a que lê fase que ficou de
  fora. Pendências graves novas: condição que lê fase, ação de outra fase ou
  dado que não existe mais.
- **Prévia**: as respostas dadas numa fase seguem valendo ao andar para a
  seguinte, e os dados do processo que o rito lê aparecem para trocar.
- **Sigilo**: a condição lê só escolhas (nunca dado reservado a quem gere a
  unidade) e o texto dela só aparece à equipe. A parte nunca vê condições.

### Ação que vem do processo e documento detalhado na entrada (16/11/2026)

**Ação ligada a um campo do processo** (`acoes_regras[i].do_processo`, ou
`do_processo_campos` no formulário; `shared/doProcesso.ts`, espelho em
`src/lib/doProcesso.js`):

- **Ação que só se marca** (desde 19/11/2026): o campo ligado a dispensa
  ("Dispensada quando preenchido"). Com o campo preenchido, ela não vale
  (`dispensadaPeloProcesso`, lida dentro de `acaoAtiva` em
  `shared/exigencias.ts` e no espelho do cliente): some da tela, não é
  cobrada, não gera registro e o servidor recusa marcá-la. Apagado o campo,
  volta a valer. Antes ela era cumprida pelo sistema, com registro; o que já
  foi cumprido assim continua registrado. `respostasDaFase` passou a ler
  também o assunto e a descrição (`@campo:@assunto`, `@campo:@descricao`) e
  o campo de registro de outro módulo como preenchido.
- **O que faz**: a ação que pede um dado (texto, número, data,
  lista, sim/não ou formulário) pode apontar para um campo do formulário do
  tipo de processo, ou para o assunto e a descrição. Se o campo está
  preenchido, na criação ou depois, o sistema cumpre a ação sozinho com o
  valor do campo: o registro vai aos autos como qualquer cumprimento, com
  "Cumprida automaticamente: o dado já consta do processo" e o autor
  "Sistema (dado do processo)". Na tela, a ação cumprida assim sai da lista
  e fica no resumo "ações já resolvidas pelos dados do processo" (desde
  19/11/2026). Ação de lista se cumpre só se o valor é uma das opções; formulário, só com
  todos os obrigatórios preenchidos. Tipos que não combinam não se ligam.
- **Quando roda**: ao autuar (fase inicial) e depois de cada ato que muda o
  processo (avançar, tramitar, alterar dados, marcar ação, mudar a
  situação), só no processo em tramitação e só se o rito tem alguma ligação
  (o rito sem ligação não paga nada a mais). Até 30 passos por vez
  (`MAX_PASSOS_AUTO`), um a um, cada um em transação própria.
- **Desfazer e mudar**: campo apagado desfaz a ação que o sistema cumpriu;
  campo alterado desfaz e cumpre de novo com o valor novo (os dois
  registros ficam nos autos). Ação cumprida à mão o sistema não mexe. Quem
  desfaz à mão uma ação cumprida pelo sistema manda nela até o processo
  sair da fase (`acoes_auto_off`); ao voltar à fase, tudo recomeça.
  `acoes_auto[fase][idx]` guarda o valor com que o sistema cumpriu.
- **Volta**: a ação ligada cumprida à mão preenche o campo do processo, se
  ele está vazio e é do mesmo tipo ("Passa a constar dos dados do
  processo"). Nunca sobrescreve um campo preenchido, nem o assunto e a
  descrição (esses só pela retificação). Ação reservada a quem gere a
  unidade não preenche.
- **Dispensar quando já veio**: a condição de um campo do processo aceita
  os valores especiais `@preenchido` e `@vazio` (para qualquer campo do
  tipo, não só lista). Ex.: "Converter em PGEA no SIM" vale só quando o
  campo "Número do PGEA" está vazio; com o número, ela é dispensada e não
  impede a fase.
- **Editor**: na ação, "Vem do processo" escolhe o campo (no formulário, um
  por campo). No topo do editor, "Ligações sugeridas" compara o nome das
  ações e dos campos dos tipos que usam o rito e propõe as ligações e as
  dispensas; nada muda até aplicar e salvar. Vale para qualquer rito: o
  criado do zero, o da biblioteca, o copiado e o importado de outro órgão
  (as ligações viajam no pacote; lá, apontam para os campos dos tipos de lá).
- **Conferência** (`problemasDasLigacoes` em `src/lib/doProcesso.js`): o
  editor do rito avisa, sem travar, a ação que vem de um campo que nenhum
  tipo do rito tem ou de outro tipo de dado. O editor do tipo, na aba
  Formulário, lista as ações do rito que vêm de cada campo, avisa quando o
  formulário deixa uma ligação sem efeito e propõe abrir o rito para
  aplicar as sugestões (`acoesPorCampo`).
- **Prévia**: os campos ligados aparecem entre os dados do processo de
  exemplo; preenchido, a ação aparece marcada como cumprida sozinha.
- **Permissão e auditoria**: a ação automática segue as regras da ação
  (quem vê, onde fica o registro); o sistema não cumpre ação que não vale
  agora nem refaz o que a pessoa desfez. Tudo fica no histórico, com a
  marca `do_processo` no movimento.

**Documento detalhado na entrada** (`DetalharDocumentos.jsx`):

- Ao escolher um arquivo no "Novo processo" ou em "Novo documento" no
  processo, abre na hora o detalhe de cada arquivo: título, tipo, do que se
  trata (`descricao`, até 500 caracteres), data do documento
  (`data_documento`, nunca futura) e o que fazer: juntar aos autos (padrão),
  guardar fora dos autos ou deixar como minuta. Ao juntar: assinar (a
  assinatura entra antes do PDF), portal das partes e pendência para o
  decisor. No processo, também o que o rito exige e o documento cumpre.
- Os arquivos entram um a um, na ordem da lista, cada um com a data e a
  hora do próprio ato (no "Novo processo", logo depois da autuação). Só o
  último deixa a fase seguir sozinha (`aguardar`). Falha num não desfaz os
  anteriores; o que faltou volta ao diálogo sem enviar o arquivo de novo.
- A descrição e a data do documento entram no texto da juntada ou da
  guarda ("Documento datado de …. Do que se trata: …").

### Ação que pede um formulário (13/11/2026)

- **O que é**: em "O que pede", a opção "Um formulário (vários campos)". O
  admin cria até 10 campos (`MAX_CAMPOS_ACAO`) com o mesmo editor dos campos
  do tipo de processo (`EditorCampos`, em `CamposProcesso.jsx`): texto, texto
  longo, número, data, lista, múltipla escolha, sim ou não e registro de outro
  módulo, com formato, seção, orientação, campo que só aparece com certa
  resposta e "Obrigatório ao cumprir a ação". Não há "exigir para sair das
  fases" nem "partes veem" por campo: o destino e as partes são os da ação.
- **Rito**: `acoes_regras[i] = { pede: 'formulario', rotulo, campos: CampoDef[] }`.
  O servidor saneia os campos com `sanitizeCampos` (o mesmo do tipo, sem os
  nomes reservados do formulário de autuação), recusa formulário sem campo e
  limita a 200 campos de formulário somando o rito (`MAX_CAMPOS_RITO`, o
  documento do rito tem limite de tamanho). Campo de registro exige a
  integração ligada, como a ação que pede um registro.
- **No processo**: "Registrar" abre o formulário; falta de obrigatório é
  avisada na tela e conferida no servidor (`validarCampos`, registros relidos
  com `refsDoFormulario`). Campo cuja condição não se cumpre não é gravado. O
  movimento `acao_fase` guarda `tipo_valor: 'formulario'`, `valor` (os campos
  preenchidos, como no processo) e `valor_texto` ("Campo: valor; …"), que vai
  na certidão, no evento ou na certidão conjunta conforme o destino. Os
  registros escolhidos entram nos vínculos do processo; se algum for de acesso
  restrito, as partes não veem o formulário, e o portal o esconde se um deles
  ficar restrito depois (`refsFechadas`).
- **Resposta**: cada campo de lista ou de sim ou não do formulário condiciona
  outras ações e indica saída, como uma ação de escolha (ver a seguir).

### Ações com mais opções: campo do formulário, alternativas e orientação (13/11/2026)

Três opções a mais na configuração da ação (`RegrasDaFase.jsx`), validadas no
servidor (`shared/exigencias.ts`) e espelhadas em `src/lib/exigencias.js`:

- **Condição por campo do formulário**: "Quando vale" e "Regra desta saída"
  aceitam, além da resposta de uma ação de escolha, um **campo de lista ou de
  sim ou não** do formulário de uma ação da mesma fase ("Conforme "Sistema
  utilizado", de "Registrar os dados básicos""). Regra:
  `se = { acao, campo, valores }` (`campo` é o `id` do campo). Ao cumprir o
  formulário, `marcarAcao` grava uma resposta por campo de escolha preenchido
  em `acoes_respostas[faseId]['idx.campo']` (`respostasDaAcao`); desfazer a
  ação tira todas (`respostaDaAcao`). Formulário com dado **reservado a quem
  gere a unidade** não condiciona nem grava resposta, para o valor não chegar
  a quem não pode vê-lo. A migração de rito leva a chave junto com a ação.
  Limite: em processo que já tinha o formulário cumprido antes de a condição
  existir, a resposta só passa a contar quando a ação for refeita. A condição
  continua valendo só dentro da fase (não lê resposta de fase anterior).
- **Ações alternativas** ("Alternativa a"): a ação aponta uma ação
  **anterior** da fase que se marca (`acoes_regras[i].ou = índice`). O grupo é
  o das ações ligadas à mesma raiz (`grupoDeAlternativas`). Cumprida uma que
  vale agora, as outras deixam de ser cobradas e recomendadas
  (`alternativaCumprida`); na tela do processo a pendente mostra "Dispensada:
  a alternativa a esta ação já foi cumprida" e continua podendo ser marcada.
  Sem nenhuma cumprida, a exigência aparece uma vez, como "A ou B". Documento
  e orientação não entram em grupo. Ao reordenar, a marca acompanha a ação e
  sai se a ordem inverter ou a ação apontada for removida.
- **Só orientação** ("O que pede" = "Nada: só orienta (não se marca)",
  `pede: 'orientacao'`): lembrete da fase ou ação que o nome da fase já diz.
  Aparece na tela do processo com ícone de informação e o "Detalhe da
  orientação" (`ajuda`), sem caixa de marcar. Não guarda destino, nível, quem
  cumpre nem partes; pode ter "Quando vale". O servidor recusa marcá-la e
  nunca a cobra. Não vai ao portal, aos autos nem aos eventos.
- **Prévia**: simula também os campos de escolha do formulário. **Desenho**:
  o desvio usa o rótulo do campo, "ou" aparece na ligação entre alternativas e
  a orientação é uma caixa branca pontilhada (legenda "Orientação").
- Testes: `functions-v2/test/acoesOpcoes.test.js`, `src/lib/exigencias.test.js`
  e `src/lib/fluxoBpmn.test.js`.

### Andamento automático da fase (13/11/2026)

No cartão da fase, a seção **Andamento automático** guarda o que a fase faz
sem que alguém precise lembrar do passo seguinte. São três regras, todas
opcionais; rito sem elas funciona como antes.

- **Seguir sozinha** (`fase.avanco: 'auto'`). Cumprido o último item
  **obrigatório** (ação marcada ou, desde 14/11/2026, documento juntado ou
  guardado), o servidor confere, depois de gravar o ato, se nada
  exigido ficou em aberto (`exigenciasAbertas`) e se o rito indica uma única
  saída (`saidaAutomatica`, em `shared/secretaria.ts`): uma só fase seguinte,
  ou várias com exatamente uma indicada pela resposta de uma ação
  (`condicoes_regra`) ou, sem nenhuma indicada, a saída padrão do rito
  (`saida_padrao`, 14/11/2026). Se sim, faz o mesmo ato do botão, com as mesmas
  permissões de quem marcou: `tramitar` com `fase_id` quando a fase seguinte
  corre em outra unidade ativa, `avancarFase` quando corre na mesma. O
  movimento leva `dados.automatico: true` e o texto termina com "Avanço
  automático: o que a fase exigia foi cumprido." Se faltar
  documento ou dado, se houver mais de uma saída possível ou se o ato for
  recusado, nada acontece e o botão continua na tela. A resposta de
  `marcarAcao`, `juntar` e `guardar` traz `avancou: { fase, unidade,
  arquivado }` e a tela avisa para onde o processo foi. Disparam a
  conferência: marcar ação obrigatória, e juntar ou guardar documento numa
  fase que exige algo (`exigeAlgo` em `shared/exigencias.ts`; `avancarSozinho`
  em `secretaria/processos.ts`). Na juntada em conjunto (botão Finalizar), a
  tela manda `aguardar: true` em todos os documentos menos o último, e só
  esse conclui a fase. Petição protocolada pelo portal não dispara o avanço:
  ela abre pendência para o decisor. Minutas não seguem com o avanço automático: fase em
  que quem envia escolhe as minutas termina pelo botão. Fase final e fase
  sem nada obrigatório não seguem sozinhas.
- **Arquivar ao entrar** (`fase.ao_entrar.arquivar`). Ao entrar na fase, o
  processo é arquivado na mesma transação, em ato próprio logo depois da
  mudança de fase: movimento `situacao`, "Arquivado pela regra da fase X.",
  com quem fez, a data e `automatico: true`. A certidão conjunta pendente sai
  antes e o prazo automático da fase não é aberto.
- **Situação da consulta ou do expediente ligado**
  (`fase.situacao_registro: { modulo, ao_entrar?, ao_assumir? }`, módulo
  `consultas` ou `expedientes`). Ao entrar na fase, ou quando alguém assume o
  processo nela, o registro ligado vai para a coluna escolhida (Pendente, Em
  elaboração, Aguarda retorno de terceiros, Em revisão, Revisadas, Na
  pasta). O registro é o de origem do processo, se for daquele módulo, ou o
  único ligado a ele (`registroDoProcesso`). A mudança vai na **mesma
  transação** do ato: grava a data do marcador (se ainda vazia), limpa os
  marcadores das colunas seguintes, ajusta `status`, e escreve uma entrada
  em `activity_log` e em `history` do registro ("Situação "X" pelo processo
  eletrônico N (fase F)"). "Em elaboração" por quem assume grava também o
  responsável e a data de distribuição; "Na pasta" grava a devolução e
  dispara o webhook `archived` do módulo. As contas são as de
  `mudancasDaSituacao` (`shared/situacaoRegistro.ts`), conferidas no teste
  contra `calculateStatus`. O que a fase fez fica num registro interno do
  processo (`efeitos_fase`, só da equipe); quando não dá para mudar
  (integração desligada, nenhum registro ligado, mais de um, registro
  excluído ou anonimizado), o registro interno diz o motivo e o andamento
  do processo segue normalmente. Salvar um rito com essa regra exige a
  integração com o módulo ligada.
- **Registro de página própria ligado** (14/11/2026;
  `fase.situacao_registro: { modulo: 'paginas', pagina, ao_entrar?,
  ao_assumir? }`). `pagina` é o id do tipo (`entityTypes`) e o alvo é a chave
  de uma fase dele. O registro é o de origem do processo, se for daquela
  página, ou o único dela ligado ao processo (`lerPaginasDoRito`, que lê até
  20 registros de páginas ligados). A mudança passa pelas **regras de
  transição da página** (`evaluatePhaseTransition`, as mesmas de
  `updateRecord`), com quem pratica o ato no processo (uid e papel no órgão,
  `Contexto.papel`): campo exigido para sair da fase, condição de campo e
  aprovação por pessoa ou por papel. Permitida, grava `phase`, os campos
  automáticos da regra (`on_success.set_fields`; `now` vira a data do dia em
  Brasília) e a entrada "Fase: A → B (pelo processo eletrônico N, fase F)"
  em `activity_log` e `history`, na mesma transação do ato
  (`mudancasDaPagina`, `gravarNoRegistro`). O comentário que a regra pode
  exigir é essa entrada. Negada, o registro fica onde está, o processo segue
  e o registro interno (`efeitos_fase`) diz o motivo. Ao salvar o rito
  (`salvarRito` e `aplicarPropostaRito`), `exigirPaginas` recusa página
  inexistente ou de outro órgão e fase que a página não tem
  (`fasesDePaginaInvalidas`), e a integração com Páginas próprias tem de
  estar ligada. No editor, "A fase conduz" lista as páginas do órgão e as
  situações passam a ser as fases da página escolhida (`comRegistroConduzido`,
  `situacoesDaRegra`); página ou fase que deixou de existir vira pendência
  grave (`problemaDaPagina`). Nada disso chega às partes. Testes:
  `functions-v2/test/situacaoPagina.test.js` e `src/lib/andamentoFase.test.js`.
- **Parceria ligada** (14/11/2026; `situacao_registro: { modulo:
  'parcerias', ao_entrar?, ao_assumir? }`). Alvos: `SITUACOES_PARCERIA`
  (Pendente, Em análise, Em revisão, Revisadas, Aguarda Terceiros, Parcerias);
  "Extintos" fica no módulo (`extinguish`, com confirmação). `mudancasDaParceria`
  aplica as regras do quadro: para frente, as datas de `applyAutoDateForPhase`
  e, em "Em análise", o responsável (quem assume) e `responsibility_date`;
  para trás, apaga os marcadores das fases seguintes como o quadro
  (`handleBackwardMove`). Depois confere `validateParceriaPhaseTransition`: se
  faltar campo exigido (pasta na rede, remetido para, formalização), a parceria
  fica onde está e o registro interno diz o motivo. Parceria formalizada
  ("Parcerias") ou extinta não volta pelo rito, porque voltar apagaria a
  formalização. Grava `status` e "Status alterado de A para B (pelo processo
  eletrônico N, fase F)" em `activity_log` e `history`. Aditivos não são
  conduzidos. O Júri não é conduzido (não tem quadro de fases). Desde
  19/11/2026 a biblioteca traz um rito que usa tudo isso: o
  `parceria-formalizacao-mprs` cobre todas as colunas e informações do
  Painel de Parcerias (mapa em `docs/PARCERIAS.md`, seção 9; teste em
  `src/lib/bibliotecaFiltro.test.js`).
- **Valer já na autuação** (14/11/2026; `situacao_registro.na_autuacao:
  true`, só no editor da primeira fase). Na autuação, `autuar` lê o registro
  (`lerRegistrosDoRito` com a origem e os vínculos do processo novo, antes de
  qualquer escrita) e aplica a regra da primeira fase (`aplicarSituacao`):
  `ao_assumir` se a fase designa o responsável e tem essa regra, senão
  `ao_entrar`. O que não deu certo vai ao registro interno da autuação.
  Sem a marca, como antes: a autuação não muda o registro.
- **Registro criado na autuação** (14/11/2026; tipo de processo,
  `cria_registro: { pagina, fase?, valores: [{ campo, de, valor? }] }`,
  `shared/registroCriado.ts`). Fontes (`de`): `numero`, `assunto`,
  `descricao`, `autuacao` (data), `unidade`, `tipo`, `partes` (nomes),
  `fixo` (com `valor`) e `campo:<id>` do formulário. `salvarTipo` confere
  com `errosCriaRegistro`: página do órgão e ativa, fase existente, campos
  existentes, campo de pessoa (`user_ref`) recusado, valor fixo válido e uma
  fonte para cada obrigatório das fases alcançadas na fase em que o
  registro nasce (`phasesReachedUpTo`); a página entra em `modulosDoTipo`
  (pede a integração ligada). Em `autuar`, `paginaDoTipo` lê a página antes
  da transação; dentro dela, depois do número, `criarRegistroDaAutuacao`
  monta os valores (`valoresDoRegistro`, convertidos por `paraCampo`),
  valida com `validateRecordValues` (erro para a autuação com o motivo) e
  grava o `customRecords` como `createRecord` (histórico, contador e
  `CREATE_RECORD` no auditLogs). O processo guarda `registro_criado` (Ref)
  e a chave em `vinculos` e `vinculos_acoes` (fica ao editar dados). Com a
  regra da página na primeira fase e "Valer já na autuação", o registro novo
  é o conduzido; nas outras fases, `lerPaginasDoRito` prefere a origem,
  depois o criado. Processo que nasce de registro da mesma página não cria
  outro. A nota vai ao registro interno; a capa mostra "Criado na
  autuação". Desde 18/11/2026 a autuação também cria **consulta ou
  expediente** (`cria_registro: { pagina: '', modulo: 'consultas' |
  'expedientes', valores }`): os campos que o tipo preenche são os de
  `CAMPOS_CRIACAO` (`shared/painelModulos.ts`; Nº do PGEA e consulente
  obrigatórios na consulta, Nº do PGEA no expediente), o documento nasce
  Pendente como em `createProcess`/`createExpediente` (`docDoModulo`), com
  histórico, contadores e `CREATE_PROCESS`/`CREATE_EXPEDIENTE` no auditLogs
  (`criarNoModulo`). Parcerias seguem sem criação pela autuação (a ficha pede
  promotor, partes e objeto do termo). Testes: `functions-v2/test/registroCriado.test.js`,
  `functions-v2/test/painelModulos.test.js` e `src/lib/registroCriado.test.js`.
- **Integração com o painel** (18/11/2026; `shared/painelModulos.ts`,
  espelho `src/lib/painelModulos.js`, tela `IntegracaoPainel.jsx`, Guia do
  rito parte 21). Por que o Rito Consultas CAOCIPP não "conversava" com o
  Painel de Consultas: (1) o editor mostrava as situações gravadas ("Em
  elaboração", "Na pasta") e o quadro mostra outros nomes ("Em Análise",
  "Arquivados"), então parecia que as fases não existiam no painel; (2) o
  que as colunas pedem no quadro (destinatário da diligência, pasta na rede)
  não vinha de nenhuma ação; (3) o processo autuado sem nascer de uma
  consulta não tinha registro para conduzir. Agora: `PAINEIS` descreve, por
  módulo, as colunas com o nome do quadro (`rotuloDaColuna`, usado também em
  `situacoesDaRegra`), as informações que cada coluna pede (`auto` quando o
  sistema preenche) e os campos da ficha que uma ação pode gravar. Cada
  regra de ação ganha `ao_registro: { modulo, pagina?, campo? | campos? }`
  ("Leva ao painel"; `sanitizeAoRegistro` no `sanitizeRegra`: só ação que
  pede dado e não reservada, campo da lista e tipo compatível; página
  conferida em `exigirPaginas`/`aoRegistroInvalido`; o módulo entra em
  `modulosDoRito`). Em `marcarAcao`, com dado e `ao_registro`, o registro é
  lido antes das escritas (`lerRegistroDaAcao`, o mesmo de
  `registroDoProcesso`) e gravado por `levarAoRegistro` →
  `camposParaModulo`/`camposParaPagina` (texto aparado, data só ISO, data que
  marca coluna só quando o registro já está nela, valor de página validado
  por `validateRecordValues`), com entrada no histórico do registro. Sem
  registro ligado, nada muda nele e o registro interno do processo diz o
  motivo; a capa avisa a equipe (`paineisSemRegistro`). No editor do rito,
  "Integração com o painel" mostra a cobertura coluna a coluna
  (`relatorioIntegracao`) e sugere pelos nomes (`sugestoesDeIntegracao`:
  coluna da fase, levar dado de ação existente, criar ação obrigatória para
  o que falta), aplicadas por `aplicarIntegracao`. O pacote de rito leva a
  página de `ao_registro` pelo nome. Testes: `functions-v2/test/painelModulos.test.js`
  e `src/lib/painelModulos.test.js` (com o Rito Consultas CAOCIPP).
- **Painel opcional em todo modelo e tipo que já cria o registro**
  (18/11/2026). `PAINEIS`, em `src/lib/bibliotecaRitos.js`, dá a cada
  modelo o nome do painel (`painel: [singular, plural]`, exigido por
  teste). Na revisão de rito novo, `IntegracaoPainel` recebe `convite` e
  mostra a escolha "Ligar: criar painel e planilha" ou "Seguir sem
  painel" antes da seção recolhida; `nomes` preenche o formulário de
  geração. Gerada a página, a tela guarda em `tipo.cria_registro`
  `{ pagina, valores: processo ← numero, assunto ← assunto }`;
  `montarPayload` só o envia se o tipo for criado, e `aplicarPropostaRito`
  confere com `sanitizeCriaRegistro` e `errosCriaRegistro` (página do
  próprio órgão, ativa, campos existentes; módulo fixo é recusado ali).
- **Gerar painel e planilha do rito** (18/11/2026, etapa 2; "Integração com
  o painel" → Gerar). `painelDoRito(fases, [singular, plural])` monta a
  definição da página própria: uma fase da página por fase do rito (chaves
  sem acento, únicas; a primeira inicial, as finais finais), os campos
  `processo` e `assunto` e um campo por dado de ação (`dadosDoRito`; tipo
  pelo que a ação pede: data, número, sim ou não, texto longo, lista com as
  opções da ação ou texto), com `phase` na coluna da fase e `table_layout`
  com os primeiros. A tela grava pela `upsertEntityType` de sempre
  (`sanitizeEntityTypeDefinition`, permissão de gerenciar páginas, auditLogs
  `CREATE_ENTITY_TYPE`) e aplica `ligarAoPainelGerado`: cada fase livre
  ganha `situacao_registro` da página (a primeira com `na_autuacao`) e cada
  ação, `ao_registro` para o seu campo. Fase que já conduz outro painel e
  ação que já leva a outro ficam como estão. O rito só muda ao salvar
  (`salvarRito` confere de novo). O tipo de processo cria o registro com
  "Criar registro na autuação".
- **Assumir.** Na tela do processo, quem está lotado na unidade que tem o
  processo vê o botão **Assumir** enquanto ele não tem responsável (é a ação
  `atribuir` para si mesmo; o destino do registro continua sendo o da linha
  "atribuição" em Registros).
- **Limites.** Sem "Valer já na autuação", a situação não é aplicada na
  autuação. A consulta precisa existir e estar ligada ao processo; o
  processo não cria a consulta. O rito grava só as datas e o responsável: o
  que o diálogo do quadro pede a mais (pasta na rede, destinatário da
  remessa) continua sendo preenchido na ficha do registro. Mover o cartão
  no quadro não muda a fase do processo.
- Telas: `AndamentoDaFase.jsx` (editor), linha "Andamento automático" na
  Prévia, "Pelo rito, esta fase…" e o botão Assumir em `ProcessoView.jsx`,
  parte 8 do Guia do rito. Testes: `functions-v2/test/andamentoAuto.test.js`
  e `src/lib/andamentoFase.test.js`.

### Fase de espera (13/11/2026)

Para o trabalho que para à espera de alguém de fora (diligência externa,
informação pedida a terceiros). A fase marcada como **Fase de espera**
(`fase.espera: true`, em Encaminhamentos) recebe o processo, aguarda e o
**devolve à fase de onde ele veio**, que é retomada como estava.

- **No rito.** A fase de espera não tem saídas próprias (`proximas`,
  condições e `final` são descartados) e nunca é a primeira nem a final. Só
  se entra nela por saída escrita: a fase de origem a lista em
  Encaminhamentos, como alternativa. Quem não escreveu saídas segue para a
  seguinte da lista **que não seja de espera** (`fasesSeguintes`). No
  desenho, a espera aparece com setas de "volta" para as fases que levam a
  ela.
- **Ida.** Ao entrar na espera vindo de outra fase, o processo guarda
  `espera: { fase, unidade, responsavel_uid, desde }`. Ir para a espera
  **não conclui a fase de origem**: o que falta nela (ações obrigatórias,
  documentos) não pede dispensa. O termo diz "(fase de espera)".
- **Volta.** Na espera, a única saída prevista é a fase de origem
  (`saidasDoProcesso`); outra fase é fora do fluxo e pede motivo. Na volta
  (`retomada: true` no movimento, "(retomada depois da espera)" no texto),
  o que já foi cumprido na fase de origem **continua valendo**: ações
  feitas, respostas e documentos exigidos não recomeçam, ao contrário de
  uma entrada comum na fase. A marca `espera` sai do processo. A espera tem
  as suas próprias exigências (ex.: registrar a remessa e o retorno): sair
  dela sem cumpri-las pede motivo de dispensa, que vai aos autos como em
  qualquer fase.
- **Unidade e responsável.** Se a espera corre em outra unidade, a volta
  devolve o processo à unidade em que ele estava e, se quem respondia por
  ele ainda está lotado nela, a responsabilidade volta junto. Na mesma
  unidade, o responsável não muda, mesmo que a fase de origem tire o
  responsável ao entrar.
- **Seguir sozinha.** A saída para uma fase de espera é desvio eventual:
  não conta como caminho do rito (uma fase com as saídas Revisão e
  Diligências tem, para esse fim, uma saída só). Com "Seguir sozinha"
  marcada na própria espera, cumprida a última ação obrigatória ela termina
  e o processo volta (`saidaAutomatica`).
- **Consulta ou expediente ligado.** A espera pode pôr o registro em
  "Aguarda retorno de terceiros" (`situacao_registro.ao_entrar`). Na volta,
  vale a situação da fase de origem: a de "quando alguém assume", se o
  processo tem responsável; senão, a de "ao entrar".
- **Tela do processo.** A fase que leva à espera mostra o botão
  **Aguardar: (nome da fase)**; o botão principal continua seguindo o
  caminho do rito. Na espera, o cabeçalho diz "em espera · volta para X" e o
  botão principal é **Encerrar a espera e voltar para X** (ou "devolver
  para" a unidade de origem).
- **Registro.** A ida e a volta seguem as regras de Registros das duas
  fases (vale o mais reservado). Para não gerar evento impresso, deixe a
  fase de espera como informação.
- **Limites.** O prazo automático da fase de origem é encerrado na ida e
  reaberto inteiro na volta. Uma espera dentro de outra mantém a origem da
  primeira. Rito migrado em que a fase de origem deixou de existir: a volta
  vira "fora do fluxo" e pede motivo.
- Testes: `functions-v2/test/faseEspera.test.js` e
  `src/lib/faseEspera.test.js`. Guia do rito, parte 9.

### Revisão: redação original guardada e botão Finalizar (13/11/2026)

Para o trabalho em que uma unidade redige e outra revisa (a assessoria
escreve a minuta, o gabinete corrige, assina e escolhe os anexos).

- **Redações anteriores da minuta.** Em `editarMinuta`, quando quem salva
  não é quem escreveu a redação atual e o texto mudou (`versaoAnterior`, em
  `shared/secretaria.ts`), a redação anterior é gravada em
  `secProcessos/{id}/documentos/{doc}/versoes/{v}`
  (`{ autor_uid, autor_nome, de, sha256, titulo, tipo, conteudo,
  substituida_em, substituida_por }`), na mesma transação da edição. O
  documento passa a ter `editado_por`, `editado_por_nome` e `versoes_qtd`.
  Quem corrige o próprio texto não gera versão. Não há o que configurar.
- **Quem vê.** A mesma regra do documento: enquanto minuta, as unidades que
  a veem (`minutaAcessivel`); depois de juntado ou guardado, a equipe com
  acesso ao processo. **As partes nunca**: o portal não lê `versoes`, e as
  regras do Firestore negam a leitura direta. As versões continuam depois
  da juntada.
- **Ações do servidor** (`secretariaDocumento`): `versoes` lista (sem o
  conteúdo); `baixar` e `pdf` aceitam `versaoId` (o PDF sai com a marca
  "VERSÃO ANTERIOR"). `excluirMinuta` apaga a minuta com as versões.
- **Na tela.** Ao lado do documento (minuta, peça dos autos ou guardado),
  o botão **Versões (n)** abre as redações anteriores, só para leitura.
- **Botão Finalizar** (`fase.juntada_conjunta`, em Andamento automático do
  rito). Na fase marcada, a tela do processo mostra "Finalizar (nome da
  fase)", ex.: **Finalizar revisão**. O diálogo lista as minutas e os
  anexos que estão com a unidade; quem tem o processo escolhe quais entram
  nos autos, a ordem, anexa o que faltar, assina e junta tudo. O que não
  foi escolhido continua como minuta ou, se marcado, é guardado fora dos
  autos. Depois, a tela abre o passo seguinte da fase (o botão principal).
  Sem a marca, o mesmo diálogo aparece como **Juntar em conjunto** quando
  há duas ou mais minutas.
- **Como grava.** A juntada em conjunto é uma sequência de juntadas comuns
  (`juntar`, com `assinar`), uma por documento, na ordem escolhida: cada
  uma tem número de ordem, folhas e termo nos autos, e cumpre o que o rito
  exige pelo tipo ou modelo do documento. Juntas, formam o evento da fase
  na impressão.
- **Limites.** Não é uma transação só: se uma juntada falha, as anteriores
  já valem e a tela diz onde parou (basta repetir com o que restou). No
  conjunto não se abre pendência ao decisor nem se decide pendência; para
  isso, use a juntada de um documento. Arquivo enviado não se edita, logo
  não tem versões. Finalizar não muda a fase: quem confirma o passo
  seguinte é a pessoa.
- Testes: `functions-v2/test/revisaoMinuta.test.js` e
  `src/lib/juntadaConjunta.test.js`. Guia do rito, parte 10.

### Fase de elaboração (19/11/2026)
- **O que é** (`fase.elaboracao`, em Andamento automático: "Fase de
  elaboração: quem está nela só prepara minutas"). Não combina com o botão
  Finalizar nem com a fase final (`sanitizeRito` descarta).
- **Na tela.** Arquivo anexado entra como minuta, sem a escolha de juntar,
  guardar ou assinar (`DetalharDocumentos` com `soMinuta`). No card das
  minutas somem Assinar, Pedir assinatura, Juntar, Guardar fora dos autos e
  Juntar em conjunto. Na remessa, todas as minutas da unidade seguem (as
  caixas ficam marcadas e travadas).
- **No servidor** (`secretaria/documentos.ts`). `assinar`,
  `pedirAssinatura`, `juntar` e `guardar` são recusados na fase. Ao criar
  ou enviar a minuta, `cumpridaPelaMinuta` acha a exigência de documento
  que ela atende (modelo ou tipo; sem tipo, a primeira livre) e grava o
  cumprimento com um registro interno. `excluirMinuta` desfaz
  (`semCumprimentoDaMinuta`). Em `tramitar`, as minutas acessíveis à
  unidade entram na remessa mesmo sem a escolha.
- No Rito Consultas CAOCIPP, a Análise é fase de elaboração.
- Testes: `functions-v2/test/elaboracao.test.js`.

### Desentranhamento e ato sem efeito (19/11/2026)
- **Onde.** Aba Eventos: "Desentranhar" no evento da juntada (ou petição)
  e "Tornar sem efeito" nos demais atos que admitem (`podeFicarSemEfeito`:
  não autuação, remessa, conclusão, fase, situação, exclusão, restauração,
  retificação, nem a própria anulação). Justificativa de 10 a 500 caracteres.
- **Quem** (`podeExcluirDosAutos`): quem praticou (ou juntou), o gestor da
  unidade onde se praticou (`unidade_juntada`, gravada na juntada desde
  19/11/2026; antes, a unidade de origem da minuta), o admin do órgão e a
  unidade que decide enquanto está com o processo.
- **Como grava** (`documentos.ts`, ações `desentranhar` e `semEfeito`).
  Desentranhar marca `desentranhado` no documento, registra o termo
  `desentranhamento` com a visibilidade do documento, marca a conferência
  pública (`desentranhado_em`) e devolve a pendente o que o documento
  cumpria na fase em curso. Sem efeito registra a certidão `sem_efeito`
  (`alvo_seq`, motivo) com a visibilidade e o caráter interno do alvo.
- **Como aparece.** `extrasDoEvento` devolve `desentranhado`,
  `sem_efeito` (número da certidão) e `pode_sem_efeito`. No PDF, o
  documento desentranhado vira uma folha de aviso carimbada com as folhas
  que ocupava; o termo do ato sem efeito leva "ATO SEM EFEITO: ver o evento
  nº N"; índice e extrato marcam os dois. O portal lista o aviso e recusa
  baixar o arquivo; a equipe ainda abre o original.
- Testes: `functions-v2/test/elaboracao.test.js`.

### Impressão interna (14/11/2026)

PDF de uso da equipe com o que fica **fora dos autos**. Serve às fases de
trabalho interno (análise, diligências externas), que o rito deixa como
informação: nada delas entra nos autos, mas a equipe pode imprimir, por
seleção.

- **Onde.** Tela do processo: menu de três pontos e aba Autos, botão
  **Impressão interna**. O diálogo lista o que pode ser marcado.
- **O que pode sair** (`functions-v2/src/shared/autos.ts`):
  - registros que não são peça dos autos (`registroInterno`): internos, de
    controle e do sistema, inclusive os que o rito deixou "só no sistema"
    (`fora_impressao`), que não saem no PDF dos autos;
  - minutas que a pessoa vê e documentos guardados fora dos autos
    (`documentoInterno`);
  - redações anteriores de qualquer documento que a pessoa vê (inclusive de
    peça já juntada).
- **O que nunca sai.** Registro que o rito marcou "sem evento" (`oculto`).
  Dado reservado a quem gere a unidade segue sem o valor (o texto do
  registro nunca o traz). Peça dos autos não entra: tem o PDF dos autos.
- **Como sai** (`montarPdfInterno`, em `exportar.ts`). Capa "IMPRESSÃO
  INTERNA" com o conteúdo, a lista dos registros e os documentos em
  sequência. Não há folhas nem carimbo dos autos; toda página leva "USO
  INTERNO" (rodapé nas páginas de texto, faixa no alto das páginas dos
  documentos) e as minutas e versões levam marca d'água.
- **Servidor.** A mesma função do PDF dos autos (`secretariaExportarPdf`),
  com `interno: { registros: [seq], documentos: [id], versoes: [id] }`. O
  servidor confere de novo, item a item, o que quem pede pode ver, e grava
  a auditoria `SECRETARIA_PDF_INTERNO_EXPORTADO`. O portal das partes tem a
  sua própria função e não chega a esta.
- **Limites.** Até 60 documentos por impressão; arquivos enviados somam
  até 18 MB (acima disso, entra uma folha de referência). A ordem é fixa:
  registros, documentos (pela data de criação) e redações anteriores.
- Testes: `functions-v2/test/impressaoInterna.test.js` e
  `src/lib/impressaoInterna.test.js`. Guia do rito, parte 11.

### Modelo pronto: Rito Consultas CAOCIPP (14/11/2026)

Em **Novo rito**, "Começar sem arquivo", o modelo **Rito Consultas CAOCIPP**
cria o rito de consultas inteiro, já configurado. É o exemplo completo do
rito em fases, ações e desvios, e o mesmo que o Guia do rito mostra na
parte 12 (`ritoConsultas` em `src/lib/secretariaRito.js`).

| Fase | Unidade | O que acontece | Onde fica |
|---|---|---|---|
| Recebimento | Secretaria | Dados básicos (formulário), número do PGEA, comunicação ao solicitante (só se a consulta não veio pelo SIM), observações. Segue sozinha | Folha de dados (evento 1); observações sem evento |
| Análise | Assessoria | Consulta Pendente; ao assumir, Em elaboração. Minuta e anexos ficam como minuta. Termina pelo botão: quem envia escolhe o que segue | Só no sistema |
| Revisão | Gabinete | Consulta Em revisão. Edita a minuta e usa Finalizar Revisão. Juntado o parecer, segue sozinha | Parecer e anexos escolhidos nos autos |
| Devolução | Secretaria | Consulta Revisadas. Registros de acervo, data e meio da devolução. Segue sozinha | Devolução nos autos |
| Arquivamento | Secretaria | Arquiva ao entrar. Consulta Na pasta | Extrato do PDF, com quem fez e a data |
| Diligências externas | onde o processo estiver | Fase de espera da Análise e da Revisão. Consulta Aguarda retorno de terceiros. Registrado o retorno, volta sozinha | Só no sistema |

- **Unidades.** O modelo cita Secretaria, Assessoria e Gabinete pelo nome. A
  tela casa com as unidades do órgão (nome ou sigla) e propõe criar a que
  não existir, como faz com um arquivo importado (`vincularProposta`).
- **Antes de usar.** A integração com Consultas precisa estar ligada (o
  editor aponta a pendência e não implanta sem ela). O processo precisa
  nascer de uma consulta ou ter uma ligada: o rito conduz a situação dela,
  mas não cria a consulta. O tipo de documento Parecer precisa existir (é o
  padrão): por ele a Revisão reconhece o parecer juntado.
- **Por que a Análise não segue sozinha.** O envio ao Gabinete pede a
  escolha das minutas que seguem com o processo, e o avanço automático não
  leva minutas. A Revisão segue sozinha desde 14/11/2026: o Finalizar
  Revisão junta o parecer e os anexos, e o último documento conclui a fase.
  Rito já implantado a partir do modelo continua como foi gravado; para ter
  o mesmo, marque "Seguir sozinha" na Revisão.
- **Nada é exclusivo do modelo.** Cada recurso que ele usa é uma opção do
  editor de rito e vale para qualquer procedimento. O Guia do rito, parte
  13, diz onde ligar cada um. Conferido criando outro rito pela tela e pela
  API no cenário de ponta a ponta.
- **Registros de acervo.** Ficam na Devolução, como ação obrigatória: o
  processo é arquivado no instante em que chega ao Arquivamento.
- Fase de espera sem unidade deixou de ser apontada como pendência no
  editor: aguardar na unidade em que o processo está é o esperado. No
  desenho, a raia dela se chama "Onde o processo estiver".
- **Anexo não escolhido na Revisão.** Basta não marcar no Finalizar
  Revisão: ele continua como minuta, só para a equipe, e pode sair na
  impressão interna. Guardar fora dos autos nessa fase deixa uma linha no
  extrato impresso, com o título do documento.
- **Guardar fora dos autos em fase interna.** O registro da guarda seguia
  para o extrato impresso sempre que o documento não cumpria exigência. Agora
  segue a fase (`destinoDaGuarda` em `shared/exigencias.ts`): na fase que o
  rito deixa só no sistema ou sem evento (Análise, Diligências externas), a
  guarda fica só no sistema e sai na impressão interna, por seleção. Nas
  demais fases nada muda. Vale para os ritos já existentes.
- Testes: `functions-v2/test/modeloConsultas.test.js` (o servidor guarda
  tudo o que o modelo configura e segue o caminho descrito) e
  `src/lib/secretariaRito.test.js` (todos os modelos).

### Ao entrar na fase: efeitos, avisos e prazos por ação (14/11/2026)

O que a fase faz sozinha ganhou mais opções. Todas são campos opcionais da
fase (ou da regra da ação); sem eles, o comportamento é o de antes. Regras
puras em `shared/efeitosFase.ts` e `shared/prazosFase.ts`; espelho da tela em
`src/lib/efeitosFase.js`.

| Campo | O que faz |
|---|---|
| `ao_entrar.urgente` / `sem_urgencia` | Marca ou tira a urgência. Tirar não vale na autuação. As partes veem a frase no termo da mudança |
| `ao_entrar.sigilo` (`restrito`/`normal`) | Muda o sigilo do processo. Registro interno |
| `ao_entrar.sem_responsavel` | Tira o responsável (já existia) |
| `ao_entrar.responsavel` (`autor`/`gestor`/`atribuicao`) + `responsavel_atribuicao` | Designa o responsável entre os lotados na unidade que fica com o processo |
| `ao_entrar.pendencia` + `pendencia_interrompe` | Abre pendência (até 300 caracteres), apreciada como as demais: pela unidade que decide, com o processo |
| `aviso.para` (`unidade`/`gestores`/`responsavel`/`ninguem`) + `aviso.mensagem` | Quem da equipe é avisado quando o processo entra na fase |
| `acoes_regras[].prazo_dias` + `prazo_contagem` | Prazo próprio da ação (1 a 3650 dias; úteis ou corridos) |
| `prazo_alerta_dias` | Antecedência do alerta dos prazos que a fase abre (0 a 30; não se grava quando é 2) |
| `prazo_vencido.urgente` / `avisar_gestores` | O que acontece quando um prazo da fase vence sem cumprimento |

- **Validação ao salvar** (`sanitizeAoEntrar`): marcar e tirar a urgência,
  tirar e designar o responsável, designar por atribuição sem dizer qual e
  designar ou abrir pendência em fase que arquiva ao entrar são recusados com
  mensagem. O editor mostra o mesmo como pendência que impede
  (`problemasDosEfeitos`). Antecedência e regra do vencimento só se gravam em
  fase que abre algum prazo sozinha.
- **Designação** (`responsavelPelaFase`): `autor` vale se quem moveu o
  processo está lotado na unidade de destino; `gestor` e `atribuicao` valem
  quando há **uma só** pessoa assim na unidade. Com nenhuma ou mais de uma,
  ninguém é designado e o registro interno diz o motivo. Designado o
  responsável, vale a situação "ao assumir" do registro ligado.
- **Volta da espera**: a fase retomada não designa de novo nem reabre a
  pendência (urgência e sigilo valem sempre).
- **Aviso** (`avisarEntradaNaFase` em `secretaria/avisosEquipe.ts`): com
  `aviso.para`, o aviso da fase substitui o de chegada por remessa e vale
  também quando o processo muda de fase sem sair da unidade. `responsavel`
  sem responsável (ou fora da unidade) e `gestores` em unidade sem gestor
  avisam a unidade: o aviso não se perde. Só `mensagem`
  acompanha o aviso padrão de remessa. Quem praticou o ato e quem é parte
  no processo nunca recebem.
- **Prazo da ação** (`prazosDasAcoes`): abre quando a ação está valendo, não
  foi cumprida e a alternativa dela não foi cumprida; encerra como cumprido
  quando a ação é marcada ou o documento que ela pede é juntado ou guardado;
  é cancelado quando a ação deixa de valer; reabre se a ação for desfeita
  (só o prazo que a regra encerrou: encerramento manual fica). Reaberto
  depois de desfeito o cumprimento, vale o vencimento de antes; reaberto
  porque a ação voltou a valer, conta de novo a partir de hoje (nunca volta
  já vencido). Na saída da
  fase (`encerrarPrazosDaFase`), o prazo de ação aberto é encerrado "sem
  cumprimento, com a saída da fase". É conferido na entrada na fase, ao
  marcar ou desfazer ação e ao juntar, guardar ou protocolar documento.
  Nos atos por documento, a contagem usa o calendário do órgão (lido só
  quando a fase atual tem ação com prazo, `calendarioDasAcoes`) e o que a
  regra fez vai ao registro interno, como nos demais atos.
- **Atualização do rito** (`migrarEstado`): o prazo de ação segue a ação
  pelo texto, como as ações marcadas. O da ação que sumiu, ou da fase de
  destino que recomeça, é cancelado ("Atualização do rito") e deixa de
  contar para a rodada.
- **Alerta e vencimento** (`secretaria/conferir.ts`, todo dia às 7h): o
  prazo entra no alerta diário quando faltam `alerta_dias` dias (o padrão,
  2). `secProcessos.proximo_alerta` guarda o primeiro dia de alerta dos
  prazos com antecedência maior que a padrão, para a busca do job. A regra do
  vencimento (`tratarVencidos`) roda uma vez por prazo
  (`vencido_tratado_em`), no dia seguinte ao vencimento, mesmo com o alerta
  por e-mail do órgão desligado: marca a urgência com o motivo "Prazo
  vencido em …" e avisa quem gere a unidade.
- **Nada disso vai às partes**: designação, sigilo, pendência, prazos e
  vencimento ficam em movimento interno (`efeitos_fase`). A única frase
  pública é a da urgência, no termo da mudança de fase. O motivo da
  urgência só sai na folha de dados da equipe (a das partes diz só
  "URGENTE"). Ao apreciar pendência aberta à mão ou pela regra da fase, o
  ato público (`pendencia_resolvida`, ou a juntada que a decide) traz a
  decisão, não o texto da pendência; o de petição e de documento continua
  dizendo o que foi apreciado.
- **Tela do processo**: a ação pendente com prazo aberto mostra "Prazo da
  ação: vence em …". Os prazos aparecem na aba de prazos como os demais.
- **Limite conhecido**: a ação condicional que lê um dado do processo
  alterado depois (ex.: urgência marcada à mão) só tem o prazo conferido no
  próximo ato da fase (marcar ação, documento ou mudança de fase).
- Testes: `functions-v2/test/efeitosFase.test.js` e
  `src/lib/efeitosFase.test.js`. Guia do rito, parte 14.

### Comunicação e resposta das partes como ações do rito (14/11/2026)

Para processos com partes (disciplinar, sancionador, apuração em contrato,
recurso): o rito conduz o contraditório. Lógica pura em
`shared/comunicacaoRito.ts`; espelho da tela em `src/lib/comunicacaoRito.js`.

| Regra da ação | O que faz |
|---|---|
| `pede: 'comunicacao'`, `comunicacao: { especie, polos?, dias, contagem?, texto? }` | Comunica as partes dos `polos` (ausente = todas; as retiradas nunca). `dias` 0 = sem prazo de resposta. Sem destino nem `partes` na regra: o registro são as próprias comunicações. Aceita `quem`, `se`, `ou` e `prazo_dias` (prazo interno para expedir). |
| `pede: 'resposta'`, `resposta: { de }` | Espera a resposta da comunicação `de` (ação anterior da mesma fase, com `dias` > 0). Sem `quem` nem `prazo_dias`. A resposta (`Apresentada`, `Parcial`, `Sem manifestação`) vale nas condições e saídas, como a de uma lista. |

- **Expedir pela ação:** `expedirComunicacao` com `comunicacao.acao_idx`
  aceita só partes que a ação alcança e grava `fase_id` e `acao_idx` em cada
  comunicação. A ação se cumpre (`acoes_feitas`) quando todas as partes
  previstas foram comunicadas na rodada, e volta a ficar por cumprir se uma
  for tornada sem efeito; `marcarAcao` recusa marcá-la à mão.
- **Resposta:** a petição da parte (ou de representante) dentro do prazo
  marca `respondida_em` e `resposta_ordem` nas comunicações dela que a fase
  espera, com registro interno. Antes da ciência também vale. Depois do
  prazo, a petição é juntada, mas não conta.
- **Decurso:** a rotina diária (`respostasPorDecurso`, às 7h, depois da
  ciência por decurso) procura `aguarda_resposta == true` e, para cada
  comunicação esperada com `vence_em` já passado e sem resposta, grava o
  movimento público `decurso_prazo` ("Certidão de decurso de prazo"), marca
  `decurso_certificado` e avisa as partes. Uma vez por comunicação.
- **Cumprimento sozinho:** quando ninguém mais pode responder, a ação de
  espera fica cumprida com a resposta, com registro interno. `marcarAcao`
  aceita registrar a resposta à mão (peça chegada por outro meio); com parte
  ainda no prazo, só `Apresentada`.
- **Andamento automático:** cumprida a espera, a fase com `avanco: 'auto'`
  segue pelo contexto do sistema (`contextoDoSistema`: as unidades ativas do
  órgão, autor "Sistema (regra do rito)"). Se a fase reserva `concluir` a
  alguém, o sistema não conclui. Na fase de espera, a espera continua na fase
  de origem (`faseQueEspera`), sem avançar.
- **Rodada:** ao sair da fase (exceto para uma fase de espera), as
  comunicações da rodada ganham `rodada_fim` e `aguarda_resposta` vira
  `false`; ao voltar, a ação comunica de novo.
- **Editor:** "O que pede" ganhou "Comunicar as partes" (espécie, polos,
  prazo de resposta, texto proposto) e "Esperar a resposta das partes" (de
  qual comunicação). Reordenar as ações leva `resposta.de` junto; se a
  comunicação sair, a espera fica sem alvo e o editor aponta.
- **Tela do processo:** a ação de comunicação mostra "Comunicadas X de Y" e o
  botão **Expedir**, que abre o formulário preenchido só com as partes que
  faltam; a de espera mostra quem respondeu e até quando os demais podem.
- **Limite conhecido:** a rotina lê até 1000 processos com
  `aguarda_resposta` por dia.
- Testes: `functions-v2/test/comunicacaoRito.test.js` e
  `src/lib/comunicacaoRito.test.js`. Guia do rito, parte 15.

### Audiência como ação do rito (14/11/2026)

`pede: 'audiencia'`, `audiencia: { especie }` (audiencia, instrucao,
conciliacao, oitiva, sessao, reuniao, inspecao). Lógica pura em
`shared/audiencias.ts`; espelho em `src/lib/audiencias.js`.

- **Regra:** o servidor grava sempre `destino: 'autos'` e `partes: true`
  (designação é ato público). Aceita `quem`, `se`, `ou` e `prazo_dias`
  (prazo interno para designar).
- **Designar** (`marcarAcao` com `valor: { data, hora, modo, local?, link?,
  participantes? }`): data de hoje em diante, hora hh:mm, modo
  `presencial | virtual | hibrida` (local exigido fora do virtual, link fora
  do presencial), até 20 participantes além das partes (`testemunha, perito,
  informante, assistente, interprete, outro`). Certidão nos autos com o texto
  da audiência; grava `secProcessos.audiencias[]` (`id, fase_id, acao_idx,
  especie, data, hora, modo, local, link, participantes, designada_em,
  designada_por, status`) e o derivado `proxima_audiencia`
  (`AAAA-MM-DDThh:mm` ou null).
- **Desfazer** cancela a última designada da ação (`status: 'cancelada'`),
  com certidão que diz qual foi cancelada. Redesignar é desfazer e designar.
- **Comunicação:** `{audiencia}` no texto é trocado na tela pela próxima
  audiência designada; o servidor recusa expedir texto que ainda tenha a
  marca.
- **Portal:** `obter` devolve `processo.audiencias` (designadas de hoje em
  diante), mostradas em "Audiências designadas". A tela da equipe mostra a
  próxima audiência no alto do processo.
- **Participantes** não têm conta: o nome sai na certidão e o órgão os
  convoca pelo meio que usa.
- Testes: `functions-v2/test/audiencias.test.js` e
  `src/lib/audiencias.test.js`. Guia do rito, parte 15.

### Julgamento colegiado como ação do rito (15/11/2026)

`pede: 'julgamento'`, `julgamento: { resultados, quorum?, desempate?,
favoravel? }`. Lógica pura em `shared/julgamento.ts`; espelho em
`src/lib/julgamento.js` (a tela apura enquanto se preenche; o servidor apura
de novo).

- **Regra:** de 2 a 8 resultados distintos (impedido, suspeito, ausente e
  abstenção não podem ser resultado); `quorum` inteiro de 1 a 30 (só grava
  acima de 1); `desempate: 'favoravel'` exige `favoravel` entre os
  resultados (ausente = desempata o presidente). O servidor grava sempre
  `destino: 'autos'` e `partes: true`. Aceita `quem`, `se`, `ou`,
  `prazo_dias` (prazo interno para julgar), `obrigatoria` e `recomendada`.
- **Responde como escolha:** `opcoesDaResposta` devolve os resultados, e o
  resultado apurado fica em `acoes_respostas`, para o `se` de outras ações e
  as saídas da fase. Modelos que trocaram uma escolha por julgamento
  mantiveram as mesmas opções, e as condições seguiram valendo.
- **Registrar** (`marcarAcao` com `valor: { data, votos: [{ nome, funcao,
  voto }] }`): data da sessão até hoje (horário de Brasília); de 1 a 30
  membros, sem nome repetido (sem distinguir maiúsculas); `funcao` relator,
  revisor, presidente ou membro; `voto` um dos resultados ou `impedido`,
  `suspeito`, `ausente`, `abstencao`. Exatamente um relator, que vota um
  resultado, e no máximo um presidente.
- **Apuração:** maioria simples dos votos válidos; abaixo do quórum, recusa
  ("Quórum não alcançado: N votos válidos, e o rito exige Q"). No empate,
  prevalece o resultado mais favorável, se o rito disse e ele está entre os
  empatados; senão, o voto do presidente, se está entre eles; senão, recusa.
- **Certidão** nos autos, com folha, vista pelas partes: "Procedente, por
  maioria (3 a 1), em sessão de 20/11/2026. Relator: Ana. Vencido: Bruno
  (Improcedente). Impedido: Davi. Ausente: Eva". Variações: por unanimidade
  (N votos), pelo voto de desempate do presidente, no empate pelo resultado
  mais favorável à parte. Desfazer certifica nos autos, como as demais ações
  com destino autos.
- **Modelos:** 13 decisões de colegiado da biblioteca passaram a usar a ação
  (TED da OAB/RS, CED do CAU, câmaras de ética, Conselho Superior do MP,
  junta de recursos de trânsito). O modelo de disciplinar de entidade de
  classe mostra o desempate pelo mais favorável (Improcedente).
- Testes: `functions-v2/test/julgamento.test.js` e
  `src/lib/julgamento.test.js`. Guia do rito, parte 15.

### Sala da audiência (15/11/2026)

Décima etapa (S10). A audiência designada pela ação do rito (`pede:
'audiencia'`) passa a ser conduzida na plataforma. Fica com o processo, e
não como sessão de colegiado: a audiência é da unidade que tem o processo,
seja ela monocrática ou não. Lógica pura em `shared/audienciaSala.ts`
(espelho `src/lib/audienciaSala.js`); servidor em
`secretaria/audienciaSala.ts`.

- **Sala** em `secProcessos/{id}/salas/{audienciaId}` (só pelo servidor):
  `aberta_em`, `aberta_por`, `presencas` (por chave do convocado: `p{i}`
  parte, `p{i}r{j}` representante, `x{k}` participante da designação),
  `outros` (até 20, nome e qualidade), `ocorrencias` (até 200: `id, tipo,
  texto, quem?, em, por`), e, ao encerrar, `encerrada_em`, `realizada`,
  `motivo`, `termo_documento_id`.
- **Ações** `sala*` em `secretariaProcesso`: `salaAudiencia` (leitura, para
  quem vê o processo), `salaAbrir`, `salaPresenca`, `salaRegistrar`,
  `salaRemover` e `salaEncerrar` (quem tem o processo consigo). A sala abre
  no dia da audiência ou depois. Tipos de registro: manifestacao,
  depoimento, requerimento, proposta (com `quem`, entre os presentes),
  acordo, sem_acordo, deliberacao, documento, suspensao, retomada,
  registro.
- **Encerrar:** `textoDoTermo` e `documentoDoTermo` montam o termo; vai como
  minuta "Termo de audiência ..." (tipo Termo de audiência, `audiencia_id`),
  assinada por quem encerrou, para a juntada pelo caminho comum. A
  audiência ganha `realizada_em` e `realizada`; `audienciasFuturas` a tira
  das próximas, e `proxima_audiencia` é refeita. Movimento interno
  `audiencia_encerrada`. Sem abrir a sala, só se registra a não realizada
  (com motivo).
- **Excluir a minuta do termo** (`excluirMinuta`) chama `reabrirSala`: a
  sala volta a ficar aberta, e a audiência perde `realizada_em`.
- Desfazer a designação de audiência já encerrada é recusado.
- Auditoria: `SECRETARIA_AUDIENCIA_ABERTA`, `_ENCERRADA`,
  `_NAO_REALIZADA` (atos do dia a dia, fora do histórico de configuração).
- Tela: aviso "Sala da audiência" no alto do processo para a audiência de
  hoje ou de antes sem termo; `components/secretaria/SalaAudiencia.jsx`.
  Guia do rito (Designar audiência ou sessão) e glossário
  `termo_audiencia`. Testes: `functions-v2/test/audienciaSala.test.js` e
  `src/lib/audienciaSala.test.js`.

### Disputa de preços: o certame (15/11/2026)

Décima primeira etapa (S11), a primeira da contratação. Nova ação do rito
`pede: 'disputa'`, com `disputa: { perfil: 'cotacao' | 'dispensa' }`
(destino autos, partes veem). As opções da ação, para condições e saídas,
são `Homologada`, `Deserta` e `Fracassada`; ela se cumpre com o resultado
do certame (etapa S13), e `marcarAcao` recusa marcá-la à mão. Lógica pura em
`shared/certames.ts` (espelho `src/lib/certames.js`); servidor em
`secretaria/certames.ts`.

- **Certame** em `secCertames/{id}` (fora do processo, porque o fornecedor
  não é parte; regras do Firestore fecham a coleção e as subcoleções):
  aviso (`objeto, criterio, unidade_disputa, itens, intervalo,
  orcamento_sigiloso, abertura_data, abertura_hora, lances, horas_lances,
  condicoes, habilitacao`), `perfil`, `situacao` (rascunho, publicado,
  cancelado; em_disputa e encerrado nas etapas seguintes), `codigo` (8
  letras, para o link `/Disputas?c=`), `abertura_em` (UTC), `convites`
  (nome, e-mail, hash do token), `convites_hashes`, `fornecedores_uids`,
  `propostas_n`, `adiamentos`, `cancelado`. O processo guarda só o resumo em
  `certame` (`id, situacao, perfil, fase_id, acao_idx, abertura_em, codigo`),
  que a tela usa.
- **Ações do órgão** `certame*` em `secretariaProcesso`: `certameLer`
  (quem vê o processo), `certameSalvar`, `certamePublicar`, `certameAdiar`,
  `certameCancelar`, `certameConvidar`, `certameRevogarConvite` e
  `certamePropostas` (quem tem o processo; montar e publicar também exige
  poder cumprir a ação, se o rito a reserva). Publicar confere
  `problemasParaPublicar`: objeto, ao menos um item, preço de referência no
  maior desconto e abertura a partir de `aberturaMinima` (3 dias úteis na
  dispensa, IN 67/2021, art. 6º, parágrafo único; 1 na cotação), em dia
  útil e entre 8h e 18h. Publicação, adiamento (só para depois) e
  cancelamento são movimentos nos autos (`disputa_publicada`,
  `disputa_adiada`, `disputa_cancelada`); descartar o rascunho não deixa
  rastro. Convite só depois de publicar e antes da abertura (token por
  e-mail, válido por 60 dias).
- **Ações do fornecedor** `disputa*` em `secretariaPortal` (qualquer conta
  autenticada): `disputaMinhas`, `disputaAviso` (por id ou código; a
  cotação só para convidados), `disputaConvite`, `disputaParticipar` (só
  dispensa), `disputaProposta` e `disputaRetirar` (só antes da abertura).
  A proposta fica em `secCertames/{id}/propostas/{uid}`, com o cadastro
  (`sanitizeLicitante`: razão social, CNPJ ou CPF com dígitos, porte) e os
  itens (`sanitizeProposta`: valor com até 4 casas, percentual no maior
  desconto, lote inteiro ou nada, item exclusivo só para ME/EPP,
  declarações obrigatórias e a de ME/EPP para quem se declara). O cadastro
  fica em `secPortalAcessos/{uid}.fornecedor` para a próxima disputa;
  `participantes/{uid}` guarda o e-mail para os avisos.
- **Sigilo:** ninguém do órgão lê as propostas antes de `abertura_em`; a
  leitura mostra só `propostas_n`. Depois da abertura, sem lances,
  `certamePropostas` classifica cada item ou lote (empate: quem enviou
  antes, IN 67/2021, art. 12, § 1º). Com lances, a abertura é da sala de
  lances (abaixo). O orçamento sigiloso não sai no aviso nem para o
  fornecedor.
- Auditoria: `SECRETARIA_SESSAO_DISPUTA_CRIADA`, `_PUBLICADA`, `_ADIADA`,
  `_CANCELADA`.
- Tela: botão "Montar a disputa" na ação (`DisputaPrecos.jsx`); página
  pública `Disputas` (`pages/Disputas.jsx`) para o fornecedor, com o
  `Entrar` do portal. Editor do rito com o tipo de disputa, guia do rito e
  glossário `disputa_precos`. Testes: `functions-v2/test/certames.test.js` e
  `src/lib/certames.test.js`.

### Sala de lances (15/11/2026)

Etapa S12. Na disputa com lances (a dispensa sempre; a cotação privada, se
o aviso pedir), a sala abre em `abertura_em` e fecha sozinha em
`abertura_em + horas_lances` (`fimDosLances`), sem prorrogação (IN 67/2021,
art. 11). O relógio é só o do servidor: cada resposta traz `agora`, a tela
corrige a contagem pela diferença, e o lance que chega depois do fim é
recusado. `momentoDaDisputa` diz se a disputa publicada está em
`propostas`, `lances` ou `encerrada`.

- **Estado:** `secCertames/{id}/sala/estado` guarda, por item ou lote, as
  posições em ordem (`Posicao`: o último lance válido do licitante ou, sem
  lance, a proposta), o contador `seq`, os apelidos ("Licitante n", pela
  ordem de envio da proposta), o último lance de cada um e quem já desfez.
  Monta-se das propostas no primeiro acesso depois da abertura. Cada lance
  fica em `lances/{id}` e nunca se apaga: a exclusão só marca `excluido`.
  Todo lance passa por uma transação sobre o estado, então entram um de
  cada vez, com número de ordem.
- **Lance** (`disputaLance`, portal): só de quem cotou o item ou lote; melhor
  que o seu último (menor preço ou maior desconto), respeitado o intervalo
  mínimo (percentual sobre o último, ou em reais; no desconto, pontos
  percentuais); não precisa vencer o melhor (lance intermediário, Lei
  14.133/2021, art. 56, § 3º). O valor é o unitário no item por menor preço
  (classifica quantidade x unitário), o global no lote e o percentual no
  desconto. Três segundos entre lances do mesmo licitante; `envio` torna o
  reenvio idempotente. Empate: quem chegou antes ao valor (IN 67/2021, art.
  12, § 1º).
- **Desfazer** (`disputaDesfazer`): o último lance, uma vez por item ou lote,
  em até 15 segundos (IN 73/2022, art. 21, § 3º). O licitante volta ao
  lance anterior ou à proposta.
- **Órgão** (`certameSala`, `certameExcluirLance`, `certameMensagem`): vê as
  posições e os lances por apelido; os nomes só depois do fim. Quem tem o
  processo exclui, com motivo, o lance que compromete a disputa, e todos na
  sala recebem o aviso automático (IN 73/2022, art. 21, § 4º); auditoria
  `SECRETARIA_SESSAO_LANCE_EXCLUIDO`. Mensagens: o órgão escreve a todos; o
  licitante escreve ao órgão, e os outros licitantes não veem.
- **Fim:** `certamePropostas` dá a classificação final, com nomes e a marca
  "por lance"; na primeira leitura depois do fim, registra nos autos
  `disputa_lances_encerrados` com o melhor valor de cada item ou lote (sem
  nomes: o julgamento os dá, na S13).
- Tela: `SalaLances.jsx` (`SalaLancesFornecedor` na página `Disputas`,
  `SalaLancesOrgao` na janela da disputa), com consulta a cada 3 ou 4
  segundos durante os lances.

### Julgamento da disputa e resultado (15/11/2026)

Etapa S13. Depois dos lances (ou da abertura, sem lances), cada item ou
lote é julgado; com tudo decidido, o órgão declara o vencedor, corre o
recurso e o resultado cumpre a ação do rito. Lógica pura em
`shared/certames.ts` (seção S13); servidor em
`secretaria/julgamentoDisputa.ts`; estado em
`secCertames/{id}/sala/julgamento` (`Julgamento`: etapa, unidades,
licitantes com nome, documento, porte e apelido, recurso, rodadas
anteriores, resultado e ata).

- **Abertura:** `certameJulgamento` (órgão) monta o julgamento na primeira
  leitura de quem tem o processo: as posições finais da sala (ou as
  propostas, sem lances) viram a `ordem` de cada unidade, com o porte de
  cada licitante. Com lances, o encerramento vai aos autos antes, como na
  classificação (`disputa_lances_encerrados`, uma vez só). Item sem
  proposta fica `deserta`.
- **Empate ficto** (LC 123/2006, arts. 44 e 45): se a primeira não é ME/EPP
  e há ME/EPP a até 5% dela (`candidatosDoDesempate`; no desconto, compara o
  preço equivalente, 100 menos o desconto), a unidade fica em `desempate`.
  `certameDesempate` convoca a próxima candidata por 5 minutos; ela cobre
  com `disputaDesempate` (oferta melhor que a primeira: passa à frente) ou
  declina. Vencido o prazo ou recusado, a unidade convoca a seguinte; sem
  candidata, a primeira vai à análise. A unidade espera o prazo da
  convocada antes de chamar outra.
- **Análise:** `certameNegociar` abre negociação com quem está na vez (a
  contraproposta vai à conversa e por e-mail) e o licitante responde com
  `disputaNegociar` (oferta melhor que a sua atual). `certameConvocar` pede
  a proposta ajustada ou os documentos de habilitação com prazo de 2 a 72
  horas; o licitante envia até 10 arquivos (PDF, DOCX, PNG ou JPG, até
  50 MB, pela área de espera do Storage) com `disputaEnviarArquivo`, gravados pela função em
  `secretaria/{org}/certames/{id}/{uid}/` (as regras do Storage não mudam:
  ninguém lê direto), e o órgão baixa com `certameArquivo`.
- **Decisão por unidade:** `certameAceitar` (proposta aceita) e
  `certameHabilitar` (vencedor habilitado). `certameRecusar` recusa a
  proposta ou inabilita, com motivo de ao menos 10 letras, e põe na vez o
  próximo classificado; sem outro, a unidade fracassa. `certameReabrir`
  (com motivo) volta um licitante à análise, para o recurso provido ou o
  erro corrigido antes da declaração. Auditoria
  `SECRETARIA_SESSAO_PROPOSTA_RECUSADA` e `SECRETARIA_SESSAO_JULGAMENTO_REABERTO`.
- **Vencedor e recurso** (Lei 14.133/2021, art. 165): `certameDeclarar`
  exige todas as unidades decididas e abre a intenção de recurso por 10 a 60
  minutos; vai aos autos (`disputa_vencedor_declarado`) com o vencedor de
  cada unidade e os prazos, e a todos por e-mail. A partir daí os nomes são
  públicos aos licitantes. `disputaIntencao` (uma por licitante, com
  síntese), `disputaRazoes` (de quem manifestou, até 3 dias úteis) e
  `disputaContrarrazoes` (de qualquer licitante, até 3 dias úteis depois das
  razões). `momentoDoRecurso` diz o ponto: intenção, razões, contrarrazões,
  decisão ou sem recurso; sem intenção no prazo, segue ao resultado. Sem
  razões no prazo, decide-se já. `certameDecidirRecurso` (negado, provido ou
  provido em parte, com fundamentos de ao menos 20 letras) vai aos autos
  (`disputa_recurso_decidido`); provido, o julgamento volta e o vencedor é
  declarado de novo (nova rodada; as anteriores ficam na ata).
- **Resultado:** `certameResultado` (Homologada se há vencedor em ao menos
  uma unidade, Deserta se ninguém propôs, Fracassada nos demais casos) põe
  nos autos a ata (`textoDaAta`: classificação de cada unidade, desempate,
  negociação, recusas com motivo, rodadas de recurso e resultado), encerra o
  certame (`situacao: 'encerrado'`, conversa fechada) e cumpre a ação pelo
  mesmo caminho do julgamento da sessão (`registrarResultadoDaDisputa`, que
  chama `marcarAcao`): a certidão leva o resultado e o resumo, a resposta
  decide as saídas e o avanço automático corre. O processo guarda o certame
  em `ultimo_certame` e libera `certame` para outra ação de disputa.
  `marcarAcao` à mão segue recusado enquanto não houver resultado.
- **Conversa:** a conversa da sala segue aberta durante o julgamento
  (também na disputa sem lances) e fecha com o resultado. Cada ato do órgão
  deixa aviso a todos; os atos dos licitantes (oferta de desempate, nova
  oferta, arquivo, intenção) deixam aviso do sistema, por apelido até a
  declaração.
- Tela: `JulgamentoDisputa.jsx` (`JulgamentoOrgao` na janela da disputa,
  depois da sala; `JulgamentoFornecedor` na página `Disputas`), com
  consulta a cada 8 ou 5 segundos até o resultado.
  ponytail: não refaz o empate ficto quando a primeira é recusada; se for
  preciso, chamar `abrirUnidade` de novo em `certameRecusar`.

### Equipe da disputa e observador (16/11/2026)

Perfis da disputa (S14), sobre o certame das etapas S11 a S13. Sem equipe
designada, nada muda: todo ato do órgão é de quem tem o processo.

- **Designação:** `certameEquipe` (quem tem o processo, do rascunho até o
  resultado) grava em `secCertames/{id}` a `equipe` (`agente`, `apoio` com
  até 10 pessoas, `autoridade`, cada um `{uid, nome}`) e `equipe_uids`, e no
  processo `certame.equipe_uids`. Confere que cada pessoa é membro ativo do
  órgão (`userOrganizations`) e não é parte no processo, e recusa autoridade
  igual ao agente (segregação de funções, Lei 14.133/2021, art. 7º, § 1º).
  Vai aos autos (`disputa_equipe`, com `textoDaEquipe`), à auditoria
  (`SECRETARIA_SESSAO_EQUIPE_DESIGNADA`) e avisa os novos membros pelo sino
  e por e-mail (`notificarPessoas`, subtipo `disputa`). Sem ninguém, desfaz
  a designação.
- **Quem faz o quê:** `podeNaDisputa(equipe, uid, posse, ato)` em
  `shared/certames.ts`. `conduzir` (excluir lance, desempate, negociação,
  convocação, aceitar, recusar, habilitar, reabrir, declarar o vencedor,
  decidir o recurso): o agente, ou quem tem o processo sem agente.
  `conversar` (mensagens da sala e do julgamento): quem conduz e a equipe de
  apoio. `homologar` (resultado e recurso encaminhado): a autoridade, ou quem
  conduz sem autoridade. `exigirAto` (`salaLances.ts`) confere no servidor e
  diz de quem é o ato; as telas usam `pode` de `certameLer`, `certameSala` e
  `certameJulgamento`.
- **Leitura dos autos:** `lerProcesso(..., { equipe: true })` (e o caminho
  do julgador em `obter`) aceita quem está em `certame.equipe_uids` enquanto
  a disputa é a do processo (`equipeLe` em `context.ts`); depois do
  resultado, o certame vira `ultimo_certame` e a leitura acaba. Lê como o
  julgador: só juntados, sem restritos, cada leitura registrada (em nome da
  "Disputa de preços"). `obter` devolve `leitura_equipe`.
- **Minhas disputas:** `certameMinhas` lista os certames em rascunho ou
  publicados em que a pessoa compõe a equipe (`equipe_uids array-contains`,
  órgão filtrado na função, sem índice composto), com os papéis.
- **Recurso em duas instâncias:** com autoridade designada, "negar
  provimento" do agente vira encaminhamento (`recurso.encaminhado`,
  `disputa_recurso_encaminhado`, `SECRETARIA_SESSAO_RECURSO_ENCAMINHADO`;
  Lei 14.133/2021, art. 165, § 2º); `momentoDoRecurso` passa a
  `autoridade` e só a autoridade decide (`certameDecidirRecurso`). Dar
  provimento, no todo ou em parte, é a reconsideração e refaz o julgamento
  como antes. A ata registra as duas manifestações.
- **Observador:** `podeObservar` deixa, na dispensa (aviso público), qualquer
  conta acompanhar `disputaSala` e `disputaJulgamento` depois da abertura,
  com `observador: true`, sem apelido próprio e sem ações (melhor lance,
  avisos do agente, julgamento, recurso e ata; nomes só depois da
  declaração). Na cotação privada, só quem participa.

### Tutorial do Guia do rito (16/11/2026)

O Guia do rito abre em duas abas: **Tutorial** e **Referência (20
partes)**. O tutorial (`components/secretaria/TutorialRito.jsx`, carregado
só quando o guia abre; textos e lógica em `src/lib/tutorialRito.js`) tem:

- **Passo a passo:** 12 etapas (planejar; preparar unidades, atribuições,
  colegiados, listas e calendário; escolher por onde começar; fases; ações;
  caminhos; quem cumpre e vê; automação; partes e contraditório; documentos
  e autos; tipo de processo; testar, implantar e manter). Cada etapa tem o
  objetivo, o que fazer em ordem, perguntas e respostas da etapa e o que
  conferir (caixas que ficam marcadas enquanto o guia está aberto).
- **Quero fazer…:** 60 receitas "quero isto, use aquilo", com onde fica a
  opção e os modelos da biblioteca que já fazem assim. Busca sem acento e
  filtro por tema.
- **Qual modelo usar?:** assunto, contraditório (o modelo espera resposta da
  parte), forma de decidir (uma pessoa, colegiado, disputa, audiência) e
  tamanho indicam os modelos (`sugerirModelos`). Se nenhum atende a tudo,
  solta o tamanho, depois o contraditório, depois a forma de decidir, e a
  tela diz o que soltou.

"Ver no guia: parte N" troca para a Referência, abre a parte e leva o foco a
ela. O teste (`src/lib/tutorialRito.test.js`) confere que toda parte citada
existe (1 a 20) e todo modelo citado existe na biblioteca: renumerar partes
ou trocar o id de um modelo exige ajustar o tutorial.

### Modelos da plataforma, do órgão e pacote para outro órgão (16/11/2026)

Princípio: modelos e padrões são da plataforma e ficam no código
(`src/lib/bibliotecaRitos.js`, `src/lib/modelos/*.js`, `ritoConsultas` em
`src/lib/secretariaRito.js`); nenhum órgão os altera. "Usar" copia o modelo
para o rito do órgão (`aplicarPropostaRito`, coleção `secRitos` com
`organization_id`), e a cópia não muda quando a plataforma atualiza o modelo.
Toda ferramenta que os modelos usam (`pede` julgamento, disputa, audiência,
comunicação, resposta, formulário, documento, registro; andamento automático,
permissões, certidão conjunta) é opção do editor e vale em qualquer rito.

- **Exportar rito:** `secretariaConfig` ação `exportarRito { rito_id }`, só
  administração do PE. Monta o pacote em `shared/pacoteRito.ts`
  (`pacoteDoRito`, testado em `test/pacoteRito.test.js`): `{ formato:
  'sigo-pacote', versao: 1, conteudo: 'rito', rito, unidades, modelos,
  paginas, tipo, avisos }`. O rito é relido por `sanitizeRito` (só campos
  conhecidos). Unidades, modelos e páginas próprias viram referências locais
  (`u1`, `m1`, `p1`) com o nome; modelo do editor leva o texto, modelo
  original só o nome (com aviso). O tipo é o que usa o rito (o ativo
  primeiro): nome, sigla, descrição, formulário e sigilo. Não vão ids do
  órgão, `organization_id`, autor, e-mails nem processos. Auditoria
  `SECRETARIA_RITO_EXPORTADO`.
- **Importar rito:** em Ritos, "Importar de outro órgão", ou o .json em
  Novo rito. `src/lib/pacoteModelos.js` (`lerPacote`, `propostaDePacote`)
  casa unidade (nome ou sigla), modelo (nome, do órgão ou da unidade) e
  página (nome) com as do órgão; o que falta vira novo (`+N`). Página que
  não existe: a regra de andamento sai, a ação e o campo da ação ficam para
  escolher (pendência grave), e o campo do tipo sai, com aviso. A revisão é
  a de sempre; implantar usa `aplicarPropostaRito`, que agora aceita
  `conteudo` e `descricao` nos modelos novos (saneados por `sanitizeDoc`,
  até 900 mil caracteres cada e 6 milhões no total) e troca `+N` também no
  "modelo indicado" dos documentos exigidos (da fase e da ação).
- **Modelo de documento:** em Documentos, "Exportar para outro órgão" (só
  modelo do editor) baixa `{ conteudo: 'documento', modelo: { nome,
  tipo_documento, descricao, conteudo } }`; "Importar de arquivo" aceita o
  .json e abre o editor; salvar passa por `salvarModelo`.
- O que vem de fora vira do órgão que importou: mudanças de um lado não
  afetam o outro.

### Relatório do colegiado, guia da secretaria e modelos com sessão (16/11/2026)

Etapa S15, sobre as sessões das etapas S1 a S10 e a disputa de S11 a S14.
Nada muda no que já existe; o relatório só lê.

- **Relatório:** `sessaoRelatorio { orgao_id, de, ate }` (aba Sessões, seção
  "Relatório do colegiado"). Vê quem vê as sessões do colegiado
  (`veSessoes`: secretaria, lotados e quem o compõe hoje). Período de até um
  ano (`MAX_DIAS_RELATORIO`), pela data da sessão, sem rascunhos. Lê as
  sessões do órgão, a subcoleção `votacoes` de cada sessão de julgamento não
  cancelada e o `acordao` dos processos julgados (vale o da sessão em que o
  processo foi julgado). A conta é pura, `relatorioDoColegiado` em
  `shared/sessoes.ts`, com teste: sessões realizadas, por realizar,
  canceladas e reuniões; julgados por resultado e por relator; itens
  pautados, retirados, adiados, convertidos em diligência, destacados e com
  pedido de vista; vistas ainda não devolvidas, atrasadas quando o prazo
  passou; acórdãos juntados, tempo médio em dias corridos da proclamação à
  juntada, quantos no prazo, pendentes e atrasados. A lista dos julgados
  baixa em CSV ou Excel (`COLUNAS_RELATORIO` em `src/lib/sessoes.js`, com as
  exportações de `jurimetriaExport.js`). Processo sob sigilo aparece só pelo
  número, como na pauta.
- **Guia da secretaria:** `passosDoColegiado` (`src/lib/sessoes.js`) confere,
  para cada colegiado que a pessoa gere, os passos: composição com
  presidente, unidade do colegiado, primeira sessão, processos na pauta,
  pauta publicada e sessão realizada. `sessaoListar` passa a mandar, só a
  quem gere, `membros` e `presidente` (composição de hoje) e `unidades`. O
  guia fica aberto enquanto falta algo e diz onde fazer cada passo.
- **Modelos com sessão:** a biblioteca ganha "Recurso administrativo julgado
  por colegiado" (Lei 9.784/1999, arts. 56 a 65, com reconsideração,
  alegações, oitiva prévia do possível agravamento e julgamento em sessão) e
  "Proposta de ato normativo ao conselho" (parecer da comissão, consulta
  pública opcional, relatoria e deliberação), em `modelos/colegiados.js`. A
  revisão de arquivamento do Conselho Superior (MPRS) e a apuração da
  comissão de ética pública passam a usar a ação Julgar em colegiado (a
  vista corre na sessão, sem saída própria). A contratação direta usa a
  disputa na dispensa eletrônica (o resultado decide a saída; deserta ou
  fracassada pede o que fazer) e a compra privada oferece a cotação
  eletrônica entre convidados.
- **Filtro Usa** na biblioteca (`RECURSOS_FILTRO` e `usaRecurso` em
  `bibliotecaFiltro.js`): julgamento em sessão, disputa de preços ou
  audiência e reunião. O teste da biblioteca aceita condição sobre o
  resultado da disputa.

### Reunião deliberativa (15/11/2026)

Nona etapa (S9). A sessão ganha o tipo `reuniao` (`secSessoes`, campo
`tipo`; ausente = julgamento, como antes). A reunião não recebe processos:
`proximaSessao`, `sessaoIncluir` e `sessaoTirar` a ignoram ou recusam.

- **Assuntos** (`assuntos[]` na sessão, `shared/reunioes.ts`): título
  (mínimo de 3 letras), descrição, proponente, `votacao` (nominal,
  simbolica, secreta, sem_votacao; a simbólica não existe na virtual),
  `maioria` (simples, absoluta, dois_tercos), `inclusao` (pauta ou
  extrapauta, esta com motivo), `situacao` (pauta, em_votacao, empate,
  deliberado, retirado, adiado), impedidos, inscritos para a palavra,
  resultado e encaminhamento. Até 60 por reunião. `vem_de` e `levado_para`
  ligam o adiado à reunião que o retoma.
- **Ações** (`secretaria/reunioes.ts`, todas numa transação):
  `reuniaoAssunto` (incluir ou editar, ou trazer adiado de outra reunião),
  `reuniaoTirar` (retirar ou adiar), `reuniaoOrdenar`, `reuniaoPalavra`
  (pedir, desistir, dar e encerrar a fala), `reuniaoImpedimento`,
  `reuniaoAbrir` (uma votação aberta por vez; quórum pela presença, salvo
  regra "livre"), `reuniaoVotar` (a secretaria registra o nominal por outro
  membro), `reuniaoSimbolica` (placar lançado pela mesa), `reuniaoApurar`,
  `reuniaoDesempate` (só quem preside) e `reuniaoEncaminhar`. Auditoria em
  `SECRETARIA_SESSAO_REUNIAO_*` (atos do dia a dia, fora do histórico de
  configuração).
- **Votos** em `secSessoes/{s}/deliberacoes/{assuntoId}`: no nominal,
  `votos` por uid; no secreto, só `votaram[]` e a contagem. O impedimento
  apaga o voto nominal do impedido e é recusado depois do voto secreto.
  `assuntosParaTela` devolve a cada um o seu voto e o que pode fazer; os
  votos nominais de todos só depois da apuração (e para a secretaria,
  durante a votação nominal).
- **Apuração** (`apurar`): sem quórum, unanimidade, maioria simples (empate
  vai ao presidente ou rejeita), absoluta e dois terços com o mínimo
  escrito no texto; só abstenções rejeitam. **Encerrar** (`fecharReuniao`
  em `encerrarSessao`): na virtual apura o que ficou aberto, e empate ou sem
  quórum viram `adiado`; na síncrona o que não foi deliberado vira adiado.
- **Regras do colegiado** (`pauta.quorum`: maioria, um_terco, dois_tercos,
  livre; `pauta.desempate`: presidente ou rejeita), em Órgãos. Ausentes =
  maioria e presidente.
- **Convocação, painel e ata**: publicar exige ao menos um assunto e avisa a
  composição; o painel mostra a contagem, quem está com a palavra e o
  resultado; a ata usa `textoDaAtaReuniao`. Tela em
  `components/secretaria/Reuniao.jsx`. Guia do rito, termo "Reunião
  deliberativa"; glossário `reuniao`. Testes:
  `functions-v2/test/reunioes.test.js`.

### Ata, painel ao vivo e avisos (15/11/2026)

Oitava etapa (S8). O dia da sessão ganha presença, chamada do processo e
um painel que se atualiza sozinho; ao encerrar, o sistema lavra a ata.

- **Painel** (`secPaineis/{sessaoId}`, `secretaria/painelAta.ts`):
  documento só de leitura, refeito por `atualizarPainel` depois de toda
  ação de sessão que não seja de leitura (invólucro `acaoSessao`), do
  pedido da parte no portal e do encerramento. Guarda título, modo, data,
  situação, `em_julgamento` e, por item, ordem, número, assunto (ou
  "Processo sob sigilo" se restrito), relator, situação, quantos votaram e,
  só depois da proclamação, o resultado. Nunca guarda conteúdo de voto.
  `leitores` = composição do dia e lotados nas unidades do colegiado; quem
  abre a sessão e ainda não está na lista é incluído. Regra no
  `firestore.rules`: lê quem está em `leitores`, ninguém escreve. O
  cliente escuta o documento e, a cada `versao` nova, recarrega a sessão e
  a votação.
- **Presença** (`sessaoPresenca`): a secretaria marca, na síncrona
  publicada, do dia dela até o encerramento; fica em `presencas` (mapa de
  uid). **Chamar** (`sessaoChamar`): presidente ou secretaria põem o
  processo `em_julgamento` (ou tiram).
- **Encerrar a síncrona** (`sessaoEncerrar`, agora para os dois modos):
  presidente ou secretaria, no dia ou depois. `encerrarSessao` adia o que
  não foi julgado (motivo "não foi julgado na sessão", vai à próxima com
  os votos), marca `encerrada`, limpa `em_julgamento` e lavra a ata. A
  virtual continua pela rotina das 7h, pelo mesmo caminho.
- **Ata** (`s.ata`, `textoDaAta` em `shared/sessoes.ts`): abertura com
  presidente e presença (na virtual, quem votou; sem marcação, a
  composição do dia com a ressalva), ordem do dia com o desfecho de cada
  processo (proclamado e redator, vista e prazo, adiado, retirado,
  diligência, destacado), sustentações e encerramento; SHA-256 do texto.
  `sessaoAta`: a secretaria ajusta o texto ou refaz com os dados, até a
  primeira assinatura. `sessaoAtaAssinar {papel}`: presidente (quem
  preside) e secretaria, pessoas diferentes; em transação. Auditoria
  `SECRETARIA_SESSAO_ATA` e `SECRETARIA_SESSAO_ATA_ASSINADA`. A tela
  imprime a ata com as assinaturas e o hash.
- **Avisos** (`avisarComposicao`, subtipo `sessao`, entity_type
  `sessao_julgamento`, link `?aba=sessoes&sessao=`): pauta publicada e
  sessão cancelada, para a composição menos o autor. `lembrarSessoes`, na
  rotina das 7h: véspera da sessão, abertura da virtual e último dia (só a
  quem ainda deve voto); `lembrado_em` evita repetir no mesmo dia.
- **Agenda**: `icsDaSessao` (`src/lib/sessoes.js`) gera o .ics no
  navegador (virtual como dia inteiro; síncrona com duas horas). Botão
  "Adicionar à agenda" na sessão e no portal das partes.
- Telas: `components/secretaria/PainelSessao.jsx` (painel em tela cheia,
  presença, ata), integrado em `Sessoes.jsx`. Glossário `ata_sessao`. Guia
  do rito, parte das sessões.
- Testes: `functions-v2/test/sessoes.test.js` (ata) e
  `src/lib/sessoes.test.js` (.ics).

### Sessão virtual, destaque, sustentação oral e preferência (15/11/2026)

Sétima etapa (S7). A sessão pode ser virtual assíncrona, como o Plenário
Virtual do STF e a Res. CNJ 591/2024, e as partes fazem pelo portal os
pedidos que cabem para o julgamento.

- **Sessão virtual:** `modo: 'assincrona'` com `fim` (o último dia da
  votação; `data` é o primeiro e `hora`, a abertura). Até 30 dias
  (`MAX_DIAS_VIRTUAL`); sem local, link opcional. `encerra_em` (= `fim`)
  marca a sessão para a rotina diária; sai no cancelamento e no
  encerramento. Publicada, `fim` não muda (como data e hora). Processo
  pautado guarda `sessao.fim`.
- **Votação:** `votacaoAberta(s, hoje)` (na virtual, do primeiro ao último
  dia; nas outras, como antes). Fora dela, não se vota nem se pede vista. O
  relator libera o voto antes do início. A proclamação manual, na virtual,
  só depois do fim (`virtualEncerrou`).
- **Encerramento:** `encerrarSessao` (em `secretaria/votacao.ts`), com o
  contexto do sistema ("Sistema (fim da sessão virtual)"): para cada
  processo pautado e não proclamado, proclama pela regra do rito
  (`sessaoProclamar`); se não der (sem o voto do relator, sem quórum),
  adia para a sessão seguinte, com o motivo (`sessaoAdiar`). Depois,
  `situacao: 'encerrada'` e `encerrada_em`. Roda na rotina das 7h
  (`secretariaAlertaPrazos` chama `encerrarSessoesVirtuais`, que procura
  `encerra_em < hoje`, só um campo, sem índice composto) e pela ação
  `sessaoEncerrar` (presidente ou secretaria, depois do fim).
- **Destaque:** `sessaoDestacar` (membro que vota no dia, até o fim da
  votação, antes da proclamação). O item fica `destacado`, o processo
  recebe a certidão `destaque` e vai para a próxima sessão **síncrona** do
  colegiado (`proximaSessao(..., sincrona = true)`), com
  `julgamento_em_curso.so_relator`: o relator continua, com o voto de volta
  ao rascunho (`liberado_em: null`), e os votos dos pares não seguem
  (`lerContinuacao` e `continuar` aplicam a regra). Pedido pela parte, o
  relator decide (sem relator, o presidente ou a secretaria).
- **Pedidos das partes:** `secSessoes/{s}/pedidos/{id}` `{processo_id,
  tipo, uid, parte, texto, link, em, situacao, decidido_por, motivo}`. Tipos
  (`TIPOS_PEDIDO`): sustentação oral (na virtual, link https da gravação),
  preferência, destaque (com o porquê) e esclarecimento de fato (durante a
  votação virtual, até três). Prazos (`problemaDoPedido`): na virtual,
  sustentação e destaque até dois dias antes do início, preferência até o
  início; na síncrona, sustentação e preferência até o dia da sessão. Um de
  cada por conta, salvo indeferido. Portal: ação `pedidoSessao`; `obter`
  devolve `sessao.pode_pedir` e `sessao.meus_pedidos`.
- **Decisão:** `sessaoPedidoDecidir {pedido_id, deferir, motivo}`. Destaque
  deferido segue `sessaoDestacar`; indeferir pede motivo, que a parte vê.
  Os demais valem enquanto não indeferidos. Os pedidos ficam fora dos
  autos; vão aos autos o destaque, o adiamento e o julgamento.
- **Ordem do CPC (art. 936):** `ordemDoCPC` (src/lib/sessoes.js) ordena
  sustentação, preferência, julgamento iniciado em sessão anterior
  (`continua`, de `continua_de`) e os demais; o botão chama
  `sessaoOrdenar`.
- **Telas:** marcar sessão com o modo "Virtual assíncrona" (primeiro e
  último dia); cartão e cabeçalho com o período; aviso da votação (abre em,
  aberta até, terminou e "Apurar e encerrar", encerrada); selos dos pedidos
  e "pedidos a decidir" na pauta; botão "Ordem do CPC"; no diálogo
  Julgamento, o aviso do período, a seção "Pedidos das partes" (com a
  gravação, deferir e indeferir) e "Destacar para sessão síncrona"; no
  portal, "Seus pedidos para esta sessão" e o formulário do pedido.
- **Limite:** a sustentação gravada vai por link: o sistema não guarda
  áudio nem vídeo (o Storage só aceita PDF, imagem, texto e documentos de
  escritório, até 50 MB).
- **Glossário:** sessão virtual, destaque e sustentação oral.

### Voto divergente, voto condutor e acórdão (15/11/2026)

Sexta etapa (S6). O julgamento proclamado vira acórdão nos autos, redigido
por quem conduziu o resultado, com os votos vencidos (CPC, arts. 941 e 943 a
944, por analogia).

- **Voto divergente fundamentado:** no voto, `fundamentos` (até 50.000
  caracteres) para quem diverge (voto divergente) ou acompanha com ressalva
  (declaração de voto). Os pares leem na votação. `sanitizeVoto` descarta
  fundamentos de quem só acompanha. O voto agora é trocado inteiro
  (`FieldPath('votos', uid)`), e `divergiu_em` guarda quando o membro passou
  a divergir para aquele resultado (mudar o texto não muda a ordem).
- **Voto condutor e redator:** na proclamação, `votoCondutor` escolhe o
  relator, se venceu, ou quem primeiro divergiu para o resultado
  proclamado; sem divergente (desempate por regra), fica o relator. Vai em
  `proclamado.condutor`. O redator é o autor do voto condutor; o presidente
  ou a secretaria designam outro entre quem votou (`sessaoRedator`) até o
  envio.
- **Prazo:** `orgao.pauta.acordao_dias` (1 a 90; ausente = 30, como no CPC,
  art. 944), na contagem da pauta. Fica em `votacao.acordao.prazo` e em
  `processo.acordao {sessao_id, sessao, colegiado, orgao_id, resultado,
  redator_uid, redator_nome, prazo, pendente, enviado_em, documento_id,
  juntado_em, ordem}`.
- **Redação:** `sessaoAcordao` (só o redator): guarda ementa e acórdão;
  com `enviar`, monta o documento (`documentoDoAcordao`: ementa, acórdão,
  relatório, voto condutor, votos vencidos e declarações de voto, via
  `votosDoAcordao`) e cria a **minuta** "Acórdão: sessão" (tipo Acórdão, da
  unidade que tem o processo, assinada pelo redator, `acordao_sessao_id`).
  O texto sugerido (`modeloDoAcordao`) traz o resultado proclamado e o voto
  condutor.
- **Juntada:** pela unidade, pelo caminho comum de juntar (PDF, folhas,
  código de verificação, exigências do rito). Ao juntar, `processo.acordao`
  fica `pendente: false` com `juntado_em` e `ordem`, e a leitura pela pauta
  acaba (`leituraDeJulgador`). Excluir a minuta devolve ao redator, que
  corrige e envia de novo.
- **Telas:** no Votar, o campo do voto divergente ou da declaração; na
  lista de votos, "Ler o voto divergente"; no diálogo Julgamento, a seção
  Acórdão (voto condutor, redator, situação, designar outro redator,
  editor); na aba Sessões, "Acórdãos que você redige", com prazo; na pauta,
  a situação do acórdão; na capa do processo, "Acórdão a redigir" ou
  "Acórdão para juntar". Em Órgãos, o prazo do acórdão.
- **Sigilo:** relatório, votos e acórdão só chegam às partes com a juntada.
- **Glossário:** acórdão.

### Vista, adiamento e conversão em diligência (15/11/2026)

Quinta etapa (S5). O julgamento pode sair da sessão sem resultado e
continuar em outra, como nos tribunais (CPC, arts. 935, 938 e 940, por
analogia), e tudo vai aos autos.

- **Onde:** ações `sessaoVista`, `sessaoDevolverVista`, `sessaoAdiar` e
  `sessaoDiligencia` (`secretaria/votacao.ts`). Textos das certidões e prazo
  em `shared/sessoes.ts` (`prazoDaVista`, `textoDaVista`, `textoDaDevolucao`,
  `textoDoAdiamento`, `textoDaDiligencia`); movimentos `vista`,
  `vista_devolvida`, `adiamento` e `diligencia`, todos visíveis às partes e
  avisados por e-mail (contam como "prazos e decisões" na preferência).
- **Prazo de vista:** `orgao.pauta.vista_dias` (1 a 90; ausente = 10, como
  no CPC), contado como a antecedência da pauta (dias úteis ou corridos, com
  o calendário do órgão). Edita-se em Órgãos, na "Pauta das sessões".
- **Pedir vista:** quem vota no dia (presidente e titulares), menos o
  relator, depois que o relator liberou o voto e antes da proclamação, com a
  pauta publicada. O item fica `vista` (com `vista.nomes` e `vista.prazo`),
  o processo perde `sessao` e ganha `vista {sessao_id, orgao_id, sessao,
  colegiado, uids, nomes, desde, prazo}` e `julgamento_em_curso {sessao_id,
  manter_votos: true, relator}`. Outro membro pode se juntar no mesmo prazo
  (vista coletiva), sem nova certidão.
- **Devolver:** quem pediu, a qualquer tempo; vencido o prazo, também o
  presidente ou a secretaria ("Requisitar o processo"). O sistema procura a
  próxima sessão ativa do colegiado com vaga (`proximaSessao`): em rascunho,
  o processo entra na pauta; com a pauta publicada, entra em extrapauta com
  o motivo "retorno de vista" e recebe a certidão de inclusão. Sem sessão
  marcada, fica aguardando, e a secretaria o inclui quando marcar. Vencido o
  prazo sem devolução, a secretaria pode incluí-lo direto em outra sessão
  (requisição); antes, `sessaoIncluir` recusa.
- **Adiar:** o presidente ou a secretaria, com motivo (mínimo 5 letras). Item
  `adiado`; o processo segue para a próxima sessão como na devolução, com o
  relator e os votos já dados.
- **Diligência:** o presidente ou a secretaria, dizendo o que fazer (mínimo
  10 letras). Item `diligencia`; o processo volta à unidade com a orientação
  na capa (`orientacao`) e, cumprida a diligência, a secretaria o inclui em
  nova pauta: o relator continua, os votos recomeçam (`manter_votos: false`).
- **Votos que seguem:** ao entrar na nova sessão (`incluirNaSessao`), a
  votação é copiada com `proclamado: null` e `continua_de`; os vogais podem
  mudar o voto até a proclamação. O relator vem junto.
- **Telas:** no diálogo Julgamento, a seção "Vista, adiamento e diligência"
  mostra o estado e os botões de cada papel; na pauta, selos "Pedido de
  vista", "Adiado" e "Convertido em diligência", com o motivo; entre os aptos,
  o aviso de vista (no prazo, bloqueado; vencida, requisição) e de julgamento
  já iniciado; na capa do processo, "Julgamento suspenso por vista".
- **Glossário:** vista.

### Votação na sessão: relator, vogais e proclamação (15/11/2026)

Quarta etapa (S4). Quem vota é o próprio julgador, na conta dele; a equipe
não digita mais os votos quando o colegiado vota pela sessão.

- **Onde:** `secSessoes/{sessao}/votacoes/{processo}` (fechada ao cliente),
  pelas ações `sessaoVotacao`, `sessaoRelator`, `sessaoRelatar`,
  `sessaoVotar` e `sessaoProclamar` (`secretaria/votacao.ts`). Regras puras em
  `shared/sessoes.ts` (`votantes`, `sanitizeVoto`, `votosDaSessao`,
  `placarParcial`); apuração, quórum e desempate seguem `shared/julgamento.ts`.
- **Quem vota:** o presidente e os titulares da composição no dia da sessão.
  O suplente não vota nesta etapa (a convocação no lugar de um titular vem
  depois).
- **Relator:** a secretaria designa na pauta (`ItemPauta.relator_uid`,
  `relator_nome`), entre quem vota. O relator escreve relatório, resultado e
  fundamentos; o rascunho é só dele. Liberar exige pauta publicada, resultado
  e os dois textos; liberado, o voto e a relatoria não mudam mais.
- **Vogais:** depois da liberação, acompanham, acompanham com ressalva
  (texto obrigatório), divergem (outro resultado do rito, síntese opcional)
  ou se declaram impedidos ou suspeitos. O voto muda até a proclamação. Os
  pares e a secretaria veem os votos e o placar; a tela se atualiza sozinha.
- **Proclamação:** o presidente, ou a secretaria que conduz a sessão no
  sistema, no dia da sessão ou depois. Quem não votou fica ausente. O
  servidor monta os votos (relator, presidente, titulares) e confere tudo com
  `dadosDoJulgamento`; grava `proclamado` na votação e em
  `processo.sessao.proclamado`. Em seguida o sistema registra o julgamento na
  ação do rito pelo mesmo caminho de "Registrar julgamento"
  (`registrarJulgamentoDaSessao`, contexto do sistema, autor "Fulano
  (proclamação na sessão)"): certidão de julgamento nos autos, saída da fase
  e avanço automático quando o rito manda. Se não couber (o rito mudou),
  a unidade registra, e o diálogo já vem com os votos proclamados, que o
  servidor impõe.
- **Sigilo:** relatório e voto não vão aos autos nem ao portal nesta etapa;
  o acórdão e os votos vencidos vão aos autos na etapa do acórdão (S6).
- **Pauta:** cada item mostra o relator e a situação ("Aguarda o seu voto",
  "1 de 2 vogais votaram", "Proclamado: Procedente") e o botão Julgamento.
- **Glossário:** relator, vogal e proclamação.

### Leitura dos autos pelo julgador e anotações privadas (15/11/2026)

Terceira etapa (S3), com a decisão do Flavio: o julgador de outra unidade lê
os autos só enquanto o processo está pautado numa sessão do seu colegiado,
até o acórdão, sem os restritos, com cada leitura registrada.

- **Quem:** quem compõe hoje um colegiado ativo (`Contexto.compoe`, de
  `composicaoEm`) e não vê o processo pela lotação. Regra pura em
  `leituraDeJulgador` (`shared/sessoes.ts`): o processo tem `sessao` do
  colegiado; ou, já julgado, tem `ultima_sessao` dele, está em tramitação e
  segue numa unidade do órgão (é ali que o acórdão é feito). Saiu do
  colegiado ou foi arquivado, a leitura acaba.
- **Onde vale:** só nas leituras. `lerProcesso(c, id, tx, { julgador: true })`
  é usado em `obter`, em `baixar` e `pdf` do documento (sem versão anterior)
  e na anotação; todo ato continua exigindo a lotação, e para o julgador o
  processo segue "não encontrado" fora da leitura.
- **O que vê:** documentos juntados; minutas e documentos guardados fora dos
  autos ficam de fora, e o dado reservado segue oculto. Sem exportar os autos
  nem impressão interna. `obter` devolve `leitura_julgador: true`, sem posse.
- **Registro:** cada abertura dos autos e cada documento lido gravam
  `secProcessos/{id}/leituras` (`uid, nome, em, o_que, sessao_id, sessao,
  colegiado`), fora dos autos e da cadeia. `obter` devolve as 50 últimas
  (`leituras`) para quem tem a posse, gere a unidade atual ou administra; a
  capa mostra "Leituras pelos julgadores".
- **Anotações privadas:** `secAnotacoes/{uid}_{processoId}` (fechada ao
  cliente), pela ação `anotacao` (sem `texto` lê; texto vazio apaga; até
  20.000 caracteres). Quem pode ler o processo anota; só o autor lê. Nunca vai
  aos autos, ao portal, à exportação ou à lista da equipe. A pauta marca
  `minha_anotacao` em cada item, e o processo mostra "Minhas anotações".
- **Telas:** aviso de leitura como julgador no processo, número do processo
  clicável na pauta para quem compõe, selo "Sua anotação" na pauta, cartão
  "Minhas anotações" no processo (para todos que o leem), "Leituras pelos
  julgadores" na capa. Quem só compõe o colegiado abre direto na aba Sessões.

### Sessões de julgamento e pauta (15/11/2026)

Segunda etapa (S2). Coleção `secSessoes` (fechada ao cliente), pelas ações
`sessao*` de `secretariaProcesso` (`secretaria/sessoes.ts`); regras puras em
`shared/sessoes.ts`, espelho de tela em `src/lib/sessoes.js`; aba
**Sessões** em `components/secretaria/Sessoes.jsx`.

- **Sessão:** `{ organization_id, orgao_id, tipo: 'julgamento', titulo,
  carater (ordinaria|extraordinaria), modo (presencial|virtual|hibrida), data,
  hora, local, link, observacoes, situacao (rascunho|publicada|cancelada),
  ativa, pauta: ItemPauta[], processos_ids, version }`. Título vazio vira
  "Sessão ordinária de dd/mm/aaaa". Presencial exige local; virtual, link ou
  sala; híbrida, os dois.
- **Item da pauta:** `{ processo_id, numero, assunto, ordem, inclusao
  (pauta|extrapauta|mesa), motivo, situacao (pautado|retirado), incluido_em }`.
  Até 100 processos. Apto (`julgamentoPendente`): em tramitação, numa unidade
  do órgão e com a ação `pede: 'julgamento'` ativa e não feita na fase atual.
  Um processo fica em uma pauta ativa por vez.
- **Quem faz o quê:** a secretaria do colegiado (admin da entidade, admin
  delegado do órgão, gestor de unidade do órgão ou lotado em unidade dele que
  expede) marca, inclui, ordena, publica, retira e cancela (`gereSessoes`).
  Quem está lotado no colegiado e quem o compõe hoje veem as sessões
  publicadas e a pauta (`sessaoListar`, `sessaoObter`); o rascunho é só da
  secretaria. Em processo restrito, quem não vê os autos não vê assunto nem
  partes. Bloqueio por quem não é do colegiado responde "não encontrada".
- **Publicar** (`sessaoPublicar`): confere a antecedência do órgão
  (`Orgao.pauta = { antecedencia 0..60, contagem uteis|corridos }`, ausente =
  0, como antes, com o calendário do órgão) e se cada item segue apto; numa
  só transação, cada processo recebe o movimento `pauta` (Certidão de
  inclusão em pauta, nos autos e visto pelas partes) e o campo `sessao = {
  id, titulo, data, hora, modo, local, link, orgao_id, colegiado, inclusao }`.
  Depois, `avisarPartesDoMovimento` (e-mail, preferência "prazos" inclui).
- **Depois de publicada:** data, hora, modo, local e link não mudam (cancelar
  e marcar outra); observações mudam. Inclusão é extrapauta ou em mesa, com
  motivo (5 letras ou mais), e já certifica. Retirada (`sessaoTirar`) e
  cancelamento (`sessaoCancelar`) pedem motivo, gravam `pauta_retirada` e
  tiram `sessao` do processo. No rascunho, nada vai aos autos.
- **Julgamento registrado** (`marcarAcao` da ação de julgamento): o processo
  troca `sessao` por `ultima_sessao` (com `julgado_em`), e a pauta o mostra
  como julgado.
- **Telas:** aba Sessões (agenda em grupos, filtro por colegiado, marcar
  sessão, detalhe com a ordem do dia arrastável, incluir com busca, publicar
  com confirmação, retirar e cancelar com motivo); selo "Pautado para
  julgamento" no processo, com "Ver a pauta"; cartão "Julgamento marcado" no
  portal; antecedência na edição do órgão colegiado; glossário (pauta,
  extrapauta, em mesa).
- Auditoria: `SECRETARIA_SESSAO_*` (fora do histórico de configuração).
- Testes: `functions-v2/test/sessoes.test.js`, `src/lib/sessoes.test.js`.

### Composição dos colegiados (15/11/2026)

Primeira etapa (S1) do plano de sessões, julgamentos e pregão. O órgão
interno com `decisao: 'colegiada'` ganha `composicao: [{ uid, funcao,
inicio, fim, representa }]`, gravada com o órgão em `secConfig.orgaos`
(`salvarOrgao`). Lógica pura em `shared/orgaos.ts`; espelho em
`src/lib/orgaos.js`.

- **Mandato:** `funcao` presidente, vice, titular ou suplente (inválida vira
  titular); `inicio` e `fim` em AAAA-MM-DD, vazios = desde sempre e sem
  fim; `representa` até 80 caracteres. Até 40 mandatos por órgão, contando
  os encerrados. Sem o campo, `composicao: []` e nada muda.
- **Ao gravar** (`conferirComposicao`): fim antes do início é recusado; a
  mesma pessoa não pode ter dois mandatos que se cruzam; há no máximo um
  presidente e um vice em cada período. Quem tem mandato atual ou futuro
  precisa ser membro ativo da entidade; mandato encerrado de quem saiu fica
  como histórico. A leitura (`orgaosDe`) nunca descarta o órgão por causa da
  composição.
- **Quem compõe na data** (`composicaoEm`): mandatos vigentes, do presidente
  aos suplentes. O organograma mostra quantos membros há hoje.
- **Registro de julgamento:** na unidade de um órgão colegiado com
  composição, o diálogo já vem com o presidente (função presidente) e os
  titulares e o vice (função membro) do dia; suplentes ficam de fora, e
  quem registra indica o relator. Sem composição, segue como antes.
- Testes: `functions-v2/test/orgaos.test.js` e `src/lib/orgaos.test.js`.
  Guia do rito, parte 15.

### Nomes dos polos por tipo de processo (14/11/2026)

`formulario.nomes_polos` no tipo (`{ requerente?, requerido?, interessado?,
terceiro? }`, até 40 caracteres; vazio = o nome de sempre). Saneado em
`shared/camposProcesso.ts` (`nomesPolosDe`); dois polos marcados com o mesmo
nome são recusados.

- O polo gravado na parte continua sendo a chave (`requerido`), e as regras
  (comunicação por polo, retificação) seguem pela chave.
- Na autuação, o processo grava `nomes_polos` do tipo (como `tipo_versao`):
  mudar o tipo depois não renomeia processos já autuados.
- `nomeDoPolo(nomes, polo)` (servidor) e `nomePolo(nomes, polo, padrao)`
  (cliente) dão o nome: certidões de retificação, de comunicação e de
  habilitação, capa impressa, certidão de andamento, tela do processo,
  capa, diálogo de comunicação e portal (`minha_parte.nome_polo`,
  `nome_polo` na lista; "Você participa como Acusado").
- `obter` da equipe e do portal devolvem `processo.nomes_polos`.

### Prorrogação e devolução de prazo (14/11/2026)

Ações `prorrogarPrazo` e `devolverPrazo` (`prazo_id`, `dias`, `motivo`
obrigatório), com quem tem o processo. Lógica pura em
`shared/ajustePrazo.ts`.

- **Prorrogar:** só prazo aberto que ainda não venceu; o novo vencimento é
  o atual somado dos dias, na contagem do prazo (e no calendário do órgão).
- **Devolver:** só prazo aberto já vencido; corre de novo pelos dias, a
  contar de hoje.
- O prazo guarda `ajustes[]` (`tipo, dias, de, para, motivo, em, por`), até
  10. Movimento `prazo_prorrogado` ou `prazo_devolvido`, com certidão nos
  autos quando é prazo de resposta de comunicação; prazo interno automático
  vai às informações; os demais seguem o registro de atos da fase.
- **Comunicação ligada** (`comunicacoes[].prazo_id`): acompanha o novo
  `vence_em`. Na devolução, se ainda sem resposta, perde o
  `decurso_certificado` e, sendo da rodada atual, a ação de resposta que o
  rito dera por cumprida volta a esperar (`acoes_feitas`/`acoes_respostas`);
  a rotina diária certifica de novo se o prazo devolvido também decorrer.
  Se a fase já saiu, só o prazo muda: voltar a fase é decisão da equipe.
- Tela: botões Prorrogar (antes do vencimento) e Devolver (depois) em cada
  prazo aberto. Portal: avisos e ícones dos dois movimentos.
- Testes: `functions-v2/test/ajustePrazo.test.js`.

### Biblioteca de modelos de processo (14/11/2026)

Em **Novo rito**, a seção **Biblioteca de modelos de processo** traz processos completos, organizados por área e porte (curto, médio ou longo) e montados a partir da lei de cada área. As áreas são:

- administrativo geral;
- correcional e disciplinar;
- ética e conselhos profissionais;
- sancionador e fiscalização;
- contratações e contratos;
- atendimento, ouvidoria e transparência;
- gestão de pessoas;
- controle e contas;
- Ministério Público (extrajudicial, não penal).

Nenhum modelo é penal. O catálogo completo, com descrição, quando usar, base legal, partes e fases de cada modelo, está em [MODELOS_DE_RITO.md](MODELOS_DE_RITO.md).

- **Filtros:** área, porte e busca por palavra ou lei. A busca ignora acentos.
- **Usar este modelo:** abre a revisão de sempre. As unidades do modelo têm nomes genéricos e são casadas pelo nome com as do órgão, ou a revisão propõe criá-las. Nada é criado antes de implantar.
- **Tipo de processo:** se o modelo tem partes, a revisão propõe criar o tipo já com os polos, os nomes deles e a descrição do modelo. O servidor confere esse formulário com a mesma regra do cadastro de tipo (`sanitizeFormulario`) e grava o tipo com ele. Desmarcar cria só o rito.
- **Código:**
  - Os modelos ficam em `src/lib/modelos/<área>.js`, escritos com `src/lib/modelos/dsl.js`. Nessa linguagem, fases e ações se citam pelo nome, e `montar` troca os nomes por ids e índices.
  - `src/lib/bibliotecaRitos.js` junta os modelos.
  - A tela é `BibliotecaModelos.jsx`.
- **Conferência automática:** em `src/lib/bibliotecaRitos.test.js` e `functions-v2/test/bibliotecaRitos.test.js`. Cobre o fluxo, as condições, as esperas, o diagrama, a aceitação pelo servidor sem perda de configuração, os metadados, a ausência de conteúdo penal e o tipo de cada modelo. O e2e abre cada modelo na tela e confere que nenhum chega com pendência que impeça implantar.
- **Guia do rito:** nova parte "16. Começar de um modelo da biblioteca".

### Biblioteca com 48 modelos, em grupos, com filtro, ordem e busca (15/11/2026)

A biblioteca passou de 28 para 48 modelos. Os 20 novos seguem o rito de uma instituição:

- **OAB/RS:** processo disciplinar no TED, revisão de processo disciplinar e reabilitação.
- **CAU:** processo ético-disciplinar e fiscalização do exercício profissional.
- **CNMP e MPRS:**
  - compromisso de ajustamento de conduta;
  - recomendação;
  - audiência pública;
  - revisão de arquivamento pelo Conselho Superior;
  - destinação de bens e valores;
  - cadastramento de entidade;
  - triagem de representação sobre patrimônio público;
  - correição e inspeção em Promotoria.
- **AGU** (área nova, Advocacia pública e consultoria): mediação e conciliação na CCAF, acordo para prevenir ou encerrar litígio, e cobrança administrativa com inscrição em dívida ativa de crédito não tributário.
- **CGU:** acordo de leniência, sindicância patrimonial, juízo de admissibilidade correcional e processo disciplinar de empregado público.

Cada modelo tem agora `referencia`, a instituição ou lei de inspiração. Ela aparece como etiqueta e serve de filtro.

A seção (`BibliotecaModelos.jsx`) foi refeita para não virar uma lista enorme:

- **Abre e fecha pelo título.** O navegador lembra a escolha (`localStorage`, só conveniência). Fechada, mostra as áreas com a contagem, e clicar numa área abre a seção já filtrada.
- **Grupos por área.** Cada grupo abre e fecha e mostra a contagem e os nomes. Sem filtro, os grupos ficam fechados. Com filtro ou busca, os grupos com resultado abrem. Há também **Abrir todas as áreas** e **Recolher todas as áreas**.
- **Busca.** Procura no nome, na referência, na base, nas fases, no quando usar e na descrição. Ignora acentos, exige todos os termos, marca o termo achado e ordena pela relevância (o nome pesa mais).
- **Filtros:** área, porte e **Inspirado em**. O contador de resultados é anunciado ao leitor de tela, e **Limpar filtros** volta tudo.
- **Ordem:** por área, por relevância, por nome, ou pelo tamanho (porte e número de fases, nos dois sentidos). Fora da ordem por área, cada modelo mostra a sua área.
- **Linha compacta.** Mostra o nome, o porte e as fases, a referência e as partes, com a descrição em duas linhas. Clicar no nome abre a descrição inteira, quando usar, a base, as partes, o que o rito faz (comunicações, esperas, audiências, documentos, formulários, saídas, sigilo) e as fases com prazo, contagem, unidade e marca de fase final.

A lógica pura fica em `src/lib/bibliotecaFiltro.js` e tem teste. O mesmo resumo do que o rito faz gera o catálogo `docs/MODELOS_DE_RITO.md`.

### Guia do rito para todos (15/11/2026)

O Guia do rito (`GuiaRito.jsx`) não fica só no editor de rito. Ele também aparece:

- no alto da tela do Processo Eletrônico, ao lado da Ajuda, para quem usa o módulo;
- na Central de Ajuda, seção Processo Eletrônico (`#guia-do-rito`), para qualquer usuário da plataforma, mesmo sem o módulo ligado.

Na Central de Ajuda o componente é carregado sob demanda (`lazy`). O link `Help#guia-do-rito` já abre o guia (`inicial`). O conteúdo é o mesmo nos três lugares, e nada nele é dado do órgão.

### Guia de implantação (14/11/2026)

O botão **Guia de implantação** fica em Painel Administrativo > Processo Eletrônico, ao lado de "Ver como a equipe e a parte", e só aparece para quem administra. O componente é `GuiaImplantacao.jsx`. O texto é o mesmo de [GUIA_IMPLANTACAO.md](GUIA_IMPLANTACAO.md) e cobre:
- como mapear o processo real;
- a escolha do modelo, com uma tabela gerada da biblioteca;
- a ordem de configuração (`PASSOS_IMPLANTACAO`), em que o botão **Abrir** leva à aba de cada passo;
- as garantias do contraditório e da ampla defesa, e como o rito garante cada uma;
- os cuidados do processo sancionador;
- o processo interno, sem partes;
- o teste antes de pôr em uso;
- as versões;
- a lista final antes de ativar.

O passo "Ter um rito ativo" dos Primeiros passos agora aponta a biblioteca e o guia.

### Documentos e textos do rito (14/11/2026)

Opções novas, todas com padrão igual ao de antes (campo ausente = como era):

| Campo | Onde | Regra |
|---|---|---|
| `assinaturas` (1 a 5) | `Exigencia` (documento da fase ou da ação) | `faltaAssinatura` (shared/exigencias.ts): o documento só cumpre com esse número de assinaturas. Some quando a forma é `juntar` (documento de fora). |
| `assinatura_atribuicao` | `Exigencia` | Uma das assinaturas é de quem tem essa atribuição numa lotação de qualquer unidade do órgão (`mesmaAtribuicao`, sem acento e caixa). |
| `partes: false` | `Exigencia` que vai aos autos | Na juntada (documentos.ts), `visivel_partes` fica falso se o documento cumpre uma exigência assim. Só esconde. A petição da parte (portal) não muda. |
| `certidao.abertura` (até 200) | Fase que reúne o grupo da certidão | `aberturaCertidao` escolhe a da fase raiz; `textoCertidao` e `cabeNaCertidao` a usam, então a frase conta no limite da folha. |
| `rotulo_concluir` (até 40) | Fase que não é final | Rótulo do botão principal em ProcessoView quando ele conclui a fase (uma saída, saída indicada ou escolha). Não muda o caminho. |
| `explicacao_publica` (até 400) | Fase | `portal.ts` devolve `fase_explicacao` da fase atual; o Portal mostra sob "Em que ponto está". A prévia do rito também. |

Reconhecimento na juntada: sem escolha de quem junta, a exigência que pede
assinaturas só é reconhecida quando elas existem; com escolha, a juntada para
com a mensagem do que falta (`failed-precondition`). A tela sugere a
exigência contando a assinatura de "Assinar antes de juntar" e mostra, sob
cada exigência, o que ela pede do documento (`exigeDoDocumento`). A
atribuição só o servidor confere, porque ele lê as lotações.

### Listas do órgão (14/11/2026)

Espécies de comunicação, espécies de audiência e origens do processo a mais,
além das do sistema. Lógica pura em `functions-v2/src/shared/listasOrgao.ts`.

- **Dados:** `secConfig.listas` = `{ comunicacao?, audiencia?, origem? }`,
  cada item `{ id, nome, m? }`. Id sempre `o_…` (`ehDoOrgao`), gerado do nome
  e mantido ao renomear. Até 30 itens por lista, nome até 40 caracteres, sem
  repetir nome (nem os do sistema). `m: true` = nome masculino (só nas
  espécies). Ação `salvarListas` (gestor do módulo), auditoria
  `SECRETARIA_LISTAS` (assunto "listas" no histórico); `estado` devolve
  `listas` saneadas (`listasDe`).
- **Registro guarda o nome:** a comunicação grava `especie_nome` e
  `especie_m`; a audiência, `especie_nome` e `especie_m`; a origem,
  `{ tipo: 'o_…', nome, descricao }`; a ação do rito (`comunicacao` e
  `audiencia`), o mesmo. O servidor aceita qualquer `o_…` bem formado com nome
  (`itemDoRegistro`, `especieValida`): a lista é sugestão das telas, e tirar
  um item não invalida rito, processo nem texto pronto.
- **Gênero:** `artigos(m)` dá "a/o", "da/do", "à/ao". Os textos gerados
  (movimentos, prazo "Responder ao edital", Meus processos "Dê ciência do
  edital", rótulo "Edital designado/expedido") concordam com a espécie.
- **Condições:** o dado `origem` aceita valores `o_…`; a condição guarda os
  nomes (`nomes`) para o texto ("Origem é Ouvidoria") mesmo que o item saia
  da lista.
- **Telas:** aba Listas do órgão (ListasOrgao.jsx); `ProvedorRegistros` leva
  `listas` ao editor de rito (RegrasDaFase); ExpedirComunicacao, textos
  prontos, FormularioAutuacao (autuação e retificação), capa e portal mostram
  o nome guardado.
- **Importar de arquivo (17/11/2026):** botão "Importar de arquivo" na aba
  (`ImportarListas.jsx`). Ação `lerListas` (admin, só lê, nada grava):
  texto (.txt, .md), CSV/TSV, JSON, Word (.docx, .doc), LibreOffice (.odt,
  .ods), Excel (.xlsx, .xls) e PDF com texto, até 5 MB, ou texto colado.
  `secretaria/listasArquivo.ts` tira linhas e tabelas na ordem do arquivo
  (Office pela mesma conversão dos arquivos juntados, `officeParaDoc` e
  `xlsxParaDoc`); `propostaDeBlocos` (`shared/listasOrgao.ts`) acha a lista
  de cada item: título de seção ("Espécies de comunicação", "Audiências:",
  "Origens do processo", aba da planilha com esse nome), "Título: a; b" na
  mesma linha, coluna com o nome da lista, colunas "Lista" e "Nome", JSON
  `{ "comunicacao": [...] }` ou `[{ "lista", "nome" }]`. Gênero: "(m)",
  "(f)", artigo "o/a" no começo ou coluna "Gênero"/"Masculino"; sem isso,
  estimado pela primeira palavra (`m_suposto`, a prévia mostra "estimado").
  Linha com mais de 40 letras fica de fora (texto corrido), com aviso; até
  300 itens por leitura; repetidos no arquivo saem. A prévia
  (`src/lib/listasImportar.js`) marca "Já existe" (sistema ou lista),
  "Repetido" e "Escolha a lista", deixa editar nome, lista e gênero e
  desmarcar, e trava o botão se alguma lista passaria de 30. "Inserir" junta
  ao fim das listas da tela e chama `salvarListas` (que valida tudo de novo);
  a auditoria `SECRETARIA_LISTAS` leva `importado_de` e `itens_importados`.

## Urgência (nov/2026)

- **Dados:** `secProcessos.urgente` (booleano) e `urgencia`
  (`{ motivo, por, em }`); `secTipos.urgente` faz o processo nascer urgente
  (motivo "Tipo de processo urgente (nome)").
- **Ações:** `autuar` aceita `urgente` e `motivo_urgencia` (obrigatório
  quando a urgência não vem do tipo); `urgencia` (`urgente`, `motivo`
  obrigatório) marca ou retira, exige a posse e grava o movimento `urgencia`
  (ato de usuário, com termo "Certidão de urgência").
- **Efeitos:** `resumo` devolve `urgente` e `urgencia`; `listar` põe os
  urgentes primeiro (`urgentesPrimeiro`, mantendo a ordem dentro de cada
  grupo; na lista paginada, dentro de cada página). Selo `SeloUrgente` nas
  listas, no processo, no portal e nos tipos; grupo "Urgentes" no Meu
  trabalho; filtro "Urgentes"; linha "Tramitação: URGENTE" na folha de dados do PDF;
  "URGENTE:" no título do aviso de processo recebido.
- **Parte:** tipo de manifestação "Pedido de urgência" no portal; a decisão é
  do gabinete, e a secretaria marca a urgência.

## Comunicações às partes (nov/2026)

Intimação, notificação, citação, ciência e comunicação. Lógica pura em
`functions-v2/src/shared/comunicacoes.ts`; gravação em
`functions-v2/src/secretaria/comunicacoes.ts`.

- **Dados:** `secProcessos.comunicacoes[]` (`id, especie, texto, parte_idx,
  parte_nome, documento_id?, dias (0 = sem prazo), contagem, expedida_em,
  expedida_por, unidade_id, limite_ciencia, status, ciencia_em?, ciencia_por?,
  ciencia_meio?, prazo_id?, vence_em?, sem_efeito_motivo?`), mais os derivados
  `comunicacoes_aguardando` (número) e `ciencia_limite` (a data limite mais
  próxima, que a rotina diária consulta). `secConfig/{orgId}.ciencia_dias`
  (padrão 10, máximo 90, 0 desliga o decurso).
- **Situações:** `aguardando`, `ciente`, `decurso`, `sem_efeito`.
- **Ações da equipe** (`secretariaProcesso`): `expedirComunicacao`
  (`comunicacao: { especie, texto, partes_idx, documento_id?, dias, contagem |
  sem_prazo, meio: 'outro', outro_meio, ciencia_data }`) exige a posse, o
  processo em tramitação e a unidade atual do tipo secretaria; o prazo precisa
  ser dito (dias ou `sem_prazo`); pela plataforma, cada destinatário precisa
  ter conta habilitada (a parte ou um representante). Uma comunicação e um
  movimento `comunicacao` por destinatário. `tornarSemEfeito`
  (`comunicacao_id`, `motivo`) só enquanto aguarda ciência.
- **Ações da parte** (`secretariaPortal`): `comunicacoes` (o que aguarda a
  ciência da conta, em todos os processos) e `darCiencia` (`processoId`,
  `comunicacaoId`), só para a parte destinatária ou representante dela.
  `obter` devolve `processo.comunicacoes` da conta e `meusProcessos` inclui
  itens `comunicacao` em "Para você".
- **Ciência:** grava o movimento `ciencia` (ou `ciencia_decurso`, pela
  rotina `secretariaAlertaPrazos`, autor "Sistema") e abre o prazo
  "Responder à intimação" com `destinatario` = nome da parte e
  `comunicacao_id`. O prazo conta do dia da ciência (o primeiro dia contado é
  o seguinte) com o calendário do órgão. Por outro meio, a ciência vale na
  data informada.
- **Eventos nos autos:** Certidão de comunicação, Termo de ciência, Certidão
  de ciência por decurso, Certidão de comunicação sem efeito e Certidão de
  decurso de prazo (quando o rito espera a resposta), todos com folha.
- **Pelo rito:** a comunicação pode ser expedida por uma ação da fase
  (`acao_idx`); ver "Comunicação e resposta das partes como ações do rito".
- **Telas:** `Comunicacoes.jsx` (cartão e formulário de expedição) e
  `ComunicacoesPendentes.jsx` (aviso ao entrar, montado no `Layout` para quem
  tem `portal_partes` e na página do Portal).
- **Testes:** `functions-v2/test/comunicacoes.test.js`.

## Textos prontos de comunicação (nov/2026)

`secConfig/{orgId}.textos_comunicacao`: até 40 itens `{id, nome, especie
(ou '' para qualquer), texto, dias, contagem}`, validados por
`sanitizeTextosProntos` (`functions-v2/src/shared/comunicacoes.ts`). Ação
`secretariaConfig.salvarTextosComunicacao {textos}` (admin; grava a lista
inteira). `estado` devolve `textos_comunicacao`. No formulário de expedição,
o texto pronto preenche o texto e o prazo, e a pessoa ajusta antes de expedir.
Cada cartão tem o menu "Mais opções" (Editar, Duplicar, Excluir). Duplicar
abre uma cópia não salva; excluir mostra um aviso com Desfazer por 8 s, que
regrava a lista com o texto na posição antiga (`src/lib/textosProntos.js`,
pela mesma ação, com o limite de 40).

## Órgãos internos (nov/2026)

A entidade é **singular** (sem órgãos internos; as unidades ficam ligadas
direto a ela) ou **composta** por órgãos em árvore.

- **Dados:** `secConfig/{orgId}.orgaos`, lista de até 60 órgãos e 6 níveis:
  `id, nome, sigla, natureza, pai_id, decisao (singular|colegiada),
  titular_cargo, titular_uid, competencias[], descricao, ordem, ativo`. A
  unidade (`secUnidades`) ganhou `orgao_id` e `competencias[]`; o tipo de
  processo (`secTipos`) ganhou `orgao_id`. O processo não guarda o órgão:
  ele é o da unidade atual.
- **Regras puras:** `functions-v2/src/shared/orgaos.ts` (`sanitizeOrgao`,
  `validarEstrutura`: sem ciclo, superior existente, nome único entre irmãos,
  limites; `emArvore`; `sanitizeProposta`). A lista é validada inteira, em
  transação, a cada gravação (`functions-v2/src/secretaria/orgaos.ts`).
- **Ações de `secretariaConfig`** (admin; veja o admin delegado abaixo): `salvarOrgao {id?, orgao}`,
  `removerOrgao {id}` (recusa órgão com unidades ou subordinados) e
  `criarEstrutura {orgaos: [{chave, pai_chave, ..., unidades: [{nome, tipo}]}]}`
  (assistente; soma aos existentes). `estado` devolve `orgaos` na ordem do
  organograma, com `nivel`. `salvarUnidade` e `salvarTipo` validam
  `orgao_id` e só o alteram quando o campo vem no pedido.
- **Admin delegado** (nov/2026): `orgao.admins_uids` (até 10 membros
  ativos). `orgaosAdministrados(orgaos, uid)` dá os órgãos em que a pessoa
  está em `admins_uids` e todos os abaixo deles; `carregarContexto` lê
  `secConfig` e guarda em `c.adminOrgaos`, e `gestorDe` passa a incluir as
  unidades desses órgãos (também inativas, para reativar), o que libera
  equipe, convites, pedidos, timbrado e modelos da unidade pelo
  `exigirGestor` de sempre. `exigirAdminDoOrgao(c, orgaoId)` cobre o que
  antes era só do admin: dados da unidade e unidade nova (`salvarUnidade`,
  sempre dentro de órgão administrado, nunca direto na entidade) e modelos de
  órgão interno (`salvarModelo`, `importarModelo`, `excluirModelo`,
  `restaurar`, `versoes`). `salvarOrgao` confere com `conferirDelegado`
  dentro da transação: no órgão delegado (raiz) não muda `pai_id` nem
  `admins_uids`; abaixo dele, o superior tem de ser órgão administrado.
  `removerOrgao` aceita do delegado órgão abaixo da raiz, com destino
  administrado. `estado` devolve `adminOrgaos`; ritos, tipos, integrações,
  histórico e preferências seguem com `exigirAdmin`. `podeVer` não muda.
- **Processo:** `autuar` recusa tipo de um órgão por unidade de outro;
  `tramitar` entre órgãos diferentes escreve "Remetido de Órgão › Unidade
  para Órgão › Unidade" e grava `orgao_de`/`orgao_para` nos dados do
  movimento.
- **Telas:** `src/components/secretaria/Orgaos.jsx` (aba Estrutura,
  organograma, formulário do órgão, assistente) e `src/lib/orgaos.js`
  (rótulos, estruturas de exemplo, `unidadeComOrgao`).
- **Modelos por órgão:** `secModelos.orgao_id` (só em modelo sem
  `unidade_id`). `modelosDaUnidade` devolve os da entidade, os do órgão da
  unidade e os da unidade. Gerência só do admin, no formulário do órgão.
- **Para a equipe:** `UnidadesDoUsuario` mostra o organograma detalhado
  (competências) e o painel soma os processos por órgão.
- **Testes:** `functions-v2/test/orgaos.test.js`, `src/lib/orgaos.test.js`.

## Exclusão de órgão, unidade e processo (nov/2026)

Nada se apaga do banco: excluir tira o item de uso e de vista, e o que já
está nos autos continua legível. Quem pode: o admin do órgão sempre; quem
criou o item, nos casos sem efeito sobre o trabalho de outros.

- **Processo** (`secretariaProcesso` `excluir {id, version, motivo}`):
  motivo obrigatório (5+ letras), termo de exclusão nos autos e auditoria
  `SECRETARIA_PROCESSO_EXCLUIDO`. O processo vai a `status: 'excluido'` com
  `unidade_atual`, `partes_uids`, `responsavel_uid`, `ciencia_limite` e
  `proximo_vencimento` zerados (o que havia fica em `excluido.antes`): some de
  listas, contadores, caixa, portal, alertas e ciência por decurso, e
  `lerProcesso` responde "não encontrado". O admin exclui qualquer um; quem
  autuou exclui o próprio enquanto ele está na sua unidade, sem parte
  habilitada e com todos os eventos praticados por ele
  (`podeExcluirProcesso`, em `shared/secretaria.ts`; `obter` devolve
  `pode_excluir`). `excluidos` lista para o admin e `restaurar {id,
  unidade_destino?}` devolve situação, partes, prazos e unidade (outra ativa,
  se a de antes não estiver), com termo de restauração. Tela: Mais › Excluir
  processo; Processos › Todos › Excluídos (admin).
- **Unidade** (`secretariaConfig` `excluirUnidade {id, sucessora?, simular?}`):
  `simular` devolve o impacto (processos, arquivados, equipe, modelos,
  `tipos`, `ritos[{id,nome,fases}]` e `orgao`). Modelos da unidade, tipos
  que entram por ela (`unidade_inicial`) e fases de rito que correm nela vão
  para a sucessora, se houver (tipo de outro órgão interno fica sem
  `unidade_inicial`). Sem sucessora, os modelos ficam inativos no órgão
  interno da unidade ou na entidade, os tipos entram pela unidade de quem
  autua e as fases correm na unidade que estiver com o processo. Processos
  já autuados guardam as fases e não mudam. Salvar um tipo, salvar um rito
  ou restaurar versão de rito descarta referência a unidade excluída. Com
  processos, só o admin exclui e escolhe a unidade sucessora: cada processo
  (em qualquer situação) vai para ela com termo de remessa "por exclusão da
  unidade", sem responsável, e as minutas seguem (`unidades_acesso`). A
  unidade fica `excluida: true`, inativa, sem equipe, pedidos e convites;
  `estado` a tira de `unidades` e devolve `unidades_excluidas` (o nome
  aparece como "Nome (excluída)" no que já passou por ela). Quem criou a
  unidade (`criada_por_mim`) exclui a que não tem processo nem é usada por
  tipo ou fase de rito, escolhendo como sucessora só unidade que gere. Não há
  restauração pela tela.
- **Órgão interno** (`removerOrgao {id, destino?}`): unidades, órgãos
  subordinados, tipos de processo e modelos do órgão passam para `destino`
  (outro órgão fora da sua subárvore ou, vazio, direto na entidade); os
  processos seguem nas mesmas unidades. Quem criou o órgão (`criado_por`,
  gravado pelo servidor) exclui o órgão vazio. A confirmação avisa que não
  se desfaz e, para o admin com o órgão ativo, oferece "Desativar em vez de
  excluir" (`salvarOrgao` com `ativo: false`).
- **Testes:** `functions-v2/test/exclusao.test.js`.

### Excluir, restaurar e duplicar ritos, tipos e modelos (nov/2026)

Cada cartão de rito, tipo de processo e modelo tem o menu ⋯ com Editar,
Duplicar e Excluir (`Lixeira.jsx`: `CartaoComMenu`, `ConfirmarExclusao`,
`Excluidos`). A exclusão é suave (`excluido: true`, `ativo: false`,
`excluido_em`, `excluido_por`) e processos já autuados não mudam: guardam as
fases, os campos e o `modelo_id` de onde nasceram (`obterModelo` continua
servindo o modelo excluído).

- `excluirTipo {id}` (admin): o tipo some de `estado`, não autua (`autuar`
  recusa `excluido`), não se edita (`salvarTipo` responde "não encontrado") e
  deixa de prender o rito em `excluirRito`.
- `excluirModelo {id}` (admin; gestor para modelo da unidade): some de
  `estado.modelos` e não se edita.
- `restaurar {colecao: 'rito' | 'tipo' | 'modelo', id, rito_id?}`: volta
  inativo, para ser reativado de propósito; confere o limite. Tipo cujo rito
  foi excluído só volta com `rito_id` de um rito existente.
- `estado.excluidos`: `{colecao, id, nome, em, por, rito_id?, unidade_id?,
  orgao_id?}`, os mais recentes primeiro (`por` = nome de quem excluiu, mesmo
  que já tenha saído do órgão); ritos e tipos para o admin, modelos para o
  admin e para a gestão da unidade dona. A tela mostra "Excluídos (N)" no fim
  de cada lista, com Restaurar (e a escolha do rito, quando falta).
- **Lixeira** (aba da configuração, nov/2026, `LixeiraConfiguracao`): ritos,
  tipos, modelos e processos excluídos numa lista só, com quem excluiu,
  quando, motivo (processo), busca sem acento, filtro por tipo e Restaurar
  (processo: com a unidade para onde volta, pela ação `restaurar` de
  `secretariaProcesso`).
- **Excluir de vez** (17/11/2026, só o admin, botão em cada linha da Lixeira
  e das listas "Excluídos"): apaga para sempre o que já está na lixeira.
  - Rito, tipo e modelo: `excluirDefinitivo {colecao, id}` de
    `secretariaConfig` apaga o documento e as `versoes`
    (`recursiveDelete`) e, no modelo, o arquivo original do Storage. Tipo com
    qualquer processo (`tipo_id`, inclusive arquivado ou na lixeira) não é
    apagado: os processos leem os campos do tipo. Confirmação: marcar
    "Entendo que não dá para desfazer".
  - Processo: `excluirDefinitivo {id, confirmacao}` de `secretariaProcesso`,
    com o número digitado (conferido no servidor). Recusa se o processo esteve
    na pauta de uma sessão (a ata o cita), tem certame ou outro processo nasceu
    dele (`vinculos` `pe:{id}`). Apaga o processo com movimentos, documentos,
    leituras e o resto das subcoleções, os códigos de `secVerificacao` dos
    documentos, as anotações (`secAnotacoes`) e os arquivos em
    `secretaria/{org}/{processo}/`. O contador da numeração não volta: o
    número não se repete.
  - Auditoria `SECRETARIA_{RITO,TIPO,MODELO,PROCESSO}_EXCLUIDO_DEFINITIVO`
    (processo: número, assunto, tipo, motivo e quem excluiu antes), no
    Histórico da configuração com o assunto "Lixeira (exclusões de vez)".
- `estado.tipos_excluidos`: `{id, nome, formulario}` dos tipos excluídos, para
  todos. Processo já autuado com um deles segue editando os dados com o
  formulário certo e aparece no filtro "Tipo de processo" da lista.
- Modelo excluído sai das fases ao salvar o rito (`salvarRito` e
  `aplicarPropostaRito` só aceitam modelos não excluídos); até lá, o editor
  mostra "Modelo excluído". Modelo de unidade excluída: só o admin exclui ou
  restaura.
- Duplicar um rito com um rascunho de rito novo guardado mostra o aviso antes
  de substituí-lo.
- Limites contam só o que não foi excluído: 50 ritos, 100 tipos (também ao
  implantar um rito com tipo novo), 200 modelos.
- Duplicar é só na tela: rito abre o "Novo rito" com as fases do original
  (sem criar tipo junto); tipo abre "Novo tipo" com rito, campos e numeração,
  sem a sigla (para não dividir a contagem por sigla); modelo do editor abre
  como modelo novo. Modelo com arquivo original não se duplica.
- Unidade e órgão interno não têm restaurar: a exclusão deles já leva
  processos, equipe e itens para outro lugar.

O PDF dos autos mostra CPF/CNPJ das partes só na cópia da equipe; a do portal
das partes não traz o documento de ninguém.

## Meus Processos Eletrônicos (nov/2026)

Página `src/pages/MeusProcessosEletronicos.jsx` (rota
`/MeusProcessosEletronicos`, dentro do menu do SIGO, abaixo de Meu Perfil).
Mostrada a quem tem `users/{uid}.portal_partes`: a marca é ligada ao aceitar
um convite e desligada quando `meusProcessos` não encontra processo algum.

- **Dados:** `secretariaPortal.meusProcessos` devolve, por processo, além do
  que já devolvia: `tipo_nome`, `autuado_em`, `prazos` (os abertos dirigidos
  à parte), `peticoes_aguardando`, `comunicacoes_aguardando` e o resultado de
  `situacaoDaParte` (`functions-v2/src/shared/meusProcessos.ts`):
  `situacao`, `prioridade`, `frase` e `data`. A resposta traz também `hoje`.
- **Situações, em ordem:** `vencido` (prazo da parte passou), `ciencia`
  (comunicação aguardando ciência e nenhum prazo aberto: prazo por abrir),
  `prazo` (prazo aberto), `apreciacao` (manifestação da parte aguardando o
  órgão), `acompanhar` e `encerrado` (arquivado).
- A frase é montada por regra, sem IA. Só entram processos em que a conta é
  parte ou representante (`partes_uids`); a atuação como membro de órgão não
  aparece aqui.
- **Testes:** `functions-v2/test/meusProcessos.test.js`.

## Exportação em PDF

Gerada no servidor com `pdf-lib` e `pdfmake`: capa, folha de dados do
processo, índice dos autos (atos de usuário com folhas e hash) e as demais
peças em ordem cronológica: cada documento juntado, carimbado com as folhas
gravadas na juntada, ou o termo do ato. Ao fim, o "Extrato de registros do
sistema".

**Capa e folha de dados (13/11/2026).** A **capa** traz só o nome do órgão, o
número do processo, a data da autuação e a situação: "Ativo", "Ativo
(sobrestado)" ou "Arquivado" (`situacaoDaCapa`). Leva também o aviso de
"cópia parcial" e, se a cadeia de eventos não conferir, o alerta. A **folha de
dados** é a página do evento 1 (a autuação, folha 1 dos autos) e vem logo
depois da capa: termo de autuação, identificação (assunto, tipo, rito, sigilo,
urgência, origem), descrição, partes, campos do processo, os **dados
registrados no andamento** que o rito manda para lá, a situação na data da
impressão (situação, fase e unidade atuais) e a frase de integridade. É
montada na impressão (`folhaDadosPdf` em `exportar.ts`, conteúdo em
`shared/folhaDados.ts`): nada é gravado, a cadeia de hash e a numeração de
folhas não mudam, e ela está sempre atualizada. Se passar de uma página, as
seguintes levam "fls. 1 (continuação)". Abrir o evento 1 no leitor mostra a
mesma folha.

- **Ação que entra na folha de dados** (`acoes_regras[i].folha_dados`,
  "Entra na folha de dados do processo" no editor): vale para ação que pede um
  dado, com qualquer destino (inclusive "Sem evento": o dado completa a folha
  sem criar evento à vista). O movimento da ação grava `dados.folha_dados`, e
  a folha lista o valor atual de `informacoesDoAndamento` (desfazer a ação
  tira o dado). Dado reservado a quem gere a unidade não pode ter a marca (o
  servidor recusa) e nunca é impresso.
- **Cópia das partes**: a folha não traz origem, CPF/CNPJ, partes retiradas,
  unidade, nem quem registrou cada dado; a fase aparece com o nome público.
  Dos campos e dos dados do andamento, só os marcados para as partes e sem
  registro de outro módulo fechado (`refsFechadas`), como em `obter`.
- Processos e ritos antigos: a capa e a folha valem para todos; sem ação
  marcada, a folha traz só os dados da autuação.
- Testes: `functions-v2/test/folhaDados.test.js`.
 Redigidos entram com o PDF guardado na juntada (ou renderizado
de novo, se forem antigos); PDFs enviados entram página a página; PNG/JPG como
imagem; TXT como texto; Word/planilha como folha de referência com o hash.
Minutas nunca entram.
A exportação é registrada em `auditLogs` (`SECRETARIA_PDF_EXPORTADO`).

## Conclusão, pendências e prazos (fase 2)

- **Conclusão:** tramitar para uma unidade que decide (o gabinete, por
  padrão; ver Papéis da unidade) grava o movimento `conclusao` ("Conclusos
  a ..."). Devolver à secretaria é tramitação comum.
- **Pendências** (`processo.pendencias[]`): o que o decisor precisa apreciar.
  Abrem-se à mão (`abrirPendencia`) ou na juntada de um documento
  (`juntar` com `pendencia: 'sim' | 'interrompe'`). Cada uma pode **interromper
  a fase**: enquanto houver pendência aberta que interrompe, `avancarFase` é
  recusado. Só a **unidade que decide** e tem o processo aprecia (`resolverPendencia`,
  com a decisão por escrito); apreciada a última que interrompia, a fase volta
  a correr. A fase 3 usa o mesmo mecanismo para a petição da parte.
- **Prazos** (`processo.prazos[]`): `abrirPrazo` com dias, contagem (úteis ou
  corridos) e destinatário. O vencimento segue o CPC, art. 224: exclui o dia
  do começo, inclui o do fim e prorroga para o primeiro dia útil. Dias úteis
  excluem sábados, domingos e feriados nacionais (fixos, Carnaval, Sexta-feira
  Santa e Corpus Christi). `encerrarPrazo` marca cumprido (no prazo ou fora
  dele) ou cancelado.
- **Cronograma de obrigações** (nov/2026; `shared/cronograma.ts`, espelho em
  `src/lib/cronograma.js`): parcelas e obrigações com vencimento e valor
  opcional, registradas de uma vez (até 120 por registro). Cada obrigação é
  um prazo com `obrigacao: true` (e `valor`, quando há): entra no alerta de
  vencimento e em `proximo_vencimento`, aparece para a parte no portal com
  "Enviar comprovante" (a petição cita o `prazo_id` e abre a pendência
  "Apreciar petição", sem encerrar nada) e a equipe a encerra como cumprida
  ou cancelada por `encerrarPrazo`. Nasce de duas formas: a ação do rito
  `pede: 'cronograma'` (`marcarAcao` com `valor: { itens, destinatario }`;
  desfazer cancela só as que a ação abriu e seguem abertas, pela marca
  `cronograma_de: "fase:índice"`) ou o botão "Cronograma" de "Pendências e
  prazos" (`abrirCronograma`, com a mesma permissão de `abrirPrazo`), para
  processo de qualquer rito. A obrigação não leva `fase_id` nem `acao_idx`:
  sobrevive à saída da fase e ao cumprimento da ação, ao contrário do prazo
  próprio da ação. A ação `pede: 'quitacao'` ("Esperar o cumprimento do
  cronograma") não se marca à mão: mostra o andamento e o servidor a cumpre
  (`cumprirQuitacao`, depois de `encerrarPrazo`, `marcarAcao`, `avancarFase`
  e `tramitar`) quando há ao menos uma obrigação cumprida e nenhuma aberta
  (`quitado`; as canceladas não contam). Obrigatória, segura a fase como
  toda ação obrigatória (sair sem ela exige motivo, que fica registrado). O
  servidor confere os itens (`sanitizeObrigacoes`: descrição, data válida,
  valor positivo). Na tela, as 4 obrigações mais próximas ficam à vista e as
  demais recolhidas; em "Meus processos" do portal entram só as vencidas ou
  dos próximos 30 dias (`prazosEmFoco`). Testes: `test/cronograma.test.js`,
  `src/lib/cronograma.test.js` e `scripts/e2e-cronograma.mjs`.
- O processo grava `pendencias_abertas`, `fase_suspensa` e
  `proximo_vencimento`, que a lista usa em selos e filtros (com pendência,
  com prazo, prazo vencido).

## Portal das partes (fase 3)

- **Parte externa (nov/2026).** Três recursos para quem é de fora do órgão:
  1. *Representante qualificado* (`shared/representacao.ts`, espelho em
     `src/lib/representacao.js`): `convidarParte` com `representante {nome,
     email, qualidade, inscricao, poderes}`. Qualidades: advogado (inscrição
     obrigatória), defensor, procurador, legal, preposto, outro. Advogado,
     representante legal e preposto exigem `poderes: true` (procuração ou
     ato conferido); o servidor recusa sem isso. O rótulo e a assinatura do
     representante levam a qualificação (`nomeQualificado`). Representante
     sem qualidade segue valendo (os antigos).
  2. *Visibilidade por polo* (`shared/autos.ts`): documento e movimento
     podem levar `visivel_polos: string[]`. `documentoVisivel(d, polo)` e
     `visivelParaPartes(m, polo)` respondem para o polo de quem lê; sem
     polo (último andamento público, "Meus processos"), o restrito não
     aparece. Vale para a lista, o PDF dos autos, a certidão, o download e o
     aviso por e-mail (só às partes do polo). A juntada aceita
     `visivel_polos` (`polosEscolhidos`: só polos com parte ativa; todos =
     sem restrição). Comunicação não leva documento restrito a destinatário
     de outro polo.
  3. *Petições por polo*: `formulario.peticoes_por_polo` no tipo de processo
     é copiado para o processo na autuação; a petição do portal nasce com
     `visivel_polos: [polo da parte]`. A equipe sempre vê tudo.
- **Tipos de petição do órgão**: lista `peticao` em Listas do órgão
  (`tiposDePeticao`: os do sistema, os do órgão e "Outro" no fim). O portal
  oferece e o servidor valida pela mesma função.

- **Convite:** a unidade que tem o processo clica em Convidar ao lado da parte.
  A function gera um token aleatório (24 bytes), guarda só o SHA-256 em
  `secConvites` e devolve o link `/Portal?convite=...`, que a equipe copia. Com
  e-mail (o da parte ou outro informado), o link também segue por e-mail se o
  envio estiver configurado. O convite vale 7 dias e só uma conta o aceita.
  Novo convite para a mesma parte invalida o anterior.
- **Aceite:** a parte entra com Google ou com e-mail e senha (cria a conta na
  hora, com recuperação de senha) e aceita. O processo grava `uid` na parte,
  `partes_uids` e o movimento `habilitacao`. Nenhum vínculo com o órgão é
  criado: o resto do SIGO continua fechado para ela.
- **O que a parte vê:** número, assunto, fase, situação, partes, prazos em
  aberto, documentos juntados marcados como visíveis e a linha do tempo sem
  atribuições internas, pendências e juntadas ocultas. Na juntada, a equipe
  escolhe "Visível às partes" (padrão) ou "Só para a equipe". Minutas nunca
  aparecem. A regra única é `visivelParaPartes` (`shared/autos.ts`): ficam de
  fora os tipos de `MOVIMENTOS_INTERNOS` (a pendência aberta à mão inclusive,
  mesmo tendo termo nos autos; só a ação de fase com certidão nos autos
  aparece), os atos de fase interna e os marcados `visivel_partes: false`. A
  lista de processos da parte usa `ultimo_movimento_publico`, gravado por
  `registrarMovimento` só quando o ato é visível; processo anterior ao campo
  mostra o último movimento apenas se o tipo for público e se ele não
  estiver marcado `ultimo_movimento.publico: false` (gravado desde nov/2026).
  O movimento `guarda` (documento guardado fora dos autos) é sempre interno.
- **Petição a qualquer tempo:** texto e/ou um anexo PDF, DOCX, PNG ou JPG até 50 MB.
  É juntada na hora com número de ordem e assinatura simples da parte, gera o
  movimento `peticao` (com a tempestividade diante dos prazos abertos para ela
  ou sem destinatário) e abre pendência para o decisor. Se o admin ligar
  "Petição da parte interrompe a fase" (Painel Administrativo → Processo
  Eletrônico), a pendência suspende a fase até o gabinete apreciá-la. Vale
  também com o processo sobrestado ou arquivado (a Mesa do decisor mostra o
  arquivado com pendência, para alguém reativar e apreciar; o portal avisa a
  parte de que o pedido vai para quem decide). Freio contra
  abuso: 20 petições por conta, por processo, em 24 horas.
- **Revogação:** Revogar tira a conta de `partes_uids`, invalida o convite e
  grava `acesso_revogado`. A parte deixa de ver o processo na hora.

## Parte e membro: dois papéis (nov/2026)

A plataforma serve a qualquer órgão ou entidade (Ministério Público, conselho
profissional, entidade esportiva, OSC, empresa). Em todas, a mesma pessoa pode
ser **membro** de um órgão (equipe, gestor, decisor, admin) e, em outro
processo, **parte** ou **representante de parte**: um conselheiro
representado num processo ético, um empregado num processo de contratação, um
atleta dirigente num processo disciplinar. São papéis distintos e não se
misturam dentro de um processo.

- **Impedimento no servidor.** `ehParte(proc, uid)` (`shared/secretaria.ts`)
  é verdadeiro quando `uid` está em `partes_uids`. `podeVer` e `podeAgir`
  devolvem falso para quem é parte, **mesmo admin do órgão ou lotado na
  unidade que tem o processo**. `lerProcesso` recusa com `failed-precondition`
  ("Você é parte neste processo. Acompanhe-o pelo Portal das partes.");
  `listar`, caixa, Meu trabalho, busca e painel não trazem o processo para
  essa pessoa. Os avisos à equipe (processo recebido, pedido de assinatura,
  pendência, petição, prazos vencendo) pulam quem é parte no processo.
- **Tela do órgão.** Quem abre por engano um processo em que é parte vê o
  aviso "Você é parte neste processo" com o botão "Abrir no Portal das
  partes" e Voltar; nenhuma ferramenta da equipe aparece.
- **Portal como lugar único da parte.** O menu do SIGO mostra "Processos em
  que sou parte" (ícone de balança) a quem tem `users.portal_partes`; o portal
  mostra "Ir para o SIGO" a quem é membro de algum órgão. Dentro do portal, a
  pessoa é só parte: nada do órgão aparece. Com processos em mais de um órgão
  ou entidade, a lista "Meus processos" vem **separada por órgão** (título com
  o nome e a contagem) e ganha um filtro por órgão.
- **Representante da parte.** Ao lado de cada parte, a equipe tem
  "Representante": informa nome e e-mail e gera o convite (`convidarParte`
  com `representante: { nome, email? }`); para um representante já listado,
  Convidar/Novo convite e Revogar usam `representante_idx`. O representante
  entra com a própria conta, vê o processo exatamente como a parte e aparece
  na lista como "Você representa X (polo)" com a etiqueta Representante. O que
  ele protocola sai como "Dra. Rita, representante de Carlos" no movimento,
  na pendência ("Carlos (parte, por Dra. Rita)"), no autor e na assinatura do
  documento, na íntegra e na certidão. Avisos por e-mail da parte chegam
  também aos representantes habilitados. Revogar um representante tira a conta
  de `partes_uids` e o retira da lista (se nunca teve convite nem conta, o
  movimento diz "retirado do processo").

### Portal completo (etapa 4, nov/2026)

- **Entrada:** Google, e-mail e senha, ou **link por e-mail sem senha**
  (`sendSignInLinkToEmail`; o e-mail fica no navegador para concluir o acesso
  na volta, com campo de confirmação se faltar). Texto de três linhas explica o
  que a parte pode fazer. O vocabulário evita termos internos: "manifestar-se",
  "processo completo", "em que ponto está".
- **Para você:** `meusProcessos` devolve `para_voce`: prazos abertos para a
  parte (vencidos primeiro), manifestações ainda sem apreciação e processos com
  novidade desde o último acesso. Cada processo traz `novidades` e `visto_em`;
  `obter` grava o acesso em `secPortalAcessos/{uid}.processos` e marca `novo`
  nos movimentos e documentos posteriores à leitura anterior (na primeira
  leitura nada é marcado). Lista com busca e filtro acima de três processos.
- **Ações sobre os autos:** `exportar` monta a íntegra em PDF (mesmo gerador da
  equipe, só com movimentos públicos e documentos visíveis, sem nomes de
  unidade); Imprimir abre esse PDF em nova aba; `certidao` gera certidão de
  andamento de uma folha (número, assunto, fase, situação, prazos abertos,
  último movimento, data e hora). Leitor contínuo (`LeitorAutos`) abre os
  documentos em sequência com lista lateral, anterior/próximo, setas do
  teclado, marca de lido no navegador e Baixar (enquanto se lê um documento,
  o leitor já pede o PDF do seguinte); cada documento tem o link de
  conferência pública para copiar.
- **Em que ponto está:** a fase atual e quantas etapas faltam até o fim pelo
  caminho mais curto do rito (`fases` públicas só com id, nome, prazo e
  encaminhamentos); o diagrama completo abre sob demanda.
- **Prazos:** os dirigidos à parte (`meu`, por destinatário igual ao nome da
  parte ou sem destinatário) ficam em destaque com dias restantes e botão
  Responder, que pré-preenche a manifestação com o prazo.
- **Manifestação guiada:** tipo (`Manifestação`, `Juntada de documento`,
  `Pedido de prazo`, `Pedido de vista`, `Recurso`, `Outro`) com texto inicial e
  orientação curta; prazo que responde (`prazo_id`, usado na tempestividade e
  gravado na pendência); rascunho guardado no navegador até protocolar;
  comprovante em PDF (`comprovante`) ao protocolar e em "Minhas manifestações",
  que lista situação (nos autos, aguardando apreciação, apreciada com a
  decisão) de cada petição da própria parte.
- **Avisos por e-mail:** preferência `tudo` (padrão), `prazos` (prazos,
  lembretes, decisões e mudanças de fase) ou `nenhum`, em
  `secPortalAcessos/{uid}.avisos`. Depois de cada movimento público
  (`processos.ts`, `documentos.ts`, petição de outra parte) a function envia o
  e-mail fora da transação (`portalAvisos.ts`), com link direto
  `/Portal?p=<id>`; a parte autora do movimento não é avisada. O alerta diário
  de prazos também lembra as partes no dia e 3 dias antes do vencimento.
  Sem `EMAIL_API_KEY`, nada é enviado.
- **Celular:** barra fixa inferior com Processo (PDF) e Manifestar-se; a lista
  do leitor recolhe num botão.

## Equipe e decisor (etapa 5, nov/2026)

- **Nesta fase:** cartão no topo da aba Andamento com o nome da fase, para
  onde segue, quem faz e em que unidade corre, a orientação do rito, as ações
  como caixas de marcar (`marcarAcao`, movimento interno `acao_fase`, guardado
  em `acoes_feitas`) e os modelos indicados como botões "Redigir X", que abrem
  o editor já preenchido (ou criam a minuta do Word/PDF). O fluxo completo
  fica recolhido.
- **Botão único:** muda conforme o rito. Fase que corre em outra unidade:
  "Enviar para X". Uma só fase seguinte em outra unidade: "Concluir e enviar
  para X" (`tramitar` com `fase_id`, um ato, um movimento). Uma seguinte na
  mesma unidade: "Concluir e seguir para Y". Várias: "Seguir para a próxima
  fase…" (abre as alternativas com condição). Fase final: arquivar. Gabinete
  com pendência: "Apreciar a pendência". As demais ações ficam em "Mais".
- **Novo documento:** um só diálogo com os modelos da fase em destaque, os
  demais modelos, redigir em branco por tipo ou enviar arquivo. Atalho `N`.
- **Minutas:** "Pedir assinatura" a alguém lotado na unidade
  (`pedirAssinatura`: grava `assinaturas_pedidas` no documento,
  `assinaturas_pendentes` no processo e envia e-mail); "Assinar antes de
  juntar" na juntada (`assinar: true`, a assinatura entra antes de gerar o
  PDF). Assinar, juntar ou excluir a minuta limpa o pedido. Pode receber o
  pedido quem está lotado na unidade que redigiu a minuta ou na que tem o
  processo.
- **Minutas que seguem com o processo (nov/2026):** no diálogo de remessa
  (não na devolução com orientação), "Minutas que seguem com o processo"
  lista as minutas que estão com a unidade que remete, todas marcadas. As
  marcadas vão em `tramitar` como `minutas`; o servidor confere, na mesma
  transação, que cada uma é minuta acessível à unidade atual (senão
  `invalid-argument`) e acrescenta o destino a `unidades_acesso`. A unidade
  de destino lê, revisa, assina, pede assinatura e junta; só a unidade que
  redigiu exclui. A unidade de origem continua vendo a minuta. O termo de
  remessa ou conclusão não cita minutas (trabalho interno); os ids ficam em
  `dados.minutas` do movimento. Na lista, a minuta recebida mostra
  "redigida em {unidade}".
- **Meu trabalho:** primeira aba para quem está lotado, com grupos por
  urgência a partir da mesma consulta da caixa: pediram sua assinatura,
  orientação do gabinete, comigo, prazo vencendo em 7 dias, chegaram hoje
  (`recebido_em`), sem responsável. Botões Assumir e Abrir; contagem na aba.
- **Mesa de decisão:** aba para quem está lotado em gabinete, com os
  processos conclusos com pendência aberta, da espera mais antiga para a mais
  nova. Na apreciação, o documento que gerou a pendência (a petição) aparece
  ao lado da decisão. Decisão em dois formatos: nota (`resolverPendencia`) ou
  **despacho**: abre o editor com o modelo "Despacho" se houver; ao juntar, a
  opção "Este documento decide uma pendência" (`resolve_pendencia_id`, só no
  gabinete) resolve a pendência com a resolução "Decidida pelo documento nº
  N". Lista curta de decisões anteriores no processo.
- **Devolver à secretaria com orientação:** no gabinete, `tramitar` com
  `orientacao` remete de volta (à unidade que concluiu, ou à primeira
  secretaria) e deixa a orientação em destaque no processo e no Meu trabalho
  até "Concluída" (`concluirOrientacao`, movimento interno).
- **Processo recebido:** depois de cada tramitação, e-mail a quem está lotado
  na unidade de destino (`avisosEquipe.ts`, fora da transação), com quem
  remeteu, motivo ou orientação e link do processo. O diálogo de envio mostra
  quem vai receber e avisa se não há ninguém lotado.
- **Autos:** leitor contínuo (`LeitorAutos`, o mesmo do portal) por
  "Ler em sequência" ou clicando no título; marca de lido no navegador.
- **Atalhos:** `N` novo documento, `T` enviar para outra unidade, `J` ir às
  pendências (fora de campos de texto e com nada aberto).
- Para o gabinete, uma linha de contexto no topo do Andamento: partes, tipo,
  dias em tramitação e último documento.

## Avisos, celular e acessibilidade (etapa 6, nov/2026)

- **Sino da plataforma:** os avisos da equipe passam a usar a coleção
  `notifications` já existente (tipo `processo_eletronico`, `subtype` em
  `recebido | assinatura | pendencia | peticao | prazo`, `entity_type`
  `processo_eletronico`, `entity_id` = processo). Clicar no sino abre o
  processo. Gravados pelas functions depois da transação
  (`avisosEquipe.ts`, `notificarPessoas`), nunca dentro dela; falha no aviso
  não desfaz o ato (fica em `console.error`).
- **Quem recebe o quê:** processo recebido → lotados na unidade de destino,
  menos quem remeteu; pedido de assinatura → a pessoa pedida; pendência
  aberta (por `abrirPendencia` ou por juntada com pendência) → lotados no
  gabinete que está com o processo, menos quem abriu; petição da parte →
  lotados na unidade que está com o processo; prazo vencendo ou vencido →
  lotados na unidade, um aviso por processo, no job diário das 7h (até 20 por
  pessoa por dia). A parte nunca entra no sino da equipe.
- **Preferências** em `userPreferences/{uid}.notificationPreferences.processo_eletronico`
  (`{ sino: boolean, email: 'cada' | 'resumo' | 'nenhum' }`, padrão sino
  ligado e um e-mail por evento), editadas no diálogo **Avisos** do cabeçalho
  do Processo Eletrônico (`AvisosEquipe.jsx`, via `useUserPreferences`).
  `resumo`: o job diário (`secretariaAlertaPrazos`, `enviarResumosDiarios`)
  manda um e-mail com os avisos não lidos das últimas 24 horas, por órgão.
  O alerta diário de prazos por e-mail não depende da preferência.
- **Celular:** na aba Andamento o botão principal e "Novo documento" ficam
  numa barra fixa embaixo (`sm:hidden`, respeita `safe-area-inset-bottom`);
  "Fotografar um documento" (`<input capture="environment">`) em Novo
  documento e no Peticionar do portal.
- **Acessibilidade:** texto auxiliar passa de `text-slate-500` para
  `text-slate-600` (contraste AA sobre branco) nos componentes do módulo e
  no portal; erros de carregamento ganham `role="alert"` e botão **Tentar de
  novo** (`ErroQuery.jsx`, `q.refetch()`); glossário em `title` nos termos
  "Juntar" e "Minutas da unidade".
- **Ajuda:** seção "Processo Eletrônico" na Central de Ajuda
  (`/Help#processo-eletronico`), por perfil (equipe, gabinete, avisos e
  celular, partes), com botão "?" no cabeçalho do módulo.

## Admin e escala (etapa 7, nov/2026)

- **Primeiros passos:** no Painel Administrativo → Processo Eletrônico, um
  cartão "Configuração: N de 4" (`PrimeirosPassos.jsx`) mostra o que falta
  para o módulo funcionar: unidade ativa, alguém lotado, rito ativo e tipo de
  processo ativo; cada item tem um "Ir" que abre a aba certa. Some quando os
  quatro estão prontos.
- **Prévia "ver como":** botão **Ver como a equipe e a parte**
  (`PreviaRito.jsx`) monta, sem gravar nada, um processo de exemplo com o rito
  e a fase escolhidos: o cartão "Nesta fase" da equipe (unidade, quem faz,
  ações, modelos, rótulo do botão principal, alternativas) e o "em que ponto
  está" da parte (fase, etapas que faltam). Calculado no navegador a partir da
  configuração; `etapasAteOFim` passou para `src/lib/secretariaRito.js`.
- **Importação de ritos:** a revisão ganha, no alto, a lista de
  **pendências** (`pendenciasDaProposta`): fase sem nome ou saída para fase
  inexistente **impedem** implantar; fase sem unidade, última fase sem fim e
  alternativas sem condição são avisos. Cada item tem "Ir" que rola até a
  fase. A revisão fica como **rascunho** no navegador
  (`localStorage` `rito-rascunho-{org}`), oferecida na tela inicial para
  continuar ou descartar; apagada ao implantar. Depois de implantar aparece o
  **resumo** do que foi criado (rito, fases, unidades, modelos, tipo) com
  atalhos "Montar as equipes", "Completar os modelos", "Ver os tipos" e
  "Abrir o rito", que trocam a aba da configuração. A tela inicial também
  oferece uma **planilha de exemplo** para preencher.
- **Versões de ritos e modelos:** cada salvamento guarda a versão anterior em
  `secRitos/{id}/versoes/{000n}` e `secModelos/{id}/versoes/{000n}`
  (`versao, salvo_em, salvo_por` e os campos do conteúdo: `nome, descricao,
  fases` no rito; `nome, tipo_documento, descricao, conteudo` no modelo), até
  20 por item (as mais antigas são apagadas). Ações `versoes` e
  `restaurarVersao` em `secretariaConfig` (`colecao: 'rito' | 'modelo'`):
  rito e modelo do órgão exigem admin; modelo de unidade, gestão dela.
  Restaurar guarda a atual como versão, grava os campos antigos, soma 1 em
  `versao` e audita `SECRETARIA_VERSAO_RESTAURADA`. Processos em andamento
  continuam com a cópia das fases com que foram autuados; documentos já
  redigidos não mudam. Botão **Versões** no editor de rito e no editor de
  modelo (`VersoesDialog.jsx`).
- **Versões do tipo de processo** (13/11/2026): `salvarTipo` guarda a versão
  anterior em `secTipos/{id}/versoes/{000n}` (`CAMPOS_TIPO`: nome, sigla,
  descrição, rito, formulário, numeração, de onde nasce, sigilo, urgência,
  unidade inicial e órgão) e soma 1 em `versao` (tipo antigo conta como 1).
  `versoes` com `colecao: 'tipo'` lista (com o número de campos próprios) e,
  com `versao`, devolve o conteúdo; o editor do tipo abre essa versão como
  alteração não salva ("Abrir no editor"), e só salvar a grava, passando por
  todas as validações de `salvarTipo`. `restaurarVersao` recusa tipo. O
  processo guarda `tipo_versao` na autuação (rastreio; os campos já são
  cópia). O cartão do tipo mostra "versão N".
- **Editor do tipo**: fechar com alterações não salvas pede confirmação (X,
  Cancelar, Esc), e o rodapé avisa "Alterações não salvas". Na aba
  Formulário, "Copiar campos de outro tipo" acrescenta os campos próprios de
  outro tipo (também de um excluído) até o limite, com id novo, condição
  remapeada e "exigir para sair" só com fases do rito deste tipo
  (`copiarCampos`); nomes repetidos aparecem nos ajustes antes de salvar.
- **Rito só por tipo** (`exigir_tipo`, 13/11/2026): caixa "Autuar só por um
  tipo de processo" nos dados do rito. Marcada, o rito some de "Sem tipo
  (escolher o rito)" no Novo processo e `autuar` sem `tipo_id` é recusado. A
  marca é sempre gravada (desmarcar apaga) e entra nas versões do rito;
  restaurar uma versão anterior à opção volta sem ela. A tela avisa quando
  nenhum tipo ativo usa o rito.
- **Modelos:** cada cartão mostra "Indicado em: Rito › Fase" quando alguma
  fase o indica; no editor, **Duplicar** abre uma cópia (sem id, "(cópia)" no
  nome) para ajustar e salvar como modelo novo.
- **Calendário:** botão **Repetir os de {ano} em {ano+1}** copia os recessos
  do último ano cadastrado para o seguinte (mesmos dias, pulando os que já
  existem) e deixa para revisar e salvar. Feriados nacionais, inclusive
  Carnaval, Sexta-feira Santa e Corpus Christi, já são contados pelo servidor
  (`feriadosNacionais()`); não há o que importar.
- **Histórico de configuração:** aba **Histórico** (`HistoricoConfiguracao.jsx`)
  lista as últimas 300 alterações da configuração (quem, quando, o quê,
  detalhes). Desde nov/2026 vem da ação `historico` de `secretariaConfig`
  (admin, inclusive quem só tem `configure_secretaria`), que lê `auditLogs` por
  `action in` (lotes de até 30, `HISTORICO_CONFIG` em `shared/secretaria.ts`)
  com `timestamp desc`: as mais recentes de verdade, sem os eventos de processo
  (excluir, restaurar, PDF). Filtro por assunto (`assunto`: unidades,
  estrutura, tipos, ritos, documentos, calendário, módulo), busca sem acento e
  "Abrir" no rito, tipo, modelo ou unidade que ainda existe
  (`src/lib/historicoConfiguracao.js`).
- **Atualizar processos para a versão atual do rito** (nov/2026): ação
  `migrarRito {rito_id, simular?, destinos?}` de `secretariaConfig` (admin,
  `functions-v2/src/secretaria/migrarRito.ts`). Lê os processos do rito em
  `em_tramitacao` ou `sobrestado` com `rito_versao` menor que a do rito
  (índice `organization_id + rito_id + status + rito_versao`). `simular`
  devolve os grupos por versão e fase (`gruposDaMigracao`) e as fases atuais;
  fase que não existe mais exige `destinos[faseAntiga] = faseNova`. Gravando,
  uma transação por processo (até 300 por chamada; `restantes` diz quantos
  faltam) troca `fases`, `rito_versao`, `rito_nome` e `fase_atual` e remapeia
  `acoes_feitas`, `acoes_respostas` e `exigencias_cumpridas` pelo texto da
  ação e pela descrição do documento (`migrarEstado`,
  `shared/migrarRito.ts`); a fase de destino, se mudou, recomeça. Movimento
  `rito_atualizado` com `interno`, `fora_impressao` e `visivel_partes: false`
  (sem folha, fora do portal) e auditoria
  `SECRETARIA_RITO_PROCESSOS_ATUALIZADOS`. Prazo automático e certidão
  conjunta pendentes ficam como estavam. Tela: "Atualizar processos" no menu
  do rito (`MigrarRitoDialog.jsx`).
- **Comparar versões** (nov/2026): em "Versões" de rito e tipo, "Ver" mostra a
  versão ao lado do resumo do que muda em relação à atual salva (fases e
  ações, campos, dados; `src/lib/versoes.js`, `diffRito`, `diffTipo`) e a
  prévia (fluxo e "Ver como a equipe e a parte"; no tipo, os campos e o fluxo
  do rito como está hoje). `versoes` com `versao` passou a devolver também o
  rito da versão (só leitura). Ação casa pelo texto: renomear aparece como
  uma que sai e outra que entra.
- **Escala:** `secretariaProcesso` `listar` com `limite` (1 a 200) pagina no
  servidor por `updated_at` desc (índice novo `organization_id + updated_at`
  em `firestore.indexes.json`), devolvendo `{ processos, cursor, mais }`;
  `cursor` é o `updated_at` em ms do último lido e volta em `cursor` na
  chamada seguinte. A posse e o sigilo continuam filtrados em memória, página
  a página, então uma página pode vir com menos itens do que `limite`. As
  abas Caixa e Todos usam `useInfiniteQuery` com 100 por página e o botão
  **Carregar mais**; os filtros valem sobre o que já foi carregado. Sem
  `limite`, `listar` segue como antes (até 1000). Ação `contadores` devolve
  `{ total, arquivados, ativos, por_unidade }` por contagem (`count()`), sem
  trazer documentos; os cartões de unidade mostram "N processos em andamento
  com a unidade" e avisam quando há carga e ninguém lotado.

## Ritos e tipos de processo (fase 4)

O admin do órgão configura tudo em Painel Administrativo → Processo
Eletrônico, sem sair da plataforma.

**Rito.** Lista de fases. Cada fase tem nome, prazo em dias (opcional),
orientação para a equipe (opcional, não aparece para as partes) e o que vem
depois dela:

- sem `proximas`: segue para a fase seguinte da lista;
- `proximas: [ids]`: ramificação, a equipe escolhe entre elas;
- `final: true`: encerra o fluxo, mesmo no meio da lista.

O servidor (`sanitizeRito`) normaliza ids (`slug`), recusa próxima fase
inexistente ou apontando para a própria fase e descarta `proximas` de fase
final. `fasesSeguintes` aplica a regra acima.

**Tela do rito** (`PropostaRito.jsx`, a mesma para criar e editar): fases em
cartões (reordenar, remover, escolher o que vem depois, ações e suas regras,
orientação) e o diagrama do fluxo (`FluxoRito.jsx`, SVG) atualizado ao vivo.
A fase aberta (`CartaoFase`) tem fundo e borda índigo, campos e blocos
internos brancos e um rodapé "Fim da fase N" com "Recolher", para marcar
onde os dados da fase começam e terminam.

**Diagrama do fluxo** (`FluxoRito.jsx`, geometria em `src/lib/fluxoBpmn.js`):
todo rito, importado ou não, é desenhado na notação BPMN usada pelo Bizagi, da
esquerda para a direita: uma raia por unidade, círculo verde de início,
losango amarelo quando a fase tem mais de uma saída, círculo vermelho de fim,
setas em ângulo reto com a condição escrita e voltas tracejadas. Quando o
fluxo não cabe na largura da tela, ele continua na faixa de baixo (como um
texto que muda de linha), para aparecer inteiro e legível. Há zoom, ajuste à
largura e tela cheia (Esc fecha); leitores de tela recebem o fluxo em lista.

Nas telas da equipe (editor de rito, prévia, versões, tipo e processo), o
diagrama recebe `acoes` e segue a leitura do BPMN: a **fase é a moldura** (nome
e prazo no cabeçalho), cada **ação é uma tarefa** (caixa azul dentro da
moldura, tracejada quando opcional) e cada **"Quando vale"** de ação vira um
**desvio** (losango) com a condição escrita, o caminho do "sim" pelas ações
condicionais e o do "não" contornando o grupo. `itensDaFase` monta essa lista
(um desvio por grupo de ações seguidas com a mesma condição) e `desenharFluxo`
dá a cada fase a altura do que ela contém. Ação alternativa leva "ou" na
ligação que chega a ela, e a ação que só orienta é uma caixa branca pontilhada
(não é tarefa). O portal das partes não passa
`acoes`: a fase continua uma caixa com o nome público, sem ações nem raias.

**Guia do rito** (`GuiaRito.jsx`): botão no editor de rito (na tela inicial e
ao lado do fluxo) que abre o guia prático: as peças do rito com um exemplo
desenhado pelo próprio `FluxoRito`, o passo a passo, o que a ação pode pedir,
onde fica o cumprimento, ação condicional, níveis e quem cumpre e vê. As
tabelas do guia leem `PEDIDOS`, `DESTINO_INFO` e `NIVEIS` de
`src/lib/exigencias.js`, as mesmas listas do editor. Ao criar uma opção nova
no editor, acrescente a explicação dela no guia.

Pontos de partida:

- **Modelos prontos:** rito comum, requerimento simples, procedimento com
  contraditório (com recurso), atendimento ao cidadão e Rito Consultas
  CAOCIPP (completo, com ações, desvios e andamento automático).
- **Planilha:** importa .xlsx, .xls, .ods ou .csv, ou texto colado do Excel.
  Colunas Fase | Prazo | Próximas | Orientação, em qualquer ordem se houver
  cabeçalho. Próximas por nome ou número da linha, separadas por `;`; "fim"
  encerra. Há planilha de exemplo para baixar.
- **Diagrama:** cola um fluxograma Mermaid (`flowchart TD`, `A[Nome] --> B`).
  "Nome - 10 dias" no rótulo define o prazo.
- **Exportar:** baixa o rito em .xlsx ou copia como Mermaid (lado da tela).
- **Arquivo:** planilha, Word, PDF, Bizagi, BPMN, XPDL, draw.io ou Mermaid,
  como em "Importação de ritos".

Conversões em `src/lib/secretariaRito.js`, testadas em
`src/lib/secretariaRito.test.js` (`npm run test:lib`).

**Numeração única** (`functions-v2/src/shared/numeracao.ts`, nov/2026). O
número é montado por partes: número sequencial (contado no órgão todo, por
tipo, por unidade que autua ou por órgão interno; recomeça por ano, por mês ou
nunca; de 1 a 10 dígitos), ano (4 ou 2 dígitos), mês, dia, sigla do tipo, da
unidade ou do órgão interno (sem sigla, as iniciais do nome) e texto fixo
(separadores). O órgão tem a sua (Tipos de processo › Numeração,
`salvarNumeracao`, em `secConfig/{org}.numeracao`); cada tipo usa a do órgão,
uma própria (`secTipos.numeracao {modo: "propria", partes}`) ou nenhuma
(`modo: "nenhuma"`: o processo recebe o identificador `SN-XXXXXXXX` e
`sem_numero: true`). Sem configuração vale a de sempre, `000001/2026`, com o
mesmo contador (`secContadores/{org}_{ano}`), então nada muda para quem não
mexe. Outras contagens usam `secContadores/{org}_{escopo}_{alvo}_{período}`,
em que o alvo é a sigla impressa (tipos, unidades ou órgãos com a mesma sigla
contam juntos) ou, sem sigla, o id. A configuração recusa o que repetiria
números (contagem anual sem o ano, contagem por tipo sem a sigla do tipo etc.)
e o que passaria de 60 caracteres. Na autuação, dentro da transação, o
servidor confere que o número ainda não existe no órgão; se uma mudança de
numeração fizer a contagem cair num número já usado, ele pula para o próximo
livre (até 200 pulos) e grava o contador já adiantado. Unidade fixa pelo tipo
(`formulario.unidade = "oculto"`) também vale no servidor: usa a sugerida
quando quem autua está lotado nela. Polo que o tipo não aceita é recusado. O "Novo processo" mostra o
formato do número do tipo escolhido. Nomes de arquivo usam `numeroArquivo`.

**Códigos numéricos** (nov/2026). Além da sigla, o número pode levar o
código fixo do tipo (`cod_tipo`), da unidade que autua (`cod_unidade`) ou do
órgão interno dela (`cod_orgao`), cada parte com 1 a 6 dígitos e zeros à
esquerda (código 1 com 3 dígitos sai `001`). Ex.: sequencial + `.` + código do
órgão + `.` + código do tipo + `/` + ano = `000007.001.002/2026`. O código é
um inteiro de 0 a 999999 em `secTipos.codigo`, `secUnidades.codigo` e
`secConfig/{org}.orgaos[].codigo`, gravado só pela ação `salvarCodigos`
(admin da entidade; Tipos de processo › Códigos), que lê e grava tudo numa
transação e recusa código repetido na mesma seção (tipos e unidades
excluídos não contam). Salvar o órgão interno (`salvarOrgao`) preserva o
código gravado e ignora o que vier do formulário; a cópia de um tipo nasce sem
código; um tipo restaurado da lixeira volta sem código se outro tipo ativo já
o usa. A contagem por tipo, unidade ou órgão aceita a sigla **ou** o código no
número e, com o código presente, conta pelo código (`..._c{codigo}_...`).
Na autuação, `faltasCodigo` recusa (failed-precondition, com o nome do item)
quando o item não tem código, quando o código passa dos dígitos da parte ou
quando o processo não tem o item (unidade fora de órgão interno com
`cod_orgao`): o número sairia incompleto e podia repetir outro. Mudar um
código não renumera nada: o número é gravado no processo na autuação. A
tela mostra, por seção, os dígitos usados, o código como sai no número, os
repetidos (impedem salvar) e os itens sem código ou longos demais (avisos), e
um botão que numera os vazios em ordem a partir do maior código. A prévia da
numeração mostra `???` no lugar de um código que falta. Lógica e testes em
`shared/numeracao.ts` e `test/numeracao.test.js`; espelho da prévia em
`src/lib/numeracao.js`; tela em `components/secretaria/CodigosNumeracao.jsx`.

**Tipo de processo** (`secTipos`): nome, sigla, descrição, rito, sigilo padrão,
unidade sugerida para autuar, formulário e numeração. Na autuação, escolher o tipo preenche rito,
sigilo e unidade; o processo guarda `tipo_id` e `tipo_nome`. A lista filtra
por tipo.

**Formulário do "Novo processo" por tipo** (`formulario` em `secTipos`). O
admin define, em cada tipo, o que quem autua preenche:

- **Campos padrão** (nov/2026, todos configuráveis): Assunto, Descrição,
  Origem e Partes podem ser obrigatórios, opcionais ou não usados (não
  aparecem e não são gravados). Unidade, Sigilo e Tramitação urgente são
  escolhas: quem autua escolhe, ou ficam fixas pelo tipo (unidade sugerida no
  tipo ou a de quem autua; sigilo padrão do tipo; urgente só se o tipo for
  urgente). Cada um pode ter nome e orientação próprios (`rotulos`, `ajudas`),
  e o tipo escolhe os polos que as partes podem ter (`polos`). Sem assunto, o
  processo se chama pelo nome do tipo. Tipos antigos seguem como antes
  (assunto obrigatório, o resto opcional). O formulário não pode ficar sem
  assunto, descrição, partes e campos próprios ao mesmo tempo.
- **Páginas próprias** (nov/2026): módulo `paginas` em `MODULOS`, sobre
  `customRecords` dos tipos de entidade do órgão (`entityTypes`). Ativo só
  com a flag `custom_entities` da plataforma. Campo e ação "registro" com
  `modulo: 'paginas'` exigem `pagina` (id do tipo; `paginaDe`), e o
  registro escolhido tem de ser dessa página. A referência
  (`refDePagina`) guarda como número o primeiro campo de texto preenchido, na
  ordem do tipo (sem texto, `#` e as 6 primeiras letras do id), como título o
  nome do tipo e `pagina`. São internas (`ehInterno`): o campo nunca fica
  visível às partes, a informação da ação sai com `restrito`,
  `refsFechadas` as fecha sem ler o banco, e não trazem dados para campos
  (`DADOS_REGISTRO.paginas` vazio). A equipe as vê sem marca de restrito. Na
  tela: "De qual página" no campo do tipo e na ação do rito
  (`EscolhaPagina`, com as páginas lidas por `ProvedorRegistros` só com a
  integração ligada), a ficha do registro (`GenericRecordDetailSheet`) com
  "Processos eletrônicos" e "Criar processo eletrônico", `?abrir=<id>` na
  lista do tipo (`CustomEntityView`) e "Abrir" da Capa em `tab=clist:<id>`
  (`abaDoRegistro`). A lista e o painel da página mostram o selo "PE" (ao
  lado da fase) nos registros com processo que a pessoa vê, e a lista tem o
  filtro "Processo eletrônico", com a mesma ação `indice` das outras listas
  (`useComPE(organization, 'paginas')`).
- **Integrações com outros módulos** (nov/2026): no Painel Administrativo,
  a aba "Integrações" liga Consultas, Expedientes,
  Parcerias, Júri e páginas próprias aos processos (`secretariaConfig.integracoes`, ação
  `salvarIntegracoes`, só admin). Só liga o módulo ativo no órgão, pela mesma
  regra das abas (`shared/modulos.ts`, `modulosAtivos`: órgão sem
  `moduleConfig` tem todos; Parcerias e Júri dependem também da flag da
  plataforma, e Júri entra desligado). Ligada, o tipo pode ter o campo
  "Registro de outro módulo" e o rito pode ter a ação que pede "Um registro de
  outro módulo". Quem preenche procura pelo número ou assunto
  (`SeletorRegistro.jsx`, combobox; busca em `src/lib/registrosModulos.js` nos
  500 registros mais recentes do módulo, pela regra de membro do órgão; sem
  resultado, procura o número exato em todo o módulo). O
  servidor relê o registro escolhido (`resolverRegistro`, confere o órgão) e
  guarda só o número e o título (`ref`); partes, promotor, responsável e
  situação nunca entram no processo. Um campo próprio do tipo pode ser
  "Preenchido com dado de" um campo de registro do mesmo formulário
  (`importar {de, dado}`; catálogo `DADOS_REGISTRO` em `shared/modulos.ts`:
  consulente, local, matéria e entrada da consulta; origem, sistema, objeto e
  entrada do expediente; tipo, objeto, partes, assinatura e termo final da
  parceria; comarca e data do júri). O dado só pré-preenche o campo na tela:
  quem autua pode mudar, o servidor valida como digitado, data só vai para
  campo de data e texto só para texto livre ou longo, e o campo nunca é
  mostrado às partes. Trocar o registro troca só o que ainda era o dado do
  anterior; o que foi digitado fica. Registro de acesso restrito não traz
  dados. Texto que vai para campo de texto curto entra cortado em 200
  caracteres, à vista de quem autua. Formulário de ação não importa dados. As partes veem só o
  número, e nunca o registro de acesso restrito (`access_restriction` ou
  anonimizado: `visivel_partes` vira falso). O portal relê a origem a cada
  abertura (`refsFechadas`): registro que ficou restrito, foi anonimizado ou
  sumiu depois sai dos campos e das informações que a parte vê. O texto dos
  movimentos já registrados não muda (a cadeia de eventos é imutável); por
  isso a ação guarda no texto só o número. Nada é escrito nos outros
  módulos, salvo a situação da consulta ou do expediente que o rito manda
  mudar (ver "Andamento automático da fase"). Desligar a integração não apaga o que os processos já guardaram e
  não trava a correção de dados com o mesmo registro; só impede escolher de
  novo. Tipo ou rito novo com registro de módulo desligado não salva.
- **Processo que nasce de outro registro** (nov/2026): com a integração
  ligada, a ficha de cada consulta, expediente, parceria e júri ganha o
  quadro "Processos eletrônicos" (`ProcessosVinculados.jsx`): os processos
  ligados ao registro, os que nasceram dele marcados "nasceu daqui", e o
  botão "Criar processo eletrônico" (só para quem está lotado). O botão abre
  o "Novo processo" (`/ProcessoEletronico?org=…&de=modulo:id`) já com a
  origem, o assunto (título de consulta, expediente ou parceria que não seja de acesso restrito; de outro processo e do júri fica em branco), os campos "Registro de outro
  módulo" do mesmo módulo preenchidos e o tipo escolhido, quando um só tipo
  sugere esse módulo ("Sugerir este tipo ao criar um processo a partir de",
  aba Dados do tipo, `pode_nascer_de`). Na Capa de um processo, "Processos
  derivados" e "Novo processo derivado" fazem o mesmo a partir dele (também
  no menu Mais do Andamento). A ação do rito que pede **um processo
  derivado** (`pede: 'derivado'`, com `derivado.tipo` opcional: o nome do
  tipo ou do rito sugerido) mostra o botão "Abrir processo", que leva ao
  mesmo "Novo processo" com o tipo sugerido já escolhido quando um só tipo
  do órgão tem esse nome ou usa o rito com esse nome. Criado o processo, o
  servidor cumpre a ação no processo de origem (`registrarDerivado`, com as
  permissões de quem abriu): a pendente que sugere o tipo ou o rito do novo
  processo; na falta, a que não sugere nada; na falta, a única pendente
  (`derivadoPendente`). "Já existe" registra à mão um processo já ligado;
  o servidor só aceita processo cujo `vinculos` cite o de origem. O dado
  guardado é o número do processo derivado. A origem (`origem.ref {modulo, id, numero,
  titulo}`) é relida no servidor (`refDaOrigem`): de outro módulo, pede a
  integração ligada e confere o órgão; de outro processo (`'pe'`), passa por
  `lerProcesso` (quem não vê o processo não deriva dele) e guarda só o
  número, porque o assunto pode ser sigiloso para quem vê o novo. Vale mesmo
  com a origem oculta no formulário do tipo, aparece na Capa ("Nasceu de") e
  no PDF da equipe, e nunca vai às partes. O processo guarda em `vinculos`
  as chaves `modulo:id` da origem, dos campos de registro e dos registros
  pedidos por ações (`vinculos_acoes`, que a correção de dados não apaga);
  a ação `vinculados` procura por elas (índice `organization_id` +
  `vinculos`, até 50, só os que a pessoa vê, sem os excluídos e sem aqueles
  em que ela é parte). A busca não escreve nos outros módulos. Processos autuados
  antes não têm `vinculos` e só aparecem depois de uma correção de dados.
- **Atalho para ativar** (nov/2026): com o PE ou a integração desligados, quem
  configura o PE (criador ou `configure_secretaria`) vê, na ficha de uma
  Consulta, Expediente, Parceria ou Júri, um aviso com "Ativar e ligar" (ou
  "Ligar integração") e "Agora não" (vale para o navegador). A confirmação
  explica o que a primeira ativação cria; o botão chama `ativar` (se preciso) e
  `salvarIntegracoes` com as demais integrações como estão. A página do PE
  desativado ganha "Ativar agora" para o admin. O servidor confere o admin.
- **Selo e filtro "Processo eletrônico" nas listas** (nov/2026): as tabelas
  de Consultas, Expedientes, Parcerias e Júris mostram o selo "PE" ao lado do
  número do registro que tem processo eletrônico, e ganham o filtro
  "Processo eletrônico: qualquer, com ou sem" (conta nos filtros ativos, é
  limpo com os demais e entra nas visões salvas; visão antiga vale
  "qualquer"; no Júri, sai no cabeçalho dos relatórios). Vem da ação
  `indice` (`secretariaProcesso`): lê o órgão em páginas de 500 até 5000
  (`select` só dos campos de acesso, número, assunto, partes e `vinculos`),
  fica com os que a pessoa vê (mesma regra de `vinculados`: sem excluídos,
  sem aqueles em que ela é parte, restrito só para quem pode) e devolve
  `{processos[{id, numero, assunto, partes_resumo}], com{modulo: ids[]},
  truncado}`; `com` só traz módulos com a integração ligada. Membro sem
  lotação recebe a lista vazia sem leitura. Com `truncado`, o "sem" some.
  O cliente guarda em `['sec-processos', orgId, 'indice']` por 5 minutos,
  a mesma chave da busca Ctrl+K, e as invalidações que já existem (autuar,
  corrigir, excluir) a renovam. Custo: uma leitura por processo do órgão a
  cada 5 minutos por pessoa que abre as listas. "Sem PE" considera só os
  processos que quem filtra vê. (`EditorTipo.jsx`): abas Dados (nome,
  sigla, rito, sigilo, unidade, órgão, urgência, situação e o fluxo do rito),
  Formulário e Numeração, com a prévia ao lado no computador e atrás do botão
  Prévia no celular. A aba com ajuste pendente leva um ponto, e o rodapé diz
  quantos ajustes faltam (o link leva à aba).
- **Uma só tela de autuação** (`FormularioAutuacao.jsx`): o "Novo processo"
  e a prévia no editor do tipo usam o mesmo componente, então a prévia é
  exatamente o que quem autua vê. Abaixo dela, "O que as partes veem no
  portal" mostra, com o que for preenchido na prévia, os campos marcados para
  as partes.
- **Campos próprios** (até 40): nome, tipo (texto curto, texto longo, número,
  data, lista que escolhe uma, lista que marca várias (`multipla`, valor em
  lista de textos, na ordem das opções), sim ou não), obrigatório, orientação
  para quem preenche e "mostrar às partes no portal" (desligado por padrão).
  A ordem da lista é a ordem no formulário; a configuração tem prévia.
  - **Formato** (`formato`): texto curto como e-mail, telefone com DDD, CPF ou
    CNPJ (dígitos verificadores conferidos, inclusive o CNPJ alfanumérico da
    IN RFB 2.229/2024; gravado com pontuação) ou endereço da internet (só http
    e https; sem esquema vale https); número como valor em reais (`moeda`,
    duas casas, mostrado "R$ 1.234,50"). No celular, cada formato abre o
    teclado certo.
  - **Seção** (`secao`): título que aparece antes do primeiro campo dela.
  - **Mostrar só quando** (`condicao {campo_id, valor}`): o campo depende de
    uma lista, múltipla escolha ou sim ou não que venha antes dele. Escondido,
    não é pedido, não é obrigatório e o que tiver sido digitado é descartado
    pelo servidor; vale em cadeia (se o campo de que depende some, este some).
  - **Exigir para sair das fases** (`exigir_em`, fases do rito do tipo; o
    servidor descarta as que não são): o campo pode ficar em branco na
    autuação, mas, na fase marcada, "Preencher ..." entra nas exigências do
    rito. Sair da fase sem ele pede o motivo da dispensa, que fica no
    movimento, como os documentos exigidos. Exigido numa fase não é
    obrigatório na autuação. A autuação copia a lista para o processo
    (`campos_exigidos`), mas na hora de sair da fase só conta o campo que o
    tipo ainda pede, com o nome e a condição de agora (um campo retirado do
    tipo não teria como ser preenchido). Salvar o tipo com o campo exigido só
    em fases que não existem mais no rito é recusado.
    Na fase, o cartão mostra "Falta preencher X" com o botão **Preencher**,
    que abre a correção dos dados já no campo.
- **Na autuação:** o modal mostra os campos do tipo escolhido e diz o que
  falta. O servidor valida de novo (`validarCampos` e `validarPadrao` em
  `functions-v2/src/shared/camposProcesso.ts`): obrigatório vazio, número,
  data, opção de lista e formato inválidos são recusados com o nome do campo.
- **No processo:** os valores ficam em `campos[]`, com a cópia do nome e do
  tipo do campo. Mudar o tipo de processo depois não altera os valores já
  gravados; um campo retirado do tipo continua no processo como foi gravado.
  A correção segue o formulário atual, mas um campo obrigatório criado depois
  não é cobrado de processo que nunca o teve (`formParaCorrecao`, no servidor
  e na tela); o obrigatório já gravado não pode ser apagado, e o que só estava
  oculto pela condição volta a ser cobrado quando a resposta o faz aparecer.
  A descrição que o tipo passou a exigir não trava processo autuado sem ela.
  Os valores entram no movimento de autuação (cadeia de hashes), aparecem em
  "Identificação", na Capa, e contam na busca da lista (`campos_resumo`).
- **Correção:** valor que volta igual ao gravado fica como está, mesmo que o
  tipo tenha passado a pedir formato ou mudado as opções; só o valor alterado
  segue as regras de agora. Campo que virou lista de várias opções (ou o
  contrário) chega à tela já convertido.
  Mais › "Corrigir dados ou retificar a autuação", no Andamento
  (`alterarDados`, exige a posse do processo)
  corrige a descrição e os campos próprios. O movimento `dados` registra o que
  mudou (de/para) e o motivo, e não aparece para as partes.
- **Retificação da autuação** (13/11/2026): a mesma tela (o formulário da
  autuação com `retificar`) muda assunto, origem, sigilo e partes, quando o
  tipo os usa. Cada dado só muda se vier no pedido (cliente antigo segue
  igual), e o dado não mexido não é cobrado por regra nova do tipo. Exige
  motivo com ao menos 5 letras e grava o movimento `retificacao` ("Termo de
  retificação da autuação"), **sempre nos autos**, fora do portal e fora da
  configuração "dados" do rito, porque mexe na identificação do processo;
  mudança mista leva descrição e campos no mesmo termo. Assunto vazio volta
  ao nome do tipo (ou do rito). A ligação com o registro de origem nunca vem
  do cliente nem sai; só o tipo e a referência mudam.
  **Partes** (`retificarPartes`): a lista só cresce e a posição de cada parte
  nunca muda (comunicações e convites apontam pelo índice). Parte existente
  não perde o nome; sai por "Retirar", que grava `retirada` e não volta atrás
  (para desfazer, inclua a parte de novo). Do cliente vêm só nome, documento,
  e-mail, polo e o pedido de retirada; conta, convites e representantes ficam
  como estavam. Polo antigo que o tipo deixou de aceitar pode ficar; polo novo
  ou trocado segue o tipo. O limite de 50 conta as retiradas. Retirar parte
  com comunicação aguardando ciência é recusado (torne-a sem efeito antes).
  A retirada revoga o convite da parte e os dos representantes, tira as
  contas deles e recalcula `partes_uids`. A parte retirada guarda os dados
  gravados (edição feita na mesma linha não vale). Renomear parte leva o nome
  novo ao convite pendente, aos prazos abertos dirigidos a ela, às
  comunicações aguardando ciência e às petições em aberto (o portal casa
  prazos e petições pelo nome); o que já se cumpriu guarda o nome da época.
  O motivo abre o texto do termo e vai também em `dados.motivo`. Parte retirada não recebe comunicação nem
  convite, não aceita convite, some da lista de partes do portal, da certidão
  de andamento e do PDF das partes, aparece riscada na tela e na Capa (fora da
  contagem) e "(retirada)" no PDF da equipe;
  `partes_resumo` a mantém para a busca achar o histórico. Trocar o tipo do
  processo não é retificação: use "Novo processo derivado deste".
- **Arquivos na autuação** (13/11/2026): o Novo processo aceita até 10
  arquivos (50 MB cada). Depois de autuar, a tela os envia um a um como
  minutas (`secretariaDocumento` `upload`), internas e fora do portal; uma
  falha não desfaz a autuação e o aviso diz o que anexar no processo. A minuta
  não cumpre a exigência "juntar" do rito até ser juntada.
- **Tela cheia no celular**: Novo processo e a correção dos dados ocupam a
  tela inteira no celular, com o rodapé (Cancelar e Autuar/Salvar) fixo e
  respeitando a área segura; no computador seguem como janela.
- **Portal:** as partes veem só os campos marcados "mostrar às partes".

Processo autuado sem tipo (escolhendo o rito) usa o formulário padrão. O
espelho da tela fica em `src/lib/camposProcesso.js`; os componentes, em
`components/secretaria/CamposProcesso.jsx`.

**Mudança de fase guiada.** A tela do processo mostra a fase atual, sua
orientação e o fluxo com a fase destacada. O diálogo oferece as próximas
fases previstas; ir para outra fase é permitido, mas exige motivo, e o
movimento fica marcado "fora do fluxo do rito" (`dados.fora_do_fluxo`).
O portal das partes mostra o diagrama sem as orientações internas.

## Papel timbrado e controles (fase 5)

- **Órgão:** Painel Administrativo → Processo Eletrônico → "Documentos e modelos": papel timbrado e tipos de documento (até 4
  linhas de cabeçalho, brasão PNG/JPG até 300 KB, rodapé, fonte e tamanho
  padrão, com prévia da folha) e "Modelos de documento". Auditoria:
  `SECRETARIA_DOCUMENTO_CONFIG`, `SECRETARIA_MODELO_SALVO`.
- **Plataforma:** Administração → aba "Processo Eletrônico" lista os órgãos com o
  módulo ligado e o volume de processos, e permite **suspender** com motivo
  (`secretariaConfig.suspensa_plataforma`, `motivo_suspensao`). Suspenso, o
  órgão (equipe e partes) não acessa os processos; nada é apagado. O admin do
  órgão vê o motivo. Auditoria: `SECRETARIA_SUSPENSA_PLATAFORMA`,
  `SECRETARIA_REATIVADA_PLATAFORMA`.

## Busca, painel, calendário, conferência e Word/Excel (fase 6)

- **Busca:** as abas Caixa e Todos buscam por número, assunto, tipo, nome ou
  CPF/CNPJ das partes (sem acento e com ou sem pontuação). "Mais filtros" abre
  unidade atual, fase, tipo, status, sigilo e período de autuação; "Limpar
  filtros" volta ao padrão. `listar` passou a devolver `partes_resumo`,
  `autuado_em`, `rito_id` e `pendencia_desde` (pendência aberta mais antiga).
- **Painel:** aba nova com totais (em tramitação, com pendência, prazos
  vencidos e da semana, sobrestados, arquivados), idade média, barras por
  unidade, fase e tipo, pendências mais antigas e prazos da semana. Filtra por
  unidade (visão da secretaria ou do gabinete). Calculado sobre os processos
  que a pessoa pode ver.
- **Prazos no calendário** (nov/2026): o Painel termina com o calendário do
  mês com os prazos abertos dos processos em tramitação que a pessoa vê
  (`listar` devolve `prazos_abertos`: até 5 por processo, data e descrição de
  até 60 caracteres, sem destinatário; servidor antigo cai no
  `proximo_vencimento`). Clicar no prazo abre o processo. A aba "Calendário de
  Vencimentos" do órgão (flag `deadline_calendar`) mostra os mesmos prazos ao
  lado das datas de Consultas, Expedientes e Parcerias, e aparece também no
  órgão que só usa o Processo Eletrônico (não com o PE suspenso). A legenda
  mostra só os tipos de data do mês na tela; o calendário do órgão avisa
  enquanto os prazos do PE carregam ou se a leitura falhar; a lista do Painel
  avisa quando foi cortada em 5.000.
- **Calendário do órgão:** Painel Administrativo → Processo Eletrônico → "Calendário".
  Feriados locais (até 200) prorrogam o vencimento e não contam em dias
  úteis; recessos (até 50, de até 120 dias cada) e o recesso forense
  opcional (20/12 a 20/01, CPC art. 220) suspendem a contagem até em dias
  corridos. Vale para prazos abertos depois de salvar. Auditoria:
  `SECRETARIA_CALENDARIO`.
- **Alerta de prazos:** com `alerta_prazos` ligado, `secretariaAlertaPrazos`
  envia às 7h um e-mail por pessoa lotada na unidade que tem o processo, com
  os prazos vencidos ou que vencem em até 2 dias. Órgão suspenso ou com o
  módulo desligado não recebe.
- **Código de conferência:** toda juntada (equipe ou petição da parte) cria um
  código de 16 caracteres (80 bits, base32 Crockford, `XXXX-XXXX-XXXX-XXXX`)
  e o registro `secVerificacao/{código}`. Cada folha do PDF carimbado traz o
  QR e o código no alto à esquerda. A página pública `/Conferir?c=CÓDIGO`
  mostra órgão, processo, documento, folhas, juntada, assinaturas e hashes, e
  compara no navegador o hash de um arquivo original (nada é enviado).
  Documentos juntados antes da fase 6 ganham código na primeira vez que o PDF
  é gerado. O processo mostra o código ao lado de cada documento dos autos.
- **Word e Excel:** DOCX (mammoth → HTML → documento do editor) e XLSX (cada
  aba vira título e tabela; até 10 abas, 400 linhas e 20 colunas) passam a
  virar folhas com conteúdo, no mesmo renderizador dos textos redigidos, e
  contam as páginas reais. O portal aceita petição em DOCX. Arquivo
  corrompido vira folha de referência com o hash.

## Limites conhecidos

- O impedimento de quem é parte vale a partir do aceite do convite: até lá, a
  pessoa ainda vê o processo como membro. Não há impedimento por parentesco
  ou interesse: só por constar como parte ou representante habilitado.
- Partes não têm verificação em duas etapas. A íntegra em PDF do portal segue
  os mesmos limites de tamanho da exportação da equipe.
- A marca de lido do leitor e o rascunho da manifestação ficam no navegador
  (localStorage): não acompanham a parte em outro aparelho.
- Os avisos por e-mail às partes e à equipe (e o sino) são disparados depois
  da transação; se a function for encerrada antes, o aviso daquele movimento
  não sai (o portal e as abas continuam mostrando a novidade).
- O resumo diário por e-mail lê até 500 pessoas com a preferência "resumo" e
  100 avisos não lidos por pessoa; os avisos de prazo no sino não são
  deduplicados entre dias (um por processo por dia).
- Se a gravação da petição falhar depois do envio do anexo ao Storage, o
  arquivo fica órfão no bucket (sem referência nos autos). No envio de
  arquivo pela equipe, o arquivo é apagado se o registro falhar.
- Assinatura só no nível simples. gov.br e ICP-Brasil dependem de credenciais
  externas (cadastro no gov.br e certificado/serviço de assinatura) e ainda não
  foram implementadas; o mesmo vale para pedir assinatura a outra pessoa.
- O calendário do órgão não recalcula prazos já abertos.
- O alerta de prazos lê até 2000 processos com vencimento próximo por dia, em
  todos os órgãos.
- A conferência pública mostra os metadados da juntada (inclusive título e
  número de processo restrito) a quem tem o código; o código só sai impresso
  nas folhas do próprio documento. Ela aceita 60 consultas por hora por
  endereço de rede (`secLimites`, guardado como hash e apagado por TTL).
- `listar` sem `limite` (Meu trabalho, Mesa de decisão, Painel e busca)
  lê a caixa pelas unidades da pessoa e "todos" em páginas de 500, até 5000
  processos (`truncado` avisa quando passa); as abas Caixa e Todos paginam no
  servidor. Na forma paginada, a posse e o
  sigilo são filtrados depois da leitura, então uma página pode vir menor e
  os filtros da tela valem só sobre o que foi carregado.
- Versões de rito e modelo: até 20 por item; a versão de um modelo guardado
  no arquivo original não guarda o arquivo (só nome, tipo e descrição). O
  histórico de configuração mostra as últimas 300 ações. Unidade e órgão
  interno excluídos não voltam pela Lixeira.
- O rascunho da revisão de rito fica no navegador (localStorage), um por
  órgão: não acompanha o admin em outro aparelho.
- O PDF volta inteiro na resposta da function; anexos acima de ~18 MB somados
  viram folha de referência.
- DOC e ODT antigos não são convertidos (exigem LibreOffice num serviço à
  parte); viram folha de referência. No Word, caixas de texto, cabeçalhos e
  notas de rodapé do arquivo não entram nas folhas.
- O Painel e a busca trabalham sobre a mesma lista de até 5000 processos.
- No PDF, as fontes Times e Courier só têm caracteres latinos (WinAnsi);
  outros símbolos saem como "?". Arial (Roboto) cobre mais caracteres.
- Localizar e substituir não acha texto que atravessa mudança de formatação.
- O índice de documentos da exportação cabe numa página (~45 documentos).
- Processos anteriores à fase 5 não tinham folhas; a contagem deles soma as
  páginas conhecidas (1 quando não há).
- Importação de modelos: do Word não vêm alinhamento, recuos, cores nem caixas
  de texto (limite do mammoth); do PDF só vem texto, até 30 páginas. Campo que
  o Word dividiu entre parágrafos não é preenchido no original. Desativar um
  modelo original não apaga o arquivo do Storage (trocar o arquivo sobrescreve).
- Importação de ritos: até 60 fases por rito (`MAX_FASES`; a revisão aponta
  o excesso), 30 unidades e 60 modelos novos por implantação. Do PDF só vem o
  texto (sem tabelas nem desenhos); fluxograma em imagem ou PDF desenhado
  (inclusive o PDF de documentação do Bizagi) não é lido como fluxo, só
  Bizagi (.bpm), BPMN, XPDL, draw.io e Mermaid. Etapas paralelas viram
  sequência (não há tramitação em paralelo). O formato interno do .bpm não é
  publicado pelo Bizagi: a leitura segue o pacote conhecido (ZIP com `.diag` e
  `Diagram.xml` em XPDL); se uma versão gravar diferente, a mensagem pede a
  exportação em BPMN ou XPDL. Visio (.vsdx) e ODT não são lidos. Unidades criadas pelo rito
  nascem sem equipe e os modelos criados são esqueletos para completar. A
  unidade da fase é sugestão: tramitar continua sendo um ato da equipe.
