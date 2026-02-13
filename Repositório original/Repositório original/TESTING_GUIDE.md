# 🧪 Guia de Testes - Consultas CAO Firebase

**Objetivo:** Validar todas as funcionalidades da plataforma Consultas CAO migrada para Firebase

---

## 📋 Pré-requisitos

Antes de começar os testes:

- [x] Node.js instalado
- [x] Dependências instaladas (`npm install`)
- [x] Firebase rules mergidas e deployed
- [x] Servidor local rodando (`npm run dev`)
- [x] `localhost` adicionado aos authorized domains no Firebase Console

---

## 🔐 Teste 1: Autenticação

### 1.1 Login com Google

**Passos:**
1. Abra `http://localhost:5173`
2. Clique em "Continuar com Google"
3. Selecione sua conta Google
4. Aceite as permissões

**Resultado Esperado:**
- ✅ Popup do Google aparece
- ✅ Após autenticação, redireciona para `/Dashboard`
- ✅ Seu nome/email aparecem no header
- ✅ Foto de perfil carregada

**Se falhar:**
- Verifique se `localhost` está nos authorized domains
- Abra DevTools (F12) e veja erros no Console

---

### 1.2 Persistência de Sessão

**Passos:**
1. Após login bem-sucedido, feche o navegador
2. Abra novamente `http://localhost:5173`

**Resultado Esperado:**
- ✅ Você continua logado (vai direto pro Dashboard)
- ✅ Não precisa fazer login novamente

---

### 1.3 Logout

**Passos:**
1. Vá para `/Profile`
2. Clique em "Sair"

**Resultado Esperado:**
- ✅ Redireciona para Landing page
- ✅ Botão "Continuar com Google" visível novamente

---

## 🏢 Teste 2: Organizações

### 2.1 Criar Primeira Organização

**Passos:**
1. Faça login
2. Vá para `/Profile`
3. Clique em "Criar Organização"
4. Preencha:
   - Nome: "Teste Org 1"
   - Descrição: "Organização de teste"
5. Clique "Criar Organização"

**Resultado Esperado:**
- ✅ Toast de sucesso aparece
- ✅ Dialog fecha
- ✅ Nova organização aparece na lista
- ✅ Role = "Criador"
- ✅ Código de convite gerado (8 caracteres)

**Validar no Firestore:**
- Abra Firebase Console > Firestore
- Collection `organizations` tem 1 documento
- Collection `userOrganizations` tem 1 documento

---

### 2.2 Copiar Código de Convite

**Passos:**
1. Na lista de organizações em `/Profile`, clique em "Ver Detalhes"
2. Vá para tab "Informações Gerais"
3. Clique no ícone de copiar ao lado do código

**Resultado Esperado:**
- ✅ Toast "Código copiado" aparece
- ✅ Cole em um editor de texto para confirmar (Ctrl+V)

---

### 2.3 Entrar em Organização (Teste com 2º usuário)

> **Nota:** Este teste requer uma segunda conta Google

**Passos:**
1. Abra navegador em modo anônimo
2. Faça login com segunda conta Google
3. Vá para `/Profile`
4. Clique em "Entrar em Organização"
5. Cole o código de convite
6. Clique "Entrar"

**Resultado Esperado:**
- ✅ Toast de sucesso
- ✅ Organização aparece na lista
- ✅ Role = "Membro"

**Validar no Firestore:**
- `userOrganizations` tem 2 documentos
- `organizations/{orgId}/stats.members_count` = 2

---

## 📊 Teste 3: Dashboard

### 3.1 Visualizar KPIs

**Passos:**
1. Após criar organização, vá para `/Dashboard`

**Resultado Esperado:**
- ✅ Card "Total de Processos" = 0
- ✅ Card "Processos Urgentes" = 0
- ✅ Card "Meus Processos" = 0
- ✅ Card "Membros" = 1 (ou 2 se testou com 2º usuário)

---

## 📝 Teste 4: Processos

### 4.1 Criar Processo

**Passos:**
1. Vá para `/Organization` (ou clique na organização em Profile > Ver Detalhes)
2. Tab "Controle de Processos"
3. Clique "Adicionar Processo"
4. Preencha:
   - Nº Processo: "00001.001.001/2026"
   - Consulente: "João Silva"
   - Local: "Porto Alegre"
   - Data Entrada: "2026-02-05"
   - Matéria/Objeto: "Teste de processo administrativo"
   - Pedido de Urgência: ❌ (deixar desmarcado)
5. Clique "Criar Processo"

**Resultado Esperado:**
- ✅ Toast de sucesso
- ✅ Dialog fecha
- ✅ Processo aparece na tabela
- ✅ Status = "Em triagem" (padrão)
- ✅ Urgente = vazio

**Validar no Firestore:**
- Collection `processes` tem 1 documento
- `organization_id` = ID da sua org
- `created_by` = seu user ID

---

### 4.2 Editar Processo

**Passos:**
1. Na tabela de processos, clique no processo criado
2. Dialog de edição abre
3. Vá para tab "Fluxo de Trabalho"
4. Preencha:
   - Data de Distribuição: "2026-02-06"
   - Assessor Responsável: Selecione seu nome
   - Início da Análise: "2026-02-07"
   - Observações: "Processo em análise inicial"
5. Tab "Dados Básicos"
6. Ative "Pedido de Urgência"
7. Clique "Salvar Alterações"

