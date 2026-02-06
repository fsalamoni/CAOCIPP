import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const COLORS = {
  "Em triagem": "#64748b",
  "Pendente": "#f59e0b",
  "Em elaboração": "#3b82f6",
  "Em revisão": "#8b5cf6",
  "Para revisão": "#f97316",
  "Na pasta": "#10b981"
};

const CHART_COLORS = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f97316'];

export function StatusPieChart({ data }) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    color: COLORS[name] || '#64748b'
  })).filter(item => item.value > 0);

  return (
    <Card className="border-0 shadow-lg shadow-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800">Processos por Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResponsibleBarChart({ data }) {
  return (
    <Card className="border-0 shadow-lg shadow-slate-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800">Processos por Responsável</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100} 
                stroke="#64748b"
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
              />
              <Bar 
                dataKey="total" 
                fill="#1e3a5f" 
                radius={[0, 4, 4, 0]}
                name="Total"
              />
              <Bar 
                dataKey="finalized" 
                fill="#10b981" 
                radius={[0, 4, 4, 0]}
                name="Finalizados"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}