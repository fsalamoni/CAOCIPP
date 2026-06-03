// Firebase Configuration
// Initialize Firebase app, auth, firestore, and functions

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
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

const envFirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfigFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
];

const placeholderConfigPatterns = [
    /^your_/,
    /^sua_/,
    /^seu_/,
    /your-project-id/,
    /your_project_id/,
    /sua_api_key/,
    /seu_project_id/,
];

const isPlaceholderValue = (value) => {
    if (typeof value !== 'string') {
        return false;
    }

    const normalizedValue = value.trim().toLowerCase();
    return placeholderConfigPatterns.some(pattern => pattern.test(normalizedValue));
};

const invalidEnvConfigFields = requiredConfigFields.filter(
    fieldName => !envFirebaseConfig[fieldName] || isPlaceholderValue(envFirebaseConfig[fieldName])
);

const shouldUseFallbackConfig = invalidEnvConfigFields.length > 0;

// Firebase configuration from environment variables.
// If the deployed environment has incomplete/example values, use the official
// project configuration instead of initializing a broken app with no database.
const firebaseConfig = shouldUseFallbackConfig
    ? fallbackFirebaseConfig
    : envFirebaseConfig;

if (shouldUseFallbackConfig && import.meta.env.PROD) {
    console.warn('Invalid or missing VITE Firebase env vars. Using fallback project config.', {
        invalidEnvConfigFields,
    });
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
});
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
