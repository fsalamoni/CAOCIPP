import React, { useEffect, useMemo, useState } from 'react';
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
import EmptyState from '@/components/ui/EmptyState';
import { BarChart3, AlarmClock, GitBranch, Layers, Info } from 'lucide-react';
// Menu de exportação genérico (recebe linhas + definição de colunas). Nasceu na
// Jurimetria, mas não conhece nada daquele domínio — por isso serve aqui igual.
import JurimetriaExportMenu from '../jurimetria/JurimetriaExportMenu';
import JurimetriaPagination, { usePagedRows } from '../jurimetria/JurimetriaPagination';
import {
    computeTotais, computeDistribuicao, computeSerieMensal, computePrescricao,
    computeGargalos, computeConcentracao, dimensionLabel,
    formatNumber, formatPercent, formatMoeda, formatDateBR, faixaAproveitamento,
} from '@/lib/panoramaEngine';
import {
    columnForRole, dimensoesDaBase, faixaPrescricaoMeta,
    PANORAMA_FAIXAS_PRESCRICAO,
} from '@/constants/panorama';
import PanoramaBadge from './PanoramaBadge';

function AproveitamentoBadge({ ratio }) {
    const faixa = faixaAproveitamento(ratio);
    if (!faixa) return <span className="text-slate-400 text-sm">—</span>;
    return (
        <Badge className={`${faixa.badge} border-0 font-semibold tabular-nums`}>
            {formatPercent(ratio)}
        </Badge>
    );
}

/**
 * Relatórios do Panorama.
 *
 * O relatório principal é REAGRUPÁVEL: a mesma base lida por território conta
 * uma história, lida por assunto conta outra. Em vez de fixar seis relatórios,
 * o módulo oferece um que o usuário reorienta — é o que permite atender
 * qualquer área sem prever de antemão o que cada CAO quer ver.
 *
 * Os demais blocos (prescrição, gargalos, concentração) só aparecem quando o
 * papel que os alimenta foi mapeado.
 */
