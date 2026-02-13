# Firebase Setup Instructions

## 📋 Prerequisites

- Node.js 18+ installed
- Google account
- Firebase CLI installed: `npm install -g firebase-tools`

---

## 🚀 Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `caocipp` (or your choice)
4. Disable Google Analytics (optional for now)
5. Click "Create project"

### 2. Enable Google Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click **Google** provider
3. Toggle **Enable**
4. Set support email
5. Click **Save**

### 3. Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. **Start in production mode** (we have custom security rules)
4. Select location: **southamerica-east1** (São Paulo)
5. Click **Enable**

### 4. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click **Web app** icon (`</>`)
4. Register app with nickname: `CAOCIPP Web`
5. **Don't** check "Firebase Hosting" yet
6. Copy the `firebaseConfig` object

### 5. Create .env File

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and paste your Firebase config values:
   ```env
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=yourproject
   VITE_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

3. **IMPORTANT:** Verify `.env` is in `.gitignore`

### 6. Initialize Firebase CLI

```powershell
# Login to Firebase
firebase login

# Initialize project
firebase init

# Select:
# - Firestore (rules and indexes)
# - Hosting
# - Functions

# When asked "What do you want to use as your public directory?":
# Answer: dist

# When asked about single-page app:
# Answer: Yes

# When asked about GitHub workflow:
# Answer: No (we'll set this up later)
```

### 7. Update .firebaserc

Edit `.firebaserc` and replace `your-project-id-here` with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "caocipp"
  }
}
```

### 8. Deploy Firestore Rules & Indexes

```powershell
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

**Note:** Index creation takes 5-15 minutes. You'll receive an email when done.

### 9. Install Dependencies

```powershell
npm install
```

### 10. Test Locally

```powershell
npm run dev
```

Visit `http://localhost:5173` and test Google login.

---

## 🔧 Optional: Firebase Emulators (for development)

If you want to test without affecting production data:

1. Install emulators:
   ```powershell
   firebase init emulators
   # Select: Authentication, Firestore, Functions
   ```

2. Add to `.env`:
   ```env
   VITE_USE_EMULATORS=true
   ```

3. Start emulators:
   ```powershell
   firebase emulators:start
   ```

4. Run dev server in another terminal:
   ```powershell
   npm run dev
   ```

---

## ✅ Verification Checklist

- [ ] Firebase project created
- [ ] Google Auth enabled
- [ ] Firestore database created (southamerica-east1)
- [ ] .env file created with correct values
- [ ] .env is in .gitignore
- [ ] Firebase CLI initialized
- [ ] .firebaserc updated with project ID
- [ ] Firestore rules deployed
- [ ] Firestore indexes deployed (wait for email)
- [ ] Dependencies installed
- [ ] App runs locally
- [ ] Google login works

---

## 🆘 Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"

**Solution:** Add your domain to authorized domains:
1. Firebase Console > Authentication > Settings
2. Scroll to "Authorized domains"
3. Add `localhost` and your production domain

### "Missing or insufficient permissions"

**Solution:** Firestore rules not deployed yet. Run:
```powershell
firebase deploy --only firestore:rules
```

### "Index not found"

**Solution:** Indexes still building. Check Firebase Console > Firestore > Indexes.
Wait for status to change from "Building" to "Enabled".

### Environment variables not loading

**Solution:** 
1. Verify `.env` file exists in project root
2. Restart dev server: `Ctrl+C` then `npm run dev`
3. Check for typos in variable names (must start with `VITE_`)

---

## 📚 Next Steps

After basic setup is working:
1. Migrate Cloud Functions from Deno to Firebase Functions
2. Update frontend to use Firestore hooks
3. Test all CRUD operations
4. Deploy to Firebase Hosting

---

## 🔗 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
