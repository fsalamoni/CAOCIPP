import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Landmark, Loader2, Network, Plus, Trash2, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { CARGOS, ESTRUTURAS, NATUREZAS, descendentes, emArvore, orgaosDoDelegado, problemasEstrutura, rotuloNatureza, unidadesDoOrgao } from '@/lib/orgaos';
import { ListaTextos, NativeSelect, rotuloUnidade } from './comum';
import GestaoUnidade, { NovaUnidade } from './GestaoUnidade';
import { ListaModelos } from './ConfiguracaoDocumentos';

const DECISOES = [['singular', 'O titular decide'], ['colegiada', 'O colegiado decide']];
const sel = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';

/**
 * Organograma em lista recuada: cada órgão logo acima dos seus subordinados.
 * `nos` já vem na ordem de leitura, com `nivel`; `unidadesDe(no)` devolve as
 * unidades do órgão ({ nome, tipo }).
 */
export function Organograma({ nos, unidadesDe, nomeTitular, onAbrir, chave = 'id', detalhado = false }) {
    return (
        <ul className="space-y-2">
            {nos.map((o) => {
                const unidades = unidadesDe(o);
                const titular = [o.titular_cargo, nomeTitular?.(o)].filter(Boolean).join(': ');
                const corpo = (
                    <>
                        <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{o.nome || 'Órgão sem nome'}</span>
                            {o.sigla && <span className="text-xs text-slate-600 dark:text-slate-400">{o.sigla}</span>}
                            <Badge variant="outline">{rotuloNatureza(o.natureza)}</Badge>
                            {o.ativo === false && <Badge variant="secondary">Inativo</Badge>}
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {o.decisao === 'colegiada' ? 'Decisão colegiada' : 'Decisão do titular'}{titular ? ` · ${titular}` : ''}
                            {!detalhado && (o.competencias || []).length > 0 ? ` · ${o.competencias.length} competência${o.competencias.length > 1 ? 's' : ''}` : ''}
                        </span>
                        {detalhado && (o.competencias || []).length > 0 && (
                            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">{o.competencias.map((c) => <li key={c}>{c}</li>)}</ul>
                        )}
                        <span className="flex flex-wrap gap-1 mt-1.5">
                            {unidades.length === 0 && <span className="text-xs text-amber-800 dark:text-amber-300">Sem unidades: ninguém recebe processos neste órgão</span>}
                            {unidades.map((u, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-800 dark:text-slate-200">
                                    <Building2 className="w-3 h-3" aria-hidden /> {u.nome} · {rotuloUnidade(u.tipo).toLowerCase()}
                                </span>
                            ))}
                        </span>
                    </>
                );
                const caixa = 'block w-full text-left rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3';
                return (
                    <li key={o[chave]} style={{ marginLeft: `${(o.nivel - 1) * 1.25}rem` }} className={o.nivel > 1 ? 'border-l-2 border-indigo-200 dark:border-indigo-800 pl-3' : ''}>
                        {onAbrir
                            ? <button type="button" onClick={() => onAbrir(o)} className={`${caixa} hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400`}>{corpo}</button>
                            : <div className={caixa}>{corpo}</div>}
                    </li>
                );
            })}
        </ul>
    );
}

const NOVO = { nome: '', sigla: '', natureza: 'executivo', pai_id: '', decisao: 'singular', titular_cargo: '', titular_uid: '', admins_uids: [], competencias: [], descricao: '', ativo: true };
const MAX_ADMINS = 10;

/**
 * Aba "Estrutura": a entidade é singular (sem órgãos internos) ou composta por
 * órgãos em árvore, cada um com unidades, competências, titular e decisão.
 * Para o admin delegado, só os órgãos que ele administra.
 */
