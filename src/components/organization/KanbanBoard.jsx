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
import { Loader2, Inbox, Pencil, Eye, FolderCheck } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDerivedStatus, getProcessField } from '@/utils/processUtils';
import { updateProcess } from '@/services/functionsService';
import { isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import KanbanCard from './KanbanCard';
import KanbanTransitionDialog from './KanbanTransitionDialog';
import ProcessDetailSheet from './ProcessDetailSheet';
import EditProcessDialog from './EditProcessDialog';
import CreateProcessButton from './CreateProcessButton';

// === Column Definitions ===
const KANBAN_COLUMNS = [
    {
        id: 'Pendente',
        label: 'Pendentes',
        icon: Inbox,
        emptyText: 'Nenhum processo pendente',
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
        emptyText: 'Nenhum processo em análise',
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
        emptyText: 'Nenhum processo em revisão',
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
        emptyText: 'Nenhum processo arquivado',
        headerBg: 'bg-green-50',
        headerBorder: 'border-green-200',
        headerText: 'text-green-700',
        columnBg: 'bg-green-50/30',
        dotColor: 'bg-green-400',
    },
];

// Valid transitions: forward only for advancing, backward allowed except from Na pasta
// Na pasta (index 3) cannot move backward
const VALID_FORWARD = { 0: [1], 1: [2], 2: [3], 3: [] };
const VALID_BACKWARD = { 0: [], 1: [0], 2: [1], 3: [] }; // Na pasta blocked

export default function KanbanBoard({
    organization,
    members,
    processes,
    userRole,
    userId,
    processesLoading,
}) {
    const [activeId, setActiveId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('assign');
    const [pendingProcess, setPendingProcess] = useState(null);
    const [pendingTarget, setPendingTarget] = useState(null);

    // Detail sheet state
    const [detailProcess, setDetailProcess] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Edit dialog state
    const [editProcess, setEditProcess] = useState(null);
    const [editOpen, setEditOpen] = useState(false);

    // Year filter
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const years = useMemo(() => {
        const yearsSet = new Set([currentYear]);
        processes.forEach(p => {
            const date = parseLocalDate(getProcessField(p, 'entry_date'));
            const year = isValid(date) ? date.getFullYear() : null;
            if (year && !isNaN(year)) yearsSet.add(year);
        });
        return Array.from(yearsSet).sort((a, b) => b - a);
    }, [processes, currentYear]);

    const filteredProcesses = useMemo(() => {
        return processes.filter(p => {
            const date = parseLocalDate(getProcessField(p, 'entry_date'));
            if (!isValid(date)) return false;
            return date.getFullYear() === selectedYear;
        });
    }, [processes, selectedYear]);

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
        filteredProcesses.forEach(p => {
            const status = calculateDerivedStatus(p);
            (grouped[status] || grouped['Pendente']).push(p);
        });
        return grouped;
    }, [filteredProcesses]);

    const activeProcess = useMemo(() => {
        if (!activeId) return null;
        return filteredProcesses.find(p => p.id === activeId) || null;
    }, [activeId, filteredProcesses]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
    );

    const getColumnIndex = (status) =>
        KANBAN_COLUMNS.findIndex(col => col.id === status);

    // === Eye Icon: View Details ===
    const handleViewDetails = useCallback((process) => {
        setDetailProcess(process);
        setDetailOpen(true);
    }, []);

    const handleEditFromDetail = useCallback((process) => {
        setDetailOpen(false);
        setEditProcess(process);
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

        const process = filteredProcesses.find(p => p.id === active.id);
        if (!process) return;

        const currentStatus = calculateDerivedStatus(process);
        const targetColumnId = over.data?.current?.columnId || over.id;

        if (currentStatus === targetColumnId) return;

        const currentIdx = getColumnIndex(currentStatus);
        const targetIdx = getColumnIndex(targetColumnId);

        const isForward = VALID_FORWARD[currentIdx]?.includes(targetIdx);
        const isBackward = VALID_BACKWARD[currentIdx]?.includes(targetIdx);

        if (!isForward && !isBackward) {
            if (currentIdx === 3) {
                toast.error('Processos arquivados não podem ser movidos. Use a edição para alterar.', { duration: 3000 });
            } else {
                toast.error('Movimente apenas para colunas adjacentes.', { duration: 3000 });
            }
            return;
        }

        if (isBackward) {
            handleBackwardMove(process, currentStatus, targetColumnId);
        } else {
            handleForwardTransition(process, currentStatus, targetColumnId);
        }
    }, [filteredProcesses, isAssessor, userId, userMember]);

    const handleDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    // === Backward Move: change status only, keep all existing data ===
    const handleBackwardMove = async (process, fromStatus, toStatus) => {
        const processNumber = getProcessField(process, 'process_number');
        const colLabel = KANBAN_COLUMNS.find(c => c.id === toStatus)?.label || toStatus;

        try {
            await updateProcess({
                id: process.id,
                organizationId: organization.id,
                changes: { status: toStatus },
            });
            toast.success(`Processo ${processNumber} retornou para "${colLabel}".`);
        } catch (err) {
            toast.error('Erro ao mover processo: ' + err.message);
        }
    };

    // === Forward Transition ===
    const handleForwardTransition = async (process, fromStatus, toStatus) => {
        const today = new Date().toISOString().split('T')[0];

        if (fromStatus === 'Pendente' && toStatus === 'Em elaboração') {
            // Always show assign dialog; pre-select self if assessor
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('assign');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em elaboração' && toStatus === 'Em revisão') {
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('review');
            setDialogOpen(true);
            return;
        }

        if (fromStatus === 'Em revisão' && toStatus === 'Na pasta') {
            setPendingProcess(process);
            setPendingTarget(toStatus);
            setDialogMode('archive');
            setDialogOpen(true);
            return;
        }
    };

    // === Dialog Confirm ===
    const handleDialogConfirm = async (data) => {
        if (!pendingProcess || !pendingTarget) return;

        const today = new Date().toISOString().split('T')[0];
        const processNumber = getProcessField(pendingProcess, 'process_number');
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
            await updateProcess({
                id: pendingProcess.id,
                organizationId: organization.id,
                changes,
            });
            const actions = {
                assign: `Processo ${processNumber} em análise!`,
                review: `Processo ${processNumber} enviado para revisão!`,
                archive: `Processo ${processNumber} arquivado!`,
            };
            toast.success(actions[dialogMode]);
        } catch (err) {
            toast.error('Erro ao atualizar processo: ' + err.message);
            throw err;
        }

        setPendingProcess(null);
        setPendingTarget(null);
    };

    if (processesLoading) {
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
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel de Controle</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Arraste os processos entre as colunas para avançar ou retornar o fluxo.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <CreateProcessButton organization={organization} members={members} />
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 pl-3 pr-8 rounded-lg border-slate-200 bg-white shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {years.map(y => <option key={y} value={y}>Ano: {y}</option>)}
                    </select>
                    <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 px-3 py-1">
                        {filteredProcesses.length} {filteredProcesses.length === 1 ? 'processo' : 'processos'}
                    </Badge>
                </div>
            </div>

            {/* Kanban Board */}
            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    // Try pointerWithin first (most intuitive for columns)
                    const pointerCollisions = pointerWithin(args);
                    if (pointerCollisions.length > 0) return pointerCollisions;
                    // Fallback to closestCorners for edge cases
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
                            processes={columns[col.id] || []}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={null}>
                    {activeProcess ? (
                        <KanbanCard process={activeProcess} overlay />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Transition Dialog */}
            {pendingProcess && (
                <KanbanTransitionDialog
                    open={dialogOpen}
                    onClose={() => {
                        setDialogOpen(false);
                        setPendingProcess(null);
                        setPendingTarget(null);
                    }}
                    mode={dialogMode}
                    process={pendingProcess}
                    assessors={assessors}
                    defaultAssessor={isAssessor ? userId : ''}
                    onConfirm={handleDialogConfirm}
                />
            )}

            {/* Process Detail Sheet (same as Controle de Processos) */}
            <ProcessDetailSheet
                process={detailProcess}
                open={detailOpen}
                onClose={() => {
                    setDetailOpen(false);
                    setDetailProcess(null);
                }}
                onEdit={handleEditFromDetail}
                getProcessField={getProcessField}
            />

            {/* Edit Process Dialog (same as Controle de Processos) */}
            {editProcess && (
                <EditProcessDialog
                    open={editOpen}
                    setOpen={(open) => {
                        setEditOpen(open);
                        if (!open) setEditProcess(null);
                    }}
                    process={editProcess}
                    members={members}
                    onSuccess={() => {
                        setEditOpen(false);
                        setEditProcess(null);
                    }}
                    organizationId={organization.id}
                    userRole={userRole}
                />
            )}
        </div>
    );
}

// === Droppable Column ===
function KanbanColumn({ column, processes, onViewDetails }) {
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
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-5 bg-white/80 text-slate-600 border border-slate-200">
                    {processes.length}
                </Badge>
            </div>

            <div className={`flex-1 p-3 space-y-2 ${column.columnBg} rounded-b-xl overflow-y-auto`}
                style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
                <SortableContext items={processes.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {processes.length > 0 ? (
                        processes.map(p => (
                            <KanbanCard key={p.id} process={p} columnId={column.id} onViewDetails={onViewDetails} />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                            <ColIcon className="w-8 h-8 mb-2 opacity-40" />
                            <p className="text-xs text-center">{column.emptyText}</p>
                        </div>
                    )}
                </SortableContext>
            </div>
        </div>
    );
}
