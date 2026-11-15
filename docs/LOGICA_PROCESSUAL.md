# Lógica processual: guia de domínio do Processo Eletrônico

**Leia antes de qualquer trabalho no Processo Eletrônico** (tela do processo,
ritos, tramitação, documentos, comunicações, portal das partes, PDF dos
autos). Este guia explica como pensa quem lida com processos todos os dias:
o que é ato processual e o que é trabalho interno, o que vai para os autos,
o que a capa deve mostrar e como cada decisão de tela ou de dado se apoia
nisso. O documento técnico do módulo é o
[PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md); aqui fica o porquê.

O SIGO serve a qualquer órgão ou entidade (Ministério Público, conselho
profissional, entidade esportiva, OSC, empresa). As referências normativas
abaixo são as brasileiras mais usadas como parâmetro (processo administrativo
federal, CPC, processo eletrônico); cada entidade pode ter regimento
próprio, e o rito configurável existe para isso. As citações servem de
orientação de desenho: confira o texto vigente antes de usá-las como
fundamento jurídico.

---

## 1. Processo, procedimento, autos e expediente

| Conceito | O que é | No SIGO |
|---|---|---|
| **Processo** | A relação entre o órgão e os interessados que caminha, por atos encadeados, até uma decisão e o seu cumprimento | `secProcessos/{id}` |
| **Procedimento (rito)** | A ordem e a forma dos atos: quais fases, quem age, o que cada fase precisa produzir | `secRitos` (cópia em `secProcessos.fases`) |
| **Autos** | O registro oficial do processo: as peças (documentos) e os termos e certidões dos atos, em ordem, com folhas | documentos juntados + termos dos eventos de usuário (PDF dos autos) |
| **Eventos** | A cronologia dos atos praticados, cada um com data, autor e unidade | `secProcessos/{id}/movimentos` (cadeia de hash) |
| **Expediente** | O trabalho em curso sobre o processo: minutas, tarefas da fase, pendências para o decisor, prazos a controlar | aba Andamento da tela do processo |
| **Registro interno** | O que a equipe precisa saber para gerir o trabalho, mas que não é ato do processo: distribuição a assessor, checklist, atribuição, orientação | eventos de origem "interno" ou "sistema" (fora dos autos) |

A regra antiga *quod non est in actis non est in mundo* (o que não está nos
autos não existe para o processo) tem um corolário que orienta todo o
desenho: **o que entra nos autos precisa ser ato do processo**. Encher os
autos de registros de rotina esconde o que importa (a decisão, a prova, a
comunicação) e expõe às partes o trabalho interno do órgão.

## 2. Princípios que guiam o desenho

| Princípio | Fonte de referência | Consequência no sistema |
|---|---|---|
| Forma e documentação dos atos | Lei 9.784/1999, art. 22; CPC, arts. 206 a 208 | Ato que a lei ou o rito exige por escrito gera documento ou termo, com data, autor e folha |
| Formalidades essenciais, formas simples | Lei 9.784/1999, art. 2º, VIII e IX; CPC, arts. 188 e 277 | Só se exige o que tem função; o rito diz o que é essencial em cada fase |
| Publicidade, com sigilo por exceção | CF, art. 5º, LX, e art. 37; Lei 12.527/2011 (LAI) | O processo é visível à equipe; o restrito só a quem por ele passou; as partes veem o que lhes diz respeito |
| Contraditório e ampla defesa | CF, art. 5º, LV; Lei 9.784/1999, arts. 3º, 26 a 28 | Toda decisão que afete a parte é comunicada, com prazo, e a ciência fica certificada |
| Impulso oficial | Lei 9.784/1999, art. 2º, XII; CPC, art. 2º | O sistema sempre mostra o próximo ato esperado e quem deve praticá-lo |
| Duração razoável | CF, art. 5º, LXXVIII; Lei 9.784/1999, arts. 48 e 49 | Prazos da fase, urgência e prioridade visíveis; a fila ordena por eles |
| Motivação | Lei 9.784/1999, art. 50 | A decisão é documento assinado; a motivação por remissão a parecer exige o parecer nos autos (art. 50, § 1º) |
| Órgão de instrução × órgão de decisão | Lei 9.784/1999, art. 47 | O trabalho de apoio (estudo, minuta) é de quem instrui; o ato que vale é o de quem decide |
| Impedimento e suspeição | Lei 9.784/1999, arts. 18 a 21 | Quem é parte num processo não atua nele pelo órgão |
| Integridade e autenticidade | Lei 11.419/2006, art. 11; Lei 14.063/2020 | Documento juntado não se altera nem se apaga; cadeia de hash; assinatura eletrônica |
| Proteção de dados | Lei 13.709/2018 (LGPD) | Só o necessário vai ao portal e ao PDF; dados internos não saem para as partes |

