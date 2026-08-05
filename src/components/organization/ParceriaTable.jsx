import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from "@/components/ui/StatusBadge";
import { useUserPreferences } from '@/hooks/useFirestore';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/dateUtils';
import { Search, MoreHorizontal, Pencil, ArrowUpDown, Filter, FilterX, X, Download, Rows3, Rows4, Bookmark } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { SearchX, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
    getParceriaField,
    calculateParceriaDerivedStatus,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { extinguishParceria } from '@/services/functionsService';

// Tradução legada mantida por compat (não mais usada para selects, mas
// renderização de células pode precisar).
const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'Termo de Cooperação',
    termo_fomento: 'Termo de Fomento',
};

const STATUSES = ['Pendente', 'Em análise', 'Revisão', 'Aguarda Terceiros', 'Parcerias', 'Extintos'];

const formatDate = (s) => {
    const d = parseLocalDate(s);
    if (!d || !isValid(d)) return '—';
    try { return format(d, 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
};

// Tipos de coluna default.
const DEFAULT_COLUMNS = [
    { key: 'pgea', label: 'PGEA', width: 'w-32', type: 'pgea' },
    { key: 'partnership_type', label: 'Tipo', width: 'w-44', type: 'type' },
    { key: 'partnership_number', label: 'Número', width: 'w-32', type: 'text' },
    { key: 'subject', label: 'Assunto', type: 'subject' },
    { key: 'parties', label: 'Partes', type: 'parties' },
    { key: 'responsible_user_name', label: 'Responsável', width: 'w-44', type: 'text' },
    { key: 'signature_date', label: 'Assinatura', width: 'w-32', type: 'date' },
    { key: 'end_date', label: 'Termo Final', width: 'w-32', type: 'date' },
    { key: 'aditivo_count', label: 'Aditivos', width: 'w-24', type: 'aditivo' },
    { key: 'status', label: 'Situação', width: 'w-40', type: 'status' },
];

/**
 * ParceriaTable — tabela completa no padrão de ExpedienteTable.
 * Inclui: busca, filtros (tipo/status/data), sort, density, saved views,
 * bulk actions (extinguir), export CSV, paginação, click-to-open DetailSheet.
 */
export default function ParceriaTable({
    parcerias = [],
    members = [],
    userId,
    isLoading = false,
    onEdit,
    onView,
    initialFilter,
    organization,
}) {
    const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
    const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
    const isDensityOn = useFlag(FEATURE_FLAGS.TABLE_DENSITY.key);
    const isStageIndicatorOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);
    const isExportOn = useFlag(FEATURE_FLAGS.EXPORT_PDF_EXCEL.key);
    const isBulkActionsOn = useFlag(FEATURE_FLAGS.BULK_ACTIONS.key);
    const isSavedViewsOn = useFlag(FEATURE_FLAGS.SAVED_VIEWS.key);
    const isAccessAuditLogOn = useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key);

    const [search, setSearch] = useState(() => localStorage.getItem('parceriaSearchTerm') || '');
    useEffect(() => {
        localStorage.setItem('parceriaSearchTerm', search);
    }, [search]);

    const orgIdRef = useRef(organization?.id);
    useEffect(() => {
        if (orgIdRef.current === organization?.id) return;
        orgIdRef.current = organization?.id;
        setSearch('');
    }, [organization?.id]);

    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const [aditivoFilter, setAditivoFilter] = useState('all');
    const [dateFilters, setDateFilters] = useState({
        signature: { start: '', end: '' },
        end: { start: '', end: '' },
    });
    const [sortRules, setSortRules] = useState([{ key: 'pgea', direction: 'asc' }]);
    const [density, setDensity] = useState('comfortable');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [newViewName, setNewViewName] = useState('');
    const savedViews = preferences?.savedParceriaViews || [];

    // Disponível: tipos / responsáveis / aditivos.
    const availableTypes = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const t = getParceriaField(p, 'partnership_type');
            if (t) set.add(t);
        });
        return Array.from(set);
    }, [parcerias]);

    const availableResponsibles = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const r = getParceriaField(p, 'responsible_user_name');
            if (r && r.trim()) set.add(r.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [parcerias]);

    // Filtro + sort.
    const filteredAndSorted = useMemo(() => {
        let out = parcerias;
        if (search.trim()) {
            const s = search.toLowerCase();
            out = out.filter((p) => {
                return (
                    String(getParceriaField(p, 'pgea') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'subject') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'parties') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'partnership_number') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'object') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'categoria') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'third_party') || '').toLowerCase().includes(s)
                );
            });
        }
        if (typeFilter !== 'all') {
            out = out.filter((p) => getParceriaField(p, 'partnership_type') === typeFilter);
        }
        if (statusFilter !== 'all') {
            out = out.filter((p) => calculateParceriaDerivedStatus(p) === statusFilter);
        }
        if (responsibleFilter !== 'all') {
            out = out.filter((p) => getParceriaField(p, 'responsible_user_name') === responsibleFilter);
        }
        if (aditivoFilter !== 'all') {
            out = out.filter((p) => {
                const has = hasAdditives(p);
                return aditivoFilter === 'yes' ? has : !has;
            });
        }
        // Filtros por data de assinatura / termo final.
        const inRange = (val, range) => {
            if (!val) return true;
            const d = parseLocalDate(val);
            if (!d || !isValid(d)) return true;
            if (range.start) {
                const sd = parseLocalDate(range.start);
                if (sd && d < startOfDay(sd)) return false;
            }
            if (range.end) {
                const ed = parseLocalDate(range.end);
                if (ed && d > endOfDay(ed)) return false;
            }
            return true;
        };
        if (dateFilters.signature.start || dateFilters.signature.end) {
            out = out.filter((p) => inRange(getParceriaField(p, 'signature_date'), dateFilters.signature));
        }
        if (dateFilters.end.start || dateFilters.end.end) {
            out = out.filter((p) => inRange(getParceriaField(p, 'end_date'), dateFilters.end));
        }
        // Sort.
        const sorted = out.slice();
        sorted.sort((a, b) => {
            for (const rule of sortRules) {
                const av = getSortValue(a, rule.key);
                const bv = getSortValue(b, rule.key);
                if (av === bv) continue;
                const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                return rule.direction === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
        return sorted;
    }, [parcerias, search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, dateFilters, sortRules]);

    function getSortValue(p, key) {
        if (key === 'status') return calculateParceriaDerivedStatus(p);
        if (key === 'aditivo_count') return Number(getParceriaField(p, 'aditivo_count')) || 0;
        const v = getParceriaField(p, key);
        if (v && typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/)) {
            const d = parseLocalDate(v);
            return d && isValid(d) ? d.getTime() : 0;
        }
        return (v || '').toString().toLowerCase();
    }

    // Paginação.
    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage));
    const paginated = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredAndSorted.slice(start, start + itemsPerPage);
    }, [filteredAndSorted, currentPage, itemsPerPage]);

    useEffect(() => { setCurrentPage(1); }, [search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, dateFilters]);
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

    // Ações.
    const clearFilters = () => {
        setSearch('');
        setTypeFilter('all');
        setStatusFilter('all');
        setResponsibleFilter('all');
        setAditivoFilter('all');
        setDateFilters({ signature: { start: '', end: '' }, end: { start: '', end: '' } });
    };

    const handleSort = (key) => {
        setSortRules((prev) => {
            const existing = prev.find((r) => r.key === key);
            if (existing) {
                return prev.map((r) => r.key === key ? { ...r, direction: r.direction === 'asc' ? 'desc' : 'asc' } : r);
            }
            return [...prev, { key, direction: 'asc' }];
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === paginated.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(paginated.map((p) => p.id)));
    };
    const toggleSelectOne = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const clearSelection = () => setSelectedIds(new Set());

    // Extinção em massa.
    const handleBulkExtinguish = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Extinguir ${selectedIds.size} parceria(s)? Esta ação é irreversível.`)) return;
        const ids = Array.from(selectedIds);
        let errors = 0;
        for (const id of ids) {
            const p = parcerias.find((x) => x.id === id);
            if (!p) continue;
            try {
                await extinguishParceria({ id, organizationId: organization.id });
            } catch (e) {
                logger.error('Bulk extinguish failed for', id, e);
                errors += 1;
            }
        }
        clearSelection();
        if (errors === 0) toast.success(`${ids.length} parceria(s) extinta(s).`);
        else toast.error(`${ids.length - errors} ok, ${errors} falharam.`);
    };

    // Export CSV.
    const handleExportCSV = () => {
        const headers = ['PGEA', 'Tipo', 'Número', 'Assunto', 'Partes', 'Responsável', 'Assinatura', 'Termo Final', 'Aditivos', 'Situação'];
        const rows = filteredAndSorted.map((p) => [
            getParceriaField(p, 'pgea') || '',
            getParceriaField(p, 'partnership_type') || '',
            getParceriaField(p, 'partnership_number') || '',
            getParceriaField(p, 'subject') || '',
            getParceriaField(p, 'parties') || '',
            getParceriaField(p, 'responsible_user_name') || '',
            getParceriaField(p, 'signature_date') || '',
            getParceriaField(p, 'end_date') || '',
            String(getParceriaField(p, 'aditivo_count') || 0),
            calculateParceriaDerivedStatus(p),
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `parcerias-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exportação CSV gerada.');
    };

    // Saved views.
    const applySavedView = (view) => {
        if (view.search !== undefined) setSearch(view.search);
        if (view.typeFilter) setTypeFilter(view.typeFilter);
        if (view.statusFilter) setStatusFilter(view.statusFilter);
        if (view.responsibleFilter) setResponsibleFilter(view.responsibleFilter);
        if (view.aditivoFilter) setAditivoFilter(view.aditivoFilter);
        if (view.dateFilters) setDateFilters(view.dateFilters);
        toast.success(`Visão "${view.name}" aplicada.`);
    };
    const saveCurrentView = () => {
        if (!newViewName.trim()) return;
        const view = {
            id: `v_${Date.now()}`,
            name: newViewName.trim(),
            search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, dateFilters,
        };
        const next = [...savedViews, view];
        updatePreferences({ savedParceriaViews: next });
        setNewViewName('');
        toast.success('Visão salva.');
    };
    const removeSavedView = (id) => {
        updatePreferences({ savedParceriaViews: savedViews.filter((v) => v.id !== id) });
    };

    const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all'
        || responsibleFilter !== 'all' || aditivoFilter !== 'all'
        || dateFilters.signature.start || dateFilters.signature.end
        || dateFilters.end.start || dateFilters.end.end;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <span className="text-slate-500">Carregando...</span>
            </div>
        );
    }

    if (parcerias.length === 0) {
        return (
            <EmptyState
                title="Nenhuma Parceria cadastrada"
                description="Crie a primeira Parceria ou importe uma planilha."
                className="py-16"
            />
        );
    }

    const cellPadding = density === 'compact' ? 'py-1' : 'py-3';

    return (
        <div className="space-y-3">
            {/* Filtros principais */}
            <Card className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por PGEA, número, assunto, partes, categoria..."
                            className="pl-8"
                        />
                    </div>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            {availableTypes.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Situação" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as situações</SelectItem>
                            {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {availableResponsibles.length > 0 && (
                        <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="Responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os responsáveis</SelectItem>
                                {availableResponsibles.map((r) => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={aditivoFilter} onValueChange={setAditivoFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Aditivos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="yes">Com aditivos</SelectItem>
                            <SelectItem value="no">Sem aditivos</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Filtro de data (popover) */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Filter className="w-3.5 h-3.5" />
                                Período
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-3" align="end">
                            <p className="text-xs font-semibold text-slate-700 mb-2">Filtro por período</p>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Data de Assinatura</p>
                                    <div className="flex gap-2">
                                        <Input type="date" value={dateFilters.signature.start}
                                            onChange={(e) => setDateFilters((p) => ({ ...p, signature: { ...p.signature, start: e.target.value } }))}
                                            placeholder="De" />
                                        <Input type="date" value={dateFilters.signature.end}
                                            onChange={(e) => setDateFilters((p) => ({ ...p, signature: { ...p.signature, end: e.target.value } }))}
                                            placeholder="Até" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 mb-1">Termo Final</p>
                                    <div className="flex gap-2">
                                        <Input type="date" value={dateFilters.end.start}
                                            onChange={(e) => setDateFilters((p) => ({ ...p, end: { ...p.end, start: e.target.value } }))}
                                            placeholder="De" />
                                        <Input type="date" value={dateFilters.end.end}
                                            onChange={(e) => setDateFilters((p) => ({ ...p, end: { ...p.end, end: e.target.value } }))}
                                            placeholder="Até" />
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setDateFilters({ signature: { start: '', end: '' }, end: { start: '', end: '' } })}>
                                    Limpar períodos
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <FilterX className="w-4 h-4 mr-1" />
                            Limpar
                        </Button>
                    )}

                    {isDensityOn && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    {density === 'compact' ? <Rows4 className="w-3.5 h-3.5" /> : <Rows3 className="w-3.5 h-3.5" />}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDensity('comfortable')}>Confortável</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDensity('compact')}>Compacto</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {isExportOn && (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
                            <Download className="w-3.5 h-3.5" />
                            CSV
                        </Button>
                    )}
                </div>

                {/* Saved views (flag saved_views) */}
                {isSavedViewsOn && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                        <span className="text-xs text-slate-500 font-semibold">Visões salvas:</span>
                        {savedViews.length === 0 && (
                            <span className="text-xs text-slate-400">nenhuma</span>
                        )}
                        {savedViews.map((v) => (
                            <div key={v.id} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full pl-3 pr-1 py-0.5">
                                <button type="button" onClick={() => applySavedView(v)} className="text-xs font-medium hover:text-indigo-600">
                                    {v.name}
                                </button>
                                <button type="button" onClick={() => removeSavedView(v.id)} className="text-slate-300 hover:text-rose-500">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <div className="flex items-center gap-1 ml-auto">
                            <Input
                                value={newViewName}
                                onChange={(e) => setNewViewName(e.target.value)}
                                placeholder="Nome da visão"
                                className="h-7 w-32 text-xs"
                            />
                            <Button size="sm" variant="ghost" onClick={saveCurrentView} disabled={!newViewName.trim()}>
                                <Bookmark className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Ações em massa (flag bulk_actions) */}
            {isBulkActionsOn && selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3">
                    <span className="text-sm text-indigo-700 dark:text-indigo-200 font-medium">
                        {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={clearSelection}>Limpar seleção</Button>
                        <Button size="sm" variant="destructive" onClick={handleBulkExtinguish}>
                            <ClipboardList className="w-3.5 h-3.5 mr-1" />
                            Extinguir selecionadas
                        </Button>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800">
                            {isBulkActionsOn && (
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                        onCheckedChange={toggleSelectAll}
                                        aria-label="Selecionar todas"
                                    />
                                </TableHead>
                            )}
                            {DEFAULT_COLUMNS.map((c) => (
                                <TableHead key={c.key} className={c.width || ''}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSort(c.key)}
                                        className="-ml-2 h-8 font-semibold gap-1"
                                    >
                                        {c.label}
                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                    </Button>
                                </TableHead>
                            ))}
                            <TableHead className="text-right w-24">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={DEFAULT_COLUMNS.length + (isBulkActionsOn ? 2 : 1)} className="py-12 text-center">
                                    <EmptyState
                                        icon={SearchX}
                                        title="Nenhuma Parceria encontrada"
                                        description="Ajuste os filtros para ver resultados."
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginated.map((p) => {
                                const status = calculateParceriaDerivedStatus(p);
                                const isSelected = selectedIds.has(p.id);
                                return (
                                    <TableRow
                                        key={p.id}
                                        className={`cursor-pointer ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                                        onClick={() => onView?.(p)}
                                    >
                                        {isBulkActionsOn && (
                                            <TableCell className={cellPadding} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelectOne(p.id)}
                                                    aria-label={`Selecionar Parceria ${getParceriaField(p, 'pgea') || ''}`}
                                                />
                                            </TableCell>
                                        )}
                                        {DEFAULT_COLUMNS.map((c) => {
                                            let content;
                                            const raw = c.key === 'status' ? status : getParceriaField(p, c.key);
                                            if (c.type === 'pgea') {
                                                content = <span className="font-mono text-xs">{raw || '—'}</span>;
                                            } else if (c.type === 'date') {
                                                content = formatDate(raw);
                                            } else if (c.type === 'aditivo') {
                                                const v = Number(getParceriaField(p, 'aditivo_count')) || 0;
                                                content = v > 0 ? (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                                        #{v}
                                                    </Badge>
                                                ) : <span className="text-slate-400">—</span>;
                                            } else if (c.type === 'status') {
                                                content = <StatusBadge status={status} />;
                                            } else {
                                                content = raw || '—';
                                            }
                                            return <TableCell key={c.key} className={cellPadding}>{content}</TableCell>;
                                        })}
                                        <TableCell className={`${cellPadding} text-right`} onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuItem onClick={() => onView?.(p)}>
                                                        <Search className="w-3.5 h-3.5 mr-2" />
                                                        Ver detalhes
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onEdit?.(p)}>
                                                        <Pencil className="w-3.5 h-3.5 mr-2" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer de paginação */}
            {filteredAndSorted.length > 0 && (
                <div className="sticky bottom-0 mt-4 flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex items-center gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSorted.length)} de {filteredAndSorted.length} parcerias
                        </p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400 dark:text-slate-500">Exibir:</label>
                            <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
                                <SelectTrigger className="w-16 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1 || totalPages === 0}>
                            Anterior
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                            Próximo
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
