// ============================================================================
// CommandPalette — busca rápida por teclado (flag `command_palette`).
// ----------------------------------------------------------------------------
// Ctrl/Cmd + K abre a paleta de comandos (navegação para páginas e órgãos).
// "?" (fora de campos de texto) abre o painel de atalhos. Self-contained:
// não precisa de nenhuma prop — lê os próprios dados (órgãos, admin de
// plataforma) e não faz nada quando a flag está desligada.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useOrganizations } from '@/hooks/useFirestore';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LayoutDashboard, User, HelpCircle, FileText, ShieldCheck, Building2, Search } from 'lucide-react';

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

export default function CommandPalette() {
    const enabled = useFlag(FEATURE_FLAGS.COMMAND_PALETTE.key);
    const navigate = useNavigate();
    const { organizations } = useOrganizations();
    const { isPlatformAdmin } = usePlatformAdmin();
    const [open, setOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleKeyDown = (e) => {
            const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
            if (isModK) {
                e.preventDefault();
                setOpen((prev) => !prev);
                return;
            }
            if (e.key === '?' && !isTypingTarget(e.target)) {
                e.preventDefault();
                setShortcutsOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);

    const goTo = (path) => {
        setOpen(false);
        navigate(path);
    };

    const pages = useMemo(() => {
        const list = [
            { key: 'Dashboard', label: 'Início', icon: LayoutDashboard },
            { key: 'Profile', label: 'Meu Perfil', icon: User },
            { key: 'Help', label: 'Ajuda', icon: HelpCircle },
            { key: 'Terms', label: 'Termos de Uso', icon: FileText },
        ];
        if (isPlatformAdmin) {
            list.push({ key: 'Admin', label: 'Administração & Custos', icon: ShieldCheck });
        }
        return list;
    }, [isPlatformAdmin]);

    if (!enabled) return null;

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Buscar página ou órgão... (Esc para fechar)" />
                <CommandList>
                    <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                    <CommandGroup heading="Navegar">
                        {pages.map((page) => {
                            const Icon = page.icon;
                            return (
                                <CommandItem key={page.key} onSelect={() => goTo(createPageUrl(page.key))}>
                                    <Icon className="w-4 h-4 mr-2" />
                                    {page.label}
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                    {organizations.length > 0 && (
                        <CommandGroup heading="Meus Órgãos">
                            {organizations.map((org) => (
                                <CommandItem key={org.id} onSelect={() => goTo(`${createPageUrl('Organization')}?id=${org.id}`)}>
                                    <Building2 className="w-4 h-4 mr-2" />
                                    {org.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>

            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Search className="w-4 h-4" /> Atalhos de teclado
                        </DialogTitle>
                        <DialogDescription>Disponíveis em qualquer tela da plataforma.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Abrir busca rápida</span>
                            <CommandShortcut>Ctrl/Cmd + K</CommandShortcut>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Mostrar estes atalhos</span>
                            <CommandShortcut>?</CommandShortcut>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Fechar diálogo/busca</span>
                            <CommandShortcut>Esc</CommandShortcut>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
