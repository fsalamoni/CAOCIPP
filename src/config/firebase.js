// Firebase Configuration
// Initialize Firebase app, auth, firestore, and functions

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

if (invalidEnvConfigFields.length > 0) {
    const errorMessage = 'Firebase configuration is incomplete or contains placeholder values.';

    if (import.meta.env.PROD) {
        console.error(errorMessage, {
            invalidEnvConfigFields,
        });
        throw new Error(errorMessage);
    }

    console.warn('Invalid or missing VITE Firebase env vars in development.', {
        invalidEnvConfigFields,
    });
}

// Firebase configuration from environment variables.
const firebaseConfig = envFirebaseConfig;

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
