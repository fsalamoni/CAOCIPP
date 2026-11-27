import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, CalendarDays, Gavel, HelpCircle, Inbox, ListChecks, Loader2, Paperclip, Plus, Scale, Search, Settings, Files, LayoutDashboard, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPageUrl } from '@/utils';
import { useOrganizations, useOrganizationRealtime } from '@/hooks/useFirestore';
import { useOrganizationTabs } from '@/hooks/useOrganizationTabs';
import { useSinalProcessos } from '@/hooks/useSinalProcessos';
import { PROCESSO_ELETRONICO_TAB } from '@/lib/organizationModules';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import OrgTabBar from '@/components/organization/OrgTabBar';
import { MAX_ENVIO_MB, secConfig, secProcesso } from '@/services/secretariaService';
// Partes pesadas (tela do processo com o editor, sessões, painel) baixadas
// quando usadas: a lista aparece sem esperar por elas.
const carregarProcessoView = () => import('@/components/secretaria/ProcessoView');
const ProcessoView = lazy(carregarProcessoView);
import ErroQuery from '@/components/secretaria/ErroQuery';
import AvisosEquipe from '@/components/secretaria/AvisosEquipe';
import UnidadesDoUsuario, { ConviteEquipe } from '@/components/secretaria/UnidadesDoUsuario';
import FluxoRito from '@/components/secretaria/FluxoRito';
import FormularioAutuacao from '@/components/secretaria/FormularioAutuacao';
import { NUMERACAO_PADRAO, codigosFaltando, formatarNumero } from '@/lib/numeracao';
import { ROTULO_REF, camposDaOrigem, faltando, formularioDe, integracoesLigadas } from '@/lib/camposProcesso';
import { buscarRegistro } from '@/lib/registrosModulos';
import { ProvedorRegistros } from '@/components/secretaria/SeletorRegistro';
import { unidadeComOrgao } from '@/lib/orgaos';
import { unidadeDecide } from '@/lib/permissoesFase';
const PainelSecretaria = lazy(() => import('@/components/secretaria/PainelSecretaria'));
import MeuTrabalho, { MesaDecisao, gruposDeTrabalho } from '@/components/secretaria/MeuTrabalho';
import { STATUS_ROTULO, NativeSelect, documentoDaUnidade } from '@/components/secretaria/comum';
import LinhaProcesso, { lembrarProcesso } from '@/components/secretaria/LinhaProcesso';
import EscolherArquivo from '@/components/secretaria/EscolherArquivo';
import DetalharDocumentos, { detalheInicial, enviarDetalhados, resumoDetalhe } from '@/components/secretaria/DetalharDocumentos';
import AjudaTermo, { focoSemAjuda } from '@/components/secretaria/AjudaTermo';
import GuiaRito from '@/components/secretaria/GuiaRito';
const Sessoes = lazy(() => import('@/components/secretaria/Sessoes'));
import { DisputasEmQueAtuo } from '@/components/secretaria/DisputaPrecos';
import { veSessoes } from '@/lib/sessoes';
import { semAcento } from '@/lib/bibliotecaFiltro';

const Carregando = () => <div role="status" className="py-6 flex items-center gap-2 text-slate-600 dark:text-slate-300"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</div>;

