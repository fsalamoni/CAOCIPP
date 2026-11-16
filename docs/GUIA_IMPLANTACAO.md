# Guia de implantação do Processo Eletrônico

Este guia mostra, na prática, como montar o processo eletrônico de um órgão, desde o mapeamento do processo real até o uso e os ajustes. No SIGO, ele fica em **Painel Administrativo > Processo Eletrônico**, no botão **Guia de implantação**, e o texto é o mesmo daqui.

Outros guias complementam este:
- o **Guia do rito**, aberto pelo editor de rito, explica cada opção do editor;
- [MODELOS_DE_RITO.md](MODELOS_DE_RITO.md) traz o catálogo da biblioteca de modelos;
- [LOGICA_PROCESSUAL.md](LOGICA_PROCESSUAL.md) explica como o processo anda.

## 1. Antes de configurar: mapeie o processo real

Reúna quem trabalha no processo hoje e responda, por escrito:

1. **Quem começa** o processo (protocolo, um setor, o cidadão pelo portal ou de ofício) e com quais documentos?
2. **Por onde ele passa**, em ordem, e quem faz o quê em cada lugar? Cada lugar vira uma fase, e cada pessoa ou setor vira uma unidade.
3. **Quem decide**, e há mais de uma instância (reconsideração, recurso, colegiado)?
4. **Há partes de fora** (requerente, acusado, licitante, contratada)? Elas precisam ser ouvidas, intimadas ou ter prazo?
5. **O processo pode resultar em sanção?** Nesse caso há contraditório e ampla defesa (seção 4) e separação entre quem instrui e quem julga (seção 5).
6. **Quais prazos a norma fixa**? São contados em dias úteis ou corridos? A partir de quê?
7. **Quais peças são obrigatórias** (portaria, notificação, defesa, relatório, decisão, ata)?
8. **Há sigilo** em alguma etapa, como instrução disciplinar, dado pessoal ou dado de saúde?
9. **Onde o caminho se divide**: deferido ou indeferido, defesa apresentada ou não, recurso ou não?

Com essas respostas, o rito quase se escreve sozinho:

| Respostas | Viram no rito |
|---|---|
| 2 | fases e unidades |
| 7 | ações e documentos |
| 6 | prazos |
| 9 | desvios |
| 4 e 5 | partes e comunicações |

## 2. Escolha o ponto de partida

Quase sempre há um modelo próximo na **Biblioteca de modelos de processo**, em Ritos > Novo rito. Comece pelo mais parecido e ajuste: é mais rápido e o modelo já traz as garantias que a lei exige. O catálogo completo está em [MODELOS_DE_RITO.md](MODELOS_DE_RITO.md).

Se nenhum modelo servir, há três caminhos:
- usar o **Processo administrativo com interessado**, baseado na Lei 9.784, que é o rito subsidiário;
- importar o fluxo que o órgão já tem (planilha, Word, PDF, Bizagi ou BPMN);
- começar em branco.

O porte de cada modelo indica o tamanho do processo:
- **Curto:** decisão rápida e pouca instrução.
- **Médio:** instrução, manifestação da parte, decisão e recurso.
- **Longo:** comissão, audiências, defesa escrita, relatório, julgamento e várias instâncias.

## 3. Configure nesta ordem

Cada passo corresponde a uma aba da configuração. No guia dentro do SIGO, o botão **Abrir** leva direto à aba.

