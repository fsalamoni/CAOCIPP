import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle,
    RefreshCw, Info, ShieldCheck, ArrowRight, RotateCcw, ArrowUpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { previewJurisImport, commitJurisImport } from '@/services/jurimetriaService';
import {
    prepareImportPayload, JURIMETRIA_ACCEPTED_EXTENSIONS, supportsDocx,
} from '@/lib/jurimetriaFile';
import { JURIMETRIA_IMPORT_POLICIES } from '@/constants/jurimetria';
import { formatDateBR, formatNumber } from '@/lib/jurimetriaEngine';

const STATUS_META = {
    novo: {
        label: 'Novos', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400',
        card: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30',
        hint: 'Serão adicionados à base do órgão.',
    },
    sem_mudanca: {
        label: 'Sem mudança', icon: RefreshCw, tone: 'text-slate-500 dark:text-slate-400',
        card: 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30',
        hint: 'Já estão na base, idênticos. Nada será feito.',
    },
    atualizacao: {
        label: 'Atualizações', icon: ArrowUpCircle, tone: 'text-sky-600 dark:text-sky-400',
        card: 'border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30',
        hint: 'Já estão na base e a planilha traz dados que faltavam. Serão completados.',
    },
    conflito: {
        label: 'Conflitos', icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400',
        card: 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30',
        hint: 'Já estão na base com dados diferentes.',
    },
    invalido: {
        label: 'Inválidos', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400',
        card: 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30',
        hint: 'Não podem ser importados. Corrija na planilha.',
    },
};

const FIELD_LABELS = {
    data_juri: 'Data do júri',
    comarca: 'Comarca',
    tipo: 'Matéria / Tipo',
    resultado: 'Espécie',
    promotor: 'Promotor(a)',
    horario: 'Horário',
    vara: 'Vara',
    observacoes: 'Observações',
    realizacao: 'Realização',
};

/**
 * Importação de planilhas de júris, em duas etapas:
 *   1) Análise — o arquivo é lido e classificado SEM gravar nada;
 *   2) Confirmação — só então os registros aprovados entram na base.
 *
 * A importação é idempotente: reimportar o mesmo arquivo não duplica nada.
 */
