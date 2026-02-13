# 👨‍💻 CAO - Development Guide (Consultas CAO)

**Version:** 1.2.0 - Final (Precision Rebranding)  
**Last Updated:** 2026-02-12  
**Purpose:** Guide for developers and AI agents working on Consultas CAO

---

## Quick Start for Developers

### Prerequisites

- Node.js 18+ installed
- Git installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Code editor (VS Code recommended)

### Setup Steps

```powershell
# 1. Clone repository (if applicable)
git clone <repo-url>
cd Consultas-CAO

# 2. Install dependencies
npm install

# 3. Configure environment
# Copy .env.example to .env and fill in Firebase credentials

# 4. Start dev server
npm run dev

# 5. Open browser
# http://localhost:5173
```

---

## Project Organization

### Directory Roles

| Directory | Purpose | When to Add Files |
|-----------|---------|-------------------|
| `src/pages/` | Route components | New top-level pages |
| `src/components/organization/` | Organization features | Process/member management |
| `src/components/ui/` | Reusable UI | New UI primitives |
| `src/hooks/` | Custom hooks | Reusable data logic |
| `src/services/` | Business logic | Firebase operations |
| `src/config/` | Configuration | Global settings |
| `src/utils/` | Helper functions | Utilities, formatters |
| `docs/` | Documentation | Reference docs |

### File Naming Conventions

- **Components:** PascalCase, `.jsx` extension → `ProcessControl.jsx`
- **Hooks:** camelCase, `use` prefix → `useFirestore.js`
- **Services:** camelCase, `Service` suffix → `firestoreService.js`
- **Utils:** camelCase → `logger.js`

---

## Development Workflow

### Adding a New Feature

**1. Plan**
- Review `FEATURES_REFERENCE.md` for existing patterns
- Check `ARCHITECTURE_REFERENCE.md` for data models
- Review `SECURITY_REFERENCE.md` for permission requirements

**2. Create Branch** (if using Git)
```bash
git checkout -b feature/feature-name
```

**3. Implement**
- Follow existing patterns
- Reuse components from `src/components/ui/`
- Use Tailwind CSS for styling
- Add Firebase rules if accessing new data

**4. Test**
- Manual testing in browser
- Test all user roles (creator, member)
- Test error cases

**5. Document**
- Update `FEATURES_REFERENCE.md` if adding feature
- Add comments for complex logic
- Update `GLOSSARY.md` for new terms

**6. Deploy**
```powershell
# Deploy Firestore rules (if changed)
firebase deploy --only firestore:rules

# Deploy application
npm run build
firebase deploy --only hosting
```

### Code Review Checklist

- [ ] Follows existing code patterns
- [ ] Uses reusable components
- [ ] Includes error handling
- [ ] Shows loading states
- [ ] Responsive on mobile/tablet/desktop
- [ ] Firestore rules updated (if needed)
- [ ] No hardcoded secrets
- [ ] Console.logs removed

---

## Common Tasks

### Adding a New Page

**1. Create page component:**
```jsx
// src/pages/NewPage.jsx
export default function NewPage() {
  return (
    <div className="container mx-auto p-6">
      <h1>New Page</h1>
    </div>
  );
}
```

**2. Add route:**
```jsx
// src/App.jsx
import NewPage from './pages/NewPage';

// In Routes
<Route path="/new-page" element={<NewPage />} />
```

### Adding a Firestore Collection

**1. Define security rules:**
```javascript
// firestore.rules
match /newCollection/{docId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
}
```

**2. Create service function:**
```javascript
// src/services/firestoreService.js
export async function createNewDocument(data, userId) {
  const docRef = await addDoc(collection(db, 'newCollection'), {
    ...data,
    created_by: userId,
    created_at: serverTimestamp()
  });
  return docRef.id;
}
```

