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
repositório).

## Ativação

- Quem ativa: o **admin do órgão** (criador ou quem tem a permissão
  `configure_secretaria`), em Painel Administrativo → aba Processo Eletrônico.
  Ali fica **toda a configuração**: ativação, preferências, unidades e equipes,
  tipos de processo, ritos, documentos e modelos do órgão e calendário.
- Não depende de flag da plataforma. O estado fica em
  `organizations/{id}.secretariaConfig.enabled`, gravado só pela function
  `secretariaConfig` (ação `ativar`). Órgãos sem o campo ficam desligados.
- Na primeira ativação, se o órgão não tiver unidade nem rito, a plataforma cria
  a unidade "Secretaria" (com o admin lotado como gestor) e o "Rito comum" (Autuação →
  Instrução → Decisão → Cumprimento → Encerramento).
- Desativar esconde a página e bloqueia as functions. Nada é apagado.
- Página: `/ProcessoEletronico?org=<id>`; processo aberto: `&p=<processoId>`.
  Links antigos `/Secretaria?...` redirecionam. O link aparece no submenu do
  órgão quando o módulo está ativo. Na página, o admin tem o botão
  **Configurar**, que abre o Painel Administrativo na aba do módulo.

## Perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| Organização | Admin do órgão (`configure_secretaria` ou criador) | Ativa, cria e edita unidades, define ritos, tipos de processo, timbrado e modelos do órgão, consulta todos os processos |
| Gestor da unidade | Lotado com a marca de gestor | Monta a equipe da unidade (insere membros, convida por e-mail, admite pedidos, define atribuições e outros gestores), escolhe o timbrado, os tipos de documento e os modelos da unidade |
| Secretaria | Lotado em unidade do tipo `secretaria` | Autua, junta, tramita, muda fase, atribui, sobrestá e arquiva quando tem o processo |
| Decisão | Lotado em unidade do tipo `gabinete` | Os mesmos atos quando o processo está no gabinete (ex.: minuta de decisão, assinatura, juntada, devolução) |
| Assessoria e outras | Lotado em unidade do tipo `assessoria` ou `outra` | Os mesmos atos de movimentação quando tem o processo (ex.: estudo e minuta) |
| Partes | Externas, com conta própria, **nunca membros do órgão** | Pelo portal (`/Portal`): acompanham os processos em que foram habilitadas e peticionam a qualquer tempo |

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
<<<<<<< HEAD

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
=======
>>>>>>> 3b52f267a18d451b5857eda73cc4cc9a41c3a868

## Modelo de dados

Todas as coleções são fechadas ao cliente (`allow read, write: if false`). Leitura
e escrita passam pelas functions, que aplicam posse, lotação, sigilo e minutas.

| Coleção | Conteúdo |
|---|---|
| `secUnidades/{id}` | `organization_id, nome, sigla, tipo (secretaria\|gabinete\|assessoria\|outra), descricao, lotacoes[{uid, atribuicao, gestor}], membros_uids[]` (espelho de `lotacoes`), `pedidos[{uid, nome, email, mensagem, em}], ativa` |
| `secUnidadeConfig/{unidadeId}` | `organization_id, timbrado_proprio, documento` (mesmo formato do timbrado do órgão), `tipos_documento[]` |
| `secConvitesEquipe/{sha256 do token}` | `organization_id, unidade_id, email, atribuicao, criado_por, criado_por_nome, expira_em, usado_por, revogado` |
| `secRitos/{id}` | `organization_id, nome, descricao, fases[{id, nome, prazo_dias?, orientacao?, proximas?[], final?}], versao, ativo` |
| `secTipos/{id}` | `organization_id, nome, sigla, descricao, rito_id, sigilo_padrao, unidade_inicial, ativo` |
| `secContadores/{org}_{ano}` | `seq` da numeração anual (`000001/2026`) |
| `secProcessos/{id}` | `numero, assunto, descricao, partes[], sigilo, status, tipo_id?, tipo_nome?, rito_id, rito_versao, fases[]` (cópia), `fase_atual, unidade_atual, unidades_historico[], responsavel_uid, mov_seq, doc_seq, folhas_seq, ultimo_hash, version` |
| `secProcessos/{id}/movimentos/{seq}` | `seq, tipo, descricao, autor_uid, autor_nome, unidade_id, em, dados, hash_anterior, hash` |
| `secProcessos/{id}/documentos/{id}` | `titulo, tipo, origem (editor\|upload), status (minuta\|juntado), unidade_origem, conteudo` (ou `delta` legado) ou `storage_path, mime, tamanho`, `sha256, assinaturas[], ordem, juntado_em, visivel_partes, peticao?, paginas, folha_inicial, folha_final, pdf_path?, pdf_sha256?, codigo_verificacao?` |
| `secConfig/{org}` | `documento: {cabecalho_linhas[], brasao, rodape, fonte_padrao, tamanho_padrao, tipos_documento[]}` (papel timbrado), `calendario: {feriados[{data, descricao}], recessos[{inicio, fim, descricao}], recesso_forense}`, `alerta_prazos` |
| `secVerificacao/{código}` | cópia pública da juntada: `organization_id, processo_id, documento_id, orgao, numero, ordem, titulo, tipo, origem, nome_arquivo, juntado_em, juntado_por, folha_inicial, folha_final, paginas, assinaturas[{nome, em, nivel}], sha256, pdf_sha256, peticao` |
<<<<<<< HEAD
| `secModelos/{id}` | `organization_id, unidade_id?` (vazio = modelo do órgão), `nome, tipo_documento, descricao, ativo, formato (editor\|original)`, `conteudo` (editor) ou `storage_path, arquivo_nome, arquivo_mime, tamanho` (original) |
=======
| `secModelos/{id}` | `organization_id, unidade_id?` (vazio = modelo do órgão), `nome, tipo_documento, descricao, conteudo, ativo` |
>>>>>>> 3b52f267a18d451b5857eda73cc4cc9a41c3a868
| `secConvites/{sha256 do token}` | `organization_id, processo_id, parte_idx, parte_nome, email, expira_em, usado_por, revogado` |

