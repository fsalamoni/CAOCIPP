import React, { useEffect, useMemo, useState } from 'react';
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
    Loader2, Pencil, BookmarkPlus, User, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { useJurimetriaPref } from '@/hooks/useJurimetriaPrefs';
import { useJurimetriaTemplates } from '@/hooks/useJuris';
import {
    createJurimetriaTemplate, updateJurimetriaTemplate, deleteJurimetriaTemplate,
} from '@/services/jurimetriaService';
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

/**
 * Modelos que ficaram no navegador antes de a coleção compartilhada existir.
 * São lidos uma única vez para oferecer a migração — depois disso a chave é
 * apagada, e não há caminho de volta para o localStorage.
 */
function loadLegacyTemplates() {
    try {
        const stored = JSON.parse(window.localStorage.getItem(TEMPLATES_KEY) || '[]');
        return Array.isArray(stored) ? stored.filter((t) => t && t.name) : [];
    } catch {
        return [];
    }
}

function discardLegacyTemplates() {
    try {
        window.localStorage.removeItem(TEMPLATES_KEY);
    } catch {
        /* sem localStorage: nada a limpar */
    }
}

/** Regrava o que ainda não migrou, para uma nova tentativa retomar daí. */
function persistLegacyTemplates(lista) {
    try {
        if (!lista || lista.length === 0) window.localStorage.removeItem(TEMPLATES_KEY);
        else window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(lista));
    } catch {
        /* sem localStorage: nada a regravar */
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
    currentUserId = '', isOrgAdmin = false,
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
    const { templates, isLoading: templatesLoading } = useJurimetriaTemplates(organizationId);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [legacyTemplates, setLegacyTemplates] = useState(loadLegacyTemplates);
    const [migrating, setMigrating] = useState(false);

    // Configurações efetivamente GERADAS. A configuração dos cartões é o
    // rascunho; só o botão Gerar promove o rascunho a relatório — sem isso,
    // mexer numa dimensão recalculava uma pivot de milhares de células a cada
    // tecla, e o usuário nunca via o recorte que pediu, só o intermediário.
    const [pivotGerado, setPivotGerado] = useState(null);
    const [descGerado, setDescGerado] = useState(null);

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

    // A pivot é calculada a partir da configuração GERADA, não da que está nos
    // cartões. Os filtros e as opções de análise, porém, continuam refluindo
    // na hora: eles dizem QUAIS júris entram, e um relatório que ignorasse o
    // filtro em vigor estaria simplesmente errado.
    const pivot = useMemo(() => {
        if (!pivotGerado) return null;
        const linhas = pivotGerado.rowDims.filter(Boolean);
        const colunas = pivotGerado.colDims.filter(Boolean);
        return buildPivot(
            juris, { ...pivotGerado, rowDims: linhas, colDims: colunas }, settings, analysis
        );
    }, [juris, pivotGerado, settings, analysis]);

    const markdown = useMemo(
        () => (descGerado ? buildDescritivo(juris, descGerado, settings, analysis) : ''),
        [juris, descGerado, settings, analysis]
    );

    // Assinatura da configuração: é o que permite dizer "há mudanças ainda não
    // geradas" sem comparar objeto a objeto em todo render.
    const pivotDesatualizado = useMemo(
        () => Boolean(pivotGerado)
            && JSON.stringify({ ...pivotConfig, rowDims, colDims })
                !== JSON.stringify({ ...pivotGerado, rowDims: pivotGerado.rowDims.filter(Boolean), colDims: pivotGerado.colDims.filter(Boolean) }),
        [pivotConfig, rowDims, colDims, pivotGerado]
    );
    const descDesatualizado = useMemo(
        () => Boolean(descGerado) && JSON.stringify(descConfig) !== JSON.stringify(descGerado),
        [descConfig, descGerado]
    );

    const gerarPivot = () => {
        if (validationError) {
            toast.error(validationError);
            return;
        }
        setPivotGerado({ ...pivotConfig, rowDims: [...rowDims], colDims: [...colDims] });
    };

    const gerarDescritivo = () => setDescGerado({ ...descConfig });

    // Dimensões válidas mudaram (o admin removeu uma coluna do órgão): a
    // tabela já gerada passaria a mostrar um eixo que não existe mais.
    useEffect(() => {
        if (!pivotGerado) return;
        const validas = new Set(dimensions.map((d) => d.key));
        const usadas = [...pivotGerado.rowDims, ...pivotGerado.colDims].filter(Boolean);
        if (usadas.some((d) => !validas.has(d))) setPivotGerado(null);
    }, [dimensions, pivotGerado]);

    // ---- Modelos compartilhados no órgão ------------------------------------
    //
    // Quem pode editar/excluir é decidido no SERVIDOR; aqui a checagem só
    // esconde o botão que iria falhar, para não oferecer o que não se pode fazer.
    const podeEditar = (template) => (
        template.created_by === currentUserId || isOrgAdmin
    );

    const modelosPivot = useMemo(() => templates.filter((t) => t.tipo === 'pivot'), [templates]);
    const modelosDescritivo = useMemo(() => templates.filter((t) => t.tipo === 'descritivo'), [templates]);

    const salvarModelo = async (tipo) => {
        const nome = templateName.trim();
        if (!nome) {
            toast.error('Dê um nome ao modelo.');
            return;
        }
        if (tipo === 'pivot' && validationError) {
            toast.error(`Corrija o cruzamento antes de salvar: ${validationError}`);
            return;
        }
        const config = tipo === 'pivot'
            ? { ...pivotConfig, rowDims: [...rowDims], colDims: [...colDims] }
            : { ...descConfig };

        // Só é "atualizar" quando o modelo em edição é DESTE tipo: com um
        // descritivo em edição, "Salvar como modelo" na aba da tabela dinâmica
        // tem de criar um modelo novo, não tentar reescrever o descritivo.
        const editandoEsteTipo = editingTemplate?.tipo === tipo ? editingTemplate : null;

        setSavingTemplate(true);
        try {
            if (editandoEsteTipo) {
                await updateJurimetriaTemplate({
                    organizationId, id: editandoEsteTipo.id, nome, tipo, config,
                });
                toast.success(`Modelo "${nome}" atualizado.`);
            } else {
                await createJurimetriaTemplate({ organizationId, nome, tipo, config });
                toast.success(`Modelo "${nome}" salvo e disponível para todo o órgão.`);
            }
            setTemplateName('');
            if (editandoEsteTipo) setEditingTemplate(null);
        } catch (error) {
            logger.error('[jurimetria] erro ao salvar modelo:', error);
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
            const config = { ...DEFAULT_DESCRITIVO, ...template.config };
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

    const excluirModelo = async (template) => {
        try {
            await deleteJurimetriaTemplate({ organizationId, id: template.id });
            if (editingTemplate?.id === template.id) {
                setEditingTemplate(null);
                setTemplateName('');
            }
            toast.success(`Modelo "${template.nome}" excluído.`);
        } catch (error) {
            logger.error('[jurimetria] erro ao excluir modelo:', error);
            toast.error(error?.message || 'Não foi possível excluir o modelo.');
        }
    };

    /** Sobe para o órgão os modelos que ficaram presos neste navegador. */
    const migrarModelosLocais = async () => {
        setMigrating(true);
        let migrados = 0;
        // Cada modelo sai da lista local assim que sobe. Se a rede cair no
        // meio, tentar de novo retoma de onde parou, em vez de duplicar tudo
        // o que já tinha subido.
        let restantes = [...legacyTemplates];
        try {
            for (const legado of legacyTemplates) {
                // Um modelo antigo guardava os DOIS lados; vira um modelo de
                // cada tipo, que é como a coleção compartilhada os organiza.
                if (legado.pivot) {
                    await createJurimetriaTemplate({
                        organizationId,
                        nome: `${legado.name} (tabela)`.slice(0, 120),
                        tipo: 'pivot',
                        config: { ...DEFAULT_PIVOT, ...legado.pivot },
                    });
                    migrados += 1;
                }
                if (legado.descritivo) {
                    await createJurimetriaTemplate({
                        organizationId,
                        nome: `${legado.name} (descritivo)`.slice(0, 120),
                        tipo: 'descritivo',
                        config: { ...DEFAULT_DESCRITIVO, ...legado.descritivo },
                    });
                    migrados += 1;
                }
                restantes = restantes.filter((t) => t !== legado);
                persistLegacyTemplates(restantes);
            }
            setLegacyTemplates([]);
            toast.success(`${migrados} modelo(s) enviados para o órgão.`);
        } catch (error) {
            logger.error('[jurimetria] erro ao migrar modelos locais:', error);
            setLegacyTemplates(restantes);
            toast.error(
                `${migrados} modelo(s) enviados. `
                + (error?.message || 'O restante não subiu — tente novamente.')
            );
        } finally {
            setMigrating(false);
        }
    };

    // ---- Exportação da pivot ------------------------------------------------
    /** Converte a pivot renderizada em linhas planas, para qualquer formato. */
    const pivotToRows = () => {
        if (!pivot || !pivotGerado) return { rows: [], columns: [] };
        const measures = pivot.values.filter(Boolean);
        // Eixos da tabela GERADA: exportar com os eixos do rascunho produziria
        // um arquivo com cabeçalhos que não correspondem aos dados.
        const rowDims = pivotGerado.rowDims.filter(Boolean);
        const colDims = pivotGerado.colDims.filter(Boolean);

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

                        {/* Barra de ação: nada é gerado até aqui. */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={gerarPivot} disabled={Boolean(validationError)} className="gap-2">
                                    <Play className="w-4 h-4" />
                                    {pivotGerado ? 'Gerar novamente' : 'Gerar tabela dinâmica'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => salvarModelo('pivot')}
                                    disabled={savingTemplate || Boolean(validationError)}
                                    className="gap-2"
                                >
                                    {savingTemplate
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <BookmarkPlus className="w-4 h-4" />}
                                    {editingTemplate?.tipo === 'pivot' ? 'Atualizar modelo' : 'Salvar como modelo'}
                                </Button>
                                <Input
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Nome do modelo"
                                    className="h-9 w-[220px]"
                                />
                            </div>
                            {modelosPivot.length > 0 && (
                                <div className="flex items-center gap-2 sm:ml-auto">
                                    <Label className="text-xs text-slate-500 whitespace-nowrap">Modelo salvo</Label>
                                    <Select
                                        value=""
                                        onValueChange={(id) => {
                                            const modelo = modelosPivot.find((t) => t.id === id);
                                            if (modelo) aplicarModelo(modelo);
                                        }}
                                    >
                                        <SelectTrigger className="h-9 w-[240px]">
                                            <SelectValue placeholder="Aplicar um modelo…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modelosPivot.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {editingTemplate?.tipo === 'pivot' && (
                            <Alert>
                                <Pencil className="w-4 h-4" />
                                <AlertDescription className="text-xs flex items-center justify-between gap-3">
                                    <span>
                                        Editando o modelo <strong>{editingTemplate.nome}</strong>. Ajuste a
                                        configuração acima e clique em “Atualizar modelo”.
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setEditingTemplate(null); setTemplateName(''); }}
                                    >
                                        Cancelar edição
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {pivotDesatualizado && (
                            <Alert>
                                <RefreshCw className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    A configuração mudou desde a última geração. A tabela abaixo ainda reflete o
                                    cruzamento anterior — clique em <strong>Gerar novamente</strong> para atualizá-la.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {!pivot && !validationError && (
                    <p className="text-sm text-slate-400 text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Escolha o cruzamento acima e clique em <strong>Gerar tabela dinâmica</strong>.
                    </p>
                )}

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
                                rowDims={pivotGerado.rowDims.filter(Boolean)}
                                colDims={pivotGerado.colDims.filter(Boolean)}
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
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                    {JURIMETRIA_DESCRITIVO_ESTILOS.find((e) => e.key === descConfig.estilo)?.description}
                                </p>
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

                        {/* Barra de ação do descritivo. */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button onClick={gerarDescritivo} className="gap-2">
                                    <Play className="w-4 h-4" />
                                    {descGerado ? 'Gerar novamente' : 'Gerar relatório descritivo'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => salvarModelo('descritivo')}
                                    disabled={savingTemplate}
                                    className="gap-2"
                                >
                                    {savingTemplate
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <BookmarkPlus className="w-4 h-4" />}
                                    {editingTemplate?.tipo === 'descritivo' ? 'Atualizar modelo' : 'Salvar como modelo'}
                                </Button>
                                <Input
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Nome do modelo"
                                    className="h-9 w-[220px]"
                                />
                            </div>
                            {modelosDescritivo.length > 0 && (
                                <div className="flex items-center gap-2 sm:ml-auto">
                                    <Label className="text-xs text-slate-500 whitespace-nowrap">Modelo salvo</Label>
                                    <Select
                                        value=""
                                        onValueChange={(id) => {
                                            const modelo = modelosDescritivo.find((t) => t.id === id);
                                            if (modelo) aplicarModelo(modelo);
                                        }}
                                    >
                                        <SelectTrigger className="h-9 w-[240px]">
                                            <SelectValue placeholder="Aplicar um modelo…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {modelosDescritivo.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {editingTemplate?.tipo === 'descritivo' && (
                            <Alert>
                                <Pencil className="w-4 h-4" />
                                <AlertDescription className="text-xs flex items-center justify-between gap-3">
                                    <span>
                                        Editando o modelo <strong>{editingTemplate.nome}</strong>.
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setEditingTemplate(null); setTemplateName(''); }}
                                    >
                                        Cancelar edição
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {descDesatualizado && (
                            <Alert>
                                <RefreshCw className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    A configuração mudou desde a última geração. O texto abaixo ainda é o anterior —
                                    clique em <strong>Gerar novamente</strong> para atualizá-lo.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {!descGerado && (
                    <p className="text-sm text-slate-400 text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Escolha as opções acima e clique em <strong>Gerar relatório descritivo</strong>.
                    </p>
                )}

                {descGerado && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <CardTitle className="text-base">Relatório gerado</CardTitle>
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
                )}
            </TabsContent>

            {/* ---------------- Modelos ---------------- */}
            <TabsContent value="modelos" className="space-y-4 mt-0">
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Modelos do órgão</CardTitle>
                        <CardDescription>
                            Um modelo guarda o desenho de um relatório — o cruzamento da tabela dinâmica ou
                            as opções do descritivo — para reaplicar com um clique. Os modelos são do
                            <strong> órgão</strong>: qualquer membro usa qualquer modelo, mas só quem criou,
                            ou quem administra a Jurimetria, pode editar ou excluir. Para criar um, monte a
                            configuração nas abas <em>Tabela dinâmica</em> ou <em>Relatório descritivo</em> e
                            use “Salvar como modelo”.
                        </CardDescription>
                    </CardHeader>
                </Card>

                {legacyTemplates.length > 0 && (
                    <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-sm flex flex-col sm:flex-row sm:items-center gap-3">
                            <span className="flex-1">
                                Há <strong>{legacyTemplates.length}</strong> modelo(s) salvos apenas neste
                                navegador, de antes de os modelos serem compartilhados. Envie-os para o órgão
                                para que não se percam e fiquem disponíveis a todos.
                            </span>
                            <div className="flex gap-2 shrink-0">
                                <Button size="sm" onClick={migrarModelosLocais} disabled={migrating} className="gap-2">
                                    {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Enviar ao órgão
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { discardLegacyTemplates(); setLegacyTemplates([]); }}
                                    disabled={migrating}
                                >
                                    Descartar
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {templatesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Carregando modelos do órgão...
                    </div>
                ) : templates.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Nenhum modelo salvo neste órgão ainda.
                    </p>
                ) : (
                    <div className="space-y-5">
                        {[
                            { tipo: 'pivot', titulo: 'Tabelas dinâmicas', lista: modelosPivot, icon: Grid3x3 },
                            { tipo: 'descritivo', titulo: 'Relatórios descritivos', lista: modelosDescritivo, icon: FileText },
                        ].filter((g) => g.lista.length > 0).map(({ tipo, titulo, lista, icon: Icon }) => (
                            <div key={tipo} className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-slate-400" />
                                    {titulo}
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{lista.length}</Badge>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {lista.map((template) => (
                                        <Card key={template.id} className="border-slate-200 dark:border-slate-700">
                                            <CardContent className="p-4 flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate" title={template.nome}>
                                                        {template.nome}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {descreverModelo(template, dimensions)}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {template.created_by_name || 'Autor desconhecido'}
                                                        {template.created_by === currentUserId && ' (você)'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => aplicarModelo(template)}
                                                        title="Aplicar e gerar"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                    {podeEditar(template) && (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => editarModelo(template)}
                                                                title="Editar este modelo"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                                                onClick={() => excluirModelo(template)}
                                                                title="Excluir este modelo"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
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

/** Resumo de uma linha do modelo, para o cartão da lista. */
function descreverModelo(template, dimensions) {
    const rotulo = (key) => dimensions.find((d) => d.key === key)?.label || key;
    const cfg = template?.config || {};
    if (template?.tipo === 'pivot') {
        const linhas = (cfg.rowDims || []).filter(Boolean).map(rotulo).join(' › ') || '—';
        const colunas = (cfg.colDims || []).filter(Boolean).map(rotulo).join(' › ') || '—';
        return `Linhas: ${linhas} · Colunas: ${colunas}`;
    }
    const estilo = JURIMETRIA_DESCRITIVO_ESTILOS.find((e) => e.key === cfg.estilo)?.label || cfg.estilo || '—';
    const secoes = (cfg.secoes || []).length;
    return `Estilo: ${estilo} · ${secoes} seção(ões) · agrupado por ${rotulo(cfg.agrupador || 'comarca')}`;
}
