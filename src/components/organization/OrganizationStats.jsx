import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import KPICard from "@/components/dashboard/KPICard";
import { StatusPieChart, ResponsibleBarChart } from "@/components/dashboard/ProcessChart";
import { FileText, Clock, CheckCircle, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { differenceInDays } from "date-fns";

export default function OrganizationStats({ processes, members }) {
  const stats = useMemo(() => {
    const total = processes.length;
    const byStatus = processes.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
    
    const urgent = processes.filter(p => p.urgency_request && p.status !== "Na pasta").length;
    const finalized = byStatus["Na pasta"] || 0;
    const inProgress = total - finalized;

    // Tempo médio de revisão
    const processesWithReview = processes.filter(p => p.review_submission_date && p.distribution_date);
    const avgReviewTime = processesWithReview.length > 0
      ? Math.round(processesWithReview.reduce((sum, p) => {
          return sum + differenceInDays(new Date(p.review_submission_date), new Date(p.distribution_date));
        }, 0) / processesWithReview.length)
      : 0;

    // Tempo médio de devolução
    const processesWithReturn = processes.filter(p => p.review_return_date && p.review_submission_date);
    const avgReturnTime = processesWithReturn.length > 0
      ? Math.round(processesWithReturn.reduce((sum, p) => {
          return sum + differenceInDays(new Date(p.review_return_date), new Date(p.review_submission_date));
        }, 0) / processesWithReturn.length)
      : 0;

    // Dados por responsável
    const byResponsible = members.map(member => {
      const memberProcesses = processes.filter(p => p.responsible_user_id === member.user_id);
      return {
        name: member.user_name?.split(" ")[0] || "Sem nome",
        total: memberProcesses.length,
        finalized: memberProcesses.filter(p => p.status === "Na pasta").length
      };
    }).filter(m => m.total > 0);

    // Taxa de conclusão
    const completionRate = total > 0 ? Math.round((finalized / total) * 100) : 0;

    // Volume por localidade
    const byLocation = processes.reduce((acc, p) => {
      if (p.location) {
        acc[p.location] = (acc[p.location] || 0) + 1;
      }
      return acc;
    }, {});

    const topLocations = Object.entries(byLocation)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return {
      total,
      byStatus,
      urgent,
      finalized,
      inProgress,
      avgReviewTime,
      avgReturnTime,
      byResponsible,
      completionRate,
      topLocations
    };
  }, [processes, members]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de Processos"
          value={stats.total}
          icon={FileText}
          color="blue"
        />
        <KPICard
          title="Em Andamento"
          value={stats.inProgress}
          icon={Clock}
          color="amber"
        />
        <KPICard
          title="Finalizados"
          value={stats.finalized}
          icon={CheckCircle}
          color="emerald"
          trend="up"
          trendValue={`${stats.completionRate}% concluídos`}
        />
        <KPICard
          title="Urgentes"
          value={stats.urgent}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Métricas de Tempo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Tempo Médio p/ Revisão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{stats.avgReviewTime} <span className="text-lg font-normal text-slate-500">dias</span></p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Tempo Médio de Devolução</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{stats.avgReturnTime} <span className="text-lg font-normal text-slate-500">dias</span></p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Taxa de Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{stats.completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusPieChart data={stats.byStatus} />
        <ResponsibleBarChart data={stats.byResponsible} />
      </div>

      {/* Top Localidades */}
      <Card className="border-0 shadow-lg shadow-slate-200/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Volume por Localidade (Top 5)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topLocations.map((loc, index) => (
              <div key={loc.name} className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-500 w-6">{index + 1}º</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{loc.name}</span>
                    <span className="text-sm text-slate-500">{loc.value} processos</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                      style={{ width: `${(loc.value / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}