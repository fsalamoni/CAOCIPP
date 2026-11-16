import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Clock, Gavel, Loader2, LogOut, Search, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { ThemeToggleButton } from '@/lib/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { secPortal } from '@/services/secretariaService';
import { Entrar } from './Portal';
import { SalaLancesFornecedor } from '@/components/secretaria/SalaLances';
import { JulgamentoFornecedor } from '@/components/secretaria/JulgamentoDisputa';
import {
    CRITERIOS, PERFIS_DISPUTA, UNIDADES_DISPUTA, alertasDaProposta, faltaPara, lotesIncompletos, moeda, numero, percentual, quandoBr, unidadesDeDisputa, valorNaUnidade,
} from '@/lib/certames';

/**
 * Disputas de preços, para o fornecedor (S11). Entra por convite (cotação
 * privada) ou pelo link do aviso (dispensa eletrônica), faz o cadastro e manda
 * a proposta até a abertura. Não é parte do processo e não vê os autos: vê o
 * aviso e a própria proposta.
 */
const fmt = (n) => (n == null || n === '' ? '' : String(n).replace('.', ','));

export default function Disputas() {
    const { user, isAuthenticated, isLoadingAuth, signOut } = useAuth();
    const [params, setParams] = useSearchParams();
    const convite = params.get('convite');
    const codigo = params.get('c');
    const id = params.get('d');
    const aceitando = useRef(false);
    const ir = (novo) => setParams(novo ? new URLSearchParams(novo) : new URLSearchParams());

    useEffect(() => {
        if (!isAuthenticated || !convite || aceitando.current) return;
        aceitando.current = true;
        secPortal('disputaConvite', { convite })
            .then((r) => { toast.success('Convite aceito. A disputa agora aparece na sua lista.'); ir({ d: r.certame_id }); })
            .catch((e) => { toast.error(e?.message || 'Convite inválido'); ir(null); });
    }, [isAuthenticated, convite]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => ir(null)} className="flex items-center gap-2 font-semibold"><Gavel className="w-5 h-5 text-indigo-600" aria-hidden /> Disputas de preços</button>
                    <div className="flex items-center gap-1 text-sm min-w-0">
                        {isAuthenticated && <span className="truncate text-slate-600 dark:text-slate-400 hidden md:inline max-w-[14rem]">{user?.email}</span>}
                        <ThemeToggleButton />
                        {isAuthenticated && <Button variant="ghost" size="sm" className="gap-1" onClick={() => signOut()}><LogOut className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Sair</span></Button>}
                    </div>
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
                {isLoadingAuth ? <Carregando texto="Carregando…" />
                    : !isAuthenticated ? <Entrar convite={!!convite} titulo="Disputas de preços"
                        texto="Aqui o fornecedor vê o aviso, faz o cadastro e manda a proposta até a abertura. Entre com sua conta Google ou crie uma senha; quem recebeu convite usa o link do e-mail." />
                        : convite ? <Carregando texto="Aceitando o convite…" />
                            : id || codigo ? <Disputa id={id} codigo={codigo} onVoltar={() => ir(null)} onAbrir={(x) => ir({ d: x })} />
                                : <MinhasDisputas onAbrir={(x) => ir({ d: x })} onCodigo={(x) => ir({ c: x })} />}
            </main>
        </div>
    );
}

function Carregando({ texto }) {
    return <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2 justify-center py-10"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> {texto}</p>;
}

function SeloSituacao({ a, agora }) {
    if (a.situacao === 'cancelado') return <Badge className="bg-rose-700 hover:bg-rose-700">Cancelada</Badge>;
    if (a.situacao === 'publicado' && Date.parse(a.abertura_em) > agora) return <Badge className="bg-indigo-600 hover:bg-indigo-600">Recebendo propostas</Badge>;
    return <Badge variant="outline">{a.situacao === 'publicado' ? (a.momento === 'lances' ? 'Em lances' : 'Em julgamento') : a.situacao === 'encerrado' && a.resultado ? a.resultado : a.situacao_nome}</Badge>;
}

