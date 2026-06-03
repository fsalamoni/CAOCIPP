import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    HeartPulse,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    XCircle,
} from 'lucide-react';
import { getSystemHealth } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function StatusIcon({ status }) {
    if (status === 'ok')
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    if (status === 'warn')
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
}

export default function HealthPanel() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getSystemHealth();
            setData(result);
        } catch (err) {
            logger.error('Falha ao carregar saúde do sistema:', err);
            setError(err?.message || 'Erro ao carregar saúde do sistema.');
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
                Verificando saúde do sistema...
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

    const checks = data?.checks || [];
    const metrics = data?.metrics || {};
    const recentErrors = data?.recentErrors || [];

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <HeartPulse className="w-5 h-5 text-rose-600" />
                        Saúde do sistema
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={load} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {checks.map((c) => (
                        <div
                            key={c.name}
                            className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0 last:pb-0"
                        >
                            <StatusIcon status={c.status} />
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {c.name}
                                </p>
                                <p className="text-sm text-slate-500">{c.detail}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatNumber(metrics.auditLogsLast24h)}
                        </p>
                        <p className="text-xs text-slate-500">Eventos (24h)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatNumber(metrics.auditLogsTotal)}
                        </p>
                        <p className="text-xs text-slate-500">Eventos (total)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatNumber(metrics.recentErrorCount)}
                        </p>
                        <p className="text-xs text-slate-500">Erros recentes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {metrics.lastActivityAt
                                ? new Date(metrics.lastActivityAt).toLocaleString('pt-BR')
                                : '—'}
                        </p>
                        <p className="text-xs text-slate-500">Última atividade</p>
                    </CardContent>
                </Card>
            </div>

            {recentErrors.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Eventos de erro recentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ação</TableHead>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>Quando</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentErrors.map((e, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">{e.action}</TableCell>
                                        <TableCell>{e.user_name || '—'}</TableCell>
                                        <TableCell className="text-slate-500">
                                            {e.timestamp
                                                ? new Date(e.timestamp).toLocaleString('pt-BR')
                                                : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <p className="text-xs text-slate-400">
                Diagnóstico somente leitura baseado nos registros de auditoria. Gerado em{' '}
                {data?.generatedAt
                    ? new Date(data.generatedAt).toLocaleString('pt-BR')
                    : '—'}
                .
            </p>
        </div>
    );
}
