import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle,
    RefreshCw, Info, ArrowRight, ArrowUpCircle, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { fileToBase64, fileExtension } from '@/lib/jurimetriaFile';
import { formatNumber } from '@/lib/panoramaEngine';
import { PANORAMA_IMPORT_POLICIES } from '@/constants/panorama';
import { previewPanoramaImport, commitPanoramaImport } from '@/services/panoramaService';
import PanoramaMapeamento from './PanoramaMapeamento';

const ACEITOS = '.xlsx,.xls,.csv,.json';
const MAX_BYTES = 10 * 1024 * 1024;

const STATUS_META = {
    novo: {
        label: 'Novos', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400',
        card: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30',
        hint: 'Serão acrescentados à base.',
    },
    sem_mudanca: {
        label: 'Sem mudança', icon: RefreshCw, tone: 'text-slate-500 dark:text-slate-400',
        card: 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30',
        hint: 'Já estão na base, idênticos. Nada será feito.',
    },
    atualizacao: {
        label: 'Atualizações', icon: ArrowUpCircle, tone: 'text-sky-600 dark:text-sky-400',
        card: 'border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30',
        hint: 'Já existem e a planilha traz dados que faltavam. Serão completados.',
    },
    conflito: {
        label: 'Conflitos', icon: AlertTriangle, tone: 'text-amber-600 dark:text-amber-400',
        card: 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30',
        hint: 'Já existem com dados diferentes.',
    },
    invalido: {
        label: 'Inválidos', icon: XCircle, tone: 'text-rose-600 dark:text-rose-400',
        card: 'border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30',
        hint: 'Não podem ser importados. Corrija na planilha.',
    },
};

/**
 * Importação no Panorama, em duas etapas — e é na PRIMEIRA que o módulo se
 * distingue da Jurimetria.
 *
 * Lá o servidor já sabia quais colunas procurar. Aqui ele lê a planilha, mede
 * cada coluna e devolve uma proposta de esquema, que o usuário confirma antes
 * de qualquer gravação. Uma base nova nasce desse gesto; uma base existente
 * apenas recebe as linhas novas, com as colunas que o admin já configurou.
 */
