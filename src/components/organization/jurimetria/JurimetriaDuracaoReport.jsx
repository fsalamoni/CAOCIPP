import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Hourglass, TrendingUp, TrendingDown, Timer } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip,
} from 'recharts';
import {
    computeDuracoes, formatDuracao, formatNumber, formatDateBR, formatPercent,
} from '@/lib/jurimetriaEngine';
import { JURIMETRIA_AGRUPADORES_DURACAO } from '@/constants/jurimetria';
import JurimetriaExportMenu from './JurimetriaExportMenu';
import JurimetriaPagination, { usePagedRows } from './JurimetriaPagination';

/** Cartão de um extremo (mais longa / mais curta), com o processo identificado. */
function ExtremoCard({ icon: Icon, label, registro, accent }) {
    if (!registro) return null;
    return (
        <div className={`rounded-lg border p-3 ${accent}`}>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </p>
            <p className="text-2xl font-bold tabular-nums">{formatDuracao(registro.minutos)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate" title={registro.numero_processo}>
                {registro.numero_processo || 'sem número'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
                {[formatDateBR(registro.data_juri), registro.comarca].filter(Boolean).join(' — ')}
            </p>
            {(registro.horario_inicio || registro.horario) && (
                <p className="text-[11px] text-slate-400 tabular-nums">
                    {registro.horario_inicio || '—'} às {registro.horario || '—'}
                </p>
            )}
        </div>
    );
}

/**
 * Panorama de duração das sessões.
 *
 * A pergunta que este relatório responde não é "quantos júris houve", mas
 * "quanto tempo o plenário ficou ocupado" — e onde esse tempo se concentra. Por
 * isso o eixo de agrupamento é escolhido pelo usuário: a mesma base lida por
 * comarca, por promotor, por espécie de resultado, por matéria, por mês ou por
 * ano conta histórias diferentes.
 *
 * A média só considera as sessões com os DOIS horários preenchidos, e o
 * relatório diz quantas são — uma média de 3 sessões num recorte de 200 não é
 * a mesma informação que uma média de 190.
 */
export default function JurimetriaDuracaoReport({
    juris, settings, analysis, subtitle = '', organizationId,
}) {
    const [agrupador, setAgrupador] = useState('comarca');
    const dados = useMemo(
        () => computeDuracoes(juris, agrupador, settings, analysis),
        [juris, agrupador, settings, analysis]
    );
    const pager = usePagedRows(dados.linhas, { scope: 'rel_duracao', organizationId });

    const dimLabel = JURIMETRIA_AGRUPADORES_DURACAO.find((a) => a.key === agrupador)?.label || 'Agrupamento';

    const colunas = [
        { label: dimLabel, value: (r) => r.chave },
        { label: 'Júris', value: (r) => r.total },
        { label: 'Com duração aferida', value: (r) => r.comDuracao },
        { label: 'Duração média', value: (r) => formatDuracao(r.media) },
        { label: 'Mediana', value: (r) => formatDuracao(r.mediana) },
        { label: 'Maior duração', value: (r) => formatDuracao(r.maior?.minutos) },
        { label: 'Processo mais longo', value: (r) => r.maior?.numero_processo || '' },
        { label: 'Menor duração', value: (r) => formatDuracao(r.menor?.minutos) },
        { label: 'Processo mais curto', value: (r) => r.menor?.numero_processo || '' },
        { label: 'Tempo total', value: (r) => formatDuracao(r.minutos) },
    ];

    // O gráfico só cabe com poucas barras; acima disso a tabela é que informa.
    const grafico = useMemo(
        () => dados.linhas
            .filter((l) => l.media !== null)
            .slice(0, 12)
            .map((l) => ({
                name: l.chave.length > 22 ? `${l.chave.slice(0, 20)}…` : l.chave,
                fullName: l.chave,
                Minutos: Math.round(l.media),
            })),
        [dados]
    );

    const semAferição = dados.total > 0 && dados.comDuracao === 0;

    return (
        <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Hourglass className="w-4 h-4 text-slate-400" />
                            Panorama de duração das sessões
                        </CardTitle>
                        <CardDescription>
                            Tempo médio, maior e menor duração das sessões do recorte. A duração sai da
                            diferença entre o horário de início e o de conclusão, então só entram no cálculo
                            os júris com os dois preenchidos.
                        </CardDescription>
                    </div>
                    <div className="flex items-end gap-2 shrink-0">
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500">Agrupar por</Label>
                            <Select value={agrupador} onValueChange={setAgrupador}>
                                <SelectTrigger className="w-[210px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {JURIMETRIA_AGRUPADORES_DURACAO.map((a) => (
                                        <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <JurimetriaExportMenu
                            rows={dados.linhas}
                            columns={colunas}
                            filenameBase={`jurimetria-duracao-${agrupador}`}
                            title={`Duração das sessões por ${dimLabel.toLowerCase()}`}
                            subtitle={subtitle}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {semAferição ? (
                    <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Nenhum júri do recorte tem o horário de início e o de conclusão preenchidos —
                        sem os dois não há duração a calcular.
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <Timer className="w-3.5 h-3.5" />
                                    Duração média
                                </p>
                                <p className="text-2xl font-bold tabular-nums">{formatDuracao(dados.media)}</p>
                                <p className="text-xs text-slate-400">
                                    sobre {formatNumber(dados.comDuracao)} de {formatNumber(dados.total)} júris
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Mediana</p>
                                <p className="text-2xl font-bold tabular-nums">{formatDuracao(dados.mediana)}</p>
                                <p className="text-xs text-slate-400">metade das sessões durou menos que isso</p>
                            </div>
                            <ExtremoCard
                                icon={TrendingUp}
                                label="Sessão mais longa"
                                registro={dados.maior}
                                accent="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30"
                            />
                            <ExtremoCard
                                icon={TrendingDown}
                                label="Sessão mais curta"
                                registro={dados.menor}
                                accent="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30"
                            />
                        </div>

                        {dados.semDuracao > 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                <Badge variant="outline" className="mr-1.5 text-[11px]">
                                    {formatNumber(dados.semDuracao)}
                                </Badge>
                                júri(s) do recorte ficaram de fora do cálculo por não ter horário de início ou de
                                conclusão — {formatPercent(dados.total ? dados.semDuracao / dados.total : null)} do
                                total. Preenchê-los na aba Júris melhora a precisão deste relatório.
                            </p>
                        )}

                        {grafico.length > 1 && (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={grafico} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                                        <YAxis
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickFormatter={(v) => formatDuracao(v)}
                                            width={60}
                                        />
                                        <RechartsTooltip
                                            formatter={(value) => [formatDuracao(value), 'Duração média']}
                                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        />
                                        <Bar dataKey="Minutos" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[180px]">{dimLabel}</TableHead>
                                        <TableHead className="text-right w-20">Júris</TableHead>
                                        <TableHead className="text-right w-24">Aferidos</TableHead>
                                        <TableHead className="text-right w-28">Média</TableHead>
                                        <TableHead className="text-right w-28">Mediana</TableHead>
                                        <TableHead className="text-right w-28">Maior</TableHead>
                                        <TableHead className="text-right w-28">Menor</TableHead>
                                        <TableHead className="text-right w-28">Tempo total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pager.pageRows.map((linha) => (
                                        <TableRow key={linha.chave}>
                                            <TableCell className="text-sm">
                                                <span className="block max-w-[260px] truncate" title={linha.chave}>
                                                    {linha.chave}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-semibold">
                                                {formatNumber(linha.total)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-400">
                                                {formatNumber(linha.comDuracao)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">
                                                {formatDuracao(linha.media)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {formatDuracao(linha.mediana)}
                                            </TableCell>
                                            <TableCell
                                                className="text-right tabular-nums text-slate-500"
                                                title={linha.maior?.numero_processo || ''}
                                            >
                                                {formatDuracao(linha.maior?.minutos)}
                                            </TableCell>
                                            <TableCell
                                                className="text-right tabular-nums text-slate-500"
                                                title={linha.menor?.numero_processo || ''}
                                            >
                                                {formatDuracao(linha.menor?.minutos)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {formatDuracao(linha.minutos)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <JurimetriaPagination pager={pager} label={dimLabel.toLowerCase()} />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
