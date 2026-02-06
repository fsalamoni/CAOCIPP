import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, Filter, Upload } from 'lucide-react';
import { toast } from 'sonner';
import ImportProgressModal from './ImportProgressModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreateProcessButton from './CreateProcessButton';
import EditProcessDialog from './EditProcessDialog';
import ProcessStatusBadge from './ProcessStatusBadge';
import { format } from 'date-fns';

export default function ProcessControl({ organization, members, processes }) {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId || !importModalOpen || importComplete) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${window.location.origin}/api/functions/getImportProgress?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setImportProgress(data);
        }
      } catch (error) {
        console.error('Erro ao buscar progresso:', error);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [sessionId, importModalOpen, importComplete]);

  const handleProcessCreated = () => {
    queryClient.invalidateQueries(['organization-processes']);
    queryClient.invalidateQueries(['dashboard-processes']);
  };

  const handleEdit = (process) => {
    setSelectedProcess(process);
    setEditOpen(true);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv|json)$/i)) {
      toast.error('Selecione arquivo Excel (.xlsx, .xls), CSV ou JSON');
      event.target.value = '';
      return;
    }

    try {
      setImportModalOpen(true);
      setImportComplete(false);
      setImportProgress({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });

      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      const response = await base44.functions.invoke('importProcessesBatch', {
        file_url: uploadResult.file_url,
        organization_id: organization.id,
        batch_size: batchSize
      });

      const data = response.data;
      setSessionId(data.sessionId);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setImportStats({
        created: data.created,
        updated: data.updated,
        total: data.total,
        totalErrors: data.totalErrors
      });
      
      setImportProgress({
        current: data.total,
        total: data.total,
        created: data.created,
        updated: data.updated,
        errors: data.totalErrors
      });
      
      setImportComplete(true);
      
      queryClient.invalidateQueries(['organization-processes']);
      queryClient.invalidateQueries(['dashboard-processes']);
      
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Erro na importação');
      setImportModalOpen(false);
    } finally {
      event.target.value = '';
    }
  };

  // Filtrar processos
  const filteredProcesses = processes.filter(process => {
    const matchesSearch = 
      process.process_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      process.consultant?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'null') {
      matchesStatus = !process.status;
    } else {
      matchesStatus = process.status === statusFilter;
    }

    const matchesResponsible = responsibleFilter === 'all' || process.responsible_user_id === responsibleFilter;

    return matchesSearch && matchesStatus && matchesResponsible;
  });

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por número ou consulente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Tamanho lote:</label>
            <Input
              type="number"
              min="5"
              max="100"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 30)}
              className="w-20"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="null">Sem Status</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em elaboração">Em elaboração</SelectItem>
                      <SelectItem value="Em revisão">Em revisão</SelectItem>
                      <SelectItem value="Para revisão">Para revisão</SelectItem>
                      <SelectItem value="Na pasta">Na pasta</SelectItem>
                    </SelectContent>
                  </Select>

          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Responsáveis</SelectItem>
              {members.map(member => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.user_name}
                </SelectItem>
              ))}
              <SelectItem value="null">Não atribuído</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <label htmlFor="excel-upload">
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => document.getElementById('excel-upload').click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Importando...' : 'Importar'}
            </Button>
          </label>
          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <CreateProcessButton
            organization={organization}
            members={members}
            onSuccess={handleProcessCreated}
          />
        </div>
      </div>

      {/* Processes Table */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-32">Nº Processo</TableHead>
                  <TableHead>Consulente</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Data Entrada</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      {searchTerm || statusFilter !== 'all' || responsibleFilter !== 'all' 
                        ? 'Nenhum processo encontrado com os filtros aplicados' 
                        : 'Nenhum processo cadastrado. Clique em "Adicionar Processo" para começar.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcesses.map(process => (
                    <TableRow key={process.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-medium text-sm">
                        {process.process_number || '-'}
                        {process.urgency_request && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">
                            URGENTE
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{process.consultant || '-'}</TableCell>
                      <TableCell className="text-slate-600">{process.location || '-'}</TableCell>
                      <TableCell className="text-slate-600">
                        {(() => {
                          try {
                            if (!process.entry_date) return '-';
                            const date = new Date(process.entry_date);
                            if (isNaN(date.getTime())) return '-';
                            return format(date, 'dd/MM/yyyy');
                          } catch {
                            return '-';
                          }
                        })()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {process.responsible_user_name || (
                          <span className="text-slate-400 italic">Não atribuído</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProcessStatusBadge status={process.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(process)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Import Progress Modal */}
      <ImportProgressModal 
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportComplete(false);
        }}
        progress={importProgress}
        isComplete={importComplete}
        stats={importStats}
      />

      {/* Edit Dialog */}
      {selectedProcess && (
        <EditProcessDialog
          open={editOpen}
          setOpen={setEditOpen}
          process={selectedProcess}
          members={members}
          onSuccess={handleProcessCreated}
        />
      )}
    </div>
  );
}