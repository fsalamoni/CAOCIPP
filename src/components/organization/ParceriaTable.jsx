import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import StageTimeBadge from "@/components/ui/StageTimeBadge";
import { useUserPreferences } from '@/hooks/useFirestore';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import { getDaysInCurrentStage, getStageTimeSeverity, resolveStageTimeConfig } from '@/lib/stageTime';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/dateUtils';
import { Search, MoreHorizontal, Pencil, ArrowUpDown, Filter, FilterX, X, Download, Rows3, Rows4, Bookmark, Columns3, GitBranch, Lock, Settings2, Handshake } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { SearchX, ClipboardList } from 'lucide-react';
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
    getParceriaField,
    calculateParceriaDerivedStatus,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { extinguishParceria, logAccess } from '@/services/functionsService';

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

const isUrgencyMarked = (v) => v === true || String(v ?? '').toLowerCase().trim() === 'sim';
const isUrgencyRestricted = (v) => v === true || String(v ?? '').toLowerCase().trim() === 'sim';

// Tipos de coluna default — com `render` (espelho do padrão de ExpedienteTable).
const DEFAULT_COLUMNS = [
    {
        key: 'pgea', label: 'PGEA', defaultVisible: true, sticky: 'left', sortable: true,
        render: (p) => {
            const isUrgent = isUrgencyMarked(getParceriaField(p, 'urgency_request'));
            const isRestricted = isUrgencyRestricted(getParceriaField(p, 'access_restriction'));
            return (
                <div className="flex items-center gap-2">
                    {isUrgent && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right">Prioridade Urgente</TooltipContent>
                        </Tooltip>
                    )}
                    {isRestricted && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right">Acesso restrito</TooltipContent>
                        </Tooltip>
                    )}
                    <span className="font-semibold text-slate-800 dark:text-slate-100 font-mono text-[13px]">
                        {getParceriaField(p, 'pgea') || '—'}
                    </span>
                </div>
            );
        },
    },
    {
        key: 'partnership_type', label: 'Tipo', defaultVisible: true, sortable: true,
        render: (p) => <Badge variant="outline" className="text-[12px] font-medium">{getParceriaField(p, 'partnership_type') || '—'}</Badge>,
    },
    {
        key: 'partnership_number', label: 'Número', defaultVisible: true, sortable: true,
        render: (p) => <span className="font-mono text-[13px]">{getParceriaField(p, 'partnership_number') || '—'}</span>,
    },
    {
        key: 'subject', label: 'Assunto', defaultVisible: true, sortable: true,
        render: (p) => (
            <span className="text-slate-700 dark:text-slate-200 truncate block max-w-[260px]" title={String(getParceriaField(p, 'subject') || '')}>
                {getParceriaField(p, 'subject') || '—'}
            </span>
        ),
    },
    {
        key: 'parties', label: 'Partes', defaultVisible: true, sortable: true,
        render: (p) => (
            <span className="text-slate-700 dark:text-slate-200 truncate block max-w-[220px]" title={String(getParceriaField(p, 'parties') || '')}>
                {getParceriaField(p, 'parties') || '—'}
            </span>
        ),
    },
    {
        key: 'categoria', label: 'Categoria', defaultVisible: true, sortable: true,
        render: (p) => <span className="text-[13px] text-slate-600">{getParceriaField(p, 'categoria') || '—'}</span>,
    },
    {
        key: 'responsible_user_name', label: 'Responsável', defaultVisible: true, sortable: true,
        render: (p) => <span className="text-[13px]">{getParceriaField(p, 'responsible_user_name') || '—'}</span>,
    },
    {
        key: 'signature_date', label: 'Assinatura', defaultVisible: true, sortable: true,
        render: (p) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getParceriaField(p, 'signature_date'))}</span>,
    },
    {
        key: 'end_date', label: 'Termo Final', defaultVisible: true, sortable: true,
        render: (p) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getParceriaField(p, 'end_date'))}</span>,
    },
    {
        key: 'renewal_notice_date', label: 'Aviso Renovação', defaultVisible: false, sortable: true,
        render: (p) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getParceriaField(p, 'renewal_notice_date'))}</span>,
    },
    {
        key: 'aditivo_count', label: 'Aditivos', defaultVisible: true, sortable: true,
        render: (p) => {
            const v = Number(getParceriaField(p, 'aditivo_count')) || 0;
            return v > 0 ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 gap-0.5">
                    <GitBranch className="w-3 h-3" />
                    {v}
                </Badge>
            ) : <span className="text-slate-400">—</span>;
        },
    },
    {
        key: 'status', label: 'Situação', defaultVisible: true, sortable: true,
        render: (p) => <StatusBadge status={calculateParceriaDerivedStatus(p)} />,
    },
    // IMPORTANTE: a coluna 'stage_time' foi MOVIDA para dentro do componente
    // (ver STAGE_TIME_COLUMN_FOR abaixo). Motivo: o `render` precisa acessar
    // `stageTimeConfig` que é um useMemo local. Tê-lo dentro do array do
    // módulo causava `ReferenceError: stageTimeConfig is not defined` quando
    // a closure era executada no escopo do módulo.
];

