import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  Clock,
  Target,
  AlertCircle,
  FileText,
  CalendarDays,
  ChevronDown,
  History
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';
import TemporalMetrics from './TemporalMetrics';
import { calculateBusinessDays } from '@/lib/dateUtils';

export default function IntelligentSummary({ processes, members }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' or 0-11

  const PT_MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Available years for filter
  const years = useMemo(() => {
    const yearsSet = new Set([currentYear]);
    processes.forEach(p => {
      if (p.entry_date) {
        const year = new Date(p.entry_date).getFullYear();
        if (year && !isNaN(year)) yearsSet.add(year);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [processes, currentYear]);

  // Filter processes by selected period
  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      if (!p.entry_date) return false;
      const date = new Date(p.entry_date);
      const yearMatch = date.getFullYear() === selectedYear;
      const monthMatch = selectedMonth === 'all' || date.getMonth() === Number(selectedMonth);
      return yearMatch && monthMatch;
    });
  }, [processes, selectedYear, selectedMonth]);

  // Calcular métricas
  const totalProcesses = filteredProcesses.length;
  // 'Na pasta' is the finished status in config
  const finishedProcesses = filteredProcesses.filter(p => p.status === 'Na pasta').length;
  const urgentProcesses = filteredProcesses.filter(p => p.urgency_request && p.status !== 'Na pasta').length;
  const completionRate = totalProcesses > 0 ? ((finishedProcesses / totalProcesses) * 100).toFixed(1) : 0;

  // Conjunto sincronizado: Apenas processos que já foram devolvidos (fluxo completo)
  // Isso garante que o Total seja sempre o maior marco, pois as médias parciais
  // serão calculadas sobre a mesma base de processos finalizados.
  const completedProcessesSet = filteredProcesses.filter(p => p.review_return_date);

  // 1. Tempo total médio (Entrada -> Devolução após Revisão)
  const totalTimes = completedProcessesSet
    .filter(p => p.entry_date)
    .map(p => calculateBusinessDays(p.entry_date, p.review_return_date))
    .filter(t => t !== null && t >= 0);
  const avgTotalTime = totalTimes.length > 0 ? Math.ceil(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length) : 0;

  // 2. Tempo médio para análise de consultas (Distribuição -> Remessa p/ Revisão)
  const analysisTimes = completedProcessesSet
    .filter(p => p.distribution_date && p.review_submission_date)
    .map(p => calculateBusinessDays(p.distribution_date, p.review_submission_date))
    .filter(t => t !== null && t >= 0);
  const avgAnalysisTime = analysisTimes.length > 0 ? Math.ceil(analysisTimes.reduce((a, b) => a + b, 0) / analysisTimes.length) : 0;

  // 3. Tempo médio para revisão de minutas (Remessa p/ Revisão -> Devolução após Revisão)
  const reviewStageTimes = completedProcessesSet
    .filter(p => p.review_submission_date)
    .map(p => calculateBusinessDays(p.review_submission_date, p.review_return_date))
    .filter(t => t !== null && t >= 0);
  const avgReviewStageTime = reviewStageTimes.length > 0 ? Math.ceil(reviewStageTimes.reduce((a, b) => a + b, 0) / reviewStageTimes.length) : 0;

  // Processos por localidade (top 10)
  const processesPerLocation = {};
  filteredProcesses.forEach(p => {
    const location = p.location || 'Não informado';
    processesPerLocation[location] = (processesPerLocation[location] || 0) + 1;
  });
  const locationData = Object.entries(processesPerLocation)
    .map(([name, count]) => ({ name, processos: count }))
    .sort((a, b) => b.processos - a.processos)
    .slice(0, 10);

  // Processos por status (Dynamic based on Config)
  // Initialize counts for all configured statuses to 0
  const statusCounts = {};
  Object.keys(statusConfig).forEach(status => {
    statusCounts[status] = 0;
  });
  // Also track 'Sem Status' or others
  let noStatusCount = 0;

  filteredProcesses.forEach(p => {
    if (!p.status) {
      noStatusCount++;
    } else if (statusCounts.hasOwnProperty(p.status)) {
      statusCounts[p.status]++;
    } else {
      // If status is not in config, add it dynamically or group it? 
      // Grouping under 'Outros' or adding dynamic key
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Período de Análise</h2>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Resumo Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full sm:w-32 h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>Ano {y}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-44 h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="all">Todos os Meses</option>
              {PT_MONTHS.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

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
          title="Tempo Médio Fluxo"
          value={`${avgTotalTime} dias`}
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

      {/* Grid de Gráficos e Métricas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume por Localidade */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-lg flex items-center gap-2 font-bold text-slate-800">
              <MapPin className="w-5 h-5 text-indigo-500" />
              Distribuição por Localidade
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {locationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={locationData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={150}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar
                    dataKey="processos"
                    fill="#6366f1"
                    radius={[0, 6, 6, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="font-medium text-sm">Sem dados para este período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quadro de Temporalidade */}
        <TemporalMetrics
          totalAvg={avgTotalTime}
          analysisAvg={avgAnalysisTime}
          reviewAvg={avgReviewStageTime}
        />
      </div>

      {/* Resumo por Status */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {noStatusCount > 0 && (
              <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-2xl font-bold text-slate-900">{noStatusCount}</div>
                <div className="text-xs text-slate-600 mt-1">Sem Status</div>
              </div>
            )}
            {Object.entries(statusCounts).map(([status, count]) => {
              const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
              // Use config colors for background/border if desired, logic below uses simple styling
              // Let's use subtle background from config
              return (
                <div
                  key={status}
                  className={`text-center p-4 rounded-lg border border-transparent ${config.startColor}`}
                >
                  <div className={`text-2xl font-bold ${config.text?.replace('text-', 'text-opacity-90 text-') || 'text-slate-900'}`}>
                    {count}
                  </div>
                  <div className={`text-xs mt-1 ${config.text || 'text-slate-600'}`}>
                    {status}
                  </div>
                </div>
              );
            })}
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
