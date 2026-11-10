import { roleLabel } from '@/constants';
import React, { useMemo, useState } from 'react';
import { removeMember, updateMember } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Copy, Edit2, Loader2, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/utils/logger';
import { formatPersonName } from '@/utils/nameUtils';
import { ORG_PERMISSION_KEYS } from '@/constants/orgPermissions';

// As funções alimentam regras dos painéis (quem é assessoria, quem decide),
// por isso a lista é fixa e não um texto livre.
const FUNCOES = [
    { value: '', label: 'Sem função definida', hint: 'A pessoa participa do órgão sem um lugar fixo no fluxo.' },
    { value: 'secretaria', label: 'Secretaria', hint: 'Recebe, cadastra e encaminha o que entra.' },
    { value: 'assessoria', label: 'Assessoria', hint: 'Elabora as minutas. Aparece na lista de assessores dos painéis, para distribuição e filtros.' },
    { value: 'decisória', label: 'Decisória', hint: 'Revisa e decide o que a assessoria elabora.' },
];
const funcaoLabel = (value) => FUNCOES.find((f) => f.value === (value || ''))?.label || value;

const FILTROS = [
    { value: 'ativos', label: 'Ativos' },
    { value: 'inativos', label: 'Ex-membros' },
    { value: 'todos', label: 'Todos' },
];

const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

