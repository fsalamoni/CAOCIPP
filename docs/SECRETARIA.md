# Secretaria Processual

Processo eletrônico do órgão: autuação com rito, tramitação entre unidades,
documentos redigidos na plataforma ou enviados, assinatura, juntada, linha do
tempo com integridade por hash e exportação dos autos em PDF.

O módulo é independente: serve a qualquer pessoa física ou jurídica, pública
ou privada, que use o SIGO com sua equipe. Não substitui nenhum sistema
processual externo e não altera os demais módulos do órgão.

Este documento cobre as **fases 1 a 4** (entregues). O projeto completo, com as cinco
fases e as decisões, está no documento de projeto (fora do repositório).

## Ativação

- Quem ativa: o **admin do órgão** (criador ou quem tem a permissão
  `configure_secretaria`), em Painel Administrativo → aba Secretaria Processual.
- Não depende de flag da plataforma. O estado fica em
  `organizations/{id}.secretariaConfig.enabled`, gravado só pela function
  `secretariaConfig` (ação `ativar`). Órgãos sem o campo ficam desligados.
- Na primeira ativação, se o órgão não tiver unidade nem rito, a plataforma cria
  a unidade "Secretaria" (com o admin lotado) e o "Rito comum" (Autuação →
  Instrução → Decisão → Cumprimento → Encerramento).
- Desativar esconde a página e bloqueia as functions. Nada é apagado.
- Página: `/Secretaria?org=<id>`; processo aberto: `&p=<processoId>`. O link
  aparece no submenu do órgão quando a Secretaria está ativa.

## Perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| Organização | Admin do órgão (`configure_secretaria` ou criador) | Ativa, cria unidades, lota membros, define ritos e tipos de processo, consulta todos os processos |
| Secretaria | Lotado em unidade do tipo `secretaria` | Autua, junta, tramita, muda fase, atribui, sobrestá e arquiva quando tem o processo |
| Decisão | Lotado em unidade do tipo `gabinete` | Os mesmos atos quando o processo está no gabinete (ex.: minuta de decisão, assinatura, juntada, devolução) |
| Partes | Externas, com conta própria, **nunca membros do órgão** | Pelo portal (`/Portal`): acompanham os processos em que foram habilitadas e peticionam a qualquer tempo |

O poder de movimentar vem da **posse**: o processo está sempre com uma unidade
(`unidade_atual`) e só quem está lotado nela age sobre ele.

## Visibilidade

- **Sigilo normal:** qualquer membro lotado em alguma unidade do órgão lê.
- **Sigilo restrito:** só unidades por onde o processo passou
  (`unidades_historico`) e o admin.
- **Minutas:** só a unidade que as redigiu, até a juntada.
- Membro do órgão sem lotação não vê processo nenhum (salvo o admin).

## Modelo de dados

Todas as coleções são fechadas ao cliente (`allow read, write: if false`). Leitura
e escrita passam pelas functions, que aplicam posse, lotação, sigilo e minutas.

| Coleção | Conteúdo |
|---|---|
| `secUnidades/{id}` | `organization_id, nome, sigla, tipo (secretaria\|gabinete), membros_uids[], ativa` |
| `secRitos/{id}` | `organization_id, nome, descricao, fases[{id, nome, prazo_dias?, orientacao?, proximas?[], final?}], versao, ativo` |
| `secTipos/{id}` | `organization_id, nome, sigla, descricao, rito_id, sigilo_padrao, unidade_inicial, ativo` |
| `secContadores/{org}_{ano}` | `seq` da numeração anual (`000001/2026`) |
| `secProcessos/{id}` | `numero, assunto, descricao, partes[], sigilo, status, tipo_id?, tipo_nome?, rito_id, rito_versao, fases[]` (cópia), `fase_atual, unidade_atual, unidades_historico[], responsavel_uid, mov_seq, doc_seq, folhas_seq, ultimo_hash, version` |
| `secProcessos/{id}/movimentos/{seq}` | `seq, tipo, descricao, autor_uid, autor_nome, unidade_id, em, dados, hash_anterior, hash` |
| `secProcessos/{id}/documentos/{id}` | `titulo, tipo, origem (editor\|upload), status (minuta\|juntado), unidade_origem, conteudo` (ou `delta` legado) ou `storage_path, mime, tamanho`, `sha256, assinaturas[], ordem, juntado_em, visivel_partes, peticao?, paginas, folha_inicial, folha_final, pdf_path?, pdf_sha256?` |
| `secConfig/{org}` | `documento: {cabecalho_linhas[], brasao, rodape, fonte_padrao, tamanho_padrao, tipos_documento[]}` (papel timbrado) |
| `secModelos/{id}` | `organization_id, nome, tipo_documento, descricao, conteudo, ativo` |
| `secConvites/{sha256 do token}` | `organization_id, processo_id, parte_idx, parte_nome, email, expira_em, usado_por, revogado` |

