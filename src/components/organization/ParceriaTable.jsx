import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Search, FilterX, Pencil, Eye } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    getParceriaField,
    calculateParceriaDerivedStatus,
} from '@/utils/parceriaUtils';
import { parseLocalDate } from '@/lib/dateUtils';
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from '../ui/EmptyState';

const PARTNERSHIP_TYPE_LABEL = {
    convenio: 'Convênio',
    termo_cooperacao: 'Termo de Cooperação',
    termo_fomento: 'Termo de Fomento',
};

const formatDate = (s) => {
    const d = parseLocalDate(s);
    if (!d || !isValid(d)) return '—';
    try { return format(d, 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
};

const COLUMNS = [
    { key: 'pgea', label: 'PGEA', width: 'w-32' },
    { key: 'partnership_type', label: 'Tipo', width: 'w-44', format: (v) => PARTNERSHIP_TYPE_LABEL[v] || '—' },
    { key: 'partnership_number', label: 'Número', width: 'w-32' },
    { key: 'subject', label: 'Assunto' },
    { key: 'parties', label: 'Partes' },
    { key: 'responsible_user_name', label: 'Responsável', width: 'w-44' },
    { key: 'signature_date', label: 'Assinatura', width: 'w-32', format: formatDate },
    { key: 'end_date', label: 'Termo Final', width: 'w-32', format: formatDate },
    { key: 'aditivo_count', label: 'Aditivos', width: 'w-20', format: (v) => v > 0 ? `#${v}` : '—' },
    { key: 'status', label: 'Situação', width: 'w-40', format: (_, p) => calculateParceriaDerivedStatus(p) },
];

export default function ParceriaTable({
    parcerias = [],
    members = [],
    userId,
    isLoading = false,
    onEdit,
    onView,
    initialFilter,
    organization,
}) {
    const [search, setSearch] = useState(initialFilter || '');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const filtered = useMemo(() => {
        let out = parcerias;
        if (search) {
            const s = search.toLowerCase();
            out = out.filter((p) => {
                return (
                    String(getParceriaField(p, 'pgea') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'subject') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'parties') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'partnership_number') || '').toLowerCase().includes(s) ||
                    String(getParceriaField(p, 'object') || '').toLowerCase().includes(s)
                );
            });
        }
        if (typeFilter !== 'all') {
            out = out.filter((p) => getParceriaField(p, 'partnership_type') === typeFilter);
        }
        if (statusFilter !== 'all') {
            out = out.filter((p) => calculateParceriaDerivedStatus(p) === statusFilter);
        }
        return out;
    }, [parcerias, search, typeFilter, statusFilter]);

    const availableTypes = useMemo(() => {
        const set = new Set();
        parcerias.forEach((p) => {
            const t = getParceriaField(p, 'partnership_type');
            if (t) set.add(t);
        });
        return Array.from(set);
    }, [parcerias]);

    const clearFilters = () => {
        setSearch('');
        setTypeFilter('all');
        setStatusFilter('all');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <span className="text-slate-500">Carregando...</span>
            </div>
        );
    }

    if (parcerias.length === 0) {
        return (
            <EmptyState
                title="Nenhuma Parceria cadastrada"
                description="Crie a primeira Parceria ou importe uma planilha."
                className="py-16"
            />
        );
    }

    return (
        <div className="space-y-3">
            <Card className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por PGEA, número, assunto, partes..."
                            className="pl-8"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            {availableTypes.map((t) => (
                                <SelectItem key={t} value={t}>{PARTNERSHIP_TYPE_LABEL[t] || t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Situação" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as situações</SelectItem>
                            <SelectItem value="Pendente">Pendentes</SelectItem>
                            <SelectItem value="Em análise">Em Análise</SelectItem>
                            <SelectItem value="Revisão">Revisão</SelectItem>
                            <SelectItem value="Aguarda Terceiros">Aguarda Terceiros</SelectItem>
                            <SelectItem value="Parcerias">Parcerias</SelectItem>
                            <SelectItem value="Extintos">Extintos</SelectItem>
                        </SelectContent>
                    </Select>
                    {(search || typeFilter !== 'all' || statusFilter !== 'all') && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <FilterX className="w-4 h-4 mr-1" />
                            Limpar
                        </Button>
                    )}
                </div>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            {COLUMNS.map((c) => (
                                <th
                                    key={c.key}
                                    className={`text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 ${c.width || ''}`}
                                >
                                    {c.label}
                                </th>
                            ))}
                            <th className="text-right px-3 py-2 font-semibold text-slate-700 dark:text-slate-200 w-32">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-slate-500">
                                    Nenhuma Parceria encontrada com os filtros atuais.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((p) => {
                                const status = calculateParceriaDerivedStatus(p);
                                return (
                                    <tr
                                        key={p.id}
                                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        {COLUMNS.map((c) => {
                                            const value = c.format
                                                ? c.format(getParceriaField(p, c.key), p)
                                                : getParceriaField(p, c.key);
                                            return (
                                                <td key={c.key} className={`px-3 py-2 ${c.width || ''}`}>
                                                    {c.key === 'status' ? (
                                                        <StatusBadge status={status} />
                                                    ) : c.key === 'aditivo_count' && value !== '—' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                            {value}
                                                        </span>
                                                    ) : c.key === 'pgea' ? (
                                                        <span className="font-mono text-xs">{value || '—'}</span>
                                                    ) : (
                                                        <span className="truncate max-w-[200px] inline-block align-middle" title={String(value || '')}>
                                                            {value || '—'}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex gap-1 justify-end">
                                                {onView && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onView(p)}
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {onEdit && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onEdit(p)}
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
