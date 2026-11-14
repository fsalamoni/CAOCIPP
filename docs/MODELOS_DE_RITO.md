# Biblioteca de modelos de rito

Processos completos e prontos para começar, montados a partir da lei de cada área. Ficam em **Novo rito**, na seção **Biblioteca de modelos de processo**. O modelo é só o ponto de partida: nada é criado até o órgão revisar e implantar, e tudo se ajusta (fases, unidades, prazos, ações, documentos, saídas e partes).

Nenhum modelo é penal. Os sancionadores são administrativos (disciplinar, ético, fiscalização, contratual, fiscal, de trânsito) e os do Ministério Público são extrajudiciais cíveis (notícia de fato, procedimento administrativo, procedimento preparatório e inquérito civil).

## Como usar

1. Em **Novo rito**, filtre por **área** e **porte** ou busque por palavra ou lei. A busca ignora acentos.
2. Abra **Quando usar, base legal e fases** para ver para que o modelo serve, de onde vêm os prazos, quais são as partes e a sequência de fases.
3. Clique em **Usar este modelo**. A revisão faz três coisas:
   - casa as unidades do modelo com as do órgão pelo nome, ou propõe criá-las;
   - mostra as pendências, se houver;
   - se o modelo tem partes, propõe criar o tipo de processo já com os polos e os nomes deles, por exemplo Denunciante e Acusado ou Contratante e Contratada.
4. Ajuste o rito à norma do órgão. Os pontos mais comuns:
   - prazos e contagem (dias úteis ou corridos), que o regimento local muda com frequência;
   - nomes de unidades;
   - sanções da lista;
   - documentos exigidos.
5. Implante. Depois, o rito e o tipo se editam como qualquer outro, e cada mudança vira uma nova versão.

## Porte

- **Curto:** até cerca de 6 fases, com decisão rápida e pouca instrução. Por exemplo: notícia de fato, acesso à informação, recebimento e pagamento.
- **Médio:** instrução, manifestação da parte e decisão, com recurso.
- **Longo:** várias instâncias, comissão, audiências, defesa escrita, relatório e julgamento colegiado.

## O que os modelos usam do motor

Cada modelo foi escrito para mostrar, na prática, os recursos do editor de rito:

- **Comunicações às partes:** cada comunicação tem espécie, polos, prazo e contagem.
- **Espera da resposta:** a resposta pode ser Apresentada, Parcial ou Sem manifestação, e pode decidir a saída da fase.
- **Audiências, sessões, oitivas e vistorias:** a intimação usa `{audiencia}` no texto.
- **Escolhas que decidem a saída:** por exemplo, deferir, indeferir ou converter.
- **Ações condicionais:** ações que só valem em alguns casos.
- **Documentos exigidos:** com o tipo e com a indicação de redigir ou juntar.
- **Formulários de dados:** com folha de dados.
- **Fases de espera:** para diligências e suspensões.
- **Andamento automático.**
- **Efeitos ao entrar na fase:**
  - sigilo, que é comum nos disciplinares e éticos;
  - pendência para o decisor;
  - arquivamento.
- **Nome público da fase:** o nome que a parte vê no portal.

## Qualidade verificada automaticamente

Toda mudança na biblioteca passa por dois testes:

- **`src/lib/bibliotecaRitos.test.js`:**
  - toda fase é alcançável e chega a um fim;
  - toda condição usa uma opção que existe;
  - toda espera aponta para uma comunicação anterior com prazo;
  - toda saída por resposta está entre os encaminhamentos;
  - nenhuma fase passa de 20 ações;
  - o diagrama (Mermaid) preserva fases e prazos.
- **`functions-v2/test/bibliotecaRitos.test.js`:**
  - o servidor aceita cada modelo e guarda tudo o que ele configura;
  - os metadados estão completos;
  - nada é penal;
  - o tipo de processo de cada modelo é válido.

O teste de tela (e2e) abre cada modelo em **Novo rito** e confere que nenhum chega com pendência que impeça implantar.

## Como acrescentar um modelo

Os modelos ficam em `src/lib/modelos/<área>.js` e são escritos com a linguagem de `src/lib/modelos/dsl.js`.

- As fases e as ações se citam pelo nome. A função `montar` troca os nomes por identificadores e reclama de nome que não existe.
- Cada modelo traz:
  - `id`, `nome`, `area` e `porte`;
  - `descricao`, explicativa: para que serve, como corre, onde está o contraditório e como termina;
  - `quando` e `base`;
  - `tipo` (polos e nomes), quando há partes.
- Para conferir só uma área: `MODELOS_AREA=<área> node --test src/lib/bibliotecaRitos.test.js`.
- O catálogo abaixo é gerado a partir dos próprios modelos.

## Fontes

A pesquisa normativa que embasou os modelos está em `/mnt/project-files/modelos-rito/pesquisa-modelos.md`, nos arquivos do projeto. Em cada modelo, a **Base** cita as normas e os artigos. Onde a pesquisa não confirmou um ponto, a orientação da fase avisa e pede que o órgão confira.

## Catálogo

| Área | Modelos |
|---|---|
| Administrativo geral | Processo administrativo com interessado (médio) |
| Correcional e disciplinar | Sindicância investigativa e investigação preliminar sumária (curto); Processo administrativo disciplinar, rito ordinário (longo); Processo administrativo disciplinar, rito sumário (médio); Termo de ajustamento de conduta disciplinar (curto) |
| Ética e conselhos profissionais | Processo ético-profissional (conselho profissional) (longo); Processo disciplinar (entidade de classe) (longo); Apuração ética por comissão de ética pública (médio) |
| Sancionador e fiscalização | Responsabilização de pessoa jurídica (PAR) (longo); Infração contratual e sanção a fornecedor (médio); Fiscalização com auto de infração e defesa (médio); Processo administrativo fiscal (lançamento e impugnação) (longo); Multa de trânsito (defesa prévia e recursos) (médio) |
| Contratações e contratos | Contratação pública por licitação (longo); Contratação direta: dispensa e inexigibilidade (médio); Compra ou contratação privada (médio); Gestão e fiscalização de contrato de serviço continuado (longo); Recebimento de bens ou serviços, liquidação e pagamento (curto); Parceria com organização da sociedade civil (longo) |
| Atendimento, ouvidoria e transparência | Manifestação de ouvidoria (curto); Pedido de acesso à informação (curto) |
| Ministério Público (não penal) | Notícia de Fato (curto); Procedimento Administrativo do Ministério Público (médio); Procedimento Preparatório (médio); Inquérito Civil (longo) |
| Gestão interna e pessoas | Consulta ou parecer interno (curto); Concessão de benefício ou licença a servidor (curto) |
| Controle e contas | Tomada de contas especial (fase interna) (longo) |

## Administrativo geral

### Processo administrativo com interessado

**Porte:** Médio, 10 fases. **Identificador:** `pa-geral`.

Rito-base para qualquer pedido que exige decisão motivada da Administração: autorização, registro, reconhecimento de direito, certidão com análise. Recebe o requerimento sem recusar (pede o que falta), instrui com provas e diligências, ouve o interessado nas alegações finais, decide em até 30 dias e abre recurso, com reconsideração antes de subir. Serve de rito subsidiário quando não há lei específica.

**Quando usar:** Pedidos de particulares ou servidores sem rito próprio em lei; processos de ofício que afetem alguém.

**Base:** Lei 9.784/1999, arts. 6º, 9º, 18 a 21, 24, 26 a 28, 38, 41, 42, 44, 48 a 50, 56 a 67.

**Partes:** Requerente (requerente), Interessado (interessado).

