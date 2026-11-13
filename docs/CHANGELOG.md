# Histórico de mudanças

Principais entregas do SIGO, da mais recente para a mais antiga. O detalhe de
cada mudança está nas mensagens de commit (`git log`).

---

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

