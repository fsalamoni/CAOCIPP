import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Telescope, LayoutDashboard, Table2, Upload, BarChart3, Plus, Loader2,
    Settings, Database, AlertTriangle, Info, Trash2, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrgPermission } from '@/lib/OrganizationPermissionsContext';
import { usePanoramaBases, usePanoramaRegistros, PANORAMA_TETO_REGISTROS } from '@/hooks/usePanorama';
import { deletePanoramaRegistros } from '@/services/panoramaService';
import {
    resolveBase, rolesPreenchidos, roleMeta, PANORAMA_DEFAULT_ANALYSIS,
} from '@/constants/panorama';
import { filtrarRegistros, formatNumber } from '@/lib/panoramaEngine';
import { useJurimetriaPref } from '@/hooks/useJurimetriaPrefs';

import PanoramaFilters, {
    EMPTY_PANORAMA_FILTERS, describeFilters, describeAnalysis,
} from './panorama/PanoramaFilters';
import PanoramaTable, { buildPanoramaColumns } from './panorama/PanoramaTable';
import PanoramaDashboard from './panorama/PanoramaDashboard';
import PanoramaReports from './panorama/PanoramaReports';
import PanoramaDynamicReports from './panorama/PanoramaDynamicReports';
import PanoramaImport from './panorama/PanoramaImport';
import PanoramaFormDialog from './panorama/PanoramaFormDialog';
// Menu de exportação genérico — recebe linhas e a definição textual das colunas.
import JurimetriaExportMenu from './jurimetria/JurimetriaExportMenu';

/**
 * PanoramaControl — página Panorama do órgão.
 *
 * O módulo coringa: cada órgão cria as bases que precisa, e o ESQUEMA de cada
 * uma vem da planilha importada. A página é a mesma para todos; o que muda é a
 * base selecionada — suas colunas, seus papéis, seus desfechos.
 *
 * Os filtros no topo valem para TODAS as abas, de modo que o recorte analisado
 * é sempre o mesmo, inclusive nas exportações.
 */
