import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EmptyState from '@/components/ui/EmptyState';
import {
    Database, MapPin, Tags, Gavel, TrendingUp, Percent, Banknote, AlarmClock,
    GitBranch, Users, Info,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, PieChart, Pie, Cell, ComposedChart, Line, Legend,
} from 'recharts';
import {
    computeTotais, computeDistribuicao, computeSerieMensal, computePrescricao,
    computeGargalos, computeConcentracao,
    formatNumber, formatPercent, formatMoeda, faixaAproveitamento,
} from '@/lib/panoramaEngine';
import {
    columnForRole, corDoDesfecho, faixaPrescricaoMeta,
    PANORAMA_FAIXAS_PRESCRICAO,
} from '@/constants/panorama';

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
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
                    {hint && <p className="text-xs text-slate-400 truncate" title={hint}>{hint}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg text-xs">
            <p className="font-medium mb-1">{payload[0]?.payload?.fullName || label}</p>
            {payload.map((p) => (
                <p key={p.dataKey} style={{ color: p.color }}>
                    {p.name}: <strong>{typeof p.value === 'number' ? formatNumber(p.value) : p.value}</strong>
                </p>
            ))}
        </div>
    );
}

/**
 * Painel de uma base do Panorama.
 *
 * Cada bloco só aparece quando o PAPEL que o alimenta foi mapeado. Uma base que
 * só tem identificador e data mostra o total e a evolução mensal; quem mapeou
 * território, assunto e desfecho vê o painel inteiro. É o que permite ao mesmo
 * código servir a um CAO que acompanha dez colunas e a outro que acompanha
 * quarenta — sem mostrar caixas vazias para quem não tem o dado.
 */
