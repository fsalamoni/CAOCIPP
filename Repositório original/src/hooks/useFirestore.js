// Firestore Hooks - Custom React hooks for data fetching with Firebase
import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    onSnapshot
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { logger } from '@/utils/logger';
import { getUserPreferences, saveUserPreferences } from '@/services/firestoreService';

/**
 * Hook to fetch user's organizations
 * Returns organizations where user is a member
 */
export function useOrganizations() {
    const { user } = useAuth();
    const [organizations, setOrganizations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) {
            setOrganizations([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const membershipsRef = collection(db, 'userOrganizations');
        const q = query(
            membershipsRef,
            where('user_id', '==', user.uid),
            orderBy('joined_at', 'desc')
        );

        // Real-time listener for memberships
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            try {
                if (snapshot.empty) {
                    setOrganizations([]);
                    setIsLoading(false);
                    return;
                }

                // Get organization details for each membership
                const orgPromises = snapshot.docs.map(async (membershipDoc) => {
                    const membership = membershipDoc.data();
                    const orgRef = doc(db, 'organizations', membership.organization_id);
                    const orgSnapshot = await getDoc(orgRef);

                    if (orgSnapshot.exists()) {
                        // Filter out inactive memberships (soft deleted)
                        if (membership.active === false) return null;

                        return {
                            id: orgSnapshot.id,
                            ...orgSnapshot.data(),
                            userRole: membership.role,
                            userFunction: membership.function,
                            userActive: membership.active // Should be true or undefined
                        };
                    }
                    return null;
                });

                const orgs = (await Promise.all(orgPromises)).filter(Boolean);
                setOrganizations(orgs);
                setIsLoading(false);
            } catch (err) {
                logger.error('Error processing memberships update:', err);
                setError(err.message);
                setIsLoading(false);
            }
        }, (err) => {
            logger.error('Error listening to memberships:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    return { organizations, isLoading, error };
}

/**
 * Hook to fetch processes for a specific organization
 * @param {string} organizationId - Organization ID
 * @param {object} filters - Optional filters (status, responsible_user_id, urgency_request)
 */
export function useProcesses(organizationId, filters = {}) {
    const [processes, setProcesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setProcesses([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const processesRef = collection(db, 'processes');
        let q;

        // Apply filters - Note: In Firestore, we need to be careful with composite queries and onSnapshot
        if (filters.status) {
            q = query(processesRef, where('organization_id', '==', organizationId), where('status', '==', filters.status), orderBy('entry_date', 'desc'));
        } else if (filters.responsible_user_id) {
            q = query(processesRef, where('organization_id', '==', organizationId), where('responsible_user_id', '==', filters.responsible_user_id), orderBy('updated_at', 'desc'));
        } else if (filters.urgency_request !== undefined) {
            q = query(processesRef, where('organization_id', '==', organizationId), where('urgency_request', '==', filters.urgency_request), orderBy('status', 'asc'));
        } else {
            q = query(
                processesRef,
                where('organization_id', '==', organizationId),
                orderBy('updated_at', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const processesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProcesses(processesData);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to processes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, JSON.stringify(filters)]);

    return { processes, isLoading, error };
}

/**
 * Hook to fetch members of an organization
 * @param {string} organizationId - Organization ID
 */
export function useOrganizationMembers(organizationId) {
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setMembers([]);
            setIsLoading(false);
            return;
        }

        const fetchMembers = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const membershipsRef = collection(db, 'userOrganizations');
                const q = query(
                    membershipsRef,
                    where('organization_id', '==', organizationId),
                    orderBy('joined_at', 'desc')
                );

                const snapshot = await getDocs(q);
                const membersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setMembers(membersData);
                setIsLoading(false);
            } catch (err) {
                logger.error('Error fetching members:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchMembers();
    }, [organizationId]);

    return { members, isLoading, error };
}

/**
 * Hook to get real-time updates for a single organization
 * @param {string} organizationId - Organization ID
 */
export function useOrganizationRealtime(organizationId) {
    const [organization, setOrganization] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setOrganization(null);
            setIsLoading(false);
            return;
        }

        const orgRef = doc(db, 'organizations', organizationId);

        // Real-time listener
        const unsubscribe = onSnapshot(
            orgRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setOrganization({
                        id: snapshot.id,
                        ...snapshot.data()
                    });
                } else {
                    setOrganization(null);
                    setError('Organization not found');
                }
                setIsLoading(false);
            },
            (err) => {
                logger.error('Error listening to organization:', err);
                setError(err.message);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [organizationId]);

    return { organization, isLoading, error };
}

/**
 * Hook to fetch user's notifications
 */
export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setUnreadCount(0);
            setIsLoading(false);
            return;
        }

        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('user_id', '==', user.uid),
            where('read', '==', false),
            orderBy('created_at', 'desc')
        );

        // Real-time listener for unread notifications
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const notifs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setNotifications(notifs);
                setUnreadCount(notifs.length);
                setIsLoading(false);
            },
            (err) => {
                logger.error('Error listening to notifications:', err);
                setError(err.message);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    return { notifications, unreadCount, isLoading, error };
}

/**
 * Hook to manage user preferences with persistence
 */
export function useUserPreferences() {
    const { user, isLoadingAuth } = useAuth();
    const [preferences, setPreferences] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // CRITICAL: Don't resolve until auth is done loading.
        // Without this check, user=null during initial auth check causes
        // premature resolution with empty preferences, and ProcessTable
        // marks itself as initialized before real data arrives.
        if (isLoadingAuth) {
            setIsLoading(true);
            return;
        }

        if (!user) {
            setPreferences({});
            setIsLoading(false);
            return;
        }

        const fetchPreferences = async () => {
            setIsLoading(true);
            const prefs = await getUserPreferences(user.uid);
            setPreferences(prefs);
            setIsLoading(false);
        };

        fetchPreferences();
    }, [user, isLoadingAuth]);

    const updatePreferences = useCallback(async (newPrefs) => {
        if (!user) return;

        // Optimistic update
        setPreferences(prev => ({ ...prev, ...newPrefs }));

        // Persistence
        await saveUserPreferences(user.uid, newPrefs);
    }, [user?.uid]);

    return { preferences, updatePreferences, isLoading };
}
