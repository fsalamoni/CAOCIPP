import React, { useState, useMemo, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Upload, Loader2, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { FIELD_TYPE_LIST, formatFieldValue } from '@/lib/fieldTypes';
import {
    parseSpreadsheetFile, proposeFieldsFromColumns, autoMatchColumns,
    coerceImportedValue, normalizeHeader,
} from '@/lib/spreadsheet';
import { importRecords } from '@/services/customEntitiesService';

const IGNORE = '-1';
const MAX_ROWS = 5000;

/**
 * Diálogo de importação de planilha para páginas personalizadas.
 *
 * mode = 'structure' : lê os cabeçalhos e propõe colunas (campos) com tipo
 *                      inferido; ao confirmar chama onStructureReady(fields).
 * mode = 'data'      : mapeia cada coluna da plataforma a uma coluna da
 *                      planilha (por nome ou letra) e importa os registros.
 *
 * props: open, onOpenChange, mode, organizationId, entityType, onStructureReady, onImported
 */
export default function SpreadsheetImportDialog({
    open, onOpenChange, mode = 'structure', organizationId, entityType, onStructureReady, onImported,
}) {
    const [fileName, setFileName] = useState('');
    const [parsing, setParsing] = useState(false);
    const [parsed, setParsed] = useState(null); // { columns, rows }
    const [proposed, setProposed] = useState([]); // structure: [{...field, _include}]
    const [mapping, setMapping] = useState({}); // data: { fieldKey: columnIndex }
    const [phaseColumn, setPhaseColumn] = useState(IGNORE);
    const [typeColumn, setTypeColumn] = useState(IGNORE);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    const reset = useCallback(() => {
        setFileName(''); setParsing(false); setParsed(null); setProposed([]);
        setMapping({}); setPhaseColumn(IGNORE); setTypeColumn(IGNORE); setImporting(false); setResult(null);
    }, []);

    const handleOpenChange = (v) => {
        if (!v) reset();
        onOpenChange(v);
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setFileName(file.name);
        setParsing(true);
        setResult(null);
        try {
            const data = await parseSpreadsheetFile(file);
            if (!data.columns.length) throw new Error('Nenhuma coluna encontrada.');
            setParsed(data);
            if (mode === 'structure') {
                setProposed(proposeFieldsFromColumns(data.columns, data.rows).map((f) => ({ ...f, _include: true })));
            } else {
                setMapping(autoMatchColumns(entityType?.fields || [], data.columns));
            }
        } catch (err) {
            toast.error(err?.message || 'Não foi possível ler a planilha.');
            setParsed(null);
        } finally {
            setParsing(false);
        }
    };

    // -------- estrutura --------
    const updateProposed = (idx, patch) => setProposed((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

    const confirmStructure = () => {
        const chosen = proposed.filter((f) => f._include && String(f.label).trim());
        if (chosen.length === 0) { toast.error('Selecione ao menos uma coluna.'); return; }
        const fields = chosen.map(({ _include, ...f }) => f);
        onStructureReady?.(fields);
        handleOpenChange(false);
    };

    // -------- dados --------
    const phases = useMemo(
        () => (entityType?.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        [entityType]
    );
    const recordTypes = useMemo(() => entityType?.record_types || [], [entityType]);

    const resolvePhase = useCallback((rowCells) => {
        if (phaseColumn === IGNORE) return undefined;
        const cell = rowCells[Number(phaseColumn)];
        const norm = normalizeHeader(cell);
        if (!norm) return undefined;
        const hit = phases.find((p) => normalizeHeader(p.label) === norm || normalizeHeader(p.key) === norm);
        return hit?.key;
    }, [phaseColumn, phases]);

    const resolveType = useCallback((rowCells) => {
        if (typeColumn === IGNORE) return undefined;
        const norm = normalizeHeader(rowCells[Number(typeColumn)]);
        if (!norm) return undefined;
        const hit = recordTypes.find((t) => normalizeHeader(t.label) === norm || normalizeHeader(t.key) === norm);
        return hit?.key;
    }, [typeColumn, recordTypes]);

    const buildRows = useCallback(() => {
        const fieldByKey = Object.fromEntries((entityType?.fields || []).map((f) => [f.key, f]));
        return (parsed?.rows || []).map((cells) => {
            const values = {};
            for (const [fieldKey, colIdx] of Object.entries(mapping)) {
                if (colIdx === undefined || Number(colIdx) < 0) continue;
                const field = fieldByKey[fieldKey];
                if (!field) continue;
                values[fieldKey] = coerceImportedValue(field, cells[Number(colIdx)]);
            }
            return { values, phase: resolvePhase(cells), record_type: resolveType(cells) };
        });
    }, [parsed, mapping, entityType, resolvePhase, resolveType]);

    const mappedCount = useMemo(
        () => Object.values(mapping).filter((v) => v !== undefined && Number(v) >= 0).length,
        [mapping]
    );

    const previewRows = useMemo(() => (parsed ? buildRows().slice(0, 5) : []), [parsed, buildRows]);

    const runImport = async () => {
        if (!entityType?.id) return;
        const rows = buildRows();
        if (rows.length === 0) { toast.error('A planilha não tem linhas de dados.'); return; }
        if (rows.length > MAX_ROWS) { toast.error(`Máximo de ${MAX_ROWS} linhas por importação.`); return; }
        if (mappedCount === 0) { toast.error('Mapeie ao menos uma coluna.'); return; }
        setImporting(true);
        try {
            const res = await importRecords(organizationId, entityType.id, rows);
            setResult(res);
            if (res?.created > 0) {
                toast.success(`${res.created} ${res.created === 1 ? 'registro importado' : 'registros importados'}.`);
                onImported?.();
            }
            if (res?.failed > 0) {
                toast.warning(`${res.failed} linha(s) não importada(s).`);
            }
        } catch (err) {
            toast.error(err?.message || 'Falha na importação.');
        } finally {
            setImporting(false);
        }
    };

    const columnOptions = parsed?.columns || [];

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        {mode === 'structure' ? 'Importar planilha (criar colunas)' : `Importar dados — ${entityType?.label_plural || ''}`}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'structure'
                            ? 'Carregue uma planilha para criar as colunas a partir dos cabeçalhos. Depois você define as fases por cima delas.'
                            : 'Carregue uma planilha e indique qual coluna dela corresponde a cada coluna desta página. A correspondência pode ser por nome ou pela letra da coluna.'}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-3 -mr-2">
                    {/* Upload */}
                    {!parsed && (
                        <div className="py-8">
                            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/40 transition-colors">
                                {parsing ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                )}
                                <div className="text-center">
                                    <p className="text-sm font-medium">{parsing ? 'Lendo planilha...' : 'Clique para escolher uma planilha'}</p>
                                    <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) ou CSV{fileName ? ` · ${fileName}` : ''}</p>
                                </div>
                                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={parsing} />
                            </label>
                        </div>
                    )}

                    {/* Estrutura: revisar colunas detectadas */}
                    {parsed && mode === 'structure' && (
                        <div className="space-y-2 py-2">
                            <p className="text-xs text-muted-foreground">
                                {proposed.length} coluna(s) detectada(s) em <span className="font-medium">{fileName}</span>. Ajuste o nome e o tipo de cada uma.
                            </p>
                            {proposed.map((f, idx) => (
                                <Card key={idx} className="p-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                            type="checkbox"
                                            checked={f._include}
                                            onChange={(e) => updateProposed(idx, { _include: e.target.checked })}
                                            title="Incluir esta coluna"
                                        />
                                        <Badge variant="outline" className="font-mono shrink-0">{parsed.columns[idx]?.letter}</Badge>
                                        <Input
                                            className="h-8 flex-1 min-w-[140px]"
                                            value={f.label}
                                            onChange={(e) => updateProposed(idx, { label: e.target.value })}
                                            disabled={!f._include}
                                        />
                                        <Select value={f.type} onValueChange={(v) => updateProposed(idx, { type: v })} disabled={!f._include}>
                                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {FIELD_TYPE_LIST.map((t) => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Dados: mapeamento coluna a coluna */}
                    {parsed && mode === 'data' && (
                        <div className="space-y-4 py-2">
                            <p className="text-xs text-muted-foreground">
                                {parsed.rows.length} linha(s) em <span className="font-medium">{fileName}</span>. Para cada coluna desta página, escolha a coluna da planilha.
                            </p>

                            <div className="space-y-1.5">
                                {(entityType?.fields || []).map((field) => (
                                    <div key={field.key} className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 w-56 shrink-0">
                                            <span className="text-sm truncate">{field.label}</span>
                                            {field.required && <span className="text-red-500" title="Obrigatória">*</span>}
                                            <Badge variant="secondary" className="text-[10px] ml-auto">{field.type}</Badge>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <Select
                                            value={String(mapping[field.key] ?? IGNORE)}
                                            onValueChange={(v) => setMapping((prev) => ({ ...prev, [field.key]: Number(v) }))}
                                        >
                                            <SelectTrigger className="h-8 flex-1 min-w-[180px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={IGNORE}>— Ignorar —</SelectItem>
                                                {columnOptions.map((c) => (
                                                    <SelectItem key={c.index} value={String(c.index)}>{c.letter} · {c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>

                            {phases.length > 1 && (
                                <div className="flex items-center gap-2 flex-wrap border-t pt-3">
                                    <div className="w-56 shrink-0 text-sm">Coluna que define a fase <span className="text-muted-foreground">(opcional)</span></div>
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <Select value={phaseColumn} onValueChange={setPhaseColumn}>
                                        <SelectTrigger className="h-8 flex-1 min-w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={IGNORE}>Usar a fase inicial</SelectItem>
                                            {columnOptions.map((c) => (
                                                <SelectItem key={c.index} value={String(c.index)}>{c.letter} · {c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {recordTypes.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-56 shrink-0 text-sm">Coluna que define o tipo <span className="text-muted-foreground">(opcional)</span></div>
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <Select value={typeColumn} onValueChange={setTypeColumn}>
                                        <SelectTrigger className="h-8 flex-1 min-w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={IGNORE}>Sem tipo</SelectItem>
                                            {columnOptions.map((c) => (
                                                <SelectItem key={c.index} value={String(c.index)}>{c.letter} · {c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Pré-visualização */}
                            {mappedCount > 0 && previewRows.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Pré-visualização (primeiras linhas)</Label>
                                    <div className="rounded-md border overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50">
                                                <tr>
                                                    {(entityType?.fields || []).filter((f) => Number(mapping[f.key] ?? -1) >= 0).map((f) => (
                                                        <th key={f.key} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{f.label}</th>
                                                    ))}
                                                    {phaseColumn !== IGNORE && <th className="text-left font-medium px-2 py-1.5">Fase</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewRows.map((r, i) => (
                                                    <tr key={i} className="border-t">
                                                        {(entityType?.fields || []).filter((f) => Number(mapping[f.key] ?? -1) >= 0).map((f) => (
                                                            <td key={f.key} className="px-2 py-1.5 whitespace-nowrap max-w-[180px] truncate">
                                                                {formatFieldValue(f, r.values[f.key])}
                                                            </td>
                                                        ))}
                                                        {phaseColumn !== IGNORE && (
                                                            <td className="px-2 py-1.5">{phases.find((p) => p.key === r.phase)?.label || '— inicial —'}</td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Resultado */}
                            {result && (
                                <div className="rounded-md border p-3 space-y-1.5">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        {result.created > 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                        {result.created} importado(s) · {result.failed} com erro · {result.total} no total
                                    </div>
                                    {Array.isArray(result.errorDetails) && result.errorDetails.length > 0 && (
                                        <ul className="text-xs text-muted-foreground list-disc pl-5">
                                            {result.errorDetails.slice(0, 5).map((d, i) => (
                                                <li key={i}>Linha {d.row}: {d.error}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="gap-2">
                    {parsed && (
                        <Button variant="ghost" onClick={reset} disabled={importing}>Trocar arquivo</Button>
                    )}
                    <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
                        {result?.created > 0 ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {parsed && mode === 'structure' && (
                        <Button onClick={confirmStructure}>Usar estas colunas</Button>
                    )}
                    {parsed && mode === 'data' && (
                        <Button onClick={runImport} disabled={importing || mappedCount === 0}>
                            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Importar {parsed.rows.length} linha(s)
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
