import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CalendarDays, FileText, GitBranch, Loader2, Plus, Shapes, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { NativeSelect, TIPOS_UNIDADE } from './comum';
import RitoEditor from './RitoEditor';
import FluxoRito from './FluxoRito';
import ConfiguracaoDocumentos from './ConfiguracaoDocumentos';
import ConfiguracaoCalendario from './ConfiguracaoCalendario';
import GestaoUnidade, { NovaUnidade } from './GestaoUnidade';

const item = 'w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400';

/**
 * Configuração do Processo Eletrônico (Painel Administrativo do órgão):
 * unidades de lotação, tipos de processo, ritos, documentos e modelos do
 * órgão e calendário. A ordem das abas segue o caminho de quem monta o
 * processo: quem trabalha, o que se autua, como anda, com que papéis e prazos.
 */
export default function ConfiguracaoProcessoEletronico({ orgId, estado }) {
    return (
        <Tabs defaultValue="unidades" className="space-y-4">
            <TabsList className="flex-wrap h-auto justify-start">
                <TabsTrigger value="unidades" className="gap-2"><Building2 className="w-4 h-4" /> Unidades e equipes</TabsTrigger>
                <TabsTrigger value="tipos" className="gap-2"><Shapes className="w-4 h-4" /> Tipos de processo</TabsTrigger>
                <TabsTrigger value="ritos" className="gap-2"><GitBranch className="w-4 h-4" /> Ritos</TabsTrigger>
                <TabsTrigger value="documentos" className="gap-2"><FileText className="w-4 h-4" /> Documentos e modelos</TabsTrigger>
                <TabsTrigger value="calendario" className="gap-2"><CalendarDays className="w-4 h-4" /> Calendário</TabsTrigger>
            </TabsList>
            <TabsContent value="unidades"><Unidades orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="tipos"><Tipos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="ritos"><Ritos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="documentos"><ConfiguracaoDocumentos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="calendario"><ConfiguracaoCalendario orgId={orgId} estado={estado} /></TabsContent>
        </Tabs>
    );
}

function useSalvar(orgId) {
    const qc = useQueryClient();
    const [salvando, setSalvando] = useState(false);
    const salvar = async (action, payload, fechar) => {
        setSalvando(true);
        try {
            await secConfig(orgId, action, payload);
            toast.success('Salvo');
            fechar(null);
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSalvando(false);
        }
    };
    return { salvar, salvando };
}

export function CartaoUnidade({ u, estado, onAbrir }) {
    const nomes = (u.lotacoes || []).map((l) => estado.membros.find((m) => m.uid === l.uid)?.nome).filter(Boolean);
    const gestores = (u.lotacoes || []).filter((l) => l.gestor).map((l) => estado.membros.find((m) => m.uid === l.uid)?.nome).filter(Boolean);
    return (
        <button onClick={onAbrir} className={item}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.nome}</span>
                {u.sigla && <span className="text-xs text-slate-500">{u.sigla}</span>}
                <Badge variant="outline">{TIPOS_UNIDADE[u.tipo]?.rotulo || 'Secretaria'}</Badge>
                {!u.ativa && <Badge variant="secondary">Inativa</Badge>}
                {(u.pedidos || []).length > 0 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">{u.pedidos.length} pedido{u.pedidos.length > 1 ? 's' : ''} de lotação</Badge>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {nomes.length ? `${nomes.length} lotado${nomes.length > 1 ? 's' : ''}: ${nomes.slice(0, 4).join(', ')}${nomes.length > 4 ? '…' : ''}` : 'Ninguém lotado'}
            </p>
            {gestores.length > 0 && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Gestão: {gestores.join(', ')}</p>}
        </button>
    );
}

function Unidades({ orgId, estado }) {
    const [aberta, setAberta] = useState(null);
    const [nova, setNova] = useState(false);
    const grupos = Object.keys(TIPOS_UNIDADE).map((t) => [t, estado.unidades.filter((u) => (u.tipo || 'secretaria') === t)]).filter(([, l]) => l.length);
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="text-base">Unidades de lotação</CardTitle>
                    <CardDescription>Secretarias autuam e cumprem; gabinetes decidem; assessorias estudam e minutam. Só quem está lotado na unidade que tem o processo o movimenta. Cada unidade tem equipe, gestores, papel timbrado, tipos de documento e modelos próprios.</CardDescription>
                </div>
                <Button size="sm" className="gap-1 shrink-0" onClick={() => setNova(true)}><Plus className="w-4 h-4" /> Nova unidade</Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {estado.unidades.length === 0 && <p className="text-sm text-slate-500">Nenhuma unidade. Crie a secretaria e os gabinetes do órgão.</p>}
                {grupos.map(([tipo, lista]) => (
                    <div key={tipo}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{TIPOS_UNIDADE[tipo].rotulo}{lista.length > 1 ? 's' : ''}</h3>
                        <div className="grid md:grid-cols-2 gap-2">
                            {lista.map((u) => <CartaoUnidade key={u.id} u={u} estado={estado} onAbrir={() => setAberta(u.id)} />)}
                        </div>
                    </div>
                ))}
            </CardContent>
            {aberta && <GestaoUnidade orgId={orgId} estado={estado} unidadeId={aberta} onFechar={() => setAberta(null)} />}
            <NovaUnidade orgId={orgId} aberto={nova} onFechar={() => setNova(false)} onCriada={(id) => { setNova(false); setAberta(id); }} />
        </Card>
    );
}

