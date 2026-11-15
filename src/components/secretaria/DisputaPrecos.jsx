import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CalendarClock, ClipboardPaste, Copy, Gavel, Loader2, Mail, Plus, Send, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secProcesso } from '@/services/secretariaService';
import AjudaTermo from './AjudaTermo';
import { SalaLancesOrgao } from './SalaLances';
import {
    CRITERIOS, DIAS_UTEIS_MINIMOS, HORAS_LANCES, MAX_ITENS, PERFIS_DISPUTA, UNIDADES_DISPUTA, faltaPara, moeda, numero, quandoBr, valorEstimado, valorTexto,
} from '@/lib/certames';

/**
 * Disputa de preços (S11): a ação do rito que pede uma cotação privada ou uma
 * dispensa eletrônica. Quem tem o processo monta o aviso (objeto, itens,
 * critério, abertura), publica, convida fornecedores e acompanha quantas
 * propostas chegaram. O conteúdo das propostas é sigiloso até a abertura.
 */
const sel = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const ITEM_VAZIO = { descricao: '', unidade: 'unidade', quantidade: '', valor_estimado: '', lote: '' };
const br = (s) => (s || '').split('-').reverse().join('/');
const fmtNum = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));

function formDe(c, perfil) {
    return {
        objeto: c?.objeto || '', criterio: c?.criterio || 'menor_preco', unidade_disputa: c?.unidade_disputa || 'item',
        itens: c?.itens?.length ? c.itens.map((i) => ({ ...i, quantidade: fmtNum(i.quantidade), valor_estimado: fmtNum(i.valor_estimado), lote: i.lote || '' })) : [{ ...ITEM_VAZIO }],
        intervalo: { tipo: c?.intervalo?.tipo || 'percentual', valor: fmtNum(c?.intervalo?.valor || '') },
        orcamento_sigiloso: !!c?.orcamento_sigiloso, abertura_data: c?.abertura_data || '', abertura_hora: c?.abertura_hora || '09:00',
        lances: perfil === 'dispensa' ? true : !!c?.lances, horas_lances: c?.horas_lances || HORAS_LANCES[perfil][0],
        condicoes: c?.condicoes || '', habilitacao: c?.habilitacao || '',
    };
}

/** Linhas coladas de planilha: descrição, unidade, quantidade e valor estimado, separados por tabulação ou ponto e vírgula. */
export function itensColados(texto) {
    return texto.split(/\r?\n/).map((l) => l.split(/\t|;/).map((x) => x.trim())).filter((c) => c[0])
        .map(([descricao, unidade, quantidade, valor]) => ({ ...ITEM_VAZIO, descricao, unidade: unidade || 'unidade', quantidade: quantidade || '1', valor_estimado: valor || '' }));
}

