import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Briefcase, Info, AlarmClock } from 'lucide-react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import {
    computeExpediente, formatNumber, formatPercent, formatDuracao, formatDateBR,
} from '@/lib/jurimetriaEngine';
import {
    JURIMETRIA_AGRUPADORES_DURACAO,
    JURIMETRIA_EXPEDIENTE_SITUACOES,
    expedienteMeta,
} from '@/constants/jurimetria';
import JurimetriaExportMenu from './JurimetriaExportMenu';
import JurimetriaPagination, { usePagedRows } from './JurimetriaPagination';

/** "12:00" -> "12h". */
function horaCurta(valor) {
    const [h, m] = String(valor || '').split(':');
    if (!h) return valor;
    return m && m !== '00' ? `${h}h${m}` : `${h}h`;
}

/**
 * Panorama do expediente.
 *
 * Responde a uma pergunta de gestão, não de mérito: quantas sessões couberam
 * na janela de expediente do órgão, quantas a extrapolaram, quantas começaram
 * antes da abertura e quantas ocorreram em dia sem expediente — fim de semana,
 * feriado nacional ou data que o órgão marcou. É o insumo de escala, de
 * sobreaviso e de dimensionamento do plenário.
 *
 * A janela, os dias e os feriados vêm de Painel Administrativo → Jurimetria →
 * Expediente. Os júris sem horário ficam fora do denominador dos percentuais:
 * incluí-los faria o índice de "dentro do expediente" cair quando o problema é
 * de preenchimento, não de pauta.
 */
export default function JurimetriaExpedienteReport({
    juris, settings, analysis, subtitle = '', organizationId,
}) {
    const [agrupador, setAgrupador] = useState('comarca');
    const dados = useMemo(
        () => computeExpediente(juris, agrupador, settings, analysis),
        [juris, agrupador, settings, analysis]
    );
    const pager = usePagedRows(dados.linhas, { scope: 'rel_expediente', organizationId });

    const dimLabel = JURIMETRIA_AGRUPADORES_DURACAO.find((a) => a.key === agrupador)?.label || 'Agrupamento';
    const janela = `${horaCurta(dados.expediente.inicio)} às ${horaCurta(dados.expediente.fim)}`;

    const colunas = [
        { label: dimLabel, value: (r) => r.chave },
        { label: 'Júris', value: (r) => r.total },
        { label: 'Dentro do expediente', value: (r) => r.dentro },
        { label: 'Prolongaram', value: (r) => r.prolongou },
        { label: 'Iniciaram antes', value: (r) => r.antecipou },
        { label: 'Dia sem expediente', value: (r) => r.sem_expediente },
        { label: 'Sem horário', value: (r) => r.sem_horario },
        { label: '% dentro do expediente', value: (r) => formatPercent(r.pctDentro) },
        { label: '% que prolongaram', value: (r) => formatPercent(r.pctProlongou) },
    ];

    const grafico = useMemo(
        () => JURIMETRIA_EXPEDIENTE_SITUACOES
            .map((s) => ({ name: s.label, value: dados[s.value] || 0, fill: s.chart }))
            .filter((d) => d.value > 0),
        [dados]
    );

    const cartoes = [
        { key: 'dentro', hint: `Começaram e terminaram entre ${janela}.` },
        { key: 'prolongou', hint: `Terminaram depois das ${horaCurta(dados.expediente.fim)}.` },
        { key: 'antecipou', hint: `Começaram antes das ${horaCurta(dados.expediente.inicio)}.` },
        { key: 'sem_expediente', hint: 'Fim de semana, feriado ou data sem expediente.' },
    ];

    return (
        <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-slate-400" />
                            Panorama de expediente
                        </CardTitle>
                        <CardDescription>
                            Quantas sessões couberam no expediente do órgão ({janela}) e quantas o
                            extrapolaram, começaram antes ou ocorreram em dia sem expediente. A janela, os
                            dias e os feriados são configurados em Painel Administrativo → Jurimetria →
                            Expediente.
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
                            filenameBase={`jurimetria-expediente-${agrupador}`}
                            title={`Expediente por ${dimLabel.toLowerCase()}`}
                            subtitle={subtitle}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {cartoes.map(({ key, hint }) => {
                        const meta = expedienteMeta(key);
                        const quantidade = dados[key] || 0;
                        const pct = dados.classificados ? quantidade / dados.classificados : null;
                        return (
                            <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <Badge className={`${meta.badge} border-0 text-[11px] font-medium`}>
                                    {meta.label}
                                </Badge>
                                <p className="text-2xl font-bold tabular-nums mt-1">{formatNumber(quantidade)}</p>
                                <p className="text-xs text-slate-400">{formatPercent(pct)} das classificadas</p>
                                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{hint}</p>
                            </div>
                        );
                    })}
                </div>

                {dados.prolongou > 0 && (
                    <Alert>
                        <AlarmClock className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                            As {formatNumber(dados.prolongou)} sessões que passaram das{' '}
                            {horaCurta(dados.expediente.fim)} somaram{' '}
                            <strong>{formatDuracao(dados.minutosExcedentes)}</strong> além do expediente —
                            média de {formatDuracao(dados.mediaExcedente)} por sessão.
                            {dados.maiorExcedente && (
                                <> A maior delas passou {formatDuracao(dados.maiorExcedente.minutos)} do
                                horário, no processo{' '}
                                <span className="font-mono">{dados.maiorExcedente.numero_processo}</span>
                                {dados.maiorExcedente.data_juri
                                    ? ` (${formatDateBR(dados.maiorExcedente.data_juri)})`
                                    : ''}.</>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {dados.sem_horario > 0 && (
                    <Alert>
                        <Info className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                            {formatNumber(dados.sem_horario)} júri(s) não puderam ser classificados por falta do
                            horário de início ou de conclusão. Eles ficam fora do denominador dos percentuais
                            acima — incluí-los faria o índice cair por um problema de preenchimento, não de pauta.
                        </AlertDescription>
                    </Alert>
                )}

                {grafico.length > 1 && (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={grafico}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={82}
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {grafico.map((entry) => (
                                        <Cell key={entry.name} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value, name) => [formatNumber(value), name]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[180px]">{dimLabel}</TableHead>
                                <TableHead className="text-right w-20">Júris</TableHead>
                                <TableHead className="text-right w-24">Dentro</TableHead>
                                <TableHead className="text-right w-28">Prolongou</TableHead>
                                <TableHead className="text-right w-28">Antes</TableHead>
                                <TableHead className="text-right w-32">Sem expediente</TableHead>
                                <TableHead className="text-right w-28">Sem horário</TableHead>
                                <TableHead className="text-right w-28">% dentro</TableHead>
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
                                    <TableCell className="text-right tabular-nums">{formatNumber(linha.dentro)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                                        {formatNumber(linha.prolongou)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-sky-600 dark:text-sky-400">
                                        {formatNumber(linha.antecipou)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-violet-600 dark:text-violet-400">
                                        {formatNumber(linha.sem_expediente)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-slate-400">
                                        {formatNumber(linha.sem_horario)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                        {formatPercent(linha.pctDentro)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <JurimetriaPagination pager={pager} label={dimLabel.toLowerCase()} />
            </CardContent>
        </Card>
    );
}