**3. Create hook:**
```javascript
// src/hooks/useFirestore.js
export function useNewCollection(filter) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const q = query(
      collection(db, 'newCollection'),
      where('filter_field', '==', filter)
    );
    
    getDocs(q).then(snapshot => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setData(items);
      setIsLoading(false);
    });
  }, [filter]);
  
  return { data, isLoading };
}
```

**4. Deploy rules:**
```powershell
firebase deploy --only firestore:rules
```

### Adding a UI Component

**1. Check if Radix UI primitive exists:**
- Browse: https://www.radix-ui.com/primitives/

**2. If it exists, install:**
```powershell
npm install @radix-ui/react-component-name
```

**3. Create wrapper:**
```jsx
// src/components/ui/component.jsx
import * as ComponentPrimitive from '@radix-ui/react-component-name';

export function Component({ children, ...props }) {
  return (
    <ComponentPrimitive.Root {...props}>
      {children}
    </ComponentPrimitive.Root>
  );
}
```

**4. Use in app:**
```jsx
import { Component } from '@/components/ui/component';

<Component>Content</Component>
```

---

## Firebase Operations

### Reading Data

**Simple Query:**
```javascript
const q = query(
  collection(db, 'processes'),
  where('organization_id', '==', orgId)
);
const snapshot = await getDocs(q);
const processes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**Real-time Listener:**
```javascript
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, 'organizations', orgId), (doc) => {
    setOrg({ id: doc.id, ...doc.data() });
  });
  return () => unsubscribe();
}, [orgId]);
```

### Writing Data

**Create:**
```javascript
const docRef = await addDoc(collection(db, 'processes'), {
  organization_id: orgId,
  process_number: '00001.001.001/2026',
  created_at: serverTimestamp()
});
```

**Update:**
```javascript
await updateDoc(doc(db, 'processes', processId), {
  status: 'Em elaboração',
  updated_at: serverTimestamp()
});
```

**Delete:**
```javascript
await deleteDoc(doc(db, 'processes', processId));
```

**Atomic Increment:**
```javascript
await updateDoc(doc(db, 'organizations', orgId), {
  'stats.processes_count': increment(1)
});
```

---

## Error Handling

### Standard Pattern

```javascript
try {
  await someOperation();
  toast.success('Operação realizada com sucesso!');
} catch (error) {
  logger.error('Operation failed', { error, context });
  toast.error('Erro ao realizar operação: ' + error.message);
}
```

### User-Friendly Messages

```javascript
// ❌ BAD
toast.error(error.message); // "permission-denied"

// ✅ GOOD
toast.error('Você não tem permissão para realizar esta ação');
```

---

## Testing Strategies

### Manual Testing

**Checklist for New Features:**
1. [ ] Happy path works
2. [ ] Error cases handled
3. [ ] Loading states shown
4. [ ] Permissions enforced
5. [ ] Works on mobile
6. [ ] Works as non-creator member
7. [ ] Data validates correctly

### Testing with Multiple Users

1. Open browser in normal mode (User A - Creator)
2. Open browser in incognito (User B - Member)
3. Test interactions between users
4. Verify permission boundaries

---

## Performance Optimization

### Query Optimization

**❌ BAD - Fetching all, filtering client-side:**
```javascript
const all = await getDocs(collection(db, 'processes'));
const filtered = all.docs.filter(doc => doc.data().organization_id === orgId);
```

**✅ GOOD - Server-side filtering:**
```javascript
const q = query(
  collection(db, 'processes'),
  where('organization_id', '==', orgId)
);
const snapshot = await getDocs(q);
```

### Pagination (Future)

```javascript
const q = query(
  collection(db, 'processes'),
  where('organization_id', '==', orgId),
  orderBy('created_at', 'desc'),
  limit(25)
);

