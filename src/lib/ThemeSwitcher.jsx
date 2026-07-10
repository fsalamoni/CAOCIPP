// ============================================================================
// ThemeSwitcher — alternância de tema claro/escuro (flag `theme_switcher`).
// ----------------------------------------------------------------------------
// Usa a biblioteca `next-themes` (já instalada, mas nunca conectada). Com a
// flag DESLIGADA, o tema fica travado em "claro" (forcedTheme), reproduzindo
// exatamente o comportamento atual — o modo escuro nunca era alcançável por
// nenhum controle de UI antes desta mudança. Com a flag LIGADA, o usuário
// pode escolher claro/escuro/sistema pelo botão em Layout.jsx.
// ============================================================================

import React from 'react';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeSwitcherProvider({ children }) {
    const enabled = useFlag(FEATURE_FLAGS.THEME_SWITCHER.key);
    return (
        <NextThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={enabled}
            forcedTheme={enabled ? undefined : 'light'}
        >
            {children}
        </NextThemeProvider>
    );
}

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggleButton({ className }) {
    const enabled = useFlag(FEATURE_FLAGS.THEME_SWITCHER.key);
    const { theme, setTheme } = useTheme();

    if (!enabled) return null;

    const Icon = THEME_ICONS[theme] || Monitor;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={className} title="Alternar tema" aria-label="Alternar tema">
                    <Icon className="w-5 h-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="w-4 h-4 mr-2" /> Claro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="w-4 h-4 mr-2" /> Escuro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="w-4 h-4 mr-2" /> Sistema
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
