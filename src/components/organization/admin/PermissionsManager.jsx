import React, { useState, useMemo } from 'react';
import { setMemberPermissions } from '@/services/functionsService';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { logger } from '@/utils/logger';
import { formatPersonName } from '@/utils/nameUtils';
import { ORG_PERMISSIONS, ORG_PERMISSION_KEYS, sanitizePermissions } from '@/constants/orgPermissions';

// Painel "Atribuições Especiais": o criador concede a membros poderes que hoje
// são exclusivos dele (excluir registros, configurar expedientes, métricas etc.).
export default function PermissionsManager({ organization, members }) {
    // Apenas membros ativos e que não são o criador podem receber permissões.
    const eligibleMembers = useMemo(
        () => members.filter((m) => m.active !== false && m.role !== 'creator'),
        [members]
    );

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium">Atribuições Especiais</h3>
                        <p className="text-sm text-slate-500">
                            Conceda a membros da organização alguns ou todos os seus poderes de criador.
                            As permissões podem ser revogadas a qualquer momento.
                        </p>
                    </div>
                </div>

                <Alert className="mb-4">
                    <AlertDescription>
                        O criador da organização sempre possui todas as permissões. Aqui você delega,
                        individualmente, capacidades específicas a outros membros.
                    </AlertDescription>
                </Alert>

                {eligibleMembers.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">
                        Nenhum membro elegível. Convide membros para a organização para poder delegar permissões.
                    </p>
                ) : (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 dark:bg-slate-800">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Permissões concedidas</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {eligibleMembers.map((member) => {
                                    const grantedCount = ORG_PERMISSION_KEYS.filter(
                                        (k) => member.permissions?.[k] === true
                                    ).length;
                                    return (
                                        <TableRow key={member.id}>
                                            <TableCell className="font-medium">
                                                {formatPersonName(member.user_name || '')}
                                            </TableCell>
                                            <TableCell className="text-slate-600">{member.user_email}</TableCell>
                                            <TableCell>
                                                {grantedCount === 0 ? (
                                                    <span className="text-slate-400 text-sm">Nenhuma</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                        {grantedCount} de {ORG_PERMISSION_KEYS.length}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <PermissionsDialog member={member} organizationId={organization.id} />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
}

function PermissionsDialog({ member, organizationId }) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draft, setDraft] = useState(() => sanitizePermissions(member.permissions));

    // Ao abrir, sincroniza o rascunho com o estado atual do membro.
    const handleOpenChange = (next) => {
        if (next) {
            setDraft(sanitizePermissions(member.permissions));
        }
        setOpen(next);
    };

    const toggle = (key) => {
        setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const allSelected = ORG_PERMISSION_KEYS.every((k) => draft[k]);

    const toggleAll = () => {
        const next = !allSelected;
        const updated = {};
        for (const k of ORG_PERMISSION_KEYS) updated[k] = next;
        setDraft(updated);
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await setMemberPermissions({
                organizationId,
                userIdToUpdate: member.user_id,
                permissions: sanitizePermissions(draft),
            });
            toast.success('Permissões atualizadas com sucesso');
            setOpen(false);
        } catch (error) {
            logger.error('Error updating permissions:', error);
            toast.error('Erro ao atualizar permissões: ' + (error?.message || 'tente novamente'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => handleOpenChange(true)}
            >
                <KeyRound className="w-3.5 h-3.5" />
                Gerenciar
            </Button>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Permissões de {formatPersonName(member.user_name || '')}</DialogTitle>
                    <DialogDescription>
                        Selecione as atribuições especiais que este membro poderá exercer na organização.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-sm font-medium">Conceder todas as permissões</span>
                        <Switch
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Conceder todas as permissões"
                        />
                    </div>
                    <div className="max-h-[45vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {ORG_PERMISSIONS.map((perm) => (
                            <div key={perm.key} className="flex items-start justify-between gap-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{perm.label}</p>
                                    <p className="text-xs text-slate-500">{perm.description}</p>
                                </div>
                                <Switch
                                    checked={draft[perm.key] === true}
                                    onCheckedChange={() => toggle(perm.key)}
                                    aria-label={perm.label}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Salvar permissões
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
