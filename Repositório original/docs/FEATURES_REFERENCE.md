# ⚙️ Consultas CAO - Features Reference

**Version:** 1.2.0 - Final (Precision Rebranding)  
**Last Updated:** 2026-02-10  
**Purpose:** Complete features documentation with implementation details

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Authentication Features](#authentication-features)
3. [Organization Management](#organization-management)
4. [Process Management](#process-management)
5. [Dashboard & Analytics](#dashboard--analytics)
6. [User Profile](#user-profile)
7. [UI/UX Features](#uiux-features)
8. [Future Features](#future-features)

---

## Feature Overview

### Implemented Features Matrix

| Category | Feature | Status | Priority | Complexity |
|----------|---------|--------|----------|------------|
| **Authentication** | Google Sign-In | ✅ LIVE | P0 | Low |
| **Authentication** | Logout | ✅ LIVE | P0 | Low |
| **Authentication** | Session Persistence | ✅ LIVE | P0 | Low |
| **Organizations** | Create Organization | ✅ LIVE | P0 | Medium |
| **Organizations** | Join via Invite Code | ✅ LIVE | P0 | Medium |
| **Organizations** | View Members | ✅ LIVE | P1 | Low |
| **Organizations** | Edit Member Function | ✅ LIVE | P1 | Low |
| **Organizations** | Remove Member | ✅ LIVE | P1 | Low |
| **Processes** | Create Process | ✅ LIVE | P0 | Medium |
| **Processes** | Edit Process | ✅ LIVE | P0 | Medium |
| **Processes** | Delete Process | ✅ LIVE | P0 | Low |
| **Processes** | Filter Processes (Status/Search) | ✅ LIVE | P0 | Low |
| **Processes** | Advanced Period Filters (De/Até) | ✅ LIVE | P1 | Medium |
| **Processes** | Sorting (Natural/Date) | ✅ LIVE | P1 | Low |
| **Processes** | Per-User View Persistence | ✅ LIVE | P1 | Medium |
| **Processes** | Search Processes | ✅ LIVE | P0 | Low |
| **Processes** | Mark Urgent | ✅ LIVE | P1 | Low |
| **Processes** | Assign Responsible | ✅ LIVE | P1 | Low |
| **Processes** | Access Restriction | ✅ LIVE | P2 | Low |
| **Processes** | Workflow Tracking | ✅ LIVE | P1 | Medium |
| **Analytics** | KPIs Dashboard | ✅ LIVE | P1 | Medium |
| **Analytics** | Charts (Status, Location) | ✅ LIVE | P2 | Medium |
| **Analytics** | Performance Metrics | ✅ LIVE | P2 | Medium |
| **Profile** | Edit Display Name | ✅ LIVE | P1 | Low |
| **Profile** | Edit Function | ✅ LIVE | P1 | Low |
| **Profile** | Edit Notification Email | ✅ LIVE | P2 | Low |
| **Import** | Excel/CSV Import | ⏸️ PAUSED | P2 | High |
| **Notifications** | In-App Notifications | ⏸️ PAUSED | P2 | Medium |
| **Notifications** | Email Notifications | ⏸️ PAUSED | P3 | High |

**Legend:**
- **P0:** Critical (MVP)
- **P1:** High Priority
- **P2:** Medium Priority
- **P3:** Low Priority / Future

---

## Authentication Features

### 1. Google Sign-In

**Description:** Users authenticate using their Google account via OAuth 2.0

**Implementation:**

**File:** `src/pages/Landing.jsx`

```javascript
const handleGoogleSignIn = async () => {
  setIsLoading(true);
  try {
    await signInWithGoogle(); // From FirebaseAuthContext
    navigate('/Dashboard');
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

**Flow:**
1. User clicks "Continuar com Google"
2. Firebase opens Google OAuth popup
3. User selects Google account
4. Firebase receives credentials
5. User document created/updated in Firestore
6. Redirect to `/Dashboard`

**Technical Details:**
- **Provider:** `GoogleAuthProvider`
- **Method:** `signInWithPopup` (primary) / `signInWithRedirect` (fallback)
- **Token:** JWT with 1-hour expiration
- **Session:** Persisted in localStorage

**Error Handling:**
- Popup blocked → Fallback to redirect
- Network error → Show retry button
- Auth cancelled → Silent (return to landing)

### 2. Session Persistence

**Description:** User stays logged in across browser sessions

**Implementation:**

**File:** `src/lib/FirebaseAuthContext.jsx`

```javascript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      setUser(firebaseUser);
      // Optionally fetch additional user data from Firestore
    } else {
      setUser(null);
    }
    setIsLoading(false);
  });
  return () => unsubscribe();
}, []);
```

**Behavior:**
- On app load, Firebase checks for existing session
- If valid token exists, user is auto-logged in
- If expired, user sees login screen

### 3. Logout

**Description:** User can manually end their session

**Implementation:**

```javascript
const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    navigate('/');
  } catch (error) {
    logger.error('Logout error', error);
  }
};
```

**Flow:**
1. User clicks "Sair" button (in Profile)
2. Firebase clears tokens and session
3. `onAuthStateChanged` fires with `null`
4. Redirect to Landing page

---

## Organization Management

### 1. Create Organization

**Description:** Users can create new organizations to manage processes

**Implementation:**

**File:** `src/pages/Profile.jsx` (dialog)  
**Service:** `src/services/firestoreService.js` (`createOrganization`)

```javascript
export async function createOrganization(data, creatorUid) {
  // 1. Generate unique invite code
  const inviteCode = generateInviteCode();
  
  // 2. Create organization document
  const orgRef = await addDoc(collection(db, 'organizations'), {
    name: data.name,
    description: data.description,
    invite_code: inviteCode,
    created_by: creatorUid,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    stats: {
      members_count: 1,
      processes_count: 0,
      active_processes: 0
    }
  });
  
  // 3. Create creator membership
  await createMembership({
    user_id: creatorUid,
    organization_id: orgRef.id,
    role: 'creator',
    // ... user data
  });
  
  return orgRef.id;
}
```

**Form Fields:**
- **Name:** Required, string, max 100 chars
- **Description:** Optional, string, max 500 chars

**Business Rules:**
- Invite code is 8 random uppercase letters/numbers
- Creator automatically becomes member with 'creator' role
-stats initialized to zeros
- `created_by` tied to authentic ated user (cannot be faked)

### 2. Join Organization via Invite Code

**Description:** Users can join existing organizations using an invite code

**Implementation:**

**File:** `src/pages/Profile.jsx` (dialog)  
**Service:** `firestoreService.js` (`joinOrganizationByInvite`)

```javascript
export async function joinOrganizationByInvite(inviteCode, userId) {
  // 1. Find organization by invite code
  const q = query(
    collection(db, 'organizations'),
    where('invite_code', '==', inviteCode.toUpperCase())
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Código de convite inválido');
  }
  
  const org = snapshot.docs[0];
  
  // 2. Check if already a member
  const membershipId = `${userId}_${org.id}`;
  const membershipDoc = await getDoc(doc(db, 'userOrganizations', membershipId));
  
  if (membershipDoc.exists()) {
    throw new Error('Você já é membro desta organização');
  }
  
  // 3. Create membership
  await createMembership({
    user_id: userId,
    organization_id: org.id,
    role: 'member',
    // ... user data
  });
  
  // 4. Update org stats
  await updateDoc(doc(db, 'organizations', org.id), {
    'stats.members_count': increment(1)
  });
  
  return org.id;
}
```

**Flow:**
1. User enters 8-character code
2. System searches for matching organization
3. If found, creates membership with 'member' role
4. organization stats updated
5. User can now access organization

**Validation:**
- Code converted to uppercase (case-insensitive)
- Duplicate membership prevented
- Invalid code shows user-friendly error

### 3. Member Management

**Description:** Organization creators can manage members

**Features:**

#### 3.1 View Members

**File:** `src/components/organization/GeneralInfo.jsx`

**Hook:** `useOrganizationMembers(orgId)`

**Display:**
- Name, email, function, role, join date
- Sorted by role (creator first), then join date

#### 3.2 Edit Member Function

**Permissions:** Creator only

**Implementation:**

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  const membershipRef = doc(db, 'userOrganizations', member.id);
  await updateDoc(membershipRef, {
    function: functionValue
  });
  toast.success('Função atualizada');
};
```