function Ritos({ orgId, estado }) {
    const { salvar, salvando } = useSalvar(orgId);
    const [rito, setRito] = useState(null);
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="text-base">Ritos</CardTitle>
                    <CardDescription>O caminho do processo, fase a fase. Monte do zero, parta de um modelo ou importe de planilha ou diagrama.</CardDescription>
                </div>
                <Button size="sm" className="gap-1 shrink-0" onClick={() => setRito({ nome: '', descricao: '', fases: [{ id: `f${Date.now().toString(36)}`, nome: '' }], ativo: true })}><Plus className="w-4 h-4" /> Novo rito</Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {estado.ritos.map((r) => (
                    <button key={r.id} onClick={() => setRito({ ...r, fases: r.fases.map((f) => ({ ...f })) })} className={item}>
                        <div className="flex items-center gap-2"><span className="font-medium">{r.nome}</span><span className="text-xs text-slate-500">versão {r.versao}</span>{!r.ativo && <Badge variant="secondary">Inativo</Badge>}</div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.fases.length} fases: {r.fases.map((f) => f.nome).join(' → ')}</p>
                    </button>
                ))}
            </CardContent>
            {rito && (
                <RitoEditor rito={rito} onChange={setRito} onClose={() => setRito(null)} salvando={salvando}
                    onSalvar={() => salvar('salvarRito', { id: rito.id, rito, ativo: rito.ativo }, setRito)} />
            )}
        </Card>
    );
}

function Tipos({ orgId, estado }) {
    const { salvar, salvando } = useSalvar(orgId);
    const [tipo, setTipo] = useState(null);
    const tipos = estado.tipos || [];
    const nomeRito = (id) => estado.ritos.find((r) => r.id === id)?.nome || 'Rito removido';
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome;
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="text-base">Tipos de processo</CardTitle>
                    <CardDescription>O que se autua no órgão (ex.: Requerimento, Sindicância). Cada tipo já escolhe o rito, o sigilo e a unidade de entrada.</CardDescription>
                </div>
                <Button size="sm" className="gap-1 shrink-0" disabled={!estado.ritos.length}
                    onClick={() => setTipo({ nome: '', sigla: '', descricao: '', rito_id: estado.ritos.find((r) => r.ativo)?.id || '', sigilo_padrao: 'normal', unidade_inicial: '', ativo: true })}>
                    <Plus className="w-4 h-4" /> Novo tipo
                </Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {tipos.length === 0 && <p className="text-sm text-slate-500">Sem tipos, quem autua escolhe o rito diretamente.</p>}
                {tipos.map((t) => (
                    <button key={t.id} onClick={() => setTipo({ ...t, unidade_inicial: t.unidade_inicial || '' })} className={item}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{t.nome}</span>
                            {t.sigla && <span className="text-xs text-slate-500">{t.sigla}</span>}
                            {t.sigilo_padrao === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                            {!t.ativo && <Badge variant="secondary">Inativo</Badge>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rito: {nomeRito(t.rito_id)}{t.unidade_inicial && nomeUnidade(t.unidade_inicial) ? ` · entra por ${nomeUnidade(t.unidade_inicial)}` : ''}{t.descricao ? ` · ${t.descricao}` : ''}</p>
                    </button>
                ))}
            </CardContent>

            <Dialog open={!!tipo} onOpenChange={(o) => !o && setTipo(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>{tipo?.id ? 'Editar tipo de processo' : 'Novo tipo de processo'}</DialogTitle>
                        <DialogDescription>Ao autuar, quem escolhe este tipo já recebe o rito, o sigilo e a unidade abaixo.</DialogDescription>
                    </DialogHeader>
                    {tipo && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2"><Label htmlFor="tp-nome">Nome</Label><Input id="tp-nome" value={tipo.nome} onChange={(e) => setTipo({ ...tipo, nome: e.target.value })} placeholder="Ex.: Requerimento administrativo" /></div>
                                <div><Label htmlFor="tp-sigla">Sigla</Label><Input id="tp-sigla" value={tipo.sigla} maxLength={12} onChange={(e) => setTipo({ ...tipo, sigla: e.target.value })} placeholder="REQ" /></div>
                            </div>
                            <div><Label htmlFor="tp-desc">Para que serve</Label><Input id="tp-desc" value={tipo.descricao} onChange={(e) => setTipo({ ...tipo, descricao: e.target.value })} placeholder="Opcional; aparece para quem autua" /></div>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <NativeSelect id="tp-rito" label="Rito" value={tipo.rito_id} onChange={(v) => setTipo({ ...tipo, rito_id: v })}
                                    options={estado.ritos.map((r) => [r.id, `${r.nome}${r.ativo ? '' : ' (inativo)'}`])} />
                                <NativeSelect id="tp-sigilo" label="Sigilo padrão" value={tipo.sigilo_padrao} onChange={(v) => setTipo({ ...tipo, sigilo_padrao: v })}
                                    options={[['normal', 'Normal'], ['restrito', 'Restrito']]} />
                                <NativeSelect id="tp-unidade" label="Unidade sugerida para autuar" value={tipo.unidade_inicial} onChange={(v) => setTipo({ ...tipo, unidade_inicial: v })}
                                    options={[['', 'A de quem autua'], ...estado.unidades.filter((u) => u.ativa).map((u) => [u.id, u.nome])]} />
                            </div>
                            {estado.ritos.find((r) => r.id === tipo.rito_id) && (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                                    <p className="text-sm font-medium mb-2">Fluxo deste tipo</p>
                                    <FluxoRito fases={estado.ritos.find((r) => r.id === tipo.rito_id).fases} />
                                </div>
                            )}
                            {tipo.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={tipo.ativo} onCheckedChange={(c) => setTipo({ ...tipo, ativo: c === true })} /> Disponível para novas autuações</label>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTipo(null)}>Cancelar</Button>
                        <Button disabled={salvando || !tipo?.nome?.trim() || !tipo?.rito_id} onClick={() => salvar('salvarTipo', { id: tipo.id, tipo }, setTipo)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
