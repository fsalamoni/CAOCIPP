import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    pointerWithin,
    closestCorners,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Inbox, Pencil, Eye, FolderCheck, SlidersHorizontal, FilterX, ArrowUpDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDerivedStatus, getProcessField } from '@/utils/processUtils';
import { updateProcess } from '@/services/functionsService';
import { isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import KanbanCard from './KanbanCard';
import KanbanTransitionDialog from './KanbanTransitionDialog';
import ProcessDetailSheet from './ProcessDetailSheet';
import EditProcessDialog from './EditProcessDialog';
import CreateProcessButton from './CreateProcessButton';
import EmptyState from '../ui/EmptyState';
import { useUserPreferences } from '@/hooks/useFirestore';


// === Column Definitions ===
const KANBAN_COLUMNS = [
    {
        id: 'Pendente',
        label: 'Pendentes',
        icon: Inbox,
        emptyText: 'Nenhum processo pendente',
        headerBg: 'bg-slate-50',
        headerBorder: 'border-slate-200',
        headerText: 'text-slate-600',
        columnBg: 'bg-slate-50/50',
        dotColor: 'bg-slate-400',
    },
    {
        id: 'Em elaboração',
        label: 'Em Análise',
        icon: Pencil,
        emptyText: 'Nenhum processo em análise',
        headerBg: 'bg-amber-50',
        headerBorder: 'border-amber-200',
        headerText: 'text-amber-700',
        columnBg: 'bg-amber-50/30',
        dotColor: 'bg-amber-400',
    },
    {
        id: 'Em revisão',
        label: 'Em Revisão',
        icon: Eye,
        emptyText: 'Nenhum processo em revisão',
        headerBg: 'bg-sky-50',
        headerBorder: 'border-sky-200',
        headerText: 'text-sky-700',
        columnBg: 'bg-sky-50/30',
        dotColor: 'bg-sky-400',
    },
    {
        id: 'Na pasta',
        label: 'Arquivados',
        icon: FolderCheck,
        emptyText: 'Nenhum processo arquivado',
        headerBg: 'bg-green-50',
        headerBorder: 'border-green-200',
        headerText: 'text-green-700',
        columnBg: 'bg-green-50/30',
        dotColor: 'bg-green-400',
    },
];

// Valid transitions: forward only for advancing to the next stage.
// Backward transitions are computed dynamically and may move to any previous stage.
const VALID_FORWARD = { 0: [1], 1: [2], 2: [3], 3: [] };

const DATE_SORT_KEYS = new Set([
    'entry_date',
    'distribution_date',
    'analysis_start_date',
    'review_submission_date',
    'review_return_date',
    'archived_date',
]);

const PROCESS_SORT_OPTIONS = [
    { key: 'urgency_request', label: 'Urgência' },
    { key: 'entry_date', label: 'Entrada no órgão' },
    { key: 'process_number', label: 'Número do processo' },
    { key: 'consultant', label: 'Consulente' },
    { key: 'responsible_user_name', label: 'Responsável' },
];

const buildDefaultProcessFilters = () => ({
    urgency: 'all',
    responsible: 'all',
    consultant: 'all',
});

const buildDefaultProcessSortRules = () => ([
    { key: 'urgency_request', direction: 'desc' },
    { key: 'entry_date', direction: 'asc' },
]);

const isUrgencyMarked = (value) =>
    value === true || String(value ?? '').toLowerCase().trim() === 'sim';

const sanitizeSortRules = (rules) => {
    if (!Array.isArray(rules)) return [];

    const validKeys = new Set(PROCESS_SORT_OPTIONS.map(option => option.key));
    return rules
        .map(rule => ({
            key: rule?.key,
            direction: rule?.direction === 'desc' ? 'desc' : 'asc',
        }))
        .filter(rule => validKeys.has(rule.key))
        .slice(0, 3);
};

export default function KanbanBoard({
    organization,
    members,
    processes,
    userRole,
    userId,
    processesLoading,
}) {
    const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();

    const [activeId, setActiveId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('assign');
    const [pendingProcess, setPendingProcess] = useState(null);
    const [pendingTarget, setPendingTarget] = useState(null);

    // Detail sheet state
    const [detailProcess, setDetailProcess] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Edit dialog state
    const [editProcess, setEditProcess] = useState(null);
    const [editOpen, setEditOpen] = useState(false);

    // Year filter
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [viewFilters, setViewFilters] = useState(() => buildDefaultProcessFilters());
    const [sortRules, setSortRules] = useState(() => buildDefaultProcessSortRules());
    const [isPrefsInitialized, setIsPrefsInitialized] = useState(false);

    const years = useMemo(() => {
        const yearsSet = new Set([currentYear]);
        processes.forEach(p => {
            const date = parseLocalDate(getProcessField(p, 'entry_date'));
            const year = isValid(date) ? date.getFullYear() : null;
            if (year && !isNaN(year)) yearsSet.add(year);
        });
        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [processes, currentYear]);

    const availableResponsibleNames = useMemo(() => {
        const names = new Set();
        processes.forEach(p => {
            const value = getProcessField(p, 'responsible_user_name');
            if (value && typeof value === 'string' && value.trim()) {
                names.add(value.trim());
            }
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [processes]);

    const availableConsultants = useMemo(() => {
        const names = new Set();
        processes.forEach(p => {
            const value = getProcessField(p, 'consultant');
            if (value && typeof value === 'string' && value.trim()) {
                names.add(value.trim());
            }
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [processes]);

    const appliedPrefsRef = useRef(null);
    useEffect(() => {
        if (isLoadingPrefs) return;

        const prefsSlice = {
            filters: preferences?.kanban_process_filters || null,
            sortRules: preferences?.kanban_process_sortRules || null,
        };
        const prefsKey = JSON.stringify(prefsSlice);
        if (appliedPrefsRef.current === prefsKey) {
            if (!isPrefsInitialized) setIsPrefsInitialized(true);
            return;
        }

        const loadedFilters =
            prefsSlice.filters && typeof prefsSlice.filters === 'object'
                ? {
                    ...buildDefaultProcessFilters(),
                    urgency: prefsSlice.filters.urgency || 'all',
                    responsible: prefsSlice.filters.responsible || 'all',
                    consultant: prefsSlice.filters.consultant || 'all',
                }
                : buildDefaultProcessFilters();

        const loadedSortRules = sanitizeSortRules(prefsSlice.sortRules);

        setViewFilters(loadedFilters);
        setSortRules(loadedSortRules.length > 0 ? loadedSortRules : buildDefaultProcessSortRules());
        appliedPrefsRef.current = prefsKey;

        if (!isPrefsInitialized) {
            setIsPrefsInitialized(true);
        }
    }, [preferences, isLoadingPrefs, isPrefsInitialized]);

    const effectiveSortRules = useMemo(() => {
        const sanitized = sanitizeSortRules(sortRules);
        return sanitized.length > 0 ? sanitized : buildDefaultProcessSortRules();
    }, [sortRules]);

    const saveTimerRef = useRef(null);
    useEffect(() => {
        if (!isPrefsInitialized) return;

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            updatePreferences({
                kanban_process_filters: viewFilters,
                kanban_process_sortRules: effectiveSortRules,
            });
        }, 500);

        return () => clearTimeout(saveTimerRef.current);
    }, [viewFilters, effectiveSortRules, isPrefsInitialized, updatePreferences]);

    const getComparableValue = useCallback((process, key) => {
        if (key === 'urgency_request') {
            return isUrgencyMarked(getProcessField(process, 'urgency_request')) ? 1 : 0;
        }

        const rawValue = getProcessField(process, key);
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
            return null;
        }

        if (DATE_SORT_KEYS.has(key)) {
            const parsedDate = parseLocalDate(rawValue);
            return isValid(parsedDate) ? parsedDate.getTime() : null;
        }

        return String(rawValue);
    }, []);

    const compareProcesses = useCallback((a, b) => {
        for (const rule of effectiveSortRules) {
            const valueA = getComparableValue(a, rule.key);
            const valueB = getComparableValue(b, rule.key);

            if (valueA === null && valueB === null) continue;
            if (valueA === null) return 1;
            if (valueB === null) return -1;

            let comparison = 0;
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                comparison = valueA - valueB;
            } else {
                comparison = String(valueA).localeCompare(String(valueB), 'pt-BR', {
                    numeric: true,
                    sensitivity: 'base',
                });
            }

            if (comparison !== 0) {
                return rule.direction === 'asc' ? comparison : -comparison;
            }
        }

        return 0;
    }, [effectiveSortRules, getComparableValue]);

    const filteredProcesses = useMemo(() => {
        return processes.filter(p => {
            const date = parseLocalDate(getProcessField(p, 'entry_date'));
            if (!isValid(date)) {
                return false;
            }

            if (date.getFullYear() !== selectedYear) {
                return false;
            }

            const isUrgent = isUrgencyMarked(getProcessField(p, 'urgency_request'));
            if (viewFilters.urgency === 'urgent' && !isUrgent) {
                return false;
            }
            if (viewFilters.urgency === 'normal' && isUrgent) {
                return false;
            }

            if (
                viewFilters.responsible !== 'all' &&
                getProcessField(p, 'responsible_user_name') !== viewFilters.responsible
            ) {
                return false;
            }

            if (viewFilters.consultant !== 'all' && getProcessField(p, 'consultant') !== viewFilters.consultant) {
                return false;
            }

            return true;
        });
    }, [processes, selectedYear, viewFilters]);

    // User role detection
    const userMember = useMemo(() =>
        members.find(m => m.user_id === userId),
        [members, userId]
    );
    const userFunc = (userMember?.function || '').toLowerCase();
    const isAssessor = userFunc.includes('assessor') || userFunc.includes('assessoria');

    const assessors = useMemo(() =>
        members.filter(m => {
            const fn = (m.function || '').toLowerCase();
            return fn.includes('assessor') || fn.includes('assessoria');
        }),
        [members]
    );

    // Distribute into columns
    const columns = useMemo(() => {
        const grouped = { 'Pendente': [], 'Em elaboração': [], 'Em revisão': [], 'Na pasta': [] };
        filteredProcesses.forEach(p => {
            const status = calculateDerivedStatus(p);
            (grouped[status] || grouped['Pendente']).push(p);
        });

        Object.keys(grouped).forEach(statusKey => {
            grouped[statusKey] = grouped[statusKey]
                .map((item, index) => ({ item, index }))
                .sort((a, b) => {
                    const ruleComparison = compareProcesses(a.item, b.item);
                    if (ruleComparison !== 0) {
                        return ruleComparison;
                    }
                    return a.index - b.index;
                })
                .map(({ item }) => item);
        });

        return grouped;
    }, [filteredProcesses, compareProcesses]);

    const activeProcess = useMemo(() => {
        if (!activeId) return null;
        return filteredProcesses.find(p => p.id === activeId) || null;
    }, [activeId, filteredProcesses]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
    );

    const getColumnIndex = (status) =>
        KANBAN_COLUMNS.findIndex(col => col.id === status);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (viewFilters.urgency !== 'all') count += 1;
        if (viewFilters.responsible !== 'all') count += 1;
        if (viewFilters.consultant !== 'all') count += 1;
        return count;
    }, [viewFilters]);

    const handleFilterChange = useCallback((key, value) => {
        setViewFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setViewFilters(buildDefaultProcessFilters());
    }, []);

    const resetSortRules = useCallback(() => {
        setSortRules(buildDefaultProcessSortRules());
    }, []);

    const resetViewConfig = useCallback(() => {
        setViewFilters(buildDefaultProcessFilters());
        setSortRules(buildDefaultProcessSortRules());
    }, []);

    const addSortRule = useCallback(() => {
        setSortRules(prev => {
            const current = sanitizeSortRules(prev);
            if (current.length >= 3) return current;

            const usedKeys = new Set(current.map(rule => rule.key));
            const nextKey = PROCESS_SORT_OPTIONS.find(option => !usedKeys.has(option.key))?.key || 'entry_date';

            return [...current, { key: nextKey, direction: 'asc' }];
        });
    }, []);

    const updateSortRuleKey = useCallback((index, nextKey) => {
        setSortRules(prev => {
            const current = sanitizeSortRules(prev);
            if (!current[index]) return current;

            const next = [...current];
            next[index] = { ...next[index], key: nextKey };
            return next;
        });
    }, []);

    const updateSortRuleDirection = useCallback((index, nextDirection) => {
        setSortRules(prev => {
            const current = sanitizeSortRules(prev);
            if (!current[index]) return current;

            const next = [...current];
            next[index] = {
                ...next[index],
                direction: nextDirection === 'desc' ? 'desc' : 'asc',
            };
            return next;
        });
    }, []);

    const removeSortRule = useCallback((index) => {
        setSortRules(prev => {
            const current = sanitizeSortRules(prev);
            if (current.length <= 1) return current;

            return current.filter((_, idx) => idx !== index);
        });
    }, []);

    // === Eye Icon: View Details ===
    const handleViewDetails = useCallback((process) => {
        setDetailProcess(process);
        setDetailOpen(true);
    }, []);

    const handleEditFromDetail = useCallback((process) => {
        setDetailOpen(false);
        setEditProcess(process);
        setEditOpen(true);
    }, []);

    // === Drag Handlers ===
    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const process = filteredProcesses.find(p => p.id === active.id);
        if (!process) return;

        const currentStatus = calculateDerivedStatus(process);
        const targetColumnId = over.data?.current?.columnId || over.id;

        if (currentStatus === targetColumnId) return;

        const currentIdx = getColumnIndex(currentStatus);
        const targetIdx = getColumnIndex(targetColumnId);

        if (currentIdx < 0 || targetIdx < 0) {
            toast.error('Não foi possível identificar a coluna de origem ou destino.', { duration: 3000 });
            return;
        }

        const isForward = VALID_FORWARD[currentIdx]?.includes(targetIdx);
        const isBackward = targetIdx < currentIdx;

        if (!isForward && !isBackward) {
            toast.error('Para avançar o fluxo, mova apenas para a próxima coluna.', { duration: 3000 });
            return;
        }

        if (isBackward) {
            handleBackwardMove(process, currentStatus, targetColumnId);
        } else {
            handleForwardTransition(process, currentStatus, targetColumnId);
        }
    }, [filteredProcesses, isAssessor, userId, userMember]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    // === Backward Move ===
    const handleBackwardMove = async (process, fromStatus, toStatus) => {
        const processNumber = getProcessField(process, 'process_number');
        const colLabel = KANBAN_COLUMNS.find(c => c.id === toStatus)?.label || toStatus;

        const rollbackByStatus = {
            Pendente: {
                analysis_start_date: null,
                review_submission_date: null,
                review_return_date: null,
                archived_date: null,
                responsible_user_id: null,
                responsible_user_name: null,
            },
            'Em elaboração': {
                review_submission_date: null,
                review_return_date: null,
                archived_date: null,
            },
            'Em revisão': {
                archived_date: null,
            },
        };

        const changes = {
            status: toStatus,
            ...(rollbackByStatus[toStatus] || {}),
        };

        try {
            await updateProcess({
                id: process.id,
                organizationId: organization.id,
                changes,
            });
            toast.success(`Processo ${processNumber} retornou para "${colLabel}".`);
        } catch (err) {
            toast.error('Erro ao mover processo: ' + err.message);
        }
    };

    // === Forward Transition ===
    const handleForwardTransition = async (process, fromStatus, toStatus) => {
        const today = new Date().toISOString().split('T')[0];

        if (fromStatus === 'Pendente' && toStatus === 'Em elaboração') {
            // Always show assign dialog; pre-select self if assessor
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('assign');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em elaboração' && toStatus === 'Em revisão') {
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('review');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em revisão' && toStatus === 'Na pasta') {
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('archive');
            setDialogOpen(true);
            return;
        }
    };

    // === Dialog Confirm ===
    const handleDialogConfirm = async (data) => {
        if (!pendingProcess || !pendingTarget) return;

        const today = new Date().toISOString().split('T')[0];
        const processNumber = getProcessField(pendingProcess, 'process_number');
        let changes = {};

        if (dialogMode === 'assign') {
            changes = {
                analysis_start_date: today,
                distribution_date: today,
                responsible_user_id: data.responsible_user_id,
                responsible_user_name: data.responsible_user_name,
                status: 'Em elaboração',
            };
        } else if (dialogMode === 'review') {
            changes = {
                review_submission_date: today,
                observations: data.observations,
                network_folder: data.network_folder,
                status: 'Em revisão',
            };
        } else if (dialogMode === 'archive') {
            changes = {
                archived_date: today,
                review_return_date: data.review_return_date || today,
                status: 'Na pasta',
            };
        }

        try {
            await updateProcess({
                id: pendingProcess.id,
                organizationId: organization.id,
                changes,
            });
            const actions = {
                assign: `Processo ${processNumber} em análise!`,
                review: `Processo ${processNumber} enviado para revisão!`,
                archive: `Processo ${processNumber} arquivado!`,
            };
            toast.success(actions[dialogMode]);
        } catch (err) {
            toast.error('Erro ao atualizar processo: ' + err.message);
            throw err;
        }

        setPendingProcess(null);
        setPendingTarget(null);
    };

    if (processesLoading) {
        return (
            <Card className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel de Consultas</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Arraste os processos entre as colunas para avançar ou retornar o fluxo.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <CreateProcessButton organization={organization} members={members} />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                Filtros e ordem
                                {activeFiltersCount > 0 && (
                                    <Badge className="h-5 min-w-[20px] bg-indigo-600 px-1.5 text-[10px] text-white hover:bg-indigo-600">
                                        {activeFiltersCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[420px] space-y-4 p-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-sm font-semibold text-slate-800">Configurar visualização</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetViewConfig}
                                    className="h-8 gap-1 text-[11px] font-semibold uppercase tracking-tight text-indigo-600 hover:text-indigo-700"
                                >
                                    <FilterX className="h-3.5 w-3.5" />
                                    Restaurar padrão
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filtros por coluna</p>

                                <Select value={viewFilters.urgency} onValueChange={(value) => handleFilterChange('urgency', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Urgência" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Urgência: todas</SelectItem>
                                        <SelectItem value="urgent">Somente urgentes</SelectItem>
                                        <SelectItem value="normal">Somente não urgentes</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={viewFilters.responsible} onValueChange={(value) => handleFilterChange('responsible', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Responsável" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Responsável: todos</SelectItem>
                                        {availableResponsibleNames.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={viewFilters.consultant} onValueChange={(value) => handleFilterChange('consultant', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Consulente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Consulente: todos</SelectItem>
                                        {availableConsultants.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <div className="flex justify-end pt-1">
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-slate-600">
                                        Limpar filtros
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-slate-100 pt-3">
                                <div className="flex items-center justify-between">
                                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <ArrowUpDown className="h-3.5 w-3.5" />
                                        Ordem por colunas
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addSortRule}
                                        disabled={sortRules.length >= 3}
                                        className="h-8 gap-1 text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Adicionar
                                    </Button>
                                </div>

                                <p className="text-[11px] text-slate-500">
                                    Padrão: urgentes primeiro, depois entrada no órgão dos mais antigos para os mais novos.
                                </p>

                                {sortRules.map((rule, index) => (
                                    <div key={`${rule.key}-${index}`} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
                                        <Select value={rule.key} onValueChange={(value) => updateSortRuleKey(index, value)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PROCESS_SORT_OPTIONS.map(option => (
                                                    <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Select value={rule.direction} onValueChange={(value) => updateSortRuleDirection(index, value)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="asc">Crescente</SelectItem>
                                                <SelectItem value="desc">Decrescente</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={sortRules.length <= 1}
                                            onClick={() => removeSortRule(index)}
                                            className="h-9 w-9 text-slate-500"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                <div className="flex justify-end pt-1">
                                    <Button variant="ghost" size="sm" onClick={resetSortRules} className="h-8 text-xs text-slate-600">
                                        Resetar ordem
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 pl-3 pr-8 rounded-lg border-slate-200 bg-white shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>Ano: {y}</option>)}
                    </select>
                    <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 px-3 py-1">
                        {filteredProcesses.length} {filteredProcesses.length === 1 ? 'processo' : 'processos'}
                    </Badge>
                </div>
            </div>

            {/* Kanban Board */}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    // Try pointerWithin first (most intuitive for columns)
                    const pointerCollisions = pointerWithin(args);
                    if (pointerCollisions.length > 0) return pointerCollisions;
                    // Fallback to closestCorners for edge cases
                    return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {KANBAN_COLUMNS.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            processes={columns[col.id] || []}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeProcess ? (
                        <KanbanCard process={activeProcess} overlay />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Transition Dialog */}
            {pendingProcess && (
                <KanbanTransitionDialog
                    open={dialogOpen}
                    onClose={() => {
                        setDialogOpen(false);
                        setPendingProcess(null);
                        setPendingTarget(null);
                    }}
                    mode={dialogMode}
                    process={pendingProcess}
                    assessors={assessors}
                    defaultAssessor={isAssessor ? userId : ''}
                    onConfirm={handleDialogConfirm}
                />
            )}

            {/* Process Detail Sheet (same as Controle de Processos) */}
            <ProcessDetailSheet
                process={detailProcess}
                open={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    setDetailProcess(null);
                }}
                onEdit={handleEditFromDetail}
                getProcessField={getProcessField}
            />

            {/* Edit Process Dialog (same as Controle de Processos) */}
            {editProcess && (
                <EditProcessDialog
                    open={editOpen}
                    setOpen={(open) => {
                        setEditOpen(open);
                        if (!open) setEditProcess(null);
                    }}
                    process={editProcess}
                    members={members}
                    onSuccess={() => {
                        setEditOpen(false);
                        setEditProcess(null);
                    }}
                    organizationId={organization.id}
                    organization={organization}
                    userRole={userRole}
                />
            )}
        </div>
    );
}

// === Droppable Column ===
function KanbanColumn({ column, processes, onViewDetails }) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: { columnId: column.id },
    });

    const ColIcon = column.icon;

    return (
        <div
            ref={setNodeRef}
            className={`
        rounded-xl border flex flex-col
        ${column.headerBorder}
        ${isOver ? 'ring-2 ring-indigo-300 bg-indigo-50/30' : ''}
      `}
            style={{ minHeight: '500px' }}
        >
            <div className={`
        px-4 py-3 rounded-t-xl border-b flex items-center justify-between
        ${column.headerBg} ${column.headerBorder}
      `}>
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                    <ColIcon className={`w-4 h-4 ${column.headerText}`} />
                    <span className={`text-sm font-bold ${column.headerText}`}>{column.label}</span>
                </div>
                <Badge variant="secondary" className="bg-white/50 text-slate-600 border-0">
                    {processes.length}
                </Badge>


            </div>

            <div className={`flex-1 p-3 space-y-2 ${column.columnBg} rounded-b-xl overflow-y-auto`}
                style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
                <SortableContext items={processes.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {processes.length > 0 ? (
                        processes.map(p => (
                            <KanbanCard key={p.id} process={p} columnId={column.id} onViewDetails={onViewDetails} />
                        ))
                    ) : (
                        <EmptyState
                            icon={ColIcon}
                            title={column.emptyText}
                            description="Não há processos nesta etapa do fluxo no momento."
                            className="py-12 border-none shadow-none bg-transparent"
                        />
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