// Next page
const lastDoc = snapshot.docs[snapshot.docs.length - 1];
const nextQ = query(..., startAfter(lastDoc), limit(25));
```

---

## Debugging Tips

### Firebase Console

- **Authentication:** View logged-in users
- **Firestore:** Browse data, run queries
- **Rules:** Test rules with simulator
- **Hosting:** View deployed versions

### Browser DevTools

**Console Tab:**
- Check for JavaScript errors
- View `logger.error()` messages

**Network Tab:**
- Monitor Firestore requests
- Check for failed requests
- Verify data being sent

**Application Tab:**
- View localStorage (Firebase tokens)
- Check session persistence

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Missing or insufficient permissions" | Firestore rules block access | Check rules, verify user membership |
| "Firebase: Error (auth/unauthorized-domain)" | Domain not authorized | Add to Firebase Console > Auth > Authorized domains |
| Index not found | Composite index missing | Deploy indexes or click link in error |
| Components not updating | Missing dependency in useEffect | Add to dependency array |

---

## Deployment

### Development Build

```powershell
npm run dev
```

Access: http://localhost:5173

### Production Build

```powershell
# Build optimized bundle
npm run build

# Preview build locally
npm run preview

# Deploy to Firebase
firebase deploy --only hosting
```

### Firestore Rules Deployment

```powershell
# Deploy rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy both
firebase deploy --only firestore
```

---## AI Agent Guidelines

### For AI Assistants Working on Consultas CAO

**Before Making Changes:**
1. Read relevant reference docs (`ARCHITECTURE_REFERENCE.md`, `SECURITY_REFERENCE.md`, etc.)
2. Check `GLOSSARY.md` for unfamiliar terms
3. Review existing code patterns in similar components
4. Verify Firestore rules allow the operation

**When Writing Code:**
1. Follow existing patterns (don't reinvent)
2. Reuse components from `src/components/ui/`
3. Use existing hooks/services when possible
4. Add proper error handling and loading states
5. Include TypeScript-style JSDoc comments for complex functions

**After Making Changes:**
1. Verify code compiles (`npm run dev`)
2. Test manually in browser
3. Update `FEATURES_REFERENCE.md` if adding features
4. Update `GLOSSARY.md` if adding new terms

**Example JSDoc Comment:**
```javascript
/**
 * Creates a new process in Firestore
 * @param {Object} data - Process data
 * @param {string} data.process_number - Unique process identifier
 * @param {string} data.organization_id - Organization ID
 * @param {string} creatorUid - User ID of creator
 * @returns {Promise<string>} Created process ID
 */
export async function createProcess(data, creatorUid) {
  // Implementation
}
```

---

## Resources

### Documentation
- `ARCHITECTURE_REFERENCE.md` - System structure
- `SECURITY_REFERENCE.md` - Security rules & auth
- `FEATURES_REFERENCE.md` - Feature implementation
- `DESIGN_SYSTEM_REFERENCE.md` - UI patterns
- `GLOSSARY.md` - Terminology

### External Docs
- [React Docs](https://react.dev)
- [Firebase Docs](https://firebase.google.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/primitives)
- [Vite Docs](https://vitejs.dev/guide/)

### Code Examples
- Look at existing pages in `src/pages/`
- Look at components in `src/components/organization/`
- Check hooks in `src/hooks/useFirestore.js`
- Review services in `src/services/firestoreService.js`

---

## Troubleshooting Guide

### "npm install" fails
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Check Node.js version (need 18+)

### Firebase connection errors
- Check `.env` file has correct values
- Verify Firebase project exists
- Check authorized domains in Firebase Console

### Firestore permissions errors
- Deploy latest rules: `firebase deploy --only firestore:rules`
- Check user is logged in
- Verify user is member of organization

### Build errors
- Run `npm run build` and read error messages
- Check for missing imports
- Verify all dependencies installed

---

## Conclusion

This guide provides:
- ✅ Quick start instructions
- ✅ Common development tasks
- ✅ Code patterns and best practices
- ✅ Debugging strategies
- ✅ Deployment procedures
- ✅ AI agent guidelines

**Key Principle:** When in doubt, follow existing patterns in the codebase.

For specific implementation details, consult the reference documentation in `docs/`.
