import React, { useId } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GLOSSARIO } from '@/lib/glossario';

/** Botão "?" ao lado de um termo jurídico: abre a definição do glossário. 44px de alvo no toque. */
export default function AjudaTermo({ id, className = '' }) {
    const tituloId = useId();
    const t = GLOSSARIO[id];
    if (!t) return null;
    return (
        <Popover>
            <PopoverTrigger data-ajuda-termo="" aria-label={`Glossário: ${t.termo}`}
                className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-indigo-300 align-middle text-[11px] font-semibold leading-none text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950 after:absolute after:-inset-3 sm:after:-inset-1 mr-3 sm:mr-0 ${className}`}>
                ?
            </PopoverTrigger>
            <PopoverContent aria-labelledby={tituloId} collisionPadding={16} className="space-y-1 text-sm">
                <p id={tituloId} className="font-semibold text-slate-900 dark:text-white">{t.termo}</p>
                <p className="text-slate-700 dark:text-slate-300">{t.definicao}</p>
            </PopoverContent>
        </Popover>
    );
}

/** onOpenAutoFocus de Dialog com "?" no título: foca o primeiro campo, como antes, e não o "?". */
export function focoSemAjuda(e) {
    const alvo = [...e.currentTarget.querySelectorAll('input, select, textarea, button, [href], summary, [tabindex]')]
        .find((x) => x.tabIndex >= 0 && !x.disabled && !x.closest('[data-ajuda-termo]') && x.getClientRects().length > 0);
    if (alvo) { e.preventDefault(); alvo.focus(); }
}
