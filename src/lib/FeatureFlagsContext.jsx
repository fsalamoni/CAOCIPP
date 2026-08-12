// ============================================================================
// FeatureFlagsContext - Provider global de feature flags
// ----------------------------------------------------------------------------
// Lê o documento Firestore `platformConfig/featureFlags` em tempo real.
// Combina com os DEFAULTS (todos OFF) garantindo que, se o documento não
// existir ou uma flag não estiver definida, o comportamento atual é mantido.
//
// Uso:
//   const enabled = useFlag('db_pagination');   // boolean
//   const { flags, isLoading } = useFeatureFlags();
//
// SEGURANÇA / ZERO QUEBRA:
//   - Default sempre false. Falha de leitura => mantém defaults (OFF).
//   - Suporta override por organização via parâmetro opcional.
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FEATURE_FLAG_DEFAULTS, INTEGRATED_FLAG_ON } from '@/constants/featureFlags';
import { logger } from '@/utils/logger';

const FeatureFlagsContext = createContext({
    flags: FEATURE_FLAG_DEFAULTS,
    orgOverrides: {},
    isLoading: true,
});

export const PLATFORM_CONFIG_COLLECTION = 'platformConfig';
export const FEATURE_FLAGS_DOC = 'featureFlags';

export const FeatureFlagsProvider = ({ children }) => {
    const [flags, setFlags] = useState(FEATURE_FLAG_DEFAULTS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const ref = doc(db, PLATFORM_CONFIG_COLLECTION, FEATURE_FLAGS_DOC);

        const unsubscribe = onSnapshot(
            ref,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() || {};
                    const stored = data.flags || {};
                    // Merge: defaults primeiro, depois os valores salvos, e por
                    // último as INTEGRADAS forçadas em TRUE (permanentes — não
                    // podem ser desligadas pelo Firestore).
                    setFlags({ ...FEATURE_FLAG_DEFAULTS, ...stored, ...INTEGRATED_FLAG_ON });
                } else {
                    // Documento ainda não criado => opcionais OFF, integradas ON.
                    setFlags({ ...FEATURE_FLAG_DEFAULTS, ...INTEGRATED_FLAG_ON });
                }
                setIsLoading(false);
            },
            (error) => {
                // Em caso de erro (ex.: regras), mantém defaults seguros (OFF).
                logger.warn('Feature flags indisponíveis, usando defaults (OFF):', error?.code);
                setFlags(FEATURE_FLAG_DEFAULTS);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const value = { flags, isLoading };

    return (
        <FeatureFlagsContext.Provider value={value}>
            {children}
        </FeatureFlagsContext.Provider>
    );
};

/**
 * Retorna o estado booleano de uma flag.
 * @param {string} flagKey - chave da flag (ex.: 'db_pagination')
 * @returns {boolean}
 */
export const useFlag = (flagKey) => {
    const ctx = useContext(FeatureFlagsContext);
    return Boolean(ctx.flags?.[flagKey]);
};

/**
 * Retorna todas as flags + estado de carregamento.
 */
export const useFeatureFlags = () => {
    const ctx = useContext(FeatureFlagsContext);
    return { flags: ctx.flags, isLoading: ctx.isLoading };
};

export default FeatureFlagsContext;