function Itens({ form, setForm, sigiloso }) {
    const [colar, setColar] = useState(false);
    const [txt, setTxt] = useState('');
    const lote = form.unidade_disputa === 'lote';
    const setItem = (k, x) => setForm((f) => ({ ...f, itens: f.itens.map((i, j) => (j === k ? { ...i, ...x } : i)) }));
    const total = valorEstimado(form.itens);
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Itens ({form.itens.length})</legend>
            <ol className="space-y-2">
                {form.itens.map((i, k) => (
                    <li key={k} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                        <div className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-2 w-6 shrink-0">{k + 1}.</span>
                            <div className="grid flex-1 gap-2 sm:grid-cols-12">
                                <div className="sm:col-span-12"><Label htmlFor={`dp-desc-${k}`} className="text-xs">Descrição</Label>
                                    <Input id={`dp-desc-${k}`} className="mt-1" maxLength={500} value={i.descricao} placeholder="O que se compra ou contrata, com as especificações" onChange={(e) => setItem(k, { descricao: e.target.value })} /></div>
                                <div className="sm:col-span-3"><Label htmlFor={`dp-un-${k}`} className="text-xs">Unidade</Label>
                                    <Input id={`dp-un-${k}`} className="mt-1" maxLength={30} value={i.unidade} onChange={(e) => setItem(k, { unidade: e.target.value })} /></div>
                                <div className="sm:col-span-3"><Label htmlFor={`dp-qt-${k}`} className="text-xs">Quantidade</Label>
                                    <Input id={`dp-qt-${k}`} className="mt-1" inputMode="decimal" value={i.quantidade} onChange={(e) => setItem(k, { quantidade: e.target.value })} /></div>
                                <div className="sm:col-span-3"><Label htmlFor={`dp-vl-${k}`} className="text-xs">{form.criterio === 'maior_desconto' ? 'Preço de referência' : 'Valor estimado unitário'}</Label>
                                    <Input id={`dp-vl-${k}`} className="mt-1" inputMode="decimal" placeholder="Opcional" value={i.valor_estimado} onChange={(e) => setItem(k, { valor_estimado: e.target.value })} /></div>
                                {lote && <div className="sm:col-span-3"><Label htmlFor={`dp-lt-${k}`} className="text-xs">Lote</Label>
                                    <Input id={`dp-lt-${k}`} className="mt-1" inputMode="numeric" value={i.lote} onChange={(e) => setItem(k, { lote: e.target.value })} /></div>}
                                <label className="sm:col-span-12 flex items-center gap-2 text-xs">
                                    <input type="checkbox" checked={!!i.exclusivo_meepp} onChange={(e) => setItem(k, { exclusivo_meepp: e.target.checked })} />
                                    Exclusivo para microempresa e empresa de pequeno porte (LC 123/2006, art. 48, I)
                                </label>
                            </div>
                            <Button size="icon" variant="ghost" aria-label={`Tirar o item ${k + 1}`} disabled={form.itens.length < 2} onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((_, j) => j !== k) }))}><Trash2 className="w-4 h-4" aria-hidden /></Button>
                        </div>
                    </li>
                ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1" disabled={form.itens.length >= MAX_ITENS} onClick={() => setForm((f) => ({ ...f, itens: [...f.itens, { ...ITEM_VAZIO, lote: lote ? f.itens.at(-1)?.lote || '1' : '' }] }))}><Plus className="w-4 h-4" aria-hidden /> Item</Button>
                <Button size="sm" variant="ghost" className="gap-1" aria-expanded={colar} onClick={() => setColar(!colar)}><ClipboardPaste className="w-4 h-4" aria-hidden /> Colar da planilha</Button>
                {total != null && <span className="text-xs text-slate-600 dark:text-slate-400 ml-auto">Valor estimado total: <b>{moeda(total)}</b>{sigiloso ? ' (sigiloso: os fornecedores não veem)' : ''}</span>}
            </div>
            {colar && (
                <div className="space-y-1">
                    <Label htmlFor="dp-colar" className="text-xs">Uma linha por item: descrição, unidade, quantidade e valor estimado, separados por tabulação (como sai da planilha) ou ponto e vírgula.</Label>
                    <Textarea id="dp-colar" rows={4} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Papel A4, resma de 500 folhas\tresma\t100\t25,90'} />
                    <Button size="sm" disabled={!txt.trim()} onClick={() => {
                        const novos = itensColados(txt);
                        setForm((f) => ({ ...f, itens: [...f.itens.filter((i) => i.descricao.trim()), ...novos].slice(0, MAX_ITENS) }));
                        setTxt(''); setColar(false); toast.success(`${novos.length} ${novos.length > 1 ? 'itens incluídos' : 'item incluído'}`);
                    }}>Incluir os itens</Button>
                </div>
            )}
        </fieldset>
    );
}

