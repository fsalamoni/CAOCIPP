import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secConfig } from '@/services/secretariaService';
import { ASSUNTOS, alvoDoEvento, combina, resumoDetalhes, rotuloAcao } from '@/lib/historicoConfiguracao';
import ErroQuery from './ErroQuery';

/**
 * Quem mudou o quê e quando na configuração do módulo (ação `historico`, só
 * quem configura). Filtro por assunto, busca e "Abrir" no item que ainda existe.
 */
export default function HistoricoConfiguracao({ orgId, estado, onAbrir }) {
    const [assunto, setAssunto] = useState('');
    const [busca, setBusca] = useState('');
    const q = useQuery({
        queryKey: ['sec-historico', orgId, assunto],
        queryFn: () => secConfig(orgId, 'historico', { assunto: assunto || null }),
        placeholderData: (anterior) => anterior,
    });
    const itens = (q.data?.itens || []).filter((e) => combina(e, busca));
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" aria-hidden /> Histórico de configuração</CardTitle>
                <CardDescription>Quem mudou o quê e quando, nas últimas 300 alterações da configuração. Ritos, tipos e modelos guardam as versões anteriores; compare e restaure pelo botão "Versões" de cada um.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                    <label htmlFor="hist-assunto" className="sr-only">Assunto</label>
                    <select id="hist-assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)}
                        className="h-10 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm">
                        <option value="">Todos os assuntos</option>
                        {ASSUNTOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </select>
                    <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar no histórico" placeholder="Buscar por pessoa, item ou ação" className="h-10 sm:max-w-sm" />
                </div>
                {q.isLoading && <p role="status" className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando o histórico…</p>}
                {q.error && <ErroQuery q={q} />}
                {q.data && <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">{itens.length} alteraç{itens.length === 1 ? 'ão' : 'ões'}{q.isFetching ? ' · atualizando…' : ''}</p>}
                {q.data && !itens.length && <p className="text-sm text-slate-600 dark:text-slate-400">{q.data.itens.length ? 'Nada encontrado com esse filtro.' : 'Nenhuma alteração registrada ainda.'}</p>}
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                    {itens.map((e) => {
                        const alvo = onAbrir ? alvoDoEvento(e, estado) : null;
                        const quando = e.em ? new Date(e.em) : null;
                        return (
                            <li key={e.id} className="py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <time className="text-slate-600 dark:text-slate-400 tabular-nums w-36 shrink-0" dateTime={e.em || undefined}>{quando ? quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</time>
                                <span className="font-medium text-slate-900 dark:text-white">{rotuloAcao(e.action)}</span>
                                <span className="text-slate-600 dark:text-slate-300">{e.user_name || 'alguém'}</span>
                                {alvo && (
                                    <Button size="sm" variant="outline" className="h-9 sm:ml-auto" aria-label={alvo.rotulo} onClick={() => onAbrir(alvo.aba, alvo.id)}>{alvo.id ? 'Abrir' : 'Ir para Estrutura'}</Button>
                                )}
                                <span className="text-xs text-slate-600 dark:text-slate-400 basis-full">{resumoDetalhes(e.details)}</span>
                            </li>
                        );
                    })}
                </ol>
            </CardContent>
        </Card>
    );
}
