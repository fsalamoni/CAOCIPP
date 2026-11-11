import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Gavel, HelpCircle, Inbox, ListChecks, Loader2, Plus, Scale, Settings, Files, LayoutDashboard, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createPageUrl } from '@/utils';
import { useOrganizations, useOrganizationRealtime } from '@/hooks/useFirestore';
import { useOrganizationTabs } from '@/hooks/useOrganizationTabs';
import { PROCESSO_ELETRONICO_TAB } from '@/lib/organizationModules';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import OrgTabBar from '@/components/organization/OrgTabBar';
import { secConfig, secProcesso } from '@/services/secretariaService';
import ProcessoView from '@/components/secretaria/ProcessoView';
import ErroQuery from '@/components/secretaria/ErroQuery';
import AvisosEquipe from '@/components/secretaria/AvisosEquipe';
import UnidadesDoUsuario, { ConviteEquipe } from '@/components/secretaria/UnidadesDoUsuario';
import FluxoRito from '@/components/secretaria/FluxoRito';
import { CamposProcesso } from '@/components/secretaria/CamposProcesso';
import { faltando, formularioDe } from '@/lib/camposProcesso';
import { unidadeComOrgao } from '@/lib/orgaos';
import PainelSecretaria from '@/components/secretaria/PainelSecretaria';
import MeuTrabalho, { MesaDecisao, gruposDeTrabalho } from '@/components/secretaria/MeuTrabalho';
import { ORIGENS, STATUS_ROTULO, NativeSelect, SeloUrgente } from '@/components/secretaria/comum';

