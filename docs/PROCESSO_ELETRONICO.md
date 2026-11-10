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
  Ali fica **toda a configuração**: ativação, preferências, unidades e equipes,
  tipos de processo, ritos, documentos e modelos do órgão e calendário.
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
  (Ctrl+K) como "Processo Eletrônico · órgão". Na página, o admin tem o botão
  **Configurar**, que abre o Painel Administrativo na aba do módulo; quem não
  é admin, com o módulo desligado, é levado à página inicial do órgão.

## Perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| Organização | Admin do órgão (`configure_secretaria` ou criador) | Ativa, cria e edita unidades, define ritos, tipos de processo, timbrado e modelos do órgão, consulta todos os processos |
| Gestor da unidade | Lotado com a marca de gestor | Monta a equipe da unidade (insere membros, convida por e-mail, admite pedidos, define atribuições e outros gestores), escolhe o timbrado, os tipos de documento e os modelos da unidade |
| Secretaria | Lotado em unidade do tipo `secretaria` | Autua, junta, tramita, muda fase, atribui, sobrestá e arquiva quando tem o processo |
| Decisão | Lotado em unidade do tipo `gabinete` | Os mesmos atos quando o processo está no gabinete (ex.: minuta de decisão, assinatura, juntada, devolução) |
| Assessoria e outras | Lotado em unidade do tipo `assessoria` ou `outra` | Os mesmos atos de movimentação quando tem o processo (ex.: estudo e minuta) |
| Partes e representantes | Qualquer conta (externa **ou de membro do órgão**), habilitada por convite; o vínculo é por processo, nunca por `userOrganizations` | Pelo portal (`/Portal`): acompanham os processos em que foram habilitadas e peticionam a qualquer tempo. Um representante (advogado, procurador, preposto) tem a própria conta e fala pela parte. Quem é parte num processo **não é o órgão nele**: veja "Parte e membro: dois papéis" |

O poder de movimentar vem da **posse**: o processo está sempre com uma unidade
(`unidade_atual`) e só quem está lotado nela age sobre ele.

## Visibilidade

- **Sigilo normal:** qualquer membro lotado em alguma unidade do órgão lê.
- **Sigilo restrito:** só unidades por onde o processo passou
  (`unidades_historico`) e o admin.
- **Minutas:** só a unidade que as redigiu, até a juntada.
- Membro do órgão sem lotação não vê processo nenhum (salvo o admin). A página
  mostra a ele a aba Unidades, de onde pode pedir lotação.
- Membro com vínculo inativo no órgão não acessa o módulo.

## Unidades de lotação e equipes

Cada unidade tem tipo (`secretaria`, `gabinete`, `assessoria`, `outra`), nome,
sigla, descrição e uma **equipe**: cada pessoa lotada tem uma atribuição (texto
livre, ex.: "Chefe de secretaria") e pode ser **gestora** da unidade.

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

**Revisão** (`PropostaRito.jsx`): no alto, o fluxo inteiro desenhado na
notação do Bizagi (ver "Diagrama do fluxo" abaixo), atualizado ao vivo; clicar
numa fase do desenho abre o cartão dela. Abaixo, cada fase em cartão
recolhível (o cabeçalho resume unidade, prazo e saída), com nome, prazo,
unidade (existente, nova ou nenhuma), quem faz, ações, modelos, encaminhamentos
com condição, fase final e orientação. As observações da leitura do arquivo
ficam num bloco que abre e fecha. Ao lado: unidades novas (renomear, tipo ou trocar por uma existente), modelos novos
(renomear, tipo de documento ou trocar por um existente) e a opção de criar o
tipo de processo. Unidades e modelos com o mesmo nome dos já existentes são
ligados a eles, sem duplicar.

