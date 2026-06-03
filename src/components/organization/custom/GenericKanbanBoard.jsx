import React, { useState, useMemo, useCallback } from 'react';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatFieldValue } from '@/lib/fieldTypes';
import { updateRecord } from '@/services/customEntitiesService';

/**
 * Kanban genérico — colunas = fases do tipo de entidade.
 * props: entityType, records, isLoading, members, canEdit, canCreate,
 *        onCreate, onOpen(record), onChanged
 */
export default function GenericKanbanBoard({
    entityType, records = [], isLoading, members = [], canEdit, canCreate,
    onCreate, onOpen, onChanged,
}) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
    const [activeId, setActiveId] = useState(null);

    const membersById = useMemo(
        () => Object.fromEntries(members.map((m) => [m.user_id || m.id, m])),
        [members]
    );

    const phases = useMemo(
        () => (entityType?.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [entityType]
    );

    const primaryFields = useMemo(
        () => (entityType?.fields || [])
            .filter((f) => f.table?.show !== false)
            .sort((a, b) => (a.table?.order ?? 0) - (b.table?.order ?? 0))
            .slice(0, 3),
        [entityType]
    );

    const recordTypes = useMemo(() => entityType?.record_types || [], [entityType]);
    const typesByKey = useMemo(() => Object.fromEntries(recordTypes.map((t) => [t.key, t])), [recordTypes]);
    const [typeFilter, setTypeFilter] = useState([]);
    const toggleTypeFilter = (key) => setTypeFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    const visibleRecords = useMemo(
        () => (typeFilter.length ? records.filter((r) => typeFilter.includes(r.record_type)) : records),
        [records, typeFilter]
    );

    const byPhase = useMemo(() => {
        const map = {};
        for (const p of phases) map[p.key] = [];
        for (const r of visibleRecords) {
            const key = map[r.phase] ? r.phase : phases[0]?.key;
            if (key && map[key]) map[key].push(r);
        }
        return map;
    }, [visibleRecords, phases]);

    const activeRecord = useMemo(
        () => records.find((r) => r.id === activeId),
        [activeId, records]
    );

    const handleDragEnd = useCallback(async (event) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const recordId = active.id;
        const targetPhase = over.id;
        const rec = records.find((r) => r.id === recordId);
        if (!rec || rec.phase === targetPhase) return;
        if (!canEdit) {
            toast.error('Você não tem permissão para mover registros.');
            return;
        }
        try {
            await updateRecord({ organizationId: entityType.organization_id, recordId, phase: targetPhase });
            toast.success('Fase atualizada.');
            onChanged?.();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível mover. Verifique os requisitos da fase.');
        }
    }, [records, canEdit, entityType, onChanged]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {(recordTypes.length > 0 || canCreate) && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {recordTypes.map((t) => {
                            const active = typeFilter.includes(t.key);
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => toggleTypeFilter(t.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? 'border-transparent text-white' : 'bg-background hover:bg-muted'}`}
                                    style={active ? { backgroundColor: t.color || '#64748b' } : { borderColor: t.color || '#cbd5e1' }}
                                >
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? '#ffffff' : (t.color || '#94a3b8') }} />
                                    {t.label}
                                </button>
                            );
                        })}
                        {typeFilter.length > 0 && (
                            <button type="button" onClick={() => setTypeFilter([])} className="text-xs text-muted-foreground hover:underline px-1">
                                Limpar filtro
                            </button>
                        )}
                    </div>
                    {canCreate && (
                        <Button size="sm" onClick={onCreate}>
                            <Plus className="mr-1.5 h-4 w-4" /> Novo {entityType?.label_singular}
                        </Button>
                    )}
                </div>
            )}
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragStart={(e) => setActiveId(e.active.id)}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
                <div className="flex gap-3 overflow-x-auto pb-4">
                    {phases.map((phase) => (
                        <KanbanColumn
                            key={phase.key}
                            phase={phase}
                            records={byPhase[phase.key] || []}
                            primaryFields={primaryFields}
                            membersById={membersById}
                            typesByKey={typesByKey}
                            onOpen={onOpen}
                            draggable={canEdit}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeRecord && (
                        <RecordCardContent
                            record={activeRecord}
                            primaryFields={primaryFields}
                            membersById={membersById}
                            typesByKey={typesByKey}
                            dragging
                        />
                    )}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

function KanbanColumn({ phase, records, primaryFields, membersById, typesByKey, onOpen, draggable }) {
    const { setNodeRef, isOver } = useDroppable({ id: phase.key });
    const overLimit = phase.wip_limit && records.length > phase.wip_limit;
    return (
        <div className="flex-shrink-0 w-72">
            <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg border-b-2"
                style={{ borderColor: phase.color || '#cbd5e1' }}
            >
                <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phase.color || '#94a3b8' }} />
                    <span className="font-medium text-sm">{phase.label}</span>
                </div>
                <Badge variant={overLimit ? 'destructive' : 'secondary'} className="text-xs">
                    {records.length}{phase.wip_limit ? `/${phase.wip_limit}` : ''}
                </Badge>
            </div>
            <div
                ref={setNodeRef}
                className={`min-h-[200px] p-2 space-y-2 rounded-b-lg transition-colors ${isOver ? 'bg-primary/5' : 'bg-muted/30'}`}
            >
                {records.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>
                ) : (
                    records.map((r) => (
                        <DraggableCard
                            key={r.id}
                            record={r}
                            primaryFields={primaryFields}
                            membersById={membersById}
                            typesByKey={typesByKey}
                            onOpen={onOpen}
                            draggable={draggable}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function DraggableCard({ record, primaryFields, membersById, typesByKey, onOpen, draggable }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: record.id, disabled: !draggable,
    });
    return (
        <div
            ref={setNodeRef}
            {...(draggable ? { ...listeners, ...attributes } : {})}
            onClick={() => onOpen?.(record)}
            className={`${isDragging ? 'opacity-40' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
        >
            <RecordCardContent
                record={record}
                primaryFields={primaryFields}
                membersById={membersById}
                typesByKey={typesByKey}
            />
        </div>
    );
}

function RecordCardContent({ record, primaryFields, membersById, typesByKey, dragging }) {
    const type = typesByKey?.[record.record_type];
    return (
        <Card
            className={`p-3 space-y-1 border-l-4 ${dragging ? 'shadow-lg ring-2 ring-primary' : 'hover:shadow-sm'}`}
            style={{ borderLeftColor: type?.color || 'transparent' }}
        >
            {type && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: type.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
                    {type.label}
                </div>
            )}
            {primaryFields.map((f, i) => {
                const val = formatFieldValue(f, record.values?.[f.key], { membersById });
                return (
                    <div key={f.key} className={i === 0 ? 'font-medium text-sm truncate' : 'text-xs text-muted-foreground truncate'}>
                        {i === 0 ? val : <><span className="opacity-70">{f.label}: </span>{val}</>}
                    </div>
                );
            })}
        </Card>
    );
}
