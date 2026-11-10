import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CalendarDays, FileText, FileUp, GitBranch, History, Loader2, Network, Plus, Shapes, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig, secProcesso } from '@/services/secretariaService';
import { NativeSelect, SeloUrgente, TIPOS_UNIDADE } from './comum';
import RitoEditor from './RitoEditor';
import PropostaRito from './PropostaRito';
import FluxoRito from './FluxoRito';
import { EditorFormulario } from './CamposProcesso';
import { formularioDe, formularioPadrao, problemasFormulario } from '@/lib/camposProcesso';
import { nomeOrgao } from '@/lib/orgaos';
import ConfiguracaoDocumentos from './ConfiguracaoDocumentos';
import ConfiguracaoCalendario from './ConfiguracaoCalendario';
import GestaoUnidade, { NovaUnidade } from './GestaoUnidade';
import HistoricoConfiguracao from './HistoricoConfiguracao';
import VersoesDialog from './VersoesDialog';
import EstruturaOrgaos from './Orgaos';
import { TextosComunicacao } from './Comunicacoes';

const item = 'w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400';

/**
 * Configuração do Processo Eletrônico (Painel Administrativo do órgão):
 * unidades de lotação, tipos de processo, ritos, documentos e modelos do
 * órgão e calendário. A ordem das abas segue o caminho de quem monta o
 * processo: quem trabalha, o que se autua, como anda, com que papéis e prazos.
 */
export default function ConfiguracaoProcessoEletronico({ orgId, estado, aba, onAba }) {
    // A aba pode ser controlada de fora (primeiros passos, resumo da implantação).
    const [interna, setInterna] = useState('unidades');
    const atual = aba ?? interna;
    const mudar = onAba || setInterna;
    return (
        <Tabs value={atual} onValueChange={mudar} className="space-y-4">
            <TabsList className="flex-wrap h-auto justify-start">
                <TabsTrigger value="estrutura" className="gap-2"><Network className="w-4 h-4" /> Estrutura</TabsTrigger>
                <TabsTrigger value="unidades" className="gap-2"><Building2 className="w-4 h-4" /> Unidades e equipes</TabsTrigger>
                <TabsTrigger value="tipos" className="gap-2"><Shapes className="w-4 h-4" /> Tipos de processo</TabsTrigger>
                <TabsTrigger value="ritos" className="gap-2"><GitBranch className="w-4 h-4" /> Ritos</TabsTrigger>
                <TabsTrigger value="documentos" className="gap-2"><FileText className="w-4 h-4" /> Documentos e modelos</TabsTrigger>
                <TabsTrigger value="calendario" className="gap-2"><CalendarDays className="w-4 h-4" /> Calendário</TabsTrigger>
                <TabsTrigger value="historico" className="gap-2"><History className="w-4 h-4" /> Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="estrutura"><EstruturaOrgaos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="unidades"><Unidades orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="tipos"><Tipos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="ritos"><Ritos orgId={orgId} estado={estado} onIr={mudar} /></TabsContent>
            <TabsContent value="documentos" className="space-y-4"><ConfiguracaoDocumentos orgId={orgId} estado={estado} /><TextosProntos orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="calendario"><ConfiguracaoCalendario orgId={orgId} estado={estado} /></TabsContent>
            <TabsContent value="historico">{atual === 'historico' && <HistoricoConfiguracao orgId={orgId} />}</TabsContent>
        </Tabs>
    );
}

