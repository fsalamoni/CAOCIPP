import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Gavel, Inbox, Loader2, Plus, Settings, Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createPageUrl } from '@/utils';
import { useOrganizations } from '@/hooks/useFirestore';
import { secConfig, secProcesso } from '@/services/secretariaService';
import ProcessoView from '@/components/secretaria/ProcessoView';
import SecretariaConfiguracao from '@/components/secretaria/SecretariaConfiguracao';
import { STATUS_ROTULO, NativeSelect } from '@/components/secretaria/comum';

export default function Secretaria() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const orgId = params.get('org');
    const procId = params.get('p');
    const { organizations } = useOrganizations();
    const org = organizations.find((o) => o.id === orgId);

    const estadoQ = useQuery({
        queryKey: ['sec-estado', orgId],
        queryFn: () => secConfig(orgId, 'estado'),
        enabled: !!orgId,
    });
    const estado = estadoQ.data;

    const abrir = (id) => {
        const next = new URLSearchParams(params);
        if (id) next.set('p', id); else next.delete('p');
        setParams(next);
    };

    if (!orgId) {
        return <div className="p-8 text-slate-500">Escolha um órgão no menu lateral.</div>;
    }
    if (estadoQ.isLoading) {
        return <div className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando a Secretaria…</div>;
    }
    if (estadoQ.error) {
        return <div className="p-8 text-red-600">{estadoQ.error.message}</div>;
    }
    if (!estado?.enabled) {
        return (
            <div className="p-8 space-y-3 max-w-xl">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Secretaria Processual desativada</h1>
                <p className="text-slate-600 dark:text-slate-300">
                    {estado?.isAdmin
                        ? 'Ative a Secretaria no Painel Administrativo do órgão, aba Secretaria Processual.'
                        : 'Peça ao administrador do órgão para ativar a Secretaria Processual.'}
                </p>
                <Button variant="outline" onClick={() => navigate(`${createPageUrl('Organization')}?id=${orgId}&tab=admin`)}>
                    Ir para o órgão
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Link to={`${createPageUrl('Organization')}?id=${orgId}`} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Voltar ao órgão">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-slate-900 dark:text-white truncate">Secretaria Processual</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {org?.name || ''}
                            {estado.minhasUnidades.length > 0 && ` · lotado em ${estado.minhasUnidades.map((id) => estado.unidades.find((u) => u.id === id)?.nome).join(', ')}`}
                        </p>
                    </div>
                </div>
                {!procId && <NovoProcesso orgId={orgId} estado={estado} onCriado={abrir} />}
            </div>

            {procId ? (
                <ProcessoView orgId={orgId} procId={procId} estado={estado} onVoltar={() => abrir(null)} />
            ) : (
                <Tabs defaultValue={estado.minhasUnidades.length ? 'caixa' : 'todos'}>
                    <TabsList>
                        <TabsTrigger value="caixa" className="gap-2"><Inbox className="w-4 h-4" /> Caixa da unidade</TabsTrigger>
                        <TabsTrigger value="todos" className="gap-2"><Files className="w-4 h-4" /> Todos</TabsTrigger>
                        {estado.isAdmin && <TabsTrigger value="config" className="gap-2"><Settings className="w-4 h-4" /> Configuração</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="caixa"><ListaProcessos orgId={orgId} escopo="caixa" estado={estado} onAbrir={abrir} /></TabsContent>
                    <TabsContent value="todos"><ListaProcessos orgId={orgId} escopo="todos" estado={estado} onAbrir={abrir} /></TabsContent>
                    {estado.isAdmin && <TabsContent value="config"><SecretariaConfiguracao orgId={orgId} estado={estado} /></TabsContent>}
                </Tabs>
            )}
        </div>
    );
}

function ListaProcessos({ orgId, escopo, estado, onAbrir }) {
    const [filtro, setFiltro] = useState('');
    const [situacao, setSituacao] = useState('todos');
    const q = useQuery({
        queryKey: ['sec-processos', orgId, escopo],
        queryFn: () => secProcesso(orgId, 'listar', { escopo }),
    });
    if (q.isLoading) return <div className="py-8 text-slate-500 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <div className="py-8 text-red-600">{q.error.message}</div>;
    const termo = filtro.trim().toLowerCase();
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const lista = (q.data?.processos || [])
        .filter((p) => !termo || `${p.numero} ${p.assunto}`.toLowerCase().includes(termo))
        .filter((p) => situacao === 'todos'
            || (situacao === 'pendencia' && p.pendencias_abertas > 0)
            || (situacao === 'vencido' && p.proximo_vencimento && p.proximo_vencimento < hoje)
            || (situacao === 'prazo' && p.proximo_vencimento));
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || '—';
    const nomeMembro = (uid) => estado.membros.find((m) => m.uid === uid)?.nome;

    return (
        <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="Filtrar por número ou assunto" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-sm" />
                <select aria-label="Filtrar por situação" value={situacao} onChange={(e) => setSituacao(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                    <option value="todos">Todos</option>
                    <option value="pendencia">Com pendência para o decisor</option>
                    <option value="prazo">Com prazo aberto</option>
                    <option value="vencido">Com prazo vencido</option>
                </select>
            </div>
            {lista.length === 0 ? (
                <p className="py-8 text-slate-500 dark:text-slate-400">
                    {escopo === 'caixa' ? 'Nenhum processo com as suas unidades.' : 'Nenhum processo visível para você.'}
                </p>
            ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {lista.map((p) => (
                        <button key={p.id} onClick={() => onAbrir(p.id)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-wrap gap-x-6 gap-y-1 items-baseline">
                            <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300">{p.numero}</span>
                            <span className="font-medium text-slate-900 dark:text-white flex-1 min-w-[12rem]">{p.assunto}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{p.fase_nome} · {nomeUnidade(p.unidade_atual)}{p.responsavel_uid ? ` · ${nomeMembro(p.responsavel_uid) || ''}` : ''}</span>
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
        </div>
    );
}

function NovoProcesso({ orgId, estado, onCriado }) {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const ritosAtivos = estado.ritos.filter((r) => r.ativo);
    const vazio = { assunto: '', descricao: '', rito_id: ritosAtivos[0]?.id || '', unidade_id: estado.minhasUnidades[0] || '', sigilo: 'normal', partes: [] };
    const [f, setF] = useState(vazio);
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

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
                    <div><Label htmlFor="sec-assunto">Assunto</Label><Input id="sec-assunto" value={f.assunto} onChange={(e) => set('assunto', e.target.value)} maxLength={200} /></div>
                    <div><Label htmlFor="sec-desc">Descrição</Label><Textarea id="sec-desc" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} rows={3} /></div>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <NativeSelect label="Rito" value={f.rito_id} onChange={(v) => set('rito_id', v)}
                            options={ritosAtivos.map((r) => [r.id, r.nome])} />
                        <NativeSelect label="Unidade" value={f.unidade_id} onChange={(v) => set('unidade_id', v)}
                            options={estado.minhasUnidades.map((id) => [id, estado.unidades.find((u) => u.id === id)?.nome])} />
                        <NativeSelect label="Sigilo" value={f.sigilo} onChange={(v) => set('sigilo', v)}
                            options={[['normal', 'Normal'], ['restrito', 'Restrito às unidades por onde passar']]} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Partes e interessados</Label>
                            <Button type="button" size="sm" variant="outline" onClick={() => set('partes', [...f.partes, { nome: '', documento: '', polo: 'requerente' }])}>Adicionar</Button>
                        </div>
                        {f.partes.map((pa, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-end">
                                <Input className="col-span-5" placeholder="Nome" value={pa.nome} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                                <Input className="col-span-3" placeholder="CPF/CNPJ" value={pa.documento} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, documento: e.target.value } : x))} />
                                <select className="col-span-3 h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={pa.polo} onChange={(e) => set('partes', f.partes.map((x, j) => j === i ? { ...x, polo: e.target.value } : x))} aria-label="Polo">
                                    <option value="requerente">Requerente</option><option value="requerido">Requerido</option>
                                    <option value="interessado">Interessado</option><option value="terceiro">Terceiro</option>
                                </select>
                                <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => set('partes', f.partes.filter((_, j) => j !== i))} aria-label="Remover parte">×</Button>
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !f.assunto.trim() || !f.rito_id}>
                        {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Autuar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