**Implantar** (`aplicarPropostaRito`, só admin) grava tudo num lote atômico:
as unidades novas (equipe vazia, para o gestor ou admin lotar), os modelos
novos como esqueleto no editor (título, número, assunto, partes, local e data,
signatário) na unidade da fase, o rito (`origem: 'importacao'`) e, se pedido, o
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
| `secUnidades/{id}` | `organization_id, nome, sigla, tipo (secretaria\|gabinete\|assessoria\|outra), descricao, lotacoes[{uid, atribuicao, gestor}], membros_uids[]` (espelho de `lotacoes`), `pedidos[{uid, nome, email, mensagem, em}], ativa` |
| `secUnidadeConfig/{unidadeId}` | `organization_id, timbrado_proprio, documento` (mesmo formato do timbrado do órgão), `tipos_documento[]` |
| `secConvitesEquipe/{sha256 do token}` | `organization_id, unidade_id, email, atribuicao, criado_por, criado_por_nome, expira_em, usado_por, revogado` |
| `secRitos/{id}` | `organization_id, nome, descricao, fases[{id, nome, prazo_dias?, orientacao?, proximas?[], final?, unidade_id?, agente?, acoes?[] (até 20), modelos?[] (até 10), condicoes?{fase_id: texto}}], versao, ativo, origem? ('importacao')` |
| `secRitos/{id}/versoes/{000n}` e `secModelos/{id}/versoes/{000n}` | versão anterior (até 20 por item): `versao, salvo_em, salvo_por` e os campos de conteúdo (`nome, descricao, fases` ou `nome, tipo_documento, descricao, conteudo`) |
| `secTipos/{id}` | `organization_id, nome, sigla, descricao, rito_id, sigilo_padrao, unidade_inicial, ativo, formulario{descricao, partes ("opcional" \| "obrigatorio" \| "oculto"), campos[{id, rotulo, tipo, obrigatorio, ajuda, opcoes[], visivel_partes}]}` |
| `secContadores/{org}_{ano}` | `seq` da numeração anual (`000001/2026`) |
| `secProcessos/{id}` | `numero, assunto, descricao, partes[], campos[{id, rotulo, tipo, valor, visivel_partes}], origem{tipo, descricao}?, sigilo, status, tipo_id?, tipo_nome?, rito_id, rito_versao, fases[]` (cópia), `fase_atual, unidade_atual, unidades_historico[], responsavel_uid, mov_seq, doc_seq, folhas_seq, ultimo_hash, version, recebido_em, acoes_feitas{faseId: [idx]}, orientacao{texto, por, em, de}?, assinaturas_pendentes[{docId, uid, titulo}]` |
| `secProcessos/{id}/movimentos/{seq}` | `seq, tipo, descricao, autor_uid, autor_nome, unidade_id, em, dados, hash_anterior, hash` |
| `secProcessos/{id}/documentos/{id}` | `titulo, tipo, origem (editor\|upload), status (minuta\|juntado), unidade_origem, conteudo` (ou `delta` legado) ou `storage_path, mime, tamanho`, `sha256, assinaturas[], assinaturas_pedidas[{uid, nome, por, em}]?, ordem, juntado_em, visivel_partes, peticao?, peticao_tipo?, paginas, folha_inicial, folha_final, pdf_path?, pdf_sha256?, codigo_verificacao?` |
| `secConfig/{org}` | `documento: {cabecalho_linhas[], brasao, rodape, fonte_padrao, tamanho_padrao, tipos_documento[]}` (papel timbrado), `calendario: {feriados[{data, descricao}], recessos[{inicio, fim, descricao}], recesso_forense}`, `alerta_prazos` |
| `secVerificacao/{código}` | cópia pública da juntada: `organization_id, processo_id, documento_id, orgao, numero, ordem, titulo, tipo, origem, nome_arquivo, juntado_em, juntado_por, folha_inicial, folha_final, paginas, assinaturas[{nome, em, nivel}], sha256, pdf_sha256, peticao` |
| `secModelos/{id}` | `organization_id, unidade_id?` (vazio = modelo do órgão), `nome, tipo_documento, descricao, ativo, versao, formato (editor\|original)`, `conteudo` (editor) ou `storage_path, arquivo_nome, arquivo_mime, tamanho` (original) |
| `secConvites/{sha256 do token}` | `organization_id, processo_id, parte_idx, parte_nome, email, expira_em, usado_por, revogado` |
| `secPortalAcessos/{uid da parte}` | `avisos` (`tudo`, `prazos`, `nenhum`), `email`, `processos{processoId: último acesso ISO}` — fechada ao cliente; só o portal grava |
| `notifications/{id}` (coleção da plataforma) | avisos da equipe: `user_id, type: 'processo_eletronico', subtype, title, message, organization_id, entity_type: 'processo_eletronico', entity_id (processo), read, created_at` — gravada só pelas functions; o dono lê e marca como lida |
| `userPreferences/{uid}.notificationPreferences.processo_eletronico` | `{ sino, email }` — preferência de aviso da pessoa, gravada pelo cliente |