**UI:** Click on function name → dialog → edit → save

#### 3.3 Remove Member

**Permissions:** Creator only

**Restrictions:** Cannot remove creator

**Implementation:**

```javascript
export async function removeMember(userId, organizationId) {
  const membershipId = `${userId}_${organizationId}`;
  
  // Get membership to check role
  const membershipDoc = await getDoc(doc(db, 'userOrganizations', membershipId));
  
  if (membershipDoc.data().role === 'creator') {
    throw new Error('Não é possível remover o criador da organização');
  }
  
  // Delete membership
  await deleteDoc(doc(db, 'userOrganizations', membershipId));
  
  // Update org stats
  await updateDoc(doc(db, 'organizations', organizationId), {
    'stats.members_count': increment(-1)
  });
}
```

**Flow:**
1. Creator clicks delete icon
2. Confirmation dialog appears
3. If confirmed, membership deleted
4. Member loses access immediately
5. Stats updated

---

## Process Management

### 1. Create Process

**Description:** Members can create new processes for tracking

**Implementation:**

**File:** `src/components/organization/CreateProcessDialog.jsx`  
**Service:** `firestoreService.js` (`createProcess`)

```javascript
export async function createProcess(data, creatorUid) {
  const processRef = await addDoc(collection(db, 'processes'), {
    ...data,
    status: data.status || 'Em triagem',
    created_by: creatorUid,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    updated_by: creatorUid
  });
  
  // Update org stats
  await updateDoc(doc(db, 'organizations', data.organization_id), {
    'stats.processes_count': increment(1),
    'stats.active_processes': increment(1)
  });
  
  return processRef.id;
}
```

