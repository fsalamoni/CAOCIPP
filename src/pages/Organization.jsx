import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useProcesses, useOrganizationMembers, useOrganizationRealtime } from '@/hooks/useFirestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import organization components
import GeneralInfo from '../components/organization/GeneralInfo';
import ProcessControl from '../components/organization/ProcessControl';
import IntelligentSummary from '../components/organization/IntelligentSummary';

export default function Organization() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const { organizations, isLoading: orgsLoading } = useOrganizations();

  // Get organization ID from URL params or use first organization
  const urlOrgId = searchParams.get('id');
  const [selectedOrgId, setSelectedOrgId] = useState(urlOrgId);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/Landing');
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Auto-select organization
  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  // Fetch organization data (real-time)
  const { organization, isLoading: orgLoading } = useOrganizationRealtime(selectedOrgId);

  // Fetch members
  const { members, isLoading: membersLoading, error: membersError } = useOrganizationMembers(selectedOrgId);

  // Fetch processes
  const { processes, isLoading: processesLoading, error: processesError } = useProcesses(selectedOrgId);

  // Find user's membership to determine role
  const userMembership = members.find(m => m.user_id === user?.uid);
  const userRole = userMembership?.role || 'member';

  // Loading state
  if (isLoadingAuth || orgsLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-600">Carregando organização...</p>
        </div>
      </div>
    );
  }

  // No organizations
  if (organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Alert>
          <AlertDescription>
            Você ainda não faz parte de nenhuma organização.
            <Button
              variant="link"
              onClick={() => navigate('/Profile')}
              className="px-2"
            >
              Ir para Perfil
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Organization not found
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Organização não encontrada</p>
          <Button onClick={() => navigate('/Profile')}>
            Voltar ao Perfil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-none mx-auto space-y-6 px-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/Profile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                {organization.description}
              </p>
            )}
          </div>

          {/* Organization Selector (if multiple) */}
          {organizations.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                navigate(`/Organization?id=${e.target.value}`);
              }}
              className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="processes" className="space-y-6">
          <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
            <TabsTrigger
              value="info"
              className="data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              Informações Gerais
            </TabsTrigger>
            <TabsTrigger
              value="processes"
              className="data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              Controle de Processos
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              Resumos Inteligentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <GeneralInfo
              organization={organization}
              members={members}
              userRole={userRole}
              userId={user?.uid}
              membersLoading={membersLoading}
              membersError={membersError}
            />
          </TabsContent>

          <TabsContent value="processes">
            <ProcessControl
              organization={organization}
              members={members}
              processes={processes}
              userRole={userRole}
              userId={user?.uid}
              processesLoading={processesLoading}
              processesError={processesError}
            />
          </TabsContent>

          <TabsContent value="summary">
            <IntelligentSummary
              processes={processes}
              members={members}
              organization={organization}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}