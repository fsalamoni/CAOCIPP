import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Database, Bot, AlertTriangle, FileText, LayoutGrid, Gauge, ShieldCheck, Zap, Lock, Timer } from 'lucide-react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { hasOrgPermission, hasAnyAdminPermission } from '@/constants/orgPermissions';

// Sub-components (to be created)
import OrganizationDetails from './OrganizationDetails';
import MemberManagement from './MemberManagement';
import MatterConfiguration from './MatterConfiguration';
import ExpedienteConfiguration from './ExpedienteConfiguration';
import AISettings from './AISettings';
import DangerZone from './DangerZone';
import BulkReplaceTool from './BulkReplaceTool';
import ModulesManager from './ModulesManager';
import MetricsManager from './MetricsManager';
import PermissionsManager from './PermissionsManager';
import AutomationSettings from './AutomationSettings';
import SecuritySettings from './SecuritySettings';
import StageTimeSettings from './StageTimeSettings';

export default function AdminManagement({ organization, members, userRole, userMembership }) {
    const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);
    const isGoalsOn = useFlag(FEATURE_FLAGS.ASSESSOR_GOALS.key);
    const isEscalationOn = useFlag(FEATURE_FLAGS.AUTO_ESCALATION.key);
    const isReportsOn = useFlag(FEATURE_FLAGS.SCHEDULED_EMAIL_REPORTS.key);
    const showAutomationTab = isGoalsOn || isEscalationOn || isReportsOn;
    const isAccessAuditLogOn = useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key);
    const isRetentionOn = useFlag(FEATURE_FLAGS.DATA_RETENTION_POLICY.key);
    const isWebhooksOn = useFlag(FEATURE_FLAGS.OUTBOUND_WEBHOOKS.key);
    const showSecurityTab = isAccessAuditLogOn || isRetentionOn || isWebhooksOn;
    const isStageTimeOn = useFlag(FEATURE_FLAGS.STAGE_TIME_INDICATOR.key);

    const isCreator = userRole === 'creator';

    // Permissões efetivas do usuário atual. O criador possui todas; membros
    // delegados possuem apenas as marcadas em seu membership.
    const can = useMemo(() => ({
        details: isCreator || hasOrgPermission(userMembership, 'edit_details'),
        matters: isCreator || hasOrgPermission(userMembership, 'manage_matters'),
        modules: isCreator || hasOrgPermission(userMembership, 'manage_modules'),
        metrics: isCreator || hasOrgPermission(userMembership, 'manage_metrics'),
        expedientes: isCreator || hasOrgPermission(userMembership, 'configure_expedientes'),
        padronizacao: isCreator || hasOrgPermission(userMembership, 'bulk_standardize'),
    }), [userMembership, isCreator]);

    // Bloqueia o acesso apenas para quem não é criador NEM possui qualquer
    // permissão delegada.
    if (!isCreator && !hasAnyAdminPermission(userMembership)) {
        return (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                Acesso restrito ao Criador da organização.
            </div>
        );
    }

    // Primeira aba disponível para o usuário (evita abrir numa aba sem permissão).
    const defaultTab = isCreator
        ? 'details'
        : (can.details && 'details')
        || (can.matters && 'matters')
        || (customEntitiesOn && can.modules && 'modules')
        || (can.metrics && 'metrics')
        || (can.expedientes && 'expedientes')
        || (can.padronizacao && 'padronizacao')
        || 'details';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel Administrativo</h2>
                <p className="text-slate-500 dark:text-slate-400">
                    {isCreator
                        ? 'Gerencie todos os aspectos da organização: detalhes, membros, classificação de processos e configurações de IA.'
                        : 'Você possui atribuições especiais nesta organização. Apenas as áreas autorizadas são exibidas.'}
                </p>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-6">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full justify-start h-auto flex-wrap">
                    {can.details && (
                        <TabsTrigger value="details" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Settings className="w-4 h-4" />
                            Detalhes
                        </TabsTrigger>
                    )}
                    {isCreator && (
                        <TabsTrigger value="members" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Users className="w-4 h-4" />
                            Membros
                        </TabsTrigger>
                    )}
                    {isCreator && (
                        <TabsTrigger value="permissions" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <ShieldCheck className="w-4 h-4" />
                            Atribuições
                        </TabsTrigger>
                    )}
                    {can.matters && (
                        <TabsTrigger value="matters" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Database className="w-4 h-4" />
                            Classificação (Matérias)
                        </TabsTrigger>
                    )}
                    {customEntitiesOn && can.modules && (
                        <TabsTrigger value="modules" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <LayoutGrid className="w-4 h-4" />
                            Páginas e Módulos
                        </TabsTrigger>
                    )}
                    {can.metrics && (
                        <TabsTrigger value="metrics" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Gauge className="w-4 h-4" />
                            Métricas
                        </TabsTrigger>
                    )}
                    {can.expedientes && (
                        <TabsTrigger value="expedientes" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <FileText className="w-4 h-4" />
                            Expedientes
                        </TabsTrigger>
                    )}
                    {can.padronizacao && (
                        <TabsTrigger value="padronizacao" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Database className="w-4 h-4" />
                            Padronização em Bloco
                        </TabsTrigger>
                    )}
                    {isCreator && showAutomationTab && (
                        <TabsTrigger value="automation" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Zap className="w-4 h-4" />
                            Automação
                        </TabsTrigger>
                    )}
                    {isCreator && showSecurityTab && (
                        <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Lock className="w-4 h-4" />
                            Segurança
                        </TabsTrigger>
                    )}
                    {isCreator && isStageTimeOn && (
                        <TabsTrigger value="stagetime" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Timer className="w-4 h-4" />
                            Indicador de Tempo
                        </TabsTrigger>
                    )}
                    {isCreator && (
                        <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-200">
                            <Bot className="w-4 h-4" />
                            Inteligência Artificial
                        </TabsTrigger>
                    )}
                    {isCreator && (
                        <TabsTrigger value="danger" className="gap-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900 dark:data-[state=active]:text-red-200 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-4 h-4" />
                            Zona de Perigo
                        </TabsTrigger>
                    )}
                </TabsList>

                {can.details && (
                    <TabsContent value="details">
                        <OrganizationDetails organization={organization} />
                    </TabsContent>
                )}

                {isCreator && (
                    <TabsContent value="members">
                        <MemberManagement organization={organization} members={members} />
                    </TabsContent>
                )}

                {isCreator && (
                    <TabsContent value="permissions">
                        <PermissionsManager organization={organization} members={members} />
                    </TabsContent>
                )}

                {can.matters && (
                    <TabsContent value="matters">
                        <MatterConfiguration organization={organization} />
                    </TabsContent>
                )}

                {customEntitiesOn && can.modules && (
                    <TabsContent value="modules">
                        <ModulesManager organization={organization} />
                    </TabsContent>
                )}

                {can.metrics && (
                    <TabsContent value="metrics">
                        <MetricsManager organization={organization} />
                    </TabsContent>
                )}

                {can.expedientes && (
                    <TabsContent value="expedientes">
                        <ExpedienteConfiguration organization={organization} />
                    </TabsContent>
                )}

                {can.padronizacao && (
                    <TabsContent value="padronizacao">
                        <BulkReplaceTool organization={organization} />
                    </TabsContent>
                )}

                {isCreator && showAutomationTab && (
                    <TabsContent value="automation">
                        <AutomationSettings organization={organization} />
                    </TabsContent>
                )}

                {isCreator && showSecurityTab && (
                    <TabsContent value="security">
                        <SecuritySettings organization={organization} />
                    </TabsContent>
                )}

                {isCreator && isStageTimeOn && (
                    <TabsContent value="stagetime">
                        <StageTimeSettings organization={organization} />
                    </TabsContent>
                )}

                {isCreator && (
                    <TabsContent value="ai">
                        <AISettings organization={organization} />
                    </TabsContent>
                )}

                {isCreator && (
                    <TabsContent value="danger">
                        <DangerZone organization={organization} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