**Recursos do motor usados:** 6 comunicações às partes; 3 esperas de resposta; audiência (oitiva); 6 documentos; 1 formulários de dados; 3 fases com saída decidida pela resposta.

**Fases:** 1. Protocolo, Secretaria; 2. Admissibilidade e saneamento (5 dias corridos), Unidade instrutora; 3. Exigência ao interessado, Unidade instrutora; 4. Instrução, Unidade instrutora; 5. Parecer jurídico (15 dias corridos), Assessoria jurídica; 6. Alegações finais, Unidade instrutora; 7. Decisão (30 dias corridos), Gabinete; 8. Recurso (30 dias corridos), Gabinete; 9. Cumprimento, Secretaria; 10. Arquivamento, Secretaria.

## Correcional e disciplinar

### Sindicância investigativa e investigação preliminar sumária

**Porte:** Curto, 9 fases. **Identificador:** `sindicancia-investigativa`.

Procedimento preparatório, sem acusado e sem punição, para descobrir se houve irregularidade e quem a praticou. Começa pelo juízo de admissibilidade da notícia, que pode arquivar, propor TAC, abrir a investigação ou ir direto ao processo acusatório. Na investigação, o sindicante ou a comissão examina documentos, requisita informações e ouve pessoas, com acesso restrito. Não há contraditório: o investigado pode ser ouvido, mas a defesa só nasce no processo acusatório que vier depois. Termina por arquivamento, TAC ou instauração do processo acusatório.

**Quando usar:** Notícia de irregularidade funcional sem indícios suficientes de autoria e materialidade para abrir já um PAD ou sindicância acusatória.

**Base:** Lei 8.112/1990, arts. 143 a 145; Portaria Normativa CGU 27/2022, arts. 36 a 52 (exemplo de boa prática fora do Executivo federal).

**Partes:** Investigado (requerido), Noticiante (interessado).

**Recursos do motor usados:** 1 comunicações às partes; audiência (oitiva); 9 documentos; 1 formulários de dados; 3 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Recebimento da notícia, Corregedoria; 2. Juízo de admissibilidade, Corregedoria; 3. Instauração, Corregedoria; 4. Coleta de informações (60 dias corridos), Comissão processante; 5. Aguardando informação externa, Comissão processante; 6. Relatório conclusivo, Comissão processante; 7. Decisão, Gabinete; 8. Instauração do processo seguinte, Corregedoria; 9. Arquivamento, Corregedoria.

### Processo administrativo disciplinar, rito ordinário

**Porte:** Longo, 15 fases. **Identificador:** `pad-ordinario`.

Apura a responsabilidade de servidor por infração ligada ao cargo e pode terminar em qualquer sanção disciplinar, inclusive demissão. Uma comissão de três servidores estáveis instala os trabalhos, notifica o acusado e instrui com depoimentos, diligências e perícias, encerrando com o interrogatório. O contraditório está no acompanhamento de todos os atos desde a notificação prévia e na defesa escrita depois da indiciação, com defensor dativo em caso de revelia. A comissão faz o relatório conclusivo e outra autoridade julga em 20 dias, cabendo pedido de reconsideração ou recurso em 30 dias.

**Quando usar:** Infração disciplinar de servidor cuja pena possível seja suspensão acima de 30 dias, demissão, cassação de aposentadoria ou destituição; ou quando a sindicância apontar autoria e materialidade.

**Base:** Lei 8.112/1990, arts. 104 a 109, 142 a 182 e 238; Portaria Normativa CGU 27/2022, arts. 66, 76 a 78-A e 97 a 101.

