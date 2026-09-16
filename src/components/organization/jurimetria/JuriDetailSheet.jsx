import React, { useMemo } from 'react';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Pencil, Trash2, Scale, CalendarDays, MapPin, Gavel, User, Clock,
    Building2, FileText, History, Loader2, UserCheck, Upload, CalendarClock,
} from 'lucide-react';
import { useJuriHistory } from '@/hooks/useJuris';
import { getJurimetriaFields, getJuriFieldValue, realizacaoMeta } from '@/constants/jurimetria';
import {
    formatDateBR, tipoLabel, isDissolucao, pesoDoResultado, getRealizacao,
} from '@/lib/jurimetriaEngine';
import JuriDateHistory from './JuriDateHistory';

function Row({ icon: Icon, label, value, mono = false }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex items-start gap-3 py-2">
            <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className={`text-sm text-slate-800 dark:text-slate-100 break-words ${mono ? 'font-mono' : ''}`}>
                    {value}
                </p>
            </div>
        </div>
    );
}

/**
 * Ficha lateral de um júri: todos os campos (fixos e personalizados), a
 * situação em relação à dissolução e o histórico completo de alterações.
 */
export default function JuriDetailSheet({
    juri, open, onClose, onEdit, onDelete, settings, canDelete = false,
}) {
    const { history, isLoading: historyLoading } = useJuriHistory(juri?.id, open && Boolean(juri?.id));

    const fields = useMemo(() => getJurimetriaFields(settings), [settings]);
    const customFields = useMemo(() => fields.filter((f) => f.custom), [fields]);

    // O histórico vive em duas camadas: a subcoleção `history` (fonte atual) e
    // o array `activity_log` do documento (registro legado, mantido em espelho).
    // Preferimos a subcoleção e caímos no array quando ela ainda não propagou.
    const entries = useMemo(() => {
        if (history.length > 0) return history;
        return [...(juri?.activity_log || [])]
            .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    }, [history, juri]);

    if (!juri) return null;

    const dissolvido = isDissolucao(juri, settings);
    const peso = pesoDoResultado(juri.resultado, settings);
    const realizacao = getRealizacao(juri);
    const realizacaoInfo = realizacaoMeta(realizacao);
    const dateHistory = Array.isArray(juri.date_history) ? juri.date_history : [];

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <SheetTitle className="font-mono text-base break-all">
                                {juri.numero_processo || 'Sem número'}
                            </SheetTitle>
                            <SheetDescription className="mt-1">
                                {juri.data_juri ? formatDateBR(juri.data_juri) : 'Sem data'}
                                {juri.comarca ? ` — ${juri.comarca}` : ''}
                            </SheetDescription>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            {onEdit && (
                                <Button variant="ghost" size="icon" onClick={() => onEdit(juri)} title="Editar júri">
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            )}
                            {canDelete && onDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDelete(juri)}
                                    title="Excluir júri"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                        <Badge className={`${realizacaoInfo.badge} border-0 font-medium`}>
                            {realizacaoInfo.label}
                        </Badge>
                        {juri.resultado && (
                            <Badge variant={dissolvido ? 'outline' : 'secondary'} className="font-medium">
                                {juri.resultado}
                            </Badge>
                        )}
                        {juri.tipo && <Badge variant="outline">{tipoLabel(juri.tipo, settings)}</Badge>}
                        {juri.source === 'import' && (
                            <Badge variant="outline" className="gap-1 text-slate-500">
                                <Upload className="w-3 h-3" />
                                Importado
                            </Badge>
                        )}
                    </div>
                </SheetHeader>

                <div className="px-6 py-4 space-y-1">
                    {dissolvido && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-3 mb-3">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Conselho dissolvido
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                                Este júri conta no total do período, mas fica de fora do cálculo de espécies,
                                matérias e aproveitamento, por não ter havido julgamento de mérito.
                            </p>
                        </div>
                    )}

                    {realizacao !== 'realizado' && (
                        <div className={`rounded-lg border p-3 mb-3 ${realizacao === 'cancelado'
                            ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`}
                        >
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                Sessão {realizacaoInfo.label.toLowerCase()}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {realizacaoInfo.description} Por padrão, fica de fora dos gráficos e
                                relatórios, que contam apenas as sessões realizadas.
                            </p>
                            {juri.realizacao_justificativa && (
                                <p className="text-xs text-slate-700 dark:text-slate-200 mt-2">
                                    <strong>Justificativa:</strong> {juri.realizacao_justificativa}
                                </p>
                            )}
                        </div>
                    )}

                    <Row icon={Scale} label="Número do processo" value={juri.numero_processo} mono />
                    <Row
                        icon={CalendarDays}
                        label="Data do júri"
                        value={juri.data_juri ? formatDateBR(juri.data_juri) : 'Sem data (júri cancelado)'}
                    />
                    <Row icon={CalendarClock} label="Realização" value={realizacaoInfo.label} />
                    <Row icon={Clock} label="Horário" value={juri.horario} />
                    <Row icon={MapPin} label="Comarca" value={juri.comarca} />
                    <Row icon={Building2} label="Vara / Órgão julgador" value={juri.vara} />
                    <Row icon={Gavel} label="Matéria / Tipo" value={juri.tipo ? tipoLabel(juri.tipo, settings) : ''} />
                    <Row
                        icon={Gavel}
                        label="Espécie de resultado"
                        value={juri.resultado ? `${juri.resultado} (peso ${peso})` : ''}
                    />
                    <Row icon={User} label="Promotor(a)" value={juri.promotor} />
                    <Row icon={UserCheck} label="Responsável no órgão" value={juri.responsible_user_name} />
                    <Row icon={FileText} label="Observações" value={juri.observacoes} />

                    {customFields.length > 0 && (
                        <>
                            <Separator className="my-3" />
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pb-1">
                                Colunas do órgão
                            </p>
                            {customFields.map((field) => {
                                const raw = getJuriFieldValue(juri, field.key);
                                const value = field.type === 'boolean'
                                    ? (raw === true ? 'Sim' : 'Não')
                                    : field.type === 'date'
                                        ? (raw ? formatDateBR(raw) : '')
                                        : raw;
                                return <Row key={field.key} icon={FileText} label={field.label} value={value} />;
                            })}
                        </>
                    )}

                    {juri.source === 'import' && juri.imported_from && (
                        <>
                            <Separator className="my-3" />
                            <Row icon={Upload} label="Arquivo de origem" value={juri.imported_from} />
                        </>
                    )}
                </div>

                {dateHistory.length > 0 && (
                    <>
                        <Separator />
                        <div className="px-6 py-4">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
                                <CalendarClock className="w-4 h-4 text-slate-400" />
                                Histórico de datas
                                <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                    {dateHistory.length}
                                </Badge>
                            </h4>
                            <JuriDateHistory entries={dateHistory} emptyHint={false} />
                        </div>
                    </>
                )}

                <Separator />

                <div className="px-6 py-4">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-3">
                        <History className="w-4 h-4 text-slate-400" />
                        Histórico
                        {entries.length > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{entries.length}</Badge>
                        )}
                    </h4>

                    {historyLoading && entries.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando histórico...
                        </div>
                    ) : entries.length === 0 ? (
                        <p className="text-sm text-slate-400 py-2">Nenhum registro de alteração.</p>
                    ) : (
                        <ol className="space-y-3">
                            {entries.map((entry, index) => (
                                <li key={entry.id || `${entry.timestamp}-${index}`} className="flex gap-3">
                                    <div className="flex flex-col items-center shrink-0">
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5" />
                                        {index < entries.length - 1 && (
                                            <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />
                                        )}
                                    </div>
                                    <div className="min-w-0 pb-1">
                                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">
                                            {entry.action}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {entry.date ? formatDateBR(entry.date) : ''}
                                            {entry.time ? ` às ${entry.time}` : ''}
                                            {entry.user_name ? ` — ${entry.user_name}` : ''}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
