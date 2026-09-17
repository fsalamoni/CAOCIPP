import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, ArrowRight, Ban } from 'lucide-react';
import { formatDateBR } from '@/lib/jurimetriaEngine';
import { realizacaoMeta } from '@/constants/jurimetria';

/**
 * Histórico de datas do júri: cada remarcação, cancelamento ou correção de
 * data, com quem fez, quando e por quê.
 *
 * É o registro que responde, meses depois, "por que este júri não aconteceu na
 * data da pauta?". Aparece tanto na ficha do júri quanto no modal de edição —
 * quem está prestes a redesignar precisa ver quantas vezes aquilo já aconteceu.
 */
export default function JuriDateHistory({ entries = [], compact = false, emptyHint = true }) {
    // Mais recente primeiro: é a informação que se procura ao abrir.
    const ordered = React.useMemo(
        () => [...(entries || [])].sort(
            (a, b) => String(b.changed_at || '').localeCompare(String(a.changed_at || ''))
        ),
        [entries]
    );

    if (ordered.length === 0) {
        if (!emptyHint) return null;
        return (
            <p className="text-sm text-slate-400">
                A data deste júri nunca foi alterada.
            </p>
        );
    }

    return (
        <ol className={compact ? 'space-y-2' : 'space-y-3'}>
            {ordered.map((entry, index) => {
                const meta = realizacaoMeta(entry.realizacao);
                const cancelamento = entry.realizacao === 'cancelado' || !entry.to;
                return (
                    <li
                        key={`${entry.changed_at || index}-${index}`}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                    >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Badge className={`${meta.badge} border-0 text-[11px]`}>{meta.label}</Badge>
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                                <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                                {entry.from ? formatDateBR(entry.from) : 'sem data'}
                                {cancelamento ? (
                                    <>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                            <Ban className="w-3.5 h-3.5" />
                                            sem data
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                        {formatDateBR(entry.to)}
                                    </>
                                )}
                            </span>
                        </div>

                        {entry.justificativa && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                                {entry.justificativa}
                            </p>
                        )}

                        <p className="text-xs text-slate-400 mt-1">
                            {entry.user_name || 'Usuário desconhecido'}
                            {entry.changed_at && ` — ${new Date(entry.changed_at).toLocaleString('pt-BR')}`}
                        </p>
                    </li>
                );
            })}
        </ol>
    );
}
