import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, Crown, Loader2, Mail, Save, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { ListaTextos, NativeSelect, TIPOS_UNIDADE, copiarTexto, dataHora } from './comum';
import { DocumentosDaUnidade, ListaModelos } from './ConfiguracaoDocumentos';
import { orgaosDoDelegado } from '@/lib/orgaos';

const ATRIBUICOES = ['Chefe de secretaria', 'Analista', 'Técnico', 'Estagiário', 'Assessor', 'Promotor de Justiça', 'Procurador de Justiça', 'Servidor', 'Gestor'];

/** Dados básicos da unidade (admin do órgão): nome, sigla, tipo, descrição, ativa. */
function DadosUnidade({ u, setU, idPrefixo, orgaos = [], semEntidade = false }) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label htmlFor={`${idPrefixo}-nome`}>Nome</Label><Input id={`${idPrefixo}-nome`} value={u.nome} onChange={(e) => setU({ ...u, nome: e.target.value })} placeholder="Ex.: Gabinete do Promotor" /></div>
                <div><Label htmlFor={`${idPrefixo}-sigla`}>Sigla</Label><Input id={`${idPrefixo}-sigla`} value={u.sigla || ''} maxLength={20} onChange={(e) => setU({ ...u, sigla: e.target.value })} /></div>
            </div>
            {orgaos.length > 0 && (
                <NativeSelect id={`${idPrefixo}-orgao`} label="Órgão interno a que pertence" value={u.orgao_id || ''} onChange={(v) => setU({ ...u, orgao_id: v })}
                    options={[...(semEntidade ? [] : [['', 'Nenhum (ligada direto à entidade)']]), ...orgaos.map((o) => [o.id, `${'— '.repeat((o.nivel || 1) - 1)}${o.nome}`])]} />
            )}
            <fieldset>
                <legend className="text-sm font-medium mb-2">Papel no processo</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                    {Object.entries(TIPOS_UNIDADE).map(([k, t]) => (
                        <label key={k} className={`flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer ${u.tipo === k ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
                            <input type="radio" name={`${idPrefixo}-tipo`} className="mt-1" checked={u.tipo === k} onChange={() => setU({ ...u, tipo: k })} />
                            <span><span className="font-medium block">{t.rotulo}</span><span className="text-slate-600 dark:text-slate-400">{t.descricao}</span></span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <div><Label htmlFor={`${idPrefixo}-desc`}>Descrição (opcional)</Label><Textarea id={`${idPrefixo}-desc`} rows={2} maxLength={500} value={u.descricao || ''} onChange={(e) => setU({ ...u, descricao: e.target.value })} placeholder="O que a unidade faz, horário, contato…" /></div>
            <ListaTextos id={`${idPrefixo}-comp`} rotulo="Atribuições da unidade (opcional)" ajuda="O que cabe a esta unidade fazer. Uma por linha." itens={u.competencias || []} onChange={(competencias) => setU({ ...u, competencias })} placeholder="Ex.: Expedir intimações e controlar prazos" />
            {u.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={u.ativa !== false} onCheckedChange={(c) => setU({ ...u, ativa: c === true })} /> Unidade ativa (inativa não recebe processos e ninguém atua por ela)</label>}
        </div>
    );
}

/** Criação de unidade (admin). Depois de criada, abre a gestão completa. */
export function NovaUnidade({ orgId, aberto, onFechar, onCriada, orgaos = [], orgaoId = '', semEntidade = false }) {
    const qc = useQueryClient();
    const vazia = () => ({ nome: '', sigla: '', tipo: 'gabinete', descricao: '', orgao_id: orgaoId || '', competencias: [] });
    const [u, setU] = useState(vazia);
    const [salvando, setSalvando] = useState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (aberto) setU(vazia()); }, [aberto, orgaoId]);
    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secConfig(orgId, 'salvarUnidade', { unidade: { ...u, lotacoes: [] } });
            toast.success('Unidade criada. Agora monte a equipe.');
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            onCriada(r.id);
        } catch (e) { toast.error(e?.message || 'Não foi possível criar'); } finally { setSalvando(false); }
    };
    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Nova unidade de lotação</DialogTitle>
                    <DialogDescription>Secretaria, gabinete, assessoria ou outra. A equipe, o papel timbrado e os modelos se ajustam em seguida.</DialogDescription>
                </DialogHeader>
                <DadosUnidade u={u} setU={setU} idPrefixo="nova-un" orgaos={orgaos} semEntidade={semEntidade} />
                <DialogFooter>
                    <Button variant="outline" onClick={onFechar}>Cancelar</Button>
                    <Button disabled={salvando || !u.nome.trim()} onClick={salvar}>{salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar unidade</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Gestão completa de uma unidade: equipe (lotações, atribuições, gestão,
 * inserir, convidar, admitir pedidos), papel timbrado e tipos próprios,
 * modelos da unidade e, para o admin do órgão ou de quem administra o órgão
 * interno dela, os dados básicos.
 * Em `embutido`, renderiza sem diálogo (aba "Minha unidade").
 */
export default function GestaoUnidade({ orgId, estado, unidadeId, onFechar, embutido = false }) {
    const unidade = estado.unidades.find((x) => x.id === unidadeId);
    if (!unidade) return null;
    const corpo = <CorpoGestao key={unidade.id} orgId={orgId} estado={estado} unidade={unidade} onExcluida={onFechar} />;
    if (embutido) return corpo;
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">{unidade.nome} <Badge variant="outline">{TIPOS_UNIDADE[unidade.tipo]?.rotulo}</Badge>{!unidade.ativa && <Badge variant="secondary">Inativa</Badge>}</DialogTitle>
                    <DialogDescription>{TIPOS_UNIDADE[unidade.tipo]?.descricao}. Configure a equipe, o papel timbrado, os tipos de documento e os modelos desta unidade.</DialogDescription>
                </DialogHeader>
                {corpo}
            </DialogContent>
        </Dialog>
    );
}

function CorpoGestao({ orgId, estado, unidade, onExcluida }) {
    const pedidos = unidade.pedidos || [];
    // Dados básicos: admin da entidade ou quem administra o órgão interno da unidade.
    const podeDados = estado.isAdmin || (estado.adminOrgaos || []).includes(unidade.orgao_id);
    return (
        <>
        <Tabs defaultValue="equipe">
            <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="equipe">Equipe{pedidos.length > 0 && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">{pedidos.length}</Badge>}</TabsTrigger>
                <TabsTrigger value="documentos">Timbrado e tipos</TabsTrigger>
                <TabsTrigger value="modelos">Modelos</TabsTrigger>
                {podeDados && <TabsTrigger value="dados">Dados da unidade</TabsTrigger>}
            </TabsList>
            <TabsContent value="equipe" className="pt-3"><Equipe orgId={orgId} estado={estado} unidade={unidade} /></TabsContent>
            <TabsContent value="documentos" className="pt-3"><DocumentosDaUnidade orgId={orgId} estado={estado} unidade={unidade} /></TabsContent>
            <TabsContent value="modelos" className="pt-3">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Modelos que só esta unidade usa (além dos do órgão). Saem com o papel timbrado da unidade.</p>
                <ListaModelos orgId={orgId} estado={estado} unidadeId={unidade.id} semCartao />
            </TabsContent>
            {podeDados && <TabsContent value="dados" className="pt-3"><EditarDados orgId={orgId} unidade={unidade} orgaos={orgaosDoDelegado(estado) || estado.orgaos || []} semEntidade={!estado.isAdmin} /></TabsContent>}
        </Tabs>
        {(estado.isAdmin || unidade.criada_por_mim) && <ExcluirUnidade orgId={orgId} estado={estado} unidade={unidade} onExcluida={onExcluida} />}
        </>
    );
}

/**
 * Excluir a unidade: primeiro mostra o que muda (processos, equipe, modelos,
 * tipos e fases de rito); havendo processos, o admin escolhe a unidade que os
 * recebe. Sem processos, a escolha é opcional e leva modelos, tipos e fases.
 */
function ExcluirUnidade({ orgId, estado, unidade, onExcluida }) {
    const qc = useQueryClient();
    const [impacto, setImpacto] = useState(null);
    const [sucessora, setSucessora] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const opcoes = estado.unidades.filter((u) => u.ativa && u.id !== unidade.id && (estado.isAdmin || (estado.gestorDe || []).includes(u.id)));
    const abrir = async () => {
        setOcupado(true);
        try {
            setImpacto(await secConfig(orgId, 'excluirUnidade', { id: unidade.id, simular: true }));
            setSucessora('');
        } catch (e) { toast.error(e?.message || 'Não foi possível consultar a unidade'); } finally { setOcupado(false); }
    };
    const excluir = async () => {
        setOcupado(true);
        try {
            const r = await secConfig(orgId, 'excluirUnidade', { id: unidade.id, sucessora: sucessora || undefined });
            toast.success(r.processos ? `Unidade excluída. ${r.processos} processo(s) foram para ${r.sucessora}.` : 'Unidade excluída');
            setImpacto(null);
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
            onExcluida?.();
        } catch (e) { toast.error(e?.message || 'Não foi possível excluir'); } finally { setOcupado(false); }
    };
    const precisaSucessora = impacto?.processos > 0;
    const ritosAfetados = impacto?.ritos || [];
    const reatribui = impacto && (impacto.modelos > 0 || impacto.tipos > 0 || ritosAfetados.length > 0);
    const soAdmin = impacto && !impacto.pode_mover && (precisaSucessora || impacto.tipos > 0 || ritosAfetados.length > 0);
    const semEscolha = (txt) => (precisaSucessora ? '' : ` Sem escolha, ${txt}`);
    const n = (q, um, varios) => (q === 1 ? `1 ${um}` : `${q} ${varios}`);
    return (
        <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
            <Button type="button" variant="ghost" className="gap-1 text-red-700 dark:text-red-400" disabled={ocupado} onClick={abrir}>
                {ocupado && !impacto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Excluir unidade
            </Button>
            <Dialog open={!!impacto} onOpenChange={(o) => !o && setImpacto(null)}>
                <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Excluir {unidade.nome}?</DialogTitle>
                        <DialogDescription>A unidade some das listas e não recebe mais processos. O nome dela continua nos autos de tudo por onde ela passou. A exclusão não se desfaz por aqui.</DialogDescription>
                    </DialogHeader>
                    {impacto && (
                        <div className="space-y-3 text-sm">
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{impacto.processos ? <><b>{impacto.processos === 1 ? 'O processo que está com ela vai' : `Os ${impacto.processos} processos que estão com ela vão`}</b>{impacto.arquivados ? ` (${impacto.arquivados} arquivado${impacto.arquivados > 1 ? 's' : ''})` : ''} para a unidade escolhida abaixo, com termo de remessa e as minutas junto.</> : 'Nenhum processo está com ela.'}</li>
                                <li>{impacto.equipe ? `${impacto.equipe} pessoa(s) deixam de estar lotadas nela.` : 'Ela não tem equipe.'} Convites e pedidos de lotação em aberto deixam de valer.</li>
                                {impacto.modelos > 0 && <li>{n(impacto.modelos, 'modelo da unidade vai', 'modelos da unidade vão')} para a unidade escolhida abaixo.{semEscolha(`${impacto.modelos === 1 ? 'fica inativo' : 'ficam inativos'} nos modelos ${impacto.orgao ? `de ${impacto.orgao}` : 'do órgão'}, para o admin revisar.`)}</li>}
                                {impacto.tipos > 0 && <li>{n(impacto.tipos, 'tipo de processo entra', 'tipos de processo entram')} por esta unidade. {impacto.tipos === 1 ? 'Passa' : 'Passam'} a entrar pela unidade escolhida abaixo.{semEscolha(`${impacto.tipos === 1 ? 'entra' : 'entram'} pela unidade de quem autua.`)}</li>}
                                {ritosAfetados.map((r) => <li key={r.id}>{n(r.fases, 'fase', 'fases')} do rito {r.nome} {r.fases === 1 ? 'corre' : 'correm'} nesta unidade. {r.fases === 1 ? 'Passa' : 'Passam'} a correr na unidade escolhida abaixo.{semEscolha(`${r.fases === 1 ? 'corre' : 'correm'} na unidade que estiver com o processo.`)} Processos já autuados não mudam.</li>)}
                            </ul>
                            {soAdmin && <p role="alert" className="text-amber-800 dark:text-amber-300">Como a unidade tem processos ou é usada por tipos de processo e ritos, só o admin do órgão pode excluí-la.</p>}
                            {!soAdmin && (precisaSucessora || reatribui) && (
                                opcoes.length
                                    ? <NativeSelect id={`suc-${unidade.id}`} label={precisaSucessora ? 'Unidade que recebe os processos' : 'Unidade que fica com os modelos, tipos e fases (opcional)'} value={sucessora} onChange={setSucessora}
                                        options={[['', precisaSucessora ? 'Escolha…' : 'Nenhuma'], ...opcoes.map((u) => [u.id, u.nome])]} />
                                    : precisaSucessora && <p role="alert" className="text-amber-800 dark:text-amber-300">Não há outra unidade ativa para receber os processos. Crie uma antes.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setImpacto(null)}>Cancelar</Button>
                        <Button variant="destructive" disabled={ocupado || soAdmin || (precisaSucessora && !sucessora)} onClick={excluir}>
                            {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Excluir unidade
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EditarDados({ orgId, unidade, orgaos, semEntidade }) {
    const qc = useQueryClient();
    const [u, setU] = useState({ ...unidade });
    const [salvando, setSalvando] = useState(false);
    const salvar = async () => {
        setSalvando(true);
        try {
            await secConfig(orgId, 'salvarUnidade', { id: unidade.id, unidade: u, lotacoes_base: u.lotacoes || [] });
            toast.success('Unidade salva');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    return (
        <div className="space-y-4">
            <DadosUnidade u={u} setU={setU} idPrefixo={`un-${unidade.id}`} orgaos={orgaos} semEntidade={semEntidade} />
            <Button className="gap-1" disabled={salvando || !u.nome?.trim()} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar dados</Button>
        </div>
    );
}

function Equipe({ orgId, estado, unidade }) {
    const qc = useQueryClient();
    const [lot, setLot] = useState(unidade.lotacoes || []);
    // Equipe de onde a edição partiu: o servidor aplica só o que mudou sobre ela.
    const [base, setBase] = useState(unidade.lotacoes || []);
    const [sujo, setSujo] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [novo, setNovo] = useState({ uid: '', atribuicao: '' });
    const [convite, setConvite] = useState({ email: '', atribuicao: '', gestor: false });
    const [link, setLink] = useState(null);
    const [admissao, setAdmissao] = useState({}); // uid -> atribuição
    const lotacoesServidor = JSON.stringify(unidade.lotacoes || []);
    // Chegou equipe nova do servidor: sem edição em curso, mostra a nova; com edição, mantém o que a pessoa fez.
    useEffect(() => { if (!sujo) { setLot(unidade.lotacoes || []); setBase(unidade.lotacoes || []); } }, [lotacoesServidor]);

    const membro = (uid) => estado.membros.find((m) => m.uid === uid);
    const disponiveis = estado.membros.filter((m) => !lot.some((l) => l.uid === m.uid));
    const convites = (estado.convitesEquipe || []).filter((c) => c.unidade_id === unidade.id);
    const recarregar = () => qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
    const mudar = (uid, campo, valor) => { setLot(lot.map((l) => (l.uid === uid ? { ...l, [campo]: valor } : l))); setSujo(true); };

    const rodar = async (fn, ok) => {
        setOcupado(true);
        try { const r = await fn(); if (ok) toast.success(ok); recarregar(); return r; } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return null; } finally { setOcupado(false); }
    };
    const salvarEquipe = () => rodar(async () => {
        const r = await secConfig(orgId, 'salvarUnidade', { id: unidade.id, unidade: { ...unidade, lotacoes: lot }, lotacoes_base: base });
        if (r?.atribuicoes_removidas) toast.message(`${r.atribuicoes_removidas} processo(s) ficaram sem responsável porque a pessoa saiu da equipe.`);
        return r;
    }, 'Equipe salva').then((r) => { if (r) { setSujo(false); setBase(lot); } });
    const convidar = async () => {
        const r = await rodar(() => secConfig(orgId, 'convidarEquipe', { unidadeId: unidade.id, ...convite }), null);
        if (r) { setLink(r); setConvite({ email: '', atribuicao: '', gestor: false }); }
    };

    return (
        <div className="space-y-6">
            <datalist id="atribuicoes-sugeridas">{ATRIBUICOES.map((a) => <option key={a} value={a} />)}</datalist>

            {(unidade.pedidos || []).length > 0 && (
                <section aria-labelledby={`ped-${unidade.id}`} className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                    <h3 id={`ped-${unidade.id}`} className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pedidos de lotação</h3>
                    {unidade.pedidos.map((p) => (
                        <div key={p.uid} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="flex-1 min-w-[12rem]"><b>{p.nome}</b>{p.email && <span className="text-slate-600"> · {p.email}</span>}{p.mensagem && <span className="block text-slate-600 dark:text-slate-300">“{p.mensagem}”</span>}<span className="block text-xs text-slate-600">{dataHora(p.em)}</span></span>
                            <Input list="atribuicoes-sugeridas" aria-label={`Atribuição de ${p.nome}`} placeholder="Atribuição" className="h-8 w-44" value={admissao[p.uid] || ''} onChange={(e) => setAdmissao({ ...admissao, [p.uid]: e.target.value })} />
                            <Button size="sm" className="gap-1" disabled={ocupado || sujo} title={sujo ? 'Salve a equipe antes de decidir o pedido' : undefined} onClick={() => rodar(() => secConfig(orgId, 'decidirPedido', { unidadeId: unidade.id, uid: p.uid, admitir: true, atribuicao: admissao[p.uid] || '' }), `${p.nome} admitido`)}><Check className="w-4 h-4" /> Admitir</Button>
                            <Button size="sm" variant="ghost" disabled={ocupado || sujo} onClick={() => rodar(() => secConfig(orgId, 'decidirPedido', { unidadeId: unidade.id, uid: p.uid, admitir: false }), 'Pedido recusado')}>Recusar</Button>
                        </div>
                    ))}
                    {sujo && <p className="text-xs text-amber-900 dark:text-amber-100">Salve a equipe abaixo antes de decidir os pedidos.</p>}
                </section>
            )}

            <section aria-labelledby={`lot-${unidade.id}`} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <h3 id={`lot-${unidade.id}`} className="text-sm font-semibold">Lotados ({lot.length})</h3>
                    <span className="text-xs text-slate-600 flex items-center gap-1"><Crown className="w-3.5 h-3.5" aria-hidden /> Gestor configura a unidade</span>
                </div>
                {lot.length === 0 && <p className="text-sm text-slate-600">Ninguém lotado. Insira membros do órgão ou convide por e-mail.</p>}
                <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-md border border-slate-200 dark:border-slate-700">
                    {lot.map((l) => {
                        const m = membro(l.uid);
                        return (
                            <li key={l.uid} className="flex flex-wrap items-center gap-2 p-2">
                                <span className="flex-1 min-w-[10rem] text-sm"><span className="font-medium">{m?.nome || 'Ex-membro do órgão'}</span>{m?.email && <span className="block text-xs text-slate-600">{m.email}</span>}</span>
                                <Input list="atribuicoes-sugeridas" aria-label={`Atribuição de ${m?.nome || l.uid}`} placeholder="Atribuição" className="h-8 w-48" maxLength={80} value={l.atribuicao} onChange={(e) => mudar(l.uid, 'atribuicao', e.target.value)} />
                                <label className="flex items-center gap-1 text-sm"><Checkbox checked={l.gestor} onCheckedChange={(c) => mudar(l.uid, 'gestor', c === true)} /> Gestor</label>
                                <Button size="sm" variant="ghost" aria-label={`Remover ${m?.nome || ''} da unidade`} onClick={() => { setLot(lot.filter((x) => x.uid !== l.uid)); setSujo(true); }}><Trash2 className="w-4 h-4" /></Button>
                            </li>
                        );
                    })}
                </ul>
                <div className="flex flex-wrap items-end gap-2 pt-1">
                    <div className="flex-1 min-w-[12rem]">
                        <Label htmlFor={`ins-${unidade.id}`}>Inserir membro do órgão</Label>
                        <select id={`ins-${unidade.id}`} value={novo.uid} onChange={(e) => setNovo({ ...novo, uid: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                            <option value="">{disponiveis.length ? 'Escolha…' : 'Todos os membros já estão lotados'}</option>
                            {disponiveis.map((m) => <option key={m.uid} value={m.uid}>{m.nome}{m.funcao ? ` · ${m.funcao}` : ''}</option>)}
                        </select>
                    </div>
                    <div className="w-48"><Label htmlFor={`ins-atr-${unidade.id}`}>Atribuição</Label><Input id={`ins-atr-${unidade.id}`} list="atribuicoes-sugeridas" className="mt-1" value={novo.atribuicao} onChange={(e) => setNovo({ ...novo, atribuicao: e.target.value })} /></div>
                    <Button variant="outline" className="gap-1" disabled={!novo.uid} onClick={() => { setLot([...lot, { uid: novo.uid, atribuicao: novo.atribuicao, gestor: false }]); setNovo({ uid: '', atribuicao: '' }); setSujo(true); }}><UserPlus className="w-4 h-4" /> Inserir</Button>
                </div>
                <div className="flex items-center gap-3">
                    <Button className="gap-1" disabled={ocupado || !sujo} onClick={salvarEquipe}>{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar equipe</Button>
                    {sujo && <span className="text-xs text-amber-700 dark:text-amber-300" aria-live="polite">Alterações não salvas</span>}
                </div>
            </section>

            <section aria-labelledby={`conv-${unidade.id}`} className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <h3 id={`conv-${unidade.id}`} className="text-sm font-semibold">Convidar por e-mail</h3>
                <p className="text-xs text-slate-600">Para quem ainda não é membro do órgão. Ao aceitar com a conta do e-mail convidado, a pessoa entra no órgão já lotada aqui. Vale 7 dias.</p>
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem]"><Label htmlFor={`cv-email-${unidade.id}`}>E-mail</Label><Input id={`cv-email-${unidade.id}`} type="email" className="mt-1" value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} /></div>
                    <div className="w-48"><Label htmlFor={`cv-atr-${unidade.id}`}>Atribuição</Label><Input id={`cv-atr-${unidade.id}`} list="atribuicoes-sugeridas" className="mt-1" value={convite.atribuicao} onChange={(e) => setConvite({ ...convite, atribuicao: e.target.value })} /></div>
                    <label className="flex items-center gap-1 text-sm h-9"><Checkbox checked={convite.gestor} onCheckedChange={(c) => setConvite({ ...convite, gestor: c === true })} /> Gestor</label>
                    <Button variant="outline" className="gap-1" disabled={ocupado || !convite.email.includes('@')} onClick={convidar}><Mail className="w-4 h-4" /> Convidar</Button>
                </div>
                {link && (
                    <div role="status" className="rounded-md bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-2 text-sm space-y-1">
                        <p>{link.emailEnviado ? 'Convite enviado por e-mail.' : 'O envio de e-mail não está configurado; copie o link e envie à pessoa.'}</p>
                        <div className="flex gap-2"><Input readOnly value={link.link} aria-label="Link do convite" className="h-8" onFocus={(e) => e.target.select()} /><Button size="sm" variant="outline" className="gap-1" onClick={() => copiarTexto(link.link, 'Link copiado')}><Copy className="w-4 h-4" /> Copiar</Button><Button size="sm" variant="ghost" aria-label="Fechar" onClick={() => setLink(null)}><X className="w-4 h-4" /></Button></div>
                    </div>
                )}
                {convites.length > 0 && (
                    <ul className="text-sm space-y-1 pt-1">
                        {convites.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-2">
                                <span className="flex-1 min-w-[12rem]">{c.email}{c.atribuicao && ` · ${c.atribuicao}`}{c.gestor && ' · gestor'} <span className="text-xs text-slate-600">(vence {dataHora(c.expira_em)})</span></span>
                                <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => rodar(() => secConfig(orgId, 'revogarConviteEquipe', { id: c.id }), 'Convite revogado')}>Revogar</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
