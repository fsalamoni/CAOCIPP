# Classificação de Matéria da Consulta

**Versão:** 1.0.0
**Definida em:** Fev/2026

Este documento define a taxonomia utilizada para classificar os processos/consultas no sistema CAOCIPP.

A classificação é hierárquica, composta por **Matéria Geral** e **Matéria Específica**.

---

## 1. Estrutura Hierárquica

### Proteção da moralidade e do patrimônio público
Focada em improbidade administrativa, licitações e atos lesivos ao erário.
- ACP / TAC / FRBL
- Agentes Públicos
- ANPC (Acordo de Não Persecução Cível)
- Anticorrupção
- Bens Públicos
- Concurso Público
- Controle da Administração Pública
- Emendas Parlamentares
- Improbidade Administrativa
- Intervenção do Ministério Público
- Licitações
- Publicidade (Promoção Pessoal)
- Procuradoria Municipal
- Serviço Público
- Outros (moralidade e patrimônio público)

### Cível
Focada em direito civil, família e registros.
- Contratos
- Família
- Registros Públicos
- Sucessões
- Outros (cível)

### Processual
Questões estritamente processuais ou de competência.
- Processo Civil
- Processo Administrativo

### Recuperação judicial e falência
*(Sem subcategorias definidas)*

### Matéria de outro CAO
*(Sem subcategorias definidas)*

---

## 2. Regras de Classificação Automática (Backfill)

O sistema possui uma rotina de classificação automática (executada em Fev/2026) que utiliza palavras-chave nos campos **Pasta na Rede** e **Objeto da Consulta**.

| Categoria | Subcategoria | Palavras-Chave (contém) |
|-----------|--------------|-------------------------|
| **Patrimônio Público** | ACP / TAC / FRBL | `acp`, `ação civil pública`, `tac`, `ajustamento de conduta`, `frbl`, `inquérito civil` |
| **Patrimônio Público** | Licitações | `licitação`, `pregão`, `concorrência`, `contrato administrativo`, `dispensa`, `inexigibilidade` |
| **Patrimônio Público** | Improbidade | `improbidade`, `enriquecimento ilícito`, `dano ao erário`, `prejuízo ao erário`, `violação aos princípios` |
| **Patrimônio Público** | Agentes Públicos | `servidor público`, `concurso`, `nomeação`, `desvio de função`, `acumulação`, `pad` |
| **Patrimônio Público** | Emendas | `emenda parlamentar` |
| **Patrimônio Público** | Bens Públicos | `bens públicos`, `imóvel público`, `desafetação`, `doação` |
| **Cível** | Família | `família`, `divórcio`, `guarda`, `alimentos`, `paternidade`, `união estável` |
| **Cível** | Sucessões | `inventário`, `herança`, `testamento`, `alvará` |
| **Cível** | Registros Públicos | `registro de imóveis`, `registro civil`, `retificação`, `usucapião`, `loteamento` |
| **Cível** | Contratos | `contrato`, `rescisão`, `inadimplemento` |
| **Processual** | Processo Civil | `conflito de competência`, `declínio de atribuição`, `competência` |

---

## 3. Implementação Técnica

- **Frontend Component:** `src/components/organization/MatterCategorySelect.jsx`
- **Valores/Listas:** Constantes `MATTER_CATEGORIES` e `MATTER_SUBCATEGORIES` exportadas pelo componente.
- **Banco de Dados:** Campos `matter_category` (string) e `matter_subcategory` (string) na coleção `processes`.
