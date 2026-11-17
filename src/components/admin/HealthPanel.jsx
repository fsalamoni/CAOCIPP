import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Loader2, AlertCircle, RefreshCw, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Database, Mail,
    Receipt, Activity, GitCommit, Clock, HardDrive, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { platformDiagnostico } from '@/services/platformService';

const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);
const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const fmtBytes = (b) => {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
    return `${(b / 1024 ** i).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u[i]}`;
};
const fmtDuracao = (ms) => (ms == null ? '' : ms < 1000 ? `${ms} ms` : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60000)} min`);

const SITUACAO = {
    ok: { rotulo: 'Em dia', icone: CheckCircle2, cor: 'text-emerald-600 dark:text-emerald-400', selo: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200' },
    atrasada: { rotulo: 'Atrasada', icone: AlertTriangle, cor: 'text-amber-600 dark:text-amber-400', selo: 'bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200' },
    erro: { rotulo: 'Falhou', icone: XCircle, cor: 'text-red-600 dark:text-red-400', selo: 'bg-red-100 text-red-950 dark:bg-red-950/60 dark:text-red-200' },
    sem_registro: { rotulo: 'Sem registro ainda', icone: HelpCircle, cor: 'text-slate-500 dark:text-slate-400', selo: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
};

const caixa = 'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800';

function Servico({ icone: Icone, titulo, ok, children }) {
    return (
        <li className={`${caixa} p-4 flex gap-3 min-w-0`}>
            <Icone className={`w-5 h-5 mt-0.5 shrink-0 ${ok === false ? 'text-red-600 dark:text-red-400' : ok === null ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} aria-hidden />
            <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900 dark:text-white">{titulo}</p>
                <div className="text-slate-600 dark:text-slate-300 break-words">{children}</div>
            </div>
        </li>
    );
}

function Rotina({ r }) {
    const s = SITUACAO[r.situacao] || SITUACAO.sem_registro;
    const Icone = s.icone;
    return (
        <li className={`${caixa} p-4 flex gap-3`}>
            <Icone className={`w-5 h-5 mt-0.5 shrink-0 ${s.cor}`} aria-hidden />
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">{r.nome}</h4>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.selo}`}>{s.rotulo}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {r.agenda}.{' '}
                    {r.ultima ? `Última execução em ${fmtData(r.ultima.em)}, levou ${fmtDuracao(r.ultima.duracao_ms)}.` : 'Ainda não rodou desde que o registro começou.'}
                </p>
                {r.situacao === 'atrasada' && <p className="text-sm text-amber-800 dark:text-amber-300">Passou do dobro do intervalo sem rodar. Confira o Cloud Scheduler no console do Google Cloud.</p>}
                {r.ultimo_erro && (
                    <p className="text-sm text-red-700 dark:text-red-300 break-words">
                        Última falha em {fmtData(r.ultimo_erro.em)}: <span className="font-mono text-xs">{r.ultimo_erro.erro}</span>
                    </p>
                )}
                {r.historico?.length > 1 && (
                    <details className="text-sm">
                        <summary className="cursor-pointer text-slate-700 dark:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Últimas {r.historico.length} execuções</summary>
                        <ol className="mt-1.5 space-y-0.5 text-slate-600 dark:text-slate-300">
                            {r.historico.map((h) => (
                                <li key={h.em} className="flex gap-2 tabular-nums">
                                    <span className={h.status === 'erro' ? 'text-red-700 dark:text-red-300' : ''}>{h.status === 'erro' ? 'Falhou' : 'Ok'}</span>
                                    <span>{fmtData(h.em)}</span><span>{fmtDuracao(h.duracao_ms)}</span>
                                </li>
                            ))}
                        </ol>
                    </details>
                )}
            </div>
        </li>
    );
}

