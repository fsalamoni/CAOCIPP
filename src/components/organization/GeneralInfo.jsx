import React, { useState } from 'react';
import { removeMember, updateMember } from '@/services/functionsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Calendar,
  Shield,
  Trash2,
  Edit2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { parseYear } from '@/lib/dashboardMetrics';
import DashboardMetrics from '@/components/organization/DashboardMetrics';
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
import { logger } from '@/utils/logger';
import { formatPersonName } from '@/utils/nameUtils';
import { getExpedienteField } from '@/utils/expedienteUtils';



export default function GeneralInfo({ organization, members, processes = [], expedientes = [], userRole, userId, membersLoading, membersError, processesLoading, userNameMap = {} }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  // Anos descobertos nas páginas personalizadas (reportados pelo DashboardMetrics).
  const [customYears, setCustomYears] = useState([]);
  const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);

  // Available years for filter (dados ordinários + páginas custom + ano atual)
  const years = React.useMemo(() => {
    const yearsSet = new Set([currentYear]);
    processes.forEach(p => { const y = parseYear(p.entry_date); if (y) yearsSet.add(y); });
    expedientes.forEach(e => { const y = parseYear(getExpedienteField(e, 'entry_date')); if (y) yearsSet.add(y); });
    (customYears || []).forEach(y => { if (y) yearsSet.add(y); });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [processes, expedientes, customYears, currentYear]);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(organization.invite_code);
    toast.success('Código copiado para a área de transferência!');
  };

  const handleRemoveMember = async (memberUserId, membershipId) => {
    const confirmed = window.confirm('Tem certeza que deseja remover este membro?');
    if (!confirmed) return;

    try {
      setIsRemoving(true);
      await removeMember(organization.id, memberUserId);
      toast.success('Membro removido com sucesso');
      // Refresh will happen automatically via hooks
    } catch (error) {
      logger.error('Error removing member:', error);
      toast.error('Erro ao remover membro: ' + error.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const formatCreatedDate = (timestamp) => {
    if (!timestamp) return 'Data não disponível';
    if (timestamp.seconds) {
      return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: ptBR });
    }
    return format(new Date(timestamp), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Saúde e Métricas</h2>
          <p className="text-sm text-slate-500">Visão geral do desempenho do órgão por período.</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="year-filter" className="text-sm font-bold text-slate-600 whitespace-nowrap">
            Filtrar por Ano:
          </Label>
          <select
            id="year-filter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-10 pl-3 pr-8 rounded-lg border-slate-200 bg-slate-50 shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Métricas dinâmicas por página habilitada (ordinárias + personalizadas).
          Páginas desligadas não exibem métricas; páginas criadas pelo admin
          aparecem automaticamente. As definições do admin são respeitadas. */}
      <DashboardMetrics
        organization={organization}
        processes={processes}
        expedientes={expedientes}
        selectedYear={selectedYear}
        customEntitiesOn={customEntitiesOn}
        onCustomYears={setCustomYears}
      />

      <div className="grid grid-cols-1 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Organization Info */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-800">Identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Oficial</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{organization.name}</p>
              </div>

              {organization.description && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição / Competência</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{organization.description}</p>
                </div>
              )}

              <div className="pt-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Código de Acesso para Convite</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-lg font-mono text-lg font-bold text-indigo-600 border border-slate-200">
                    {organization.invite_code}
                  </code>
                  <Button onClick={copyInviteCode} variant="outline" size="icon" className="h-12 w-12 border-slate-200 hover:bg-slate-100">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-6 text-xs font-medium text-slate-500 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Criada em {formatCreatedDate(organization.created_at)}
                </div>
                {userRole === 'creator' && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span className="text-indigo-600">Você é o administrador titular</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Members Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Membros ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800">
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Data de Ingresso</TableHead>
                    {userRole === 'creator' && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{formatPersonName(member.user_name || '')}</TableCell>
                      <TableCell className="text-slate-600">{member.user_email}</TableCell>
                      <TableCell>
                        {userRole === 'creator' && member.role !== 'creator' ? (
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
                      <TableCell className="text-slate-600">
                        {formatCreatedDate(member.joined_at)}
                      </TableCell>
                      {userRole === 'creator' && (
                        <TableCell className="text-right">
                          {member.role !== 'creator' && (
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
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
        <Button variant="ghost" size="sm" className="h-8 gap-2 text-slate-600 hover:text-slate-900">
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
            <Label>Membro: {formatPersonName(member.user_name || '')}</Label>
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
