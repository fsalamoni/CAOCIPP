import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '../utils';
import GeneralInfo from '../components/organization/GeneralInfo';
import ProcessControl from '../components/organization/ProcessControl';
import IntelligentSummary from '../components/organization/IntelligentSummary';

export default function Organization() {
  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          window.location.href = createPageUrl('Landing');
          return;
        }
        setUser(currentUser);

        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) {
          window.location.href = createPageUrl('Dashboard');
          return;
        }
        setOrganizationId(id);
      } catch (error) {
        console.error('Erro ao carregar organização:', error);
        window.location.href = createPageUrl('Landing');
      }
    };
    init();
  }, []);

  // Buscar dados da organização
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization', organizationId],
    queryFn: async () => {
      const orgs = await base44.entities.Organization.filter({ id: organizationId });
      return orgs[0] || null;
    },
    enabled: !!organizationId,
  });

  // Buscar membros
  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: () => base44.entities.UserOrganization.filter({ organization_id: organizationId }),
    enabled: !!organizationId,
    initialData: []
  });

  // Buscar processos
  const { data: processes = [], isLoading: processesLoading } = useQuery({
    queryKey: ['organization-processes', organizationId],
    queryFn: () => base44.entities.Process.filter({ organization_id: organizationId }, null, 150),
    enabled: !!organizationId,
    initialData: []
  });

  // Verificar papel do usuário
  const userMembership = members.find(m => m.user_id === user?.id);
  const userRole = userMembership?.role || 'member';

  if (!user || orgLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando organização...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">Organização não encontrada</p>
        <Button onClick={() => window.location.href = createPageUrl('Profile')}>
          Voltar ao Perfil
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => window.location.href = createPageUrl('Profile')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{organization.name}</h1>
          {organization.description && (
            <p className="text-slate-600 mt-1">{organization.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="processes" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="info" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            Informações Gerais
          </TabsTrigger>
          <TabsTrigger value="processes" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            Controle de Processos
          </TabsTrigger>
          <TabsTrigger value="summary" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white">
            Resumos Inteligentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <GeneralInfo 
            organization={organization} 
            members={members}
            userRole={userRole}
            onMemberUpdate={refetchMembers}
          />
        </TabsContent>

        <TabsContent value="processes">
          <ProcessControl 
            organization={organization}
            members={members}
            processes={processes}
          />
        </TabsContent>

        <TabsContent value="summary">
          <IntelligentSummary 
            processes={processes}
            members={members}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}