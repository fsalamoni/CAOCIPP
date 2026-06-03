import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    DollarSign,
    Flag,
    ShieldCheck,
    Loader2,
    Lock,
    Building2,
    Users,
    Activity,
    HardDrive,
    SlidersHorizontal,
    HeartPulse,
    Wrench,
} from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import PlatformOverview from '@/components/admin/PlatformOverview';
import CostsPanel from '@/components/admin/CostsPanel';
import FeatureFlagsPanel from '@/components/admin/FeatureFlagsPanel';
import PlatformAdminsPanel from '@/components/admin/PlatformAdminsPanel';
import OrgsPanel from '@/components/admin/OrgsPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import ActivityPanel from '@/components/admin/ActivityPanel';
import FootprintPanel from '@/components/admin/FootprintPanel';
import QuotasPanel from '@/components/admin/QuotasPanel';
import HealthPanel from '@/components/admin/HealthPanel';
import DataToolsPanel from '@/components/admin/DataToolsPanel';

export default function Admin() {
    const { isPlatformAdmin, isLoading } = usePlatformAdmin();
    const wave2 = useFlag(FEATURE_FLAGS.ADMIN_WAVE_2.key);
    const wave3 = useFlag(FEATURE_FLAGS.ADMIN_WAVE_3.key);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Verificando acesso...
            </div>
        );
    }

    if (!isPlatformAdmin) {
        return (
            <div className="max-w-md mx-auto mt-16 text-center space-y-3">
                <Lock className="w-10 h-10 mx-auto text-slate-400" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Acesso restrito
                </h2>
                <p className="text-slate-500">
                    Esta área é exclusiva do super-administrador da plataforma.
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Administração & Custos
                </h1>
                <p className="text-slate-500">
                    Visão completa da plataforma: uso, armazenamento, custos e controle
                    das funcionalidades por meio de chaves (feature flags).
                </p>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 w-full justify-start h-auto flex-wrap">
                    <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <LayoutDashboard className="w-4 h-4" /> Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="costs" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <DollarSign className="w-4 h-4" /> Custos
                    </TabsTrigger>
                    <TabsTrigger value="flags" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <Flag className="w-4 h-4" /> Funcionalidades
                    </TabsTrigger>
                    <TabsTrigger value="admins" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                        <ShieldCheck className="w-4 h-4" /> Administradores
                    </TabsTrigger>
                    {wave2 && (
                        <>
                            <TabsTrigger value="orgs" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <Building2 className="w-4 h-4" /> Órgãos
                            </TabsTrigger>
                            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <Users className="w-4 h-4" /> Usuários
                            </TabsTrigger>
                            <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <Activity className="w-4 h-4" /> Movimentações
                            </TabsTrigger>
                            <TabsTrigger value="footprint" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <HardDrive className="w-4 h-4" /> Footprint
                            </TabsTrigger>
                        </>
                    )}
                    {wave3 && (
                        <>
                            <TabsTrigger value="quotas" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <SlidersHorizontal className="w-4 h-4" /> Cotas
                            </TabsTrigger>
                            <TabsTrigger value="health" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <HeartPulse className="w-4 h-4" /> Saúde
                            </TabsTrigger>
                            <TabsTrigger value="datatools" className="gap-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
                                <Wrench className="w-4 h-4" /> Ferramentas
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <TabsContent value="overview">
                    <PlatformOverview />
                </TabsContent>
                <TabsContent value="costs">
                    <CostsPanel />
                </TabsContent>
                <TabsContent value="flags">
                    <FeatureFlagsPanel />
                </TabsContent>
                <TabsContent value="admins">
                    <PlatformAdminsPanel />
                </TabsContent>
                {wave2 && (
                    <>
                        <TabsContent value="orgs">
                            <OrgsPanel />
                        </TabsContent>
                        <TabsContent value="users">
                            <UsersPanel />
                        </TabsContent>
                        <TabsContent value="activity">
                            <ActivityPanel />
                        </TabsContent>
                        <TabsContent value="footprint">
                            <FootprintPanel />
                        </TabsContent>
                    </>
                )}
                {wave3 && (
                    <>
                        <TabsContent value="quotas">
                            <QuotasPanel />
                        </TabsContent>
                        <TabsContent value="health">
                            <HealthPanel />
                        </TabsContent>
                        <TabsContent value="datatools">
                            <DataToolsPanel />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
