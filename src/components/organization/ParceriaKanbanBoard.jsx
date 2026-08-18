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
import {
    Loader2, Inbox, Pencil, Send, Eye, CheckCheck, Handshake, Archive, Plus, SlidersHorizontal,
    FilterX, ArrowUpDown, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { isValid } from 'date-fns';
import { computeStageAverages, resolveStageTimeConfig } from '@/lib/stageTime';
import { safeLower } from '@/lib/stringUtils';
import {
    calculateParceriaDerivedStatus,
    getParceriaField,
    hasAdditives,
} from '@/utils/parceriaUtils';
import {
    updateParceria, updateAditivo, concludeAditivo, deleteParceria,
} from '@/services/functionsService';
import { parseLocalDate } from '@/lib/dateUtils';
import { useUserPreferences, useAditivos } from '@/hooks/useFirestore';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useOrgPermission } from '@/lib/OrganizationPermissionsContext';
import ProcessLogDialog from './ProcessLogDialog';
import ParceriaKanbanCard from './ParceriaKanbanCard';
import ParceriaKanbanTransitionDialog from './ParceriaKanbanTransitionDialog';
import ParceriaDetailSheet from './ParceriaDetailSheet';
import CreateAditivoDialog from './CreateAditivoDialog';
import ConcludeAditivoDialog from './ConcludeAditivoDialog';
import ExtinguishConfirmDialog from './ExtinguishConfirmDialog';
import EditParceriaDialog from './EditParceriaDialog';
import EmptyState from '../ui/EmptyState';
import CreateParceriaDialog from './CreateParceriaDialog';

const KANBAN_COLUMNS_BASE = [
    {
        id: 'Pendente',
        label: 'Pendentes',
        icon: Inbox,
        emptyText: 'Nenhuma parceria pendente',
        headerBg: 'bg-slate-50 dark:bg-slate-800',
        headerBorder: 'border-slate-200 dark:border-slate-600',
        headerText: 'text-slate-600 dark:text-slate-100',
        columnBg: 'bg-slate-50/30 dark:bg-slate-900',
        dotColor: 'bg-slate-400 dark:bg-slate-400',
    },
    {
        id: 'Em análise',
        label: 'Em Análise',
        icon: Pencil,
        emptyText: 'Nenhuma parceria em análise',
        headerBg: 'bg-amber-50 dark:bg-amber-900',
        headerBorder: 'border-amber-200 dark:border-amber-600',
        headerText: 'text-amber-700 dark:text-amber-100',
        columnBg: 'bg-amber-50/30 dark:bg-amber-950/30',
        dotColor: 'bg-amber-400 dark:bg-amber-400',
    },
    {
        id: 'Em revisão',
        label: 'Em Revisão',
        icon: Eye,
        emptyText: 'Nenhuma parceria em revisão',
        headerBg: 'bg-sky-50 dark:bg-sky-900',
        headerBorder: 'border-sky-200 dark:border-sky-600',
        headerText: 'text-sky-700 dark:text-sky-100',
        columnBg: 'bg-sky-50/30 dark:bg-sky-950/30',
        dotColor: 'bg-sky-400 dark:bg-sky-400',
    },
    {
        id: 'Revisadas',
        label: 'Revisadas',
        icon: CheckCheck,
        emptyText: 'Nenhuma parceria revisada',
        headerBg: 'bg-violet-50 dark:bg-violet-900',
        headerBorder: 'border-violet-200 dark:border-violet-600',
        headerText: 'text-violet-700 dark:text-violet-100',
        columnBg: 'bg-violet-50/30 dark:bg-violet-950/30',
        dotColor: 'bg-violet-400 dark:bg-violet-400',
    },
    {
        id: 'Aguarda Terceiros',
        label: 'Aguarda Terceiros',
        icon: Send,
        emptyText: 'Nenhuma parceria aguardando terceiros',
        headerBg: 'bg-cyan-50 dark:bg-cyan-900',
        headerBorder: 'border-cyan-200 dark:border-cyan-600',
        headerText: 'text-cyan-700 dark:text-cyan-100',
        columnBg: 'bg-cyan-50/30 dark:bg-cyan-950/30',
        dotColor: 'bg-cyan-400 dark:bg-cyan-400',
        conditional: 'thirdPartyPhaseEnabled',
    },
    {
        id: 'Parcerias',
        label: 'Parcerias',
        icon: Handshake,
        emptyText: 'Nenhuma parceria formalizada',
        headerBg: 'bg-emerald-50 dark:bg-emerald-900',
        headerBorder: 'border-emerald-200 dark:border-emerald-600',
        headerText: 'text-emerald-700 dark:text-emerald-100',
        columnBg: 'bg-emerald-50/30 dark:bg-emerald-950/30',
        dotColor: 'bg-emerald-400 dark:bg-emerald-400',
    },
    {
        id: 'Extintos',
        label: 'Extintos',
        icon: Archive,
        emptyText: 'Nenhuma parceria extinta',
        headerBg: 'bg-slate-100 dark:bg-slate-700',
        headerBorder: 'border-slate-300 dark:border-slate-500',
        headerText: 'text-slate-500 dark:text-slate-300',
        columnBg: 'bg-slate-100/30 dark:bg-slate-900',
        dotColor: 'bg-slate-300 dark:bg-slate-500',
    },
];