export default function JurimetriaImport({ organization, settings, onImported }) {
    const inputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [payload, setPayload] = useState(null);
    const [policy, setPolicy] = useState(settings?.importPolicy || 'preserve');
    const [report, setReport] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [result, setResult] = useState(null);

    const reset = () => {
        setFile(null);
        setPayload(null);
        setReport(null);
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleFile = async (event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        setReport(null);
        setResult(null);
        setAnalyzing(true);

        try {
            const prepared = await prepareImportPayload(selected);
            setPayload(prepared);

            const response = await previewJurisImport({
                organizationId: organization.id,
                fileData: prepared.fileData,
                fileName: prepared.fileName,
                policy,
            });
            setReport(response);

            if ((response?.total || 0) === 0) {
                toast.warning('O arquivo não tem nenhuma linha de dados.');
            } else {
                toast.success(`Arquivo analisado: ${response.total} linha(s) lida(s).`);
            }
        } catch (error) {
            logger.error('[jurimetria] falha ao analisar arquivo:', error);
            toast.error(error?.message || 'Não foi possível ler o arquivo.');
            reset();
        } finally {
            setAnalyzing(false);
        }
    };

    const reanalyze = async (nextPolicy) => {
        setPolicy(nextPolicy);
        if (!payload) return;
        setAnalyzing(true);
        try {
            const response = await previewJurisImport({
                organizationId: organization.id,
                fileData: payload.fileData,
                fileName: payload.fileName,
                policy: nextPolicy,
            });
            setReport(response);
        } catch (error) {
            logger.error('[jurimetria] falha ao reanalisar:', error);
            toast.error(error?.message || 'Não foi possível reanalisar o arquivo.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleCommit = async () => {
        if (!payload || !report) return;
        setCommitting(true);
        try {
            const response = await commitJurisImport({
                organizationId: organization.id,
                fileData: payload.fileData,
                fileName: payload.fileName,
                policy,
            });
            setResult(response);
            toast.success(
                `Importação concluída: ${response.created || 0} novo(s)`
                + (response.enriched ? `, ${response.enriched} complementado(s)` : '')
                + (response.updated ? `, ${response.updated} atualizado(s)` : '') + '.'
            );
            if (onImported) onImported();
        } catch (error) {
            logger.error('[jurimetria] falha ao importar:', error);
            toast.error(error?.message || 'Não foi possível concluir a importação.');
        } finally {
            setCommitting(false);
        }
    };

    const counts = report?.counts
        || { novo: 0, sem_mudanca: 0, atualizacao: 0, conflito: 0, invalido: 0 };
    // Enriquecer é ganho puro (preenche o que estava vazio) e acontece com
    // qualquer política; sobrescrever um valor divergente depende da política.
    const seraoGravados = counts.novo
        + (counts.atualizacao || 0)
        + (policy === 'update' ? counts.conflito : 0);
    const busy = analyzing || committing;

    return (
        <div className="space-y-5">
            {/* 1. Seleção do arquivo */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="w-4 h-4 text-slate-400" />
                        1. Escolher o arquivo
                    </CardTitle>
                    <CardDescription>
                        Planilha do Excel (.xlsx, .xls), CSV, JSON ou documento do Word com tabela (.docx).
                        Todas as abas da planilha são lidas. O arquivo original nunca é alterado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <div className="flex-1 space-y-1.5">
                            <Label htmlFor="juri-import-file">Arquivo</Label>
                            <input
                                ref={inputRef}
                                id="juri-import-file"
                                type="file"
                                accept={JURIMETRIA_ACCEPTED_EXTENSIONS}
                                onChange={handleFile}
                                disabled={busy}
                                className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100 disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1.5 sm:w-72">
                            <Label>Em caso de conflito</Label>
                            <Select value={policy} onValueChange={reanalyze} disabled={busy}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {JURIMETRIA_IMPORT_POLICIES.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {JURIMETRIA_IMPORT_POLICIES.find((p) => p.value === policy)?.description}
                        {' '}O reconhecimento é feito pelo número do processo, ignorando pontuação — por isso
                        reimportar o mesmo arquivo nunca duplica nada.
                    </p>

                    {!supportsDocx() && (
                        <Alert>
                            <Info className="w-4 h-4" />
                            <AlertDescription className="text-xs">
                                Este navegador não abre arquivos .docx. Os demais formatos funcionam normalmente;
                                para importar de um documento do Word, use o Chrome ou o Edge, ou salve a tabela
                                como .xlsx antes.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Alert>
                        <ShieldCheck className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                            A importação é <strong>idempotente</strong>: o número do processo é a chave do registro,
                            então importar a mesma planilha duas vezes não duplica nada. Comarcas, matérias e espécies
                            são corrigidas automaticamente para as listas oficiais do órgão, e todas as correções
                            aparecem no relatório antes de você confirmar.
                        </AlertDescription>
                    </Alert>

                    {analyzing && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analisando o arquivo — nada foi gravado ainda...
                            </div>
                            <Progress value={66} className="h-1.5" />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Relatório da análise */}
            {report && !result && (
                <>
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                2. Conferir o que será importado
                            </CardTitle>
                            <CardDescription>
                                {file?.name} — {formatNumber(report.total)} linha(s) lida(s)
                                {payload?.rowsPreview ? ' (extraídas das tabelas do documento)' : ''}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {Object.entries(STATUS_META).map(([key, meta]) => {
                                    const Icon = meta.icon;
                                    return (
                                        <div key={key} className={`rounded-xl border p-3 ${meta.card}`}>
                                            <div className="flex items-center gap-2">
                                                <Icon className={`w-4 h-4 ${meta.tone}`} />
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                                {formatNumber(counts[key] || 0)}
                                            </p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                                {meta.hint}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            {report.unmappedHeaders?.length > 0 && (
                                <Alert>
                                    <Info className="w-4 h-4" />
                                    <AlertDescription className="text-xs">
                                        Colunas da planilha que não foram reconhecidas e serão ignoradas:{' '}
                                        <strong>{report.unmappedHeaders.join(', ')}</strong>. Para trazê-las,
                                        crie colunas com esses nomes em Painel Administrativo → Jurimetria.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {report.correctionsTotal > 0 && (
                                <Alert>
                                    <RotateCcw className="w-4 h-4" />
                                    <AlertDescription className="text-xs">
                                        <strong>{formatNumber(report.correctionsTotal)}</strong> valor(es) foram ajustados
                                        para as listas oficiais do órgão (ex.: “PORTO ALEGRE” → “Porto Alegre (0001)”).
                                        A lista completa está na aba <em>Correções</em> abaixo.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <Tabs defaultValue="novo">
                                <TabsList className="flex-wrap h-auto">
                                    {Object.entries(STATUS_META).map(([key, meta]) => (
                                        <TabsTrigger key={key} value={key} className="gap-2">
                                            {meta.label}
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                                {counts[key] || 0}
                                            </Badge>
                                        </TabsTrigger>
                                    ))}
                                    {report.correctionsTotal > 0 && (
                                        <TabsTrigger value="correcoes" className="gap-2">
                                            Correções
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                                {report.correctionsTotal}
                                            </Badge>
                                        </TabsTrigger>
                                    )}
                                </TabsList>

                                {Object.keys(STATUS_META).map((key) => (
                                    <TabsContent key={key} value={key} className="mt-3">
                                        <SampleTable
                                            rows={report.samples?.[key] || []}
                                            status={key}
                                            total={counts[key] || 0}
                                        />
                                    </TabsContent>
                                ))}

                                {report.correctionsTotal > 0 && (
                                    <TabsContent value="correcoes" className="mt-3">
                                        <ScrollArea className="h-72 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-20">Linha</TableHead>
                                                        <TableHead>Campo</TableHead>
                                                        <TableHead>Na planilha</TableHead>
                                                        <TableHead>Será gravado como</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(report.corrections || []).map((c, i) => (
                                                        <TableRow key={`${c.row}-${c.field}-${i}`}>
                                                            <TableCell className="text-xs tabular-nums">{c.row}</TableCell>
                                                            <TableCell className="text-xs">{c.field}</TableCell>
                                                            <TableCell className="text-xs text-slate-500 line-through">{c.from}</TableCell>
                                                            <TableCell className="text-xs font-medium">{c.to}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                        {report.correctionsTotal > (report.corrections?.length || 0) && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                Exibindo as primeiras {report.corrections.length} de{' '}
                                                {formatNumber(report.correctionsTotal)} correções.
                                            </p>
                                        )}
                                    </TabsContent>
                                )}
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* 3. Confirmação */}
                    <Card className="border-indigo-200 dark:border-indigo-900">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    3. Confirmar a importação
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {seraoGravados > 0 ? (
                                        <>
                                            <strong>{formatNumber(counts.novo)}</strong> júri(s) novo(s) serão adicionados
                                            {counts.atualizacao > 0 && (
                                                <>, <strong>{formatNumber(counts.atualizacao)}</strong> serão
                                                complementados com os dados que faltavam</>
                                            )}
                                            {policy === 'update' && counts.conflito > 0 && (
                                                <> e <strong>{formatNumber(counts.conflito)}</strong> terão os valores
                                                divergentes substituídos</>
                                            )}
                                            . Os demais permanecem como estão.
                                        </>
                                    ) : (
                                        'Nada a gravar com a política atual — a base já está em dia com este arquivo.'
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <Button variant="outline" onClick={reset} disabled={busy}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleCommit} disabled={busy || seraoGravados === 0} className="gap-2">
                                    {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    Importar {formatNumber(seraoGravados)} registro(s)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Resultado */}
            {result && (
                <Card className="border-emerald-200 dark:border-emerald-900">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-5 h-5" />
                            Importação concluída
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
                            <Stat label="Adicionados" value={result.created || 0} />
                            <Stat label="Complementados" value={result.enriched || 0} />
                            <Stat label="Atualizados" value={result.updated || 0} />
                            <Stat label="Sem mudança" value={counts.sem_mudanca || 0} />
                            <Stat label="Não importados" value={(counts.invalido || 0) + (policy === 'preserve' ? (counts.conflito || 0) : 0)} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Os júris já aparecem nas abas Júris, Painel e Relatórios. Cada registro importado guarda
                            o arquivo de origem no seu histórico.
                        </p>
                        <Button variant="outline" onClick={reset} className="gap-2">
                            <Upload className="w-4 h-4" />
                            Importar outro arquivo
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatNumber(value)}</p>
        </div>
    );
}

function SampleTable({ rows, status, total }) {
    if (total === 0) {
        return (
            <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                Nenhuma linha nesta categoria.
            </p>
        );
    }

    return (
        <>
            <ScrollArea className="h-72 rounded-lg border border-slate-200 dark:border-slate-700">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">Linha</TableHead>
                            <TableHead>Processo</TableHead>
                            {status === 'invalido' ? (
                                <TableHead>Motivo</TableHead>
                            ) : status === 'conflito' ? (
                                <TableHead>Divergências</TableHead>
                            ) : status === 'atualizacao' ? (
                                <TableHead>Dados que serão completados</TableHead>
                            ) : (
                                <>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Comarca</TableHead>
                                    <TableHead>Espécie</TableHead>
                                </>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={`${row.row}-${row.numero_processo}`}>
                                <TableCell className="text-xs tabular-nums text-slate-400">{row.row}</TableCell>
                                <TableCell className="text-xs font-mono">{row.numero_processo || '—'}</TableCell>
                                {status === 'invalido' ? (
                                    <TableCell className="text-xs text-rose-600 dark:text-rose-400">{row.error}</TableCell>
                                ) : status === 'conflito' ? (
                                    <TableCell className="text-xs">
                                        <ul className="space-y-0.5">
                                            {(row.diffs || []).map((d, i) => (
                                                <li key={`${d.field}-${i}`}>
                                                    <span className="text-slate-500">{FIELD_LABELS[d.field] || d.field}:</span>{' '}
                                                    <span className="line-through text-slate-400">{d.current || '(vazio)'}</span>
                                                    {' → '}
                                                    <span className="font-medium">{d.incoming}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {(row.fills || []).length > 0 && (
                                            <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-1">
                                                + {row.fills.length} campo(s) vazio(s) que serão preenchidos de
                                                qualquer forma.
                                            </p>
                                        )}
                                    </TableCell>
                                ) : status === 'atualizacao' ? (
                                    <TableCell className="text-xs">
                                        <ul className="space-y-0.5">
                                            {(row.fills || []).map((f, i) => (
                                                <li key={`${f.field}-${i}`}>
                                                    <span className="text-slate-500">{FIELD_LABELS[f.field] || f.field}:</span>{' '}
                                                    <span className="text-slate-400">(vazio)</span>
                                                    {' → '}
                                                    <span className="font-medium text-sky-700 dark:text-sky-300">{f.incoming}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                ) : (
                                    <>
                                        <TableCell className="text-xs">{formatDateBR(row.data_juri)}</TableCell>
                                        <TableCell className="text-xs">{row.comarca || '—'}</TableCell>
                                        <TableCell className="text-xs">{row.resultado || '—'}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
            {total > rows.length && (
                <p className="text-xs text-slate-400 mt-2">
                    Exibindo as primeiras {rows.length} de {formatNumber(total)} linhas desta categoria.
                </p>
            )}
        </>
    );
}
