import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '../utils';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [dateRange, setDateRange] = useState({ start: subDays(new Date(), 30), end: new Date() });

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          window.location.href = createPageUrl('Landing');
          return;
        }
        setUser(currentUser);
        
        // Buscar organizações do usuário
        const response = await base44.functions.invoke('getUserOrganizations', {});
        setUserOrganizations(response.data.organizations || []);
        
        // Buscar todos os usuários para criar mapa de platform_name
        try {
          const allUsers = await base44.entities.User.list();
          const map = {};
          allUsers.forEach(u => {
            map[u.id] = u.platform_name || u.full_name;
          });
          setUserMap(map);
        } catch (userError) {
          // Continua mesmo se não conseguir buscar usuários
          console.warn('Não foi possível buscar usuários para mapa', userError);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        window.location.href = createPageUrl('Landing');
      }
    };
    init();
  }, []);

  const organizationIds = userOrganizations.map(org => org.id);

  // Buscar todos os processos das organizações do usuário
  const { data: allProcesses = [] } = useQuery({
    queryKey: ['dashboard-processes', organizationIds],
    queryFn: async () => {
      if (organizationIds.length === 0) return [];
      
      const processes = [];
      for (const orgId of organizationIds) {
        const orgProcesses = await base44.entities.Process.filter({ organization_id: orgId });
        processes.push(...orgProcesses);
      }
      return processes;
    },
    enabled: organizationIds.length > 0,
    initialData: []
  });

  // Filtrar processos por data de entrada
  const filteredByDate = allProcesses.filter(p => {
    if (!p.entry_date) return false;
    const entryDate = new Date(p.entry_date);
    return entryDate >= dateRange.start && entryDate <= dateRange.end;
  });

  // Total de processos: se assessoria, conta processos onde é responsável; senão, todos do órgão
  const userFirstOrg = userOrganizations[0];
  const activeOrgProcesses = userFirstOrg 
    ? allProcesses.filter(p => p.organization_id === userFirstOrg.id)
    : [];
  
  let totalProcesses = 0;
  if (user?.function === 'assessoria') {
    totalProcesses = filteredByDate.filter(p => p.responsible_user_id === user?.id).length;
  } else {
    totalProcesses = filteredByDate.length;
  }

  const pendingProcesses = filteredByDate.filter(p => p.status === 'Pendente').length;
  const inProgressProcesses = filteredByDate.filter(p => p.status === 'Em elaboração').length;
  const urgentProcesses = filteredByDate.filter(p => p.urgency_request && p.status !== 'Na pasta').length;

  // Dados para gráfico de pizza (processos por status)
  const statusData = [
    { name: 'Em triagem', value: filteredByDate.filter(p => p.status === 'Em triagem').length, color: '#94a3b8' },
    { name: 'Pendente', value: filteredByDate.filter(p => p.status === 'Pendente').length, color: '#f59e0b' },
    { name: 'Em elaboração', value: filteredByDate.filter(p => p.status === 'Em elaboração').length, color: '#3b82f6' },
    { name: 'Em revisão', value: filteredByDate.filter(p => p.status === 'Em revisão').length, color: '#8b5cf6' },
    { name: 'Para revisão', value: filteredByDate.filter(p => p.status === 'Para revisão').length, color: '#ec4899' },
    { name: 'no Arquivo', value: filteredByDate.filter(p => p.status === 'Na pasta').length, color: '#10b981' }
  ].filter(item => item.value > 0);

  // Dados para gráfico de barras (processos por responsável)
  const processesPerResponsible = {};
  filteredByDate.forEach(process => {
    const responsible = process.responsible_user_id 
      ? (userMap[process.responsible_user_id] || process.responsible_user_name || 'Não atribuído')
      : 'Não atribuído';
    processesPerResponsible[responsible] = (processesPerResponsible[responsible] || 0) + 1;
  });

  const responsibleData = Object.entries(processesPerResponsible)
    .map(([name, count]) => ({ name, processos: count }))
    .sort((a, b) => b.processos - a.processos);

  // Últimos 5 processos analisados
  let recentProcesses = [];
  if (user?.function === 'assessoria') {
    // Se assessoria: últimos processos arquivados (Na pasta) onde é responsável
    recentProcesses = allProcesses
      .filter(p => p.status === 'Na pasta' && p.responsible_user_id === user?.id)
      .sort((a, b) => new Date(b.archived_date || b.updated_date) - new Date(a.archived_date || a.updated_date))
      .slice(0, 5);
  } else {
    // Senão: últimos processos arquivados do órgão
    recentProcesses = activeOrgProcesses
      .filter(p => p.status === 'Na pasta')
      .sort((a, b) => new Date(b.archived_date || b.updated_date) - new Date(a.archived_date || a.updated_date))
      .slice(0, 5);
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Olá, {user.platform_name?.split(' ')[0] || 'Usuário'}! 👋
        </h1>
        <p className="text-slate-600 mt-1">
          {userOrganizations.length === 0 
            ? 'Crie ou entre em um órgão para começar' 
            : 'Aqui está o resumo dos seus processos'
          }
        </p>
      </div>

      {/* Date Range Filter */}
      {userOrganizations.length > 0 && (
        <Card className="shadow-sm border-slate-200 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <label className="text-sm font-medium text-slate-600">Data Inicial:</label>
                <Input
                  type="date"
                  value={format(dateRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Data Final:</label>
                <Input
                  type="date"
                  value={format(dateRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                  className="w-40"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ start: subDays(new Date(), 30), end: new Date() })}
              >
                Últimos 30 dias
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {userOrganizations.length === 0 ? (
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Bem-vindo ao ProcessFlow!
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Para começar a gerenciar seus processos, você precisa criar ou entrar em um órgão.
            </p>
            <button
              onClick={() => window.location.href = createPageUrl('Profile')}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-3 rounded-lg font-medium"
            >
              Ir para Meu Perfil
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
              title="Total de Processos"
              value={totalProcesses}
              icon={FileText}
              color="from-indigo-500 to-violet-500"
            />
            <KPICard 
              title="Processos Pendentes"
              value={pendingProcesses}
              icon={Clock}
              color="from-amber-500 to-orange-500"
            />
            <KPICard 
              title="Em Elaboração"
              value={inProgressProcesses}
              icon={TrendingUp}
              color="from-blue-500 to-cyan-500"
            />
            <KPICard 
              title="Processos Urgentes"
              value={urgentProcesses}
              icon={AlertCircle}
              color="from-red-500 to-rose-500"
            />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Gráfico de Pizza - Status */}
              <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Processos por Status no {userFirstOrg?.name}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-4 h-4" />
                  <span>{format(dateRange.start, 'dd/MM/yyyy')} - {format(dateRange.end, 'dd/MM/yyyy')}</span>
                </div>
              </div>
            </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                Nenhum processo cadastrado
              </div>
            )}
            </CardContent>
            </Card>

            {/* Gráfico de Barras - Responsável */}
            <Card className="shadow-sm border-slate-200">
            <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Processos por Responsável</CardTitle>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-4 h-4" />
                <span>{format(dateRange.start, 'dd/MM/yyyy')} - {format(dateRange.end, 'dd/MM/yyyy')}</span>
              </div>
            </div>
            </CardHeader>
          <CardContent>
            {responsibleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={responsibleData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="processos" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                Nenhum processo cadastrado
              </div>
            )}
            </CardContent>
            </Card>
          </div>

          {/* Recent Processes */}
          <Card className="shadow-sm border-slate-200">
                <CardHeader>
              <CardTitle className="text-lg">Últimos Processos Analisados</CardTitle>
            </CardHeader>
            <CardContent>
          {recentProcesses.length > 0 ? (
            <div className="space-y-3">
              {recentProcesses.map(process => (
                <div key={process.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{process.process_number}</span>
                      {process.urgency_request && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                          URGENTE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{process.consultant}</p>
                    <p className="text-xs text-slate-500 mt-1">{process.location}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={process.status} />
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(process.archived_date || process.updated_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Nenhum processo encontrado. Crie seu primeiro órgão para começar!
            </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPICard({ title, value, icon: Icon, color }) {
  return (
    <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
          </div>
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const statusConfig = {
    'Em triagem': { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
    'Pendente': { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
    'Em elaboração': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: FileText },
    'Em revisão': { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: FileText },
    'Para revisão': { color: 'bg-pink-100 text-pink-700 border-pink-200', icon: AlertCircle },
    'Na pasta': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle }
  };

  const config = statusConfig[status] || statusConfig['Em triagem'];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}