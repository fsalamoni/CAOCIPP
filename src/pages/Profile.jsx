import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations } from '@/hooks/useFirestore';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { createOrganization, joinOrganization, updateProfile as updateUserProfile } from '@/services/functionsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  Building2,
  Plus,
  LogIn,
  Loader2,
  LogOut,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { formatPersonName } from '@/utils/nameUtils';

export default function Profile() {
  const navigate = useNavigate();
  const { user, userProfile, signOut, isLoadingAuth } = useAuth();
  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);

  // Profile edit state
  const [platformName, setPlatformName] = useState(userProfile?.platform_name || '');
  const [userFunction, setUserFunction] = useState(userProfile?.function || '');
  const [notificationEmail, setNotificationEmail] = useState(userProfile?.notification_email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Create organization dialog
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  // Join organization dialog
  const [joinOrgOpen, setJoinOrgOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningOrg, setIsJoiningOrg] = useState(false);

  // Update local state when userProfile changes
  React.useEffect(() => {
    if (userProfile) {
      setPlatformName(userProfile.platform_name || '');
      setUserFunction(userProfile.function || '');
      setNotificationEmail(userProfile.notification_email || '');
    }
  }, [userProfile]);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isLoadingAuth && !user) {
      navigate('/Landing');
    }
  }, [isLoadingAuth, user, navigate]);

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);

      await updateUserProfile({
        platform_name: formatPersonName(platformName),
        function: userFunction,
        notification_email: notificationEmail,
      });

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      logger.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil: ' + error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      toast.error('Nome da organização é obrigatório');
      return;
    }

    try {
      setIsCreatingOrg(true);

      const orgId = await createOrganization(
        { name: newOrgName, description: newOrgDesc, startMinimal: customEntitiesOn },
        user.uid
      );

      toast.success(`Organização "${newOrgName}" criada com sucesso!`);
      setCreateOrgOpen(false);
      setNewOrgName('');
      setNewOrgDesc('');

      // Refresh organizations list (the hook will auto-refresh)
      navigate(`/Organization?id=${orgId}`);
    } catch (error) {
      logger.error('Error creating organization:', error);
      toast.error('Erro ao criar organização: ' + error.message);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      toast.error('Código de convite é obrigatório');
      return;
    }

    try {
      setIsJoiningOrg(true);
      const cleanCode = inviteCode.trim().toUpperCase();
      const result = await joinOrganization(cleanCode);
      const orgId = result?.orgId;
      const orgName = result?.message?.match(/organização (.*) com sucesso/)?.[1] || 'organização';

      toast.success(`Você ingressou em ${orgName} com sucesso!`, {
        duration: 5000,
        description: 'Você será redirecionado em instantes.'
      });

      setJoinOrgOpen(false);
      setInviteCode('');

      // Navigate to organization page after a short delay so they see the message
      if (orgId) {
        setTimeout(() => {
          navigate(`/Organization?id=${orgId}`);
        }, 1500);
      }
    } catch (error) {
      logger.error('Error joining organization:', error);
      toast.error(error.message);
    } finally {
      setIsJoiningOrg(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/Landing');
    } catch (error) {
      logger.error('Error signing out:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  if (isLoadingAuth || orgsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Perfil</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Gerencie suas informações e organizações
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-slate-100 dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Email gerenciado pelo Google
                </p>
              </div>

              <div>
                <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={formatPersonName(userProfile?.full_name || '')}
                    disabled
                    className="bg-slate-100 dark:bg-slate-800"
                  />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="platform_name">Nome de Exibição</Label>
                <Input
                  id="platform_name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                />
              </div>

              <div>
                <Label htmlFor="function">Função</Label>
                <Select value={userFunction} onValueChange={setUserFunction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secretaria">Secretaria</SelectItem>
                    <SelectItem value="assessoria">Assessoria</SelectItem>
                    <SelectItem value="decisória">Decisória</SelectItem>
                    <SelectItem value="Criador">Criador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notification_email">Email para Notificações (opcional)</Label>
              <Input
                id="notification_email"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="email@example.com"
              />
              <p className="text-xs text-slate-500 mt-1">
                Deixe em branco para usar o email principal
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              className="gap-2"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Minhas Organizações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {organizations.length > 0 ? (
              <div className="space-y-3">
                {organizations.map(org => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {org.name}
                      </h3>
                      {org.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {org.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>Role: <strong>{org.userRole}</strong></span>
                        <span>Membros: {org.stats?.members_count || 0}</span>
                        <span>Processos: {org.stats?.processes_count || 0}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/Organization?id=${org.id}`)}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Você ainda não faz parte de nenhuma organização.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-4 border-t">
              {/* Create Organization Dialog */}
              <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Criar Organização
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Organização</DialogTitle>
                    <DialogDescription>
                      Crie uma organização para gerenciar processos administrativos
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="org_name">Nome da Organização *</Label>
                      <Input
                        id="org_name"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="Ex: Secretaria Municipal de Educação"
                      />
                    </div>
                    <div>
                      <Label htmlFor="org_desc">Descrição (opcional)</Label>
                      <Textarea
                        id="org_desc"
                        value={newOrgDesc}
                        onChange={(e) => setNewOrgDesc(e.target.value)}
                        placeholder="Breve descrição da organização"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOrgOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateOrganization} disabled={isCreatingOrg}>
                      {isCreatingOrg ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Criando...
                        </>
                      ) : (
                        'Criar Organização'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Join Organization Dialog */}
              <Dialog open={joinOrgOpen} onOpenChange={setJoinOrgOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar em Organização
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Entrar em Organização</DialogTitle>
                    <DialogDescription>
                      Digite o código de convite fornecido pelo administrador
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="invite_code">Código de Convite (8 caracteres)</Label>
                    <Input
                      id="invite_code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="ABC12XYZ"
                      maxLength={8}
                      className="uppercase font-mono text-lg tracking-wider"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setJoinOrgOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleJoinOrganization} disabled={isJoiningOrg}>
                      {isJoiningOrg ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