function TextosProntos({ orgId, estado }) {
    const { salvar, salvando } = useSalvar(orgId);
    // Devolve se salvou, para o diálogo saber se fecha.
    const onSalvar = (textos) => new Promise((ok) => { let fechou = false; salvar('salvarTextosComunicacao', { textos }, () => { fechou = true; }).then(() => ok(fechou)); });
    return <TextosComunicacao estado={estado} salvando={salvando} onSalvar={onSalvar} />;
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

export function CartaoUnidade({ u, estado, onAbrir, carga }) {
    const nomes = (u.lotacoes || []).map((l) => estado.membros.find((m) => m.uid === l.uid)?.nome).filter(Boolean);
    const gestores = (u.lotacoes || []).filter((l) => l.gestor).map((l) => estado.membros.find((m) => m.uid === l.uid)?.nome).filter(Boolean);
    return (
        <button onClick={onAbrir} className={item}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.nome}</span>
                {u.sigla && <span className="text-xs text-slate-600">{u.sigla}</span>}
                <Badge variant="outline">{TIPOS_UNIDADE[u.tipo]?.rotulo || 'Secretaria'}</Badge>
                {!u.ativa && <Badge variant="secondary">Inativa</Badge>}
                {(u.pedidos || []).length > 0 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">{u.pedidos.length} pedido{u.pedidos.length > 1 ? 's' : ''} de lotação</Badge>}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {nomes.length ? `${nomes.length} lotado${nomes.length > 1 ? 's' : ''}: ${nomes.slice(0, 4).join(', ')}${nomes.length > 4 ? '…' : ''}` : 'Ninguém lotado'}
            </p>
            {gestores.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Gestão: {gestores.join(', ')}</p>}
            {carga != null && <p className={`text-xs mt-0.5 ${carga > 0 && !nomes.length ? 'text-amber-700 dark:text-amber-300 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>{carga} processo{carga === 1 ? '' : 's'} em andamento com a unidade{carga > 0 && !nomes.length ? ' e ninguém lotado' : ''}</p>}
        </button>
    );
}

function Unidades({ orgId, estado }) {
    const [aberta, setAberta] = useState(null);
    const [nova, setNova] = useState(false);
    // Carga por unidade contada no servidor (não traz processos).
    const cargaQ = useQuery({ queryKey: ['sec-contadores', orgId], queryFn: () => secProcesso(orgId, 'contadores'), staleTime: 60_000 });
    const carga = cargaQ.data?.por_unidade;
    // Entidade composta: agrupa por órgão interno; singular: por papel da unidade.
    const orgaos = estado.orgaos || [];
    const grupos = (orgaos.length
        ? [...orgaos.map((o) => [o.nome, estado.unidades.filter((u) => u.orgao_id === o.id)]), ['Ligadas direto à entidade', estado.unidades.filter((u) => !orgaos.some((o) => o.id === u.orgao_id))]]
        : Object.keys(TIPOS_UNIDADE).map((t) => [null, estado.unidades.filter((u) => (u.tipo || 'secretaria') === t), t])
    ).filter(([, l]) => l.length);
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
                {estado.unidades.length === 0 && <p className="text-sm text-slate-600">Nenhuma unidade. Crie a secretaria e os gabinetes do órgão.</p>}
                {grupos.map(([nome, lista, tipo]) => (
                    <div key={nome || tipo}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">{nome || `${TIPOS_UNIDADE[tipo].rotulo}${lista.length > 1 ? 's' : ''}`}</h3>
                        <div className="grid md:grid-cols-2 gap-2">
                            {lista.map((u) => <CartaoUnidade key={u.id} u={u} estado={estado} carga={carga ? carga[u.id] || 0 : undefined} onAbrir={() => setAberta(u.id)} />)}
                        </div>
                    </div>
                ))}
            </CardContent>
            {aberta && <GestaoUnidade orgId={orgId} estado={estado} unidadeId={aberta} onFechar={() => setAberta(null)} />}
            <NovaUnidade orgId={orgId} orgaos={orgaos} aberto={nova} onFechar={() => setNova(false)} onCriada={(id) => { setNova(false); setAberta(id); }} />
        </Card>
    );
}

function Ritos({ orgId, estado, onIr }) {
    const { salvar, salvando } = useSalvar(orgId);
    const [rito, setRito] = useState(null);
    const [importar, setImportar] = useState(false);
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">Ritos</CardTitle>
                    <CardDescription>O caminho do processo, fase a fase. Monte do zero, parta de um modelo ou importe de planilha, Word, PDF ou diagrama (BPMN, draw.io, Mermaid): o sistema propõe o rito completo, com unidades, ações, modelos e alternativas, para você revisar e implantar.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportar(true)}><FileUp className="w-4 h-4" /> Importar de arquivo</Button>
                    <Button size="sm" className="gap-1" onClick={() => setRito({ nome: '', descricao: '', fases: [{ id: `f${Date.now().toString(36)}`, nome: '' }], ativo: true })}><Plus className="w-4 h-4" /> Novo rito</Button>
                </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {estado.ritos.map((r) => (
                    <button key={r.id} onClick={() => setRito({ ...r, fases: r.fases.map((f) => ({ ...f })) })} className={item}>
                        <div className="flex items-center gap-2"><span className="font-medium">{r.nome}</span><span className="text-xs text-slate-600">versão {r.versao}</span>{!r.ativo && <Badge variant="secondary">Inativo</Badge>}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{r.fases.length} fases: {r.fases.map((f) => f.nome).join(' → ')}</p>
                    </button>
                ))}
            </CardContent>
            {rito && (
                <RitoEditor rito={rito} onChange={setRito} onClose={() => setRito(null)} salvando={salvando} unidades={estado.unidades} modelos={estado.modelos || []}
                    onSalvar={() => salvar('salvarRito', { id: rito.id, rito, ativo: rito.ativo }, setRito)}
                    extra={rito.id && <VersoesDialog orgId={orgId} colecao="rito" id={rito.id} nome={rito.nome} estado={estado} onRestaurado={() => setRito(null)} />} />
            )}
            <PropostaRito aberto={importar} orgId={orgId} estado={estado} onFechar={() => setImportar(false)} onIr={onIr} />
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
                    <CardDescription>O que se autua no órgão (ex.: Requerimento, Sindicância). Cada tipo já escolhe o rito, o sigilo, a unidade de entrada e os campos do “Novo processo”.</CardDescription>
                </div>
                <Button size="sm" className="gap-1 shrink-0" disabled={!estado.ritos.length}
                    onClick={() => setTipo({ nome: '', sigla: '', descricao: '', rito_id: estado.ritos.find((r) => r.ativo)?.id || '', sigilo_padrao: 'normal', unidade_inicial: '', orgao_id: '', ativo: true, formulario: formularioPadrao() })}>
                    <Plus className="w-4 h-4" /> Novo tipo
                </Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {tipos.length === 0 && <p className="text-sm text-slate-600">Sem tipos, quem autua escolhe o rito diretamente.</p>}
                {tipos.map((t) => (
                    <button key={t.id} onClick={() => setTipo({ ...t, unidade_inicial: t.unidade_inicial || '', orgao_id: t.orgao_id || '', formulario: formularioDe(t) })} className={item}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{t.nome}</span>
                            {t.sigla && <span className="text-xs text-slate-600">{t.sigla}</span>}
                            {t.sigilo_padrao === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                            {t.urgente && <SeloUrgente />}
                            {!t.ativo && <Badge variant="secondary">Inativo</Badge>}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Rito: {nomeRito(t.rito_id)}{nomeOrgao(estado, t.orgao_id) ? ` · só de ${nomeOrgao(estado, t.orgao_id)}` : ''}{t.unidade_inicial && nomeUnidade(t.unidade_inicial) ? ` · entra por ${nomeUnidade(t.unidade_inicial)}` : ''}{t.descricao ? ` · ${t.descricao}` : ''}</p>
                        {formularioDe(t).campos.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Campos próprios: {formularioDe(t).campos.map((c) => c.rotulo).join(', ')}</p>}
                    </button>
                ))}
            </CardContent>

            <Dialog open={!!tipo} onOpenChange={(o) => !o && setTipo(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>{tipo?.id ? 'Editar tipo de processo' : 'Novo tipo de processo'}</DialogTitle>
                        <DialogDescription>Ao autuar, quem escolhe este tipo já recebe o rito, o sigilo, a unidade e os campos abaixo.</DialogDescription>
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
                            {(estado.orgaos || []).length > 0 && (
                                <div>
                                    <NativeSelect id="tp-orgao" label="Órgão interno deste tipo" value={tipo.orgao_id || ''} onChange={(v) => setTipo({ ...tipo, orgao_id: v })}
                                        options={[['', 'Qualquer órgão pode autuar'], ...estado.orgaos.map((o) => [o.id, `${'— '.repeat((o.nivel || 1) - 1)}${o.nome}`])]} />
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Escolhendo um órgão, só as unidades dele autuam processos deste tipo.</p>
                                </div>
                            )}
                            <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-1" checked={tipo.urgente === true} onChange={(e) => setTipo({ ...tipo, urgente: e.target.checked })} />
                                <span><span className="font-medium">Todo processo deste tipo é urgente</span><span className="block text-xs text-slate-600 dark:text-slate-400">Já nasce com o selo de urgência e aparece primeiro nas listas.</span></span>
                            </label>
                            <EditorFormulario form={tipo.formulario} onChange={(formulario) => setTipo({ ...tipo, formulario })} />
                            {problemasFormulario(tipo.formulario).length > 0 && (
                                <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc pl-5" role="alert">
                                    {problemasFormulario(tipo.formulario).map((m) => <li key={m}>{m}</li>)}
                                </ul>
                            )}
                            {estado.ritos.find((r) => r.id === tipo.rito_id) && (
                                <details className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                                    <summary className="text-sm font-medium cursor-pointer">Fluxo deste tipo</summary>
                                    <FluxoRito fases={estado.ritos.find((r) => r.id === tipo.rito_id).fases} unidades={estado.unidades} className="mt-2" />
                                </details>
                            )}
                            {tipo.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={tipo.ativo} onCheckedChange={(c) => setTipo({ ...tipo, ativo: c === true })} /> Disponível para novas autuações</label>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTipo(null)}>Cancelar</Button>
                        <Button disabled={salvando || !tipo?.nome?.trim() || !tipo?.rito_id || problemasFormulario(tipo.formulario).length > 0} onClick={() => salvar('salvarTipo', { id: tipo.id, tipo }, setTipo)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
