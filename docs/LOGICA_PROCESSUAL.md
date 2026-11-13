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
| Origem | Como o processo chegou (requerimento, representação ou denúncia, ofício de outro órgão, de ofício, derivado de outro processo), a referência (nº do ofício, processo de origem, meio de recebimento), data e unidade de autuação | Competência, legitimidade, prevenção e contagem de prazos dependem da origem; Lei 9.784/1999, arts. 5º e 6º |
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

## 8. Prazos

- Contagem: exclui o dia do começo e inclui o do vencimento, prorrogando
  para o primeiro dia útil (CPC, art. 224; Lei 9.784/1999, art. 66).
- Começo: da ciência; na comunicação eletrônica sem consulta, a ciência se
  presume após 10 dias corridos (Lei 11.419/2006, art. 5º, § 3º), padrão do
  SIGO (`ciencia_dias`).
- **Prazo próprio** (da parte: preclusão) × **prazo impróprio** (do órgão:
  controle de gestão). O prazo da fase do rito é impróprio: sinaliza, não
  extingue direito.

## 9. Acesso, sigilo e papéis

- Normal: a equipe do órgão vê; restrito: só quem por ele passou e o admin;
  minuta: só a unidade que a redigiu e as unidades a quem ela a enviou com
  o processo (a assessoria que minuta para o gabinete assinar).
- A parte vê pelo portal só o que lhe diz respeito: documentos marcados
  como visíveis, atos dos autos, comunicações a ela. Nunca registros
  internos, pendências, orientações ou minutas.
- Quem é parte num processo não é o órgão nele (impedimento), ainda que
  seja admin ou lotado na unidade.

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
| Origem do processo | `secProcessos.origem` (`{ tipo, descricao }`), informada na autuação; tipos em `ORIGENS` (`functions-v2/src/shared/secretaria.ts`, espelho em `src/components/secretaria/comum.jsx`) |
| Origem do evento | `origemEvento` em `functions-v2/src/shared/autos.ts`: `usuario` (termo com folha), `interno` (o rito deixou fora dos autos) ou `sistema` (os dois últimos saem no extrato) |
| O que vai aos autos | `fase.registro` no rito (`remessas_fora` ou `interno`) e `acoes_regras[i].autos` (certidão de cumprimento); `movimentoInterno` em `functions-v2/src/shared/exigencias.ts` |
| Documento exigido | `fase.documentos` e `acoes_regras[i].documento` no rito; a juntada cumpre (`reconhecer`), sair da fase sem ele pede motivo de dispensa; `exigencias_cumpridas` no processo |
| Minuta | Trabalho interno da unidade (`minutaAcessivel`); segue com o processo quando marcada na remessa (`unidades_acesso`), sem constar do termo |
| Comunicações | `functions-v2/src/shared/comunicacoes.ts`; só a secretaria expede, sempre nos autos |
| Impedimento de parte | `ehParte` em `functions-v2/src/shared/secretaria.ts` |

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