// Painel Administrativo → Membros e convite (só o criador).
export default function MemberManagement({ organization, members, onOpenSection }) {
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState('ativos');
    const [removendo, setRemovendo] = useState(null); // membro aguardando confirmação
    const [isRemoving, setIsRemoving] = useState(false);

    const ativos = members.filter((m) => m.active !== false).length;
    const contagem = { ativos, inativos: members.length - ativos, todos: members.length };

    const visiveis = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        return members
            .filter((m) => filtro === 'todos' || (filtro === 'ativos') === (m.active !== false))
            .filter((m) => !termo || `${m.user_name || ''} ${m.user_email || ''}`.toLowerCase().includes(termo));
    }, [members, busca, filtro]);

    const copiarCodigo = async () => {
        try {
            await navigator.clipboard.writeText(organization.invite_code);
            toast.success('Código copiado.');
        } catch {
            toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
        }
    };

    const confirmarRemocao = async () => {
        try {
            setIsRemoving(true);
            await removeMember(organization.id, removendo.user_id);
            toast.success('Membro removido.');
            setRemovendo(null);
        } catch (error) {
            logger.error('Error removing member:', error);
            toast.error('Erro ao remover membro: ' + error.message);
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">Convidar pessoas</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Envie este código a quem deve entrar. A pessoa cria a conta, abre o próprio Perfil e informa o
                                código em &quot;Entrar em uma organização&quot;. Ela entra como membro, sem atribuições especiais.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <code className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg font-mono text-lg font-bold text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 select-all">
                            {organization.invite_code || '-'}
                        </code>
                        <Button onClick={copiarCodigo} variant="outline" size="icon" aria-label="Copiar código de convite" disabled={!organization.invite_code}>
                            <Copy className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                        <Input
                            value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9"
                            placeholder="Buscar por nome ou e-mail" aria-label="Buscar membros por nome ou e-mail"
                        />
                    </div>
                    <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start" role="group" aria-label="Filtrar por situação">
                        {FILTROS.map((f) => (
                            <button
                                key={f.value} type="button" onClick={() => setFiltro(f.value)} aria-pressed={filtro === f.value}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filtro === f.value
                                    ? 'bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {f.label} <span className="tabular-nums opacity-70">{contagem[f.value]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {visiveis.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                        {busca.trim() ? 'Ninguém encontrado com essa busca.' : 'Ninguém nesta situação.'}
                    </p>
                ) : (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 dark:bg-slate-800">
                                    <TableHead>Pessoa</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead>Papel</TableHead>
                                    <TableHead>Atribuições</TableHead>
                                    <TableHead>Entrada</TableHead>
                                    <TableHead>Saída</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visiveis.map((member) => {
                                    const isActive = member.active !== false;
                                    const isCreator = member.role === 'creator';
                                    const nome = formatPersonName(member.user_name || '') || 'Sem nome';
                                    const concedidas = ORG_PERMISSION_KEYS.filter((k) => member.permissions?.[k] === true).length;
                                    return (
                                        <TableRow key={member.id} className={!isActive ? 'bg-slate-50 dark:bg-slate-800/50' : ''}>
                                            <TableCell className="min-w-[12rem]">
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {nome}
                                                    {!isActive && <span className="ml-2 text-xs font-normal italic text-slate-500 dark:text-slate-400">ex-membro</span>}
                                                </p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300 break-all">{member.user_email}</p>
                                            </TableCell>
                                            <TableCell>
                                                {!isCreator && isActive ? (
                                                    <EditFunctionDialog member={member} nome={nome} organizationId={organization.id} />
                                                ) : (
                                                    <span className="text-slate-600 dark:text-slate-300">{funcaoLabel(member.function) || '-'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCreator
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                    {roleLabel(member.role)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {isCreator ? (
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">Todas</span>
                                                ) : !isActive ? (
                                                    <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
                                                ) : (
                                                    <Button
                                                        variant="ghost" size="sm" className="h-8 gap-1.5 -ml-2"
                                                        onClick={() => onOpenSection?.('permissions')}
                                                        aria-label={`Ver atribuições especiais de ${nome}`}
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                                                        {concedidas === 0 ? 'Nenhuma' : `${concedidas} de ${ORG_PERMISSION_KEYS.length}`}
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-600 dark:text-slate-300 tabular-nums">{formatDate(member.joined_at)}</TableCell>
                                            <TableCell className="text-slate-600 dark:text-slate-300 tabular-nums">{formatDate(member.left_at)}</TableCell>
                                            <TableCell className="text-right">
                                                {!isCreator && isActive && (
                                                    <Button
                                                        variant="ghost" size="sm" onClick={() => setRemovendo(member)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                        aria-label={`Remover ${nome}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>

            <AlertDialog open={Boolean(removendo)} onOpenChange={(open) => !open && !isRemoving && setRemovendo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover {formatPersonName(removendo?.user_name || '') || 'este membro'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A pessoa perde o acesso ao órgão agora e passa a constar como ex-membro. O que ela registrou
                            continua no histórico. Para voltar, ela precisa entrar de novo com o código de convite.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRemoving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); confirmarRemocao(); }}
                            disabled={isRemoving}
                            className="bg-red-600 hover:bg-red-700 text-white gap-2"
                        >
                            {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Remover do órgão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function EditFunctionDialog({ member, nome, organizationId }) {
    const [open, setOpen] = useState(false);
    const [functionValue, setFunctionValue] = useState(member.function || '');
    const [isUpdating, setIsUpdating] = useState(false);
    // Função gravada fora da lista (ex.: vinda do Perfil) continua selecionável.
    const opcoes = FUNCOES.some((f) => f.value === (member.function || ''))
        ? FUNCOES
        : [...FUNCOES, { value: member.function, label: member.function, hint: 'Função informada pela própria pessoa no Perfil.' }];

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsUpdating(true);
            await updateMember({ organizationId, userIdToUpdate: member.user_id, newFunction: functionValue, newRole: member.role });
            toast.success('Função atualizada.');
            setOpen(false);
        } catch (error) {
            logger.error('Error updating function:', error);
            toast.error('Erro ao atualizar função: ' + error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (next) setFunctionValue(member.function || ''); setOpen(next); }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 -ml-2 text-slate-700 dark:text-slate-200" aria-label={`Alterar a função de ${nome}`}>
                    {funcaoLabel(member.function) || 'Definir função'}
                    <Edit2 className="w-3 h-3" aria-hidden />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Função de {nome}</DialogTitle>
                    <DialogDescription>
                        A função diz onde a pessoa atua no fluxo de trabalho do órgão. Ela não concede poderes de administração.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <fieldset className="space-y-2">
                        <legend className="sr-only">Função</legend>
                        {opcoes.map((f) => (
                            <Label
                                key={f.value || 'nenhuma'}
                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer font-normal ${functionValue === f.value
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                                    : 'border-slate-200 dark:border-slate-700'}`}
                            >
                                <input
                                    type="radio" name="function" value={f.value} checked={functionValue === f.value}
                                    onChange={() => setFunctionValue(f.value)} className="mt-1 accent-indigo-600"
                                />
                                <span>
                                    <span className="block font-medium text-slate-900 dark:text-white">{f.label}</span>
                                    <span className="block text-sm text-slate-600 dark:text-slate-300">{f.hint}</span>
                                </span>
                            </Label>
                        ))}
                    </fieldset>
                    <Button type="submit" className="w-full gap-2" disabled={isUpdating}>
                        {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                        Salvar
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
