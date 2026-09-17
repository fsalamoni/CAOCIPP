import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    LayoutDashboard, Table2, Upload, BarChart3, Grid3x3, Plus, Loader2,
    Wand2, Trash2, Scale, Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useOrgPermission } from '@/lib/OrganizationPermissionsContext';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { resolveJurimetriaSettings, JURIMETRIA_DEFAULT_ANALYSIS } from '@/constants/jurimetria';
import { filtrarJuris, formatNumber } from '@/lib/jurimetriaEngine';
import { useJurimetriaPref } from '@/hooks/useJurimetriaPrefs';
import { deleteJuri, deleteJuris } from '@/services/jurimetriaService';

import JurimetriaFilters, {
    EMPTY_JURIMETRIA_FILTERS, describeFilters, describeAnalysis,
} from './jurimetria/JurimetriaFilters';
import JurimetriaDashboard from './jurimetria/JurimetriaDashboard';
import JuriTable, { buildJuriColumns } from './jurimetria/JuriTable';
import JuriFormDialog from './jurimetria/JuriFormDialog';
import JuriDetailSheet from './jurimetria/JuriDetailSheet';
import JuriBulkDialog from './jurimetria/JuriBulkDialog';
import JurimetriaImport from './jurimetria/JurimetriaImport';
import JurimetriaReports from './jurimetria/JurimetriaReports';
import JurimetriaDynamicReports from './jurimetria/JurimetriaDynamicReports';
import JurimetriaExportMenu from './jurimetria/JurimetriaExportMenu';

/**
 * JurimetriaControl — página de Jurimetria do órgão.
 *
 * Reúne, em abas, tudo o que o módulo oferece: painel de indicadores, base de
 * júris (CRUD + ações em massa), importação de planilhas, relatórios estáticos
 * e relatórios dinâmicos. Os filtros no topo valem para TODAS as abas, de modo
 * que o recorte analisado é sempre o mesmo, inclusive nas exportações.
 *
 * A configuração do módulo (listas oficiais, pontuação, colunas próprias) fica
 * no Painel Administrativo → Jurimetria, seguindo o padrão dos demais módulos.
 */
