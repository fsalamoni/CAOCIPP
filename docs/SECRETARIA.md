# Secretaria Processual

Processo eletrônico do órgão: autuação com rito, tramitação entre unidades,
documentos redigidos na plataforma ou enviados, assinatura, juntada, linha do
tempo com integridade por hash e exportação dos autos em PDF.

O módulo é independente: serve a qualquer pessoa física ou jurídica, pública
ou privada, que use o SIGO com sua equipe. Não substitui nenhum sistema
processual externo e não altera os demais módulos do órgão.

Este documento cobre as **fases 1, 2 e 3** (entregues). O projeto completo, com as cinco
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
| Organização | Admin do órgão (`configure_secretaria` ou criador) | Ativa, cria unidades, lota membros, define ritos, consulta todos os processos |
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
| `secRitos/{id}` | `organization_id, nome, descricao, fases[{id, nome, prazo_dias?}], versao, ativo` |
| `secContadores/{org}_{ano}` | `seq` da numeração anual (`000001/2026`) |
| `secProcessos/{id}` | `numero, assunto, descricao, partes[], sigilo, status, rito_id, rito_versao, fases[]` (cópia), `fase_atual, unidade_atual, unidades_historico[], responsavel_uid, mov_seq, doc_seq, ultimo_hash, version` |
| `secProcessos/{id}/movimentos/{seq}` | `seq, tipo, descricao, autor_uid, autor_nome, unidade_id, em, dados, hash_anterior, hash` |
| `secProcessos/{id}/documentos/{id}` | `titulo, tipo, origem (editor\|upload), status (minuta\|juntado), unidade_origem, delta` ou `storage_path, mime, tamanho`, `sha256, assinaturas[], ordem, juntado_em, visivel_partes, peticao?` |
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
| `secretariaConfig` | `estado`, `ativar`, `salvarUnidade`, `salvarRito`, `salvarPreferencias` |
| `secretariaProcesso` | `listar`, `obter`, `autuar`, `tramitar`, `atribuir`, `avancarFase`, `alterarStatus`, `abrirPendencia`, `resolverPendencia`, `abrirPrazo`, `encerrarPrazo`, `convidarParte`, `revogarParte` |
| `secretariaPortal` | (partes, sem vínculo com o órgão) `aceitarConvite`, `meusProcessos`, `obter`, `baixar`, `peticionar` |
| `secretariaDocumento` | `criarMinuta`, `editarMinuta`, `upload`, `assinar`, `juntar`, `excluirMinuta`, `baixar` |
| `secretariaExportarPdf` | gera o PDF dos autos |

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
- O editor grava o conteúdo como **Delta** (lista de operações de texto) com
  uma lista fechada de formatos (negrito, itálico, sublinhado, títulos, listas,
  alinhamento, citação, recuo). Nada de HTML, imagem embutida ou link: o
  conteúdo nunca é interpretado como HTML.
- **Assinatura eletrônica simples** (Lei 14.063/2020, art. 4º, I): registra
  quem assinou, quando e o SHA-256 do conteúdo. Minuta assinada não se edita.
- **Juntada:** a minuta entra nos autos com número de ordem e movimento
  encadeado. Documento juntado não se edita nem se apaga.

## Exportação em PDF

Gerada no servidor com `pdf-lib`: capa (dados, partes, integridade), índice de
movimentos em ordem cronológica com hash, e cada documento juntado na ordem da
juntada. Redigidos viram texto; PDFs enviados entram página a página; PNG/JPG
entram como imagem; TXT como texto; Word/planilha aparecem como folha de
referência com o hash (conversão fica para a fase 5). Minutas nunca entram.
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
