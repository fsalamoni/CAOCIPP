import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertCircle, RefreshCw, Save, Info, ExternalLink, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCostReport, platformUso } from '@/services/platformService';

const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);
const fmtDia = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const moeda = (v, c) => {
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c || 'BRL' }).format(v || 0); } catch { return `${(v || 0).toFixed(2)} ${c || ''}`; }
};
const caixa = 'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800';

/** Barras por dia com a linha da cota gratuita. */
function Barras({ dias, campo, cota, rotulo }) {
    const max = Math.max(cota || 0, ...dias.map((d) => d[campo] || 0), 1);
    const acima = dias.filter((d) => cota && d[campo] > cota).length;
    const media = Math.round(dias.reduce((s, d) => s + (d[campo] || 0), 0) / (dias.length || 1));
    const pico = dias.reduce((m, d) => ((d[campo] || 0) > (m?.[campo] || 0) ? d : m), null);
    return (
        <figure className="space-y-2">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{rotulo}</span>
                <span className="text-slate-600 dark:text-slate-300">
                    média de {fmtNum(media)} por dia{pico ? `, pico de ${fmtNum(pico[campo])} em ${fmtDia(pico.dia)}` : ''}
                    {cota ? (acima ? <span className="text-amber-800 dark:text-amber-300">, {acima} {acima === 1 ? 'dia' : 'dias'} acima da cota gratuita</span> : ', sempre dentro da cota gratuita') : ''}
                </span>
            </figcaption>
            <div className="relative mt-1 h-28 flex items-end gap-px sm:gap-0.5" role="img" aria-label={`${rotulo}: média de ${fmtNum(media)} por dia nos últimos ${dias.length} dias`}>
                {cota > 0 && (
                    <div className="absolute inset-x-0 border-t border-dashed border-slate-400 dark:border-slate-500" style={{ bottom: `${(cota / max) * 100}%` }} aria-hidden>
                        <span className="absolute right-0 top-0.5 rounded bg-white/90 dark:bg-slate-900/90 px-1 text-[10px] leading-4 text-slate-600 dark:text-slate-300">cota gratuita {fmtNum(cota)}</span>
                    </div>
                )}
                {dias.map((d) => {
                    const v = d[campo] || 0;
                    return (
                        <div key={d.dia} className="flex-1 min-w-0 h-full flex items-end" title={`${fmtDia(d.dia)}: ${fmtNum(v)}`}>
                            <div className={`w-full rounded-t-sm ${cota && v > cota ? 'bg-amber-500' : 'bg-indigo-500 dark:bg-indigo-400'}`} style={{ height: `${Math.max(1, (v / max) * 100)}%` }} />
                        </div>
                    );
                })}
            </div>
            {dias.length > 1 && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400" aria-hidden><span>{fmtDia(dias[0].dia)}</span><span>{fmtDia(dias[dias.length - 1].dia)}</span></div>
            )}
        </figure>
    );
}

