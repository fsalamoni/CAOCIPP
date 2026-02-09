import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { Search, MoreHorizontal, Pencil, Eye, Archive, ArrowUpDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProcessTable({
  processes,
  members,
  onEdit,
  onViewDetails,
  onArchive
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [dateFilters, setDateFilters] = useState({
    entry: '',
    distribution: '',
    analysis: '',
    review_submission: '',
    review_return: '',
    archived: ''
  });
  const [textFilters, setTextFilters] = useState({
    matter_object: '',
    network_folder_path: ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'entry_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const filteredAndSortedProcesses = useMemo(() => {
    let result = [...processes];

    // Search filter (number, consultant, location)
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p =>
        p.process_number?.toLowerCase().includes(searchLower) ||
        p.consultant?.toLowerCase().includes(searchLower) ||
        p.location?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    // Responsible filter
    if (responsibleFilter !== "all") {
      result = result.filter(p => p.responsible_user_id === responsibleFilter);
    }

    // Location filter
    if (locationFilter !== "all") {
      result = result.filter(p => p.location === locationFilter);
    }

    // Urgency filter
    if (urgencyFilter !== "all") {
      const isUrgent = urgencyFilter === "urgent";
      result = result.filter(p => !!p.urgency_request === isUrgent);
    }

    // Date filters
    Object.keys(dateFilters).forEach(key => {
      const filterDate = dateFilters[key];
      if (filterDate) {
        const fieldMap = {
          entry: 'entry_date',
          distribution: 'distribution_date',
          analysis: 'analysis_start_date',
          review_submission: 'review_submission_date',
          review_return: 'review_return_date',
          archived: 'archived_date'
        };
        const fieldName = fieldMap[key];
        result = result.filter(p => p[fieldName] === filterDate);
      }
    });

    // Text filters
    Object.keys(textFilters).forEach(key => {
      const filterText = textFilters[key]?.toLowerCase();
      if (filterText) {
        result = result.filter(p => p[key]?.toLowerCase().includes(filterText));
      }
    });

    // Sorting
    result.sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return result;
  }, [processes, search, statusFilter, responsibleFilter, sortConfig]);

  const paginatedProcesses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProcesses.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProcesses, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedProcesses.length / itemsPerPage);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
  };

  const statuses = ["Pendente", "Em elaboração", "Em revisão", "Para revisão", "Para assinatura", "Na pasta"];

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

            {/* Dates */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Data de Entrada</label>
              <Input
                type="date"
                value={dateFilters.entry}
                onChange={(e) => setDateFilters({ ...dateFilters, entry: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Data de Distribuição</label>
              <Input
                type="date"
                value={dateFilters.distribution}
                onChange={(e) => setDateFilters({ ...dateFilters, distribution: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Início da Análise</label>
              <Input
                type="date"
                value={dateFilters.analysis}
                onChange={(e) => setDateFilters({ ...dateFilters, analysis: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Remessa Revisão</label>
              <Input
                type="date"
                value={dateFilters.review_submission}
                onChange={(e) => setDateFilters({ ...dateFilters, review_submission: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Retorno Revisão</label>
              <Input
                type="date"
                value={dateFilters.review_return}
                onChange={(e) => setDateFilters({ ...dateFilters, review_return: e.target.value })}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Data de Arquivamento</label>
              <Input
                type="date"
                value={dateFilters.archived}
                onChange={(e) => setDateFilters({ ...dateFilters, archived: e.target.value })}
                className="h-9"
              />
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
                      {process.process_number}
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[200px]" title={process.consultant}>
                      {process.consultant}
                    </TableCell>
                    <TableCell className="max-w-[450px]">
                      <div className="line-clamp-2 text-xs leading-relaxed text-slate-700" title={process.matter_object}>
                        {process.matter_object || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[180px]" title={process.location}>
                      {process.location}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.entry_date)}</TableCell>
                    <TableCell className="text-center">
                      {process.urgency_request ? (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0 h-5 border-none bg-rose-500">SIM</Badge>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.distribution_date)}</TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[220px]" title={process.responsible_user_name}>
                      {process.responsible_user_name || '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.analysis_start_date)}</TableCell>
                    <TableCell className="max-w-[350px]">
                      <div className="line-clamp-2 text-xs text-slate-500" title={process.observations}>
                        {process.observations || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.review_submission_date)}</TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.review_return_date)}</TableCell>
                    <TableCell className="text-slate-600">
                      {process.access_restriction ? (
                        <span className="text-xs text-amber-600 font-medium">Restrito</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(process.archived_date)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="truncate text-[10px] text-blue-600 font-mono" title={process.network_folder || process.network_folder_path}>
                        {process.network_folder || process.network_folder_path || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <StatusBadge status={process.status} />
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
                          <DropdownMenuItem onClick={() => onViewDetails(process)}>
                            <Eye className="w-4 h-4 mr-2 text-slate-500" />
                            Ver Detalhes
                          </DropdownMenuItem>
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