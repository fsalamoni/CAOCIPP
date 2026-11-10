import React, { useState, useMemo } from 'react';
import { setMemberPermissions } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { logger } from '@/utils/logger';
import { formatPersonName } from '@/utils/nameUtils';
import { ORG_PERMISSIONS, ORG_PERMISSION_GROUPS, ORG_PERMISSION_KEYS, sanitizePermissions } from '@/constants/orgPermissions';

const GRUPOS = ORG_PERMISSION_GROUPS.map((g) => ({ ...g, perms: ORG_PERMISSIONS.filter((p) => p.group === g.key) }));

// Painel Administrativo → Atribuições especiais: o criador delega a membros
// tarefas que são só dele (configurar módulos, excluir registros etc.).
export default function PermissionsManager({ organization, members, onOpenSection }) {
    // Apenas membros ativos e que não são o criador podem receber permissões.
    const eligibleMembers = useMemo(
        () => members.filter((m) => m.active !== false && m.role !== 'creator'),
        [members]
    );

    return (
        <div className="space-y-6">
            <Alert>
                <AlertDescription>
                    Você, como criador, sempre pode tudo. Aqui você escolhe o que cada membro também pode fazer. Quem recebe
                    ao menos uma atribuição passa a ver o Painel Administrativo, só com as áreas liberadas. Membros, atribuições,
                    auditoria e exclusão do órgão continuam exclusivos do criador.
                </AlertDescription>
            </Alert>

            {eligibleMembers.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Ainda não há outros membros ativos. Convide alguém para poder delegar atribuições.
                    </p>
                    <Button variant="outline" onClick={() => onOpenSection?.('members')}>Ver o código de convite</Button>
                </div>
            ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 dark:bg-slate-800">
                                <TableHead>Pessoa</TableHead>
                                {GRUPOS.map((g) => <TableHead key={g.key} className="text-center whitespace-nowrap">{g.label}</TableHead>)}
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {eligibleMembers.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="min-w-[12rem]">
                                        <p className="font-medium text-slate-900 dark:text-white">{formatPersonName(member.user_name || '') || 'Sem nome'}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 break-all">{member.user_email}</p>
                                    </TableCell>
                                    {GRUPOS.map((g) => {
                                        const n = g.perms.filter((p) => member.permissions?.[p.key] === true).length;
                                        return (
                                            <TableCell key={g.key} className="text-center">
                                                <span
                                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium tabular-nums ${n === 0
                                                        ? 'text-slate-500 dark:text-slate-400'
                                                        : n === g.perms.length
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'}`}
                                                    title={g.perms.filter((p) => member.permissions?.[p.key] === true).map((p) => p.label).join(', ') || 'Nenhuma'}
                                                >
                                                    {n === 0 ? 'Nenhuma' : `${n} de ${g.perms.length}`}
                                                </span>
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell className="text-right">
                                        <PermissionsDialog member={member} organizationId={organization.id} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

function PermissionsDialog({ member, organizationId }) {
    const [open, setOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [draft, setDraft] = useState(() => sanitizePermissions(member.permissions));
    const nome = formatPersonName(member.user_name || '') || 'membro';

    // Ao abrir, sincroniza o rascunho com o estado atual do membro.
    const handleOpenChange = (next) => {
        if (next) setDraft(sanitizePermissions(member.permissions));
        setOpen(next);
    };

    const setKeys = (keys, value) => setDraft((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, value])) }));
    const total = ORG_PERMISSION_KEYS.filter((k) => draft[k]).length;
    const allSelected = total === ORG_PERMISSION_KEYS.length;

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await setMemberPermissions({
                organizationId,
                userIdToUpdate: member.user_id,
                permissions: sanitizePermissions(draft),
            });
            toast.success('Atribuições atualizadas.');
            setOpen(false);
        } catch (error) {
            logger.error('Error updating permissions:', error);
            toast.error('Erro ao atualizar atribuições: ' + (error?.message || 'tente novamente'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleOpenChange(true)} aria-label={`Gerenciar atribuições de ${nome}`}>
                <KeyRound className="w-3.5 h-3.5" aria-hidden />
                Gerenciar
            </Button>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Atribuições de {nome}</DialogTitle>
                    <DialogDescription>
                        Marque o que esta pessoa pode fazer no órgão. Vale assim que você salvar e pode ser desfeito quando quiser.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-medium">Todas as atribuições <span className="font-normal text-slate-500 dark:text-slate-400 tabular-nums">({total} de {ORG_PERMISSION_KEYS.length})</span></span>
                    <Switch checked={allSelected} onCheckedChange={(v) => setKeys(ORG_PERMISSION_KEYS, v)} aria-label="Conceder todas as atribuições" />
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
                    {GRUPOS.map((g) => {
                        const keys = g.perms.map((p) => p.key);
                        const groupAll = keys.every((k) => draft[k]);
                        return (
                            <div key={g.key} role="group" aria-label={g.label} className="rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-t-lg">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{g.label}</p>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setKeys(keys, !groupAll)}>
                                        {groupAll ? 'Desmarcar a área' : 'Marcar a área toda'}
                                    </Button>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 px-3">
                                    {g.perms.map((perm) => (
                                        <div key={perm.key} className="flex items-start justify-between gap-4 py-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">{perm.label}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300">{perm.description}</p>
                                            </div>
                                            <Switch checked={draft[perm.key] === true} onCheckedChange={(v) => setKeys([perm.key], v)} aria-label={perm.label} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Salvar atribuições
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