function Alerta({ alerta, ultimoAviso, cota, onSalvo }) {
    const [l, setL] = useState(String(alerta?.leiturasDia ?? cota.leituras));
    const [e, setE] = useState(String(alerta?.escritasDia ?? cota.escritas));
    const [ativo, setAtivo] = useState(alerta ? alerta.ativo : true);
    const [salvando, setSalvando] = useState(false);
    const salvar = async () => {
        setSalvando(true);
        try {
            await platformUso('salvarAlerta', { leiturasDia: Number(l), escritasDia: Number(e), ativo });
            toast.success(ativo ? 'Alerta salvo. A conferência é todo dia às 6h.' : 'Alerta desligado.');
            onSalvo();
        } catch (err) {
            toast.error(err?.message || 'Não foi possível salvar.');
        } finally {
            setSalvando(false);
        }
    };
    return (
        <div className={`${caixa} p-4 space-y-3`}>
            <p className="text-sm text-slate-700 dark:text-slate-200">
                Todo dia às 6h o SIGO confere o uso do banco no dia anterior e manda e-mail para os administradores da plataforma se passar de um destes limites. Deixe 0 para não conferir.
            </p>
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <Label htmlFor="alerta-leituras">Leituras por dia</Label>
                    <Input id="alerta-leituras" type="number" inputMode="numeric" min={0} value={l} onChange={(ev) => setL(ev.target.value)} className="w-40" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="alerta-escritas">Gravações por dia</Label>
                    <Input id="alerta-escritas" type="number" inputMode="numeric" min={0} value={e} onChange={(ev) => setE(ev.target.value)} className="w-40" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 pb-2">
                    <input type="checkbox" checked={ativo} onChange={(ev) => setAtivo(ev.target.checked)} className="w-4 h-4 accent-indigo-600" />Alerta ligado
                </label>
                <Button onClick={salvar} disabled={salvando} className="gap-1.5">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}Salvar
                </Button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Sugestão: a cota gratuita ({fmtNum(cota.leituras)} leituras e {fmtNum(cota.escritas)} gravações por dia). O e-mail sai pela chave configurada em <Link to="/Admin?secao=setup" className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Configuração inicial</Link>.
                {alerta?.em && ` Última alteração em ${fmtData(alerta.em)}${alerta.por ? ` por ${alerta.por}` : ''}.`}
            </p>
            {ultimoAviso && (
                <p className="text-sm text-amber-800 dark:text-amber-300 flex gap-2"><BellRing className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />Último aviso: {ultimoAviso.dia}, {(ultimoAviso.fora || []).join('; ')}.</p>
            )}
        </div>
    );
}