export default function EstruturaOrgaos({ orgId, estado }) {
    const meus = orgaosDoDelegado(estado);
    const delegado = !!meus;
    const orgaos = meus || estado.orgaos || [];
    const [orgao, setOrgao] = useState(null);
    const [assistente, setAssistente] = useState(false);
    const [novaUnidade, setNovaUnidade] = useState(null); // { orgaoId }
    const [unidade, setUnidade] = useState(null);
    const soltas = estado.unidades.filter((u) => !orgaos.some((o) => o.id === u.orgao_id));
    const nomeMembro = (uid) => estado.membros.find((m) => m.uid === uid)?.nome;
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[14rem] flex-1">
                    <CardTitle className="text-base">{delegado ? (orgaos.length > 1 ? 'Órgãos que você administra' : 'Órgão que você administra') : 'Estrutura da entidade'}</CardTitle>
                    {delegado ? (
                        <CardDescription>
                            O admin da entidade deixou com você estes órgãos internos e os que ficam abaixo deles. Aqui você edita os órgãos, cria subordinados e unidades
                            e cuida dos dados, das equipes e dos modelos. Ritos, tipos de processo e integrações seguem com o admin da entidade.
                        </CardDescription>
                    ) : (
                    <CardDescription>
                        A entidade pode ser singular, só com as suas unidades, ou composta por órgãos internos (conselhos, presidência, diretorias, comissões).
                        Cada órgão tem as próprias unidades, competências, titular e forma de decidir, e os processos tramitam de um órgão para outro.
                    </CardDescription>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    {!delegado && <Button size="sm" variant="outline" className="gap-1" onClick={() => setAssistente(true)}><Wand2 className="w-4 h-4" /> Montar estrutura</Button>}
                    <Button size="sm" className="gap-1" onClick={() => setOrgao({ ...NOVO, pai_id: delegado ? orgaos[0]?.id || '' : '' })}><Plus className="w-4 h-4" /> {delegado ? 'Novo órgão subordinado' : 'Novo órgão interno'}</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!delegado && (<>
                <div className="flex items-center gap-3 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 p-3">
                    <Landmark className="w-5 h-5 text-indigo-700 dark:text-indigo-300 shrink-0" aria-hidden />
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white">{estado.orgao || 'Entidade'}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                            {orgaos.length === 0
                                ? `Entidade singular: sem órgãos internos, ${estado.unidades.length} unidade${estado.unidades.length === 1 ? '' : 's'}.`
                                : `${orgaos.length} órgão${orgaos.length > 1 ? 's' : ''} interno${orgaos.length > 1 ? 's' : ''} e ${estado.unidades.length} unidade${estado.unidades.length === 1 ? '' : 's'}.`}
                        </p>
                    </div>
                </div>

                {orgaos.length === 0 && (
                    <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" aria-hidden /> Manter singular</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Não precisa fazer nada. As unidades (secretaria, gabinete, assessoria) ficam ligadas direto à entidade, na aba Unidades e equipes.</p>
                        </div>
                        <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-sm font-medium flex items-center gap-2"><Network className="w-4 h-4" aria-hidden /> Compor com órgãos internos</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Use o assistente para montar tudo de uma vez a partir de um exemplo (federação, colegiado com câmaras, departamentos) ou crie os órgãos um a um.</p>
                            <Button size="sm" className="mt-2 gap-1" onClick={() => setAssistente(true)}><Wand2 className="w-4 h-4" /> Montar estrutura</Button>
                        </div>
                    </div>
                )}
                </>)}

                {orgaos.length > 0 && (
                    <Organograma nos={orgaos} onAbrir={(o) => setOrgao({ ...NOVO, ...o, pai_id: o.pai_id || '', titular_uid: o.titular_uid || '', admins_uids: o.admins_uids || [] })}
                        unidadesDe={(o) => estado.unidades.filter((u) => u.orgao_id === o.id)} nomeTitular={(o) => nomeMembro(o.titular_uid)} />
                )}

                {!delegado && orgaos.length > 0 && soltas.length > 0 && (
                    <section aria-labelledby="un-soltas">
                        <h3 id="un-soltas" className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-2">Unidades ligadas direto à entidade</h3>
                        <div className="flex flex-wrap gap-2">
                            {soltas.map((u) => (
                                <Button key={u.id} size="sm" variant="outline" className="gap-1" onClick={() => setUnidade(u.id)}><Building2 className="w-4 h-4" aria-hidden /> {u.nome}</Button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Para colocar uma delas em um órgão, abra a unidade e escolha o órgão em Dados da unidade.</p>
                    </section>
                )}
            </CardContent>

            {orgao && (
                <OrgaoDialog orgId={orgId} estado={estado} inicial={orgao} onFechar={() => setOrgao(null)}
                    onNovaUnidade={(orgaoId) => { setOrgao(null); setNovaUnidade({ orgaoId }); }} onAbrirUnidade={(id) => { setOrgao(null); setUnidade(id); }} />
            )}
            <MontarEstrutura orgId={orgId} estado={estado} aberto={assistente} onFechar={() => setAssistente(false)} />
            <NovaUnidade orgId={orgId} orgaos={orgaos} semEntidade={delegado} orgaoId={novaUnidade?.orgaoId} aberto={!!novaUnidade} onFechar={() => setNovaUnidade(null)} onCriada={(id) => { setNovaUnidade(null); setUnidade(id); }} />
            {unidade && <GestaoUnidade orgId={orgId} estado={estado} unidadeId={unidade} onFechar={() => setUnidade(null)} />}
        </Card>
    );
}

function OrgaoDialog({ orgId, estado, inicial, onFechar, onNovaUnidade, onAbrirUnidade }) {
    const qc = useQueryClient();
    const [o, setO] = useState(inicial);
    const [ocupado, setOcupado] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const [destino, setDestino] = useState(inicial.pai_id || '');
    const set = (k, v) => setO((x) => ({ ...x, [k]: v }));
    const orgaos = estado.orgaos || [];
    const proibidos = o.id ? descendentes(orgaos, o.id) : new Set();
    // Admin delegado: escolhe só entre os órgãos que administra; no órgão que lhe
    // foi delegado (raiz) não muda o superior nem quem administra (o servidor confere).
    const delegado = !estado.isAdmin;
    const meus = new Set(estado.adminOrgaos || []);
    const raiz = delegado && !!o.id && !meus.has(inicial.pai_id);
    const podeMover = estado.isAdmin || (delegado && !!o.id && !raiz);
    const superiores = orgaos.filter((x) => !proibidos.has(x.id) && (!delegado || meus.has(x.id))).map((x) => [x.id, `${'— '.repeat(x.nivel - 1)}${x.nome}`]);
    const nomeMembro = (uid) => estado.membros.find((m) => m.uid === uid)?.nome || 'Membro que saiu';
    const admins = o.admins_uids || [];
    const unidades = o.id ? estado.unidades.filter((u) => u.orgao_id === o.id) : [];
    const subordinados = o.id ? orgaos.filter((x) => x.pai_id === o.id).length : 0;
    const rodar = async (acao, payload, ok) => {
        setOcupado(true);
        try {
            await secConfig(orgId, acao, payload);
            toast.success(ok);
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); } finally { setOcupado(false); }
    };
    const salvar = (x, ok) => rodar('salvarOrgao', { id: x.id, orgao: { ...x, pai_id: x.pai_id || null, titular_uid: x.titular_uid || null } }, ok);
    return (
        <Dialog open onOpenChange={(a) => !a && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>{o.id ? 'Editar órgão interno' : 'Novo órgão interno'}</DialogTitle>
                    <DialogDescription>Diga o que é o órgão, onde ele fica na estrutura, quem responde por ele e o que lhe compete. As unidades do órgão recebem e movimentam os processos.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><Label htmlFor="og-nome">Nome<span className="text-red-600 dark:text-red-400" aria-hidden> *</span></Label><Input id="og-nome" value={o.nome} maxLength={120} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Secretaria-Geral" aria-required /></div>
                        <div><Label htmlFor="og-sigla">Sigla</Label><Input id="og-sigla" value={o.sigla} maxLength={20} onChange={(e) => set('sigla', e.target.value)} placeholder="SG" /></div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <NativeSelect id="og-natureza" label="Natureza" value={o.natureza} onChange={(v) => set('natureza', v)} options={Object.entries(NATUREZAS).map(([k, n]) => [k, n.rotulo])} />
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{NATUREZAS[o.natureza]?.descricao}</p>
                        </div>
                        <div>
                            <NativeSelect id="og-pai" label="Órgão superior" value={o.pai_id} onChange={(v) => set('pai_id', v)} disabled={raiz}
                                options={raiz
                                    ? [[o.pai_id, orgaos.find((x) => x.id === o.pai_id)?.nome || `Nenhum (ligado direto a ${estado.orgao || 'entidade'})`]]
                                    : [...(delegado ? [] : [['', `Nenhum (ligado direto a ${estado.orgao || 'entidade'})`]]), ...superiores]} />
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{raiz ? 'Só o admin da entidade muda a posição deste órgão.' : 'Define a posição no organograma.'}</p>
                        </div>
                    </div>
                    <fieldset>
                        <legend className="text-sm font-medium mb-2">Quem decide neste órgão</legend>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {[['singular', 'O titular', 'Uma pessoa decide (presidente, diretor, secretário).'], ['colegiada', 'O colegiado', 'A decisão é tomada em conjunto (conselho, comissão, câmara).']].map(([k, t, d]) => (
                                <label key={k} className={`flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer ${o.decisao === k ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="og-decisao" className="mt-1" checked={o.decisao === k} onChange={() => set('decisao', k)} />
                                    <span><span className="font-medium block">{t}</span><span className="text-slate-600 dark:text-slate-400">{d}</span></span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="og-cargo">Cargo do titular</Label>
                            <Input id="og-cargo" list="og-cargos" value={o.titular_cargo} maxLength={80} onChange={(e) => set('titular_cargo', e.target.value)} placeholder="Ex.: Presidente" />
                            <datalist id="og-cargos">{CARGOS.map((c) => <option key={c} value={c} />)}</datalist>
                        </div>
                        <NativeSelect id="og-titular" label="Quem ocupa hoje" value={o.titular_uid} onChange={(v) => set('titular_uid', v)}
                            options={[['', 'Ninguém indicado'], ...estado.membros.map((m) => [m.uid, m.nome])]} />
                    </div>
                    <section aria-labelledby="og-admins-titulo" className="space-y-2">
                        <h3 id="og-admins-titulo" className="text-sm font-medium">Quem administra este órgão</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Configura este órgão, os subordinados e as unidades deles: dados, equipes, pedidos de lotação e modelos. Não muda ritos, tipos de processo
                            nem integrações, e só vê os processos das unidades em que estiver lotado.
                        </p>
                        {admins.length > 0 ? (
                            <ul className="flex flex-wrap gap-2" aria-label="Admins deste órgão">
                                {admins.map((uid) => (
                                    <li key={uid} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 pl-3 text-sm text-indigo-900 dark:text-indigo-100">
                                        {nomeMembro(uid)}
                                        {!raiz && (
                                            <button type="button" className="inline-flex min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 items-center justify-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                aria-label={`Tirar ${nomeMembro(uid)} da administração do órgão`} onClick={() => set('admins_uids', admins.filter((x) => x !== uid))}>
                                                <X className="w-3.5 h-3.5" aria-hidden />
                                            </button>
                                        )}
                                        {raiz && <span className="pr-3" />}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-slate-600 dark:text-slate-400">{delegado ? 'Ninguém indicado.' : 'Ninguém indicado: só o admin da entidade configura este órgão.'}</p>}
                        {raiz
                            ? <p className="text-xs text-slate-600 dark:text-slate-400">Só o admin da entidade muda quem administra este órgão. Nos órgãos abaixo dele, você pode indicar.</p>
                            : admins.length < MAX_ADMINS && (
                                <NativeSelect id="og-admins" label="Indicar alguém" value="" onChange={(v) => v && set('admins_uids', [...admins, v])}
                                    options={[['', 'Escolher membro…'], ...estado.membros.filter((m) => !admins.includes(m.uid)).map((m) => [m.uid, m.nome])]} />
                            )}
                    </section>
                    <ListaTextos id="og-comp" rotulo="Competências" ajuda="O que cabe a este órgão decidir ou fazer. Uma por linha." itens={o.competencias} onChange={(v) => set('competencias', v)} placeholder="Ex.: Julgar recursos contra decisões das diretorias" />
                    <div><Label htmlFor="og-desc">Observações (opcional)</Label><Textarea id="og-desc" rows={2} maxLength={1000} value={o.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Composição, mandato, base no estatuto…" /></div>

                    {o.id && (
                        <section aria-labelledby="og-unidades" className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                            <h3 id="og-unidades" className="text-sm font-semibold">Unidades deste órgão ({unidades.length})</h3>
                            {unidades.length === 0 && <p className="text-sm text-amber-800 dark:text-amber-300">Sem unidades, o órgão não recebe processos. Crie ao menos uma.</p>}
                            <div className="flex flex-wrap gap-2">
                                {unidades.map((u) => <Button key={u.id} type="button" size="sm" variant="outline" className="gap-1" onClick={() => onAbrirUnidade(u.id)}><Building2 className="w-4 h-4" aria-hidden /> {u.nome} · {rotuloUnidade(u.tipo).toLowerCase()}</Button>)}
                                <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => onNovaUnidade(o.id)}><Plus className="w-4 h-4" /> Nova unidade neste órgão</Button>
                            </div>
                        </section>
                    )}
                    {o.id && (
                        <section aria-labelledby="og-modelos" className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                            <h3 id="og-modelos" className="text-sm font-semibold">Modelos de documento deste órgão</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Só as unidades deste órgão usam estes modelos, além dos modelos da entidade e dos de cada unidade.</p>
                            <ListaModelos orgId={orgId} estado={estado} unidadeId={null} orgaoId={o.id} semCartao />
                        </section>
                    )}
                    {o.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={o.ativo !== false} onCheckedChange={(c) => set('ativo', c === true)} /> Órgão ativo</label>}
                </div>
                {o.id && confirmar && (
                    <section role="alertdialog" aria-labelledby="og-excluir" aria-describedby="og-excluir-aviso" className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3 space-y-3 text-sm">
                        <h3 id="og-excluir" className="font-semibold text-red-900 dark:text-red-100">Excluir {inicial.nome}?</h3>
                        <p id="og-excluir-aviso" className="font-medium text-red-900 dark:text-red-100">Esta exclusão não pode ser desfeita. Para ter o órgão de volta, será preciso criá-lo de novo e ligar outra vez as unidades, os tipos de processo e os modelos.</p>
                        {inicial.ativo !== false && (
                            <div className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 p-3 space-y-2">
                                <p className="text-slate-800 dark:text-slate-200">Só quer parar de usar este órgão? Desative em vez de excluir. É o mesmo que desmarcar "Órgão ativo" e salvar. Ele sai do organograma que as equipes veem, mas guarda as unidades, os tipos de processo e os modelos, e pode ser ativado de novo quando quiser. As unidades dele continuam recebendo processos. Para parar também, desative cada unidade.</p>
                                <Button type="button" size="sm" variant="outline" disabled={ocupado || !o.nome.trim()} onClick={() => salvar({ ...o, ativo: false }, 'Órgão desativado')}>Desativar em vez de excluir</Button>
                            </div>
                        )}
                        {unidades.length || subordinados ? (
                            podeMover ? (
                                <>
                                    <p>Neste órgão estão {[unidades.length && `${unidades.length} unidade${unidades.length > 1 ? 's' : ''}`, subordinados && `${subordinados} órgão${subordinados > 1 ? 's' : ''} subordinado${subordinados > 1 ? 's' : ''}`].filter(Boolean).join(' e ')}. Eles, os tipos de processo e os modelos do órgão passam para o destino abaixo. Os processos seguem nas mesmas unidades.{unidades.length > 0 && ' Se a numeração usa a sigla ou a contagem por órgão, os próximos processos dessas unidades passam a ser numerados pelo destino escolhido.'}</p>
                                    <NativeSelect id="og-destino" label="Para onde vai o que está neste órgão" value={destino} onChange={setDestino}
                                        options={[...(delegado ? [] : [['', `Direto na entidade (${estado.orgao || 'sem órgão'})`]]), ...superiores]} />
                                </>
                            ) : <p role="alert" className="text-amber-800 dark:text-amber-300">Este órgão tem unidades ou órgãos subordinados. Só o admin do órgão pode excluí-lo.</p>
                        ) : <p>O órgão está vazio. {destino ? `Tipos de processo e modelos ligados a ele passam para ${orgaos.find((x) => x.id === destino)?.nome || 'o órgão superior'}.` : 'Tipos de processo e modelos ligados a ele passam a valer para a entidade inteira.'}</p>}
                        <div className="flex flex-wrap gap-2 justify-end">
                            <Button type="button" variant="outline" size="sm" autoFocus onClick={() => setConfirmar(false)}>Manter o órgão</Button>
                            <Button type="button" variant="destructive" size="sm" disabled={ocupado || (!podeMover && (unidades.length || subordinados)) || (delegado && podeMover && !destino)}
                                onClick={() => rodar('removerOrgao', { id: o.id, destino: destino || null }, 'Órgão excluído')}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Excluir órgão</Button>
                        </div>
                    </section>
                )}
                <DialogFooter className="gap-2 sm:justify-between">
                    <div>
                        {o.id && !confirmar && (estado.isAdmin || podeMover || inicial.criado_por === estado.uid) && <Button type="button" variant="ghost" className="gap-1 text-red-700 dark:text-red-400" onClick={() => setConfirmar(true)}><Trash2 className="w-4 h-4" /> Excluir órgão</Button>}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={onFechar}>Cancelar</Button>
                        <Button disabled={ocupado || !o.nome.trim()} onClick={() => salvar(o, 'Órgão salvo')}>
                            {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} {o.id ? 'Salvar' : 'Criar órgão'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

let seq = 0;
const novaChave = () => `n${Date.now().toString(36)}${seq++}`;

/** Assistente: escolhe um ponto de partida, ajusta os órgãos vendo o organograma e cria tudo de uma vez. */
function MontarEstrutura({ orgId, estado, aberto, onFechar }) {
    const qc = useQueryClient();
    const [modelo, setModelo] = useState(null);
    const [linhas, setLinhas] = useState([]);
    const [criando, setCriando] = useState(false);
    useEffect(() => { if (aberto) { setModelo(null); setLinhas([]); } }, [aberto]);
    const existentes = estado.orgaos || [];
    const escolher = (m) => { setModelo(m.id); setLinhas(m.orgaos.map((o) => ({ ...o, unidades: { ...o.unidades }, competencias: [...o.competencias] }))); };
    const mudar = (chave, campo, valor) => setLinhas((l) => l.map((o) => (o.chave === chave ? { ...o, [campo]: valor } : o)));
    const remover = (chave) => setLinhas((l) => l.filter((o) => o.chave !== chave).map((o) => (o.pai_chave === chave ? { ...o, pai_chave: null } : o)));
    const problemas = problemasEstrutura(linhas);
    const totalUnidades = linhas.reduce((n, o) => n + unidadesDoOrgao(o).length, 0);
    // No organograma de prévia, órgão novo abaixo de um existente aparece no primeiro nível.
    const previa = emArvore(linhas.map((o) => ({ ...o, pai_chave: linhas.some((x) => x.chave === o.pai_chave) ? o.pai_chave : null })), 'chave', 'pai_chave');
    const criar = async () => {
        setCriando(true);
        try {
            const r = await secConfig(orgId, 'criarEstrutura', {
                orgaos: linhas.map(({ unidades, ...o }) => ({ ...o, nome: o.nome.trim(), unidades: unidadesDoOrgao({ ...o, unidades }) })),
            });
            toast.success(`Estrutura criada: ${r.orgaos} órgão(s) e ${r.unidades} unidade(s). Agora monte a equipe de cada unidade.`);
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível criar a estrutura'); } finally { setCriando(false); }
    };
    return (
        <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
            <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Montar a estrutura da entidade</DialogTitle>
                    <DialogDescription>
                        {modelo ? 'Passo 2 de 2: ajuste os órgãos. Renomeie, mude o superior, marque as unidades de cada um e confira o organograma antes de criar.' : 'Passo 1 de 2: escolha um ponto de partida. Nada é criado até você confirmar no passo seguinte.'}
                    </DialogDescription>
                </DialogHeader>

                {!modelo && (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {ESTRUTURAS.map((m) => (
                            <button key={m.id} type="button" onClick={() => escolher(m)} className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><Network className="w-4 h-4" aria-hidden /> {m.nome}</span>
                                <span className="block text-sm text-slate-600 dark:text-slate-400 mt-1">{m.descricao}</span>
                                {m.id !== 'branco' && <span className="block text-xs text-slate-600 dark:text-slate-400 mt-2">{m.orgaos.length} órgãos: {m.orgaos.map((o) => o.nome).join(', ')}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {modelo && (
                    <div className="grid lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-3 space-y-3">
                            {existentes.length > 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Os órgãos abaixo serão somados aos {existentes.length} que já existem.</p>}
                            {linhas.map((o, i) => (
                                <fieldset key={o.chave} className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                    <legend className="sr-only">Órgão {i + 1}</legend>
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 min-w-0"><Label htmlFor={`me-nome-${o.chave}`}>Nome do órgão</Label><Input id={`me-nome-${o.chave}`} value={o.nome} maxLength={120} onChange={(e) => mudar(o.chave, 'nome', e.target.value)} placeholder="Ex.: Diretoria Técnica" /></div>
                                        <div className="w-24"><Label htmlFor={`me-sigla-${o.chave}`}>Sigla</Label><Input id={`me-sigla-${o.chave}`} value={o.sigla} maxLength={20} onChange={(e) => mudar(o.chave, 'sigla', e.target.value)} /></div>
                                        <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${o.nome || `órgão ${i + 1}`}`} onClick={() => remover(o.chave)}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                    <div className="grid sm:grid-cols-3 gap-2">
                                        <div><Label htmlFor={`me-pai-${o.chave}`}>Órgão superior</Label>
                                            <select id={`me-pai-${o.chave}`} className={sel} value={o.pai_chave || ''} onChange={(e) => mudar(o.chave, 'pai_chave', e.target.value || null)}>
                                                <option value="">Nenhum</option>
                                                {linhas.filter((x) => x.chave !== o.chave && x.nome.trim()).map((x) => <option key={x.chave} value={x.chave}>{x.nome}</option>)}
                                                {existentes.map((x) => <option key={x.id} value={x.id}>{x.nome} (já existe)</option>)}
                                            </select>
                                        </div>
                                        <div><Label htmlFor={`me-nat-${o.chave}`}>Natureza</Label>
                                            <select id={`me-nat-${o.chave}`} className={sel} value={o.natureza} onChange={(e) => mudar(o.chave, 'natureza', e.target.value)}>
                                                {Object.entries(NATUREZAS).map(([k, n]) => <option key={k} value={k}>{n.rotulo}</option>)}
                                            </select>
                                        </div>
                                        <div><Label htmlFor={`me-dec-${o.chave}`}>Quem decide</Label>
                                            <select id={`me-dec-${o.chave}`} className={sel} value={o.decisao} onChange={(e) => mudar(o.chave, 'decisao', e.target.value)}>
                                                {DECISOES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                        <span className="text-slate-700 dark:text-slate-300">Unidades a criar:</span>
                                        {[['secretaria', 'Secretaria (autua e cumpre)'], ['gabinete', 'Gabinete (decide)'], ['assessoria', 'Assessoria (minuta)']].map(([t, r]) => (
                                            <label key={t} className="flex items-center gap-1.5"><Checkbox checked={o.unidades[t] === true} onCheckedChange={(c) => mudar(o.chave, 'unidades', { ...o.unidades, [t]: c === true })} /> {r}</label>
                                        ))}
                                    </div>
                                </fieldset>
                            ))}
                            <Button type="button" variant="outline" className="gap-1" onClick={() => setLinhas((l) => [...l, { chave: novaChave(), nome: '', sigla: '', natureza: 'executivo', pai_chave: null, decisao: 'singular', titular_cargo: '', competencias: [], unidades: { secretaria: false, gabinete: true, assessoria: false } }])}><Plus className="w-4 h-4" /> Adicionar órgão</Button>
                        </div>
                        <aside className="lg:col-span-2" aria-label="Prévia do organograma">
                            <div className="lg:sticky lg:top-0 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <p className="text-sm font-semibold flex items-center gap-2"><Landmark className="w-4 h-4" aria-hidden /> {estado.orgao || 'Entidade'}</p>
                                <Organograma nos={previa} chave="chave" unidadesDe={unidadesDoOrgao} />
                                <p className="text-xs text-slate-600 dark:text-slate-400">Competências, titular e equipe de cada unidade se ajustam depois, abrindo o órgão ou a unidade.</p>
                            </div>
                        </aside>
                    </div>
                )}

                {modelo && (
                    <DialogFooter className="gap-2 sm:justify-between items-center">
                        <Button type="button" variant="ghost" className="gap-1" onClick={() => setModelo(null)}><ArrowLeft className="w-4 h-4" /> Trocar o ponto de partida</Button>
                        <div className="flex flex-wrap items-center gap-3 justify-end">
                            {problemas.length > 0 && <p className="text-sm text-amber-800 dark:text-amber-300" role="alert">{problemas.join(' ')}</p>}
                            <Button disabled={criando || problemas.length > 0} onClick={criar}>
                                {criando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar {linhas.length} órgão{linhas.length === 1 ? '' : 's'} e {totalUnidades} unidade{totalUnidades === 1 ? '' : 's'}
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
