# Visão geral do SIGO

**SIGO — Sistema Interno de Gestão Operacional.** Plataforma web de gestão de
processos, procedimentos e dados para unidades do Ministério Público do Estado
do Rio Grande do Sul (MPRS). Nasceu no CAOCIPP (Centro de Apoio Operacional
Cível e de Proteção do Patrimônio Público) e hoje serve a qualquer unidade que
crie um **órgão** dentro da plataforma.

- Aplicação publicada: <https://sigo-caocipp.web.app>
- Endereço antigo (redireciona com HTTP 301): <https://consultascao.web.app>

---

## 1. Que problema resolve

Antes do SIGO, cada servidor controlava o próprio trabalho numa planilha
individual. Não havia visão de prazos, de carga de trabalho, de histórico nem
memória da unidade: quando alguém saía ou entrava de férias, a informação ia
junto. O SIGO transforma essas planilhas numa plataforma única:

- cada demanda tem um registro com fases, responsável e datas;
- a fase é **derivada das datas preenchidas** (regra auditável, não opinião);
- tudo o que muda fica no histórico do registro;
- a chefia enxerga o conjunto em quadros (Kanban), listas, métricas e
  relatórios, sem precisar pedir a planilha de ninguém.

**Não há inteligência artificial em nenhum cálculo.** Status, métricas,
relatórios, inferência de colunas do Panorama e pontuação da Jurimetria são
regras determinísticas escritas no código e documentadas aqui. Nenhuma função
do sistema chama um serviço de IA.

---

## 2. Conceitos básicos

| Conceito | O que é |
|---|---|
| **Órgão** (organização) | O espaço de trabalho de uma unidade. Tudo — registros, membros, configurações — pertence a um órgão (`organization_id`). Um usuário pode participar de vários órgãos. |
| **Membro** | Usuário vinculado a um órgão (documento `userOrganizations/{uid}_{orgId}`). Entra pelo **código de convite** do órgão. |
| **Papel** (`role`) | `creator` (quem criou o órgão — tem todos os poderes), `admin` ou `member`. Governa autorização. |
| **Função** (`function`) | Texto livre que descreve o que a pessoa faz (ex.: Assessoria, Secretaria, Decisória, Promotor). Personaliza o painel inicial; não concede permissão. |
| **Atribuições** | Permissões especiais que o criador delega a membros (ex.: configurar Parcerias, excluir registros). Ver [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md). |
| **Módulo** | Conjunto de páginas do órgão (Consultas, Expedientes, Parcerias, Jurimetria, Panorama, Processo Eletrônico, Resumos, Calendário). Cada órgão liga os que usa em *Painel Administrativo → Páginas e Módulos*. |
| **Super-admin** | Administrador da plataforma inteira (custom claim `platformAdmin`). Acessa a página *Administração da plataforma*. |
| **Modelo da plataforma × modelo do órgão** | Modelos e padrões (a biblioteca de ritos, o Rito Consultas CAOCIPP, os textos prontos) são da plataforma e ficam no código; nenhum órgão os altera. Usar um modelo grava uma cópia só do órgão, que ele muda à vontade e que não muda quando a plataforma muda. O órgão leva o que montou a outro órgão por um pacote `.json` (exportar e importar). |

---

## 3. Perfis de uso

| Perfil | O que faz no SIGO |
|---|---|
| **Assessor(a)** | Recebe registros distribuídos, registra o andamento (início da análise, remessa a terceiros, envio para revisão), vê os próprios prazos no painel inicial e no calendário. |
| **Secretaria** | Cadastra e importa registros, distribui para os assessores, acompanha o Kanban e arquiva. |
| **Decisória / chefia** | Revisa, acompanha métricas e tempos nos *Resumos Inteligentes*, nas métricas de *Informações Gerais* e nos relatórios. |
| **Criador do órgão** | Configura o órgão: membros, atribuições, matérias, listas de sistemas/origens/terceiros, módulos, métricas, segurança. |
| **Super-admin da plataforma** | Liga funcionalidades opcionais, acompanha custos, cotas, saúde do sistema e ferramentas de dados. |
| **Equipe do Processo Eletrônico** | Autua, redige, assina e junta documentos, cumpre as ações de cada fase, comunica as partes, designa audiências, pauta processos em sessão e conduz disputas de preços. A administração do PE monta ritos, tipos, unidades e modelos. |
| **Julgador(a) de colegiado** | Vê as sessões do seu colegiado, lê os autos dos processos pautados (cada leitura registrada), anota para si, vota, pede vista, diverge e redige o acórdão. |
| **Parte e advogado(a)** | Pelo portal (`/Portal`), acompanham o processo, recebem comunicações, respondem, peticionam e participam de audiências e sessões, sem ver nada interno. |
| **Fornecedor(a) e público** | O fornecedor convidado envia proposta e lances em `/Disputas` (na dispensa, também há observadores); qualquer pessoa confere documentos em `/Conferir`. |

---

## 4. Módulos

