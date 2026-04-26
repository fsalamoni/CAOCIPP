// Firebase Configuration
// Initialize Firebase app, auth, firestore, and functions

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Official project fallback configuration.
// This avoids production outage if build-time env vars are not available.
const fallbackFirebaseConfig = {
    apiKey: 'AIzaSyAyfzs8Z5hLSteHEbNWLGNbFpVoKqdPk-Q',
    authDomain: 'protagonista-rpg.firebaseapp.com',
    projectId: 'protagonista-rpg',
    storageBucket: 'protagonista-rpg.firebasestorage.app',
    messagingSenderId: '745680303218',
    appId: '1:745680303218:web:7f5df5b7e0b682f0d3feeb',
    measurementId: 'G-CY18T83H6D',
};

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId,
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

const requiredConfigFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
];

const missingConfigFields = requiredConfigFields.filter(
    fieldName => !firebaseConfig[fieldName]
);

if (missingConfigFields.length > 0 && import.meta.env.PROD) {
    console.error('Missing required Firebase environment variables:', missingVars);
    throw new Error('Firebase configuration is incomplete. Check your .env file.');
}

if (missingVars.length > 0 && import.meta.env.PROD) {
    console.warn('Missing VITE Firebase env vars. Using fallback project config.');
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