**Required Fields:**
- Process Number (format: `00000.000.000/0000`)
- Consultant Name
- Location (dropdown of RS cities)
- Entry Date
- Matter/Object (textarea)

**Optional Fields:**
- Urgency Request (boolean)
- Distribution Date
- Responsible User
- All workflow fields (analysis dates, review dates, etc.)

**Validation:**
- Process number unique within organization (client-side warning)
- Dates in ISO format (YYYY-MM-DD)
- Location from predefined list

**Default Values:**
- `status`: "Em triagem"
- `urgency_request`: false
- `access_restriction`: false

### 2. Edit Process

**Description:** Authorized users can update process information

**Permissions:**
- Creator/Admin: Can edit any process
- Member: Can edit if `responsible_user_id` matches their ID

**Implementation:**

**File:** `src/components/organization/EditProcessDialog.jsx`

**UI Structure:** 3 tabs
1. **Dados Básicos:** Process number, consultant, location, entry date, matter, urgency (read-only fields except urgency)
2. **Fluxo de Trabalho:** Distribution, responsible, analysis dates, observations
3. **Revisão e Arquivo:** Review dates, archive date, network folder, access restriction

```javascript
export async function updateProcess(processId, updates, updaterUid) {
  await updateDoc(doc(db, 'processes', processId), {
    ...updates,
    updated_at: serverTimestamp(),
    updated_by: updaterUid
  });
}
```

**Read-Only Fields (after creation):**
- `process_number`
- `consultant`
- `location`
- `entry_date`
- `matter_object`

**Rationale:** These are core identifiers and shouldn't change

### 3. Delete Process

**Description:** Creators/admins can permanently delete processes

**Permissions:** Creator or Admin only

**Implementation:**

```javascript
export async function deleteProcess(processId, organizationId) {
  await deleteDoc(doc(db, 'processes', processId));
  
  // Update org stats
  await updateDoc(doc(db, 'organizations', organizationId), {
    'stats.processes_count': increment(-1),
    'stats.active_processes': increment(-1)
  });
}
```

**UI:** Button in `EditProcessDialog` → Confirmation → Delete

**Warning:** No soft delete implemented (permanent)

### 4. Search, Filter & Persistence

**Description:** Users can filter, search and have their view preferences persisted.

**Implementation:**

**File:** `src/components/organization/ProcessTable.jsx`  
**Hook:** `useUserPreferences`

**4.1 Persistence:**
- Sort configuration and current page are saved to Firestore under `userPreferences/{user_id}`.
- Data is restored on mount, ensuring a consistent experience across sessions.

**4.2 Date Range Filtering (De/Até):**
- Users can filter by period for all process dates.
- Exact match: If only "De" is provided.
- Range match: If "De" and "Até" are provided.

**4.3 Natural Sorting:**
- The `process_number` uses a natural numeric collator for logical ordering (SIM 1 before SIM 10).

**4.4 Filter Options:**
- **By Status:** Refined list (Pendente, Em elaboração, Em revisão, Para revisão, Na pasta).
- **By Responsible:** All members.
- **Search:** Process number, consultant, or location (case-insensitive).

**Performance:** Client-side filtering for <1000 processes. For larger datasets, implement server-side pagination.

### 5. Urgency Marking

**Description:** Mark processes as urgent for priority handling

**Implementation:**

**Field:** `urgency_request: boolean`

**UI Indicators:**
- Red badge "SIM" in table
- Separate count in Dashboard KPI
- Filter option in ProcessControl

