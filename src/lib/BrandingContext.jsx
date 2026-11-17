// Identidade da plataforma em tempo real (platformConfig/branding, leitura
// pública). Sem documento ou com erro de leitura, valem os padrões: a tela
// nunca fica sem nome nem logo.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BRANDING_PADRAO, mesclarBranding } from '@/lib/platformBranding';
import { logger } from '@/utils/logger';

const BrandingContext = createContext(mesclarBranding(null));

export function BrandingProvider({ children }) {
    const [branding, setBranding] = useState(() => mesclarBranding(null));

    useEffect(() => onSnapshot(
        doc(db, 'platformConfig', 'branding'),
        (snap) => setBranding(mesclarBranding(snap.exists() ? snap.data() : null)),
        (err) => logger.warn('Identidade da plataforma indisponível, usando o padrão:', err?.code),
    ), []);

    // Título da aba e cor da barra do navegador no celular.
    useEffect(() => {
        document.title = `${branding.nome_curto} - ${branding.nome_completo}`;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', branding.cor || BRANDING_PADRAO.cor);
    }, [branding.nome_curto, branding.nome_completo, branding.cor]);

    return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export const useBranding = () => useContext(BrandingContext);