function resolveColumns(organization) {
    const flag = organization?.parceriaSettings?.thirdPartyPhaseEnabled;
    const showThirdParty = flag !== false;
    return KANBAN_COLUMNS_BASE.filter((c) => {
        if (c.conditional === 'thirdPartyPhaseEnabled') return showThirdParty;
        return true;
    });
}

// Transições válidas para mover para frente, recalculadas quando colunas são
// removidas. Pula "Aguarda Terceiros" indo direto de "Em análise" para
// "Parcerias" se a coluna intermediária ("Aguarda Terceiros") for removida.
function buildValidForward(columns) {
    const map = {};
    columns.forEach((c, i) => {
        const next = columns[i + 1]?.id;
        const skipOne = columns[i + 2]?.id;
        if (next) {
            map[i] = [i + 1];
            // "Aguarda Terceiros" é opcional: de "Revisadas" pode-se ir direto
            // para "Parcerias" (pulando a coluna de terceiros quando presente).
            if (skipOne && c.id === 'Revisadas') map[i].push(i + 2);
        } else {
            map[i] = [];
        }
    });
    return map;
}

// Id do aditivo EM ANDAMENTO da parceria (ou null). Fonte única de verdade
// para decidir "esta parceria está tramitando um aditivo?".
function getActiveAditivoId(parceria) {
    const id = parceria?.current_additive_id;
    return ((parceria?.aditivo_count || 0) > 0 && id) ? id : null;
}

const PARCERIA_SORT_OPTIONS = [
    { key: 'pgea', label: 'PGEA' },
    { key: 'partnership_type', label: 'Tipo' },
    { key: 'partnership_number', label: 'Número' },
    { key: 'responsible_user_name', label: 'Responsável' },
    { key: 'signature_date', label: 'Data de Assinatura' },
    { key: 'end_date', label: 'Termo Final' },
    { key: 'urgency_request', label: 'Urgência' },
    { key: 'aditivo_count', label: 'Nº de Aditivos' },
];

const DEFAULT_THIRD_PARTIES = ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

const buildDefaultParceriaFilters = () => ({
    urgency: 'all',
    type: 'all',
    responsible: 'all',
    hasAdditive: 'all',
    categoria: 'all',
});

const buildDefaultParceriaSortRules = () => ([
    { key: 'urgency_request', direction: 'desc' },
    { key: 'signature_date', direction: 'asc' },
]);

const isUrgencyMarked = (value) =>
    value === true || String(value ?? '').toLowerCase().trim() === 'sim';

const sanitizeSortRules = (rules) => {
    if (!Array.isArray(rules)) return [];
    const validKeys = new Set(PARCERIA_SORT_OPTIONS.map((o) => o.key));
    return rules
        .map((r) => ({
            key: r?.key,
            direction: r?.direction === 'desc' ? 'desc' : 'asc',
        }))
        .filter((r) => validKeys.has(r.key))
        .slice(0, 3);
};

const safeParseDate = (rawValue) => {
    if (!rawValue) return null;
    if (rawValue instanceof Date) return isValid(rawValue) ? rawValue : null;
    if (typeof rawValue === 'object' && rawValue.seconds !== undefined) {
        const d = new Date(rawValue.seconds * 1000);
        return isValid(d) ? d : null;
    }
    const parsed = parseLocalDate(rawValue);
    return isValid(parsed) ? parsed : null;
};

