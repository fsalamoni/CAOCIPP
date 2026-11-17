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
| Órgãos e pessoas | Órgãos | Para ver todos os órgãos e excluir um (pede o nome exato). |
| Órgãos e pessoas | Usuários | Para ver quem usa o SIGO e em que órgãos. |
| Órgãos e pessoas | Administradores da plataforma | Para dar ou tirar o acesso a esta página. |
| Módulos | Processo Eletrônico | Para ver os órgãos com Processo Eletrônico e suspender ou reativar o módulo de um órgão. |
| Operação e diagnóstico | Movimentações | Para saber quem fez o quê, filtrando por órgão ou ação. |
| Operação e diagnóstico | Saúde do sistema | Quando algo parecer errado: banco, atividade das últimas 24 h e erros. |
| Operação e diagnóstico | Cotas e limites | Para gravar limites. Atenção: hoje são só registrados, nenhum é aplicado. |
| Dados e custos | Armazenamento | Para ver o espaço que cada coleção ocupa. |
| Dados e custos | Ferramentas de dados | Para conferir e recalcular contadores ou migrar o histórico. |
| Dados e custos | Custos | Para ver o gasto por serviço (exige a exportação do faturamento). |

## O que vem a seguir

O plano de evolução do painel tem 10 etapas (fichas de órgão e de usuário,
identidade visual, avisos e modo manutenção, segurança, diagnóstico, dados e
custos). Este guia cresce a cada etapa entregue e descreve só o que já existe.
