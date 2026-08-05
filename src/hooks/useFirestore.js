// Firestore Hooks - Custom React hooks for data fetching with Firebase
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    onSnapshot
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { logger } from '@/utils/logger';
import { getUserPreferences, saveUserPreferences } from '@/services/firestoreService';
import { formatPersonName } from '@/utils/nameUtils';

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

        // Guarda contra respostas fora de ordem: se a listener disparar de novo
        // antes do Promise.all da rodada anterior terminar, a rodada antiga não
        // pode sobrescrever o resultado da mais nova quando resolver por último.
        let requestId = 0;

        // Real-time listener for memberships
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const currentRequest = ++requestId;
            try {
                if (snapshot.empty) {
                    if (currentRequest !== requestId) return;
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
                            userPermissions: membership.permissions || {},
                            userName: formatPersonName(membership.user_name || ''),
                            userActive: membership.active // Should be true or undefined
                        };
                    }
                    return null;
                });

                const orgs = (await Promise.all(orgPromises)).filter(Boolean);
                if (currentRequest !== requestId) return;
                setOrganizations(orgs);
                setIsLoading(false);
            } catch (err) {
                if (currentRequest !== requestId) return;
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
export function useProcesses(organizationId, filters = {}, options = {}) {
    const [processes, setProcesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    // limitTo: quando definido (> 0), aplica limit() na consulta (flag db_pagination).
    // Sem limitTo => comportamento atual (coleção inteira).
    const limitTo = (typeof options.limitTo === 'number' && options.limitTo > 0)
        ? options.limitTo
        : null;

    useEffect(() => {
        if (!organizationId) {
            setProcesses([]);
            setHasMore(false);
            setIsLoading(false);
            return;
        }

        // Limpa os dados do órgão anterior imediatamente: sem isto, ao trocar
        // de órgão, os processos antigos ficam visíveis até a nova consulta
        // resolver — um vazamento momentâneo de dados de outro órgão.
        setProcesses([]);
        setIsLoading(true);
        setError(null);

        const processesRef = collection(db, 'processes');
        let q;
        const constraints = [];

        // Apply filters - Note: In Firestore, we need to be careful with composite queries and onSnapshot
        if (filters.status) {
            constraints.push(where('organization_id', '==', organizationId), where('status', '==', filters.status), orderBy('entry_date', 'desc'));
        } else if (filters.responsible_user_id) {
            constraints.push(where('organization_id', '==', organizationId), where('responsible_user_id', '==', filters.responsible_user_id), orderBy('updated_at', 'desc'));
        } else if (filters.urgency_request !== undefined) {
            constraints.push(where('organization_id', '==', organizationId), where('urgency_request', '==', filters.urgency_request), orderBy('status', 'asc'));
        } else {
            constraints.push(where('organization_id', '==', organizationId), orderBy('updated_at', 'desc'));
        }
        if (limitTo) constraints.push(limit(limitTo));
        q = query(processesRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const processesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProcesses(processesData);
            setHasMore(limitTo ? snapshot.size >= limitTo : false);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to processes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, JSON.stringify(filters), limitTo]);

    return { processes, isLoading, error, hasMore };
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

        // Limpa a lista do órgão anterior e ignora uma resposta que chegue
        // fora de ordem (troca rápida de órgão A→B→A) — sem isto, os membros
        // de outro órgão ficam visíveis até esta busca pontual resolver.
        let cancelled = false;
        setMembers([]);

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
                if (cancelled) return;
                const membersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    user_name: formatPersonName(doc.data()?.user_name || '')
                }));

                setMembers(membersData);
                setIsLoading(false);
            } catch (err) {
                if (cancelled) return;
                logger.error('Error fetching members:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        fetchMembers();
        return () => { cancelled = true; };
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

        // Limpa o órgão anterior imediatamente para não exibir dados de outro
        // órgão enquanto a nova consulta ainda não resolveu.
        setOrganization(null);
        setIsLoading(true);

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
    // Espelha `preferences` sem entrar nas deps de updatePreferences: se
    // `preferences` fosse dependência, a identidade da função mudaria a cada
    // atualização otimista, disparando de novo os efeitos de auto-save que a
    // têm como dependência (ProcessTable/ExpedienteTable/KanbanBoard).
    const preferencesRef = useRef(preferences);
    preferencesRef.current = preferences;

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

        // Ignora uma resposta que chegue fora de ordem (ex.: troca rápida de
        // conta), que sobrescreveria as preferências do usuário atual com as
        // de outro.
        let cancelled = false;

        const fetchPreferences = async () => {
            setIsLoading(true);
            const prefs = await getUserPreferences(user.uid);
            if (cancelled) return;
            setPreferences(prefs);
            setIsLoading(false);
        };

        fetchPreferences();
        return () => { cancelled = true; };
    }, [user, isLoadingAuth]);

    const updatePreferences = useCallback(async (newPrefs) => {
        if (!user) return;

        const previous = preferencesRef.current;
        // Optimistic update
        setPreferences(prev => ({ ...prev, ...newPrefs }));

        try {
            await saveUserPreferences(user.uid, newPrefs);
        } catch (error) {
            // Reverte: sem isto, a tela ficava mostrando uma preferência que
            // na verdade não foi salva, sem nenhum aviso ao usuário.
            setPreferences(previous);
            toast.error('Não foi possível salvar a preferência. Tente novamente.');
        }
    }, [user?.uid]);

    return { preferences, updatePreferences, isLoading };
}