| Módulo | Para quê | Documento |
|---|---|---|
| **Consultas** | Consultas jurídicas recebidas pela unidade: entrada, distribuição, análise, revisão e arquivamento, com classificação por matéria. | [CONSULTAS.md](./CONSULTAS.md) |
| **Expedientes** | Expedientes administrativos, com fluxo paralelo ao das Consultas e listas próprias de sistemas e origens. | [EXPEDIENTES.md](./EXPEDIENTES.md) |
| **Parcerias** | Convênios, Termos de Cooperação e Termos de Fomento: sete fases, aditivos ilimitados, avisos automáticos de renovação e revisão, extinção. | [PARCERIAS.md](./PARCERIAS.md) |
| **Jurimetria** | Base de júris do órgão (incorporada do aplicativo do CAOJúri): importação, cadastro, relatórios estáticos e dinâmicos, exportação em seis formatos. | [JURIMETRIA.md](./JURIMETRIA.md) |
| **Panorama** | Módulo "coringa": transforma qualquer planilha em painel, relatórios e prescrição, sem programação, atribuindo papéis às colunas. | [PANORAMA.md](./PANORAMA.md) |
| **Resumos Inteligentes** | Indicadores consolidados de Consultas e Expedientes por período: totais, taxa de conclusão, tempo médio do fluxo, urgentes, distribuição por localidade, resumo por status, temporalidade em dias úteis e comparação com o período anterior. | [FEATURES_REFERENCE.md](./FEATURES_REFERENCE.md) |
| **Calendário de Vencimentos** | Prazos de Consultas, Expedientes e Parcerias num calendário. | [FEATURES_REFERENCE.md](./FEATURES_REFERENCE.md) |
| **Páginas personalizadas** | O órgão cria seus próprios tipos de registro (campos, fases, Kanban, lista e resumo) sem código. | [FEATURES_REFERENCE.md](./FEATURES_REFERENCE.md) |
| **Processo Eletrônico** | Processo eletrônico com ritos configuráveis (fases, ações, saídas condicionais, permissões e efeitos), biblioteca de 55 modelos de rito (todos com painel e planilha de acompanhamento opcionais), autuação, editor de documentos, assinatura, juntada com paginação, prazos, comunicações às partes, audiências, sessões de julgamento e reuniões de colegiado, disputa de preços, portal das partes, PDF com código de verificação e pacote para levar ritos e modelos a outro órgão. Liberado pelo admin do órgão. | [PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md) |

Jurimetria e Panorama são **opcionais**: só aparecem quando o super-admin liga
as flags `jurimetria_enabled` / `panorama_enabled` **e** o órgão ativa o módulo.
Os demais módulos estão integrados ao produto.

---

## 5. Páginas da aplicação

| Rota | Página |
|---|---|
| `/` e `/Landing` | Apresentação e login com Google. |
| `/Dashboard` | Painel inicial do usuário, com KPIs e atividades de todos os seus órgãos. |
| `/Organization?id=…&tab=…` | Página do órgão; a aba ativa fica na URL (`tab=kanban`, `processes`, `parcerias`, `admin` etc.). |
| `/Profile` | Perfil do usuário (nome, função, e-mail de notificação, preferências). |
| `/ProcessoEletronico?org=…` | Processo Eletrônico do órgão (processos, documentos, prazos, sessões). O endereço antigo `/Secretaria` redireciona. |
| `/MeusProcessosEletronicos` | Processos eletrônicos de todos os órgãos em que a pessoa trabalha. |
| `/Portal` | Portal das partes e advogados (login Google ou e-mail e senha). |
| `/Disputas` | Disputas de preços do fornecedor: convite, aviso, proposta, sala de lances e resultado. |
| `/Conferir` | Conferência pública de documento pelo código de verificação. |
| `/Admin` | Administração da plataforma (somente super-admin). |
| `/Help`, `/Terms` | Central de ajuda e Termos de Uso. |

---

## 6. Situação atual e limites conhecidos

O SIGO roda em produção num projeto Firebase (Google Cloud) mantido pela equipe
do CAOCIPP, com login por conta Google. **Não é, ainda, um sistema homologado
pela TI do MPRS**: não usa o login institucional, a hospedagem institucional
nem integra com os sistemas oficiais (os números de processo, PGEA e
expedientes são digitados ou importados por planilha).

Outros limites que valem para quem chega agora:

- Os testes automatizados cobrem o motor de ritos (`src/lib`) e as
  Functions da Secretaria (`functions-v2/test`) e rodam no CI junto com lint, tipos e build.
  O teste de ponta a ponta nos emuladores (regras do Firestore, Secretaria) é
  rodado manualmente; ver [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md).
- Três rotinas agendadas (escalonamento automático de urgentes, resumo diário e
  relatório semanal por e-mail) estão **comentadas** em
  `functions-v2/src/index.ts` e não rodam em produção. A única agendada ativa é
  `checkPartnershipNoticeDeadlines` (avisos das Parcerias), além do alerta de
  prazos do Processo Eletrônico (`secretariaAlertaPrazos`).
- A marcação "Restrição de acesso" de uma Consulta é um **rótulo** que gera
  registro de auditoria ao abrir; ela não esconde o registro dos demais membros
  do órgão (ver [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md#3-lgpd-e-proteção-de-dados)).