export default function PanoramaDashboard({ registros, base, analysis }) {
    const totais = useMemo(() => computeTotais(registros, base, analysis), [registros, base, analysis]);
    const serie = useMemo(() => computeSerieMensal(registros, base, analysis), [registros, base, analysis]);

    const temUnidade = Boolean(columnForRole(base, 'unidade'));
    const temAssunto = Boolean(columnForRole(base, 'assunto'));
    const temDesfecho = Boolean(columnForRole(base, 'desfecho'));
    const temResponsavel = Boolean(columnForRole(base, 'responsavel'));
    const temValor = Boolean(columnForRole(base, 'valor'));
    const temSituacao = Boolean(columnForRole(base, 'situacao'));
    const temPrescricao = (base?.prescricao?.modo || 'desligado') !== 'desligado';
    const temRegioes = Object.keys(base?.regioes || {}).length > 0;

    const keyUnidade = columnForRole(base, 'unidade')?.key;
    const keyAssunto = columnForRole(base, 'assunto')?.key;
    const keyDesfecho = columnForRole(base, 'desfecho')?.key;
    const keyResponsavel = columnForRole(base, 'responsavel')?.key;

    const unidades = useMemo(
        () => (temUnidade ? computeDistribuicao(registros, keyUnidade, base, analysis) : null),
        [registros, keyUnidade, base, analysis, temUnidade]
    );
    const assuntos = useMemo(
        () => (temAssunto ? computeDistribuicao(registros, keyAssunto, base, analysis) : null),
        [registros, keyAssunto, base, analysis, temAssunto]
    );
    const desfechos = useMemo(
        () => (temDesfecho ? computeDistribuicao(registros, keyDesfecho, base, analysis) : null),
        [registros, keyDesfecho, base, analysis, temDesfecho]
    );
    const responsaveis = useMemo(
        () => (temResponsavel ? computeDistribuicao(registros, keyResponsavel, base, analysis) : null),
        [registros, keyResponsavel, base, analysis, temResponsavel]
    );
    const regioes = useMemo(
        () => (temRegioes ? computeDistribuicao(registros, '__regiao', base, analysis) : null),
        [registros, base, analysis, temRegioes]
    );
    const prescricao = useMemo(
        () => (temPrescricao ? computePrescricao(registros, base, analysis) : null),
        [registros, base, analysis, temPrescricao]
    );
    const gargalos = useMemo(
        () => (temSituacao ? computeGargalos(registros, base, analysis) : null),
        [registros, base, analysis, temSituacao]
    );
    const concentracao = useMemo(
        () => (temUnidade ? computeConcentracao(registros, keyUnidade, base, analysis) : null),
        [registros, keyUnidade, base, analysis, temUnidade]
    );

    const faixa = faixaAproveitamento(totais.aproveitamento);

    const serieChart = useMemo(() => serie.map((m) => ({
        name: m.label,
        fullName: m.labelCompleto,
        Registros: m.quantidade,
        ...(temValor ? { Valor: Math.round(m.valorTotal) } : {}),
    })), [serie, temValor]);

    const desfechoChart = useMemo(() => (desfechos?.linhas || [])
        .filter((l) => l.quantidade > 0)
        .slice(0, 9)
        .map((l) => ({
            name: l.chave.length > 26 ? `${l.chave.slice(0, 24)}…` : l.chave,
            fullName: l.chave,
            value: l.quantidade,
            fill: corDoDesfecho(l.chave, base),
        })), [desfechos, base]);

    const unidadeChart = useMemo(() => (unidades?.linhas || [])
        .slice(0, 12)
        .map((l) => ({
            name: l.chave.length > 20 ? `${l.chave.slice(0, 18)}…` : l.chave,
            fullName: l.chave,
            Registros: l.quantidade,
        })), [unidades]);

    if (!registros || registros.length === 0) {
        return (
            <EmptyState
                icon={Database}
                title="Nenhum registro no recorte atual"
                description="Importe uma planilha na aba Importação ou ajuste os filtros para ver os indicadores aqui."
            />
        );
    }

    return (
        <div className="space-y-5">
            {/* Indicadores principais */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    icon={Database}
                    label="Registros no recorte"
                    value={formatNumber(totais.quantidade)}
                    hint={serie.length > 0 ? `${formatNumber(serie.length)} mês(es) com registros` : ''}
                />
                {temUnidade && (
                    <KpiCard
                        icon={MapPin}
                        label={columnForRole(base, 'unidade').label}
                        value={formatNumber(unidades.linhas.length)}
                        hint={unidades.linhas[0] ? `maior: ${unidades.linhas[0].chave}` : ''}
                        accent="slate"
                    />
                )}
                {temAssunto && (
                    <KpiCard
                        icon={Tags}
                        label={columnForRole(base, 'assunto').label}
                        value={formatNumber(assuntos.linhas.length)}
                        hint={assuntos.linhas[0] ? `maior: ${assuntos.linhas[0].chave}` : ''}
                        accent="slate"
                    />
                )}
                {temDesfecho && (
                    <KpiCard
                        icon={Percent}
                        label="Aproveitamento"
                        value={formatPercent(totais.aproveitamento)}
                        hint={`${formatNumber(totais.pontos, 2)} pontos em ${formatNumber(totais.efetivos)} registros`}
                        accent="emerald"
                    />
                )}
                {temValor && (
                    <KpiCard
                        icon={Banknote}
                        label="Valor total"
                        value={formatMoeda(totais.valorTotal)}
                        hint={`média de ${formatMoeda(totais.valorMedio)} em ${formatNumber(totais.comValor)} registros`}
                        accent="amber"
                    />
                )}
                {temPrescricao && (
                    <KpiCard
                        icon={AlarmClock}
                        label="Prescritos"
                        value={formatNumber(prescricao.contagem.prescrito || 0)}
                        hint={`${formatNumber((prescricao.contagem.critico || 0) + (prescricao.contagem.alerta || 0))} em alerta`}
                        accent="rose"
                    />
                )}
            </div>

            {temDesfecho && faixa && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>Faixa de aproveitamento do recorte:</span>
                    <Badge className={`${faixa.badge} border-0 font-medium`}>{faixa.label}</Badge>
                    <span className="text-xs">
                        (calculado sobre {formatNumber(totais.efetivos)} registro(s), com os pesos definidos
                        em Painel Administrativo → Panorama)
                    </span>
                </div>
            )}

            {/* Leitura de concentração — a pergunta de alocação de força de trabalho */}
            {concentracao && concentracao.grupos > 2 && (
                <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        A demanda está <strong>{concentracao.leitura}</strong>:{' '}
                        {concentracao.linhas.slice(0, 3).map((l) => l.chave).join(', ')} respondem por{' '}
                        <strong>{formatPercent(concentracao.pctTop3)}</strong> do recorte, e bastam{' '}
                        <strong>{formatNumber(concentracao.paraMetade)}</strong> de{' '}
                        {formatNumber(concentracao.grupos)} para chegar à metade do volume.
                    </AlertDescription>
                </Alert>
            )}

            {/* Evolução no tempo */}
            {serieChart.length > 1 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-slate-400" />
                            Evolução mensal
                        </CardTitle>
                        <CardDescription>
                            Registros por mês, pela {columnForRole(base, 'data_principal')?.label || 'data principal'}
                            {temValor ? ', com o valor acumulado do período' : ''}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={serieChart} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                    {temValor && (
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                                        />
                                    )}
                                    <RechartsTooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar yAxisId="left" dataKey="Registros" fill="#1e3a5f" radius={[3, 3, 0, 0]} />
                                    {temValor && (
                                        <Line
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="Valor"
                                            stroke="#f59e0b"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            connectNulls
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Desfechos */}
                {desfechoChart.length > 1 && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Gavel className="w-4 h-4 text-slate-400" />
                                {columnForRole(base, 'desfecho').label}
                            </CardTitle>
                            <CardDescription>
                                Distribuição entre os {formatNumber(totais.quantidade)} registros do recorte.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={desfechoChart}
                                            cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={88}
                                            paddingAngle={2}
                                            dataKey="value"
                                            nameKey="fullName"
                                        >
                                            {desfechoChart.map((entry) => (
                                                <Cell key={entry.fullName} fill={entry.fill} stroke="rgba(15,23,42,0.18)" />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Legend
                                            wrapperStyle={{ fontSize: 11 }}
                                            formatter={(v) => (String(v).length > 30 ? `${String(v).slice(0, 28)}…` : v)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Territórios */}
                {unidadeChart.length > 1 && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                Onde a demanda se concentra
                            </CardTitle>
                            <CardDescription>
                                As {unidadeChart.length} maiores de {formatNumber(unidades.linhas.length)}{' '}
                                {columnForRole(base, 'unidade').label.toLowerCase()}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={unidadeChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={110} />
                                        <RechartsTooltip content={<ChartTooltip />} />
                                        <Bar dataKey="Registros" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Prescrição */}
            {temPrescricao && prescricao.comPrazo > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlarmClock className="w-4 h-4 text-slate-400" />
                            Prescrição
                        </CardTitle>
                        <CardDescription>
                            Situação dos {formatNumber(prescricao.comPrazo)} registros com prazo apurável.
                            {prescricao.semPrazo > 0 && ` ${formatNumber(prescricao.semPrazo)} ficaram de fora por falta da data-base.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {PANORAMA_FAIXAS_PRESCRICAO.filter((f) => f.key !== 'sem_prazo').map((f) => (
                                <div key={f.key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <Badge className={`${f.badge} border-0 text-[11px] font-medium`}>{f.label}</Badge>
                                    <p className="text-2xl font-bold tabular-nums mt-1">
                                        {formatNumber(prescricao.contagem[f.key] || 0)}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {formatPercent(prescricao.pct[f.key])} dos apuráveis
                                    </p>
                                </div>
                            ))}
                        </div>

                        {prescricao.urgentes.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                                    Os 10 mais urgentes
                                </p>
                                <ul className="space-y-1.5">
                                    {prescricao.urgentes.slice(0, 10).map((r) => {
                                        const meta = faixaPrescricaoMeta(r.faixa);
                                        return (
                                            <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                                                <Badge className={`${meta.badge} border-0 text-[10px]`}>{meta.label}</Badge>
                                                <span className="font-mono">{r.identificador || 'sem identificador'}</span>
                                                <span className="text-slate-400">
                                                    {[r.unidade, r.assunto].filter(Boolean).join(' · ')}
                                                </span>
                                                <span className="tabular-nums text-slate-500 ml-auto">
                                                    {r.dias < 0
                                                        ? `venceu há ${formatNumber(Math.abs(r.dias))} dia(s)`
                                                        : `vence em ${formatNumber(r.dias)} dia(s)`}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gargalos */}
                {gargalos?.disponivel && gargalos.linhas.length > 1 && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-slate-400" />
                                Onde os registros param
                            </CardTitle>
                            <CardDescription>
                                Quantos estão em cada {columnForRole(base, 'situacao').label.toLowerCase()}
                                {gargalos.temIdade ? ', e há quanto tempo em média' : ''}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {gargalos.linhas.slice(0, 8).map((l) => (
                                    <li key={l.situacao} className="flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm truncate" title={l.situacao}>{l.situacao}</p>
                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-400 rounded-full"
                                                    style={{ width: `${Math.round((l.percentual || 0) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-semibold tabular-nums">{formatNumber(l.quantidade)}</p>
                                            {gargalos.temIdade && l.idadeMediana !== null && (
                                                <p className="text-[11px] text-slate-400 tabular-nums">
                                                    mediana {formatNumber(Math.round(l.idadeMediana))} dias
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* Responsáveis */}
                {responsaveis && responsaveis.linhas.length > 1 && (
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                Distribuição por {columnForRole(base, 'responsavel').label.toLowerCase()}
                            </CardTitle>
                            <CardDescription>
                                {formatNumber(responsaveis.linhas.length)} no recorte. Diferenças grandes de
                                volume costumam indicar desequilíbrio de carga.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {responsaveis.linhas.slice(0, 8).map((l) => (
                                    <li key={l.chave} className="flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm truncate" title={l.chave}>{l.chave}</p>
                                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-400 rounded-full"
                                                    style={{ width: `${Math.round((l.percentual || 0) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold tabular-nums shrink-0">
                                            {formatNumber(l.quantidade)}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Regiões */}
            {regioes && regioes.linhas.length > 1 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            Por região
                        </CardTitle>
                        <CardDescription>
                            Agrupamento configurado em Painel Administrativo → Panorama → Regiões.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {regioes.linhas.map((l) => (
                                <div key={l.chave} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={l.chave}>
                                        {l.chave}
                                    </p>
                                    <p className="text-2xl font-bold tabular-nums">{formatNumber(l.quantidade)}</p>
                                    <p className="text-xs text-slate-400">{formatPercent(l.percentual)} do recorte</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
