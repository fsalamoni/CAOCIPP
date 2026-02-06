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
  const [sortConfig, setSortConfig] = useState({ key: 'entry_date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredAndSortedProcesses = useMemo(() => {
    let result = [...processes];

    // Filtro de busca
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => 
        p.process_number?.toLowerCase().includes(searchLower) ||
        p.consultant?.toLowerCase().includes(searchLower) ||
        p.location?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro de status
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    // Filtro de responsável
    if (responsibleFilter !== "all") {
      result = result.filter(p => p.responsible_user_id === responsibleFilter);
    }

    // Ordenação
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

  const statuses = ["Em triagem", "Pendente", "Em elaboração", "Em revisão", "Para revisão", "Na pasta"];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-64">
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
            <SelectItem value="all">Todos</SelectItem>
            {members.map(member => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.user_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">
                <Button variant="ghost" size="sm" onClick={() => handleSort('process_number')}>
                  Processo <ArrowUpDown className="w-3 h-3 ml-1" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">Consulente</TableHead>
              <TableHead className="font-semibold">Local</TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" size="sm" onClick={() => handleSort('entry_date')}>
                  Entrada <ArrowUpDown className="w-3 h-3 ml-1" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">Responsável</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProcesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  Nenhum processo encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginatedProcesses.map((process) => (
                <TableRow key={process.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {process.process_number}
                      {process.urgency_request && (
                        <Badge variant="destructive" className="text-xs px-1.5">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Urgente
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{process.consultant}</TableCell>
                  <TableCell>{process.location}</TableCell>
                  <TableCell>{formatDate(process.entry_date)}</TableCell>
                  <TableCell>{process.responsible_user_name || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={process.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(process)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(process)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {!process.archived_date && (
                          <DropdownMenuItem onClick={() => onArchive(process)}>
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

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredAndSortedProcesses.length)} de {filteredAndSortedProcesses.length} processos
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}