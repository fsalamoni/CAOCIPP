import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Grid3x3, FileText, Save, Trash2, Play, AlertTriangle, Copy, Download, Layers, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useJurimetriaPref } from '@/hooks/useJurimetriaPrefs';
import JurimetriaPagination, { usePagedRows } from './JurimetriaPagination';
import {
    JURIMETRIA_PIVOT_DIMENSIONS, JURIMETRIA_PIVOT_VALUES, JURIMETRIA_PIVOT_SHOW_AS,
    JURIMETRIA_DESCRITIVO_SECOES, JURIMETRIA_DESCRITIVO_ESTILOS,
    getJurimetriaFields,
} from '@/constants/jurimetria';
import {
    buildPivot, buildDescritivo, formatPivotValue, measureLabel, formatNumber,
} from '@/lib/jurimetriaEngine';
import {
    exportTableToExcel, exportTableToCsv, exportTableToPdf, exportTableToDoc,
    exportTableToMarkdown, exportToJson, exportMarkdown, exportMarkdownToDoc,
    exportMarkdownToPdf, exportMarkdownToTxt, dateSuffix,
} from '@/lib/jurimetriaExport';

const NENHUM = '__nenhum__';
const TEMPLATES_KEY = 'caocipp_jurimetria_templates';

const DEFAULT_PIVOT = {
    rowDims: ['comarca'],
    colDims: ['mes'],
    values: ['quantidade'],
    showAs: 'valor',
    subtotais: 'auto',
};

const DEFAULT_DESCRITIVO = {
    agrupador: 'comarca',
    secoes: ['quantitativo', 'especies', 'materias', 'aproveitamento'],
    estilo: 'formal',
    titulo: 'Relatório de jurimetria',
};

function loadTemplates() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(TEMPLATES_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
}

function saveTemplates(list) {
    try {
        window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list.slice(0, 40)));
    } catch {
        /* sem localStorage: o modelo vale só para esta sessão */
    }
}