No processo, cada item de `partes[]` pode ter `uid` (conta habilitada),
`convite_hash` (último convite) e `representantes[]` (até 5 por parte, cada um
`{ nome, email?, uid?, convite_hash?, habilitada_em?, conta? }`);
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
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade` (admin; gestor só equipe e descrição), `obterUnidadeDocumento`, `salvarUnidadeDocumento` (gestor), `convidarEquipe`, `revogarConviteEquipe`, `convitesPendentes`, `pedirLotacao`, `decidirPedido` (gestor), `verConviteEquipe` e `aceitarConviteEquipe` (quem tem o link), `salvarRito`, `salvarTipo`, `salvarPreferencias`, `salvarDocumentoConfig`, `salvarModelo` (admin; gestor para modelo da unidade; aceita `formato: 'original'` com o arquivo), `importarModelo` (mesma permissão; só interpreta e devolve a proposta), `obterModelo` e `baixarModelo` (qualquer membro; `baixarModelo` com `valores` devolve o Word preenchido), `extrairTextoRito` e `aplicarPropostaRito` (admin; ver Importação de ritos), `salvarCalendario`, `versoes` e `restaurarVersao` (`colecao: 'rito' \| 'modelo'`; admin, ou gestor para modelo da unidade) |
| `secretariaProcesso` | `listar` (com `limite` e `cursor`, paginado), `contadores`, `obter`, `autuar` (opcional `origem`), `tramitar` (opcionais `fase_id` e `orientacao`), `atribuir`, `avancarFase`, `alterarStatus`, `abrirPendencia`, `resolverPendencia`, `abrirPrazo`, `encerrarPrazo`, `convidarParte`, `revogarParte`, `marcarAcao`, `concluirOrientacao`, `alterarDados` (descrição e campos próprios do tipo) |
| `secretariaPortal` | (partes, sem vínculo com o órgão) `aceitarConvite`, `preferencias`, `meusProcessos`, `obter`, `baixar`, `pdf`, `peticionar`, `exportar`, `certidao`, `comprovante` |
| `secretariaDocumento` | `criarMinuta`, `editarMinuta`, `upload`, `assinar`, `pedirAssinatura`, `juntar` (opcionais `assinar` e `resolve_pendencia_id`), `excluirMinuta`, `baixar`, `pdf` (prévia da minuta com marca d'água ou documento juntado carimbado) |
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

## Documentos

- Todo documento nasce **minuta** da unidade que tem o processo, redigido no
  editor ou enviado (PDF, PNG, JPG, TXT, DOC, DOCX, ODT, XLSX; até 5 MB, limite
  do envio por function).
- O **editor** (TipTap) mostra uma folha A4 com o papel timbrado e tem as
  ferramentas de um processador de texto: estilos (títulos, citação), fonte e
  tamanho, negrito, itálico, sublinhado, tachado, sobrescrito, subscrito, cor
  e realce, alinhamento, espaçamento entre linhas, recuo de primeira linha e
  de parágrafo, listas, tabelas (mesclar, dividir, cabeçalho), imagem PNG/JPG,
  link, linha horizontal, quebra de página (Ctrl+Enter), caracteres
  especiais, localizar e substituir, limpar formatação, desfazer/refazer, zoom
  e contagem de palavras. Ctrl+S salva.
- O conteúdo é gravado como JSON do ProseMirror em `conteudo`. O servidor
  (`shared/documento.ts`, `sanitizeDoc`) mantém só uma lista fechada de nós,
  marcas e atributos: link só `http(s)`/`mailto`, imagem só data URL PNG/JPEG
  (até 1,5 MB cada), documento até 4 MB. Nada é interpretado como HTML.
  Minutas antigas em Delta continuam abrindo (`deltaParaDoc`).
- **Modelos:** o admin cria textos prontos com campos (`{{numero}}`,
  `{{partes}}`, `{{data_extenso}}` etc.) que se preenchem ao começar a redigir.
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
  inalterada). `shared/autos.ts` classifica cada um pela origem:
  **sistema** (`TIPOS_SISTEMA`: `atribuicao`, `acao_fase`,
  `orientacao_concluida`, `convite`, ou `dados.automatico === true`) ou
  **usuário** (todo o resto).
- **Termo.** Ato de usuário que não juntou documento (`geraTermo`) tem como
  página um termo de uma folha, gerado do próprio movimento (título por tipo
  em `tituloEvento`, descrição, autor, unidade, data, hora e hash). A partir
  desta versão, `registrarMovimento` reserva a folha: grava `folha` no
  movimento e avança `folhas_seq` do processo. Movimentos antigos não têm
  `folha`: o termo sai sem número de folha e nada é renumerado. Processo
  antigo com documentos e sem `folhas_seq` também fica sem folha no termo.
- **Tela.** `EventosAutos.jsx` (equipe e portal): tabela com nº, data e hora,
  evento, quem e folhas; filtros Todos, Atos de usuários, Sistema e Com
  documentos; busca; ordem. `obter` devolve em cada movimento `origem`,
  `titulo`, `folhas` e `documento_id` (`extrasDoEvento`). "Ler os autos"
  usa o `LeitorAutos` evento a evento. A tabela fica na aba **Eventos** da
  tela do processo; a **Capa** mostra a cronologia dos atos dos autos.
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
  trabalho; filtro "Urgentes"; linha "Tramitação: URGENTE" na capa do PDF;
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
  de ciência por decurso e Certidão de comunicação sem efeito, todos com folha.
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
- **Ações de `secretariaConfig`** (só admin): `salvarOrgao {id?, orgao}`,
  `removerOrgao {id}` (recusa órgão com unidades ou subordinados) e
  `criarEstrutura {orgaos: [{chave, pai_chave, ..., unidades: [{nome, tipo}]}]}`
  (assistente; soma aos existentes). `estado` devolve `orgaos` na ordem do
  organograma, com `nivel`. `salvarUnidade` e `salvarTipo` validam
  `orgao_id` e só o alteram quando o campo vem no pedido.
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

Gerada no servidor com `pdf-lib` e `pdfmake`: capa (dados, partes,
integridade; "cópia parcial" quando há seleção), índice dos autos (atos de
usuário com folhas e hash) e as peças em ordem cronológica: cada documento
juntado, carimbado com as folhas gravadas na juntada, ou o termo do ato. Ao
fim, o "Extrato de registros do sistema". Redigidos entram com o PDF guardado na juntada (ou renderizado
de novo, se forem antigos); PDFs enviados entram página a página; PNG/JPG como
imagem; TXT como texto; Word/planilha como folha de referência com o hash.
Minutas nunca entram.
A exportação é registrada em `auditLogs` (`SECRETARIA_PDF_EXPORTADO`).

## Conclusão, pendências e prazos (fase 2)

- **Conclusão:** tramitar para uma unidade do tipo gabinete grava o movimento
  `conclusao` ("Conclusos a ..."). Devolver à secretaria é tramitação comum.
- **Pendências** (`processo.pendencias[]`): o que o decisor precisa apreciar.
  Abrem-se à mão (`abrirPendencia`) ou na juntada de um documento
  (`juntar` com `pendencia: 'sim' | 'interrompe'`). Cada uma pode **interromper
  a fase**: enquanto houver pendência aberta que interrompe, `avancarFase` é
  recusado. Só o **gabinete** que tem o processo aprecia (`resolverPendencia`,
  com a decisão por escrito); apreciada a última que interrompia, a fase volta
  a correr. A fase 3 usa o mesmo mecanismo para a petição da parte.
- **Prazos** (`processo.prazos[]`): `abrirPrazo` com dias, contagem (úteis ou
  corridos) e destinatário. O vencimento segue o CPC, art. 224: exclui o dia
  do começo, inclui o do fim e prorroga para o primeiro dia útil. Dias úteis
  excluem sábados, domingos e feriados nacionais (fixos, Carnaval, Sexta-feira
  Santa e Corpus Christi). `encerrarPrazo` marca cumprido (no prazo ou fora
  dele) ou cancelado.
- O processo grava `pendencias_abertas`, `fase_suspensa` e
  `proximo_vencimento`, que a lista usa em selos e filtros (com pendência,
  com prazo, prazo vencido).

## Portal das partes (fase 3)

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
  aparecem.
- **Petição a qualquer tempo:** texto e/ou um anexo PDF, PNG ou JPG até 5 MB.
  É juntada na hora com número de ordem e assinatura simples da parte, gera o
  movimento `peticao` (com a tempestividade diante dos prazos abertos para ela
  ou sem destinatário) e abre pendência para o decisor. Se o admin ligar
  "Petição da parte interrompe a fase" (Painel Administrativo → Processo
  Eletrônico), a pendência suspende a fase até o gabinete apreciá-la. Vale
  também com o processo sobrestado ou arquivado.
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
  teclado, marca de lido no navegador e Baixar; cada documento tem o link de
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
  PDF). Assinar, juntar ou excluir a minuta limpa o pedido.
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
- **Modelos:** cada cartão mostra "Indicado em: Rito › Fase" quando alguma
  fase o indica; no editor, **Duplicar** abre uma cópia (sem id, "(cópia)" no
  nome) para ajustar e salvar como modelo novo.
- **Calendário:** botão **Repetir os de {ano} em {ano+1}** copia os recessos
  do último ano cadastrado para o seguinte (mesmos dias, pulando os que já
  existem) e deixa para revisar e salvar. Feriados nacionais, inclusive
  Carnaval, Sexta-feira Santa e Corpus Christi, já são contados pelo servidor
  (`feriadosNacionais()`); não há o que importar.
- **Histórico de configuração:** aba **Histórico** (`HistoricoConfiguracao.jsx`)
  lista as últimas 300 ações `SECRETARIA_*` de `auditLogs` do órgão (quem,
  quando, o quê, detalhes), lidas pelo cliente com o índice
  `organization_id + action + timestamp` já existente e as regras que liberam
  leitura ao admin do órgão.
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

**Editor visual** (`RitoEditor.jsx`): fases em cartões (reordenar, remover,
escolher o que vem depois, orientação) e o diagrama do fluxo
(`FluxoRito.jsx`, SVG) atualizado ao vivo.

**Diagrama do fluxo** (`FluxoRito.jsx`, geometria em `src/lib/fluxoBpmn.js`):
todo rito, importado ou não, é desenhado na notação BPMN usada pelo Bizagi, da
esquerda para a direita: uma raia por unidade, círculo verde de início,
tarefas em caixas azuis (com o prazo), losango amarelo quando a fase tem mais
de uma saída, círculo vermelho de fim, setas em ângulo reto com a condição
escrita e voltas tracejadas. Quando o fluxo não cabe na largura da tela, ele
continua na faixa de baixo (como um texto que muda de linha), para aparecer
inteiro e legível. Há zoom, ajuste à largura e tela cheia (Esc fecha); leitores
de tela recebem o fluxo em lista. O portal das partes não mostra as raias.

Pontos de partida:

- **Modelos prontos:** rito comum, requerimento simples, procedimento com
  contraditório (com recurso) e atendimento ao cidadão.
- **Planilha:** importa .xlsx, .xls, .ods ou .csv, ou texto colado do Excel.
  Colunas Fase | Prazo | Próximas | Orientação, em qualquer ordem se houver
  cabeçalho. Próximas por nome ou número da linha, separadas por `;`; "fim"
  encerra. Há planilha de exemplo para baixar.
- **Diagrama:** cola um fluxograma Mermaid (`flowchart TD`, `A[Nome] --> B`).
  "Nome - 10 dias" no rótulo define o prazo.
- **Exportar:** baixa o rito em .xlsx ou copia como Mermaid.

Conversões em `src/lib/secretariaRito.js`, testadas em
`src/lib/secretariaRito.test.js` (`npm run test:lib`).

**Tipo de processo** (`secTipos`): nome, sigla, descrição, rito, sigilo padrão
e unidade sugerida para autuar. Na autuação, escolher o tipo preenche rito,
sigilo e unidade; o processo guarda `tipo_id` e `tipo_nome`. A lista filtra
por tipo.

**Formulário do "Novo processo" por tipo** (`formulario` em `secTipos`). O
admin define, em cada tipo, o que quem autua preenche:

- **Campos padrão:** Descrição e Partes podem ser opcionais, obrigatórios ou
  não usados (não aparecem e não são gravados). Assunto, unidade e sigilo
  aparecem sempre.
- **Campos próprios** (até 20): nome, tipo (texto curto, texto longo, número,
  data, lista de opções, sim ou não), obrigatório, orientação para quem
  preenche e "mostrar às partes no portal" (desligado por padrão). A ordem da
  lista é a ordem no formulário; a configuração tem prévia.
- **Na autuação:** o modal mostra os campos do tipo escolhido e diz o que
  falta. O servidor valida de novo (`validarCampos` e `validarPadrao` em
  `functions-v2/src/shared/camposProcesso.ts`): obrigatório vazio, número,
  data e opção de lista inválidos são recusados com o nome do campo.
- **No processo:** os valores ficam em `campos[]`, com a cópia do nome e do
  tipo do campo. Mudar o tipo de processo depois não altera processos já
  autuados; um campo retirado do tipo continua no processo como foi gravado.
  Os valores entram no movimento de autuação (cadeia de hashes), aparecem em
  "Identificação", na Capa, e contam na busca da lista (`campos_resumo`).
- **Correção:** Mais › "Corrigir os dados do processo", no Andamento
  (`alterarDados`, exige a posse do processo)
  corrige a descrição e os campos próprios. O movimento `dados` registra o que
  mudou (de/para) e o motivo, e não aparece para as partes.
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
  arquivo fica órfão no bucket (sem referência nos autos).
- Assinatura só no nível simples. gov.br e ICP-Brasil dependem de credenciais
  externas (cadastro no gov.br e certificado/serviço de assinatura) e ainda não
  foram implementadas; o mesmo vale para pedir assinatura a outra pessoa.
- O calendário do órgão não recalcula prazos já abertos.
- O alerta de prazos lê até 2000 processos com vencimento próximo por dia, em
  todos os órgãos.
- A conferência pública mostra os metadados da juntada (inclusive título e
  número de processo restrito) a quem tem o código; o código só sai impresso
  nas folhas do próprio documento.
- `listar` sem `limite` lê até 1000 processos do órgão e filtra em memória
  (Meu trabalho, Mesa de decisão, Painel e busca ainda usam essa forma); as
  abas Caixa e Todos já paginam no servidor. Na forma paginada, a posse e o
  sigilo são filtrados depois da leitura, então uma página pode vir menor e
  os filtros da tela valem só sobre o que foi carregado.
- Versões de rito e modelo: até 20 por item; a versão de um modelo guardado
  no arquivo original não guarda o arquivo (só nome, tipo e descrição). O
  histórico de configuração mostra as últimas 300 ações.
- O rascunho da revisão de rito fica no navegador (localStorage), um por
  órgão: não acompanha o admin em outro aparelho.
- O PDF volta inteiro na resposta da function; anexos acima de ~18 MB somados
  viram folha de referência.
- DOC e ODT antigos não são convertidos (exigem LibreOffice num serviço à
  parte); viram folha de referência. No Word, caixas de texto, cabeçalhos e
  notas de rodapé do arquivo não entram nas folhas.
- O Painel e a busca trabalham sobre a mesma lista de até 1000 processos.
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