function FormAviso({ form, setForm, perfil, minima }) {
    const set = (x) => setForm((f) => ({ ...f, ...x }));
    const [hMin, hMax] = HORAS_LANCES[perfil];
    return (
        <div className="space-y-4">
            <div><Label htmlFor="dp-objeto">Objeto</Label>
                <Textarea id="dp-objeto" className="mt-1" rows={2} maxLength={2000} value={form.objeto} onChange={(e) => set({ objeto: e.target.value })} placeholder="Ex.: aquisição de material de expediente para a unidade" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="dp-criterio">Critério de julgamento</Label>
                    <select id="dp-criterio" className={sel} value={form.criterio} onChange={(e) => set({ criterio: e.target.value })}>
                        {Object.entries(CRITERIOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                <div><Label htmlFor="dp-unidade">Disputa</Label>
                    <select id="dp-unidade" className={sel} value={form.unidade_disputa} onChange={(e) => set({ unidade_disputa: e.target.value, itens: form.itens.map((i) => ({ ...i, lote: e.target.value === 'lote' ? i.lote || '1' : '' })) })}>
                        {Object.entries(UNIDADES_DISPUTA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
            </div>
            <Itens form={form} setForm={setForm} sigiloso={form.orcamento_sigiloso} />
            <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={form.orcamento_sigiloso} onChange={(e) => set({ orcamento_sigiloso: e.target.checked })} />
                <span>Orçamento sigiloso <span className="block text-xs text-slate-600 dark:text-slate-400">Os fornecedores não veem o valor estimado; ele se divulga depois do julgamento (Lei 14.133/2021, art. 24).</span></span>
            </label>
            <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Abertura</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label htmlFor="dp-data">Data</Label><Input id="dp-data" type="date" className="mt-1" min={minima} value={form.abertura_data} onChange={(e) => set({ abertura_data: e.target.value })} /></div>
                    <div><Label htmlFor="dp-hora">Hora (Brasília)</Label><Input id="dp-hora" type="time" className="mt-1" min="08:00" max="18:00" value={form.abertura_hora} onChange={(e) => set({ abertura_hora: e.target.value })} /></div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    As propostas chegam até a abertura. Publicando hoje, a abertura pode ser a partir de {br(minima)}, em dia útil e horário comercial
                    ({DIAS_UTEIS_MINIMOS[perfil]} dia{DIAS_UTEIS_MINIMOS[perfil] > 1 ? 's úteis' : ' útil'} depois da publicação{perfil === 'dispensa' ? ', IN 67/2021, art. 6º' : ''}).
                </p>
            </fieldset>
            <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lances</legend>
                {perfil === 'cotacao' && (
                    <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={form.lances} onChange={(e) => set({ lances: e.target.checked })} />
                        <span>Abrir lances depois das propostas <span className="block text-xs text-slate-600 dark:text-slate-400">Sem lances, vale a proposta: a classificação sai na abertura.</span></span>
                    </label>
                )}
                {form.lances && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div><Label htmlFor="dp-horas">Duração (horas)</Label><Input id="dp-horas" type="number" className="mt-1" min={hMin} max={hMax} value={form.horas_lances} onChange={(e) => set({ horas_lances: e.target.value })} /></div>
                        <div><Label htmlFor="dp-iv-tipo">Intervalo mínimo entre lances</Label>
                            <select id="dp-iv-tipo" className={sel} value={form.intervalo.tipo} onChange={(e) => set({ intervalo: { ...form.intervalo, tipo: e.target.value } })}>
                                <option value="percentual">Em percentual</option><option value="valor">Em reais</option>
                            </select></div>
                        <div><Label htmlFor="dp-iv">Intervalo</Label><Input id="dp-iv" className="mt-1" inputMode="decimal" placeholder="0 = sem intervalo" value={form.intervalo.valor} onChange={(e) => set({ intervalo: { ...form.intervalo, valor: e.target.value } })} /></div>
                    </div>
                )}
                {perfil === 'dispensa' && <p className="text-xs text-slate-600 dark:text-slate-400">Na dispensa eletrônica, os lances duram de 6 a 10 horas, sem prorrogação (IN 67/2021, art. 11).</p>}
            </fieldset>
            <div><Label htmlFor="dp-cond">Condições da contratação</Label>
                <Textarea id="dp-cond" className="mt-1" rows={3} maxLength={4000} value={form.condicoes} onChange={(e) => set({ condicoes: e.target.value })} placeholder="Local e prazo de entrega, pagamento, garantia, sanções" /></div>
            <div><Label htmlFor="dp-hab">Habilitação</Label>
                <Textarea id="dp-hab" className="mt-1" rows={3} maxLength={4000} value={form.habilitacao} onChange={(e) => set({ habilitacao: e.target.value })} placeholder="Documentos que o vencedor apresenta (regularidade fiscal, trabalhista, qualificação técnica)" /></div>
        </div>
    );
}

const paraServidor = (f) => ({
    ...f,
    itens: f.itens.filter((i) => i.descricao.trim() || i.quantidade).map((i) => ({ ...i, quantidade: numero(i.quantidade), valor_estimado: i.valor_estimado === '' ? '' : numero(i.valor_estimado), lote: i.lote === '' ? '' : Number(i.lote) })),
    intervalo: { tipo: f.intervalo.tipo, valor: f.intervalo.valor === '' ? 0 : numero(f.intervalo.valor) },
    horas_lances: Number(f.horas_lances),
});

function Convites({ c, gerir, chamar, indo }) {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [link, setLink] = useState('');
    const ativos = (c.convites || []).filter((v) => !v.revogado);
    return (
        <section className="space-y-2" aria-label="Fornecedores convidados">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Users className="w-4 h-4" aria-hidden /> Fornecedores convidados ({ativos.length})</h3>
            {ativos.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                    {ativos.map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                            <span className="flex-1 min-w-[10rem]"><b>{v.nome}</b> <span className="text-xs text-slate-600 dark:text-slate-400">{v.email}</span></span>
                            <Badge variant="outline">{v.aceito ? 'Aceitou' : 'Aguardando'}</Badge>
                            {gerir && !v.aceito && <Button size="sm" variant="ghost" disabled={indo} onClick={() => chamar('certameRevogarConvite', { convite_id: v.id }, 'Convite revogado')}>Revogar</Button>}
                        </li>
                    ))}
                </ul>
            )}
            {gerir && (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
                    <div><Label htmlFor="dp-cv-nome" className="text-xs">Fornecedor</Label><Input id="dp-cv-nome" className="mt-1" maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                    <div><Label htmlFor="dp-cv-email" className="text-xs">E-mail</Label><Input id="dp-cv-email" type="email" className="mt-1" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                    <Button className="gap-1" disabled={indo || nome.trim().length < 3 || !email.includes('@')} onClick={async () => {
                        const r = await chamar('certameConvidar', { nome, email }, 'Convite feito');
                        if (r) { setNome(''); setEmail(''); setLink(r.link || ''); if (r.emailEnviado === false) toast.info('O e-mail não saiu: copie o link do convite e envie ao fornecedor.'); }
                    }}><Mail className="w-4 h-4" aria-hidden /> Convidar</Button>
                </div>
            )}
            {link && (
                <p className="text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-2">Link do último convite (só aparece agora):
                    <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('Link copiado'))}><Copy className="w-3.5 h-3.5" aria-hidden /> Copiar</Button>
                </p>
            )}
        </section>
    );
}

