import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { HardDrive, RefreshCw, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { getStorageFootprint } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatBytes(bytes) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i += 1;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n || 0);
}

export default function FootprintPanel() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getStorageFootprint();
            setData(result);
        } catch (err) {
            logger.error('Falha ao carregar footprint:', err);
            setError(err?.message || 'Erro ao carregar footprint.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando footprint...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
                <AlertCircle className="w-5 h-5" />
                {error}
            </div>
        );
    }

    const collections = data?.collections || [];
    const samples = data?.samples || [];
    const alerts = data?.alerts || [];

    return (
        <div className="space-y-4">
            {alerts.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <ul className="list-disc pl-4 space-y-1">
                            {alerts.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <HardDrive className="w-5 h-5 text-cyan-600" />
                        Armazenamento por coleção
                        <span className="text-sm font-normal text-slate-400">
                            (total ~{formatBytes(data?.totalEstimatedBytes)})
                        </span>
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={load} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Coleção</TableHead>
                                <TableHead className="text-right">Documentos</TableHead>
                                <TableHead className="text-right">Bytes estimados*</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {collections.map((c) => (
                                <TableRow key={c.collection}>
                                    <TableCell className="font-medium">{c.collection}</TableCell>
                                    <TableCell className="text-right">{formatNumber(c.count)}</TableCell>
                                    <TableCell className="text-right text-slate-500">{formatBytes(c.estimatedBytes)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <p className="text-xs text-slate-400 mt-3">
                        * Estimativa por tamanho médio de documento (não é o valor exato do
                        faturamento).
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Amostragem de histórico (activity_log)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Coleção</TableHead>
                                <TableHead className="text-right">Amostrados</TableHead>
                                <TableHead className="text-right">Máx. entradas</TableHead>
                                <TableHead className="text-right">Média entradas</TableHead>
                                <TableHead className="text-right">Acima do limiar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {samples.map((s) => (
                                <TableRow key={s.collection}>
                                    <TableCell className="font-medium">{s.collection}</TableCell>
                                    <TableCell className="text-right">{formatNumber(s.sampled)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(s.maxLogEntries)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(s.avgLogEntries)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(s.docsOverThreshold)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <p className="text-xs text-slate-400 mt-3">
                        Limite de documento do Firestore: {formatBytes(data?.docLimitBytes)}.
                        Históricos grandes podem ser migrados para subcoleção (flag
                        “Histórico em subcoleção”).
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
