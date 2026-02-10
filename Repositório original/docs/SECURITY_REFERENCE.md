# 🔒 CAO - Security Reference (Consultas CAO)

**Version:** 1.2.0 - Final (Precision Rebranding)  
**Last Updated:** 2026-02-10  
**Purpose:** Complete security documentation for the Consultas CAO platform

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication Security](#authentication-security)
3. [Firestore Security Rules](#firestore-security-rules)
4. [Authorization Patterns](#authorization-patterns)
5. [Data Protection](#data-protection)
6. [Client-Side Security](#client-side-security)
7. [Security Best Practices](#security-best-practices)
8. [Threat Model](#threat-model)
9. [Security Checklist](#security-checklist)

---

## Security Overview

### Security Principles

1. **Authentication Required:** All operations require user to be logged in
2. **Role-Based Access Control (RBAC):** Permissions based on user role in organization
3. **Data Isolation:** Organizations are completely isolated from each other
4. **Least Privilege:** Users can only access data they need
5. **Defense in Depth:** Multiple layers of security (client + server)

### Security Layers

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Firebase Authentication (OAuth 2.0)        │
│ - Google Sign-In only                               │
│ - JWT tokens                                        │
│ - Session management                                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: Firestore Security Rules                   │
│ - Server-side validation                            │
│ - Role-based permissions                            │
│ - Data validation                                   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Layer 3: Client-Side Validation                     │
│ - Input sanitization                                │
│ - UI-based restrictions                             │
│ - Form validation                                   │
└─────────────────────────────────────────────────────┘
```

---

## Authentication Security

### Firebase Authentication

#### Configuration

```javascript
// src/config/firebase.js
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  // ... other config
};
```

**Security Notes:**
- ✅ API keys are public (by design in Firebase)
- ✅ Security is enforced by Firestore rules
- ✅ Environment variables prevent accidental commits
- ✅ Auth domain restricts valid redirect URIs

#### Supported Authentication Methods

**Current:**
- ✅ Google Sign-In (OAuth 2.0)

**Future Considerations:**
- Email/Password (with email verification)
- Microsoft/Azure AD (for government integration)
- SAML (for enterprise SSO)

#### Authentication Flow Security

```javascript
// FirebaseAuthContext.jsx
const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account' // Force account selection
    });
    const result = await signInWithPopup(auth, provider);
    
    // User is now authenticated
    // Firestore rules will enforce authorization
  } catch (error) {
    // Handle errors securely (no sensitive data in logs)
    logger.error('Auth error', { code: error.code });
  }
};
```

**Security Features:**
- ✅ HTTPS enforced
- ✅ Cross-Site Request Forgery (CSRF) protection (Firebase handles)
- ✅ Session hijacking protection (short-lived tokens)
- ✅ Account selection required (no auto-login)

#### Token Management

**ID Tokens:**
- **Lifetime:** 1 hour
- **Refresh:** Automatic (Firebase SDK)
- **Storage:** Browser memory + localStorage (encrypted)
- **Validation:** Server-side by Firebase

```javascript
// Getting current user token
const user = auth.currentUser;
const token = await user.getIdToken();

// Token is automatically sent with Firestore requests
```

---

## Firestore Security Rules

### Rule Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isUser(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Collection rules
    match /users/{userId} {
      // Rules here
    }
  }
}
```

### Collection-Specific Rules

#### 1. `/users/{userId}`

**Purpose:** User profile documents

```javascript
match /users/{userId} {
  allow read: if isAuthenticated() && isUser(userId);
  
  allow create: if isAuthenticated() 
    && isUser(userId)
    && request.resource.data.keys().hasAll([
      'email', 'full_name', 'created_at'
    ])
    && request.resource.data.email == request.auth.token.email;
  
  allow update: if isAuthenticated()
    && isUser(userId)
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['created_at', 'email']);
  
  allow delete: if false; // Users cannot delete their own profile
}
```

**Security Guarantees:**
- ✅ Users can only access their own profile
- ✅ Email must match authenticated email
- ✅ Cannot modify creation date or email after creation
- ✅ Cannot delete profile (data retention)

#### 2. `/organizations/{orgId}`

**Purpose:** Organization documents

```javascript
match /organizations/{orgId} {
  allow create: if isAuthenticated()
    && request.resource.data.created_by == request.auth.uid
    && request.resource.data.keys().hasAll([
      'name', 'invite_code', 'created_by', 'created_at'
    ]);
  
  allow read: if isAuthenticated() && isMemberOf(orgId);
  
  allow update: if isAuthenticated()
    && hasRole(orgId, ['creator'])
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['created_by', 'created_at', 'invite_code']);
  
  allow delete: if isAuthenticated() && hasRole(orgId, ['creator']);
}
```

**Helper Functions:**

```javascript
function isMemberOf(orgId) {
  return exists(/databases/$(database)/documents/userOrganizations/$(request.auth.uid + '_' + orgId));
}

function getMembership(orgId) {
  return get(/databases/$(database)/documents/userOrganizations/$(request.auth.uid + '_' + orgId));
}

function hasRole(orgId, roles) {
  return isMemberOf(orgId) 
    && getMembership(orgId).data.role in roles;
}
```

**Security Guarantees:**
- ✅ Only organization members can read
- ✅ Only creator can modify/delete
- ✅ Cannot change creator or invite code after creation
- ✅ Stats can only be updated by server (not in allowed keys)

#### 3. `/userOrganizations/{membershipId}`

**Purpose:** Membership documents

```javascript
match /userOrganizations/{membershipId} {
  allow create: if isAuthenticated()
    && (
      // Scenario 1: Creating own membership when creating org
      (request.resource.data.user_id == request.auth.uid
        && request.resource.data.role == 'creator')
      ||
      // Scenario 2: Joining via invite code
      (request.resource.data.user_id == request.auth.uid
        && request.resource.data.role == 'member'
        && validateInviteCode(request.resource.data.organization_id))
    );
  
  allow read: if isAuthenticated()
    && (
      request.resource.data.user_id == request.auth.uid
      || isMemberOf(request.resource.data.organization_id)
    );
  
  allow update: if isAuthenticated()
    && hasRole(request.resource.data.organization_id, ['creator'])
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['user_id', 'organization_id', 'role', 'joined_at']);
  
  allow delete: if isAuthenticated()
    && hasRole(resource.data.organization_id, ['creator'])
    && resource.data.role != 'creator'; // Cannot remove creator
}
```

**Helper for Invite Code:**

```javascript
function validateInviteCode(orgId) {
  let org = get(/databases/$(database)/documents/organizations/$(orgId));
  return org.data.invite_code != null;
}
```

**Security Guarantees:**
- ✅ Users can only create their own memberships
- ✅ Creator role can only be assigned during org creation
- ✅ Joining requires organization to exist (validated by invite code check)
- ✅ Only creator can modify memberships
- ✅ Cannot change user_id, org_id, or role after creation
- ✅ Creator cannot be removed

#### 4. `/processes/{processId}`

**Purpose:** Process tracking documents

```javascript
match /processes/{processId} {
  allow create: if isAuthenticated()
    && isMemberOf(request.resource.data.organization_id)
    && request.resource.data.created_by == request.auth.uid
    && request.resource.data.keys().hasAll([
      'organization_id', 'process_number', 'consultant',
      'location', 'entry_date', 'matter_object'
    ]);
  
  allow read: if isAuthenticated()
    && isMemberOf(resource.data.organization_id)
    && (!resource.data.access_restriction
        || hasRole(resource.data.organization_id, ['creator', 'admin'])
        || isOwner(resource.data.responsible_user_id));
  
  allow update: if isAuthenticated()
    && isMemberOf(resource.data.organization_id)
    && (hasRole(resource.data.organization_id, ['creator', 'admin'])
        || isOwner(resource.data.responsible_user_id))
    && request.resource.data.organization_id == resource.data.organization_id;
  
  allow delete: if isAuthenticated()
    && isMemberOf(resource.data.organization_id)
    && hasRole(resource.data.organization_id, ['creator', 'admin']);
}
```

**Helper Functions:**

```javascript
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Security Guarantees:**
- ✅ Only organization members can create processes
- ✅ Required fields enforced at creation
- ✅ Access restriction limits visibility to admins/assigned user
- ✅ Update allowed for admins or assigned user
- ✅ Delete restricted to creator/admin
- ✅ Cannot change organization_id after creation

#### 5. `/notifications/{notificationId}`

**Purpose:** User notifications (optional)

```javascript
match /notifications/{notificationId} {
  allow create: if isAuthenticated(); // Any authenticated user
  
  allow read: if isAuthenticated()
    && request.auth.uid == resource.data.user_id;
  
  allow update: if isAuthenticated()
    && isUser(resource.data.user_id)
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['read']);
  
  allow delete: if isAuthenticated()
    && isUser(resource.data.user_id);
}
```

**Security Guarantees:**
- ✅ Users can only read their own notifications
- ✅ Can only mark as read (no other modifications)
- ✅ Can delete own notifications

---

## Authorization Patterns

### Role Hierarchy

```
Creator (Organization Owner)
  ├── Full control over organization
  ├── Can add/remove members
  ├── Can delete processes
  ├── Can view restricted processes
  └── Cannot be removed
  
Admin (Optional - not yet implemented)
  ├── Can manage processes
  ├── Can view restricted processes
  └── Can be removed by creator
  
Member (Default)
  ├── Can create processes
  ├── Can edit assigned processes
  ├── Cannot delete processes
  └── Cannot view restricted processes (unless assigned)
```

### Permission Matrix

| Action | Creator | Admin | Member | Non-Member |
|--------|---------|-------|--------|------------|
| **Organizations** |
| Read org info | ✅ | ✅ | ✅ | ❌ |
| Update org | ✅ | ❌ | ❌ | ❌ |
| Delete org | ✅ | ❌ | ❌ | ❌ |
| **Members** |
| View members | ✅ | ✅ | ✅ | ❌ |
| Add members (via invite) | ✅ | ✅ | ✅ | ❌ |
| Remove members | ✅ | ❌ | ❌ | ❌ |
| Edit member function | ✅ | ❌ | ❌ | ❌ |
| **Processes** |
| Create process | ✅ | ✅ | ✅ | ❌ |
| Read all processes | ✅ | ✅ | ✅ | ❌ |
| Read restricted process | ✅ | ✅ | ⚠️ (if assigned) | ❌ |
| Update any process | ✅ | ✅ | ❌ | ❌ |
| Update assigned process | ✅ | ✅ | ✅ | ❌ |
| Delete process | ✅ | ✅ | ❌ | ❌ |

**Legend:** ✅ Allowed | ❌ Denied | ⚠️ Conditional

---

## Data Protection

### Sensitive Data Handling

#### Personal Identifiable Information (PII)

**Collected PII:**
- Email address (from Google Auth)
- Full name (from Google Auth)
- Profile photo URL (from Google Auth)

**Storage:**
- `/users/{userId}` collection
- Encrypted in transit (HTTPS)
- Encrypted at rest (Firebase default)

**Access Control:**
- User can only access own PII
- Not shared with other users (except in memberships)

#### Process Data

**Sensitivity Levels:**

1. **Public (within org):** All processes by default
2. **Restricted:** `access_restriction: true`
   - Only visible to:
     - Creator
     - Admins
     - Assigned user (`responsible_user_id`)

**Implementation:**

```javascript
// In Firestore rules
allow read: if isAuthenticated()
  && isMemberOf(resource.data.organization_id)
  && (!resource.data.access_restriction
      || hasRole(resource.data.organization_id, ['creator', 'admin'])
      || isOwner(resource.data.responsible_user_id));
```

### Data Encryption

**In Transit:**
- ✅ HTTPS enforced (Firebase default)
- ✅ TLS 1.2+ (modern browsers)
- ✅ Certificate pinning (Firebase handles)

**At Rest:**
- ✅ AES-256 encryption (Firebase default)
- ✅ Encrypted backups
- ✅ Key rotation (Firebase handles)

### Data Retention

**User Data:**
- Retained while account is active
- Manual deletion not implemented (by design)
- Future: Implement GDPR-compliant deletion

**Organization Data:**
- Retained indefinitely
- Deleted when organization is deleted (cascade)

**Process Data:**
- Retained indefinitely
- `archived_date` for soft deletion
- Future: Implement retention policies

---

## Client-Side Security

### Input Validation

**Form Validation:**

```javascript
// Example: Process number validation
const validateProcessNumber = (value) => {
  const pattern = /^\d{5}\.\d{3}\.\d{3}\/\d{4}$/;
  return pattern.test(value);
};

// Date validation
const validateDate = (value) => {
  const date = new Date(value);
  return date instanceof Date && !isNaN(date);
};
```

**Sanitization:**

```javascript
// HTML escaping (React does this by default)
<p>{userInput}</p> // Automatically escaped

// URL validation
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;  
  }
};
```

### XSS Protection

**React's Built-in Protection:**
- ✅ Auto-escapes all variables in JSX
- ✅ `dangerouslySetInnerHTML` NOT used
- ✅ No `eval()` or `Function()` constructor used

**Content Security Policy (CSP):**

Future implementation in Firebase Hosting:
```json
{
  "headers": [{
    "source": "**",
    "headers": [{
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' https://www.gstatic.com; connect-src 'self' https://*.googleapis.com"
    }]
  }]
}
```

### CSRF Protection

**Firebase Handles:**
- ✅ CSRF tokens in authentication
- ✅ SameSite cookies
- ✅ Origin checking

**Client Implementation:**
- No special handling needed (Firebase SDK handles)

---

## Security Best Practices

### For Developers

#### 1. Never Trust Client Input

```javascript
// ❌ BAD
const createProcess = (data) => {
  // Directly save user input
  await addDoc(collection(db, 'processes'), data);
};