export default function ParceriaKanbanBoard({
    organization,
    members,
    parcerias,
    userRole,
    userId,
    parceriasLoading,
}) {
    const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
    const canDeleteRecords = useOrgPermission('delete_records');
    const isCommentsOn = useFlag(FEATURE_FLAGS.PROCESS_COMMENTS.key);
    const isPresenceOn = useFlag(FEATURE_FLAGS.LIVE_PRESENCE.key);
    const isStageIndicatorOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);
    const showCollabSection = isCommentsOn || isPresenceOn;

    const thirdParties = organization?.thirdPartiesSettingsParcerias?.length
        ? organization.thirdPartiesSettingsParcerias
        : DEFAULT_THIRD_PARTIES;

    // Categorias do órgão (configuração administrativa).
    const availableCategorias = useMemo(() => {
        return organization?.parceriaSettings?.categorias || [];
    }, [organization]);

    // Colunas e transições respeitam thirdPartyPhaseEnabled do órgão.
    const columns_list = useMemo(() => resolveColumns(organization), [organization]);
    const validForward = useMemo(() => buildValidForward(columns_list), [columns_list]);

    const [activeId, setActiveId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('assign');
    const [pendingParceria, setPendingParceria] = useState(null);
    const [pendingTarget, setPendingTarget] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailParceria, setDetailParceria] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editParceria, setEditParceria] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [aditivoDialogOpen, setAditivoDialogOpen] = useState(false);
    const [concludeOpen, setConcludeOpen] = useState(false);
    const [concludeTarget, setConcludeTarget] = useState(null);
    const [aditivoTarget, setAditivoTarget] = useState(null);
    const [extinguishOpen, setExtinguishOpen] = useState(false);
    const [extinguishTarget, setExtinguishTarget] = useState(null);
    const [logOpen, setLogOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [viewFilters, setViewFilters] = useState(buildDefaultParceriaFilters);
    const [sortRules, setSortRules] = useState(buildDefaultParceriaSortRules);
    const [isPrefsInitialized, setIsPrefsInitialized] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Aditivos da Parceria selecionada no DetailSheet (reativo).
    const { aditivos = [] } = useAditivos(detailParceria?.id, !!detailParceria);

    // Permissão: admin/owner/creator OU config `delete_records` podem excluir.
    const canDelete = userRole === 'admin' || userRole === 'owner' || userRole === 'creator' || canDeleteRecords;

    const currentYear = new Date().getFullYear();

    const availableTypes = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const t = getParceriaField(p, 'partnership_type');
            if (t) set.add(t);
        });
        return Array.from(set).sort();
    }, [parcerias]);

    const availableResponsibles = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const n = getParceriaField(p, 'responsible_user_name');
            if (n && typeof n === 'string' && n.trim()) set.add(n.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [parcerias]);

    // Resiliência: parcerias SEM data válida ainda aparecem (não filtrar).
    // (Igual ao padrão de ExpedienteKanbanBoard, mas se a Parceria não tem
    // assinatura/PGEA/criação, ela cai no "currentYear" para garantir que o
    // card apareça em algum lugar — o usuário pode trocar de ano e elas
    // continuam lá se o ano for coerente.)
    const years = useMemo(() => {
        const set = new Set([currentYear]);
        parcerias.forEach((p) => {
            const d = safeParseDate(getParceriaField(p, 'signature_date'))
                || safeParseDate(getParceriaField(p, 'created_at'));
            if (d) set.add(d.getFullYear());
        });
        return Array.from(set).sort((a, b) => b - a);
    }, [parcerias, currentYear]);

    // Lista de pessoas que podem ser "responsáveis" por uma Parceria.
    // Mesma heurística que ExpedienteKanbanBoard: o filtro por função
    // "assessor"/"assessoria" ajuda quando o órgão tem vários tipos de
    // membros, mas se a lista resultante vier vazia (caso comum: o admin
    // do órgão ainda não atualizou as funções, ou os membros têm a função
    // definida no "meu perfil" mas o member.function está desatualizado),
    // caímos no fallback: TODOS os membros ativos do órgão podem ser
    // escolhidos — o Kanban não tem como saber melhor do que o usuário
    // quem pode receber uma Parceria nova.
    const assessors = useMemo(() => {
        const fnFiltered = members.filter((m) => {
            const fn = safeLower(m.function);
            return fn.includes('assessor') || fn.includes('assessoria');
        });
        if (fnFiltered.length > 0) return fnFiltered;
        return members.filter((m) => m.active !== false);
    }, [members]);

    // Config do Indicador de Tempo (Painel Administrativo → Indicador de
    // Tempo). Mesmo padrão de ExpedienteKanbanBoard.
    const stageTimeConfig = useMemo(
        () => resolveStageTimeConfig(organization?.stageTimeConfig),
        [organization?.stageTimeConfig]
    );
    const stageAverages = useMemo(
        () => (isStageIndicatorOn
            ? computeStageAverages(parcerias, getParceriaField, stageTimeConfig.dayType)
            : null),
        [isStageIndicatorOn, parcerias, stageTimeConfig.dayType]
    );

    // Namespacing por órgão (mesma razão de ExpedienteKanbanBoard).
    const filtersKey = `kanban_parceria_filters_${organization?.id || 'default'}`;
    const sortRulesKey = `kanban_parceria_sortRules_${organization?.id || 'default'}`;

    const appliedPrefsRef = useRef(null);
    useEffect(() => {
        if (isLoadingPrefs) return;
        const prefsSlice = {
            filters: preferences?.[filtersKey] || null,
            sortRules: preferences?.[sortRulesKey] || null,
        };
        const prefsKey = `${organization?.id}:${JSON.stringify(prefsSlice)}`;
        if (appliedPrefsRef.current === prefsKey) {
            if (!isPrefsInitialized) setIsPrefsInitialized(true);
            return;
        }
        const loadedFilters = prefsSlice.filters && typeof prefsSlice.filters === 'object'
            ? { ...buildDefaultParceriaFilters(), ...prefsSlice.filters }
            : buildDefaultParceriaFilters();
        const loadedSortRules = sanitizeSortRules(prefsSlice.sortRules);
        setViewFilters(loadedFilters);
        setSortRules(loadedSortRules.length > 0 ? loadedSortRules : buildDefaultParceriaSortRules());
        appliedPrefsRef.current = prefsKey;
        if (!isPrefsInitialized) setIsPrefsInitialized(true);
    }, [preferences, isLoadingPrefs, isPrefsInitialized, filtersKey, sortRulesKey, organization?.id]);

    const effectiveSortRules = useMemo(() => {
        const sanitized = sanitizeSortRules(sortRules);
        return sanitized.length > 0 ? sanitized : buildDefaultParceriaSortRules();
    }, [sortRules]);

    const saveTimerRef = useRef(null);
    useEffect(() => {
        if (!isPrefsInitialized) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updatePreferences({ [filtersKey]: viewFilters, [sortRulesKey]: effectiveSortRules });
        }, 500);
        return () => clearTimeout(saveTimerRef.current);
    }, [viewFilters, effectiveSortRules, isPrefsInitialized, updatePreferences, filtersKey, sortRulesKey]);

    const getComparableValue = useCallback((parceria, key) => {
        if (key === 'urgency_request') {
            return isUrgencyMarked(getParceriaField(parceria, 'urgency_request')) ? 1 : 0;
        }
        if (key === 'aditivo_count') {
            return Number(getParceriaField(parceria, 'aditivo_count')) || 0;
        }
        const rawValue = getParceriaField(parceria, key);
        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return null;
        if (['signature_date', 'end_date', 'renewal_notice_date'].includes(key)) {
            const d = safeParseDate(rawValue);
            return d ? d.getTime() : null;
        }
        return String(rawValue);
    }, []);

    const compareParcerias = useCallback((a, b) => {
        for (const rule of effectiveSortRules) {
            const valueA = getComparableValue(a, rule.key);
            const valueB = getComparableValue(b, rule.key);
            if (valueA === null && valueB === null) continue;
            if (valueA === null) return 1;
            if (valueB === null) return -1;
            let comparison = 0;
            if (typeof valueA === 'number' && typeof valueB === 'number') comparison = valueA - valueB;
            else comparison = String(valueA).localeCompare(String(valueB), 'pt-BR', { numeric: true, sensitivity: 'base' });
            if (comparison !== 0) return rule.direction === 'asc' ? comparison : -comparison;
        }
        return 0;
    }, [effectiveSortRules, getComparableValue]);

    const filteredParcerias = useMemo(() => {
        return parcerias.filter((p) => {
            // (Bug #2) Parcerias EM ANDAMENTO (Pendente → Aguarda Terceiros)
            // aparecem SEMPRE no quadro, independentemente do ano — são trabalho
            // ativo e não devem "sumir" só porque o PGEA é de um ano anterior.
            // Apenas as FINALIZADAS (Parcerias/Extintos) são filtradas por ano,
            // pela data de assinatura (fallback termo final/PGEA/criação), para
            // não poluir o quadro com formalizações antigas.
            const status = calculateParceriaDerivedStatus(p);
            const isFinalized = status === 'Parcerias' || status === 'Extintos';
            if (isFinalized) {
                const d = safeParseDate(getParceriaField(p, 'signature_date'))
                    || safeParseDate(getParceriaField(p, 'end_date'))
                    || safeParseDate(getParceriaField(p, 'created_at'));
                if (d && d.getFullYear() !== selectedYear) return false;
            }

            // Filtros.
            const isUrgent = isUrgencyMarked(getParceriaField(p, 'urgency_request'));
            if (viewFilters.urgency === 'urgent' && !isUrgent) return false;
            if (viewFilters.urgency === 'normal' && isUrgent) return false;

            if (viewFilters.type !== 'all' && getParceriaField(p, 'partnership_type') !== viewFilters.type) return false;
            if (viewFilters.responsible !== 'all' && getParceriaField(p, 'responsible_user_name') !== viewFilters.responsible) return false;
            if (viewFilters.categoria !== 'all' && getParceriaField(p, 'categoria') !== viewFilters.categoria) return false;
            if (viewFilters.hasAdditive === 'yes' && !hasAdditives(p)) return false;
            if (viewFilters.hasAdditive === 'no' && hasAdditives(p)) return false;

            return true;
        });
    }, [parcerias, selectedYear, viewFilters]);

    const columns = useMemo(() => {
        const grouped = {};
        columns_list.forEach((c) => { grouped[c.id] = []; });
        filteredParcerias.forEach((p) => {
            const status = calculateParceriaDerivedStatus(p);
            if (grouped[status]) {
                grouped[status].push(p);
            } else {
                const fallback = grouped['Em revisão'] || grouped['Em análise'] || grouped['Pendente'] || [];
                fallback.push(p);
            }
        });
        // Sort dentro de cada coluna.
        Object.keys(grouped).forEach((statusKey) => {
            grouped[statusKey] = grouped[statusKey]
                .map((item, index) => ({ item, index }))
                .sort((a, b) => {
                    const c = compareParcerias(a.item, b.item);
                    return c !== 0 ? c : a.index - b.index;
                })
                .map(({ item }) => item);
        });
        return grouped;
    }, [filteredParcerias, columns_list, compareParcerias]);

    const activeParceria = useMemo(() => {
        if (!activeId) return null;
        return filteredParcerias.find((p) => p.id === activeId) || null;
    }, [activeId, filteredParcerias]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));
    const getColumnIndex = (status) => columns_list.findIndex((c) => c.id === status);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (viewFilters.urgency !== 'all') count += 1;
        if (viewFilters.type !== 'all') count += 1;
        if (viewFilters.responsible !== 'all') count += 1;
        if (viewFilters.hasAdditive !== 'all') count += 1;
        if (viewFilters.categoria !== 'all') count += 1;
        return count;
    }, [viewFilters]);

    const handleFilterChange = useCallback((key, value) => {
        setViewFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => setViewFilters(buildDefaultParceriaFilters()), []);
    const resetSortRules = useCallback(() => setSortRules(buildDefaultParceriaSortRules()), []);
    const resetViewConfig = useCallback(() => {
        setViewFilters(buildDefaultParceriaFilters());
        setSortRules(buildDefaultParceriaSortRules());
    }, []);

    const addSortRule = useCallback(() => {
        setSortRules((prev) => {
            const current = sanitizeSortRules(prev);
            if (current.length >= 3) return current;
            const usedKeys = new Set(current.map((r) => r.key));
            const nextKey = PARCERIA_SORT_OPTIONS.find((o) => !usedKeys.has(o.key))?.key || 'pgea';
            return [...current, { key: nextKey, direction: 'asc' }];
        });
    }, []);
    const updateSortRuleKey = useCallback((index, nextKey) => {
        setSortRules((prev) => {
            const current = sanitizeSortRules(prev);
            if (!current[index]) return current;
            const next = [...current];
            next[index] = { ...next[index], key: nextKey };
            return next;
        });
    }, []);
    const updateSortRuleDirection = useCallback((index, nextDirection) => {
        setSortRules((prev) => {
            const current = sanitizeSortRules(prev);
            if (!current[index]) return current;
            const next = [...current];
            next[index] = { ...next[index], direction: nextDirection === 'desc' ? 'desc' : 'asc' };
            return next;
        });
    }, []);
    const removeSortRule = useCallback((index) => {
        setSortRules((prev) => {
            const current = sanitizeSortRules(prev);
            if (current.length <= 1) return current;
            return current.filter((_, idx) => idx !== index);
        });
    }, []);

    // === Detalhes / Edição / Log / Aditivo / Extinção / Exclusão ===
    const handleViewDetails = useCallback((p) => {
        setDetailParceria(p);
        setDetailOpen(true);
    }, []);
    const handleEditFromDetail = useCallback((p) => {
        setDetailOpen(false);
        setEditParceria(p);
        setEditOpen(true);
    }, []);

    const handleDelete = useCallback(async (p) => {
        if (!p) return;
        const confirmed = window.confirm(`Excluir a Parceria ${p.pgea || p.id}? Esta ação é irreversível.`);
        if (!confirmed) return;
        try {
            setIsDeleting(true);
            await deleteParceria({ id: p.id, organizationId: organization.id });
            toast.success('Parceria excluída com sucesso.');
            if (detailOpen && detailParceria?.id === p.id) setDetailOpen(false);
        } catch (err) {
            toast.error('Erro ao excluir: ' + (err?.message || err));
        } finally {
            setIsDeleting(false);
        }
    }, [organization, detailOpen, detailParceria]);

    // Aplica uma mudança de fase no alvo correto: se a Parceria tem um aditivo
    // corrente, é o ADITIVO que caminha pelas fases (item 2) — e o backend
    // espelha a fase do aditivo de volta na Parceria pai. Caso contrário, muda
    // a própria Parceria.
    const applyPhaseChange = useCallback(async (parceria, changes) => {
        const aditivoId = getActiveAditivoId(parceria);
        if (aditivoId) {
            return updateAditivo({
                parceriaId: parceria.id,
                aditivoId,
                organizationId: organization.id,
                changes,
            });
        }
        return updateParceria({ id: parceria.id, organizationId: organization.id, changes });
    }, [organization]);

    // Campos "marcadores" de cada fase — usados no rollback (limpar tudo das
    // fases posteriores ao voltar). NÃO inclui `object` (conteúdo, não fase).
    const PHASE_MARKER_FIELDS = {
        'Em análise': { responsible_user_id: null, responsible_user_name: null, responsibility_date: null, distribution_date: null },
        'Em revisão': { review_start_date: null, network_folder: '', observations: '' },
        'Revisadas': { reviewed_date: null, review_conclusion_date: null },
        'Aguarda Terceiros': { third_party_referral_date: null, third_party: null },
        'Parcerias': {
            third_party_return_date: null, partnership_type: null, partnership_number: null,
            signature_date: null, publication_date: null, demp: null, validity_period: null,
            end_date: null, renewal_notice_date: null,
        },
    };
    const PHASE_SEQUENCE = ['Pendente', 'Em análise', 'Em revisão', 'Revisadas', 'Aguarda Terceiros', 'Parcerias', 'Extintos'];

    // === Backward Move (rollback de campos das fases posteriores) ===
    const handleBackwardMove = useCallback(async (parceria, fromStatus, toStatus) => {
        const pgea = getParceriaField(parceria, 'pgea');
        const colLabel = columns_list.find((c) => c.id === toStatus)?.label || toStatus;
        const targetIdx = PHASE_SEQUENCE.indexOf(toStatus);
        const rollback = {};
        // Limpa os marcadores de todas as fases APÓS a fase-alvo.
        PHASE_SEQUENCE.forEach((phase, idx) => {
            if (idx > targetIdx && PHASE_MARKER_FIELDS[phase]) {
                Object.assign(rollback, PHASE_MARKER_FIELDS[phase]);
            }
        });
        // Ao voltar de "Extintos" para qualquer fase anterior, "des-extingue".
        if (fromStatus === 'Extintos') {
            rollback.extinguished = false;
            rollback.archived_date = null;
        }
        const changes = { status: toStatus, ...rollback };
        try {
            await applyPhaseChange(parceria, changes);
            toast.success(`Parceria ${pgea} retornou para "${colLabel}".`);
        } catch (err) {
            toast.error('Erro ao mover Parceria: ' + err.message);
        }
    }, [organization, columns_list, applyPhaseChange]);

    // Transição direta (sem diálogo): usada quando a fase só registra uma data
    // automática, sem campos manuais (ex.: "Revisadas" só registra a data de
    // conclusão da revisão — item 3.4).
    const handleDirectTransition = useCallback(async (parceria, toStatus) => {
        const pgea = getParceriaField(parceria, 'pgea');
        try {
            await applyPhaseChange(parceria, { status: toStatus });
            toast.success(`Parceria ${pgea} → "${toStatus}".`);
        } catch (err) {
            toast.error('Erro ao mover Parceria: ' + (err?.message || err));
        }
    }, [applyPhaseChange]);

    // === Forward Transition (abre diálogo intermediário quando há campos) ===
    const handleForwardTransition = useCallback((parceria, fromStatus, toStatus) => {
        const openDialog = (mode) => {
            setPendingParceria(parceria);
            setPendingTarget(toStatus);
            setDialogMode(mode);
            setDialogOpen(true);
        };
        if (fromStatus === 'Pendente' && toStatus === 'Em análise') return openDialog('assign');
        if (fromStatus === 'Em análise' && toStatus === 'Em revisão') return openDialog('review');
        if (fromStatus === 'Em revisão' && toStatus === 'Revisadas') {
            // Item 3.4: só registra a data de conclusão (backend auto) — sem diálogo.
            handleDirectTransition(parceria, 'Revisadas');
            return;
        }
        if (fromStatus === 'Revisadas' && toStatus === 'Aguarda Terceiros') return openDialog('third_party');
        if (toStatus === 'Parcerias' && (fromStatus === 'Aguarda Terceiros' || fromStatus === 'Revisadas')) {
            // Se a parceria está tramitando um ADITIVO, o passo final não é
            // "formalizar" (a original já é formalizada): é CONCLUIR o aditivo,
            // que aplica prazo/objeto na original e a devolve para "Parcerias".
            if (getActiveAditivoId(parceria)) {
                setConcludeTarget(parceria);
                setConcludeOpen(true);
                return;
            }
            return openDialog('formalize');
        }
        if (fromStatus === 'Parcerias' && toStatus === 'Extintos') {
            setExtinguishTarget(parceria);
            setExtinguishOpen(true);
            return;
        }
    }, [handleDirectTransition]);

    // Conclusão do aditivo: chama concludeAditivo (aplica na original).
    const handleConcludeAditivo = async (data) => {
        const parceria = concludeTarget;
        if (!parceria) return;
        const aditivoId = getActiveAditivoId(parceria);
        const pgea = getParceriaField(parceria, 'pgea');
        try {
            await concludeAditivo({
                parceriaId: parceria.id,
                aditivoId,
                organizationId: organization.id,
                aditivoSignatureDate: data.aditivoSignatureDate,
                demp: data.demp,
                prazoValor: data.prazoValor,
                prazoUnidade: data.prazoUnidade,
                objetoAditivo: data.objetoAditivo,
            });
            toast.success(`Aditivo concluído! Parceria ${pgea} atualizada e ativa.`);
            setConcludeOpen(false);
            setConcludeTarget(null);
        } catch (err) {
            toast.error('Erro ao concluir aditivo: ' + (err?.message || err));
            throw err;
        }
    };

    const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);
    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;
        const parceria = filteredParcerias.find((p) => p.id === active.id);
        if (!parceria) return;
        const currentStatus = calculateParceriaDerivedStatus(parceria);
        const targetColumnId = over.data?.current?.columnId || over.id;
        if (currentStatus === targetColumnId) return;
        const currentIdx = getColumnIndex(currentStatus);
        const targetIdx = getColumnIndex(targetColumnId);
        if (currentIdx < 0 || targetIdx < 0) {
            toast.error('Não foi possível identificar a coluna.', { duration: 3000 });
            return;
        }
        const isForward = validForward[currentIdx]?.includes(targetIdx);
        const isBackward = targetIdx < currentIdx;
        if (!isForward && !isBackward) {
            toast.error('Para avançar, mova para a próxima fase do fluxo.', { duration: 3000 });
            return;
        }
        if (isBackward) handleBackwardMove(parceria, currentStatus, targetColumnId);
        else handleForwardTransition(parceria, currentStatus, targetColumnId);
    }, [filteredParcerias, handleBackwardMove, handleForwardTransition, columns_list, validForward]);
    const handleDragCancel = useCallback(() => setActiveId(null), []);

    const handleDialogConfirm = async (data) => {
        if (!pendingParceria || !pendingTarget) return;
        const pgea = getParceriaField(pendingParceria, 'pgea');
        const today = new Date().toISOString().split('T')[0];
        // Datas automáticas (review_start_date, reviewed_date,
        // third_party_referral_date, third_party_return_date) são registradas
        // pelo BACKEND ao entrar na fase — o frontend só envia os campos manuais.
        let changes = {};
        if (dialogMode === 'assign') {
            // (3.2) Em análise: assessor obrigatório → registra distribuição.
            changes = {
                responsible_user_id: data.responsible_user_id,
                responsible_user_name: data.responsible_user_name,
                responsibility_date: data.responsibility_date || today,
                distribution_date: data.distribution_date || today,
                status: 'Em análise',
            };
        } else if (dialogMode === 'review') {
            // (3.3) Em revisão: pasta na rede + observações (início auto no backend).
            changes = {
                network_folder: data.network_folder || '',
                observations: data.observations || '',
                status: 'Em revisão',
            };
        } else if (dialogMode === 'third_party') {
            // (3.5) Aguarda Terceiros: "Remetido para" (remessa auto no backend).
            changes = {
                third_party: data.third_party,
                status: 'Aguarda Terceiros',
            };
        } else if (dialogMode === 'formalize') {
            // (3.6) Parcerias: dados de formalização (retorno de terceiros auto).
            changes = {
                partnership_type: data.partnership_type,
                partnership_number: data.partnership_number,
                signature_date: data.signature_date || today,
                demp: data.demp || '',
                validity_period: data.validity_period,
                validity_value: data.validity_value ?? null,
                validity_unit: data.validity_unit || null,
                object: data.object || '',
                end_date: data.end_date,
                renewal_notice_date: data.renewal_notice_date,
                categoria: data.categoria,
                status: 'Parcerias',
            };
        }
        try {
            await applyPhaseChange(pendingParceria, { ...changes, status: pendingTarget });
            const messages = {
                assign: `Parceria ${pgea} em análise!`,
                review: `Parceria ${pgea} em revisão!`,
                third_party: `Parceria ${pgea} remetida a terceiros!`,
                formalize: `Parceria ${pgea} formalizada!`,
            };
            toast.success(messages[dialogMode] || `Parceria ${pgea} atualizada!`);
        } catch (err) {
            toast.error('Erro ao atualizar Parceria: ' + err.message);
            throw err;
        }
        setPendingParceria(null);
        setPendingTarget(null);
    };

    if (parceriasLoading) {
        return (
            <Card className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header com filtros */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel de Parcerias</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Arraste as Parcerias entre as colunas para gerenciar as fases do fluxo.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Parceria
                    </Button>

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
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Configurar visualização</h4>
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
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtros por coluna</p>

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

                                <Select value={viewFilters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tipo: todos</SelectItem>
                                        {availableTypes.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={viewFilters.responsible} onValueChange={(value) => handleFilterChange('responsible', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Responsável" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Responsável: todos</SelectItem>
                                        {availableResponsibles.map((name) => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={viewFilters.hasAdditive} onValueChange={(value) => handleFilterChange('hasAdditive', value)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Aditivos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Aditivos: todos</SelectItem>
                                        <SelectItem value="yes">Somente com aditivos</SelectItem>
                                        <SelectItem value="no">Somente sem aditivos</SelectItem>
                                    </SelectContent>
                                </Select>

                                {availableCategorias.length > 0 && (
                                    <Select value={viewFilters.categoria} onValueChange={(value) => handleFilterChange('categoria', value)}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Categoria" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Categoria: todas</SelectItem>
                                            {availableCategorias.map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <div className="flex justify-end pt-1">
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-slate-600 dark:text-slate-300">
                                        Limpar filtros
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                                <div className="flex items-center justify-between">
                                    <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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

                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Padrão: urgentes primeiro, depois data de assinatura crescente.
                                </p>

                                {sortRules.map((rule, index) => (
                                    <div key={`${rule.key}-${index}`} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
                                        <Select value={rule.key} onValueChange={(value) => updateSortRuleKey(index, value)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PARCERIA_SORT_OPTIONS.map((option) => (
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
                                            className="h-9 w-9 text-slate-500 dark:text-slate-400"
                                            aria-label="Remover regra de ordenação"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}

                                <div className="flex justify-end pt-1">
                                    <Button variant="ghost" size="sm" onClick={resetSortRules} className="h-8 text-xs text-slate-600 dark:text-slate-300">
                                        Resetar ordem
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 pl-3 pr-8 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {years.map((y) => <option key={y} value={y}>Ano: {y}</option>)}
                    </select>
                    <Badge variant="outline" className="text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-3 py-1">
                        {filteredParcerias.length} {filteredParcerias.length === 1 ? 'parceria' : 'parcerias'}
                    </Badge>
                </div>
            </div>

            {/* Kanban Board */}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    const p = pointerWithin(args);
                    if (p.length > 0) return p;
                    return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns_list.length}, minmax(0, 1fr))` }}>
                    {columns_list.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            parcerias={columns[col.id] || []}
                            onViewDetails={handleViewDetails}
                            onEdit={canDelete ? (p) => { setEditParceria(p); setEditOpen(true); } : null}
                            onDelete={canDelete ? handleDelete : null}
                            canDelete={canDelete}
                            isDeleting={isDeleting}
                            organization={organization}
                        />
                    ))}
                </div>
                <DragOverlay dropAnimation={null}>
                    {activeParceria ? <ParceriaKanbanCard parceria={activeParceria} overlay organization={organization} /> : null}
                </DragOverlay>
            </DndContext>

            {/* Dialog de transição de fase */}
            {pendingParceria && (
                <ParceriaKanbanTransitionDialog
                    open={dialogOpen}
                    onClose={() => { setDialogOpen(false); setPendingParceria(null); setPendingTarget(null); }}
                    mode={dialogMode}
                    parceria={pendingParceria}
                    assessors={assessors}
                    thirdParties={thirdParties}
                    onConfirm={handleDialogConfirm}
                />
            )}

            {/* Detail Sheet */}
            <ParceriaDetailSheet
                parceria={detailParceria}
                open={detailOpen}
                onClose={() => { setDetailOpen(false); setDetailParceria(null); }}
                onEdit={canDelete ? handleEditFromDetail : null}
                onIncludeAditivo={(p) => { setDetailOpen(false); setAditivoTarget(p); setAditivoDialogOpen(true); }}
                onExtinguish={(p) => { setDetailOpen(false); setExtinguishTarget(p); setExtinguishOpen(true); }}
                onDelete={canDelete ? (p) => { setDetailOpen(false); handleDelete(p); } : null}
                onViewLog={() => setLogOpen(true)}
                aditivos={aditivos}
                currentAdditiveId={detailParceria?.current_additive_id}
                userRole={userRole}
                organizationId={organization.id}
                members={members}
            />

            {/* Edit Dialog */}
            {editParceria && (
                <EditParceriaDialog
                    open={editOpen}
                    setOpen={(open) => { setEditOpen(open); if (!open) setEditParceria(null); }}
                    parceria={editParceria}
                    members={members}
                    organizationId={organization.id}
                    organization={organization}
                    userRole={userRole}
                    onSuccess={() => { setEditOpen(false); setEditParceria(null); }}
                />
            )}

            {/* Aditivo */}
            {aditivoTarget && (
                <CreateAditivoDialog
                    open={aditivoDialogOpen}
                    onClose={() => { setAditivoDialogOpen(false); setAditivoTarget(null); }}
                    parceria={aditivoTarget}
                    organizationId={organization.id}
                    organization={organization}
                    onSuccess={() => { setAditivoDialogOpen(false); setAditivoTarget(null); }}
                />
            )}

            {/* Conclusão de aditivo (passo final) */}
            {concludeTarget && (
                <ConcludeAditivoDialog
                    open={concludeOpen}
                    onClose={() => { setConcludeOpen(false); setConcludeTarget(null); }}
                    aditivoNumber={Number(getParceriaField(concludeTarget, 'aditivo_count')) || concludeTarget.aditivo_count || 1}
                    isProrrogacao={concludeTarget.current_additive_prorrogacao}
                    isObjeto={concludeTarget.current_additive_objeto}
                    onConfirm={handleConcludeAditivo}
                />
            )}

            {/* Extinção */}
            {extinguishTarget && (
                <ExtinguishConfirmDialog
                    open={extinguishOpen}
                    onClose={() => { setExtinguishOpen(false); setExtinguishTarget(null); }}
                    parceria={extinguishTarget}
                    organizationId={organization.id}
                    onSuccess={() => { setExtinguishOpen(false); setExtinguishTarget(null); }}
                />
            )}

            {/* Log (criador) */}
            {detailParceria && userRole === 'creator' && (
                <ProcessLogDialog
                    open={logOpen}
                    onClose={() => setLogOpen(false)}
                    process={detailParceria}
                    collectionName="parcerias"
                />
            )}

            {/* Create Dialog */}
            <CreateParceriaDialog
                open={createOpen}
                setOpen={setCreateOpen}
                organization={organization}
                members={members}
                onSuccess={() => setCreateOpen(false)}
            />
        </div>
    );
}

function KanbanColumn({ column, parcerias, onViewDetails, onEdit, onDelete, canDelete, isDeleting, organization }) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id } });
    const ColIcon = column.icon;
    return (
        <div
            ref={setNodeRef}
            className={`
                rounded-xl border flex flex-col
                ${column.headerBorder}
                ${isOver ? 'ring-2 ring-indigo-300 dark:ring-indigo-400 bg-indigo-50/30 dark:bg-indigo-500/10' : ''}
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
                <Badge variant="secondary" className="bg-white/60 dark:bg-black/25 text-slate-600 dark:text-white border-0">
                    {parcerias.length}
                </Badge>
            </div>
            <div className={`flex-1 p-3 space-y-2 ${column.columnBg} rounded-b-xl overflow-y-auto`}
                style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
                <SortableContext items={parcerias.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {parcerias.length > 0 ? (
                        parcerias.map((p) => (
                            <ParceriaKanbanCard
                                key={p.id}
                                parceria={p}
                                columnId={column.id}
                                onViewDetails={onViewDetails}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                canDelete={canDelete}
                                isDeleting={isDeleting}
                                organization={organization}
                            />
                        ))
                    ) : (
                        <EmptyState
                            icon={ColIcon}
                            title={column.emptyText}
                            description="Não há parcerias nesta etapa do fluxo no momento."
                            className="py-12 border-none shadow-none bg-transparent"
                        />
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
