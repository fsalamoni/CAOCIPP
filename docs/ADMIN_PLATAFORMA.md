# Guia da Administração da plataforma

Para quem administra o SIGO inteiro (super-admin). O painel de cada órgão é
outro: fica dentro do órgão, na aba *Painel Administrativo*, e está descrito em
[FEATURES_REFERENCE.md §4](./FEATURES_REFERENCE.md).

## Como entrar

Menu lateral → *Administração da plataforma* (endereço `/Admin`). Só abre
para quem é super-admin: custom claim `platformAdmin`, documento ativo em
`platformAdmins/{uid}` ou e-mail confirmado listado em `PLATFORM_ADMIN_EMAILS`.
Quem não é vê "Acesso restrito"; as Functions recusam do mesmo jeito.

## Como se achar

- **Visão geral** (abre primeiro): pendências de configuração em amarelo, cada
  uma com o botão que leva à seção que resolve; totais da plataforma; um
  cartão por seção, agrupado por assunto.
- **Menu lateral** (computador) ou **seletor** no topo (celular e tablet), com
  os mesmos grupos.
- **Busca** no canto superior: procura no nome, na descrição e em palavras
  comuns (por exemplo "bigquery", "super-admin", "erros"), sem ligar para
  acento ou maiúsculas.
- **Link de cada seção:** o endereço muda para `/Admin?secao=<chave>`. Dá para
  voltar, recarregar e mandar o link para outra pessoa que também administre.

## Seções

| Grupo | Seção | Quando usar |
|---|---|---|
| Plataforma | Configuração inicial | Na instalação, ou quando a visão geral mostrar pendência de e-mail, faturamento ou recuperação de acesso. |
| Plataforma | Funcionalidades | Para ligar ou desligar, para todos os órgãos, as funcionalidades opcionais (Jurimetria, Panorama, busca global, metas, dois fatores, tour). |
| Plataforma | E-mail | Para definir o remetente dos e-mails. |
| Órgãos e pessoas | Órgãos | Para achar um órgão, abrir a ficha dele e agir: suspender, reativar, trocar o criador ou excluir. |
| Órgãos e pessoas | Usuários | Para ver quem usa o SIGO e em que órgãos. |
| Órgãos e pessoas | Administradores da plataforma | Para dar ou tirar o acesso a esta página. |
| Módulos | Processo Eletrônico | Para ver os órgãos com Processo Eletrônico e suspender ou reativar o módulo de um órgão. |
| Operação e diagnóstico | Central de segurança | Para ver a nota de segurança, o que falta resolver, quem administra e tudo o que super-admins fizeram (com exportação). |
| Operação e diagnóstico | Movimentações | Para saber quem fez o quê, filtrando por órgão ou ação. |
| Operação e diagnóstico | Diagnóstico e saúde | Quando algo parecer errado: serviços, versão no ar, rotinas automáticas, erros do servidor nas últimas 24 h e espaço dos arquivos. |
| Operação e diagnóstico | Cotas e limites | Limites que valem de fato: órgãos por pessoa, membros por órgão e linhas por importação, com o uso atual. |
| Dados e custos | Cópias e exportação | Para ligar a cópia diária do banco, ver as cópias guardadas e exportar os dados de um órgão ou a configuração da plataforma. |
| Dados e custos | Armazenamento | Para ver o espaço que cada coleção ocupa. |
| Dados e custos | Ferramentas de dados | Para conferir e recalcular contadores ou migrar o histórico. |
| Dados e custos | Custos | Para ver o gasto por serviço (exige a exportação do faturamento). |

## Identidade e termos: receitas

- **Trocar nome, cor ou logo:** em *Identidade e termos*, mude os campos e
  confira a prévia ao lado. A cor precisa de contraste mínimo de 4,5 para 1
  com o branco (o painel avisa e não deixa salvar um tom claro demais). O
  logo é uma imagem PNG, JPEG ou WebP quadrada de até 220 KB; *Voltar ao logo
  oficial* desfaz. *Salvar identidade* vale na hora para todos: topo das
  telas, tela de entrada e nome da aba do navegador.
- **Textos da tela de entrada e rodapé:** campo vazio usa o texto padrão.
- **Contato de suporte:** e-mail, telefone e página de chamados aparecem no
  rodapé da tela de entrada. Preencha só o que existir.
- **Publicar os termos de uso:** cole o texto oficial (parágrafos separados
  por uma linha em branco), escolha se o aceite é obrigatório e clique em
  *Publicar versão N*. Com aceite obrigatório, cada pessoa (inclusive você) vê
  os termos ao abrir o SIGO e só continua depois de aceitar; a versão e a data
  do aceite aparecem na ficha da pessoa. Cada versão publicada fica guardada
  com data e autor, e a página *Termos de Uso* passa a mostrar o texto novo.

