import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Copy, 
  Calendar,
  Shield,
  Trash2,
  Edit2
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

export default function GeneralInfo({ organization, members, userRole, onMemberUpdate }) {
  const queryClient = useQueryClient();

  const copyInviteCode = () => {
    navigator.clipboard.writeText(organization.invite_code);
    toast.success('Código copiado para a área de transferência!');
  };

  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId) => {
      const response = await base44.functions.invoke('removeMember', {
        membership_id: membershipId,
        organization_id: organization.id
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Membro removido com sucesso');
      onMemberUpdate();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao remover membro');
    }
  });

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
            <p className="text-lg font-semibold text-slate-900">{organization.name}</p>
          </div>
          
          {organization.description && (
            <div>
              <p className="text-sm text-slate-600 mb-1">Descrição</p>
              <p className="text-slate-700">{organization.description}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-slate-600 mb-2">Código de Convite</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 bg-slate-100 rounded-lg font-mono text-lg font-bold text-indigo-600 border-2 border-dashed border-indigo-200">
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
              Criada em {format(new Date(organization.created_date), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            {userRole === 'creator' && (
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="text-indigo-600 font-medium">Você é o criador</span>
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
          <div className="rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
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
                          onSuccess={onMemberUpdate}
                        />
                      ) : (
                        <span className="text-slate-600">{member.function || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        member.role === 'creator' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {member.role === 'creator' ? 'Criador' : 'Membro'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {format(new Date(member.created_date), 'dd/MM/yyyy')}
                    </TableCell>
                    {userRole === 'creator' && (
                      <TableCell className="text-right">
                        {member.role !== 'creator' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMemberMutation.mutate(member.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditFunctionDialog({ member, organizationId, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [functionValue, setFunctionValue] = useState(member.function || '');

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('updateMemberFunction', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Função atualizada');
      setOpen(false);
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      membership_id: member.id,
      new_function: functionValue,
      organization_id: organizationId
    });
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
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}