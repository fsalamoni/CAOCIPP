import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import ImportProgressModal from './ImportProgressModal';
import { format } from 'date-fns';
import { statusConfig } from '@/config/processStatus';
import { importProcessesFromExcel } from '@/services/functionsService';
import { toast } from 'sonner';

export default function ProcessControl({
  organization,
  members,
  processes,
  userRole,
  userId,
  processesLoading,
  processesError
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');

  // Import state
  const [uploading, setUploading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState(null);

  const handleEdit = (process) => {
    setSelectedProcess(process);
    setEditOpen(true);
  };

  const handleProcessMutation = () => {
    // Refresh handled by hooks
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

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo: 5MB');
      event.target.value = '';
      return;
    }

    try {
      setImportModalOpen(true);
      setImportComplete(false);
      setImportProgress({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
      setUploading(true);

      const fileData = await fileToBase64(file);
      const result = await importProcessesFromExcel({ organizationId: organization.id, fileData });

      setImportStats({
        created: result.count || 0,
        updated: 0,
        total: result.count || 0,
        totalErrors: 0
      });

      setImportProgress({
        current: result.count || 0,
        total: result.count || 0,
        created: result.count || 0,
        updated: 0,
        errors: 0
      });

      setImportComplete(true);
      toast.success(result.message || `${result.count} processos importados`);

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Erro na importação');
      setImportModalOpen(false);
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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

    const matchesResponsible = responsibleFilter === 'all' ||
      process.responsible_user_id === responsibleFilter;

    return matchesSearch && matchesStatus && matchesResponsible;
  });

  const uniqueStatuses = Object.keys(statusConfig);

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Processos
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filteredProcesses.length} {filteredProcesses.length === 1 ? 'processo' : 'processos'}
            </p>
          </div>

          <div className="flex gap-2">
            {/* Import Button */}
            <label htmlFor="excel-upload">
              <Button
                type="button"
                variant="outline"
                disabled={uploading || processesLoading}
                onClick={() => document.getElementById('excel-upload').click()}
                className="cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Importando...' : 'Importar Planilha'}
              </Button>
            </label>
            <input
              id="excel-upload"
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Create Process Button */}
            <CreateProcessButton
              organization={organization}
              members={members}
              onSuccess={handleProcessMutation}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Buscar por número ou consulente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="null">Sem status</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por responsável" />
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
        </div>

        {/* Loading State */}
        {processesLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {processesError && (
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar processos: {processesError}
            </AlertDescription>
          </Alert>
        )}

        {/* Processes Table */}
        {!processesLoading && !processesError && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Consulente</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Data Entrada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Urgente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      {searchTerm || statusFilter !== 'all' || responsibleFilter !== 'all'
                        ? 'Nenhum processo encontrado com esses filtros'
                        : 'Nenhum processo cadastrado ainda'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcesses.map((process) => (
                    <TableRow
                      key={process.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => handleEdit(process)}
                    >
                      <TableCell className="font-medium">
                        {process.process_number}
                      </TableCell>
                      <TableCell>{process.consultant}</TableCell>
                      <TableCell>{process.location}</TableCell>
                      <TableCell>
                        {process.entry_date ? format(new Date(process.entry_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <ProcessStatusBadge status={process.status || 'Em triagem'} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {process.responsible_user_name || '-'}
                      </TableCell>
                      <TableCell>
                        {process.urgency_request && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            SIM
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(process);
                          }}
                        >
                          Ver/Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit Dialog */}
        {selectedProcess && (
          <EditProcessDialog
            open={editOpen}
            setOpen={setEditOpen}
            process={selectedProcess}
            members={members}
            organizationId={organization.id}
            onSuccess={handleProcessMutation}
          />
        )}

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
      </CardContent>
    </Card>
  );
}