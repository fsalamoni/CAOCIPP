import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, Circle, Download, FileSpreadsheet, Loader2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secProcesso } from '@/services/secretariaService';
import { COLUNAS_RELATORIO, br, juntarNomes, passosDoColegiado } from '@/lib/sessoes';
import { exportTableToCsv, exportTableToExcel } from '@/lib/jurimetriaExport';
import ErroQuery from './ErroQuery';

const sel = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const caixa = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3';

/**
 * S15: passo a passo para a secretaria pôr o colegiado a funcionar, conferido
 * com o que já existe. Aberto enquanto falta algo; fechado quando tudo está pronto.
 */
export function GuiaColegiado({ colegiado, sessoes }) {
    const passos = passosDoColegiado(colegiado, sessoes);
    const feitos = passos.filter((p) => p.feito).length;
    const pronto = feitos === passos.length;
    return (
        <details open={!pronto} className={`${caixa} group`} aria-label={`Guia do colegiado ${colegiado.nome}`}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                {pronto ? `${colegiado.nome}: colegiado em funcionamento` : `Guia para montar o ${colegiado.nome} (${feitos} de ${passos.length})`}
            </summary>
            <ol className="mt-3 space-y-2">
                {passos.map((p, i) => (
                    <li key={p.id} className="flex gap-2 text-sm">
                        {p.feito
                            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Feito" />
                            : <Circle className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-label="A fazer" />}
                        <span>
                            <span className={`font-medium ${p.feito ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{i + 1}. {p.titulo}</span>
                            {!p.feito && <span className="block text-slate-600 dark:text-slate-400">{p.ajuda}</span>}
                        </span>
                    </li>
                ))}
            </ol>
        </details>
    );
}

const Numero = ({ rotulo, valor, alerta }) => (
    <div className="min-w-[7rem]">
        <dt className="text-xs text-slate-600 dark:text-slate-400">{rotulo}</dt>
        <dd className={`text-xl font-semibold ${alerta ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-white'}`}>{valor}</dd>
    </div>
);

const Bloco = ({ titulo, children }) => (
    <section className={`${caixa} space-y-2`} aria-label={titulo}>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h4>
        {children}
    </section>
);

const Contagem = ({ pares, vazio }) => (pares.length
    ? <ul className="text-sm space-y-0.5">{pares.map(([k, n]) => <li key={k} className="flex justify-between gap-3"><span className="text-slate-800 dark:text-slate-200">{k}</span><span className="font-semibold tabular-nums">{n}</span></li>)}</ul>
    : <p className="text-sm text-slate-600 dark:text-slate-400">{vazio}</p>);

/**
 * S15: relatório do colegiado no período: sessões, julgados por resultado e
 * por relator, o que saiu da pauta, vistas em atraso e tempo até o acórdão,
 * com a lista dos julgados para baixar em CSV ou Excel.
 */
export default function RelatorioColegiado({ orgId, colegiados, hoje }) {
    const [orgaoId, setOrgaoId] = useState(colegiados[0]?.id || '');
    const [de, setDe] = useState(`${hoje.slice(0, 4)}-01-01`);
    const [ate, setAte] = useState(hoje);
    const [pedido, setPedido] = useState(null);
    const q = useQuery({
        queryKey: ['sec-sessao-relatorio', orgId, pedido],
        queryFn: () => secProcesso(orgId, 'sessaoRelatorio', pedido),
        enabled: !!pedido,
    });
    const r = q.data;
    const base = r ? `relatorio-${r.colegiado.sigla || r.colegiado.nome}-${r.de}-a-${r.ate}` : '';
    return (
        <details className="group" aria-label="Relatório do colegiado">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><BarChart3 className="w-4 h-4" aria-hidden /> Relatório do colegiado</summary>
            <div className="mt-3 space-y-3">
                <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setPedido({ orgao_id: orgaoId, de, ate }); }}>
                    {colegiados.length > 1 && (
                        <label className="text-sm space-y-1">
                            <span className="block text-slate-700 dark:text-slate-300">Colegiado</span>
                            <select id="rel-colegiado" value={orgaoId} onChange={(e) => setOrgaoId(e.target.value)} className={sel}>
                                {colegiados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </label>
                    )}
                    <label className="text-sm space-y-1"><span className="block text-slate-700 dark:text-slate-300">De</span><Input id="rel-de" type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} required /></label>
                    <label className="text-sm space-y-1"><span className="block text-slate-700 dark:text-slate-300">Até</span><Input id="rel-ate" type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} required /></label>
                    <Button type="submit" disabled={!orgaoId || q.isFetching} className="gap-2">{q.isFetching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <BarChart3 className="w-4 h-4" aria-hidden />} Gerar relatório</Button>
                </form>
                <p className="text-xs text-slate-600 dark:text-slate-400">Conta as sessões com data no período (até um ano). Vistas e acórdãos pendentes valem para hoje; o processo sob sigilo aparece só pelo número.</p>
                {q.error && <ErroQuery q={q} />}
                {r && (
                    <div className="space-y-3" id="rel-resultado">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{r.colegiado.nome}, de {br(r.de)} a {br(r.ate)}.</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <Bloco titulo="Sessões">
                                <dl className="flex flex-wrap gap-4">
                                    <Numero rotulo="Realizadas" valor={r.sessoes.realizadas} />
                                    <Numero rotulo="Por realizar" valor={r.sessoes.por_realizar} />
                                    <Numero rotulo="Canceladas" valor={r.sessoes.canceladas} />
                                    {r.sessoes.reunioes > 0 && <Numero rotulo="Reuniões" valor={r.sessoes.reunioes} />}
                                </dl>
                            </Bloco>
                            <Bloco titulo={`Processos julgados (${r.julgados.total})`}>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div><p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Por resultado</p><Contagem pares={r.julgados.por_resultado} vazio="Nenhum julgado." /></div>
                                    <div><p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Por relator</p><Contagem pares={r.julgados.por_relator} vazio="Nenhum julgado." /></div>
                                </div>
                            </Bloco>
                            <Bloco titulo="Pauta">
                                <dl className="flex flex-wrap gap-4">
                                    <Numero rotulo="Itens pautados" valor={r.pauta.pautados} />
                                    <Numero rotulo="Retirados" valor={r.pauta.retirados} />
                                    <Numero rotulo="Adiados" valor={r.pauta.adiados} />
                                    <Numero rotulo="Diligências" valor={r.pauta.diligencias} />
                                    <Numero rotulo="Destacados" valor={r.pauta.destacados} />
                                    <Numero rotulo="Pedidos de vista" valor={r.pauta.vistas} />
                                </dl>
                            </Bloco>
                            <Bloco titulo="Acórdãos">
                                <dl className="flex flex-wrap gap-4">
                                    <Numero rotulo="Juntados" valor={r.acordaos.juntados} />
                                    <Numero rotulo="Tempo médio" valor={r.acordaos.media_dias === null ? 'sem dado' : `${String(r.acordaos.media_dias).replace('.', ',')} ${r.acordaos.media_dias === 1 ? 'dia' : 'dias'}`} />
                                    <Numero rotulo="No prazo" valor={r.acordaos.juntados ? `${r.acordaos.no_prazo} de ${r.acordaos.juntados}` : '0'} />
                                    <Numero rotulo="Pendentes" valor={r.acordaos.pendentes} />
                                    <Numero rotulo="Atrasados" valor={r.acordaos.atrasados} alerta={r.acordaos.atrasados > 0} />
                                </dl>
                                {r.acordaos.lista_pendentes.length > 0 && (
                                    <ul className="text-sm space-y-0.5">{r.acordaos.lista_pendentes.map((a) => (
                                        <li key={a.processo_id}><span className="font-mono">{a.numero}</span> · {a.redator || 'sem redator'} · <span className={a.atrasado ? 'text-rose-700 dark:text-rose-300 font-semibold' : ''}>até {br(a.prazo)}{a.atrasado ? ' (vencido)' : ''}</span></li>
                                    ))}</ul>
                                )}
                            </Bloco>
                        </div>
                        <Bloco titulo={`Vistas em aberto (${r.vistas.abertas}${r.vistas.atrasadas ? `, ${r.vistas.atrasadas} em atraso` : ''})`}>
                            {r.vistas.lista.length ? (
                                <ul className="text-sm space-y-0.5">{r.vistas.lista.map((v) => (
                                    <li key={`${v.processo_id}-${v.sessao}`}><span className="font-mono">{v.numero}</span> · {juntarNomes(v.nomes)} · {v.sessao} · <span className={v.atrasada ? 'text-rose-700 dark:text-rose-300 font-semibold' : ''}>{v.prazo ? `até ${br(v.prazo)}` : 'sem prazo'}{v.atrasada ? ' (em atraso)' : ''}</span></li>
                                ))}</ul>
                            ) : <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma vista em aberto.</p>}
                        </Bloco>
                        <section className={`${caixa} space-y-2`} aria-label="Julgados no período">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Julgados no período</h4>
                                {r.linhas.length > 0 && (
                                    <span className="flex gap-2">
                                        <Button size="sm" variant="outline" className="gap-1" onClick={() => exportTableToCsv({ rows: r.linhas, columns: COLUNAS_RELATORIO, filenameBase: base })}><Download className="w-4 h-4" aria-hidden /> CSV</Button>
                                        <Button size="sm" variant="outline" className="gap-1" onClick={() => exportTableToExcel({ rows: r.linhas, columns: COLUNAS_RELATORIO, filenameBase: base, sheetName: 'Julgados' })}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Excel</Button>
                                    </span>
                                )}
                            </div>
                            {r.linhas.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-xs text-slate-600 dark:text-slate-400">{['Sessão', 'Processo', 'Relator', 'Resultado', 'Acórdão'].map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr></thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {r.linhas.map((l) => (
                                                <tr key={`${l.processo_id}-${l.data}`}>
                                                    <td className="py-1 pr-3">{br(l.data)}</td>
                                                    <td className="py-1 pr-3 font-mono">{l.numero}</td>
                                                    <td className="py-1 pr-3">{l.relator}</td>
                                                    <td className="py-1 pr-3">{l.resultado}</td>
                                                    <td className="py-1 pr-3">{l.juntado_em ? `juntado em ${br(l.juntado_em)} (${l.dias_ate_acordao} ${l.dias_ate_acordao === 1 ? 'dia' : 'dias'})` : l.acordao_pendente ? `pendente, até ${br(l.prazo_acordao)}` : 'sem acórdão'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum processo julgado no período.</p>}
                        </section>
                    </div>
                )}
            </div>
        </details>
    );
}
