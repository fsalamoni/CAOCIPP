import React, { useState } from 'react';
import { clearOrganizationData, backfillProcessLogs, deleteOrganization } from '@/services/functionsService';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { AlertTriangle, ShieldAlert, Loader2, ClipboardList, Trash2 } from 'lucide-react';
import { logger } from '@/utils/logger';

export default function DangerZone({ organization }) {
    return (
        <div className="space-y-6">

            {/* Log Backfill */}
            <div className="bg-indigo-50/30 p-6 rounded-lg border border-indigo-200">
                <h3 className="text-lg font-medium text-indigo-700 flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5" />
                    Logs de Atividade
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-indigo-100 rounded-lg bg-white gap-4">
                    <div className="space-y-1">
                        <p className="font-semibold text-slate-900">Gerar Logs Retroativos</p>
                        <p className="text-sm text-slate-600">
                            Criar registros de log iniciais para processos que ainda não possuem histórico de atividades.
                        </p>
                    </div>
                    <BackfillLogsButton organizationId={organization.id} />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50/30 p-6 rounded-lg border border-red-200">
                <h3 className="text-lg font-medium text-red-700 flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-5 h-5" />
                    Zona de Perigo
                </h3>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-red-100 rounded-lg bg-white gap-4">
                    <div className="space-y-1">
                        <p className="font-semibold text-slate-900">Limpar Dados da Organização</p>
                        <p className="text-sm text-slate-600">
                            Apagar permanentemente todos os processos desta organização. Esta ação não pode ser desfeita.
                        </p>
                    </div>
                    <ClearDataDialog organization={organization} />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border border-red-200 rounded-lg bg-white gap-4 mt-4">
                    <div className="space-y-1">
                        <p className="font-semibold text-slate-900">Excluir Organização</p>
                        <p className="text-sm text-slate-600">
                            Apagar permanentemente esta organização e <strong>todo o seu banco de dados</strong> (processos,
                            expedientes, páginas personalizadas, históricos e membros). Esta ação não pode ser desfeita.
                        </p>
                    </div>
                    <DeleteOrganizationDialog organization={organization} />
                </div>
            </div>
        </div>
    );
}

function BackfillLogsButton({ organizationId }) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleBackfill = async () => {
        if (!window.confirm('Deseja gerar logs retroativos para processos que ainda não possuem?')) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await backfillProcessLogs(organizationId);
            setResult(res);
            toast.success(res.message || 'Logs gerados com sucesso!');
        } catch (err) {
            toast.error('Erro ao gerar logs: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-end gap-2">
            <Button
                onClick={handleBackfill}
                disabled={loading}
                variant="outline"
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 whitespace-nowrap"
            >
                {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                ) : (
                    'Gerar Logs'
                )}
            </Button>
            {result && (
                <span className="text-xs text-slate-500">
                    {result.processed} atualizados
                </span>
            )}
        </div>
    );
}

function ClearDataDialog({ organization }) {
    const [open, setOpen] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const [isClearing, setIsClearing] = useState(false);

    const handleClear = async () => {
        if (confirmName !== organization.name) {
            toast.error('O nome da organização não coincide.');
            return;
        }

        try {
            setIsClearing(true);
            const result = await clearOrganizationData(organization.id);
            toast.success(result.message || 'Dados limpos com sucesso');
            setOpen(false);
            setConfirmName('');
            window.location.reload();
        } catch (error) {
            logger.error('Error clearing organization data:', error);
            toast.error('Erro ao limpar dados: ' + error.message);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
                    Limpar Tudo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Atenção: Ação Irreversível
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Esta ação apagará permanentemente **todos os processos** da organização <strong>{organization.name}</strong>.
                        Isso inclui históricos e dados de workflow.
                    </p>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                        <strong>Importante:</strong> Certifique-se de ter um backup dos seus dados Excel/JSON antes de prosseguir.
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-name" className="text-xs font-semibold uppercase text-slate-500">
                            Digite o nome da organização para confirmar:
                        </Label>
                        <Input
                            id="confirm-name"
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={organization.name}
                            className="border-red-200 focus-visible:ring-red-500"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isClearing}>
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleClear}
                        disabled={isClearing || confirmName !== organization.name}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isClearing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Limpando...
                            </>
                        ) : (
                            'Sim, Apagar Tudo'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DeleteOrganizationDialog({ organization }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (confirmName !== organization.name) {
            toast.error('O nome da organização não coincide.');
            return;
        }

        try {
            setIsDeleting(true);
            const result = await deleteOrganization({
                organizationId: organization.id,
                confirmName,
            });
            toast.success(result.message || 'Organização excluída com sucesso');
            setOpen(false);
            setConfirmName('');
            // A organização não existe mais: volta para o painel inicial.
            navigate('/Dashboard', { replace: true });
        } catch (error) {
            logger.error('Error deleting organization:', error);
            toast.error('Erro ao excluir organização: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="bg-red-700 hover:bg-red-800 gap-2">
                    <Trash2 className="w-4 h-4" />
                    Excluir Organização
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Atenção: Exclusão Permanente
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Esta ação excluirá permanentemente a organização <strong>{organization.name}</strong> e
                        <strong> todo o seu banco de dados</strong>: processos, expedientes, páginas personalizadas,
                        históricos, métricas e vínculos de membros. Não há como desfazer.
                    </p>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                        <strong>Importante:</strong> Certifique-se de ter um backup dos seus dados antes de prosseguir.
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-delete-name" className="text-xs font-semibold uppercase text-slate-500">
                            Digite o nome da organização para confirmar:
                        </Label>
                        <Input
                            id="confirm-delete-name"
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={organization.name}
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
                        disabled={isDeleting || confirmName !== organization.name}
                        className="bg-red-700 hover:bg-red-800"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Excluindo...
                            </>
                        ) : (
                            'Sim, Excluir Organização'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
