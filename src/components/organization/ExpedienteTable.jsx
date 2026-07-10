import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "@/components/ui/StatusBadge";
import StageTimeBadge from "@/components/ui/StageTimeBadge";
import ExpedienteDetailSheet from "./ExpedienteDetailSheet";
import { Search, MoreHorizontal, Pencil, Archive, ArrowUpDown, Settings2, Columns3, Filter, FilterX, Clock, Download, Bookmark, X, Rows3, Rows4 } from "lucide-react";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { useUserPreferences } from "@/hooks/useFirestore";
import { useFlag } from "@/lib/FeatureFlagsContext";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { statusConfig, DEFAULT_STATUS_CONFIG } from "@/config/processStatus";
import { getExpedienteField, calculateExpedienteDerivedStatus, isExpedienteUrgent } from "@/utils/expedienteUtils";
import { computeStageAverages, getDaysInCurrentStage, getStageTimeSeverity } from "@/lib/stageTime";
import { logAccess } from "@/services/functionsService";
import EmptyState from '../ui/EmptyState';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { SearchX, FileX2 } from 'lucide-react';

export default function ExpedienteTable({
  expedientes,
  members,
  userId,
  isLoading,
  onEdit,
  onArchive,
  onBulkArchive,
  initialFilter,
  organization
}) {

  const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
  const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
  const isDensityOn = useFlag(FEATURE_FLAGS.TABLE_DENSITY.key);
  const isStageIndicatorOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);
  const isExportOn = useFlag(FEATURE_FLAGS.EXPORT_PDF_EXCEL.key);
  const isBulkActionsOn = useFlag(FEATURE_FLAGS.BULK_ACTIONS.key);
  const isSavedViewsOn = useFlag(FEATURE_FLAGS.SAVED_VIEWS.key);
  const isAccessAuditLogOn = useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key);
  const [search, setSearch] = useState(() => localStorage.getItem('expedienteSearchTerm') || "");

  useEffect(() => {
    localStorage.setItem('expedienteSearchTerm', search);
  }, [search]);

  // Mesma razão da limpeza equivalente em ProcessTable.jsx: a chave no
  // localStorage não é por-órgão, então o termo de busca do órgão anterior
  // ficava visível depois de trocar de órgão.
  const orgIdRef = useRef(organization?.id);
  useEffect(() => {
    if (orgIdRef.current === organization?.id) return;
    orgIdRef.current = organization?.id;
    setSearch("");
  }, [organization?.id]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [dateFilters, setDateFilters] = useState({
    entry: { start: '', end: '' },
    distribution: { start: '', end: '' },
    analysis: { start: '', end: '' },
    review_submission: { start: '', end: '' },
    reviewed: { start: '', end: '' },
    review_return: { start: '', end: '' },
    archived: { start: '', end: '' }
  });
  const [isAniversarianteFilter, setIsAniversarianteFilter] = useState(false);
  const [selectedExpediente, setSelectedExpediente] = useState(null);

  // Ações em massa (flag `bulk_actions`): IDs selecionados na página atual.
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Visões salvas (flag `saved_views`): nome em edição para a nova visão.
  const [newViewName, setNewViewName] = useState('');
  const savedViews = preferences?.savedExpedienteViews || [];

  // Indicador de tempo na etapa atual (flag `stage_time_indicator`).
  const stageAverages = useMemo(
    () => (isStageIndicatorOn ? computeStageAverages(expedientes, getExpedienteField) : null),
    [isStageIndicatorOn, expedientes]
  );

  const dynamicResponsibleNames = useMemo(() => {
    const names = new Set();
    expedientes.forEach(e => {
      const name = getExpedienteField(e, 'responsible_user_name');
      if (name && typeof name === 'string' && name.trim()) {
        names.add(name.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [expedientes]);

  const dynamicSystems = useMemo(() => {
    const systems = new Set();
    expedientes.forEach(e => {
      const sys = getExpedienteField(e, 'system');
      if (sys && typeof sys === 'string' && sys.trim()) systems.add(sys.trim());
    });
    return Array.from(systems).sort();
  }, [expedientes]);

  const dynamicOrigins = useMemo(() => {
    const origins = new Set();
    expedientes.forEach(e => {
      const orig = getExpedienteField(e, 'origin');
      if (orig && typeof orig === 'string' && orig.trim()) origins.add(orig.trim());
    });
    return Array.from(origins).sort();
  }, [expedientes]);

  useEffect(() => {
    if (initialFilter === 'urgent') {
      setUrgencyFilter('sim');
    } else if (initialFilter === 'mine') {
      const currentUserMember = members.find(m => m.user_id === userId);
      if (currentUserMember?.user_name) {
        setResponsibleFilter(currentUserMember.user_name);
      }
    }
  }, [initialFilter, userId, members]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("all");
    setResponsibleFilter("all");
    setSystemFilter("all");
    setOriginFilter("all");
    setUrgencyFilter("all");
    setIsAniversarianteFilter(false);
    setDateFilters({
      entry: { start: '', end: '' },
      distribution: { start: '', end: '' },
      analysis: { start: '', end: '' },
      review_submission: { start: '', end: '' },
      reviewed: { start: '', end: '' },
      review_return: { start: '', end: '' },
      archived: { start: '', end: '' }
    });
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (responsibleFilter !== "all") count++;
    if (systemFilter !== "all") count++;
    if (originFilter !== "all") count++;
    if (urgencyFilter !== "all") count++;
    if (isAniversarianteFilter) count++;
    Object.values(dateFilters).forEach(d => {
      if (d.start || d.end) count++;
    });
    return count;
  }, [statusFilter, responsibleFilter, systemFilter, originFilter, urgencyFilter, dateFilters, isAniversarianteFilter]);

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN DEFINITIONS for Expedientes
  // ═══════════════════════════════════════════════════════════════════

  const orgName = organization?.name || organization?.organization_name || 'Órgão';

  const COLUMN_DEFINITIONS = useMemo(() => [
    {
      key: 'expediente_number', label: 'Expediente', defaultVisible: true,
      width: 'w-[200px]', sticky: 'left', sortable: true,
      render: (exp) => {
        const isUrgent = (() => {
          const val = getExpedienteField(exp, 'urgency_request');
          return val === true || String(val).toLowerCase().trim() === 'sim';
        })();
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
            <span className="font-semibold text-slate-800 dark:text-slate-100">{getExpedienteField(exp, 'expediente_number')}</span>
          </div>
        );
      }
    },
    ...(isStageIndicatorOn ? [{
      key: 'stage_time', label: 'Tempo na Etapa', defaultVisible: true,
      width: 'w-[110px]', sortable: false,
      render: (exp) => {
        const status = calculateExpedienteDerivedStatus(exp);
        const days = getDaysInCurrentStage(exp, status, getExpedienteField);
        const avg = stageAverages ? stageAverages[status] : null;
        const severity = getStageTimeSeverity(days);
        return <StageTimeBadge days={days} severity={severity} avg={avg} />;
      }
    }] : []),
    {
      key: 'system', label: 'Sistema', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => (
        <Badge variant="outline" className="text-[12px] font-medium">{getExpedienteField(exp, 'system') || '-'}</Badge>
      )
    },
    {
      key: 'origin', label: 'Origem', defaultVisible: true,
      width: 'w-[140px]', sortable: true,
      render: (exp) => (
        <span className="text-slate-700 truncate block text-[13px]" title={String(getExpedienteField(exp, 'origin'))}>
          {getExpedienteField(exp, 'origin') || '-'}
        </span>
      )
    },
    {
      key: 'entry_date', label: `Entrada no ${orgName}`, defaultVisible: true,
      width: 'w-[140px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'entry_date'))}</span>
    },
    {
      key: 'object', label: 'Objeto', defaultVisible: true,
      width: 'w-[300px]', sortable: true,
      render: (exp) => (
        <div className="line-clamp-2 text-sm leading-relaxed text-slate-700" title={String(getExpedienteField(exp, 'object'))}>
          {getExpedienteField(exp, 'object') || '-'}
        </div>
      )
    },
    {
      key: 'distribution_date', label: 'Distribuição', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'distribution_date'))}</span>
    },
    {
      key: 'responsible_user_name', label: 'Assessor Responsável', defaultVisible: true,
      width: 'w-[180px]', sortable: true,
      render: (exp) => (
        <span className="text-slate-700 truncate block" title={String(getExpedienteField(exp, 'responsible_user_name'))}>
          {getExpedienteField(exp, 'responsible_user_name') || '-'}
        </span>
      )
    },
    {
      key: 'analysis_start_date', label: 'Início da Análise', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'analysis_start_date'))}</span>
    },
    {
      key: 'observations', label: 'Observações', defaultVisible: true,
      width: 'w-[280px]', sortable: false,
      render: (exp) => (
        <div className="line-clamp-2 text-sm text-slate-500" title={String(getExpedienteField(exp, 'observations'))}>
          {getExpedienteField(exp, 'observations') || '-'}
        </div>
      )
    },
    {
      key: 'review_submission_date', label: 'Remessa p/ Revisão', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'review_submission_date'))}</span>
    },
    {
      key: 'reviewed_date', label: 'Revisão Concluída', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'reviewed_date'))}</span>
    },
    {
      key: 'review_return_date', label: 'Devolução após Revisão', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'review_return_date'))}</span>
    },
    {
      key: 'archived_date', label: 'Arquivamento', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (exp) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getExpedienteField(exp, 'archived_date'))}</span>
    },
    {
      key: 'network_folder', label: 'Pasta na Rede', defaultVisible: true,
      width: 'w-[220px]', sortable: true,
      render: (exp) => (
        <div className="truncate text-[11px] text-blue-600 font-mono" title={String(getExpedienteField(exp, 'network_folder'))}>
          {getExpedienteField(exp, 'network_folder') || '-'}
        </div>
      )
    },
    {
      key: 'status', label: 'Status', defaultVisible: true,
      width: 'w-[160px]', sortable: true,
      render: (exp) => <StatusBadge status={calculateExpedienteDerivedStatus(exp)} className="" />
    },
  ], [orgName, isStageIndicatorOn, stageAverages]);

  const DEFAULT_VISIBLE = useMemo(() => {
    const map = {};
    COLUMN_DEFINITIONS.forEach(col => { map[col.key] = col.defaultVisible; });
    return map;
  }, [COLUMN_DEFINITIONS]);

  const readLocalPref = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`caocipp_exp_pref_${key}`);
      if (stored === null) return defaultValue;
      return JSON.parse(stored);
    } catch { return defaultValue; }
  };

  const writeLocalPref = (key, value) => {
    try {
      localStorage.setItem(`caocipp_exp_pref_${key}`, JSON.stringify(value));
    } catch { }
  };

  const [sortConfig, setSortConfig] = useState(() => readLocalPref('sortConfig', { key: 'entry_date', direction: 'desc' }));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => readLocalPref('itemsPerPage', 20));
  const [visibleColumns, setVisibleColumns] = useState(() => readLocalPref('visibleColumns', DEFAULT_VISIBLE));
  const [density, setDensity] = useState(() => readLocalPref('density', 'comfortable'));
  const [isInitialized, setIsInitialized] = useState(false);

  const activeColumns = useMemo(() =>
    COLUMN_DEFINITIONS.filter(col => visibleColumns[col.key] !== false),
    [COLUMN_DEFINITIONS, visibleColumns]
  );

  const tableMinWidth = useMemo(() => {
    const nonStickyActive = activeColumns.filter(c => c.key !== 'expediente_number');
    const widthMap = { 'w-[300px]': 300, 'w-[280px]': 280, 'w-[220px]': 220, 'w-[200px]': 200, 'w-[180px]': 180, 'w-[160px]': 160, 'w-[140px]': 140, 'w-[110px]': 110, 'w-[100px]': 100 };
    let total = 200 + 80;
    nonStickyActive.forEach(col => { total += widthMap[col.width] || 150; });
    return total;
  }, [activeColumns]);

  const toggleColumn = useCallback((key) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      writeLocalPref('visibleColumns', next);
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE);
    writeLocalPref('visibleColumns', DEFAULT_VISIBLE);
  }, [DEFAULT_VISIBLE]);

  useEffect(() => {
    writeLocalPref('sortConfig', sortConfig);
  }, [sortConfig]);

  useEffect(() => {
    writeLocalPref('itemsPerPage', itemsPerPage);
  }, [itemsPerPage]);

  useEffect(() => {
    writeLocalPref('density', density);
  }, [density]);

  const appliedPrefsRef = useRef(null);
  useEffect(() => {
    if (isLoadingPrefs) return;
    const prefsKey = JSON.stringify(preferences);
    if (appliedPrefsRef.current === prefsKey) return;

    if (preferences && typeof preferences === 'object') {
      const p = preferences;
      const sConf = p['expediente_sortConfig'];
      const iPage = p['expediente_itemsPerPage'];
      const dens = p['expediente_density'];
      if (sConf) {
        setSortConfig(sConf);
        writeLocalPref('sortConfig', sConf);
      }
      if (iPage != null) {
        setItemsPerPage(Number(iPage) || 20);
        writeLocalPref('itemsPerPage', Number(iPage) || 20);
      }
      if (dens === 'comfortable' || dens === 'compact') {
        setDensity(dens);
        writeLocalPref('density', dens);
      }
    }
    appliedPrefsRef.current = prefsKey;
    if (!isInitialized) setIsInitialized(true);
  }, [preferences, isLoadingPrefs]);

  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (isInitialized) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updatePreferences({ expediente_sortConfig: sortConfig, expediente_itemsPerPage: itemsPerPage, expediente_density: density });
      }, 500);
    }
    return () => clearTimeout(saveTimerRef.current);
  }, [sortConfig, itemsPerPage, density, isInitialized, updatePreferences]);

  useEffect(() => {
    if (isInitialized) setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, responsibleFilter, systemFilter, originFilter, urgencyFilter, dateFilters]);

  const filteredAndSortedExpedientes = useMemo(() => {
    let result = [...expedientes];

    if (search) {
      const searchLower = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const extractAllText = (obj) => {
        if (!obj) return '';
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return String(obj) + ' ';
        if (Array.isArray(obj)) return obj.map(extractAllText).join(' ');
        if (typeof obj === 'object') {
          if (obj.seconds) {
            try { const d = new Date(obj.seconds * 1000); return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()} `; } catch { return ''; }
          }
          return Object.values(obj).map(extractAllText).join(' ');
        }
        return '';
      };

      result = result.filter(e => {
        const allText = extractAllText(e).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const derivedStatus = calculateExpedienteDerivedStatus(e).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return allText.includes(searchLower) || derivedStatus.includes(searchLower);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter(e => calculateExpedienteDerivedStatus(e) === statusFilter);
    }

    if (responsibleFilter !== "all") {
      result = result.filter(e => getExpedienteField(e, 'responsible_user_name') === responsibleFilter);
    }

    if (systemFilter !== "all") {
      result = result.filter(e => getExpedienteField(e, 'system') === systemFilter);
    }

    if (originFilter !== "all") {
      result = result.filter(e => getExpedienteField(e, 'origin') === originFilter);
    }

    if (urgencyFilter !== "all") {
      const isUrgent = urgencyFilter === "urgent" || urgencyFilter === "sim";
      result = result.filter(e => {
        const val = getExpedienteField(e, 'urgency_request');
        return (val === true || String(val).toLowerCase().trim() === 'sim') === isUrgent;
      });
    }

    Object.keys(dateFilters).forEach(key => {
      const { start, end } = dateFilters[key];
      if (start || end) {
        const fieldName = { entry: 'entry_date', distribution: 'distribution_date', analysis: 'analysis_start_date', review_submission: 'review_submission_date', reviewed: 'reviewed_date', review_return: 'review_return_date', archived: 'archived_date' }[key];
        result = result.filter(e => {
          const val = getExpedienteField(e, fieldName);
          if (!val) return false;
          const date = parseLocalDate(val);
          if (!isValid(date)) return false;
          if (start && !end) return date >= startOfDay(new Date(start));
          if (!start && end) return date <= endOfDay(new Date(end));
          if (start && end) return date >= startOfDay(new Date(start)) && date <= endOfDay(new Date(end));
          return true;
        });
      }
    });

    if (isAniversarianteFilter) {
      result = result.filter(e => {
        const entryDate = getExpedienteField(e, "entry_date");
        if (!entryDate) return false;
        const diff = Number(new Date()) - Number(new Date(entryDate));
        return (diff / (1000 * 60 * 60 * 24)) >= 365;
      });
    }

    const DATE_COLUMNS = new Set(['entry_date', 'distribution_date', 'analysis_start_date', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date']);
    const parseDateToTimestamp = (value) => {
      if (!value) return null;
      if (value.seconds !== undefined) return value.seconds * 1000;
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    result.sort((a, b) => {
      const aRaw = getExpedienteField(a, sortConfig.key);
      const bRaw = getExpedienteField(b, sortConfig.key);
      if (!aRaw && !bRaw) return 0;
      if (!aRaw) return 1;
      if (!bRaw) return -1;

      let comparison = 0;
      if (DATE_COLUMNS.has(sortConfig.key)) {
        const aT = parseDateToTimestamp(aRaw);
        const bT = parseDateToTimestamp(bRaw);
        if (aT === null) return 1;
        if (bT === null) return -1;
        comparison = aT - bT;
      } else {
        comparison = String(aRaw).localeCompare(String(bRaw), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [expedientes, search, statusFilter, responsibleFilter, systemFilter, originFilter, urgencyFilter, dateFilters, sortConfig, isAniversarianteFilter]);

  const paginatedExpedientes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedExpedientes.slice(start, start + itemsPerPage);
  }, [filteredAndSortedExpedientes, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedExpedientes.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseLocalDate(dateStr);
    if (!isValid(date)) return 'Data Inválida';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getStatusRowColor = (exp) => {
    const status = calculateExpedienteDerivedStatus(exp);
    const isUrgent = isExpedienteUrgent(exp);

    if (isUrgent && (status === 'Pendente' || !status)) {
      return isV2
        ? {
          bg: "bg-white dark:bg-slate-900",
          accent: "border-l-red-500",
          border: "border-b-border",
          hover: "hover:bg-muted/60",
          groupHover: "group-hover:!bg-muted/60"
        }
        : {
          bg: "bg-[#FF7979]",
          accent: "border-l-[#CC0000]",
          border: "border-b-[#E06666]",
          hover: "hover:bg-[#FF6060]",
          groupHover: "group-hover:!bg-[#FF6060]"
        };
    }

    const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
    if (isV2) return config.rowV2 || DEFAULT_STATUS_CONFIG.rowV2;
    return config.row || DEFAULT_STATUS_CONFIG.row;
  };

  const statuses = ["Pendente", "Em elaboração", "Em revisão", "Revisadas", "Na pasta"];

  // ═══════════════════════════════════════════════════════════════════
  // VISÕES SALVAS (flag `saved_views`)
  // ═══════════════════════════════════════════════════════════════════
  const currentFilterSnapshot = () => ({
    search, statusFilter, responsibleFilter, systemFilter, originFilter, urgencyFilter,
    dateFilters, isAniversarianteFilter,
  });

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const view = { id: Date.now().toString(36), name, filters: currentFilterSnapshot() };
    updatePreferences({ savedExpedienteViews: [...savedViews, view] });
    setNewViewName('');
    toast.success(`Visão "${name}" salva.`);
  };

  const applySavedView = (view) => {
    const f = view.filters || {};
    setSearch(f.search || '');
    setStatusFilter(f.statusFilter || 'all');
    setResponsibleFilter(f.responsibleFilter || 'all');
    setSystemFilter(f.systemFilter || 'all');
    setOriginFilter(f.originFilter || 'all');
    setUrgencyFilter(f.urgencyFilter || 'all');
    setDateFilters(f.dateFilters || {
      entry: { start: '', end: '' }, distribution: { start: '', end: '' }, analysis: { start: '', end: '' },
      review_submission: { start: '', end: '' }, reviewed: { start: '', end: '' }, review_return: { start: '', end: '' }, archived: { start: '', end: '' }
    });
    setIsAniversarianteFilter(!!f.isAniversarianteFilter);
    toast.success(`Visão "${view.name}" aplicada.`);
  };

  const removeSavedView = (id) => {
    updatePreferences({ savedExpedienteViews: savedViews.filter(v => v.id !== id) });
  };

  // ═══════════════════════════════════════════════════════════════════
  // AÇÕES EM MASSA (flag `bulk_actions`)
  // ═══════════════════════════════════════════════════════════════════
  const allPageSelected = paginatedExpedientes.length > 0 && paginatedExpedientes.every(e => selectedIds.has(e.id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedExpedientes.forEach(e => next.delete(e.id));
      } else {
        paginatedExpedientes.forEach(e => next.add(e.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedExpedienteObjects = useMemo(
    () => filteredAndSortedExpedientes.filter(e => selectedIds.has(e.id)),
    [filteredAndSortedExpedientes, selectedIds]
  );

  const handleBulkArchive = async () => {
    const toArchive = selectedExpedienteObjects.filter(e => !e.archived_date);
    if (toArchive.length === 0) {
      toast.info('Nenhum expediente selecionado pode ser arquivado.');
      return;
    }
    const confirmed = window.confirm(`Arquivar ${toArchive.length} expediente(s) selecionado(s)?`);
    if (!confirmed) return;

    const results = await Promise.allSettled(toArchive.map((exp) => onBulkArchive(exp)));
    const failed = results.filter((r) => r.status === 'rejected');
    const succeeded = results.length - failed.length;

    if (succeeded > 0) {
      toast.success(`${succeeded} expediente(s) arquivado(s).`);
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} expediente(s) não puderam ser arquivados.`);
    }
    clearSelection();
  };

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAÇÃO (flag `export_pdf_excel`)
  // ═══════════════════════════════════════════════════════════════════
  const DATE_EXPORT_KEYS = new Set(['entry_date', 'distribution_date', 'analysis_start_date', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date']);

  const getExportValue = (col, exp) => {
    if (col.key === 'status') return calculateExpedienteDerivedStatus(exp);
    if (col.key === 'stage_time') {
      const status = calculateExpedienteDerivedStatus(exp);
      const days = getDaysInCurrentStage(exp, status, getExpedienteField);
      return days == null ? '' : `${days}d`;
    }
    if (DATE_EXPORT_KEYS.has(col.key)) return formatDate(getExpedienteField(exp, col.key));
    return getExpedienteField(exp, col.key) ?? '';
  };

  const handleExport = async (kind) => {
    const rows = selectedIds.size > 0 ? selectedExpedienteObjects : filteredAndSortedExpedientes;
    if (rows.length === 0) {
      toast.info('Nenhum expediente para exportar.');
      return;
    }
    const columns = activeColumns.map(col => ({ label: col.label, value: (e) => getExportValue(col, e) }));
    const filenameBase = `expedientes-${new Date().toISOString().slice(0, 10)}`;
    // Import sob demanda: xlsx/jsPDF são pesadas (~centenas de KB) e só devem
    // ser baixadas por quem realmente exporta, não incluídas no bundle principal.
    const { exportRowsToExcel, exportRowsToPdf } = await import('@/lib/tableExport');
    if (kind === 'excel') {
      exportRowsToExcel({ rows, columns, filenameBase });
    } else {
      exportRowsToPdf({ rows, columns, filenameBase, title: 'Expedientes' });
    }
    toast.success(`Exportação de ${rows.length} expediente(s) iniciada.`);

    if (isAccessAuditLogOn && organization?.id) {
      logAccess({
        organizationId: organization.id,
        entityType: 'expediente',
        action: 'export_table',
        details: { format: kind, rowCount: rows.length },
      }).catch(() => { /* best-effort — não deve impedir a exportação já concluída */ });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por número, sistema, origem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-44 h-10">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {dynamicResponsibleNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 gap-2 text-slate-600">
                  <Filter className="w-4 h-4" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="bg-indigo-600 text-white hover:bg-indigo-700 px-1.5 min-w-[20px] h-5 rounded-full text-[10px]">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[400px] p-4 shadow-xl border-slate-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Filtros Avançados
                    </h4>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-tight">
                      Limpar Tudo
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sistema</label>
                      <Select value={systemFilter} onValueChange={setSystemFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer</SelectItem>
                          {dynamicSystems.map(sys => (
                            <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Origem</label>
                      <Select value={originFilter} onValueChange={setOriginFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer</SelectItem>
                          {dynamicOrigins.map(orig => (
                            <SelectItem key={orig} value={orig}>{orig}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Urgência</label>
                      <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Qualquer</SelectItem>
                          <SelectItem value="sim">Urgente</SelectItem>
                          <SelectItem value="não">Normal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Longa Data</label>
                      <Button
                        variant={isAniversarianteFilter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsAniversarianteFilter(!isAniversarianteFilter)}
                        className={`w-full h-9 justify-start gap-2 ${isAniversarianteFilter ? 'bg-indigo-600' : ''}`}
                      >
                        <Clock className={`w-3.5 h-3.5 ${isAniversarianteFilter ? 'text-white' : 'text-slate-400'}`} />
                        <span className="text-[11px]">365+ dias</span>
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Filtros de Datas</label>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                      {[
                        { label: `Entrada no ${orgName}`, key: 'entry' },
                        { label: 'Distribuição', key: 'distribution' },
                        { label: 'Início da Análise', key: 'analysis' },
                        { label: 'Remessa p/ Revisão', key: 'review_submission' },
                        { label: 'Revisão Concluída', key: 'reviewed' },
                        { label: 'Devolução após Revisão', key: 'review_return' },
                        { label: 'Arquivamento', key: 'archived' }
                      ].map(({ label, key }) => (
                        <div key={key} className="p-2 border rounded-md bg-slate-50/50 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
                          <div className="flex items-center gap-2">
                            <Input type="date" value={dateFilters[key].start} onChange={(e) => setDateFilters({ ...dateFilters, [key]: { ...dateFilters[key], start: e.target.value } })} className="h-8 text-xs px-2" />
                            <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0 rotate-90" />
                            <Input type="date" value={dateFilters[key].end} onChange={(e) => setDateFilters({ ...dateFilters, [key]: { ...dateFilters[key], end: e.target.value } })} className="h-8 text-xs px-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-slate-500 hover:text-slate-900 border-none shadow-none">
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Colunas</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold">{activeColumns.length}</Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 shadow-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-1 dark:ring-white/10 dark:shadow-2xl mt-2">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">Colunas Visíveis</h4>
                    <Button variant="ghost" size="sm" onClick={resetColumns} className="h-7 text-xs text-slate-500 hover:text-slate-700">Restaurar</Button>
                  </div>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {COLUMN_DEFINITIONS.map(col => (
                      <label key={col.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                        <Checkbox checked={visibleColumns[col.key] !== false} onCheckedChange={() => toggleColumn(col.key)} className="h-4 w-4" />
                        <span className="text-sm text-slate-600">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 text-rose-500 hover:text-rose-600 hover:bg-rose-50" title="Limpar todos os filtros">
                <FilterX className="w-4 h-4" />
              </Button>
            )}

            {isSavedViewsOn && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-10 gap-2 text-slate-600">
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
                      <p className="text-xs text-slate-400 px-1 py-2">Nenhuma visão salva ainda. Configure os filtros e salve abaixo.</p>
                    ) : (
                      savedViews.map(view => (
                        <div key={view.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                          <button type="button" className="text-sm text-slate-700 dark:text-slate-200 flex-1 text-left truncate" onClick={() => applySavedView(view)}>
                            {view.name}
                          </button>
                          <button type="button" className="text-slate-300 hover:text-rose-500 shrink-0" onClick={() => removeSavedView(view.id)} title="Excluir visão">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 border-t border-slate-100 pt-3">
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
                  <Button variant="outline" className="h-10 gap-2 text-slate-600">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Exportar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('excel')}>Exportar Excel (.xlsx)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>Exportar PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isDensityOn && (
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDensity('comfortable')}
                      className={`h-full px-2.5 flex items-center transition-colors ${density === 'comfortable' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Rows3 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Densidade confortável</TooltipContent>
                </Tooltip>
                <div className="w-px h-5 bg-slate-200" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setDensity('compact')}
                      className={`h-full px-2.5 flex items-center transition-colors ${density === 'compact' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
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

      {isBulkActionsOn && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selectedIds.size} selecionado(s)</span>
          <div className="flex items-center gap-2">
            {isExportOn && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleExport('excel')}>
                <Download className="w-3.5 h-3.5" /> Exportar selecionados
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50" onClick={handleBulkArchive}>
              <Archive className="w-3.5 h-3.5" /> Arquivar selecionados
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-slate-500" onClick={clearSelection}>Limpar seleção</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table style={{ minWidth: `${tableMinWidth}px` }}>
            <TableHeader>
              <TableRow className="bg-slate-50 shadow-sm">
                {isBulkActionsOn && (
                  <TableHead className="w-[40px] bg-slate-50 sticky top-0 z-30">
                    <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAllOnPage} aria-label="Selecionar todos nesta página" />
                  </TableHead>
                )}
                {activeColumns.map(col => {
                  const isStickyLeft = col.sticky === 'left';
                  return (
                    <TableHead
                      key={col.key}
                      className={`font-semibold ${col.width} bg-slate-50 sticky top-0 z-30 ${isStickyLeft ? 'left-0 z-40 border-r' : ''} ${col.align === 'center' ? 'text-center' : ''}`}
                    >
                      {col.sortable ? (
                        <Button variant="ghost" size="sm" onClick={() => handleSort(col.key)} className="-ml-2 h-8 font-semibold">
                          {col.label} <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig.key === col.key ? 'text-indigo-600' : ''}`} />
                        </Button>
                      ) : col.label}
                    </TableHead>
                  )
                })}
                <TableHead className="font-semibold text-center sticky top-0 right-0 z-40 bg-slate-50 border-l w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {isBulkActionsOn && (
                      <TableCell><div className="h-4 w-4 bg-slate-100/60 rounded animate-pulse"></div></TableCell>
                    )}
                    {activeColumns.map(col => (
                      <TableCell key={col.key}>
                        <div className="h-4 bg-slate-100/60 rounded animate-pulse w-full"></div>
                      </TableCell>
                    ))}
                    <TableCell><div className="h-4 bg-slate-100/60 rounded animate-pulse w-8 mx-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : paginatedExpedientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 1 + (isBulkActionsOn ? 1 : 0)} className="py-20">
                    <EmptyState
                      icon={search ? SearchX : FileX2}
                      title={search ? "Nenhum expediente encontrado" : "Nenhum expediente cadastrado"}
                      description={search
                        ? `Não encontramos resultados para "${search}". Verifique a ortografia ou tente outros termos.`
                        : "Esta organização ainda não possui expedientes registrados."}
                      action={search && (
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
                paginatedExpedientes.map((exp) => {
                  const colors = getStatusRowColor(exp);
                  const cellPadding = density === 'compact' ? 'py-1' : 'py-3';

                  return (
                    <TableRow
                      key={exp.id}
                      className={`${colors.bg} ${colors.hover} ${colors.border} transition-all duration-150 group cursor-pointer border-b-[1.5px]`}
                      onClick={() => setSelectedExpediente(exp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedExpediente(exp);
                        }
                      }}
                    >
                      {isBulkActionsOn && (
                        <TableCell className={cellPadding} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(exp.id)}
                            onCheckedChange={() => toggleSelectOne(exp.id)}
                            aria-label={`Selecionar expediente ${getExpedienteField(exp, 'expediente_number') || ''}`}
                          />
                        </TableCell>
                      )}
                      {activeColumns.map(col => {
                        const isStickyLeft = col.sticky === 'left';
                        const isFirstCol = col.key === 'expediente_number';

                        return (
                          <TableCell
                            key={col.key}
                            className={`${cellPadding} transition-colors ${isStickyLeft ? `sticky left-0 z-10 ${colors.bg} border-r ${colors.groupHover}` : ''} ${isFirstCol ? `border-l-[4px] ${colors.accent}` : ''} ${col.align === 'center' ? 'text-center' : ''}`}
                          >
                            {col.render(exp)}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-center sticky right-0 z-10 ${colors.bg} border-l ${colors.groupHover} transition-colors`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black/5"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-1 dark:ring-white/10 dark:shadow-2xl">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(exp); }}><Pencil className="w-4 h-4 mr-2 text-slate-500" />Editar</DropdownMenuItem>
                            {!exp.archived_date && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onArchive(exp); }}
                                    className="text-rose-600 focus:text-rose-600"
                                  >
                                    <Archive className="w-4 h-4 mr-2" />Arquivar
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left">Move o expediente para arquivados</TooltipContent>
                              </Tooltip>
                            )}
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

      <ExpedienteDetailSheet
        expediente={selectedExpediente}
        open={!!selectedExpediente}
        onClose={() => setSelectedExpediente(null)}
        onEdit={onEdit}
        getExpedienteField={getExpedienteField}
      />

      {filteredAndSortedExpedientes.length > 0 && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] z-20">
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedExpedientes.length)} de {filteredAndSortedExpedientes.length} expedientes</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Exibir:</label>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(parseInt(v))}>
                <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
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
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || totalPages === 0} className="h-8">Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="h-8">Próximo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
