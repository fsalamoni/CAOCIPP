import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, LayoutGrid, ChevronUp, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useEntityTypes } from '@/hooks/useCustomEntities';
import { useOrganizationMembers } from '@/hooks/useFirestore';
import { deleteEntityType, upsertEntityType } from '@/services/customEntitiesService';
import EntityTypeBuilder from '@/components/organization/custom/EntityTypeBuilder';
import SpreadsheetImportDialog from '@/components/organization/custom/SpreadsheetImportDialog';

/**
 * Lista e gerencia as páginas personalizadas (tipos de entidade) do órgão.
 * props: organization
 */
export default function EntityTypesManager({ organization }) {
    const organizationId = organization?.id;
    const { entityTypes, isLoading } = useEntityTypes(organizationId);
    const { members } = useOrganizationMembers(organizationId);
    const [builderOpen, setBuilderOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importedFields, setImportedFields] = useState(null);
    const [builderNonce, setBuilderNonce] = useState(0);

    const openCreate = () => { setEditing(null); setImportedFields(null); setBuilderNonce((n) => n + 1); setBuilderOpen(true); };
    const openEdit = (et) => { setEditing(et); setImportedFields(null); setBuilderNonce((n) => n + 1); setBuilderOpen(true); };
    const handleStructureReady = (fields) => { setEditing(null); setImportedFields(fields); setBuilderNonce((n) => n + 1); setBuilderOpen(true); };

    const toggleEnabled = async (et) => {
        setBusyId(et.id);
        try {
            await upsertEntityType(organizationId, { ...et, enabled: et.enabled === false });
            toast.success(et.enabled === false ? 'Página ativada.' : 'Página desativada.');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível atualizar.');
        } finally {
            setBusyId(null);
        }
    };

    const move = async (idx, dir) => {
        const j = idx + dir;
        if (j < 0 || j >= entityTypes.length) return;
        const a = entityTypes[idx];
        const b = entityTypes[j];
        setBusyId(a.id);
        try {
            await Promise.all([
                upsertEntityType(organizationId, { ...a, order: j }),
                upsertEntityType(organizationId, { ...b, order: idx }),
            ]);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível reordenar.');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (et) => {
        setDeletingId(et.id);
        try {
            await deleteEntityType(organizationId, et.id);
            toast.success('Página excluída.');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível excluir.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Páginas personalizadas</h3>
                    <p className="text-sm text-slate-500">
                        Crie suas próprias páginas com campos, painel de fases e regras — sem programar.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
                        <FileSpreadsheet className="h-4 w-4" /> Importar planilha
                    </Button>
                    <Button onClick={openCreate} className="gap-1.5">
                        <Plus className="h-4 w-4" /> Nova página
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                </div>
            ) : entityTypes.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                        <LayoutGrid className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                            Nenhuma página personalizada ainda. Clique em "Nova página" para começar.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {entityTypes.map((et, idx) => (
                        <Card key={et.id}>
                            <CardContent className="flex items-center justify-between gap-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="flex flex-col">
                                        <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0 || busyId} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                                        <button type="button" onClick={() => move(idx, 1)} disabled={idx === entityTypes.length - 1 || busyId} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{et.label_plural}</span>
                                            {et.enabled === false && <Badge variant="secondary">Desativada</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {(et.fields || []).length} campo(s) · {(et.phases || []).length} fase(s)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 cursor-pointer">
                                        <Switch checked={et.enabled !== false} onCheckedChange={() => toggleEnabled(et)} disabled={busyId === et.id} />
                                        Ativa
                                    </label>
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(et)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" disabled={deletingId === et.id}>
                                                {deletingId === et.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Excluir "{et.label_plural}"?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Só é possível excluir páginas sem registros. Se houver registros, desative a página em vez de excluir.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(et)} className="bg-red-600 hover:bg-red-700">
                                                    Excluir
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <EntityTypeBuilder
                key={`${editing?.id || 'new'}-${builderNonce}`}
                open={builderOpen}
                onOpenChange={setBuilderOpen}
                organizationId={organizationId}
                members={members}
                entityType={editing}
                initialFields={importedFields}
                onSaved={() => {}}
            />

            <SpreadsheetImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                mode="structure"
                organizationId={organizationId}
                onStructureReady={handleStructureReady}
            />
        </div>
    );
}
