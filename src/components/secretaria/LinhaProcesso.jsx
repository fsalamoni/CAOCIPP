import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_ROTULO, SeloUrgente } from './comum';
import { unidadeComOrgao } from '@/lib/orgaos';

// Linha de processo, a mesma em Meu trabalho, Caixa da unidade, Mesa de decisão e Todos.
// Lê-se de cima para baixo como a capa: número, assunto, de quem é (tipo e partes),
// onde está (fase, unidade, com quem) e o que pede atenção (selos). O assunto é um
// link de verdade: abre com Enter, e Ctrl+clique ou o botão do meio abre em outra aba.

const dataBr = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');
const diasDesde = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
export const ha = (n) => (n == null ? '' : n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`);

/** "Fulano, Beltrano e mais 2": os nomes que o servidor manda na linha (até três). */
export function partesDaLinha(p) {
    const nomes = p.partes_nomes || [];
    if (!nomes.length) return '';
    const resto = (p.partes_total || nomes.length) - nomes.length;
    return `${nomes.join(', ')}${resto > 0 ? ` e mais ${resto}` : ''}`;
}

/** Último processo aberto neste órgão: ao voltar para a lista, ela rola até ele e o destaca. */
const chaveUltimo = (orgId) => `pe-ultimo-${orgId}`;
export function lembrarProcesso(orgId, id) {
    try { sessionStorage.setItem(chaveUltimo(orgId), id); } catch { /* sem armazenamento: só não volta ao lugar */ }
}
function ultimoProcesso(orgId) {
    try { return sessionStorage.getItem(chaveUltimo(orgId)) || ''; } catch { return ''; }
}

/**
 * p: resumo do processo (ação listar). estado: o do órgão. hoje: 'AAAA-MM-DD'.
 * selos: selos próprios da lista, antes dos comuns. acoes: botões à direita (Assumir).
 * oculta: selos comuns que a lista dispensa ({ urgente, status, prazo, pendencias }).
 * tempo: mostra há quanto tempo o processo está na unidade.
 */
export default function LinhaProcesso({ p, estado, orgId, hoje, selos = null, acoes = null, oculta = {}, tempo = false }) {
    const [params] = useSearchParams();
    const ref = useRef(null);
    const destino = new URLSearchParams(params);
    destino.set('p', p.id);
    const vencido = p.proximo_vencimento && p.proximo_vencimento < hoje;
    const comigo = p.responsavel_uid && p.responsavel_uid === estado.uid;
    const responsavel = p.responsavel_uid && !comigo ? estado.membros.find((m) => m.uid === p.responsavel_uid)?.nome : '';
    const partes = partesDaLinha(p);
    const naUnidade = tempo ? diasDesde(p.recebido_em) : null;

    // De volta de um processo: a lista rola até ele e a linha fica marcada por um instante.
    useEffect(() => {
        if (ultimoProcesso(orgId) !== p.id || !ref.current) return;
        try { sessionStorage.removeItem(chaveUltimo(orgId)); } catch { /* idem */ }
        const el = ref.current;
        el.scrollIntoView({ block: 'center' });
        el.dataset.voltou = '1';
        const t = setTimeout(() => { delete el.dataset.voltou; }, 2500);
        return () => clearTimeout(t);
    }, []);

    return (
        <div ref={ref} data-processo={p.id}
            // A linha inteira abre o processo; selecionar texto (copiar o número) não abre.
            onClick={(e) => {
                if (e.defaultPrevented || e.target.closest?.('a,button,[data-copiavel]') || window.getSelection()?.toString()) return;
                ref.current?.querySelector('a[data-abrir]')?.click();
            }}
            className="group relative cursor-pointer p-3 sm:px-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 data-[voltou]:bg-indigo-50 dark:data-[voltou]:bg-indigo-950/40 flex flex-col gap-x-4 gap-y-1.5 sm:flex-row sm:items-start">
            <div className="flex items-center justify-between gap-2 sm:block sm:w-[8.5rem] sm:shrink-0 sm:pt-0.5">
                <span data-copiavel="" title="Selecione para copiar o número" className="font-mono text-sm text-indigo-700 dark:text-indigo-300 select-all cursor-text break-all">{p.numero}</span>
                {/* No celular, o selo de urgência sobe para a linha do número. */}
                {p.urgente && !oculta.urgente && <span className="sm:hidden"><SeloUrgente motivo={p.urgencia?.motivo} /></span>}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
                <Link data-abrir="" to={{ search: `?${destino.toString()}` }} onClick={() => lembrarProcesso(orgId, p.id)}
                    className="block font-medium text-slate-900 dark:text-white rounded-sm group-hover:text-indigo-800 dark:group-hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 [overflow-wrap:anywhere]"
                    aria-label={`Abrir o processo ${p.numero}: ${p.assunto}`}>
                    {p.assunto}
                </Link>
                {(p.tipo_nome || partes) && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere]">
                        {p.tipo_nome}{p.tipo_nome && partes ? ' · ' : ''}{partes && <span className="text-slate-700 dark:text-slate-300">{partes}</span>}
                    </p>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere]">
                    {p.fase_nome} · {unidadeComOrgao(estado, p.unidade_atual)}{naUnidade != null ? `, ${ha(naUnidade)}` : ''}{responsavel ? ` · com ${responsavel}` : ''}{!p.responsavel_uid && p.status === 'em_tramitacao' ? ' · sem responsável' : ''}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[46%] sm:justify-end sm:pt-0.5">
                {p.urgente && !oculta.urgente && <span className="hidden sm:inline-flex"><SeloUrgente motivo={p.urgencia?.motivo} /></span>}
                {selos}
                {comigo && !oculta.comigo && <Badge variant="outline" className="gap-1"><UserCheck className="w-3 h-3" aria-hidden />Comigo</Badge>}
                {p.status !== 'em_tramitacao' && !oculta.status && <Badge variant="outline">{STATUS_ROTULO[p.status]}</Badge>}
                {p.sigilo === 'restrito' && <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" aria-hidden />Restrito</Badge>}
                {p.sessao && <Badge variant="outline" className="border-indigo-300 text-indigo-800 dark:border-indigo-700 dark:text-indigo-200">Pautado: {dataBr(p.sessao.data)}</Badge>}
                {p.pendencias_abertas > 0 && !oculta.pendencias && (
                    <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100">{p.pendencias_abertas} pendência{p.pendencias_abertas > 1 ? 's' : ''}{p.fase_suspensa ? ' · fase interrompida' : ''}</Badge>
                )}
                {p.proximo_vencimento && !oculta.prazo && (
                    <Badge variant="outline" className={vencido ? 'border-red-400 text-red-700 dark:text-red-300' : ''}>Prazo {vencido ? 'vencido em' : 'vence'} {dataBr(p.proximo_vencimento)}</Badge>
                )}
                {acoes}
            </div>
        </div>
    );
}
