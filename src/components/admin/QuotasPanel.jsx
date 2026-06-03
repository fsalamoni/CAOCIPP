import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SlidersHorizontal, Loader2, AlertCircle, Save, Info } from 'lucide-react';
import { getPlatformQuotas, setPlatformQuota } from '@/services/platformService';
import { logger } from '@/utils/logger';

export default function QuotasPanel() {
    const [data, setData] = useState(null);
    const [drafts, setDrafts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [savingKey, setSavingKey] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getPlatformQuotas();
            setData(result);
            setDrafts({ ...(result?.quotas || {}) });
        } catch (err) {
            logger.error('Falha ao carregar cotas:', err);
            setError(err?.message || 'Erro ao carregar cotas.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSave = async (def) => {
        const value = Number(drafts[def.key]);
        if (!Number.isFinite(value) || value < def.min || value > def.max) {
            setError(
                `"${def.label}" deve estar entre ${def.min} e ${def.max} ${def.unit}.`
            );
            return;
        }
        setSavingKey(def.key);
        setError(null);
        try {
            await setPlatformQuota(def.key, value);
            await load();
        } catch (err) {
            logger.error('Falha ao salvar cota:', err);
            setError(err?.message || 'Erro ao salvar cota.');
        } finally {
            setSavingKey(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando cotas...
            </div>
        );
    }

    const definitions = data?.definitions || [];

    return (
        <div className="space-y-4">
            <Alert className="border-sky-300 bg-sky-50 dark:bg-sky-950/30">
                <Info className="w-4 h-4 text-sky-600" />
                <AlertDescription className="text-sky-800 dark:text-sky-200">
                    As cotas são apenas <strong>configuração</strong>. Alterá-las não muda
                    o funcionamento atual do sistema — cada limite só passa a valer quando
                    a funcionalidade correspondente for ativada. É seguro ajustar.
                </AlertDescription>
            </Alert>

            {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <SlidersHorizontal className="w-5 h-5 text-violet-600" />
                        Cotas & Limites
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {definitions.map((def) => {
                        const current = data?.quotas?.[def.key];
                        const draft = drafts[def.key];
                        const changed = Number(draft) !== Number(current);
                        return (
                            <div
                                key={def.key}
                                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-700 pb-4 last:border-0 last:pb-0"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {def.label}
                                    </p>
                                    <p className="text-sm text-slate-500">{def.description}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Permitido: {def.min}–{def.max} {def.unit}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        className="w-32"
                                        value={draft ?? ''}
                                        min={def.min}
                                        max={def.max}
                                        onChange={(e) =>
                                            setDrafts((d) => ({
                                                ...d,
                                                [def.key]: e.target.value,
                                            }))
                                        }
                                    />
                                    <Button
                                        size="sm"
                                        variant={changed ? 'default' : 'outline'}
                                        disabled={!changed || savingKey === def.key}
                                        onClick={() => handleSave(def)}
                                        className="gap-1"
                                    >
                                        {savingKey === def.key ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        Salvar
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    {data?.updatedAt && (
                        <p className="text-xs text-slate-400">
                            Última alteração:{' '}
                            {new Date(data.updatedAt).toLocaleString('pt-BR')}
                            {data.updatedBy ? ` • por ${data.updatedBy}` : ''}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
