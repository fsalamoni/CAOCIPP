import React, { useState, useMemo, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    pointerWithin,
    closestCorners,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Inbox, Pencil, Eye, FolderCheck, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { calculateExpedienteDerivedStatus, getExpedienteField } from '@/utils/expedienteUtils';
import { updateExpediente } from '@/services/functionsService';
import { isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import ExpedienteKanbanCard from './ExpedienteKanbanCard';
import ExpedienteKanbanTransitionDialog from './ExpedienteKanbanTransitionDialog';
import ExpedienteDetailSheet from './ExpedienteDetailSheet';
import EditExpedienteDialog from './EditExpedienteDialog';
import CreateExpedienteDialog from './CreateExpedienteDialog';
import EmptyState from '../ui/EmptyState';

// === Column Definitions ===
const KANBAN_COLUMNS = [
    {
        id: 'Pendente',
        label: 'Pendentes',
        icon: Inbox,
        emptyText: 'Nenhum expediente pendente',
        headerBg: 'bg-slate-50',
        headerBorder: 'border-slate-200',
        headerText: 'text-slate-600',
        columnBg: 'bg-slate-50/50',
        dotColor: 'bg-slate-400',
    },
    {
        id: 'Em elaboração',
        label: 'Em Análise',
        icon: Pencil,
        emptyText: 'Nenhum expediente em análise',
        headerBg: 'bg-amber-50',
        headerBorder: 'border-amber-200',
        headerText: 'text-amber-700',
        columnBg: 'bg-amber-50/30',
        dotColor: 'bg-amber-400',
    },
    {
        id: 'Em revisão',
        label: 'Em Revisão',
        icon: Eye,
        emptyText: 'Nenhum expediente em revisão',
        headerBg: 'bg-sky-50',
        headerBorder: 'border-sky-200',
        headerText: 'text-sky-700',
        columnBg: 'bg-sky-50/30',
        dotColor: 'bg-sky-400',
    },
    {
        id: 'Na pasta',
        label: 'Arquivados',
        icon: FolderCheck,
        emptyText: 'Nenhum expediente arquivado',
        headerBg: 'bg-green-50',
        headerBorder: 'border-green-200',
        headerText: 'text-green-700',
        columnBg: 'bg-green-50/30',
        dotColor: 'bg-green-400',
    },
];

// Valid transitions: forward only for advancing, backward allowed except from Na pasta
const VALID_FORWARD = { 0: [1], 1: [2], 2: [3], 3: [] };
const VALID_BACKWARD = { 0: [], 1: [0], 2: [1], 3: [] }; // Na pasta blocked

export default function ExpedienteKanbanBoard({
    organization,
    members,
    expedientes,
    userRole,
    userId,
    expedientesLoading,
}) {
    const [activeId, setActiveId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('assign');
    const [pendingExpediente, setPendingExpediente] = useState(null);
    const [pendingTarget, setPendingTarget] = useState(null);

    // Detail sheet state
    const [detailExpediente, setDetailExpediente] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Edit dialog state
    const [editExpediente, setEditExpediente] = useState(null);
    const [editOpen, setEditOpen] = useState(false);

    // Create dialog state (mimicking CreateButton pattern)
    const [createOpen, setCreateOpen] = useState(false);

    // Year filter
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const years = useMemo(() => {
        const yearsSet = new Set([currentYear]);
        expedientes.forEach(p => {
            const date = parseLocalDate(getExpedienteField(p, 'entry_date'));
            const year = isValid(date) ? date.getFullYear() : null;
            if (year && !isNaN(year)) yearsSet.add(year);
        });
        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [expedientes, currentYear]);

    const filteredExpedientes = useMemo(() => {
        return expedientes.filter(p => {
            const date = parseLocalDate(getExpedienteField(p, 'entry_date'));
            if (!isValid(date)) return false;
            return date.getFullYear() === selectedYear;
        });
    }, [expedientes, selectedYear]);

    // User role detection
    const userMember = useMemo(() =>
        members.find(m => m.user_id === userId),
        [members, userId]
    );
    const userFunc = (userMember?.function || '').toLowerCase();
    const isAssessor = userFunc.includes('assessor') || userFunc.includes('assessoria');

    const assessors = useMemo(() =>
        members.filter(m => {
            const fn = (m.function || '').toLowerCase();
            return fn.includes('assessor') || fn.includes('assessoria');
        }),
        [members]
    );

    // Distribute into columns
    const columns = useMemo(() => {
        const grouped = { 'Pendente': [], 'Em elaboração': [], 'Em revisão': [], 'Na pasta': [] };
        filteredExpedientes.forEach(p => {
            const status = calculateExpedienteDerivedStatus(p);
            (grouped[status] || grouped['Pendente']).push(p);
        });
        return grouped;
    }, [filteredExpedientes]);

    const activeExpediente = useMemo(() => {
        if (!activeId) return null;
        return filteredExpedientes.find(p => p.id === activeId) || null;
    }, [activeId, filteredExpedientes]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
    );

    const getColumnIndex = (status) =>
        KANBAN_COLUMNS.findIndex(col => col.id === status);

    // === Eye Icon: View Details ===
    const handleViewDetails = useCallback((expediente) => {
        setDetailExpediente(expediente);
        setDetailOpen(true);
    }, []);

    const handleEditFromDetail = useCallback((expediente) => {
        setDetailOpen(false);
        setEditExpediente(expediente);
        setEditOpen(true);
    }, []);

    // === Drag Handlers ===
    const handleDragStart = useCallback((event) => {
        setActiveId(event.active.id);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const expediente = filteredExpedientes.find(p => p.id === active.id);
        if (!expediente) return;

        const currentStatus = calculateExpedienteDerivedStatus(expediente);
        const targetColumnId = over.data?.current?.columnId || over.id;

        if (currentStatus === targetColumnId) return;

        const currentIdx = getColumnIndex(currentStatus);
        const targetIdx = getColumnIndex(targetColumnId);

        const isForward = VALID_FORWARD[currentIdx]?.includes(targetIdx);
        const isBackward = VALID_BACKWARD[currentIdx]?.includes(targetIdx);

        if (!isForward && !isBackward) {
            if (currentIdx === 3) {
                toast.error('Expedientes arquivados não podem ser movidos. Use a edição para alterar.', { duration: 3000 });
            } else {
                toast.error('Movimente apenas para colunas adjacentes.', { duration: 3000 });
            }
            return;
        }

        if (isBackward) {
            handleBackwardMove(expediente, currentStatus, targetColumnId);
        } else {
            handleForwardTransition(expediente, currentStatus, targetColumnId);
        }
    }, [filteredExpedientes, isAssessor, userId, userMember]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    // === Backward Move: change status only, keep all existing data ===
    const handleBackwardMove = async (expediente, fromStatus, toStatus) => {
        const expedienteNumber = getExpedienteField(expediente, 'expediente_number');
        const colLabel = KANBAN_COLUMNS.find(c => c.id === toStatus)?.label || toStatus;

        try {
            await updateExpediente({
                id: expediente.id,
                organizationId: organization.id,
                changes: { status: toStatus },
            });
            toast.success(`Expediente ${expedienteNumber} retornou para "${colLabel}".`);
        } catch (err) {
            toast.error('Erro ao mover expediente: ' + err.message);
        }
    };

    // === Forward Transition ===
    const handleForwardTransition = async (expediente, fromStatus, toStatus) => {
        if (fromStatus === 'Pendente' && toStatus === 'Em elaboração') {
            setPendingExpediente(expediente);
            setPendingTarget(toStatus);
            setDialogMode('assign');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em elaboração' && toStatus === 'Em revisão') {
            setPendingExpediente(expediente);
            setPendingTarget(toStatus);
            setDialogMode('review');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em revisão' && toStatus === 'Na pasta') {
            setPendingExpediente(expediente);
            setPendingTarget(toStatus);
            setDialogMode('archive');
            setDialogOpen(true);
            return;
        }
    };

    // === Dialog Confirm ===
    const handleDialogConfirm = async (data) => {
        if (!pendingExpediente || !pendingTarget) return;

        const today = new Date().toISOString().split('T')[0];
        const expedienteNumber = getExpedienteField(pendingExpediente, 'expediente_number');
        let changes = {};

        if (dialogMode === 'assign') {
            changes = {
                analysis_start_date: today,
                distribution_date: today,
                responsible_user_id: data.responsible_user_id,
                responsible_user_name: data.responsible_user_name,
                status: 'Em elaboração',
            };
        } else if (dialogMode === 'review') {
            changes = {
                review_submission_date: today,
                observations: data.observations,
                network_folder: data.network_folder,
                status: 'Em revisão',
            };
        } else if (dialogMode === 'archive') {
            changes = {
                archived_date: today,
                review_return_date: data.review_return_date || today,
                status: 'Na pasta',
            };
        }

        try {
            await updateExpediente({
                id: pendingExpediente.id,
                organizationId: organization.id,
                changes,
            });
            const actions = {
                assign: `Expediente ${expedienteNumber} em análise!`,
                review: `Expediente ${expedienteNumber} enviado para revisão!`,
                archive: `Expediente ${expedienteNumber} arquivado!`,
            };
            toast.success(actions[dialogMode]);
        } catch (err) {
            toast.error('Erro ao atualizar expediente: ' + err.message);
            throw err;
        }

        setPendingExpediente(null);
        setPendingTarget(null);
    };

    if (expedientesLoading) {
        return (
            <Card className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel de Expedientes</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Arraste os expedientes entre as colunas para gerenciar as etapas do fluxo de trabalho.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Expediente
                    </Button>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 pl-3 pr-8 rounded-lg border-slate-200 bg-white shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>Ano: {y}</option>)}
                    </select>
                    <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 px-3 py-1">
                        {filteredExpedientes.length} {filteredExpedientes.length === 1 ? 'expediente' : 'expedientes'}
                    </Badge>
                </div>
            </div>

            {/* Kanban Board */}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    const pointerCollisions = pointerWithin(args);
                    if (pointerCollisions.length > 0) return pointerCollisions;
                    return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {KANBAN_COLUMNS.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            expedientes={columns[col.id] || []}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeExpediente ? (
                        <ExpedienteKanbanCard expediente={activeExpediente} overlay />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Transition Dialog */}
            {pendingExpediente && (
                <ExpedienteKanbanTransitionDialog
                    open={dialogOpen}
                    onClose={() => {
                        setDialogOpen(false);
                        setPendingExpediente(null);
                        setPendingTarget(null);
                    }}
                    mode={dialogMode}
                    expediente={pendingExpediente}
                    assessors={assessors}
                    defaultAssessor={isAssessor ? userId : ''}
                    onConfirm={handleDialogConfirm}
                />
            )}

            {/* Detail Sheet */}
            <ExpedienteDetailSheet
                expediente={detailExpediente}
                open={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    setDetailExpediente(null);
                }}
                onEdit={handleEditFromDetail}
                getExpedienteField={getExpedienteField}
            />

            {/* Edit Dialog */}
            {editExpediente && (
                <EditExpedienteDialog
                    open={editOpen}
                    setOpen={(open) => {
                        setEditOpen(open);
                        if (!open) setEditExpediente(null);
                    }}
                    expediente={editExpediente}
                    members={members}
                    onSuccess={() => {
                        setEditOpen(false);
                        setEditExpediente(null);
                    }}
                    organizationId={organization.id}
                    organization={organization}
                    userRole={userRole}
                />
            )}

            {/* Create Dialog */}
            <CreateExpedienteDialog
                open={createOpen}
                setOpen={setCreateOpen}
                organization={organization}
                members={members}
                onSuccess={() => setCreateOpen(false)}
            />
        </div>
    );
}

// === Droppable Column ===
function KanbanColumn({ column, expedientes, onViewDetails }) {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: { columnId: column.id },
    });

    const ColIcon = column.icon;

    return (
        <div
            ref={setNodeRef}
            className={`
        rounded-xl border flex flex-col
        ${column.headerBorder}
        ${isOver ? 'ring-2 ring-indigo-300 bg-indigo-50/30' : ''}
      `}
            style={{ minHeight: '500px' }}
        >
            <div className={`
        px-4 py-3 rounded-t-xl border-b flex items-center justify-between
        ${column.headerBg} ${column.headerBorder}
      `}>
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                    <ColIcon className={`w-4 h-4 ${column.headerText}`} />
                    <span className={`text-sm font-bold ${column.headerText}`}>{column.label}</span>
                </div>
                <Badge variant="secondary" className="bg-white/50 text-slate-600 border-0">
                    {expedientes.length}
                </Badge>
            </div>

            <div className={`flex-1 p-3 space-y-2 ${column.columnBg} rounded-b-xl overflow-y-auto`}
                style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
                <SortableContext items={expedientes.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {expedientes.length > 0 ? (
                        expedientes.map(p => (
                            <ExpedienteKanbanCard key={p.id} expediente={p} columnId={column.id} onViewDetails={onViewDetails} />
                        ))
                    ) : (
                        <EmptyState
                            icon={ColIcon}
                            title={column.emptyText}
                            description="Não há expedientes nesta etapa do fluxo no momento."
                            className="py-12 border-none shadow-none bg-transparent"
                        />
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