1. **Estrutura.** Se o órgão tem órgãos internos (promotorias, departamentos), crie-os. Cada um pode ter tipos de processo próprios.
2. **Unidades e equipes.** Crie uma unidade para cada lugar por onde o processo passa: quem protocola, quem instrui, quem decide, quem assessora, quem julga em colegiado. Lote as pessoas e dê a cada uma o papel (gere ou atua) e a atribuição, como Presidente da comissão, Pregoeiro ou Fiscal do contrato. As atribuições servem para reservar atos e designar responsáveis no rito.
3. **Rito.** Em Novo rito, comece de um modelo da biblioteca, de um arquivo ou em branco. Troque as unidades genéricas pelas do órgão e confira prazos e contagem com a norma local.
4. **Tipo de processo.** O tipo liga o rito ao "Novo processo". Nele se definem:
   - o formulário, com os campos, as partes e os nomes dos polos;
   - a numeração;
   - o sigilo padrão;
   - a unidade de entrada;
   - de onde o processo pode nascer;
   - o registro que a autuação cria numa página própria, se a equipe acompanha o processo num quadro (contratos, atendimentos, procedimentos disciplinares).

   Um rito pode servir a vários tipos.
5. **Documentos e modelos.** Configure o papel timbrado e crie um modelo de texto para cada peça que o rito manda redigir (portaria, despacho, decisão, ata, relatório). Use o mesmo tipo de documento que a ação pede: assim a equipe já começa do texto do órgão.
6. **Listas do órgão (se precisar).** Cadastre as espécies de comunicação e de audiência e as origens do processo que o órgão usa e o sistema não traz (edital, sessão de mediação, ouvidoria). Marque "Nome masculino" quando for o caso, para os textos saírem "ao edital". Elas entram na autuação, nas ações do rito e nas condições.
7. **Calendário.** Cadastre os feriados e pontos facultativos do órgão. Os prazos em dias úteis pulam esses dias.
8. **Preferências.** Defina se a petição da parte interrompe a fase e em quantos dias a comunicação não aberta é dada por ciente.

## 4. Processo com partes: contraditório e ampla defesa

Quando alguém de fora pode ser atingido pela decisão, o rito precisa garantir cada item abaixo.

| Garantia | Como o rito garante |
|---|---|
| Saber que o processo existe e do que se trata | Ação **Comunicar as partes**, da espécie citação ou notificação, dirigida ao polo certo, com texto que diga o fato e o enquadramento. Cada comunicação vira certidão nos autos. |
| Prazo para se defender | A comunicação leva um **prazo** (dias úteis ou corridos) e é seguida da ação **Esperar a resposta das partes**. O prazo conta da ciência. Sem resposta, o sistema certifica o decurso. |
| Ver os autos | O **portal das partes** mostra os autos públicos e cada comunicação. O que é interno nunca vai à parte: dados reservados, impressão interna e pendências. |
| Produzir provas | **Designar audiência ou sessão** (oitiva, instrução, inspeção), com uma intimação que traga `{audiencia}` no texto. A parte também junta documentos pelo portal. |
| Defesa quando a parte se cala | A fase sai pela resposta **Sem manifestação** para uma fase de revelia ou de defensor dativo, com novo prazo. |
| Decisão motivada | Documento **Decisão** obrigatório na fase de julgamento. Se houver comissão, também o **Relatório** antes dela. |
| Recorrer | A decisão é comunicada com o prazo do recurso, o rito espera a resposta e a fase sai por ela: recurso apresentado vai à instância recursal; sem recurso, ao cumprimento. |
| Justa causa no prazo | Na tela do processo, **Prorrogar** o prazo enquanto ele corre ou **Devolver** depois de vencido, sempre com motivo e certidão. |
| Nome de cada parte | No tipo de processo, os polos ganham nome (Denunciante, Acusado, Contratada). O nome aparece nas certidões, nas comunicações e no portal. |

## 5. Processo sancionador: cuidados a mais