export default function PanoramaReports({
    registros, base, analysis, subtitle = '', organizationId,
}) {
    const dimensoes = useMemo(() => dimensoesDaBase(base), [base]);
    const agrupadorPadrao = columnForRole(base, 'unidade')?.key || dimensoes[0]?.key || '';
    const [agrupador, setAgrupador] = useState(agrupadorPadrao);

    // Trocar de base (ou o admin remover a coluna que estava agrupando) deixaria
    // o agrupador apontando para uma dimensão que não existe mais — e a tabela
    // colapsaria numa única linha "(não informado)". Volta para o padrão.
    useEffect(() => {
        if (agrupador && dimensoes.some((d) => d.key === agrupador)) return;
        setAgrupador(agrupadorPadrao);
    }, [dimensoes, agrupador, agrupadorPadrao]);

    const totais = useMemo(() => computeTotais(registros, base, analysis), [registros, base, analysis]);
    const distribuicao = useMemo(
        () => (agrupador ? computeDistribuicao(registros, agrupador, base, analysis) : null),
        [registros, agrupador, base, analysis]
    );
    const serie = useMemo(() => computeSerieMensal(registros, base, analysis), [registros, base, analysis]);
    const concentracao = useMemo(
        () => (agrupador ? computeConcentracao(registros, agrupador, base, analysis) : null),
        [registros, agrupador, base, analysis]
    );

    const temDesfecho = Boolean(columnForRole(base, 'desfecho'));
    const temValor = Boolean(columnForRole(base, 'valor'));
    const temPrescricao = (base?.prescricao?.modo || 'desligado') !== 'desligado';
    const temSituacao = Boolean(columnForRole(base, 'situacao'));

    const prescricao = useMemo(
        () => (temPrescricao ? computePrescricao(registros, base, analysis) : null),
        [registros, base, analysis, temPrescricao]
    );
    const gargalos = useMemo(
        () => (temSituacao ? computeGargalos(registros, base, analysis) : null),
        [registros, base, analysis, temSituacao]
    );

    const dimLabel = dimensionLabel(agrupador, base);
    const distPager = usePagedRows(distribuicao?.linhas || [], {
        scope: `pan_dist_${agrupador}`, organizationId,
    });
    const seriePager = usePagedRows(serie, { scope: 'pan_serie', organizationId });
    const prescPager = usePagedRows(prescricao?.urgentes || [], {
        scope: 'pan_presc', organizationId,
    });

    const distColunas = [
        { label: dimLabel, value: (r) => r.chave },
        { label: 'Registros', value: (r) => r.quantidade },
        { label: '% do total', value: (r) => formatPercent(r.percentual) },
        ...(temDesfecho ? [
            { label: 'Computados', value: (r) => r.efetivos },
            { label: 'Sem mérito', value: (r) => r.neutros },
            { label: 'Aproveitamento', value: (r) => formatPercent(r.aproveitamento) },
        ] : []),
        ...(temValor ? [
            { label: 'Valor total', value: (r) => formatMoeda(r.valorTotal) },
            { label: 'Valor médio', value: (r) => formatMoeda(r.valorMedio) },
        ] : []),
    ];

    const serieColunas = [
        { label: 'Mês', value: (r) => r.labelCompleto },
        { label: 'Registros', value: (r) => r.quantidade },
        ...(temDesfecho ? [{ label: 'Aproveitamento', value: (r) => formatPercent(r.aproveitamento) }] : []),
        ...(temValor ? [{ label: 'Valor total', value: (r) => formatMoeda(r.valorTotal) }] : []),
    ];

    const prescColunas = [
        { label: 'Identificador', value: (r) => r.identificador },
        { label: 'Situação', value: (r) => faixaPrescricaoMeta(r.faixa).label },
        { label: 'Data-limite', value: (r) => formatDateBR(r.limite) },
        { label: 'Dias restantes', value: (r) => r.dias },
        { label: 'Unidade', value: (r) => r.unidade },
        { label: 'Assunto', value: (r) => r.assunto },
        { label: 'Responsável', value: (r) => r.responsavel },
    ];

    if (!registros || registros.length === 0) {
        return (
            <EmptyState
                icon={BarChart3}
                title="Sem dados para relatar"
                description="Os relatórios refletem os filtros aplicados. Ajuste os filtros ou importe registros para começar."
            />
        );
    }

    return (
        <div className="space-y-5">
            {/* Totais */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Totais do recorte</CardTitle>
                    <CardDescription>Base de todos os demais relatórios desta aba.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Registros</p>
                            <p className="text-2xl font-bold">{formatNumber(totais.quantidade)}</p>
                        </div>
                        {temDesfecho && (
                            <>
                                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Computados</p>
                                    <p className="text-2xl font-bold">{formatNumber(totais.efetivos)}</p>
                                    <p className="text-xs text-slate-400">{formatPercent(totais.pctEfetivos)} do total</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Sem mérito</p>
                                    <p className="text-2xl font-bold">{formatNumber(totais.neutros)}</p>
                                    <p className="text-xs text-slate-400">{formatPercent(totais.pctNeutros)} do total</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Aproveitamento</p>
                                    <p className="text-2xl font-bold">{formatPercent(totais.aproveitamento)}</p>
                                    <p className="text-xs text-slate-400">{formatNumber(totais.pontos, 2)} pontos</p>
                                </div>
                            </>
                        )}
                        {temValor && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Valor total</p>
                                <p className="text-2xl font-bold">{formatMoeda(totais.valorTotal)}</p>
                                <p className="text-xs text-slate-400">
                                    média {formatMoeda(totais.valorMedio)} em {formatNumber(totais.comValor)}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Distribuição reagrupável */}
            {distribuicao && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-slate-400" />
                                    Distribuição por {dimLabel.toLowerCase()}
                                </CardTitle>
                                <CardDescription>
                                    A mesma base lida por ângulos diferentes conta histórias diferentes —
                                    troque o agrupamento ao lado para reorientar o relatório inteiro.
                                </CardDescription>
                            </div>
                            <div className="flex items-end gap-2 shrink-0">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Agrupar por</Label>
                                    <Select value={agrupador} onValueChange={setAgrupador}>
                                        <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {dimensoes.map((d) => (
                                                <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <JurimetriaExportMenu
                                    rows={distribuicao.linhas}
                                    columns={distColunas}
                                    filenameBase={`panorama-${agrupador}`}
                                    title={`Distribuição por ${dimLabel.toLowerCase()}`}
                                    subtitle={subtitle}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {concentracao && concentracao.grupos > 2 && (
                            <Alert>
                                <Info className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    Distribuição <strong>{concentracao.leitura}</strong>:{' '}
                                    {formatNumber(concentracao.paraMetade)} de{' '}
                                    {formatNumber(concentracao.grupos)} respondem pela metade do volume;
                                    as três maiores, por {formatPercent(concentracao.pctTop3)}.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[180px]">{dimLabel}</TableHead>
                                        <TableHead className="text-right w-24">Registros</TableHead>
                                        <TableHead className="text-right w-24">% do total</TableHead>
                                        {temDesfecho && <TableHead className="text-right w-28">Computados</TableHead>}
                                        {temDesfecho && <TableHead className="text-right w-32">Aproveitamento</TableHead>}
                                        {temValor && <TableHead className="text-right w-36">Valor total</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {distPager.pageRows.map((linha) => (
                                        <TableRow key={linha.chave}>
                                            <TableCell className="text-sm">
                                                <span className="block max-w-[280px] truncate" title={linha.chave}>
                                                    {linha.chave}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-semibold">
                                                {formatNumber(linha.quantidade)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {formatPercent(linha.percentual)}
                                            </TableCell>
                                            {temDesfecho && (
                                                <TableCell className="text-right tabular-nums">
                                                    {formatNumber(linha.efetivos)}
                                                </TableCell>
                                            )}
                                            {temDesfecho && (
                                                <TableCell className="text-right">
                                                    <AproveitamentoBadge ratio={linha.aproveitamento} />
                                                </TableCell>
                                            )}
                                            {temValor && (
                                                <TableCell className="text-right tabular-nums text-slate-500">
                                                    {formatMoeda(linha.valorTotal)}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <JurimetriaPagination pager={distPager} label={dimLabel.toLowerCase()} />
                    </CardContent>
                </Card>
            )}

            {/* Série mensal */}
            {serie.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-base">Evolução mensal</CardTitle>
                                <CardDescription>
                                    Distribuição cronológica pela{' '}
                                    {columnForRole(base, 'data_principal')?.label?.toLowerCase() || 'data principal'}.
                                </CardDescription>
                            </div>
                            <JurimetriaExportMenu
                                rows={serie}
                                columns={serieColunas}
                                filenameBase="panorama-mensal"
                                title="Evolução mensal"
                                subtitle={subtitle}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mês</TableHead>
                                    <TableHead className="text-right w-28">Registros</TableHead>
                                    {temDesfecho && <TableHead className="text-right w-32">Aproveitamento</TableHead>}
                                    {temValor && <TableHead className="text-right w-36">Valor total</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {seriePager.pageRows.map((mes) => (
                                    <TableRow key={mes.chave}>
                                        <TableCell className="text-sm">{mes.labelCompleto}</TableCell>
                                        <TableCell className="text-right tabular-nums font-medium">
                                            {formatNumber(mes.quantidade)}
                                        </TableCell>
                                        {temDesfecho && (
                                            <TableCell className="text-right">
                                                <AproveitamentoBadge ratio={mes.aproveitamento} />
                                            </TableCell>
                                        )}
                                        {temValor && (
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {formatMoeda(mes.valorTotal)}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <JurimetriaPagination pager={seriePager} label="meses" />
                    </CardContent>
                </Card>
            )}

            {/* Prescrição */}
            {temPrescricao && prescricao.comPrazo > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlarmClock className="w-4 h-4 text-slate-400" />
                                    Prescrição
                                </CardTitle>
                                <CardDescription>
                                    {formatNumber(prescricao.comPrazo)} registro(s) com prazo apurável, do
                                    mais urgente para o menos.
                                    {prescricao.semPrazo > 0 && ` ${formatNumber(prescricao.semPrazo)} ficaram de fora por falta da data-base.`}
                                </CardDescription>
                            </div>
                            <JurimetriaExportMenu
                                rows={prescricao.urgentes}
                                columns={prescColunas}
                                filenameBase="panorama-prescricao"
                                title="Panorama de prescrição"
                                subtitle={subtitle}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {PANORAMA_FAIXAS_PRESCRICAO.filter((f) => f.key !== 'sem_prazo').map((f) => (
                                <div key={f.key} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <Badge className={`${f.badge} border-0 text-[11px] font-medium`}>{f.label}</Badge>
                                    <p className="text-2xl font-bold tabular-nums mt-1">
                                        {formatNumber(prescricao.contagem[f.key] || 0)}
                                    </p>
                                    <p className="text-xs text-slate-400">{formatPercent(prescricao.pct[f.key])}</p>
                                </div>
                            ))}
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-32">Situação</TableHead>
                                        <TableHead>Identificador</TableHead>
                                        <TableHead className="w-28">Vence em</TableHead>
                                        <TableHead className="text-right w-28">Dias</TableHead>
                                        <TableHead>Unidade</TableHead>
                                        <TableHead>Assunto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {prescPager.pageRows.map((r) => {
                                        const meta = faixaPrescricaoMeta(r.faixa);
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <Badge className={`${meta.badge} border-0 text-[11px]`}>{meta.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono">{r.identificador || '—'}</TableCell>
                                                <TableCell className="text-xs tabular-nums">{formatDateBR(r.limite)}</TableCell>
                                                <TableCell className="text-right text-xs tabular-nums">
                                                    {r.dias < 0 ? `−${formatNumber(Math.abs(r.dias))}` : formatNumber(r.dias)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className="block max-w-[180px] truncate">{r.unidade || '—'}</span>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className="block max-w-[200px] truncate">{r.assunto || '—'}</span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <JurimetriaPagination pager={prescPager} label="registros" />
                    </CardContent>
                </Card>
            )}

            {/* Gargalos */}
            {gargalos?.disponivel && gargalos.linhas.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="min-w-0">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <GitBranch className="w-4 h-4 text-slate-400" />
                                    Gargalos de tramitação
                                </CardTitle>
                                <CardDescription>
                                    Quantos registros estão em cada{' '}
                                    {columnForRole(base, 'situacao').label.toLowerCase()}
                                    {gargalos.temIdade ? ', e há quanto tempo' : ''}. Onde a mediana é alta,
                                    o acúmulo não é de volume, é de tempo parado.
                                </CardDescription>
                            </div>
                            <JurimetriaExportMenu
                                rows={gargalos.linhas}
                                columns={[
                                    { label: 'Situação', value: (r) => r.situacao },
                                    { label: 'Registros', value: (r) => r.quantidade },
                                    { label: '% do total', value: (r) => formatPercent(r.percentual) },
                                    { label: 'Idade média (dias)', value: (r) => (r.idadeMedia === null ? '' : Math.round(r.idadeMedia)) },
                                    { label: 'Idade mediana (dias)', value: (r) => (r.idadeMediana === null ? '' : Math.round(r.idadeMediana)) },
                                    { label: 'Mais antigo (dias)', value: (r) => (r.maisAntigo === null ? '' : r.maisAntigo) },
                                ]}
                                filenameBase="panorama-gargalos"
                                title="Gargalos de tramitação"
                                subtitle={subtitle}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Situação</TableHead>
                                    <TableHead className="text-right w-28">Registros</TableHead>
                                    <TableHead className="text-right w-24">%</TableHead>
                                    {gargalos.temIdade && <TableHead className="text-right w-32">Idade média</TableHead>}
                                    {gargalos.temIdade && <TableHead className="text-right w-32">Mediana</TableHead>}
                                    {gargalos.temIdade && <TableHead className="text-right w-32">Mais antigo</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gargalos.linhas.map((l) => (
                                    <TableRow key={l.situacao}>
                                        <TableCell className="text-sm">{l.situacao}</TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">
                                            {formatNumber(l.quantidade)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-slate-500">
                                            {formatPercent(l.percentual)}
                                        </TableCell>
                                        {gargalos.temIdade && (
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {l.idadeMedia === null ? '—' : `${formatNumber(Math.round(l.idadeMedia))} dias`}
                                            </TableCell>
                                        )}
                                        {gargalos.temIdade && (
                                            <TableCell className="text-right tabular-nums">
                                                {l.idadeMediana === null ? '—' : `${formatNumber(Math.round(l.idadeMediana))} dias`}
                                            </TableCell>
                                        )}
                                        {gargalos.temIdade && (
                                            <TableCell className="text-right tabular-nums text-slate-400">
                                                {l.maisAntigo === null ? '—' : `${formatNumber(l.maisAntigo)} dias`}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Desfechos com as cores configuradas */}
            {temDesfecho && (
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                            {columnForRole(base, 'desfecho').label}
                        </CardTitle>
                        <CardDescription>
                            Com os pesos e as cores definidos em Painel Administrativo → Panorama.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Desfecho</TableHead>
                                    <TableHead className="text-right w-28">Registros</TableHead>
                                    <TableHead className="text-right w-24">%</TableHead>
                                    <TableHead className="text-right w-20">Peso</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {computeDistribuicao(registros, columnForRole(base, 'desfecho').key, base, analysis)
                                    .linhas.map((linha) => (
                                        <TableRow key={linha.chave}>
                                            <TableCell>
                                                <PanoramaBadge valor={linha.chave} base={base} />
                                                {(base?.desfechos?.neutros || []).includes(linha.chave) && (
                                                    <span className="text-[11px] text-slate-400 ml-2">sem mérito</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">
                                                {formatNumber(linha.quantidade)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-500">
                                                {formatPercent(linha.percentual)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-slate-400">
                                                {base?.desfechos?.pesos?.[linha.chave] ?? 0}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
