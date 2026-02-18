import React, { useState, useMemo } from 'react';
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

/**
 * ProcessLogDialog — Displays the activity_log of a process.
 * Visible only to the admin (org creator).
 *
 * Each entry has: date, time, user_name, action
 */
export default function ProcessLogDialog({ open, onClose, process }) {
    const [search, setSearch] = useState('');

    const log = useMemo(() => {
        const raw = process?.activity_log || [];
        // Sort by timestamp descending (most recent first)
        return [...raw].sort((a, b) => {
            const ta = a.timestamp || `${a.date}T${a.time}`;
            const tb = b.timestamp || `${b.date}T${b.time}`;
            return tb.localeCompare(ta);
        });
    }, [process]);

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
