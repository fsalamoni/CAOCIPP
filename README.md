# SIGO — Sistema Interno de Gestão Operacional

Plataforma web de gestão de processos, procedimentos e dados para unidades do
**Ministério Público do Estado do Rio Grande do Sul (MPRS)**. Criada no
CAOCIPP para substituir as planilhas individuais de controle por uma gestão
integrada: cada demanda com fases, responsável, prazos, histórico e métricas,
visível para toda a unidade.

**Aplicação:** <https://sigo-caocipp.web.app> (o endereço antigo
`consultascao.web.app` redireciona para lá).

---

## O que a plataforma oferece

Cada unidade cria um **órgão** no SIGO, convida seus membros e liga os módulos
de que precisa:

| Módulo | Para quê |
|---|---|
| **Consultas** | Consultas jurídicas: entrada, distribuição, análise, revisão e arquivamento, com classificação por matéria. |
| **Expedientes** | Expedientes administrativos, com fluxo e listas próprios. |
| **Parcerias** | Convênios, Termos de Cooperação e de Fomento, com aditivos e avisos automáticos de renovação. |
| **Jurimetria** *(opcional)* | Base de júris com relatórios e exportações, incorporada do aplicativo do CAOJúri. |
| **Panorama** *(opcional)* | Transforma qualquer planilha em painel e relatórios, sem programação. |
| **Resumos, métricas e calendário** | Indicadores configuráveis, temporalidade em dias úteis, calendário de vencimentos. |
| **Páginas personalizadas** | O órgão cria seus próprios tipos de registro, com campos e fases. |
| **Secretaria Processual** *(opcional)* | Processo eletrônico com ritos configuráveis: autuação, editor de documentos, assinatura, prazos, portal das partes e PDF com verificação. |

As fases são **derivadas dos dados preenchidos** e todos os cálculos são regras
auditáveis no código: **nenhuma funcionalidade usa inteligência artificial**.

---

## Documentação

Tudo está em [`docs/`](./docs/README.md). Para começar:

- [Visão geral](./docs/VISAO_GERAL.md) — o que é, para quem, módulos e limites atuais
- [Funcionalidades](./docs/FEATURES_REFERENCE.md) — órgãos, membros, administração, métricas, automação
- Módulos: [Consultas](./docs/CONSULTAS.md) · [Expedientes](./docs/EXPEDIENTES.md) · [Parcerias](./docs/PARCERIAS.md) · [Jurimetria](./docs/JURIMETRIA.md) · [Panorama](./docs/PANORAMA.md) · [Secretaria Processual](./docs/SECRETARIA.md)
- [Arquitetura](./docs/ARCHITECTURE_REFERENCE.md) · [Segurança e LGPD](./docs/SECURITY_REFERENCE.md) · [Guia de desenvolvimento](./docs/DEVELOPMENT_GUIDE.md)
- [Glossário](./docs/GLOSSARY.md) · [Histórico de mudanças](./docs/CHANGELOG.md)

---

## Tecnologias

React 18 + Vite · Tailwind CSS + shadcn/ui · Firebase Authentication (Google)
· Cloud Firestore · Cloud Functions v2 (Node 22, TypeScript, região São Paulo)
· Firebase Hosting · GitHub Actions.

---

## Rodando localmente

Requer Node.js 22.

```bash
git clone https://github.com/fsalamoni/CAOCIPP.git
cd CAOCIPP
npm install
npm --prefix functions-v2 install
npm run dev
```

> Sem um `.env` próprio, o app se conecta ao **projeto de produção**. Para
> trabalhar com uma base isolada, use os emuladores do Firebase — passo a passo
> no [Guia de desenvolvimento](./docs/DEVELOPMENT_GUIDE.md).

Antes de abrir um pull request, rode o mesmo que o CI:

```bash
npm run lint && npm run typecheck && npm --prefix functions-v2 run build:local
npm --prefix functions-v2 test && npm run test:lib && npm run test:rules && npm run build
```

---

## Publicação

Pull requests para `main` passam pelo CI (lint, verificação de tipos, testes e build).
O merge em `main` publica automaticamente hosting, Cloud Functions, regras e
índices do Firestore no projeto Firebase. Detalhes, segredos e permissões em
[DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md#6-deploy).

---

## Estrutura

```
src/            Aplicação React (páginas, módulos, motores de cálculo)
functions-v2/   Cloud Functions (src/ em TypeScript, lib/ compilado)
firestore.rules Regras de segurança do banco
docs/           Documentação
```

Pastas como `functions/`, `Repositório original/` e `.agent/` são legado ou
ferramentas de desenvolvimento e não entram no deploy (ver
[Arquitetura](./docs/ARCHITECTURE_REFERENCE.md#pastas-legadas)).

---

## Situação

Em produção, num projeto Firebase mantido pela equipe do CAOCIPP, com login
por conta Google. Ainda não é um sistema homologado pela TI do MPRS. Os limites
conhecidos estão na [Visão geral](./docs/VISAO_GERAL.md#6-situação-atual-e-limites-conhecidos).

Mantenedor: **Flávio Salomone** ([@fsalamoni](https://github.com/fsalamoni)).
Projeto proprietário, sem licença de uso aberta.
