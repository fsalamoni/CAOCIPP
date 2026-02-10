import React, { createContext, useState, useContext, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    signInWithRedirect,
    getRedirectResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/config/firebase';
import { logger } from '@/utils/logger';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Firebase User object
    const [userProfile, setUserProfile] = useState(null); // Firestore user profile
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        // Subscribe to auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    // User is signed in
                    setUser(firebaseUser);
                    setIsAuthenticated(true);

                    // Fetch or create user profile in Firestore
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        // User profile exists
                        setUserProfile({
                            uid: firebaseUser.uid,
                            ...userDoc.data()
                        });

                        // Update last login
                        await setDoc(userDocRef, {
                            last_login: serverTimestamp()
                        }, { merge: true });

                    } else {
                        // Create initial profile for new user
                        const newProfile = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            full_name: firebaseUser.displayName || '',
                            platform_name: firebaseUser.displayName || '',
                            photo_url: firebaseUser.photoURL || '',
                            function: 'member', // Default role
                            created_at: serverTimestamp(),
                            updated_at: serverTimestamp(),
                            last_login: serverTimestamp(),
                        };

                        await setDoc(userDocRef, newProfile);
                        setUserProfile(newProfile);

                        logger.info('New user profile created:', firebaseUser.uid);
                    }
                } else {
                    // User is signed out
                    setUser(null);
                    setUserProfile(null);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                logger.error('Error in auth state change:', error);
                setAuthError({
                    type: 'profile_error',
                    message: error.message,
                    code: error.code
                });
            } finally {
                setIsLoadingAuth(false);
            }
        });

        // Check for redirect result (for mobile/Safari compatibility)
        getRedirectResult(auth)
            .then((result) => {
                if (result) {
                    logger.info('Redirect sign-in successful');
                }
            })
            .catch((error) => {
                logger.error('Redirect sign-in error:', error);
                setAuthError({
                    type: 'redirect_error',
                    message: error.message,
                    code: error.code
                });
                setIsLoadingAuth(false);
            });

        return () => unsubscribe();
    }, []);

    /**
     * Sign in with Google
     * @param {boolean} useRedirect - Use redirect flow instead of popup (better for mobile)
     */
    const signInWithGoogle = async (useRedirect = false) => {
        try {
            setAuthError(null);

            if (useRedirect) {
                // Redirect flow - better for mobile browsers
                await signInWithRedirect(auth, googleProvider);
                // Note: The redirect will happen, onAuthStateChanged will handle the result
            } else {
                // Popup flow - better for desktop
                const result = await signInWithPopup(auth, googleProvider);
                logger.info('Sign-in successful:', result.user.email);
                return result;
            }
        } catch (error) {
            logger.error('Sign-in error:', error);

            // Categorize errors for better UX
            let userMessage = 'Erro ao fazer login com Google.';

            if (error.code === 'auth/popup-closed-by-user') {
                userMessage = 'Login cancelado. Tente novamente.';
            } else if (error.code === 'auth/popup-blocked') {
                userMessage = 'Pop-up bloqueado pelo navegador. Permitapop-ups para este site.';
            } else if (error.code === 'auth/network-request-failed') {
                userMessage = 'Erro de conexão. Verifique sua internet.';
            } else if (error.code === 'auth/unauthorized-domain') {
                userMessage = 'Domínio não autorizado. Entre em contato com o suporte.';
            }

            setAuthError({
                type: 'signin_error',
                message: userMessage,
                code: error.code,
                originalError: error
            });

            throw error;
        }
    };

    /**
     * Sign out current user
     */
    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            logger.info('Sign-out successful');
            setUser(null);
            setUserProfile(null);
            setIsAuthenticated(false);
        } catch (error) {
            logger.error('Sign-out error:', error);
            throw error;
        }
    };

    /**
     * Update user profile in Firestore
     * @param {object} updates - Profile fields to update
     */
    const updateUserProfile = async (updates) => {
        if (!user) {
            throw new Error('No user logged in');
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const updatedData = {
                ...updates,
                updated_at: serverTimestamp()
            };

            await setDoc(userDocRef, updatedData, { merge: true });

            // Update local state
            setUserProfile(prev => ({
                ...prev,
                ...updates
            }));

            logger.info('Profile updated successfully');
        } catch (error) {
            logger.error('Profile update error:', error);
            throw error;
        }
    };

    const value = {
        // Auth state
        user,
        userProfile,
        isAuthenticated,
        isLoadingAuth,
        authError,

        // Actions
        signInWithGoogle,
        signOut,
        updateUserProfile,

        // Helpers
        clearAuthError: () => setAuthError(null),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Hook to use auth context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