function MinhasDisputas({ onAbrir, onCodigo }) {
    const q = useQuery({ queryKey: ['disputas-minhas'], queryFn: () => secPortal('disputaMinhas') });
    const [cod, setCod] = useState('');
    const agora = Date.now();
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-semibold">Minhas disputas</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">As disputas em que você foi convidado ou entrou pelo link do aviso.</p>
            </div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (cod.trim()) onCodigo(cod.trim().toUpperCase()); }}>
                <div><Label htmlFor="disp-cod" className="text-xs">Tem o código de um aviso?</Label><Input id="disp-cod" className="mt-1 w-44 uppercase" maxLength={8} value={cod} onChange={(e) => setCod(e.target.value)} placeholder="Ex.: K7M2Q9PX" /></div>
                <Button type="submit" variant="outline" className="gap-1" disabled={cod.trim().length !== 8}><Search className="w-4 h-4" aria-hidden /> Abrir o aviso</Button>
            </form>
            {q.isLoading && <Carregando texto="Carregando suas disputas…" />}
            {q.error && <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>}
            {q.data && !q.data.disputas.length && <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma disputa ainda.</p>}
            <ul className="grid gap-3 sm:grid-cols-2">
                {(q.data?.disputas || []).map((a) => (
                    <li key={a.id}>
                        <button type="button" onClick={() => onAbrir(a.id)} className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">{PERFIS_DISPUTA[a.perfil]} · {a.orgao_nome} <SeloSituacao a={a} agora={agora} /></span>
                            <span className="block mt-1 font-medium line-clamp-2">{a.objeto}</span>
                            <span className="block mt-1 text-xs text-slate-600 dark:text-slate-400">Abertura {quandoBr(a.abertura_em)}{Date.parse(a.abertura_em) > agora ? ` · faltam ${faltaPara(a.abertura_em, agora)}` : ''}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Aviso({ a, agora }) {
    const desconto = a.criterio === 'maior_desconto';
    return (
        <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">{PERFIS_DISPUTA[a.perfil]} · {a.orgao_nome}{a.unidade_nome ? ` · ${a.unidade_nome}` : ''} · processo {a.processo_numero} <SeloSituacao a={a} agora={agora} /></div>
                <h1 className="text-lg font-semibold">{a.objeto}</h1>
                {a.cancelado && <p className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-2">Disputa cancelada: {a.cancelado.motivo}</p>}
                <p className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                    <span><b>Propostas até {quandoBr(a.abertura_em)}</b> (horário de Brasília){Date.parse(a.abertura_em) > agora ? ` · faltam ${faltaPara(a.abertura_em, agora)}` : ''}</span></p>
                <p>Julgamento pelo {CRITERIOS[a.criterio].toLowerCase()}, {UNIDADES_DISPUTA[a.unidade_disputa].toLowerCase()}. {a.lances
                    ? `Depois da abertura, lances por ${a.horas_lances} hora${a.horas_lances > 1 ? 's' : ''}${a.intervalo?.valor ? `, com intervalo mínimo de ${a.intervalo.tipo === 'valor' ? moeda(a.intervalo.valor) : percentual(a.intervalo.valor)}` : ''}.`
                    : 'Sem lances: vale a proposta.'}</p>
                {(a.adiamentos || []).map((x, k) => <p key={k} className="text-xs text-slate-700 dark:text-slate-300">Abertura adiada de {quandoBr(x.de)} para {quandoBr(x.para)}: {x.motivo}</p>)}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-600 dark:text-slate-400"><tr><th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Descrição</th><th className="py-1 pr-2">Qtd.</th>{!a.orcamento_sigiloso && <th className="py-1">{desconto ? 'Referência' : 'Estimado unit.'}</th>}</tr></thead>
                        <tbody>{a.itens.map((i) => (
                            <tr key={i.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                                <td className="py-1 pr-2">{i.numero}{i.lote ? <span className="block text-xs text-slate-600 dark:text-slate-400">lote {i.lote}</span> : null}</td>
                                <td className="py-1 pr-2">{i.descricao}{i.exclusivo_meepp && <Badge variant="outline" className="ml-1 text-[10px]">Exclusivo ME/EPP</Badge>}</td>
                                <td className="py-1 pr-2 whitespace-nowrap">{fmt(i.quantidade)} {i.unidade}</td>
                                {!a.orcamento_sigiloso && <td className="py-1 whitespace-nowrap">{i.valor_estimado != null ? moeda(i.valor_estimado) : '—'}</td>}
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
                {a.orcamento_sigiloso && <p className="text-xs text-slate-600 dark:text-slate-400">O orçamento estimado é sigiloso e será divulgado depois do julgamento.</p>}
                {a.condicoes && <div><h2 className="font-semibold">Condições da contratação</h2><p className="whitespace-pre-wrap">{a.condicoes}</p></div>}
                {a.habilitacao && <div><h2 className="font-semibold">Habilitação</h2><p className="whitespace-pre-wrap">{a.habilitacao}</p></div>}
            </CardContent>
        </Card>
    );
}

// O recibo fica no pai: o formulário se remonta a cada versão recebida.
function FormProposta({ d, onFeito, recibo, setRecibo }) {
    const a = d.aviso;
    const desconto = a.criterio === 'maior_desconto';
    const ini = d.proposta?.licitante || d.perfil || {};
    const [lic, setLic] = useState({ razao_social: ini.razao_social || '', documento: ini.documento || '', porte: ini.porte || 'demais', representante: ini.representante || '' });
    const [itens, setItens] = useState(() => a.itens.map((i) => {
        const x = d.proposta?.itens?.find((y) => y.item_id === i.id) || {};
        return { item_id: i.id, valor: fmt(x.valor), marca: x.marca || '', modelo: x.modelo || '', descricao: x.descricao || '' };
    }));
    const [decl, setDecl] = useState(() => new Set(d.proposta?.declaracoes || []));
    const [indo, setIndo] = useState(false);
    const setItem = (k, x) => setItens((l) => l.map((y, j) => (j === k ? { ...y, ...x } : y)));
    const cotados = itens.filter((x) => Number.isFinite(numero(x.valor)));
    const alertas = alertasDaProposta(itens, a);
    const incompletos = lotesIncompletos(itens, a);
    const unidades = useMemo(() => unidadesDeDisputa(a), [a]);
    const obrig = d.declaracoes.filter((x) => x.obrigatoria).every((x) => decl.has(x.id)) && (lic.porte !== 'me_epp' || decl.has('meepp'));
    const pronto = lic.razao_social.trim().length >= 3 && lic.documento.trim() && cotados.length && !incompletos.length && obrig;
    const enviar = async () => {
        setIndo(true);
        try {
            const r = await secPortal('disputaProposta', {
                certame_id: a.id, licitante: lic,
                proposta: { itens: cotados.map((x) => ({ ...x, valor: numero(x.valor) })), declaracoes: [...decl] },
            });
            setRecibo(r.recibo);
            toast.success(d.proposta ? 'Proposta atualizada' : 'Proposta enviada');
            onFeito();
        } catch (e) { toast.error(e?.message || 'Não foi possível enviar'); } finally { setIndo(false); }
    };
    const retirar = async () => {
        setIndo(true);
        try { await secPortal('disputaRetirar', { certame_id: a.id }); toast.success('Proposta retirada'); setRecibo(null); onFeito(); } catch (e) { toast.error(e?.message || 'Não foi possível retirar'); } finally { setIndo(false); }
    };
    return (
        <Card>
            <CardContent className="pt-6 space-y-5">
                <div>
                    <h2 className="text-base font-semibold">{d.proposta ? 'Sua proposta' : 'Enviar proposta'}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Ninguém do órgão vê o conteúdo antes da abertura. Até lá, você pode atualizar ou retirar a proposta.</p>
                    {d.proposta && <p className="text-sm mt-1 flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="w-4 h-4" aria-hidden /> Recebida; última versão em {quandoBr(d.proposta.atualizada_em)}.</p>}
                    {recibo && <p className="text-xs mt-1 text-slate-700 dark:text-slate-300">Recibo {recibo.codigo}, {quandoBr(recibo.em)}: {recibo.itens} {recibo.itens > 1 ? 'itens cotados' : 'item cotado'}.</p>}
                </div>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                    <legend className="text-sm font-semibold mb-2">Cadastro</legend>
                    <div><Label htmlFor="pf-razao">Nome ou razão social</Label><Input id="pf-razao" className="mt-1" maxLength={200} value={lic.razao_social} onChange={(e) => setLic({ ...lic, razao_social: e.target.value })} /></div>
                    <div><Label htmlFor="pf-doc">CNPJ ou CPF</Label><Input id="pf-doc" className="mt-1" maxLength={20} value={lic.documento} onChange={(e) => setLic({ ...lic, documento: e.target.value })} /></div>
                    <div><Label htmlFor="pf-rep">Quem assina pela empresa</Label><Input id="pf-rep" className="mt-1" maxLength={120} value={lic.representante} onChange={(e) => setLic({ ...lic, representante: e.target.value })} placeholder="Opcional" /></div>
                    <div><Label htmlFor="pf-porte">Porte</Label>
                        <select id="pf-porte" className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900" value={lic.porte} onChange={(e) => setLic({ ...lic, porte: e.target.value })}>
                            <option value="demais">Demais empresas ou pessoa física</option><option value="me_epp">Microempresa ou empresa de pequeno porte</option>
                        </select></div>
                </fieldset>
                <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">Itens</legend>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{desconto ? 'Informe o desconto em percentual sobre o preço de referência.' : 'Informe o valor unitário, com até 4 casas decimais.'} Deixe em branco o item que não vai cotar{a.unidade_disputa === 'lote' ? ' (por lote: todos os itens do lote ou nenhum)' : ''}.</p>
                    <ol className="space-y-2">
                        {a.itens.map((i, k) => {
                            const bloqueado = i.exclusivo_meepp && lic.porte !== 'me_epp';
                            return (
                                <li key={i.id} className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
                                    <p className="text-sm"><b>{i.numero}.</b> {i.descricao} <span className="text-xs text-slate-600 dark:text-slate-400">· {fmt(i.quantidade)} {i.unidade}{i.lote ? ` · lote ${i.lote}` : ''}</span></p>
                                    {bloqueado ? <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Exclusivo para microempresa e empresa de pequeno porte.</p> : (
                                        <div className="grid gap-2 sm:grid-cols-4 mt-1">
                                            <div><Label htmlFor={`pf-v-${k}`} className="text-xs">{desconto ? 'Desconto (%)' : 'Valor unitário (R$)'}</Label><Input id={`pf-v-${k}`} className="mt-1" inputMode="decimal" value={itens[k].valor} onChange={(e) => setItem(k, { valor: e.target.value })} /></div>
                                            <div><Label htmlFor={`pf-m-${k}`} className="text-xs">Marca</Label><Input id={`pf-m-${k}`} className="mt-1" maxLength={120} value={itens[k].marca} onChange={(e) => setItem(k, { marca: e.target.value })} /></div>
                                            <div><Label htmlFor={`pf-mo-${k}`} className="text-xs">Modelo</Label><Input id={`pf-mo-${k}`} className="mt-1" maxLength={120} value={itens[k].modelo} onChange={(e) => setItem(k, { modelo: e.target.value })} /></div>
                                            <div><Label htmlFor={`pf-d-${k}`} className="text-xs">Observação</Label><Input id={`pf-d-${k}`} className="mt-1" maxLength={1000} value={itens[k].descricao} onChange={(e) => setItem(k, { descricao: e.target.value })} /></div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    {!desconto && (
                        <ul className="text-sm text-slate-700 dark:text-slate-300">
                            {unidades.map((u) => { const v = valorNaUnidade(itens, u, a.criterio); return v == null ? null : <li key={u.chave}>{u.nome}: <b>{moeda(v)}</b></li>; })}
                        </ul>
                    )}
                    {[...alertas, ...incompletos.map((n) => `${n}: cote todos os itens do lote ou nenhum`)].map((t) => <p key={t} className="text-xs text-amber-800 dark:text-amber-300">{t}</p>)}
                </fieldset>
                <fieldset className="space-y-1.5">
                    <legend className="text-sm font-semibold">Declarações</legend>
                    {d.declaracoes.filter((x) => x.id !== 'meepp' || lic.porte === 'me_epp').map((x) => (
                        <label key={x.id} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" className="mt-1" checked={decl.has(x.id)} onChange={(e) => setDecl((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} />
                            <span>{x.texto}{(x.obrigatoria || x.id === 'meepp') && <span className="text-xs text-slate-600 dark:text-slate-400"> (obrigatória)</span>}</span>
                        </label>
                    ))}
                </fieldset>
                <div className="flex flex-wrap gap-2 justify-end">
                    {d.proposta && <Button variant="ghost" className="gap-1 text-rose-700 dark:text-rose-300" disabled={indo} onClick={retirar}><Trash2 className="w-4 h-4" aria-hidden /> Retirar a proposta</Button>}
                    <Button className="gap-1" disabled={indo || !pronto} onClick={enviar}><Send className="w-4 h-4" aria-hidden /> {d.proposta ? 'Atualizar a proposta' : 'Enviar a proposta'}</Button>
                </div>
            </CardContent>
        </Card>
    );
}

function Disputa({ id, codigo, onVoltar, onAbrir }) {
    const qc = useQueryClient();
    const chave = ['disputa', id || codigo];
    const q = useQuery({ queryKey: chave, queryFn: () => secPortal('disputaAviso', id ? { certame_id: id } : { codigo }) });
    const [agora, setAgora] = useState(Date.now());
    const [indo, setIndo] = useState(false);
    const [recibo, setRecibo] = useState(null);
    useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t); }, []);
    const d = q.data;
    // Na hora da abertura (e no fim dos lances), o aviso se relê: a tela passa à sala de lances ou ao resultado.
    const fimDosLances = useCallback(() => qc.invalidateQueries({ queryKey: chave }), [qc, id, codigo]);
    useEffect(() => {
        if (!d?.aviso?.abertura_em || d.aviso.momento !== 'propostas') return undefined;
        const ms = Date.parse(d.aviso.abertura_em) - Date.now() + 1500;
        if (ms > 2 ** 31 - 1) return undefined;
        const t = setTimeout(fimDosLances, Math.max(0, ms));
        return () => clearTimeout(t);
    }, [d?.aviso?.abertura_em, d?.aviso?.momento, fimDosLances]);
    const participar = async () => {
        setIndo(true);
        try { const r = await secPortal('disputaParticipar', { certame_id: d.aviso.id }); toast.success('Você participa desta disputa'); onAbrir(r.certame_id); qc.invalidateQueries({ queryKey: chave }); } catch (e) { toast.error(e?.message || 'Não foi possível participar'); } finally { setIndo(false); }
    };
    return (
        <div className="space-y-4">
            <Button variant="ghost" size="sm" className="gap-1" onClick={onVoltar}><ArrowLeft className="w-4 h-4" aria-hidden /> Minhas disputas</Button>
            {q.isLoading && <Carregando texto="Carregando o aviso…" />}
            {q.error && <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>}
            {d && (
                <>
                    <Aviso a={d.aviso} agora={agora} />
                    {d.pode.participar && (
                        <Card><CardContent className="pt-6 flex flex-wrap items-center gap-3">
                            <p className="text-sm flex-1 min-w-[12rem]">Para mandar proposta, entre na disputa. Você recebe por e-mail os avisos de adiamento e cancelamento.</p>
                            <Button disabled={indo} onClick={participar}>Participar desta disputa</Button>
                        </CardContent></Card>
                    )}
                    {d.pode.propor && <FormProposta key={d.proposta?.atualizada_em || 'nova'} d={d} recibo={recibo} setRecibo={setRecibo} onFeito={() => qc.invalidateQueries({ queryKey: chave })} />}
                    {d.participa && d.proposta && d.aviso.momento === 'lances' && (
                        <SalaLancesFornecedor certameId={d.aviso.id} aviso={d.aviso} onFim={fimDosLances} />
                    )}
                    {d.participa && d.proposta && d.aviso.momento !== 'lances' && ['publicado', 'encerrado'].includes(d.aviso.situacao) && Date.parse(d.aviso.abertura_em) <= agora && (
                        <JulgamentoFornecedor certameId={d.aviso.id} criterio={d.aviso.criterio} />
                    )}
                    {!d.participa && d.aviso.participacao === 'aberta' && ['publicado', 'encerrado'].includes(d.aviso.situacao) && Date.parse(d.aviso.abertura_em) <= agora && (
                        // S14: na dispensa, quem não participa acompanha a sessão pública.
                        d.aviso.momento === 'lances'
                            ? <SalaLancesFornecedor certameId={d.aviso.id} aviso={d.aviso} onFim={fimDosLances} />
                            : <JulgamentoFornecedor certameId={d.aviso.id} criterio={d.aviso.criterio} />
                    )}
                    {d.participa && !d.proposta && !d.pode.propor && d.aviso.situacao === 'publicado' && Date.parse(d.aviso.abertura_em) <= agora && (
                        <p className="text-sm text-slate-700 dark:text-slate-300">O prazo de propostas terminou. Sem proposta, não se dá lance nem se participa do julgamento.</p>
                    )}
                </>
            )}
        </div>
    );
}
