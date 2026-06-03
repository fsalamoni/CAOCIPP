import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw, Loader2, AlertCircle, Filter } from 'lucide-react';
import { getActivityFeed } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatDateTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch {
        return '—';
    }
}

export default function ActivityPanel() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [actionFilter, setActionFilter] = useState('');
    const [orgFilter, setOrgFilter] = useState('');

    const load = async (reset = true) => {
        if (reset) {
            setIsLoading(true);
            setError(null);
        } else {
            setIsLoadingMore(true);
        }
        try {
            const params = { limit: 50 };
            if (actionFilter.trim()) params.action = actionFilter.trim();
            if (orgFilter.trim()) params.organizationId = orgFilter.trim();
            if (!reset && cursor) params.cursor = cursor;

            const result = await getActivityFeed(params);
            setItems((prev) => (reset ? result.items : [...prev, ...result.items]));
            setCursor(result.nextCursor);
            setHasMore(result.hasMore);
        } catch (err) {
            logger.error('Falha ao carregar movimentações:', err);
            setError(err?.message || 'Erro ao carregar movimentações.');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        load(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Card>
            <CardHeader className="space-y-3">
                <div className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="w-5 h-5 text-amber-600" />
                        Movimentações (feed global)
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => load(true)}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                        <Filter className="w-4 h-4" /> Filtros:
                    </div>
                    <Input
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        placeholder="Ação (ex: CREATE_PROCESS)"
                        className="w-56"
                    />
                    <Input
                        value={orgFilter}
                        onChange={(e) => setOrgFilter(e.target.value)}
                        placeholder="ID do órgão"
                        className="w-48"
                    />
                    <Button size="sm" onClick={() => load(true)}>
                        Aplicar
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Carregando movimentações...
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {items.map((it) => (
                                <div
                                    key={it.id}
                                    className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-2"
                                >
                                    <div className="flex items-start gap-3">
                                        <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
                                            {it.action || '—'}
                                        </Badge>
                                        <div className="text-sm">
                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                {it.user_name || it.user_id || 'Sistema'}
                                            </span>
                                            {it.details && Object.keys(it.details).length > 0 && (
                                                <span className="text-slate-500">
                                                    {' '}
                                                    — {Object.entries(it.details)
                                                        .slice(0, 3)
                                                        .map(([k, v]) => `${k}: ${String(v)}`)
                                                        .join(', ')}
                                                </span>
                                            )}
                                            {it.organization_id && (
                                                <span className="text-slate-400 text-xs block">
                                                    órgão: {it.organization_id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 whitespace-nowrap">
                                        {formatDateTime(it.timestamp)}
                                    </span>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <p className="text-center text-slate-400 py-8">
                                    Nenhuma movimentação encontrada.
                                </p>
                            )}
                        </div>
                        {hasMore && (
                            <div className="flex justify-center mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => load(false)}
                                    disabled={isLoadingMore}
                                    className="gap-2"
                                >
                                    {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Carregar mais
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
