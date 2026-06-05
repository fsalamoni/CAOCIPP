import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Database, Bot, AlertTriangle, FileText, LayoutGrid, Gauge } from 'lucide-react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

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

export default function AdminManagement({ organization, members, userRole }) {
    const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);

    if (userRole !== 'creator') {
        return (
            <div className="p-8 text-center text-slate-500">
                Acesso restrito ao Criador da organização.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Painel Administrativo</h2>
                <p className="text-slate-500">
                    Gerencie todos os aspectos da organização: detalhes, membros, classificação de processos e configurações de IA.
                </p>
            </div>

            <Tabs defaultValue="details" className="space-y-6">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="details" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Settings className="w-4 h-4" />
                        Detalhes
                    </TabsTrigger>
                    <TabsTrigger value="members" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Users className="w-4 h-4" />
                        Membros
                    </TabsTrigger>
                    <TabsTrigger value="matters" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Database className="w-4 h-4" />
                        Classificação (Matérias)
                    </TabsTrigger>
                    {customEntitiesOn && (
                        <TabsTrigger value="modules" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                            <LayoutGrid className="w-4 h-4" />
                            Páginas e Módulos
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="metrics" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Gauge className="w-4 h-4" />
                        Métricas
                    </TabsTrigger>
                    <TabsTrigger value="expedientes" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <FileText className="w-4 h-4" />
                        Expedientes
                    </TabsTrigger>
                    <TabsTrigger value="padronizacao" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Database className="w-4 h-4" />
                        Padronização em Bloco
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Bot className="w-4 h-4" />
                        Inteligência Artificial
                    </TabsTrigger>
                    <TabsTrigger value="danger" className="gap-2 data-[state=active]:bg-red-50 data-[state=active]:text-red-700 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        Zona de Perigo
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <OrganizationDetails organization={organization} />
                </TabsContent>

                <TabsContent value="members">
                    <MemberManagement organization={organization} members={members} />
                </TabsContent>

                <TabsContent value="matters">
                    <MatterConfiguration organization={organization} />
                </TabsContent>

                {customEntitiesOn && (
                    <TabsContent value="modules">
                        <ModulesManager organization={organization} />
                    </TabsContent>
                )}

                <TabsContent value="metrics">
                    <MetricsManager organization={organization} />
                </TabsContent>

                <TabsContent value="expedientes">
                    <ExpedienteConfiguration organization={organization} />
                </TabsContent>

                <TabsContent value="padronizacao">
                    <BulkReplaceTool organization={organization} />
                </TabsContent>

                <TabsContent value="ai">
                    <AISettings organization={organization} />
                </TabsContent>

                <TabsContent value="danger">
                    <DangerZone organization={organization} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
