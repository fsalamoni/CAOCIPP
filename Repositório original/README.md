# Consultas CAO (Version 1.3.0)

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

`` `
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

### 12/02/2026 - Persistência Definitiva & Novo Domínio (v1.3.0)
- **Novo URL**: Aplicação migrada para [consultascao.web.app](https://consultascao.web.app)
- **Persistência Bulletproof**: Itens por página e ordenação agora usam localStorage como cache instantâneo + Firestore como backup. Valores persistem em recarregamento, navegação entre abas e reabertura do navegador.
- **Ordenação Type-Aware**: Registro de tipos por coluna com parser universal de datas (Firestore Timestamps, Date objects, ISO strings, dd/mm/yyyy).

### Fevereiro de 2026 - Auditoria e Refinamento de UX (Round 9)
- **Persistence Per-User**: O sistema agora salva configurações de ordenação e página atual por usuário no Firestore. Ao retornar à aplicação, sua visão estará exatamente como você a deixou.
- **Filtragem por Período Flexível (De/Até)**: Todos os filtros de data agora suportam intervalos. É possível filtrar processos por uma data única (preenchendo apenas "De") ou por um período completo (preenchendo "De" e "Até").
- **Ordenação Natural**: O número do processo segue agora uma ordenação numérica inteligente (SIM 1, SIM 2, SIM 10).
- **Auditoria de Paridade de Dados**: Garantia de 100% de visibilidade DB ↔ UI:
    - **Normalização de Chaves**: Mapeamento agressivo de cabeçalhos do SIM (quebras de linha, espaços e termos legados).
    - **Assessor Responsável**: Lógica de resolução que preserva nomes mesmo sem ID vinculado, usando placeholders seguros.
    - **Remoção de Campos Obsoletos**: Simplificação do fluxo de trabalho conforme as regras de negócio atuais.

## 📝 Licença

Este projeto é proprietário do Consultas CAO.

## 👤 Autor

**Flávio Salamoni** (@fsalamoni)

---

**Status do Projeto**: ✅ Estável / Versão 1.3.0 (Persistência Definitiva & Novo Domínio) — 12/02/2026
