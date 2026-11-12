import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CalendarDays, FileText, GitBranch, Hash, History, Loader2, Network, Plus, Shapes, Trash2, Users } from 'lucide-react';
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
import PropostaRito from './PropostaRito';
import FluxoRito from './FluxoRito';
import { EditorFormulario } from './CamposProcesso';
import { formularioDe, formularioPadrao, problemasFormulario } from '@/lib/camposProcesso';
import { NUMERACAO_PADRAO, formatarNumero, problemasNumeracao, resumoContagem } from '@/lib/numeracao';
import EditorNumeracao from './EditorNumeracao';
import { nomeOrgao } from '@/lib/orgaos';
import ConfiguracaoDocumentos from './ConfiguracaoDocumentos';
import ConfiguracaoCalendario from './ConfiguracaoCalendario';
import GestaoUnidade, { NovaUnidade } from './GestaoUnidade';
import HistoricoConfiguracao from './HistoricoConfiguracao';
import VersoesDialog from './VersoesDialog';
import EstruturaOrgaos from './Orgaos';
import { TextosComunicacao } from './Comunicacoes';
import { BloqueioRito, CartaoComMenu, ConfirmarExclusao, Excluidos } from './Lixeira';

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
    // Rito que não pode ser excluído leva direto ao tipo que o usa.
    const [pedidoTipo, setPedidoTipo] = useState(null);
    const abrirTipo = (id) => { setPedidoTipo(id); mudar('tipos'); };
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
            <TabsContent value="tipos"><Tipos orgId={orgId} estado={estado} pedido={pedidoTipo} onPedidoAtendido={() => setPedidoTipo(null)} /></TabsContent>
            <TabsContent value="ritos"><Ritos orgId={orgId} estado={estado} onIr={mudar} onAbrirTipo={abrirTipo} /></TabsContent>
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
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[14rem] flex-1">
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

function Ritos({ orgId, estado, onIr, onAbrirTipo }) {
    // null: fechado; {}: novo rito; { rito }: editar na mesma tela da criação; { copia }: novo a partir de outro.
    const [aberto, setAberto] = useState(null);
    const [excluir, setExcluir] = useState(null);
    const tiposDe = (id) => (estado.tipos || []).filter((t) => t.rito_id === id);
    const bloqueio = excluir && tiposDe(excluir.id).length ? <BloqueioRito tipos={tiposDe(excluir.id)} onAbrirTipo={(id) => { setExcluir(null); onAbrirTipo(id); }} /> : null;
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[14rem] flex-1">
                    <CardTitle className="text-base">Ritos</CardTitle>
                    <CardDescription>O caminho do processo, fase a fase, e o que cada ação pede e registra. Monte do zero, parta de um modelo ou importe de planilha, Word, PDF ou diagrama (BPMN, draw.io, Mermaid). Criar e editar usam a mesma tela; cada alteração gera uma versão.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" className="gap-1" onClick={() => setAberto({})}><Plus className="w-4 h-4" /> Novo rito</Button>
                </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {estado.ritos.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400 md:col-span-2">Nenhum rito ainda. Sem rito não dá para autuar: comece por <b>Novo rito</b> (há modelos prontos) ou importe o fluxo de um arquivo.</p>}
                {estado.ritos.map((r) => (
                    <CartaoComMenu key={r.id} nome={r.nome} className={item} onEditar={() => setAberto({ rito: r })} onDuplicar={() => setAberto({ copia: r })}
                        onExcluir={() => setExcluir({ colecao: 'rito', id: r.id, nome: r.nome })}>
                        <div className="flex flex-wrap items-center gap-2"><span className="font-medium"><span className="sr-only">Editar o rito </span>{r.nome}</span><span className="text-xs text-slate-600">versão {r.versao}</span>{!r.ativo && <Badge variant="secondary">Inativo</Badge>}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{r.fases.length} fases: {r.fases.map((f) => f.nome).join(' → ')}</p>
                        {tiposDe(r.id).length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Usado por: {tiposDe(r.id).map((t) => t.nome).join(', ')}</p>}
                    </CartaoComMenu>
                ))}
                <Excluidos orgId={orgId} estado={estado} colecao="rito" />
            </CardContent>
            {aberto && (
                <PropostaRito key={aberto.rito?.id || (aberto.copia ? `copia-${aberto.copia.id}` : 'novo')} aberto orgId={orgId} estado={estado} rito={aberto.rito || null} copia={aberto.copia || null}
                    onFechar={() => setAberto(null)} onIr={onIr} onAbrirTipo={onAbrirTipo}
                    extra={aberto.rito && <VersoesDialog orgId={orgId} colecao="rito" id={aberto.rito.id} nome={aberto.rito.nome} estado={estado} onRestaurado={() => setAberto(null)} />} />
            )}
            <ConfirmarExclusao orgId={orgId} alvo={excluir} onFechar={() => setExcluir(null)} bloqueio={bloqueio} />
        </Card>
    );
}

