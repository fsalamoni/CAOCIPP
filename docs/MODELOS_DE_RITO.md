# Biblioteca de modelos de rito

Processos completos e prontos para começar, montados a partir da lei de cada área. Ficam em **Novo rito**, na seção **Biblioteca de modelos de processo**. O modelo é só o ponto de partida: nada é criado até o órgão revisar e implantar, e tudo se ajusta (fases, unidades, prazos, ações, documentos, saídas e partes).

Nenhum modelo é penal. Os sancionadores são administrativos (disciplinar, ético, fiscalização, contratual, fiscal, de trânsito) e os do Ministério Público são extrajudiciais cíveis (notícia de fato, procedimento administrativo, procedimento preparatório, inquérito civil, ajustamento de conduta, recomendação, audiência pública, revisão de arquivamento e os expedientes próprios do MPRS).

Muitos modelos seguem o rito de uma instituição: o TED da OAB/RS, o processo ético-disciplinar e a fiscalização do CAU, os provimentos do MPRS (inclusive os de contratos e de bens móveis) e as resoluções do CNMP, a câmara de conciliação, os acordos e a dívida ativa da AGU, e os ritos correcionais e a leniência da CGU. O filtro **Inspirado em** mostra a origem de cada um. Onde a pesquisa não confirmou um artigo ou prazo, a base diz "conferir na norma vigente".

Os modelos são da plataforma e ficam no código (`src/lib/modelos/`); nenhum órgão os altera. Usar um modelo grava uma cópia que é só do órgão, no banco do órgão: ela se ajusta à vontade e não muda quando a plataforma atualiza o modelo. Toda ferramenta que um modelo usa (julgamento em sessão, disputa de preços, audiência, comunicação, formulário, documento exigido, andamento automático) também está no editor para qualquer rito do órgão. Para levar um rito pronto a outro órgão, use "Exportar para outro órgão" no menu do rito e, lá, "Importar de outro órgão" (Guia do rito, parte 20).

## Como usar

1. Em **Novo rito**, abra a **Biblioteca de modelos de processo**. Ela é uma seção que abre e fecha pelo título, e a tela lembra a escolha de cada pessoa. Fechada, mostra só as áreas com a contagem; clicar numa área abre a biblioteca já filtrada.
2. Os modelos ficam agrupados por área, em grupos que abrem e fecham. Com qualquer filtro ou busca, os grupos com resultado abrem sozinhos.
3. Encontre o modelo:
   - **Buscar** procura no nome, na instituição ou lei de inspiração, na base, nas fases, no quando usar e na descrição. Ignora acentos, exige todos os termos e marca o que achou. No agrupamento por área, os mais relevantes vêm primeiro em cada grupo;
   - **Área**, **Porte** e **Inspirado em** (a instituição ou lei de origem, por exemplo OAB/RS, CAU/BR, MPRS, CNMP, AGU, CGU, Lei 14.133) filtram a lista;
   - **Usa** mostra só os modelos que usam um recurso do motor: julgamento em sessão de colegiado (o processo entra na pauta da aba Sessões), disputa de preços ou audiência e reunião;
   - **Ordenar** muda a ordem: por área, mais relevantes, nome, do mais curto ao mais longo ou o contrário. Fora do agrupamento por área, cada modelo mostra a sua área;
   - **Limpar filtros** volta tudo, e o contador diz quantos modelos aparecem.
4. Clique no nome do modelo para ver a descrição inteira, quando usar, a base, as partes, o que o rito faz (comunicações, esperas, audiências, documentos, formulários e saídas) e as fases com prazo, contagem, unidade e marca de fase final.
5. Clique em **Usar**. A revisão faz três coisas:
   - casa as unidades do modelo com as do órgão pelo nome, ou propõe criá-las;
   - mostra as pendências, se houver;
   - se o modelo tem partes, propõe criar o tipo de processo já com os polos e os nomes deles, por exemplo Denunciante e Acusado ou Contratante e Contratada;
   - pergunta, num quadro em destaque, se o rito terá **painel e planilha de acompanhamento**. Todo modelo traz essa possibilidade, já com o nome sugerido (Contratos, Bens móveis, Sindicâncias). É opcional: **Ligar** cria na hora uma página própria do órgão, com uma coluna por fase e um campo por dado das ações, e o tipo de processo criado com o rito passa a abrir um registro nela a cada autuação; **Seguir sem painel** não cria nada, e dá para ligar depois em "Integração com o painel". Precisa da integração Páginas próprias ligada.
6. Ajuste o rito à norma do órgão. Os pontos mais comuns:
   - prazos e contagem (dias úteis ou corridos), que o regimento local muda com frequência;
   - nomes de unidades;
   - sanções da lista;
   - documentos exigidos.
7. Implante. Depois, o rito e o tipo se editam como qualquer outro, e cada mudança vira uma nova versão.

## Porte

- **Curto:** até cerca de 6 fases, com decisão rápida e pouca instrução. Por exemplo: notícia de fato, acesso à informação, recebimento e pagamento.
- **Médio:** instrução, manifestação da parte e decisão, com recurso.
- **Longo:** várias instâncias, comissão, audiências, defesa escrita, relatório e julgamento colegiado.

## O que os modelos usam do motor

Cada modelo foi escrito para mostrar, na prática, os recursos do editor de rito:

- **Comunicações às partes:** cada comunicação tem espécie, polos, prazo e contagem.
- **Espera da resposta:** a resposta pode ser Apresentada, Parcial ou Sem manifestação, e pode decidir a saída da fase.
- **Audiências, sessões, oitivas e vistorias:** a intimação usa `{audiencia}` no texto.
- **Julgamento em sessão de colegiado:** a ação Julgar em colegiado leva o processo à pauta do colegiado; relator, votos, vista, proclamação, acórdão e ata correm na aba Sessões, e o resultado proclamado cumpre a ação e escolhe a saída. Exemplos: Recurso administrativo julgado por colegiado, Proposta de ato normativo ao conselho, Revisão de arquivamento pelo Conselho Superior (MPRS), Apuração ética por comissão de ética pública e os processos éticos de conselhos de classe.
- **Disputa de preços:** cotação privada ou dispensa com sala de lances (Contratação direta e Compra ou contratação privada).
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
  - o diagrama (Mermaid) preserva fases e prazos;
  - todo modelo propõe o nome do painel e da planilha.
- **`functions-v2/test/bibliotecaRitos.test.js`:**
  - o servidor aceita cada modelo e guarda tudo o que ele configura;
  - os metadados estão completos;
  - nada é penal;
  - o tipo de processo de cada modelo é válido.

O teste de tela (e2e) abre cada modelo em **Novo rito** e confere que nenhum chega com pendência que impeça implantar.

`scripts/e2e-painel-modelo.mjs` confere, nos emuladores e com o navegador, o painel opcional: usar um modelo mostra a escolha com o nome sugerido; **Seguir sem painel** não cria página; **Ligar** cria a página, o rito é implantado, o tipo nasce com "Criar registro na autuação" e a autuação cria o registro. Faz capturas no computador e no celular.

## Como acrescentar um modelo

Os modelos ficam em `src/lib/modelos/<área>.js` e são escritos com a linguagem de `src/lib/modelos/dsl.js`.

- As fases e as ações se citam pelo nome. A função `montar` troca os nomes por identificadores e reclama de nome que não existe.
- Cada modelo traz:
  - `id`, `nome`, `area` e `porte`;
  - `referencia`: a instituição ou lei em que o modelo se inspira, curta (por exemplo "OAB/RS" ou "Lei 14.133"), usada no filtro **Inspirado em**;
  - `descricao`, explicativa: para que serve, como corre, onde está o contraditório e como termina;
  - `quando` e `base`;
  - `tipo` (polos e nomes), quando há partes;
  - o nome do painel e da planilha, em `PAINEIS`, no arquivo `src/lib/bibliotecaRitos.js` (um registro e o plural).
- Para conferir só uma área: `MODELOS_AREA=<área> node --test src/lib/bibliotecaRitos.test.js`.
- O catálogo abaixo é gerado a partir dos próprios modelos.
- Filtro, ordem, grupos, destaque da busca e o resumo do que o rito faz ficam em `src/lib/bibliotecaFiltro.js`, com teste em `src/lib/bibliotecaFiltro.test.js`. Esse teste também exige `referencia`, descrição, quando usar e base em todo modelo, e nenhum travessão no texto.

## Fontes

A pesquisa normativa que embasou os modelos está nos arquivos do projeto, em `/mnt/project-files/modelos-rito/`: `pesquisa-modelos.md` (os primeiros 28 modelos), `pesquisa-conselhos.md` (OAB/RS e CAU), `pesquisa-mprs.md` (CNMP e MPRS) e `pesquisa-agu-cgu.md` (AGU e CGU) `pesquisa-contratos-patrimonio.md` (gestão contratual completa e gestão de bens patrimoniais), `pesquisa-esferas-federal-estadual.md` (versões federal e do Estado do RS de sanção a fornecedor e de bens inservíveis, e por que não há versão própria de gestão de contrato) e `pesquisa-mprs-contratos-patrimonio.md` (contratos, descumprimento contratual e bens móveis no MPRS, pelos Provimentos 104/2023, 05/2023, 55/2022 e 02/2009 da PGJ, e o que vale do Estado do RS), cada um com as URLs consultadas. Em cada modelo, a **Base** cita as normas e os artigos. Onde a pesquisa não confirmou um ponto, a orientação da fase avisa e pede que o órgão confira.

## Catálogo

| Área | Modelos |
|---|---|
| Administrativo geral | Processo administrativo com interessado (médio); Recurso administrativo julgado por colegiado (médio) |
| Correcional e disciplinar | Sindicância investigativa e investigação preliminar sumária (curto); Processo administrativo disciplinar, rito ordinário (longo); Processo administrativo disciplinar, rito sumário (médio); Termo de ajustamento de conduta disciplinar (curto); Correição e inspeção em Promotoria de Justiça (MPRS) (médio); Sindicância patrimonial (médio); Juízo de admissibilidade correcional (curto); Processo disciplinar de empregado público (médio) |
| Ética e conselhos profissionais | Processo ético-profissional (conselho profissional) (longo); Processo disciplinar (entidade de classe) (longo); Apuração ética por comissão de ética pública (médio); Processo disciplinar no TED da OAB/RS (longo); Revisão de processo disciplinar (OAB) (curto); Reabilitação de inscrito punido (OAB) (curto); Processo ético-disciplinar do CAU (longo) |
| Sancionador e fiscalização | Responsabilização de pessoa jurídica (PAR) (longo); Infração contratual e sanção a fornecedor (médio); Descumprimento contratual no MPRS: apuração e sanção (longo); Sanção a fornecedor no Estado do RS: apuração e registro no CFIL/RS (longo); Fiscalização com auto de infração e defesa (médio); Processo administrativo fiscal (lançamento e impugnação) (longo); Multa de trânsito (defesa prévia e recursos) (médio); Fiscalização do exercício profissional no CAU (médio); Acordo de leniência (Lei Anticorrupção) (longo) |
| Contratações e contratos | Contratação pública por licitação (longo); Contratação direta: dispensa e inexigibilidade (médio); Compra ou contratação privada (médio); Gestão contratual completa: da assinatura à extinção (longo); Gestão de contrato no MPRS: do empenho ao encerramento (longo); Gestão e fiscalização de contrato de serviço continuado (longo); Recebimento de bens ou serviços, liquidação e pagamento (curto); Parceria com organização da sociedade civil (longo) |
| Atendimento, ouvidoria e transparência | Manifestação de ouvidoria (curto); Pedido de acesso à informação (curto) |
| Ministério Público (não penal) | Notícia de Fato (curto); Procedimento Administrativo do Ministério Público (médio); Procedimento Preparatório (médio); Inquérito Civil (longo); Compromisso de ajustamento de conduta (TAC) (longo); Recomendação do Ministério Público (curto); Audiência pública do Ministério Público (curto); Revisão de arquivamento pelo Conselho Superior (MPRS) (médio); Destinação de bens e valores de tutela coletiva (MPRS) (médio); Cadastramento de entidade para destinação de recursos (MPRS) (curto); Triagem de representação sobre patrimônio público (MPRS) (curto) |
| Gestão interna e pessoas | Consulta ou parecer interno (curto); Concessão de benefício ou licença a servidor (curto); Proposta de ato normativo ao conselho (curto); Gestão de bens patrimoniais: do tombamento à baixa (longo); Bens móveis no MPRS: do tombamento à baixa (longo); Bens móveis inservíveis no Estado do RS: avaliação, destinação e baixa (médio); Bens móveis inservíveis na administração federal: circularidade e desfazimento (médio) |
| Controle e contas | Tomada de contas especial (fase interna) (longo) |
| Advocacia pública e consultoria | Mediação e conciliação na câmara da advocacia pública (CCAF) (médio); Acordo para prevenir ou encerrar litígio com a União (médio); Cobrança administrativa e inscrição em dívida ativa (crédito não tributário) (médio) |

## Administrativo geral

### Processo administrativo com interessado

**Porte:** Médio, 10 fases. **Inspirado em:** Lei 9.784. **Identificador:** `pa-geral`.

Rito-base para qualquer pedido que exige decisão motivada da Administração: autorização, registro, reconhecimento de direito, certidão com análise. Recebe o requerimento sem recusar (pede o que falta), instrui com provas e diligências, ouve o interessado nas alegações finais, decide em até 30 dias e abre recurso, com reconsideração antes de subir. Serve de rito subsidiário quando não há lei específica.

**Quando usar:** Pedidos de particulares ou servidores sem rito próprio em lei; processos de ofício que afetem alguém.

**Base:** Lei 9.784/1999, arts. 6º, 9º, 18 a 21, 24, 26 a 28, 38, 41, 42, 44, 48 a 50, 56 a 67.

**Partes:** Requerente (requerente), Interessado (interessado).

**Recursos do motor usados:** 6 comunicações às partes; 3 esperas de resposta; audiência (oitiva); 6 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta.

**Fases:** 1. Protocolo, Secretaria; 2. Admissibilidade e saneamento (5 dias corridos), Unidade instrutora; 3. Exigência ao interessado, Unidade instrutora; 4. Instrução, Unidade instrutora; 5. Parecer jurídico (15 dias corridos), Assessoria jurídica; 6. Alegações finais, Unidade instrutora; 7. Decisão (30 dias corridos), Gabinete; 8. Recurso (30 dias corridos), Gabinete; 9. Cumprimento, Secretaria; 10. Arquivamento, Secretaria.

### Recurso administrativo julgado por colegiado

**Porte:** Médio, 11 fases. **Inspirado em:** Lei 9.784. **Identificador:** `recurso-colegiado`.

Para o órgão em que o recurso contra decisão administrativa é julgado por um colegiado: junta ou conselho de recursos, conselho superior, câmara recursal. A autoridade que decidiu pode reconsiderar em 5 dias; mantida a decisão, o recurso sobe, é distribuído a um relator e os demais interessados apresentam alegações em 5 dias úteis. Se o provimento puder agravar a situação do recorrente, ele é ouvido antes. O colegiado julga em sessão, com relator, votos, vista e acórdão, e pode não conhecer, negar ou dar provimento, total ou parcial, ou anular a decisão.

**Quando usar:** Recursos contra decisões administrativas quando o regimento atribui o julgamento a um colegiado. Ajuste prazos, sustentação oral e quórum ao regimento.

**Base:** Lei 9.784/1999, arts. 56 (reconsideração em 5 dias), 57 (até três instâncias), 58 (legitimados), 59 (10 dias para recorrer e 30 para decidir), 60, 61 (efeito suspensivo), 62 (alegações em 5 dias úteis), 63 (não conhecimento) e 64 (confirmar, modificar, anular ou revogar; gravame só com oitiva prévia).

**Partes:** Recorrente (requerente), Interessado (interessado).

**Recursos do motor usados:** 4 comunicações às partes; 2 esperas de resposta; 1 julgamento colegiado; 4 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta.

**Fases:** 1. Interposição, Unidade recorrida; 2. Juízo de reconsideração (5 dias corridos), Autoridade recorrida; 3. Distribuição ao relator, Secretaria do colegiado; 4. Alegações dos interessados, Secretaria do colegiado; 5. Relatório e voto, Gabinete do relator; 6. Ciência de possível agravamento, Secretaria do colegiado; 7. Julgamento em sessão, Secretaria do colegiado; 8. Cumprimento, Unidade recorrida; 9. Decisão reconsiderada, Unidade recorrida; 10. Retorno à origem, Unidade recorrida; 11. Arquivamento, Secretaria.

## Correcional e disciplinar

### Sindicância investigativa e investigação preliminar sumária

**Porte:** Curto, 9 fases. **Inspirado em:** CGU. **Identificador:** `sindicancia-investigativa`.

Procedimento preparatório, sem acusado e sem punição, para descobrir se houve irregularidade e quem a praticou. Começa pelo juízo de admissibilidade da notícia, que pode arquivar, propor TAC, abrir a investigação ou ir direto ao processo acusatório. Na investigação, o sindicante ou a comissão examina documentos, requisita informações e ouve pessoas, com acesso restrito. Não há contraditório: o investigado pode ser ouvido, mas a defesa só nasce no processo acusatório que vier depois. Termina por arquivamento, TAC ou instauração do processo acusatório.

**Quando usar:** Notícia de irregularidade funcional sem indícios suficientes de autoria e materialidade para abrir já um PAD ou sindicância acusatória.

**Base:** Lei 8.112/1990, arts. 143 a 145; Portaria Normativa CGU 27/2022, arts. 36 a 52 (exemplo de boa prática fora do Executivo federal).

**Partes:** Investigado (requerido), Noticiante (interessado).

**Recursos do motor usados:** 1 comunicação às partes; audiência (oitiva); 9 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Recebimento da notícia, Corregedoria; 2. Juízo de admissibilidade, Corregedoria; 3. Instauração, Corregedoria; 4. Coleta de informações (60 dias corridos), Comissão processante; 5. Aguardando informação externa, Comissão processante; 6. Relatório conclusivo, Comissão processante; 7. Decisão, Gabinete; 8. Instauração do processo seguinte, Corregedoria; 9. Arquivamento, Corregedoria.

### Processo administrativo disciplinar, rito ordinário

**Porte:** Longo, 15 fases. **Inspirado em:** CGU. **Identificador:** `pad-ordinario`.

Apura a responsabilidade de servidor por infração ligada ao cargo e pode terminar em qualquer sanção disciplinar, inclusive demissão. Uma comissão de três servidores estáveis instala os trabalhos, notifica o acusado e instrui com depoimentos, diligências e perícias, encerrando com o interrogatório. O contraditório está no acompanhamento de todos os atos desde a notificação prévia e na defesa escrita depois da indiciação, com defensor dativo em caso de revelia. A comissão faz o relatório conclusivo e outra autoridade julga em 20 dias, cabendo pedido de reconsideração ou recurso em 30 dias.