/** Diagnóstico e saúde da plataforma: serviços, versão, rotinas, erros reais e arquivos. */
export default function HealthPanel() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['platformDiagnostico'], queryFn: platformDiagnostico });

    if (isLoading) {
        return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Conferindo o sistema...</div>;
    }
    if (error || !data) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Erro ao conferir o sistema.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    const { servicos, atividade, rotinas, erros, arquivos } = data;
    const problemas = [
        !servicos.banco.ok,
        ...rotinas.map((r) => r.situacao === 'erro' || r.situacao === 'atrasada'),
        (erros?.total || 0) > 0,
    ].filter(Boolean).length;
    const commit = import.meta.env.VITE_SIGO_COMMIT;
    const buildEm = import.meta.env.VITE_SIGO_BUILD_EM;

    return (
        <div className="space-y-8">
            <section className={`${caixa} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3`} aria-live="polite">
                {problemas ? <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden /> : <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{problemas ? `${problemas} ${problemas === 1 ? 'ponto' : 'pontos'} para olhar` : 'Tudo funcionando'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Conferido em {fmtData(data.geradoEm)}.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5 self-start sm:self-center">
                    <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />Conferir de novo
                </Button>
            </section>

            <section aria-labelledby="diag-servicos" className="space-y-3">
                <h3 id="diag-servicos" className="font-semibold text-slate-900 dark:text-white">Serviços e versão</h3>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Servico icone={Database} titulo="Banco de dados" ok={servicos.banco.ok}>
                        {servicos.banco.ok ? `Respondendo em ${fmtNum(servicos.banco.ms)} ms.` : `Falhou: ${servicos.banco.erro}`}
                    </Servico>
                    <Servico icone={Mail} titulo="Envio de e-mail" ok={servicos.email ? true : null}>
                        {servicos.email ? 'Chave configurada.' : <>Sem chave: códigos e avisos por e-mail não saem. <Link to="/Admin?secao=setup" className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Configurar</Link></>}
                    </Servico>
                    <Servico icone={Receipt} titulo="Custos reais" ok={servicos.faturamento ? true : null}>
                        {servicos.faturamento ? 'Exportação do faturamento ligada.' : 'Exportação do faturamento para o BigQuery desligada.'}
                    </Servico>
                    <Servico icone={Activity} titulo="Atividade" ok>
                        {atividade.ultimas24h == null ? 'Não disponível.' : `${fmtNum(atividade.ultimas24h)} ${atividade.ultimas24h === 1 ? 'ação registrada' : 'ações registradas'} nas últimas 24 h.`}
                        {atividade.ultima && ` Última em ${fmtData(atividade.ultima)}.`}
                    </Servico>
                    <Servico icone={GitCommit} titulo="Versão no ar" ok>
                        Site: {commit ? <a href={`https://github.com/fsalamoni/CAOCIPP/commit/${commit}`} target="_blank" rel="noreferrer" className="font-mono text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:underline">{commit.slice(0, 7)}</a> : 'build local'}
                        {buildEm && `, gerado em ${fmtData(buildEm)}`}.
                        {data.revisao && <> Funções: <span className="font-mono text-xs">{data.revisao}</span>.</>}
                    </Servico>
                    <Servico icone={HardDrive} titulo="Arquivos enviados" ok={arquivos ? true : null}>
                        {arquivos ? `${fmtBytes(arquivos.bytes)}${arquivos.objetos != null ? ` em ${fmtNum(arquivos.objetos)} arquivos` : ''}. Inclui os outros apps do mesmo projeto.` : 'Não disponível agora.'}
                        {' '}<Link to="/Admin?secao=footprint" className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Espaço do banco</Link>
                    </Servico>
                </ul>
            </section>

            <section aria-labelledby="diag-rotinas" className="space-y-3">
                <div>
                    <h3 id="diag-rotinas" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />Rotinas agendadas</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">O que o SIGO faz sozinho todo dia ou toda semana, com o resultado de cada execução.</p>
                </div>
                <ul className="space-y-3">{rotinas.map((r) => <Rotina key={r.chave} r={r} />)}</ul>
            </section>

            <section aria-labelledby="diag-erros" className="space-y-3">
                <div>
                    <h3 id="diag-erros" className="font-semibold text-slate-900 dark:text-white">Erros do servidor nas últimas 24 horas</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Lidos do registro do Google Cloud, só das funções do SIGO, agrupados por função.</p>
                </div>
                {!erros ? (
                    <p className={`${caixa} p-4 text-sm text-slate-600 dark:text-slate-300`}>Não disponível agora: o registro do Google Cloud não respondeu. Tente de novo em alguns minutos.</p>
                ) : !erros.grupos.length ? (
                    <p className={`${caixa} p-4 text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2`}><CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden />Nenhum erro nas últimas 24 horas.</p>
                ) : (
                    <>
                        <ul className={`${caixa} divide-y divide-slate-100 dark:divide-slate-800`}>
                            {erros.grupos.map((g) => (
                                <li key={g.funcao} className="p-3 sm:px-4 space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">{g.funcao}</span>
                                        <span className="text-sm text-red-700 dark:text-red-300">{fmtNum(g.quantidade)} {g.quantidade === 1 ? 'erro' : 'erros'}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">último em {fmtData(g.ultima_em)}</span>
                                    </div>
                                    <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-words">{g.ultima_mensagem}</p>
                                </li>
                            ))}
                        </ul>
                        {erros.truncado && <p className="text-xs text-slate-500 dark:text-slate-400">Mostrando os 500 registros mais recentes; houve mais.</p>}
                    </>
                )}
                <Link to="/Admin?secao=activity" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Ver as movimentações<ArrowRight className="w-3.5 h-3.5" aria-hidden /></Link>
            </section>
        </div>
    );
}