const MODOS_NUMERO = [
    ['orgao', 'A numeração do órgão', 'Igual à dos demais processos.'],
    ['propria', 'Numeração própria', 'Montada só para este tipo.'],
    ['nenhuma', 'Sem número', 'O processo recebe só um identificador (SN-…), sem ocupar número.'],
];

function Tipos({ orgId, estado, pedido, onPedidoAtendido }) {
    const { salvar, salvando } = useSalvar(orgId);
    const [tipo, setTipo] = useState(null);
    const [excluir, setExcluir] = useState(null);
    const [numOrg, setNumOrg] = useState(null);
    const tipos = estado.tipos || [];
    const nomeRito = (id) => estado.ritos.find((r) => r.id === id)?.nome || 'Rito removido';
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome;
    const numeracaoOrgao = estado.numeracao || NUMERACAO_PADRAO;
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const exemplo = (n, t) => formatarNumero(n, { hoje, tipo: t || { sigla: 'REQ', nome: 'Requerimento' }, unidade: estado.unidades[0] || { sigla: 'SEC' }, orgao: (estado.orgaos || [])[0] }, 1);
    const numTipo = tipo?.numeracao || { modo: 'orgao' };
    const problemasNum = numTipo.modo === 'propria' ? problemasNumeracao(numTipo) : [];
    const idsFasesTipo = (estado.ritos.find((r) => r.id === tipo?.rito_id)?.fases || []).map((f) => f.id);
    const paraEditar = (t) => ({ ...t, unidade_inicial: t.unidade_inicial || '', orgao_id: t.orgao_id || '', formulario: formularioDe(t), numeracao: t.numeracao || { modo: 'orgao' } });
    // Cópia: mesmo rito, campos e numeração; sem sigla, para não dividir a contagem com o original.
    const duplicar = (t) => { const { id: _id, ...resto } = paraEditar(t); setTipo({ ...resto, nome: `${t.nome} (cópia)`, sigla: '', ativo: true }); };
    // Vindo de um rito que não pôde ser excluído: abre o tipo pedido.
    useEffect(() => {
        if (!pedido) return;
        const t = tipos.find((x) => x.id === pedido);
        if (t) setTipo(paraEditar(t));
        onPedidoAtendido?.();
    }, [pedido]);
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[14rem] flex-1">
                    <CardTitle className="text-base">Tipos de processo</CardTitle>
                    <CardDescription>O que se autua no órgão (ex.: Requerimento, Sindicância). Cada tipo já escolhe o rito, o sigilo, a unidade de entrada e os campos do “Novo processo”.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setNumOrg(numeracaoOrgao)}><Hash className="w-4 h-4" aria-hidden /> Numeração</Button>
                    <Button size="sm" className="gap-1" disabled={!estado.ritos.length}
                        onClick={() => setTipo({ nome: '', sigla: '', descricao: '', rito_id: estado.ritos.find((r) => r.ativo)?.id || '', sigilo_padrao: 'normal', unidade_inicial: '', orgao_id: '', ativo: true, formulario: formularioPadrao(), numeracao: { modo: 'orgao' } })}>
                        <Plus className="w-4 h-4" /> Novo tipo
                    </Button>
                </div>
            </CardHeader>
            <p className="px-6 -mt-2 pb-3 text-xs text-slate-600 dark:text-slate-400">Numeração do órgão: <span className="font-mono">{exemplo(numeracaoOrgao)}</span> · {resumoContagem(numeracaoOrgao)}</p>
            <CardContent className="grid md:grid-cols-2 gap-2">
                {tipos.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400 md:col-span-2">{estado.ritos.length ? 'Sem tipos, quem autua escolhe o rito diretamente.' : 'Crie primeiro um rito na aba Ritos: todo tipo de processo aponta para um.'}</p>}
                {tipos.map((t) => (
                    <CartaoComMenu key={t.id} nome={t.nome} className={item} onEditar={() => setTipo(paraEditar(t))} onDuplicar={() => duplicar(t)}
                        onExcluir={() => setExcluir({ colecao: 'tipo', id: t.id, nome: t.nome })}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{t.nome}</span>
                            {t.sigla && <span className="text-xs text-slate-600">{t.sigla}</span>}
                            {t.sigilo_padrao === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                            {t.urgente && <SeloUrgente />}
                            {!t.ativo && <Badge variant="secondary">Inativo</Badge>}
                            {t.numeracao?.modo === 'nenhuma' && <Badge variant="outline">Sem número</Badge>}
                            {t.numeracao?.modo === 'propria' && <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{exemplo(t.numeracao, t)}</span>}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Rito: {nomeRito(t.rito_id)}{nomeOrgao(estado, t.orgao_id) ? ` · só de ${nomeOrgao(estado, t.orgao_id)}` : ''}{t.unidade_inicial && nomeUnidade(t.unidade_inicial) ? ` · entra por ${nomeUnidade(t.unidade_inicial)}` : ''}{t.descricao ? ` · ${t.descricao}` : ''}</p>
                        {formularioDe(t).campos.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Campos próprios: {formularioDe(t).campos.map((c) => c.rotulo).join(', ')}</p>}
                    </CartaoComMenu>
                ))}
                <Excluidos orgId={orgId} estado={estado} colecao="tipo" />
            </CardContent>
            <ConfirmarExclusao orgId={orgId} alvo={excluir} onFechar={() => setExcluir(null)} onExcluido={() => setTipo(null)} />

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
                            <EditorFormulario form={tipo.formulario} tipo={tipo} fases={estado.ritos.find((r) => r.id === tipo.rito_id)?.fases || []} onChange={(formulario) => setTipo({ ...tipo, formulario })} />
                            <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                                <legend className="px-1 text-sm font-medium">Numeração única</legend>
                                <div className="grid sm:grid-cols-3 gap-2">
                                    {MODOS_NUMERO.map(([v, l, d]) => (
                                        <label key={v} className={`flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer ${numTipo.modo === v ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                            <input type="radio" name="tp-numeracao" className="mt-1" checked={numTipo.modo === v}
                                                onChange={() => setTipo({ ...tipo, numeracao: v === 'propria' ? { modo: 'propria', partes: numTipo.partes || numeracaoOrgao.partes } : { modo: v } })} />
                                            <span><span className="font-medium">{l}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{v === 'orgao' ? `${d} Ex.: ${exemplo(numeracaoOrgao, tipo)}` : d}</span></span>
                                        </label>
                                    ))}
                                </div>
                                {numTipo.modo === 'propria' && <EditorNumeracao valor={numTipo} onChange={(n) => setTipo({ ...tipo, numeracao: { ...n, modo: 'propria' } })} exemplo={{ tipo, unidade: estado.unidades[0], orgao: (estado.orgaos || [])[0] }} />}
                            </fieldset>
                            {problemasFormulario(tipo.formulario, idsFasesTipo).length > 0 && (
                                <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc pl-5" role="alert">
                                    {problemasFormulario(tipo.formulario, idsFasesTipo).map((m) => <li key={m}>{m}</li>)}
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
                    <DialogFooter className="gap-2">
                        {tipo?.id && (
                            <Button variant="ghost" className="gap-1 text-red-700 dark:text-red-300 sm:mr-auto" onClick={() => setExcluir({ colecao: 'tipo', id: tipo.id, nome: tipo.nome })}>
                                <Trash2 className="w-4 h-4" aria-hidden /> Excluir tipo
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setTipo(null)}>Cancelar</Button>
                        <Button disabled={salvando || !tipo?.nome?.trim() || !tipo?.rito_id || problemasFormulario(tipo.formulario, idsFasesTipo).length > 0 || problemasNum.length > 0} onClick={() => salvar('salvarTipo', { id: tipo.id, tipo }, setTipo)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!numOrg} onOpenChange={(o) => !o && setNumOrg(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Numeração do órgão</DialogTitle>
                        <DialogDescription>Vale para quem autua sem tipo e para os tipos que não têm numeração própria. Processos já autuados mantêm o número que receberam.</DialogDescription>
                    </DialogHeader>
                    {numOrg && <EditorNumeracao valor={numOrg} onChange={setNumOrg} exemplo={{ unidade: estado.unidades[0], orgao: (estado.orgaos || [])[0] }} />}
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" className="sm:mr-auto" onClick={() => setNumOrg(NUMERACAO_PADRAO)}>Voltar ao padrão (000001/{hoje.slice(0, 4)})</Button>
                        <Button variant="outline" onClick={() => setNumOrg(null)}>Cancelar</Button>
                        <Button disabled={salvando || !numOrg || problemasNumeracao(numOrg).length > 0} onClick={() => salvar('salvarNumeracao', { numeracao: numOrg }, setNumOrg)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