## 3. As camadas de um processo eletrônico

Quem tramita processo trabalha com quatro camadas distintas. Misturá-las é o
erro de desenho mais comum.

1. **Capa (informação).** O que identifica o processo e a sua situação. Lida
   por todos (equipe, decisor, consulta), igual para todos os perfis, sem
   nenhuma ferramenta de ação. CPC, art. 206: a autuação menciona o juízo, a
   natureza do processo, o número, os nomes das partes e a data de início.
   A Resolução CNJ 121/2010 trata como "dados básicos" o número, a classe e
   os assuntos, as partes e os advogados e a movimentação processual.
2. **Andamento (expediente).** Onde se age: o que a fase espera, minutas,
   pendências, prazos, comunicações, acesso das partes ao portal. Só quem tem
   o processo consigo age; os demais veem, sem botões.
3. **Autos (peças).** Os documentos juntados e os termos dos atos, em ordem,
   com folhas. É o que se lê para decidir e o que se exporta em PDF.
4. **Eventos (cronologia).** Todos os atos, cada um com data, autor, unidade
   e folhas. Os atos de usuário formam a cronologia dos autos; os registros
   internos e do sistema ficam separados, para auditoria.

A separação **informar × agir** não é estética: evita ato por engano (uma
intimação disparada de uma tela de consulta), deixa a capa estável para quem
só precisa saber "o que é e onde está", e permite que a mesma capa sirva ao
decisor, à consulta e à impressão.

## 4. A capa: o que é essencial

| Grupo | Informação | Por que importa |
|---|---|---|
| Identificação | Número, tipo de processo (classe), assunto, rito, descrição | Saber do que se trata e qual procedimento se aplica |
| Origem | Como o processo chegou (requerimento, representação ou denúncia, ofício de outro órgão, de ofício, derivado de outro processo, ou uma origem da lista do órgão, como ouvidoria), a referência (nº do ofício, processo de origem, meio de recebimento), data e unidade de autuação | Competência, legitimidade, prevenção e contagem de prazos dependem da origem; Lei 9.784/1999, arts. 5º e 6º |
| Quem solicitou | Requerente (polo ativo) e quem o representa; "de ofício" quando é iniciativa do órgão | Define a quem se responde e quem tem legitimidade para recorrer |
| Partes | Todas, com polo e representantes, e se acompanham pelo portal | Contraditório: a quem comunicar |
| Tramitação | Urgência (e o motivo), sigilo, situação, fase, com quem está e desde quando, responsável | Prioridade, acesso, impulso |
| Dados próprios | Campos do tipo de processo | O que a entidade definiu como essencial para aquele tipo |
| Cronologia | Os atos dos autos em ordem, com data, autor, unidade e folhas | A história do processo em uma leitura |
| Integridade | A cadeia de eventos conferida | Confiança no registro |

**Não pertencem à capa:** botões de ato (intimar, juntar, tramitar,
assinar, convidar parte), minutas, caixas de marcar da fase, pendências
internas, orientações entre unidades, atribuição de responsável, trabalho
de assessoria. Tudo isso é andamento.

## 5. Classificação dos atos

| Classe | Exemplos | Quem pratica | Nos autos? |
|---|---|---|---|
| Decisórios | Decisão, despacho, julgamento | Decisor (gabinete) | Sempre, como documento assinado |
| De comunicação | Intimação, notificação, citação, ciência | Secretaria | Sempre: certidão e termo de ciência; geram prazo |
| Ordinatórios (de movimentação formal) | Autuação, juntada, conclusão, remessa a outro órgão, abertura e encerramento de prazo, mudança de situação | Secretaria (CPC, art. 203, § 4º) | Sim, como termo ou certidão |
| Instrutórios | Diligência, oitiva, parecer obrigatório, laudo, informação técnica | Quem instrui | Sim, como documento |
| De apoio interno | Distribuição a assessor, estudo, minuta, revisão, checklist, atribuição | Assessoria, equipe | **Em regra, não**: registro interno. Exceções abaixo |
| Do sistema | Convite ao portal, avisos, registros automáticos | Plataforma | Não: extrato do sistema |

**Teste para decidir se um ato vai aos autos.** Basta um "sim":

