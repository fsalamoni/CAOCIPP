import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/ui/EmptyState';
import { Scale, Gavel, MapPin, Users, CalendarRange } from 'lucide-react';
import JurimetriaExportMenu from './JurimetriaExportMenu';
import {
    computeTotais, computeEspecies, computeMaterias, computeRanking,
    computeSerieMensal, formatNumber, formatPercent, faixaAproveitamento,
} from '@/lib/jurimetriaEngine';

/** Abrevia o nome de uma espécie para caber no cabeçalho das tabelas largas. */
function abbreviate(especie) {
    return String(especie)
        .replace('PARCIAL PROCEDÊNCIA', 'PARCIAL')
        .replace('IMPROCEDÊNCIA', 'IMPROC.')
        .replace('DESCLASSIFICAÇÃO', 'DESCL.')
        .replace('PROCEDÊNCIA', 'PROC.')
        .replace('(QUALIFICADORA)', '(QUAL.)')
        .replace('DISSOLUÇÃO', 'DISS.');
}

function AproveitamentoBadge({ ratio }) {
    const faixa = faixaAproveitamento(ratio);
    if (!faixa) return <span className="text-slate-400">—</span>;
    return (
        <Badge className={`${faixa.badge} border-0 font-semibold tabular-nums`}>
            {formatPercent(ratio)}
        </Badge>
    );
}

