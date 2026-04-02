import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useProcesses, useExpedientes, useMyProcesses, useMyExpedientes } from '@/hooks/useFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Clock,
  AlertCircle,
  Users,
  Loader2,
  PlusCircle,
  Building2,
  ArrowRight
} from 'lucide-react';
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const DEFAULT_COLOR = DEFAULT_STATUS_CONFIG.color;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const { organizations, isLoading: orgsLoading } = useOrganizations();

  // Redirect to landing if not authenticated
  React.useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/Landing');
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

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
      <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50 text-center">
        <Card className="max-w-md w-full p-8 shadow-lg border-slate-200">
          <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <Building2 className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo(a)!</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Você ainda não está vinculado(a) a nenhum órgão. Comece criando um novo ou solicite um convite.
          </p>
          <Button
            onClick={() => navigate('/Profile')}
            className="w-full h-12 gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md"
          >
            <PlusCircle className="w-5 h-5" />
            Configurar meu Perfil
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Meu Início
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            Resumo das suas atividades e responsabilidades em cada órgão.
          </p>
        </div>

        {/* Organizations List */}
        <div className="space-y-12">
          {organizations.map((org) => (
            <UserOrganDashboard key={org.id} organization={org} user={user} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UserOrganDashboard({ organization, user }) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { processes, isLoading } = useProcesses(organization.id);
  const { expedientes } = useExpedientes(organization.id);
  const { processes: myProcesses } = useMyProcesses(organization.id, user?.uid);
  const { expedientes: myExpedientes } = useMyExpedientes(organization.id, user?.uid);

  // Normalize function name
  const userFunc = (organization.userFunction || '').toLowerCase();
  const isAssessor = userFunc.includes('assessor') || userFunc.includes('assessoria');
  const isSecretaria = userFunc.includes('secretaria') || userFunc.includes('apoio');
  const isDecisor = userFunc.includes('decisor') || userFunc.includes('decisória') || userFunc.includes('promotor') || userFunc.includes('procurador');

  // Available years for filter
  const years = useMemo(() => {
    const yearsSet = new Set([currentYear]);
    processes.forEach(p => {
      const date = parseLocalDate(p.entry_date);
      const year = isValid(date) ? date.getFullYear() : null;
      if (year && !isNaN(year)) yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [processes, currentYear]);

  // Filter processes by year (for Total, Status Chart, etc.)
  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      const date = parseLocalDate(p.entry_date);
      if (!isValid(date)) return false;
      return date.getFullYear() === selectedYear;
    });
  }, [processes, selectedYear]);

  const filteredExpedientes = useMemo(() => {
    return expedientes.filter(e => {
      const date = parseLocalDate(e.entry_date);
      if (!isValid(date)) return false;
      return date.getFullYear() === selectedYear;
    });
  }, [expedientes, selectedYear]);

  const myProcessesInYear = useMemo(() => {
    return myProcesses.filter(p => {
      const date = parseLocalDate(p.entry_date);
      if (!isValid(date)) return false;
      return date.getFullYear() === selectedYear;
    }).length;
  }, [myProcesses, selectedYear]);

  const myExpedientesInYear = useMemo(() => {
    return myExpedientes.filter(e => {
      const date = parseLocalDate(e.entry_date);
      if (!isValid(date)) return false;
      return date.getFullYear() === selectedYear;
    }).length;
  }, [myExpedientes, selectedYear]);

  // Role-based KPI Logic
  const kpis = useMemo(() => {
    const total = filteredProcesses.length;
    // Urgent + Pending only (per requirement)
    const urgent = filteredProcesses.filter(p => p.urgency_request && p.status === 'Pendente').length;

    let mineCount = 0;
    let mineLabel = "Meus Processos";
    let mineSubtext = "Focado em você";

    if (isDecisor) {
      mineCount = filteredProcesses.filter(p => p.status === 'Em revisão').length;
      mineLabel = "Para Revisão";
      mineSubtext = "Aguardando seu despacho";
    } else {
      // Assessoria and others use responsible identity
      mineCount = filteredProcesses.filter(p => p.responsible_user_id === user?.uid).length;
      mineLabel = "Sob minha responsabilidade";
    }

    return { total, urgent, mineCount, mineLabel, mineSubtext };
  }, [filteredProcesses, isDecisor, user?.uid]);

  // Status distribution (filtered by year)
  const statusData = useMemo(() => {
    const counts = filteredProcesses.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([status, count]) => ({
      name: status,
      value: count,
      color: statusConfig[status]?.color || DEFAULT_COLOR
    }));
  }, [filteredProcesses]);

  // Activity logic
  const activity = useMemo(() => {
    const safeDateParse = (d) => {
      if (!d) return 0;
      if (d.seconds) return d.seconds * 1000;
      const date = parseLocalDate(d);
      const ts = date.getTime();
      return isNaN(ts) ? 0 : ts;
    };

    if (isDecisor) {
      // Recent revisions/returns
      return [...processes]
        .filter(p => p.review_submission_date || p.review_return_date)
        .sort((a, b) => {
          const dateA = Math.max(safeDateParse(a.review_return_date), safeDateParse(a.review_submission_date));
          const dateB = Math.max(safeDateParse(b.review_return_date), safeDateParse(b.review_submission_date));
          return dateB - dateA;
        })
        .slice(0, 5);
    } else if (isSecretaria) {
      // Any recent update in organ
      return [...processes]
        .sort((a, b) => safeDateParse(b.updated_at) - safeDateParse(a.updated_at))
        .slice(0, 5);
    } else {
      // Assessoria: Movement by user
      return [...processes]
        .filter(p => p.updated_by === user?.uid || p.responsible_user_id === user?.uid)
        .sort((a, b) => safeDateParse(b.updated_at) - safeDateParse(a.updated_at))
        .slice(0, 5);
    }
  }, [processes, isDecisor, isSecretaria, user?.uid]);

  if (isLoading) {
    return (
      <Card className="p-8 border-dashed bg-slate-50/50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {organization.name}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Sua função: <span className="text-indigo-600">{organization.userFunction || 'Membro'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-10 pl-3 pr-8 rounded-lg border-slate-200 bg-white shadow-sm text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {years.map(y => <option key={y} value={y}>Ano: {y}</option>)}
          </select>
          <Button
            variant="ghost"
            className="text-indigo-600 font-semibold hover:bg-indigo-50 px-4 h-10"
            onClick={() => navigate(`/Organization?id=${organization.id}`)}
          >
            Acessar Órgão <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* KPI: Total */}
        <KpiCard
          title="Total de Processos"
          value={kpis.total}
          icon={FileText}
          color="text-slate-600"
          bgIcon="bg-slate-100"
          subtext={`Registrados em ${selectedYear}`}
          onClick={() => navigate(`/Organization?id=${organization.id}`)}
        />

        {/* KPI: Urgentes */}
        <KpiCard
          title="Urgentes Pendentes"
          value={kpis.urgent}
          icon={AlertCircle}
          color="text-red-600"
          bgIcon="bg-red-100"
          subtext="Requerem atenção"
          onClick={() => navigate(`/Organization?id=${organization.id}&filter=urgent`)}
          pulse={kpis.urgent > 0}
        />

        {/* KPI: Meus */}
        <KpiCard
          title={kpis.mineLabel}
          value={kpis.mineCount}
          icon={isDecisor ? Clock : Users}
          color="text-blue-600"
          bgIcon="bg-blue-100"
          subtext={kpis.mineSubtext}
          onClick={() => navigate(`/Organization?id=${organization.id}&filter=mine`)}
        />

        <KpiCard
          title="Total de Expedientes"
          value={filteredExpedientes.length}
          icon={FileText}
          color="text-violet-600"
          bgIcon="bg-violet-100"
          subtext={`Meus: ${myExpedientesInYear}`}
          onClick={() => navigate(`/Organization?id=${organization.id}&tab=expedientes`)}
        />

        {/* Gráfico resumido lateral */}
        <Card className="shadow-sm border-slate-200 flex flex-col justify-center p-4 lg:col-span-4">
          {statusData.length > 0 ? (
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-wider">
                Distribuição de Status
              </p>
              <p className="text-[10px] text-center text-slate-400 font-medium uppercase tracking-wider mt-1">
                Minhas consultas: {myProcessesInYear} · Meus expedientes: {myExpedientesInYear}
              </p>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 py-4">Sem dados para {selectedYear}</div>
          )}
        </Card>
      </div>

      {/* Activity Feed and Status Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/50 py-4 px-6 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              ATRIBUÍDO A VOCÊ (MOVIMENTAÇÕES RECENTES)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {activity.length > 0 ? (
                activity.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/Organization?id=${organization.id}`)}
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {p.process_number || 'Sem número'}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {p.consulente || p.matter_object || 'Detalhes não informados'}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${statusConfig[p.status]?.startColor || 'bg-slate-100'} ${statusConfig[p.status]?.text || 'text-slate-600'} text-[10px] px-2 py-0.5 border-0`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-slate-400 text-sm">Nenhuma atividade recente identificada.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="py-4 px-6 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-600 uppercase">Resumo Financeiro/Ano</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Média de conclusões</span>
                <span className="text-sm font-bold text-emerald-600">--%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[0%]" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                * Módulo de performance analítica em fase de desenvolvimento.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, bgIcon, subtext, onClick, pulse }) {
  return (
    <Card
      className={`shadow-sm border-slate-200 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-indigo-200' : 'hover:shadow-md'}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
            <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
          </div>
          <div className={`w-12 h-12 rounded-full ${bgIcon} flex items-center justify-center ${pulse ? 'animate-pulse' : ''}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        {subtext && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">{subtext}</p>
            {onClick && <ArrowRight className="w-3.5 h-3.5 text-slate-300" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
