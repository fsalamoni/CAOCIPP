import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Building2, RefreshCw, Loader2, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { getOrgsReport, deleteOrganization } from '@/services/platformService';
import { toast } from 'sonner';
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

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
        return '—';
    }
}

export default function OrgsPanel() {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getOrgsReport(200);
            setData(result);
        } catch (err) {
            logger.error('Falha ao carregar órgãos:', err);
            setError(err?.message || 'Erro ao carregar órgãos.');
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
                Carregando órgãos...
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

    const orgs = data?.organizations || [];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    Órgãos ({formatNumber(data?.total)})
                    {data?.hasMore && (
                        <span className="text-xs font-normal text-slate-400">
                            mostrando os {orgs.length} maiores
                        </span>
                    )}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={load} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Órgão</TableHead>
                            <TableHead className="text-right">Membros</TableHead>
                            <TableHead className="text-right">Processos</TableHead>
                            <TableHead className="text-right">Ativos</TableHead>
                            <TableHead className="text-right">Expedientes</TableHead>
                            <TableHead className="text-right">Armazenamento*</TableHead>
                            <TableHead>Criado</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orgs.map((o) => (
                            <TableRow key={o.id}>
                                <TableCell className="font-medium">{o.name}</TableCell>
                                <TableCell className="text-right">{formatNumber(o.members_count)}</TableCell>
                                <TableCell className="text-right">{formatNumber(o.processes_count)}</TableCell>
                                <TableCell className="text-right">{formatNumber(o.active_processes)}</TableCell>
                                <TableCell className="text-right">{formatNumber(o.expedientes_count)}</TableCell>
                                <TableCell className="text-right text-slate-500">{formatBytes(o.storageEstimateBytes)}</TableCell>
                                <TableCell className="text-slate-500">{formatDate(o.created_at)}</TableCell>
                                <TableCell className="text-right">
                                    <DeleteOrgButton org={o} onDeleted={load} />
                                </TableCell>
                            </TableRow>
                        ))}
                        {orgs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                                    Nenhum órgão encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                <p className="text-xs text-slate-400 mt-3">
                    * Armazenamento estimado a partir de tamanhos médios por documento.
                </p>
            </CardContent>
        </Card>
    );
}

function DeleteOrgButton({ org, onDeleted }) {
    const [open, setOpen] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== org.name) {
            toast.error('O nome da organização não coincide.');
            return;
        }
        try {
            setIsDeleting(true);
            const result = await deleteOrganization(org.id, confirmName);
            toast.success(result?.message || 'Organização excluída com sucesso');
            setOpen(false);
            setConfirmName('');
            onDeleted?.();
        } catch (error) {
            logger.error('Erro ao excluir organização:', error);
            toast.error('Erro ao excluir organização: ' + (error?.message || 'tente novamente'));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => { setOpen(v); if (!v) setConfirmName(''); }}
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
            >
                <Trash2 className="w-4 h-4" />
                Excluir
            </Button>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Excluir Organização
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Esta ação excluirá permanentemente a organização <strong>{org.name}</strong> e
                        <strong> todo o seu banco de dados</strong> (processos, expedientes, páginas personalizadas,
                        históricos e vínculos de membros). Não há como desfazer.
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor={`confirm-org-${org.id}`} className="text-xs font-semibold uppercase text-slate-500">
                            Digite o nome da organização para confirmar:
                        </Label>
                        <Input
                            id={`confirm-org-${org.id}`}
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={org.name}
                            className="border-red-200 focus-visible:ring-red-500"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isDeleting}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || confirmName !== org.name}
                        className="bg-red-700 hover:bg-red-800"
                    >
                        {isDeleting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
                        ) : (
                            'Sim, Excluir'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
