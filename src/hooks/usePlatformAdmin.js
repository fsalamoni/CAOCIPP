// ============================================================================
// usePlatformAdmin - Identidade de super-administrador da plataforma
// ----------------------------------------------------------------------------
// Reconhece o super-admin por DOIS mecanismos combinados (decisão do projeto):
//   1) Custom claim no token de autenticação: token.platformAdmin === true
//      (verificação forte, emitida no servidor)
//   2) Allowlist em Firestore: documento `platformAdmins/{uid}` com active:true
//      (facilita conceder/revogar; uma função sincroniza o claim a partir dela)
//
// O cliente usa qualquer um dos dois para decidir a EXIBIÇÃO da página/menu.
// A AUTORIZAÇÃO REAL (escritas/leituras sensíveis) é sempre revalidada no
// servidor pelas Cloud Functions (assertPlatformAdmin).
// ============================================================================

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { logger } from '@/utils/logger';

export const PLATFORM_ADMINS_COLLECTION = 'platformAdmins';

export function usePlatformAdmin() {
    const { user, isAuthenticated } = useAuth();
    const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [source, setSource] = useState(null); // 'claim' | 'allowlist' | null

    // 1) Custom claim no token
    useEffect(() => {
        let cancelled = false;

        async function checkClaim() {
            if (!isAuthenticated || !user) {
                if (!cancelled) {
                    setIsPlatformAdmin(false);
                    setSource(null);
                    setIsLoading(false);
                }
                return;
            }
            try {
                const tokenResult = await auth.currentUser?.getIdTokenResult();
                const claim = tokenResult?.claims?.platformAdmin === true;
                if (!cancelled && claim) {
                    setIsPlatformAdmin(true);
                    setSource('claim');
                }
            } catch (error) {
                logger.warn('Falha ao ler claims de admin:', error?.code);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        checkClaim();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user]);

    // 2) Allowlist em Firestore (fallback / fonte para o claim)
    useEffect(() => {
        if (!isAuthenticated || !user?.uid) {
            return undefined;
        }

        const ref = doc(db, PLATFORM_ADMINS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(
            ref,
            (snap) => {
                const active = snap.exists() && snap.data()?.active === true;
                if (active) {
                    setIsPlatformAdmin(true);
                    setSource((prev) => prev || 'allowlist');
                } else {
                    // Só rebaixa se o claim também não estiver presente.
                    setSource((prev) => {
                        if (prev === 'claim') return prev;
                        setIsPlatformAdmin(false);
                        return null;
                    });
                }
                setIsLoading(false);
            },
            (error) => {
                // Sem permissão de leitura => não é admin (seguro).
                logger.warn('Allowlist de admin indisponível:', error?.code);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [isAuthenticated, user?.uid]);

    return { isPlatformAdmin, isLoading, source };
}
