import React, { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ClipboardList, Search } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

/**
 * ProcessLogDialog — Displays the activity_log of a process.
 * Visible only to the admin (org creator).
 *
 * Each entry has: date, time, user_name, action
 *
 * Fonte dos dados:
 *   - Padrão: array embutido `process.activity_log` (comportamento histórico).
 *   - Com a flag `history_subcollection` LIGADA e havendo entradas na
 *     subcoleção `history`, faz UNIÃO (array + subcoleção) deduplicando por
 *     chave estável. Nunca esconde entradas do array — mesmo que o backfill
 *     ainda não tenha rodado — então não há regressão ao ligar a flag.
 */
export default function ProcessLogDialog({ open, onClose, process, collectionName = 'processes' }) {
    const [search, setSearch] = useState('');
    const historyFlag = useFlag(FEATURE_FLAGS.HISTORY_SUBCOLLECTION.key);
    const [subEntries, setSubEntries] = useState(null);

    const docId = process?.id;

    useEffect(() => {
        // Só assina a subcoleção quando a flag está ligada, o diálogo está aberto
        // e temos o id do documento. Caso contrário, mantém o array como fonte.
        if (!historyFlag || !open || !docId) {
            setSubEntries(null);
            return;
        }
        const ref = collection(db, collectionName, docId, 'history');
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setSubEntries(snap.docs.map((d) => d.data()));
            },
            () => {
                // Em erro (ex.: permissão), faz fallback para o array.
                setSubEntries(null);
            }
        );
        return () => unsub();
    }, [historyFlag, open, docId, collectionName]);

    const log = useMemo(() => {
        // Fonte base: array embutido (sempre disponível, fonte de verdade atual).
        const arrayEntries = Array.isArray(process?.activity_log) ? process.activity_log : [];
        let raw = arrayEntries;
        // Com a flag ligada e havendo entradas na subcoleção, faz UNIÃO segura
        // (array + subcoleção) deduplicando por chave estável. Nunca esconde
        // entradas antigas do array, mesmo que o backfill ainda não tenha rodado.
        if (historyFlag && Array.isArray(subEntries) && subEntries.length > 0) {
            const keyOf = (e) =>
                `${e.timestamp || ''}|${e.date || ''}|${e.time || ''}|${e.user_id || ''}|${e.user_name || ''}|${e.action || ''}`;
            const byKey = new Map();
            for (const e of arrayEntries) byKey.set(keyOf(e), e);
            for (const e of subEntries) byKey.set(keyOf(e), e);
            raw = [...byKey.values()];
        }
        // Sort by timestamp descending (most recent first)
        return [...raw].sort((a, b) => {
            const ta = a.timestamp || `${a.date}T${a.time}`;
            const tb = b.timestamp || `${b.date}T${b.time}`;
            return tb.localeCompare(ta);
        });
    }, [process, subEntries, historyFlag]);

    const filteredLog = useMemo(() => {
        if (!search.trim()) return log;
        const q = search.toLowerCase();
        return log.filter(entry =>
            (entry.action || '').toLowerCase().includes(q) ||
            (entry.user_name || '').toLowerCase().includes(q) ||
            (entry.date || '').includes(q)
        );
    }, [log, search]);

    const processNumber = process?.process_number || 'Processo';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                        Log de Atividades — {processNumber}
                    </DialogTitle>
                    <DialogDescription>
                        Histórico completo de todas as movimentações e alterações realizadas neste processo.
                    </DialogDescription>
                </DialogHeader>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Buscar no log..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Log Table */}
                <ScrollArea className="flex-1 border rounded-lg">
                    {filteredLog.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-[100px]">Data</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-[70px]">Hora</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-[150px]">Usuário</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLog.map((entry, i) => (
                                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                            {entry.date || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-xs">
                                            {entry.time || '—'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-700 truncate max-w-[150px]" title={entry.user_name}>
                                            {entry.user_name || 'Desconhecido'}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600">
                                            {entry.action || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <ClipboardList className="w-8 h-8 mb-2 opacity-40" />
                            <p className="text-sm">
                                {log.length === 0
                                    ? 'Nenhum registro de atividade encontrado.'
                                    : 'Nenhum resultado para a busca.'}
                            </p>
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
                    <span>{filteredLog.length} de {log.length} registros</span>
                    <Badge variant="outline" className="text-[10px]">
                        Log permanente
                    </Badge>
                </div>
            </DialogContent>
        </Dialog>
    );
}
