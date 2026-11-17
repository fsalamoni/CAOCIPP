// Identidade da plataforma e avisos em tempo real (platformConfig/branding e
// platformConfig/avisos, leitura pública). Sem documento ou com erro de
// leitura, valem os padrões: a tela nunca fica sem nome nem logo, e sem
// aviso nem manutenção.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BRANDING_PADRAO, mesclarBranding } from '@/lib/platformBranding';
import { logger } from '@/utils/logger';

const BrandingContext = createContext(mesclarBranding(null));
const AvisosContext = createContext({ aviso: null, manutencao: null, carregado: false });

export function BrandingProvider({ children }) {
    const [branding, setBranding] = useState(() => mesclarBranding(null));
    const [avisos, setAvisos] = useState({ aviso: null, manutencao: null, carregado: false });

    useEffect(() => onSnapshot(
        doc(db, 'platformConfig', 'branding'),
        (snap) => setBranding(mesclarBranding(snap.exists() ? snap.data() : null)),
        (err) => logger.warn('Identidade da plataforma indisponível, usando o padrão:', err?.code),
    ), []);

    useEffect(() => onSnapshot(
        doc(db, 'platformConfig', 'avisos'),
        (snap) => {
            const d = snap.exists() ? snap.data() : {};
            setAvisos({ aviso: d.aviso || null, manutencao: d.manutencao || null, carregado: true });
        },
        (err) => {
            logger.warn('Avisos da plataforma indisponíveis:', err?.code);
            setAvisos({ aviso: null, manutencao: null, carregado: true });
        },
    ), []);

    // Título da aba e cor da barra do navegador no celular.
    useEffect(() => {
        document.title = `${branding.nome_curto} - ${branding.nome_completo}`;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', branding.cor || BRANDING_PADRAO.cor);
    }, [branding.nome_curto, branding.nome_completo, branding.cor]);

    return (
        <BrandingContext.Provider value={branding}>
            <AvisosContext.Provider value={avisos}>{children}</AvisosContext.Provider>
        </BrandingContext.Provider>
    );
}

export const useBranding = () => useContext(BrandingContext);
export const useAvisos = () => useContext(AvisosContext);