## Avisos e manutenção: receitas

- **Avisar todo mundo** (nova versão, instabilidade, prazo): em *Avisos e
  manutenção*, escolha o tom (Informação, Atenção ou Urgente), escreva o
  título e, se quiser, um texto e um link (`https://…` ou uma página do SIGO,
  como `/Help`). Confira a prévia e clique em *Publicar aviso*. A faixa
  aparece no topo de todas as telas e na tela de entrada.
- **Agendar:** preencha *Começa em* e *Sai do ar em*. Fora desse período a
  faixa não aparece; o painel mostra se está agendado, no ar ou expirado.
- **Aviso que não pode ser fechado:** desligue *Pode ser dispensado*.
  Publicar um aviso novo substitui o anterior e o faz reaparecer para quem o
  tinha fechado. *Encerrar aviso atual* tira a faixa na hora.
- **Modo manutenção** (migração, correção de dados, incidente): escreva a
  mensagem e, se souber, a previsão de volta; *Ligar manutenção*. Na hora,
  quem não administra a plataforma vê só a tela de manutenção; você continua
  usando tudo, com uma faixa lembrando que a manutenção está ligada. *Desligar
  manutenção* devolve o acesso a todos, sem precisar recarregar a página.
  Atenção: é um bloqueio de tela. Para impedir o acesso de alguém de fato,
  suspenda o órgão ou bloqueie a pessoa.

## Segurança: receitas

- **Ver como está a proteção:** abra *Central de segurança*. A nota vai de 0
  a 100; itens em vermelho (risco) vêm primeiro, depois os amarelos
  (atenção). Cada um diz o que fazer e, quando dá, tem o botão *Resolver*
  que leva à seção certa.
- **Itens "não verificado":** o servidor não conseguiu ler a configuração do
  banco naquele momento (por exemplo, no ambiente de teste). Eles ficam fora
  da nota. Use *Conferir de novo*.
- **Itens de console (App Check e chave de API):** só o console do Google
  mostra. Depois de fazer lá, clique em *Já está feito no console*; o nome
  de quem confirmou e a data ficam registrados, e dá para desfazer.
- **Revisar quem administra:** a parte *Quem administra a plataforma* mostra o
  último login, se a pessoa usa o código por e-mail e se o e-mail é
  confirmado. Para tirar o acesso, use *Administradores da plataforma*: a
  retirada vale na hora, sem desconectar a pessoa dos outros apps.
- **Prestar contas do que a administração fez:** em *Auditoria da
  administração*, filtre por ação e período e clique em *Exportar em CSV*
  (abre no Excel). A exportação leva o que está carregado; use *Carregar
  mais* antes, se precisar de mais linhas.

## Diagnóstico: receitas

- **Saber se está tudo funcionando:** abra *Diagnóstico e saúde*. O topo diz
  "Tudo funcionando" ou quantos pontos pedem atenção.
- **Uma rotina automática falhou:** o cartão da rotina fica vermelho, com a
  hora e a mensagem da falha; *Últimas execuções* mostra o histórico. Se for
  um envio de e-mail, confira a chave em *Configuração inicial*.
- **Rotina "Atrasada":** passou do dobro do intervalo sem rodar. Abra o
  Cloud Scheduler no console do Google Cloud e veja se o agendamento está
  pausado ou com erro.
- **Rotina "Sem registro ainda":** é normal logo depois da publicação; o
  registro começa na primeira execução.
- **Erros do servidor:** cada linha é uma função do SIGO, com quantos erros
  teve nas últimas 24 horas e a última mensagem. Passe o nome da função e a
  mensagem para quem dá manutenção.
- **Qual versão está no ar:** o cartão *Versão no ar* mostra o commit do site
  (com link para o GitHub) e a revisão das funções.

## Cópias e exportação: receitas

- **Ligar a cópia diária do banco:** em *Cópias e exportação*, escolha por
  quantos dias guardar cada cópia (14 é um bom padrão) e clique em *Ligar
  cópia diária*. A primeira sai nas próximas 24 horas e aparece em *Cópias
  guardadas*. Se o botão recusar por permissão, siga o *Passo a passo pelo
  console* logo abaixo.
- **Ligar a proteção contra exclusão:** botão *Ligar proteção*. Não custa nada
  e impede apagar o banco inteiro pelo console.
- **Recuperar dados de uma data:** pelo console (passo a passo na tela). A
  restauração cria sempre um banco novo; o banco em uso não é tocado.