**Quando usar:** Infração disciplinar de servidor cuja pena possível seja suspensão acima de 30 dias, demissão, cassação de aposentadoria ou destituição; ou quando a sindicância apontar autoria e materialidade.

**Base:** Lei 8.112/1990, arts. 104 a 109, 142 a 182 e 238; Portaria Normativa CGU 27/2022, arts. 66, 76 a 78-A e 97 a 101.

**Partes:** Acusado (requerido), Testemunha (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 2 esperas de resposta; audiência (oitiva); 23 documentos; 1 formulário de dados; 7 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Instauração, Gabinete; 2. Instalação e notificação prévia, Comissão processante; 3. Afastamento preventivo, Gabinete; 4. Instrução, Comissão processante; 5. Aguardando perícia ou informação externa, Comissão processante; 6. Análise de proposta de TAC, Gabinete; 7. Interrogatório, Comissão processante; 8. Indiciação e citação, Comissão processante; 9. Revelia e defensor dativo (10 dias corridos), Comissão processante; 10. Relatório final, Comissão processante; 11. Parecer jurídico, Assessoria jurídica; 12. Julgamento (20 dias corridos), Gabinete; 13. Pedido de reconsideração e recurso (30 dias corridos), Gabinete; 14. Execução e registro, Secretaria; 15. Arquivamento, Secretaria.

### Processo administrativo disciplinar, rito sumário

**Porte:** Médio, 11 fases. **Inspirado em:** CGU. **Identificador:** `pad-sumario`.

Rito abreviado para três infrações de prova documental: acumulação ilegal de cargos, abandono de cargo e inassiduidade habitual. Na acumulação, o servidor é primeiro notificado para optar por um dos cargos em 10 dias. A comissão de dois servidores estáveis indicia em até 3 dias da portaria, que já aponta autoria e materialidade, e cita o acusado para defesa escrita em 5 dias, com defensor dativo na revelia. Segue o relatório conclusivo e o julgamento em 5 dias, que pode resultar em demissão, com recurso como no rito ordinário.

**Quando usar:** Acumulação ilegal de cargos, abandono de cargo (mais de 30 dias de ausência intencional) ou inassiduidade habitual (60 faltas interpoladas em 12 meses). Na dúvida sobre a infração, use o rito ordinário.

**Base:** Lei 8.112/1990, arts. 104 a 109, 133, 140, 163, 164 e 238; Portaria Normativa CGU 27/2022, arts. 79 e 80.

**Partes:** Acusado (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 3 esperas de resposta; 11 documentos; 1 formulário de dados; 4 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Enquadramento, Corregedoria; 2. Notificação para opção, Corregedoria; 3. Instauração, Gabinete; 4. Indiciação (3 dias corridos), Comissão processante; 5. Citação e defesa, Comissão processante; 6. Revelia e defensor dativo (5 dias corridos), Comissão processante; 7. Relatório conclusivo, Comissão processante; 8. Julgamento (5 dias corridos), Gabinete; 9. Pedido de reconsideração e recurso (30 dias corridos), Gabinete; 10. Execução e registro, Secretaria; 11. Arquivamento, Secretaria.

### Termo de ajustamento de conduta disciplinar

**Porte:** Curto, 8 fases. **Inspirado em:** CGU. **Identificador:** `tac-disciplinar`.

Substitui o processo disciplinar por um compromisso escrito quando a infração é de menor potencial ofensivo, punível com advertência ou suspensão de até 30 dias. A proposta nasce de ofício, da comissão ou do próprio servidor; confere-se se ele não tem sanção vigente nem TAC nos últimos 2 anos e se o dano foi ressarcido. Não há acusação nem julgamento: o servidor aceita ou não as obrigações redigidas no termo. Celebrado e publicado o extrato, a chefia acompanha o cumprimento por até 2 anos; cumprido, arquiva-se; descumprido, apura-se a falta.

**Quando usar:** Infração disciplinar leve, punível com advertência ou suspensão de até 30 dias, de servidor que preenche os requisitos e aceita ajustar a conduta.

**Base:** Portaria Normativa CGU 27/2022, arts. 61 a 69 (exemplo para outros órgãos); Lei 8.112/1990, art. 116, III.

**Partes:** Servidor compromissário (requerido).

**Recursos do motor usados:** 2 comunicações às partes; 8 documentos; 2 formulários de dados; 3 fases com saída decidida pela resposta.

**Fases:** 1. Proposta, Corregedoria; 2. Verificação dos requisitos, Corregedoria; 3. Negociação e redação, Corregedoria; 4. Celebração, Gabinete; 5. Publicação e comunicação, Secretaria; 6. Acompanhamento, Corregedoria; 7. Apuração do descumprimento, Corregedoria; 8. Arquivamento, Secretaria.

### Correição e inspeção em Promotoria de Justiça (MPRS)

**Porte:** Médio, 7 fases. **Inspirado em:** MPRS. **Identificador:** `correicao-corregedoria-mp`.

Verificação pela Corregedoria-Geral do Ministério Público do funcionamento dos cargos de Promotor de Justiça. A correição ordinária é periódica, a cada três anos, com calendário anual feito até outubro e publicado com 30 dias de antecedência; a extraordinária e a inspeção, esta quando há indícios de irregularidade, são determinadas pelo Conselho Nacional, pelo Conselho Superior, pelo Órgão Especial, pelo Procurador-Geral ou pelo Corregedor-Geral. O correicionado é avisado com 5 dias. O Corregedor-Geral ou o Promotor-Corregedor examina os sistemas e pode visitar a Promotoria, ouvir juízes, advogados, partes e a comunidade e fazer audiência pública. Lavra-se o Relatório Avaliativo de Correição, com boas práticas, irregularidades, avaliação e proposições; o Promotor é cientificado, o relatório vai ao Conselho Superior e a avaliação entra na ficha funcional. As proposições são acompanhadas; indício de falta funcional segue ao procedimento disciplinar próprio.

**Quando usar:** Para as correições ordinárias do calendário e para correições extraordinárias e inspeções determinadas. Outros Ministérios Públicos ajustam periodicidade e prazos à norma da sua Corregedoria.

**Base:** Provimento 2/2024-CGMP (MPRS), arts. 2º (conceitos), 3º (periodicidade de 3 anos, quem determina, calendário com 30 dias, aviso com 5 dias, contatos externos, audiência pública e correição remota), 4º (calendário até outubro, com ciência à Corregedoria Nacional), 6º (diretrizes de avaliação), 7º (relatório, ciência, Conselho Superior e ficha funcional), 8º e 9º (inspeção e Ordem de Serviço), com alteração do Provimento 19/2026-CGMP; Lei Estadual 7.669/1982. Prazo de manifestação do correicionado: conferir na Ordem de Serviço vigente.

**Partes:** Membro correicionado (requerido).

**Recursos do motor usados:** 2 comunicações às partes; audiência (inspeção, audiência); 3 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Determinação e designação, Corregedoria-Geral; 2. Publicação e aviso, Corregedoria-Geral; 3. Exame e visita, Corregedoria-Geral; 4. Relatório avaliativo, Corregedoria-Geral; 5. Ciência e providências, Corregedoria-Geral; 6. Acompanhamento das proposições, Corregedoria-Geral; 7. Encerramento, Corregedoria-Geral.

### Sindicância patrimonial

**Porte:** Médio, 9 fases. **Inspirado em:** CGU. **Identificador:** `sindicancia-patrimonial`.

Investiga, sem acusado e sem punição, indício de enriquecimento ilícito de servidor ou empregado público, em especial evolução patrimonial incompatível com a renda declarada. Começa com a análise patrimonial da CGU, uma denúncia ou um achado de auditoria; o titular da correição decide entre abrir a sindicância, ir direto ao processo disciplinar ou arquivar. Uma comissão de dois ou mais servidores levanta bens e movimentações em cartórios, Detran, juntas comerciais e nas declarações, pode convidar o sindicado a explicar a origem dos recursos e monta o demonstrativo de evolução patrimonial, em 30 dias prorrogáveis. Tudo corre em sigilo; não há contraditório, que fica para o processo disciplinar. O relatório recomenda arquivamento ou processo disciplinar, a autoridade decide e, confirmados os indícios, comunica MPF, TCU, CGU, Receita, Coaf e AGU.

**Quando usar:** Indício de patrimônio ou gasto incompatível com a renda de agente público. Difere do modelo de sindicância investigativa por ter comissão própria, requisições patrimoniais e comunicações obrigatórias. Fora do Executivo federal, ajuste ao regulamento local.

**Base:** Decreto 10.571/2020, arts. 7º, 11, 12, I, 13 e 14; Portaria Normativa CGU 27/2022, arts. 38, 39 e 50 a 56 (art. 56, parágrafo único, incluído pela PN CGU 123/2024); Lei 8.429/1992, arts. 9º, VII, e 13; Lei 8.112/1990, art. 132, IV; LC 105/2001 (sigilo bancário: conferir o caminho adotado pelo órgão).

**Partes:** Sindicado (requerido).

**Recursos do motor usados:** 1 comunicação às partes; 1 espera de resposta; audiência (oitiva); 10 documentos; 2 formulários de dados; 3 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Notícia e admissibilidade, Corregedoria; 2. Instauração, Corregedoria; 3. Apuração patrimonial (30 dias corridos), Comissão processante; 4. Aguardando informações externas, Comissão processante; 5. Relatório conclusivo, Comissão processante; 6. Decisão, Corregedoria; 7. Instauração do processo disciplinar, Corregedoria; 8. Encerramento, Corregedoria; 9. Arquivamento, Corregedoria.

### Juízo de admissibilidade correcional

**Porte:** Curto, 8 fases. **Inspirado em:** CGU. **Identificador:** `juizo-admissibilidade-correcional`.

Triagem de denúncia, representação ou relato de irregularidade que chega à corregedoria, com processo próprio. A unidade registra a notícia, preserva o denunciante e manda à ouvidoria o que veio de cidadão; faz consultas rápidas a sistemas e assentamentos, confere competência e prescrição e pode aguardar informação de outro órgão. O titular decide, por despacho fundamentado, entre arquivar, propor termo de ajustamento de conduta, abrir procedimento investigativo, instaurar logo o processo acusatório ou remeter à autoridade competente. Não há contraditório nem recurso; termina com o arquivamento ou com a abertura do procedimento seguinte.

**Quando usar:** Toda notícia de infração disciplinar ou de ato lesivo de pessoa jurídica, inclusive anônima. Use quando a triagem tem número próprio; se a investigação vai correr no mesmo processo, prefira o modelo de sindicância investigativa.

**Base:** Portaria Normativa CGU 27/2022, arts. 35 a 39 (art. 36, § 2º, incluído pela PN CGU 123/2024), 40, 46, 50, 57, 62, 73, 75, 79, 82, 86, 90 e 94; Decreto 10.153/2019 (proteção ao denunciante); Lei 8.112/1990, art. 144, parágrafo único.

**Partes:** Noticiado (requerido), Denunciante ou representante (interessado).

**Recursos do motor usados:** 6 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Recebimento, Corregedoria; 2. Análise prévia, Corregedoria; 3. Aguardando informação, Corregedoria; 4. Despacho de admissibilidade, Corregedoria; 5. Abertura do procedimento seguinte, Corregedoria; 6. Remessa à autoridade competente, Corregedoria; 7. Encaminhado, Corregedoria; 8. Arquivamento, Corregedoria.

### Processo disciplinar de empregado público

**Porte:** Médio, 9 fases. **Inspirado em:** CGU. **Identificador:** `processo-disciplinar-empregado-publico`.

Apura falta disciplinar de empregado público regido pela CLT, seja da administração direta, autárquica e fundacional (Lei 9.962/2000), seja de empresa pública ou sociedade de economia mista. Instaurado por ato publicado, uma comissão de pelo menos dois servidores ou empregados notifica o acusado, que pode acompanhar a instrução, ouve testemunhas e o interroga, em 30 dias prorrogáveis. Havendo indícios, indicia e abre prazo de defesa escrita; sem defesa, nomeia defensor dativo. A comissão relata e a autoridade julga, podendo aplicar advertência, suspensão de até 30 dias ou rescisão do contrato por justa causa, ou outra medida do regulamento interno da estatal. O empregado é intimado e pode recorrer em 10 dias. Termina com o registro e a execução da medida, ou com o arquivamento.

**Quando usar:** Falta disciplinar de empregado celetista de órgão, autarquia, fundação ou estatal. Na estatal, siga o regulamento interno quando existir; para estatutário, use os modelos de PAD.

**Base:** Portaria Normativa CGU 27/2022, arts. 77, 78 e 86 a 93; Lei 9.962/2000, art. 3º (conferir o texto vigente); CLT, arts. 474 e 482; Lei 8.112/1990, arts. 156, 161 e 164 (no que couber); Lei 9.784/1999, arts. 26 a 28, 44, 49, 56 a 59 e 66.

**Partes:** Empregado acusado (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (oitiva); 11 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Instauração, Corregedoria; 2. Notificação e instrução (30 dias corridos), Comissão processante; 3. Indiciação e defesa, Comissão processante; 4. Defensor dativo, Comissão processante; 5. Relatório final, Comissão processante; 6. Julgamento, Gabinete; 7. Recurso (30 dias corridos), Gabinete; 8. Execução e registro, Recursos humanos; 9. Arquivamento, Corregedoria.

## Ética e conselhos profissionais

### Processo ético-profissional (conselho profissional)

**Porte:** Longo, 19 fases. **Inspirado em:** CFM. **Identificador:** `etico-profissional`.

Apura infração ao código de ética da profissão por profissional inscrito no conselho. Corre em duas etapas: a sindicância, só investigativa, que termina em arquivamento, conciliação, ajustamento de conduta ou instauração do processo; e o processo ético-profissional, com citação, defesa prévia, instrução com audiência, alegações finais e julgamento em colegiado. O contraditório está na defesa prévia, na audiência, nas alegações finais sucessivas, na sustentação oral e no recurso com efeito suspensivo. Termina com a execução da sanção e o registro, ou com o arquivamento; tudo tramita em sigilo.

**Quando usar:** Denúncia ou notícia de infração ética contra profissional inscrito em conselho de fiscalização profissional. Ajuste prazos e sanções ao código processual do seu conselho.

**Base:** Exemplo: Resolução CFM 2.306/2022 (Código de Processo Ético-Profissional), alterada pela Res. CFM 2.424/2025, arts. 1º, 13 a 23, 29 a 51, 60 a 65, 81, 83 a 92, 100, 101, 104, 109, 116 a 120 e 131; Lei 3.268/1957, art. 22 (sanções).

**Partes:** Denunciante (requerente), Denunciado (requerido).

**Recursos do motor usados:** 17 comunicações às partes; 8 esperas de resposta; audiência (sessão, conciliação, audiência de instrução); 1 julgamento colegiado; 22 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Denúncia, Secretaria; 2. Sindicância (90 dias corridos), Comissão de ética; 3. Julgamento da sindicância, Câmara de julgamento; 4. Prazo de recurso do arquivamento, Secretaria; 5. Recurso do arquivamento, Plenário; 6. Conciliação ou ajustamento de conduta, Comissão de ética; 7. Instauração do processo, Corregedoria; 8. Interdição cautelar, Plenário; 9. Citação e defesa prévia, Comissão de ética; 10. Revelia e defensor dativo (30 dias corridos), Comissão de ética; 11. Instrução e audiência, Comissão de ética; 12. Alegações finais, Comissão de ética; 13. Parecer jurídico, Assessoria jurídica; 14. Designação de relator e pauta, Corregedoria; 15. Sessão de julgamento, Câmara de julgamento; 16. Recurso, Plenário; 17. Execução e registro (90 dias corridos), Secretaria; 18. Suspensão por doença incapacitante (90 dias corridos), Comissão de ética; 19. Arquivamento, Secretaria.

### Processo disciplinar (entidade de classe)

**Porte:** Longo, 16 fases. **Inspirado em:** OAB. **Identificador:** `disciplinar-entidade-classe`.

Apura infração disciplinar de inscrito na entidade de classe, de ofício ou por representação identificada. Um relator emite parecer de admissibilidade, o presidente instaura ou arquiva, e a instrução segue com defesa prévia, audiência, parecer preliminar e razões finais. O contraditório está na defesa prévia com rol de testemunhas, na audiência, nas razões finais, na sustentação oral e no recurso com efeito suspensivo. Julga um tribunal de ética colegiado, com relator diferente do da instrução; termina com o registro da sanção ou o arquivamento, e tudo corre em sigilo até o fim.

**Quando usar:** Representação ou notícia de infração disciplinar contra inscrito em entidade de classe com tribunal de ética próprio, como a OAB. Ajuste prazos e sanções ao estatuto da sua entidade.

**Base:** Exemplo: Lei 8.906/1994 (Estatuto da Advocacia), arts. 35, 43, 68 a 77; Resolução CFOAB 02/2015 (Código de Ética e Disciplina), arts. 55 a 62 e 69.

**Partes:** Representante (requerente), Representado (requerido).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (audiência de instrução, sessão); 1 julgamento colegiado; 13 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Representação, Secretaria; 2. Designação de relator e certidões, Secretaria; 3. Parecer de admissibilidade (30 dias), Comissão de ética; 4. Despacho de instauração, Gabinete; 5. Notificação e defesa prévia, Comissão de ética; 6. Defensor dativo (15 dias), Comissão de ética; 7. Indeferimento liminar, Gabinete; 8. Saneamento e audiência de instrução, Comissão de ética; 9. Parecer preliminar, Comissão de ética; 10. Razões finais, Comissão de ética; 11. Distribuição e pauta, Câmara de julgamento; 12. Sessão de julgamento, Câmara de julgamento; 13. Recurso, Plenário; 14. Execução e registro, Secretaria; 15. Suspensão preventiva, Câmara de julgamento; 16. Arquivamento, Secretaria.

### Apuração ética por comissão de ética pública

**Porte:** Médio, 8 fases. **Inspirado em:** Comissão de Ética Pública. **Identificador:** `comissao-etica-publica`.

Apura desvio ético de agente público que não chega a ser infração disciplinar, ou que corre em paralelo a ela. A comissão de ética admite a denúncia fundamentada ou instaura de ofício, notifica o investigado e instrui com documentos, diligências e parecer de especialista. O contraditório está na manifestação escrita em 10 dias e na nova manifestação quando surgem provas novas. Termina com decisão conclusiva e fundamentada do colegiado, que pode aplicar censura ética, recomendar e comunicar a autoridade para apuração disciplinar; o procedimento é reservado até a conclusão.

**Quando usar:** Denúncia ou notícia de conduta de agente público contrária ao código de ética, no Executivo federal ou em órgão que adote rito semelhante.

**Base:** Decreto 6.029/2007, arts. 12 e 13. Rito detalhado na Resolução CEP 10/2008, que deve ser conferida.

**Partes:** Denunciante (requerente), Investigado (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (oitiva); 1 julgamento colegiado; 6 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Denúncia ou instauração de ofício, Secretaria; 2. Juízo de admissibilidade, Comissão de ética; 3. Notificação do investigado, Comissão de ética; 4. Instrução, Comissão de ética; 5. Nova manifestação, Comissão de ética; 6. Deliberação, Comissão de ética; 7. Providências, Comissão de ética; 8. Arquivamento, Secretaria.

### Processo disciplinar no TED da OAB/RS

**Porte:** Longo, 23 fases. **Inspirado em:** OAB/RS. **Identificador:** `ted-oab-rs`.

Rito do Tribunal de Ética e Disciplina da OAB/RS para apurar infração disciplinar de advogado ou estagiário. A representação identificada, ou a instauração de ofício, recebe relator por sorteio eletrônico para a admissibilidade; o Presidente do TED instaura, arquiva liminarmente, encaminha à conciliação entre advogados ou propõe termo de ajustamento de conduta. Instaurado, um instrutor designado pelo Presidente notifica para defesa prévia, instrui com audiência, dá parecer preliminar e abre razões finais sucessivas; um relator sorteado, diferente do instrutor, leva o processo a uma das Turmas Julgadoras, em sessão reservada com pauta publicada 15 dias antes e sustentação oral de 15 minutos. O contraditório está na defesa prévia, na audiência, nas razões finais, na sustentação, nos embargos e nos recursos: das decisões do Presidente do TED e dos instrutores cabe recurso à Turma; das Turmas, ao Conselho Seccional; deste, ao Conselho Federal quando a decisão não for unânime ou contrariar a lei ou precedente. A suspensão preventiva corre em sessão especial de Turma sorteada. Termina com a aplicação da sanção pelo Presidente do TED e o registro, ou com o arquivamento; tudo em sigilo. Difere do modelo genérico disciplinar-entidade-classe por seguir a estrutura gaúcha: instrutores, Turmas Julgadoras, recurso interno às Turmas, conciliação entre advogados, TAC, embargos ao redator e as regras de sessão do regimento do TED.

**Quando usar:** Representação ou notícia de infração disciplinar de inscrito na OAB/RS, quando o fato ocorreu na base territorial da Seccional. Confira o texto consolidado do Regimento Interno do TED e do Regimento Interno da OAB/RS antes de implantar, principalmente qual câmara do Conselho Seccional julga o recurso.

**Base:** Lei 8.906/1994, arts. 35, 40, 43, 68 a 77; Regulamento Geral, arts. 137-D a 144-A (art. 139: prazos em dias úteis, Res. CFOAB 09/2016; art. 137-D alterado pela Res. CFOAB 01/2026, conferir na norma vigente); Código de Ética e Disciplina (Res. CFOAB 02/2015), arts. 55 a 63, 66 e 67; Provimento CFOAB 200/2020 (TAC); Regimento Interno do TED da OAB/RS (DOU de 10/09/2018), arts. 2º, 7º, 10 a 12, 26, 33, 37, 38, 42 a 44, 47 e 55 a 59, com alteração homologada pela Ementa 073/2025/SCA (texto consolidado: conferir na norma vigente).

**Partes:** Representante (requerente), Representado (requerido).

**Recursos do motor usados:** 20 comunicações às partes; 12 esperas de resposta; audiência (sessão, conciliação, audiência de instrução); 1 julgamento colegiado; 21 documentos; 3 formulários de dados; 11 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Representação, Secretaria do TED; 2. Distribuição e certidões, Secretaria do TED; 3. Parecer de admissibilidade (30 dias), Relator; 4. Despacho do Presidente do TED, Presidência do TED; 5. Prazo de recurso do arquivamento, Secretaria do TED; 6. Recurso à Turma Julgadora, Turma Julgadora; 7. Conciliação entre advogados, Relator; 8. Termo de ajustamento de conduta, Presidência do TED; 9. Cumprimento do termo, Presidência do TED; 10. Notificação e defesa prévia, Instrutor; 11. Defensor dativo (15 dias), Presidência do TED; 12. Indeferimento liminar, Presidência do Conselho Seccional; 13. Instrução, Instrutor; 14. Parecer preliminar, Instrutor; 15. Razões finais, Secretaria do TED; 16. Distribuição à Turma e pauta, Presidência do TED; 17. Sessão de julgamento, Turma Julgadora; 18. Embargos de declaração, Turma Julgadora; 19. Recurso ao Conselho Seccional, Câmara do Conselho Seccional; 20. Recurso ao Conselho Federal, Conselho Federal; 21. Execução e registro, Presidência do TED; 22. Suspensão preventiva (90 dias corridos), Turma Julgadora; 23. Arquivamento, Secretaria do TED.

### Revisão de processo disciplinar (OAB)

**Porte:** Curto, 6 fases. **Inspirado em:** OAB. **Identificador:** `revisao-disciplinar-oab`.

Pedido do advogado punido para rever a condenação disciplinar já definitiva, por erro de julgamento ou por condenação baseada em prova falsa. O pedido é autuado em apenso ao processo e vai ao órgão que proferiu a condenação final, onde o relator examina a admissibilidade; se não conhecer, cabe recurso ao colegiado. Admitido, segue o rito do processo disciplinar no que couber, e o representante só é chamado se a revisão puder prejudicar o interesse que motivou a representação. O pedido não suspende a sanção, salvo tutela cautelar do relator. Termina com o julgamento que mantém, reduz ou desconstitui a condenação, anotado nos assentamentos.

**Quando usar:** Condenação disciplinar da OAB transitada em julgado que o punido aponta como erro de julgamento ou baseada em prova falsa. Na OAB/RS, julga a Turma do TED que proferiu a condenação final; ajuste a unidade à sua seccional.

**Base:** Lei 8.906/1994, art. 73, § 5º, e arts. 75 a 77; Código de Ética e Disciplina (Res. CFOAB 02/2015), art. 68; Regimento Interno do TED da OAB/RS, arts. 49 e 50; Regulamento Geral, art. 139 (prazos em dias úteis).

**Partes:** Requerente (advogado punido) (requerente), Representante original (interessado).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (sessão); 6 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Pedido de revisão, Secretaria do TED; 2. Admissibilidade, Relator; 3. Recurso da inadmissão, Turma Julgadora; 4. Instrução e julgamento, Turma Julgadora; 5. Registro da decisão, Secretaria do TED; 6. Arquivamento, Secretaria do TED.

### Reabilitação de inscrito punido (OAB)

**Porte:** Curto, 7 fases. **Inspirado em:** OAB. **Identificador:** `reabilitacao-oab`.

Pedido de quem sofreu sanção disciplinar na OAB para ser reabilitado, depois de um ano do cumprimento da sanção, com provas efetivas de bom comportamento na advocacia e na vida social. O pedido é autuado em apenso ao processo disciplinar e corre no Conselho Seccional que aplicou a sanção; a Secretaria certifica o cumprimento da pena e um relator instrui. Julga o órgão competente do Conselho Seccional; indeferido, cabe recurso em 15 dias úteis, com efeito suspensivo. Termina com a anotação da reabilitação nos assentamentos ou com o arquivamento.

**Quando usar:** Inscrito que cumpriu sanção disciplinar há mais de um ano e quer a reabilitação. Ajuste o órgão julgador ao regimento da sua seccional.

**Base:** Lei 8.906/1994, arts. 41 e 75 a 77; Código de Ética e Disciplina (Res. CFOAB 02/2015), art. 69; Regulamento Geral, art. 139. Órgão julgador no Conselho Seccional: conferir na norma vigente da seccional.

**Partes:** Requerente (requerente).

**Recursos do motor usados:** 4 comunicações às partes; 1 espera de resposta; audiência (sessão); 7 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Pedido de reabilitação, Secretaria do Conselho Seccional; 2. Certidão e instrução, Relator; 3. Julgamento, Conselho Seccional; 4. Prazo de recurso do indeferimento, Secretaria do Conselho Seccional; 5. Recurso, Conselho Federal; 6. Registro da reabilitação, Secretaria do Conselho Seccional; 7. Arquivamento, Secretaria do Conselho Seccional.

### Processo ético-disciplinar do CAU

**Porte:** Longo, 17 fases. **Inspirado em:** CAU/BR. **Identificador:** `etico-disciplinar-cau`.

Apura infração ao Código de Ética e Disciplina por arquiteto e urbanista ou sociedade registrada no CAU. Começa por denúncia identificada, denúncia anônima ou de ofício; a fiscalização confere registro e RRT, e um relator da Comissão de Ética e Disciplina do CAU/UF dá parecer de admissibilidade, que a comissão decide; da inadmissão cabe recurso ao Plenário do CAU/UF. A conciliação pode ser tentada antes da admissão ou na instrução, e o termo de ajustamento de conduta cabe nos processos de ofício de interesse coletivo. Admitida a denúncia, o denunciado tem 30 dias para defesa, há saneamento, provas, audiência de instrução una, alegações finais em 10 dias, relatório e voto do relator e julgamento pela comissão, com sustentação oral de 10 minutos e nomes ocultos. Cabe recurso em 30 dias ao Plenário do CAU/UF e, depois, ao Plenário do CAU/BR, ambos com efeito suspensivo. Termina com a execução da sanção (advertência reservada ou pública, suspensão, cancelamento do registro ou multa) ou com o arquivamento.

**Quando usar:** Denúncia ou notícia de infração ética de profissional ou sociedade registrada no CAU. Quando a comissão de ética reúne metade dos conselheiros do Plenário, quem julga em primeira instância é o Plenário: ajuste as unidades.

**Base:** Lei 12.378/2010, arts. 17 a 23; Res. CAU/BR 52/2013 (Código de Ética e Disciplina); Res. CAU/BR 143/2017, com a redação da Res. 224/2022 (vigência ajustada pelas Res. 232/2023 e 239/2023, conferir na norma vigente), arts. 5º, 9º a 13-B, 18 a 47, 49-A a 62, 68 a 88, 91, 91-A, 92, 93, 98 a 100 e 114 a 119.

**Partes:** Denunciante (requerente), Denunciado (requerido).

**Recursos do motor usados:** 16 comunicações às partes; 9 esperas de resposta; audiência (reunião, conciliação, audiência de instrução, sessão); 1 julgamento colegiado; 14 documentos; 1 formulário de dados; 8 fases com saída decidida pela resposta; sigilo ao entrar.

**Fases:** 1. Denúncia, Secretaria da CED; 2. Providências da fiscalização (10 dias), Fiscalização; 3. Admissibilidade, Comissão de ética e disciplina; 4. Prazo de recurso da inadmissão, Secretaria da CED; 5. Recurso da inadmissão, Plenário do CAU/UF; 6. Conciliação ou TAC, Comissão de ética e disciplina; 7. Cumprimento do acordo, Comissão de ética e disciplina; 8. Notificação e defesa, Comissão de ética e disciplina; 9. Saneamento e provas (180 dias corridos), Relator; 10. Audiência de instrução, Relator; 11. Alegações finais, Secretaria da CED; 12. Relatório e voto (30 dias corridos), Relator; 13. Julgamento pela CED (60 dias corridos), Comissão de ética e disciplina; 14. Recurso ao Plenário do CAU/UF, Plenário do CAU/UF; 15. Recurso ao Plenário do CAU/BR, Plenário do CAU/BR; 16. Execução da sanção, Secretaria da CED; 17. Arquivamento, Secretaria da CED.

## Sancionador e fiscalização

### Responsabilização de pessoa jurídica (PAR)

**Porte:** Longo, 14 fases. **Inspirado em:** CGU. **Identificador:** `par-pessoa-juridica`.

Apura a responsabilidade objetiva de pessoa jurídica por ato lesivo à Administração, como fraude a licitação, oferta de vantagem indevida a agente público ou obstrução de fiscalização. Começa pelo juízo de admissibilidade, que pode abrir investigação preliminar sigilosa, e segue com portaria, comissão de dois ou mais servidores estáveis, nota de indiciação e instrução. O contraditório está na defesa escrita em 30 dias, na manifestação sobre prova nova em 10 dias e sobre o relatório final em 10 dias. Termina com julgamento precedido de manifestação jurídica obrigatória, pedido de reconsideração com efeito suspensivo e cumprimento das sanções, com registro no CNEP.

**Quando usar:** Indício de ato lesivo do art. 5º da Lei 12.846 praticado por empresa. Se o mesmo fato também for infração da Lei 14.133, as duas apurações correm juntas por este rito.

**Base:** Lei 12.846/2013, arts. 5º, 6º, 8º a 15 e 25; Decreto 11.129/2022, arts. 3º a 16; Portaria Normativa CGU 27/2022, arts. 59, 60 e 96; Lei 14.133/2021, art. 159.

**Partes:** Pessoa jurídica processada (requerido).

**Recursos do motor usados:** 7 comunicações às partes; 5 esperas de resposta; audiência (oitiva); 16 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Juízo de admissibilidade, Corregedoria; 2. Investigação preliminar (60 dias corridos), Corregedoria; 3. Instauração, Gabinete; 4. Indiciação e defesa, Comissão processante; 5. Instrução, Comissão processante; 6. Manifestação sobre prova nova, Comissão processante; 7. Relatório final, Comissão processante; 8. Manifestação sobre o relatório, Secretaria; 9. Análise de regularidade, Corregedoria; 10. Manifestação jurídica, Assessoria jurídica; 11. Julgamento, Gabinete; 12. Reconsideração (30 dias corridos), Gabinete; 13. Cumprimento, Secretaria; 14. Arquivamento, Secretaria.

### Infração contratual e sanção a fornecedor

**Porte:** Médio, 14 fases. **Inspirado em:** Lei 14.133. **Identificador:** `sancao-fornecedor`.

Apura infração de licitante ou contratada, como inexecução, atraso injustificado, não manter a proposta ou apresentar documento falso, e aplica advertência, multa, impedimento de licitar e contratar ou declaração de inidoneidade. O juízo de admissibilidade define a sanção cabível em tese, e com ela o rito: o simples, conduzido pelo setor de contratos, para advertência e multa; ou o com comissão de dois ou mais servidores estáveis, obrigatório para impedimento e inidoneidade. O contraditório está na defesa em 15 dias úteis, nas alegações finais em 15 dias úteis quando há prova nova e no recurso ou pedido de reconsideração, ambos com efeito suspensivo. Termina com a execução da sanção, a cobrança da multa e o registro no CEIS e no CNEP.

**Quando usar:** Ocorrência registrada pelo fiscal ou gestor do contrato, ou pelo agente de contratação na licitação, que possa configurar infração do art. 155 da Lei 14.133. No Ministério Público do RS, prefira "Descumprimento contratual no MPRS", com as autoridades e os prazos do Provimento 104/2023-PGJ. No Executivo do RS, use "Sanção a fornecedor no Estado do RS", com o CFIL/RS.

**Base:** Lei 14.133/2021, arts. 117, § 1º, 155 a 163, 166 a 168 e 183; Decreto 11.129/2022, arts. 58 a 63 (registro no CEIS e no CNEP, por todos os Poderes e esferas).

**Partes:** Contratada ou licitante (requerido).

**Recursos do motor usados:** 8 comunicações às partes; 4 esperas de resposta; audiência (oitiva); 11 documentos; 2 formulários de dados; 4 fases com saída decidida pela resposta.

**Fases:** 1. Comunicação da ocorrência, Fiscalização; 2. Juízo de admissibilidade, Setor de contratos; 3. Defesa no rito simples, Setor de contratos; 4. Instauração da comissão, Gabinete; 5. Defesa perante a comissão, Comissão processante; 6. Instrução, Comissão processante; 7. Alegações finais, Comissão processante; 8. Relatório da comissão, Comissão processante; 9. Análise jurídica, Assessoria jurídica; 10. Decisão, Gabinete; 11. Recurso ou reconsideração (20 dias), Gabinete; 12. Instância recursal (20 dias), Instância recursal; 13. Execução e registro (15 dias), Setor de contratos; 14. Arquivamento, Secretaria.

### Descumprimento contratual no MPRS: apuração e sanção

**Porte:** Longo, 13 fases. **Inspirado em:** MPRS. **Identificador:** `descumprimento-contratual-mprs`.

O procedimento "Descumprimento Contratual" do Ministério Público do RS: o fiscal instaura com a gravidade, os danos, a cláusula descumprida e o inciso do art. 155 da Lei 14.133; o gestor analisa e abre 15 dias úteis de defesa, quando o caso é de advertência ou multa, ou remete à Direção-Geral para a comissão processante de dois ou mais servidores estáveis, quando o caso é de impedimento ou de inidoneidade. Depois vêm a manifestação do gestor ou o relatório da comissão, a manifestação da Unidade de Assessoramento Jurídico e a decisão do Diretor-Geral (advertência, multa e impedimento) ou do Subprocurador-Geral de Justiça para Assuntos Administrativos (inidoneidade). Da intimação correm 15 dias úteis para recurso ou pedido de reconsideração. A decisão final sai no Diário Eletrônico, a sanção é registrada no CFIL/RS e no CEIS e a multa é cobrada, com inscrição no CADIN/RS se não for paga. Multa de até R$ 250,00 fica sobrestada.

**Quando usar:** Inexecução total ou parcial de contrato, de nota de empenho ou de ata de registro de preços do MPRS, e recusa em assinar. Abra como processo derivado do contrato ("Novo processo derivado deste"). A sanção é administrativa. Ligue o painel e a planilha para acompanhar defesas, prazos e multas a cobrar.

**Base:** Provimento 104/2023-PGJ, arts. 55, § 2º, 66 e 89 a 98; Provimento 05/2023-PGJ, arts. 21, XVI, 22, XVI, e 23, VII; Provimento 75/2016-PGJ (atos da Lei 12.846/2013); Lei 14.133/2021, arts. 155 a 163 e 165 a 168; Lei estadual 11.389/1999 (com a Lei 14.657/2014), Decreto 42.250/2003 (com os Decretos 45.680/2008 e 54.434/2018) e Instrução Normativa CAGE 2/2003, que põe o Ministério Público entre os órgãos da administração estadual (art. 1º, parágrafo único, II), com o manual do módulo CFIL/RS do sistema FPE, versão 2025.1; Lei estadual 15.612/2021 (processo administrativo do RS, subsidiária: não cita o Ministério Público). O provimento não fala em efeito suspensivo nem em alegações finais: valem os arts. 158, § 2º, e 168 da lei.

**Partes:** Ministério Público (requerente), Contratada (requerido).

**Recursos do motor usados:** 6 comunicações às partes; 5 esperas de resposta; audiência (audiência de instrução); 10 documentos; 1 formulário de dados; 6 fases com saída decidida pela resposta.

**Fases:** 1. Instauração pelo fiscal, Fiscalização do contrato; 2. Análise do gestor, Gestão do contrato; 3. Multa sobrestada, Unidade de Assessoramento Jurídico; 4. Defesa prévia, Gestão do contrato; 5. Manifestação do gestor, Gestão do contrato; 6. Comissão processante, Comissão processante; 7. Manifestação jurídica, Unidade de Assessoramento Jurídico; 8. Decisão, Direção-Geral; 9. Intimação e recurso, Unidade de Assessoramento Jurídico; 10. Reconsideração e decisão final, Subprocuradoria-Geral de Justiça para Assuntos Administrativos; 11. Publicação e registros, Unidade de Contratos; 12. Cobrança da multa, Unidade de Contratos; 13. Arquivamento, Unidade de Contratos.

### Sanção a fornecedor no Estado do RS: apuração e registro no CFIL/RS

**Porte:** Longo, 16 fases. **Inspirado em:** Estado do RS. **Identificador:** `sancao-fornecedor-rs`.

Apura o descumprimento de contrato ou o ato ilícito em licitação nos órgãos, autarquias e fundações do Executivo do Rio Grande do Sul. Começa pelo parecer técnico de quem atesta a execução, enviado ao ordenador de despesa, como manda a lei do CFIL/RS. Daí em diante segue o procedimento da Lei 14.133: defesa em 15 dias úteis no rito simples, para advertência e multa, ou comissão de dois ou mais servidores estáveis, para impedimento e inidoneidade; análise jurídica; decisão do ordenador de despesa ou, na inidoneidade, do Secretário de Estado; recurso ou reconsideração com efeito suspensivo. No fim, a decisão sai no Diário Oficial do Estado, a sanção é cadastrada no CFIL/RS, pelo sistema FPE, a multa é cobrada e o registro é acompanhado até o saneamento e a baixa.

**Quando usar:** Órgãos, autarquias e fundações do Executivo do RS, quando o fiscal ou o gestor aponta descumprimento de contrato ou a comissão de licitação registra ato ilícito de licitante. No Ministério Público do RS, use "Descumprimento contratual no MPRS". Fora do RS, use "Infração contratual e sanção a fornecedor".

**Base:** Lei 14.133/2021, arts. 117, § 1º, 137, 155 a 163, 166 a 168 e 183; Lei estadual 11.389/1999 (com a Lei 14.657/2014), arts. 2º a 4º, 7º, 9º e 12; Decreto estadual 42.250/2003 (com os Decretos 45.680/2008 e 54.434/2018), arts. 2º, 3º, 7º a 11, 14 e 16; Instrução Normativa CAGE 2/2003, arts. 3º, 13 e 16; manual do módulo CFIL/RS do FPE, versão 2025.1; Decreto federal 11.129/2022, arts. 58 a 63 (CEIS); Lei estadual 15.612/2021 (processo administrativo, subsidiária). O Estado não editou regulamento próprio do processo de sanção da Lei 14.133: os prazos de defesa de 5 dias úteis e as suspensões de 3 a 6 meses da lei e do decreto do CFIL são do tempo da Lei 8.666 e cedem aos 15 dias úteis e às sanções dos arts. 156 a 158 da lei federal.

**Partes:** Fornecedor (requerido).

**Recursos do motor usados:** 13 documentos; 2 formulários de dados; 7 comunicações às partes; 7 fases com saída decidida pela resposta.

**Fases:** 1. Parecer técnico da fiscalização, Fiscalização do contrato; 2. Admissibilidade, Ordenador de despesa; 3. Defesa no rito simples, Setor de contratos; 4. Instauração da comissão, Ordenador de despesa; 5. Defesa perante a comissão, Comissão processante; 6. Instrução, Comissão processante; 7. Alegações finais, Comissão processante; 8. Relatório da comissão, Comissão processante; 9. Análise jurídica, Assessoria jurídica; 10. Decisão, Ordenador de despesa; 11. Recurso ou reconsideração, Ordenador de despesa; 12. Autoridade superior, Autoridade superior; 13. Publicação e CFIL/RS, Setor de contratos; 14. Cobrança da multa, Setor de contratos; 15. Saneamento e baixa do registro, Setor de contratos; 16. Arquivamento, Setor de contratos.

### Fiscalização com auto de infração e defesa

**Porte:** Médio, 13 fases. **Inspirado em:** Poder de polícia. **Identificador:** `auto-de-infracao`.

Modelo para qualquer órgão de fiscalização: um agente constata a infração, lavra o auto, o autuado se defende, uma autoridade distinta do autuante julga e cabe recurso. Serve de base para vigilância sanitária, defesa do consumidor, meio ambiente, posturas municipais e agências reguladoras, trocando só os prazos; vem configurado com os do Decreto 6.514/2008 (ambiental), e a orientação de cada fase traz os do consumidor e do sanitário. O contraditório está na defesa, nas alegações finais, na manifestação prévia antes de agravar a multa e no recurso, com reconsideração antes de subir. Termina por arquivamento, auto insubsistente, solução consensual (pagamento com desconto, parcelamento ou conversão) ou sanção definitiva com cobrança e inscrição em dívida ativa.

**Quando usar:** Constatação de infração administrativa em ação fiscal, reclamação ou denúncia, quando a norma do setor prevê auto de infração com defesa e recurso.

**Base:** Decreto 6.514/2008, arts. 21, 96, 99, 113 a 130; Decreto 2.181/1997 (redação do Decreto 10.887/2021), arts. 33 a 55; Lei 6.437/1977, arts. 12 a 37; Lei 9.873/1999, arts. 1º e 2º; Lei 9.784/1999, art. 66, § 2º.

**Partes:** Autuado (requerido), Reclamante (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 5 esperas de resposta; audiência (oitiva); 13 documentos; 2 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Ação fiscal, Fiscalização; 2. Averiguação preliminar, Fiscalização; 3. Lavratura do auto de infração, Fiscalização; 4. Ciência e defesa, Secretaria; 5. Solução consensual, Secretaria; 6. Instrução, Secretaria; 7. Alegações finais, Secretaria; 8. Parecer, Assessoria jurídica; 9. Julgamento (30 dias corridos), Gabinete; 10. Recurso (5 dias corridos), Gabinete; 11. Julgamento do recurso, Instância recursal; 12. Cobrança e execução, Secretaria; 13. Arquivamento, Secretaria.

### Processo administrativo fiscal (lançamento e impugnação)

**Porte:** Longo, 11 fases. **Inspirado em:** Decreto 70.235. **Identificador:** `processo-fiscal`.

Discute a exigência de tributo e multa lançados pelo fisco. Começa pelo termo de início da fiscalização, que exclui a espontaneidade, e segue com o auto de infração ou notificação de lançamento, que já intima o sujeito passivo a pagar ou impugnar em 30 dias. A impugnação abre a fase litigiosa, com diligências e perícias, julgamento em primeira instância e recurso voluntário em 30 dias, com efeito suspensivo, a um colegiado de segunda instância; há recurso de ofício quando a Fazenda perde acima da alçada. Sem pagamento nem impugnação, declara-se a revelia e abre-se a cobrança amigável; o processo termina com a decisão definitiva e o pagamento, o parcelamento ou a inscrição em dívida ativa.

**Quando usar:** Lançamento de ofício de tributo ou multa com contencioso administrativo em duas instâncias. Estados e municípios ajustam os prazos e órgãos à sua lei.

**Base:** Decreto 70.235/1972, arts. 5º, 7º, 10, 14 a 16, 21, 23, 25, 33, 34 e 42 (texto original; órgãos julgadores atuais não conferidos).

**Partes:** Sujeito passivo (requerido).

**Recursos do motor usados:** 7 comunicações às partes; 4 esperas de resposta; audiência (sessão); 8 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Início do procedimento fiscal, Fiscalização; 2. Lançamento, Fiscalização; 3. Intimação para pagar ou impugnar, Secretaria; 4. Revelia e cobrança amigável (30 dias corridos), Secretaria; 5. Preparo da impugnação, Secretaria; 6. Diligências e perícias, Fiscalização; 7. Julgamento em primeira instância, Junta de julgamento; 8. Intimação da decisão de primeira instância, Secretaria; 9. Julgamento em segunda instância, Instância recursal; 10. Cobrança e encerramento, Secretaria; 11. Arquivamento, Secretaria.

### Multa de trânsito (defesa prévia e recursos)

**Porte:** Médio, 9 fases. **Inspirado em:** CTB. **Identificador:** `multa-transito`.

Sancionador de alto volume e baixo valor, com prazo decadencial para o próprio órgão: se a notificação da autuação não for expedida em 30 dias, o auto é arquivado. Depois da análise de consistência do auto, o proprietário é notificado e pode apresentar defesa prévia e indicar o condutor. O contraditório tem três momentos: a defesa prévia, o recurso à junta (JARI), com efeito suspensivo, e o recurso à segunda instância, cada um com prazo não inferior a 30 dias. Termina com o cancelamento do auto ou com a sanção definitiva, o registro no prontuário e a cobrança da multa.

**Quando usar:** Auto de infração de trânsito lavrado por agente ou equipamento. Útil também como base para órgãos que emitem muitos autos padronizados.

**Base:** Lei 9.503/1997 (Código de Trânsito Brasileiro), arts. 280 a 290. Resoluções do Contran sobre o procedimento não conferidas.

**Partes:** Proprietário do veículo (requerido), Condutor (interessado).

**Recursos do motor usados:** 4 comunicações às partes; 3 esperas de resposta; 1 julgamento colegiado; 5 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Auto de infração, Fiscalização; 2. Análise de consistência (30 dias corridos), Gabinete; 3. Notificação da autuação, Secretaria; 4. Julgamento da defesa prévia, Gabinete; 5. Notificação da penalidade, Secretaria; 6. Recurso à junta (730 dias corridos), Junta de julgamento; 7. Recurso à segunda instância (730 dias corridos), Instância recursal; 8. Encerramento e cobrança, Secretaria; 9. Arquivamento, Secretaria.

### Fiscalização do exercício profissional no CAU

**Porte:** Médio, 9 fases. **Inspirado em:** CAU/BR. **Identificador:** `fiscalizacao-cau`.

Rito administrativo do CAU/UF para coibir o exercício ilegal ou irregular da arquitetura e urbanismo, por pessoa física ou jurídica, registrada ou não. A ação de fiscalização começa de ofício ou por denúncia, inclusive anônima; o agente apura e registra em relatório. Constatada a infração, emite notificação preventiva com 10 dias para regularizar, e a regularização no prazo afasta a multa; sem regularização, ou com reincidência na mesma capitulação em um ano, lavra auto de infração com 10 dias para regularizar e pagar ou apresentar defesa. O contraditório está nas alegações à notificação, na defesa ao auto e nos recursos. Julga a Comissão de Exercício Profissional do CAU/UF, com relatório e voto, inclusive à revelia; cabe recurso em 30 dias ao Plenário do CAU/UF e, depois, ao Plenário do CAU/BR, com efeito suspensivo. Termina com arquivamento ou com a multa definitiva e sua cobrança administrativa. Difere do modelo genérico auto-de-infracao pela notificação preventiva obrigatória, pelos prazos de 10 e 30 dias corridos e pelas duas instâncias recursais nos plenários do CAU.

**Quando usar:** Indício de exercício ilegal ou irregular da profissão, falta de RRT, de responsável técnico ou de placa, ou obstrução da fiscalização. Questão ética de profissional registrado vai ao processo ético-disciplinar.

**Base:** Lei 12.378/2010, arts. 24, 34, 35 e 50; Res. CAU/BR 198/2020 (revogou a Res. 22/2012; vigência pelo art. 96, alterado pela Res. 208/2021, conferir na norma vigente), arts. 15, 22 a 46, 49, 50 e 52 a 62, 71 a 74, 76 e 77. Inscrição em dívida ativa: conferir na norma vigente.

**Partes:** Autuado (requerido), Denunciante (interessado).

**Recursos do motor usados:** 10 comunicações às partes; 5 esperas de resposta; audiência (reunião, sessão); 8 documentos; 2 formulários de dados; 6 fases com saída decidida pela resposta.

**Fases:** 1. Origem da ação, Fiscalização; 2. Apuração e relatório, Fiscalização; 3. Notificação preventiva, Fiscalização; 4. Auto de infração, Fiscalização; 5. Julgamento pela CEP, Comissão de exercício profissional; 6. Recurso ao Plenário do CAU/UF, Plenário do CAU/UF; 7. Recurso ao Plenário do CAU/BR, Plenário do CAU/BR; 8. Trânsito em julgado e cobrança, Fiscalização; 9. Arquivamento, Fiscalização.

### Acordo de leniência (Lei Anticorrupção)

**Porte:** Longo, 17 fases. **Inspirado em:** CGU. **Identificador:** `acordo-leniencia`.

Negocia com a pessoa jurídica que admite ato lesivo contra a Administração um acordo administrativo em que ela colabora com a apuração, repara o dano e perde a vantagem indevida em troca de isenção ou redução das sanções da Lei 12.846 e da Lei 14.133. Pode começar por um pedido de declaração de tempestividade, que garante a prioridade, ou direto pela proposta escrita, que é sigilosa. Admitida a proposta, CGU, AGU e a empresa assinam memorando de entendimentos, que interrompe a prescrição, e uma comissão das duas instituições negocia em até 180 dias, prorrogáveis, colhendo provas e calculando dano, vantagem e multa. A empresa pode desistir e a Administração pode rejeitar, sem reconhecimento do ilícito e sem uso dos documentos entregues. Assinado pelo Ministro da CGU e pelo Advogado-Geral da União, o acordo é publicado e acompanhado, inclusive o programa de integridade; termina com a declaração de cumprimento ou com a rescisão, que tira os benefícios, impede novo acordo por 3 anos e vai ao CNEP.

**Quando usar:** Pessoa jurídica que quer colaborar e admitir responsabilidade por ato lesivo do art. 5º da Lei 12.846, antes do relatório final do processo de responsabilização. Estados e Municípios aplicam o rito com a sua controladoria e a sua procuradoria, conforme o regulamento local.

**Base:** Lei 12.846/2013, arts. 16 e 17; Decreto 11.129/2022, arts. 32 a 55 (em especial 37 a 43, 45, 48 a 53 e 55); Portaria Normativa Interministerial CGU/AGU 1/2025, art. 6º (declaração de tempestividade), arts. 24 e 31 (vantagem e capacidade de pagamento) e demais regras de procedimento e prazos internos: conferir na norma vigente; LC 73/1993 e Lei 13.140/2015 (participação da AGU, Decreto 11.129, art. 35).

**Partes:** Pessoa jurídica proponente (requerente).

**Recursos do motor usados:** 8 comunicações às partes; 3 esperas de resposta; audiência (reunião); 20 documentos; 2 formulários de dados; 7 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Manifestação de interesse, Diretoria de acordos de leniência; 2. Declaração de tempestividade, Diretoria de acordos de leniência; 3. Proposta de acordo, Diretoria de acordos de leniência; 4. Juízo de admissibilidade, Diretoria de acordos de leniência; 5. Memorando de entendimentos, Diretoria de acordos de leniência; 6. Negociação (180 dias corridos), Comissão de negociação; 7. Aprovação e assinatura, Gabinete; 8. Publicação e efeitos, Diretoria de acordos de leniência; 9. Acompanhamento do cumprimento, Diretoria de acordos de leniência; 10. Aguardando prazos do acordo (180 dias corridos), Diretoria de acordos de leniência; 11. Apuração de descumprimento, Comissão de negociação; 12. Rescisão e registro, Diretoria de acordos de leniência; 13. Declaração de cumprimento, Gabinete; 14. Encerramento sem acordo, Diretoria de acordos de leniência; 15. Acordo cumprido, Diretoria de acordos de leniência; 16. Acordo rescindido, Diretoria de acordos de leniência; 17. Arquivamento sem acordo, Diretoria de acordos de leniência.

## Contratações e contratos

### Contratação pública por licitação

**Porte:** Longo, 27 fases. **Inspirado em:** Lei 14.133. **Identificador:** `licitacao`.

Caminho inteiro de uma compra ou contratação pública por pregão ou concorrência, da formalização da demanda até o contrato publicado no PNCP. A fase preparatória reúne DFD, estudo técnico preliminar com mapa de riscos, termo de referência, pesquisa de preços, reserva orçamentária, minutas e parecer jurídico, e termina com a autorização da autoridade. A fase externa publica o edital, responde esclarecimentos e impugnações, realiza a sessão pública, julga, habilita e abre a fase recursal, em que os licitantes recorrem e contrarrazoam com prazos de 3 dias úteis. Termina com adjudicação, homologação, assinatura e publicação do contrato, ou com licitação deserta ou fracassada, revogação ou anulação.

**Quando usar:** Aquisições de bens, serviços e obras que exigem licitação na modalidade pregão ou concorrência. Para dispensa ou inexigibilidade, use o modelo de contratação direta.

**Base:** Lei 14.133/2021, arts. 6º, XXIII, 8º, 17, 18, 21, 23, 25, 53 a 55, 59, 61 a 64, 71, 90, 94 a 96, 164, 165 e 168; Decreto 10.947/2022, arts. 8º a 11; IN SEGES 58/2022; IN SEGES 65/2021, arts. 5º e 6º; IN SEGES 73/2022, arts. 23, 24, 29 e 40.

**Partes:** Área requisitante (requerente), Licitante (interessado).

**Recursos do motor usados:** 13 comunicações às partes; 7 esperas de resposta; audiência (sessão); 30 documentos; 6 formulários de dados; 13 fases com saída decidida pela resposta; 2 fases de espera.

**Fases:** 1. Formalização da demanda, Área requisitante; 2. Verificação no plano anual, Setor de compras; 3. Designação da equipe de planejamento, Gabinete; 4. Estudo técnico preliminar, Área requisitante; 5. Termo de referência, Área requisitante; 6. Pesquisa de preços, Setor de compras; 7. Disponibilidade orçamentária, Setor financeiro; 8. Minuta de edital e de contrato, Setor de compras; 9. Parecer jurídico (15 dias), Assessoria jurídica; 10. Ajustes e autorização, Gabinete; 11. Publicação do edital, Agente de contratação; 12. Esclarecimentos e impugnações, Agente de contratação; 13. Sessão pública, Agente de contratação; 14. Julgamento e negociação, Agente de contratação; 15. Habilitação, Agente de contratação; 16. Recursos, Agente de contratação; 17. Decisão do recurso (10 dias), Gabinete; 18. Adjudicação e homologação, Gabinete; 19. Convocação para assinatura, Setor de contratos; 20. Publicação do contrato no PNCP (20 dias), Setor de contratos; 21. Designação de gestor e fiscais, Gabinete; 22. Arquivamento, Secretaria; 23. Cotações com fornecedores, Setor de compras; 24. Diligência de habilitação, Agente de contratação; 25. Licitação deserta ou fracassada, Setor de compras; 26. Revogação ou anulação, Gabinete; 27. Convocação de remanescentes, Setor de contratos.

### Contratação direta: dispensa e inexigibilidade

**Porte:** Médio, 13 fases. **Inspirado em:** Lei 14.133. **Identificador:** `contratacao-direta`.

Contratação sem licitação, quando a lei dispensa (valor baixo, emergência, licitação deserta e as demais hipóteses do art. 75) ou quando a competição é inviável (fornecedor exclusivo, notória especialização, credenciamento e as demais do art. 74). O processo é mais curto, mas a instrução do art. 72 é rigorosa: demanda, enquadramento, estimativa de despesa, razão da escolha do fornecedor, justificativa de preço, habilitação, recursos orçamentários e parecer jurídico. Na dispensa por valor, o aviso de dispensa eletrônica abre disputa entre fornecedores. O fornecedor é chamado para complementar documentos e para assinar, e o processo termina com o contrato ou instrumento equivalente publicado no PNCP, ou com arquivamento.

**Quando usar:** Compras e serviços enquadrados no art. 74 (inexigibilidade) ou no art. 75 (dispensa) da Lei 14.133. Se o caso exige licitação, use o modelo de contratação por licitação.

**Base:** Lei 14.133/2021, arts. 23, 53, §§ 4º e 5º, 71, 72 a 75, 94, II e § 1º, 95 e 165; IN SEGES 67/2021, arts. 6º e 11.

**Partes:** Área requisitante (requerente), Fornecedor (interessado).

**Recursos do motor usados:** 2 comunicações às partes; 2 esperas de resposta; 1 disputa de preços; 15 documentos; 5 formulários de dados; 5 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Formalização da demanda, Área requisitante; 2. Enquadramento legal, Setor de compras; 3. Estimativa da despesa, Setor de compras; 4. Aviso de dispensa eletrônica (3 dias), Agente de contratação; 5. Escolha do fornecedor e preço, Setor de compras; 6. Habilitação do fornecedor, Setor de compras; 7. Disponibilidade orçamentária, Setor financeiro; 8. Parecer jurídico (15 dias), Assessoria jurídica; 9. Autorização, Gabinete; 10. Contrato ou instrumento equivalente, Setor de contratos; 11. Publicação no PNCP (10 dias), Setor de contratos; 12. Arquivamento, Secretaria; 13. Complementação pelo fornecedor, Setor de compras.

### Compra ou contratação privada

**Porte:** Médio, 13 fases. **Inspirado em:** Setor privado. **Identificador:** `compra-privada`.

Fluxo de aquisição de bens e serviços em empresa ou entidade privada, da requisição ao pagamento. Não há lei que imponha rito: fases, alçadas, número de cotações e prazos são da política interna e devem ser revistos pela organização. Corre com requisição, aprovação do gestor, cotações, mapa comparativo e negociação, homologação de fornecedor novo, aprovação por alçada de valor e análise jurídica quando há contrato. O fornecedor se manifesta no cadastro, no aceite do pedido e nas não conformidades do recebimento. Termina com a conferência tripla (pedido, recebimento e nota fiscal), o pagamento e a avaliação do fornecedor.

**Quando usar:** Compras e contratações de organizações privadas que querem segregação de funções e registro das aprovações. Entidades do Sistema S e organizações sociais devem ajustar ao seu regulamento de compras.

**Base:** Política interna de compras da organização; Código Civil, arts. 421 a 425 (liberdade contratual). Modelo construído por prática de mercado; prazos sugeridos, sem fonte normativa.

**Partes:** Requisitante (requerente), Fornecedor (interessado).

**Recursos do motor usados:** 3 comunicações às partes; 3 esperas de resposta; 1 disputa de preços; 10 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Requisição de compra, Área requisitante; 2. Aprovação do gestor (2 dias), Área requisitante; 3. Cotação (5 dias), Setor de compras; 4. Mapa comparativo e negociação, Setor de compras; 5. Homologação do fornecedor, Setor de compras; 6. Aprovação por alçada, Gabinete; 7. Análise jurídica, Assessoria jurídica; 8. Pedido ou contrato, Setor de compras; 9. Recebimento, Área requisitante; 10. Conferência e pagamento, Setor financeiro; 11. Avaliação do fornecedor, Setor de compras; 12. Arquivamento, Secretaria; 13. Correção pelo fornecedor, Área requisitante.

### Gestão contratual completa: da assinatura à extinção

**Porte:** Longo, 24 fases. **Inspirado em:** Lei 14.133. **Identificador:** `gestao-contratual-completa`.

Um processo por contrato administrativo, do começo ao fim: convocação e assinatura, garantia, publicação no PNCP (condição de eficácia), designação de gestor e fiscais, início da execução, fiscalização a cada período, recebimento, liquidação e pagamento em ordem cronológica. De cada pagamento o contrato segue para o período seguinte ou para um evento: termo aditivo, apostila, prorrogação da vigência, reequilíbrio, subcontratação ou mudança societária, solução consensual de controvérsia e extinção antecipada. Falha não corrigida é remetida a processo derivado de apuração de infração ("Novo processo derivado deste", com o modelo "Infração contratual e sanção a fornecedor"); o contrato continua sendo acompanhado aqui. No fim, recebimento definitivo, avaliação de desempenho da contratada para o cadastro de fornecedores, liberação da garantia e encerramento.

**Quando usar:** No Ministério Público do RS, prefira o modelo "Gestão de contrato no MPRS", que já traz as unidades e os prazos dos provimentos. Qualquer contrato administrativo (serviço contínuo ou por escopo, fornecimento, obra ou serviço de engenharia), de licitação ou de contratação direta. Um processo por contrato. Para o quadro de todos os contratos, use "Gerar painel e planilha" na Integração com o painel (Guia do rito, parte 21). Os regulamentos citados (Decreto 11.246/2022 e instruções da SEGES) são do Executivo federal: nos outros entes servem de referência. O Executivo do RS não tem regulamento próprio de gestor e fiscal: use este modelo, com a consulta ao CFIL/RS e ao CADIN/RS antes de assinar e de pagar.

**Base:** Lei 14.133/2021, arts. 53, § 4º, 88, §§ 3º e 4º, 89 a 103, 104, 105 a 114, 115 a 123, 124 a 136, 137 a 139, 140 a 146, 151 a 154, 155 a 163 e 165 a 168; Decreto 11.246/2022; IN SEGES 5/2017; IN SEGES 77/2022; Lei 4.320/1964, arts. 58 a 65.

**Partes:** Contratante (requerente), Contratada (requerido).

**Recursos do motor usados:** 16 comunicações às partes; 8 esperas de resposta; audiências (reunião e conciliação); 35 documentos; 6 formulários de dados; 11 fases com saída decidida pela resposta.

**Fases:** 1. Formalização e assinatura, Setor de contratos; 2. Recusa em assinar, Gabinete; 3. Garantia contratual, Setor de contratos; 4. Publicação no PNCP (20 dias), Setor de contratos; 5. Designação de gestão e fiscalização, Gabinete; 6. Início da execução, Gestão do contrato; 7. Execução e fiscalização, Fiscalização do contrato; 8. Notificação para correção, Fiscalização do contrato; 9. Remessa a processo de apuração, Gestão do contrato; 10. Ateste e recebimento, Gestão do contrato; 11. Liquidação e pagamento (20 dias), Setor financeiro; 12. Termo aditivo: instrução (30 dias corridos), Gestão do contrato; 13. Apostila (30 dias corridos), Setor de contratos; 14. Prorrogação da vigência, Gestão do contrato; 15. Reequilíbrio econômico-financeiro (30 dias corridos), Gestão do contrato; 16. Subcontratação ou mudança na contratada, Gestão do contrato; 17. Solução de controvérsia, Gabinete; 18. Parecer jurídico, Assessoria jurídica; 19. Termo aditivo: assinatura e publicação (20 dias), Setor de contratos; 20. Extinção antecipada, Gabinete; 21. Recebimento definitivo do objeto, Gestão do contrato; 22. Avaliação de desempenho da contratada, Gestão do contrato; 23. Encerramento e liberação da garantia, Gestão do contrato; 24. Arquivamento, Secretaria.

### Gestão de contrato no MPRS: do empenho ao encerramento

**Porte:** Longo, 22 fases. **Inspirado em:** MPRS. **Identificador:** `gestao-contratual-mprs`.

O contrato do Ministério Público do RS como os provimentos internos mandam: a Assessoria de Planejamento e Orçamento empenha; a Unidade de Contratos formaliza, colhe a assinatura eletrônica, publica a designação do gestor e dos fiscais e o extrato no Diário Eletrônico, cadastra no Licitacon do TCE e confere o PNCP; o gestor notifica o início e o fiscal técnico emite a ordem de serviço ou de fornecimento. A cada período o fiscal registra a execução e o recebimento provisório, o gestor atesta e manda ao Setor Financeiro com a lista de checagem e as certidões. Do pagamento o contrato segue para o período seguinte ou para um evento: alteração (com aval do coordenador, análise orçamentária, parecer e minuta da Unidade de Assessoramento Jurídico e aprovação do Diretor-Geral), prorrogação pedida 45 dias antes do fim, reajuste por apostila (IPCA ou INCC-DI), verificação anual da habilitação e extinção. O descumprimento vira processo derivado, instaurado pelo fiscal. No fim, recebimento definitivo, relatório final com boas práticas e liberação da garantia. A contratada é chamada a assinar, corrigir, regularizar certidões, anuir e se defender.

**Quando usar:** Contratos do MPRS regidos pela Lei 14.133/2021 (e, no que couber, os antigos da Lei 8.666). Abra um processo por contrato, logo depois da homologação ou da ratificação. Outro órgão estadual pode usar trocando as unidades e conferindo o próprio regulamento. Ligue o painel e a planilha para ver todos os contratos, as vigências e os pagamentos num quadro.

**Base:** Provimento 104/2023-PGJ, arts. 13, 15, 17, 18 e 52 a 100 (com os Provimentos 6/2024, 34/2025, 41/2025 e 73/2025); Provimento 05/2023-PGJ, arts. 4º, 8º, 12 e 18 a 26; Provimento 03/2023-PGJ (governança das contratações); Lei 14.133/2021, arts. 89 a 147; Resolução CNMP 264/2023. O Provimento 104 não fixa percentual de garantia, prazos de recebimento e de pagamento em dias nem trata de subcontratação e repactuação: nesses pontos valem o contrato e a lei.

**Partes:** Ministério Público (requerente), Contratada (requerido).

**Recursos do motor usados:** 14 comunicações às partes; 8 esperas de resposta; audiência (reunião); 32 documentos; 6 formulários de dados; 12 fases com saída decidida pela resposta.

**Fases:** 1. Empenho, Assessoria de Planejamento e Orçamento; 2. Formalização e assinatura, Unidade de Contratos; 3. Não assinatura, Unidade de Contratos; 4. Publicação e cadastros, Unidade de Contratos; 5. Início da execução, Gestão do contrato; 6. Execução e fiscalização, Fiscalização do contrato; 7. Notificação para correção, Fiscalização do contrato; 8. Descumprimento contratual, Fiscalização do contrato; 9. Recebimento e ateste, Gestão do contrato; 10. Pagamento, Assessoria de Planejamento e Orçamento; 11. Verificação anual da habilitação, Gestão do contrato; 12. Alteração do contrato: instrução, Gestão do contrato; 13. Prorrogação da vigência, Gestão do contrato; 14. Reajuste por apostila, Gestão do contrato; 15. Análise orçamentária, Assessoria de Planejamento e Orçamento; 16. Parecer e minuta do termo aditivo, Unidade de Assessoramento Jurídico; 17. Aprovação do Diretor-Geral, Direção-Geral; 18. Termo aditivo: empenho e formalização, Unidade de Contratos; 19. Extinção do contrato, Gestão do contrato; 20. Recebimento definitivo e relatório final, Gestão do contrato; 21. Encerramento e liberação da garantia, Unidade de Contratos; 22. Arquivamento, Unidade de Contratos.

### Gestão e fiscalização de contrato de serviço continuado

**Porte:** Longo, 16 fases. **Inspirado em:** Lei 14.133. **Identificador:** `gestao-contrato`.

Acompanha a execução de um contrato de serviço que se repete mês a mês (limpeza, vigilância, manutenção, suporte de TI), da designação do gestor e dos fiscais até o termo de recebimento definitivo e o encerramento. O processo é cíclico: a cada período os fiscais medem e recebem provisoriamente, o gestor atesta e o setor financeiro paga, e o ciclo volta para a medição seguinte. Repactuação, reajuste, prorrogação, alteração e reequilíbrio são tratados como eventos que saem do ciclo e voltam a ele; o descumprimento que persiste é remetido a processo próprio de apuração. A contratada é notificada para corrigir falhas, pode contestar glosas, é ouvida antes de qualquer alteração e tem defesa e recurso antes da extinção unilateral.

**Quando usar:** Contratos de serviço contínuo, com ou sem dedicação exclusiva de mão de obra, durante toda a vigência. Abra um processo por contrato. No Ministério Público do RS, prefira "Gestão de contrato no MPRS". O Decreto 11.246/2022 e as instruções da SEGES são do Executivo federal: nos outros entes servem de referência.

**Base:** Lei 14.133/2021, arts. 92, §§ 4º e 6º, 94, 106, 107, 117, 123 a 125, 135, 136, 137 a 141 e 165; Decreto 11.246/2022, arts. 8º e 21 a 25; IN SEGES 5/2017, arts. 39 a 50 e 54 a 57; IN SEGES 77/2022, arts. 7º e 8º.

**Partes:** Contratante (requerente), Contratada (requerido).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (reunião); 26 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Designação de gestor e fiscais, Gabinete; 2. Reunião inicial, Gestão do contrato; 3. Medição do período, Fiscalização do contrato; 4. Notificação para correção, Fiscalização do contrato; 5. Remessa para apuração de infração, Gestão do contrato; 6. Ateste do período, Gestão do contrato; 7. Pagamento do período (20 dias), Setor financeiro; 8. Evento contratual, Gestão do contrato; 9. Repactuação ou reajuste (30 dias corridos), Setor de contratos; 10. Prorrogação de vigência, Gestão do contrato; 11. Alteração ou reequilíbrio (30 dias corridos), Gestão do contrato; 12. Parecer jurídico, Assessoria jurídica; 13. Termo aditivo (20 dias), Setor de contratos; 14. Extinção unilateral, Gabinete; 15. Recebimento definitivo e encerramento, Gestão do contrato; 16. Arquivamento, Secretaria.

### Recebimento de bens ou serviços, liquidação e pagamento

**Porte:** Curto, 9 fases. **Inspirado em:** Lei 14.133. **Identificador:** `recebimento-pagamento`.

Confere se o que foi entregue corresponde ao contratado e paga. São duas conferências com responsáveis diferentes: o recebimento provisório, pelo fiscal, e o definitivo, pelo gestor ou por comissão; depois vêm a liquidação, que verifica o direito do credor, e o pagamento em ordem cronológica. Se o objeto não estiver conforme, o fornecedor é notificado para corrigir ou substituir no prazo; ensaio ou laudo externo põe o processo em espera. Termina com o comprovante de pagamento, ou com a remessa a processo próprio quando falta empenho ou o fornecedor não corrige.

**Quando usar:** Cada entrega de compra e cada parcela de serviço ou obra a receber e pagar. Para o ciclo mensal de contrato contínuo, use a gestão de contrato.

**Base:** Lei 14.133/2021, arts. 140 e 141; Decreto 11.246/2022, art. 25; Lei 4.320/1964, arts. 58, 60 e 62 a 64; IN SEGES 77/2022, arts. 6º a 8º.

**Partes:** Contratante (requerente), Fornecedor (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (inspeção); 10 documentos; 2 formulários de dados; 3 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Entrega e cobrança, Fiscalização do contrato; 2. Recebimento provisório, Fiscalização do contrato; 3. Aguardando ensaio ou laudo, Fiscalização do contrato; 4. Correção pelo fornecedor, Fiscalização do contrato; 5. Recebimento definitivo, Gestão do contrato; 6. Liquidação (10 dias), Setor financeiro; 7. Pagamento (10 dias), Setor financeiro; 8. Remessa a processo próprio, Gestão do contrato; 9. Arquivamento, Secretaria.

### Parceria com organização da sociedade civil

**Porte:** Longo, 17 fases. **Inspirado em:** Lei 13.019. **Identificador:** `parceria-osc`.

Seleciona uma organização da sociedade civil, em regra por chamamento público, celebra termo de colaboração ou de fomento, acompanha a execução e julga a prestação de contas. Corre do edital ao julgamento das propostas pela comissão de seleção, com resultado e recursos, segue para o plano de trabalho, os pareceres e a celebração, que só produz efeitos com a publicação do extrato. Na execução, a organização recebe visitas e notificações, o relatório de monitoramento é homologado pela comissão e a vigência pode ser alterada a pedido. A organização presta contas, pode sanear irregularidades em 45 dias e tem defesa prévia antes de sanção; contas irregulares levam à sanção e à tomada de contas especial.

**Quando usar:** Repasses a entidades sem fins lucrativos para execução de atividade ou projeto de interesse público. Para contratar empresa, use o rito de contratação por licitação.

**Base:** Lei 13.019/2014, arts. 23 a 38, 52, 55, 58, 59 e 69 a 73; Decreto 8.726/2016 (Executivo federal).

**Partes:** Organização parceira (interessado).

**Recursos do motor usados:** 11 comunicações às partes; 6 esperas de resposta; audiência (inspeção); 17 documentos; 2 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Planejamento e edital, Gestão da parceria; 2. Publicação do edital (30 dias corridos), Secretaria; 3. Julgamento das propostas, Comissão de seleção; 4. Resultado e recursos, Gabinete; 5. Plano de trabalho e requisitos, Gestão da parceria; 6. Parecer técnico, Gestão da parceria; 7. Parecer jurídico, Assessoria jurídica; 8. Celebração e extrato, Gabinete; 9. Execução e monitoramento, Gestão da parceria; 10. Homologação do relatório, Comissão de monitoramento e avaliação; 11. Alteração da parceria, Gestão da parceria; 12. Prestação de contas, Gestão da parceria; 13. Análise das contas (150 dias corridos), Gestão da parceria; 14. Saneamento das contas, Gestão da parceria; 15. Decisão sobre as contas, Gabinete; 16. Sanção e tomada de contas especial, Gabinete; 17. Arquivamento, Secretaria.

## Atendimento, ouvidoria e transparência

### Manifestação de ouvidoria

**Porte:** Curto, 7 fases. **Inspirado em:** Lei 13.460. **Identificador:** `ouvidoria`.

Trata reclamação, denúncia, elogio, sugestão e solicitação de providências sobre serviço público. A ouvidoria recebe sem recusar e sem exigir motivo, classifica, pede complementação uma vez se faltar informação e aciona a área responsável, que responde em 20 dias. A denúncia não é apurada pela ouvidoria: segue ao órgão apuratório, e a identidade do manifestante fica protegida. Termina com a resposta conclusiva em até 30 dias corridos, prorrogáveis uma vez; a lei não prevê recurso.

**Quando usar:** Qualquer manifestação do usuário sobre serviço público que não seja pedido de acesso a informação (este tem rito próprio, pela Lei 12.527).

**Base:** Lei 13.460/2017, arts. 9º a 16; Decreto 9.492/2018, arts. 3º e 12 a 23.

**Partes:** Manifestante (requerente).

**Recursos do motor usados:** 4 comunicações às partes; 1 espera de resposta; 4 documentos; 1 formulário de dados; 1 fase com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Recebimento e registro, Ouvidoria; 2. Análise prévia e classificação, Ouvidoria; 3. Pedido de complementação, Ouvidoria; 4. Encaminhamento à área responsável (20 dias corridos), Área técnica; 5. Encaminhamento ao órgão apuratório, Ouvidoria; 6. Resposta conclusiva, Ouvidoria; 7. Arquivamento, Ouvidoria.

### Pedido de acesso à informação

**Porte:** Curto, 10 fases. **Inspirado em:** LAI. **Identificador:** `acesso-informacao`.

Atende pedido de qualquer pessoa por documento ou dado público, sem exigir motivo. O serviço de informação ao cidadão entrega na hora o que está disponível ou busca na área detentora, e responde em até 20 dias corridos, prorrogáveis por 10 com justificativa. Negado o acesso no todo ou em parte, o requerente recorre em 10 dias à autoridade superior, depois à autoridade máxima, ao órgão de controle e à Comissão Mista de Reavaliação de Informações; cada instância decide em 5 dias. Termina com a entrega da informação ou com a negativa mantida.

**Quando usar:** Pedido de informação, documento ou dado em poder do órgão, e não de providência (esta vai para a ouvidoria).

**Base:** Lei 12.527/2011, arts. 10 a 17; Decreto 7.724/2012, arts. 15, 16 e 21 a 24.

**Partes:** Requerente (requerente).

**Recursos do motor usados:** 13 comunicações às partes; 4 esperas de resposta; 6 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Registro do pedido, Serviço de informação ao cidadão; 2. Triagem, Serviço de informação ao cidadão; 3. Busca na área detentora (20 dias corridos), Área técnica; 4. Resposta, Serviço de informação ao cidadão; 5. Recurso em primeira instância (5 dias corridos), Gabinete; 6. Recurso em segunda instância (5 dias corridos), Autoridade máxima; 7. Recurso ao órgão de controle (5 dias corridos), Controle interno; 8. Recurso à Comissão Mista de Reavaliação de Informações, Serviço de informação ao cidadão; 9. Cumprimento, Serviço de informação ao cidadão; 10. Arquivamento, Serviço de informação ao cidadão.

## Ministério Público (não penal)

### Notícia de Fato

**Porte:** Curto, 10 fases. **Inspirado em:** CNMP. **Identificador:** `noticia-de-fato`.

Registro e triagem de qualquer demanda que chega à atividade-fim do Ministério Público: atendimento, documento, requerimento ou representação. O membro aprecia em 30 dias, prorrogáveis uma vez por até 90, colhendo só informações preliminares, sem expedir requisições; o noticiante pode ser chamado a complementar. A decisão arquiva, declina a atribuição a outro órgão ou instaura o procedimento próprio. Arquivada, o noticiante é cientificado e tem 10 dias para recorrer; sem reconsideração, o recurso sobe ao Conselho Superior.

**Quando usar:** Porta de entrada de toda demanda extrajudicial cível que ainda não justifica procedimento próprio: representações, atendimentos ao público, ofícios e documentos recebidos.

**Base:** Res. CNMP 174/2017, arts. 1º a 7º (registro e distribuição, art. 2º; prazo, art. 3º; arquivamento e recurso, arts. 4º e 5º; instauração, art. 7º).

**Partes:** Noticiante (requerente), Interessado (interessado).

**Recursos do motor usados:** 4 comunicações às partes; 2 esperas de resposta; 1 julgamento colegiado; 7 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Registro e distribuição, Secretaria; 2. Apreciação (30 dias corridos), Gabinete; 3. Complementação pelo noticiante, Secretaria; 4. Decisão, Gabinete; 5. Cientificação do arquivamento, Secretaria; 6. Recurso do arquivamento (3 dias corridos), Gabinete; 7. Revisão pelo Conselho Superior, Conselho Superior; 8. Instauração de procedimento, Gabinete; 9. Remessa por declínio, Secretaria; 10. Arquivamento, Secretaria.

### Procedimento Administrativo do Ministério Público

**Porte:** Médio, 11 fases. **Inspirado em:** CNMP. **Identificador:** `procedimento-administrativo-mp`.

Acompanha de forma continuada o cumprimento de termo de ajustamento de conduta, políticas públicas e instituições, apura fato ligado a direito individual indisponível ou embasa outra atividade que não cabe em inquérito civil. Não investiga pessoa determinada por ilícito específico. Instaurado por portaria sucinta, corre por um ano, prorrogável sucessivamente por decisão fundamentada, com ofícios, requisições e reuniões com o acompanhado. Cumprido o objeto, arquiva-se no próprio órgão com comunicação ao Conselho Superior; no caso de direito individual indisponível, o noticiante é cientificado e pode recorrer em 10 dias.

**Quando usar:** Para acompanhar TAC, fiscalizar política pública ou instituição, tratar de direito individual indisponível ou embasar atividade sem caráter investigativo.

**Base:** Res. CNMP 174/2017, arts. 8º (cabimento), 9º (portaria), 10 (fato novo), 11 (prazo e prorrogação), 12 e 13 (arquivamento e recurso).

**Partes:** Noticiante (requerente), Acompanhado (requerido), Interessado (interessado).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; audiência (reunião); 1 julgamento colegiado; 6 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Instauração, Gabinete; 2. Registro e comunicação, Secretaria; 3. Acompanhamento e diligências (365 dias corridos), Gabinete; 4. Aguardando resposta, Secretaria; 5. Avaliação do objeto, Gabinete; 6. Prorrogação, Gabinete; 7. Comunicação ao Conselho Superior, Secretaria; 8. Cientificação do arquivamento, Secretaria; 9. Recurso do arquivamento (3 dias corridos), Gabinete; 10. Revisão pelo Conselho Superior, Conselho Superior; 11. Arquivamento, Secretaria.

### Procedimento Preparatório

**Porte:** Médio, 12 fases. **Inspirado em:** CNMP. **Identificador:** `procedimento-preparatorio`.

Antecede o inquérito civil quando ainda falta identificar o investigado ou delimitar o objeto. Corre por 90 dias, prorrogáveis uma única vez por igual prazo, com requisições, notificações e oitivas. Ao final, converte-se em inquérito civil, dá base à ação civil pública ou é arquivado. O arquivamento passa pelo mesmo controle do inquérito: o representante e o investigado são cientificados, os autos sobem ao Conselho Superior em 3 dias e lá podem apresentar razões até a sessão.

**Quando usar:** Quando a notícia indica possível lesão a direito difuso, coletivo ou individual homogêneo, mas faltam elementos para identificar o investigado ou delimitar o objeto do inquérito civil.

**Base:** Res. CNMP 23/2007, art. 2º, §§ 4º a 7º (cabimento, numeração e prazo), art. 10 (arquivamento e revisão) e art. 12 (desarquivamento); Lei 7.347/1985, art. 8º, § 1º (requisições).

**Partes:** Representante (requerente), Investigado (requerido), Interessado (interessado), Órgão requisitado (terceiro).

**Recursos do motor usados:** 4 comunicações às partes; 1 espera de resposta; audiência (oitiva, sessão); 1 julgamento colegiado; 7 documentos; 1 formulário de dados; 3 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Instauração, Gabinete; 2. Registro e publicação, Secretaria; 3. Diligências (90 dias corridos), Gabinete; 4. Aguardando resposta a requisição, Secretaria; 5. Prorrogação, Gabinete; 6. Conclusão, Gabinete; 7. Conversão em inquérito civil, Secretaria; 8. Ajuizamento de ação civil pública, Gabinete; 9. Cientificação e remessa ao Conselho Superior (3 dias corridos), Secretaria; 10. Revisão pelo Conselho Superior, Conselho Superior; 11. Designação de outro membro, Secretaria; 12. Arquivamento, Secretaria.

### Inquérito Civil

**Porte:** Longo, 18 fases. **Inspirado em:** CNMP. **Identificador:** `inquerito-civil`.

Investigação presidida por membro do Ministério Público para apurar lesão a direitos difusos, coletivos ou individuais homogêneos, como meio ambiente, consumidor e patrimônio público, e preparar ação civil pública, ajustamento de conduta ou recomendação. A representação pode ser indeferida em 30 dias, com recurso; instaurado por portaria, corre por um ano, prorrogável quantas vezes for preciso, com requisições, oitivas e audiências. É inquisitivo, mas o investigado e o representante podem ser ouvidos e juntar documentos a qualquer tempo. Termina com ação civil pública ou com promoção de arquivamento, que sobe ao Conselho Superior em 3 dias para homologação.

**Quando usar:** Quando há elementos de lesão a direito difuso, coletivo ou individual homogêneo, com investigado e objeto identificáveis, a apurar antes de ação civil pública ou solução negociada.

**Base:** Res. CNMP 23/2007, arts. 2º (representação), 4º (portaria), 5º (indeferimento e recurso), 6º (instrução), 7º (publicidade), 9º e 9º-A (prazo e declínio), 10 e 11 (arquivamento e revisão), 12 (desarquivamento) e 14 (ajustamento); Lei 7.347/1985, arts. 5º, § 6º, 8º e 9º.

**Partes:** Representante (requerente), Investigado (requerido), Interessado (interessado), Órgão requisitado (terceiro).

**Recursos do motor usados:** 8 comunicações às partes; 3 esperas de resposta; audiência (oitiva, reunião, sessão); 1 julgamento colegiado; 15 documentos; 2 formulários de dados; 8 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Representação ou atuação de ofício, Secretaria; 2. Admissibilidade (30 dias corridos), Gabinete; 3. Indeferimento da representação, Gabinete; 4. Recurso do indeferimento (3 dias corridos), Gabinete; 5. Instauração, Gabinete; 6. Registro e publicação, Secretaria; 7. Instrução (365 dias corridos), Gabinete; 8. Aguardando resposta a requisição, Secretaria; 9. Recomendação, Gabinete; 10. Ajustamento de conduta, Gabinete; 11. Prorrogação, Gabinete; 12. Declínio de atribuição (3 dias corridos), Gabinete; 13. Conclusão, Gabinete; 14. Ajuizamento de ação civil pública, Gabinete; 15. Cientificação e remessa ao Conselho Superior (3 dias corridos), Secretaria; 16. Revisão pelo Conselho Superior, Conselho Superior; 17. Designação de outro membro, Secretaria; 18. Arquivamento, Secretaria.

### Compromisso de ajustamento de conduta (TAC)

**Porte:** Longo, 16 fases. **Inspirado em:** CNMP. **Identificador:** `compromisso-ajustamento-conduta`.

Acompanha num só processo a vida inteira do compromisso de ajustamento de conduta tomado pelo Ministério Público: a negociação com o responsável pela lesão, em reuniões e, se for o caso, audiência pública; a celebração do termo, com obrigações certas, líquidas e exigíveis, prazos e multa; a promoção de arquivamento do procedimento de origem e a ciência ao Conselho Superior em até 3 dias; a publicação do extrato em 15 dias; e a fiscalização do cumprimento. Descumprido o termo, o compromissário é instado a justificar e o membro executa em até 60 dias, repactua ou segue acompanhando. Cumprido, o acompanhamento é arquivado com ciência ao compromissário, que pode recorrer em 10 dias ao Conselho Superior. Difere do procedimento administrativo genérico por trazer as fases e cláusulas próprias do ajuste.

**Quando usar:** Quando, num inquérito civil, procedimento preparatório ou procedimento administrativo, o investigado aceita adequar a conduta. Ajuste os prazos de comunicação ao Conselho Superior e de recurso conforme o regulamento do seu Ministério Público (no MPRS, Provimento 71/2017-PGJ, arts. 34 a 45).

**Base:** Lei 7.347/1985, art. 5º, § 6º; Res. CNMP 179/2017, arts. 1º a 4º (cabimento, forma e multa), 5º (destinação), 6º (ciência ao órgão superior em até 3 dias), 7º (extrato em 15 dias), 8º (Portal, redação da Res. CNMP 326/2026), 9º e 10 (fiscalização) e 11 (execução em 60 dias); Res. CNMP 174/2017, art. 8º, I; no MPRS, Provimento 71/2017-PGJ, arts. 34 a 45 e 70 (prazos em dias corridos).

**Partes:** Compromissário (requerido), Interessado (interessado).

**Recursos do motor usados:** 7 comunicações às partes; 3 esperas de resposta; audiência (reunião, inspeção); 2 julgamentos colegiados; 10 documentos; 1 formulário de dados; 6 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Proposta de ajustamento, Gabinete; 2. Negociação, Gabinete; 3. Celebração do termo, Gabinete; 4. Arquivamento do procedimento de origem (3 dias corridos), Secretaria; 5. Homologação pelo Conselho Superior, Conselho Superior; 6. Publicidade do termo (15 dias corridos), Secretaria; 7. Acompanhamento do cumprimento (365 dias corridos), Gabinete; 8. Pedido de informações ao compromissário, Secretaria; 9. Descumprimento, Gabinete; 10. Repactuação, Gabinete; 11. Execução judicial, Gabinete; 12. Arquivamento do acompanhamento, Secretaria; 13. Recurso do arquivamento, Conselho Superior; 14. Encerramento sem acordo, Gabinete; 15. Encerramento com execução, Secretaria; 16. Arquivamento, Secretaria.

### Recomendação do Ministério Público

**Porte:** Curto, 8 fases. **Inspirado em:** CNMP. **Identificador:** `recomendacao-mp`.

Ato formal e fundamentado pelo qual o membro expõe ao destinatário as razões de fato e de direito e recomenda que faça ou deixe de fazer algo, sem caráter coercitivo. Antes de recomendar à autoridade pública, requisitam-se informações, salvo impossibilidade motivada; em urgência, expede-se e instaura-se o procedimento depois. A recomendação indica as providências, o prazo razoável e, se quiser, as medidas cabíveis em caso de desatendimento. O destinatário responde por escrito; a resposta de não atendimento é apreciada de forma fundamentada. Acatada, acompanha-se o cumprimento; desatendida ou sem resposta, o membro adota as medidas cabíveis, como ação, ajustamento de conduta ou instauração de procedimento.

**Quando usar:** Dentro de inquérito civil, procedimento preparatório ou procedimento administrativo, quando persuadir o destinatário pode evitar a ação judicial. Ajuste o prazo de resposta ao caso.

**Base:** Res. CNMP 164/2017, arts. 1º (natureza), 3º (cabimento, informações prévias e urgência), 4º (destinatário e encaminhamento pelo Procurador-Geral em 10 dias), 5º e 6º (relação com a ação judicial), 7º e 8º (fundamentação e prazo), 9º (divulgação), 10 (resposta) e 11 (medidas); no MPRS, Provimento 71/2017-PGJ, arts. 48, parágrafo único, e 56 a 64.

**Partes:** Destinatário (requerido), Interessado (interessado).

**Recursos do motor usados:** 3 comunicações às partes; 2 esperas de resposta; 4 documentos; 1 formulário de dados; 4 fases com saída decidida pela resposta.

**Fases:** 1. Preparação, Gabinete; 2. Informações prévias, Secretaria; 3. Expedição e prazo de resposta, Gabinete; 4. Apreciação da resposta, Gabinete; 5. Acompanhamento do atendimento, Gabinete; 6. Providências, Gabinete; 7. Recomendação atendida, Secretaria; 8. Encerramento com providências, Secretaria.

### Audiência pública do Ministério Público

**Porte:** Curto, 6 fases. **Inspirado em:** CNMP. **Identificador:** `audiencia-publica-mp`.

Reunião organizada e aberta a qualquer cidadão e a representantes do poder público, da sociedade civil e da comunidade, para colher elementos sobre situação que lese ou possa lesar direitos difusos, coletivos ou individuais homogêneos, ou para prestar contas da atuação. É autuada e começa por edital com data, hora, local, objetivo, cadastro de expositores e forma de participação, publicado no sítio e afixado na sede com 3 dias úteis de antecedência, salvo urgência motivada; outros membros com atribuição são avisados no mesmo prazo. Realizada a audiência, lavra-se ata circunstanciada em 30 dias, publicada por extrato, e o membro produz relatório com as providências, como arquivamento, ajustamento de conduta, recomendação, instauração de procedimento ou ação civil pública. As manifestações são consultivas e não vinculam.

**Quando usar:** Para ouvir a sociedade num inquérito civil, procedimento ou negociação de ajustamento, identificar demandas sociais, elaborar planos de ação ou prestar contas.

**Base:** Res. CNMP 82/2012, arts. 1º (finalidade, autuação), 2º (edital), 3º (publicidade com 3 dias úteis, redação da Res. 207/2020), 4º (ata em 30 dias e extrato), 5º (aviso a outros membros), 6º (relatório) e 7º (caráter consultivo); Res. CNMP 179/2017, art. 1º, § 4º.

**Partes:** Participante inscrito (interessado).

**Recursos do motor usados:** 2 comunicações às partes; audiência (audiência); 6 documentos; 1 formulário de dados.

**Fases:** 1. Proposta e autuação, Gabinete; 2. Convocação, Secretaria; 3. Realização, Gabinete; 4. Ata (30 dias), Secretaria; 5. Relatório e providências, Gabinete; 6. Encerramento, Secretaria.

### Revisão de arquivamento pelo Conselho Superior (MPRS)

**Porte:** Médio, 13 fases. **Inspirado em:** MPRS. **Identificador:** `revisao-arquivamento-csmp`.

Rito do próprio Conselho Superior do Ministério Público do Rio Grande do Sul para os expedientes que lhe chegam das Promotorias: promoção de arquivamento de inquérito civil ou procedimento preparatório, inclusive após ajustamento de conduta, declínio de atribuição e recurso contra arquivamento de notícia de fato ou procedimento administrativo. A Secretaria dos Órgãos Colegiados confere e devolve o que estiver irregular; o relator instrui, pode baixar os autos em diligência, requisitar informações e, havendo recurso de interessado, ouve o órgão que arquivou em 5 dias. Publica-se aviso no Diário Eletrônico, as associações legitimadas apresentam razões até 3 dias antes da sessão e a pauta sai com 48 horas. O colegiado, em sessão pública, homologa, converte em diligência ou rejeita; rejeitado o arquivamento, o Procurador-Geral designa outro membro para propor ajustamento ou ação. Não cabe recurso. Difere das fases de revisão dos outros ritos por ser o processo do colegiado.

**Quando usar:** Na Secretaria dos Órgãos Colegiados e nos gabinetes dos conselheiros, para cada expediente remetido ao Conselho Superior. Outros Ministérios Públicos devem ajustar prazos e unidades ao seu regimento.

**Base:** Lei 7.347/1985, art. 9º, §§ 1º a 4º; Res. CNMP 23/2007, art. 10; Provimento 71/2017-PGJ (MPRS), arts. 5º, §§ 4º e 6º, 10, § 3º, 22, 24 a 30, 33, 43, 55, 67 e 70; Regimento Interno do CSMP-RS, arts. 4º (homologação), 12, § 4º (pauta com 48 horas), 16 (relator e sessão), 38 (aviso, diligências, homologação e designação) e 40 (sem recurso).

**Partes:** Representante ou recorrente (requerente), Investigado (requerido), Interessado (interessado).

**Recursos do motor usados:** 3 comunicações às partes; audiência (sessão); 1 julgamento colegiado; 4 documentos; 1 formulário de dados; 4 fases com saída decidida pela resposta.

**Fases:** 1. Recebimento e conferência, Secretaria dos Órgãos Colegiados; 2. Distribuição ao relator, Secretaria dos Órgãos Colegiados; 3. Instrução pelo relator, Gabinete do relator; 4. Diligências no órgão de execução, Promotoria de Justiça; 5. Esclarecimentos do órgão de execução (5 dias corridos), Promotoria de Justiça; 6. Aviso e pauta, Secretaria dos Órgãos Colegiados; 7. Sessão de julgamento, Conselho Superior; 8. Publicação e baixa, Secretaria dos Órgãos Colegiados; 9. Designação de outro membro, Secretaria dos Órgãos Colegiados; 10. Devolução ao órgão de execução, Secretaria dos Órgãos Colegiados; 11. Retorno para prosseguimento, Secretaria dos Órgãos Colegiados; 12. Arquivamento homologado, Secretaria dos Órgãos Colegiados; 13. Prosseguimento por outro membro, Secretaria dos Órgãos Colegiados.

### Destinação de bens e valores de tutela coletiva (MPRS)

**Porte:** Médio, 9 fases. **Inspirado em:** MPRS. **Identificador:** `destinacao-bens-valores-mprs`.

Destina os valores de compromisso de ajustamento, acordo de não persecução civil ou condenação em ação coletiva quando o membro não os envia ao Fundo para Reconstituição de Bens Lesados nem a outro fundo legal. O membro seleciona, por decisão fundamentada, entidade cadastrada, sem vedações, com pertinência temática e preferência pela comunidade atingida, alternando entre os cadastrados. Formaliza o termo de recebimento e, se a execução for continuada, o plano de trabalho; o membro nunca toca os valores. A entidade presta contas, em forma simplificada até 30 salários mínimos; com pendências, é chamada a sanar; reprovadas as contas ou sem prestação, o termo é rescindido, com devolução e exclusão do cadastro. Aprovadas as contas ou rescindido o termo, o procedimento vai ao Conselho Superior para homologação.

**Quando usar:** Em procedimento com valores a destinar a projeto ou entidade no MPRS. Outros Ministérios Públicos devem seguir a Res. Conjunta CNJ/CNMP 10/2024 e o seu regulamento.

**Base:** Res. Conjunta CNJ/CNMP 10/2024; Provimento 69/2025-PGJ (MPRS), arts. 1º, parágrafo único, 2º, § 2º (Defesa Civil), 4º e 7º (vedações), 6º (membro sem acesso aos valores), 8º a 10 (seleção, termo e plano de trabalho), 11 e 12 (prestação de contas), 14 (rescisão) e 15 (homologação), com alterações do Provimento 31/2026-PGJ; Provimento 71/2017-PGJ, art. 41; Res. CNMP 179/2017, art. 5º; Lei 7.347/1985, art. 13.

**Partes:** Devedor ou compromissário (requerido), Entidade destinatária (interessado).

**Recursos do motor usados:** 3 comunicações às partes; 1 espera de resposta; audiência (inspeção); 1 julgamento colegiado; 6 documentos; 1 formulário de dados; 4 fases com saída decidida pela resposta.

**Fases:** 1. Origem e opção de destinação, Gabinete; 2. Seleção do destinatário, Gabinete; 3. Formalização, Gabinete; 4. Execução e prestação de contas, Secretaria; 5. Análise das contas, Gabinete; 6. Rescisão do termo, Gabinete; 7. Homologação pelo Conselho Superior, Conselho Superior; 8. Destinação a fundo, Secretaria; 9. Encerramento, Secretaria.

### Cadastramento de entidade para destinação de recursos (MPRS)

**Porte:** Curto, 7 fases. **Inspirado em:** MPRS. **Identificador:** `cadastro-entidade-mprs`.

Pedido de órgão público, fundo ou entidade privada sem fins lucrativos para entrar no cadastro do MPRS que habilita a receber bens e valores de reparação de danos coletivos. O pedido chega pelo formulário do sítio à Promotoria da sede da entidade, com estatuto, ata da diretoria, CNPJ, certidões, projeto e dados bancários. A Promotoria confere os requisitos, como constituição há pelo menos três anos, e as vedações, chama a entidade a completar documentos, ouve o Centro de Apoio da matéria e decide. O cadastro vale três anos para entidade privada, deve ser atualizado em 30 dias a cada alteração e não dá direito à destinação; quem não presta contas é excluído.

**Quando usar:** Ao receber pedido de cadastramento, em fluxo contínuo ou em resposta ao edital bienal de chamamento.

**Base:** Provimento 69/2025-PGJ (MPRS), arts. 2º (entidades), 3º (edital a cada 2 anos e fluxo contínuo), 4º (vedações), 5º (formulário, documentos, decisão da Promotoria ouvido o Centro de Apoio, atualização em 30 dias, exclusão e validade de 3 anos), com alterações do Provimento 31/2026-PGJ; Res. Conjunta CNJ/CNMP 10/2024, art. 12. Prazo para completar documentos e cabimento de recurso: conferir na norma vigente e no edital.

**Partes:** Entidade requerente (requerente).

**Recursos do motor usados:** 2 comunicações às partes; 1 espera de resposta; 3 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Pedido de cadastramento, Secretaria; 2. Análise dos requisitos, Promotoria de Justiça; 3. Complementação de documentos, Secretaria; 4. Oitiva do Centro de Apoio, Centro de Apoio Operacional; 5. Decisão, Promotoria de Justiça; 6. Cadastro deferido, Secretaria; 7. Cadastro indeferido, Secretaria.

### Triagem de representação sobre patrimônio público (MPRS)

**Porte:** Curto, 8 fases. **Inspirado em:** MPRS. **Identificador:** `triagem-patrimonio-publico-mprs`.

Filtro próprio do MPRS para representações sobre improbidade e dano ao erário, antes de instaurar inquérito civil ou procedimento preparatório. O membro pode, por decisão fundamentada, não instaurar e encaminhar a representação à procuradoria do ente lesado quando não há indícios de improbidade ou a pretensão está prescrita, ou quando o ente já apura a conduta; requisitar sindicância ao ente e aguardar até um ano; enviar ao Tribunal de Contas ou ao ente o caso de prejuízo até R$ 2.000; indeferir com recomendação entre R$ 2.000 e R$ 8.500; ou arquivar abaixo de R$ 34.000 sem ofensa relevante a princípios. Essas saídas não valem quando o agente administra o ente ou o controle interno está comprometido. O representante é cientificado e pode recorrer em 10 dias; a decisão sobe sempre ao Conselho Superior em 3 dias. Difere da notícia de fato comum pelos limites de valor e pela remessa obrigatória.

**Quando usar:** Nas Promotorias com atribuição em patrimônio público no MPRS, ao receber representação sobre improbidade ou dano ao erário. Confira os valores atualizados do provimento.

**Base:** Provimento 04/2012-PGJ (MPRS), arts. 3º (encaminhamento ao ente e sindicância por até 1 ano; vedações do § 2º), 4º e 4º-A (limites de R$ 2.000, R$ 8.500 e R$ 34.000, redação do Provimento 85/2023-PGJ), 5º (prioridade), 6º e 7º (registro e remessa ao Conselho Superior); Provimento 71/2017-PGJ, art. 5º, §§ 1º, 4º e 6º, e art. 70; Lei 8.429/1992. O art. 1º do Provimento 04/2012-PGJ (investigação na esfera criminal) não é modelado.

**Partes:** Representante (requerente), Representado (requerido), Ente público lesado (interessado).

**Recursos do motor usados:** 3 comunicações às partes; 2 esperas de resposta; 1 julgamento colegiado; 5 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Registro da representação, Secretaria; 2. Análise de relevância (30 dias corridos), Gabinete; 3. Aguardando apuração do ente, Secretaria; 4. Decisão de não instaurar, Gabinete; 5. Cientificação e remessa ao Conselho Superior, Secretaria; 6. Deliberação do Conselho Superior, Conselho Superior; 7. Instauração de procedimento, Gabinete; 8. Arquivamento, Secretaria.

## Gestão interna e pessoas

### Consulta ou parecer interno

**Porte:** Curto, 7 fases. **Inspirado em:** Lei 9.784. **Identificador:** `consulta-interna`.

Uma unidade pede a outra, em geral a assessoria jurídica ou uma área técnica, opinião formal sobre uma dúvida. A chefia do órgão consultivo confere se a consulta está instruída, devolve para diligência se faltar algo, aplica parecer referencial quando houver, e distribui ao parecerista, que tem 15 dias quando o parecer é obrigatório. Aprovado o parecer, a autoridade decide e, se divergir, motiva. Não há partes externas nem recurso: termina com a devolução do parecer aprovado ao consulente.

**Quando usar:** Quando a decisão de outro processo depende de parecer, ou para fixar entendimento sobre uma dúvida jurídica ou técnica.

**Base:** Lei 9.784/1999, arts. 24, 42 e 50, VII; Lei 14.133/2021, art. 53 (consulta sobre contratação).

**Partes:** Unidade consulente (requerente).

**Recursos do motor usados:** 7 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; 1 fase de espera.

**Fases:** 1. Formulação da consulta, Área técnica; 2. Triagem e distribuição, Assessoria jurídica; 3. Diligência ao consulente, Área técnica; 4. Elaboração do parecer (15 dias corridos), Assessoria jurídica; 5. Aprovação, Assessoria jurídica; 6. Devolução ao consulente, Gabinete; 7. Arquivamento, Secretaria.

### Concessão de benefício ou licença a servidor

**Porte:** Curto, 8 fases. **Inspirado em:** Lei 8.112. **Identificador:** `beneficio-servidor`.

Decide pedido do servidor sobre direito funcional: licença, afastamento, adicional, auxílio ou averbação de tempo. O requerimento passa pela chefia imediata, que opina sobre a conveniência quando o benefício depende de interesse da Administração, e pela gestão de pessoas, que confere os requisitos e, nas licenças por saúde, aciona a perícia oficial. A autoridade decide em até 30 dias, a decisão é publicada e lançada nos assentamentos. O servidor pode pedir reconsideração ou recorrer em 30 dias; sem isso, o processo é arquivado.

**Quando usar:** Qualquer requerimento individual de direito funcional em que só o servidor é interessado.

**Base:** Lei 8.112/1990, arts. 81, 82, 87, 91, 104 a 110, 202 a 204 e 238. Para outros regimes, o estatuto próprio.

**Partes:** Servidor requerente (requerente).

**Recursos do motor usados:** 2 comunicações às partes; 1 espera de resposta; 6 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Requerimento, Secretaria; 2. Manifestação da chefia imediata, Chefia imediata; 3. Instrução pela gestão de pessoas, Gestão de pessoas; 4. Perícia oficial, Gestão de pessoas; 5. Decisão (30 dias corridos), Gabinete; 6. Publicação e registro, Gestão de pessoas; 7. Reconsideração ou recurso (30 dias corridos), Gabinete; 8. Arquivamento, Gestão de pessoas.

### Proposta de ato normativo ao conselho

**Porte:** Curto, 8 fases. **Inspirado em:** Regimento do colegiado. **Identificador:** `deliberacao-normativa`.

Para conselhos e colegiados que editam resoluções, enunciados, instruções e regimentos. A proposta chega à secretaria com minuta e justificativa, recebe parecer da comissão temática, pode passar por consulta pública quando a matéria é de interesse geral, e o relator leva voto e emendas à sessão. O colegiado aprova, aprova com emendas ou rejeita; aprovada, a secretaria consolida a redação final e publica.

**Quando usar:** Atos normativos de conselho superior, conselho de classe, conselho de política pública ou comissão. Ajuste quórum e prazos ao regimento.

**Base:** Lei 9.784/1999, arts. 31 e 32 (consulta e audiência pública), 50, § 1º (motivação) e o regimento do colegiado (quórum, emendas e publicação).

**Partes:** Proponente (requerente).

**Recursos do motor usados:** 1 julgamento colegiado; 5 documentos; 1 formulário de dados; 2 fases com saída decidida pela resposta.

**Fases:** 1. Proposta, Secretaria do colegiado; 2. Parecer da comissão (15 dias corridos), Comissão temática; 3. Consulta pública (30 dias corridos), Secretaria do colegiado; 4. Relatoria, Gabinete do relator; 5. Deliberação em sessão, Secretaria do colegiado; 6. Publicação, Secretaria do colegiado; 7. Ato publicado, Secretaria do colegiado; 8. Arquivamento, Secretaria.

### Gestão de bens patrimoniais: do tombamento à baixa

**Porte:** Longo, 15 fases. **Inspirado em:** Lei 4.320. **Identificador:** `gestao-patrimonio`.

Acompanha a vida de um bem do órgão (ou de um lote de bens iguais) do ingresso à baixa: conferência e classificação (permanente ou consumo), tombamento com plaqueta e registro patrimonial e contábil (vida útil e valor residual), carga ao responsável por termo de responsabilidade. Em uso, o processo fica em "Bem em uso" e dela saem os eventos: inventário anual, movimentação ou troca de responsável, manutenção, reavaliação e depreciação, cessão ou empréstimo, apuração de extravio, dano ou furto (termo circunstanciado para pequeno valor sem dolo, ou processo disciplinar derivado) e bem sem uso ou com defeito. O inservível é classificado por comissão (ocioso, recuperável, antieconômico, irrecuperável) e segue para reaproveitamento, alienação (leilão, doação de interesse social, permuta) ou descarte ambientalmente adequado. Tudo termina na baixa patrimonial e contábil. Não trata de patrimônio histórico ou cultural.

**Quando usar:** No Ministério Público do RS, prefira o modelo "Bens móveis no MPRS", pelo Provimento 55/2022-PGJ. Só para dar destino ao que não serve mais, há modelos por esfera: "Bens móveis inservíveis na administração federal" e "Bens móveis inservíveis no Estado do RS". Bens permanentes de uso do órgão (mobiliário, equipamentos, veículos, informática, imóveis, softwares e licenças). Um processo por bem ou por lote do mesmo ingresso. Para o quadro e a planilha dos bens, use "Gerar painel e planilha".

**Base:** Lei 4.320/1964, arts. 15, § 2º, 94 a 96 e 106; Lei 14.133/2021, arts. 76 e 140; NBC TSP 07 e 09; MCASP, Parte II; Portaria STN 448/2002; Lei 12.305/2010; na União, Decreto 12.785/2025 (que substituiu o Decreto 9.373/2018) e IN CGU 4/2009. Estados e municípios: conferir o regulamento próprio de bens e de desfazimento.

**Partes:** sem partes (processo interno).

**Recursos do motor usados:** 17 documentos; 5 formulários de dados; 9 fases com saída decidida pela resposta.

**Fases:** 1. Entrada e conferência, Almoxarifado; 2. Tombamento e registro, Patrimônio; 3. Carga ao responsável, Patrimônio; 4. Bem em uso, Patrimônio; 5. Inventário, Comissão de inventário; 6. Movimentação ou transferência, Patrimônio; 7. Manutenção, Manutenção; 8. Reavaliação e depreciação, Contabilidade; 9. Cessão ou empréstimo, Gabinete; 10. Apuração de extravio ou dano, Patrimônio; 11. Classificação de inservível, Comissão de desfazimento; 12. Reaproveitamento, Patrimônio; 13. Alienação ou descarte, Gabinete; 14. Baixa patrimonial, Patrimônio; 15. Arquivamento, Secretaria.

### Bens móveis no MPRS: do tombamento à baixa

**Porte:** Longo, 19 fases. **Inspirado em:** MPRS. **Identificador:** `gestao-patrimonio-mprs`.

A vida do bem móvel permanente do Ministério Público do RS, pelo Provimento 55/2022-PGJ: classificação e cadastro na Unidade de Patrimônio e Almoxarifado, tombamento antes de sair, carga por Termo de Responsabilidade ao titular da unidade (no interior, o Diretor da Promotoria) ou carga pessoal no bem de uso exclusivo. Com o bem em uso, cada evento tem o seu caminho: o inventário anual, com as datas de 31 de julho, 31 de agosto, 30 de setembro e 31 de outubro; a conferência de 30 dias do novo titular; a movimentação entre unidades; a perda, o furto ou o dano, com Termo Circunstanciado Administrativo, decisão do Subprocurador-Geral de Justiça para Assuntos Administrativos e reposição ou indenização pela tabela do provimento; a devolução para triagem (ocioso-excedente, recuperável, obsoleto, fora do padrão ou irrecuperável); a cessão de uso. O inservível passa pela Comissão Permanente de Avaliação de Patrimônio e, com autorização do Diretor-Geral, é doado, leiloado, permutado, descartado ou incinerado, com baixa ao fim.

**Quando usar:** Bens móveis permanentes do MPRS. Abra um processo por bem ou por lote (uma aquisição, uma unidade, um conjunto para baixa). Bem de consumo fica no controle do almoxarifado. Não trata de imóveis nem de patrimônio histórico e cultural. Ligue o painel e a planilha para ter a relação dos bens, com tombo, unidade e situação.

**Base:** Provimento 55/2022-PGJ (bens móveis), arts. 1º a 35; Provimento 02/2009, arts. 2º a 7º e 16 (alienação e desfazimento; o capítulo da venda foi revogado pelo Provimento 05/2023-PGJ); Lei 14.133/2021, arts. 6º, XL, 31 e 76, II (alienação de bens móveis e leilão); Lei 4.320/1964, arts. 94 a 96; Lei 12.305/2010 (resíduos); Decreto estadual 58.685/2026 (Programa Sustentare, de adesão facultativa pelos outros Poderes e órgãos); Decreto estadual 57.408/2023, com o § 3º do art. 3º incluído pelo Decreto 58.684/2026 (bens móveis inservíveis da administração direta, das autarquias e das fundações do Executivo, exceto veículos: não obriga o Ministério Público e entra só como referência de boa prática).

**Partes:** sem partes (processo interno).

**Recursos do motor usados:** 20 documentos; 5 formulários de dados; 10 fases com saída decidida pela resposta.

**Fases:** 1. Entrada e classificação, Unidade de Patrimônio e Almoxarifado; 2. Tombamento e cadastro, Unidade de Patrimônio e Almoxarifado; 3. Carga e Termo de Responsabilidade, Unidade de Patrimônio e Almoxarifado; 4. Bem em uso, Unidade detentora da carga; 5. Inventário anual, Unidade detentora da carga; 6. Inconsistência do inventário, Unidade de Patrimônio e Almoxarifado; 7. Conferência do novo titular, Unidade detentora da carga; 8. Movimentação, Unidade detentora da carga; 9. Perda, furto ou dano: termo circunstanciado, Unidade detentora da carga; 10. Instrução do termo circunstanciado, Unidade de Patrimônio e Almoxarifado; 11. Decisão do Subprocurador-Geral, Subprocuradoria-Geral de Justiça para Assuntos Administrativos; 12. Reposição ou indenização, Direção-Geral; 13. Triagem, Unidade de Patrimônio e Almoxarifado; 14. Cessão de uso, Subprocuradoria-Geral de Justiça para Assuntos Administrativos; 15. Avaliação para baixa, Comissão Permanente de Avaliação de Patrimônio; 16. Autorização da baixa, Direção-Geral; 17. Destinação, Unidade de Patrimônio e Almoxarifado; 18. Baixa patrimonial, Unidade de Patrimônio e Almoxarifado; 19. Arquivamento, Unidade de Patrimônio e Almoxarifado.

### Bens móveis inservíveis no Estado do RS: avaliação, destinação e baixa

**Porte:** Médio, 11 fases. **Inspirado em:** Estado do RS. **Identificador:** `bens-inserviveis-rs`.

O caminho do bem móvel que não serve mais ao órgão, nos órgãos, autarquias e fundações do Executivo do Rio Grande do Sul. Primeiro o bem é oferecido a outro órgão estadual, por transferência patrimonial, que dispensa parecer da comissão e baixa. Sem interessado, a Comissão Especial de Avaliação de Inservíveis faz o relatório e classifica o bem (obsoleto, ocioso, antieconômico ou irrecuperável) e o ordenador de despesa decide a baixa e o destino: Programa Sustentare, para o eletroeletrônico; leilão pela Central de Licitações; doação; ou eliminação, com ata. A baixa no sistema de patrimônio do Estado sai junto com a alienação ou a doação.

**Quando usar:** Órgãos, autarquias e fundações do Executivo do RS, para mobiliário, equipamentos e eletroeletrônicos sem uso. Não vale para veículos. Abra um processo por lote. No Ministério Público do RS, use "Bens móveis no MPRS"; na administração federal, "Bens móveis inservíveis na administração federal".

**Base:** Decreto estadual 57.408/2023, arts. 1º a 7º, com o § 3º do art. 3º incluído pelo Decreto 58.684/2026; Decreto estadual 58.685/2026 (Programa Sustentare), arts. 1º, 2º, 6º e 8º; Decreto estadual 57.916/2024 (leilão de bens móveis inservíveis: texto não lido, conferir antes de usar); Lei 14.133/2021, arts. 6º, XL, 31 e 76, II; Lei 12.305/2010 (resíduos); Lei 4.320/1964, arts. 94 a 96.

**Partes:** sem partes (processo interno).

**Recursos do motor usados:** 8 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Levantamento dos bens, Setor de patrimônio; 2. Oferta a outros órgãos, Setor de patrimônio; 3. Transferência patrimonial, Ordenador de despesa; 4. Avaliação pela comissão, Comissão Especial de Avaliação de Inservíveis; 5. Deliberação do ordenador, Ordenador de despesa; 6. Programa Sustentare, Setor de patrimônio; 7. Alienação por leilão, Setor de patrimônio; 8. Doação, Ordenador de despesa; 9. Eliminação, Comissão Especial de Avaliação de Inservíveis; 10. Baixa no patrimônio, Setor de patrimônio; 11. Arquivamento, Setor de patrimônio.

### Bens móveis inservíveis na administração federal: circularidade e desfazimento

**Porte:** Médio, 11 fases. **Inspirado em:** Governo federal. **Identificador:** `bens-inserviveis-federal`.

O caminho do bem móvel que não serve mais ao órgão, na administração federal direta, nas autarquias e nas fundações, pelo decreto de circularidade de 2025. A comissão de avaliação enquadra o bem como ocioso, recuperável, antieconômico ou irrecuperável. A autoridade escolhe o destino, na ordem que o decreto sugere: transferência dentro do órgão, transferência ou cessão a outro órgão, doação para uso de interesse social, permuta, leilão do que ninguém quis e, por último, tratamento como resíduo. Informática e eletroeletrônicos passam antes pelo Programa Computadores para Inclusão. Cessão, transferência, doação e permuta são divulgadas no sistema do governo federal.

**Quando usar:** Órgãos, autarquias e fundações federais, para bens móveis sem uso. Não vale para os Comandos da Marinha, do Exército e da Aeronáutica nem para bens com legislação própria. Abra um processo por lote. No Executivo do RS, use "Bens móveis inservíveis no Estado do RS"; no Ministério Público do RS, "Bens móveis no MPRS".

**Base:** Decreto 12.785/2025 (que revogou os Decretos 9.373/2018 e 10.340/2020), arts. 2º a 21; Lei 14.133/2021, arts. 6º, XL, 7º, 31 e 76, II; Lei 14.479/2022 (Política Nacional de Desfazimento e Recondicionamento de Equipamentos Eletroeletrônicos); Lei 12.305/2010, art. 38 (resíduos); Código Civil, art. 533 (permuta); Lei 4.320/1964, arts. 94 a 96. O decreto não trata da baixa nem fixa prazo de divulgação: valem as normas complementares da Secretaria de Gestão e Inovação (art. 22) e o sistema patrimonial do órgão.

**Partes:** sem partes (processo interno).

**Recursos do motor usados:** 10 documentos; 2 formulários de dados; 5 fases com saída decidida pela resposta.

**Fases:** 1. Levantamento dos bens, Setor de patrimônio; 2. Classificação pela comissão, Comissão de avaliação de bens; 3. Escolha da destinação, Autoridade competente; 4. Transferência ou cessão, Setor de patrimônio; 5. Computadores para Inclusão, Setor de patrimônio; 6. Doação, Autoridade competente; 7. Permuta, Autoridade competente; 8. Leilão, Setor de licitações; 9. Destinação como resíduo, Setor de patrimônio; 10. Baixa e registro, Setor de patrimônio; 11. Arquivamento, Setor de patrimônio.

## Controle e contas

### Tomada de contas especial (fase interna)

**Porte:** Longo, 13 fases. **Inspirado em:** TCU. **Identificador:** `tomada-contas-especial`.

Apura quem causou dano ao erário, quanto é o dano, e busca o ressarcimento. Antes de instaurar, o órgão esgota as medidas administrativas: notifica os responsáveis para prestar contas, justificar ou recolher, e tenta a solução consensual quando cabível. Instaurada, a comissão quantifica o débito, individualiza as condutas e ouve o responsável, que pode se defender ou recolher; o relatório passa pelo controle interno e pela autoridade supervisora. Termina com a remessa ao tribunal de contas em até 180 dias da instauração, que julga na fase externa, ou com o arquivamento quando o débito é recolhido, o dano afastado ou a tomada de contas dispensada.

**Quando usar:** Omissão no dever de prestar contas, falta de comprovação da aplicação de recursos repassados, desfalque ou desvio de bens ou valores, ou ato ilegal, ilegítimo ou antieconômico que cause dano ao erário.

**Base:** Lei 8.443/1992, art. 8º; IN TCU 98/2024, arts. 2º a 25 (em especial arts. 3º a 7º, 14, 15, 17 a 25).

**Partes:** Responsável (requerido).

**Recursos do motor usados:** 3 comunicações às partes; 2 esperas de resposta; 14 documentos; 2 formulários de dados; 6 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Conhecimento do fato, Área técnica; 2. Medidas administrativas prévias, Gabinete; 3. Solução consensual (120 dias corridos), Gabinete; 4. Verificação dos pressupostos e das dispensas, Gabinete; 5. Instauração, Gabinete; 6. Apuração e quantificação, Comissão de tomada de contas; 7. Relatório do tomador de contas, Comissão de tomada de contas; 8. Registro de devedores, Secretaria; 9. Controle interno, Controle interno; 10. Pronunciamento da autoridade supervisora, Autoridade máxima; 11. Remessa ao tribunal de contas, Secretaria; 12. Saneamento da remessa (60 dias corridos), Comissão de tomada de contas; 13. Arquivamento, Secretaria.

## Advocacia pública e consultoria

### Mediação e conciliação na câmara da advocacia pública (CCAF)

**Porte:** Médio, 14 fases. **Inspirado em:** AGU. **Identificador:** `conciliacao-ccaf`.

Resolve por consenso conflito entre órgãos e entidades federais, ou entre eles e Estados, Municípios ou particulares legitimados, na Câmara de Mediação e de Conciliação da Administração Pública Federal. Começa com requerimento de quem tem legitimidade; a câmara confere o cabimento, distribui a um mediador e, depois de reuniões preliminares, faz o juízo de admissibilidade, que suspende a prescrição desde o pedido. Na negociação mediada, os interessados trocam propostas em reuniões; o mediador não decide. Havendo acordo, cada interessado se manifesta sobre legalidade e vantajosidade, as autoridades da alçada autorizam, o mediador emite parecer de conformidade aprovado pelo diretor, e o termo assinado é homologado pelo Advogado-Geral da União, valendo como título executivo. Sem acordo sobre controvérsia jurídica entre órgãos federais, o caso vai ao Consultor-Geral da União para que o Advogado-Geral a dirima. Não há recurso contra o arquivamento.

**Quando usar:** Conflito em que pelo menos um lado é órgão ou entidade federal e há espaço para solução negociada, judicializado ou não. Câmaras estaduais ou municipais de advocacia pública podem usar o mesmo desenho, trocando as autoridades e as alçadas pelas da lei local.

**Base:** Lei 13.140/2015, arts. 32, 34, 36 e 40 (art. 34 e art. 36, § 4º: conferir na norma vigente); Lei 9.469/1997, art. 1º, §§ 1º, 3º e 4º; Decreto 10.201/2020, art. 2º, § 1º; Portaria Normativa AGU 178/2025, arts. 20 e 48 (demais artigos e prazos: conferir na norma vigente); decreto de estrutura da AGU (Decreto 11.328/2023: conferir o artigo que manda à Consultoria-Geral as controvérsias não resolvidas); Enunciados da CCAF de 2026, n. 3 a 8.

**Partes:** Requerente (requerente), Órgão ou ente requerido (requerido), Outro interessado (interessado).

**Recursos do motor usados:** 7 comunicações às partes; 1 espera de resposta; audiência (reunião); 19 documentos; 1 formulário de dados; 5 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Requerimento, Câmara de mediação; 2. Análise preliminar e distribuição, Câmara de mediação; 3. Saneamento do pedido, Câmara de mediação; 4. Juízo de admissibilidade, Câmara de mediação; 5. Negociação mediada (60 dias), Câmara de mediação; 6. Aguardando estudos dos interessados, Câmara de mediação; 7. Conformidade e autorizações, Câmara de mediação; 8. Assinatura e homologação, Gabinete do Advogado-Geral; 9. Encaminhamento ao Consultor-Geral, Consultoria-Geral; 10. Inadmissão, Câmara de mediação; 11. Encerramento sem acordo, Câmara de mediação; 12. Acordo homologado, Câmara de mediação; 13. Controvérsia dirimida, Câmara de mediação; 14. Arquivamento, Câmara de mediação.

### Acordo para prevenir ou encerrar litígio com a União

**Porte:** Médio, 12 fases. **Inspirado em:** AGU. **Identificador:** `acordo-transacao-uniao`.

Negocia acordo ou transação para evitar uma ação ou encerrar um processo judicial em que a União ou ente federal é parte. Começa com proposta do interessado ou iniciativa da própria advocacia pública, sob termo de confidencialidade e com o processo suspenso. A unidade da causa examina, nessa ordem, a probabilidade de êxito, a viabilidade jurídica e a economicidade; se não houver viabilidade, arquiva e avisa o interessado ou o juízo. Viável, negocia com o interessado, que responde às contrapropostas. Fechada a proposta, a autoridade da alçada autoriza: o procurador-geral até R$ 10 milhões, o Advogado-Geral acima disso e, a partir de R$ 50 milhões, também o Ministro de Estado. Assinado o termo, o juízo o homologa quando necessário, e a unidade acompanha o pagamento, que pode ser em até 60 parcelas; o descumprimento leva à execução do saldo.

**Quando usar:** Proposta de acordo em ação judicial ou pedido de solução extrajudicial contra a União ou autarquia federal. Para empresa pública federal, as alçadas são outras (Decreto 10.201, arts. 2º, § 4º, e 4º); para Estados e Municípios, use a lei local de acordos.

**Base:** Lei 9.469/1997, arts. 1º, caput e §§ 1º, 4º e 5º, 1º-C e 2º, §§ 2º a 4º; Decreto 10.201/2020, arts. 2º, 3º e 5º; Portaria Normativa PGU/AGU 21/2024, arts. 3º, 5º, 7º a 17 e 23; Portaria AGU 173/2020 (conferir na norma vigente); CPC, arts. 313, II, 487, III, b, e 725, VIII. Para autarquias e fundações, normas da PGF: conferir na norma vigente.

**Partes:** Interessado no acordo (requerente).

**Recursos do motor usados:** 5 comunicações às partes; 1 espera de resposta; audiência (reunião); 14 documentos; 1 formulário de dados; 4 fases com saída decidida pela resposta; 1 fase de espera; sigilo ao entrar.

**Fases:** 1. Proposta, Procuradoria; 2. Probabilidade de êxito e cálculos, Procuradoria; 3. Viabilidade jurídica e economicidade, Procuradoria; 4. Negociação, Procuradoria; 5. Autorização por alçada, Gabinete; 6. Termo de acordo e homologação, Procuradoria; 7. Cumprimento, Procuradoria; 8. Aguardando pagamento, Procuradoria; 9. Execução do saldo, Procuradoria; 10. Recusa e arquivamento, Procuradoria; 11. Acordo cumprido, Procuradoria; 12. Arquivamento, Procuradoria.

### Cobrança administrativa e inscrição em dívida ativa (crédito não tributário)

**Porte:** Médio, 15 fases. **Inspirado em:** AGU. **Identificador:** `cobranca-divida-ativa-nao-tributaria`.

Cobra crédito não tributário já constituído, como multa administrativa, ressarcimento ao erário ou reposição, e o leva à dívida ativa se não for pago. A unidade de origem notifica o devedor para pagar, parcelar ou impugnar, com aviso de inclusão no Cadin 75 dias depois. A impugnação é decidida pela unidade, com recurso à autoridade superior. Não pago, o processo vai à procuradoria, que faz o controle de legalidade (liquidez, certeza e prescrição), devolve para correção ou inscreve e emite a certidão de dívida ativa. Seguem a cobrança extrajudicial, com Cadin e protesto, e, se ainda não houver pagamento, a execução fiscal. Termina com a quitação, o cancelamento do crédito ou o envio à execução.

**Quando usar:** Crédito não tributário de autarquia, fundação ou órgão, com decisão definitiva no processo que o gerou. Ajuste o prazo de pagamento e as medidas de cobrança à norma do seu ente; a PGFN e as procuradorias estaduais e municipais têm regras próprias.

**Base:** Lei 4.320/1964, art. 39, § 2º; Lei 6.830/1980, art. 2º, §§ 3º, 5º, 6º e 8º; Lei 9.784/1999, arts. 26 a 28, 56 a 59 e 66; Lei 10.522/2002, arts. 2º, § 2º, e 37-B; Lei 9.492/1997, art. 1º, parágrafo único; Lei 10.480/2002, art. 10 (conferir parágrafos); Lei 9.469/1997, art. 1º-C; Lei 9.873/1999, art. 1º-A; Portaria Normativa PGF 51/2023 (dispensa de inscrição e cobrança extrajudicial: conferir na norma vigente). O prazo de 30 dias da notificação é padrão do modelo: conferir na norma do órgão.

**Partes:** Devedor (requerido).

**Recursos do motor usados:** 5 comunicações às partes; 2 esperas de resposta; 17 documentos; 3 formulários de dados; 7 fases com saída decidida pela resposta.

**Fases:** 1. Constituição do crédito, Unidade de origem; 2. Notificação de cobrança, Unidade de origem; 3. Impugnação (30 dias corridos), Unidade de origem; 4. Intimação da decisão e recurso, Unidade de origem; 5. Recurso (30 dias corridos), Gabinete; 6. Parcelamento, Unidade de origem; 7. Remessa para inscrição, Unidade de origem; 8. Controle de legalidade, Procuradoria; 9. Devolução para correção, Unidade de origem; 10. Inscrição e certidão, Procuradoria; 11. Cobrança extrajudicial, Procuradoria; 12. Execução fiscal, Procuradoria; 13. Cancelamento, Unidade de origem; 14. Crédito quitado, Unidade de origem; 15. Encerramento, Unidade de origem.