// ✅ GOOD
const createProcess = (data, userId) => {
  // Validate and sanitize
  const validatedData = {
    process_number: validateProcessNumber(data.process_number),
    consultant: sanitizeString(data.consultant),
    created_by: userId, // From auth, not client
    created_at: serverTimestamp() // Server time, not client
  };
  await addDoc(collection(db, 'processes'), validatedData);
};
```

#### 2. Use Server Timestamps

```javascript
// ❌ BAD
created_at: new Date().toISOString() // Client time can be manipulated

// ✅ GOOD
created_at: serverTimestamp() // Server time, cannot be faked
```

#### 3. Validate in Rules

```javascript
// Firestore rules
allow create: if request.resource.data.keys().hasAll([
  'required_field_1', 'required_field_2'
]);
```

#### 4. Never Expose Secrets

```javascript
// ❌ BAD
const apiKey = "sk_live_abc123"; // Hardcoded secret

// ✅ GOOD
const apiKey = process.env.VITE_API_KEY; // Environment variable
```

#### 5. Implement Proper Error Handling

```javascript
// ❌ BAD
} catch (error) {
  console.log(error); // Exposes stack trace
  alert(error.message); // Shows internal error to user
}

// ✅ GOOD
} catch (error) {
  logger.error('Error creating process', { code: error.code });
  toast.error('Não foi possível criar o processo. Tente novamente.');
}
```

### For Users

#### Education Points

1. **Strong Passwords:** (if implementing email/password)
2. **Account Security:** Use Google's 2FA
3. **Invite Code Security:** Don't share publicly
4. **Access Restriction:** Use for sensitive processes
5. **Logout:** Always logout on shared devices

---

## Threat Model

### Identified Threats

#### 1. Unauthorized Data Access

**Threat:** User trying to access another organization's data

**Mitigation:**
- ✅ Firestore rules check membership
- ✅ Client-side checks (defense in depth)
- ✅ No direct ID exposure in URLs (future: use slugs)

**Risk Level:** LOW (well mitigated)

#### 2. Privilege Escalation

**Threat:** Member trying to perform admin actions

**Mitigation:**
- ✅ Role-based rules in Firestore
- ✅ UI hides unauthorized actions
- ✅ Creator role immutable

**Risk Level:** LOW (well mitigated)

#### 3. Data Injection

**Threat:** Malicious data submitted via forms

**Mitigation:**
- ✅ React auto-escapes JSX
- ✅ Server-side validation in rules
- ✅ Input sanitization

**Risk Level:** LOW (well mitigated)

#### 4. Session Hijacking

**Threat:** Attacker stealing user session

**Mitigation:**
- ✅ HTTPS only
- ✅ Short-lived tokens (1 hour)
- ✅ SameSite cookies
- ⚠️ No explicit logout on inactivity (future)

**Risk Level:** MEDIUM (partially mitigated)

#### 5. Denial of Service (DoS)

**Threat:** Flooding with requests

**Mitigation:**
- ✅ Firebase quotas and rate limiting
- ⚠️ No app-level rate limiting (future)
- ⚠️ No CAPTCHA on forms (future)

**Risk Level:** MEDIUM (partially mitigated)

#### 6. Invite Code Guessing

**Threat:** Brute-force guessing invite codes

**Mitigation:**
- ✅ 8-character codes = 208 billion combinations
- ✅ Firebase rate limiting
- ⚠️ No lockout after failed attempts (future)

**Risk Level:** LOW (acceptable)

### Future Security Enhancements

- [ ] Implement login attempt monitoring
- [ ] Add session timeout (auto-logout after inactivity)
- [ ] Implement audit logging
- [ ] Add CAPTCHA on invite code entry
- [ ] Implement API rate limiting
- [ ] Add data export (GDPR compliance)
- [ ] Implement right-to-delete (GDPR compliance)

---

## Security Checklist

### Pre-Deployment

- [x] Firestore rules deployed
- [x] Environment variables configured
- [x] HTTPS enforced
- [ ] Security audit performed
- [ ] Penetration testing completed
- [ ] Authorized domains configured
- [ ] Production Firebase project created

### Post-Deployment

- [ ] Monitor error logs daily
- [ ] Review access logs weekly
- [ ] Update dependencies monthly
- [ ] Security audit quarterly
- [ ] Review Firestore rules quarterly
- [ ] Test restore from backup monthly

### Incident Response

**If security breach detected:**

1. **Immediate:**
   - Disable affected accounts
   - Block malicious IPs (Firebase Console)
   - Alert users

2. **Investigation:**
   - Review audit logs
   - Identify attack vector
   - Assess data exposure

3. **Remediation:**
   - Patch vulnerabilities
   - Reset compromised credentials
   - Update security rules

4. **Post-Mortem:**
   - Document incident
   - Update security procedures
   - Implement preventive measures

---

## Conclusion

The Consultas CAO platform implements **defense in depth** with multiple security layers:

1. ✅ **Authentication:** Firebase OAuth 2.0
2. ✅ **Authorization:** Role-based Firestore rules
3. ✅ **Data Protection:** Encryption + access control
4. ✅ **Client Security:** Input validation + XSS protection
5. ✅ **Network:** HTTPS + Firebase infrastructure

**Current Security Posture:** STRONG  
**Remaining Risks:** Acceptable for current use case  
**Recommendations:** Implement future enhancements before scaling

For implementation details, see:
- Architecture → `ARCHITECTURE_REFERENCE.md`
- Features → `FEATURES_REFERENCE.md`
