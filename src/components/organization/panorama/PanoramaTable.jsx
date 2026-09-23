import React, { useEffect, useMemo, useState } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/ui/EmptyState';
import {
    Columns3, ArrowUp, ArrowDown, ArrowUpDown, Pencil, Trash2, Eye, SearchX,
    ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
    formatarValor, formatNumber, valorDe, numeroDe,
    prescricaoDoRegistro, regiaoDoRegistro,
} from '@/lib/panoramaEngine';
import { columnForRole, faixaPrescricaoMeta } from '@/constants/panorama';
import PanoramaBadge from './PanoramaBadge';

const PAGE_SIZES = [20, 50, 100, 200];

function storageKey(baseId) {
    return `caocipp_panorama_colunas_${baseId || 'sem-base'}`;
}

/**
 * Colunas da tabela, montadas a partir da definição da base.
 *
 * Cada uma carrega o extrator de TEXTO (usado na ordenação e em todas as
 * exportações) e a chave de ordenação — datas ordenam pelo ISO, números pelo
 * número, e a ausência de valor vai sempre para o fim.
 */
export function buildPanoramaColumns(base) {
    const cols = (base?.columns || [])
        .filter((c) => c.visivel !== false)
        .sort((a, b) => a.ordem - b.ordem)
        .map((col) => ({
            key: col.key,
            label: col.label,
            type: col.type,
            role: col.role,
            defaultVisible: true,
            text: (registro) => formatarValor(valorDe(registro, col.key), col.type),
            sortValue: (registro) => {
                const bruto = valorDe(registro, col.key);
                if (bruto === null || bruto === undefined || bruto === '') return null;
                if (col.type === 'numero' || col.type === 'moeda') return numeroDe(registro, col.key);
                if (col.type === 'data') return String(bruto);
                if (col.type === 'booleano') return bruto === true ? 'Sim' : 'Não';
                return String(bruto).toLowerCase();
            },
        }));

    // Colunas calculadas: não existem no documento, saem da configuração da
    // base. Entram aqui para valerem também na ordenação e na exportação.
    if (Object.keys(base?.regioes || {}).length > 0 && columnForRole(base, 'unidade')) {
        cols.push({
            key: '__regiao',
            label: 'Região',
            type: 'texto',
            calculada: true,
            defaultVisible: false,
            text: (registro) => regiaoDoRegistro(registro, base),
            sortValue: (registro) => regiaoDoRegistro(registro, base).toLowerCase(),
        });
    }

    if ((base?.prescricao?.modo || 'desligado') !== 'desligado') {
        cols.push({
            key: '__prescricao',
            label: 'Prescrição',
            type: 'texto',
            calculada: true,
            defaultVisible: true,
            text: (registro) => {
                const p = prescricaoDoRegistro(registro, base);
                if (!p.limite) return '';
                return `${faixaPrescricaoMeta(p.faixa).label} (${p.dias < 0 ? `${Math.abs(p.dias)} dias atrás` : `${p.dias} dias`})`;
            },
            // Ordena pelo que importa: quem vence primeiro vem primeiro.
            sortValue: (registro) => {
                const p = prescricaoDoRegistro(registro, base);
                return p.dias === null ? null : p.dias;
            },
        });
    }

    return cols;
}

function loadVisible(columns, baseId) {
    const todas = columns.map((c) => c.key);
    const fallback = columns.filter((c) => c.defaultVisible).map((c) => c.key);
    try {
        const stored = JSON.parse(window.localStorage.getItem(storageKey(baseId)) || 'null');
        const visible = stored?.visible;
        const known = stored?.known;
        if (!Array.isArray(visible) || visible.length === 0) return fallback;

        // Colunas que surgiram depois da última escolha (o admin acrescentou
        // uma na base, ou a planilha trouxe uma nova) entram visíveis, em vez
        // de ficarem escondidas justamente para quem mais usa a tela.
        const conhecidas = new Set(Array.isArray(known) ? known : visible);
        const novas = todas.filter((k) => !conhecidas.has(k) && fallback.includes(k));
        const mantidas = visible.filter((k) => todas.includes(k));
        if (mantidas.length === 0 && novas.length === 0) return fallback;

        const escolhidas = new Set([...mantidas, ...novas]);
        return todas.filter((k) => escolhidas.has(k));
    } catch {
        /* localStorage indisponível — usa o padrão */
    }
    return fallback;
}

