import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Download, DatabaseBackup, ExternalLink, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { platformDados, getOrgsReport } from '@/services/platformService';
import { exportToJson, dateSuffix } from '@/lib/jurimetriaExport';

const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);
const fmtBytes = (b) => {
    if (b == null) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = b ? Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024))) : 0;
    return `${(b / 1024 ** i).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u[i]}`;
};
const caixa = 'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800';
const seletor = 'h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

function Linha({ ok, titulo, children }) {
    const Icone = ok ? CheckCircle2 : AlertTriangle;
    return (
        <li className="flex gap-3 p-3 sm:px-4">
            <Icone className={`w-5 h-5 mt-0.5 shrink-0 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} aria-hidden />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
                <p className="font-medium text-slate-900 dark:text-white">{titulo}</p>
                {children}
            </div>
        </li>
    );
}

function GuiaConsole() {
    const proj = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
    const url = `https://console.cloud.google.com/firestore/databases/-default-/disaster-recovery${proj ? `?project=${encodeURIComponent(proj)}` : ''}`;
    return (
        <details className={`${caixa} p-4 text-sm`}>
            <summary className="cursor-pointer font-medium text-slate-900 dark:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">Passo a passo pelo console do Google Cloud</summary>
            <div className="mt-3 space-y-3 text-slate-700 dark:text-slate-200">
                <div>
                    <p className="font-medium">Ligar a cópia diária (se o botão acima recusar)</p>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>Abra <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300 hover:underline">Firestore, Recuperação de desastres<ExternalLink className="w-3.5 h-3.5" aria-hidden /></a>, entrando com a conta dona do projeto.</li>
                        <li>Clique em <strong>Criar programação de backup</strong> (Create backup schedule).</li>
                        <li>Escolha <strong>Diária</strong> e retenção de <strong>14 dias</strong>. Salve.</li>
                        <li>Volte aqui e clique em <em>Conferir de novo</em>: o item fica verde.</li>
                    </ol>
                </div>
                <div>
                    <p className="font-medium">Restaurar uma cópia</p>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>No mesmo lugar, aba <strong>Backups</strong>, escolha a data e clique em <strong>Restaurar</strong>.</li>
                        <li>Dê um nome novo ao banco (por exemplo, <code className="text-xs">restauro-2026-11-17</code>). A restauração <strong>sempre cria um banco novo</strong>: o banco em uso não é tocado.</li>
                        <li>Para trazer só alguns dados de volta, peça a quem dá manutenção copiar do banco restaurado.</li>
                    </ol>
                </div>
                <p className="text-slate-600 dark:text-slate-300">Custo: a cópia é cobrada pelo espaço guardado (centavos por GB ao mês) e a restauração pelo volume lido.</p>
            </div>
        </details>
    );
}

function Copias() {
    const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['platformDadosCopias'], queryFn: () => platformDados('copias') });
    const [retencao, setRetencao] = useState('14');
    const [agindo, setAgindo] = useState(null);

    const agir = async (acao, extra, okMsg) => {
        setAgindo(acao);
        try {
            const r = await platformDados(acao, extra);
            toast.success(r?.jaExistia ? 'A cópia diária já estava ligada.' : okMsg);
            await refetch();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível fazer agora.');
        } finally {
            setAgindo(null);
        }
    };

    if (isLoading) return <div role="status" className="flex items-center py-8 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Consultando o banco...</div>;
    if (error) return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error.message}</p>;

    const diaria = data.agendas?.find((a) => a.diaria);
    return (
        <div className="space-y-3">
            {!data.disponivel ? (
                <p className={`${caixa} p-4 text-sm text-slate-700 dark:text-slate-200 flex gap-2`}>
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden />
                    Não foi possível consultar a configuração do banco agora{data.erro ? ` (${data.erro})` : ''}. Use o passo a passo abaixo.
                </p>
            ) : (
                <ul className={`${caixa} divide-y divide-slate-100 dark:divide-slate-800`}>
                    <Linha ok={!!diaria} titulo={diaria ? `Cópia diária ligada, guardada por ${diaria.retencaoDias} dias` : 'Sem cópia diária'}>
                        {!diaria && (
                            <>
                                <p className="text-slate-600 dark:text-slate-300">Se algo for apagado por engano, é daqui que se recupera. Custo pequeno, pelo espaço guardado.</p>
                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="copia-retencao">Guardar cada cópia por</Label>
                                        <select id="copia-retencao" value={retencao} onChange={(e) => setRetencao(e.target.value)} className={seletor}>
                                            <option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option>
                                        </select>
                                    </div>
                                    <Button onClick={() => agir('ligarCopiaDiaria', { retencaoDias: Number(retencao) }, 'Cópia diária ligada. A primeira sai nas próximas 24 horas.')} disabled={!!agindo} className="gap-1.5">
                                        {agindo === 'ligarCopiaDiaria' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <DatabaseBackup className="w-4 h-4" aria-hidden />}Ligar cópia diária
                                    </Button>
                                </div>
                            </>
                        )}
                    </Linha>
                    <Linha ok={data.protecao} titulo={data.protecao ? 'Proteção contra exclusão do banco ligada' : 'Proteção contra exclusão do banco desligada'}>
                        {!data.protecao && (
                            <>
                                <p className="text-slate-600 dark:text-slate-300">Impede apagar o banco inteiro pelo console, por engano. Não custa nada e não muda o uso do SIGO.</p>
                                <Button variant="outline" onClick={() => agir('ligarProtecao', {}, 'Proteção contra exclusão ligada.')} disabled={!!agindo} className="gap-1.5">
                                    {agindo === 'ligarProtecao' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <ShieldCheck className="w-4 h-4" aria-hidden />}Ligar proteção
                                </Button>
                            </>
                        )}
                    </Linha>
                    <Linha ok={data.pitr} titulo={data.pitr ? 'Recuperação de qualquer minuto dos últimos 7 dias ligada' : 'Recuperação minuto a minuto (PITR) desligada'}>
                        {!data.pitr && <p className="text-slate-600 dark:text-slate-300">Opcional. A cópia diária cobre o essencial; isto dá precisão de minuto, com custo de armazenamento extra. Liga-se no console, em Recuperação de desastres.</p>}
                    </Linha>
                </ul>
            )}
            {data.disponivel && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Cópias guardadas</h4>
                    {data.backups?.length ? (
                        <ul className={`${caixa} divide-y divide-slate-100 dark:divide-slate-800 text-sm`}>
                            {data.backups.map((b) => (
                                <li key={b.em} className="p-3 sm:px-4 flex flex-wrap gap-x-4 gap-y-0.5 text-slate-700 dark:text-slate-200">
                                    <span className="font-medium tabular-nums">{fmtData(b.em)}</span>
                                    <span>{b.estado === 'READY' ? 'Pronta' : b.estado === 'CREATING' ? 'Sendo feita' : b.estado}</span>
                                    {b.bytes != null && <span>{fmtBytes(b.bytes)}</span>}
                                    {b.expira && <span className="text-slate-500 dark:text-slate-400">guardada até {fmtData(b.expira)}</span>}
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-600 dark:text-slate-300">Nenhuma cópia guardada ainda.</p>}
                </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching && <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden />}Conferir de novo</Button>
            <GuiaConsole />
        </div>
    );
}

function ExportarOrgao({ colecoes }) {
    const [params] = useSearchParams();
    const { data: orgs } = useQuery({ queryKey: ['platformOrgsReport'], queryFn: () => getOrgsReport(500) });
    const [orgId, setOrgId] = useState(params.get('orgao') || '');
    const [progresso, setProgresso] = useState(null);
    const lista = (orgs?.organizations || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

    const exportar = async () => {
        const org = lista.find((o) => o.id === orgId);
        const saida = { orgao: { id: orgId, nome: org?.name || null }, exportado_em: new Date().toISOString(), colecoes: {} };
        try {
            for (const colecao of colecoes) {
                let cursor = null;
                const itens = [];
                do {
                    setProgresso({ colecao, total: Object.values(saida.colecoes).reduce((s, l) => s + l.length, 0) + itens.length });
                    const r = await platformDados('exportarOrgao', { organizationId: orgId, colecao, cursor });
                    itens.push(...r.itens);
                    cursor = r.cursor;
                } while (cursor);
                if (itens.length) saida.colecoes[colecao === '_docs' ? 'configuracao' : colecao] = itens;
            }
            const total = Object.values(saida.colecoes).reduce((s, l) => s + l.length, 0);
            exportToJson({ data: saida, filenameBase: `sigo-${org?.name || orgId}-${dateSuffix()}` });
            toast.success(`${fmtNum(total)} registros exportados.`);
        } catch (e) {
            toast.error(e?.message || 'A exportação parou. Tente de novo.');
        } finally {
            setProgresso(null);
        }
    };

    return (
        <div className={`${caixa} p-4 space-y-3`}>
            <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1 min-w-0 flex-1 sm:flex-none">
                    <Label htmlFor="exp-orgao">Órgão</Label>
                    <select id="exp-orgao" value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`${seletor} w-full sm:w-80`} disabled={!!progresso}>
                        <option value="">{orgs ? 'Escolha o órgão' : 'Carregando órgãos...'}</option>
                        {lista.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                </div>
                <Button onClick={exportar} disabled={!orgId || !!progresso} className="gap-1.5">
                    {progresso ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}Exportar em JSON
                </Button>
            </div>
            {progresso && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Lendo {progresso.colecao === '_docs' ? 'configuração' : progresso.colecao}... {fmtNum(progresso.total)} registros até agora.</p>}
            <p className="text-xs text-slate-500 dark:text-slate-400">Leva todos os registros do órgão (consultas, expedientes, parcerias, júris, Panorama, Processo Eletrônico com os autos, membros e auditoria), com o histórico de cada um. Arquivos anexados (PDFs, imagens) não entram: os autos de cada processo saem em PDF pelo próprio Processo Eletrônico. A exportação fica registrada na auditoria.</p>
        </div>
    );
}

/** Cópias de segurança do banco e exportação de dados. Nada aqui apaga dado. */
export default function DadosPanel() {
    const { data } = useQuery({ queryKey: ['platformDadosCopias'], queryFn: () => platformDados('copias') });
    const [exportando, setExportando] = useState(false);

    const exportarPlataforma = async () => {
        setExportando(true);
        try {
            exportToJson({ data: { exportado_em: new Date().toISOString(), ...(await platformDados('exportarPlataforma')) }, filenameBase: `sigo-configuracao-plataforma-${dateSuffix()}` });
            toast.success('Configuração exportada.');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível exportar.');
        } finally {
            setExportando(false);
        }
    };

    return (
        <div className="space-y-8">
            <section aria-labelledby="dados-copias" className="space-y-3">
                <div>
                    <h3 id="dados-copias" className="font-semibold text-slate-900 dark:text-white">Cópia de segurança do banco</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Cópias automáticas guardadas pelo Google, fora do alcance de quem usa o SIGO.</p>
                </div>
                <Copias />
            </section>
            <section aria-labelledby="dados-orgao" className="space-y-3">
                <div>
                    <h3 id="dados-orgao" className="font-semibold text-slate-900 dark:text-white">Exportar os dados de um órgão</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Um arquivo .json com tudo o que o órgão registrou, para guardar, entregar ao órgão ou levar a outro sistema.</p>
                </div>
                {data?.colecoesOrgao ? <ExportarOrgao colecoes={data.colecoesOrgao} /> : <Loader2 className="w-5 h-5 animate-spin text-slate-500" aria-label="Carregando" />}
            </section>
            <section aria-labelledby="dados-plataforma" className="space-y-3">
                <div>
                    <h3 id="dados-plataforma" className="font-semibold text-slate-900 dark:text-white">Exportar a configuração da plataforma</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Identidade, termos (todas as versões), avisos, funcionalidades, cotas, e-mail, administradores e rotinas.</p>
                </div>
                <Button variant="outline" onClick={exportarPlataforma} disabled={exportando} className="gap-1.5">
                    {exportando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}Exportar configuração
                </Button>
            </section>
        </div>
    );
}
