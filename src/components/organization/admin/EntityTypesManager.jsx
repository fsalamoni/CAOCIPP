import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { useEntityTypes } from '@/hooks/useCustomEntities';
import { useOrganizationMembers } from '@/hooks/useFirestore';
import { deleteEntityType } from '@/services/customEntitiesService';
import EntityTypeBuilder from '@/components/organization/custom/EntityTypeBuilder';

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

    const openCreate = () => { setEditing(null); setBuilderOpen(true); };
    const openEdit = (et) => { setEditing(et); setBuilderOpen(true); };

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
                <Button onClick={openCreate} className="gap-1.5 shrink-0">
                    <Plus className="h-4 w-4" /> Nova página
                </Button>
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
                    {entityTypes.map((et) => (
                        <Card key={et.id}>
                            <CardContent className="flex items-center justify-between gap-4 py-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">{et.label_plural}</span>
                                        {et.enabled === false && <Badge variant="secondary">Desativada</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {(et.fields || []).length} campo(s) · {(et.phases || []).length} fase(s)
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
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
                open={builderOpen}
                onOpenChange={setBuilderOpen}
                organizationId={organizationId}
                members={members}
                entityType={editing}
                onSaved={() => {}}
            />
        </div>
    );
}