**Use Case:** Processes requiring immediate attention

### 6. Workflow Tracking

**Description:** Track process through various stages

Lifecycle Stages:**

```
Entry Date
    ↓
Distribution Date → Assigned to Responsible User
    ↓
Analysis Start Date → In Analysis
    ↓
Review Submission Date → Sent for Review
    ↓
Review Return Date → Review Complete
    ↓
Archived Date → Process Complete
```

**Tracked Dates:**
- `entry_date`: Process received
- `distribution_date`: Assigned to user
- `analysis_start_date`: Analysis begun
- `review_submission_date`: Sent to reviewer
- `review_return_date`: Returned from review
- `archived_date`: Finalized/archived

**Status Field:**
- Manually set by users
- Common values: "Em triagem", "Pendente", "Em elaboração", "Em revisão", "Para revisão", "Na pasta"
- Used for filtering and analytics

---

## Dashboard & Analytics

### 1. KPI Cards

**Description:** High-level metrics for quick overview

**File:** `src/pages/Dashboard.jsx`

**Metrics:**

#### Total Processos
**Calculation:** Count of all processes in selected organization

```javascript
const totalProcessos = processes.length;
```

#### Processos Urgentes
**Calculation:** Count of  processes with `urgency_request === true` and not archived

```javascript
const processosUrgentes = processes.filter(
  p => p.urgency_request && p.status !== 'Na pasta'
).length;
```

#### Meus Processos
**Calculation:** Count of processes assigned to current user

```javascript
const meusProcessos = processes.filter(
  p => p.responsible_user_id === user.uid
).length;
```

#### Membros
**Calculation:** Count of organization members

```javascript
const membrosCount = organizations.find(
  o => o.id === selectedOrgId
)?.stats.members_count || 0;
```

**Visual Design:**
- Gradient background (indigo to violet)
- Icon for each metric
- Large number display

### 2. Charts

**Description:** Visual analytics for process distribution

**Library:** Recharts v2.15.0

**Charts Implemented:**

#### 2.1 Distribution by Status (Pie Chart)

**File:** `src/pages/Dashboard.jsx`

```javascript
const statusData = [
  { name: 'Em triagem', value: processes.filter(p => p.status === 'Em triagem').length },
  { name: 'Em elaboração', value: processes.filter(p => p.status === 'Em elaboração').length },
  { name: 'Em revisão', value: processes.filter(p => p.status === 'Em revisão').length },
  { name: 'Na pasta', value: processes.filter(p => p.status === 'Na pasta').length },
];
```

**Colors:** Distinct colors for each status

#### 2.2 Volume by Location (Bar Chart)

**File:** `src/components/organization/IntelligentSummary.jsx`

```javascript
const processesPerLocation = {};
processes.forEach(p => {
  const location = p.location || 'Não informado';
  processesPerLocation[location] = (processesPerLocation[location] || 0) + 1;
});
const locationData = Object.entries(processesPerLocation)
  .map(([name, count]) => ({ name, processos: count }))
  .sort((a, b) => b.processos - a.processos)
  .slice(0, 10); // Top 10
```

**Display:** Horizontal bar chart

### 3. Performance Metrics

**Description:** Analyze team/individual performance

**File:** `src/components/organization/IntelligentSummary.jsx`

**Metrics:**

#### Completion Rate
**Calculation:**

```javascript
const totalProcesses = processes.length;
const finishedProcesses = processes.filter(p => p.status === 'Na pasta').length;
const completionRate = totalProcesses > 0 
  ? ((finishedProcesses / totalProcesses) * 100).toFixed(1) 
  : 0;
```

#### Average Review Time
**Calculation:** Average days from analysis start to review submission

```javascript
const reviewTimes = processes
  .filter(p => p.analysis_start_date && p.review_submission_date)
  .map(p => {
    const start = new Date(p.analysis_start_date);
    const submission = new Date(p.review_submission_date);
    return Math.floor((submission - start) / (1000 * 60 * 60 * 24));
  });
  
const avgReviewTime = reviewTimes.length > 0 
  ? (reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length).toFixed(1)
  : 0;
```

#### Per-Responsible Performance
**Display:** Progress bars showing completion rate for each assigned user