- **Nunca penal.** O SIGO modela processos administrativos. Quando o fato também pode ter outra natureza, o rito registra a **remessa a outros órgãos** e segue apenas no que é administrativo.
- **Quem instrui não julga.** Ponha instrução e julgamento em unidades diferentes, como Comissão processante e Gabinete. Em **Quem pode nesta fase**, reserve a conclusão da fase de julgamento a quem tem a atribuição.
- **Acusação clara.** A portaria ou o termo de indiciação descreve o fato e o enquadramento, e a defesa responde a ele. Exija esses documentos nas fases certas.
- **Prescrição e prazos de conclusão.** Registre em formulário as datas que contam: ciência do fato, instauração e interrupções. Use o prazo automático da fase para o prazo de conclusão.
- **Dosimetria.** Um formulário com a sanção escolhida, os agravantes e os atenuantes deixa a proporcionalidade à vista de quem revisa.
- **Sigilo na instrução.** Em **Ao entrar**, torne o processo restrito na fase de instrução e devolva-o ao normal no julgamento, se a norma pedir.

## 6. Processo interno, sem partes

Em consultas, pareceres e pedidos entre setores, não marque polos no tipo de processo. Três recursos do rito ajudam nesses casos:
- **fases de espera**, para diligências fora do órgão;
- **andamento automático**, para a fase seguir sozinha quando o que ela exige estiver cumprido;
- **pendência para quem decide**, para levar o processo ao gabinete.

O Rito Consultas CAOCIPP, descrito no Guia do rito, é um exemplo completo.

## 7. Julgamento em colegiado e a primeira sessão

Quando a decisão é de um conselho, comissão, junta ou câmara, o processo vai a julgamento em sessão, com pauta, relator, votos, vista, acórdão e ata.

1. Em **Estrutura**, cadastre o órgão com **decisão colegiada** e a composição: presidente, titulares e suplentes, com o período de cada um. Ajuste a antecedência da pauta, o prazo de vista e o do acórdão, se o regimento disser.
2. Em **Unidades e equipes**, crie ao menos uma unidade do colegiado, de preferência a secretaria que expede. Só entram na pauta processos que estão numa unidade dele.
3. No rito, use na fase de julgamento a ação **Julgar em colegiado**, com os resultados possíveis. Na biblioteca, o filtro **Usa** mostra os modelos que já trazem a ação.
4. Na aba **Sessões**, a secretaria segue o guia do colegiado, que confere cada passo com o que já existe: marca a sessão, inclui os processos com julgamento pendente, publica a pauta e, no dia, registra a presença, colhe os votos e proclama. Ao encerrar, o sistema gera a ata.
5. O **Relatório do colegiado**, na mesma aba, mostra por período os julgados por resultado e por relator, o que saiu da pauta, as vistas em atraso e o tempo médio até o acórdão, com download em CSV ou Excel.

## 8. Teste antes de pôr em uso

1. No editor, resolva todas as **pendências** e abra a **Prévia**. Ela mostra como a equipe e as partes vão ver cada fase.
2. Use **Ver como a equipe e a parte** para conferir as telas de cada papel.
3. Autue um **processo de teste** com uma parte de teste (use um e-mail seu) e leve-o do começo ao fim, passando por todos os desvios importantes. Exclua-o depois.
4. Confira as certidões nos autos e o que a parte viu no portal.

## 9. Em uso: ajuste sem medo

Cada vez que o rito é salvo, vira uma nova **versão**. Os processos já autuados seguem com a cópia do rito da autuação, e também com os nomes de polos daquela época. Por isso, ajustar o rito não bagunça o que está em curso. O histórico da configuração registra quem mudou o quê.

Reveja o rito depois dos primeiros processos reais. Onde a equipe trava, costuma faltar uma ação, um documento ou um desvio.

## 10. Lista final antes de ativar

- [ ] Toda fase tem unidade, e toda unidade tem pelo menos uma pessoa lotada.
- [ ] Prazos e contagem foram conferidos com a norma do órgão, e os feriados estão no calendário.
- [ ] Se há partes: citação ou notificação com prazo, espera da defesa, decisão comunicada e prazo de recurso.
- [ ] Os documentos obrigatórios estão marcados e têm modelo de texto.
- [ ] O tipo de processo tem o formulário, os polos e a unidade de entrada.
- [ ] Um processo de teste foi levado até o fim.