**Resultado Esperado:**
- ✅ Toast de sucesso
- ✅ Dialog fecha
- ✅ Processo atualizado na tabela
- ✅ Coluna "Urgente" = "SIM"
- ✅ Coluna "Responsável" = seu nome

**Validar Dashboard:**
- Volte para `/Dashboard`
- "Processos Urgentes" = 1
- "Meus Processos" = 1

---

### 4.3 Filtrar Processos

**Passos:**
1. Crie mais 2 processos com dados diferentes
2. Marque um como urgente, outro não
3. Atribua responsáveis diferentes
4. Use os filtros:
   - Busca: Digite parte do número
   - Status: Selecione "Em triagem"
   - Responsável: Selecione seu nome

**Resultado Esperado:**
- ✅ Busca filtra corretamente
- ✅ Filtro de status funciona
- ✅ Filtro de responsável funciona
- ✅ Contador de processos atualiza

---

### 4.4 Deletar Processo

**Passos:**
1. Clique em um processo
2. No dialog de edição, clique "Excluir"
3. Confirme a exclusão

**Resultado Esperado:**
- ✅ Confirmação aparece
- ✅ Toast de sucesso
- ✅ Processo removido da tabela
- ✅ KPIs atualizados

**Validar no Firestore:**
- Documento removido de `processes`

---

## 👥 Teste 5: Membros

### 5.1 Visualizar Membros

**Passos:**
1. Vá para `/Organization`
2. Tab "Informações Gerais"
3. Role para baixo até "Membros"

**Resultado Esperado:**
- ✅ Sua conta aparece
- ✅ Role = "Criador"
- ✅ Data de Ingresso preenchida
- ✅ Se testou com 2º usuário, ele aparece como "Membro"

---

### 5.2 Editar Função de Membro (somente creator)

**Passos:**
1. Na tabela de membros, clique em "Definir função" de um membro
2. Digite "Assessor Jurídico"
3. Clique "Salvar"

**Resultado Esperado:**
- ✅ Toast de sucesso
- ✅ Função atualizada na tabela

---

### 5.3 Remover Membro (somente creator)

> Teste com 2º usuário primeiro (seção 2.3)

**Passos:**
1. Na tabela de membros, clique no ícone de lixeira do membro
2. (Creator não pode ser removido)

**Resultado Esperado:**
- ✅ Membro removido
- ✅ Toast de sucesso
- ✅ Contador de membros atualizado

---

## 📈 Teste 6: Resumos Inteligentes

### 6.1 Visualizar Analytics

**Passos:**
1. Crie pelo menos 5 processos com:
   - Diferentes locais
   - Diferentes responsáveis
   - Diferentes status
2. Vá para tab "Resumos Inteligentes"

**Resultado Esperado:**
- ✅ KPIs corretos:
  - Total de Processos
  - Taxa de Conclusão
  - Processos Urgentes
- ✅ Gráfico "Volume por Localidade" mostra barras
- ✅ "Performance por Responsável" mostra barras de progresso
- ✅ "Resumo por Status" mostra contadores

---

## 🔒 Teste 7: Segurança

### 7.1 Acesso sem Login

**Passos:**
1. Abra navegador em modo anônimo
2. Tente acessar `http://localhost:5173/Dashboard`

**Resultado Esperado:**
- ✅ Redirecionado para `/Landing`
- ✅ Não consegue ver dados

---

### 7.2 Acesso a Organização de Outro Usuário

> Requer 2 usuários e 2 organizações separadas

**Passos:**
1. Usuário A cria Org A
2. Usuário B cria Org B (não entra na Org A)
3. Usuário B tenta acessar processo da Org A via Firestore

**Resultado Esperado:**
- ✅ Firestore rules bloqueiam acesso
- ✅ "Missing or insufficient permissions"

**Validar:**
- Abra DevTools > Console
- Deve mostrar erro de permissão

---

## ✅ Checklist Final

Após completar todos os testes:

### Autenticação
- [ ] Login com Google
- [ ] Logout
- [ ] Persistência de sessão

### Organizações
- [ ] Criar organização
- [ ] Copiar código de convite
- [ ] Entrar via código (2º usuário)

### Dashboard
- [ ] KPIs corretos
- [ ] Gráficos carregam
- [ ] Seletor de organização (se múltiplas)

### Processos
- [ ] Criar processo
- [ ] Editar processo
- [ ] Deletar processo
- [ ] Filtrar por status
- [ ] Filtrar por responsável
- [ ] Buscar por texto
- [ ] Marcar urgência

### Membros
- [ ] Visualizar lista
- [ ] Editar função
- [ ] Remover membro

### Analytics
- [ ] KPIs corretos
- [ ] Gráficos funcionais

### Segurança
- [ ] Acesso bloqueado sem login
- [ ] Isolamento entre organizações

---

## 🐛 Reportar Bugs

Se encontrar problemas:

1. **Anote:**
   - O que você estava fazendo
   - O que esperava que acontecesse
   - O que realmente aconteceu

2. **Console do navegador (F12):**
   - Copie erros em vermelho

3. **Firestore (opcional):**
   - Verifique se dados foram salvos
   - Firebase Console > Firestore > Data

---

## 🎉 Sucesso!

Se todos os testes passarem, a migração está **100% funcional** e pronta para deploy em produção!

**Próximo passo:** Deploy no Firebase Hosting
```powershell
npm run build
firebase deploy --only hosting
```
