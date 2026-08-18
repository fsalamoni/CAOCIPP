// ============================================================================
// FeatureFlagsContext - Provider global de feature flags
// ----------------------------------------------------------------------------
// Lê o documento Firestore `platformConfig/featureFlags` em tempo real e
// combina com os DEFAULTS.
//
// MODELO ATUAL (ver src/constants/featureFlags.js):
//   - Flags INTEGRADAS: default = TRUE (permanentes). Não aparecem no admin
//     para ligar/desligar. Ficam sempre ligadas por padrão; um valor
//     explícito `false` no Firestore ainda é respeitado como VÁLVULA DE
//     EMERGÊNCIA (permite desligar sem redeploy se algo der errado).
//   - Flags OPCIONAIS: default = FALSE (OFF). Geridas normalmente no admin.
//   - Doc ausente ou erro de leitura: integradas ON, opcionais OFF (via
//     FEATURE_FLAG_DEFAULTS) — o produto continua funcionando.
//
// Uso:
//   const enabled = useFlag('db_pagination');   // boolean
//   const { flags, isLoading } = useFeatureFlags();
// ============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FEATURE_FLAG_DEFAULTS } from '@/constants/featureFlags';
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
                    // Defaults primeiro (integradas ON, opcionais OFF), depois os
                    // valores salvos. As integradas já vêm gravadas como true; um
                    // `false` explícito no Firestore é respeitado (válvula de
                    // emergência para desligar sem redeploy).
                    setFlags({ ...FEATURE_FLAG_DEFAULTS, ...stored });
                } else {
                    // Documento ainda não criado => integradas ON, opcionais OFF.
                    setFlags(FEATURE_FLAG_DEFAULTS);
                }
                setIsLoading(false);
            },
            (error) => {
                // Erro de leitura (ex.: regras/offline): mantém os defaults —
                // integradas ON (o produto continua funcionando), opcionais OFF.
                logger.warn('Feature flags indisponíveis, usando defaults:', error?.code);
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
