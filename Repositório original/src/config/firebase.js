// Firebase Configuration
// Initialize Firebase app, auth, firestore, and functions

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate configuration
const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
];

const missingVars = requiredEnvVars.filter(
    varName => !import.meta.env[varName]
);

if (missingVars.length > 0 && import.meta.env.PROD) {
    console.error('Missing required Firebase environment variables:', missingVars);
    throw new Error('Firebase configuration is incomplete. Check your .env file.');
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'southamerica-east1'); // São Paulo region
export const googleProvider = new GoogleAuthProvider();

// Configure Google Auth Provider
googleProvider.setCustomParameters({
    prompt: 'select_account', // Always show account selector
});

// Emulator setup for development
if (import.meta.env.DEV) {
    const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

    if (USE_EMULATORS) {
        console.log('🔧 Using Firebase Emulators');

        try {
            connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectFunctionsEmulator(functions, 'localhost', 5001);
        } catch (error) {
            console.warn('Failed to connect to emulators:', error);
        }
    } else {
        console.log('🌐 Using Production Firebase');
    }
}

// Log configuration in development
if (import.meta.env.DEV) {
    console.log('Firebase initialized:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
    });
}

export default app;
