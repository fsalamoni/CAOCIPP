import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CalendarClock, Inbox, Loader2, PenLine, Siren, Undo2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErroQuery from './ErroQuery';
import { Badge } from '@/components/ui/badge';
import { secProcesso } from '@/services/secretariaService';
import { STATUS_ROTULO } from './comum';
import LinhaProcesso, { ha } from './LinhaProcesso';
import { unidadeDecide } from '@/lib/permissoesFase';

const hojeIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somarDias = (iso, n) => new Date(new Date(`${iso}T12:00:00`).getTime() + n * 86400000).toLocaleDateString('en-CA');
const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

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
        { id: 'urgentes', titulo: 'Urgentes', icone: Siren, itens: ativos.filter((p) => p.urgente) },
        { id: 'assinar', titulo: 'Pediram sua assinatura', icone: PenLine, itens: ativos.filter((p) => (p.assinaturas_pendentes || []).some((x) => x.uid === estado.uid)) },
        { id: 'orientacao', titulo: 'Orientação do gabinete', icone: Undo2, itens: ativos.filter((p) => p.orientacao) },
        { id: 'comigo', titulo: 'Comigo', icone: UserCheck, itens: ativos.filter((p) => p.responsavel_uid === estado.uid) },
        { id: 'vencendo', titulo: 'Prazo vencendo em 7 dias', icone: CalendarClock, itens: ativos.filter((p) => p.proximo_vencimento && p.proximo_vencimento <= limite) },
        { id: 'chegaram', titulo: 'Chegaram hoje', icone: Inbox, itens: ativos.filter((p) => (p.recebido_em || '').slice(0, 10) === hoje && p.responsavel_uid !== estado.uid) },
        { id: 'semdono', titulo: 'Na minha unidade, sem responsável', icone: AlertCircle, itens: ativos.filter((p) => !p.responsavel_uid && (p.recebido_em || '').slice(0, 10) !== hoje) },
    ];
    // Cada processo aparece uma vez, no primeiro grupo em que cabe (a ordem acima é a prioridade);
    // os outros motivos viram selos na própria linha.
    const vistos = new Set();
    for (const g of grupos) g.itens = g.itens.filter((p) => !vistos.has(p.id) && vistos.add(p.id));
    return { grupos: grupos.filter((g) => g.itens.length), total: vistos.size, hoje };
}

export default function MeuTrabalho({ orgId, estado }) {
    const qc = useQueryClient();
    const [assumindo, setAssumindo] = useState('');
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'caixa'], queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }) });
    if (q.isLoading) return <div className="py-8 text-slate-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <ErroQuery q={q} />;
    const { grupos, hoje } = gruposDeTrabalho(q.data?.processos || [], estado);

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
                        {g.itens.map((p) => (
                            <LinhaProcesso key={p.id} p={p} estado={estado} orgId={orgId} hoje={hoje} tempo
                                oculta={{ urgente: g.id === 'urgentes', comigo: g.id === 'comigo' }}
                                selos={<>
                                    {g.id === 'urgentes' && p.urgencia?.motivo && <span className="text-xs text-red-800 dark:text-red-200 max-w-xs truncate" title={p.urgencia.motivo}>{p.urgencia.motivo}</span>}
                                    {(p.assinaturas_pendentes || []).some((x) => x.uid === estado.uid) && <Badge className="bg-amber-500 hover:bg-amber-500 gap-1 max-w-full"><PenLine className="w-3 h-3 shrink-0" aria-hidden /><span className="truncate">Assinar: {(p.assinaturas_pendentes || []).filter((x) => x.uid === estado.uid).map((x) => x.titulo).join(', ')}</span></Badge>}
                                    {p.orientacao && <span className="text-xs text-amber-800 dark:text-amber-200 max-w-xs truncate" title={p.orientacao.texto}>Orientação: {p.orientacao.texto}</span>}
                                </>}
                                acoes={!p.responsavel_uid && (
                                    <Button size="sm" variant="outline" className="h-8" disabled={assumindo === p.id} aria-label={`Assumir o processo ${p.numero}`} onClick={(e) => { e.stopPropagation(); assumir(p); }}>
                                        {assumindo === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assumir'}
                                    </Button>
                                )} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

/** Pendências de todos os processos nos gabinetes em que a pessoa está lotada, da mais antiga para a mais nova. */
export function MesaDecisao({ orgId, estado }) {
    const q = useQuery({ queryKey: ['sec-processos', orgId, 'caixa'], queryFn: () => secProcesso(orgId, 'listar', { escopo: 'caixa' }) });
    if (q.isLoading) return <div className="py-8 text-slate-600 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
    if (q.error) return <ErroQuery q={q} />;
    const gabinetes = new Set(estado.unidades.filter((u) => unidadeDecide(u) && estado.minhasUnidades.includes(u.id)).map((u) => u.id));
    const lista = (q.data?.processos || [])
        // Arquivado com pendência aberta (ex.: a parte peticionou depois) também aparece: alguém precisa ver.
        .filter((p) => gabinetes.has(p.unidade_atual) && p.pendencias_abertas > 0)
        .sort((a, b) => String(a.pendencia_desde || '').localeCompare(String(b.pendencia_desde || '')));
    const hoje = hojeIso();
    if (lista.length === 0) {
        return <p className="py-8 text-slate-600 dark:text-slate-300">Nenhuma pendência para decidir nos seus gabinetes. Processos conclusos sem pendência estão na Caixa da unidade.</p>;
    }
    return (
        <div className="pt-2 divide-y divide-slate-200 dark:divide-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {lista.map((p) => {
                const espera = dias(p.pendencia_desde);
                return (
                    <LinhaProcesso key={p.id} p={p} estado={estado} orgId={orgId} hoje={hoje} oculta={{ pendencias: true, status: true }}
                        selos={<>
                            {p.status !== 'em_tramitacao' && <Badge variant="outline">{STATUS_ROTULO[p.status]}{p.status === 'arquivado' ? ': reative para apreciar' : ''}</Badge>}
                            <Badge className={`${espera > 10 ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 hover:bg-red-100' : 'bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100'}`}>
                                {p.pendencias_abertas} pendência{p.pendencias_abertas > 1 ? 's' : ''} · espera {ha(espera) || 'desde hoje'}{p.fase_suspensa ? ' · fase interrompida' : ''}
                            </Badge>
                        </>} />
                );
            })}
        </div>
    );
}
