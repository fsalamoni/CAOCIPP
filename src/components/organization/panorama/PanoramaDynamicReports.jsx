import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EmptyState from '@/components/ui/EmptyState';
import {
    Table2, FileText, Play, Save, Bookmark, Trash2, Pencil, Copy, Download,
    Loader2, Info, AlertTriangle, X, Plus, FileType2, FileCode,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { usePanoramaTemplates } from '@/hooks/usePanorama';
import {
    createPanoramaTemplate, updatePanoramaTemplate, deletePanoramaTemplate,
} from '@/services/panoramaService';
import {
    buildPivot, formatPivotValue, measureLabel, buildDescritivo,
    dimensionLabel, formatNumber, PANORAMA_ESTILOS_DESCRITIVO,
} from '@/lib/panoramaEngine';
import { dimensoesDaBase, medidasDaBase } from '@/constants/panorama';
import {
    exportTableToExcel, exportTableToPdf, exportTableToDoc, exportTableToMarkdown,
    exportTableToCsv, exportToJson, exportMarkdown, exportMarkdownToDoc,
    exportMarkdownToPdf, exportMarkdownToTxt, dateSuffix,
} from '@/lib/jurimetriaExport';

const DEFAULT_PIVOT = {
    rowDims: [''],
    colDims: [''],
    values: ['quantidade'],
    showAs: 'valor',
};

const DEFAULT_DESCRITIVO = {
    estilo: 'formal',
    titulo: '',
    dimensoes: [],
    limite: 15,
    incluir: {
        totais: true, distribuicao: true, serie: true,
        prescricao: true, gargalos: true, concentracao: true, cruzamentos: true,
    },
};

const SECOES_DESCRITIVO = [
    { key: 'totais', label: 'Panorama geral', hint: 'Totais, aproveitamento e valores.' },
    { key: 'distribuicao', label: 'Distribuição por dimensão', hint: 'Como o conjunto se reparte em cada dimensão escolhida.' },
    { key: 'serie', label: 'Evolução no tempo', hint: 'Série mensal, quando há data principal mapeada.' },
    { key: 'prescricao', label: 'Situação de prescrição', hint: 'Prazos vencidos, críticos e em alerta.' },
    { key: 'gargalos', label: 'Gargalos e carga de trabalho', hint: 'Onde os registros se acumulam, e há quanto tempo.' },
    { key: 'concentracao', label: 'Concentração', hint: 'Se poucos pontos respondem por muito. Não sai no estilo formal.' },
    { key: 'cruzamentos', label: 'Cruzamento entre dimensões', hint: 'Tabelas cruzadas. Exclusivo do estilo analítico.' },
];

const SHOW_AS = [
    { value: 'valor', label: 'Valor absoluto' },
    { value: 'linha', label: '% da linha' },
    { value: 'coluna', label: '% da coluna' },
    { value: 'total', label: '% do total geral' },
];

/**
 * Relatórios dinâmicos do Panorama.
 *
 * Duas construções sobre a MESMA base filtrada: a tabela dinâmica (cruzar
 * qualquer dimensão com qualquer outra) e o relatório descritivo (texto pronto
 * para instruir expediente).
 *
 * Duas decisões de projeto que valem explicação:
 *
 * 1. Nada é recalculado enquanto o usuário monta a configuração. O resultado
 *    só aparece quando ele clica em "Gerar". Numa base de 20 mil registros,
 *    recalcular a cada clique travaria a tela — e, pior, mostraria resultados
 *    intermediários que ninguém pediu.
 *
 * 2. Os modelos ficam no banco, visíveis para todo o órgão. Qualquer um usa o
 *    modelo de qualquer um; só o autor e o administrador editam ou excluem. A
 *    checagem definitiva é do servidor: aqui os botões apenas não são
 *    oferecidos a quem não poderia executá-los.
 */
export default function PanoramaDynamicReports({
    registros = [],
    base,
    analysis,
    subtitle = '',
    organizationId,
    currentUserId = '',
    isOrgAdmin = false,
}) {
    const dimensions = useMemo(() => dimensoesDaBase(base), [base]);
    const measures = useMemo(() => medidasDaBase(base), [base]);
    const { templates } = usePanoramaTemplates(organizationId, base?.id);

    const [pivotConfig, setPivotConfig] = useState(DEFAULT_PIVOT);
    const [pivotGerado, setPivotGerado] = useState(null);
    const [descConfig, setDescConfig] = useState(DEFAULT_DESCRITIVO);
    const [descGerado, setDescGerado] = useState(null);

    const [templateName, setTemplateName] = useState('');
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [excluindo, setExcluindo] = useState(null);

    // Trocar de base invalida tudo: as dimensões de uma não existem na outra.
    useEffect(() => {
        setPivotConfig(DEFAULT_PIVOT);
        setPivotGerado(null);
        setDescConfig(DEFAULT_DESCRITIVO);
        setDescGerado(null);
        setEditingTemplate(null);
        setTemplateName('');
    }, [base?.id]);

    // O admin removeu do órgão uma coluna que a tabela gerada usava como eixo:
    // o resultado na tela passaria a mostrar um eixo que não existe mais.
    useEffect(() => {
        if (!pivotGerado) return;
        const validas = new Set(dimensions.map((d) => d.key));
        const usadas = [...pivotGerado.rowDims, ...pivotGerado.colDims].filter(Boolean);
        if (usadas.some((d) => !validas.has(d))) setPivotGerado(null);
    }, [dimensions, pivotGerado]);

    const rowDims = pivotConfig.rowDims.filter(Boolean);
    const colDims = pivotConfig.colDims.filter(Boolean);

    const validationError = useMemo(() => {
        if (rowDims.length === 0 && colDims.length === 0) {
            return 'Escolha ao menos uma dimensão para as linhas ou para as colunas.';
        }
        const repetida = [...rowDims, ...colDims]
            .find((d, i, arr) => arr.indexOf(d) !== i);
        if (repetida) {
            return `A dimensão "${dimensionLabel(repetida, base)}" está em dois eixos ao mesmo tempo.`;
        }
        if (pivotConfig.values.filter(Boolean).length === 0) {
            return 'Escolha ao menos uma medida.';
        }
        return null;
    }, [rowDims, colDims, pivotConfig.values, base]);

    // O cálculo só roda sobre a configuração GERADA — nunca sobre o rascunho.
    const pivot = useMemo(() => {
        if (!pivotGerado) return null;
        return buildPivot(registros, pivotGerado, base, analysis);
    }, [registros, pivotGerado, base, analysis]);

    // Medidas e eixos do pivô GERADO. O cabeçalho e o corpo da tabela têm de
    // contar exatamente as mesmas colunas: divergir aqui desalinha o cabeçalho
    // do dado — e no arquivo exportado o rótulo passa a nomear a coluna errada.
    const medidasAtivas = useMemo(() => (pivot ? pivot.values.filter(Boolean) : []), [pivot]);
    // Sem dimensão nas colunas, a única "folha" já é o próprio total da linha:
    // repetir um bloco TOTAL ao lado dela seria a mesma coluna duas vezes.
    const temColunas = Boolean(pivot && pivot.colDims.length > 0);
    const rotuloDasLinhas = useMemo(() => (
        (pivotGerado?.rowDims || []).filter(Boolean)
            .map((d) => dimensionLabel(d, base)).join(' / ') || '—'
    ), [pivotGerado, base]);

    const markdown = useMemo(() => {
        if (!descGerado) return '';
        return buildDescritivo(registros, descGerado, base, analysis);
    }, [registros, descGerado, base, analysis]);

    const gerarPivot = () => {
        if (validationError) { toast.error(validationError); return; }
        setPivotGerado({ ...pivotConfig, rowDims: [...rowDims], colDims: [...colDims] });
    };

    const gerarDescritivo = () => setDescGerado({ ...descConfig });

    // ---- Eixos --------------------------------------------------------------
    const setDim = (eixo, index, valor) => {
        setPivotConfig((prev) => {
            const lista = [...prev[eixo]];
            lista[index] = valor === '__none__' ? '' : valor;
            return { ...prev, [eixo]: lista };
        });
    };

    const addDim = (eixo) => setPivotConfig((prev) => (
        prev[eixo].length >= 3 ? prev : { ...prev, [eixo]: [...prev[eixo], ''] }
    ));

    const removeDim = (eixo, index) => setPivotConfig((prev) => ({
        ...prev,
        [eixo]: prev[eixo].length <= 1 ? [''] : prev[eixo].filter((_, i) => i !== index),
    }));

    const toggleMeasure = (key) => setPivotConfig((prev) => ({
        ...prev,
        values: prev.values.includes(key)
            ? prev.values.filter((v) => v !== key)
            : [...prev.values, key],
    }));

    // ---- Modelos ------------------------------------------------------------
    const podeEditar = (template) => (
        template.created_by === currentUserId || isOrgAdmin
    );

    const modelosPivot = useMemo(() => templates.filter((t) => t.tipo === 'pivot'), [templates]);
    const modelosDescritivo = useMemo(() => templates.filter((t) => t.tipo === 'descritivo'), [templates]);

    const salvarModelo = async (tipo) => {
        const nome = templateName.trim();
        if (!nome) { toast.error('Dê um nome ao modelo.'); return; }
        if (tipo === 'pivot' && validationError) {
            toast.error(`Corrija o cruzamento antes de salvar: ${validationError}`);
            return;
        }
        const config = tipo === 'pivot'
            ? { ...pivotConfig, rowDims: [...rowDims], colDims: [...colDims] }
            : { ...descConfig };

        // Só é "atualizar" quando o modelo em edição é DESTE tipo: com um
        // descritivo em edição, salvar na aba da tabela tem de criar um modelo
        // novo, não reescrever o descritivo.
        const editandoEsteTipo = editingTemplate?.tipo === tipo ? editingTemplate : null;

        setSavingTemplate(true);
        try {
            if (editandoEsteTipo) {
                await updatePanoramaTemplate({
                    organizationId, id: editandoEsteTipo.id, nome, tipo, config,
                });
                toast.success(`Modelo "${nome}" atualizado.`);
                setEditingTemplate(null);
            } else {
                await createPanoramaTemplate({ organizationId, baseId: base?.id, nome, tipo, config });
                toast.success(`Modelo "${nome}" salvo e disponível para todo o órgão.`);
            }
            setTemplateName('');
        } catch (error) {
            logger.error('[panorama] erro ao salvar modelo:', error);
            toast.error(error?.message || 'Não foi possível salvar o modelo.');
        } finally {
            setSavingTemplate(false);
        }
    };

    const aplicarModelo = (template, gerar = true) => {
        if (!template?.config) return;
        if (template.tipo === 'pivot') {
            const config = { ...DEFAULT_PIVOT, ...template.config };
            setPivotConfig(config);
            if (gerar) {
                setPivotGerado({
                    ...config,
                    rowDims: (config.rowDims || []).filter(Boolean),
                    colDims: (config.colDims || []).filter(Boolean),
                });
            }
        } else {
            const config = {
                ...DEFAULT_DESCRITIVO,
                ...template.config,
                incluir: { ...DEFAULT_DESCRITIVO.incluir, ...(template.config.incluir || {}) },
            };
            setDescConfig(config);
            if (gerar) setDescGerado(config);
        }
        toast.success(`Modelo "${template.nome}" aplicado.`);
    };

    const editarModelo = (template) => {
        aplicarModelo(template, false);
        setEditingTemplate(template);
        setTemplateName(template.nome || '');
        toast.info('Ajuste a configuração e clique em "Atualizar modelo".');
    };

    const confirmarExclusao = async () => {
        const template = excluindo;
        if (!template) return;
        try {
            await deletePanoramaTemplate({ organizationId, id: template.id });
            if (editingTemplate?.id === template.id) {
                setEditingTemplate(null);
                setTemplateName('');
            }
            toast.success(`Modelo "${template.nome}" excluído.`);
        } catch (error) {
            logger.error('[panorama] erro ao excluir modelo:', error);
            toast.error(error?.message || 'Não foi possível excluir o modelo.');
        } finally {
            setExcluindo(null);
        }
    };

    // ---- Exportação da tabela -----------------------------------------------
    const pivotToRows = () => {
        if (!pivot || !pivotGerado) return { rows: [], columns: [] };
        const medidas = pivot.values.filter(Boolean);
        // Eixos da tabela GERADA: exportar com os do rascunho produziria um
        // arquivo cujos cabeçalhos não correspondem aos dados.
        const linhasDims = pivotGerado.rowDims.filter(Boolean);
        const colunasDims = pivotGerado.colDims.filter(Boolean);

        const columns = linhasDims.map((dim, level) => ({
            label: dimensionLabel(dim, base),
            value: (row) => row.path[level] || '',
        }));
        if (linhasDims.length === 0) columns.push({ label: 'Linha', value: () => 'Total' });

        for (const leaf of pivot.colLeaves) {
            for (const medida of medidas) {
                const header = colunasDims.length
                    ? `${leaf.path.join(' / ')}${medidas.length > 1 ? ` — ${measureLabel(medida)}` : ''}`
                    : measureLabel(medida);
                columns.push({
                    label: header,
                    // A linha de total geral não tem célula própria na matriz:
                    // o valor dela é o total DA COLUNA. Buscá-la em `cells` com
                    // a chave vazia devolveria nada, e o arquivo exportado sairia
                    // com uma fileira inteira de travessões.
                    value: (row) => (row.total
                        ? formatPivotValue(pivot.colTotals.get(leaf.key), medida, 'valor', null)
                        : formatPivotValue(
                            pivot.cells.get(`${row.key}|${leaf.key}`),
                            medida,
                            pivot.showAs,
                            divisorDe(row.key, leaf.key)
                        )),
                });
            }
        }
        if (colunasDims.length > 0) {
            for (const medida of medidas) {
                columns.push({
                    label: `TOTAL${medidas.length > 1 ? ` — ${measureLabel(medida)}` : ''}`,
                    value: (row) => formatPivotValue(
                        row.total ? pivot.grandTotal : pivot.rowTotals.get(row.key),
                        medida, 'valor', null
                    ),
                });
            }
        }

        const rows = pivot.rowNodes.map((n) => ({ key: n.key, path: n.path, label: n.label }));
        // Sem dimensão nas linhas existe uma única linha, que já é o total:
        // acrescentar "TOTAL GERAL" a repetiria.
        if (linhasDims.length > 0) {
            rows.push({
                key: '',
                path: linhasDims.map(() => 'TOTAL GERAL'),
                label: 'TOTAL GERAL',
                total: true,
            });
        }
        return { rows, columns };
    };

    /** Denominador da célula conforme o modo de exibição escolhido. */
    const divisorDe = (rowKey, colKey) => {
        if (!pivot || pivot.showAs === 'valor') return null;
        if (pivot.showAs === 'linha') return pivot.rowTotals.get(rowKey);
        if (pivot.showAs === 'coluna') return pivot.colTotals.get(colKey);
        return pivot.grandTotal;
    };

    const exportPivot = (format) => {
        const { rows, columns } = pivotToRows();
        if (rows.length === 0) { toast.error('Gere a tabela antes de exportar.'); return; }
        const filenameBase = `panorama-dinamico-${dateSuffix()}`;
        const title = `Tabela dinâmica — ${base?.nome || 'Panorama'}`;
        try {
            switch (format) {
                case 'Excel': exportTableToExcel({ rows, columns, filenameBase, sheetName: 'Dinâmico' }); break;
                case 'CSV': exportTableToCsv({ rows, columns, filenameBase }); break;
                case 'PDF': exportTableToPdf({ rows, columns, filenameBase, title, subtitle }); break;
                case 'Word': exportTableToDoc({ rows, columns, filenameBase, title, subtitle }); break;
                case 'Markdown': exportTableToMarkdown({ rows, columns, filenameBase, title, subtitle }); break;
                case 'JSON':
                    exportToJson({
                        data: {
                            base: base?.nome || '',
                            configuracao: pivotGerado,
                            geradoEm: new Date().toISOString(),
                            filtros: subtitle,
                            linhas: rows.map((row) => {
                                const obj = {};
                                columns.forEach((col) => { obj[col.label] = col.value(row); });
                                return obj;
                            }),
                        },
                        filenameBase,
                    });
                    break;
                default: break;
            }
            toast.success(`Arquivo ${format} gerado.`);
        } catch (error) {
            logger.error('[panorama] falha ao exportar tabela dinâmica:', error);
            toast.error(`Não foi possível gerar o arquivo ${format}.`);
        }
    };

    const copyPivot = async () => {
        const { rows, columns } = pivotToRows();
        if (rows.length === 0) { toast.error('Gere a tabela antes de copiar.'); return; }
        const text = [
            columns.map((c) => c.label).join('\t'),
            ...rows.map((row) => columns.map((c) => c.value(row)).join('\t')),
        ].join('\n');
        try {
            await navigator.clipboard.writeText(text);
            toast.success('Tabela copiada — cole direto no Excel ou no Word.');
        } catch {
            toast.error('O navegador bloqueou o acesso à área de transferência.');
        }
    };

    const exportDescritivo = (format) => {
        if (!markdown) { toast.error('Gere o relatório antes de exportar.'); return; }
        const filenameBase = `panorama-descritivo-${dateSuffix()}`;
        const title = descGerado?.titulo || `Panorama — ${base?.nome || ''}`;
        try {
            switch (format) {
                case 'md': exportMarkdown({ markdown, filenameBase }); break;
                case 'doc': exportMarkdownToDoc({ markdown, filenameBase, title }); break;
                case 'pdf': exportMarkdownToPdf({ markdown, filenameBase, title }); break;
                case 'txt': exportMarkdownToTxt({ markdown, filenameBase }); break;
                default: break;
            }
            toast.success('Documento gerado.');
        } catch (error) {
            logger.error('[panorama] falha ao exportar descritivo:', error);
            toast.error('Não foi possível gerar o documento.');
        }
    };

    const copyDescritivo = async () => {
        if (!markdown) { toast.error('Gere o relatório antes de copiar.'); return; }
        try {
            await navigator.clipboard.writeText(markdown);
            toast.success('Relatório copiado.');
        } catch {
            toast.error('O navegador bloqueou o acesso à área de transferência.');
        }
    };

    const toggleSecao = (key) => setDescConfig((prev) => ({
        ...prev,
        incluir: { ...prev.incluir, [key]: !prev.incluir[key] },
    }));

    const toggleDimensaoDescritivo = (key) => setDescConfig((prev) => ({
        ...prev,
        dimensoes: prev.dimensoes.includes(key)
            ? prev.dimensoes.filter((d) => d !== key)
            : [...prev.dimensoes, key],
    }));

    if (dimensions.length === 0) {
        return (
            <EmptyState
                icon={Table2}
                title="Nenhuma dimensão disponível"
                description={'Os relatórios dinâmicos cruzam dimensões da base — colunas de lista, '
                    + 'texto ou sim/não. Esta base ainda não tem nenhuma. Importe uma planilha ou '
                    + 'ajuste os tipos das colunas no Painel Administrativo → Panorama.'}
            />
        );
    }

    const listaDeModelos = (modelos) => (
        modelos.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
                Nenhum modelo salvo ainda para esta base.
            </p>
        ) : (
            <div className="flex flex-wrap gap-2">
                {modelos.map((t) => (
                    <div
                        key={t.id}
                        className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 pl-3 pr-1 py-1"
                    >
                        <button
                            type="button"
                            onClick={() => aplicarModelo(t)}
                            className="text-sm hover:text-indigo-600 dark:hover:text-indigo-400"
                            title="Aplicar e gerar"
                        >
                            {t.nome}
                        </button>
                        {t.created_by !== currentUserId && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                                de outro
                            </Badge>
                        )}
                        {podeEditar(t) && (
                            <>
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => editarModelo(t)}
                                    title="Editar este modelo"
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="ghost" size="icon" className="h-6 w-6 text-rose-600"
                                    onClick={() => setExcluindo(t)}
                                    title="Excluir este modelo"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        )
    );

    const caixaDeModelo = (tipo) => (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Bookmark className="w-4 h-4 text-slate-400" />
                Modelos do órgão
            </div>
            {listaDeModelos(tipo === 'pivot' ? modelosPivot : modelosDescritivo)}
            <div className="flex flex-col sm:flex-row gap-2">
                <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={editingTemplate?.tipo === tipo
                        ? `Novo nome para "${editingTemplate.nome}"`
                        : 'Nome do novo modelo'}
                    className="h-9"
                />
                <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onClick={() => salvarModelo(tipo)}
                    disabled={savingTemplate}
                >
                    {savingTemplate
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Save className="w-4 h-4" />}
                    {editingTemplate?.tipo === tipo ? 'Atualizar modelo' : 'Salvar como modelo'}
                </Button>
                {editingTemplate?.tipo === tipo && (
                    <Button
                        variant="ghost"
                        className="gap-2 shrink-0"
                        onClick={() => { setEditingTemplate(null); setTemplateName(''); }}
                    >
                        <X className="w-4 h-4" />
                        Cancelar edição
                    </Button>
                )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Todo o órgão enxerga e usa os modelos salvos. Editar e excluir, só o autor
                e o administrador do órgão.
            </p>
        </div>
    );

    return (
        <div className="space-y-4">
            <Tabs defaultValue="tabela" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="tabela" className="gap-2">
                        <Table2 className="w-4 h-4" />
                        Tabela dinâmica
                    </TabsTrigger>
                    <TabsTrigger value="descritivo" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Relatório descritivo
                    </TabsTrigger>
                </TabsList>

                {/* ---------------- Tabela dinâmica ---------------- */}
                <TabsContent value="tabela" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Monte o cruzamento</CardTitle>
                            <CardDescription>
                                Escolha o que vai nas linhas, o que vai nas colunas e o que será
                                contado. Nada é calculado até você clicar em <strong>Gerar tabela</strong>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {['rowDims', 'colDims'].map((eixo) => (
                                    <div key={eixo} className="space-y-2">
                                        <Label>{eixo === 'rowDims' ? 'Linhas' : 'Colunas'}</Label>
                                        {pivotConfig[eixo].map((dim, index) => (
                                            <div key={`${eixo}-${index}`} className="flex gap-2">
                                                <Select
                                                    value={dim || '__none__'}
                                                    onValueChange={(v) => setDim(eixo, index, v)}
                                                >
                                                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">— nenhuma —</SelectItem>
                                                        {dimensions.map((d) => (
                                                            <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {pivotConfig[eixo].length > 1 && (
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        onClick={() => removeDim(eixo, index)}
                                                        title="Remover este nível"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        {pivotConfig[eixo].length < 3 && (
                                            <Button
                                                variant="ghost" size="sm" className="gap-1.5 h-8"
                                                onClick={() => addDim(eixo)}
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Subdividir
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Medidas</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {measures.map((m) => {
                                            const ativa = pivotConfig.values.includes(m.key);
                                            return (
                                                <Button
                                                    key={m.key}
                                                    type="button"
                                                    variant={ativa ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => toggleMeasure(m.key)}
                                                >
                                                    {m.label}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Mostrar como</Label>
                                    <Select
                                        value={pivotConfig.showAs}
                                        onValueChange={(showAs) => setPivotConfig((p) => ({ ...p, showAs }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SHOW_AS.map((s) => (
                                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {validationError && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertDescription className="text-sm">{validationError}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={gerarPivot} disabled={Boolean(validationError)} className="gap-2">
                                    <Play className="w-4 h-4" />
                                    Gerar tabela
                                </Button>
                                {pivot && (
                                    <>
                                        <Button variant="outline" onClick={copyPivot} className="gap-2">
                                            <Copy className="w-4 h-4" />
                                            Copiar
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="gap-2">
                                                    <Download className="w-4 h-4" />
                                                    Exportar
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Formato</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {['Excel', 'CSV', 'PDF', 'Word', 'Markdown', 'JSON'].map((f) => (
                                                    <DropdownMenuItem key={f} onClick={() => exportPivot(f)}>
                                                        {f}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                                    {formatNumber(registros.length)} registro(s) no recorte atual
                                </span>
                            </div>

                            {caixaDeModelo('pivot')}
                        </CardContent>
                    </Card>

                    {pivot ? (
                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Resultado</CardTitle>
                                {subtitle && <CardDescription>{subtitle}</CardDescription>}
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        {temColunas ? (
                                            <>
                                                {pivot.colHeaderRows.map((nivel, i) => (
                                                    <TableRow key={`hdr-${i}`}>
                                                        {i === 0 && (
                                                            <TableHead
                                                                rowSpan={pivot.colHeaderRows.length + 1}
                                                                className="align-bottom"
                                                            >
                                                                {rotuloDasLinhas}
                                                            </TableHead>
                                                        )}
                                                        {nivel.map((h) => (
                                                            <TableHead
                                                                key={h.key}
                                                                colSpan={h.span * medidasAtivas.length}
                                                                className="text-center"
                                                            >
                                                                {h.label}
                                                            </TableHead>
                                                        ))}
                                                        {i === 0 && (
                                                            <TableHead
                                                                rowSpan={pivot.colHeaderRows.length}
                                                                colSpan={medidasAtivas.length}
                                                                className="text-center font-semibold"
                                                            >
                                                                Total
                                                            </TableHead>
                                                        )}
                                                    </TableRow>
                                                ))}
                                                <TableRow>
                                                    {pivot.colLeaves.map((leaf) => (
                                                        medidasAtivas.map((m) => (
                                                            <TableHead key={`${leaf.key}-${m}`} className="text-right whitespace-nowrap">
                                                                {measureLabel(m)}
                                                            </TableHead>
                                                        ))
                                                    ))}
                                                    {medidasAtivas.map((m) => (
                                                        <TableHead key={`tot-${m}`} className="text-right font-semibold whitespace-nowrap">
                                                            {measureLabel(m)}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </>
                                        ) : (
                                            <TableRow>
                                                <TableHead>{rotuloDasLinhas}</TableHead>
                                                {medidasAtivas.map((m) => (
                                                    <TableHead key={`m-${m}`} className="text-right whitespace-nowrap">
                                                        {measureLabel(m)}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        )}
                                    </TableHeader>
                                    <TableBody>
                                        {pivot.rowNodes.map((node) => (
                                            <TableRow key={node.key || 'total'}>
                                                <TableCell
                                                    className={node.level > 0 ? 'text-slate-600 dark:text-slate-300' : 'font-medium'}
                                                    style={{ paddingLeft: `${12 + node.level * 16}px` }}
                                                >
                                                    {node.label}
                                                </TableCell>
                                                {pivot.colLeaves.map((leaf) => (
                                                    medidasAtivas.map((m) => (
                                                        <TableCell key={`${node.key}-${leaf.key}-${m}`} className="text-right tabular-nums">
                                                            {formatPivotValue(
                                                                pivot.cells.get(`${node.key}|${leaf.key}`),
                                                                m, pivot.showAs, divisorDe(node.key, leaf.key)
                                                            )}
                                                        </TableCell>
                                                    ))
                                                ))}
                                                {temColunas && medidasAtivas.map((m) => (
                                                    <TableCell key={`${node.key}-total-${m}`} className="text-right tabular-nums font-semibold">
                                                        {formatPivotValue(pivot.rowTotals.get(node.key), m, 'valor', null)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                        {pivot.rowDims.length > 0 && (
                                        <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                                            <TableCell className="font-semibold">TOTAL GERAL</TableCell>
                                            {pivot.colLeaves.map((leaf) => (
                                                medidasAtivas.map((m) => (
                                                    <TableCell key={`ger-${leaf.key}-${m}`} className="text-right tabular-nums font-semibold">
                                                        {formatPivotValue(pivot.colTotals.get(leaf.key), m, 'valor', null)}
                                                    </TableCell>
                                                ))
                                            ))}
                                            {temColunas && medidasAtivas.map((m) => (
                                                <TableCell key={`ger-total-${m}`} className="text-right tabular-nums font-bold">
                                                    {formatPivotValue(pivot.grandTotal, m, 'valor', null)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ) : (
                        <Alert>
                            <Info className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                Monte o cruzamento acima e clique em <strong>Gerar tabela</strong>.
                                Numa base grande, recalcular a cada clique travaria a tela — por isso
                                o resultado só aparece quando você pede.
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                {/* ---------------- Relatório descritivo ---------------- */}
                <TabsContent value="descritivo" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Monte o relatório</CardTitle>
                            <CardDescription>
                                O estilo muda o documento de verdade: o formal é texto corrido sem
                                tabelas; o executivo acrescenta as tabelas que sustentam cada
                                afirmação; o analítico cruza as dimensões entre si e interpreta os
                                cruzamentos.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Estilo</Label>
                                    <Select
                                        value={descConfig.estilo}
                                        onValueChange={(estilo) => setDescConfig((p) => ({ ...p, estilo }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PANORAMA_ESTILOS_DESCRITIVO.map((e) => (
                                                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {PANORAMA_ESTILOS_DESCRITIVO.find((e) => e.value === descConfig.estilo)?.description}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pan-desc-titulo">Título do documento</Label>
                                    <Input
                                        id="pan-desc-titulo"
                                        value={descConfig.titulo}
                                        onChange={(e) => setDescConfig((p) => ({ ...p, titulo: e.target.value }))}
                                        placeholder={`Panorama — ${base?.nome || ''}`}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Dimensões a percorrer</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Nenhuma marcada significa todas. No estilo analítico, cada par de
                                    dimensões marcadas vira uma tabela cruzada — marcar poucas produz
                                    documento mais curto e mais legível.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {dimensions.map((d) => {
                                        const ativa = descConfig.dimensoes.includes(d.key);
                                        return (
                                            <Button
                                                key={d.key}
                                                type="button"
                                                variant={ativa ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => toggleDimensaoDescritivo(d.key)}
                                            >
                                                {d.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Seções</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {SECOES_DESCRITIVO.map((s) => (
                                        <label
                                            key={s.key}
                                            className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 cursor-pointer"
                                        >
                                            <Switch
                                                checked={descConfig.incluir[s.key] !== false}
                                                onCheckedChange={() => toggleSecao(s.key)}
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium leading-tight">{s.label}</span>
                                                <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                                                    {s.hint}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={gerarDescritivo} className="gap-2">
                                    <Play className="w-4 h-4" />
                                    Gerar relatório
                                </Button>
                                {markdown && (
                                    <>
                                        <Button variant="outline" onClick={copyDescritivo} className="gap-2">
                                            <Copy className="w-4 h-4" />
                                            Copiar
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="gap-2">
                                                    <Download className="w-4 h-4" />
                                                    Exportar
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Formato</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => exportDescritivo('doc')}>
                                                    <FileType2 className="w-4 h-4 mr-2" /> Word
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => exportDescritivo('pdf')}>
                                                    <FileText className="w-4 h-4 mr-2" /> PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => exportDescritivo('md')}>
                                                    <FileCode className="w-4 h-4 mr-2" /> Markdown
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => exportDescritivo('txt')}>
                                                    <FileText className="w-4 h-4 mr-2" /> Texto simples
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}
                            </div>

                            {caixaDeModelo('descritivo')}
                        </CardContent>
                    </Card>

                    {markdown ? (
                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardContent className="pt-6">
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                                    {markdown}
                                </pre>
                            </CardContent>
                        </Card>
                    ) : (
                        <Alert>
                            <Info className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                Configure acima e clique em <strong>Gerar relatório</strong>.
                            </AlertDescription>
                        </Alert>
                    )}
                </TabsContent>
            </Tabs>

            <AlertDialog open={Boolean(excluindo)} onOpenChange={(v) => !v && setExcluindo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir o modelo “{excluindo?.nome}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O modelo deixa de aparecer para todos do órgão. Os relatórios já
                            gerados e exportados não são afetados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmarExclusao} className="bg-rose-600 hover:bg-rose-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
