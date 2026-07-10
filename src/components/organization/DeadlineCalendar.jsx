// ============================================================================
// DeadlineCalendar — vista de calendário mensal de datas relevantes
// (flag `deadline_calendar`).
// ----------------------------------------------------------------------------
// Mostra, num calendário mensal, os dias em que há entrada, distribuição,
// remessa/devolução de revisão ou arquivamento de Consultas e Expedientes do
// órgão. Clicar num dia lista os itens daquele dia; clicar num item leva à
// lista (Consultas/Expedientes) com o número já preenchido na busca.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { parseLocalDate } from '@/lib/dateUtils';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const PT_MONTHS_FULL = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const EVENT_FIELDS = [
    { field: 'entry_date', label: 'Entrada', dot: 'bg-slate-400' },
    { field: 'distribution_date', label: 'Distribuição', dot: 'bg-sky-500' },
    { field: 'review_submission_date', label: 'Remessa p/ revisão', dot: 'bg-amber-500' },
    { field: 'review_return_date', label: 'Devolução da revisão', dot: 'bg-emerald-500' },
    { field: 'archived_date', label: 'Arquivamento', dot: 'bg-slate-600' },
];

function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DeadlineCalendar({ organization, processes = [], expedientes = [] }) {
    const navigate = useNavigate();
    const [cursor, setCursor] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const [selectedDayKey, setSelectedDayKey] = useState(null);

    const eventsByDay = useMemo(() => {
        const map = new Map();
        const addRecord = (record, kind) => {
            EVENT_FIELDS.forEach(({ field, label, dot }) => {
                const raw = record[field];
                if (!raw) return;
                const date = parseLocalDate(raw);
                if (isNaN(date.getTime())) return;
                const key = dayKey(date);
                const list = map.get(key) || [];
                list.push({
                    kind,
                    id: record.id,
                    number: kind === 'processo' ? record.process_number : record.expediente_number,
                    field,
                    label,
                    dot,
                });
                map.set(key, list);
            });
        };
        processes.forEach((p) => addRecord(p, 'processo'));
        expedientes.forEach((e) => addRecord(e, 'expediente'));
        return map;
    }, [processes, expedientes]);

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = useMemo(() => {
        const arr = [];
        for (let i = 0; i < firstWeekday; i++) arr.push(null);
        for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
        return arr;
    }, [firstWeekday, daysInMonth, year, month]);

    const todayKey = dayKey(new Date());
    const selectedEvents = selectedDayKey ? (eventsByDay.get(selectedDayKey) || []) : [];

    const goToRecord = (evt) => {
        if (!organization?.id) return;
        if (evt.kind === 'processo') {
            localStorage.setItem('processSearchTerm', evt.number || '');
            navigate(`${createPageUrl('Organization')}?id=${organization.id}&tab=processes`);
        } else {
            localStorage.setItem('expedienteSearchTerm', evt.number || '');
            navigate(`${createPageUrl('Organization')}?id=${organization.id}&tab=expedientes`);
        }
    };

    return (
        <div className="space-y-4">
            <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                        <CalendarDays className="w-5 h-5 text-primary" />
                        {PT_MONTHS_FULL[month]} de {year}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCursor(new Date(year, month - 1, 1))}
                            aria-label="Mês anterior"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}
                        >
                            Hoje
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCursor(new Date(year, month + 1, 1))}
                            aria-label="Próximo mês"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-7 mb-1">
                        {WEEKDAY_LABELS.map((w, idx) => (
                            <div key={idx} className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 py-1">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((date, idx) => {
                            if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
                            const key = dayKey(date);
                            const dayEvents = eventsByDay.get(key) || [];
                            const isToday = key === todayKey;
                            const isSelected = key === selectedDayKey;
                            const uniqueDots = Array.from(new Set(dayEvents.map((e) => e.dot))).slice(0, 4);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedDayKey(dayEvents.length > 0 ? key : null)}
                                    className={cn(
                                        'aspect-square rounded-lg border p-1.5 flex flex-col items-start justify-between text-left transition-colors',
                                        dayEvents.length > 0 ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5' : 'cursor-default',
                                        isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800',
                                        isToday && !isSelected && 'border-slate-300 dark:border-slate-600'
                                    )}
                                >
                                    <span className={cn(
                                        'text-xs font-semibold',
                                        isToday ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                                    )}>
                                        {date.getDate()}
                                    </span>
                                    {uniqueDots.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5">
                                            {uniqueDots.map((dot, i) => (
                                                <span key={i} className={cn('w-1.5 h-1.5 rounded-full', dot)} />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {EVENT_FIELDS.map(({ field, label, dot }) => (
                            <div key={field} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <span className={cn('w-2 h-2 rounded-full', dot)} />
                                {label}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {selectedDayKey && (
                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {selectedEvents.length} evento(s) em {selectedDayKey.split('-').reverse().join('/')}
                        </CardTitle>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDayKey(null)} aria-label="Fechar detalhes do dia">
                            <X className="w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-1.5">
                        {selectedEvents.map((evt, idx) => (
                            <button
                                key={`${evt.kind}-${evt.id}-${evt.field}-${idx}`}
                                type="button"
                                onClick={() => goToRecord(evt)}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={cn('w-2 h-2 rounded-full shrink-0', evt.dot)} />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                                        {evt.number || '(sem número)'}
                                    </span>
                                    <span className="text-xs text-slate-400 shrink-0">
                                        {evt.kind === 'processo' ? 'Consulta' : 'Expediente'}
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{evt.label}</span>
                            </button>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
