import React, { useState } from 'react';
import { removeMember, updateMember } from '@/services/functionsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function GeneralInfo({ organization, members, userRole, userId, membersLoading, membersError }) {
  const [isRemoving, setIsRemoving] = useState(false);

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

  // Format created_at timestamp from Firestore
  const formatCreatedDate = (timestamp) => {
    if (!timestamp) return 'Data não disponível';

    // Handle Firestore Timestamp
    if (timestamp.seconds) {
      return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: ptBR });
    }

    // Handle regular Date
    return format(new Date(timestamp), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Informações da Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 mb-1">Nome</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{organization.name}</p>
          </div>

          {organization.description && (
            <div>
              <p className="text-sm text-slate-600 mb-1">Descrição</p>
              <p className="text-slate-700 dark:text-slate-300">{organization.description}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-slate-600 mb-2">Código de Convite</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-lg font-bold text-primary border-2 border-dashed border-primary/30">
                {organization.invite_code}
              </code>
              <Button
                onClick={copyInviteCode}
                variant="outline"
                size="icon"
                className="h-12 w-12"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Compartilhe este código para convidar novos membros
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-600 pt-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Criada em {formatCreatedDate(organization.created_at)}
            </div>
            {userRole === 'creator' && (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-primary font-medium">Você é o criador</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                      <TableCell className="font-medium">{member.user_name}</TableCell>
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
                              {isRemoving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
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

      // Update via Cloud Function
      await updateMember({
        organizationId: organizationId,
        userIdToUpdate: member.user_id, // Note: member object has user_id, id is membership id
        newFunction: functionValue,
        newRole: member.role // Keep existing role
      });

      toast.success('Função atualizada');
      setOpen(false);
      // Refresh will happen automatically via hooks
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
            <Label>Membro: {member.user_name}</Label>
          </div>
          <div>
            <Label htmlFor="function">Função</Label>
            <Input
              id="function"
              value={functionValue}
              onChange={(e) => setFunctionValue(e.target.value)}
              placeholder="Ex: Assessor Jurídico"
              className="mt-1"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isUpdating}
          >
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