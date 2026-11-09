import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CalendarClock, Inbox, Loader2, PenLine, Undo2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErroQuery from './ErroQuery';
import { Badge } from '@/components/ui/badge';
import { secProcesso } from '@/services/secretariaService';
import { STATUS_ROTULO } from './comum';

const hojeIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somarDias = (iso, n) => new Date(new Date(`${iso}T12:00:00`).getTime() + n * 86400000).toLocaleDateString('en-CA');
const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const ha = (n) => (n == null ? '' : n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`);

/**
 * Fila pessoal: o que espera a pessoa, em grupos por urgência, a partir da
 * mesma lista da caixa da unidade (sem consulta nova). Devolve também a
 * contagem para o título da aba.
 */
export function gruposDeTrabalho(processos, estado) {
    const hoje = hojeIso();
    const limite = somarDias(hoje, 7);
    const minhas = new Set(estado.minhasUnidades);
    const ativos = processos.filter((p) => p.status === 'em_tramitacao' && minhas.has(p.unidade_atual));
    const grupos = [
        { id: 'assinar', titulo: 'Pediram sua assinatura', icone: PenLine, itens: ativos.filter((p) => (p.assinaturas_pendentes || []).some((x) => x.uid === estado.uid)) },
        { id: 'orientacao', titulo: 'Orientação do gabinete', icone: Undo2, itens: ativos.filter((p) => p.orientacao) },
        { id: 'comigo', titulo: 'Comigo', icone: UserCheck, itens: ativos.filter((p) => p.responsavel_uid === estado.uid) },
        { id: 'vencendo', titulo: 'Prazo vencendo em 7 dias', icone: CalendarClock, itens: ativos.filter((p) => p.proximo_vencimento && p.proximo_vencimento <= limite) },
        { id: 'chegaram', titulo: 'Chegaram hoje', icone: Inbox, itens: ativos.filter((p) => (p.recebido_em || '').slice(0, 10) === hoje && p.responsavel_uid !== estado.uid) },
        { id: 'semdono', titulo: 'Na minha unidade, sem responsável', icone: AlertCircle, itens: ativos.filter((p) => !p.responsavel_uid && (p.recebido_em || '').slice(0, 10) !== hoje) },
    ].filter((g) => g.itens.length);
    const total = new Set(grupos.flatMap((g) => g.itens.map((p) => p.id))).size;
    return { grupos, total, hoje };
}

export default function MeuTrabalho({ orgId, estado, onAbrir }) {
    const qc = useQueryClient();
    const [assumindo, setAssumindo] = useState('');
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'caixa'], queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }) });
    if (q.isLoading) return <div className="py-8 text-slate-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <ErroQuery q={q} />;
    const { grupos, hoje } = gruposDeTrabalho(q.data?.processos || [], estado);
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || '—';
    const nomeMembro = (uid) => estado.membros.find((m) => m.uid === uid)?.nome || '';

    const assumir = async (p) => {
        setAssumindo(p.id);
        try {
            await secProcesso(orgId, 'atribuir', { id: p.id, version: p.version, responsavel_uid: estado.uid });
            toast.success(`Processo ${p.numero} é seu`);
            qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível assumir'); } finally { setAssumindo(''); }
    };

    if (grupos.length === 0) {
        return (
            <div className="py-8 text-slate-600 dark:text-slate-300 space-y-2">
                <p className="font-medium">Nada esperando por você.</p>
                <p className="text-sm">Processos atribuídos a você, pedidos de assinatura, orientações do gabinete, prazos vencendo em 7 dias e o que chegou hoje na sua unidade aparecem aqui. Veja a Caixa da unidade para o restante.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 pt-2">
            {grupos.map((g) => (
                <section key={g.id} aria-labelledby={`mt-${g.id}`}>
                    <h3 id={`mt-${g.id}`} className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"><g.icone className="w-4 h-4 text-indigo-600" aria-hidden /> {g.titulo} <span className="text-slate-400 font-normal">({g.itens.length})</span></h3>
                    <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        {g.itens.map((p) => {
                            const vencido = p.proximo_vencimento && p.proximo_vencimento < hoje;
                            const naUnidade = dias(p.recebido_em);
                            return (
                                <div key={p.id} className="p-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
                                    <button type="button" onClick={() => onAbrir(p.id)} className="font-mono text-sm text-indigo-700 dark:text-indigo-300 hover:underline">{p.numero}</button>
                                    <button type="button" onClick={() => onAbrir(p.id)} className="font-medium text-left text-slate-900 dark:text-white flex-1 min-w-[12rem] hover:underline">{p.assunto}</button>
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                        {p.fase_nome} · {nomeUnidade(p.unidade_atual)}{naUnidade != null ? ` ${ha(naUnidade)}` : ''}{p.responsavel_uid && p.responsavel_uid !== estado.uid ? ` · ${nomeMembro(p.responsavel_uid)}` : ''}
                                    </span>
                                    {g.id === 'assinar' && <Badge className="bg-amber-500 hover:bg-amber-500">{(p.assinaturas_pendentes || []).filter((x) => x.uid === estado.uid).map((x) => x.titulo).join(', ')}</Badge>}
                                    {g.id === 'orientacao' && p.orientacao && <span className="text-xs text-amber-800 dark:text-amber-200 max-w-md truncate" title={p.orientacao.texto}>{p.orientacao.texto}</span>}
                                    {p.pendencias_abertas > 0 && <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">{p.pendencias_abertas} pendência{p.pendencias_abertas > 1 ? 's' : ''}</Badge>}
                                    {p.proximo_vencimento && <Badge variant="outline" className={vencido ? 'border-red-400 text-red-700 dark:text-red-300' : ''}>Prazo {vencido ? 'vencido' : 'vence'} {p.proximo_vencimento.split('-').reverse().join('/')}</Badge>}
                                    {p.status !== 'em_tramitacao' && <Badge variant="outline">{STATUS_ROTULO[p.status]}</Badge>}
                                    {!p.responsavel_uid && <Button size="sm" variant="outline" disabled={assumindo === p.id} onClick={() => assumir(p)}>{assumindo === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assumir'}</Button>}
                                    <Button size="sm" onClick={() => onAbrir(p.id)}>Abrir</Button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

/** Pendências de todos os processos nos gabinetes em que a pessoa está lotada, da mais antiga para a mais nova. */
export function MesaDecisao({ orgId, estado, onAbrir }) {
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'caixa'], queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }) });
    if (q.isLoading) return <div className="py-8 text-slate-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <ErroQuery q={q} />;
    const gabinetes = new Set(estado.unidades.filter((u) => u.tipo === 'gabinete' && estado.minhasUnidades.includes(u.id)).map((u) => u.id));
    const lista = (q.data?.processos || [])
        .filter((p) => gabinetes.has(p.unidade_atual) && p.pendencias_abertas > 0 && p.status !== 'arquivado')
        .sort((a, b) => String(a.pendencia_desde || '').localeCompare(String(b.pendencia_desde || '')));
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || '—';
    if (lista.length === 0) {
        return <p className="py-8 text-slate-600 dark:text-slate-300">Nenhuma pendência para decidir nos seus gabinetes. Processos conclusos sem pendência estão na Caixa da unidade.</p>;
    }
    return (
        <div className="pt-2 divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {lista.map((p) => {
                const espera = dias(p.pendencia_desde);
                return (
                    <button key={p.id} type="button" onClick={() => onAbrir(p.id)} className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-wrap gap-x-6 gap-y-1 items-baseline">
                        <span className="font-mono text-sm text-indigo-700 dark:text-indigo-300">{p.numero}</span>
                        <span className="font-medium text-slate-900 dark:text-white flex-1 min-w-[12rem]">{p.assunto}{p.tipo_nome && <span className="ml-2 text-xs font-normal text-slate-600">{p.tipo_nome}</span>}</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{p.fase_nome} · {nomeUnidade(p.unidade_atual)}</span>
                        <Badge className={`${espera > 10 ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 hover:bg-red-100' : 'bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100'}`}>
                            {p.pendencias_abertas} pendência{p.pendencias_abertas > 1 ? 's' : ''} · espera {ha(espera) || 'desde hoje'}{p.fase_suspensa ? ' · fase interrompida' : ''}
                        </Badge>
                    </button>
                );
            })}
        </div>
    );
}
