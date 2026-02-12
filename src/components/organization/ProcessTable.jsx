import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { Search, MoreHorizontal, Pencil, Archive, ArrowUpDown, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserPreferences } from "@/hooks/useFirestore";

export default function ProcessTable({
  processes,
  members,
  onEdit,
  onArchive
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'entry_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    if (!isLoadingPrefs && !isInitialized) {
      if (preferences && typeof preferences === 'object') {
        const p = preferences;
        if (p.sortConfig) setSortConfig(p.sortConfig);
        // Note: we do NOT restore currentPage on reload, as users usually expect to start at page 1
        // unless they are navigating back. For now, let's keep it reset to 1 to avoid confusion if data changed.
        // However, user specifically asked for "configuration to remain", so we will restore it if valid.
        if (p.currentPage) setCurrentPage(Number(p.currentPage) || 1);
        if (p.itemsPerPage) setItemsPerPage(Number(p.itemsPerPage) || 20);
      }
      setIsInitialized(true);
    }
  }, [preferences, isInitialized, isLoadingPrefs]);

  // Save preferences when sort, page, or itemsPerPage change (debounced, flush on unmount)
  const saveTimerRef = useRef(null);
  const latestPrefsRef = useRef(null);

  useEffect(() => {
    if (isInitialized) {
      const prefsToSave = { sortConfig, currentPage, itemsPerPage };
      latestPrefsRef.current = prefsToSave;

      // Debounce: wait 300ms before saving to prevent excessive Firestore writes
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updatePreferences(prefsToSave);
        latestPrefsRef.current = null; // Mark as saved
        saveTimerRef.current = null;
      }, 300);
    }
    return () => {
      // CRITICAL: On unmount, FLUSH pending save instead of canceling it
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (latestPrefsRef.current) {
        updatePreferences(latestPrefsRef.current);
        latestPrefsRef.current = null;
      }
    };
  }, [sortConfig, currentPage, itemsPerPage, isInitialized, updatePreferences]);

  // Reset to page 1 when any filter changes
  // We exclude sortConfig from this to allow persistence of page and sort simultaneously
  useEffect(() => {
    if (isInitialized) {
      setCurrentPage(1);
    }
  }, [search, statusFilter, responsibleFilter, locationFilter, urgencyFilter, dateFilters, textFilters]);

  const filteredAndSortedProcesses = useMemo(() => {
    let result = [...processes];

    // Search filter (number, consultant, location)
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => {
        const num = String(getProcessField(p, 'process_number')).toLowerCase();
        const con = String(getProcessField(p, 'consultant')).toLowerCase();
        const loc = String(getProcessField(p, 'location')).toLowerCase();
        return num.includes(searchLower) || con.includes(searchLower) || loc.includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(p => getProcessField(p, 'status') === statusFilter);
    }

    // Responsible filter
    if (responsibleFilter !== "all") {
      result = result.filter(p => p.responsible_user_id === responsibleFilter);
    }

    // Location filter
    if (locationFilter !== "all") {
      const locLower = locationFilter.toLowerCase();
      result = result.filter(p => String(getProcessField(p, 'location')).toLowerCase().includes(locLower));
    }

    // Urgency filter
    if (urgencyFilter !== "all") {
      const isUrgent = urgencyFilter === "urgent";
      result = result.filter(p => {
        const val = getProcessField(p, 'urgency_request');
        const isTrue = val === true || String(val).toLowerCase().trim() === 'sim';
        return isTrue === isUrgent;
      });
    }

    // Date filters (De/Até)
    Object.keys(dateFilters).forEach(key => {
      const { start, end } = dateFilters[key];
      if (start || end) {
        const fieldMap = {
          entry: 'entry_date',
          distribution: 'distribution_date',
          analysis: 'analysis_start_date',
          review_submission: 'review_submission_date',
          review_return: 'review_return_date',
          archived: 'archived_date'
        };
        const fieldName = fieldMap[key];

        result = result.filter(p => {
          const val = getProcessField(p, fieldName);
          if (!val) return false;

          const processDate = new Date(val);
          if (!isValid(processDate)) return false;

          // Case 1: Only start or start == end -> exact day
          if ((start && !end) || (start && end && start === end)) {
            const startD = new Date(start);
            if (!isValid(startD)) return false;
            const s = startOfDay(startD);
            const e = endOfDay(startD);
            return processDate >= s && processDate <= e;
          }
          // Case 2: Only end
          if (!start && end) {
            const endD = new Date(end);
            if (!isValid(endD)) return false;
            return processDate <= endOfDay(endD);
          }
          // Case 3: Range
          if (start && end) {
            const startD = new Date(start);
            const endD = new Date(end);
            if (!isValid(startD) || !isValid(endD)) return false;
            return processDate >= startOfDay(startD) &&
              processDate <= endOfDay(endD);
          }
          return true;
        });
      }
    });

    // Text filters
    Object.keys(textFilters).forEach(key => {
      const filterText = textFilters[key]?.toLowerCase();
      if (filterText) {
        const fieldName = key === 'network_folder_path' ? 'network_folder' : key;
        result = result.filter(p => String(getProcessField(p, fieldName)).toLowerCase().includes(filterText));
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // DEFINITIVE SORTING SYSTEM — Type-aware, direction-aware, null-safe
    // ═══════════════════════════════════════════════════════════════════

    // Column type registry: which columns contain dates
    const DATE_COLUMNS = new Set([
      'entry_date',
      'distribution_date',
      'analysis_start_date',
      'review_submission_date',
      'review_return_date',
      'archived_date',
    ]);

    // Universal date parser: converts any date representation to a numeric timestamp
    // Handles: Firestore Timestamps, Date objects, ISO strings, dd/mm/yyyy strings
    const parseDateToTimestamp = (value) => {
      if (value === null || value === undefined || value === '') return null;

      // Firestore Timestamp object { seconds, nanoseconds }
      if (typeof value === 'object' && value.seconds !== undefined) {
        return value.seconds * 1000;
      }

      // Already a Date object
      if (value instanceof Date) {
        const t = value.getTime();
        return isNaN(t) ? null : t;
      }

      // String date
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return null;

        // Try direct parse first (handles ISO 8601 and many formats)
        const directParse = new Date(trimmed);
        if (!isNaN(directParse.getTime())) {
          return directParse.getTime();
        }

        // Try dd/mm/yyyy format (common in Brazilian data)
        const brMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (brMatch) {
          const [, day, month, year] = brMatch;
          const parsed = new Date(Number(year), Number(month) - 1, Number(day));
          if (!isNaN(parsed.getTime())) {
            return parsed.getTime();
          }
        }

        return null;
      }

      // Numeric value (epoch)
      if (typeof value === 'number') {
        return isNaN(value) ? null : value;
      }

      return null;
    };

    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

    result.sort((a, b) => {
      const aRaw = getProcessField(a, sortConfig.key);
      const bRaw = getProcessField(b, sortConfig.key);

      // ── Unified null/empty handling ──
      // Missing values ALWAYS go to the bottom, regardless of sort direction
      const aEmpty = (aRaw === null || aRaw === undefined || String(aRaw).trim() === '');
      const bEmpty = (bRaw === null || bRaw === undefined || String(bRaw).trim() === '');

      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;   // a missing → push to bottom
      if (bEmpty) return -1;  // b missing → push to bottom

      let comparison = 0;

      // ── Date columns: compare as timestamps ──
      if (DATE_COLUMNS.has(sortConfig.key)) {
        const aTime = parseDateToTimestamp(aRaw);
        const bTime = parseDateToTimestamp(bRaw);

        // If parsing failed, treat as missing (push to bottom)
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;

        comparison = aTime - bTime;
      }
      // ── Process number: natural alphanumeric sort ──
      else if (sortConfig.key === 'process_number') {
        comparison = collator.compare(String(aRaw), String(bRaw));
      }
      // ── All other columns: string comparison with locale ──
      else {
        comparison = String(aRaw).localeCompare(String(bRaw), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [processes, search, statusFilter, responsibleFilter, locationFilter, urgencyFilter, dateFilters, textFilters, sortConfig]);

  const paginatedProcesses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProcesses.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProcesses, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProcesses.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Check if it's already a Date object
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr);

    if (!isValid(date)) return 'Data Inválida';

    try {
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return 'Erro Data';
    }
  };

  // Refined status list (removed "Para assinatura" as per request)
  const statuses = ["Pendente", "Em elaboração", "Em revisão", "Para revisão", "Na pasta"];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por número, consulente ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
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
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {members.map(member => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.user_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-slate-600 hover:text-slate-900"
          >
            {showAdvanced ? "Ocultar Filtros" : "Mais Filtros"}
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Urgency */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Urgência</label>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Local / Cidade</label>
              <Input
                placeholder="Filtrar cidade..."
                value={locationFilter === "all" ? "" : locationFilter}
                onChange={(e) => setLocationFilter(e.target.value || "all")}
                className="h-9"
              />
            </div>

            {/* Matter/Object */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Objeto da Consulta</label>
              <Input
                placeholder="Filtrar objeto..."
                value={textFilters.matter_object}
                onChange={(e) => setTextFilters({ ...textFilters, matter_object: e.target.value })}
                className="h-9"
              />
            </div>

            {/* Network Path */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Pasta na Rede</label>
              <Input
                placeholder="Filtrar pasta..."
                value={textFilters.network_folder_path}
                onChange={(e) => setTextFilters({ ...textFilters, network_folder_path: e.target.value })}
                className="h-9"
              />
            </div>

            {/* Dates Grid */}
            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              {[
                { label: 'Data de Entrada', key: 'entry' },
                { label: 'Data de Distribuição', key: 'distribution' },
                { label: 'Início da Análise', key: 'analysis' },
                { label: 'Remessa Revisão', key: 'review_submission' },
                { label: 'Retorno Revisão', key: 'review_return' },
                { label: 'Data de Arquivamento', key: 'archived' }
              ].map(({ label, key }) => (
                <div key={key} className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={dateFilters[key].start}
                      onChange={(e) => setDateFilters({
                        ...dateFilters,
                        [key]: { ...dateFilters[key], start: e.target.value }
                      })}
                      className="h-9 text-xs transition-colors hover:border-slate-300 focus:border-blue-400"
                    />
                    <span className="text-slate-400 text-[9px] font-bold uppercase">até</span>
                    <Input
                      type="date"
                      value={dateFilters[key].end}
                      onChange={(e) => setDateFilters({
                        ...dateFilters,
                        [key]: { ...dateFilters[key], end: e.target.value }
                      })}
                      className="h-9 text-xs transition-colors hover:border-slate-300 focus:border-blue-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabela com Scroll Horizontal */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[2800px]">
            <TableHeader>
              <TableRow className="bg-slate-50">
                {/* Coluna Fixa à Esquerda */}
                <TableHead className="font-semibold sticky left-0 z-20 bg-slate-50 border-r w-[200px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('process_number')} className="-ml-2 h-8 font-semibold">
                    Processo <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[200px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('consultant')} className="-ml-2 h-8 font-semibold">
                    Consulente <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[450px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('matter_object')} className="-ml-2 h-8 font-semibold">
                    Objeto da Consulta <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[180px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('location')} className="-ml-2 h-8 font-semibold">
                    Local dos Fatos <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('entry_date')} className="-ml-2 h-8 font-semibold">
                    Entrada <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[120px] text-center">Urgência</TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('distribution_date')} className="-ml-2 h-8 font-semibold">
                    Distribuição <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[220px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('responsible_user_name')} className="-ml-2 h-8 font-semibold">
                    Assessor Responsável <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('analysis_start_date')} className="-ml-2 h-8 font-semibold">
                    Início Análise <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[350px]">Observações</TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('review_submission_date')} className="-ml-2 h-8 font-semibold">
                    Para Revisão <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('review_return_date')} className="-ml-2 h-8 font-semibold">
                    Retorno Rev. <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[140px]">Restrição</TableHead>
                <TableHead className="font-semibold w-[140px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('archived_date')} className="-ml-2 h-8 font-semibold">
                    Arquivado em <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[280px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('network_folder_path')} className="-ml-2 h-8 font-semibold">
                    Pasta na Rede <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold w-[180px]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="-ml-2 h-8 font-semibold">
                    Status do Processo <ArrowUpDown className="w-3 h-3 ml-1" />
                  </Button>
                </TableHead>
                {/* Coluna Fixa à Direita */}
                <TableHead className="font-semibold text-center sticky right-0 z-20 bg-slate-50 border-l w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProcesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-12 text-slate-500">
                    Nenhum processo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProcesses.map((process) => (
                  <TableRow key={process.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Coluna Fixa: Processo */}
                    <TableCell className="font-medium sticky left-0 z-10 bg-white border-r group-hover:bg-slate-50 transition-colors">
                      {getProcessField(process, 'process_number')}
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[200px]" title={String(getProcessField(process, 'consultant'))}>
                      {getProcessField(process, 'consultant')}
                    </TableCell>
                    <TableCell className="max-w-[450px]">
                      <div className="line-clamp-2 text-xs leading-relaxed text-slate-700" title={String(getProcessField(process, 'matter_object'))}>
                        {getProcessField(process, 'matter_object') || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[180px]" title={String(getProcessField(process, 'location'))}>
                      {getProcessField(process, 'location')}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'entry_date'))}</TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const val = getProcessField(process, 'urgency_request');
                        return (val === true || String(val).toLowerCase().trim() === 'sim') ? (
                          <Badge variant="destructive" className="text-[10px] px-2 py-0 h-5 border-none bg-rose-500">SIM</Badge>
                        ) : (
                          <span className="text-slate-300">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'distribution_date'))}</TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[220px]" title={String(getProcessField(process, 'responsible_user_name'))}>
                      {getProcessField(process, 'responsible_user_name') || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'analysis_start_date'))}</TableCell>
                    <TableCell className="max-w-[350px]">
                      <div className="line-clamp-2 text-xs text-slate-500" title={String(getProcessField(process, 'observations'))}>
                        {getProcessField(process, 'observations') || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'review_submission_date'))}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'review_return_date'))}</TableCell>
                    <TableCell className="text-slate-600">
                      {(() => {
                        const val = getProcessField(process, 'access_restriction');
                        return (val === true || String(val).toLowerCase().trim() === 'sim') ? (
                          <span className="text-xs text-amber-600 font-medium">Restrito</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(getProcessField(process, 'archived_date'))}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate text-[10px] text-blue-600 font-mono" title={String(getProcessField(process, 'network_folder'))}>
                        {getProcessField(process, 'network_folder') || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <StatusBadge status={getProcessField(process, 'status')} />
                    </TableCell>
                    {/* Coluna Fixa: Ações */}
                    <TableCell className="text-center sticky right-0 z-10 bg-white border-l group-hover:bg-slate-50 transition-colors">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-200">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onEdit(process)}>
                            <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                            Editar
                          </DropdownMenuItem>
                          {!process.archived_date && (
                            <DropdownMenuItem onClick={() => onArchive(process)} className="text-rose-600">
                              <Archive className="w-4 h-4 mr-2" />
                              Arquivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Paginação */}
      {filteredAndSortedProcesses.length > 0 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedProcesses.length)} de {filteredAndSortedProcesses.length} processos
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Exibir:</label>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}