/** Seção de relatório com título, descrição e menu de exportação próprio. */
function ReportSection({ icon: Icon, title, description, rows, columns, filenameBase, subtitle, children }) {
    return (
        <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Icon className="w-4 h-4 text-slate-400" />
                            {title}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <JurimetriaExportMenu
                        rows={rows}
                        columns={columns}
                        filenameBase={filenameBase}
                        title={title}
                        subtitle={subtitle}
                    />
                </div>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

/**
 * Relatórios estáticos: as quatro visões consagradas do CAOJúri — totais e
 * dissoluções, espécies de resultado, matérias e rankings por comarca e por
 * promotor —, cada uma exportável em seis formatos.
 */
export default function JurimetriaReports({ juris, settings, subtitle = '' }) {
    const totais = useMemo(() => computeTotais(juris, settings), [juris, settings]);
    const especies = useMemo(() => computeEspecies(juris, settings), [juris, settings]);
    const materias = useMemo(() => computeMaterias(juris, settings), [juris, settings]);
    const comarcas = useMemo(() => computeRanking(juris, 'comarca', settings), [juris, settings]);
    const promotores = useMemo(() => computeRanking(juris, 'promotor', settings), [juris, settings]);
    const serie = useMemo(() => computeSerieMensal(juris, settings), [juris, settings]);

    // Colunas para exportação — sempre texto puro, nunca JSX.
    const especiesColumns = [
        { label: 'Espécie de resultado', value: (r) => r.especie },
        { label: 'Quantidade', value: (r) => r.quantidade },
        { label: '% sobre efetivos', value: (r) => formatPercent(r.percentual) },
        { label: 'Peso', value: (r) => r.peso },
    ];

    const materiasColumns = [
        { label: 'Matéria / Tipo', value: (r) => r.label },
        { label: 'Júris', value: (r) => r.total },
        { label: '% sobre efetivos', value: (r) => formatPercent(r.percentual) },
        { label: 'Aproveitamento', value: (r) => formatPercent(r.aproveitamento) },
        { label: 'Espécies', value: (r) => r.porEspecie.map((e) => `${e.especie}: ${e.quantidade}`).join(' | ') },
    ];

    const rankingColumns = (dimLabel, especiesList) => [
        { label: dimLabel, value: (r) => r.chave },
        { label: 'Total', value: (r) => r.total },
        { label: 'Efetivos', value: (r) => r.efetivos },
        { label: 'Dissoluções', value: (r) => r.dissolucoes },
        ...especiesList.map((especie) => ({
            label: abbreviate(especie),
            value: (r) => r.porEspecie[especie] || 0,
        })),
        { label: 'Pontos', value: (r) => Number(r.pontos.toFixed(2)) },
        { label: 'Aproveitamento', value: (r) => formatPercent(r.aproveitamento) },
    ];

    const serieColumns = [
        { label: 'Mês', value: (r) => r.labelCompleto },
        { label: 'Total', value: (r) => r.total },
        { label: 'Efetivos', value: (r) => r.efetivos },
        { label: 'Dissoluções', value: (r) => r.dissolucoes },
        { label: 'Aproveitamento', value: (r) => formatPercent(r.aproveitamento) },
    ];

    if (!juris || juris.length === 0) {
        return (
            <EmptyState
                icon={Scale}
                title="Sem dados para relatar"
                description="Os relatórios refletem os filtros aplicados. Ajuste os filtros ou importe júris para começar."
            />
        );
    }

    return (
        <div className="space-y-5">
            {/* Totais e dissoluções */}
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Scale className="w-4 h-4 text-slate-400" />
                        Total e dissoluções
                    </CardTitle>
                    <CardDescription>
                        Base de todos os demais relatórios. Os júris dissolvidos entram no total, mas são
                        excluídos do cálculo de espécies, matérias e aproveitamento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Total de júris</p>
                            <p className="text-2xl font-bold">{formatNumber(totais.total)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Efetivos (julgados)</p>
                            <p className="text-2xl font-bold">{formatNumber(totais.efetivos)}</p>
                            <p className="text-xs text-slate-400">{formatPercent(totais.pctEfetivos)} do total</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Dissolvidos</p>
                            <p className="text-2xl font-bold">{formatNumber(totais.dissolvidos)}</p>
                            <p className="text-xs text-slate-400">{formatPercent(totais.pctDissolvidos)} do total</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Aproveitamento</p>
                            <p className="text-2xl font-bold">{formatPercent(totais.aproveitamento)}</p>
                            <p className="text-xs text-slate-400">{formatNumber(totais.pontos, 2)} pontos</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Espécies */}
            <ReportSection
                icon={Gavel}
                title="Resultados por espécie"
                description={`Percentuais calculados sobre os ${formatNumber(especies.totalEfetivos)} júris efetivos.`}
                rows={especies.linhas}
                columns={especiesColumns}
                filenameBase="jurimetria-especies"
                subtitle={subtitle}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Espécie de resultado</TableHead>
                            <TableHead className="text-right w-28">Quantidade</TableHead>
                            <TableHead className="text-right w-36">% sobre efetivos</TableHead>
                            <TableHead className="text-right w-20">Peso</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {especies.linhas.map((linha) => (
                            <TableRow key={linha.especie}>
                                <TableCell className="text-sm">{linha.especie}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                    {formatNumber(linha.quantidade)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-slate-500">
                                    {formatPercent(linha.percentual)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-slate-400">{linha.peso}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                            <TableCell>Total de efetivos</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(especies.totalEfetivos)}</TableCell>
                            <TableCell className="text-right tabular-nums">100,0%</TableCell>
                            <TableCell />
                        </TableRow>
                        <TableRow className="text-slate-500">
                            <TableCell className="text-sm italic">
                                Dissoluções (fora do cálculo acima)
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(especies.dissolucoes)}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                                {formatPercent(especies.totalGeral ? especies.dissolucoes / especies.totalGeral : null)} do total
                            </TableCell>
                            <TableCell />
                        </TableRow>
                    </TableBody>
                </Table>
            </ReportSection>

            {/* Matérias */}
            <ReportSection
                icon={Gavel}
                title="Matérias / Tipos de júri"
                description="Distribuição por matéria, com a composição de espécies de cada uma."
                rows={materias.linhas}
                columns={materiasColumns}
                filenameBase="jurimetria-materias"
                subtitle={subtitle}
            >
                <div className="space-y-3">
                    {materias.linhas.map((linha) => (
                        <div
                            key={linha.sigla}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {linha.label}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatNumber(linha.total)} júri(s) — {formatPercent(linha.percentual)} dos efetivos
                                    </p>
                                </div>
                                <AproveitamentoBadge ratio={linha.aproveitamento} />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {linha.porEspecie.map((especie) => (
                                    <Badge
                                        key={especie.especie}
                                        variant="outline"
                                        className="text-[11px] font-normal"
                                    >
                                        {abbreviate(especie.especie)}: <strong className="ml-1">{especie.quantidade}</strong>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ReportSection>

            {/* Ranking de comarcas */}
            <ReportSection
                icon={MapPin}
                title="Ranking de comarcas"
                description="Todas as comarcas do recorte, ordenadas por volume, com o aproveitamento ponderado."
                rows={comarcas.linhas}
                columns={rankingColumns('Comarca', comarcas.especies)}
                filenameBase="jurimetria-comarcas"
                subtitle={subtitle}
            >
                <RankingTable ranking={comarcas} dimLabel="Comarca" />
            </ReportSection>

            {/* Atuação por promotor */}
            <ReportSection
                icon={Users}
                title="Atuação por promotor(a)"
                description="Mesma estrutura do ranking de comarcas, agrupada pelo promotor que atuou na sessão."
                rows={promotores.linhas}
                columns={rankingColumns('Promotor(a)', promotores.especies)}
                filenameBase="jurimetria-promotores"
                subtitle={subtitle}
            >
                <RankingTable ranking={promotores} dimLabel="Promotor(a)" />
            </ReportSection>

            {/* Série mensal */}
            <ReportSection
                icon={CalendarRange}
                title="Júris por mês"
                description="Evolução cronológica do recorte, com efetivos, dissoluções e aproveitamento."
                rows={serie}
                columns={serieColumns}
                filenameBase="jurimetria-mensal"
                subtitle={subtitle}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mês</TableHead>
                            <TableHead className="text-right w-24">Total</TableHead>
                            <TableHead className="text-right w-24">Efetivos</TableHead>
                            <TableHead className="text-right w-28">Dissoluções</TableHead>
                            <TableHead className="text-right w-36">Aproveitamento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {serie.map((mes) => (
                            <TableRow key={mes.chave}>
                                <TableCell className="text-sm">{mes.labelCompleto}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{formatNumber(mes.total)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatNumber(mes.efetivos)}</TableCell>
                                <TableCell className="text-right tabular-nums text-slate-500">{formatNumber(mes.dissolucoes)}</TableCell>
                                <TableCell className="text-right"><AproveitamentoBadge ratio={mes.aproveitamento} /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ReportSection>
        </div>
    );
}

function RankingTable({ ranking, dimLabel }) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[180px]">{dimLabel}</TableHead>
                        <TableHead className="text-right w-20">Total</TableHead>
                        <TableHead className="text-right w-20">Efet.</TableHead>
                        <TableHead className="text-right w-20">Diss.</TableHead>
                        {ranking.especies.map((especie) => (
                            <TableHead key={especie} className="text-right whitespace-nowrap text-[11px]" title={especie}>
                                {abbreviate(especie)}
                            </TableHead>
                        ))}
                        <TableHead className="text-right w-32">Aproveitamento</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ranking.linhas.map((linha) => (
                        <TableRow key={linha.chave}>
                            <TableCell className="text-sm">
                                <span className="block max-w-[260px] truncate" title={linha.chave}>{linha.chave}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{formatNumber(linha.total)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(linha.efetivos)}</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-400">{formatNumber(linha.dissolucoes)}</TableCell>
                            {ranking.especies.map((especie) => (
                                <TableCell key={especie} className="text-right tabular-nums text-slate-500 text-[13px]">
                                    {linha.porEspecie[especie] || 0}
                                </TableCell>
                            ))}
                            <TableCell className="text-right"><AproveitamentoBadge ratio={linha.aproveitamento} /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
