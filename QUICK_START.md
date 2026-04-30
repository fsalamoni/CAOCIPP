# 🚀 Quick Start Guide - Consultas CAO Local Testing

## Passo 1: Verificar Pré-requisitos ✅

Você precisa ter instalado:
- ✅ Node.js 22+ 
- ✅ npm ou yarn

## Passo 2: Instalar Dependências

Execute no terminal (na pasta do projeto):

```powershell
npm install
```

Isso vai instalar o Firebase SDK e todas as dependências necessárias.

**Tempo estimado:** 2-3 minutos

---

## Passo 3: Configurar Firebase Rules (IMPORTANTE!)

### Opção A: Se NÃO houver conflito de nomes de coleções

Se suas outras plataformas no Firebase **NÃO** usam as coleções:
- `users`
- `organizations` 
- `userOrganizations`
- `processes`
- `auditLogs`
- `notifications`

**Faça isso:**

1. Baixe as rules atuais:
   ```powershell
   firebase firestore:rules:get > firestore.rules.backup
   ```

2. Abra o arquivo `firestore.rules` atual (do projeto)

3. Copie TODO o conteúdo de `firestore.rules.backup`

4. Cole ANTES das regras do Consultas CAO (que começam com `// ========== Consultas CAO PLATFORM RULES`)

5. Salve o arquivo

6. Deploy:
   ```powershell
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

### Opção B: Se HOUVER conflito (mais seguro)

Se você usa as mesmas coleções em outras plataformas, **renomeie as coleções do Consultas CAO**:

1. Abra `src/config/firebase.js`
2. No final do arquivo, adicione:

```javascript
// Collection names with namespace for Consultas CAO
export const COLLECTIONS = {
  USERS: 'caocipp_users',
  ORGANIZATIONS: 'caocipp_organizations',
  USER_ORGANIZATIONS: 'caocipp_userOrganizations',
  PROCESSES: 'caocipp_processes',
  AUDIT_LOGS: 'caocipp_auditLogs',
  NOTIFICATIONS: 'caocipp_notifications',
};
```

3. Atualize `firestore.rules` para usar os nomes prefixados
4. Deploy das rules

**⚠️ Se escolher Opção B, me avise para eu atualizar todos os hooks/services!**

---

## Passo 4: Login no Firebase CLI (se ainda não fez)

```powershell
firebase login
```

Isso vai abrir o navegador para autenticação.

---

## Passo 5: Iniciar Servidor de Desenvolvimento

```powershell
npm run dev
```

O servidor vai iniciar em: **http://localhost:5173**

---

## Passo 6: Testar Google Login

1. Abra http://localhost:5173
2. Clique em "Continuar com Google"
3. Escolha sua conta Google
4. Você será redirecionado para o Dashboard

### Possíveis Erros e Soluções:

**Erro: "Firebase: Error (auth/unauthorized-domain)"**
- **Solução:** No Firebase Console > Authentication > Settings > Authorized domains
- Adicione: `localhost`

**Erro: "Missing or insufficient permissions"**
- **Solução:** Deploy das rules não foi feito ainda
- Execute: `firebase deploy --only firestore:rules`

**Erro: "Index not found"**
- **Solução:** Indexes ainda estão sendo criados
- Aguarde 5-15 minutos
- Verifique status em: Firebase Console > Firestore > Indexes

---

## Checklist de Teste ✅

Após o servidor iniciar, teste:

- [ ] Landing page carrega
- [ ] Botão "Continuar com Google" aparece
- [ ] Login com Google funciona
- [ ] Após login, é redirecionado para Dashboard
- [ ] Console do navegador não mostra erros críticos

---

## Debugging

Se algo não funcionar:

1. **Abra DevTools (F12)**
2. Vá para aba **Console**
3. Procure por erros em vermelho
4. Me envie a mensagem de erro completa

---

## Próximos Passos (depois que login funcionar)

1. Criar primeira organização
2. Criar processo de teste
3. Testar Dashboard
4. Verificar que dados estão sendo salvos no Firestore

---

**Tempo total estimado: 10-15 minutos**

Qualquer problema, me avise com a mensagem de erro exata! 🚀
