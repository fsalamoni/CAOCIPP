import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useProcesses, useOrganizationMembers, useOrganizationRealtime } from '@/hooks/useFirestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import organization components
import GeneralInfo from '../components/organization/GeneralInfo';
import ProcessControl from '../components/organization/ProcessControl';
import IntelligentSummary from '../components/organization/IntelligentSummary';

import KanbanBoard from '../components/organization/KanbanBoard';
import AdminManagement from '../components/organization/admin/AdminManagement';

export default function Organization() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const { organizations, isLoading: orgsLoading } = useOrganizations();

  // Get organization ID and tab from URL params
  const urlOrgId = searchParams.get('id');
  const activeTab = searchParams.get('tab') || 'info';
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

  // Filter active members for general views and process management
  const activeMembers = React.useMemo(() => {
    return members.filter(m => m.active !== false);
  }, [members]);

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
    <TooltipProvider delayDuration={400}>
      <div className="min-h-full flex flex-col min-w-0">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 rounded-xl mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate('/Profile')}
            >
              <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                {organization.name}
              </h1>
              {organization.description && (
                <p className="text-slate-600 dark:text-slate-400 mt-0.5 text-sm truncate hidden md:block">
                  {organization.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Organization Selector (if multiple) */}
          {organizations.length > 1 && (
            <select
              value={selectedOrgId || ''}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                navigate(`/Organization?id=${e.target.value}&tab=${activeTab}`);
              }}
              className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
        </header>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0">
          {activeTab === 'info' && (
            <GeneralInfo
              organization={organization}
              members={activeMembers}
              processes={processes}
              userRole={userRole}
              userId={user?.uid}
              membersLoading={membersLoading}
              membersError={membersError}
              processesLoading={processesLoading}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanBoard
              organization={organization}
              members={activeMembers}
              processes={processes}
              userRole={userRole}
              userId={user?.uid}
              processesLoading={processesLoading}
            />
          )}

          {activeTab === 'processes' && (
            <ProcessControl
              organization={organization}
              members={activeMembers}
              processes={processes}
              userRole={userRole}
              userId={user?.uid}
              processesLoading={processesLoading}
              processesError={processesError}
              initialFilter={searchParams.get('filter')}
            />
          )}

          {activeTab === 'summary' && (
            <IntelligentSummary
              processes={processes}
              members={activeMembers}
              organization={organization}
            />
          )}

          {activeTab === 'admin' && userRole === 'creator' && (
            <AdminManagement
              organization={organization}
              members={members}
              userRole={userRole}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}