// ============================================================================
// ThemeV2 - Aplica/remove o tema visual V2 (puramente CSS, zero lógica de negócio)
// ----------------------------------------------------------------------------
// Quando a flag `frontend_v2` está ligada, adiciona a classe `theme-v2` na tag
// <html> e injeta os links das fontes (IBM Plex Sans/Mono). Toda a mudança
// visual de fato acontece em `src/styles/theme-v2.css`, que reage a essa
// classe. Nenhum componente muda de comportamento; apenas a aparência.
//
// Ver docs/DESIGN_SYSTEM_V2.md para o guia completo do padrão V2.
// ============================================================================

import { useEffect } from 'react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

const THEME_CLASS = 'theme-v2';
const FONTS_LINK_ID = 'theme-v2-fonts';
const FONTS_PRECONNECT_ID = 'theme-v2-fonts-preconnect';
const FONTS_HREF =
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

function injectFonts() {
    if (!document.getElementById(FONTS_PRECONNECT_ID)) {
        const preconnect = document.createElement('link');
        preconnect.id = FONTS_PRECONNECT_ID;
        preconnect.rel = 'preconnect';
        preconnect.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect);
    }
    if (!document.getElementById(FONTS_LINK_ID)) {
        const stylesheet = document.createElement('link');
        stylesheet.id = FONTS_LINK_ID;
        stylesheet.rel = 'stylesheet';
        stylesheet.href = FONTS_HREF;
        document.head.appendChild(stylesheet);
    }
}

function removeFonts() {
    document.getElementById(FONTS_LINK_ID)?.remove();
    document.getElementById(FONTS_PRECONNECT_ID)?.remove();
}

/**
 * Componente sem renderização visual próprio: apenas sincroniza a flag
 * `frontend_v2` com a classe `theme-v2` em <html> e as fontes do tema.
 * Deve ser montado uma única vez, dentro do FeatureFlagsProvider.
 */
export default function ThemeV2Effect() {
    const enabled = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);

    useEffect(() => {
        const root = document.documentElement;
        if (enabled) {
            root.classList.add(THEME_CLASS);
            injectFonts();
        } else {
            root.classList.remove(THEME_CLASS);
            removeFonts();
        }
    }, [enabled]);

    return null;
}
