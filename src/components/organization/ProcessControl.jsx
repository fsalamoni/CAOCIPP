import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CreateProcessButton from './CreateProcessButton';
import EditProcessDialog from './EditProcessDialog';
import ProcessTable from './ProcessTable';
import ImportProgressModal from './ImportProgressModal';
import { importProcessesFromExcel, archiveProcess } from '@/services/functionsService';
import { toast } from 'sonner';

export default function ProcessControl({
  organization,
  members,
  processes,
  userRole,
  userId,
  processesLoading,
  processesError,
  initialFilter
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);

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

  const handleArchive = async (process) => {
    if (!window.confirm(`Deseja realmente arquivar o processo ${process.process_number}?`)) return;

    try {
      await archiveProcess(process.id);
      toast.success('Processo arquivado com sucesso!');
    } catch (error) {
      toast.error('Erro ao arquivar processo: ' + error.message);
    }
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

      /** @type {any} */
      const res = result;

      // Update stats with detailed results
      setImportStats({
        created: res?.created || 0,
        updated: res?.updated || 0,
        total: res?.total || 0,
        totalErrors: res?.errors || 0
      });

      setImportProgress({
        current: res?.total || 0,
        total: res?.total || 0,
        created: res?.created || 0,
        updated: res?.updated || 0,
        errors: res?.errors || 0
      });

      setImportComplete(true);

      // Show detailed success/error message
      if (res?.errors > 0 && res?.errorDetails && res?.errorDetails.length > 0) {
        // Show errors details
        const errorSummary = res.errorDetails.slice(0, 5).map((err) =>
          `Linha ${err.row} (Processo ${err.processNumber}): ${err.error}`
        ).join('\n');

        const moreErrors = res.errors > 5 ? `\n... e mais ${res.errors - 5} erros` : '';

        toast.error(
          `${res.message}\n\nErros encontrados:\n${errorSummary}${moreErrors}`,
          { duration: 10000 }
        );
      } else {
        toast.success(res?.message || `Sucesso! ${res?.created} criados, ${res?.updated} atualizados`);
      }

    } catch (error) {
      console.error('[ProcessControl] Import error:', error);

      let errorMessage = 'Erro na importação';
      const err = /** @type {any} */ (error);

      if (err.code === 'functions/unauthenticated') {
        errorMessage = 'Você precisa estar autenticado para importar processos';
      } else if (err.code === 'functions/permission-denied') {
        errorMessage = err.message || 'Você não tem permissão para importar processos nesta organização';
      } else if (err.code === 'functions/invalid-argument') {
        errorMessage = err.message || 'Arquivo inválido ou campos obrigatórios faltando';
      } else if (err.code === 'functions/internal') {
        errorMessage = err.message || 'Erro interno do servidor ao processar a importação';
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage, { duration: 8000 });
      setImportModalOpen(false);
      setImportComplete(false);
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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
              {processes.length} {processes.length === 1 ? 'processo' : 'processos'} cadastrados
            </p>
          </div>

          <div className="flex gap-2">
            <label htmlFor="excel-upload" className="cursor-pointer">
              <Button
                asChild
                variant="outline"
                disabled={uploading || processesLoading}
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'Importando...' : 'Importar Planilha'}
                </span>
              </Button>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <CreateProcessButton
              organization={organization}
              members={members}
              onSuccess={handleProcessMutation}
            />
          </div>
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
        {!processesError && (
          <ProcessTable
            processes={processes}
            members={members}
            userId={userId}
            isLoading={processesLoading}
            onEdit={handleEdit}
            onArchive={handleArchive}
            initialFilter={initialFilter}
          />
        )}

        {/* Edit Dialog */}
        {selectedProcess && editOpen && (
          <EditProcessDialog
            open={editOpen}
            setOpen={setEditOpen}
            process={selectedProcess}
            members={members}
            organizationId={organization.id}
            userRole={userRole}
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