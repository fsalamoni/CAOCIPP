import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Users, RefreshCw, Loader2, AlertCircle, Search } from 'lucide-react';
import { listPlatformUsers } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function formatDateTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch {
        return '—';
    }
}

export default function UsersPanel() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await listPlatformUsers();
            setData(result);
        } catch (err) {
            logger.error('Falha ao carregar usuários:', err);
            setError(err?.message || 'Erro ao carregar usuários.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        const users = data?.users || [];
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                (u.email || '').toLowerCase().includes(q) ||
                (u.fullName || '').toLowerCase().includes(q) ||
                (u.displayName || '').toLowerCase().includes(q)
        );
    }, [data, search]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Carregando usuários...
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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="w-5 h-5 text-violet-600" />
                    Usuários ({formatNumber(data?.returned)})
                </CardTitle>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nome ou e-mail"
                            className="pl-8 w-56"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead className="text-right">Órgãos</TableHead>
                            <TableHead>Papéis</TableHead>
                            <TableHead>Último login</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((u) => (
                            <TableRow key={u.uid}>
                                <TableCell className="font-medium">
                                    {u.fullName || u.displayName || '—'}
                                </TableCell>
                                <TableCell className="text-slate-500">{u.email || '—'}</TableCell>
                                <TableCell className="text-right">{formatNumber(u.orgCount)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {(u.roles || []).map((r) => (
                                            <Badge key={r} variant="secondary" className="text-xs">
                                                {r}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-500">{formatDateTime(u.lastLogin)}</TableCell>
                                <TableCell>
                                    {u.disabled ? (
                                        <Badge variant="destructive">Desativado</Badge>
                                    ) : (
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                            Ativo
                                        </Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                                    Nenhum usuário encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {data?.hasMore && (
                    <p className="text-xs text-slate-400 mt-3">
                        Existem mais usuários além desta página (limite de 1000 por carga).
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