export default function ProcessoEletronico() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const orgId = params.get('org');
    const tokenEquipe = params.get('equipe');
    const procId = params.get('p');
    const { organizations } = useOrganizations();
    const org = organizations.find((o) => o.id === orgId);
    // Mesma barra de páginas do órgão (Novo design V2), com o Processo
    // Eletrônico marcado: dá para ir às outras páginas sem voltar ao órgão.
    const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
    const { organization: orgAoVivo, resolvedId } = useOrganizationRealtime(orgId);
    const orgTabs = useOrganizationTabs(resolvedId === orgId ? orgAoVivo : null, { role: org?.userRole, permissions: org?.userPermissions });
    const barra = isV2 && <OrgTabBar tabs={orgTabs} activeTab={PROCESSO_ELETRONICO_TAB} orgId={orgId} />;
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
    });
    const estado = estadoQ.data;
    // Mesma consulta da caixa: alimenta as contagens das abas "Meu trabalho" e "Mesa de decisão".
    const caixaQ = useQuery({
        queryKey: ['sec-processos', orgId, 'caixa'],
        queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }),
        enabled: !!estado?.enabled && !estado.suspensa_plataforma && estado.minhasUnidades.length > 0,
    });

    const abrir = (id) => {
        const next = new URLSearchParams(params);
        if (id) next.set('p', id); else next.delete('p');
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
                        ? 'Ative e configure o módulo no Painel Administrativo do órgão, seção Processo Eletrônico.'
                        : 'Peça ao administrador do órgão para ativar o Processo Eletrônico.'}
                </p>
                {/* Quem não é admin não vê o Painel Administrativo: vai para a página inicial do órgão. */}
                <Button variant="outline" onClick={() => navigate(`${createPageUrl('Organization')}?id=${orgId}${estado?.isAdmin ? '&tab=admin&secao=secretaria' : ''}`)}>
                    {estado?.isAdmin ? 'Abrir a configuração' : 'Ir para o órgão'}
                </Button>
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
    const gabinetes = estado.unidades.filter((u) => u.tipo === 'gabinete' && estado.minhasUnidades.includes(u.id)).map((u) => u.id);
    const paraDecidir = gabinetes.length ? caixa.filter((p) => gabinetes.includes(p.unidade_atual)).reduce((n, p) => n + (p.pendencias_abertas || 0), 0) : 0;

    const abaPadrao = estado.minhasUnidades.length ? 'meu' : estado.isAdmin ? 'todos' : 'unidades';
    const abasValidas = ['caixa', 'todos', 'painel', 'unidades', ...(estado.minhasUnidades.length ? ['meu'] : []), ...(gabinetes.length ? ['mesa'] : [])];
    const aba = abasValidas.includes(abaUrl) ? abaUrl : abaPadrao;

    return (
        <>
        {barra}
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Link to={`${createPageUrl('Organization')}?id=${orgId}`} className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Voltar ao órgão">
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
                {!procId && (
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="ghost" size="icon" aria-label="Ajuda do Processo Eletrônico">
                            <Link to={`${createPageUrl('Help')}#processo-eletronico`}><HelpCircle className="w-5 h-5" aria-hidden /></Link>
                        </Button>
                        {estado.minhasUnidades.length > 0 && <AvisosEquipe />}
                        {estado.isAdmin && (
                            <Button asChild variant="outline" className="gap-2">
                                <Link to={`${createPageUrl('Organization')}?id=${orgId}&tab=admin&secao=secretaria`}><Settings className="w-4 h-4" aria-hidden /> Configurar</Link>
                            </Button>
                        )}
                        <NovoProcesso orgId={orgId} estado={estado} onCriado={abrir} />
                    </div>
                )}
            </div>
            {!procId && estado.minhasUnidades.length === 0 && !estado.isAdmin && (
                <div role="status" className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/50 p-3 text-sm text-indigo-900 dark:text-indigo-100">
                    Você ainda não está lotado em nenhuma unidade, por isso não vê processos. Peça lotação na aba <b>Unidades</b>.
                </div>
            )}

            {procId ? (
                <ProcessoView orgId={orgId} procId={procId} estado={estado} onVoltar={() => abrir(null)} />
            ) : (
                <Tabs value={aba} onValueChange={trocarAba}>
                    <TabsList className="flex-wrap h-auto">
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
                        <TabsTrigger value="todos" className="gap-2"><Files className="w-4 h-4" /> Todos</TabsTrigger>
                        <TabsTrigger value="painel" className="gap-2"><LayoutDashboard className="w-4 h-4" /> Painel</TabsTrigger>
                        <TabsTrigger value="unidades" className="gap-2">
                            <Building2 className="w-4 h-4" /> Unidades
                            {pedidosPendentes > 0 && <Badge className="ml-1 bg-amber-500 hover:bg-amber-500">{pedidosPendentes}</Badge>}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="meu"><MeuTrabalho orgId={orgId} estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="caixa"><ListaProcessos orgId={orgId} escopo="caixa" estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="mesa"><MesaDecisao orgId={orgId} estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="todos"><ListaProcessos orgId={orgId} escopo="todos" estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="painel"><PainelSecretaria orgId={orgId} estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="unidades"><UnidadesDoUsuario orgId={orgId} estado={estado} /></TabsContent>
                </Tabs>
            )}
        </div>
        </>
    );
}

const FILTROS_VAZIOS = { texto: '', situacao: 'todos', tipo: '', unidade: '', fase: '', status: '', sigilo: '', de: '', ate: '' };
const sel = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
// Busca sem acento: "joao" acha "João".
const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const Campo = ({ rotulo, children }) => (
    <label className="text-sm space-y-1"><span className="block text-slate-600 dark:text-slate-300">{rotulo}</span>{children}</label>
);

