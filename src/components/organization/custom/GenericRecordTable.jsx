import React, { useState, useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Search, Eye, Loader2 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { formatFieldValue } from '@/lib/fieldTypes';

/**
 * Tabela genérica de registros.
 * props: entityType, records, isLoading, members, canCreate, onCreate, onOpen(record)
 */
export default function GenericRecordTable({
    entityType, records = [], isLoading, members = [], canCreate, onCreate, onOpen,
}) {
    const [search, setSearch] = useState('');

    const membersById = useMemo(
        () => Object.fromEntries(members.map((m) => [m.user_id || m.id, m])),
        [members]
    );

    const recordTypes = useMemo(() => entityType?.record_types || [], [entityType]);
    const typesByKey = useMemo(() => Object.fromEntries(recordTypes.map((t) => [t.key, t])), [recordTypes]);
    const hasTypes = recordTypes.length > 0;

    const columns = useMemo(() => {
        const layoutCols = entityType?.table_layout?.columns;
        if (layoutCols?.length) {
            const byKey = Object.fromEntries((entityType.fields || []).map((f) => [f.key, f]));
            return layoutCols
                .map((c) => byKey[c.field_key])
                .filter(Boolean);
        }
        return (entityType?.fields || [])
            .filter((f) => f.table?.show !== false)
            .sort((a, b) => (a.table?.order ?? 0) - (b.table?.order ?? 0))
            .slice(0, 6);
    }, [entityType]);

    const phasesByKey = useMemo(
        () => Object.fromEntries((entityType?.phases || []).map((p) => [p.key, p])),
        [entityType]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return records;
        const q = search.toLowerCase();
        return records.filter((r) => {
            const inColumns = columns.some((c) => {
                const txt = formatFieldValue(c, r.values?.[c.key], { membersById });
                return String(txt).toLowerCase().includes(q);
            });
            if (inColumns) return true;
            const typeLabel = typesByKey[r.record_type]?.label;
            return typeLabel ? typeLabel.toLowerCase().includes(q) : false;
        });
    }, [records, search, columns, membersById, typesByKey]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Buscar ${entityType?.label_plural?.toLowerCase() || 'registros'}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>
                {canCreate && (
                    <Button onClick={onCreate} size="sm">
                        <Plus className="mr-1.5 h-4 w-4" />
                        Novo {entityType?.label_singular}
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    title={search ? 'Nenhum resultado' : `Nenhum ${entityType?.label_singular?.toLowerCase() || 'registro'}`}
                    description={search ? 'Tente outra busca.' : 'Crie o primeiro registro para começar.'}
                />
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-32">Fase</TableHead>
                                    {hasTypes && <TableHead className="w-28">Tipo</TableHead>}
                                    {columns.map((c) => (
                                        <TableHead key={c.key}>{c.label}</TableHead>
                                    ))}
                                    <TableHead className="w-16 text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((r) => {
                                    const phase = phasesByKey[r.phase];
                                    return (
                                        <TableRow
                                            key={r.id}
                                            className="cursor-pointer"
                                            onClick={() => onOpen?.(r)}
                                        >
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    style={phase?.color ? { borderColor: phase.color, color: phase.color } : undefined}
                                                >
                                                    {phase?.label || r.phase || '—'}
                                                </Badge>
                                            </TableCell>
                                            {hasTypes && (
                                                <TableCell>
                                                    {typesByKey[r.record_type] ? (
                                                        <Badge
                                                            variant="outline"
                                                            style={{ borderColor: typesByKey[r.record_type].color, color: typesByKey[r.record_type].color }}
                                                        >
                                                            {typesByKey[r.record_type].label}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {columns.map((c) => (
                                                <TableCell key={c.key} className="max-w-[240px] truncate">
                                                    {formatFieldValue(c, r.values?.[c.key], { membersById })}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onOpen?.(r); }}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    );
}
