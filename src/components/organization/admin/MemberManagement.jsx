import React, { useState } from 'react';
import { removeMember, updateMember } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/utils/logger';

export default function MemberManagement({ organization, members }) {
    const [isRemoving, setIsRemoving] = useState(false);

    const formatCreatedDate = (timestamp) => {
        if (!timestamp) return 'Data não disponível';
        if (timestamp.seconds) {
            return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: ptBR });
        }
        return format(new Date(timestamp), "dd/MM/yyyy", { locale: ptBR });
    };

    const handleRemoveMember = async (memberUserId, membershipId) => {
        const confirmed = window.confirm('Tem certeza que deseja remover este membro?');
        if (!confirmed) return;

        try {
            setIsRemoving(true);
            await removeMember(organization.id, memberUserId);
            toast.success('Membro removido com sucesso');
        } catch (error) {
            logger.error('Error removing member:', error);
            toast.error('Erro ao remover membro: ' + error.message);
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4">Membros ({members.length})</h3>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800">
                                <TableHead>Nome</TableHead>
                                <TableHead>E-mail</TableHead>
                                <TableHead>Função</TableHead>
                                <TableHead>Papel</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Entrada</TableHead>
                                <TableHead>Saída</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.map(member => {
                                const isActive = member.active !== false;
                                return (
                                    <TableRow key={member.id} className={!isActive ? "bg-slate-50 dark:bg-slate-800/50 opacity-75" : ""}>
                                        <TableCell className="font-medium">
                                            {member.user_name}
                                            {!isActive && <span className="ml-2 text-xs italic text-slate-500">(Ex-membro)</span>}
                                        </TableCell>
                                        <TableCell className="text-slate-600">{member.user_email}</TableCell>
                                        <TableCell>
                                            {member.role !== 'creator' && isActive ? (
                                                <EditFunctionDialog
                                                    member={member}
                                                    organizationId={organization.id}
                                                />
                                            ) : (
                                                <span className="text-slate-600">{member.function || '-'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${member.role === 'creator'
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                }`}>
                                                {member.role === 'creator' ? 'Criador' : 'Membro'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isActive
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {formatCreatedDate(member.joined_at)}
                                        </TableCell>
                                        <TableCell className="text-slate-600">
                                            {member.left_at ? formatCreatedDate(member.left_at) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {member.role !== 'creator' && isActive && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveMember(member.user_id, member.id)}
                                                    disabled={isRemoving}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

function EditFunctionDialog({ member, organizationId }) {
    const [open, setOpen] = useState(false);
    const [functionValue, setFunctionValue] = useState(member.function || '');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsUpdating(true);
            await updateMember({
                organizationId: organizationId,
                userIdToUpdate: member.user_id,
                newFunction: functionValue,
                newRole: member.role
            });
            toast.success('Função atualizada');
            setOpen(false);
        } catch (error) {
            logger.error('Error updating function:', error);
            toast.error('Erro ao atualizar função: ' + error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200">
                    {member.function || 'Definir função'}
                    <Edit2 className="w-3 h-3" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Função</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div>
                        <Label>Membro: {member.user_name}</Label>
                    </div>
                    <div>
                        <Label htmlFor="function">Função</Label>
                        <select
                            id="function"
                            value={functionValue}
                            onChange={(e) => setFunctionValue(e.target.value)}
                            className="mt-1 w-full h-10 px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Sem função definida</option>
                            <option value="assessoria">Assessoria</option>
                            <option value="secretaria">Secretaria</option>
                            <option value="decisória">Decisória</option>
                        </select>
                    </div>
                    <Button type="submit" className="w-full" disabled={isUpdating}>
                        {isUpdating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            'Salvar'
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