function Faturamento() {
    const [dias, setDias] = useState(30);
    const { data: r, isLoading } = useQuery({ queryKey: ['platformCostReport', dias], queryFn: () => getCostReport(dias) });
    if (isLoading) return <div role="status" className="flex items-center py-6 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Consultando o faturamento...</div>;
    if (r?.status !== 'ok') {
        return (
            <div className={`${caixa} p-4 space-y-2 text-sm text-slate-700 dark:text-slate-200`}>
                <p className="flex gap-2 font-medium"><Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden />{r?.status === 'error' ? 'O faturamento não respondeu.' : 'O custo em reais ainda não está ligado.'}</p>
                <p className="text-slate-600 dark:text-slate-300">{r?.status === 'error' ? r.message : 'Precisa da exportação do faturamento do Google Cloud para o BigQuery e de três variáveis nas funções. O passo a passo está em Configuração inicial.'}</p>
                <Link to="/Admin?secao=setup" className="inline-flex font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Abrir Configuração inicial</Link>
            </div>
        );
    }
    return (
        <div className={`${caixa} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{moeda(r.totalCost, r.currency)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Últimos {r.periodDays} dias, todo o projeto do Google Cloud.</p>
                </div>
                <div className="flex gap-1" role="group" aria-label="Período">
                    {[7, 30, 90].map((d) => <Button key={d} size="sm" variant={dias === d ? 'default' : 'outline'} onClick={() => setDias(d)} aria-pressed={dias === d}>{d} dias</Button>)}
                </div>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {(r.byService || []).map((s) => (
                    <li key={s.service} className="flex justify-between gap-3 py-2"><span className="text-slate-700 dark:text-slate-200">{s.service}</span><span className="font-medium tabular-nums text-slate-900 dark:text-white">{moeda(s.cost, s.currency)}</span></li>
                ))}
                {!r.byService?.length && <li className="py-2 text-slate-600 dark:text-slate-300">Nenhum custo no período.</li>}
            </ul>
        </div>
    );
}

/** Custos e uso: banco e funções por dia, uso por órgão, alerta diário e custo em reais. */
export default function CostsPanel() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['platformUso'], queryFn: () => platformUso('painel') });

    if (isLoading) return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Lendo o uso da plataforma...</div>;
    if (error || !data) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Erro ao ler o uso.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    const { banco, funcoes, orgaos, cotaGratis } = data;
    const maxOrg = Math.max(1, ...orgaos.map((o) => o.acoes30d || 0));

    return (
        <div className="space-y-8">
            <section aria-labelledby="uso-banco" className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h3 id="uso-banco" className="font-semibold text-slate-900 dark:text-white">Uso do banco nos últimos 30 dias</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Abaixo da linha tracejada, o Google não cobra. O banco é compartilhado com os outros apps do mesmo projeto, então os números incluem o uso deles.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5"><RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />Atualizar</Button>
                </div>
                {!banco ? (
                    <p className={`${caixa} p-4 text-sm text-slate-600 dark:text-slate-300`}>Não disponível agora: o monitoramento do Google Cloud não respondeu.</p>
                ) : (
                    <div className={`${caixa} p-4 space-y-6`}>
                        <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <Info className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                            Cota gratuita por dia: {fmtNum(cotaGratis.leituras)} leituras, {fmtNum(cotaGratis.escritas)} gravações e {fmtNum(cotaGratis.exclusoes)} exclusões.
                        </p>
                        <Barras dias={banco} campo="leituras" cota={cotaGratis.leituras} rotulo="Leituras" />
                        <Barras dias={banco} campo="escritas" cota={cotaGratis.escritas} rotulo="Gravações" />
                        {funcoes && <Barras dias={funcoes} campo="chamadas" rotulo="Chamadas às funções do SIGO" />}
                    </div>
                )}
            </section>

            <section aria-labelledby="uso-orgaos" className="space-y-3">
                <div>
                    <h3 id="uso-orgaos" className="font-semibold text-slate-900 dark:text-white">Uso por órgão nos últimos 30 dias</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ações registradas na auditoria de cada órgão: mostra quem mais usa o sistema.</p>
                </div>
                <ol className={`${caixa} divide-y divide-slate-100 dark:divide-slate-800`}>
                    {orgaos.map((o) => (
                        <li key={o.id} className="p-3 sm:px-4 space-y-1.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                                <Link to={`/Admin?secao=orgs&orgao=${encodeURIComponent(o.id)}`} className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline truncate">{o.nome}</Link>
                                <span className="text-slate-600 dark:text-slate-300 tabular-nums">{o.acoes30d == null ? 'não disponível' : `${fmtNum(o.acoes30d)} ${o.acoes30d === 1 ? 'ação' : 'ações'}`} · {fmtNum(o.membros)} {o.membros === 1 ? 'vínculo' : 'vínculos'}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" aria-hidden>
                                <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${((o.acoes30d || 0) / maxOrg) * 100}%` }} />
                            </div>
                        </li>
                    ))}
                    {!orgaos.length && <li className="p-4 text-sm text-slate-600 dark:text-slate-300">Nenhum órgão.</li>}
                </ol>
            </section>

            <section aria-labelledby="uso-alerta" className="space-y-3">
                <h3 id="uso-alerta" className="font-semibold text-slate-900 dark:text-white">Alerta de uso por e-mail</h3>
                <Alerta alerta={data.alerta} ultimoAviso={data.ultimoAviso} cota={cotaGratis} onSalvo={() => refetch()} />
            </section>

            <section aria-labelledby="uso-reais" className="space-y-3">
                <div>
                    <h3 id="uso-reais" className="font-semibold text-slate-900 dark:text-white">Custo em reais</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Do faturamento do Google Cloud. Para um teto com aviso do próprio Google, crie um orçamento no console.</p>
                </div>
                <Faturamento />
                <details className={`${caixa} p-4 text-sm`}>
                    <summary className="cursor-pointer font-medium text-slate-900 dark:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Criar um orçamento com aviso no Google Cloud</summary>
                    <ol className="mt-3 list-decimal pl-5 space-y-1 text-slate-700 dark:text-slate-200">
                        <li>Abra <a href="https://console.cloud.google.com/billing/budgets" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Faturamento, Orçamentos e alertas<ExternalLink className="w-3.5 h-3.5" aria-hidden /></a> com a conta dona do faturamento.</li>
                        <li><strong>Criar orçamento</strong>, escolha o projeto do SIGO e um valor mensal (por exemplo, R$ 50).</li>
                        <li>Mantenha os avisos em 50%, 90% e 100% e marque o envio de e-mail aos administradores do faturamento.</li>
                    </ol>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">O orçamento só avisa: ele não desliga nada sozinho.</p>
                </details>
            </section>
        </div>
    );
}
