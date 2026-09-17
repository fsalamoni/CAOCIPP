import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { formatNumber } from '@/lib/jurimetriaEngine';
import { useJurimetriaPref } from '@/hooks/useJurimetriaPrefs';

/** Tamanhos de página oferecidos nas tabelas de relatórios. */
export const JURIMETRIA_PAGE_SIZES = [20, 50, 100];

/**
 * Paginação de uma lista já calculada.
 *
 * Um relatório de comarcas do estado inteiro passa de 160 linhas; renderizar
 * tudo de uma vez trava a rolagem e esconde o que interessa. O recorte
 * completo continua íntegro para os cálculos e para a exportação — a paginação
 * é só da leitura na tela.
 *
 * @param {Array} rows Linhas completas (já ordenadas).
 * @param {object} [options] `{ scope, organizationId, defaultSize }` — informe
 *   `scope` para que o tamanho escolhido sobreviva ao refresh.
 */
export function usePagedRows(rows, options = {}) {
    const { scope, organizationId, defaultSize = 20 } = options;
    const all = useMemo(() => rows || [], [rows]);

    const [storedSize, setStoredSize] = useJurimetriaPref(
        scope ? `pagina_${scope}` : 'pagina_tmp',
        scope ? organizationId : null,
        defaultSize
    );
    const [localSize, setLocalSize] = useState(defaultSize);

    const pageSize = scope ? storedSize : localSize;
    const setPageSize = scope ? setStoredSize : setLocalSize;

    const [page, setPage] = useState(1);

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / (pageSize || 1)));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    // A lista encolheu (filtro novo) e a página atual deixou de existir:
    // volta para a primeira, em vez de mostrar uma tabela vazia.
    useEffect(() => { setPage(1); }, [total, pageSize]);

    const pageRows = useMemo(
        () => all.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [all, currentPage, pageSize]
    );

    return {
        pageRows,
        page: currentPage,
        setPage,
        pageSize,
        setPageSize,
        totalPages,
        total,
        from: total === 0 ? 0 : (currentPage - 1) * pageSize + 1,
        to: Math.min(currentPage * pageSize, total),
    };
}

/** Janela de números de página ao redor da atual, com reticências. */
function pageWindow(current, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, current, current - 1, current + 1]);
    if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
    if (current >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));

    const ordered = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    let previous = 0;
    for (const p of ordered) {
        if (previous && p - previous > 1) out.push('…');
        out.push(p);
        previous = p;
    }
    return out;
}

/**
 * Barra de paginação: tamanho da página (20/50/100), contagem do intervalo
 * exibido e navegação entre páginas.
 */
export default function JurimetriaPagination({ pager, label = 'linhas', className = '' }) {
    const { page, setPage, pageSize, setPageSize, totalPages, total, from, to } = pager;

    // Tabela curta e no menor tamanho: a barra só ocuparia espaço.
    if (total <= JURIMETRIA_PAGE_SIZES[0] && totalPages <= 1) return null;

    const janela = pageWindow(page, totalPages);

    return (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 ${className}`}>
            <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {JURIMETRIA_PAGE_SIZES.map((size) => (
                            <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)} {label}
                </span>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage(1)} disabled={page <= 1}
                        title="Primeira página"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                        title="Página anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {janela.map((item, index) => (
                        item === '…' ? (
                            <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">…</span>
                        ) : (
                            <Button
                                key={item}
                                variant={item === page ? 'default' : 'outline'}
                                size="icon"
                                className="h-8 w-8 text-xs"
                                onClick={() => setPage(item)}
                                aria-current={item === page ? 'page' : undefined}
                            >
                                {item}
                            </Button>
                        )
                    ))}

                    <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                        title="Próxima página"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                        title="Última página"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
