import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { Button } from '@/components/ui/button';


import { Badge } from '@/components/ui/badge';
import {
    Inbox, Pencil, Send, Eye, Handshake, Archive, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { isValid } from 'date-fns';
import {
    calculateParceriaDerivedStatus,
    getParceriaField,
    hasAdditives,
} from '@/utils/parceriaUtils';
import { updateParceria } from '@/services/functionsService';
import { parseLocalDate } from '@/lib/dateUtils';
import { useUserPreferences, useAditivos } from '@/hooks/useFirestore';
import ProcessLogDialog from './ProcessLogDialog';
import ParceriaKanbanCard from './ParceriaKanbanCard';
import ParceriaKanbanTransitionDialog from './ParceriaKanbanTransitionDialog';
import ParceriaDetailSheet from './ParceriaDetailSheet';
import CreateAditivoDialog from './CreateAditivoDialog';
import ExtinguishConfirmDialog from './ExtinguishConfirmDialog';
import EditParceriaDialog from './EditParceriaDialog';
import EmptyState from '../ui/EmptyState';

const KANBAN_COLUMNS_BASE = [
    { id: 'Pendente',          label: 'Pendentes',         icon: Inbox,     color: 'slate'   },
    { id: 'Em análise',        label: 'Em Análise',        icon: Pencil,    color: 'amber'   },
    { id: 'Revisão',           label: 'Revisão',           icon: Eye,       color: 'sky'     },
    { id: 'Aguarda Terceiros', label: 'Aguarda Terceiros', icon: Send,      color: 'cyan',   conditional: 'thirdPartyPhaseEnabled' },
    { id: 'Parcerias',         label: 'Parcerias',         icon: Handshake, color: 'emerald' },
    { id: 'Extintos',          label: 'Extintos',          icon: Archive,   color: 'slate'   },
];

// Resolve as colunas visíveis de acordo com a configuração do órgão.
// A coluna "Aguarda Terceiros" só aparece se thirdPartyPhaseEnabled !== false
// (default ON; admin pode desligar em Administração → Configurações → Parcerias).
function resolveColumns(organization) {
    const flag = organization?.parceriaSettings?.thirdPartyPhaseEnabled;
    const showThirdParty = flag !== false;
    return KANBAN_COLUMNS_BASE.filter((c) => {
        if (c.conditional === 'thirdPartyPhaseEnabled') return showThirdParty;
        return true;
    });
}

// Transições válidas (forward only), recalculadas quando uma coluna é removida.
// Pode pular "Aguarda Terceiros" indo direto de "Em análise" para "Revisão".
function buildValidForward(columns) {
    const idx = (id) => columns.findIndex((c) => c.id === id);
    const map = {};
    columns.forEach((c, i) => {
        const next = columns[i + 1]?.id;
        const skipOne = columns[i + 2]?.id;
        if (next) {
            // "Em análise" pode pular "Aguarda Terceiros" indo para "Revisão"
            // (ou, se a coluna intermediária for outra, ainda assim para o próximo).
            map[idx(c.id)] = [idx(next)];
            if (skipOne && c.id === 'Em análise') {
                map[idx(c.id)].push(idx(skipOne));
            }
        } else {
            map[idx(c.id)] = [];
        }
    });
    return map;
}

const buildDefaultFilters = () => ({ type: 'all', responsible: 'all', hasAdditive: 'all' });
const buildDefaultSortRules = () => ([{ key: 'pgea', direction: 'asc' }]);

export default function ParceriaKanbanBoard({
    organization,
    members,
    parcerias,
    userRole,
    userId,
    parceriasLoading,
}) {
    const { preferences, updatePreferences, isLoading: isLoadingPrefs } = useUserPreferences();
    const thirdParties = organization?.thirdPartiesSettingsParcerias
        || ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

    // Colunas e transições respeitam thirdPartyPhaseEnabled do órgão.
    const columns_list = useMemo(() => resolveColumns(organization), [organization]);
    const validForward = useMemo(() => buildValidForward(columns_list), [columns_list]);

    const [activeId, setActiveId] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState('assign');
    const [pendingParceria, setPendingParceria] = useState(null);
    const [pendingTarget, setPendingTarget] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailParceria, setDetailParceria] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editParceria, setEditParceria] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [aditivoDialogOpen, setAditivoDialogOpen] = useState(false);
    const [aditivoTarget, setAditivoTarget] = useState(null);
    const [extinguishOpen, setExtinguishOpen] = useState(false);
    const [extinguishTarget, setExtinguishTarget] = useState(null);
    const [logOpen, setLogOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    // Aditivos da Parceria selecionada no DetailSheet (reativo).
    const { aditivos = [] } = useAditivos(detailParceria?.id, !!detailParceria);
    const [viewFilters, setViewFilters] = useState(buildDefaultFilters());
    const [sortRules, setSortRules] = useState(buildDefaultSortRules());
    const [isPrefsInitialized, setIsPrefsInitialized] = useState(false);

    const currentYear = new Date().getFullYear();
    const years = useMemo(() => {
        const set = new Set([currentYear]);
        parcerias.forEach((p) => {
            const date = parseLocalDate(getParceriaField(p, 'signature_date'))
                || parseLocalDate(getParceriaField(p, 'pgea_date'))
                || parseLocalDate(getParceriaField(p, 'created_at'));
            const y = isValid(date) ? date.getFullYear() : null;
            if (y && !isNaN(y)) set.add(y);
        });
        return Array.from(set).sort((a, b) => b - a);
    }, [parcerias, currentYear]);

    const availableResponsibles = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const n = getParceriaField(p, 'responsible_user_name');
            if (n && typeof n === 'string' && n.trim()) set.add(n.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [parcerias]);

    const assessors = useMemo(() =>
        members.filter((m) => {
            const fn = (m.function || '').toLowerCase();
            return fn.includes('assessor') || fn.includes('assessoria');
        }),
        [members]
    );

    const filtersKey = `kanban_parceria_filters_${organization?.id || 'default'}`;
    const sortRulesKey = `kanban_parceria_sortRules_${organization?.id || 'default'}`;

    useEffect(() => {
        if (isLoadingPrefs) return;
        const stored = preferences?.[filtersKey] || null;
        const storedSort = preferences?.[sortRulesKey] || null;
        setViewFilters(stored && typeof stored === 'object' ? { ...buildDefaultFilters(), ...stored } : buildDefaultFilters());
        setSortRules(Array.isArray(storedSort) && storedSort.length ? storedSort : buildDefaultSortRules());
        setIsPrefsInitialized(true);
    }, [preferences, isLoadingPrefs, filtersKey, sortRulesKey]);

    const saveTimerRef = useRef(null);
    useEffect(() => {
        if (!isPrefsInitialized) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updatePreferences({ [filtersKey]: viewFilters, [sortRulesKey]: sortRules });
        }, 500);
        return () => clearTimeout(saveTimerRef.current);
    }, [viewFilters, sortRules, isPrefsInitialized, updatePreferences, filtersKey, sortRulesKey]);

    const filteredParcerias = useMemo(() => {
        return parcerias.filter((p) => {
            const date = parseLocalDate(getParceriaField(p, 'signature_date'))
                || parseLocalDate(getParceriaField(p, 'pgea_date'))
                || parseLocalDate(getParceriaField(p, 'created_at'));
            if (!isValid(date)) return false;
            if (date.getFullYear() !== selectedYear) return false;
            if (viewFilters.type !== 'all' && getParceriaField(p, 'partnership_type') !== viewFilters.type) return false;
            if (viewFilters.responsible !== 'all' && getParceriaField(p, 'responsible_user_name') !== viewFilters.responsible) return false;
            if (viewFilters.hasAdditive === 'yes' && !hasAdditives(p)) return false;
            if (viewFilters.hasAdditive === 'no' && hasAdditives(p)) return false;
            return true;
        });
    }, [parcerias, selectedYear, viewFilters]);

    const columns = useMemo(() => {
        // Colunas visíveis no Kanban (dinâmicas conforme thirdPartyPhaseEnabled).
        const grouped = {};
        columns_list.forEach((c) => { grouped[c.id] = []; });
        // Garante que todas as colunas base existam, mesmo se desabilitadas
        // (parcerias nessa fase vão para a primeira coluna visível à esquerda).
        filteredParcerias.forEach((p) => {
            const status = calculateParceriaDerivedStatus(p);
            if (grouped[status]) {
                grouped[status].push(p);
            } else {
                // Fase não-visível (ex.: Aguarda Terceiros desabilitada) → joga
                // na fase anterior visível, mantendo o card na UI.
                const fallback = grouped['Revisão'] || grouped['Em análise'] || grouped['Pendente'] || [];
                fallback.push(p);
            }
        });
        return grouped;
    }, [filteredParcerias, columns_list]);

    const activeParceria = useMemo(() => {
        if (!activeId) return null;
        return filteredParcerias.find((p) => p.id === activeId) || null;
    }, [activeId, filteredParcerias]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

    const getColumnIndex = (status) => columns_list.findIndex((c) => c.id === status);

    const handleViewDetails = useCallback((p) => {
        setDetailParceria(p);
        setDetailOpen(true);
    }, []);

    const handleEditFromDetail = useCallback((p) => {
        setDetailOpen(false);
        setEditParceria(p);
        setEditOpen(true);
    }, []);

    const handleBackwardMove = useCallback(async (parceria, fromStatus, toStatus) => {
        const pgea = getParceriaField(parceria, 'pgea');
        const colLabel = columns_list.find((c) => c.id === toStatus)?.label || toStatus;
        const rollbackByStatus = {
            'Pendente': {
                responsible_user_id: null,
                responsible_user_name: null,
                responsibility_date: null,
                network_folder: '',
                observations: '',
                review_conclusion_date: null,
                third_party: null,
                partnership_type: null,
                partnership_number: null,
                signature_date: null,
                validity_period: null,
                end_date: null,
                renewal_notice_date: null,
                extinguished: false,
            },
            'Em análise': {
                network_folder: '',
                observations: '',
                review_conclusion_date: null,
                third_party: null,
                partnership_type: null,
                partnership_number: null,
                signature_date: null,
                validity_period: null,
                end_date: null,
                renewal_notice_date: null,
            },
            'Revisão': {
                review_conclusion_date: null,
                third_party: null,
                partnership_type: null,
                partnership_number: null,
                signature_date: null,
                validity_period: null,
                end_date: null,
                renewal_notice_date: null,
            },
            'Aguarda Terceiros': {
                partnership_type: null,
                partnership_number: null,
                signature_date: null,
                validity_period: null,
                end_date: null,
                renewal_notice_date: null,
            },
            'Parcerias': {
                extinguished: true, // para diferenciar visualmente
            },
        };
        const changes = {
            status: toStatus,
            ...(rollbackByStatus[toStatus] || {}),
        };
        try {
            await updateParceria({ id: parceria.id, organizationId: organization.id, changes });
            toast.success(`Parceria ${pgea} retornou para "${colLabel}".`);
        } catch (err) {
            toast.error('Erro ao mover Parceria: ' + err.message);
        }
    }, [organization, columns_list]);

    const handleForwardTransition = useCallback((parceria, fromStatus, toStatus) => {
        if (fromStatus === 'Pendente' && toStatus === 'Em análise') {
            setPendingParceria(parceria);
            setPendingTarget(toStatus);
            setDialogMode('assign');
            setDialogOpen(true);
            return;
        }
        if (fromStatus === 'Em análise' && toStatus === 'Revisão') {
            setPendingParceria(parceria);
            setPendingTarget(toStatus);
            setDialogMode('review');
            setDialogOpen(true);
            return;
        }
        if (
            (fromStatus === 'Em análise' || fromStatus === 'Revisão') &&
            toStatus === 'Aguarda Terceiros'
        ) {
            setPendingParceria(parceria);
            setPendingTarget(toStatus);
            setDialogMode('third_party');
            setDialogOpen(true);
            return;
        }
        if (fromStatus === 'Aguarda Terceiros' && toStatus === 'Parcerias') {
            setPendingParceria(parceria);
            setPendingTarget(toStatus);
            setDialogMode('formalize');
            setDialogOpen(true);
            return;
        }
        if (fromStatus === 'Parcerias' && toStatus === 'Extintos') {
            setExtinguishTarget(parceria);
            setExtinguishOpen(true);
            return;
        }
    }, []);

    const handleDragStart = useCallback((event) => setActiveId(event.active.id), []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;
        const parceria = filteredParcerias.find((p) => p.id === active.id);
        if (!parceria) return;
        const currentStatus = calculateParceriaDerivedStatus(parceria);
        const targetColumnId = over.data?.current?.columnId || over.id;
        if (currentStatus === targetColumnId) return;
        const currentIdx = getColumnIndex(currentStatus);
        const targetIdx = getColumnIndex(targetColumnId);
        if (currentIdx < 0 || targetIdx < 0) {
            toast.error('Não foi possível identificar a coluna.');
            return;
        }
        const isForward = validForward[currentIdx]?.includes(targetIdx);
        const isBackward = targetIdx < currentIdx;
        if (!isForward && !isBackward) {
            toast.error('Para avançar, mova para a próxima fase do fluxo.');
            return;
        }
        if (isBackward) {
            handleBackwardMove(parceria, currentStatus, targetColumnId);
        } else {
            handleForwardTransition(parceria, currentStatus, targetColumnId);
        }
    }, [filteredParcerias, handleBackwardMove, handleForwardTransition, columns_list, validForward]);

    const handleDialogConfirm = async (data) => {
        if (!pendingParceria || !pendingTarget) return;
        const pgea = getParceriaField(pendingParceria, 'pgea');
        try {
            await updateParceria({
                id: pendingParceria.id,
                organizationId: organization.id,
                changes: { ...data, status: pendingTarget },
            });
            const messages = {
                assign: `Parceria ${pgea} em análise!`,
                review: `Parceria ${pgea} em revisão!`,
                third_party: `Parceria ${pgea} remetida a terceiros!`,
                formalize: `Parceria ${pgea} formalizada!`,
            };
            toast.success(messages[dialogMode]);
        } catch (err) {
            toast.error('Erro ao atualizar Parceria: ' + err.message);
            throw err;
        }
        setPendingParceria(null);
        setPendingTarget(null);
    };

    if (parceriasLoading) {
        return (
            <Card className="p-12 flex items-center justify-center">
                <span className="text-slate-500">Carregando...</span>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel de Parcerias</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Arraste as Parcerias entre as colunas para gerenciar as fases do fluxo.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Parceria
                    </Button>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="h-10 pl-3 pr-8 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {years.map((y) => <option key={y} value={y}>Ano: {y}</option>)}
                    </select>
                    <Badge variant="outline" className="text-xs text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-3 py-1">
                        {filteredParcerias.length} {filteredParcerias.length === 1 ? 'parceria' : 'parcerias'}
                    </Badge>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                    const p = pointerWithin(args);
                    if (p.length > 0) return p;
                    return closestCorners(args);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns_list.length}, minmax(0, 1fr))` }}>
                    {columns_list.map((col) => (
                        <KanbanColumn
                            key={col.id}
                            column={col}
                            parcerias={columns[col.id] || []}
                            onViewDetails={handleViewDetails}
                            onIncludeAditivo={(p) => {
                                setAditivoTarget(p);
                                setAditivoDialogOpen(true);
                            }}
                        />
                    ))}
                </div>
                <DragOverlay dropAnimation={null}>
                    {activeParceria ? <ParceriaKanbanCard parceria={activeParceria} overlay /> : null}
                </DragOverlay>
            </DndContext>

            {pendingParceria && (
                <ParceriaKanbanTransitionDialog
                    open={dialogOpen}
                    onClose={() => { setDialogOpen(false); setPendingParceria(null); setPendingTarget(null); }}
                    mode={dialogMode}
                    parceria={pendingParceria}
                    assessors={assessors}
                    thirdParties={thirdParties}
                    onConfirm={handleDialogConfirm}
                />
            )}

            <ParceriaDetailSheet
                parceria={detailParceria}
                open={detailOpen}
                onClose={() => { setDetailOpen(false); setDetailParceria(null); }}
                onEdit={handleEditFromDetail}
                onIncludeAditivo={(p) => { setDetailOpen(false); setAditivoTarget(p); setAditivoDialogOpen(true); }}
                onExtinguish={(p) => { setDetailOpen(false); setExtinguishTarget(p); setExtinguishOpen(true); }}
                onViewLog={() => setLogOpen(true)}
                aditivos={aditivos}
                currentAdditiveId={detailParceria?.current_additive_id}
                userRole={userRole}
                organizationId={organization.id}
                members={members}
            />

            {editParceria && (
                <EditParceriaDialog
                    open={editOpen}
                    setOpen={(o) => { setEditOpen(o); if (!o) setEditParceria(null); }}
                    parceria={editParceria}
                    members={members}
                    organizationId={organization.id}
                    organization={organization}
                    userRole={userRole}
                    onSuccess={() => { setEditOpen(false); setEditParceria(null); }}
                />
            )}

            {aditivoTarget && (
                <CreateAditivoDialog
                    open={aditivoDialogOpen}
                    onClose={() => { setAditivoDialogOpen(false); setAditivoTarget(null); }}
                    parceria={aditivoTarget}
                    organizationId={organization.id}
                    organization={organization}
                    onSuccess={() => { setAditivoDialogOpen(false); setAditivoTarget(null); }}
                />
            )}

            {extinguishTarget && (
                <ExtinguishConfirmDialog
                    open={extinguishOpen}
                    onClose={() => { setExtinguishOpen(false); setExtinguishTarget(null); }}
                    parceria={extinguishTarget}
                    organizationId={organization.id}
                    onSuccess={() => { setExtinguishOpen(false); setExtinguishTarget(null); }}
                />
            )}

            {detailParceria && (
                <ProcessLogDialog
                    open={logOpen}
                    onClose={() => setLogOpen(false)}
                    process={detailParceria}
                    collectionName="parcerias"
                />
            )}

            <CreateParceriaDialogWrapper
                open={createOpen}
                setOpen={setCreateOpen}
                organization={organization}
            />
        </div>
    );
}

function KanbanColumn({ column, parcerias, onViewDetails, onIncludeAditivo }) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { columnId: column.id } });
    const ColIcon = column.icon;
    const colorClasses = {
        slate: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-100', border: 'border-slate-200 dark:border-slate-600', col: 'bg-slate-50/30 dark:bg-slate-900' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-100', border: 'border-amber-200 dark:border-amber-600', col: 'bg-amber-50/30 dark:bg-amber-950/30' },
        sky:   { bg: 'bg-sky-50 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-100', border: 'border-sky-200 dark:border-sky-600', col: 'bg-sky-50/30 dark:bg-sky-950/30' },
        cyan:  { bg: 'bg-cyan-50 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-100', border: 'border-cyan-200 dark:border-cyan-600', col: 'bg-cyan-50/30 dark:bg-cyan-950/30' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-100', border: 'border-emerald-200 dark:border-emerald-600', col: 'bg-emerald-50/30 dark:bg-emerald-950/30' },
    };
    const c = colorClasses[column.color] || colorClasses.slate;
    return (
        <div
            ref={setNodeRef}
            className={`
                rounded-xl border flex flex-col
                ${c.border}
                ${isOver ? 'ring-2 ring-indigo-300 dark:ring-indigo-400 bg-indigo-50/30 dark:bg-indigo-500/10' : ''}
            `}
            style={{ minHeight: '500px' }}
        >
            <div className={`px-4 py-3 rounded-t-xl border-b flex items-center justify-between ${c.bg} ${c.border}`}>
                <div className="flex items-center gap-2">
                    <ColIcon className={`w-4 h-4 ${c.text}`} />
                    <span className={`text-sm font-bold ${c.text}`}>{column.label}</span>
                </div>
                <Badge variant="secondary" className="bg-white/60 dark:bg-black/25 text-slate-600 dark:text-white border-0">
                    {parcerias.length}
                </Badge>
            </div>
            <div className={`flex-1 p-3 space-y-2 ${c.col} rounded-b-xl overflow-y-auto`}
                style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
                <SortableContext items={parcerias.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    {parcerias.length > 0 ? (
                        parcerias.map((p) => (
                            <ParceriaKanbanCard
                                key={p.id}
                                parceria={p}
                                columnId={column.id}
                                onViewDetails={onViewDetails}
                            />
                        ))
                    ) : (
                        <EmptyState
                            icon={ColIcon}
                            title={`Nenhuma Parceria em "${column.label}"`}
                            description="Arraste Parcerias para cá conforme o fluxo avançar."
                            className="py-12 border-none shadow-none bg-transparent"
                        />
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

// Wrapper para evitar import circular.
import CreateParceriaDialog from './CreateParceriaDialog';
function CreateParceriaDialogWrapper({ open, setOpen, organization }) {
    return <CreateParceriaDialog open={open} setOpen={setOpen} organization={organization} onSuccess={() => setOpen(false)} />;
}
