import React, { useState } from 'react';
import { useEntityType, useRecords } from '@/hooks/useCustomEntities';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GenericRecordTable from './GenericRecordTable';
import GenericKanbanBoard from './GenericKanbanBoard';
import GenericSummary from './GenericSummary';
import GenericRecordForm from './GenericRecordForm';
import GenericRecordDetailSheet from './GenericRecordDetailSheet';
import SpreadsheetImportDialog from './SpreadsheetImportDialog';

/**
 * Orquestra a visualização de um tipo de entidade personalizado.
 * props:
 *   - mode: 'panel' | 'list' | 'summary'
 *   - entityTypeId, organizationId, members, userRole
 */
export default function CustomEntityView({ mode, entityTypeId, organizationId, members = [], userRole }) {
    const { entityType, isLoading: typeLoading } = useEntityType(entityTypeId);
    const { records, isLoading: recordsLoading } = useRecords(organizationId, entityTypeId);

    const [formOpen, setFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [detailRecord, setDetailRecord] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const canEdit = ['creator', 'admin', 'member'].includes(userRole);
    const canCreate = canEdit;
    const canDelete = ['creator', 'admin'].includes(userRole);

    const openCreate = () => { setEditingRecord(null); setFormOpen(true); };
    const openEdit = (rec) => { setEditingRecord(rec); setDetailOpen(false); setFormOpen(true); };
    const openDetail = (rec) => { setDetailRecord(rec); setDetailOpen(true); };

    if (typeLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
        );
    }
    if (!entityType) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                Esta página não está mais disponível.
            </div>
        );
    }

    // Mantém o registro de detalhe sincronizado com os dados em tempo real.
    const liveDetail = detailRecord ? records.find((r) => r.id === detailRecord.id) || detailRecord : null;

    return (
        <div>
            {canCreate && (
                <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                        <FileSpreadsheet className="h-4 w-4" /> Importar dados
                    </Button>
                </div>
            )}

            {mode === 'panel' && (
                <GenericKanbanBoard
                    entityType={entityType}
                    records={records}
                    isLoading={recordsLoading}
                    members={members}
                    canEdit={canEdit}
                    canCreate={canCreate}
                    onCreate={openCreate}
                    onOpen={openDetail}
                    onChanged={() => {}}
                />
            )}

            {mode === 'list' && (
                <GenericRecordTable
                    entityType={entityType}
                    records={records}
                    isLoading={recordsLoading}
                    members={members}
                    canCreate={canCreate}
                    onCreate={openCreate}
                    onOpen={openDetail}
                />
            )}

            {mode === 'summary' && (
                <GenericSummary
                    entityType={entityType}
                    records={records}
                    isLoading={recordsLoading}
                />
            )}

            <GenericRecordForm
                open={formOpen}
                onOpenChange={setFormOpen}
                organizationId={organizationId}
                entityType={entityType}
                record={editingRecord}
                members={members}
                onSaved={() => {}}
            />

            <GenericRecordDetailSheet
                open={detailOpen}
                onOpenChange={setDetailOpen}
                organizationId={organizationId}
                entityType={entityType}
                record={liveDetail}
                members={members}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={openEdit}
                onChanged={() => {}}
            />

            <SpreadsheetImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                mode="data"
                organizationId={organizationId}
                entityType={entityType}
                onImported={() => {}}
            />
        </div>
    );
}
