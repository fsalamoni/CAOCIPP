# 🎨 Consultas CAO - Design System V2 (Minimalista)

**Version:** 1.1.0
**Last Updated:** 2026-07-09
**Status:** Opt-in (feature flag `frontend_v2`, default OFF)
**Purpose:** Padrão visual oficial para novas telas e evolução da plataforma

---

## O que é isto

Este documento descreve o **novo padrão visual** da Consultas CAO: tipografia
IBM Plex, paleta neutra quente + navy, cantos e sombras suaves, sem
gradientes. É o resultado da proposta de redesign entregue em
`Proposta de redesign frontend minimalista.zip` (protótipo `.dc.html`),
convertido em tokens de design reais e aplicado à plataforma.

**Ele é 100% opt-in.** Nada muda para ninguém até que um administrador de
plataforma ligue a chave **"Novo design (V2)"** em
**Administração da Plataforma → Funcionalidades → Aparência**. Desligada,
o sistema é pixel-a-pixel idêntico ao que já existe hoje.

Esse é também o **padrão a ser seguido em todas as novas telas, modais e
funcionalidades daqui em diante** — mesmo enquanto o V2 estiver desligado
por padrão. Ver [Como construir novas telas](#como-construir-novas-telas-compatíveis-com-o-v2)
abaixo.

---

## Como funciona (arquitetura)

O V2 é implementado como uma **troca de tema puramente visual (CSS)**, sem
nenhuma lógica de negócio, rota, componente ou dado alterado:

```
src/constants/featureFlags.js   → declara a flag FRONTEND_V2 (key: frontend_v2)
src/lib/ThemeV2.jsx             → observa a flag e alterna a classe `theme-v2`
                                   na tag <html> (+ carrega as fontes IBM Plex)
src/styles/theme-v2.css         → todo o tema: variáveis + overrides, só tem
                                   efeito dentro de `html.theme-v2 { ... }`
src/index.css                   → importa theme-v2.css
```

1. `FeatureFlagsPanel` (Admin → Funcionalidades) lê/grava a flag em
   `platformConfig/featureFlags` no Firestore, exatamente como qualquer
   outra flag do catálogo (`src/constants/featureFlags.js`).
2. `ThemeV2Effect` (montado uma vez em `App.jsx`, dentro do
   `FeatureFlagsProvider`) escuta `useFlag('frontend_v2')` e:
   - Adiciona/remove a classe `theme-v2` em `document.documentElement`.
   - Injeta/remove os `<link>` das fontes Google (IBM Plex Sans/Mono) —
     só baixa a fonte para quem realmente ativa o V2.
3. `src/styles/theme-v2.css` contém **todas** as regras visuais, todas
   escopadas dentro de `html.theme-v2 { ... }`. Sem a classe, o arquivo não
   tem efeito nenhum.

**Por que CSS puro, e não reescrever cada página?** Porque a plataforma já
usa o padrão shadcn/ui (`src/components/ui/*`), onde os componentes
compartilhados (Button, Card, Dialog, Badge, Switch, Tabs, Table, Input,
Select...) já consomem **variáveis** (`bg-primary`, `bg-card`,
`text-foreground`, `border-border`, `bg-sidebar`...). Ao trocar o valor
dessas variáveis dentro de `.theme-v2`, todo componente que já segue o
padrão é retemado automaticamente — sem tocar em nenhuma linha de JSX.
Para os pontos que ainda usam cores Tailwind fixas (`bg-slate-50`,
`text-indigo-600`, gradientes etc.), o mesmo arquivo remapeia essas
classes especificamente (ver [Cobertura](#cobertura-e-limitações)).

---

## Tokens de design

### Cores (light, tema único)

| Token / uso | V1 (atual) | V2 (novo) | Hex V2 |
|---|---|---|---|
| `--background` (fundo da página) | branco puro | cinza-quente bem claro | `#FAFAF9` |
| `--foreground` (texto principal) | quase preto neutro | quase preto quente | `#18181B` |
| `--card` / `--popover` | branco | branco | `#FFFFFF` |
| `--primary` (marca, botões, links ativos) | preto (`#171717`) | navy | `#33495C` |
| `--primary` hover | — | navy escuro | `#283A49` |
| `--secondary` / `--muted` | cinza neutro | cinza-quente | `#F1F0ED` |
| `--muted-foreground` (texto secundário) | cinza neutro | cinza-quente | `#6B6B66` |
| `--accent` (hover suave, fundo de avatar) | cinza claro | azul-acinzentado claro | `#EAEEF1` |
| `--destructive` | vermelho vivo | vermelho escuro | `#991B1B` |
| `--border` | cinza claro | bege-acinzentado | `#E7E5E2` |
| `--input` (borda de campos) | cinza claro | bege médio | `#D8D5CF` |
| `--sidebar-*` | tema escuro/indigo | branco + navy | ver `theme-v2.css` |

Cores de **status de processo** (Pendente=âmbar, Em elaboração=azul, Em
revisão/Revisadas=violeta, Na pasta=esmeralda, Urgente=vermelho) **não
mudam** — o protótipo usa exatamente essa mesma paleta semântica, então
`src/config/processStatus.js` não precisa de nenhuma alteração.

### Tipografia

| Uso | Fonte |
|---|---|
| Texto geral | `IBM Plex Sans` (400/500/600/700) |
| Números, códigos, IDs de processo (`.font-mono`) | `IBM Plex Mono` (400/500/600) |

As fontes são carregadas via Google Fonts, apenas quando a flag está ligada
(`src/lib/ThemeV2.jsx`).

### Raio de borda e sombra

| Token | V1 | V2 |
|---|---|---|
| `--radius` | `0.5rem` (8px) | `0.625rem` (10px) |
| Sombra padrão | cinza-azulada, mais forte | tom neutro (`rgba(24,24,27,x)`), mais suave |
| Gradientes | usados em logo, avatar, nav ativo, CTAs | **nenhum** — tudo em cor sólida |

---

## Cobertura e limitações

O tema V2 cobre, **sem precisar editar nenhum componente**:

- Todos os primitivos de `src/components/ui/` (Button, Card, Dialog/Sheet
  — ou seja, **todos os modais** —, Badge, Switch, Tabs, Table, Input,
  Select, Alert, Popover, DropdownMenu, Avatar) porque já usam os tokens.
- Toda a casca do app (`src/Layout.jsx`): sidebar, topo, navegação, menu
  mobile — via remapeamento das classes `slate-*`/`indigo-*` que o layout
  usa hoje, incluindo o logo com texto em gradiente e o avatar do usuário.
- Tabelas/planilhas (`ProcessTable`, `ExpedienteTable`, spreadsheet
  import), Kanban (`KanbanBoard`, `KanbanCard`, colunas e cartões),
  formulários e diálogos de edição — via os mesmos remapeamentos.
- Painel administrativo completo (`Admin.jsx` e todos os painéis em
  `src/components/admin/`), incluindo o próprio painel de Funcionalidades.

**Limitações conhecidas (aceitas conscientemente):**

1. **Cobertura de utilitárias Tailwind fixas é por lista, não 100%
   exaustiva.** `theme-v2.css` remapeia as classes `slate-*`/`indigo-*` e
   combinações de gradiente **efetivamente usadas hoje** no código (checado
   via grep em toda a `src/`). Se uma tela nova introduzir uma cor fixa
   ainda não coberta (ex.: `bg-cyan-600`), ela não muda de cor sob V2 até
   alguém adicionar a regra correspondente em `theme-v2.css` — não quebra
   nada, só não reestiliza aquele ponto específico. Ver
   [Como estender o tema](#como-estender-o-tema).
2. **V2 não tem par claro/escuro.** Ele é um tema completo (claro), e tem
   prioridade sobre o modo escuro (`.dark`) caso ambos estejam ativos ao
   mesmo tempo — não é uma variante do dark mode.
3. **Cuidado com seletores de elemento fora de `@layer`.** Ver a nota
   técnica abaixo — é a armadilha mais fácil de cair ao estender este
   arquivo.

### ⚠️ Nota técnica importante: `@layer` e especificidade

`theme-v2.css` **não** está dentro de nenhum `@layer` do Tailwind. Isso é
proposital: por regra de cascata do CSS, **declarações fora de `@layer`
sempre vencem declarações dentro de `@layer` (como as utilitárias do
Tailwind), independentemente da especificidade do seletor.** É assim que
uma regra simples como `.bg-slate-50 { background-color: #FAFAF9; }`
consegue sobrescrever a utilitária `.bg-slate-50` do Tailwind de forma
previsível.

**A armadilha:** um seletor de **elemento genérico** (`a { }`, `button { }`,
`h1 { }`) escrito aqui vence **qualquer** utilitária Tailwind de cor/fonte
aplicada àquele elemento em qualquer lugar do app — mesmo que a utilitária
tenha especificidade maior. Já removemos duas regras assim durante a
implementação porque quebravam texto branco em botões/links ativos
(`text-white` sobre fundo navy virava texto navy sobre navy = invisível).

**Regra prática ao editar `theme-v2.css`:** prefira sempre seletores de
**classe** (`.bg-slate-50`, `.text-indigo-600`) em vez de seletores de
**elemento** (`a`, `button`, `h1`). Se precisar mesmo de um seletor de
elemento, confirme por grep que nenhuma tela combina aquele elemento com
uma utilitária de cor/fonte que você não quer sobrescrever.

---

## Componentes estruturais V2 (além do CSS)

A partir da v1.1.0, algumas telas de alto impacto ganharam uma **segunda
variante de estrutura/layout** (não só cor), também 100% condicionada a
`useFlag(FEATURE_FLAGS.FRONTEND_V2.key)` — o caminho V1 permanece
byte-a-byte o mesmo no código, só não é executado quando a flag está ligada.

### Sidebar colapsável (`src/Layout.jsx`)

No V2, a barra lateral pode ser recolhida para uma trilha de **76px** só
com ícones (botão de recolher/expandir no rodapé do menu, com tooltip em
cada ícone mostrando o rótulo). A preferência fica salva em
`localStorage` (`caocipp_sidebar_collapsed`) e é por navegador, não por
conta. Sub-navegação do órgão fica oculta quando colapsada (mesmo
comportamento do protótipo). No mobile, a barra sempre abre expandida
(o botão de colapsar só aparece em telas `lg:` ou maiores).

### Linhas de tabela limpas (`ProcessTable.jsx`, `ExpedienteTable.jsx`)

No V1, a linha inteira é pintada com a cor do status (estilo planilha
Excel). No V2, a linha volta a ser branca/neutra e o status é indicado só
por uma **borda de acento à esquerda** (4px, mesma paleta das colunas do
Kanban) — mais fácil de escanear uma lista longa. Essa variante vive em
`statusConfig[status].rowV2` (`src/config/processStatus.js`), ao lado da
`row` (V1) já existente. Ao adicionar um novo status, adicione as duas
variantes.

### Gráficos: `MinimalBarList` (`src/components/ui/MinimalBarList.jsx`)

Para distribuições (por localidade, origem, status), o V2 troca o
`BarChart`/`PieChart` do recharts (eixos, tooltip, legenda) por uma lista
horizontal simples: rótulo + barra fina + valor — o mesmo padrão do
protótipo, mais rápido de ler que um gráfico com eixos. Use este
componente para qualquer nova distribuição adicionada em painéis/resumos:

```jsx
import MinimalBarList from '@/components/ui/MinimalBarList';

<MinimalBarList data={rows} valueKey="count" colorKey="barColor" />
// rows: [{ name, count, barColor?: 'bg-emerald-500' }, ...]
// colorKey é opcional — sem ele, todas as barras usam bg-primary (navy).
```

Ícones de KPI com fundo em gradiente (`bg-gradient-to-br ${cor}`) também
precisam de uma cor sólida equivalente no V2 — o tema V2 zera
`background-image` de qualquer gradiente, então um ícone gradiente sem
fallback sólido fica com fundo transparente/invisível. Veja o mapa
`V2_ICON_COLOR` em `IntelligentSummary.jsx` como referência.

### Navegação entre abas em página: `OrgTabBar` (`src/components/organization/OrgTabBar.jsx`)

Como a sidebar colapsada esconde o sub-menu do órgão, a página de Órgão
ganhou, no V2, uma barra de abas dentro do próprio conteúdo (logo abaixo
do card de cabeçalho), para que a navegação entre Informações Gerais,
Painel de Consultas, Consultas, Expedientes, Resumos e Administração
continue possível com a sidebar em modo ícone.

O layout usa CSS Grid (`grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`)
em vez de uma lista simples ou de rolagem horizontal: os itens se
distribuem igualmente pela largura disponível e quebram para uma nova
linha sozinhos quando não cabem mais — se adapta ao número de abas
(varia de 3 a 8+ conforme os módulos habilitados e páginas
personalizadas do órgão) e a qualquer largura de tela, sem esconder
nenhuma opção atrás de scroll. Use o mesmo padrão para qualquer nova
barra de navegação cuja quantidade de itens seja variável:

```jsx
import OrgTabBar from '@/components/organization/OrgTabBar';

<OrgTabBar tabs={tabs} activeTab={activeTab} orgId={orgId} />
// tabs: [{ key, label, icon }, ...] — mesma forma de getOrganizationTabs()
```

---

## Como construir novas telas compatíveis com o V2

A partir de agora, ao criar uma nova página, modal, tabela ou componente:

1. **Prefira os componentes de `src/components/ui/`** (Button, Card,
   Dialog, Table, Badge, Tabs, Select, Input...) em vez de `<div>`/`<button>`
   soltos com classes manuais. Eles já são retemados automaticamente.
2. **Use as classes semânticas do Tailwind**, não cores fixas:

   | Em vez de... | Use |
   |---|---|
   | `bg-white`, `bg-slate-50` | `bg-background` / `bg-card` |
   | `text-slate-900` | `text-foreground` |
   | `text-slate-500`, `text-slate-400` | `text-muted-foreground` |
   | `border-slate-200` | `border-border` |
   | `bg-indigo-600`, `text-indigo-600` | `bg-primary` / `text-primary` |
   | `bg-indigo-50` | `bg-accent` |

   Essas classes já resolvem para os tokens corretos em V1 **e** em V2, sem
   precisar de nenhum ajuste futuro.
3. **Não use gradientes** em elementos novos (logo, avatar, botão, estado
   ativo). O padrão V2 é flat/sólido. Se um gradiente for realmente
   necessário, ele não será neutralizado automaticamente pelo tema V2.
4. **Use `.font-mono`** para números de processo, códigos, IDs e outros
   identificadores — no V2 eles aparecem em IBM Plex Mono, reforçando a
   escaneabilidade dos dados (como no protótipo original).
5. **Se ainda assim precisar de uma cor Tailwind fixa** (`bg-slate-100`,
   `text-indigo-700` etc., por exemplo em uma tela migrada de fora), tudo
   bem — é só o padrão de hoje. Adicione a regra equivalente em
   `src/styles/theme-v2.css` (seguindo os blocos 3/4 já existentes) para
   que a tela também acompanhe o V2. Não é obrigatório para a tela
   funcionar, apenas para ela ficar visualmente consistente sob V2.

---

## Como estender o tema

Ao introduzir uma nova classe de cor fixa que ainda não está coberta:

1. Abra `src/styles/theme-v2.css`.
2. Localize a seção correspondente (3 = neutros/slate, 4 = marca/indigo,
   5 = gradientes, 6 = raio, 7 = sombra, 8 = focus ring).
3. Adicione uma regra `html.theme-v2 .sua-classe { propriedade: valor; }`
   usando os hex da tabela de tokens acima como referência de paleta.
4. **Sempre use seletor de classe**, nunca de elemento solto (ver nota de
   `@layer` acima).
5. Rode `npm run build` e confirme visualmente (ver
   [Como testar localmente](#como-testar-localmente)).

---

## Como testar localmente

Sem alterar a flag em produção, dá para visualizar o V2 no navegador:

```js
// Console do navegador, com o app já carregado:
document.documentElement.classList.add('theme-v2');
```

Isso ativa todo o CSS do tema instantaneamente (as fontes IBM Plex não
serão carregadas por esse atalho manual — para isso, ligue a flag de
verdade em Admin → Funcionalidades, que já cuida de injetar as fontes).

**Checklist de QA ao mexer em `theme-v2.css`:**

- [ ] `npm run lint` e `npm run build` sem erros.
- [ ] Com a flag desligada (padrão), a tela está pixel-a-pixel igual à
      versão atual (nenhuma classe `theme-v2` presente).
- [ ] Com a flag ligada: sidebar, topo, kanban, tabelas, modais e o
      próprio painel de Funcionalidades exibem o navy/paleta neutra.
- [ ] Textos brancos sobre fundo navy (nav ativo, botões primários,
      badges) continuam legíveis — este é o ponto que mais quebra
      silenciosamente (ver nota de `@layer`).
- [ ] Sem erros no console do navegador.

---

## Referências

- Protótipo original: `Proposta de redesign frontend minimalista.zip`
  (raiz do repositório) — arquivo `.dc.html` com o prazo completo de telas:
  landing, dashboard, órgão (info/kanban/consultas/resumos/admin), perfil,
  administração da plataforma.
- Catálogo de flags: `src/constants/featureFlags.js`
- Efeito de tema: `src/lib/ThemeV2.jsx`
- Folha de estilo do tema: `src/styles/theme-v2.css`
- Design system atual (V1): [`DESIGN_SYSTEM_REFERENCE.md`](./DESIGN_SYSTEM_REFERENCE.md)