export default function ProcessoEletronico() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const orgId = params.get('org');
    const tokenEquipe = params.get('equipe');
    const procId = params.get('p');
    // "Criar processo eletrônico" num registro de outro módulo (ou "Novo processo
    // derivado"): ?de=modulo:id abre o Novo processo já com a origem.
    const location = useLocation();
    const de = params.get('de') || '';
    const [deModulo, deId] = de.split(':');
    const { organizations } = useOrganizations();
    const org = organizations.find((o) => o.id === orgId);
    // Mesma barra de páginas do órgão (Novo design V2), com o Processo
    // Eletrônico marcado: dá para ir às outras páginas sem voltar ao órgão.
    const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
    const { organization: orgAoVivo, resolvedId } = useOrganizationRealtime(orgId);
    const orgTabs = useOrganizationTabs(resolvedId === orgId ? orgAoVivo : null, { role: org?.userRole, permissions: org?.userPermissions });
    // Dentro de um processo, a barra e o cabeçalho somem: a tela é do processo, com o
    // caminho de volta em "Processos" (as outras páginas seguem no menu lateral).
    const barra = isV2 && !procId && <OrgTabBar tabs={orgTabs} activeTab={PROCESSO_ELETRONICO_TAB} orgId={orgId} />;
    // A aba interna fica no endereço (?aba=): voltar de um processo, recarregar
    // ou compartilhar o link mantém a pessoa onde estava.
    const abaUrl = params.get('aba');
    const trocarAba = (v) => {
        const next = new URLSearchParams(params);
        next.set('aba', v);
        setParams(next, { replace: true });
    };

    const estadoQ = useQuery({
        queryKey: ['sec-estado', orgId],
        queryFn: () => secConfig(orgId, 'estado'),
        enabled: !!orgId && !tokenEquipe,
        // Configuração muda pouco e quem a altera invalida: não relê a cada volta à página.
        staleTime: 60000,
    });
    // Atos de colegas (e das partes) aparecem sozinhos nas listas e no processo aberto.
    useSinalProcessos(orgId, !!estadoQ.data?.enabled && !tokenEquipe);
    // Link direto para um processo: os autos e a tela dele são buscados junto
    // com o estado, em vez de só depois dele (uma ida e volta a menos).
    const qc = useQueryClient();
    useEffect(() => {
        if (!orgId || !procId || tokenEquipe) return;
        carregarProcessoView();
        qc.prefetchQuery({ queryKey: ['sec-proc', orgId, procId], queryFn: () => secProcesso(orgId, 'obter', { id: procId }), staleTime: 15000 });
    }, [orgId, procId, tokenEquipe]);
    const estado = estadoQ.data;
    // Mesma consulta da caixa: alimenta as contagens das abas "Meu trabalho" e "Mesa de decisão".
    const caixaQ = useQuery({
        queryKey: ['sec-processos', orgId, 'caixa'],
        queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }),
        enabled: !!estado?.enabled && !estado.suspensa_plataforma && estado.minhasUnidades.length > 0,
    });
    const sementeNavegacao = deId && location.state?.semente?.id === deId && location.state.semente.modulo === deModulo ? location.state.semente : null;
    const sementeQ = useQuery({
        queryKey: ['sec-semente', orgId, de],
        queryFn: async () => (deModulo === 'pe'
            ? secProcesso(orgId, 'obter', { id: deId }).then((r) => ({ modulo: 'pe', id: deId, numero: r.processo.numero }))
            : buscarRegistro(orgId, deModulo, deId)),
        enabled: !!deId && !sementeNavegacao && !!estado?.enabled && !estado.suspensa_plataforma && estado.minhasUnidades.length > 0,
        retry: false,
        staleTime: Infinity,
    });
    const semente = deId ? sementeNavegacao || sementeQ.data || null : null;
    const sementeFalhou = !!deId && !sementeNavegacao && (sementeQ.isError || (sementeQ.isSuccess && !sementeQ.data));
    const usarSemente = () => {
        const next = new URLSearchParams(params);
        next.delete('de');
        setParams(next, { replace: true });
    };
    useEffect(() => {
        if (sementeFalhou) {
            toast.error('Registro de origem não encontrado (ou sem acesso). Autue sem origem ou escolha outro registro.');
            usarSemente();
        }
    }, [sementeFalhou]);

    const abrir = (id) => {
        const next = new URLSearchParams(params);
        if (id) { next.set('p', id); lembrarProcesso(orgId, id); } else next.delete('p');
        setParams(next);
    };

    if (tokenEquipe) return <ConviteEquipe token={tokenEquipe} />;
    if (!orgId) {
        return <div className="p-8 text-slate-600">Escolha um órgão no menu lateral.</div>;
    }
    if (estadoQ.isLoading) {
        return <>{barra}<div role="status" className="py-6 flex items-center gap-2 text-slate-600 dark:text-slate-300"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando o Processo Eletrônico…</div></>;
    }
    if (estadoQ.error) {
        return <>{barra}<ErroQuery q={estadoQ} /></>;
    }
    if (estado?.enabled && estado.suspensa_plataforma) {
        return (
            <>{barra}
            <div className="py-2 space-y-3 max-w-xl" role="alert">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Processo Eletrônico suspenso</h1>
                <p className="text-slate-600 dark:text-slate-300">
                    A administração da plataforma suspendeu o módulo neste órgão. Nada foi apagado; os processos voltam a ficar disponíveis quando a suspensão for retirada.
                </p>
                {estado.motivo_suspensao && <p className="text-sm text-slate-600 dark:text-slate-300">Motivo informado: {estado.motivo_suspensao}</p>}
            </div>
            </>
        );
    }
    if (!estado?.enabled) {
        return (
            <>{barra}
            <div className="py-2 space-y-3 max-w-xl">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Processo Eletrônico desativado</h1>
                <p className="text-slate-600 dark:text-slate-300">
                    {estado?.isAdmin
                        ? 'Ative aqui ou no Painel Administrativo do órgão, seção Processo Eletrônico. Na primeira ativação, a plataforma cria a unidade "Secretaria" com você lotado como gestor e um "Rito comum".'
                        : 'Peça ao administrador do órgão para ativar o Processo Eletrônico.'}
                </p>
                <div className="flex flex-wrap gap-2">
                    {estado?.isAdmin && <AtivarAgora orgId={orgId} />}
                    {/* Quem não é admin não vê o Painel Administrativo: vai para a página inicial do órgão. */}
                    <Button variant="outline" onClick={() => navigate(`${createPageUrl('Organization')}?id=${orgId}${estado?.isAdmin ? '&tab=admin&secao=secretaria' : ''}`)}>
                        {estado?.isAdmin ? 'Abrir a configuração' : 'Ir para o órgão'}
                    </Button>
                </div>
            </div>
            </>
        );
    }

    // Pedidos de lotação esperando nas unidades que a pessoa gere.
    const pedidosPendentes = estado.unidades
        .filter((u) => estado.gestorDe?.includes(u.id))
        .reduce((n, u) => n + (u.pedidos || []).length, 0);
    const caixa = caixaQ.data?.processos || [];
    const meuTrabalho = gruposDeTrabalho(caixa, estado).total;
    const gabinetes = estado.unidades.filter((u) => unidadeDecide(u) && estado.minhasUnidades.includes(u.id)).map((u) => u.id);
    const paraDecidir = gabinetes.length ? caixa.filter((p) => gabinetes.includes(p.unidade_atual)).reduce((n, p) => n + (p.pendencias_abertas || 0), 0) : 0;

    // Sessões dos colegiados: secretaria, lotados e quem compõe (este, mesmo sem lotação, abre direto nelas).
    const comSessoes = veSessoes(estado, new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
    const abaPadrao = estado.minhasUnidades.length ? 'meu' : estado.isAdmin ? 'todos' : comSessoes ? 'sessoes' : 'unidades';
    const abasValidas = ['caixa', 'todos', 'painel', 'unidades', ...(estado.minhasUnidades.length ? ['meu'] : []), ...(gabinetes.length ? ['mesa'] : []), ...(comSessoes ? ['sessoes'] : [])];
    const aba = abasValidas.includes(abaUrl) ? abaUrl : abaPadrao;

    return (
        <ProvedorRegistros orgId={orgId} ligadas={integracoesLigadas(estado)} unidades={estado.unidades} listas={estado.listas}>
        {barra}
        <div className="space-y-5">
            {!procId && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                {/* No celular, o título já está na barra do site: aqui fica só para leitores de tela. */}
                <div className="flex items-center gap-3 min-w-0 max-sm:sr-only">
                    <Link to={`${createPageUrl('Organization')}?id=${orgId}`} className="-m-3 inline-flex rounded-md p-3 text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:m-0 sm:p-0" aria-label="Voltar ao órgão">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-white truncate">Processo Eletrônico</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {org?.name || ''}
                            {estado.minhasUnidades.length > 0 && ` · lotado em ${estado.minhasUnidades.map((id) => estado.unidades.find((u) => u.id === id)?.nome).join(', ')}`}
                        </p>
                    </div>
                </div>
                {/* No celular, "Novo processo" vem primeiro e ocupa a linha; os demais ficam abaixo. */}
                {(
                    <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:gap-2">
                        <Button asChild variant="ghost" size="icon" aria-label="Ajuda do Processo Eletrônico">
                            <Link to={`${createPageUrl('Help')}#processo-eletronico`}><HelpCircle className="w-5 h-5" aria-hidden /></Link>
                        </Button>
                        <GuiaRito variante="ghost" />
                        {estado.minhasUnidades.length > 0 && <AvisosEquipe />}
                        {estado.isAdmin && (
                            <Button asChild variant="outline" className="gap-2 max-sm:px-3" aria-label="Configurar o Processo Eletrônico">
                                <Link to={`${createPageUrl('Organization')}?id=${orgId}&tab=admin&secao=secretaria`}><Settings className="w-4 h-4" aria-hidden /> <span className="max-sm:sr-only">Configurar</span></Link>
                            </Button>
                        )}
                        <NovoProcesso orgId={orgId} estado={estado} onCriado={abrir} semente={semente} onSementeUsada={usarSemente} />
                    </div>
                )}
            </div>
            )}
            {deId && estado.minhasUnidades.length === 0 && (
                <div role="alert" className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 p-3 text-sm text-amber-900 dark:text-amber-100">
                    Para criar um processo a partir de {ROTULO_REF[deModulo] ? `um registro de ${ROTULO_REF[deModulo].toLowerCase()}` : 'outro registro'}, você precisa estar lotado em uma unidade. Peça lotação na aba <b>Unidades</b>.
                </div>
            )}
            {!procId && estado.minhasUnidades.length === 0 && !estado.isAdmin && (
                <div role="status" className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/50 p-3 text-sm text-indigo-900 dark:text-indigo-100">
                    {comSessoes
                        ? <>Você não está lotado em nenhuma unidade, por isso não vê processos. As sessões dos colegiados que você compõe ficam na aba <b>Sessões</b>.</>
                        : <>Você ainda não está lotado em nenhuma unidade, por isso não vê processos. Peça lotação na aba <b>Unidades</b>.</>}
                </div>
            )}

            {!procId && <DisputasEmQueAtuo orgId={orgId} onAbrir={abrir} />}
            <Suspense fallback={<Carregando />}>
            {procId ? (
                <ProcessoView orgId={orgId} procId={procId} estado={estado} onVoltar={() => abrir(null)} />
            ) : (
                <Tabs value={aba} onValueChange={trocarAba}>
                    {/* No celular, as abas ficam numa linha só, que rola para o lado. */}
                    <TabsList className="h-auto max-w-full justify-start overflow-x-auto flex-nowrap sm:flex-wrap max-sm:pr-8 max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0">
                        {estado.minhasUnidades.length > 0 && (
                            <TabsTrigger value="meu" className="gap-2">
                                <ListChecks className="w-4 h-4" /> Meu trabalho
                                {meuTrabalho > 0 && <Badge className="ml-1 bg-indigo-600 hover:bg-indigo-600">{meuTrabalho}</Badge>}
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="caixa" className="gap-2"><Inbox className="w-4 h-4" /> Caixa da unidade</TabsTrigger>
                        {gabinetes.length > 0 && (
                            <TabsTrigger value="mesa" className="gap-2">
                                <Scale className="w-4 h-4" /> Mesa de decisão
                                {paraDecidir > 0 && <Badge className="ml-1 bg-amber-500 hover:bg-amber-500">{paraDecidir}</Badge>}
                            </TabsTrigger>
                        )}
                        {comSessoes && <TabsTrigger value="sessoes" className="gap-2"><CalendarDays className="w-4 h-4" /> Sessões</TabsTrigger>}
                        <TabsTrigger value="todos" className="gap-2"><Files className="w-4 h-4" /> Todos</TabsTrigger>
                        <TabsTrigger value="painel" className="gap-2"><LayoutDashboard className="w-4 h-4" /> Painel</TabsTrigger>
                        <TabsTrigger value="unidades" className="gap-2">
                            <Building2 className="w-4 h-4" /> Unidades
                            {pedidosPendentes > 0 && <Badge className="ml-1 bg-amber-500 hover:bg-amber-500">{pedidosPendentes}</Badge>}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="meu"><MeuTrabalho orgId={orgId} estado={estado} /></TabsContent>
                    <TabsContent value="caixa"><ListaProcessos orgId={orgId} escopo="caixa" estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="mesa"><MesaDecisao orgId={orgId} estado={estado} /></TabsContent>
                    <TabsContent value="sessoes">{comSessoes && <Sessoes orgId={orgId} onAbrir={abrir} />}</TabsContent>
                    <TabsContent value="todos"><ListaProcessos orgId={orgId} escopo="todos" estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="painel"><PainelSecretaria orgId={orgId} estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="unidades"><UnidadesDoUsuario orgId={orgId} estado={estado} /></TabsContent>
                </Tabs>
            )}
            </Suspense>
        </div>
        </ProvedorRegistros>
    );
}

const FILTROS_VAZIOS = { texto: '', situacao: 'todos', tipo: '', unidade: '', fase: '', status: '', sigilo: '', de: '', ate: '', ordem: 'recentes' };
// A busca, os filtros e a ordem ficam guardados enquanto a aba do navegador estiver aberta:
// abrir um processo e voltar não desfaz o que a pessoa montou.
const chaveFiltros = (orgId, escopo) => `pe-filtros-${orgId}-${escopo}`;
function filtrosGuardados(orgId, escopo) {
    try { return { ...FILTROS_VAZIOS, ...JSON.parse(sessionStorage.getItem(chaveFiltros(orgId, escopo)) || '{}') }; } catch { return FILTROS_VAZIOS; }
}
const ORDENS = [
    ['recentes', 'Mais recentes primeiro'],
    ['prazo', 'Prazo mais próximo'],
    ['parados', 'Há mais tempo na unidade'],
    ['antigos', 'Mais antigos primeiro'],
];
const porTexto = (a, b) => String(a || '').localeCompare(String(b || ''));
const ORDENAR = {
    // Sem prazo vai para o fim.
    prazo: (a, b) => porTexto(a.proximo_vencimento || '9999', b.proximo_vencimento || '9999'),
    parados: (a, b) => porTexto(a.recebido_em, b.recebido_em),
    antigos: (a, b) => porTexto(a.autuado_em, b.autuado_em),
};
const sel = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
// Busca sem acento: "joao" acha "João".
const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const Campo = ({ rotulo, children }) => (
    <label className="text-sm space-y-1"><span className="block text-slate-600 dark:text-slate-300">{rotulo}</span>{children}</label>
);

/** Processos excluídos (só o admin): quem excluiu, quando e por quê, com Restaurar. */
function ProcessosExcluidos({ orgId, estado, aberto, onFechar, onAbrir }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'excluidos'], queryFn: () => secProcesso(orgId, 'excluidos'), enabled: aberto });
    const [destino, setDestino] = useState({}); // id -> unidade escolhida
    const [restaurando, setRestaurando] = useState('');
    const ativas = estado.unidades.filter((u) => u.ativa);
    const restaurar = async (x) => {
        setRestaurando(x.id);
        try {
            await secProcesso(orgId, 'restaurar', { id: x.id, unidade_destino: destino[x.id] || undefined });
            toast.success(`Processo ${x.numero} restaurado`);
            await qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
            onAbrir(x.id);
        } catch (e) { toast.error(e?.message || 'Não foi possível restaurar'); } finally { setRestaurando(''); }
    };
    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Processos excluídos</DialogTitle>
                    <DialogDescription>Ficam fora das listas e do portal, com o termo de exclusão nos autos. Restaurar devolve o processo à situação e à unidade de antes.</DialogDescription>
                </DialogHeader>
                {q.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p>}
                {q.error && <ErroQuery q={q} />}
                {q.data && !q.data.processos.length && <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum processo excluído.</p>}
                <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(q.data?.processos || []).map((x) => {
                        const voltaPara = ativas.some((u) => u.id === x.unidade_anterior) ? x.unidade_anterior : '';
                        const escolhida = destino[x.id] ?? voltaPara;
                        return (
                            <li key={x.id} className="py-3 space-y-2 text-sm">
                                <div className="flex flex-wrap gap-x-3 items-baseline">
                                    <span className="font-mono text-indigo-700 dark:text-indigo-300">{x.numero}</span>
                                    <span className="font-medium flex-1 min-w-[10rem]">{x.assunto}</span>
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{x.em ? new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}{x.por ? ` · ${x.por}` : ''}</span>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300">Motivo: {x.motivo}</p>
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="text-xs space-y-1 flex-1 min-w-[12rem]">
                                        <span className="block text-slate-600 dark:text-slate-300">Volta para{voltaPara ? '' : ' (a unidade de antes não está ativa)'}</span>
                                        <select value={escolhida} onChange={(e) => setDestino({ ...destino, [x.id]: e.target.value })} className={`${sel} w-full`}>
                                            <option value="">Escolha a unidade…</option>
                                            {ativas.map((u) => <option key={u.id} value={u.id}>{unidadeComOrgao(estado, u.id)}</option>)}
                                        </select>
                                    </label>
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!!restaurando || !escolhida} onClick={() => restaurar(x)}>
                                        {restaurando === x.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" aria-hidden />} Restaurar
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </DialogContent>
        </Dialog>
    );
}

export function ListaProcessos({ orgId, escopo, estado, onAbrir }) {
    const [f, setF] = useState(() => filtrosGuardados(orgId, escopo));
    const [verExcluidos, setVerExcluidos] = useState(false);
    const ativosAvancados = ['tipo', 'unidade', 'fase', 'status', 'sigilo', 'de', 'ate'].filter((k) => f[k] !== FILTROS_VAZIOS[k]).length;
    const [avancado, setAvancado] = useState(ativosAvancados > 0);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    useEffect(() => {
        try { sessionStorage.setItem(chaveFiltros(orgId, escopo), JSON.stringify(f)); } catch { /* sem armazenamento: os filtros só não ficam guardados */ }
    }, [f, orgId, escopo]);
    // "/" leva o cursor à busca (fora de campos de texto), como nas caixas de e-mail.
    const busca = useRef(null);
    useEffect(() => {
        const tecla = (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
            if (!busca.current || busca.current.offsetParent === null) return;
            e.preventDefault();
            busca.current.focus();
            busca.current.select();
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, []);
    // Paginado pelo servidor, dos mais recentes para os mais antigos; os
    // filtros valem sobre o que já foi carregado ("Carregar mais" traz o resto).
    const q = useInfiniteQuery({
        queryKey: ['sec-processos', orgId, escopo, 'paginado'],
        queryFn: ({ pageParam }) => secProcesso(orgId, 'listar', { escopo, limite: PAGINA, cursor: pageParam || undefined }),
        initialPageParam: null,
        getNextPageParam: (ultima) => (ultima.mais ? ultima.cursor : undefined),
    });
    if (q.isLoading) return <div className="py-8 text-slate-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error && !q.data) return <ErroQuery q={q} />;
    const todos = q.data?.pages.flatMap((pg) => pg.processos) || [];
    const termo = norm(f.texto.trim());
    const termoDig = f.texto.replace(/\D/g, '');
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const fases = [...new Set(todos.map((p) => p.fase_nome).filter(Boolean))].sort();
    const lista = todos
        .filter((p) => !termo || norm(`${p.numero} ${p.assunto} ${p.tipo_nome || ''} ${p.partes_resumo || ''} ${p.campos_resumo || ''}`).includes(termo)
            || (termoDig.length >= 3 && String(p.partes_resumo || '').replace(/\D/g, '').includes(termoDig)))
        .filter((p) => !f.tipo || p.tipo_id === f.tipo)
        .filter((p) => !f.unidade || p.unidade_atual === f.unidade)
        .filter((p) => !f.fase || p.fase_nome === f.fase)
        .filter((p) => !f.status || p.status === f.status)
        .filter((p) => !f.sigilo || p.sigilo === f.sigilo)
        .filter((p) => !f.de || (p.autuado_em || '').slice(0, 10) >= f.de)
        .filter((p) => !f.ate || (p.autuado_em || '').slice(0, 10) <= f.ate)
        .filter((p) => f.situacao === 'todos'
            || (f.situacao === 'urgente' && p.urgente)
            || (f.situacao === 'pendencia' && p.pendencias_abertas > 0)
            || (f.situacao === 'vencido' && p.proximo_vencimento && p.proximo_vencimento < hoje)
            || (f.situacao === 'semdono' && !p.responsavel_uid && p.status === 'em_tramitacao')
            || (f.situacao === 'comigo' && p.responsavel_uid === estado.uid)
            || (f.situacao === 'prazo' && p.proximo_vencimento));
    if (ORDENAR[f.ordem]) lista.sort(ORDENAR[f.ordem]);
    // A ordem não é filtro: "Limpar filtros" não aparece só por causa dela.
    const ativos = Object.entries(f).filter(([k, v]) => k !== 'ordem' && v !== FILTROS_VAZIOS[k]).length;
    const limpar = () => setF((x) => ({ ...FILTROS_VAZIOS, ordem: x.ordem }));

    return (
        <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative min-w-0 flex-[1_1_calc(100%-6rem)] sm:flex-1 sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                    <Input ref={busca} type="search" placeholder="Número, assunto, parte ou CPF/CNPJ" aria-label="Buscar processos" aria-keyshortcuts="/" value={f.texto} onChange={(e) => set('texto', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape' && f.texto) { e.stopPropagation(); set('texto', ''); } }} className="pl-8 sm:pr-8" />
                    {!f.texto && <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 px-1.5 text-[11px] leading-5 text-slate-500 dark:border-slate-600 dark:text-slate-400 sm:block" aria-hidden>/</kbd>}
                </div>
                <select aria-label="Filtrar por situação" value={f.situacao} onChange={(e) => set('situacao', e.target.value)} className={`${sel} max-sm:order-2 max-sm:min-w-0 max-sm:flex-[1_1_40%]`}>
                    <option value="todos">Qualquer situação</option>
                    <option value="urgente">Urgentes</option>
                    <option value="comigo">Comigo</option>
                    <option value="semdono">Sem responsável</option>
                    <option value="pendencia">Com pendência para o decisor</option>
                    <option value="prazo">Com prazo aberto</option>
                    <option value="vencido">Com prazo vencido</option>
                </select>
                <Button variant="outline" size="sm" className="gap-2 max-sm:order-1 max-sm:h-9 max-sm:shrink-0" title="Mais filtros" aria-expanded={avancado} onClick={() => setAvancado((v) => !v)}>
                    <SlidersHorizontal className="w-4 h-4" aria-hidden /> <span className="max-sm:sr-only">Mais filtros</span>{ativosAvancados > 0 && <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1 bg-indigo-600 hover:bg-indigo-600">{ativosAvancados}</Badge>}
                </Button>
                <select aria-label="Ordenar a lista" value={f.ordem} onChange={(e) => set('ordem', e.target.value)} className={`${sel} max-sm:order-2 max-sm:min-w-0 max-sm:flex-[1_1_40%]`}>
                    {ORDENS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {ativos > 0 && (
                    <Button variant="ghost" size="sm" className="gap-1 max-sm:order-3" onClick={limpar}><X className="w-4 h-4" aria-hidden /> Limpar filtros</Button>
                )}
                <span className={`text-sm text-slate-600 dark:text-slate-400 ml-auto max-sm:order-3 ${ativos > 0 || q.hasNextPage ? '' : 'max-sm:sr-only'}`} aria-live="polite">{lista.length} de {todos.length}{q.hasNextPage ? ' carregados' : ''}</span>
                {escopo === 'todos' && estado.isAdmin && (
                    <Button variant="ghost" size="sm" className="gap-1 max-sm:order-3" onClick={() => setVerExcluidos(true)}><Trash2 className="w-4 h-4" aria-hidden /> Excluídos</Button>
                )}
            </div>
            {escopo === 'todos' && estado.isAdmin && <ProcessosExcluidos orgId={orgId} estado={estado} aberto={verExcluidos} onFechar={() => setVerExcluidos(false)} onAbrir={(id) => { setVerExcluidos(false); onAbrir(id); }} />}
            {avancado && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/50">
                    <Campo rotulo="Unidade atual">
                        <select value={f.unidade} onChange={(e) => set('unidade', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todas</option>
                            {estado.unidades.map((u) => <option key={u.id} value={u.id}>{unidadeComOrgao(estado, u.id)}</option>)}
                        </select>
                    </Campo>
                    <Campo rotulo="Fase">
                        <select value={f.fase} onChange={(e) => set('fase', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todas</option>
                            {fases.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </Campo>
                    <Campo rotulo="Tipo de processo">
                        <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todos</option>
                            {(estado.tipos || []).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                            {(estado.tipos_excluidos || []).map((t) => <option key={t.id} value={t.id}>{t.nome} (excluído)</option>)}
                        </select>
                    </Campo>
                    <Campo rotulo="Status">
                        <select value={f.status} onChange={(e) => set('status', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todos</option>
                            {Object.entries(STATUS_ROTULO).filter(([k]) => k !== 'excluido').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Campo>
                    <Campo rotulo="Sigilo">
                        <select value={f.sigilo} onChange={(e) => set('sigilo', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todos</option>
                            <option value="normal">Normal</option>
                            <option value="restrito">Restrito</option>
                        </select>
                    </Campo>
                    <Campo rotulo="Autuado de"><Input type="date" value={f.de} onChange={(e) => set('de', e.target.value)} /></Campo>
                    <Campo rotulo="Autuado até"><Input type="date" value={f.ate} onChange={(e) => set('ate', e.target.value)} /></Campo>
                </div>
            )}
            {lista.length === 0 ? (
                <div className="py-8 text-slate-600 dark:text-slate-400 space-y-2">
                    <p>{todos.length && ativos ? 'Nenhum processo com esses filtros.' : escopo === 'caixa' ? 'Nenhum processo com as suas unidades.' : 'Nenhum processo visível para você.'}</p>
                    {todos.length > 0 && ativos > 0 && <Button variant="outline" size="sm" onClick={limpar}>Limpar filtros</Button>}
                    {todos.length > 0 && ativos > 0 && q.hasNextPage && <p className="text-sm">A busca olhou só os {todos.length} processos já carregados. Use <b>Carregar mais</b>, abaixo, para procurar nos anteriores.</p>}
                    {!todos.length && escopo === 'caixa' && estado.minhasUnidades.length > 0 && <p className="text-sm">Use <b>Novo processo</b> acima para autuar o primeiro.</p>}
                    {!todos.length && !estado.minhasUnidades.length && <p className="text-sm">Peça lotação em uma unidade na aba <b>Unidades</b>.</p>}
                </div>
            ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {lista.map((p) => <LinhaProcesso key={p.id} p={p} estado={estado} orgId={orgId} hoje={hoje} tempo={escopo === 'caixa'} />)}
                </div>
            )}
            {q.hasNextPage && (
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} className="gap-2">
                        {q.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Carregar mais {PAGINA}
                    </Button>
                    {ativos > 0 && <span className="text-xs text-slate-600 dark:text-slate-400">Os filtros valem só sobre o que já foi carregado.</span>}
                </div>
            )}
        </div>
    );
}

/** Unidade da primeira fase do rito, se está entre as permitidas (as da pessoa, para o tipo). */
function unidadeDaPrimeiraFase(rito, permitidas) {
    const u = rito?.fases?.[0]?.unidade_id;
    return u && permitidas.includes(u) ? u : '';
}

/** Processos por página na lista (o servidor aceita até 200). */
const PAGINA = 100;

const MAX_MB_ANEXO = MAX_ENVIO_MB;
const MAX_ANEXOS = 10;

function NovoProcesso({ orgId, estado, onCriado, semente = null, onSementeUsada }) {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    // Arquivos detalhados (tipo, do que se trata, juntar/guardar/minuta) que entram logo depois de autuar.
    const [anexos, setAnexos] = useState([]);
    const [detalhando, setDetalhando] = useState(null); // {inicio, itens, troca?}
    const ritosAtivos = estado.ritos.filter((r) => r.ativo);
    // Rito que só se autua por tipo não aparece em "Sem tipo".
    const ritosSemTipo = ritosAtivos.filter((r) => !r.exigir_tipo);
    // Tipo próprio de um órgão interno: só aparece para quem está lotado em unidade dele.
    const orgaoDe = (unidadeId) => estado.unidades.find((u) => u.id === unidadeId)?.orgao_id || null;
    const restrito = (t) => (t?.orgao_id && (estado.orgaos || []).some((o) => o.id === t.orgao_id) ? t.orgao_id : null);
    const unidadesPara = (t) => estado.minhasUnidades.filter((id) => !restrito(t) || orgaoDe(id) === restrito(t));
    const tiposAtivos = (estado.tipos || []).filter((t) => t.ativo && ritosAtivos.some((r) => r.id === t.rito_id) && unidadesPara(t).length > 0);
    const vazio = { assunto: '', descricao: '', tipo_id: '', rito_id: ritosSemTipo[0]?.id || '', unidade_id: estado.minhasUnidades[0] || '', sigilo: 'normal', urgente: false, motivo_urgencia: '', origem: { tipo: '', descricao: '' }, partes: [], campos: {} };
    const [f, setF] = useState(vazio);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    // Escolher o tipo preenche rito, sigilo e unidade sugerida (se a pessoa está lotada nela).
    const escolherTipo = (id) => {
        const t = tiposAtivos.find((x) => x.id === id);
        // Polo que o novo tipo não aceita vira o que ele aceita (o mesmo que o servidor faria recusar).
        const polos = formularioDe(t).polos;
        const reserva = polos.includes('interessado') ? 'interessado' : polos[0];
        setF((x) => ({
            // Campos de registro do mesmo módulo da origem já vêm com ela.
            ...x, tipo_id: id, campos: camposDaOrigem(formularioDe(t), x.origem?.ref), partes: x.partes.map((pa) => (polos.includes(pa.polo) ? pa : { ...pa, polo: reserva })),
            ...(t ? {
                rito_id: t.rito_id, sigilo: t.sigilo_padrao, urgente: t.urgente === true,
                // Unidade: a que o tipo indica; senão a da primeira fase do rito; senão a que já estava.
                ...(t.unidade_inicial && unidadesPara(t).includes(t.unidade_inicial) ? { unidade_id: t.unidade_inicial }
                    : unidadeDaPrimeiraFase(ritosAtivos.find((r) => r.id === t.rito_id), unidadesPara(t)) ? { unidade_id: unidadeDaPrimeiraFase(ritosAtivos.find((r) => r.id === t.rito_id), unidadesPara(t)) }
                        : unidadesPara(t).includes(x.unidade_id) ? {} : { unidade_id: unidadesPara(t)[0] }),
            } : ritosSemTipo.some((r) => r.id === x.rito_id) ? {} : { rito_id: ritosSemTipo[0]?.id || '' }),
        }));
    };
    // Sem tipo: trocar o rito leva a unidade para a da primeira fase dele, se a pessoa está lotada lá.
    const escolherRito = (id) => setF((x) => {
        const u = unidadeDaPrimeiraFase(estado.ritos.find((r) => r.id === id), estado.minhasUnidades);
        return { ...x, rito_id: id, ...(u ? { unidade_id: u } : {}) };
    });
    // Ao abrir sem nada preenchido: o tipo usado da última vez neste órgão; sem isso, o único tipo que
    // existe. Quem autuou sem tipo da última vez continua sem tipo. A pessoa troca à vontade.
    const abrirNovo = () => {
        setAberto(true);
        if (f.tipo_id || f.assunto || f.origem?.ref) return;
        let ultimo = '';
        try { ultimo = localStorage.getItem(`pe-ultimo-tipo-${orgId}`) || ''; } catch { /* sem armazenamento */ }
        const sugerido = tiposAtivos.find((t) => t.id === ultimo) || (tiposAtivos.length === 1 && ultimo !== '-' ? tiposAtivos[0] : null);
        if (sugerido) escolherTipo(sugerido.id);
        else escolherRito(f.rito_id);
    };
    const tipoSel = tiposAtivos.find((t) => t.id === f.tipo_id);
    const ritoSel = estado.ritos.find((r) => r.id === f.rito_id);
    // Unidade da primeira fase do rito (se existe e está ativa): onde o processo começa a andar.
    const primeiraUnidade = estado.unidades.some((u) => u.id === ritoSel?.fases?.[0]?.unidade_id && u.ativa) ? ritoSel.fases[0].unidade_id : '';
    // Formulário do tipo: o que é obrigatório, o que não se usa e os campos próprios.
    const form = formularioDe(tipoSel);
    const falta = faltando(form, f);
    // Avisos do que falta só depois que a pessoa começou a preencher.
    const tocado = JSON.stringify({ ...f, tipo_id: '', rito_id: '', unidade_id: '', sigilo: '', urgente: false }) !== JSON.stringify({ ...vazio, tipo_id: '', rito_id: '', unidade_id: '', sigilo: '', urgente: false });
    // Numeração: a do tipo, a do órgão ou nenhuma; mostra o formato.
    const numTipo = tipoSel?.numeracao || { modo: 'orgao' };
    const numeracao = numTipo.modo === 'nenhuma' ? null : numTipo.modo === 'propria' ? numTipo : estado.numeracao || NUMERACAO_PADRAO;
    const unidadeSel = estado.unidades.find((u) => u.id === f.unidade_id);
    const tiposDoc = documentoDaUnidade(estado, f.unidade_id).tipos_documento || [];
    const ctxNumero = {
        hoje: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), tipo: tipoSel, unidade: unidadeSel,
        orgao: (estado.orgaos || []).find((o) => o.id === unidadeSel?.orgao_id),
    };
    const exemploNumero = numeracao && formatarNumero(numeracao, ctxNumero, 1);
    // Número com código e item sem código: o servidor recusa a autuação; avisa antes.
    const semCodigo = numeracao && unidadeSel ? codigosFaltando(numeracao, ctxNumero) : [];

    // Nascendo de um registro: origem, assunto e, se só um tipo é sugerido para esse módulo, o tipo.
    const sugeridosDe = (t, ref) => !!ref && (t.pode_nascer_de || []).includes(ref.modulo);
    const sugeridos = semente ? tiposAtivos.filter((t) => (t.pode_nascer_de || []).includes(semente.modulo)) : [];
    useEffect(() => {
        if (!semente || estado.minhasUnidades.length === 0) return;
        // O título vira o assunto só se as partes podem vê-lo: não de outro processo (pode ser sigiloso), de registro restrito ou do júri (é a comarca).
        const assunto = ['consultas', 'expedientes', 'parcerias'].includes(semente.modulo) && !semente.restrito ? semente.titulo || '' : '';
        setF({ ...vazio, assunto, origem: { tipo: semente.modulo === 'pe' ? 'outro_processo' : '', descricao: '', ref: semente } });
        // Aberto pela ação "Abrir processo derivado": o tipo que o rito sugere, pelo nome dele ou pelo nome do rito que ele usa.
        const igual = (n) => semAcento(n).trim() === semAcento(semente.tipo_nome).trim();
        const pedido = semente.tipo_nome ? tiposAtivos.filter((t) => igual(t.nome) || igual(ritosAtivos.find((r) => r.id === t.rito_id)?.nome)) : [];
        if (pedido.length === 1) escolherTipo(pedido[0].id);
        else if (sugeridos.length === 1) escolherTipo(sugeridos[0].id);
        setAberto(true);
        onSementeUsada?.();
    }, [semente?.modulo, semente?.id]);

    if (estado.minhasUnidades.length === 0) return null; // só quem está lotado autua

    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secProcesso(orgId, 'autuar', f);
            try { localStorage.setItem(`pe-ultimo-tipo-${orgId}`, f.tipo_id || '-'); } catch { /* sem armazenamento */ }
            // Os arquivos entram como foram detalhados (juntados, guardados ou minutas), um a um e na
            // ordem, com a data e a hora de agora; falha num não desfaz a autuação nem os anteriores.
            const env = anexos.length ? await enviarDetalhados(orgId, r.id, anexos) : { falhou: null };
            if (env.falhou) {
                const resto = anexos.slice(env.feitos.length).map((d) => d.titulo || d.file.name);
                toast.warning(`Processo ${r.numero} autuado. Não entrou: ${resto.join(', ')} (${env.erro}). Envie no processo, em Novo documento.`);
            } else toast.success(`Processo ${r.numero} autuado${anexos.length ? ` com ${anexos.length} ${anexos.length === 1 ? 'documento' : 'documentos'}` : ''}`);
            qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
            setAberto(false);
            setF(vazio);
            setAnexos([]);
            onCriado(r.id);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível autuar');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => { setAberto(o); if (!o && f.origem?.ref) setF(vazio); }}>
            <Button className="gap-2 max-sm:order-first max-sm:w-full" onClick={abrirNovo}><Plus className="w-4 h-4" aria-hidden /> Novo processo</Button>
            <DialogContent onOpenAutoFocus={focoSemAjuda} className="max-w-2xl p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden max-sm:max-w-none max-sm:w-screen max-sm:h-[100dvh] max-sm:max-h-none max-sm:rounded-none">
                <DialogHeader className="px-4 pt-4 pr-12 pb-3 sm:px-6"><div className="flex items-center justify-center gap-1 sm:justify-start"><DialogTitle>Autuar processo</DialogTitle><AjudaTermo id="autuar" /></div></DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-4 space-y-4">
                    {tiposAtivos.length > 0 && (
                        <div>
                            <NativeSelect id="sec-tipo" label="Tipo de processo" value={f.tipo_id} onChange={escolherTipo}
                                options={[['', ritosSemTipo.length ? 'Sem tipo (escolher o rito)' : 'Escolha o tipo…'], ...tiposAtivos.map((t) => [t.id, `${t.sigla ? `${t.nome} (${t.sigla})` : t.nome}${sugeridosDe(t, f.origem?.ref) ? ' (sugerido)' : ''}`])]} />
                            {tipoSel?.descricao && <p className="text-xs text-slate-600 mt-1">{tipoSel.descricao}</p>}
                        </div>
                    )}
                    <FormularioAutuacao form={form} f={f} setF={setF} tipo={tipoSel || null} origens={estado.listas?.origem}
                        unidades={unidadesPara(tipoSel).map((id) => [id, unidadeComOrgao(estado, id)])}
                        rito={tipoSel
                            ? <div><Label>Rito</Label><p className="mt-1 h-9 flex items-center text-sm text-slate-700 dark:text-slate-300">{ritoSel?.nome}</p></div>
                            : ritosSemTipo.length
                                ? <NativeSelect id="sec-rito" label="Rito" value={f.rito_id} onChange={escolherRito} options={ritosSemTipo.map((r) => [r.id, r.nome])} />
                                : <div><Label>Rito</Label><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{!ritosAtivos.length
                                    ? 'Nenhum rito ativo neste órgão. Peça ao administrador que ative um rito.'
                                    : !tiposAtivos.length
                                        ? 'Os ritos deste órgão são autuados por tipo de processo, e nenhum tipo está disponível para as suas unidades. Fale com o administrador.'
                                        : 'Os ritos deste órgão são autuados por tipo de processo: escolha o tipo.'}</p></div>} />
                    {primeiraUnidade && primeiraUnidade !== f.unidade_id && (
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-100" role="status">
                            <span className="min-w-0 flex-1">A primeira fase deste rito ({ritoSel.fases[0].nome}) corre em <b>{unidadeComOrgao(estado, primeiraUnidade)}</b>, e você está autuando em {unidadeComOrgao(estado, f.unidade_id)}.</span>
                            {unidadesPara(tipoSel).includes(primeiraUnidade) && <Button type="button" size="sm" variant="outline" className="h-8 bg-white dark:bg-slate-900" onClick={() => set('unidade_id', primeiraUnidade)}>Autuar em {estado.unidades.find((u) => u.id === primeiraUnidade)?.sigla || estado.unidades.find((u) => u.id === primeiraUnidade)?.nome}</Button>}
                        </p>
                    )}
                    {ritoSel && (
                        <details className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <summary className="text-sm cursor-pointer">Ver o fluxo do rito ({ritoSel.fases.length} fases)</summary>
                            <FluxoRito fases={ritoSel.fases} unidades={estado.unidades} className="mt-2" />
                        </details>
                    )}
                    <div>
                        <Label htmlFor="sec-anexos">Arquivos (opcional)</Label>
                        <EscolherArquivo id="sec-anexos" multiple className="mt-1" accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.odt,.xlsx" aria-describedby="sec-anexos-ajuda"
                            onArquivos={(novos) => {
                                const grandes = novos.filter((x) => x.size > MAX_MB_ANEXO * 1024 * 1024);
                                if (grandes.length) toast.error(`Acima de ${MAX_MB_ANEXO} MB: ${grandes.map((x) => x.name).join(', ')}`);
                                const cabem = novos.filter((x) => x.size <= MAX_MB_ANEXO * 1024 * 1024).slice(0, Math.max(0, MAX_ANEXOS - anexos.length));
                                if (novos.length - grandes.length > cabem.length) toast.error(`Só cabem ${MAX_ANEXOS} arquivos na autuação. Os demais você envia no processo, em Novo documento.`);
                                // Cada arquivo é detalhado na hora: tipo, do que se trata, data, juntar ou guardar, assinatura.
                                if (cabem.length) setDetalhando({ inicio: anexos.length, itens: cabem.map((x) => detalheInicial(x, tiposDoc[0] || 'Documento')) });
                            }} />
                        <p id="sec-anexos-ajuda" className="text-xs text-slate-600 dark:text-slate-400 mt-1">Até {MAX_ANEXOS} arquivos de até {MAX_MB_ANEXO} MB. Ao escolher, você diz o tipo, do que se trata e se o documento é juntado aos autos, guardado fora deles ou fica como minuta. Ao autuar, eles entram nessa ordem, com a data e a hora da autuação.</p>
                        {anexos.length > 0 && (
                            <ul className="mt-2 space-y-1">
                                {anexos.map((a, i) => (
                                    <li key={`${a.file.name}-${i}`} className="flex items-center gap-2 text-sm">
                                        <Paperclip className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />
                                        <span className="flex-1 min-w-0"><span className="block truncate">{a.titulo}</span><span className="block text-xs text-slate-600 dark:text-slate-400 truncate">{resumoDetalhe(a)}</span></span>
                                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" aria-label={`Detalhar ${a.titulo}`} onClick={() => setDetalhando({ inicio: i, itens: [a], troca: true })}>Detalhar</Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Tirar ${a.titulo}`} onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}><X className="w-4 h-4" aria-hidden /></Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <DetalharDocumentos aberto={!!detalhando} itens={detalhando?.itens} tipos={tiposDoc} naAutuacao
                            onFechar={() => setDetalhando(null)}
                            onConfirmar={(itens) => {
                                setAnexos((a) => (detalhando.troca ? a.map((x, j) => (j === detalhando.inicio ? itens[0] : x)) : [...a, ...itens]));
                                setDetalhando(null);
                            }} />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{exemploNumero ? <>Número no formato <b className="font-mono">{exemploNumero}</b>, dado ao autuar.</> : 'Este tipo de processo não tem número: recebe um identificador (SN-…).'}</p>
                    {semCodigo.length > 0 && (
                        <p className="text-sm text-amber-800 dark:text-amber-300" role="status">
                            O número deste processo usa o código numérico de {semCodigo.join(' e ')}, que ainda não foi cadastrado (ou tem mais dígitos que o número aceita). Peça ao administrador para cadastrá-lo em Configuração, Tipos de processo, Códigos.
                        </p>
                    )}
                    {tocado && falta.length > 0 && (
                        <p className="text-sm text-amber-800 dark:text-amber-300" role="status">Para autuar: {falta.join('; ')}.</p>
                    )}
                </div>
                <DialogFooter className="border-t border-slate-200 dark:border-slate-700 px-4 pt-3 sm:px-6 flex-row justify-end gap-2 sm:space-x-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !f.rito_id || falta.length > 0 || semCodigo.length > 0}>
                        {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Autuar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Ativa o PE da própria página desativada (o servidor confere que é admin). */
function AtivarAgora({ orgId }) {
    const qc = useQueryClient();
    const [salvando, setSalvando] = useState(false);
    const ativar = async () => {
        setSalvando(true);
        try {
            await secConfig(orgId, 'ativar', { enabled: true });
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            toast.success('Processo Eletrônico ativado');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível ativar');
        } finally { setSalvando(false); }
    };
    return (
        <Button onClick={ativar} disabled={salvando} className="gap-1">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {salvando ? 'Ativando…' : 'Ativar agora'}
        </Button>
    );
}
