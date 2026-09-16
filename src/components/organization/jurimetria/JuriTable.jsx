import React, { useMemo, useState, useEffect } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/ui/EmptyState';
import {
    ArrowUpDown, ArrowUp, ArrowDown, Columns3, MoreHorizontal, Pencil, Trash2,
    Eye, SearchX, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { formatDateBR, tipoLabel, isDissolucao, getRealizacao } from '@/lib/jurimetriaEngine';
import {
    getJurimetriaFields, getJuriFieldValue, realizacaoMeta,
} from '@/constants/jurimetria';

const PAGE_SIZES = [20, 50, 100, 200];
const STORAGE_KEY = 'caocipp_jurimetria_columns';

/**
 * Colunas exibidas na tabela: os campos fixos visíveis do órgão, mais o
 * responsável, mais as colunas personalizadas criadas pelo administrador.
 */
export function buildJuriColumns(settings) {
    const fields = getJurimetriaFields(settings);

    const columns = fields.map((field) => ({
        key: field.key,
        label: field.label,
        custom: field.custom,
        type: field.type,
        // Colunas estruturais da ferramenta (número, data, realização): não
        // podem ser escondidas pelo admin e reaparecem para quem já tinha uma
        // preferência salva de antes de elas existirem.
        locked: field.locked === true,
        defaultVisible: !['vara', 'observacoes'].includes(field.key),
        // Valor textual — usado na ordenação e em TODAS as exportações.
        text: (juri) => {
            const raw = getJuriFieldValue(juri, field.key);
            if (field.key === 'data_juri') return formatDateBR(raw);
            if (field.key === 'tipo') return raw ? tipoLabel(raw, settings) : '';
            // Júri anterior à coluna de realização: vale como realizado.
            if (field.key === 'realizacao') return realizacaoMeta(getRealizacao(juri)).label;
            if (field.type === 'date') return raw ? formatDateBR(raw) : '';
            if (raw === true) return 'Sim';
            if (raw === false) return 'Não';
            return raw === null || raw === undefined ? '' : String(raw);
        },
        // Chave de ordenação — datas ordenam pelo ISO, não pelo texto pt-BR.
        sortValue: (juri) => {
            const raw = getJuriFieldValue(juri, field.key);
            if (field.key === 'data_juri' || field.type === 'date') return String(raw || '');
            if (field.key === 'realizacao') return getRealizacao(juri);
            if (field.type === 'number') return Number(raw) || 0;
            return String(raw ?? '').toLowerCase();
        },
    }));

    columns.push({
        key: 'responsible_user_name',
        label: 'Responsável',
        defaultVisible: true,
        text: (juri) => juri.responsible_user_name || '',
        sortValue: (juri) => String(juri.responsible_user_name || '').toLowerCase(),
    });

    return columns;
}

/**
 * Colunas visíveis.
 *
 * Além da escolha do usuário, guardamos quais colunas EXISTIAM quando ele
 * escolheu. Assim, quando uma coluna nova entra na ferramenta (ou o admin cria
 * uma), ela aparece para quem já tinha uma preferência salva, em vez de ficar
 * invisível justamente para quem mais usa a tela — sem desfazer o que a pessoa
 * tinha ocultado de propósito.
 *
 * No formato antigo (array puro) não dá para separar "ocultei" de "não
 * existia", então só as colunas estruturais entram — é o mínimo necessário
 * para a ferramenta fazer sentido, sem reabrir o que a pessoa fechou.
 */
function loadVisible(columns) {
    const todas = columns.map((c) => c.key);
    const fallback = columns.filter((c) => c.defaultVisible).map((c) => c.key);
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');

        // Formato antigo (array puro): não sabemos o que era oferecido na
        // época, então tratamos as colunas de então como as guardadas.
        const visible = Array.isArray(stored) ? stored : stored?.visible;
        const known = Array.isArray(stored) ? stored : stored?.known;
        if (!Array.isArray(visible) || visible.length === 0) return fallback;

        const legado = Array.isArray(stored);
        const conhecidas = new Set(Array.isArray(known) ? known : visible);
        const estruturais = new Set(columns.filter((c) => c.locked).map((c) => c.key));
        const novas = todas.filter((key) => (
            !conhecidas.has(key)
            && fallback.includes(key)
            && (!legado || estruturais.has(key))
        ));
        const mantidas = visible.filter((key) => todas.includes(key));
        if (mantidas.length === 0 && novas.length === 0) return fallback;

        // Preserva a ordem oficial das colunas.
        const escolhidas = new Set([...mantidas, ...novas]);
        return todas.filter((key) => escolhidas.has(key));
    } catch {
        /* localStorage indisponível (modo privado etc.) — usa o padrão */
    }
    return fallback;
}