**Partes:** Acusado (requerido), Testemunha (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 2 esperas de resposta; audiência (oitiva); 23 documentos; 1 formulários de dados; 7 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Instauração, Gabinete; 2. Instalação e notificação prévia, Comissão processante; 3. Afastamento preventivo, Gabinete; 4. Instrução, Comissão processante; 5. Aguardando perícia ou informação externa, Comissão processante; 6. Análise de proposta de TAC, Gabinete; 7. Interrogatório, Comissão processante; 8. Indiciação e citação, Comissão processante; 9. Revelia e defensor dativo (10 dias corridos), Comissão processante; 10. Relatório final, Comissão processante; 11. Parecer jurídico, Assessoria jurídica; 12. Julgamento (20 dias corridos), Gabinete; 13. Pedido de reconsideração e recurso (30 dias corridos), Gabinete; 14. Execução e registro, Secretaria; 15. Arquivamento, Secretaria.

### Processo administrativo disciplinar, rito sumário

**Porte:** Médio, 11 fases. **Identificador:** `pad-sumario`.

Rito abreviado para três infrações de prova documental: acumulação ilegal de cargos, abandono de cargo e inassiduidade habitual. Na acumulação, o servidor é primeiro notificado para optar por um dos cargos em 10 dias. A comissão de dois servidores estáveis indicia em até 3 dias da portaria, que já aponta autoria e materialidade, e cita o acusado para defesa escrita em 5 dias, com defensor dativo na revelia. Segue o relatório conclusivo e o julgamento em 5 dias, que pode resultar em demissão, com recurso como no rito ordinário.

**Quando usar:** Acumulação ilegal de cargos, abandono de cargo (mais de 30 dias de ausência intencional) ou inassiduidade habitual (60 faltas interpoladas em 12 meses). Na dúvida sobre a infração, use o rito ordinário.

**Base:** Lei 8.112/1990, arts. 104 a 109, 133, 140, 163, 164 e 238; Portaria Normativa CGU 27/2022, arts. 79 e 80.

**Partes:** Acusado (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 3 esperas de resposta; 11 documentos; 1 formulários de dados; 4 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Enquadramento, Corregedoria; 2. Notificação para opção, Corregedoria; 3. Instauração, Gabinete; 4. Indiciação (3 dias corridos), Comissão processante; 5. Citação e defesa, Comissão processante; 6. Revelia e defensor dativo (5 dias corridos), Comissão processante; 7. Relatório conclusivo, Comissão processante; 8. Julgamento (5 dias corridos), Gabinete; 9. Pedido de reconsideração e recurso (30 dias corridos), Gabinete; 10. Execução e registro, Secretaria; 11. Arquivamento, Secretaria.

### Termo de ajustamento de conduta disciplinar

**Porte:** Curto, 8 fases. **Identificador:** `tac-disciplinar`.

Substitui o processo disciplinar por um compromisso escrito quando a infração é de menor potencial ofensivo, punível com advertência ou suspensão de até 30 dias. A proposta nasce de ofício, da comissão ou do próprio servidor; confere-se se ele não tem sanção vigente nem TAC nos últimos 2 anos e se o dano foi ressarcido. Não há acusação nem julgamento: o servidor aceita ou não as obrigações redigidas no termo. Celebrado e publicado o extrato, a chefia acompanha o cumprimento por até 2 anos; cumprido, arquiva-se; descumprido, apura-se a falta.

**Quando usar:** Infração disciplinar leve, punível com advertência ou suspensão de até 30 dias, de servidor que preenche os requisitos e aceita ajustar a conduta.

**Base:** Portaria Normativa CGU 27/2022, arts. 61 a 69 (exemplo para outros órgãos); Lei 8.112/1990, art. 116, III.

**Partes:** Servidor compromissário (requerido).

**Recursos do motor usados:** 2 comunicações às partes; 8 documentos; 2 formulários de dados; 3 fases com saída decidida pela resposta.

**Fases:** 1. Proposta, Corregedoria; 2. Verificação dos requisitos, Corregedoria; 3. Negociação e redação, Corregedoria; 4. Celebração, Gabinete; 5. Publicação e comunicação, Secretaria; 6. Acompanhamento, Corregedoria; 7. Apuração do descumprimento, Corregedoria; 8. Arquivamento, Secretaria.

## Ética e conselhos profissionais

### Processo ético-profissional (conselho profissional)

**Porte:** Longo, 19 fases. **Identificador:** `etico-profissional`.

Apura infração ao código de ética da profissão por profissional inscrito no conselho. Corre em duas etapas: a sindicância, só investigativa, que termina em arquivamento, conciliação, ajustamento de conduta ou instauração do processo; e o processo ético-profissional, com citação, defesa prévia, instrução com audiência, alegações finais e julgamento em colegiado. O contraditório está na defesa prévia, na audiência, nas alegações finais sucessivas, na sustentação oral e no recurso com efeito suspensivo. Termina com a execução da sanção e o registro, ou com o arquivamento; tudo tramita em sigilo.

**Quando usar:** Denúncia ou notícia de infração ética contra profissional inscrito em conselho de fiscalização profissional. Ajuste prazos e sanções ao código processual do seu conselho.

**Base:** Exemplo: Resolução CFM 2.306/2022 (Código de Processo Ético-Profissional), alterada pela Res. CFM 2.424/2025, arts. 1º, 13 a 23, 29 a 51, 60 a 65, 81, 83 a 92, 100, 101, 104, 109, 116 a 120 e 131; Lei 3.268/1957, art. 22 (sanções).

**Partes:** Denunciante (requerente), Denunciado (requerido).

**Recursos do motor usados:** 17 comunicações às partes; 8 esperas de resposta; audiência (sessão, conciliação, audiência de instrução); 22 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Denúncia, Secretaria; 2. Sindicância (90 dias corridos), Comissão de ética; 3. Julgamento da sindicância, Câmara de julgamento; 4. Prazo de recurso do arquivamento, Secretaria; 5. Recurso do arquivamento, Plenário; 6. Conciliação ou ajustamento de conduta, Comissão de ética; 7. Instauração do processo, Corregedoria; 8. Interdição cautelar, Plenário; 9. Citação e defesa prévia, Comissão de ética; 10. Revelia e defensor dativo (30 dias corridos), Comissão de ética; 11. Instrução e audiência, Comissão de ética; 12. Alegações finais, Comissão de ética; 13. Parecer jurídico, Assessoria jurídica; 14. Designação de relator e pauta, Corregedoria; 15. Sessão de julgamento, Câmara de julgamento; 16. Recurso, Plenário; 17. Execução e registro (90 dias corridos), Secretaria; 18. Suspensão por doença incapacitante (90 dias corridos), Comissão de ética; 19. Arquivamento, Secretaria.

### Processo disciplinar (entidade de classe)

**Porte:** Longo, 16 fases. **Identificador:** `disciplinar-entidade-classe`.

Apura infração disciplinar de inscrito na entidade de classe, de ofício ou por representação identificada. Um relator emite parecer de admissibilidade, o presidente instaura ou arquiva, e a instrução segue com defesa prévia, audiência, parecer preliminar e razões finais. O contraditório está na defesa prévia com rol de testemunhas, na audiência, nas razões finais, na sustentação oral e no recurso com efeito suspensivo. Julga um tribunal de ética colegiado, com relator diferente do da instrução; termina com o registro da sanção ou o arquivamento, e tudo corre em sigilo até o fim.

**Quando usar:** Representação ou notícia de infração disciplinar contra inscrito em entidade de classe com tribunal de ética próprio, como a OAB. Ajuste prazos e sanções ao estatuto da sua entidade.

**Base:** Exemplo: Lei 8.906/1994 (Estatuto da Advocacia), arts. 35, 43, 68 a 77; Resolução CFOAB 02/2015 (Código de Ética e Disciplina), arts. 55 a 62 e 69.

**Partes:** Representante (requerente), Representado (requerido).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (audiência de instrução, sessão); 13 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Representação, Secretaria; 2. Designação de relator e certidões, Secretaria; 3. Parecer de admissibilidade (30 dias), Comissão de ética; 4. Despacho de instauração, Gabinete; 5. Notificação e defesa prévia, Comissão de ética; 6. Defensor dativo (15 dias), Comissão de ética; 7. Indeferimento liminar, Gabinete; 8. Saneamento e audiência de instrução, Comissão de ética; 9. Parecer preliminar, Comissão de ética; 10. Razões finais, Comissão de ética; 11. Distribuição e pauta, Câmara de julgamento; 12. Sessão de julgamento, Câmara de julgamento; 13. Recurso, Plenário; 14. Execução e registro, Secretaria; 15. Suspensão preventiva, Câmara de julgamento; 16. Arquivamento, Secretaria.

### Apuração ética por comissão de ética pública

**Porte:** Médio, 8 fases. **Identificador:** `comissao-etica-publica`.

Apura desvio ético de agente público que não chega a ser infração disciplinar, ou que corre em paralelo a ela. A comissão de ética admite a denúncia fundamentada ou instaura de ofício, notifica o investigado e instrui com documentos, diligências e parecer de especialista. O contraditório está na manifestação escrita em 10 dias e na nova manifestação quando surgem provas novas. Termina com decisão conclusiva e fundamentada do colegiado, que pode aplicar censura ética, recomendar e comunicar a autoridade para apuração disciplinar; o procedimento é reservado até a conclusão.

**Quando usar:** Denúncia ou notícia de conduta de agente público contrária ao código de ética, no Executivo federal ou em órgão que adote rito semelhante.

**Base:** Decreto 6.029/2007, arts. 12 e 13. Rito detalhado na Resolução CEP 10/2008, que deve ser conferida.

**Partes:** Denunciante (requerente), Investigado (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (oitiva, reunião); 6 documentos; 1 formulários de dados; 3 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Denúncia ou instauração de ofício, Secretaria; 2. Juízo de admissibilidade, Comissão de ética; 3. Notificação do investigado, Comissão de ética; 4. Instrução, Comissão de ética; 5. Nova manifestação, Comissão de ética; 6. Deliberação, Comissão de ética; 7. Providências, Comissão de ética; 8. Arquivamento, Secretaria.

## Sancionador e fiscalização

### Responsabilização de pessoa jurídica (PAR)

**Porte:** Longo, 14 fases. **Identificador:** `par-pessoa-juridica`.

Apura a responsabilidade objetiva de pessoa jurídica por ato lesivo à Administração, como fraude a licitação, oferta de vantagem indevida a agente público ou obstrução de fiscalização. Começa pelo juízo de admissibilidade, que pode abrir investigação preliminar sigilosa, e segue com portaria, comissão de dois ou mais servidores estáveis, nota de indiciação e instrução. O contraditório está na defesa escrita em 30 dias, na manifestação sobre prova nova em 10 dias e sobre o relatório final em 10 dias. Termina com julgamento precedido de manifestação jurídica obrigatória, pedido de reconsideração com efeito suspensivo e cumprimento das sanções, com registro no CNEP.

**Quando usar:** Indício de ato lesivo do art. 5º da Lei 12.846 praticado por empresa. Se o mesmo fato também for infração da Lei 14.133, as duas apurações correm juntas por este rito.

**Base:** Lei 12.846/2013, arts. 5º, 6º, 8º a 15 e 25; Decreto 11.129/2022, arts. 3º a 16; Portaria Normativa CGU 27/2022, arts. 59, 60 e 96; Lei 14.133/2021, art. 159.

**Partes:** Pessoa jurídica processada (requerido).

**Recursos do motor usados:** 7 comunicações às partes; 5 esperas de resposta; audiência (oitiva); 16 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Juízo de admissibilidade, Corregedoria; 2. Investigação preliminar (60 dias corridos), Corregedoria; 3. Instauração, Gabinete; 4. Indiciação e defesa, Comissão processante; 5. Instrução, Comissão processante; 6. Manifestação sobre prova nova, Comissão processante; 7. Relatório final, Comissão processante; 8. Manifestação sobre o relatório, Secretaria; 9. Análise de regularidade, Corregedoria; 10. Manifestação jurídica, Assessoria jurídica; 11. Julgamento, Gabinete; 12. Reconsideração (30 dias corridos), Gabinete; 13. Cumprimento, Secretaria; 14. Arquivamento, Secretaria.

### Infração contratual e sanção a fornecedor

**Porte:** Médio, 14 fases. **Identificador:** `sancao-fornecedor`.

Apura infração de licitante ou contratada, como inexecução, atraso injustificado, não manter a proposta ou apresentar documento falso, e aplica advertência, multa, impedimento de licitar e contratar ou declaração de inidoneidade. O juízo de admissibilidade define a sanção cabível em tese, e com ela o rito: o simples, conduzido pelo setor de contratos, para advertência e multa; ou o com comissão de dois ou mais servidores estáveis, obrigatório para impedimento e inidoneidade. O contraditório está na defesa em 15 dias úteis, nas alegações finais em 15 dias úteis quando há prova nova e no recurso ou pedido de reconsideração, ambos com efeito suspensivo. Termina com a execução da sanção, a cobrança da multa e o registro no CEIS e no CNEP.

**Quando usar:** Ocorrência registrada pelo fiscal ou gestor do contrato, ou pelo agente de contratação na licitação, que possa configurar infração do art. 155 da Lei 14.133.

**Base:** Lei 14.133/2021, arts. 117, § 1º, 155 a 163, 166 a 168 e 183.

**Partes:** Contratada ou licitante (requerido).

**Recursos do motor usados:** 8 comunicações às partes; 4 esperas de resposta; audiência (oitiva); 11 documentos; 2 formulários de dados; 4 fases com saída decidida pela resposta.

**Fases:** 1. Comunicação da ocorrência, Fiscalização; 2. Juízo de admissibilidade, Setor de contratos; 3. Defesa no rito simples, Setor de contratos; 4. Instauração da comissão, Gabinete; 5. Defesa perante a comissão, Comissão processante; 6. Instrução, Comissão processante; 7. Alegações finais, Comissão processante; 8. Relatório da comissão, Comissão processante; 9. Análise jurídica, Assessoria jurídica; 10. Decisão, Gabinete; 11. Recurso ou reconsideração (20 dias), Gabinete; 12. Instância recursal (20 dias), Instância recursal; 13. Execução e registro (15 dias), Setor de contratos; 14. Arquivamento, Secretaria.

### Fiscalização com auto de infração e defesa

**Porte:** Médio, 13 fases. **Identificador:** `auto-de-infracao`.

Modelo para qualquer órgão de fiscalização: um agente constata a infração, lavra o auto, o autuado se defende, uma autoridade distinta do autuante julga e cabe recurso. Serve de base para vigilância sanitária, defesa do consumidor, meio ambiente, posturas municipais e agências reguladoras, trocando só os prazos; vem configurado com os do Decreto 6.514/2008 (ambiental), e a orientação de cada fase traz os do consumidor e do sanitário. O contraditório está na defesa, nas alegações finais, na manifestação prévia antes de agravar a multa e no recurso, com reconsideração antes de subir. Termina por arquivamento, auto insubsistente, solução consensual (pagamento com desconto, parcelamento ou conversão) ou sanção definitiva com cobrança e inscrição em dívida ativa.

**Quando usar:** Constatação de infração administrativa em ação fiscal, reclamação ou denúncia, quando a norma do setor prevê auto de infração com defesa e recurso.

**Base:** Decreto 6.514/2008, arts. 21, 96, 99, 113 a 130; Decreto 2.181/1997 (redação do Decreto 10.887/2021), arts. 33 a 55; Lei 6.437/1977, arts. 12 a 37; Lei 9.873/1999, arts. 1º e 2º; Lei 9.784/1999, art. 66, § 2º.

**Partes:** Autuado (requerido), Reclamante (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 5 esperas de resposta; audiência (oitiva); 13 documentos; 2 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Ação fiscal, Fiscalização; 2. Averiguação preliminar, Fiscalização; 3. Lavratura do auto de infração, Fiscalização; 4. Ciência e defesa, Secretaria; 5. Solução consensual, Secretaria; 6. Instrução, Secretaria; 7. Alegações finais, Secretaria; 8. Parecer, Assessoria jurídica; 9. Julgamento (30 dias corridos), Gabinete; 10. Recurso (5 dias corridos), Gabinete; 11. Julgamento do recurso, Instância recursal; 12. Cobrança e execução, Secretaria; 13. Arquivamento, Secretaria.

### Processo administrativo fiscal (lançamento e impugnação)

**Porte:** Longo, 11 fases. **Identificador:** `processo-fiscal`.

Discute a exigência de tributo e multa lançados pelo fisco. Começa pelo termo de início da fiscalização, que exclui a espontaneidade, e segue com o auto de infração ou notificação de lançamento, que já intima o sujeito passivo a pagar ou impugnar em 30 dias. A impugnação abre a fase litigiosa, com diligências e perícias, julgamento em primeira instância e recurso voluntário em 30 dias, com efeito suspensivo, a um colegiado de segunda instância; há recurso de ofício quando a Fazenda perde acima da alçada. Sem pagamento nem impugnação, declara-se a revelia e abre-se a cobrança amigável; o processo termina com a decisão definitiva e o pagamento, o parcelamento ou a inscrição em dívida ativa.

**Quando usar:** Lançamento de ofício de tributo ou multa com contencioso administrativo em duas instâncias. Estados e municípios ajustam os prazos e órgãos à sua lei.

**Base:** Decreto 70.235/1972, arts. 5º, 7º, 10, 14 a 16, 21, 23, 25, 33, 34 e 42 (texto original; órgãos julgadores atuais não conferidos).

**Partes:** Sujeito passivo (requerido).

**Recursos do motor usados:** 7 comunicações às partes; 4 esperas de resposta; audiência (sessão); 8 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Início do procedimento fiscal, Fiscalização; 2. Lançamento, Fiscalização; 3. Intimação para pagar ou impugnar, Secretaria; 4. Revelia e cobrança amigável (30 dias corridos), Secretaria; 5. Preparo da impugnação, Secretaria; 6. Diligências e perícias, Fiscalização; 7. Julgamento em primeira instância, Junta de julgamento; 8. Intimação da decisão de primeira instância, Secretaria; 9. Julgamento em segunda instância, Instância recursal; 10. Cobrança e encerramento, Secretaria; 11. Arquivamento, Secretaria.

### Multa de trânsito (defesa prévia e recursos)

**Porte:** Médio, 9 fases. **Identificador:** `multa-transito`.

Sancionador de alto volume e baixo valor, com prazo decadencial para o próprio órgão: se a notificação da autuação não for expedida em 30 dias, o auto é arquivado. Depois da análise de consistência do auto, o proprietário é notificado e pode apresentar defesa prévia e indicar o condutor. O contraditório tem três momentos: a defesa prévia, o recurso à junta (JARI), com efeito suspensivo, e o recurso à segunda instância, cada um com prazo não inferior a 30 dias. Termina com o cancelamento do auto ou com a sanção definitiva, o registro no prontuário e a cobrança da multa.

**Quando usar:** Auto de infração de trânsito lavrado por agente ou equipamento. Útil também como base para órgãos que emitem muitos autos padronizados.

**Base:** Lei 9.503/1997 (Código de Trânsito Brasileiro), arts. 280 a 290. Resoluções do Contran sobre o procedimento não conferidas.

**Partes:** Proprietário do veículo (requerido), Condutor (interessado).

**Recursos do motor usados:** 4 comunicações às partes; 3 esperas de resposta; 5 documentos; 1 formulários de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Auto de infração, Fiscalização; 2. Análise de consistência (30 dias corridos), Gabinete; 3. Notificação da autuação, Secretaria; 4. Julgamento da defesa prévia, Gabinete; 5. Notificação da penalidade, Secretaria; 6. Recurso à junta (730 dias corridos), Junta de julgamento; 7. Recurso à segunda instância (730 dias corridos), Instância recursal; 8. Encerramento e cobrança, Secretaria; 9. Arquivamento, Secretaria.

## Contratações e contratos

### Contratação pública por licitação

**Porte:** Longo, 27 fases. **Identificador:** `licitacao`.

Caminho inteiro de uma compra ou contratação pública por pregão ou concorrência, da formalização da demanda até o contrato publicado no PNCP. A fase preparatória reúne DFD, estudo técnico preliminar com mapa de riscos, termo de referência, pesquisa de preços, reserva orçamentária, minutas e parecer jurídico, e termina com a autorização da autoridade. A fase externa publica o edital, responde esclarecimentos e impugnações, realiza a sessão pública, julga, habilita e abre a fase recursal, em que os licitantes recorrem e contrarrazoam com prazos de 3 dias úteis. Termina com adjudicação, homologação, assinatura e publicação do contrato, ou com licitação deserta ou fracassada, revogação ou anulação.

**Quando usar:** Aquisições de bens, serviços e obras que exigem licitação na modalidade pregão ou concorrência. Para dispensa ou inexigibilidade, use o modelo de contratação direta.

**Base:** Lei 14.133/2021, arts. 6º, XXIII, 8º, 17, 18, 21, 23, 25, 53 a 55, 59, 61 a 64, 71, 90, 94 a 96, 164, 165 e 168; Decreto 10.947/2022, arts. 8º a 11; IN SEGES 58/2022; IN SEGES 65/2021, arts. 5º e 6º; IN SEGES 73/2022, arts. 23, 24, 29 e 40.

**Partes:** Área requisitante (requerente), Licitante (interessado).

**Recursos do motor usados:** 13 comunicações às partes; 7 esperas de resposta; audiência (sessão); 30 documentos; 6 formulários de dados; 13 fases com saída decidida pela resposta; 2 fases de espera.

**Fases:** 1. Formalização da demanda, Área requisitante; 2. Verificação no plano anual, Setor de compras; 3. Designação da equipe de planejamento, Gabinete; 4. Estudo técnico preliminar, Área requisitante; 5. Termo de referência, Área requisitante; 6. Pesquisa de preços, Setor de compras; 7. Disponibilidade orçamentária, Setor financeiro; 8. Minuta de edital e de contrato, Setor de compras; 9. Parecer jurídico (15 dias), Assessoria jurídica; 10. Ajustes e autorização, Gabinete; 11. Publicação do edital, Agente de contratação; 12. Esclarecimentos e impugnações, Agente de contratação; 13. Sessão pública, Agente de contratação; 14. Julgamento e negociação, Agente de contratação; 15. Habilitação, Agente de contratação; 16. Recursos, Agente de contratação; 17. Decisão do recurso (10 dias), Gabinete; 18. Adjudicação e homologação, Gabinete; 19. Convocação para assinatura, Setor de contratos; 20. Publicação do contrato no PNCP (20 dias), Setor de contratos; 21. Designação de gestor e fiscais, Gabinete; 22. Arquivamento, Secretaria; 23. Cotações com fornecedores, Setor de compras; 24. Diligência de habilitação, Agente de contratação; 25. Licitação deserta ou fracassada, Setor de compras; 26. Revogação ou anulação, Gabinete; 27. Convocação de remanescentes, Setor de contratos.

### Contratação direta: dispensa e inexigibilidade

**Porte:** Médio, 13 fases. **Identificador:** `contratacao-direta`.

Contratação sem licitação, quando a lei dispensa (valor baixo, emergência, licitação deserta e as demais hipóteses do art. 75) ou quando a competição é inviável (fornecedor exclusivo, notória especialização, credenciamento e as demais do art. 74). O processo é mais curto, mas a instrução do art. 72 é rigorosa: demanda, enquadramento, estimativa de despesa, razão da escolha do fornecedor, justificativa de preço, habilitação, recursos orçamentários e parecer jurídico. Na dispensa por valor, o aviso de dispensa eletrônica abre disputa entre fornecedores. O fornecedor é chamado para complementar documentos e para assinar, e o processo termina com o contrato ou instrumento equivalente publicado no PNCP, ou com arquivamento.

**Quando usar:** Compras e serviços enquadrados no art. 74 (inexigibilidade) ou no art. 75 (dispensa) da Lei 14.133. Se o caso exige licitação, use o modelo de contratação por licitação.

**Base:** Lei 14.133/2021, arts. 23, 53, §§ 4º e 5º, 71, 72 a 75, 94, II e § 1º, 95 e 165; IN SEGES 67/2021, arts. 6º e 11.

**Partes:** Área requisitante (requerente), Fornecedor (interessado).

**Recursos do motor usados:** 2 comunicações às partes; 2 esperas de resposta; 16 documentos; 5 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Formalização da demanda, Área requisitante; 2. Enquadramento legal, Setor de compras; 3. Estimativa da despesa, Setor de compras; 4. Aviso de dispensa eletrônica (3 dias), Agente de contratação; 5. Escolha do fornecedor e preço, Setor de compras; 6. Habilitação do fornecedor, Setor de compras; 7. Disponibilidade orçamentária, Setor financeiro; 8. Parecer jurídico (15 dias), Assessoria jurídica; 9. Autorização, Gabinete; 10. Contrato ou instrumento equivalente, Setor de contratos; 11. Publicação no PNCP (10 dias), Setor de contratos; 12. Arquivamento, Secretaria; 13. Complementação pelo fornecedor, Setor de compras.

### Compra ou contratação privada

**Porte:** Médio, 13 fases. **Identificador:** `compra-privada`.

Fluxo de aquisição de bens e serviços em empresa ou entidade privada, da requisição ao pagamento. Não há lei que imponha rito: fases, alçadas, número de cotações e prazos são da política interna e devem ser revistos pela organização. Corre com requisição, aprovação do gestor, cotações, mapa comparativo e negociação, homologação de fornecedor novo, aprovação por alçada de valor e análise jurídica quando há contrato. O fornecedor se manifesta no cadastro, no aceite do pedido e nas não conformidades do recebimento. Termina com a conferência tripla (pedido, recebimento e nota fiscal), o pagamento e a avaliação do fornecedor.

**Quando usar:** Compras e contratações de organizações privadas que querem segregação de funções e registro das aprovações. Entidades do Sistema S e organizações sociais devem ajustar ao seu regulamento de compras.

**Base:** Política interna de compras da organização; Código Civil, arts. 421 a 425 (liberdade contratual). Modelo construído por prática de mercado; prazos sugeridos, sem fonte normativa.

**Partes:** Requisitante (requerente), Fornecedor (interessado).

**Recursos do motor usados:** 3 comunicações às partes; 3 esperas de resposta; 10 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Requisição de compra, Área requisitante; 2. Aprovação do gestor (2 dias), Área requisitante; 3. Cotação (5 dias), Setor de compras; 4. Mapa comparativo e negociação, Setor de compras; 5. Homologação do fornecedor, Setor de compras; 6. Aprovação por alçada, Gabinete; 7. Análise jurídica, Assessoria jurídica; 8. Pedido ou contrato, Setor de compras; 9. Recebimento, Área requisitante; 10. Conferência e pagamento, Setor financeiro; 11. Avaliação do fornecedor, Setor de compras; 12. Arquivamento, Secretaria; 13. Correção pelo fornecedor, Área requisitante.

### Gestão e fiscalização de contrato de serviço continuado

**Porte:** Longo, 16 fases. **Identificador:** `gestao-contrato`.

Acompanha a execução de um contrato de serviço que se repete mês a mês (limpeza, vigilância, manutenção, suporte de TI), da designação do gestor e dos fiscais até o termo de recebimento definitivo e o encerramento. O processo é cíclico: a cada período os fiscais medem e recebem provisoriamente, o gestor atesta e o setor financeiro paga, e o ciclo volta para a medição seguinte. Repactuação, reajuste, prorrogação, alteração e reequilíbrio são tratados como eventos que saem do ciclo e voltam a ele; o descumprimento que persiste é remetido a processo próprio de apuração. A contratada é notificada para corrigir falhas, pode contestar glosas, é ouvida antes de qualquer alteração e tem defesa e recurso antes da extinção unilateral.

**Quando usar:** Contratos de serviço contínuo, com ou sem dedicação exclusiva de mão de obra, durante toda a vigência. Abra um processo por contrato.

**Base:** Lei 14.133/2021, arts. 92, §§ 4º e 6º, 94, 106, 107, 117, 123 a 125, 135, 136, 137 a 141 e 165; Decreto 11.246/2022, arts. 8º e 21 a 25; IN SEGES 5/2017, arts. 39 a 50 e 54 a 57; IN SEGES 77/2022, arts. 7º e 8º.

**Partes:** Contratante (requerente), Contratada (requerido).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (reunião); 26 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Designação de gestor e fiscais, Gabinete; 2. Reunião inicial, Gestão do contrato; 3. Medição do período, Fiscalização do contrato; 4. Notificação para correção, Fiscalização do contrato; 5. Remessa para apuração de infração, Gestão do contrato; 6. Ateste do período, Gestão do contrato; 7. Pagamento do período (20 dias), Setor financeiro; 8. Evento contratual, Gestão do contrato; 9. Repactuação ou reajuste (30 dias corridos), Setor de contratos; 10. Prorrogação de vigência, Gestão do contrato; 11. Alteração ou reequilíbrio (30 dias corridos), Gestão do contrato; 12. Parecer jurídico, Assessoria jurídica; 13. Termo aditivo (20 dias), Setor de contratos; 14. Extinção unilateral, Gabinete; 15. Recebimento definitivo e encerramento, Gestão do contrato; 16. Arquivamento, Secretaria.

### Recebimento de bens ou serviços, liquidação e pagamento

**Porte:** Curto, 9 fases. **Identificador:** `recebimento-pagamento`.

Confere se o que foi entregue corresponde ao contratado e paga. São duas conferências com responsáveis diferentes: o recebimento provisório, pelo fiscal, e o definitivo, pelo gestor ou por comissão; depois vêm a liquidação, que verifica o direito do credor, e o pagamento em ordem cronológica. Se o objeto não estiver conforme, o fornecedor é notificado para corrigir ou substituir no prazo; ensaio ou laudo externo põe o processo em espera. Termina com o comprovante de pagamento, ou com a remessa a processo próprio quando falta empenho ou o fornecedor não corrige.

**Quando usar:** Cada entrega de compra e cada parcela de serviço ou obra a receber e pagar. Para o ciclo mensal de contrato contínuo, use a gestão de contrato.

**Base:** Lei 14.133/2021, arts. 140 e 141; Decreto 11.246/2022, art. 25; Lei 4.320/1964, arts. 58, 60 e 62 a 64; IN SEGES 77/2022, arts. 6º a 8º.

**Partes:** Contratante (requerente), Fornecedor (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (inspeção); 10 documentos; 2 formulários de dados; 3 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Entrega e cobrança, Fiscalização do contrato; 2. Recebimento provisório, Fiscalização do contrato; 3. Aguardando ensaio ou laudo, Fiscalização do contrato; 4. Correção pelo fornecedor, Fiscalização do contrato; 5. Recebimento definitivo, Gestão do contrato; 6. Liquidação (10 dias), Setor financeiro; 7. Pagamento (10 dias), Setor financeiro; 8. Remessa a processo próprio, Gestão do contrato; 9. Arquivamento, Secretaria.

### Parceria com organização da sociedade civil

**Porte:** Longo, 17 fases. **Identificador:** `parceria-osc`.

Seleciona uma organização da sociedade civil, em regra por chamamento público, celebra termo de colaboração ou de fomento, acompanha a execução e julga a prestação de contas. Corre do edital ao julgamento das propostas pela comissão de seleção, com resultado e recursos, segue para o plano de trabalho, os pareceres e a celebração, que só produz efeitos com a publicação do extrato. Na execução, a organização recebe visitas e notificações, o relatório de monitoramento é homologado pela comissão e a vigência pode ser alterada a pedido. A organização presta contas, pode sanear irregularidades em 45 dias e tem defesa prévia antes de sanção; contas irregulares levam à sanção e à tomada de contas especial.

**Quando usar:** Repasses a entidades sem fins lucrativos para execução de atividade ou projeto de interesse público. Para contratar empresa, use o rito de contratação por licitação.

**Base:** Lei 13.019/2014, arts. 23 a 38, 52, 55, 58, 59 e 69 a 73; Decreto 8.726/2016 (Executivo federal).

**Partes:** Organização parceira (interessado).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (inspeção); 17 documentos; 2 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Planejamento e edital, Gestão da parceria; 2. Publicação do edital (30 dias corridos), Secretaria; 3. Julgamento das propostas, Comissão de seleção; 4. Resultado e recursos, Gabinete; 5. Plano de trabalho e requisitos, Gestão da parceria; 6. Parecer técnico, Gestão da parceria; 7. Parecer jurídico, Assessoria jurídica; 8. Celebração e extrato, Gabinete; 9. Execução e monitoramento, Gestão da parceria; 10. Homologação do relatório, Comissão de monitoramento e avaliação; 11. Alteração da parceria, Gestão da parceria; 12. Prestação de contas, Gestão da parceria; 13. Análise das contas (150 dias corridos), Gestão da parceria; 14. Saneamento das contas, Gestão da parceria; 15. Decisão sobre as contas, Gabinete; 16. Sanção e tomada de contas especial, Gabinete; 17. Arquivamento, Secretaria.

## Atendimento, ouvidoria e transparência

### Manifestação de ouvidoria

**Porte:** Curto, 7 fases. **Identificador:** `ouvidoria`.

Trata reclamação, denúncia, elogio, sugestão e solicitação de providências sobre serviço público. A ouvidoria recebe sem recusar e sem exigir motivo, classifica, pede complementação uma vez se faltar informação e aciona a área responsável, que responde em 20 dias. A denúncia não é apurada pela ouvidoria: segue ao órgão apuratório, e a identidade do manifestante fica protegida. Termina com a resposta conclusiva em até 30 dias corridos, prorrogáveis uma vez; a lei não prevê recurso.

**Quando usar:** Qualquer manifestação do usuário sobre serviço público que não seja pedido de acesso a informação (este tem rito próprio, pela Lei 12.527).

**Base:** Lei 13.460/2017, arts. 9º a 16; Decreto 9.492/2018, arts. 3º e 12 a 23.

**Partes:** Manifestante (requerente).

**Recursos do motor usados:** 4 comunicações às partes; 1 esperas de resposta; 4 documentos; 1 formulários de dados; 1 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Recebimento e registro, Ouvidoria; 2. Análise prévia e classificação, Ouvidoria; 3. Pedido de complementação, Ouvidoria; 4. Encaminhamento à área responsável (20 dias corridos), Área técnica; 5. Encaminhamento ao órgão apuratório, Ouvidoria; 6. Resposta conclusiva, Ouvidoria; 7. Arquivamento, Ouvidoria.

### Pedido de acesso à informação

**Porte:** Curto, 10 fases. **Identificador:** `acesso-informacao`.

Atende pedido de qualquer pessoa por documento ou dado público, sem exigir motivo. O serviço de informação ao cidadão entrega na hora o que está disponível ou busca na área detentora, e responde em até 20 dias corridos, prorrogáveis por 10 com justificativa. Negado o acesso no todo ou em parte, o requerente recorre em 10 dias à autoridade superior, depois à autoridade máxima, ao órgão de controle e à Comissão Mista de Reavaliação de Informações; cada instância decide em 5 dias. Termina com a entrega da informação ou com a negativa mantida.

**Quando usar:** Pedido de informação, documento ou dado em poder do órgão, e não de providência (esta vai para a ouvidoria).

**Base:** Lei 12.527/2011, arts. 10 a 17; Decreto 7.724/2012, arts. 15, 16 e 21 a 24.

**Partes:** Requerente (requerente).

**Recursos do motor usados:** 13 comunicações às partes; 4 esperas de resposta; 6 documentos; 1 formulários de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Registro do pedido, Serviço de informação ao cidadão; 2. Triagem, Serviço de informação ao cidadão; 3. Busca na área detentora (20 dias corridos), Área técnica; 4. Resposta, Serviço de informação ao cidadão; 5. Recurso em primeira instância (5 dias corridos), Gabinete; 6. Recurso em segunda instância (5 dias corridos), Autoridade máxima; 7. Recurso ao órgão de controle (5 dias corridos), Controle interno; 8. Recurso à Comissão Mista de Reavaliação de Informações, Serviço de informação ao cidadão; 9. Cumprimento, Serviço de informação ao cidadão; 10. Arquivamento, Serviço de informação ao cidadão.

## Ministério Público (não penal)

### Notícia de Fato

**Porte:** Curto, 10 fases. **Identificador:** `noticia-de-fato`.

Registro e triagem de qualquer demanda que chega à atividade-fim do Ministério Público: atendimento, documento, requerimento ou representação. O membro aprecia em 30 dias, prorrogáveis uma vez por até 90, colhendo só informações preliminares, sem expedir requisições; o noticiante pode ser chamado a complementar. A decisão arquiva, declina a atribuição a outro órgão ou instaura o procedimento próprio. Arquivada, o noticiante é cientificado e tem 10 dias para recorrer; sem reconsideração, o recurso sobe ao Conselho Superior.

**Quando usar:** Porta de entrada de toda demanda extrajudicial cível que ainda não justifica procedimento próprio: representações, atendimentos ao público, ofícios e documentos recebidos.

**Base:** Res. CNMP 174/2017, arts. 1º a 7º (registro e distribuição, art. 2º; prazo, art. 3º; arquivamento e recurso, arts. 4º e 5º; instauração, art. 7º).

**Partes:** Noticiante (requerente), Interessado (interessado).

**Recursos do motor usados:** 4 comunicações às partes; 2 esperas de resposta; 7 documentos; 1 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Registro e distribuição, Secretaria; 2. Apreciação (30 dias corridos), Gabinete; 3. Complementação pelo noticiante, Secretaria; 4. Decisão, Gabinete; 5. Cientificação do arquivamento, Secretaria; 6. Recurso do arquivamento (3 dias corridos), Gabinete; 7. Revisão pelo Conselho Superior, Conselho Superior; 8. Instauração de procedimento, Gabinete; 9. Remessa por declínio, Secretaria; 10. Arquivamento, Secretaria.

### Procedimento Administrativo do Ministério Público

**Porte:** Médio, 11 fases. **Identificador:** `procedimento-administrativo-mp`.

Acompanha de forma continuada o cumprimento de termo de ajustamento de conduta, políticas públicas e instituições, apura fato ligado a direito individual indisponível ou embasa outra atividade que não cabe em inquérito civil. Não investiga pessoa determinada por ilícito específico. Instaurado por portaria sucinta, corre por um ano, prorrogável sucessivamente por decisão fundamentada, com ofícios, requisições e reuniões com o acompanhado. Cumprido o objeto, arquiva-se no próprio órgão com comunicação ao Conselho Superior; no caso de direito individual indisponível, o noticiante é cientificado e pode recorrer em 10 dias.

**Quando usar:** Para acompanhar TAC, fiscalizar política pública ou instituição, tratar de direito individual indisponível ou embasar atividade sem caráter investigativo.

**Base:** Res. CNMP 174/2017, arts. 8º (cabimento), 9º (portaria), 10 (fato novo), 11 (prazo e prorrogação), 12 e 13 (arquivamento e recurso).

**Partes:** Noticiante (requerente), Acompanhado (requerido), Interessado (interessado).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (reunião); 6 documentos; 1 formulários de dados; 5 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Instauração, Gabinete; 2. Registro e comunicação, Secretaria; 3. Acompanhamento e diligências (365 dias corridos), Gabinete; 4. Aguardando resposta, Secretaria; 5. Avaliação do objeto, Gabinete; 6. Prorrogação, Gabinete; 7. Comunicação ao Conselho Superior, Secretaria; 8. Cientificação do arquivamento, Secretaria; 9. Recurso do arquivamento (3 dias corridos), Gabinete; 10. Revisão pelo Conselho Superior, Conselho Superior; 11. Arquivamento, Secretaria.

### Procedimento Preparatório

**Porte:** Médio, 12 fases. **Identificador:** `procedimento-preparatorio`.

Antecede o inquérito civil quando ainda falta identificar o investigado ou delimitar o objeto. Corre por 90 dias, prorrogáveis uma única vez por igual prazo, com requisições, notificações e oitivas. Ao final, converte-se em inquérito civil, dá base à ação civil pública ou é arquivado. O arquivamento passa pelo mesmo controle do inquérito: o representante e o investigado são cientificados, os autos sobem ao Conselho Superior em 3 dias e lá podem apresentar razões até a sessão.

**Quando usar:** Quando a notícia indica possível lesão a direito difuso, coletivo ou individual homogêneo, mas faltam elementos para identificar o investigado ou delimitar o objeto do inquérito civil.

**Base:** Res. CNMP 23/2007, art. 2º, §§ 4º a 7º (cabimento, numeração e prazo), art. 10 (arquivamento e revisão) e art. 12 (desarquivamento); Lei 7.347/1985, art. 8º, § 1º (requisições).

**Partes:** Representante (requerente), Investigado (requerido), Interessado (interessado), Órgão requisitado (terceiro).

**Recursos do motor usados:** 4 comunicações às partes; 1 esperas de resposta; audiência (oitiva, sessão); 7 documentos; 1 formulários de dados; 3 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Instauração, Gabinete; 2. Registro e publicação, Secretaria; 3. Diligências (90 dias corridos), Gabinete; 4. Aguardando resposta a requisição, Secretaria; 5. Prorrogação, Gabinete; 6. Conclusão, Gabinete; 7. Conversão em inquérito civil, Secretaria; 8. Ajuizamento de ação civil pública, Gabinete; 9. Cientificação e remessa ao Conselho Superior (3 dias corridos), Secretaria; 10. Revisão pelo Conselho Superior, Conselho Superior; 11. Designação de outro membro, Secretaria; 12. Arquivamento, Secretaria.

### Inquérito Civil

**Porte:** Longo, 18 fases. **Identificador:** `inquerito-civil`.

Investigação presidida por membro do Ministério Público para apurar lesão a direitos difusos, coletivos ou individuais homogêneos, como meio ambiente, consumidor e patrimônio público, e preparar ação civil pública, ajustamento de conduta ou recomendação. A representação pode ser indeferida em 30 dias, com recurso; instaurado por portaria, corre por um ano, prorrogável quantas vezes for preciso, com requisições, oitivas e audiências. É inquisitivo, mas o investigado e o representante podem ser ouvidos e juntar documentos a qualquer tempo. Termina com ação civil pública ou com promoção de arquivamento, que sobe ao Conselho Superior em 3 dias para homologação.

**Quando usar:** Quando há elementos de lesão a direito difuso, coletivo ou individual homogêneo, com investigado e objeto identificáveis, a apurar antes de ação civil pública ou solução negociada.

**Base:** Res. CNMP 23/2007, arts. 2º (representação), 4º (portaria), 5º (indeferimento e recurso), 6º (instrução), 7º (publicidade), 9º e 9º-A (prazo e declínio), 10 e 11 (arquivamento e revisão), 12 (desarquivamento) e 14 (ajustamento); Lei 7.347/1985, arts. 5º, § 6º, 8º e 9º.

**Partes:** Representante (requerente), Investigado (requerido), Interessado (interessado), Órgão requisitado (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 3 esperas de resposta; audiência (oitiva, reunião, sessão); 15 documentos; 2 formulários de dados; 8 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Representação ou atuação de ofício, Secretaria; 2. Admissibilidade (30 dias corridos), Gabinete; 3. Indeferimento da representação, Gabinete; 4. Recurso do indeferimento (3 dias corridos), Gabinete; 5. Instauração, Gabinete; 6. Registro e publicação, Secretaria; 7. Instrução (365 dias corridos), Gabinete; 8. Aguardando resposta a requisição, Secretaria; 9. Recomendação, Gabinete; 10. Ajustamento de conduta, Gabinete; 11. Prorrogação, Gabinete; 12. Declínio de atribuição (3 dias corridos), Gabinete; 13. Conclusão, Gabinete; 14. Ajuizamento de ação civil pública, Gabinete; 15. Cientificação e remessa ao Conselho Superior (3 dias corridos), Secretaria; 16. Revisão pelo Conselho Superior, Conselho Superior; 17. Designação de outro membro, Secretaria; 18. Arquivamento, Secretaria.

## Gestão interna e pessoas

### Consulta ou parecer interno

**Porte:** Curto, 7 fases. **Identificador:** `consulta-interna`.

Uma unidade pede a outra, em geral a assessoria jurídica ou uma área técnica, opinião formal sobre uma dúvida. A chefia do órgão consultivo confere se a consulta está instruída, devolve para diligência se faltar algo, aplica parecer referencial quando houver, e distribui ao parecerista, que tem 15 dias quando o parecer é obrigatório. Aprovado o parecer, a autoridade decide e, se divergir, motiva. Não há partes externas nem recurso: termina com a devolução do parecer aprovado ao consulente.

**Quando usar:** Quando a decisão de outro processo depende de parecer, ou para fixar entendimento sobre uma dúvida jurídica ou técnica.

**Base:** Lei 9.784/1999, arts. 24, 42 e 50, VII; Lei 14.133/2021, art. 53 (consulta sobre contratação).

**Partes:** Unidade consulente (requerente).

**Recursos do motor usados:** 7 documentos; 1 formulários de dados; 2 fases com saída decidida pela resposta; 1 fases de espera.

**Fases:** 1. Formulação da consulta, Área técnica; 2. Triagem e distribuição, Assessoria jurídica; 3. Diligência ao consulente, Área técnica; 4. Elaboração do parecer (15 dias corridos), Assessoria jurídica; 5. Aprovação, Assessoria jurídica; 6. Devolução ao consulente, Gabinete; 7. Arquivamento, Secretaria.

### Concessão de benefício ou licença a servidor

**Porte:** Curto, 8 fases. **Identificador:** `beneficio-servidor`.

Decide pedido do servidor sobre direito funcional: licença, afastamento, adicional, auxílio ou averbação de tempo. O requerimento passa pela chefia imediata, que opina sobre a conveniência quando o benefício depende de interesse da Administração, e pela gestão de pessoas, que confere os requisitos e, nas licenças por saúde, aciona a perícia oficial. A autoridade decide em até 30 dias, a decisão é publicada e lançada nos assentamentos. O servidor pode pedir reconsideração ou recorrer em 30 dias; sem isso, o processo é arquivado.

**Quando usar:** Qualquer requerimento individual de direito funcional em que só o servidor é interessado.

**Base:** Lei 8.112/1990, arts. 81, 82, 87, 91, 104 a 110, 202 a 204 e 238. Para outros regimes, o estatuto próprio.

**Partes:** Servidor requerente (requerente).

**Recursos do motor usados:** 2 comunicações às partes; 1 esperas de resposta; 6 documentos; 1 formulários de dados; 2 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Requerimento, Secretaria; 2. Manifestação da chefia imediata, Chefia imediata; 3. Instrução pela gestão de pessoas, Gestão de pessoas; 4. Perícia oficial, Gestão de pessoas; 5. Decisão (30 dias corridos), Gabinete; 6. Publicação e registro, Gestão de pessoas; 7. Reconsideração ou recurso (30 dias corridos), Gabinete; 8. Arquivamento, Gestão de pessoas.

## Controle e contas

### Tomada de contas especial (fase interna)

**Porte:** Longo, 13 fases. **Identificador:** `tomada-contas-especial`.

Apura quem causou dano ao erário, quanto é o dano, e busca o ressarcimento. Antes de instaurar, o órgão esgota as medidas administrativas: notifica os responsáveis para prestar contas, justificar ou recolher, e tenta a solução consensual quando cabível. Instaurada, a comissão quantifica o débito, individualiza as condutas e ouve o responsável, que pode se defender ou recolher; o relatório passa pelo controle interno e pela autoridade supervisora. Termina com a remessa ao tribunal de contas em até 180 dias da instauração, que julga na fase externa, ou com o arquivamento quando o débito é recolhido, o dano afastado ou a tomada de contas dispensada.

**Quando usar:** Omissão no dever de prestar contas, falta de comprovação da aplicação de recursos repassados, desfalque ou desvio de bens ou valores, ou ato ilegal, ilegítimo ou antieconômico que cause dano ao erário.

**Base:** Lei 8.443/1992, art. 8º; IN TCU 98/2024, arts. 2º a 25 (em especial arts. 3º a 7º, 14, 15, 17 a 25).

**Partes:** Responsável (requerido).

**Recursos do motor usados:** 3 comunicações às partes; 2 esperas de resposta; 14 documentos; 2 formulários de dados; 6 fases com saída decidida pela resposta; 1 fases de espera; sigilo ao entrar.

**Fases:** 1. Conhecimento do fato, Área técnica; 2. Medidas administrativas prévias, Gabinete; 3. Solução consensual (120 dias corridos), Gabinete; 4. Verificação dos pressupostos e das dispensas, Gabinete; 5. Instauração, Gabinete; 6. Apuração e quantificação, Comissão de tomada de contas; 7. Relatório do tomador de contas, Comissão de tomada de contas; 8. Registro de devedores, Secretaria; 9. Controle interno, Controle interno; 10. Pronunciamento da autoridade supervisora, Autoridade máxima; 11. Remessa ao tribunal de contas, Secretaria; 12. Saneamento da remessa (60 dias corridos), Comissão de tomada de contas; 13. Arquivamento, Secretaria.