No processo, cada item de `partes[]` pode ter `uid` (conta habilitada) e
`convite_hash` (último convite); `partes_uids[]` lista as contas habilitadas e
é o que o portal consulta.

O processo guarda a **cópia das fases** do rito com que foi autuado. Editar o
rito incrementa `versao` e só vale para os próximos processos.

Arquivos ficam no Cloud Storage em `secretaria/{org}/{processo}/{documento}`.
`storage.rules` nega todo acesso do navegador; o Admin SDK das functions
ignora as regras.

## Functions

| Function | Ações |
|---|---|
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade`, `salvarRito`, `salvarTipo`, `salvarPreferencias`, `salvarDocumentoConfig`, `salvarModelo`, `obterModelo` (qualquer membro) |
| `secretariaProcesso` | `listar`, `obter`, `autuar`, `tramitar`, `atribuir`, `avancarFase`, `alterarStatus`, `abrirPendencia`, `resolverPendencia`, `abrirPrazo`, `encerrarPrazo`, `convidarParte`, `revogarParte` |
| `secretariaPortal` | (partes, sem vínculo com o órgão) `aceitarConvite`, `meusProcessos`, `obter`, `baixar`, `pdf`, `peticionar` |
| `secretariaDocumento` | `criarMinuta`, `editarMinuta`, `upload`, `assinar`, `juntar`, `excluirMinuta`, `baixar`, `pdf` (prévia da minuta com marca d'água ou documento juntado carimbado) |
| `secretariaExportarPdf` | gera o PDF dos autos |
| `secretariaPlataforma` | (só administração da plataforma) `resumo`, `suspender` |

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
  "Petição da parte interrompe a fase" (Painel Administrativo → Secretaria
  Processual), a pendência suspende a fase até o gabinete apreciá-la. Vale
  também com o processo sobrestado ou arquivado.
- **Revogação:** Revogar tira a conta de `partes_uids`, invalida o convite e
  grava `acesso_revogado`. A parte deixa de ver o processo na hora.

## Ritos e tipos de processo (fase 4)

O admin do órgão configura tudo em Painel Administrativo → Secretaria
Processual, sem sair da plataforma.

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

- **Órgão:** Configuração → "Papel timbrado e tipos de documento" (até 4
  linhas de cabeçalho, brasão PNG/JPG até 300 KB, rodapé, fonte e tamanho
  padrão, com prévia da folha) e "Modelos de documento". Auditoria:
  `SECRETARIA_DOCUMENTO_CONFIG`, `SECRETARIA_MODELO_SALVO`.
- **Plataforma:** Administração → aba "Secretaria" lista os órgãos com o
  módulo ligado e o volume de processos, e permite **suspender** com motivo
  (`secretariaConfig.suspensa_plataforma`, `motivo_suspensao`). Suspenso, o
  órgão (equipe e partes) não acessa os processos; nada é apagado. O admin do
  órgão vê o motivo. Auditoria: `SECRETARIA_SUSPENSA_PLATAFORMA`,
  `SECRETARIA_REATIVADA_PLATAFORMA`.

## Limites conhecidos

- Partes não têm verificação em duas etapas nem exportam o PDF dos autos;
  baixam cada documento.
- Se a gravação da petição falhar depois do envio do anexo ao Storage, o
  arquivo fica órfão no bucket (sem referência nos autos).
- Assinatura só no nível simples (gov.br e ICP-Brasil na fase 5).
- Feriados locais e recesso não entram na contagem de prazos; não há alerta
  por e-mail de vencimento.
- `listar` lê até 1000 processos do órgão e filtra em memória; paginar quando
  passar disso.
- O PDF volta inteiro na resposta da function; anexos acima de ~18 MB somados
  viram folha de referência.
- Documentos Word e planilhas não são convertidos para o PDF.
- No PDF, as fontes Times e Courier só têm caracteres latinos (WinAnsi);
  outros símbolos saem como "?". Arial (Roboto) cobre mais caracteres.
- Localizar e substituir não acha texto que atravessa mudança de formatação.
- O índice de documentos da exportação cabe numa página (~45 documentos).
- Processos anteriores à fase 5 não tinham folhas; a contagem deles soma as
  páginas conhecidas (1 quando não há).