1. Ele cria, altera ou extingue direito, dever, ônus ou prazo de alguém?
2. Ele é fundamento de uma decisão (inclusive por remissão, art. 50, § 1º)?
3. A parte precisa conhecê-lo para se defender ou recorrer?
4. Ele prova o cumprimento de uma formalidade (comunicação, prazo,
   competência, remessa entre órgãos)?
5. A lei, o regimento ou o rito exigem que conste?

Se nenhum: registro interno. A equipe continua vendo, a cadeia de hash
continua íntegra e o PDF pode trazê-lo num extrato ao fim, mas não há termo,
não há folha e a parte não vê.

**A mesma atividade muda de classe conforme o rito.** A distribuição interna
entre assessorias é apoio quando o que importa é a decisão de quem tem o
poder; é ato do processo quando o regimento atribui a instrução a um órgão
diferente do que decide (relatório com proposta de decisão, Lei 9.784/1999,
art. 47) ou quando a decisão adota o parecer da assessoria como
fundamento. Por isso quem cria o rito decide, fase a fase, o que gera
registro nos autos.

**Três lugares para um registro.** Nem todo registro interno precisa sair em
papel. O rito escolhe, para cada ação e para os atos de tramitação de cada
fase, um destes:

| Destino | Folha | Sai na impressão | Partes veem | Serve para |
|---|---|---|---|---|
| Nos autos | sim | sim, como termo ou certidão | sim, salvo se o rito disser que não | atos que passam no teste acima |
| Evento no extrato | não | sim, no extrato ao fim do PDF | não | controle que vale ver junto com os autos (distribuição, conferência) |
| Só no sistema | não | não | só se o rito disser | dados de gestão (número em outro sistema, origem da demanda, checklist) |

"Sai na impressão" fala do PDF dos autos. O que fica só no sistema, as
minutas e os documentos guardados fora dos autos podem sair, por seleção, na
**impressão interna**: um PDF de uso da equipe, sem folhas dos autos e
marcado como uso interno, que não é cópia do processo.

Os três ficam na cadeia de hash, com autor e hora. Um dado informado numa
ação (texto, número, data, escolha) aparece nas informações do processo,
com a fase em que foi registrado; se for nos autos, também na certidão.

## 6. Documentação exigida por fase e por ação

Cada fase do rito tem um **produto**: a admissibilidade produz um despacho; a
instrução, documentos juntados; a decisão, uma decisão assinada; o
cumprimento, uma certidão. Quando o rito diz qual documento a fase ou a ação
precisa, o sistema pode:

- mostrar a exigência enquanto a fase corre, com o modelo indicado;
- reconhecer o cumprimento na juntada (pelo tipo do documento, pelo modelo
  usado ou pela escolha de quem junta);
- impedir que a fase termine sem o documento, salvo **dispensa motivada**,
  que fica registrada nos autos (a forma não pode impedir o processo de
  andar, CPC, art. 277, mas a dispensa precisa ser justificada e visível).

A forma do documento importa: **redigir** (ato próprio do órgão: despacho,
decisão, certidão, ofício), **juntar** (documento recebido de fora:
comprovante, laudo, ofício respondido) ou **qualquer um**.

**Quem assina faz parte do ato.** Uma decisão colegiada só existe com a
assinatura dos membros; um parecer, com a de quem tem a atribuição para
emiti-lo. Por isso o rito pode pedir, no documento que ele redige, um número
de assinaturas e que uma delas seja de certa atribuição: sem isso, o
documento está nos autos, mas não cumpre o que a fase exige. Documento
recebido de fora não se assina na plataforma; a regra não vale para ele.

**O que é só da equipe continua só da equipe.** O rito pode marcar o
documento exigido como fora do portal das partes (um relatório preliminar,
uma nota técnica interna). A marca só esconde: nada que quem junta deixou
para a equipe passa a ser visto pelas partes por causa do rito.

**Documento que não é peça do processo.** Às vezes a ação pede um documento
só para controle (uma planilha de conferência, um print de outro sistema).
Ele não passa no teste dos autos, mas precisa ser guardado. O rito marca esse
documento como guardado fora dos autos: a equipe o vê e baixa, ele não recebe
folha, não sai no PDF dos autos e a parte não o vê.