/**
 * Helper: retorna a definição da coluna 'stage_time' já com o render
 * vinculado ao `stageTimeConfig` recebido. Usado dentro do componente
 * ParceriaTable (onde `stageTimeConfig` está no escopo via useMemo).
 */
function getStageTimeColumn(stageTimeConfig) {
    return {
        key: 'stage_time',
        label: 'Tempo na etapa',
        defaultVisible: true,
        sortable: false,
        render: (p) => {
            const status = calculateParceriaDerivedStatus(p);
            const days = getDaysInCurrentStage(p, status, getParceriaField, stageTimeConfig.dayType);
            if (days == null) return <span className="text-slate-300 text-xs">—</span>;
            const severity = getStageTimeSeverity(days, stageTimeConfig);
            return <StageTimeBadge days={days} severity={severity} colors={stageTimeConfig.colors} dayType={stageTimeConfig.dayType} />;
        },
    };
}

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

    // Config do Indicador de Tempo (Painel Administrativo → Indicador de
    // Tempo). Mesmo padrão de ExpedienteTable. Lemos do org. atual; default
    // 5/10 dias úteis, verde/amarelo/vermelho quando o admin não configurou.
    const stageTimeConfig = useMemo(
        () => resolveStageTimeConfig(organization?.stageTimeConfig),
        [organization?.stageTimeConfig]
    );

    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [responsibleFilter, setResponsibleFilter] = useState('all');
    const [aditivoFilter, setAditivoFilter] = useState('all');
    const [urgencyFilter, setUrgencyFilter] = useState('all');
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

    // Colunas visíveis (preferences por usuário): toggle, persistência, etc.
    // Filtra também pela flag STAGE_TIME_INDICATOR (a coluna "Tempo na etapa"
    // só aparece quando a flag está ligada).
    const visibleColumns = preferences?.visibleParceriaColumns || {};

    // Lista completa de colunas incluindo a 'stage_time' (criada a partir
    // do stageTimeConfig local). Usada tanto para activeColumns quanto
    // para o toggle de visibilidade.
    const allColumns = useMemo(() => {
        const cols = [...DEFAULT_COLUMNS];
        if (isStageIndicatorOn) cols.push(getStageTimeColumn(stageTimeConfig));
        return cols;
    }, [stageTimeConfig, isStageIndicatorOn]);

    // Visibilidade efetiva de uma coluna: quando o usuário nunca configurou,
    // respeita o `defaultVisible` da definição (espelho de ExpedienteTable, que
    // inicializa o mapa a partir de defaultVisible).
    const isColumnVisible = useCallback((col) => {
        const pref = visibleColumns[col.key];
        if (pref === undefined) return col.defaultVisible !== false;
        return pref !== false;
    }, [visibleColumns]);

    const activeColumns = useMemo(
        () => allColumns.filter(isColumnVisible),
        [allColumns, isColumnVisible]
    );
    const toggleColumn = useCallback((key) => {
        const current = preferences?.visibleParceriaColumns || {};
        const col = allColumns.find((c) => c.key === key);
        const currentlyVisible = current[key] === undefined
            ? (col?.defaultVisible !== false)
            : current[key] !== false;
        const next = { ...current, [key]: !currentlyVisible };
        updatePreferences({ visibleParceriaColumns: next });
    }, [preferences, updatePreferences, allColumns]);
    const resetColumns = useCallback(() => {
        updatePreferences({ visibleParceriaColumns: {} });
    }, [updatePreferences]);

    // Largura mínima da tabela (espelho de ExpedienteTable): garante scroll
    // horizontal em telas estreitas em vez de espremer as colunas.
    const tableMinWidth = useMemo(() => {
        const base = isBulkActionsOn ? 40 : 0;
        return base + (activeColumns.length * 150) + 80;
    }, [activeColumns.length, isBulkActionsOn]);

    // Cor da linha por status (espelho de ExpedienteTable → getStatusRowColor).
    // Usa a mesma fonte de verdade de cores (config/processStatus) já estendida
    // com os status de Parcerias. Em V2 usa o acento lateral minimalista.
    const getStatusRowColor = useCallback((p) => {
        const status = calculateParceriaDerivedStatus(p);
        const isUrgent = isUrgencyMarked(getParceriaField(p, 'urgency_request'));
        if (isUrgent && (status === 'Pendente' || !status)) {
            return isV2
                ? { bg: 'bg-white dark:bg-slate-900', accent: 'border-l-red-500', border: 'border-b-border', hover: 'hover:bg-muted/60', groupHover: 'group-hover:!bg-muted/60' }
                : { bg: 'bg-[#FF7979]', accent: 'border-l-[#CC0000]', border: 'border-b-[#E06666]', hover: 'hover:bg-[#FF6060]', groupHover: 'group-hover:!bg-[#FF6060]' };
        }
        const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
        if (isV2) return config.rowV2 || DEFAULT_STATUS_CONFIG.rowV2;
        return config.row || DEFAULT_STATUS_CONFIG.row;
    }, [isV2]);

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
        if (urgencyFilter !== 'all') {
            const wantUrgent = urgencyFilter === 'sim' || urgencyFilter === 'urgent';
            out = out.filter((p) => isUrgencyMarked(getParceriaField(p, 'urgency_request')) === wantUrgent);
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
    }, [parcerias, search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, urgencyFilter, dateFilters, sortRules]);

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

    useEffect(() => { setCurrentPage(1); }, [search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, urgencyFilter, dateFilters]);
    useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

    // Ações.
    const clearFilters = () => {
        setSearch('');
        setTypeFilter('all');
        setStatusFilter('all');
        setResponsibleFilter('all');
        setAditivoFilter('all');
        setUrgencyFilter('all');
        setDateFilters({ signature: { start: '', end: '' }, end: { start: '', end: '' } });
    };

    // Deep-link vindo do Dashboard / sidebar (?filter=urgent|mine), espelho de
    // ExpedienteTable: aplica o filtro inicial uma única vez.
    useEffect(() => {
        if (initialFilter === 'urgent') {
            setUrgencyFilter('sim');
        } else if (initialFilter === 'mine') {
            const currentUserMember = members.find((m) => m.user_id === userId);
            if (currentUserMember?.user_name) {
                setResponsibleFilter(currentUserMember.user_name);
            }
        }
    }, [initialFilter, userId, members]);

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

    // Export Excel / PDF (via lib tableExport, import sob demanda).
    const DATE_EXPORT_KEYS = new Set(['signature_date', 'end_date', 'renewal_notice_date', 'pgea_date', 'responsibility_date', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date']);
    const getExportValue = (col, p) => {
        if (col.key === 'status') return calculateParceriaDerivedStatus(p);
        if (col.key === 'stage_time') {
            const status = calculateParceriaDerivedStatus(p);
            const days = getDaysInCurrentStage(p, status, getParceriaField, stageTimeConfig.dayType);
            return days == null ? '' : String(days);
        }
        if (col.key === 'aditivo_count') return String(getParceriaField(p, 'aditivo_count') || 0);
        if (col.key === 'pgea') return getParceriaField(p, 'pgea') || '';
        if (DATE_EXPORT_KEYS.has(col.key)) return formatDate(getParceriaField(p, col.key));
        if (col.key === 'urgency_request') {
            return isUrgencyMarked(getParceriaField(p, 'urgency_request')) ? 'Sim' : 'Não';
        }
        if (col.key === 'access_restriction') {
            return isUrgencyRestricted(getParceriaField(p, 'access_restriction')) ? 'Sim' : 'Não';
        }
        return getParceriaField(p, col.key) ?? '';
    };
    const handleExport = async (kind) => {
        const rows = filteredAndSorted;
        if (rows.length === 0) {
            toast.info('Nenhuma Parceria para exportar.');
            return;
        }
        const columns = activeColumns.map((col) => ({ label: col.label, value: (p) => getExportValue(col, p) }));
        const filenameBase = `parcerias-${new Date().toISOString().slice(0, 10)}`;
        const { exportRowsToExcel, exportRowsToPdf } = await import('@/lib/tableExport');
        if (kind === 'excel') exportRowsToExcel({ rows, columns, filenameBase });
        else exportRowsToPdf({ rows, columns, filenameBase, title: 'Parcerias' });
        toast.success(`Exportação de ${rows.length} parceria(s) iniciada.`);
        if (isAccessAuditLogOn && organization?.id) {
            logAccess({
                organizationId: organization.id,
                entityType: 'parceria',
                action: 'export_table',
                details: { format: kind, rowCount: rows.length },
            }).catch(() => {});
        }
    };

    // Saved views.
    const applySavedView = (view) => {
        if (view.search !== undefined) setSearch(view.search);
        if (view.typeFilter) setTypeFilter(view.typeFilter);
        if (view.statusFilter) setStatusFilter(view.statusFilter);
        if (view.responsibleFilter) setResponsibleFilter(view.responsibleFilter);
        if (view.aditivoFilter) setAditivoFilter(view.aditivoFilter);
        if (view.urgencyFilter) setUrgencyFilter(view.urgencyFilter);
        if (view.dateFilters) setDateFilters(view.dateFilters);
        toast.success(`Visão "${view.name}" aplicada.`);
    };
    const saveCurrentView = () => {
        if (!newViewName.trim()) return;
        const view = {
            id: `v_${Date.now()}`,
            name: newViewName.trim(),
            search, typeFilter, statusFilter, responsibleFilter, aditivoFilter, urgencyFilter, dateFilters,
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
        || responsibleFilter !== 'all' || aditivoFilter !== 'all' || urgencyFilter !== 'all'
        || dateFilters.signature.start || dateFilters.signature.end
        || dateFilters.end.start || dateFilters.end.end;

    // Contador de filtros avançados (dentro do popover "Filtros"): espelha o
    // padrão de ExpedienteTable, onde busca/status/responsável ficam fora do
    // popover e os demais entram na contagem do badge.
    const activeFiltersCount = (
        (typeFilter !== 'all' ? 1 : 0)
        + (aditivoFilter !== 'all' ? 1 : 0)
        + (urgencyFilter !== 'all' ? 1 : 0)
        + (dateFilters.signature.start || dateFilters.signature.end ? 1 : 0)
        + (dateFilters.end.start || dateFilters.end.end ? 1 : 0)
    );

    const cellPadding = density === 'compact' ? 'py-1' : 'py-3';

    return (
        <div className="space-y-4">
            {/* ── Barra de ferramentas (espelho de ExpedienteTable) ── */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <Input
                            placeholder="Buscar por PGEA, número, assunto, partes, categoria..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40 h-10">
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
                                <SelectTrigger className="w-44 h-10">
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

                        {/* Filtros avançados (popover) */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 gap-2 text-slate-600 dark:text-slate-300">
                                    <Filter className="w-4 h-4" />
                                    Filtros
                                    {activeFiltersCount > 0 && (
                                        <Badge variant="secondary" className="bg-indigo-600 text-white hover:bg-indigo-700 px-1.5 min-w-[20px] h-5 rounded-full text-[10px]">
                                            {activeFiltersCount}
                                        </Badge>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[400px] p-4 shadow-xl border-slate-200 dark:border-slate-700">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            <Settings2 className="w-4 h-4" />
                                            Filtros Avançados
                                        </h4>
                                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tight">
                                            Limpar Tudo
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</label>
                                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Qualquer</SelectItem>
                                                    {availableTypes.map((t) => (
                                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aditivos</label>
                                            <Select value={aditivoFilter} onValueChange={setAditivoFilter}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Qualquer</SelectItem>
                                                    <SelectItem value="yes">Com aditivos</SelectItem>
                                                    <SelectItem value="no">Sem aditivos</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Urgência</label>
                                            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Qualquer</SelectItem>
                                                    <SelectItem value="sim">Urgente</SelectItem>
                                                    <SelectItem value="nao">Normal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">Filtros de Datas</label>
                                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                                            {[
                                                { label: 'Data de Assinatura', key: 'signature' },
                                                { label: 'Termo Final', key: 'end' },
                                            ].map(({ label, key }) => (
                                                <div key={key} className="p-2 border rounded-md bg-slate-50/50 dark:bg-slate-800/50 space-y-1.5">
                                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">{label}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Input type="date" value={dateFilters[key].start} onChange={(e) => setDateFilters((prev) => ({ ...prev, [key]: { ...prev[key], start: e.target.value } }))} className="h-8 text-xs px-2" />
                                                        <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 rotate-90" />
                                                        <Input type="date" value={dateFilters[key].end} onChange={(e) => setDateFilters((prev) => ({ ...prev, [key]: { ...prev[key], end: e.target.value } }))} className="h-8 text-xs px-2" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

                        {/* Colunas */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 border-none shadow-none">
                                    <Columns3 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Colunas</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">{activeColumns.length}</Badge>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4 shadow-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-1 dark:ring-white/10 dark:shadow-2xl mt-2">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Colunas Visíveis</h4>
                                        <Button variant="ghost" size="sm" onClick={resetColumns} className="h-7 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Restaurar</Button>
                                    </div>
                                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                        {allColumns.map((col) => (
                                            <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                                                <Checkbox checked={isColumnVisible(col)} onCheckedChange={() => toggleColumn(col.key)} className="h-4 w-4" />
                                                <span className="text-sm text-slate-600 dark:text-slate-300">{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {hasFilters && (
                            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-rose-500 hover:text-rose-600 hover:bg-rose-50" title="Limpar todos os filtros">
                                <FilterX className="w-4 h-4" />
                            </Button>
                        )}

                        {isSavedViewsOn && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-10 gap-2 text-slate-600 dark:text-slate-300">
                                        <Bookmark className="w-4 h-4" />
                                        <span className="hidden sm:inline">Visões</span>
                                        {savedViews.length > 0 && (
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">{savedViews.length}</Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-72 p-3">
                                    <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                                        {savedViews.length === 0 ? (
                                            <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-2">Nenhuma visão salva ainda. Configure os filtros e salve abaixo.</p>
                                        ) : (
                                            savedViews.map((view) => (
                                                <div key={view.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <button type="button" className="text-sm text-slate-700 dark:text-slate-200 flex-1 text-left truncate" onClick={() => applySavedView(view)}>
                                                        {view.name}
                                                    </button>
                                                    <button type="button" className="text-slate-300 dark:text-slate-600 hover:text-rose-500 shrink-0" onClick={() => removeSavedView(view.id)} title="Excluir visão">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                                        <Input
                                            placeholder="Nome da visão atual..."
                                            value={newViewName}
                                            onChange={(e) => setNewViewName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentView(); }}
                                            className="h-8 text-xs"
                                        />
                                        <Button size="sm" className="h-8 shrink-0" onClick={saveCurrentView} disabled={!newViewName.trim()}>Salvar</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        {isExportOn && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-10 gap-2 text-slate-600 dark:text-slate-300">
                                        <Download className="w-4 h-4" />
                                        <span className="hidden sm:inline">Exportar</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleExport('excel')}>Exportar Excel (.xlsx)</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport('pdf')}>Exportar PDF</DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportCSV}>Exportar CSV</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {isDensityOn && (
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-10">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => setDensity('comfortable')}
                                            className={`h-full px-2.5 flex items-center transition-colors ${density === 'comfortable' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
                                        >
                                            <Rows3 className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Densidade confortável</TooltipContent>
                                </Tooltip>
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => setDensity('compact')}
                                            className={`h-full px-2.5 flex items-center transition-colors ${density === 'compact' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
                                        >
                                            <Rows4 className="w-4 h-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Densidade compacta</TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Ações em massa (flag bulk_actions) */}
            {isBulkActionsOn && selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-600 rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-100">{selectedIds.size} selecionada(s)</span>
                    <div className="flex items-center gap-2">
                        {isExportOn && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleExport('excel')}>
                                <Download className="w-3.5 h-3.5" /> Exportar selecionadas
                            </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50" onClick={handleBulkExtinguish}>
                            <ClipboardList className="w-3.5 h-3.5" /> Extinguir selecionadas
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-slate-500 dark:text-slate-400" onClick={clearSelection}>Limpar seleção</Button>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <Table style={{ minWidth: `${tableMinWidth}px` }}>
                        <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800 shadow-sm">
                                {isBulkActionsOn && (
                                    <TableHead className="w-[40px] bg-slate-50 dark:bg-slate-800 sticky top-0 z-30">
                                        <Checkbox
                                            checked={paginated.length > 0 && selectedIds.size === paginated.length}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Selecionar todas nesta página"
                                        />
                                    </TableHead>
                                )}
                                {activeColumns.map((c) => {
                                    const isStickyLeft = c.sticky === 'left';
                                    return (
                                        <TableHead
                                            key={c.key}
                                            className={`font-semibold ${c.width || ''} bg-slate-50 dark:bg-slate-800 sticky top-0 z-30 ${isStickyLeft ? 'left-0 z-40 border-r' : ''}`}
                                        >
                                            {c.sortable !== false ? (
                                                <Button variant="ghost" size="sm" onClick={() => handleSort(c.key)} className="-ml-2 h-8 font-semibold">
                                                    {c.label} <ArrowUpDown className={`w-3 h-3 ml-1 ${sortRules.some((r) => r.key === c.key) ? 'text-indigo-600' : 'opacity-50'}`} />
                                                </Button>
                                            ) : c.label}
                                        </TableHead>
                                    );
                                })}
                                <TableHead className="font-semibold text-center sticky top-0 right-0 z-40 bg-slate-50 dark:bg-slate-800 border-l w-[80px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        {isBulkActionsOn && (
                                            <TableCell><div className="h-4 w-4 bg-slate-100/60 dark:bg-slate-700/60 rounded animate-pulse"></div></TableCell>
                                        )}
                                        {activeColumns.map((col) => (
                                            <TableCell key={col.key}>
                                                <div className="h-4 bg-slate-100/60 dark:bg-slate-700/60 rounded animate-pulse w-full"></div>
                                            </TableCell>
                                        ))}
                                        <TableCell><div className="h-4 bg-slate-100/60 dark:bg-slate-700/60 rounded animate-pulse w-8 mx-auto"></div></TableCell>
                                    </TableRow>
                                ))
                            ) : paginated.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeColumns.length + 1 + (isBulkActionsOn ? 1 : 0)} className="py-20">
                                        <EmptyState
                                            icon={search || hasFilters ? SearchX : Handshake}
                                            title={search || hasFilters ? 'Nenhuma Parceria encontrada' : 'Nenhuma Parceria cadastrada'}
                                            description={search || hasFilters
                                                ? 'Ajuste os filtros ou a busca para ver resultados.'
                                                : 'Esta organização ainda não possui parcerias registradas. Crie a primeira ou importe uma planilha.'}
                                            action={(search || hasFilters) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={clearFilters}
                                                    className="mt-4 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/50 dark:hover:bg-indigo-950/50"
                                                >
                                                    Limpar Busca e Filtros
                                                </Button>
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginated.map((p) => {
                                    const colors = getStatusRowColor(p);
                                    const isSelected = selectedIds.has(p.id);
                                    return (
                                        <TableRow
                                            key={p.id}
                                            className={`${colors.bg} ${colors.hover} ${colors.border} transition-all duration-150 group cursor-pointer border-b-[1.5px]`}
                                            onClick={() => onView?.(p)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onView?.(p);
                                                }
                                            }}
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
                                            {activeColumns.map((c) => {
                                                const isStickyLeft = c.sticky === 'left';
                                                const isFirstCol = c.key === 'pgea';
                                                const content = c.render ? c.render(p) : (
                                                    <span className="text-[13px] text-slate-700 dark:text-slate-200">
                                                        {getParceriaField(p, c.key) || '—'}
                                                    </span>
                                                );
                                                return (
                                                    <TableCell
                                                        key={c.key}
                                                        className={`${cellPadding} transition-colors ${isStickyLeft ? `sticky left-0 z-10 ${colors.bg} border-r ${colors.groupHover}` : ''} ${isFirstCol ? `border-l-[4px] ${colors.accent}` : ''}`}
                                                    >
                                                        {content}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className={`text-center sticky right-0 z-10 ${colors.bg} border-l ${colors.groupHover} transition-colors`} onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black/5"><MoreHorizontal className="w-4 h-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-1 dark:ring-white/10 dark:shadow-2xl">
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(p); }}><Search className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />Ver detalhes</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(p); }}><Pencil className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />Editar</DropdownMenuItem>
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
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1 || totalPages === 0} className="h-8">
                            Anterior
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="h-8">
                            Próximo
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
