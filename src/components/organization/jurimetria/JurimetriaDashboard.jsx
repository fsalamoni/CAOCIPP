import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/ui/EmptyState';
import {
    Scale, Gavel, Percent, CalendarDays, MapPin, TrendingUp, Users, CalendarClock,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, PieChart, Pie, Cell, ComposedChart, Line, Legend,
} from 'recharts';
import {
    computeTotais, computeEspecies, computeSerieMensal, computeRanking,
    formatNumber, formatPercent, faixaAproveitamento, resolveAnalysis,
} from '@/lib/jurimetriaEngine';
import { JURIMETRIA_REALIZACOES } from '@/constants/jurimetria';

// Paleta alinhada aos gráficos já existentes na plataforma (ProcessChart).
const CHART_COLORS = [
    '#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#f97316', '#06b6d4', '#ec4899', '#64748b',
];

function KpiCard({ icon: Icon, label, value, hint, accent = 'indigo' }) {
    const accents = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
        slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    };
    return (
        <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accents[accent] || accents.indigo}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
                    {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{hint}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

/** Tooltip dos gráficos, seguindo o tema claro/escuro da plataforma. */
function ChartTooltip({ active, payload, label, suffix = '' }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
            {payload.map((entry) => (
                <p key={entry.dataKey || entry.name} className="text-xs text-slate-600 dark:text-slate-300">
                    <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                        style={{ background: entry.color || entry.fill }}
                    />
                    {entry.name}: <strong>{entry.value}{suffix}</strong>
                </p>
            ))}
        </div>
    );
}

/**
 * Painel da Jurimetria: leitura rápida do conjunto filtrado — totais,
 * aproveitamento, evolução mensal, espécies, comarcas e promotores.
 */
