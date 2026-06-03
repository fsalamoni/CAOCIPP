import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DollarSign,
    RefreshCw,
    Loader2,
    AlertTriangle,
    Info,
} from 'lucide-react';
import { getCostReport } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatCurrency(value, currency) {
    try {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL',
        }).format(value || 0);
    } catch {
        return `${(value || 0).toFixed(2)} ${currency || ''}`;
    }
}

const PERIODS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
];

export default function CostsPanel() {
    const [report, setReport] = useState(null);
    const [days, setDays] = useState(30);
    const [isLoading, setIsLoading] = useState(true);

    const load = async (period = days) => {
        setIsLoading(true);
        try {
            const result = await getCostReport(period);
            setReport(result);
        } catch (err) {
            logger.error('Falha ao carregar custos:', err);
            setReport({ status: 'error', message: err?.message, byService: [] });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load(days);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days]);

    const status = report?.status;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                    {PERIODS.map((p) => (
                        <Button
                            key={p.value}
                            size="sm"
                            variant={days === p.value ? 'default' : 'outline'}
                            onClick={() => setDays(p.value)}
                        >
                            {p.label}
                        </Button>
                    ))}
                </div>
                <Button onClick={() => load(days)} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Carregando custos...
                </div>
            ) : status === 'not_configured' ? (
                <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription className="space-y-2">
                        <p className="font-medium">
                            Custos reais ainda não conectados.
                        </p>
                        <p className="text-sm">{report?.message}</p>
                        <p className="text-sm text-slate-500">
                            Passos: (1) ativar o export de faturamento do Google Cloud
                            para o BigQuery; (2) informar o dataset/tabela às funções
                            (variáveis BILLING_BQ_PROJECT, BILLING_BQ_DATASET,
                            BILLING_BQ_TABLE). Depois disso, os custos reais por serviço
                            aparecem aqui automaticamente.
                        </p>
                    </AlertDescription>
                </Alert>
            ) : status === 'error' ? (
                <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{report?.message}</AlertDescription>
                </Alert>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <DollarSign className="w-4 h-4" /> Custo total no período
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(report?.totalCost, report?.currency)}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Últimos {report?.periodDays} dias — fonte: Cloud Billing (BigQuery)
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Custo por serviço</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {(report?.byService || []).length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    Nenhum custo registrado no período.
                                </p>
                            ) : (
                                report.byService.map((s) => (
                                    <div
                                        key={s.service}
                                        className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
                                    >
                                        <span className="text-sm text-slate-700">
                                            {s.service}
                                        </span>
                                        <span className="text-sm font-medium text-slate-900">
                                            {formatCurrency(s.cost, s.currency)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
