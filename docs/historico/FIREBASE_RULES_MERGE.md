# 🔥 IMPORTANTE: Mesclando Security Rules com Projeto Existente

## ⚠️ ATENÇÃO

Seu projeto Firebase **Protagonista RPG** já possui outras plataformas rodando. As security rules do CAOCIPP **NÃO devem sobrescrever** as rules existentes.

---

## 📋 Estratégia de Mesclagem

### Opção A: Rules Separadas por Coleção (RECOMENDADO)

As rules do CAOCIPP afetam apenas estas 6 coleções:
- `users`
- `organizations`
- `userOrganizations`
- `processes`
- `auditLogs`
- `notifications`

**Como mesclar:**

1. **Baixe as rules atuais do Firebase:**
   ```powershell
   firebase firestore:rules:get > firestore.rules.current
   ```

2. **Edite `firestore.rules` para incluir AMBAS as plataformas:**

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       
       // ========== SUAS RULES EXISTENTES (outras plataformas) ==========
       // Cole aqui as rules da firestore.rules.current
       // ...
       
       // ========== CAOCIPP PLATFORM RULES (NOVAS) ==========
       
       // Helper functions para CAOCIPP
       function isAuthenticated() {
         return request.auth != null;
       }
       
       function isOwner(userId) {
         return request.auth.uid == userId;
       }
       
       function isMemberOf(orgId) {
         return exists(/databases/$(database)/documents/userOrganizations/$(request.auth.uid + '_' + orgId));
       }
       
       function getMembership(orgId) {
         return get(/databases/$(database)/documents/userOrganizations/$(request.auth.uid + '_' + orgId)).data;
       }
       
       function hasRole(orgId, allowedRoles) {
         let membership = getMembership(orgId);
         return membership.role in allowedRoles;
       }
       
       // Users (CAOCIPP)
       match /users/{userId} {
         allow read: if isAuthenticated();
         allow write: if isAuthenticated() && isOwner(userId);
       }
       
       // Organizations (CAOCIPP)
       match /organizations/{orgId} {
         allow read: if isAuthenticated() && isMemberOf(orgId);
         allow create: if isAuthenticated();
         allow update, delete: if isAuthenticated() && isMemberOf(orgId) && hasRole(orgId, ['creator', 'admin']);
       }
       
       // UserOrganizations (CAOCIPP)
       match /userOrganizations/{membershipId} {
         allow read: if isAuthenticated();
         allow create: if isAuthenticated();
         allow update, delete: if isAuthenticated() && (
           (isMemberOf(resource.data.organization_id) && hasRole(resource.data.organization_id, ['creator', 'admin'])) ||
           isOwner(resource.data.user_id)
         );
       }
       
       // Processes (CAOCIPP)
       match /processes/{processId} {
         allow read: if isAuthenticated() && isMemberOf(resource.data.organization_id);
         allow create: if isAuthenticated() && isMemberOf(request.resource.data.organization_id);
         allow update: if isAuthenticated() && isMemberOf(resource.data.organization_id) && (
           hasRole(resource.data.organization_id, ['creator', 'admin']) ||
           isOwner(resource.data.responsible_user_id)
         );
         allow delete: if isAuthenticated() && isMemberOf(resource.data.organization_id) &&
                         hasRole(resource.data.organization_id, ['creator', 'admin']);
       }
       
       // AuditLogs (CAOCIPP)
       match /auditLogs/{logId} {
         allow read: if isAuthenticated() && isMemberOf(resource.data.organization_id);
         allow write: if false;
       }
       
       // Notifications (CAOCIPP)
       match /notifications/{notifId} {
         allow read: if isAuthenticated() && isOwner(resource.data.user_id);
         allow update: if isAuthenticated() && isOwner(resource.data.user_id) &&
                         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'read_at']);
         allow create, delete: if false;
       }
     }
   }
   ```

3. **Deploy das rules mescladas:**
   ```powershell
   firebase deploy --only firestore:rules
   ```

---

### Opção B: Namespace por Subcoleção (se tiver conflito de nomes)

Se alguma das suas outras plataformas já usa coleções com os mesmos nomes (`users`, `organizations`, etc), você pode usar um namespace:

**Prefixar coleções do CAOCIPP:**
- `users` → `caocipp_users`
- `organizations` → `caocipp_organizations`
- `userOrganizations` → `caocipp_userOrganizations`
- `processes` → `caocipp_processes`
- `auditLogs` → `caocipp_auditLogs`
- `notifications` → `caocipp_notifications`

**⚠️ Se optar por Opção B:**
1. Atualize `firestore.rules` com os nomes prefixados
2. Atualize `src/config/firebase.js` para usar collections prefixadas
3. Atualize todos os hooks/services para usar os novos nomes

---

## 🔍 Verificar Conflitos

**Antes de fazer merge, verifique se há conflitos:**

1. Abra Firebase Console > Firestore Database
2. Veja as coleções existentes
3. Se houver coleções com mesmo nome (`users`, `organizations`, etc):
   - **Use Opção B** (namespace)
4. Se NÃO houver conflitos:
   - **Use Opção A** (merge direto)

---

## 📊 Deploy de Indexes

Os indexes do CAOCIPP são independentes e podem ser deployados sem problemas:

```powershell
firebase deploy --only firestore:indexes
```

**Observação:** Indexes levam 5-15 minutos para serem criados.

---

## ✅ Checklist de Deploy Seguro

- [ ] Baixei as rules atuais (`firebase firestore:rules:get`)
- [ ] Verifiquei conflitos de nomes de coleções
- [ ] Mesclei as rules (Opção A ou B)
- [ ] Testei as rules no Simulator (Firebase Console)
- [ ] Deploy de rules: `firebase deploy --only firestore:rules`
- [ ] Deploy de indexes: `firebase deploy --only firestore:indexes`
- [ ] Verifiquei que outras plataformas ainda funcionam

---

## 🆘 Rollback (se algo der errado)

```powershell
# Restaurar rules anteriores
firebase deploy --only firestore:rules

# (cole o conteúdo de firestore.rules.current em firestore.rules antes)
```

---

## 📝 Próximos Passos

Depois de fazer o merge das rules:
1. Instalar dependências: `npm install`
2. Testar localmente: `npm run dev`
3. Testar Google login
4. Criar primeira organização (vai criar as coleções automaticamente)

---

**Nota:** As coleções do CAOCIPP só serão criadas quando você começar a usar a plataforma. Até lá, não há impacto zero nas outras plataformas do projeto.