/** Seletor de uma dimensão de eixo (linhas ou colunas). */
function DimensionSelect({ label, value, onChange, options, disabledValues }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-slate-400">{label}</Label>
            <Select value={value || NENHUM} onValueChange={(v) => onChange(v === NENHUM ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NENHUM}>— nenhuma —</SelectItem>
                    {options.map((option) => (
                        <SelectItem
                            key={option.key}
                            value={option.key}
                            disabled={disabledValues.includes(option.key) && option.key !== value}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

/**
 * Relatórios dinâmicos: tabela dinâmica multi-nível (até 3 dimensões em linhas,
 * 3 em colunas e 2 medidas lado a lado) e relatório descritivo em texto.
 */
export default function JurimetriaDynamicReports({
    juris, settings, subtitle = '', analysis, organizationId,
}) {
    // O desenho do relatório é trabalho do usuário — ele fica gravado no
    // navegador, por órgão, e volta pronto no próximo acesso ou ao atualizar a
    // página. Redefinir devolve o padrão de fábrica.
    const [pivotConfig, setPivotConfig, resetPivotConfig] = useJurimetriaPref(
        'dinamicos_pivot', organizationId, DEFAULT_PIVOT
    );
    const [descConfig, setDescConfig, resetDescConfig] = useJurimetriaPref(
        'dinamicos_descritivo', organizationId, DEFAULT_DESCRITIVO
    );
    const [templates, setTemplates] = useState(loadTemplates);
    const [templateName, setTemplateName] = useState('');

    // As colunas personalizadas do órgão também servem como dimensão de análise.
    const dimensions = useMemo(() => {
        const custom = getJurimetriaFields(settings)
            .filter((f) => f.custom && ['text', 'select', 'boolean', 'number'].includes(f.type))
            .map((f) => ({ key: f.key, label: `${f.label} (coluna do órgão)` }));
        return [...JURIMETRIA_PIVOT_DIMENSIONS, ...custom];
    }, [settings]);

    const setPivot = (patch) => setPivotConfig((prev) => ({ ...prev, ...patch }));

    const setDim = (axis, index, value) => {
        setPivotConfig((prev) => {
            const next = [...prev[axis]];
            next[index] = value;
            return { ...prev, [axis]: next.filter((v, i) => v || i < next.length) };
        });
    };

    const rowDims = useMemo(() => pivotConfig.rowDims.filter(Boolean), [pivotConfig.rowDims]);
    const colDims = useMemo(() => pivotConfig.colDims.filter(Boolean), [pivotConfig.colDims]);

    // Validação — as mesmas regras do app original, explicadas ao usuário.
    const validationError = useMemo(() => {
        if (rowDims.length === 0 && colDims.length === 0) {
            return 'Escolha ao menos uma dimensão em Linhas ou em Colunas.';
        }
        if (new Set(rowDims).size !== rowDims.length) {
            return 'A mesma dimensão foi escolhida duas vezes em Linhas.';
        }
        if (new Set(colDims).size !== colDims.length) {
            return 'A mesma dimensão foi escolhida duas vezes em Colunas.';
        }
        const cruzada = rowDims.find((d) => colDims.includes(d));
        if (cruzada) {
            const label = dimensions.find((x) => x.key === cruzada)?.label || cruzada;
            return `"${label}" está em Linhas e em Colunas ao mesmo tempo.`;
        }
        if (pivotConfig.values.filter(Boolean).length === 0) {
            return 'Escolha ao menos uma medida.';
        }
        return null;
    }, [rowDims, colDims, pivotConfig.values, dimensions]);

    const pivot = useMemo(() => {
        if (validationError) return null;
        return buildPivot(juris, { ...pivotConfig, rowDims, colDims }, settings, analysis);
    }, [juris, pivotConfig, rowDims, colDims, settings, validationError, analysis]);

    const markdown = useMemo(
        () => buildDescritivo(juris, descConfig, settings, analysis),
        [juris, descConfig, settings, analysis]
    );

    // ---- Modelos salvos -----------------------------------------------------
    const handleSaveTemplate = () => {
        const name = templateName.trim();
        if (!name) {
            toast.error('Dê um nome ao modelo.');
            return;
        }
        const next = [
            { name, schema: 1, pivot: { ...pivotConfig }, descritivo: { ...descConfig } },
            ...templates.filter((t) => t.name !== name),
        ];
        setTemplates(next);
        saveTemplates(next);
        setTemplateName('');
        toast.success(`Modelo "${name}" salvo neste navegador.`);
    };

    const handleLoadTemplate = (template) => {
        if (template.pivot) setPivotConfig({ ...DEFAULT_PIVOT, ...template.pivot });
        if (template.descritivo) setDescConfig({ ...DEFAULT_DESCRITIVO, ...template.descritivo });
        toast.success(`Modelo "${template.name}" aplicado.`);
    };

    const handleDeleteTemplate = (name) => {
        const next = templates.filter((t) => t.name !== name);
        setTemplates(next);
        saveTemplates(next);
    };

    // ---- Exportação da pivot ------------------------------------------------
    /** Converte a pivot renderizada em linhas planas, para qualquer formato. */
    const pivotToRows = () => {
        if (!pivot) return { rows: [], columns: [] };
        const measures = pivot.values.filter(Boolean);

        const columns = [
            ...rowDims.map((dim, level) => ({
                label: dimensions.find((d) => d.key === dim)?.label || dim,
                value: (row) => row.path[level] || '',
            })),
        ];
        if (rowDims.length === 0) {
            columns.push({ label: 'Linha', value: () => 'Total' });
        }
        for (const leaf of pivot.colLeaves) {
            for (const measure of measures) {
                const header = colDims.length
                    ? `${leaf.path.join(' / ')}${measures.length > 1 ? ` — ${measureLabel(measure)}` : ''}`
                    : measureLabel(measure);
                columns.push({
                    label: header,
                    value: (row) => formatPivotValue(
                        pivot.cells.get(`${row.key}|${leaf.key}`),
                        measure,
                        pivot.showAs,
                        pivot.showAs === 'linha'
                            ? pivot.rowTotals.get(row.key)
                            : pivot.showAs === 'coluna'
                                ? pivot.colTotals.get(leaf.key)
                                : pivot.showAs === 'total'
                                    ? pivot.grandTotal
                                    : null
                    ),
                });
            }
        }
        for (const measure of measures) {
            columns.push({
                label: `TOTAL${measures.length > 1 ? ` — ${measureLabel(measure)}` : ''}`,
                value: (row) => formatPivotValue(
                    pivot.rowTotals.get(row.key), measure, 'valor', null
                ),
            });
        }

        const rows = pivot.rowNodes.map((node) => ({ key: node.key, path: node.path, label: node.label }));
        rows.push({ key: '', path: rowDims.map(() => 'TOTAL GERAL'), label: 'TOTAL GERAL' });

        return { rows, columns };
    };

    const exportPivot = (format) => {
        const { rows, columns } = pivotToRows();
        if (rows.length === 0) {
            toast.error('Gere a tabela antes de exportar.');
            return;
        }
        const filenameBase = `jurimetria-dinamico-${dateSuffix()}`;
        const title = 'Tabela dinâmica de jurimetria';
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
                            configuracao: { ...pivotConfig, rowDims, colDims },
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
            logger.error('[jurimetria] falha ao exportar pivot:', error);
            toast.error(`Não foi possível gerar o arquivo ${format}.`);
        }
    };

    const copyPivot = async () => {
        const { rows, columns } = pivotToRows();
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

    const copyDescritivo = async () => {
        try {
            await navigator.clipboard.writeText(markdown);
            toast.success('Relatório copiado.');
        } catch {
            toast.error('O navegador bloqueou o acesso à área de transferência.');
        }
    };

    const exportDescritivo = (format) => {
        const filenameBase = `jurimetria-descritivo-${dateSuffix()}`;
        try {
            switch (format) {
                case 'md': exportMarkdown({ markdown, filenameBase }); break;
                case 'doc': exportMarkdownToDoc({ markdown, filenameBase, title: descConfig.titulo }); break;
                case 'pdf': exportMarkdownToPdf({ markdown, filenameBase, title: descConfig.titulo }); break;
                case 'txt': exportMarkdownToTxt({ markdown, filenameBase }); break;
                default: break;
            }
            toast.success('Documento gerado.');
        } catch (error) {
            logger.error('[jurimetria] falha ao exportar descritivo:', error);
            toast.error('Não foi possível gerar o documento.');
        }
    };

    const toggleSecao = (key) => {
        setDescConfig((prev) => ({
            ...prev,
            secoes: prev.secoes.includes(key)
                ? prev.secoes.filter((s) => s !== key)
                : [...prev.secoes, key],
        }));
    };

    return (
        <Tabs defaultValue="pivot" className="space-y-4">
            <TabsList>
                <TabsTrigger value="pivot" className="gap-2">
                    <Grid3x3 className="w-4 h-4" />
                    Tabela dinâmica
                </TabsTrigger>
                <TabsTrigger value="descritivo" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Relatório descritivo
                </TabsTrigger>
                <TabsTrigger value="modelos" className="gap-2">
                    <Layers className="w-4 h-4" />
                    Modelos
                    {templates.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{templates.length}</Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            {/* ---------------- Tabela dinâmica ---------------- */}
            <TabsContent value="pivot" className="space-y-4 mt-0">
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <CardTitle className="text-base">Como cruzar os dados</CardTitle>
                                <CardDescription>
                                    Escolha até 3 dimensões em Linhas e 3 em Colunas, e até 2 medidas lado a lado.
                                    A tabela é recalculada automaticamente sobre os júris filtrados.
                                    Suas escolhas ficam gravadas neste navegador e voltam prontas no próximo acesso.
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { resetPivotConfig(); toast.success('Cruzamento restaurado ao padrão.'); }}
                                className="gap-1.5 shrink-0 text-slate-500"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar padrão
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Linhas</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[0, 1, 2].map((index) => (
                                        <DimensionSelect
                                            key={index}
                                            label={`Nível ${index + 1}`}
                                            value={pivotConfig.rowDims[index] || ''}
                                            onChange={(value) => setDim('rowDims', index, value)}
                                            options={dimensions}
                                            disabledValues={[...rowDims, ...colDims]}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Colunas</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[0, 1, 2].map((index) => (
                                        <DimensionSelect
                                            key={index}
                                            label={`Nível ${index + 1}`}
                                            value={pivotConfig.colDims[index] || ''}
                                            onChange={(value) => setDim('colDims', index, value)}
                                            options={dimensions}
                                            disabledValues={[...rowDims, ...colDims]}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Medida 1</Label>
                                <Select
                                    value={pivotConfig.values[0] || 'quantidade'}
                                    onValueChange={(v) => setPivot({ values: [v, pivotConfig.values[1]].filter(Boolean) })}
                                >
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {JURIMETRIA_PIVOT_VALUES.map((v) => (
                                            <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Medida 2 (opcional)</Label>
                                <Select
                                    value={pivotConfig.values[1] || NENHUM}
                                    onValueChange={(v) => setPivot({
                                        values: v === NENHUM
                                            ? [pivotConfig.values[0] || 'quantidade']
                                            : [pivotConfig.values[0] || 'quantidade', v],
                                    })}
                                >
                                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NENHUM}>— nenhuma —</SelectItem>
                                        {JURIMETRIA_PIVOT_VALUES
                                            .filter((v) => v.key !== pivotConfig.values[0])
                                            .map((v) => (
                                                <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Mostrar como</Label>
                                <Select value={pivotConfig.showAs} onValueChange={(showAs) => setPivot({ showAs })}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {JURIMETRIA_PIVOT_SHOW_AS.map((s) => (
                                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Subtotais</Label>
                                <Select value={pivotConfig.subtotais} onValueChange={(subtotais) => setPivot({ subtotais })}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Automático (níveis + total geral)</SelectItem>
                                        <SelectItem value="linha">Somente subtotais de linha</SelectItem>
                                        <SelectItem value="coluna">Somente o total geral</SelectItem>
                                        <SelectItem value="nenhum">Sem subtotais</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {pivotConfig.showAs !== 'valor' && pivotConfig.values.includes('aproveitamento') && (
                            <Alert>
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    O aproveitamento já é um percentual ponderado, então ele é sempre mostrado como
                                    valor — o modo “{JURIMETRIA_PIVOT_SHOW_AS.find((s) => s.key === pivotConfig.showAs)?.label}”
                                    vale apenas para as demais medidas.
                                </AlertDescription>
                            </Alert>
                        )}

                        {validationError && (
                            <Alert variant="destructive">
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription>{validationError}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {pivot && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="text-base">Resultado</CardTitle>
                                    <CardDescription>
                                        {formatNumber(pivot.rowNodes.length)} linha(s) ×{' '}
                                        {formatNumber(pivot.colLeaves.length)} coluna(s) —{' '}
                                        {formatNumber(pivot.grandTotal.quantidade)} júri(s) no total.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={copyPivot} className="gap-2">
                                        <Copy className="w-4 h-4" />
                                        Copiar
                                    </Button>
                                    {['Excel', 'CSV', 'PDF', 'Word', 'Markdown', 'JSON'].map((format) => (
                                        <Button
                                            key={format}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => exportPivot(format)}
                                            className="gap-1.5"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {format}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <PivotTable
                                pivot={pivot}
                                rowDims={rowDims}
                                colDims={colDims}
                                dimensions={dimensions}
                                organizationId={organizationId}
                            />
                        </CardContent>
                    </Card>
                )}
            </TabsContent>

            {/* ---------------- Relatório descritivo ---------------- */}
            <TabsContent value="descritivo" className="space-y-4 mt-0">
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <CardTitle className="text-base">Como redigir o relatório</CardTitle>
                                <CardDescription>
                                    O texto é gerado a partir dos júris filtrados e pode ser copiado ou baixado em Word,
                                    PDF, Markdown ou texto puro. As escolhas ficam gravadas para o próximo acesso.
                                </CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { resetDescConfig(); toast.success('Descritivo restaurado ao padrão.'); }}
                                className="gap-1.5 shrink-0 text-slate-500"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar padrão
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5 sm:col-span-1">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Agrupar por</Label>
                                <Select
                                    value={descConfig.agrupador}
                                    onValueChange={(agrupador) => setDescConfig((p) => ({ ...p, agrupador }))}
                                >
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {dimensions.map((d) => (
                                            <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Estilo</Label>
                                <Select
                                    value={descConfig.estilo}
                                    onValueChange={(estilo) => setDescConfig((p) => ({ ...p, estilo }))}
                                >
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {JURIMETRIA_DESCRITIVO_ESTILOS.map((e) => (
                                            <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Título do documento</Label>
                                <Input
                                    value={descConfig.titulo}
                                    onChange={(e) => setDescConfig((p) => ({ ...p, titulo: e.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Seções incluídas</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {JURIMETRIA_DESCRITIVO_SECOES.map((secao) => (
                                    <label
                                        key={secao.key}
                                        className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <Checkbox
                                            className="mt-0.5"
                                            checked={descConfig.secoes.includes(secao.key)}
                                            onCheckedChange={() => toggleSecao(secao.key)}
                                        />
                                        <span className="text-sm leading-tight">{secao.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">Pré-visualização</CardTitle>
                                <CardDescription>
                                    Gerado sobre {formatNumber(juris.length)} júri(s) no recorte atual.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" onClick={copyDescritivo} className="gap-2">
                                    <Copy className="w-4 h-4" />
                                    Copiar
                                </Button>
                                {[
                                    { key: 'doc', label: 'Word' },
                                    { key: 'pdf', label: 'PDF' },
                                    { key: 'md', label: 'Markdown' },
                                    { key: 'txt', label: 'Texto' },
                                ].map((format) => (
                                    <Button
                                        key={format.key}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => exportDescritivo(format.key)}
                                        className="gap-1.5"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {format.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[32rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                            <pre className="p-4 text-[13px] leading-relaxed whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200">
                                {markdown}
                            </pre>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* ---------------- Modelos ---------------- */}
            <TabsContent value="modelos" className="space-y-4 mt-0">
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Salvar a configuração atual</CardTitle>
                        <CardDescription>
                            Guarda o cruzamento da tabela dinâmica e as opções do relatório descritivo para reaplicar
                            com um clique. Os modelos ficam salvos neste navegador.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="Ex.: Relatório mensal por comarca"
                                className="flex-1 h-9"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
                            />
                            <Button onClick={handleSaveTemplate} className="gap-2">
                                <Save className="w-4 h-4" />
                                Salvar modelo
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {templates.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Nenhum modelo salvo ainda.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {templates.map((template) => (
                            <Card key={template.name} className="border-slate-200 dark:border-slate-700">
                                <CardContent className="p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">{template.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Linhas: {(template.pivot?.rowDims || []).filter(Boolean)
                                                .map((d) => dimensions.find((x) => x.key === d)?.label || d)
                                                .join(' › ') || '—'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Colunas: {(template.pivot?.colDims || []).filter(Boolean)
                                                .map((d) => dimensions.find((x) => x.key === d)?.label || d)
                                                .join(' › ') || '—'}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleLoadTemplate(template)}
                                            title="Aplicar modelo"
                                        >
                                            <Play className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                            onClick={() => handleDeleteTemplate(template.name)}
                                            title="Excluir modelo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </TabsContent>
        </Tabs>
    );
}

/** Renderiza a pivot com cabeçalho multi-nível e recuo hierárquico nas linhas. */
function PivotTable({ pivot, rowDims, colDims, dimensions, organizationId }) {
    const measures = pivot.values.filter(Boolean);
    const showRowSubtotals = ['auto', 'linha'].includes(pivot.subtotais);
    const showGrandTotal = ['auto', 'linha', 'coluna'].includes(pivot.subtotais);

    // Linhas que de fato aparecem (sem subtotais, quando desligados). Um
    // cruzamento por comarca × mês passa de 160 linhas: a paginação é o que
    // torna a tabela legível. O TOTAL GERAL fica fora e repete em toda página.
    const visibleNodes = useMemo(
        () => pivot.rowNodes.filter(
            (node) => !(node.children.length > 0 && !showRowSubtotals && rowDims.length > 1)
        ),
        [pivot.rowNodes, showRowSubtotals, rowDims.length]
    );
    const pager = usePagedRows(visibleNodes, { scope: 'dinamicos_pivot', organizationId });

    const divisorFor = (rowKey, colKey) => {
        if (pivot.showAs === 'linha') return pivot.rowTotals.get(rowKey);
        if (pivot.showAs === 'coluna') return pivot.colTotals.get(colKey);
        if (pivot.showAs === 'total') return pivot.grandTotal;
        return null;
    };

    const rowHeaderLabel = rowDims.length
        ? rowDims.map((d) => dimensions.find((x) => x.key === d)?.label || d).join(' › ')
        : 'Total';

    return (
        <div className="overflow-x-auto">
            <UiTable className="text-[13px]">
                <TableHeader>
                    {/* Uma linha de cabeçalho por nível de coluna */}
                    {colDims.length > 0 ? pivot.colHeaderRows.map((headerRow, level) => (
                        <TableRow key={`hdr-${level}`}>
                            {level === 0 && (
                                <TableHead
                                    rowSpan={pivot.colHeaderRows.length + (measures.length > 1 ? 1 : 0)}
                                    className="align-bottom min-w-[220px] sticky left-0 bg-white dark:bg-slate-900 z-10"
                                >
                                    {rowHeaderLabel}
                                </TableHead>
                            )}
                            {headerRow.map((cell) => (
                                <TableHead
                                    key={cell.key}
                                    colSpan={cell.span * measures.length}
                                    className="text-center whitespace-nowrap border-l border-slate-100 dark:border-slate-800"
                                >
                                    {cell.label}
                                </TableHead>
                            ))}
                            {level === 0 && showGrandTotal && (
                                <TableHead
                                    colSpan={measures.length}
                                    rowSpan={pivot.colHeaderRows.length + (measures.length > 1 ? 1 : 0)}
                                    className="text-center whitespace-nowrap border-l-2 border-slate-200 dark:border-slate-700 align-bottom"
                                >
                                    TOTAL
                                </TableHead>
                            )}
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableHead className="min-w-[220px] sticky left-0 bg-white dark:bg-slate-900 z-10">
                                {rowHeaderLabel}
                            </TableHead>
                            {measures.map((measure) => (
                                <TableHead key={measure} className="text-right whitespace-nowrap">
                                    {measureLabel(measure)}
                                </TableHead>
                            ))}
                        </TableRow>
                    )}

                    {/* Linha extra com o nome de cada medida, quando há duas */}
                    {colDims.length > 0 && measures.length > 1 && (
                        <TableRow>
                            {pivot.colLeaves.map((leaf) => (
                                measures.map((measure) => (
                                    <TableHead
                                        key={`${leaf.key}-${measure}`}
                                        className="text-right text-[11px] font-normal text-slate-400 whitespace-nowrap border-l border-slate-100 dark:border-slate-800"
                                    >
                                        {measureLabel(measure)}
                                    </TableHead>
                                ))
                            ))}
                        </TableRow>
                    )}
                </TableHeader>

                <TableBody>
                    {pager.pageRows.map((node) => {
                        const isSubtotal = node.children.length > 0;
                        return (
                            <TableRow
                                key={node.key || 'root'}
                                className={isSubtotal ? 'bg-slate-50/70 dark:bg-slate-800/40 font-medium' : ''}
                            >
                                <TableCell
                                    className="sticky left-0 bg-inherit z-10 whitespace-nowrap"
                                    style={{ paddingLeft: `${12 + node.level * 18}px` }}
                                >
                                    <span className="block max-w-[320px] truncate" title={node.label}>
                                        {node.label}
                                    </span>
                                </TableCell>

                                {pivot.colLeaves.map((leaf) => (
                                    measures.map((measure) => (
                                        <TableCell
                                            key={`${leaf.key}-${measure}`}
                                            className="text-right tabular-nums border-l border-slate-100 dark:border-slate-800"
                                        >
                                            {formatPivotValue(
                                                pivot.cells.get(`${node.key}|${leaf.key}`),
                                                measure,
                                                pivot.showAs,
                                                divisorFor(node.key, leaf.key)
                                            )}
                                        </TableCell>
                                    ))
                                ))}

                                {showGrandTotal && measures.map((measure) => (
                                    <TableCell
                                        key={`total-${measure}`}
                                        className="text-right tabular-nums font-semibold border-l-2 border-slate-200 dark:border-slate-700"
                                    >
                                        {formatPivotValue(pivot.rowTotals.get(node.key), measure, 'valor', null)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        );
                    })}

                    {showGrandTotal && (
                        <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                            <TableCell className="sticky left-0 bg-inherit z-10">TOTAL GERAL</TableCell>
                            {pivot.colLeaves.map((leaf) => (
                                measures.map((measure) => (
                                    <TableCell
                                        key={`gt-${leaf.key}-${measure}`}
                                        className="text-right tabular-nums border-l border-slate-100 dark:border-slate-800"
                                    >
                                        {formatPivotValue(pivot.colTotals.get(leaf.key), measure, 'valor', null)}
                                    </TableCell>
                                ))
                            ))}
                            {measures.map((measure) => (
                                <TableCell
                                    key={`gt-total-${measure}`}
                                    className="text-right tabular-nums border-l-2 border-slate-200 dark:border-slate-700"
                                >
                                    {formatPivotValue(pivot.grandTotal, measure, 'valor', null)}
                                </TableCell>
                            ))}
                        </TableRow>
                    )}
                </TableBody>
            </UiTable>
            <JurimetriaPagination pager={pager} label="linhas" />
        </div>
    );
}