/**
 * Tabela de júris: ordenação por coluna, seleção de colunas, seleção múltipla
 * para ações em massa e paginação. Recebe as linhas JÁ filtradas.
 */
export default function JuriTable({
    juris,
    settings,
    onView,
    onEdit,
    onDelete,
    canDelete = false,
    selectedIds = [],
    onSelectionChange,
    emptyAction = null,
}) {
    const columns = useMemo(() => buildJuriColumns(settings), [settings]);
    const [visibleKeys, setVisibleKeys] = useState(() => loadVisible(columns));
    const [sort, setSort] = useState({ key: 'data_juri', dir: 'desc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Quando o administrador acrescenta/remove colunas, mantém a preferência do
    // usuário apenas para as colunas que ainda existem.
    useEffect(() => {
        setVisibleKeys((prev) => {
            const known = prev.filter((key) => columns.some((c) => c.key === key));
            return known.length > 0 ? known : columns.filter((c) => c.defaultVisible).map((c) => c.key);
        });
    }, [columns]);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                visible: visibleKeys,
                known: columns.map((c) => c.key),
            }));
        } catch {
            /* sem localStorage: a preferência vale só para esta sessão */
        }
    }, [visibleKeys, columns]);

    // Sai de uma página que deixou de existir depois de um filtro mais restritivo.
    useEffect(() => { setPage(1); }, [juris.length, pageSize]);

    const visibleColumns = useMemo(
        () => columns.filter((c) => visibleKeys.includes(c.key)),
        [columns, visibleKeys]
    );

    const sorted = useMemo(() => {
        const column = columns.find((c) => c.key === sort.key);
        if (!column) return juris;
        const factor = sort.dir === 'asc' ? 1 : -1;
        return [...juris].sort((a, b) => {
            const va = column.sortValue(a);
            const vb = column.sortValue(b);
            if (va === vb) return 0;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
            return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * factor;
        });
    }, [juris, columns, sort]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageRows = useMemo(
        () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [sorted, currentPage, pageSize]
    );

    const toggleSort = (key) => {
        setSort((prev) => (
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'asc' }
        ));
    };

    const selectable = typeof onSelectionChange === 'function';
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const pageIds = pageRows.map((j) => j.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

    const togglePageSelection = () => {
        if (!selectable) return;
        const next = new Set(selectedSet);
        if (allPageSelected) pageIds.forEach((id) => next.delete(id));
        else pageIds.forEach((id) => next.add(id));
        onSelectionChange([...next]);
    };

    const toggleRow = (id) => {
        if (!selectable) return;
        const next = new Set(selectedSet);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onSelectionChange([...next]);
    };

    if (juris.length === 0) {
        return (
            <EmptyState
                icon={SearchX}
                title="Nenhum júri encontrado"
                description="Ajuste os filtros, cadastre um júri ou importe uma planilha na aba Importação."
                action={emptyAction}
            />
        );
    }

    return (
        <div className="space-y-3">
            {/* Barra de ferramentas da tabela */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {sorted.length.toLocaleString('pt-BR')} júri(s)
                    {selectable && selectedIds.length > 0 && (
                        <> — <strong>{selectedIds.length}</strong> selecionado(s)</>
                    )}
                </p>

                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-9">
                                <Columns3 className="w-4 h-4" />
                                Colunas
                                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                    {visibleColumns.length}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="end">
                            <ScrollArea className="h-72">
                                <div className="p-2 space-y-0.5">
                                    {columns.map((column) => (
                                        <label
                                            key={column.key}
                                            className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
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
                                                {column.custom && (
                                                    <span className="block text-[11px] text-slate-400">coluna do órgão</span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>

                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                        <SelectTrigger className="w-[120px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZES.map((size) => (
                                <SelectItem key={size} value={String(size)}>{size} por página</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabela */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                {selectable && (
                                    <TableHead className="w-10">
                                        <Checkbox
                                            checked={allPageSelected}
                                            onCheckedChange={togglePageSelection}
                                            aria-label="Selecionar todos desta página"
                                        />
                                    </TableHead>
                                )}
                                {visibleColumns.map((column) => (
                                    <TableHead key={column.key} className="whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => toggleSort(column.key)}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
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
                            {pageRows.map((juri) => {
                                const dissolvido = isDissolucao(juri, settings);
                                return (
                                    <TableRow
                                        key={juri.id}
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        onClick={() => onView && onView(juri)}
                                    >
                                        {selectable && (
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedSet.has(juri.id)}
                                                    onCheckedChange={() => toggleRow(juri.id)}
                                                    aria-label={`Selecionar ${juri.numero_processo}`}
                                                />
                                            </TableCell>
                                        )}
                                        {visibleColumns.map((column) => {
                                            const text = column.text(juri);
                                            if (column.key === 'numero_processo') {
                                                return (
                                                    <TableCell key={column.key} className="font-mono text-[13px] font-semibold whitespace-nowrap">
                                                        <span className="flex items-center gap-2">
                                                            {dissolvido && (
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                                                                    title="Conselho dissolvido"
                                                                />
                                                            )}
                                                            {text || '—'}
                                                        </span>
                                                    </TableCell>
                                                );
                                            }
                                            if (column.key === 'realizacao') {
                                                const meta = realizacaoMeta(getRealizacao(juri));
                                                return (
                                                    <TableCell key={column.key}>
                                                        <Badge className={`${meta.badge} border-0 text-[11px] font-medium whitespace-nowrap`}>
                                                            {meta.label}
                                                        </Badge>
                                                    </TableCell>
                                                );
                                            }
                                            if (column.key === 'resultado') {
                                                return (
                                                    <TableCell key={column.key}>
                                                        {text ? (
                                                            <Badge
                                                                variant={dissolvido ? 'outline' : 'secondary'}
                                                                className="text-[11px] font-medium whitespace-nowrap"
                                                            >
                                                                {text}
                                                            </Badge>
                                                        ) : '—'}
                                                    </TableCell>
                                                );
                                            }
                                            return (
                                                <TableCell key={column.key} className="text-[13px] text-slate-600 dark:text-slate-300">
                                                    <span className="block max-w-[260px] truncate" title={text}>
                                                        {text || '—'}
                                                    </span>
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {onView && (
                                                        <DropdownMenuItem onClick={() => onView(juri)} className="gap-2">
                                                            <Eye className="w-4 h-4" /> Ver detalhes
                                                        </DropdownMenuItem>
                                                    )}
                                                    {onEdit && (
                                                        <DropdownMenuItem onClick={() => onEdit(juri)} className="gap-2">
                                                            <Pencil className="w-4 h-4" /> Editar
                                                        </DropdownMenuItem>
                                                    )}
                                                    {canDelete && onDelete && (
                                                        <DropdownMenuItem
                                                            onClick={() => onDelete(juri)}
                                                            className="gap-2 text-rose-600 focus:text-rose-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Excluir
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Paginação */}
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