/**
 * Hook to fetch expedientes for a specific organization (real-time)
 * @param {string} organizationId - Organization ID
 */
export function useExpedientes(organizationId, options = {}) {
    const [expedientes, setExpedientes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    const limitTo = (typeof options.limitTo === 'number' && options.limitTo > 0)
        ? options.limitTo
        : null;

    useEffect(() => {
        if (!organizationId) {
            setExpedientes([]);
            setHasMore(false);
            setIsLoading(false);
            return;
        }

        // Limpa os dados do órgão anterior imediatamente (mesma razão de
        // useProcesses): evita mostrar expedientes de outro órgão até a nova
        // consulta resolver.
        setExpedientes([]);
        setIsLoading(true);
        setError(null);

        const expedientesRef = collection(db, 'expedientes');
        const constraints = [
            where('organization_id', '==', organizationId),
            orderBy('updated_at', 'desc')
        ];
        if (limitTo) constraints.push(limit(limitTo));
        const q = query(expedientesRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expedientesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpedientes(expedientesData);
            setHasMore(limitTo ? snapshot.size >= limitTo : false);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to expedientes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, limitTo]);

    return { expedientes, isLoading, error, hasMore };
}

/**
 * Hook to fetch processes assigned to a user in a specific organization (real-time)
 */
export function useMyProcesses(organizationId, userId) {
    const [processes, setProcesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId || !userId) {
            setProcesses([]);
            setIsLoading(false);
            return;
        }

        setProcesses([]);
        setIsLoading(true);
        setError(null);

        const processesRef = collection(db, 'processes');
        const q = query(
            processesRef,
            where('organization_id', '==', organizationId),
            where('responsible_user_id', '==', userId),
            orderBy('updated_at', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProcesses(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to my processes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, userId]);

    return { processes, isLoading, error };
}

/**
 * Hook to fetch expedientes assigned to a user in a specific organization (real-time)
 */
export function useMyExpedientes(organizationId, userId) {
    const [expedientes, setExpedientes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId || !userId) {
            setExpedientes([]);
            setIsLoading(false);
            return;
        }

        setExpedientes([]);
        setIsLoading(true);
        setError(null);

        const expedientesRef = collection(db, 'expedientes');
        const q = query(
            expedientesRef,
            where('organization_id', '==', organizationId),
            where('responsible_user_id', '==', userId),
            orderBy('updated_at', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setExpedientes(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to my expedientes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, userId]);

    return { expedientes, isLoading, error };
}

/**
 * Hook to fetch organization names mapped by user id
 */
export function useOrganizationUserNameMap(organizationId) {
    const [nameMap, setNameMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setNameMap({});
            setIsLoading(false);
            return;
        }

        setNameMap({});
        setIsLoading(true);
        setError(null);

        const membershipsRef = collection(db, 'userOrganizations');
        const q = query(
            membershipsRef,
            where('organization_id', '==', organizationId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const map = {};
            snapshot.docs.forEach((membershipDoc) => {
                const membership = membershipDoc.data();
                if (membership?.user_id) {
                    map[membership.user_id] = formatPersonName(membership.user_name || '');
                }
            });
            setNameMap(map);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to organization user names:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId]);

    return { nameMap, isLoading, error };
}

/**
 * Hook to fetch Parcerias (Convênio, Termo de Cooperação, Termo de Fomento)
 * for a specific organization in real-time. Espelha useExpedientes.
 *
 * Resiliência: faz fallback automático para uma query SEM orderBy se o índice
 * composto (organization_id, updated_at) ainda não estiver sido criado/propagado
 * no Firestore. Sem isso, a UI fica vazia sem nenhum sinal do problema.
 */
export function useParcerias(organizationId, options = {}) {
    const [parcerias, setParcerias] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    const limitTo = (typeof options.limitTo === 'number' && options.limitTo > 0)
        ? options.limitTo
        : null;

    useEffect(() => {
        if (!organizationId) {
            setParcerias([]);
            setHasMore(false);
            setIsLoading(false);
            return;
        }
        setParcerias([]);
        setIsLoading(true);
        setError(null);

        const parceriasRef = collection(db, 'parcerias');

        // 1ª tentativa: query completa com orderBy (requer índice composto).
        // 2ª tentativa (fallback): apenas where — funciona sem índice composto,
        // e mostra a Parceria recém-criada mesmo antes do índice propagar.
        const tryQuery = (withOrder, attempt = 0) => {
            const constraints = [
                where('organization_id', '==', organizationId),
            ];
            if (withOrder) constraints.push(orderBy('updated_at', 'desc'));
            if (limitTo) constraints.push(limit(limitTo));
            const q = query(parceriasRef, ...constraints);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Se a query com orderBy retornar vazio mas o fallback trouxer
                // resultados, sabemos que é um problema de índice.
                if (withOrder && data.length === 0 && attempt === 0) {
                    unsubscribe();
                    tryQuery(false, 1);
                    return;
                }
                setParcerias(data);
                setHasMore(limitTo ? snapshot.size >= limitTo : false);
                setIsLoading(false);
            }, (err) => {
                // Erro típico: "The query requires an index". Faz fallback.
                if (withOrder && attempt === 0 && err && /index/i.test(err.message || '')) {
                    logger.warn('[useParcerias] índice composto ausente, usando fallback sem orderBy:', err.message);
                    tryQuery(false, 1);
                    return;
                }
                logger.error('Error listening to parcerias:', err);
                setError(err.message);
                setIsLoading(false);
            });

            return unsubscribe;
        };

        const unsubscribe = tryQuery(true);
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [organizationId, limitTo]);

    return { parcerias, isLoading, error, hasMore };
}

/**
 * Hook to fetch all aditivos (subcollection) of a Parceria in real-time.
 * Returns aditivos sorted by aditivo_number ascending.
 */
export function useAditivos(parceriaId, enabled = true) {
    const [aditivos, setAditivos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!parceriaId || !enabled) {
            setAditivos([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);

        const aditivosRef = collection(db, 'parcerias', parceriaId, 'aditivos');
        const q = query(aditivosRef, orderBy('aditivo_number', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setAditivos(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to aditivos:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [parceriaId, enabled]);

    return { aditivos, isLoading, error };
}
