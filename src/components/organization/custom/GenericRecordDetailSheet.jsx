import React, { useState, useMemo } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, History, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatFieldValue } from '@/lib/fieldTypes';
import { updateRecord, deleteRecord } from '@/services/customEntitiesService';

/**
 * Folha de detalhes de um registro.
 * props: open, onOpenChange, organizationId, entityType, record, members,
 *        canEdit, canDelete, onEdit(record), onChanged
 */
export default function GenericRecordDetailSheet({
    open, onOpenChange, organizationId, entityType, record, members = [],
    canEdit, canDelete, onEdit, onChanged,
}) {
    const [movingTo, setMovingTo] = useState('');
    const [comment, setComment] = useState('');

    const membersById = useMemo(
        () => Object.fromEntries(members.map((m) => [m.user_id || m.id, m])),
        [members]
    );
    const phasesByKey = useMemo(
        () => Object.fromEntries((entityType?.phases || []).map((p) => [p.key, p])),
        [entityType]
    );

    if (!record) return null;

    const currentPhase = phasesByKey[record.phase];
    const otherPhases = (entityType?.phases || []).filter((p) => p.key !== record.phase);
    const fields = (entityType?.fields || []).slice().sort((a, b) => (a.form?.order ?? 0) - (b.form?.order ?? 0));
    const activityLog = Array.isArray(record.activity_log) ? [...record.activity_log].reverse() : [];

    const handleMove = () => {
        if (!movingTo) return;
        const targetPhase = movingTo;
        const targetComment = comment.trim() || undefined;
        // UI otimista: limpa os campos imediatamente e grava em segundo plano.
        setMovingTo('');
        setComment('');
        const action = updateRecord({
            organizationId, recordId: record.id, phase: targetPhase,
            comment: targetComment,
        });
        toast.promise(action, {
            loading: 'Atualizando fase...',
            success: () => {
                onChanged?.();
                return 'Fase atualizada.';
            },
            error: (e) => e?.message || 'Não foi possível mudar a fase.',
        });
    };

    const handleDelete = () => {
        // UI otimista: fecha imediatamente e exclui em segundo plano.
        onOpenChange(false);
        const action = deleteRecord(organizationId, record.id);
        toast.promise(action, {
            loading: 'Excluindo...',
            success: () => {
                onChanged?.();
                return 'Registro excluído.';
            },
            error: (e) => e?.message || 'Não foi possível excluir.',
        });
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
                <SheetHeader className="p-6 pb-3">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            style={currentPhase?.color ? { borderColor: currentPhase.color, color: currentPhase.color } : undefined}
                        >
                            {currentPhase?.label || record.phase || '—'}
                        </Badge>
                    </div>
                    <SheetTitle>{entityType?.label_singular}</SheetTitle>
                    <SheetDescription>Detalhes do registro</SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-4 pb-6">
                        {/* Campos */}
                        <div className="space-y-3">
                            {fields.map((f) => (
                                <div key={f.key} className="grid grid-cols-3 gap-2 text-sm">
                                    <span className="text-muted-foreground col-span-1">{f.label}</span>
                                    <span className="col-span-2 break-words">
                                        {formatFieldValue(f, record.values?.[f.key], { membersById })}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        {/* Mudança de fase */}
                        {canEdit && otherPhases.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                    <ArrowRight className="h-4 w-4" /> Mover para outra fase
                                </h4>
                                <Select value={movingTo} onValueChange={setMovingTo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Escolha a fase de destino..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {otherPhases.map((p) => (
                                            <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {movingTo && (
                                    <>
                                        <Textarea
                                            placeholder="Comentário (opcional)"
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            rows={2}
                                        />
                                        <Button size="sm" onClick={handleMove} disabled={!movingTo} className="w-full">
                                            Confirmar mudança
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}

                        <Separator />

                        {/* Histórico */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                <History className="h-4 w-4" /> Histórico
                            </h4>
                            {activityLog.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Sem registros de atividade.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {activityLog.map((e, i) => (
                                        <li key={i} className="text-xs border-l-2 border-muted pl-3 py-0.5">
                                            <div className="font-medium">{e.action}</div>
                                            <div className="text-muted-foreground">
                                                {e.user_name} · {e.date} {e.time}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {(canEdit || canDelete) && (
                    <div className="border-t p-4 flex gap-2">
                        {canEdit && (
                            <Button variant="outline" className="flex-1" onClick={() => onEdit?.(record)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                            </Button>
                        )}
                        {canDelete && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                            Excluir
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
