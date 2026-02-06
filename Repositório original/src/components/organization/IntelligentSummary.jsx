import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  MapPin, 
  Users,
  Clock,
  Target,
  AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function IntelligentSummary({ processes, members }) {
  // Calcular métricas
  const totalProcesses = processes.length;
  const finishedProcesses = processes.filter(p => p.status === 'Na pasta').length;
  const urgentProcesses = processes.filter(p => p.urgency_request && p.status !== 'Na pasta').length;
  const completionRate = totalProcesses > 0 ? ((finishedProcesses / totalProcesses) * 100).toFixed(1) : 0;

  // Tempo médio de remessa para revisão (em dias)
  const reviewTimes = processes
    .filter(p => p.analysis_start_date && p.review_submission_date)
    .map(p => {
      try {
        const start = new Date(p.analysis_start_date);
        const submission = new Date(p.review_submission_date);
        if (isNaN(start.getTime()) || isNaN(submission.getTime())) return null;
        return Math.floor((submission - start) / (1000 * 60 * 60 * 24));
      } catch {
        return null;
      }
    })
    .filter(time => time !== null);
  const avgReviewTime = reviewTimes.length > 0 
    ? (reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length).toFixed(1)
    : 0;

  // Tempo médio de devolução (em dias)
  const returnTimes = processes
    .filter(p => p.review_submission_date && p.review_return_date)
    .map(p => {
      try {
        const submission = new Date(p.review_submission_date);
        const returnDate = new Date(p.review_return_date);
        if (isNaN(submission.getTime()) || isNaN(returnDate.getTime())) return null;
        return Math.floor((returnDate - submission) / (1000 * 60 * 60 * 24));
      } catch {
        return null;
      }
    })
    .filter(time => time !== null);
  const avgReturnTime = returnTimes.length > 0 
    ? (returnTimes.reduce((a, b) => a + b, 0) / returnTimes.length).toFixed(1)
    : 0;

  // Processos por localidade (top 10)
  const processesPerLocation = {};
  processes.forEach(p => {
    const location = p.location || 'Não informado';
    processesPerLocation[location] = (processesPerLocation[location] || 0) + 1;
  });
  const locationData = Object.entries(processesPerLocation)
    .map(([name, count]) => ({ name, processos: count }))
    .sort((a, b) => b.processos - a.processos)
    .slice(0, 10);

  // Processos por responsável
  const processesPerResponsible = {};
  const finishedPerResponsible = {};
  
  processes.forEach(p => {
    const responsible = p.responsible_user_name || 'Não atribuído';
    processesPerResponsible[responsible] = (processesPerResponsible[responsible] || 0) + 1;
    if (p.status === 'Na pasta') {
      finishedPerResponsible[responsible] = (finishedPerResponsible[responsible] || 0) + 1;
    }
  });

  const responsiblePerformance = Object.entries(processesPerResponsible).map(([name, total]) => ({
    name,
    total,
    concluídos: finishedPerResponsible[name] || 0,
    taxa: total > 0 ? ((finishedPerResponsible[name] || 0) / total * 100).toFixed(1) : 0
  }));

  // Processos por status
  const statusCounts = {
    'Sem Status': processes.filter(p => !p.status).length,
    'Pendente': processes.filter(p => p.status === 'Pendente').length,
    'Em elaboração': processes.filter(p => p.status === 'Em elaboração').length,
    'Em revisão': processes.filter(p => p.status === 'Em revisão').length,
    'Para revisão': processes.filter(p => p.status === 'Para revisão').length,
    'Na pasta': processes.filter(p => p.status === 'Na pasta').length
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Processos"
          value={totalProcesses}
          icon={FileText}
          color="from-indigo-500 to-violet-500"
        />
        <MetricCard
          title="Taxa de Conclusão"
          value={`${completionRate}%`}
          icon={Target}
          color="from-emerald-500 to-teal-500"
        />
        <MetricCard
          title="Tempo Médio Revisão"
          value={`${avgReviewTime} dias`}
          icon={Clock}
          color="from-blue-500 to-cyan-500"
        />
        <MetricCard
          title="Processos Urgentes"
          value={urgentProcesses}
          icon={AlertCircle}
          color="from-red-500 to-rose-500"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Volume por Localidade */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Volume por Localidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={locationData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="processos" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance por Responsável */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Performance por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {responsiblePerformance.map(({ name, total, concluídos, taxa }) => (
                <div key={name} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-slate-900">{name}</span>
                    <span className="text-xs text-slate-600">{concluídos}/{total} concluídos</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all"
                      style={{ width: `${taxa}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Taxa de conclusão: {taxa}%</div>
                </div>
              ))}
              {responsiblePerformance.length === 0 && (
                <div className="text-center py-8 text-slate-500">Sem dados disponíveis</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Status */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="text-center p-4 bg-slate-50 rounded-lg">
                <div className="text-2xl font-bold text-slate-900">{count}</div>
                <div className="text-xs text-slate-600 mt-1">{status}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const FileText = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;