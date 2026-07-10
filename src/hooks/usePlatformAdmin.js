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
//
// Os dois sinais são mantidos em estados independentes (claimActive/
// allowlistActive) e combinados por OR — antes, o claim "vencia" e nunca
// era reavaliado após o carregamento inicial, então revogar o acesso de um
// super-admin (revokePlatformAdmin, que já força um refresh do token do
// lado do servidor) não atualizava a tela até o usuário recarregar a página
// ou o token expirar sozinho. onIdTokenChanged reage tanto ao refresh
// automático periódico do SDK quanto a um refresh forçado.
// ============================================================================

import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { logger } from '@/utils/logger';

export const PLATFORM_ADMINS_COLLECTION = 'platformAdmins';

export function usePlatformAdmin() {
    const { user, isAuthenticated } = useAuth();
    const [claimActive, setClaimActive] = useState(false);
    const [allowlistActive, setAllowlistActive] = useState(false);
    const [isClaimLoading, setIsClaimLoading] = useState(true);
    const [isAllowlistLoading, setIsAllowlistLoading] = useState(true);

    // 1) Custom claim no token — reavalia sempre que o token for renovado
    // (refresh automático do SDK, ou refresh forçado por revokeRefreshTokens).
    useEffect(() => {
        if (!isAuthenticated || !user) {
            setClaimActive(false);
            setIsClaimLoading(false);
            return undefined;
        }

        setIsClaimLoading(true);
        const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setClaimActive(false);
                setIsClaimLoading(false);
                return;
            }
            try {
                const tokenResult = await firebaseUser.getIdTokenResult();
                setClaimActive(tokenResult?.claims?.platformAdmin === true);
            } catch (error) {
                logger.warn('Falha ao ler claims de admin:', error?.code);
                setClaimActive(false);
            } finally {
                setIsClaimLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isAuthenticated, user]);

    // 2) Allowlist em Firestore (fallback / fonte para o claim)
    useEffect(() => {
        if (!isAuthenticated || !user?.uid) {
            setAllowlistActive(false);
            setIsAllowlistLoading(false);
            return undefined;
        }

        const ref = doc(db, PLATFORM_ADMINS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(
            ref,
            (snap) => {
                setAllowlistActive(snap.exists() && snap.data()?.active === true);
                setIsAllowlistLoading(false);
            },
            (error) => {
                // Sem permissão de leitura => não é admin (seguro).
                logger.warn('Allowlist de admin indisponível:', error?.code);
                setAllowlistActive(false);
                setIsAllowlistLoading(false);
            }
        );

        return () => unsubscribe();
    }, [isAuthenticated, user?.uid]);

    const isPlatformAdmin = claimActive || allowlistActive;
    const source = claimActive ? 'claim' : (allowlistActive ? 'allowlist' : null);

    return { isPlatformAdmin, isLoading: isClaimLoading || isAllowlistLoading, source };
}
