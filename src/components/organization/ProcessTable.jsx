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
import ProcessDetailSheet from "./ProcessDetailSheet";
import { Search, MoreHorizontal, Pencil, Archive, ArrowUpDown, Settings2, Columns3, Filter, FilterX, Clock, Download, Bookmark, X, Rows3, Rows4 } from "lucide-react";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { useUserPreferences } from "@/hooks/useFirestore";
import { useFlag } from "@/lib/FeatureFlagsContext";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { statusConfig, DEFAULT_STATUS_CONFIG } from "@/config/processStatus";
import { getProcessField, calculateDerivedStatus, isProcessUrgent } from "@/utils/processUtils";
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

export default function ProcessTable({
  processes,
  members,
  userId,
  isLoading,
  onEdit,
  onArchive,
  onBulkArchive,
  initialFilter,
  organization
}) {
  // Defensive helper to ensure 100% data visibility across different field name variations
  // Mirrors the logic found in EditProcessDialog

  const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
  const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
  const isDensityOn = useFlag(FEATURE_FLAGS.TABLE_DENSITY.key);
  const isStageIndicatorOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);
  const isExportOn = useFlag(FEATURE_FLAGS.EXPORT_PDF_EXCEL.key);
  const isBulkActionsOn = useFlag(FEATURE_FLAGS.BULK_ACTIONS.key);
  const isSavedViewsOn = useFlag(FEATURE_FLAGS.SAVED_VIEWS.key);
  const isAccessAuditLogOn = useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key);
  const [search, setSearch] = useState(() => localStorage.getItem('processSearchTerm') || "");

  useEffect(() => {
    localStorage.setItem('processSearchTerm', search);
  }, [search]);

  // Sem isto, o termo de busca de um órgão ficava visível na caixa de busca
  // depois de trocar para outro órgão (a chave no localStorage não é
  // por-órgão). Ignora a primeira execução (montagem) para não descartar o
  // termo restaurado do localStorage antes mesmo de exibi-lo.
  const orgIdRef = useRef(organization?.id);
  useEffect(() => {
    if (orgIdRef.current === organization?.id) return;
    orgIdRef.current = organization?.id;
    setSearch("");
  }, [organization?.id]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
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
  const [textFilters, setTextFilters] = useState({
    matter_object: '',
    network_folder_path: ''
  });
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [isAniversarianteFilter, setIsAniversarianteFilter] = useState(false);

  // Ações em massa (flag `bulk_actions`): IDs selecionados na página atual.
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Visões salvas (flag `saved_views`): nome em edição para a nova visão.
  const [newViewName, setNewViewName] = useState('');
  const savedViews = preferences?.savedProcessViews || [];

  // Indicador de tempo na etapa atual (flag `stage_time_indicator`): média
  // histórica calculada sobre TODOS os processos do órgão.
  const stageAverages = useMemo(
    () => (isStageIndicatorOn ? computeStageAverages(processes, getProcessField) : null),
    [isStageIndicatorOn, processes]
  );

  // 1. Extract dynamic list of responsible names from process data
  const dynamicResponsibleNames = useMemo(() => {
    const names = new Set();
    processes.forEach(p => {
      const name = getProcessField(p, 'responsible_user_name');
      if (name && typeof name === 'string' && name.trim()) {
        names.add(name.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [processes]);

  // Handle initial filter from query params
  useEffect(() => {
    if (initialFilter === 'urgent') {
      setUrgencyFilter('sim');
    } else if (initialFilter === 'mine') {
      // Find the user name in members to filter by name
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
    setLocationFilter("all");
    setUrgencyFilter("all");
    setIsAniversarianteFilter(false);
    setTextFilters({ matter_object: '', network_folder_path: '' });
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
    if (locationFilter !== "all") count++;
    if (urgencyFilter !== "all") count++;
    if (isAniversarianteFilter) count++;
    if (textFilters.matter_object) count++;
    if (textFilters.network_folder_path) count++;
    Object.values(dateFilters).forEach(d => {
      if (d.start || d.end) count++;
    });
    return count;
  }, [statusFilter, responsibleFilter, locationFilter, urgencyFilter, textFilters, dateFilters, isAniversarianteFilter]);

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN DEFINITIONS — Data-driven table architecture
  // ═══════════════════════════════════════════════════════════════════
  const COLUMN_DEFINITIONS = useMemo(() => [
    {
      key: 'process_number', label: 'Processo', defaultVisible: true,
      width: 'w-[200px]', sticky: 'left', sortable: true,
      render: (process) => {
        const isUrgent = (() => {
          const val = getProcessField(process, 'urgency_request');
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
            <span className="font-semibold text-slate-800 dark:text-slate-100">{getProcessField(process, 'process_number')}</span>
          </div>
        );
      }
    },
    ...(isStageIndicatorOn ? [{
      key: 'stage_time', label: 'Tempo na Etapa', defaultVisible: true,
      width: 'w-[110px]', sortable: false,
      render: (process) => {
        const status = calculateDerivedStatus(process);
        const days = getDaysInCurrentStage(process, status, getProcessField);
        const avg = stageAverages ? stageAverages[status] : null;
        const severity = getStageTimeSeverity(days, avg);
        return <StageTimeBadge days={days} severity={severity} avg={avg} />;
      }
    }] : []),
    {
      key: 'consultant', label: 'Consulente', defaultVisible: true,
      width: 'w-[140px]', sortable: true,
      render: (process) => (
        <div className="text-slate-700 whitespace-normal break-words line-clamp-2 leading-tight text-[13px]" title={String(getProcessField(process, 'consultant'))}>
          {getProcessField(process, 'consultant')}
        </div>
      )
    },
    {
      key: 'matter_category', label: 'Matéria', defaultVisible: true,
      width: 'w-[180px]', sortable: true,
      render: (process) => {
        const cat = getProcessField(process, 'matter_category');
        const sub = getProcessField(process, 'matter_subcategory');
        if (!cat) return <span className="text-slate-400">-</span>;
        return (
          <div className="text-[13px] leading-tight text-slate-700">
            <div className="font-medium line-clamp-1" title={cat}>{cat}</div>
            {sub && <div className="text-slate-500 line-clamp-1" title={sub}>{sub}</div>}
          </div>
        );
      }
    },
    {
      key: 'matter_object', label: 'Objeto da Consulta', defaultVisible: true,
      width: 'w-[300px]', sortable: true,
      render: (process) => (
        <div className="line-clamp-2 text-sm leading-relaxed text-slate-700" title={String(getProcessField(process, 'matter_object'))}>
          {getProcessField(process, 'matter_object') || '-'}
        </div>
      )
    },
    {
      key: 'location', label: 'Local dos Fatos', defaultVisible: false,
      width: 'w-[160px]', sortable: true,
      render: (process) => (
        <span className="text-slate-600 truncate block" title={String(getProcessField(process, 'location'))}>
          {getProcessField(process, 'location') || '-'}
        </span>
      )
    },
    {
      key: 'entry_date', label: 'Entrada', defaultVisible: true,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'entry_date'))}</span>
    },
    {
      key: 'distribution_date', label: 'Distribuição', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'distribution_date'))}</span>
    },
    {
      key: 'responsible_user_name', label: 'Assessor Responsável', defaultVisible: true,
      width: 'w-[180px]', sortable: true,
      render: (process) => (
        <span className="text-slate-700 truncate block" title={String(getProcessField(process, 'responsible_user_name'))}>
          {getProcessField(process, 'responsible_user_name') || '-'}
        </span>
      )
    },
    {
      key: 'analysis_start_date', label: 'Início Análise', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'analysis_start_date'))}</span>
    },
    {
      key: 'observations', label: 'Observações', defaultVisible: false,
      width: 'w-[280px]', sortable: false,
      render: (process) => (
        <div className="line-clamp-2 text-sm text-slate-500" title={String(getProcessField(process, 'observations'))}>
          {getProcessField(process, 'observations') || '-'}
        </div>
      )
    },
    {
      key: 'review_submission_date', label: 'Para Revisão', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'review_submission_date'))}</span>
    },
    {
      key: 'reviewed_date', label: 'Revisão Concluída', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'reviewed_date'))}</span>
    },
    {
      key: 'review_return_date', label: 'Devolução após Revisão', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'review_return_date'))}</span>
    },
    {
      key: 'access_restriction', label: 'Restrição', defaultVisible: false,
      width: 'w-[100px]', sortable: false, align: 'center',
      render: (process) => {
        const val = getProcessField(process, 'access_restriction');
        return (val === true || String(val).toLowerCase().trim() === 'sim')
          ? <span className="text-xs text-amber-600 font-medium">Restrito</span>
          : <span className="text-slate-300">-</span>;
      }
    },
    {
      key: 'archived_date', label: 'Arquivado em', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-[13px] text-slate-500 font-medium dark:text-slate-400">{formatDate(getProcessField(process, 'archived_date'))}</span>
    },
    {
      key: 'network_folder', label: 'Pasta na Rede', defaultVisible: false,
      width: 'w-[220px]', sortable: true,
      render: (process) => (
        <div className="truncate text-[11px] text-blue-600 font-mono" title={String(getProcessField(process, 'network_folder'))}>
          {getProcessField(process, 'network_folder') || '-'}
        </div>
      )
    },
    {
      key: 'status', label: 'Status', defaultVisible: true,
      width: 'w-[160px]', sortable: true,
      render: (process) => <StatusBadge status={calculateDerivedStatus(process)} className="" />
    },
  ], [isStageIndicatorOn, stageAverages]);

  const DEFAULT_VISIBLE = useMemo(() => {
    const map = {};
    COLUMN_DEFINITIONS.forEach(col => { map[col.key] = col.defaultVisible; });
    return map;
  }, [COLUMN_DEFINITIONS]);

  const readLocalPref = (key, defaultValue) => {
    try {
      const stored = localStorage.getItem(`caocipp_pref_${key}`);
      if (stored === null) return defaultValue;
      return JSON.parse(stored);
    } catch { return defaultValue; }
  };

  const writeLocalPref = (key, value) => {
    try {
      localStorage.setItem(`caocipp_pref_${key}`, JSON.stringify(value));
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
    const nonStickyActive = activeColumns.filter(c => c.key !== 'process_number');
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
      const sConf = p['sortConfig'];
      const iPage = p['itemsPerPage'];
      const dens = p['density'];
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
        // currentPage é deliberadamente omitido: nunca é restaurado no efeito
        // acima, então persisti-lo só gerava uma escrita a mais no Firestore
        // a cada troca de página sem nenhum efeito prático (mesmo comportamento
        // já usado em ExpedienteTable.jsx).
        updatePreferences({ sortConfig, itemsPerPage, density });
      }, 500);
    }
    return () => clearTimeout(saveTimerRef.current);
  }, [sortConfig, itemsPerPage, density, isInitialized, updatePreferences]);

  useEffect(() => {
    if (isInitialized) setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, responsibleFilter, locationFilter, urgencyFilter, dateFilters, textFilters]);

  const filteredAndSortedProcesses = useMemo(() => {
    let result = [...processes];

    if (search) {
      const searchLower = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const extractAllText = (obj) => {
        if (!obj) return '';
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
          return String(obj) + ' ';
        }
        if (Array.isArray(obj)) {
          return obj.map(extractAllText).join(' ');
        }
        if (typeof obj === 'object') {
          // Attempt to format Firebase Timestamps
          if (obj.seconds) {
            try {
              const d = new Date(obj.seconds * 1000);
              return `${("0" + d.getDate()).slice(-2)}/${("0" + (d.getMonth() + 1)).slice(-2)}/${d.getFullYear()} `;
            } catch (e) { return ''; }
          }
          return Object.values(obj).map(extractAllText).join(' ');
        }
        return '';
      };

      result = result.filter(p => {
        const allText = extractAllText(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const derivedStatus = calculateDerivedStatus(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return allText.includes(searchLower) || derivedStatus.includes(searchLower);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter(p => calculateDerivedStatus(p) === statusFilter);
    }

    if (responsibleFilter !== "all") {
      result = result.filter(p => getProcessField(p, 'responsible_user_name') === responsibleFilter);
    }

    if (locationFilter !== "all") {
      const locLower = locationFilter.toLowerCase();
      result = result.filter(p => String(getProcessField(p, 'location')).toLowerCase().includes(locLower));
    }

    if (urgencyFilter !== "all") {
      const isUrgent = urgencyFilter === "urgent" || urgencyFilter === "sim";
      result = result.filter(p => {
        const val = getProcessField(p, 'urgency_request');
        return (val === true || String(val).toLowerCase().trim() === 'sim') === isUrgent;
      });
    }

    Object.keys(dateFilters).forEach(key => {
      const { start, end } = dateFilters[key];
      if (start || end) {
        const fieldName = { entry: 'entry_date', distribution: 'distribution_date', analysis: 'analysis_start_date', review_submission: 'review_submission_date', reviewed: 'reviewed_date', review_return: 'review_return_date', archived: 'archived_date' }[key];
        result = result.filter(p => {
          const val = getProcessField(p, fieldName);
          if (!val) return false;
          const processDate = parseLocalDate(val);
          if (!isValid(processDate)) return false;
          if (start && !end) return processDate >= startOfDay(new Date(start));
          if (!start && end) return processDate <= endOfDay(new Date(end));
          if (start && end) return processDate >= startOfDay(new Date(start)) && processDate <= endOfDay(new Date(end));
          return true;
        });
      }
    });

    Object.keys(textFilters).forEach(key => {
      const filterText = textFilters[key]?.toLowerCase();
      if (filterText) {
        const fieldName = key === 'network_folder_path' ? 'network_folder' : key;
        result = result.filter(p => String(getProcessField(p, fieldName)).toLowerCase().includes(filterText));
      }
    });

    if (isAniversarianteFilter) {
      result = result.filter(p => {
        const entryDate = getProcessField(p, "entry_date");
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
      const aRaw = getProcessField(a, sortConfig.key);
      const bRaw = getProcessField(b, sortConfig.key);
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
  }, [processes, search, statusFilter, responsibleFilter, locationFilter, urgencyFilter, dateFilters, textFilters, sortConfig, isAniversarianteFilter]);

  const paginatedProcesses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProcesses.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProcesses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProcesses.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = parseLocalDate(dateStr);
    if (!isValid(date)) return 'Data Inválida';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getStatusRowColor = (process) => {
    // Definitive v1.13.0: Derived status for coloring ensures ZERO LAG with dates
    const status = calculateDerivedStatus(process);
    const isUrgent = isProcessUrgent(process);

    // Override: Urgent + Pending gets the red color
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

    // Default to configuration from statusConfig
    const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
    if (isV2) return config.rowV2 || DEFAULT_STATUS_CONFIG.rowV2;
    return config.row || DEFAULT_STATUS_CONFIG.row;
  };

  const statuses = ["Pendente", "Em elaboração", "Em revisão", "Revisadas", "Na pasta"];

  // ═══════════════════════════════════════════════════════════════════
  // VISÕES SALVAS (flag `saved_views`)
  // ═══════════════════════════════════════════════════════════════════
  const currentFilterSnapshot = () => ({
    search, statusFilter, responsibleFilter, locationFilter, urgencyFilter,
    dateFilters, textFilters, isAniversarianteFilter,
  });

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    const view = { id: Date.now().toString(36), name, filters: currentFilterSnapshot() };
    updatePreferences({ savedProcessViews: [...savedViews, view] });
    setNewViewName('');
    toast.success(`Visão "${name}" salva.`);
  };

  const applySavedView = (view) => {
    const f = view.filters || {};
    setSearch(f.search || '');
    setStatusFilter(f.statusFilter || 'all');
    setResponsibleFilter(f.responsibleFilter || 'all');
    setLocationFilter(f.locationFilter || 'all');
    setUrgencyFilter(f.urgencyFilter || 'all');
    setDateFilters(f.dateFilters || {
      entry: { start: '', end: '' }, distribution: { start: '', end: '' }, analysis: { start: '', end: '' },
      review_submission: { start: '', end: '' }, reviewed: { start: '', end: '' }, review_return: { start: '', end: '' }, archived: { start: '', end: '' }
    });
    setTextFilters(f.textFilters || { matter_object: '', network_folder_path: '' });
    setIsAniversarianteFilter(!!f.isAniversarianteFilter);
    toast.success(`Visão "${view.name}" aplicada.`);
  };

  const removeSavedView = (id) => {
    updatePreferences({ savedProcessViews: savedViews.filter(v => v.id !== id) });
  };

  // ═══════════════════════════════════════════════════════════════════
  // AÇÕES EM MASSA (flag `bulk_actions`)
  // ═══════════════════════════════════════════════════════════════════
  const allPageSelected = paginatedProcesses.length > 0 && paginatedProcesses.every(p => selectedIds.has(p.id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedProcesses.forEach(p => next.delete(p.id));
      } else {
        paginatedProcesses.forEach(p => next.add(p.id));
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

  const selectedProcessObjects = useMemo(
    () => filteredAndSortedProcesses.filter(p => selectedIds.has(p.id)),
    [filteredAndSortedProcesses, selectedIds]
  );

  const handleBulkArchive = async () => {
    const toArchive = selectedProcessObjects.filter(p => !p.archived_date);
    if (toArchive.length === 0) {
      toast.info('Nenhum processo selecionado pode ser arquivado.');
      return;
    }
    const confirmed = window.confirm(`Arquivar ${toArchive.length} processo(s) selecionado(s)?`);
    if (!confirmed) return;

    const results = await Promise.allSettled(toArchive.map((process) => onBulkArchive(process)));
    const failed = results.filter((r) => r.status === 'rejected');
    const succeeded = results.length - failed.length;

    if (succeeded > 0) {
      toast.success(`${succeeded} processo(s) arquivado(s).`);
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} processo(s) não puderam ser arquivados.`);
    }
    clearSelection();
  };

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAÇÃO (flag `export_pdf_excel`)
  // ═══════════════════════════════════════════════════════════════════
  const DATE_EXPORT_KEYS = new Set(['entry_date', 'distribution_date', 'analysis_start_date', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date']);

  const getExportValue = (col, process) => {
    if (col.key === 'status') return calculateDerivedStatus(process);
    if (col.key === 'stage_time') {
      const status = calculateDerivedStatus(process);
      const days = getDaysInCurrentStage(process, status, getProcessField);
      return days == null ? '' : `${days}d`;
    }
    if (col.key === 'matter_category') {
      const cat = getProcessField(process, 'matter_category');
      const sub = getProcessField(process, 'matter_subcategory');
      return [cat, sub].filter(Boolean).join(' / ');
    }
    if (col.key === 'access_restriction') {
      const val = getProcessField(process, 'access_restriction');
      return (val === true || String(val).toLowerCase().trim() === 'sim') ? 'Restrito' : 'Não';
    }
    if (DATE_EXPORT_KEYS.has(col.key)) return formatDate(getProcessField(process, col.key));
    return getProcessField(process, col.key) ?? '';
  };

  const handleExport = async (kind) => {
    const rows = selectedIds.size > 0 ? selectedProcessObjects : filteredAndSortedProcesses;
    if (rows.length === 0) {
      toast.info('Nenhum processo para exportar.');
      return;
    }
    const columns = activeColumns.map(col => ({ label: col.label, value: (p) => getExportValue(col, p) }));
    const filenameBase = `consultas-${new Date().toISOString().slice(0, 10)}`;
    // Import sob demanda: xlsx/jsPDF são pesadas (~centenas de KB) e só devem
    // ser baixadas por quem realmente exporta, não incluídas no bundle principal.
    const { exportRowsToExcel, exportRowsToPdf } = await import('@/lib/tableExport');
    if (kind === 'excel') {
      exportRowsToExcel({ rows, columns, filenameBase });
    } else {
      exportRowsToPdf({ rows, columns, filenameBase, title: 'Consultas' });
    }
    toast.success(`Exportação de ${rows.length} processo(s) iniciada.`);

    if (isAccessAuditLogOn && organization?.id) {
      logAccess({
        organizationId: organization.id,
        entityType: 'process',
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
              placeholder="Buscar por número, consulente ou cidade..."
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
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Urgência</label>
                      <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Qualquer" />
                        </SelectTrigger>
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

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Local / Cidade</label>
                      <Input
                        placeholder="Filtrar cidade..."
                        value={locationFilter === "all" ? "" : locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value || "all")}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Filtros de Datas</label>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                      {[
                        { label: 'Entrada no CAO', key: 'entry' },
                        { label: 'Distribuição', key: 'distribution' },
                        { label: 'Início da Análise', key: 'analysis' },
                        { label: 'Remessa p/ Revisão', key: 'review_submission' },
                        { label: 'Revisão Concluída', key: 'reviewed' },
                        { label: 'Retorno da Revisão', key: 'review_return' },
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
              ) : paginatedProcesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeColumns.length + 1 + (isBulkActionsOn ? 1 : 0)} className="py-20">
                    <EmptyState
                      icon={search ? SearchX : FileX2}
                      title={search ? "Nenhum processo encontrado" : "Nenhum processo cadastrado"}
                      description={search
                        ? `Não encontramos resultados para "${search}". Verifique a ortografia ou tente outros termos.`
                        : "Esta organização ainda não possui processos registrados."}
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
                paginatedProcesses.map((process) => {
                  const colors = getStatusRowColor(process);

                  const cellPadding = density === 'compact' ? 'py-1' : 'py-3';

                  return (
                    <TableRow
                      key={process.id}
                      className={`${colors.bg} ${colors.hover} ${colors.border} transition-all duration-150 group cursor-pointer border-b-[1.5px]`}
                      onClick={() => setSelectedProcess(process)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedProcess(process);
                        }
                      }}
                    >
                      {isBulkActionsOn && (
                        <TableCell className={cellPadding} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(process.id)}
                            onCheckedChange={() => toggleSelectOne(process.id)}
                            aria-label={`Selecionar processo ${getProcessField(process, 'process_number') || ''}`}
                          />
                        </TableCell>
                      )}
                      {activeColumns.map(col => {
                        const isStickyLeft = col.sticky === 'left';
                        const isFirstCol = col.key === 'process_number';

                        return (
                          <TableCell
                            key={col.key}
                            className={`${cellPadding} transition-colors ${isStickyLeft ? `sticky left-0 z-10 ${colors.bg} border-r ${colors.groupHover}` : ''} ${isFirstCol ? `border-l-[4px] ${colors.accent}` : ''} ${col.align === 'center' ? 'text-center' : ''}`}
                          >
                            {col.render(process)}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`text-center sticky right-0 z-10 ${colors.bg} border-l ${colors.groupHover} transition-colors`}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black/5"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:ring-1 dark:ring-white/10 dark:shadow-2xl">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(process); }}><Pencil className="w-4 h-4 mr-2 text-slate-500" />Editar</DropdownMenuItem>
                            {!process.archived_date && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onArchive(process); }}
                                    className="text-rose-600 focus:text-rose-600"
                                  >
                                    <Archive className="w-4 h-4 mr-2" />Arquivar
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left">Move o processo para a aba de arquivados</TooltipContent>
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

      <ProcessDetailSheet
        process={selectedProcess}
        open={!!selectedProcess}
        onClose={() => setSelectedProcess(null)}
        onEdit={onEdit}
        getProcessField={getProcessField}
      />

      {filteredAndSortedProcesses.length > 0 && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] z-20">
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedProcesses.length)} de {filteredAndSortedProcesses.length} processos</p>
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