export function ListaProcessos({ orgId, escopo, estado, onAbrir }) {
    const [f, setF] = useState(FILTROS_VAZIOS);
    const [avancado, setAvancado] = useState(false);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
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
            || (f.situacao === 'prazo' && p.proximo_vencimento));
    const nomeUnidade = (id) => unidadeComOrgao(estado, id);
    const nomeMembro = (uid) => estado.membros.find((m) => m.uid === uid)?.nome;
    const ativos = Object.entries(f).filter(([k, v]) => v !== FILTROS_VAZIOS[k]).length;

    return (
        <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="Número, assunto, parte ou CPF/CNPJ" aria-label="Buscar processos" value={f.texto} onChange={(e) => set('texto', e.target.value)} className="max-w-sm" />
                <select aria-label="Filtrar por situação" value={f.situacao} onChange={(e) => set('situacao', e.target.value)} className={sel}>
                    <option value="todos">Qualquer situação</option>
                    <option value="urgente">Urgentes</option>
                    <option value="pendencia">Com pendência para o decisor</option>
                    <option value="prazo">Com prazo aberto</option>
                    <option value="vencido">Com prazo vencido</option>
                </select>
                <Button variant="outline" size="sm" className="gap-2" aria-expanded={avancado} onClick={() => setAvancado((v) => !v)}>
                    <SlidersHorizontal className="w-4 h-4" /> Mais filtros
                </Button>
                {ativos > 0 && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => setF(FILTROS_VAZIOS)}><X className="w-4 h-4" /> Limpar filtros</Button>
                )}
                <span className="text-sm text-slate-600 dark:text-slate-400 ml-auto" aria-live="polite">{lista.length} de {todos.length}{q.hasNextPage ? ' carregados' : ''}</span>
            </div>
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
                        </select>
                    </Campo>
                    <Campo rotulo="Status">
                        <select value={f.status} onChange={(e) => set('status', e.target.value)} className={`${sel} w-full`}>
                            <option value="">Todos</option>
                            {Object.entries(STATUS_ROTULO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                    {todos.length > 0 && ativos > 0 && <Button variant="outline" size="sm" onClick={() => setF(FILTROS_VAZIOS)}>Limpar filtros</Button>}
                    {!todos.length && escopo === 'caixa' && estado.minhasUnidades.length > 0 && <p className="text-sm">Use <b>Novo processo</b> acima para autuar o primeiro.</p>}
                    {!todos.length && !estado.minhasUnidades.length && <p className="text-sm">Peça lotação em uma unidade na aba <b>Unidades</b>.</p>}
                </div>
            ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {lista.map((p) => (
                        <button key={p.id} onClick={() => onAbrir(p.id)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-wrap gap-x-6 gap-y-1 items-baseline">
                            <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300">{p.numero}</span>
                            <span className="font-medium text-slate-900 dark:text-white flex-1 min-w-[12rem]">{p.assunto}{p.tipo_nome && <span className="ml-2 text-xs font-normal text-slate-600">{p.tipo_nome}</span>}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-400">{p.fase_nome} · {nomeUnidade(p.unidade_atual)}{p.responsavel_uid ? ` · ${nomeMembro(p.responsavel_uid) || ''}` : ''}</span>
                            {p.urgente && <SeloUrgente motivo={p.urgencia?.motivo} />}
                            <Badge variant={p.status === 'em_tramitacao' ? 'secondary' : 'outline'}>{STATUS_ROTULO[p.status]}</Badge>
                            {p.sigilo === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                            {p.pendencias_abertas > 0 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">{p.pendencias_abertas} pendência{p.pendencias_abertas > 1 ? 's' : ''}{p.fase_suspensa ? ' · fase interrompida' : ''}</Badge>}
                            {p.proximo_vencimento && (
                                <Badge variant="outline" className={p.proximo_vencimento < hoje ? 'border-red-400 text-red-700 dark:text-red-300' : ''}>
                                    Prazo {p.proximo_vencimento < hoje ? 'vencido' : 'vence'} {p.proximo_vencimento.split('-').reverse().join('/')}
                                </Badge>
                            )}
                        </button>
                    ))}
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

/** Processos por página na lista (o servidor aceita até 200). */
const PAGINA = 100;

function NovoProcesso({ orgId, estado, onCriado }) {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const ritosAtivos = estado.ritos.filter((r) => r.ativo);
    // Tipo próprio de um órgão interno: só aparece para quem está lotado em unidade dele.
    const orgaoDe = (unidadeId) => estado.unidades.find((u) => u.id === unidadeId)?.orgao_id || null;
    const restrito = (t) => (t?.orgao_id && (estado.orgaos || []).some((o) => o.id === t.orgao_id) ? t.orgao_id : null);
    const unidadesPara = (t) => estado.minhasUnidades.filter((id) => !restrito(t) || orgaoDe(id) === restrito(t));
    const tiposAtivos = (estado.tipos || []).filter((t) => t.ativo && ritosAtivos.some((r) => r.id === t.rito_id) && unidadesPara(t).length > 0);
    const vazio = { assunto: '', descricao: '', tipo_id: '', rito_id: ritosAtivos[0]?.id || '', unidade_id: estado.minhasUnidades[0] || '', sigilo: 'normal', urgente: false, motivo_urgencia: '', origem: { tipo: '', descricao: '' }, partes: [], campos: {} };
    const [f, setF] = useState(vazio);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    // Escolher o tipo preenche rito, sigilo e unidade sugerida (se a pessoa está lotada nela).
    const escolherTipo = (id) => {
        const t = tiposAtivos.find((x) => x.id === id);
        setF((x) => ({
            ...x, tipo_id: id, campos: {},
            ...(t ? {
                rito_id: t.rito_id, sigilo: t.sigilo_padrao, urgente: t.urgente === true,
                ...(t.unidade_inicial && unidadesPara(t).includes(t.unidade_inicial) ? { unidade_id: t.unidade_inicial }
                    : unidadesPara(t).includes(x.unidade_id) ? {} : { unidade_id: unidadesPara(t)[0] }),
            } : {}),
        }));
    };
    const tipoSel = tiposAtivos.find((t) => t.id === f.tipo_id);
    const ritoSel = estado.ritos.find((r) => r.id === f.rito_id);
    // Formulário do tipo: o que é obrigatório, o que não se usa e os campos próprios.
    const form = formularioDe(tipoSel);
    const falta = faltando(form, f);
    const req = (uso) => (uso === 'obrigatorio' ? <span className="text-red-600 dark:text-red-400" aria-hidden> *</span> : null);

    if (estado.minhasUnidades.length === 0) return null; // só quem está lotado autua

    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secProcesso(orgId, 'autuar', f);
            toast.success(`Processo ${r.numero} autuado`);
            qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
            setAberto(false);
            setF(vazio);
            onCriado(r.id);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível autuar');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open={aberto} onOpenChange={setAberto}>
            <Button className="gap-2" onClick={() => setAberto(true)}><Plus className="w-4 h-4" /> Novo processo</Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Autuar processo</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    {tiposAtivos.length > 0 && (
                        <div>
                            <NativeSelect id="sec-tipo" label="Tipo de processo" value={f.tipo_id} onChange={escolherTipo}
                                options={[['', 'Sem tipo (escolher o rito)'], ...tiposAtivos.map((t) => [t.id, t.sigla ? `${t.nome} (${t.sigla})` : t.nome])]} />
                            {tipoSel?.descricao && <p className="text-xs text-slate-600 mt-1">{tipoSel.descricao}</p>}
                        </div>
                    )}
                    <div><Label htmlFor="sec-assunto">Assunto<span className="text-red-600 dark:text-red-400" aria-hidden> *</span></Label><Input id="sec-assunto" value={f.assunto} onChange={(e) => set('assunto', e.target.value)} maxLength={200} /></div>
                    {form.descricao !== 'oculto' && <div><Label htmlFor="sec-desc">Descrição{req(form.descricao)}</Label><Textarea id="sec-desc" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} rows={3} aria-required={form.descricao === 'obrigatorio' || undefined} /></div>}
                    <CamposProcesso campos={form.campos} valores={f.campos} onChange={(id, v) => setF((x) => ({ ...x, campos: { ...x.campos, [id]: v } }))} />
                    <div className="grid sm:grid-cols-3 gap-3">
                        <NativeSelect id="sec-origem" label="Origem" value={f.origem.tipo} onChange={(v) => set('origem', { ...f.origem, tipo: v })}
                            options={[['', 'Não informar'], ...ORIGENS]} />
                        <div className="sm:col-span-2">
                            <Label htmlFor="sec-origem-ref">Referência da origem</Label>
                            <Input id="sec-origem-ref" className="mt-1" value={f.origem.descricao} maxLength={200} onChange={(e) => set('origem', { ...f.origem, descricao: e.target.value })}
                                placeholder="Ex.: Ofício nº 12/2026 da Prefeitura, recebido por e-mail" aria-describedby="sec-origem-ajuda" />
                        </div>
                        <p id="sec-origem-ajuda" className="sm:col-span-3 -mt-2 text-xs text-slate-600 dark:text-slate-400">Como o processo chegou ao órgão. Aparece na capa e no PDF da equipe; as partes não veem a referência.</p>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                        {tipoSel
                            ? <div><Label>Rito</Label><p className="mt-1 h-9 flex items-center text-sm text-slate-700 dark:text-slate-300">{ritoSel?.nome}</p></div>
                            : <NativeSelect id="sec-rito" label="Rito" value={f.rito_id} onChange={(v) => set('rito_id', v)} options={ritosAtivos.map((r) => [r.id, r.nome])} />}
                        <NativeSelect label="Unidade" value={f.unidade_id} onChange={(v) => set('unidade_id', v)}
                            options={unidadesPara(tipoSel).map((id) => [id, unidadeComOrgao(estado, id)])} />
                        <NativeSelect label="Sigilo" value={f.sigilo} onChange={(v) => set('sigilo', v)}
                            options={[['normal', 'Normal'], ['restrito', 'Restrito às unidades por onde passar']]} />
                    </div>
                    <div className={`rounded-lg border px-3 py-2 space-y-2 ${f.urgente ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <input type="checkbox" checked={f.urgente} disabled={tipoSel?.urgente === true} onChange={(e) => set('urgente', e.target.checked)} />
                            Tramitação urgente
                            {tipoSel?.urgente === true && <span className="font-normal text-xs text-slate-600 dark:text-slate-400">(este tipo de processo é sempre urgente)</span>}
                        </label>
                        {f.urgente && tipoSel?.urgente !== true && (
                            <div><Label htmlFor="sec-urg">Motivo da urgência<span className="text-red-600 dark:text-red-400" aria-hidden> *</span></Label>
                                <Input id="sec-urg" value={f.motivo_urgencia} onChange={(e) => set('motivo_urgencia', e.target.value)} maxLength={300} placeholder="Ex.: risco de perecimento do direito, prazo legal curto" aria-required /></div>
                        )}
                        {!f.urgente && <p className="text-xs text-slate-600 dark:text-slate-400">O processo urgente aparece primeiro nas listas, com selo vermelho, e os avisos saem marcados como urgentes.</p>}
                    </div>
                    {ritoSel && (
                        <details className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <summary className="text-sm cursor-pointer">Ver o fluxo do rito ({ritoSel.fases.length} fases)</summary>
                            <FluxoRito fases={ritoSel.fases} unidades={estado.unidades} className="mt-2" />
                        </details>
                    )}
                    {form.partes !== 'oculto' && <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Partes e interessados{req(form.partes)}</Label>
                            <Button type="button" size="sm" variant="outline" onClick={() => set('partes', [...f.partes, { nome: '', documento: '', polo: 'requerente' }])}>Adicionar</Button>
                        </div>
                        {f.partes.map((pa, i) => (
                            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-md sm:rounded-none border sm:border-0 border-slate-200 dark:border-slate-700 p-2 sm:p-0">
                                <Input className="col-span-2 sm:col-span-4" placeholder="Nome" aria-label="Nome da parte" value={pa.nome} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                                <Input className="sm:col-span-2" placeholder="CPF/CNPJ" aria-label="CPF ou CNPJ" value={pa.documento} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, documento: e.target.value } : x))} />
                                <Input className="sm:col-span-3" type="email" placeholder="E-mail (convite)" aria-label="E-mail da parte" value={pa.email || ''} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                                <select className="sm:col-span-2 h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900" value={pa.polo} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, polo: e.target.value } : x))} aria-label="Polo">
                                    <option value="requerente">Requerente</option><option value="requerido">Requerido</option>
                                    <option value="interessado">Interessado</option><option value="terceiro">Terceiro</option>
                                </select>
                                <Button type="button" variant="ghost" size="sm" className="sm:col-span-1" onClick={() => set('partes', f.partes.filter((_, j) => j !== i))} aria-label="Remover parte">×</Button>
                            </div>
                        ))}
                    </div>}
                    {f.assunto.trim() && falta.length > 0 && (
                        <p className="text-sm text-amber-800 dark:text-amber-300" role="status">Para autuar: {falta.join('; ')}.</p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !f.assunto.trim() || !f.rito_id || falta.length > 0}>
                        {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Autuar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