No processo, cada item de `partes[]` pode ter `uid` (conta habilitada) e
`convite_hash` (último convite); `partes_uids[]` lista as contas habilitadas e
é o que o portal consulta.

O processo guarda a **cópia das fases** do rito com que foi autuado. Editar o
rito incrementa `versao` e só vale para os próximos processos.

Arquivos ficam no Cloud Storage em `secretaria/{org}/{processo}/{documento}`;
modelos guardados no original, em `secretaria/{org}/modelos/{modelo}`.
`storage.rules` nega todo acesso do navegador; o Admin SDK das functions
ignora as regras.

## Functions

| Function | Ações |
|---|---|
<<<<<<< HEAD
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade` (admin; gestor só equipe e descrição), `obterUnidadeDocumento`, `salvarUnidadeDocumento` (gestor), `convidarEquipe`, `revogarConviteEquipe`, `convitesPendentes`, `pedirLotacao`, `decidirPedido` (gestor), `verConviteEquipe` e `aceitarConviteEquipe` (quem tem o link), `salvarRito`, `salvarTipo`, `salvarPreferencias`, `salvarDocumentoConfig`, `salvarModelo` (admin; gestor para modelo da unidade; aceita `formato: 'original'` com o arquivo), `importarModelo` (mesma permissão; só interpreta e devolve a proposta), `obterModelo` e `baixarModelo` (qualquer membro; `baixarModelo` com `valores` devolve o Word preenchido), `salvarCalendario` |
=======
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade` (admin; gestor só equipe e descrição), `obterUnidadeDocumento`, `salvarUnidadeDocumento` (gestor), `convidarEquipe`, `revogarConviteEquipe`, `convitesPendentes`, `pedirLotacao`, `decidirPedido` (gestor), `verConviteEquipe` e `aceitarConviteEquipe` (quem tem o link), `salvarRito`, `salvarTipo`, `salvarPreferencias`, `salvarDocumentoConfig`, `salvarModelo` (admin; gestor para modelo da unidade), `obterModelo` (qualquer membro), `salvarCalendario` |
>>>>>>> 3b52f267a18d451b5857eda73cc4cc9a41c3a868
| `secretariaProcesso` | `listar`, `obter`, `autuar`, `tramitar`, `atribuir`, `avancarFase`, `alterarStatus`, `abrirPendencia`, `resolverPendencia`, `abrirPrazo`, `encerrarPrazo`, `convidarParte`, `revogarParte` |
| `secretariaPortal` | (partes, sem vínculo com o órgão) `aceitarConvite`, `meusProcessos`, `obter`, `baixar`, `pdf`, `peticionar` |
| `secretariaDocumento` | `criarMinuta`, `editarMinuta`, `upload`, `assinar`, `juntar`, `excluirMinuta`, `baixar`, `pdf` (prévia da minuta com marca d'água ou documento juntado carimbado) |
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

## Exportação em PDF

Gerada no servidor com `pdf-lib` e `pdfmake`: capa (dados, partes,
integridade), movimentos em ordem cronológica com hash, índice "Documentos
(folhas dos autos)" e cada documento juntado na ordem da juntada, carimbado
com as folhas. Redigidos entram com o PDF guardado na juntada (ou renderizado
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
(`FluxoRito.jsx`, SVG) atualizado ao vivo. Pontos de partida:

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

- Partes não têm verificação em duas etapas nem exportam o PDF dos autos;
  baixam cada documento.
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
- `listar` lê até 1000 processos do órgão e filtra em memória; paginar quando
  passar disso.
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