export default function PanoramaImport({
    organization, base, bases = [], onImported, onBaseCriada, podeConfigurar,
}) {
    const inputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [payload, setPayload] = useState(null);
    const [report, setReport] = useState(null);
    const [columns, setColumns] = useState([]);
    const [baseNome, setBaseNome] = useState('');
    const [alvo, setAlvo] = useState(base?.id || '__nova__');
    const [policy, setPolicy] = useState(base?.importPolicy || 'preserve');
    const [analyzing, setAnalyzing] = useState(false);
    const [committing, setCommitting] = useState(false);
    const [result, setResult] = useState(null);

    const baseNova = alvo === '__nova__';
    const busy = analyzing || committing;

    const reset = () => {
        setFile(null);
        setPayload(null);
        setReport(null);
        setColumns([]);
        setResult(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const analisar = async (arquivo, alvoId, policyAtual) => {
        setAnalyzing(true);
        setReport(null);
        setResult(null);
        try {
            const fileData = await fileToBase64(arquivo);
            const dados = {
                organizationId: organization.id,
                baseId: alvoId === '__nova__' ? '' : alvoId,
                fileData,
                fileName: arquivo.name,
                policy: policyAtual,
            };
            const resposta = await previewPanoramaImport(dados);
            setPayload(dados);
            setReport(resposta);
            setColumns(resposta.colunas || []);
            if (alvoId === '__nova__' && !baseNome) {
                setBaseNome(arquivo.name.replace(/\.[^.]+$/, ''));
            }
        } catch (error) {
            logger.error('[panorama] falha ao analisar:', error);
            toast.error(error?.message || 'Não foi possível ler o arquivo.');
            reset();
        } finally {
            setAnalyzing(false);
        }
    };

    const handleFile = async (event) => {
        const arquivo = event.target.files?.[0];
        if (!arquivo) return;
        if (arquivo.size > MAX_BYTES) {
            toast.error('Arquivo maior que 10 MB.');
            reset();
            return;
        }
        const ext = fileExtension(arquivo);
        if (!['xlsx', 'xls', 'csv', 'json'].includes(ext)) {
            toast.error('Formato não aceito. Use .xlsx, .xls, .csv ou .json.');
            reset();
            return;
        }
        setFile(arquivo);
        await analisar(arquivo, alvo, policy);
    };

    const trocarAlvo = async (novoAlvo) => {
        setAlvo(novoAlvo);
        if (file) await analisar(file, novoAlvo, policy);
    };

    const trocarPolitica = async (novaPolitica) => {
        setPolicy(novaPolitica);
        if (file) await analisar(file, alvo, novaPolitica);
    };

    const handleCommit = async () => {
        if (!payload || !report) return;
        if (baseNova && !baseNome.trim()) {
            toast.error('Dê um nome à base.');
            return;
        }
        setCommitting(true);
        try {
            const resposta = await commitPanoramaImport({
                ...payload,
                columns,
                baseNome: baseNome.trim(),
            });
            setResult(resposta);
            toast.success(
                `Importação concluída: ${resposta.criados || 0} novo(s)`
                + (resposta.enriquecidos ? `, ${resposta.enriquecidos} complementado(s)` : '')
                + (resposta.atualizados ? `, ${resposta.atualizados} atualizado(s)` : '') + '.'
            );
            if (baseNova && resposta.baseId && onBaseCriada) onBaseCriada(resposta.baseId);
            if (onImported) onImported();
        } catch (error) {
            logger.error('[panorama] falha ao importar:', error);
            toast.error(error?.message || 'Não foi possível concluir a importação.');
        } finally {
            setCommitting(false);
        }
    };

    const counts = report?.counts
        || { novo: 0, sem_mudanca: 0, atualizacao: 0, conflito: 0, invalido: 0 };
    const seraoGravados = counts.novo
        + (counts.atualizacao || 0)
        + (policy === 'update' ? counts.conflito : 0);

    return (
        <div className="space-y-5">
            {/* 1. Arquivo e destino */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="w-4 h-4 text-slate-400" />
                        1. Escolher o arquivo e o destino
                    </CardTitle>
                    <CardDescription>
                        Planilha do Excel (.xlsx, .xls), CSV ou JSON. Todas as abas da planilha são lidas.
                        O arquivo original nunca é alterado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="panorama-file">Arquivo</Label>
                            <input
                                ref={inputRef}
                                id="panorama-file"
                                type="file"
                                accept={ACEITOS}
                                onChange={handleFile}
                                disabled={busy}
                                className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100 disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Destino</Label>
                            <Select value={alvo} onValueChange={trocarAlvo} disabled={busy}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {podeConfigurar && (
                                        <SelectItem value="__nova__">+ Criar uma base nova</SelectItem>
                                    )}
                                    {bases.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-slate-400">
                                {baseNova
                                    ? 'A base será criada com as colunas desta planilha.'
                                    : 'As linhas entram na base existente, com as colunas já configuradas.'}
                            </p>
                        </div>
                    </div>

                    {baseNova && (
                        <div className="space-y-1.5 max-w-md">
                            <Label htmlFor="panorama-base-nome">Nome da base</Label>
                            <Input
                                id="panorama-base-nome"
                                value={baseNome}
                                onChange={(e) => setBaseNome(e.target.value)}
                                placeholder="Ex.: Improbidade administrativa"
                                disabled={busy}
                            />
                        </div>
                    )}

                    <div className="space-y-1.5 max-w-md">
                        <Label>Política para dados divergentes</Label>
                        <Select value={policy} onValueChange={trocarPolitica} disabled={busy}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PANORAMA_IMPORT_POLICIES.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {PANORAMA_IMPORT_POLICIES.find((p) => p.value === policy)?.description}
                        </p>
                    </div>

                    <Alert>
                        <ShieldCheck className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                            Os dados importados ficam no banco da plataforma, acessíveis a todos os membros
                            deste órgão. A responsabilidade sobre o que é importado — inclusive quanto a
                            dados pessoais e sigilo — é do órgão que importa.
                        </AlertDescription>
                    </Alert>

                    {analyzing && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Lendo a planilha e identificando as colunas...
                        </div>
                    )}
                </CardContent>
            </Card>

            {report && !result && (
                <>
                    {/* 2. Mapeamento */}
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                                2. Conferir o que a plataforma entendeu
                            </CardTitle>
                            <CardDescription>
                                {file?.name} — {formatNumber(report.total)} linha(s),{' '}
                                {formatNumber(columns.length)} coluna(s) reconhecida(s).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PanoramaMapeamento
                                columns={columns}
                                onChange={setColumns}
                                compacto={!baseNova}
                                somenteLeitura={!podeConfigurar && !baseNova}
                            />
                        </CardContent>
                    </Card>

                    {/* 3. Classificação das linhas */}
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">3. O que será feito com cada linha</CardTitle>
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

                            {report.correctionsTotal > 0 && (
                                <Alert>
                                    <RotateCcw className="w-4 h-4" />
                                    <AlertDescription className="text-xs">
                                        <strong>{formatNumber(report.correctionsTotal)}</strong> valor(es) foram
                                        aproximados de valores que já existem na base — é o que impede
                                        “PORTO ALEGRE”, “Porto Alegre” e “P. Alegre” de virarem três grupos
                                        diferentes no relatório. A lista está na aba <em>Correções</em>.
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
                                        <AmostraTabela
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
                                                        <TableHead>Coluna</TableHead>
                                                        <TableHead>Estava</TableHead>
                                                        <TableHead>Virou</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(report.corrections || []).map((c, i) => (
                                                        <TableRow key={`${c.row}-${i}`}>
                                                            <TableCell className="text-xs tabular-nums text-slate-400">{c.row}</TableCell>
                                                            <TableCell className="text-xs">{c.field}</TableCell>
                                                            <TableCell className="text-xs text-slate-400 line-through">{c.from}</TableCell>
                                                            <TableCell className="text-xs font-medium">{c.to}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </TabsContent>
                                )}
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* 4. Confirmação */}
                    <Card className="border-indigo-200 dark:border-indigo-900">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                    4. Confirmar a importação
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {seraoGravados > 0 ? (
                                        <>
                                            <strong>{formatNumber(counts.novo)}</strong> registro(s) novo(s)
                                            {counts.atualizacao > 0 && (
                                                <>, <strong>{formatNumber(counts.atualizacao)}</strong> complementado(s)</>
                                            )}
                                            {policy === 'update' && counts.conflito > 0 && (
                                                <> e <strong>{formatNumber(counts.conflito)}</strong> com valores substituídos</>
                                            )}
                                            . Os demais permanecem como estão.
                                        </>
                                    ) : (
                                        'Nada a gravar com a política atual — a base já está em dia com este arquivo.'
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <Button variant="outline" onClick={reset} disabled={busy}>Cancelar</Button>
                                <Button onClick={handleCommit} disabled={busy || seraoGravados === 0} className="gap-2">
                                    {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    Importar {formatNumber(seraoGravados)} registro(s)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {result && (
                <Card className="border-emerald-200 dark:border-emerald-900">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-5 h-5" />
                            Importação concluída
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <Stat label="Adicionados" value={result.criados || 0} />
                            <Stat label="Complementados" value={result.enriquecidos || 0} />
                            <Stat label="Atualizados" value={result.atualizados || 0} />
                            <Stat label="Não importados" value={(counts.invalido || 0) + (policy === 'preserve' ? (counts.conflito || 0) : 0)} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Os registros já aparecem nas abas Dados, Painel e Relatórios. Cada um guarda o
                            arquivo de origem no seu histórico.
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
            <p className="text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
        </div>
    );
}

function AmostraTabela({ rows, status, total }) {
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
                            <TableHead>Identificador</TableHead>
                            <TableHead>
                                {status === 'invalido' ? 'Motivo'
                                    : status === 'conflito' ? 'Divergências'
                                        : status === 'atualizacao' ? 'Será completado com' : 'Conteúdo'}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={`${row.row}-${i}`}>
                                <TableCell className="text-xs tabular-nums text-slate-400">{row.row}</TableCell>
                                <TableCell className="text-xs font-mono">{row.chave || '—'}</TableCell>
                                <TableCell className="text-xs">
                                    {status === 'invalido' ? (
                                        <span className="text-rose-600 dark:text-rose-400">{row.error}</span>
                                    ) : status === 'conflito' ? (
                                        <ul className="space-y-0.5">
                                            {(row.diffs || []).map((d, k) => (
                                                <li key={`${d.field}-${k}`}>
                                                    <span className="text-slate-500">{d.field}:</span>{' '}
                                                    <span className="line-through text-slate-400">{d.current}</span>
                                                    {' → '}
                                                    <span className="font-medium">{d.incoming}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : status === 'atualizacao' ? (
                                        <ul className="space-y-0.5">
                                            {(row.fills || []).map((f, k) => (
                                                <li key={`${f.field}-${k}`}>
                                                    <span className="text-slate-500">{f.field}:</span>{' '}
                                                    <span className="text-slate-400">(vazio)</span>
                                                    {' → '}
                                                    <span className="font-medium text-sky-700 dark:text-sky-300">{f.incoming}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-slate-600 dark:text-slate-300">{row.resumo}</span>
                                    )}
                                </TableCell>
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
            {status === 'invalido' && total > 0 && (
                <Alert className="mt-2">
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                        Linhas inválidas são simplesmente ignoradas — a importação prossegue com as demais.
                        Corrija a planilha e importe de novo: as que já entraram não serão duplicadas.
                    </AlertDescription>
                </Alert>
            )}
        </>
    );
}
