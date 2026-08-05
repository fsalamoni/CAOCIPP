import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CreateParceriaDialog from './CreateParceriaDialog';
import EditParceriaDialog from './EditParceriaDialog';
import ParceriaTable from './ParceriaTable';
import ImportProgressModal from './ImportProgressModal';
import { importParceriasFromExcel } from '@/services/functionsService';
import { toast } from 'sonner';

/**
 * ParceriaControl — container do módulo de Parcerias (lista + import + criar).
 * Espelha ExpedienteControl.jsx.
 */
export default function ParceriaControl({
    organization,
    members,
    parcerias,
    userRole,
    userId,
    parceriasLoading,
    parceriasError,
    initialFilter,
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [selectedParceria, setSelectedParceria] = useState(null);

    const [uploading, setUploading] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 });
    const [importComplete, setImportComplete] = useState(false);
    const [importStats, setImportStats] = useState(null);

    const handleEdit = (p) => {
        setSelectedParceria(p);
        setEditOpen(true);
    };

    const orgIdRef = useRef(organization?.id);
    useEffect(() => {
        if (orgIdRef.current === organization?.id) return;
        orgIdRef.current = organization?.id;
        setEditOpen(false);
        setSelectedParceria(null);
    }, [organization?.id]);

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const validTypes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/json',
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
            const result = await importParceriasFromExcel({ organizationId: organization.id, fileData });
            const res = result;
            setImportStats({
                created: res?.created || 0,
                updated: res?.updated || 0,
                total: res?.total || 0,
                totalErrors: res?.errors || 0,
            });
            setImportProgress({
                current: res?.total || 0,
                total: res?.total || 0,
                created: res?.created || 0,
                updated: res?.updated || 0,
                errors: res?.errors || 0,
            });
            setImportComplete(true);
            if (res?.errors > 0 && res?.errorDetails && res?.errorDetails.length > 0) {
                const errorSummary = res.errorDetails.slice(0, 5).map((err) =>
                    `Linha ${err.row} (PGEA ${err.pgea}): ${err.error}`
                ).join('\n');
                const moreErrors = res.errors > 5 ? `\n... e mais ${res.errors - 5} erros` : '';
                toast.error(`${res.message}\n\nErros:\n${errorSummary}${moreErrors}`, { duration: 10000 });
            } else {
                toast.success(res?.message || `Sucesso! ${res?.created} criadas, ${res?.updated} atualizadas`);
            }
        } catch (error) {
            console.error('[ParceriaControl] Import error:', error);
            toast.error('Erro na importação: ' + error.message, { duration: 8000 });
            setImportModalOpen(false);
            setImportComplete(false);
        } finally {
            event.target.value = '';
            setUploading(false);
        }
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const r = reader.result;
            if (typeof r === 'string') resolve(r.split(',')[1]);
            else reject(new Error('Failed to read file'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    return (
        <Card>
            <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Parcerias
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {parcerias.length} {parcerias.length === 1 ? 'parceria' : 'parcerias'} cadastradas
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <label htmlFor="parceria-excel-upload" className="cursor-pointer">
                            <Button asChild variant="outline" disabled={uploading || parceriasLoading}>
                                <span>
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploading ? 'Importando...' : 'Importar Planilha'}
                                </span>
                            </Button>
                            <input
                                id="parceria-excel-upload"
                                type="file"
                                accept=".xlsx,.xls,.csv,.json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Parceria
                        </Button>
                    </div>
                </div>

                {parceriasLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}

                {parceriasError && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            Erro ao carregar Parcerias: {parceriasError}
                        </AlertDescription>
                    </Alert>
                )}

                {!parceriasError && (
                    <ParceriaTable
                        parcerias={parcerias}
                        members={members}
                        userId={userId}
                        isLoading={parceriasLoading}
                        onEdit={handleEdit}
                        initialFilter={initialFilter}
                        organization={organization}
                    />
                )}

                <CreateParceriaDialog
                    open={createOpen}
                    setOpen={setCreateOpen}
                    organization={organization}
                    onSuccess={() => setCreateOpen(false)}
                />

                {selectedParceria && editOpen && (
                    <EditParceriaDialog
                        open={editOpen}
                        setOpen={setEditOpen}
                        parceria={selectedParceria}
                        members={members}
                        organizationId={organization.id}
                        organization={organization}
                        userRole={userRole}
                        onSuccess={() => {
                            setEditOpen(false);
                            setSelectedParceria(null);
                        }}
                    />
                )}

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
