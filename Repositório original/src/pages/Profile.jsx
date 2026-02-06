import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Building2, 
  Plus, 
  Copy, 
  LogIn,
  Calendar,
  Shield,
  Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '../utils';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [platformName, setPlatformName] = useState('');
  const [userFunction, setUserFunction] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [joinOrgOpen, setJoinOrgOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setPlatformName(currentUser.platform_name || '');
        setUserFunction(currentUser.function || '');
        setNotificationEmail(currentUser.notification_email || '');
      } catch (error) {
        // Se não autenticado, redireciona para Landing
        window.location.href = '/Landing';
      }
    };
    init();
  }, []);

  // Buscar órgãos
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['user-organizations'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getUserOrganizations', {});
      return response.data.organizations || [];
    },
    enabled: !!user,
    initialData: []
  });

  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('updateUserProfile', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Perfil atualizado com sucesso!');
      setUser(data.user);
      setPlatformName(data.user.platform_name || '');
      setUserFunction(data.user.function || '');
      setNotificationEmail(data.user.notification_email || '');
    },
    onError: (error) => {
      console.error('Erro:', error);
      toast.error(error.response?.data?.error || error.message || 'Erro ao atualizar perfil');
    }
  });

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({ 
      platform_name: platformName, 
      function: userFunction,
      notification_email: notificationEmail 
    });
  };

  if (!user) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Profile Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações do Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Label htmlFor="platform_name">Nome no Órgão *</Label>
                  <div className="group cursor-help">
                    <Info className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    <div className="hidden group-hover:block absolute z-10 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap mt-1">
                      Nome utilizado para identificação nos processos
                    </div>
                  </div>
                </div>
                <Input
                  id="platform_name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="Seu nome na plataforma"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="mt-1 bg-slate-50"
                />
              </div>
              <div>
                <Label htmlFor="function">Função</Label>
                <Select value={userFunction} onValueChange={setUserFunction}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secretaria">Secretária</SelectItem>
                    <SelectItem value="assessoria">Assessoria</SelectItem>
                    <SelectItem value="decisória">Decisória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notification_email">Email para Notificações</Label>
                <Input
                  id="notification_email"
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="Email para receber notificações"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se deixar em branco, as notificações serão enviadas para seu email de registro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold">
                {platformName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-sm text-slate-600">Membro desde</p>
                <p className="font-medium text-slate-900">
                  {format(new Date(user.created_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <Button 
              type="submit" 
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Organizations Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Meus Órgãos
            </CardTitle>
            <div className="flex gap-2">
              <CreateOrganizationDialog 
                open={createOrgOpen} 
                setOpen={setCreateOrgOpen}
                onSuccess={() => queryClient.invalidateQueries(['user-organizations'])}
              />
              <JoinOrganizationDialog 
                open={joinOrgOpen} 
                setOpen={setJoinOrgOpen}
                onSuccess={() => queryClient.invalidateQueries(['user-organizations'])}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Carregando organizações...</div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 mb-4">Você ainda não faz parte de nenhum órgão</p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={() => setCreateOrgOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Órgão
                </Button>
                <Button onClick={() => setJoinOrgOpen(true)} variant="outline">
                  <LogIn className="w-4 h-4 mr-2" />
                  Ingressar em Órgão
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map(org => (
                <div key={org.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">
                      {org.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{org.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          org.userRole === 'creator' 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {org.userRole === 'creator' ? 'Criador' : 'Membro'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Membro desde {format(new Date(org.joined_at), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = createPageUrl('Organization') + '?id=' + org.id}
                  >
                    Acessar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateOrganizationDialog({ open, setOpen, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createOrganization', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Órgão criado com sucesso!');
      setOpen(false);
      setName('');
      setDescription('');
      onSuccess();
      setTimeout(() => {
        window.location.href = createPageUrl('Organization') + '?id=' + data.organization.id;
      }, 500);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao criar órgão');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ name, description });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Criar Órgão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Órgão</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="org_name">Nome do Órgão *</Label>
            <Input
              id="org_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Secretaria de Justiça"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="org_description">Descrição</Label>
            <Textarea
              id="org_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu órgão..."
              rows={3}
              className="mt-1"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Órgão'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JoinOrganizationDialog({ open, setOpen, onSuccess }) {
  const [inviteCode, setInviteCode] = useState('');

  const joinMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('joinOrganization', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Você ingressou no órgão!');
      setOpen(false);
      setInviteCode('');
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Código inválido');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    joinMutation.mutate({ invite_code: inviteCode });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LogIn className="w-4 h-4 mr-2" />
          Ingressar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ingressar em Órgão</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="invite_code">Código de Convite</Label>
            <Input
              id="invite_code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ex: ABC12345"
              required
              className="mt-1 uppercase"
              maxLength={8}
            />
            <p className="text-xs text-slate-500 mt-1">
              Insira o código de 8 caracteres fornecido pelo administrador
            </p>
          </div>
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            disabled={joinMutation.isPending}
          >
            {joinMutation.isPending ? 'Ingressando...' : 'Ingressar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}