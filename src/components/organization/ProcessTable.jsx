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
import ProcessDetailSheet from "./ProcessDetailSheet";
import { Search, MoreHorizontal, Pencil, Archive, ArrowUpDown, Settings2, FileSearch, Columns3, Filter, FilterX, Clock } from "lucide-react";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { useUserPreferences } from "@/hooks/useFirestore";

export default function ProcessTable({
  processes,
  members,
  userId,
  isLoading,
  onEdit,
  onArchive,
  initialFilter
}) {
  // Defensive helper to ensure 100% data visibility across different field name variations
  // Mirrors the logic found in EditProcessDialog
  const getProcessField = (p, field) => {
    if (!p) return '';

    const aliases = {
      process_number: ['process_number', 'numero', 'n_processo', 'processo', 'PROCESSO SIM\n(NÚMERO)', 'PROCESSO SIM\\n(NÚMERO)'],
      consultant: ['consultant', 'consulente', 'cliente', 'interessado', 'CONSULENTE'],
      location: ['location', 'local', 'cidade', 'local_fatos', 'municipio', 'LOCAL DOS FATOS\n(CIDADE)', 'LOCAL DOS FATOS\\n(CIDADE)'],
      entry_date: ['entry_date', 'data_entrada', 'entrada', 'data', 'ENTRADA NO CAOPP\n(DATA)', 'ENTRADA NO CAOPP\\n(DATA)'],
      matter_object: ['matter_object', 'objeto', 'assunto', 'materia', 'descricao', 'MATÉRIA E OBJETO DA CONSULTA'],
      urgency_request: ['urgency_request', 'urgente', 'prioridade', 'PEDIDO DE URGÊNCIA', 'Solicitação de Urgência'],
      distribution_date: ['distribution_date', 'data_distribuicao', 'distribuicao', 'DISTRIBUIÇÃO\n(DATA)', 'DISTRIBUIÇÃO\\n(DATA)'],
      responsible_user_name: ['responsible_user_name', 'responsibleUserName', 'assessor', 'assessor_responsavel', 'responsavel'],
      analysis_start_date: ['analysis_start_date', 'inicio_analise', 'data_inicio', 'INÍCIO DA ANÁLISE\n(DATA)', 'INÍCIO DA ANÁLISE\\n(DATA)'],
      observations: ['observations', 'observacoes', 'notas', 'pontos_importantes', 'obs', 'OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'],
      review_submission_date: ['review_submission_date', 'remessa_revisao', 'data_revisao', 'remessa', 'REMESSA AO DR. PARA REVISÃO (DATA)'],
      review_return_date: ['review_return_date', 'devolucao_revisao', 'retorno_revisao', 'retorno', 'DEVOLUÇÃO APÓS REVISÃO\n(DATA)', 'DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)'],
      archived_date: ['archived_date', 'data_arquivamento', 'arquivamento', 'data_arquivo', 'NA PASTA\nARQUIVADO\n(DATA)', 'NA PASTA\\nARQUIVADO\\n(DATA)'],
      network_folder: ['network_folder', 'network_folder_path', 'pasta', 'pasta_rede', 'caminho', 'PASTA NA REDE'],
      status: ['status', 'situacao', 'estado'],
      access_restriction: ['access_restriction', 'restricao', 'restrito', 'sigilo', 'RESTRIÇÃO DE ACESSO']
    };

    const keysToTry = aliases[field] || [field];

    // 1. Direct match
    for (const key of keysToTry) {
      if (p[key] !== undefined && p[key] !== null && String(p[key]).trim() !== '') {
        return p[key];
      }
    }

    // 2. Normalized aggressive match
    const normalize = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedKeys = keysToTry.map(normalize);
    const pKeys = Object.keys(p);

    for (const pk of pKeys) {
      if (normalizedKeys.includes(normalize(pk))) {
        if (p[pk] !== undefined && p[pk] !== null && String(p[pk]).trim() !== '') {
          return p[pk];
        }
      }
    }

    return field === 'urgency_request' || field === 'access_restriction' ? false : '';
  };

  const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [dateFilters, setDateFilters] = useState({
    entry: { start: '', end: '' },
    distribution: { start: '', end: '' },
    analysis: { start: '', end: '' },
    review_submission: { start: '', end: '' },
    review_return: { start: '', end: '' },
    archived: { start: '', end: '' }
  });
  const [textFilters, setTextFilters] = useState({
    matter_object: '',
    network_folder_path: ''
  });
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [isAniversarianteFilter, setIsAniversarianteFilter] = useState(false);

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
            {isUrgent && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Urgente" />}
            <span className="font-medium">{getProcessField(process, 'process_number')}</span>
          </div>
        );
      }
    },
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
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'entry_date'))}</span>
    },
    {
      key: 'distribution_date', label: 'Distribuição', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'distribution_date'))}</span>
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
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'analysis_start_date'))}</span>
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
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'review_submission_date'))}</span>
    },
    {
      key: 'review_return_date', label: 'Devolução após Revisão', defaultVisible: false,
      width: 'w-[110px]', sortable: true,
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'review_return_date'))}</span>
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
      render: (process) => <span className="text-slate-600">{formatDate(getProcessField(process, 'archived_date'))}</span>
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
      render: (process) => <StatusBadge status={getProcessField(process, 'status')} variant="neutral" className="" />
    },
  ], []);

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

  const appliedPrefsRef = useRef(null);
  useEffect(() => {
    if (isLoadingPrefs) return;
    const prefsKey = JSON.stringify(preferences);
    if (appliedPrefsRef.current === prefsKey) return;

    if (preferences && typeof preferences === 'object') {
      const p = preferences;
      const sConf = p['sortConfig'];
      const iPage = p['itemsPerPage'];
      if (sConf) {
        setSortConfig(sConf);
        writeLocalPref('sortConfig', sConf);
      }
      if (iPage != null) {
        setItemsPerPage(Number(iPage) || 20);
        writeLocalPref('itemsPerPage', Number(iPage) || 20);
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
        updatePreferences({ sortConfig, currentPage, itemsPerPage });
      }, 500);
    }
    return () => clearTimeout(saveTimerRef.current);
  }, [sortConfig, currentPage, itemsPerPage, isInitialized, updatePreferences]);

  useEffect(() => {
    if (isInitialized) setCurrentPage(1);
  }, [search, statusFilter, responsibleFilter, locationFilter, urgencyFilter, dateFilters, textFilters]);

  const filteredAndSortedProcesses = useMemo(() => {
    let result = [...processes];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => {
        const num = String(getProcessField(p, 'process_number')).toLowerCase();
        const con = String(getProcessField(p, 'consultant')).toLowerCase();
        const loc = String(getProcessField(p, 'location')).toLowerCase();
        return num.includes(searchLower) || con.includes(searchLower) || loc.includes(searchLower);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter(p => getProcessField(p, 'status') === statusFilter);
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
        const fieldName = { entry: 'entry_date', distribution: 'distribution_date', analysis: 'analysis_start_date', review_submission: 'review_submission_date', review_return: 'review_return_date', archived: 'archived_date' }[key];
        result = result.filter(p => {
          const val = getProcessField(p, fieldName);
          if (!val) return false;
          const processDate = parseLocalDate(val);
          if (!isValid(processDate)) return false;
          if (start && !end) return processDate >= startOfDay(new Date(start)) && processDate <= endOfDay(new Date(start));
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

    const DATE_COLUMNS = new Set(['entry_date', 'distribution_date', 'analysis_start_date', 'review_submission_date', 'review_return_date', 'archived_date']);
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
    const status = getProcessField(process, 'status');
    const urgencyVal = getProcessField(process, 'urgency_request');
    const isUrgent = urgencyVal === true || String(urgencyVal).toLowerCase().trim() === 'sim';

    // Override: Urgent + Pending gets the red color
    if (isUrgent && (status === 'Pendente' || !status)) {
      return {
        bg: "bg-[#FF7979]",
        accent: "border-l-[#CC0000]",
        border: "border-b-[#E06666]",
        hover: "hover:bg-[#FF6060]",
        groupHover: "group-hover:!bg-[#FF6060]"
      };
    }

    switch (status) {
      case "Em revisão":
        return {
          bg: "bg-[#B6DDE8]",
          accent: "border-l-[#6FA8DC]",
          border: "border-b-[#9BBDC6]",
          hover: "hover:bg-[#A5C9D4]",
          groupHover: "group-hover:!bg-[#A5C9D4]"
        };
      case "Em elaboração":
        return {
          bg: "bg-[#FFFF99]",
          accent: "border-l-[#F1C232]",
          border: "border-b-[#E1E17F]",
          hover: "hover:bg-[#F0F08B]",
          groupHover: "group-hover:!bg-[#F0F08B]"
        };
      case "Para revisão":
        return {
          bg: "bg-[#B6DDE8]",
          accent: "border-l-[#6FA8DC]",
          border: "border-b-[#9BBDC6]",
          hover: "hover:bg-[#A5C9D4]",
          groupHover: "group-hover:!bg-[#A5C9D4]"
        };
      case "Na pasta":
        return {
          bg: "bg-[#D7E4BC]",
          accent: "border-l-[#93C47D]",
          border: "border-b-[#C2D0A5]",
          hover: "hover:bg-[#C9D6AF]",
          groupHover: "group-hover:!bg-[#C9D6AF]"
        };
      default:
        return {
          bg: "bg-white",
          accent: "border-l-slate-200",
          border: "border-b-slate-100",
          hover: "hover:bg-slate-50",
          groupHover: "group-hover:!bg-slate-50"
        };
    }
  };

  const statuses = ["Pendente", "Em elaboração", "Em revisão", "Para revisão", "Na pasta"];

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
              <PopoverContent align="end" className="w-64 p-3 shadow-xl border-slate-200">
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
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table style={{ minWidth: `${tableMinWidth}px` }}>
            <TableHeader>
              <TableRow className="bg-slate-50">
                {activeColumns.map(col => (
                  <TableHead key={col.key} className={`font-semibold ${col.width} ${col.sticky === 'left' ? 'sticky left-0 z-20 bg-slate-50 border-r' : ''} ${col.align === 'center' ? 'text-center' : ''}`}>
                    {col.sortable ? (
                      <Button variant="ghost" size="sm" onClick={() => handleSort(col.key)} className="-ml-2 h-8 font-semibold">
                        {col.label} <ArrowUpDown className={`w-3 h-3 ml-1 ${sortConfig.key === col.key ? 'text-indigo-600' : ''}`} />
                      </Button>
                    ) : col.label}
                  </TableHead>
                ))}
                <TableHead className="font-semibold text-center sticky right-0 z-20 bg-slate-50 border-l w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
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
                  <TableCell colSpan={activeColumns.length + 1} className="text-center py-16 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="bg-slate-50 p-4 rounded-full"><FileSearch className="w-10 h-10 text-slate-300" /></div>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-600">Nenhum processo encontrado</p>
                        <p className="text-sm text-slate-400">Tente ajustar seus filtros ou busca</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 text-indigo-600 border-indigo-100 hover:bg-indigo-50">Limpar Filtros</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProcesses.map((process) => {
                  const colors = getStatusRowColor(process);

                  return (
                    <TableRow
                      key={process.id}
                      className={`${colors.bg} ${colors.hover} ${colors.border} transition-all duration-150 group cursor-pointer border-b-[1.5px]`}
                      onClick={() => setSelectedProcess(process)}
                    >
                      {activeColumns.map(col => {
                        const isStickyLeft = col.sticky === 'left';
                        const isFirstCol = col.key === 'process_number';

                        return (
                          <TableCell
                            key={col.key}
                            className={`py-3 transition-colors ${isStickyLeft ? `sticky left-0 z-10 ${colors.bg} border-r ${colors.groupHover}` : ''} ${isFirstCol ? `border-l-[4px] ${colors.accent}` : ''} ${col.align === 'center' ? 'text-center' : ''}`}
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(process); }}><Pencil className="w-4 h-4 mr-2 text-slate-500" />Editar</DropdownMenuItem>
                            {!process.archived_date && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(process); }} className="text-rose-600"><Archive className="w-4 h-4 mr-2" />Arquivar</DropdownMenuItem>}
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
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
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