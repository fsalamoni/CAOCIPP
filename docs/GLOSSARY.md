# 📖 CAOCIPP - Glossary

**Version:** 1.0.0  
**Last Updated:** 2026-02-05  
**Purpose:** Complete terminology reference for developers and maintainers

---

## Table of Contents

1. [General Terms](#general-terms)
2. [Technical Terms](#technical-terms)
3. [Firebase Terms](#firebase-terms)
4. [React Terms](#react-terms)
5. [Database Terms](#database-terms)
6. [Security Terms](#security-terms)
7. [UI/UX Terms](#uiux-terms)
8. [Business Domain Terms](#business-domain-terms)

---

## General Terms

### CAOCIPP
**Centro de Apoio Operacional de Controle Institucional de Projetos e Processos**  
The legal/administrative organization that manages processes and inquiries.

### Processo
A legal or administrative inquiry/case tracked in the system. Contains consultant information, dates, analysis notes, and workflow stages.

### Consulente
The person or entity that submitted the inquiry/process.

### Assessor
An analyst/advisor responsible for reviewing and processing inquiries.

### Organização (Organization)
A group/team of users collaborating on processes. Users can belong to multiple organizations.

### Membro (Member)
A user who belongs to an organization. Can have different roles (creator, admin, member).

---

## Technical Terms

### SPA (Single Page Application)
A web application that loads a single HTML page and dynamically updates content without full page reloads. CAOCIPP is an SPA.

### CSR (Client-Side Rendering)
Rendering approach where JavaScript runs in the browser to generate HTML. Used by CAOCIPP (via Vite + React).

### SSR (Server-Side Rendering)
Alternative rendering where HTML is generated on the server. NOT used in CAOCIPP.

### PWA (Progressive Web App)
Web apps that work offline and can be installed. Future enhancement for CAOCIPP.

### JWT (JSON Web Token)
Token format used by Firebase Auth for user authentication. Contains user ID and expiration.

### OAuth 2.0
Authentication protocol used for Google Sign-In. Industry standard for delegated authorization.

### API (Application Programming Interface)
Interface for communication between software components. CAOCIPP uses Firebase SDK as its primary API.

### REST API
Architectural style for networked applications. NOT used in CAOCIPP (uses Firebase SDK instead).

### CDN (Content Delivery Network)
Distributed network that serves static files quickly. Firebase Hosting includes a CDN.

### HTTPS
Secure HTTP protocol using TLS encryption. Required for all CAOCIPP traffic.

### Environment Variable
Configuration value stored outside code (in `.env` file). Used for Firebase credentials.

---

## Firebase Terms

### Firebase
Google's Backend-as-a-Service (BaaS) platform providing authentication, database, hosting, and more.

### Firebase Project
A container for Firebase services. CAOCIPP uses project ID: `protagonista-rpg`.

### Firebase Authentication (Auth)
Service managing user sign-in and identity. CAOCIPP uses Google Sign-In provider.

### Firestore
Firebase's NoSQL cloud database. Stores all CAOCIPP data (users, organizations, processes).

### Firebase Hosting
Static web hosting service with CDN. Deploys built CAOCIPP application.

### Cloud Functions
Serverless backend code execution. Placeholder created for future CAOCIPP features.

### Firebase SDK
JavaScript library for interacting with Firebase services. Current version: 10.14.1.

### Security Rules
Server-side rules validating Firestore read/write permissions. Written in a custom DSL.

### Composite Index
Database index on multiple fields for performant queries. CAOCIPP has 9 composite indexes.

### serverTimestamp()
Firebase function generating server-side timestamp. Prevents client clock manipulation.

### onAuthStateChanged
Firebase listener detecting user login/logout state changes.

### Collection
Top-level group of documents in Firestore. CAOCIPP has 5 collections.

### Document
Individual record in a Firestore collection. Has unique ID and key-value data.

### Subcollection
Collection nested under a document. NOT used in CAOCIPP (flat structure preferred).

### Real-time Listener (onSnapshot)
Firestore feature streaming live database updates to client.

### Batch Write
Atomic operation updating multiple documents simultaneously. Used for organizational stats.

### increment()
Firestore helper atomically increasing/decreasing numeric field.

---

## React Terms

### Component
Reusable UI building block. CAOCIPP has ~30 components.

### JSX (JavaScript XML)
Syntax extension allowing HTML-like code in JavaScript.

```jsx
<Button onClick={handleClick}>Click me</Button>
```

### Props (Properties)
Data passed from parent component to child component.

```jsx
<ProcessControl organization={org} members={members} />
```

### State
Component's internal data that can change over time. Managed with `useState`.

```jsx
const [isOpen, setIsOpen] = useState(false);
```

### Hook
React function enabling state and lifecycle features in function components. Examples: `useState`, `useEffect`, custom hooks.

### useEffect
React hook for side effects (data fetching, subscriptions, timers).

```jsx
useEffect(() => {
  // Fetch data
}, [dependency]);
```

### useState
React hook for managing component state.

```jsx
const [count, setCount] = useState(0);
```

### Context
React pattern for sharing data across component tree without props drilling. CAOCIPP uses `FirebaseAuthContext`.

### Provider
Component wrapping children to provide Context value.

```jsx
<FirebaseAuthProvider>
  <App />
</FirebaseAuthProvider>
```

### Custom Hook
Reusable hook extracting component logic. CAOCIPP has 5 custom hooks in `useFirestore.js`.

### Ref (useRef)
React hook for accessing DOM elements or persisting values across renders.

###Controlled Component
Form input whose value is controlled by React state.

```jsx
<Input value={value} onChange={e => setValue(e.target.value)} />
```

### Uncontrolled Component
Form input managing its own state (not via React state). NOT used in CAOCIPP.

---

## Database Terms

### NoSQL Database
Non-relational database. Firestore is a NoSQL document database.

### Document Database
NoSQL database storing data as documents (JSON-like). Firestore's model.

### Schema
Structure/organization of database. Firestore is schema-less (flexible structure).

### Query
Request for data from database.

```javascript
query(collection(db, 'processes'), where('organization_id', '==', orgId))
```

### Filter (Where Clause)
Condition limiting query results.

```javascript
where('urgency_request', '==', true)
```

### Index
Data structure improving query performance. Required for Firestore compound queries.

### Compound Query
Query filtering on multiple fields. Requires composite index.

```javascript
where('organization_id', '==', orgId).where('status', '==', 'Em triagem')
```

### Denormalization
Duplicating data for performance. CAOCIPP denormalizes `user_name` in processes.

### Normalization
Organizing data to reduce duplication. CAOCIPP is partially normalized.

### Foreign Key
Reference to document in another collection. CAOCIPP uses `organization_id` as foreign key.

### Primary Key
Unique identifier for document. Firestore auto-generates unless specified.

### Composite Key
Primary key combining multiple fields. CAOCIPP uses `{userId}_{orgId}` for memberships.

### CRUD
Create, Read, Update, Delete - basic database operations.

### Transaction
Atomic operation ensuring all-or-nothing execution. NOT currently used in CAOCIPP.

### Batch Operation
Multiple operations executed together. Used for stats updates in CAOCIPP.

---

## Security Terms

### Authentication (AuthN)
Verifying user identity ("who are you?"). Firebase Auth provides this.

### Authorization (AuthZ)
Determining user permissions ("what can you do?"). Firestore rules provide this.

### Role-Based Access Control (RBAC)
Authorization based on user's role. CAOCIPP uses creator/admin/member roles.

### Principle of Least Privilege
Users have minimum permissions needed. Applied in Firestore rules.

### Defense in Depth
Multiple security layers. CAOCIPP has client validation + Firestore rules.

### XSS (Cross-Site Scripting)
Attack injecting malicious scripts. React auto-escapes JSX preventing this.

### CSRF (Cross-Site Request Forgery)
Attack forcing authenticated users to submit unauthorized requests. Firebase prevents this.

### TLS (Transport Layer Security)
Cryptographic protocol securing network communication. HTTPS uses TLS.

### Encryption at Rest
Data encrypted when stored on disk. Firebase provides this by default.

### Encryption in Transit
Data encrypted during transmission. HTTPS provides this.

### Session Hijacking
Attack stealing user's session. Mitigated by HTTPS + short-lived tokens.

### Threat Model
Analysis of potential security threats. Documented in `SECURITY_REFERENCE.md`.

### Security Rule
Firestore configuration controlling data access.

```javascript
allow read: if isAuthenticated() && isMemberOf(orgId);
```

---

## UIUX Terms

### Responsive Design
UI adapting to different screen sizes. CAOCIPP uses Tailwind breakpoints.

### Breakpoint
Screen width triggering layout change. CAOCIPP: mobile (<768px), tablet (768-1024px), desktop (>1024px).

### Component Library
Pre-built UI components. CAOCIPP uses Radix UI primitives.

### Design System
Standardized UI patterns and components. Documented in `DESIGN_SYSTEM_REFERENCE.md`.

### Accessibility (a11y)
Making UI usable by people with disabilities. Radix UI provides accessibility features.

### Loading State
UI shown while data is being fetched.

```jsx
{isLoading && <Loader2 className="animate-spin" />}
```

### Error State
UI shown when operation fails.

```jsx
{error && <Alert variant="destructive">{error}</Alert>}
```

### Toast Notification
Temporary popup message. CAOCIPP uses Sonner library.

### Modal/Dialog
Overlay window requiring user interaction. Used for forms in CAOCIPP.

### Form Validation
Checking user input meets requirements. Implemented in CAOCIPP dialogs.

### Placeholder
Temporary content shown before real data loads.

### Skeleton Screen
Placeholder mimicking final content's shape. NOT currently used in CAOCIPP.

---

## Business Domain Terms

### Processo Administrativo
Administrative process/inquiry requiring analysis and decision.

### Consulta
Inquiry or consultation request submitted to CAOCIPP.

### Matéria e Objeto
Subject matter and purpose of the inquiry.

### Local dos Fatos
City/location where the matter occurred.

### Pedido de Urgência
Urgent request flag for priority handling.

### Distribuição
Assignment of process to specific advisor (assessor).

### Análise
Review and examination of the inquiry by assigned advisor.

### Revisão
Secondary review by supervisor or senior analyst.

### Arquivamento
Archiving/finalizing the process after completion.

### Restrição de Acesso
Access restriction limiting visibility to authorized users only.

### Pasta da Rede
Network folder storing physical/digital documents related to process.

### Status do Processo
Current stage of the process (em triagem, em elaboração, na pasta, etc.).

### Triagem
Initial sorting/classification of incoming processes.

### Em Elaboração
Process being actively analyzed and written up.

### Em Revisão
Process under review by supervisor.

### Para Revisão
Process ready to be sent for review.

### Na Pasta
Process completed and archived.

### Decisão
Final decision or conclusion on the inquiry.

### Observações
Notes and important points recorded during analysis.

---

## Acronyms Quick Reference

| Acronym | Full Term | Category |
|---------|-----------|----------|
| **CAOCIPP** | Centro de Apoio Operacional de Controle Institucional de Projetos e Processos | Business |
| **SPA** | Single Page Application | Technical |
| **CSR** | Client-Side Rendering | Technical |
| **SSR** | Server-Side Rendering | Technical |
| **PWA** | Progressive Web App | Technical |
| **API** | Application Programming Interface | Technical |
| **CDN** | Content Delivery Network | Technical |
| **JWT** | JSON Web Token | Security |
| **OAuth** | Open Authorization | Security |
| **HTTPS** | Hypertext Transfer Protocol Secure | Security |
| **Auth** | Authentication | Firebase |
| **AuthN** | Authentication | Security |
| **AuthZ** | Authorization | Security |
| **RBAC** | Role-Based Access Control | Security |
| **XSS** | Cross-Site Scripting | Security |
| **CSRF** | Cross-Site Request Forgery | Security |
| **TLS** | Transport Layer Security | Security |
| **CRUD** | Create, Read, Update, Delete | Database |
| **NoSQL** | Not Only SQL | Database |
| **JSX** | JavaScript XML | React |
| **UI** | User Interface | UI/UX |
| **UX** | User Experience | UI/UX |
| **a11y** | Accessibility (11 letters between a and y) | UI/UX |
| **KPI** | Key Performance Indicator | Analytics |

---

## File Extensions

| Extension | Description | Example |
|-----------|-------------|---------|
| `.jsx` | JavaScript with JSX syntax (React components) | `Dashboard.jsx` |
| `.js` | Plain JavaScript | `firebase.js` |
| `.json` | JSON data/configuration file | `package.json` |
| `.md` | Markdown documentation | `README.md` |
| `.css` | Cascading Style Sheets | `index.css` |
| `.html` | HTML markup | `index.html` |
| `.env` | Environment variables | `.env` |
| `.rules` | Firebase Security Rules | `firestore.rules` |
| `.config.js` | Configuration file | `vite.config.js` |

---

## Common Patterns

### Snake_Case
Lowercase words separated by underscores.  
**Used for:** Firestore field names  
**Example:** `organization_id`, `created_at`, `responsible_user_id`

### camelCase
Lowercase first word, capitalized subsequent words.  
**Used for:** JavaScript variables, functions  
**Example:** `createProcess`, `isLoading`, `organizationId`

### PascalCase
All words capitalized.  
**Used for:** React components, classes  
**Example:** `Dashboard`, `ProcessControl`, `FirebaseAuthContext`

### SCREAMING_SNAKE_CASE
Uppercase words separated by underscores.  
**Used for:** Constants  
**Example:** `VITE_FIREBASE_API_KEY`, `MAX_FILE_SIZE`

### kebab-case
Lowercase words separated by hyphens.  
**Used for:** URLs, CSS classes, file names (sometimes)  
**Example:** `process-control`, `btn-primary`

---

## Conclusion

This glossary provides definitions for **150+ terms** across 8 categories:
- General (15 terms)
- Technical (20 terms)
- Firebase (25 terms)
- React (20 terms)
- Database (20 terms)
- Security (15 terms)
- UI/UX (15 terms)
- Business Domain (25 terms)

Use this as a quick reference when:
- ✅ Onboarding new developers
- ✅ Understanding codebase terminology
- ✅ Writing documentation
- ✅ Communicating with stakeholders

For context on how terms are used:
- Architecture → `ARCHITECTURE_REFERENCE.md`
- Security → `SECURITY_REFERENCE.md`
- Features → `FEATURES_REFERENCE.md`
