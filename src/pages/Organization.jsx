import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useProcesses, useExpedientes, useOrganizationMembers, useOrganizationRealtime, useOrganizationUserNameMap } from '@/hooks/useFirestore';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { isTabVisible } from '@/lib/organizationModules';
import { useEntityTypes } from '@/hooks/useCustomEntities';
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import organization components
import GeneralInfo from '../components/organization/GeneralInfo';
import ProcessControl from '../components/organization/ProcessControl';
import ExpedienteControl from '../components/organization/ExpedienteControl';
import IntelligentSummary from '../components/organization/IntelligentSummary';

import KanbanBoard from '../components/organization/KanbanBoard';
import ExpedienteKanbanBoard from '../components/organization/ExpedienteKanbanBoard';
import AdminManagement from '../components/organization/admin/AdminManagement';
import CustomEntityView from '../components/organization/custom/CustomEntityView';

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
    if (organizations.length === 0) {
      return;
    }

    const hasUrlOrganization = urlOrgId && organizations.some(org => org.id === urlOrgId);
    const hasSelectedOrganization = selectedOrgId && organizations.some(org => org.id === selectedOrgId);

    if (urlOrgId && urlOrgId !== selectedOrgId && hasUrlOrganization) {
      setSelectedOrgId(urlOrgId);
      return;
    }

    if (!hasSelectedOrganization) {
      const fallbackOrgId = hasUrlOrganization
        ? urlOrgId
        : organizations[0].id;

      setSelectedOrgId(fallbackOrgId);
      if (fallbackOrgId !== urlOrgId) {
        navigate(`/Organization?id=${fallbackOrgId}&tab=${activeTab}`, { replace: true });
      }
    }
  }, [organizations, selectedOrgId, urlOrgId, activeTab, navigate]);

  // Fetch organization data (real-time)
  const { organization, isLoading: orgLoading } = useOrganizationRealtime(selectedOrgId);

  // Fetch members
  const { members, isLoading: membersLoading, error: membersError } = useOrganizationMembers(selectedOrgId);
  const { nameMap: userNameMap } = useOrganizationUserNameMap(selectedOrgId);

  // Carregamento por aba (flag): quando ligado, assina apenas os dados que a
  // aba ativa realmente usa. Flag DESLIGADO = comportamento atual (assina tudo).
  const perTabLoading = useFlag(FEATURE_FLAGS.PER_TAB_LOADING.key);
  const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);

  // Tipos de entidade personalizados (apenas quando a flag está ligada).
  const { entityTypes: customTypes } = useEntityTypes(customEntitiesOn ? selectedOrgId : null);

  // Parse de aba customizada: "cpanel:<id>", "clist:<id>", "csummary:<id>".
  const customTab = React.useMemo(() => {
    if (!customEntitiesOn) return null;
    const m = /^(cpanel|clist|csummary):(.+)$/.exec(activeTab || '');
    if (!m) return null;
    const modeMap = { cpanel: 'panel', clist: 'list', csummary: 'summary' };
    return { mode: modeMap[m[1]], typeId: m[2] };
  }, [activeTab, customEntitiesOn]);

  const TABS_NEEDING_PROCESSES = ['info', 'kanban', 'processes', 'summary'];
  const TABS_NEEDING_EXPEDIENTES = ['info', 'kanban-expedientes', 'expedientes', 'summary'];
  const wantProcesses = !perTabLoading || TABS_NEEDING_PROCESSES.includes(activeTab);
  const wantExpedientes = !perTabLoading || TABS_NEEDING_EXPEDIENTES.includes(activeTab);
  const processesOrgId = wantProcesses ? selectedOrgId : null;
  const expedientesOrgId = wantExpedientes ? selectedOrgId : null;

  // Paginação no banco (flag): quando ligado, as ABAS DE LISTA (processos /
  // expedientes) carregam apenas os N mais recentes, com um botão para carregar
  // o restante sob demanda. Kanban/Resumo/Info continuam carregando tudo para
  // não esconder dados. Flag DESLIGADO = comportamento atual (sem limite).
  const dbPagination = useFlag(FEATURE_FLAGS.DB_PAGINATION.key);
  const DB_PAGE_LIMIT = 500;
  const [loadAllProcesses, setLoadAllProcesses] = useState(false);
  const [loadAllExpedientes, setLoadAllExpedientes] = useState(false);

  // Ao trocar de órgão, volta ao carregamento limitado.
  useEffect(() => {
    setLoadAllProcesses(false);
    setLoadAllExpedientes(false);
  }, [selectedOrgId]);

  const processesLimit = (dbPagination && !loadAllProcesses && activeTab === 'processes')
    ? DB_PAGE_LIMIT : undefined;
  const expedientesLimit = (dbPagination && !loadAllExpedientes && activeTab === 'expedientes')
    ? DB_PAGE_LIMIT : undefined;

  // Fetch processes
  const { processes, isLoading: processesLoading, error: processesError, hasMore: processesHasMore } = useProcesses(processesOrgId, {}, { limitTo: processesLimit });

  // Fetch expedientes
  const { expedientes, isLoading: expedientesLoading, error: expedientesError, hasMore: expedientesHasMore } = useExpedientes(expedientesOrgId, { limitTo: expedientesLimit });

  // Filter active members for general views and process management
  const activeMembers = React.useMemo(() => {
    return members.filter(m => m.active !== false);
  }, [members]);

  // Find user's membership to determine role
  const userMembership = members.find(m => m.user_id === user?.uid);
  const userRole = userMembership?.role || 'member';

  // Guarda de aba (flag CUSTOM_ENTITIES): se a aba ativa pertence a um módulo
  // desligado, volta para "Informações Gerais". Com a flag OFF, isTabVisible
  // devolve true para todas as abas built-in (nada muda).
  useEffect(() => {
    if (!customEntitiesOn || !organization) return;
    const visible = isTabVisible(activeTab, organization, { customEntitiesOn, customTypes });
    // 'admin' depende do papel; mantém o comportamento atual (só creator vê).
    if (!visible && activeTab !== 'admin') {
      navigate(`/Organization?id=${selectedOrgId}&tab=info`, { replace: true });
    }
  }, [customEntitiesOn, organization, activeTab, selectedOrgId, navigate, customTypes]);

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
              expedientes={expedientes}
              userRole={userRole}
              userId={user?.uid}
              membersLoading={membersLoading}
              membersError={membersError}
              processesLoading={processesLoading}
              userNameMap={userNameMap}
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
            <>
              {dbPagination && !loadAllProcesses && processesHasMore && (
                <Alert className="mb-3">
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>
                      Exibindo os {DB_PAGE_LIMIT} processos mais recentes. Para buscar em todos os registros, carregue a lista completa.
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setLoadAllProcesses(true)}>
                      Carregar todos
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
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
            </>
          )}

          {activeTab === 'kanban-expedientes' && (
            <ExpedienteKanbanBoard
              organization={organization}
              members={activeMembers}
              expedientes={expedientes}
              userRole={userRole}
              userId={user?.uid}
              expedientesLoading={expedientesLoading}
            />
          )}

          {activeTab === 'expedientes' && (
            <>
              {dbPagination && !loadAllExpedientes && expedientesHasMore && (
                <Alert className="mb-3">
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>
                      Exibindo os {DB_PAGE_LIMIT} expedientes mais recentes. Para buscar em todos os registros, carregue a lista completa.
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setLoadAllExpedientes(true)}>
                      Carregar todos
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <ExpedienteControl
                organization={organization}
                members={activeMembers}
                expedientes={expedientes}
                userRole={userRole}
                userId={user?.uid}
                expedientesLoading={expedientesLoading}
                expedientesError={expedientesError}
                initialFilter={searchParams.get('filter')}
              />
            </>
          )}

          {activeTab === 'summary' && (
            <IntelligentSummary
              processes={processes}
              expedientes={expedientes}
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

          {customTab && (
            <CustomEntityView
              mode={customTab.mode}
              entityTypeId={customTab.typeId}
              organizationId={selectedOrgId}
              members={activeMembers}
              userRole={userRole}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
