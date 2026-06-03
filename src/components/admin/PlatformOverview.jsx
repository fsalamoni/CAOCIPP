import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Building2,
    Users,
    FileText,
    ScrollText,
    Database,
    HardDrive,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { getPlatformOverview } from '@/services/platformService';
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

const KPI_CARDS = [
    { key: 'organizations', label: 'Órgãos', icon: Building2, color: 'text-indigo-600' },
    { key: 'users', label: 'Usuários', icon: Users, color: 'text-violet-600' },
    { key: 'processes', label: 'Processos', icon: FileText, color: 'text-blue-600' },
    { key: 'expedientes', label: 'Expedientes', icon: ScrollText, color: 'text-cyan-600' },
    { key: 'memberships', label: 'Vínculos', icon: Users, color: 'text-emerald-600' },
    { key: 'auditLogs', label: 'Movimentações', icon: Database, color: 'text-amber-600' },
];

export default function PlatformOverview() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getPlatformOverview();
            setData(result);
        } catch (err) {
            logger.error('Falha ao carregar visão geral:', err);
            setError(err?.message || 'Erro ao carregar dados.');
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
                Carregando visão geral...
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="py-8 text-center space-y-3">
                    <p className="text-red-600">{error}</p>
                    <Button onClick={load} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const totals = data?.totals || {};
    const storage = data?.storageEstimate || { totalBytes: 0, byCollection: {} };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Gerado em {new Date(data?.generatedAt).toLocaleString('pt-BR')}
                </p>
                <Button onClick={load} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {KPI_CARDS.map(({ key, label, icon: Icon, color }) => (
                    <Card key={key}>
                        <CardContent className="p-4">
                            <Icon className={`w-5 h-5 mb-2 ${color}`} />
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatNumber(totals[key])}
                            </div>
                            <div className="text-xs text-slate-500">{label}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <HardDrive className="w-4 h-4" /> Armazenamento estimado
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                        {formatBytes(storage.totalBytes)}
                    </div>
                    <p className="text-xs text-slate-500">
                        Estimativa baseada no número de documentos e tamanho médio por coleção.
                        Valores reais de armazenamento podem variar conforme o conteúdo.
                    </p>
                    <div className="space-y-2 pt-2">
                        {Object.entries(storage.byCollection || {})
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, bytes]) => {
                                const pct = storage.totalBytes
                                    ? (bytes / storage.totalBytes) * 100
                                    : 0;
                                return (
                                    <div key={name}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600">{name}</span>
                                            <span className="text-slate-500">
                                                {formatBytes(bytes)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