- **Entregar os dados a um órgão:** na ficha do órgão, *Exportar dados* (ou
  escolha o órgão em *Cópias e exportação*) e *Exportar em JSON*. O arquivo
  traz todos os registros, com o histórico; os anexos não entram (os autos de
  cada processo saem em PDF pelo Processo Eletrônico).
- **Guardar a configuração da plataforma:** *Exportar configuração* baixa
  identidade, termos (todas as versões), avisos, funcionalidades, cotas,
  e-mail, administradores e rotinas.

## Cotas: receitas

- **Ver se algum órgão está perto do limite:** em *Cotas e limites*, cada cota
  mostra o maior uso de hoje (por exemplo, o órgão com mais membros) e a
  porcentagem do limite; a barra fica amarela a partir de 80%.
- **Mudar um limite:** digite o novo valor e *Salvar*. Vale em até 1 minuto.
  Baixar um limite abaixo do uso atual não tira ninguém: só impede novas
  entradas (ou novos órgãos) até o uso ficar abaixo dele.
- **O que a pessoa vê ao bater no limite:** uma mensagem dizendo qual limite
  foi atingido e pedindo para falar com a administração do SIGO.

## Órgãos: receitas

- **Achar um órgão:** digite parte do nome na busca. Os filtros mostram só os
  suspensos, os que usam o Processo Eletrônico ou os que ainda não têm
  registros. Clique no órgão para abrir a ficha; o link da ficha pode ser
  enviado (`/Admin?secao=orgs&orgao=<id>`).
- **Ler a ficha:** situação (ativo ou suspenso), Processo Eletrônico, volumes
  de cada módulo, membros (ativos primeiro, com papel, atribuições e data de
  entrada; quem saiu aparece apagado, com a data de saída), páginas ligadas,
  contato e as 15 últimas ações registradas no órgão.
- **Suspender um órgão** (por exemplo, órgão desativado, incidente de
  segurança, uso indevido): *Suspender*, escreva o motivo (os membros leem) e
  confirme. Na hora, ninguém do órgão abre nada, nem o criador; as partes
  perdem o Portal e o código de convite para de funcionar. Quem tentar entrar
  vê o aviso com o motivo. **Nada é apagado.**
- **Reativar:** *Reativar* e confirmar. Tudo volta como estava.
- **Trocar o criador** (o criador saiu ou mudou de função): *Trocar criador*,
  escolha um membro ativo. O criador anterior, se ainda estiver no órgão,
  continua como administrador.
- **Excluir para sempre:** *Excluir* e digite o nome exato. Apaga o órgão e
  todo o banco dele, sem volta. Se a intenção é só impedir o acesso, prefira
  suspender.

Toda ação fica registrada em *Movimentações* (plataforma) e na atividade do
próprio órgão.

## Usuários: receitas

O login do SIGO é o mesmo de outros sistemas. Por isso a lista mostra **só
as pessoas do SIGO**: quem participa de algum órgão, quem já entrou no SIGO
ou quem administra a plataforma.

- **Achar uma pessoa:** digite parte do nome ou do e-mail. Os filtros mostram
  as bloqueadas, quem não está em nenhum órgão, quem não entra há mais de 90
  dias e os super-admins. Clique na pessoa para abrir a ficha
  (`/Admin?secao=users&pessoa=<uid>`). Na ficha de um órgão, o nome de cada
  membro também leva à ficha dele.
- **Ler a ficha:** órgãos de que participa (com papel e datas; cada um abre a
  ficha do órgão), como entra (Google ou e-mail e senha), se o e-mail foi
  confirmado, se usa verificação em duas etapas, último acesso, quando aceitou
  os termos e as 20 últimas ações registradas.
- **Bloquear no SIGO** (desligamento, uso indevido, conta comprometida):
  *Bloquear no SIGO*, escreva o motivo (a pessoa lê) e confirme. Na hora, ela
  não abre nenhum órgão, não usa o Portal das partes, não cria órgão nem entra
  por convite; ao abrir o SIGO, vê o aviso com o motivo. O login dela **não**
  é desativado (seguiria valendo nos outros sistemas) e **nada é apagado**.
  Não dá para bloquear a si mesmo nem outro super-admin (retire antes o
  acesso em *Administradores da plataforma*).
- **Desbloquear:** *Desbloquear* e confirmar. Volta com os mesmos papéis.
- **Tirar alguém de um só órgão** continua sendo feito pela administração do
  próprio órgão (Membros).

## O que vem a seguir

O plano de evolução do painel tem 10 etapas (fichas de órgão e de usuário,
identidade visual, avisos e modo manutenção, segurança, diagnóstico, dados e
custos). Este guia cresce a cada etapa entregue e descreve só o que já existe.
