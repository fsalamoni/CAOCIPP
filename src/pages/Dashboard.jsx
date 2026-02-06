import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useProcesses } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Loader2,
  PlusCircle,
  Building2,
  ArrowRight
} from 'lucide-react';
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line
} from 'recharts';

const DEFAULT_COLOR = DEFAULT_STATUS_CONFIG.color;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // Redirect to landing if not authenticated
  React.useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/Landing');
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

  // Auto-select first organization
  React.useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  // Fetch processes for selected organization
  const { processes, isLoading: processesLoading } = useProcesses(selectedOrgId);

  // Loading State
  if (isLoadingAuth || orgsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Empty State (No Organizations)
  if (organizations.length === 0) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full text-center p-6">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Bem-vindo ao ProcessFlow</h2>
          <p className="text-slate-600 mb-6">
            Você ainda não faz parte de nenhuma organização. Para começar, crie uma nova ou peça para ser convidado.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/Profile')}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusCircle className="w-4 h-4" />
              Criar ou Entrar em Organização
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  // Calculate KPIs
  const totalProcesses = processes.length;
  const urgentProcesses = processes.filter(p => p.urgency_request).length;
  const myProcesses = processes.filter(p => p.responsible_user_id === user?.uid).length;

  // Status distribution for Charts
  const statusCounts = processes.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status,
    value: count,
    color: statusConfig[status]?.color || DEFAULT_COLOR
  }));

  // Recent processes (last 5 for cleaner UI)
  const recentProcesses = [...processes]
    .sort((a, b) => {
      const dateA = a.updated_at?.seconds || 0;
      const dateB = b.updated_at?.seconds || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Visão geral de <span className="font-semibold text-indigo-600">{selectedOrg?.name}</span>
            </p>
          </div>

          {/* Organization Selector */}
          {organizations.length > 1 && (
            <div className="relative">
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="pl-4 pr-10 py-2 border border-slate-200 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Total de Processos"
            value={totalProcesses}
            icon={FileText}
            color="text-slate-600"
            bgIcon="bg-slate-100"
            subtext="Processos ativos"
          />
          <KpiCard
            title="Processos Urgentes"
            value={urgentProcesses}
            icon={AlertCircle}
            color="text-red-600"
            bgIcon="bg-red-100"
            subtext="Requerem atenção"
          />
          <KpiCard
            title="Meus Processos"
            value={myProcesses}
            icon={Users}
            color="text-blue-600"
            bgIcon="bg-blue-100"
            subtext="Atribuídos a você"
          />
          <KpiCard
            title="Membros"
            value={selectedOrg?.stats?.members_count || 0}
            icon={Users}
            color="text-green-600"
            bgIcon="bg-green-100"
            subtext="Total na equipe"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Status Distribution Chart */}
          <Card className="lg:col-span-1 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg text-slate-800">Status dos Processos</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum dado disponível</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="lg:col-span-2 shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-slate-800">Atividade Recente</CardTitle>
              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => navigate(`/Organization?id=${selectedOrgId}`)}>
                Ver todos <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentProcesses.length > 0 ? (
                  recentProcesses.map(process => {
                    const statusInfo = statusConfig[process.status] || { startColor: 'bg-slate-100', text: 'text-slate-600', label: process.status };

                    return (
                      <div
                        key={process.id}
                        className="group flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                        onClick={() => navigate(`/Organization?id=${selectedOrgId}`)} // TODO: Open specific process details
                      >
                        <div className={`w-10 h-10 rounded-full ${statusInfo.startColor} flex items-center justify-center shrink-0`}>
                          <Clock className={`w-5 h-5 ${statusInfo.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-900 truncate">
                              {process.process_number || 'Sem número'}
                            </h4>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {/* Formatter for date would go here */}
                              {new Date(process.updated_at?.seconds * 1000).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 truncate mb-2">
                            {process.description || 'Sem descrição'}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`${statusInfo.startColor} ${statusInfo.text} border-0 hover:${statusInfo.startColor}`}>
                              {statusInfo.label}
                            </Badge>
                            {process.urgency_request && (
                              <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50">
                                Urgente
                              </Badge>
                            )}
                            <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {process.responsible_user_id === user?.uid ? 'Você' : 'Outro'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Nenhuma atividade recente</p>
                    <p className="text-slate-400 text-sm">Os processos atualizados aparecerão aqui</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, bgIcon, subtext }) {
  return (
    <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
          </div>
          <div className={`w-12 h-12 rounded-full ${bgIcon} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        {subtext && (
          <p className="text-xs text-slate-400 mt-2">
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