export default function JurimetriaControl({
    organization,
    members = [],
    userRole,
    juris = [],
    jurisLoading = false,
    jurisError = null,
    onGoToAdmin,
}) {
    const settings = useMemo(() => resolveJurimetriaSettings(organization), [organization]);
    // Identidade do usuário: é ela que decide quais modelos de relatório ele
    // pode editar ou excluir (a checagem definitiva é do servidor).
    const { user } = useAuth();
    const currentUserId = user?.uid || '';
    const canDelete = useOrgPermission('delete_records');
    const canConfigure = useOrgPermission('configure_jurimetria') || userRole === 'creator';

    const [filters, setFilters] = useState(EMPTY_JURIMETRIA_FILTERS);
    const [selectedIds, setSelectedIds] = useState([]);

    // Opções de ANÁLISE (como o recorte é contado) — diferentes dos filtros
    // (o que entra no recorte). Ficam gravadas por órgão: quem trabalha
    // contando só as sessões realizadas não quer reconfigurar isso toda vez.
    const [analysis, setAnalysis] = useJurimetriaPref(
        'analise', organization?.id, JURIMETRIA_DEFAULT_ANALYSIS
    );

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [detailJuri, setDetailJuri] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Ao trocar de órgão, zera filtros, seleção e diálogos abertos — sem isso,
    // uma seleção feita num órgão continuaria "viva" em outro.
    useEffect(() => {
        setFilters(EMPTY_JURIMETRIA_FILTERS);
        setSelectedIds([]);
        setFormOpen(false);
        setEditing(null);
        setDetailOpen(false);
        setDetailJuri(null);
        setBulkOpen(false);
    }, [organization?.id]);

    const filtered = useMemo(
        () => filtrarJuris(juris, filters, settings),
        [juris, filters, settings]
    );

    // Mantém selecionados apenas os júris que continuam visíveis no recorte.
    useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.length === 0) return prev;
            const visible = new Set(filtered.map((j) => j.id));
            const next = prev.filter((id) => visible.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [filtered]);

    // Listas alimentadas pelo que EXISTE na base do órgão.
    const availableComarcas = useMemo(
        () => [...new Set(juris.map((j) => j.comarca).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [juris]
    );
    const availablePromotores = useMemo(
        () => [...new Set(juris.map((j) => j.promotor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [juris]
    );

    const subtitle = useMemo(() => describeFilters(filters, settings), [filters, settings]);

    // Legenda impressa nos relatórios e nos documentos exportados: o leitor
    // precisa saber qual recorte E qual critério de contagem gerou o número.
    const criterio = useMemo(() => describeAnalysis(analysis), [analysis]);
    const reportSubtitle = useMemo(
        () => [subtitle, criterio].filter(Boolean).join(' · '),
        [subtitle, criterio]
    );

    const tableColumns = useMemo(
        () => buildJuriColumns(settings).map((c) => ({ label: c.label, value: c.text })),
        [settings]
    );

    // Mantém a ficha lateral sincronizada com a atualização em tempo real.
    useEffect(() => {
        if (!detailJuri) return;
        const fresh = juris.find((j) => j.id === detailJuri.id);
        if (fresh && fresh !== detailJuri) setDetailJuri(fresh);
        if (!fresh) { setDetailOpen(false); setDetailJuri(null); }
    }, [juris, detailJuri]);

    const handleNew = () => { setEditing(null); setFormOpen(true); };
    const handleEdit = (juri) => { setEditing(juri); setFormOpen(true); };
    const handleView = (juri) => { setDetailJuri(juri); setDetailOpen(true); };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteJuri(organization.id, deleteTarget.id);
            toast.success('Júri excluído.');
            if (detailJuri?.id === deleteTarget.id) { setDetailOpen(false); setDetailJuri(null); }
            setDeleteTarget(null);
        } catch (err) {
            logger.error('[jurimetria] erro ao excluir júri:', err);
            toast.error(err?.message || 'Não foi possível excluir o júri.');
        } finally {
            setDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setDeleting(true);
        try {
            const result = await deleteJuris(organization.id, selectedIds);
            toast.success(`${result?.deleted ?? 0} júri(s) excluído(s).`);
            setSelectedIds([]);
            setBulkDeleteOpen(false);
        } catch (err) {
            logger.error('[jurimetria] erro na exclusão em massa:', err);
            toast.error(err?.message || 'Não foi possível excluir os júris selecionados.');
        } finally {
            setDeleting(false);
        }
    };

    if (jurisLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Carregando a base de júris...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Scale className="w-6 h-6 text-indigo-500" />
                        Jurimetria
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Base de júris do órgão: {formatNumber(juris.length)} registro(s)
                        {filtered.length !== juris.length && (
                            <> — {formatNumber(filtered.length)} no recorte atual</>
                        )}
                        .
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canConfigure && onGoToAdmin && (
                        <Button variant="outline" size="sm" onClick={onGoToAdmin} className="gap-2">
                            <Settings className="w-4 h-4" />
                            Configurar
                        </Button>
                    )}
                    <JurimetriaExportMenu
                        rows={filtered}
                        columns={tableColumns}
                        filenameBase="jurimetria-juris"
                        title="Base de júris"
                        subtitle={subtitle}
                        label="Exportar base"
                    />
                    <Button size="sm" onClick={handleNew} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Novo júri
                    </Button>
                </div>
            </div>

            {jurisError && (
                <Alert variant="destructive">
                    <AlertDescription>
                        Não foi possível carregar os júris: {jurisError}
                    </AlertDescription>
                </Alert>
            )}

            {/* Filtros — valem para todas as abas */}
            <JurimetriaFilters
                filters={filters}
                onChange={setFilters}
                settings={settings}
                members={members}
                availableComarcas={availableComarcas}
                availablePromotores={availablePromotores}
                analysis={analysis}
                onAnalysisChange={setAnalysis}
            />

            <Tabs defaultValue="painel" className="space-y-4">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="painel" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <LayoutDashboard className="w-4 h-4" />
                        Painel
                    </TabsTrigger>
                    <TabsTrigger value="juris" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <Table2 className="w-4 h-4" />
                        Júris
                        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                            {formatNumber(filtered.length)}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="importacao" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <Upload className="w-4 h-4" />
                        Importação
                    </TabsTrigger>
                    <TabsTrigger value="relatorios" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <BarChart3 className="w-4 h-4" />
                        Relatórios
                    </TabsTrigger>
                    <TabsTrigger value="dinamicos" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <Grid3x3 className="w-4 h-4" />
                        Relatórios dinâmicos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="painel" className="mt-0">
                    <JurimetriaDashboard
                        juris={filtered}
                        settings={settings}
                        analysis={analysis}
                    />
                </TabsContent>

                <TabsContent value="juris" className="mt-0 space-y-3">
                    {selectedIds.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 px-4 py-3">
                            <p className="text-sm text-indigo-900 dark:text-indigo-100">
                                <strong>{selectedIds.length}</strong> júri(s) selecionado(s).
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} className="gap-2">
                                    <Wand2 className="w-4 h-4" />
                                    Alterar em massa
                                </Button>
                                {canDelete && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setBulkDeleteOpen(true)}
                                        className="gap-2 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Excluir selecionados
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                                    Limpar seleção
                                </Button>
                            </div>
                        </div>
                    )}

                    <JuriTable
                        juris={filtered}
                        settings={settings}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={setDeleteTarget}
                        canDelete={canDelete}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        emptyAction={(
                            <Button onClick={handleNew} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Cadastrar o primeiro júri
                            </Button>
                        )}
                    />
                </TabsContent>

                <TabsContent value="importacao" className="mt-0">
                    <JurimetriaImport organization={organization} settings={settings} />
                </TabsContent>

                <TabsContent value="relatorios" className="mt-0">
                    <JurimetriaReports
                        juris={filtered}
                        settings={settings}
                        subtitle={reportSubtitle}
                        analysis={analysis}
                        organizationId={organization?.id}
                        currentUserId={currentUserId}
                        isOrgAdmin={canConfigure}
                    />
                </TabsContent>

                <TabsContent value="dinamicos" className="mt-0">
                    <JurimetriaDynamicReports
                        juris={filtered}
                        settings={settings}
                        subtitle={reportSubtitle}
                        analysis={analysis}
                        organizationId={organization?.id}
                    />
                </TabsContent>
            </Tabs>

            {/* Diálogos */}
            <JuriFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                organization={organization}
                settings={settings}
                members={members}
                juri={editing}
            />

            <JuriDetailSheet
                juri={detailJuri}
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                onEdit={(juri) => { setDetailOpen(false); handleEdit(juri); }}
                onDelete={(juri) => { setDetailOpen(false); setDeleteTarget(juri); }}
                settings={settings}
                canDelete={canDelete}
            />

            <JuriBulkDialog
                open={bulkOpen}
                onOpenChange={setBulkOpen}
                organization={organization}
                settings={settings}
                members={members}
                selectedIds={selectedIds}
                onDone={() => setSelectedIds([])}
            />

            <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir este júri?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O júri <strong className="font-mono">{deleteTarget?.numero_processo}</strong> e todo o seu
                            histórico serão apagados. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); confirmDelete(); }}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {selectedIds.length} júri(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Todos os júris selecionados e seus históricos serão apagados. Esta ação não pode
                            ser desfeita. Considere exportar a base antes, pelo botão “Exportar base”.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); confirmBulkDelete(); }}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Excluir {selectedIds.length}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