/**
 * Tabela de registros de uma base do Panorama.
 *
 * Ordenação por coluna, seleção de colunas visíveis, seleção múltipla para
 * ações em massa e paginação. Recebe as linhas JÁ filtradas.
 */
export default function PanoramaTable({
    registros,
    base,
    onView,
    onEdit,
    onDelete,
    canDelete = false,
    selectable = false,
    selectedIds = [],
    onSelectionChange,
    emptyAction = null,
}) {
    const columns = useMemo(() => buildPanoramaColumns(base), [base]);
    const [visibleKeys, setVisibleKeys] = useState(() => loadVisible(columns, base?.id));
    const [sort, setSort] = useState({ key: null, dir: 'desc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Trocou de base: as colunas são outras, então a preferência também.
    useEffect(() => {
        setVisibleKeys(loadVisible(columns, base?.id));
        setSort({ key: null, dir: 'desc' });
        setPage(1);
    }, [columns, base?.id]);

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey(base?.id), JSON.stringify({
                visible: visibleKeys,
                known: columns.map((c) => c.key),
            }));
        } catch {
            /* sem localStorage: vale só para esta sessão */
        }
    }, [visibleKeys, columns, base?.id]);

    useEffect(() => { setPage(1); }, [registros.length, pageSize]);

    const visibleColumns = useMemo(
        () => columns.filter((c) => visibleKeys.includes(c.key)),
        [columns, visibleKeys]
    );

    const sorted = useMemo(() => {
        const column = columns.find((c) => c.key === sort.key);
        if (!column) return registros;
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...registros].sort((a, b) => {
            const va = column.sortValue(a);
            const vb = column.sortValue(b);
            // Valor ausente vai para o fim nos DOIS sentidos: ele não é "o
            // menor", é desconhecido, e ocupar o topo esconderia o que se
            // ordenou para ver.
            const aVazio = va === null || va === undefined;
            const bVazio = vb === null || vb === undefined;
            if (aVazio && bVazio) return 0;
            if (aVazio) return 1;
            if (bVazio) return -1;
            if (va === vb) return 0;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
            return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * factor;
        });
    }, [registros, columns, sort]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = useMemo(
        () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [sorted, currentPage, pageSize]
    );

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const toggleRow = (id) => {
        const next = new Set(selectedSet);
        if (next.has(id)) next.delete(id); else next.add(id);
        onSelectionChange?.([...next]);
    };
    const togglePage = () => {
        const ids = pageRows.map((r) => r.id);
        const todos = ids.every((id) => selectedSet.has(id));
        const next = new Set(selectedSet);
        ids.forEach((id) => (todos ? next.delete(id) : next.add(id)));
        onSelectionChange?.([...next]);
    };

    const toggleSort = (key) => {
        setSort((prev) => (prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'asc' }));
    };

    const colDesfecho = columnForRole(base, 'desfecho');

    if (registros.length === 0) {
        return (
            <EmptyState
                icon={SearchX}
                title="Nenhum registro no recorte atual"
                description="Ajuste os filtros ou importe uma planilha para começar."
                action={emptyAction}
            />
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatNumber(registros.length)} registro(s)
                    {selectedIds.length > 0 && ` · ${formatNumber(selectedIds.length)} selecionado(s)`}
                </p>

                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Columns3 className="w-4 h-4" />
                                Colunas
                                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                    {visibleColumns.length}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="end">
                            <ScrollArea className="h-72">
                                <div className="space-y-0.5 pr-2">
                                    {columns.map((column) => (
                                        <label
                                            key={column.key}
                                            className="flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            <Checkbox
                                                className="mt-0.5"
                                                checked={visibleKeys.includes(column.key)}
                                                onCheckedChange={() => setVisibleKeys((prev) => (
                                                    prev.includes(column.key)
                                                        ? prev.filter((k) => k !== column.key)
                                                        : [...prev, column.key]
                                                ))}
                                            />
                                            <span className="text-sm leading-tight">
                                                {column.label}
                                                {column.calculada && (
                                                    <span className="text-[11px] text-slate-400"> (calculada)</span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>

                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                        <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZES.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selectable && (
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={pageRows.length > 0 && pageRows.every((r) => selectedSet.has(r.id))}
                                        onCheckedChange={togglePage}
                                        aria-label="Selecionar a página"
                                    />
                                </TableHead>
                            )}
                            {visibleColumns.map((column) => (
                                <TableHead key={column.key} className="whitespace-nowrap">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(column.key)}
                                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                                    >
                                        {column.label}
                                        {sort.key === column.key
                                            ? (sort.dir === 'asc'
                                                ? <ArrowUp className="w-3 h-3" />
                                                : <ArrowDown className="w-3 h-3" />)
                                            : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                                    </button>
                                </TableHead>
                            ))}
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.map((registro) => (
                            <TableRow
                                key={registro.id}
                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                onClick={() => onView?.(registro)}
                            >
                                {selectable && (
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={selectedSet.has(registro.id)}
                                            onCheckedChange={() => toggleRow(registro.id)}
                                            aria-label="Selecionar registro"
                                        />
                                    </TableCell>
                                )}
                                {visibleColumns.map((column) => {
                                    const text = column.text(registro);

                                    if (colDesfecho && column.key === colDesfecho.key) {
                                        return (
                                            <TableCell key={column.key}>
                                                <PanoramaBadge
                                                    valor={text}
                                                    base={base}
                                                    className="max-w-[240px]"
                                                />
                                            </TableCell>
                                        );
                                    }

                                    if (column.key === '__prescricao') {
                                        const p = prescricaoDoRegistro(registro, base);
                                        if (!p.limite) {
                                            return <TableCell key={column.key} className="text-slate-400 text-[13px]">—</TableCell>;
                                        }
                                        const meta = faixaPrescricaoMeta(p.faixa);
                                        return (
                                            <TableCell key={column.key}>
                                                <Badge className={`${meta.badge} border-0 text-[11px] whitespace-nowrap`}>
                                                    {meta.label}
                                                </Badge>
                                                <span className="block text-[11px] text-slate-400 tabular-nums mt-0.5">
                                                    {p.dias < 0
                                                        ? `há ${formatNumber(Math.abs(p.dias))} dia(s)`
                                                        : `em ${formatNumber(p.dias)} dia(s)`}
                                                </span>
                                            </TableCell>
                                        );
                                    }

                                    const alinhaDireita = column.type === 'numero' || column.type === 'moeda';
                                    return (
                                        <TableCell
                                            key={column.key}
                                            className={`text-[13px] text-slate-600 dark:text-slate-300 ${alinhaDireita ? 'text-right tabular-nums' : ''}`}
                                        >
                                            <span className="block max-w-[260px] truncate" title={text}>
                                                {text || '—'}
                                            </span>
                                        </TableCell>
                                    );
                                })}
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-0.5">
                                        {onView && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(registro)} title="Ver">
                                                <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {onEdit && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(registro)} title="Editar">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {canDelete && onDelete && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-rose-600 hover:text-rose-700"
                                                onClick={() => onDelete(registro)}
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Página {currentPage} de {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="gap-1"
                        >
                            <ChevronLeft className="w-4 h-4" /> Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="gap-1"
                        >
                            Próxima <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
