# Documentação do SIGO

Índice de toda a documentação de referência. Comece pela
[Visão geral](./VISAO_GERAL.md) se é a primeira vez que você vê o projeto.

---

## Entender a plataforma

| Documento | Conteúdo |
|---|---|
| [VISAO_GERAL.md](./VISAO_GERAL.md) | O que é o SIGO, que problema resolve, perfis de uso, módulos e limites atuais |
| [FEATURES_REFERENCE.md](./FEATURES_REFERENCE.md) | Funcionalidades comuns: órgãos, membros, Painel Administrativo, métricas, páginas personalizadas, automação, administração da plataforma, feature flags |
| [GLOSSARY.md](./GLOSSARY.md) | Termos de negócio, técnicos e siglas |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico das entregas |

## Módulos

| Documento | Módulo |
|---|---|
| [CONSULTAS.md](./CONSULTAS.md) | Consultas: fases, Kanban, campos, importação |
| [MATTER_CLASSIFICATION.md](./MATTER_CLASSIFICATION.md) | Classificação das Consultas por matéria |
| [EXPEDIENTES.md](./EXPEDIENTES.md) | Expedientes administrativos |
| [PARCERIAS.md](./PARCERIAS.md) | Convênios, Termos de Cooperação e de Fomento, aditivos, avisos, extinção |
| [JURIMETRIA.md](./JURIMETRIA.md) | Base de júris, importação, relatórios e exportação |
| [PANORAMA.md](./PANORAMA.md) | Bases analíticas de qualquer área a partir de planilhas |
| [PROCESSO_ELETRONICO.md](./PROCESSO_ELETRONICO.md) | Processo Eletrônico: processo eletrônico com ritos, unidades, documentos, assinatura, folhas, portal das partes e conferência pública |
| [LOGICA_PROCESSUAL.md](./LOGICA_PROCESSUAL.md) | Guia de domínio do Processo Eletrônico: ato do processo × trabalho interno, o que vai para os autos, o que a capa mostra. **Leia antes de mexer no módulo** |

## Técnica

| Documento | Conteúdo |
|---|---|
| [ARCHITECTURE_REFERENCE.md](./ARCHITECTURE_REFERENCE.md) | Tecnologias, estrutura do repositório, fluxo de dados, Cloud Functions, coleções, implantação |
| [SECURITY_REFERENCE.md](./SECURITY_REFERENCE.md) | Regras do Firestore, autenticação, autorização, LGPD, decisões de segurança por módulo |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Ambiente local, emuladores, convenções, verificação, deploy |
| [CI-DEPLOY-PERMISSIONS.md](./CI-DEPLOY-PERMISSIONS.md) | Permissões do Google Cloud exigidas pelo deploy automático |
| [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md) | Padrão visual atual (V2, minimalista) e como construir telas novas |
| [DESIGN_SYSTEM_REFERENCE.md](./DESIGN_SYSTEM_REFERENCE.md) | Padrão visual anterior (V1), que só volta a valer se a flag `frontend_v2` for desligada |

## Histórico

[historico/](./historico/README.md) guarda os guias da migração Base44 →
Firebase. Não descrevem o sistema atual.

---

## Ordem de leitura sugerida

- **Quem vai usar ou apresentar o SIGO:** Visão geral → documentos dos módulos.
- **Quem vai desenvolver:** Visão geral → Arquitetura → Guia de
  desenvolvimento → Segurança → documento do módulo que vai alterar.
- **Avaliação de segurança e LGPD:** Segurança (seções 2, 3 e 5) →
  Arquitetura (seção 5, coleções) → `firestore.rules`.

---

## Como manter

- A documentação descreve o que o código faz **hoje**. Ao mudar
  comportamento, dados, telas, permissões ou estrutura, atualize no mesmo PR o
  documento afetado e, se for uma entrega relevante, o
  [CHANGELOG.md](./CHANGELOG.md).
- Documento novo entra neste índice.
- Escreva em português, citando arquivos e campos reais (`caminho/arquivo.js`,
  `nome_do_campo`), para que o leitor possa conferir no código.