function Propostas({ orgId, procId, criterio }) {
    const q = useQuery({ queryKey: ['sec-disputa-propostas', orgId, procId], queryFn: () => secProcesso(orgId, 'certamePropostas', { processo_id: procId }) });
    if (q.isLoading) return <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Abrindo as propostas…</p>;
    if (q.error) return <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>;
    return (
        <section className="space-y-3" aria-label="Propostas">
            {q.data.unidades.map((u) => (
                <div key={u.chave}>
                    <h4 className="text-sm font-semibold">{u.nome}</h4>
                    {!u.classificacao.length ? <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma proposta.</p> : (
                        <ol className="mt-1 space-y-1">
                            {u.classificacao.map((x, k) => (
                                <li key={k} className="flex flex-wrap gap-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1">
                                    <span className="font-semibold w-6">{k + 1}º</span>
                                    <span className="flex-1 min-w-[10rem]">{x.fornecedor} <span className="text-xs text-slate-600 dark:text-slate-400">{x.documento}{x.porte === 'me_epp' ? ' · ME/EPP' : ''}</span></span>
                                    <b>{valorTexto(x.valor, criterio)}</b>{x.por_lance && <span className="text-xs text-slate-600 dark:text-slate-400">por lance</span>}
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            ))}
            <p className="text-xs text-slate-600 dark:text-slate-400">Empate: vale quem chegou antes ao valor. O julgamento, a habilitação e o resultado vêm em seguida.</p>
        </section>
    );
}

export default function DisputaPrecos({ orgId, procId, onFechar }) {
    const qc = useQueryClient();
    const chave = ['sec-disputa', orgId, procId];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'certameLer', { processo_id: procId }) });
    const d = q.data;
    const c = d?.certame;
    const perfil = c?.perfil || d?.acao?.perfil || 'cotacao';
    const [form, setForm] = useState(null);
    const [indo, setIndo] = useState(false);
    const [modal, setModal] = useState(null); // 'adiar' | 'cancelar'
    const [motivo, setMotivo] = useState('');
    const [nova, setNova] = useState({ data: '', hora: '' });
    const [agora, setAgora] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
    useEffect(() => { if (d && !form) setForm(formDe(c, perfil)); }, [d, c, perfil, form]);
    const editavel = d?.pode?.editar && (!c || c.situacao === 'rascunho');
    const aberta = c?.abertura_em && Date.parse(c.abertura_em) <= agora;
    const mudou = useMemo(() => form && JSON.stringify(paraServidor(form)) !== JSON.stringify(paraServidor(formDe(c, perfil))), [form, c, perfil]);

    const chamar = async (action, extra, ok) => {
        setIndo(true);
        try {
            const r = await secProcesso(orgId, action, { processo_id: procId, ...extra });
            toast.success(ok);
            await qc.invalidateQueries({ queryKey: chave });
            qc.invalidateQueries({ queryKey: ['sec-proc', orgId, procId] });
            return r || true;
        } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return false; } finally { setIndo(false); }
    };
    const salvar = () => chamar('certameSalvar', { dados: paraServidor(form) }, 'Rascunho salvo');
    const publicar = async () => {
        if (mudou && !(await salvar())) return;
        const r = await chamar('certamePublicar', {}, 'Aviso publicado');
        if (r) setForm(null);
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2"><Gavel className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Disputa de preços <AjudaTermo id="disputa_precos" />
                        <Badge variant="outline">{PERFIS_DISPUTA[perfil]}</Badge>
                        {c && <Badge className={c.situacao === 'publicado' ? 'bg-indigo-600 hover:bg-indigo-600' : 'bg-slate-600 hover:bg-slate-600'}>{aberta && c.situacao === 'publicado' ? (d.momento === 'lances' ? 'Em lances' : 'Aberta') : c.situacao_nome}</Badge>}
                    </DialogTitle>
                    <DialogDescription>{d ? `Processo ${d.processo.numero}${d.acao ? `: ${d.acao.nome}` : ''}.` : 'Carregando…'}</DialogDescription>
                </DialogHeader>
                {q.isLoading && <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p>}
                {q.error && <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>}
                {d && !c && !d.pode.editar && <p className="text-sm text-slate-700 dark:text-slate-300">{d.motivo || 'Nenhuma disputa montada.'}</p>}
                {d && form && editavel && (
                    <>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            {perfil === 'dispensa'
                                ? 'Monte o aviso e publique: ele vai aos autos e ganha um link público, em que qualquer fornecedor com conta na plataforma envia proposta.'
                                : 'Monte o aviso e publique: ele vai aos autos e você convida os fornecedores por e-mail. Só quem foi convidado vê o aviso e envia proposta.'}
                            {' '}O rascunho só a equipe vê.
                        </p>
                        <FormAviso form={form} setForm={setForm} perfil={perfil} minima={d.abertura_minima} />
                        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                            {c && <Button variant="ghost" className="gap-1 text-rose-700 dark:text-rose-300" disabled={indo} onClick={async () => { if (await chamar('certameCancelar', {}, 'Rascunho descartado')) setForm(null); }}><Trash2 className="w-4 h-4" aria-hidden /> Descartar</Button>}
                            <Button variant="outline" disabled={indo || !mudou} onClick={salvar}>Salvar rascunho</Button>
                            <Button className="gap-1" disabled={indo || (!c && !mudou)} onClick={publicar}><Send className="w-4 h-4" aria-hidden /> Publicar o aviso</Button>
                        </DialogFooter>
                    </>
                )}
                {d && c && c.situacao !== 'rascunho' && (
                    <div className="space-y-4">
                        <div className="rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-3 text-sm space-y-1">
                            <p><b>Abertura:</b> {quandoBr(c.abertura_em)} (horário de Brasília){!aberta && <> · faltam {faltaPara(c.abertura_em, agora)}</>}</p>
                            <p><b>Propostas recebidas:</b> {c.propostas_n || 0} <span className="text-xs text-slate-600 dark:text-slate-400">{aberta ? '' : '(o conteúdo é sigiloso até a abertura)'}</span></p>
                            {c.link && perfil === 'dispensa' && (
                                <p className="flex flex-wrap items-center gap-2"><b>Link público:</b> <span className="break-all">{c.link}</span>
                                    <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => navigator.clipboard?.writeText(c.link).then(() => toast.success('Link copiado'))}><Copy className="w-3.5 h-3.5" aria-hidden /> Copiar</Button>
                                    <span className="text-xs text-slate-600 dark:text-slate-400">Código {c.codigo}</span></p>
                            )}
                            {(c.adiamentos || []).map((a, k) => <p key={k} className="text-xs text-slate-700 dark:text-slate-300">Adiada de {quandoBr(a.de)} para {quandoBr(a.para)}: {a.motivo}</p>)}
                        </div>
                        <details className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                            <summary className="text-sm font-semibold cursor-pointer">Aviso publicado</summary>
                            <pre className="mt-2 whitespace-pre-wrap text-sm font-sans text-slate-800 dark:text-slate-200">{c.aviso}</pre>
                        </details>
                        {c.situacao === 'publicado' && !aberta && <Convites c={c} gerir={d.pode.gerir} chamar={chamar} indo={indo} />}
                        {aberta && c.situacao === 'publicado' && c.lances && <SalaLancesOrgao orgId={orgId} procId={procId} />}
                        {aberta && c.situacao === 'publicado' && (!c.lances || d.momento === 'encerrada') && <Propostas orgId={orgId} procId={procId} criterio={c.criterio} />}
                        {d.pode.gerir && c.situacao === 'publicado' && !aberta && (
                            <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                                <Button variant="ghost" className="gap-1 text-rose-700 dark:text-rose-300" disabled={indo} onClick={() => { setModal('cancelar'); setMotivo(''); }}><Ban className="w-4 h-4" aria-hidden /> Cancelar a disputa</Button>
                                <Button variant="outline" className="gap-1" disabled={indo} onClick={() => { setModal('adiar'); setMotivo(''); setNova({ data: c.abertura_data, hora: c.abertura_hora }); }}><CalendarClock className="w-4 h-4" aria-hidden /> Adiar a abertura</Button>
                            </DialogFooter>
                        )}
                    </div>
                )}
                {modal && (
                    <div role="group" aria-label={modal === 'adiar' ? 'Adiar a abertura' : 'Cancelar a disputa'} className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
                        <p className="text-sm font-semibold">{modal === 'adiar' ? 'Adiar a abertura' : 'Cancelar a disputa'}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{modal === 'adiar' ? 'O adiamento vai aos autos e os fornecedores que participam recebem e-mail.' : 'O cancelamento vai aos autos, os fornecedores recebem e-mail e a ação volta a pedir uma disputa.'}</p>
                        {modal === 'adiar' && (
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div><Label htmlFor="dp-nova-data" className="text-xs">Nova data</Label><Input id="dp-nova-data" type="date" className="mt-1" min={d.abertura_minima} value={nova.data} onChange={(e) => setNova((n) => ({ ...n, data: e.target.value }))} /></div>
                                <div><Label htmlFor="dp-nova-hora" className="text-xs">Nova hora</Label><Input id="dp-nova-hora" type="time" className="mt-1" value={nova.hora} onChange={(e) => setNova((n) => ({ ...n, hora: e.target.value }))} /></div>
                            </div>
                        )}
                        <div><Label htmlFor="dp-motivo" className="text-xs">Motivo</Label><Textarea id="dp-motivo" className="mt-1" rows={2} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" onClick={() => setModal(null)}>Voltar</Button>
                            <Button disabled={indo || motivo.trim().length < 5} onClick={async () => {
                                const ok = modal === 'adiar'
                                    ? await chamar('certameAdiar', { abertura_data: nova.data, abertura_hora: nova.hora, motivo }, 'Abertura adiada')
                                    : await chamar('certameCancelar', { motivo }, 'Disputa cancelada');
                                if (ok) { setModal(null); setForm(null); }
                            }}>{modal === 'adiar' ? 'Adiar' : 'Cancelar a disputa'}</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