**Ação que pede um dado.** A ação pode pedir só a confirmação ("conferir a
qualificação"), um dado ("informar o número no SIM", "informar o sistema de
origem", com lista de opções) ou um documento. O rito diz o nome do dado,
se a ação é obrigatória para a fase seguir e se as partes veem o que foi
informado.

## 7. Tramitação

- **Posse.** O processo está sempre com uma unidade; só ela age. Na prática
  forense, é a "carga" ou a localização.
- **Remessa** é ato de movimentação: entre órgãos, sempre nos autos (muda
  quem é competente); entre unidades do mesmo órgão, conforme o rito.
- **Conclusão** é a remessa a quem decide; abre o tempo do decisor (CPC,
  art. 228).
- **Fase × local.** A fase diz em que ponto do procedimento o processo
  está; a unidade diz onde está. Elas andam juntas na maioria dos ritos,
  mas não sempre (o gabinete devolve à secretaria para cumprir, sem mudar a
  fase).
- **Sobrestamento** suspende o andamento por motivo registrado;
  **arquivamento** encerra; desarquivar é ato motivado.
- **Paralelismo.** O motor do SIGO anda uma fase por vez; etapas paralelas
  do desenho viram sequência.
- **Espera por terceiros.** Diligência externa não é fase do procedimento:
  é uma pausa dentro de uma fase. O rito a modela como **fase de espera**:
  o processo vai para ela, registra a remessa e o retorno e volta para a
  fase em que estava, sem refazer o que já tinha sido cumprido. Difere do
  sobrestamento (que muda a situação do processo, com motivo nos autos) e
  da pendência ao decisor (que interrompe a fase dentro do órgão).
- **Impulso automático.** O rito pode mandar a fase seguir sozinha quando as
  ações obrigatórias são cumpridas e arquivar ao entrar na última fase. É o
  mesmo ato de quem cumpriu a ação, com as mesmas permissões e o mesmo
  registro; o termo diz que foi automático. Nunca escolhe entre duas saídas
  nem dispensa documento exigido: na dúvida, espera o botão. Quem escolhe é
  o rito: a regra de cada saída e, quando nenhuma vale, a **saída padrão**
  (o "senão" do desvio) que o rito tiver indicado.
- **Desvio pelo que já consta do processo.** A regra de um desvio pode ler o
  que foi respondido na fase, o que foi respondido em fase anterior (o rito
  ordinário ou sumário escolhido na admissibilidade) e dados do processo
  (urgente, sigiloso, com partes, origem, tipo). Mais de uma exigência na
  mesma regra vale como "e". O desvio nunca lê dado reservado.

## 8. Prazos

- Contagem: exclui o dia do começo e inclui o do vencimento, prorrogando
  para o primeiro dia útil (CPC, art. 224; Lei 9.784/1999, art. 66).
- Começo: da ciência; na comunicação eletrônica sem consulta, a ciência se
  presume após 10 dias corridos (Lei 11.419/2006, art. 5º, § 3º), padrão do
  SIGO (`ciencia_dias`).
- **Prazo próprio** (da parte: preclusão) × **prazo impróprio** (do órgão:
  controle de gestão). O prazo da fase do rito é impróprio: sinaliza, não
  extingue direito.
- **Prazo da ação** (do rito): também é impróprio e interno. Nasce quando a
  ação passa a valer na fase, termina com o cumprimento dela ou com a saída
  da fase, e nunca aparece para as partes. O prazo da parte nasce da
  intimação, não do rito.
- **Consequência do prazo impróprio vencido**: é de gestão, nunca
  processual. O rito pode marcar a urgência e avisar quem gere a unidade;
  não pode presumir o ato, dispensar a exigência nem mover o processo.
- **O que a fase ajusta ao entrar** (urgência, sigilo, responsável,
  pendência para quem decide) é ato de impulso oficial: vale o que o rito
  diz, fica registrado só para a equipe e não substitui decisão. Designar
  responsável não dá posse: ele precisa estar lotado na unidade que tem o
  processo.
- **Prazo que volta a valer conta de novo**: se a ação deixou de valer (a
  condição mudou) e volta, o prazo recomeça no dia em que voltou. Se o
  cumprimento foi desfeito, vale o vencimento de antes, porque o prazo nunca
  deixou de correr.
- **Contraditório conduzido pelo rito** (CF, art. 5º, LV; Lei 9.784/1999,
  arts. 3º, 26 a 28 e 44): a ação "Comunicar as partes" é a intimação ou
  citação; "Esperar a resposta" é a oportunidade de defesa. O prazo da parte
  é **próprio**: conta da ciência, e o fim dele sem manifestação gera a
  **certidão de decurso**, ato público que a parte vê. O decurso não presume
  a verdade dos fatos (Lei 9.784/1999, art. 27) nem dispensa a decisão: só registra que a
  oportunidade foi dada e não usada (preclusão), e o rito escolhe o caminho
  (ex.: defensor dativo no disciplinar).
- **Manifestação intempestiva** é juntada (direito de petição), mas não
  conta como resposta no prazo nem desfaz a certidão. Quem decide pode
  apreciá-la, como qualquer petição.
- **Audiência** (Lei 9.784/1999, arts. 26, § 2º, e 29): a designação é ato
  público, nos autos, e a lei pede antecedência mínima de três dias úteis
  entre a intimação e o comparecimento (o sistema não bloqueia: quem expede
  confere). O rito separa os passos: designar (data, local,
  participantes), intimar (comunicação com `{audiencia}`), registrar se
  houve a audiência e juntar a ata. Testemunha e perito não são partes:
  participam pelo nome na certidão.
- **Julgamento colegiado**: quando a decisão é de turma, câmara, comissão,
  conselho ou plenário, o rito diz os resultados possíveis, o quórum e o
  critério de desempate (voto do presidente ou o resultado mais favorável à
  parte, quando o regimento assim prevê). Impedimento e
  suspeição (Lei 9.784/1999, arts. 18 a 21), ausência e abstenção ficam
  registrados e não contam como voto. A certidão diz o resultado, o placar,
  o relator e os vencidos: é ato público, nos autos, e a parte a vê. Os
  fundamentos ficam no voto do relator e no acórdão, documentos da fase,
  porque a decisão precisa ser motivada (art. 50). Quem compõe o colegiado
  vem do órgão: cada mandato tem início e fim, e o encerrado fica guardado,
  porque o julgamento vale pela composição da data da sessão. O suplente só
  vota no lugar de um titular, e por isso quem registra o inclui.
- **Pauta da sessão de julgamento**: o julgamento colegiado acontece em
  sessão, e a pauta é a forma de dar publicidade e de permitir que a parte
  acompanhe e se manifeste (CF, art. 93, IX; por analogia, CPC, arts. 934 e
  935, que pedem a pauta publicada com antecedência). Por isso a pauta é
  publicada antes da sessão, com a antecedência que o colegiado definir, e
  cada processo recebe a certidão de inclusão, vista e avisada às partes. Só
  entra na pauta o processo que está numa unidade do colegiado e tem o
  julgamento pendente na fase. Depois de publicada, o processo só entra como
  extrapauta ou em mesa, com o motivo na certidão; retirar ou cancelar
  também é certificado com o motivo. Data, hora e local publicados não mudam
  em silêncio: para mudar, cancela-se a sessão, e as partes são avisadas.
  Quem vai votar precisa conhecer os autos: por isso quem compõe o
  colegiado lê o processo pautado, mesmo sem estar lotado na unidade, até o
  acórdão. A leitura é só leitura (o julgador não pratica atos no processo),
  alcança o que está juntado aos autos e fica registrada, para que a unidade
  saiba quem consultou. As anotações do julgador são dele: não são ato do
  processo e não vão aos autos.
- **Votação na sessão.** O relator vota primeiro e expõe o caso; os demais
  votam depois de conhecer o voto dele (por isso o voto do relator só se
  libera com relatório e fundamentos, e não muda depois). Cada um vota por
  si, e o voto só se torna definitivo com a proclamação do resultado pelo
  presidente; até ali, o membro pode reconsiderar (CPC, art. 941, § 1º, por
  analogia). Quem não votou conta como ausente, e o resultado segue a
  maioria, o quórum e o desempate que o rito define. A proclamação é o ato
  que vai aos autos, como certidão de julgamento.
- **Vista, adiamento e diligência.** Quem ainda não se sente pronto para
  votar pede vista e examina o processo; o julgamento fica suspenso pelo
  prazo do colegiado e retoma na sessão seguinte, com os votos já dados, que
  ainda podem ser reconsiderados (CPC, art. 940, por analogia). Vencido o
  prazo, o presidente requisita o processo, para que a vista não paralise o
  julgamento. O presidente também adia o julgamento, motivadamente, para a
  sessão seguinte (CPC, art. 935), e o converte em diligência quando falta
  algo para decidir (CPC, art. 938, § 3º): o processo volta à unidade e, ao
  retornar, os votos recomeçam, porque o que se julga mudou. O relator
  continua o mesmo. Cada ato é certificado nos autos e comunicado às partes.
- **Voto condutor e acórdão.** Proclamado o resultado, redige o acórdão o
  relator, se o voto dele venceu; vencido, redige quem primeiro votou no
  sentido que prevaleceu (CPC, art. 941, por analogia). O acórdão traz a
  ementa (CPC, art. 943, § 1º) e, além do voto condutor, os votos vencidos,
  que o integram para todos os fins (art. 941, § 3º). Tem prazo para ser
  lavrado (art. 944), e só depois de juntado aos autos as partes o conhecem;
  com ele termina a leitura dos autos pelos julgadores pela pauta.
- **Sessão virtual, destaque, sustentação oral e preferência.** Na sessão
  virtual assíncrona, cada membro vota no seu tempo dentro de um período, e
  o voto do relator está disponível desde o início (Res. CNJ 591/2024, arts.
  1º a 6º). No fim, apura-se como na proclamação; sem quórum, ou sem o voto
  do relator, o julgamento passa à sessão seguinte (art. 5º, §§ 7º e 8º). O
  destaque leva o processo a uma sessão síncrona, onde o julgamento recomeça
  (art. 8º): qualquer membro destaca; a parte pede até 48 horas antes do
  início, e o relator decide. A sustentação oral é direito da parte nas
  hipóteses do regimento (CPC, art. 937): na síncrona, ela se inscreve até o
  início da sessão; na virtual, envia a gravação até 48 horas antes (Res. CNJ
  591, art. 9º), e durante a votação pode esclarecer fato (art. 9º, § 6º). A
  ordem de julgamento põe à frente os processos com sustentação, depois os
  com preferência e os iniciados em sessão anterior (CPC, art. 936). Os
  pedidos da parte e a decisão sobre eles ficam com a sessão; vão aos autos o
  destaque, o adiamento e o resultado.
- **Audiência na plataforma.** A audiência designada pelo rito é conduzida
  por quem tem o processo, no dia dela. O termo registra quem esteve
  presente e quem faltou, o que cada um disse ou pediu, o que se decidiu e a
  hora do fim (CPC, art. 367, por analogia); quem conduziu assina. O termo
  vai aos autos pela juntada, como qualquer documento, e é ele que as
  partes veem. Se a audiência não se realizou, o termo diz por quê.
- **Disputa de preços.** A contratação escolhe o fornecedor por um ato do
  rito, e não fora dele: o aviso, o adiamento e o cancelamento vão aos autos,
  e o resultado (homologada, deserta ou fracassada) decide o caminho. O
  fornecedor não é parte e não vê os autos: vê o aviso e a própria proposta.
  O conteúdo das propostas fica em sigilo até a abertura, para ninguém
  ajustar preço pelo dos outros. Na dispensa eletrônica, a abertura respeita
  ao menos 3 dias úteis da publicação (IN SEGES/ME 67/2021, art. 6º).
  Nos lances, quem dá o lance não aparece: cada um vê o melhor valor e a
  própria posição, e o órgão vê apelidos até o fim, para que a disputa seja
  pelo preço e não por quem concorre. O prazo é o do relógio do servidor,
  igual para todos, e o lance excluído pelo órgão sempre tem motivo e aviso
  a todos na sala.
- **Reunião deliberativa.** O colegiado também decide assuntos que não são
  processos. Cada assunto tem a forma de votação e a maioria que ele exige:
  simples (mais votos a favor que contra), absoluta (mais da metade dos
  membros) ou dois terços dos membros. Sem o quórum do colegiado não se
  delibera. Quem tem interesse no assunto declara o impedimento e não vota
  (Lei 9.784/1999, arts. 18 e 19). No voto secreto, só se registra quem
  votou e a contagem. O empate se resolve pelo voto de qualidade do
  presidente ou, se o colegiado preferir, mantém o que está (rejeita). A ata
  só traz o resultado depois de apurados os votos (CC, art. 1.354-A, § 3º,
  por analogia). Na reunião virtual, o empate e o assunto sem quórum vão para
  a reunião seguinte (Res. CNJ 591/2024, art. 5º, § 8º, por analogia).
- **Encerramento e ata.** Encerrada a sessão síncrona, o processo da pauta
  que não foi julgado passa à sessão seguinte, com os votos já dados (CPC,
  art. 935, por analogia). A ata registra quem esteve presente (na virtual,
  quem votou) e o desfecho de cada processo, e é assinada pelo presidente e
  pela secretaria; depois da primeira assinatura não se altera. A ata fica
  com a sessão; nos autos ficam as certidões de cada ato (julgamento,
  adiamento, vista, retirada).
- **Prorrogação e devolução de prazo**: o prazo corre sem suspensão, salvo
  força maior (Lei 9.784/1999, art. 67). Por analogia ao CPC (arts. 139, VI,
  e 223), a autoridade pode dilatar o prazo antes do vencimento
  (prorrogação) e restituí-lo a quem provou justa causa depois dele
  (devolução). Os dois são motivados e certificados nos autos; a devolução
  desfaz o efeito do decurso para a parte que não respondeu.
- **Uma rodada por passagem na fase**: se o processo volta à fase, a
  comunicação é nova, com prazo novo. A diligência em fase de espera não
  suspende o prazo da parte.

## 9. Acesso, sigilo e papéis

- Normal: a equipe do órgão vê; restrito: só quem por ele passou e o admin;
  minuta: só a unidade que a redigiu e as unidades a quem ela a enviou com
  o processo (a assessoria que minuta para o gabinete assinar). A redação
  de quem escreveu antes de outra pessoa revisar fica guardada (versões),
  com o mesmo acesso do documento e nunca para as partes.
- A parte vê pelo portal só o que lhe diz respeito: documentos marcados
  como visíveis, atos dos autos, comunicações a ela. Nunca registros
  internos, pendências, orientações ou minutas.
- Quem é parte num processo não é o órgão nele (impedimento), ainda que
  seja admin ou lotado na unidade.
- Competência para o ato: ter o processo na unidade não basta para todo
  ato. O rito pode reservar, por fase, quem conclui (o responsável, quem
  gere a unidade ou quem tem certa atribuição, como o relator ou a
  autoridade julgadora), quem dispensa o que a fase exige, quem segue por
  caminho fora do previsto e quem arquiva, sobresta ou reativa. Sem
  reserva, vale quem tem o processo, com motivo registrado. A
  administração do Processo Eletrônico sempre pode, para o processo nunca
  ficar preso.

## 10. Integridade

- Documento juntado não se edita nem se apaga; correção é ato novo
  (certidão, novo documento). Desentranhamento, quando houver, é ato formal.
- Cada evento entra numa cadeia de hash; folhas são numeradas em sequência e
  nunca renumeradas.
- O registro interno também entra na cadeia: tirar algo dos autos não é
  apagar, é classificar.

## 11. Como isso está no SIGO hoje

| Conceito | Implementação |
|---|---|
| Capa | Aba **Capa** de `src/components/secretaria/ProcessoView.jsx` (`CapaProcesso`): identificação, origem, quem solicitou, partes, tramitação, campos e cronologia dos autos, sem botões de ato |
| Andamento | Aba **Andamento**: fase atual, minutas, pendências e prazos, comunicações, partes e portal; as ações ficam aqui |
| Autos | Aba **Autos**: documentos juntados, leitura em sequência e PDF |
| Capa e folha de dados do PDF | A capa impressa só identifica (órgão, número, autuação, ativo ou arquivado). O conteúdo da capa da seção 4 vai na **folha de dados**, a folha do evento 1, montada na impressão (`functions-v2/src/shared/folhaDados.ts`); o rito pode mandar para ela dados registrados depois (`acoes_regras[i].folha_dados`) |
| Eventos | Aba **Eventos** (`EventosAutos.jsx`): todos os eventos, filtros por origem |
| Origem do processo | `secProcessos.origem` (`{ tipo, descricao }`, e `nome` quando o tipo é da lista do órgão, `o_…`), informada na autuação; tipos em `ORIGENS` (`functions-v2/src/shared/secretaria.ts`, espelho em `src/components/secretaria/comum.jsx`) e em `secConfig.listas.origem` |
| Origem do evento | `origemEvento` em `functions-v2/src/shared/autos.ts`: `usuario` (termo com folha), `interno` (o rito deixou fora dos autos) ou `sistema` (os dois últimos saem no extrato) |
| O que vai aos autos | `fase.registro` no rito (`remessas_fora` ou `interno`) e `acoes_regras[i].autos` (certidão de cumprimento); `movimentoInterno` em `functions-v2/src/shared/exigencias.ts` |
| Documento exigido | `fase.documentos` e `acoes_regras[i].documento` no rito; a juntada cumpre (`reconhecer`), sair da fase sem ele pede motivo de dispensa; `exigencias_cumpridas` no processo |
| Minuta | Trabalho interno da unidade (`minutaAcessivel`); segue com o processo quando marcada na remessa (`unidades_acesso`), sem constar do termo |
| Comunicações | `functions-v2/src/shared/comunicacoes.ts`; só a unidade que expede (a secretaria, por padrão; `unidadeExpede`) expede, sempre nos autos |
| Papéis da unidade | Quem decide (recebe conclusão, aprecia pendência) e quem expede comunicação: `papeis` da unidade, com o tipo como padrão; `unidadeDecide` e `unidadeExpede` em `functions-v2/src/shared/secretaria.ts` |
| Guarda fora dos autos | Registro no extrato impresso, salvo quando a exigência cumprida ou a fase pedem só no sistema (`destinoDaGuarda` em `functions-v2/src/shared/exigencias.ts`) |
| Exemplo completo | Modelo pronto "Rito Consultas CAOCIPP" (`ritoConsultas` em `src/lib/secretariaRito.js`), conferido contra as regras do servidor em `functions-v2/test/modeloConsultas.test.js`; é o exemplo do Guia do rito |
| Impressão interna | O que fica fora dos autos sai, por seleção, num PDF de uso da equipe (`montarPdfInterno` em `functions-v2/src/secretaria/exportar.ts`; `registroInterno` e `documentoInterno` em `shared/autos.ts`); nunca vai às partes nem leva folhas dos autos |
| Revisão | Redações anteriores em `documentos/{doc}/versoes` (`versaoAnterior` em `functions-v2/src/shared/secretaria.ts`, gravada por `editarMinuta`); botão Finalizar da fase (`fase.juntada_conjunta`): juntadas comuns em sequência, na ordem escolhida (`src/lib/juntadaConjunta.js`) |
| Fase de espera | `fase.espera` no rito e `secProcessos.espera` (`{ fase, unidade, responsavel_uid, desde }`); `saidasDoProcesso` em `functions-v2/src/shared/secretaria.ts`; a volta não zera o estado da fase de origem (`ehRetomada` em `processos.ts`) |
| Impulso automático | `fase.avanco: 'auto'` (`saidaAutomatica`; dispara ao cumprir ação obrigatória e ao juntar ou guardar documento em fase que exige algo, `exigeAlgo`), `fase.ao_entrar.arquivar` e `fase.situacao_registro` (coluna da consulta ou do expediente ligado, ou fase do registro de uma página própria, pelas regras de transição da página; `functions-v2/src/shared/situacaoRegistro.ts`) e `tipo.cria_registro` (a autuação cria o registro da página, que passa a ser o conduzido; `functions-v2/src/shared/registroCriado.ts`), aplicados em `functions-v2/src/secretaria/processos.ts` |
| Impedimento de parte | `ehParte` em `functions-v2/src/shared/secretaria.ts` |
| Competência para o ato | `fase.permissoes` (concluir, dispensar, desviar, situacao) e `acoes_regras[i].quem` com `atribuicao`; `functions-v2/src/shared/permissoesFase.ts`, conferido em `exigirSaida`, `exigirDispensa`, `marcarAcao` e `alterarStatus` (`processos.ts`) |

## 12. Antes de mexer no Processo Eletrônico

- [ ] O que estou mudando é capa, andamento, autos ou evento? A mudança
      respeita a camada?
- [ ] Cada ato novo foi classificado pelo teste da seção 5? Se vai aos
      autos, tem título de termo em `tituloEvento` e folha?
- [ ] A parte vê só o que deve (portal, avisos, PDF do portal)?
- [ ] A regra de negócio está no servidor (functions), com o espelho de
      tela apenas para orientar?
- [ ] Processos antigos continuam abrindo (campos ausentes têm padrão)?
- [ ] A cadeia de hash e a numeração de folhas não mudam para o passado?
- [ ] O rito comum (sem nada configurado) se comporta como antes?
- [ ] Os documentos `PROCESSO_ELETRONICO.md`, este guia e o `CHANGELOG.md`
      foram atualizados?

## Referências

- Constituição Federal, art. 5º, LV, LX e LXXVIII; art. 37.
- Lei 9.784/1999 (processo administrativo federal).
- Lei 13.105/2015 (CPC), arts. 188, 203, 206 a 208, 219, 224, 228, 231, 269 a 275.
- Lei 11.419/2006 (informatização do processo judicial).
- Decreto 8.539/2015 (processo eletrônico na administração pública federal).
- Lei 12.527/2011 (acesso à informação) e Lei 13.709/2018 (LGPD).
- Lei 14.063/2020 (assinaturas eletrônicas).
- Resolução CNJ 46/2007 (Tabelas Processuais Unificadas: classes, assuntos e
  movimentos) e Resolução CNJ 121/2010 (dados básicos na consulta).
- Resolução CNMP 63/2010 (Tabelas Unificadas do MP), 23/2007 (inquérito
  civil), 174/2017 (notícia de fato e procedimento administrativo) e
  181/2017 (procedimento investigatório criminal).
- Sistemas de referência: eproc (capa e eventos), SEI (níveis de acesso,
  "Gerar PDF", blocos de assinatura), PJe.