export default function PanoramaControl({ organization, userRole, onGoToAdmin }) {
    // Identidade do usuário: é ela que decide quais modelos de relatório ele
    // pode editar ou excluir (a checagem definitiva é do servidor).
    const { user } = useAuth();
    const currentUserId = user?.uid || '';
    const canDelete = useOrgPermission('delete_records');
    const canConfigure = useOrgPermission('configure_panorama') || userRole === 'creator';

    const { bases, isLoading: basesLoading } = usePanoramaBases(organization?.id);
    const [baseId, setBaseId] = useJurimetriaPref('panorama_base', organization?.id, '');

    // Base selecionada: a gravada, se ainda existir; senão a primeira.
    const baseSelecionada = useMemo(() => {
        if (bases.length === 0) return null;
        return bases.find((b) => b.id === baseId) || bases[0];
    }, [bases, baseId]);

    const base = useMemo(
        () => (baseSelecionada ? resolveBase(baseSelecionada) : null),
        [baseSelecionada]
    );

    const {
        registros, isLoading: registrosLoading, pertoDoTeto, acimaDoTeto,
    } = usePanoramaRegistros(organization?.id, baseSelecionada?.id);

    const [filters, setFilters] = useState(EMPTY_PANORAMA_FILTERS);
    const [analysis, setAnalysis] = useJurimetriaPref(
        'panorama_analise', organization?.id, PANORAMA_DEFAULT_ANALYSIS
    );
    const [selectedIds, setSelectedIds] = useState([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [excluindo, setExcluindo] = useState(null);
    const [excluindoMassa, setExcluindoMassa] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Trocou de base: as colunas são outras, então filtros e seleção também.
    useEffect(() => {
        setFilters(EMPTY_PANORAMA_FILTERS);
        setSelectedIds([]);
        setFormOpen(false);
        setEditando(null);
    }, [baseSelecionada?.id, organization?.id]);

    const filtrados = useMemo(
        () => filtrarRegistros(registros, filters, base),
        [registros, filters, base]
    );

    // Mantém selecionados apenas os registros que continuam visíveis.
    useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.length === 0) return prev;
            const visiveis = new Set(filtrados.map((r) => r.id));
            const next = prev.filter((id) => visiveis.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [filtrados]);

    const subtitle = useMemo(() => {
        const partes = [
            base?.nome,
            describeFilters(filters, base),
            describeAnalysis(analysis, base),
        ].filter(Boolean);
        return partes.join(' · ');
    }, [base, filters, analysis]);

    const tableColumns = useMemo(
        () => (base ? buildPanoramaColumns(base).map((c) => ({ label: c.label, value: c.text })) : []),
        [base]
    );

    const papeis = useMemo(() => (base ? rolesPreenchidos(base) : []), [base]);

    const handleExcluir = async (ids) => {
        setDeleting(true);
        try {
            const resposta = await deletePanoramaRegistros({
                organizationId: organization.id, baseId: base.id, ids,
            });
            toast.success(`${formatNumber(resposta.excluidos || 0)} registro(s) excluído(s).`);
            setSelectedIds([]);
        } catch (error) {
            logger.error('[panorama] erro ao excluir:', error);
            toast.error(error?.message || 'Não foi possível excluir.');
        } finally {
            setDeleting(false);
            setExcluindo(null);
            setExcluindoMassa(false);
        }
    };

    if (basesLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Carregando as bases do órgão...
            </div>
        );
    }

    // Nenhuma base ainda: a tela explica o que o módulo é e como começar.
    if (bases.length === 0) {
        return (
            <div className="space-y-4">
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Telescope className="w-5 h-5 text-indigo-500" />
                            Panorama
                        </CardTitle>
                        <CardDescription>
                            O Panorama dá ao órgão a visão de conjunto da sua área de atuação, a partir
                            das planilhas que ele já mantém. Diferente dos outros módulos, aqui{' '}
                            <strong>as colunas não são fixas</strong>: elas vêm da planilha que você
                            importar. A plataforma lê o arquivo, identifica cada coluna e propõe o que
                            ela significa para a análise — data, território, responsável, assunto,
                            resultado, valor, prazo. Você confirma, e a partir daí tem painel,
                            relatórios e exportações sobre os seus próprios dados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <Info className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                Para começar, vá à aba <strong>Importação</strong> e envie uma planilha.
                                A base será criada com as colunas dela. Não é preciso preparar nada
                                antes — a planilha que o órgão já usa serve.
                            </AlertDescription>
                        </Alert>
                        {!canConfigure && (
                            <Alert>
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription className="text-sm">
                                    Criar uma base exige a permissão <strong>Configurar Panorama</strong>.
                                    Peça ao criador do órgão que a conceda, ou que crie a primeira base.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {canConfigure && (
                    <PanoramaImport
                        organization={organization}
                        base={null}
                        bases={[]}
                        podeConfigurar={canConfigure}
                        onBaseCriada={(id) => setBaseId(id)}
                        onImported={() => {}}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Seletor de base */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                            <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <Select value={baseSelecionada?.id || ''} onValueChange={setBaseId}>
                                <SelectTrigger className="h-9 max-w-md font-medium">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {bases.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {base?.descricao && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                    {base.descricao}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                            {formatNumber(registros.length)} registro(s)
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                            {formatNumber(base?.columns?.length || 0)} coluna(s)
                        </Badge>
                        <Badge variant="outline" className="text-xs" title={papeis.map((p) => roleMeta(p)?.label).join(', ')}>
                            {papeis.length}/10 papéis
                        </Badge>
                        {canConfigure && onGoToAdmin && (
                            <Button variant="outline" size="sm" onClick={onGoToAdmin} className="gap-1.5">
                                <Settings className="w-3.5 h-3.5" />
                                Configurar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {acimaDoTeto && (
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Esta base passou de {formatNumber(PANORAMA_TETO_REGISTROS)} registros. O módulo
                        calcula tudo no navegador, e acima desse volume a tela fica lenta. Considere
                        dividir a base por período ou por área — cada base é independente e os relatórios
                        continuam funcionando em cada uma.
                    </AlertDescription>
                </Alert>
            )}
            {!acimaDoTeto && pertoDoTeto && (
                <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Esta base está se aproximando do limite de{' '}
                        {formatNumber(PANORAMA_TETO_REGISTROS)} registros para cálculo instantâneo.
                    </AlertDescription>
                </Alert>
            )}

            {papeis.length === 0 && (
                <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Nenhuma coluna desta base tem um <strong>papel</strong> atribuído, então o painel e
                        os relatórios não têm o que calcular. Abra{' '}
                        {canConfigure ? 'o Painel Administrativo → Panorama' : 'a configuração do módulo'} e
                        diga qual coluna é a data, qual é o território, qual é o resultado.
                    </AlertDescription>
                </Alert>
            )}

            {/* Filtros — valem para todas as abas */}
            <PanoramaFilters
                filters={filters}
                onChange={setFilters}
                base={base}
                registros={registros}
                analysis={analysis}
                onAnalysisChange={setAnalysis}
            />

            <Tabs defaultValue="painel" className="space-y-4">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="painel" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <LayoutDashboard className="w-4 h-4" />
                        Painel
                    </TabsTrigger>
                    <TabsTrigger value="dados" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                        <Table2 className="w-4 h-4" />
                        Dados
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
                        <Sparkles className="w-4 h-4" />
                        Relatórios dinâmicos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="painel" className="mt-0">
                    {registrosLoading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando os registros...
                        </div>
                    ) : (
                        <PanoramaDashboard registros={filtrados} base={base} analysis={analysis} />
                    )}
                </TabsContent>

                <TabsContent value="dados" className="space-y-4 mt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={() => { setEditando(null); setFormOpen(true); }} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Novo registro
                            </Button>
                            {canDelete && selectedIds.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setExcluindoMassa(true)}
                                    className="gap-2 text-rose-600 hover:text-rose-700"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir {formatNumber(selectedIds.length)}
                                </Button>
                            )}
                        </div>
                        <JurimetriaExportMenu
                            rows={filtrados}
                            columns={tableColumns}
                            filenameBase={`panorama-${base?.nome || 'dados'}`}
                            title={base?.nome || 'Panorama'}
                            subtitle={subtitle}
                            disabled={filtrados.length === 0}
                        />
                    </div>

                    {registrosLoading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando os registros...
                        </div>
                    ) : (
                        <PanoramaTable
                            registros={filtrados}
                            base={base}
                            onView={(r) => { setEditando(r); setFormOpen(true); }}
                            onEdit={(r) => { setEditando(r); setFormOpen(true); }}
                            onDelete={(r) => setExcluindo(r)}
                            canDelete={canDelete}
                            selectable={canDelete}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                        />
                    )}
                </TabsContent>

                <TabsContent value="importacao" className="mt-0">
                    <PanoramaImport
                        organization={organization}
                        base={base}
                        bases={bases}
                        podeConfigurar={canConfigure}
                        onBaseCriada={(id) => setBaseId(id)}
                        onImported={() => {}}
                    />
                </TabsContent>

                <TabsContent value="relatorios" className="mt-0">
                    {registrosLoading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando os registros...
                        </div>
                    ) : (
                        <PanoramaReports
                            registros={filtrados}
                            base={base}
                            analysis={analysis}
                            subtitle={subtitle}
                            organizationId={organization?.id}
                        />
                    )}
                </TabsContent>

                <TabsContent value="dinamicos" className="mt-0">
                    {registrosLoading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Carregando os registros...
                        </div>
                    ) : (
                        <PanoramaDynamicReports
                            registros={filtrados}
                            base={base}
                            analysis={analysis}
                            subtitle={subtitle}
                            organizationId={organization?.id}
                            currentUserId={currentUserId}
                            isOrgAdmin={canConfigure}
                        />
                    )}
                </TabsContent>
            </Tabs>

            <PanoramaFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                organization={organization}
                base={base}
                registro={editando}
                onSaved={() => {}}
            />

            <AlertDialog open={Boolean(excluindo)} onOpenChange={(o) => !o && setExcluindo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A exclusão é definitiva. O registro sai da base e de todos os relatórios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleExcluir([excluindo.id])}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {deleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={excluindoMassa} onOpenChange={setExcluindoMassa}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Excluir {formatNumber(selectedIds.length)} registro(s)?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            A exclusão é definitiva e atinge todos os selecionados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleExcluir(selectedIds)}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {deleting ? 'Excluindo...' : 'Excluir todos'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