```javascript
const processesPerResponsible = {};
const finishedPerResponsible = {};

processes.forEach(p => {
  const responsible = p.responsible_user_name || 'Não atribuído';
  processesPerResponsible[responsible] = (processesPerResponsible[responsible] || 0) + 1;
  if (p.status === 'Na pasta') {
    finishedPerResponsible[responsible] = (finishedPerResponsible[responsible] || 0) + 1;
  }
});

const responsiblePerformance = Object.entries(processesPerResponsible).map(([name, total]) => ({
  name,
  total,
  concluídos: finishedPerResponsible[name] || 0,
  taxa: total > 0 ? ((finishedPerResponsible[name] || 0) / total * 100).toFixed(1) : 0
}));
```

---

## User Profile

### 1. Edit Profile

**Description:** Users can update their profile information

**File:** `src/pages/Profile.jsx`

**Editable Fields:**

#### Platform Name
**Field:** `platform_name`  
**Purpose:** Display name used throughout the app  
**Default:** From Google profile (`full_name`)

#### Function
** Field:** `function`  
**Purpose:** User's role/position  
**Options:** Dropdown (secretaria, assessoria, decisória, outro)  
**Default:** Empty

#### Notification Email   
**Field:** `notification_email`  
**Purpose:** Alternative email for notifications  
**Default:** Same as login email

**Implementation:**

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    platform_name: formData.platform_name,
    function: formData.function,
    notification_email: formData.notification_email,
    updated_at: serverTimestamp()
  });
  toast.success('Perfil atualizado');
};
```

**Validation:**
- Platform name required
- Notification email must be valid email format (or empty)

---

## UI/UX Features

### 1. Responsive Design

**Breakpoints:**
- Mobile: `<768px`
- Tablet: `768px - 1024px`
- Desktop: `>1024px`

**Implementation:** Tailwind CSS responsive classes

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Mobile: 1 column, Tablet: 2 columns, Desktop: 4 columns */}
</div>
```

### 2. Loading States

**Pattern:** Show spinner while fetching data

```javascript
if (isLoading) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
```

### 3. Error States

**Pattern:** Show user-friendly error message

```javascript
if (error) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
```

### 4. Toast Notifications

**Library:** Sonner

**Usage:**

```javascript
import { toast } from 'sonner';

// Success
toast.success('Processo criado com sucesso!');

// Error
toast.error('Erro ao criar processo: ' + error.message);

// Info
toast.info('Código copiado para área de transferência');
```

### 5. Dialogs/Modals

**Library:** Radix UI Dialog

**Pattern:**

```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### 6. Confirmation Dialogs

**Pattern:** Native browser confirm for destructive actions

```javascript
const handleDelete = () => {
  if (window.confirm('Tem certeza que deseja excluir?')) {
    deleteProcess(processId);
  }
};
```

---

## Future Features

### Planned Enhancements

1. **Excel/CSV Import** (Priority: P2)
   - Bulk import processes from spreadsheet
   - Validation and error reporting
   - Progress tracking
   - **Requires:** Cloud Functions + Cloud Storage

2. **Real-Time Collaboration** (Priority: P2)
   - Show who's viewing/editing a process
   - Live updates without refresh
   - **Requires:** Firestore real-time listeners optimization

3. **Email Notifications** (Priority: P3)
   - Notify on process assignment
   - Daily digest of urgent processes
   - **Requires:** Cloud Functions + SendGrid/similar

4. **Advanced Search** (Priority: P2)
   - Full-text search across all fields
   - Date range filters
   - Saved searches
   - **Requires:** Algolia or similar search service

5. **Audit Log** (Priority: P2)
   - Track all changes to processes
   - Who changed what and when
   - **Requires:** Additional Firestore collection + UI

6. **Custom Reports** (Priority: P3)
   - Generate PDF reports
   - Customizable templates
   - **Requires:** Cloud Functions + PDF library

7. **Mobile App** (Priority: P3)
   - React Native app
   - Offline support
   - **Requires:** Significant development

---

## Feature Configuration

### Feature Flags (Future)

For gradual rollout of new features:

```javascript
// src/config/features.js
export const FEATURES = {
  EXCEL_IMPORT: false,
  EMAIL_NOTIFICATIONS: false,
  ADVANCED_SEARCH: false,
  AUDIT_LOG: false
};
```

---

## Conclusion

The CAOCIPP platform provides comprehensive process management with:
- ✅ **22 implemented features** covering authentication, organizations, processes, and analytics
- ✅ **Secure, role-based access control**
- ✅ **Intuitive UI with proper loading/error states**
- ✅ **Real-time data updates**
- ✅ **Responsive design**

For implementation details:
- Architecture → `ARCHITECTURE_REFERENCE.md`
- Security → `SECURITY_REFERENCE.md`
- Design → `DESIGN_SYSTEM_REFERENCE.md`
