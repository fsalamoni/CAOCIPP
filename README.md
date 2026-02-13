# Consultas CAO (Version 1.11.1)

Sistema de gestão de processos para o Centro de Apoio Operacional.

## 🚀 Tecnologias

- **Frontend**: React 18 + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Firebase (Auth + Firestore + Cloud Functions v2)
- **Deploy**: Firebase Hosting → [consultascao.web.app](https://consultascao.web.app)

## 📋 Funcionalidades

- ✅ Autenticação com Google (Firebase Auth)
- ✅ Gerenciamento de organizações
- ✅ Sistema de membros com roles
- ✅ Tracking de processos
- ✅ Importação de processos via Excel/CSV/JSON
- ✅ Dashboard com estatísticas
- ✅ Sistema de status automatizado
- ✅ Auditoria de Paridade de Dados (100% visibilidade DB ↔ UI)
- ✅ Tratamento resiliente de dados históricos e assessores legados
- ✅ Sincronização em tempo real (onSnapshot)
- ✅ Hover inteligente e uniforme em colunas fixas

## 🛠️ Setup Local

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Firebase

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/fsalamoni/Consultas-CAO.git
cd Consultas-CAO

# 2. Instale dependências do frontend
npm install

# 3. Instale dependências das Cloud Functions
cd functions-v2
npm install
cd ..

# 4. Configure variáveis de ambiente
# Crie .env na raiz com suas credenciais Firebase
cp .env.example .env
# Edite .env com suas configurações

# 5. Inicie o servidor de desenvolvimento
npm run dev
```

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_auth_domain
VITE_FIREBASE_PROJECT_ID=seu_project_id
VITE_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

## 🔥 Firebase Setup

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative Authentication (Google provider)
3. Crie banco Firestore (modo production)
4. Deploy dos índices:
   ```bash
   npx firebase deploy --only firestore:indexes
   ```
5. Deploy das Cloud Functions:
   ```bash
   cd functions-v2
   npm run build
   npx firebase deploy --only functions
   ```

## 📦 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build
npm run lint         # Lint do código
```

## 🌿 Workflow de Branches

```
main           ← Produção (código estável)
development    ← Desenvolvimento ativo
feature/*      ← Features específicas
```

**Fluxo de trabalho**:
1. Trabalhe no branch `development`
2. Teste completamente
3. Merge para `main` quando estável
4. Deploy a partir de `main`

## 📁 Estrutura do Projeto

```
Consultas-CAO/
├── src/
│   ├── components/     # Componentes React
│   │   ├── organization/  # Componentes de organização
│   │   └── ui/            # Componentes UI (shadcn)
│   ├── pages/          # Páginas principais
│   ├── hooks/          # Custom hooks
│   ├── services/       # Serviços (Firestore, Functions)
│   ├── config/         # Configurações
│   └── lib/            # Utilidades
├── functions-v2/       # Cloud Functions (TypeScript)
│   └── src/
│       ├── organizations/  # Funções de organização
│       ├── processes/      # Funções de processos
│       └── import/         # Importação de dados
├── firebase.json       # Config Firebase
├── firestore.rules     # Regras de segurança
└── firestore.indexes.json  # Índices Firestore
```

## 🔐 Segurança

- Nunca commite arquivos `.env`
- Nunca commite `serviceAccountKey.json`
- Revise `firestore.rules` regularmente
- Use roles de membros para controlar acessos

## 🐛 Troubleshooting

### Membros não aparecem
- Aguarde 2-3 minutos após deploy dos índices
- Verifique se índices foram criados: `npx firebase firestore:indexes`

### ImportarProcessos falha
- Limite de 5MB por arquivo
- Formatos aceitos: .xlsx, .xls, .csv, .json
- Verifique colunas: Número, Consulente, Local, Data Entrada, Objeto

## 📝 Atualizações Recentes

### 13/02/2026 - Correção de Lógica Temporal (v1.11.1)
- **Ajuste de Marcos Temporais**: A métrica de análise agora é calculada corretamente a partir da **Distribuição** até a **Remessa**.
- **Descritivos Exatos**: Atualização dos subtextos das métricas para as definições operacionais precisas solicitadas (Entrada->Devolução, Distribuição->Remessa, Remessa->Devolução).

### 13/02/2026 - Precisão Temporal (Dias Úteis) (v1.11.0)
- **Cálculo de Dias Úteis**: As médias de temporalidade agora consideram apenas dias úteis (segunda a sexta), proporcionando uma visão mais realista do desempenho.
- **Arredondamento Conservador**: Todas as médias são agora arredondadas para cima (Math.ceil), garantindo que tempos parciais sejam contabilizados como dias inteiros de trabalho.
- **Identificação Visual**: Título do quadro atualizado para "Temporalidade das Consultas (dias úteis)".

### 13/02/2026 - Métricas de Temporalidade & Terminology Fix (v1.10.0)

### 13/02/2026 - Métricas de Temporalidade & Terminology Fix (v1.10.0)
- **Quadro de Temporalidade**: Novo componente modular na aba de Resumos Inteligentes exibindo médias de:
    - Tempo total (Entrada → Devolução)
    - Tempo de Análise (Início → Remessa)
    - Tempo de Revisão (Remessa → Devolução)
- **Padronização de Termos**: Substituição global de "Retorno da Revisão" por **"Devolução após revisão"** para alinhamento com os fluxos originais de trabalho.
- **Importação Robusta**: Mapeador de Excel atualizado para detectar automaticamente variações do novo termo ("DEVOLUÇÃO APÓS REVISÃO", "RETORNO DA REVISÃO", etc).

### 12/02/2026 - Persistência, Real-time & UI Premium (v1.8.9)
- **Correção de Persistência**: Alinhamento definitivo de campos (snake_case/camelCase) entre Frontend e Cloud Functions.
- **Real-time Synchronization**: Listagem de processos agora utiliza `onSnapshot` para atualizações instantâneas.
- **UI Hover Consistente**: Refinamento visual com `group-hover` estático para garantir destaque uniforme em colunas fixas.
- **Service Layer Robustness**: Padronização dos serviços de Deletar e Arquivar com contexto organizacional.

### 12/02/2026 - Dashboard User-Centric & Multi-Filter (v1.5.0)
- **Dashboard v2**: Interface per-organ automatizada, exibindo apenas o que é relevante para sua função atual.
- **Lógica de Roles**: Assessoria, Secretaria e Decisória agora possuem KPIs e feeds de atividade distintos.
- **Filtro Avançado**: Implementado seletor de Ano e Mês nos Resumos Inteligentes para análise histórica precisa.
- **Filtro de Ano por Órgão**: Controle temporal individualizado para cada card do Dashboard.
- **Rebranding Final**: Nome oficial consolidado em todo o ecossistema como **Consultas CAO**.

### 12/02/2026 - UX Pro Max & Zero Problems (v1.4.0)
- **Zero Problems (IDE)**: Otimização total do ambiente de desenvolvimento (jsconfig.json) para eliminar falsos-positivos de tipos.
- **Filtros Dinâmicos**: O filtro de "Responsável" agora é extraído automaticamente dos dados da planilha.
- **UX Improvements**: Implementação de Loading Skeletons modernos e estados vazios interativos.
- **Limpeza de Build**: Resolução de 100% dos avisos de ESLint e erros de parsing.

### 12/02/2026 - Persistência Definitiva & Novo Domínio (v1.3.0)
- **Novo URL**: Aplicação migrada para [consultascao.web.app](https://consultascao.web.app)
- **Persistência Bulletproof**: Itens por página e ordenação agora usam localStorage como cache instantâneo + Firestore como backup.
- **Ordenação Type-Aware**: Registro de tipos por coluna com parser universal de datas.

## 📝 Licença

Este projeto é proprietário do Consultas CAO.

## 👤 Autor

**Flávio Salamoni** (@fsalamoni)

---

**Status do Projeto**: ✅ Estável / Versão 1.11.1 (Correção Lógica Temporal) — 13/02/2026