export default function JurimetriaDashboard({ juris, settings, analysis }) {
    const totais = useMemo(() => computeTotais(juris, settings, analysis), [juris, settings, analysis]);
    const especies = useMemo(() => computeEspecies(juris, settings, analysis), [juris, settings, analysis]);
    const serie = useMemo(() => computeSerieMensal(juris, settings, analysis), [juris, settings, analysis]);
    const comarcas = useMemo(
        () => computeRanking(juris, 'comarca', settings, analysis),
        [juris, settings, analysis]
    );
    const promotores = useMemo(
        () => computeRanking(juris, 'promotor', settings, analysis),
        [juris, settings, analysis]
    );
    const opts = resolveAnalysis(analysis);

    // Desfecho da sessão (realizado / redesignado / cancelado): é o plano do
    // "aconteceu?", anterior ao plano do "deu em quê?". Vale sobre o recorte
    // inteiro, mesmo quando os gráficos contam só os realizados.
    const realizacaoChart = useMemo(() => JURIMETRIA_REALIZACOES.map((r) => ({
        name: r.label,
        value: r.value === 'realizado'
            ? totais.realizados
            : r.value === 'redesignado' ? totais.redesignados : totais.cancelados,
        fill: r.chart,
    })).filter((d) => d.value > 0), [totais]);

    const faixa = faixaAproveitamento(totais.aproveitamento);

    const especiesChart = useMemo(
        () => especies.linhas.filter((l) => l.quantidade > 0).slice(0, 9).map((l) => ({
            name: l.especie.length > 26 ? `${l.especie.slice(0, 24)}…` : l.especie,
            fullName: l.especie,
            value: l.quantidade,
        })),
        [especies]
    );

    const serieChart = useMemo(
        () => serie.map((m) => ({
            name: m.label,
            Efetivos: m.efetivos,
            Dissolvidos: m.dissolucoes,
            Aproveitamento: m.aproveitamento === null ? null : Number((m.aproveitamento * 100).toFixed(1)),
        })),
        [serie]
    );

    const comarcasChart = useMemo(
        () => comarcas.linhas.slice(0, 10).map((l) => ({
            name: String(l.chave).replace(/\s*\([^)]*\)\s*$/, '').slice(0, 22),
            Júris: l.total,
        })),
        [comarcas]
    );

    if (!juris || juris.length === 0) {
        return (
            <EmptyState
                icon={Scale}
                title="Nenhum júri no recorte atual"
                description="Importe uma planilha na aba Importação ou cadastre um júri na aba Júris para ver os indicadores aqui."
            />
        );
    }

    return (
        <div className="space-y-5">
            {/* Indicadores principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    icon={Scale}
                    label={opts.somenteRealizados ? 'Júris realizados' : 'Júris no recorte'}
                    value={formatNumber(totais.total)}
                    hint={opts.somenteRealizados && totais.totalBruto !== totais.total
                        ? `de ${formatNumber(totais.totalBruto)} no recorte`
                        : `${formatNumber(serie.length)} mês(es) com sessões`}
                />
                <KpiCard
                    icon={Gavel}
                    label="Julgados (efetivos)"
                    value={formatNumber(totais.efetivos)}
                    hint={`${formatPercent(totais.pctEfetivos)} do total`}
                    accent="emerald"
                />
                <KpiCard
                    icon={CalendarDays}
                    label="Conselhos dissolvidos"
                    value={formatNumber(totais.dissolvidos)}
                    hint={`${formatPercent(totais.pctDissolvidos)} do total`}
                    accent="amber"
                />
                <KpiCard
                    icon={Percent}
                    label="Aproveitamento"
                    value={formatPercent(totais.aproveitamento)}
                    hint={`${formatNumber(totais.pontos, 2)} pontos ponderados`}
                    accent="slate"
                />
            </div>

            {/* Desfecho das sessões: o "aconteceu?" antes do "deu em quê?". */}
            {(totais.redesignados > 0 || totais.cancelados > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <KpiCard
                        icon={CalendarClock}
                        label="Sessões realizadas"
                        value={formatNumber(totais.realizados)}
                        hint={`${formatPercent(totais.pctRealizados)} do recorte`}
                        accent="emerald"
                    />
                    <KpiCard
                        icon={CalendarClock}
                        label="Redesignadas"
                        value={formatNumber(totais.redesignados)}
                        hint={`${formatPercent(totais.pctRedesignados)} do recorte`}
                        accent="amber"
                    />
                    <KpiCard
                        icon={CalendarClock}
                        label="Canceladas"
                        value={formatNumber(totais.cancelados)}
                        hint={`${formatPercent(totais.pctCancelados)} do recorte`}
                        accent="rose"
                    />
                </div>
            )}

            {faixa && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>Faixa de aproveitamento do recorte:</span>
                    <Badge className={`${faixa.badge} border-0 font-medium`}>{faixa.label}</Badge>
                    <span className="text-xs">
                        (calculado sobre os {formatNumber(totais.efetivos)} júris efetivos, com os pesos
                        definidos em Painel Administrativo → Jurimetria)
                    </span>
                </div>
            )}

            {/* Evolução mensal */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        Evolução mensal
                    </CardTitle>
                    <CardDescription>
                        Júris efetivos e dissolvidos por mês, com o aproveitamento ponderado do período.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={serieChart} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    unit="%"
                                    domain={[0, 100]}
                                />
                                <RechartsTooltip content={<ChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar yAxisId="left" dataKey="Efetivos" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
                                <Bar yAxisId="left" dataKey="Dissolvidos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="Aproveitamento"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    connectNulls
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Espécies de resultado */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Gavel className="w-4 h-4 text-slate-400" />
                            Espécies de resultado
                        </CardTitle>
                        <CardDescription>
                            Distribuição entre os {formatNumber(especies.totalEfetivos)} júris efetivos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={especiesChart}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={88}
                                        paddingAngle={2}
                                        dataKey="value"
                                        nameKey="fullName"
                                    >
                                        {especiesChart.map((entry, index) => (
                                            <Cell key={entry.fullName} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: 11 }}
                                        formatter={(value) => (
                                            String(value).length > 30 ? `${String(value).slice(0, 28)}…` : value
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Realização das sessões */}
                {realizacaoChart.length > 1 && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CalendarClock className="w-4 h-4 text-slate-400" />
                                Realização das sessões
                            </CardTitle>
                            <CardDescription>
                                Dos {formatNumber(totais.totalBruto)} júris do recorte, quantos de fato
                                foram a júri na data da pauta.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={realizacaoChart}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={88}
                                            paddingAngle={2}
                                            dataKey="value"
                                            nameKey="name"
                                        >
                                            {realizacaoChart.map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Top comarcas */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            Comarcas com mais júris
                        </CardTitle>
                        <CardDescription>
                            As 10 primeiras de {formatNumber(comarcas.linhas.length)} comarcas no recorte.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comarcasChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={120}
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        interval={0}
                                    />
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Bar dataKey="Júris" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Promotores */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        Atuação por promotor(a)
                    </CardTitle>
                    <CardDescription>
                        Os 12 com maior número de júris no recorte. O relatório completo está na aba Relatórios.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {promotores.linhas.slice(0, 12).map((linha) => {
                            const f = faixaAproveitamento(linha.aproveitamento);
                            const maior = promotores.linhas[0]?.total || 1;
                            return (
                                <div key={linha.chave} className="flex items-center gap-3 py-2">
                                    <span className="text-sm text-slate-700 dark:text-slate-200 w-52 shrink-0 truncate" title={linha.chave}>
                                        {linha.chave}
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-indigo-500"
                                            style={{ width: `${Math.max(2, (linha.total / maior) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums w-12 text-right">
                                        {formatNumber(linha.total)}
                                    </span>
                                    {f && (
                                        <Badge className={`${f.badge} border-0 text-[11px] w-16 justify-center`}>
                                            {formatPercent(linha.aproveitamento, 0)}
                                        </Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
