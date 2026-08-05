// ============================================================================
// CommandPalette — busca rápida por teclado (flag `command_palette`).
// ----------------------------------------------------------------------------
// Ctrl/Cmd + K abre a paleta de comandos (navegação para páginas e órgãos).
// "?" (fora de campos de texto) abre o painel de atalhos. Self-contained:
// não precisa de nenhuma prop — lê os próprios dados (órgãos, admin de
// plataforma) e não faz nada quando a flag está desligada.
// ============================================================================

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useOrganizations } from '@/hooks/useFirestore';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { searchAcrossOrganizations } from '@/lib/globalSearch';
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
import { LayoutDashboard, User, HelpCircle, FileText, ShieldCheck, Building2, Search, Loader2 } from 'lucide-react';

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
}

export default function CommandPalette() {
    const enabled = useFlag(FEATURE_FLAGS.COMMAND_PALETTE.key);
    const isGlobalSearchOn = useFlag(FEATURE_FLAGS.GLOBAL_SEARCH.key);
    const navigate = useNavigate();
    const { organizations } = useOrganizations();
    const { isPlatformAdmin } = usePlatformAdmin();
    const [open, setOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const searchRequestId = useRef(0);

    // Busca global entre órgãos (flag `global_search`): consulta debounced
    // (300ms) disparada a partir de 2 caracteres digitados na própria paleta.
    useEffect(() => {
        if (!enabled || !isGlobalSearchOn || !open) return undefined;
        const term = searchValue.trim();
        if (term.length < 2) {
            setSearchResults([]);
            setSearching(false);
            return undefined;
        }
        setSearching(true);
        const requestId = ++searchRequestId.current;
        const timer = setTimeout(async () => {
            const results = await searchAcrossOrganizations(organizations, term);
            if (searchRequestId.current === requestId) {
                setSearchResults(results);
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchValue, enabled, isGlobalSearchOn, open, organizations]);

    useEffect(() => {
        if (!open) {
            setSearchValue('');
            setSearchResults([]);
        }
    }, [open]);

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

    const goToResult = (result) => {
        if (result.kind === 'processo') {
            localStorage.setItem('processSearchTerm', result.number || '');
            goTo(`${createPageUrl('Organization')}?id=${result.orgId}&tab=processes`);
        } else if (result.kind === 'parceria') {
            localStorage.setItem('parceriaSearchTerm', result.number || '');
            goTo(`${createPageUrl('Organization')}?id=${result.orgId}&tab=parcerias`);
        } else {
            localStorage.setItem('expedienteSearchTerm', result.number || '');
            goTo(`${createPageUrl('Organization')}?id=${result.orgId}&tab=expedientes`);
        }
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

    // Com `global_search` ligado, o cmdk deixa de filtrar sozinho (shouldFilter
    // desligado) porque os resultados de Consultas/Expedientes já vêm
    // pré-filtrados do servidor por substring (não por fuzzy-match, e podem
    // bater num campo — ex. consulente — que não aparece no texto do item).
    // Para não perder o filtro de "Navegar"/"Meus Órgãos" nesse modo, filtramos
    // essas duas listas manualmente pelo mesmo termo digitado.
    const term = searchValue.trim().toLowerCase();
    const displayPages = isGlobalSearchOn
        ? pages.filter((p) => term.length === 0 || p.label.toLowerCase().includes(term))
        : pages;
    const displayOrgs = isGlobalSearchOn
        ? organizations.filter((o) => term.length === 0 || (o.name || '').toLowerCase().includes(term))
        : organizations;

    if (!enabled) return null;

    return (
        <>
            <CommandDialog open={open} onOpenChange={setOpen} commandProps={{ shouldFilter: !isGlobalSearchOn }}>
                <CommandInput
                    placeholder={isGlobalSearchOn
                        ? "Buscar página, órgão, Consulta, Expediente ou Parceria... (Esc para fechar)"
                        : "Buscar página ou órgão... (Esc para fechar)"}
                    value={searchValue}
                    onValueChange={setSearchValue}
                />
                <CommandList>
                    <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                    {isGlobalSearchOn && searchValue.trim().length >= 2 && (
                        <CommandGroup heading="Consultas, Expedientes e Parcerias">
                            {searching && searchResults.length === 0 && (
                                <CommandItem disabled value="__searching__">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Buscando em todos os órgãos...
                                </CommandItem>
                            )}
                            {searchResults.map((result) => (
                                <CommandItem
                                    key={`${result.kind}-${result.orgId}-${result.id}`}
                                    value={`${result.number || ''} ${result.subtitle || ''} ${result.orgName || ''}`}
                                    onSelect={() => goToResult(result)}
                                >
                                    <FileText className="w-4 h-4 mr-2 shrink-0" />
                                    <span className="flex-1 min-w-0 truncate">
                                        <span className="font-semibold">{result.number || '(sem número)'}</span>
                                        {result.subtitle && <span className="text-muted-foreground"> — {result.subtitle}</span>}
                                    </span>
                                    <CommandShortcut className="normal-case tracking-normal">{result.orgName}</CommandShortcut>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                    {displayPages.length > 0 && (
                        <CommandGroup heading="Navegar">
                            {displayPages.map((page) => {
                                const Icon = page.icon;
                                return (
                                    <CommandItem key={page.key} onSelect={() => goTo(createPageUrl(page.key))}>
                                        <Icon className="w-4 h-4 mr-2" />
                                        {page.label}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    )}
                    {displayOrgs.length > 0 && (
                        <CommandGroup heading="Meus Órgãos">
                            {displayOrgs.map((org) => (
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
