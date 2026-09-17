import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Info, CalendarClock, History, Ban } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { createJuri, updateJuri } from '@/services/jurimetriaService';
import {
    getJurimetriaFields, getJuriFieldValue,
    JURIMETRIA_REALIZACOES, JURIMETRIA_REALIZACAO_PADRAO, realizacaoMeta,
} from '@/constants/jurimetria';
import { formatDateBR, duracaoEmMinutos, formatDuracao } from '@/lib/jurimetriaEngine';
import JuriDateHistory from './JuriDateHistory';

// Valor sentinela do Select para "nenhum": o Radix Select não aceita item com
// value="" (string vazia é usada internamente para "sem seleção").
const NENHUM = '__nenhum__';

function emptyFormFor(fields) {
    const form = {
        numero_processo: '',
        data_juri: '',
        realizacao: JURIMETRIA_REALIZACAO_PADRAO,
        realizacao_justificativa: '',
        comarca: '',
        tipo: '',
        resultado: '',
        promotor: '',
        horario_inicio: '',
        horario: '',
        vara: '',
        observacoes: '',
        responsible_user_id: '',
        responsible_user_name: '',
        values: {},
    };
    for (const field of fields.filter((f) => f.custom)) {
        form.values[field.key] = field.type === 'boolean' ? false : '';
    }
    return form;
}

/**
 * Cadastro e edição de um júri. Os campos fixos seguem a lista oficial do
 * órgão; as colunas personalizadas criadas pelo administrador aparecem logo
 * abaixo, com o controle adequado ao tipo de cada uma.
 */
export default function JuriFormDialog({
    open,
    onOpenChange,
    organization,
    settings,
    members = [],
    juri = null,
    onSaved,
}) {
    const isEdit = Boolean(juri?.id);
    const fields = useMemo(() => getJurimetriaFields(settings), [settings]);
    const customFields = useMemo(() => fields.filter((f) => f.custom), [fields]);
    const visibleCore = useMemo(() => new Set(fields.filter((f) => !f.custom).map((f) => f.key)), [fields]);
    const labelOf = (key, fallback) => fields.find((f) => f.key === key)?.label || fallback;

    const [form, setForm] = useState(() => emptyFormFor(fields));
    const [saving, setSaving] = useState(false);

    // Data que estava gravada ao abrir o modal. Serve de referência visual na
    // redesignação ("de 10/03 para ...") e não muda enquanto o modal está aberto.
    const dataAnterior = isEdit ? (juri?.data_juri || '') : '';
    const realizacaoAnterior = isEdit
        ? (juri?.realizacao || JURIMETRIA_REALIZACAO_PADRAO)
        : JURIMETRIA_REALIZACAO_PADRAO;

    const realizacao = form.realizacao || JURIMETRIA_REALIZACAO_PADRAO;
    const meta = realizacaoMeta(realizacao);
    const mudouRealizacao = realizacao !== realizacaoAnterior;
    const exigeJustificativa = ['redesignado', 'cancelado'].includes(realizacao);

    // Duração mostrada enquanto se digita: erro de horário aparece aqui, antes
    // de virar uma média errada no relatório.
    const duracaoPrevia = duracaoEmMinutos({
        horario_inicio: form.horario_inicio,
        horario: form.horario,
    });

    /**
     * Trocar a realização mexe na data, então o ajuste acontece aqui (e não num
     * efeito): ao redesignar, o campo de data é esvaziado para o usuário digitar
     * a NOVA data — a anterior continua visível como referência e vai para o
     * histórico ao salvar. Ao cancelar, a data deixa de existir.
     */
    const handleRealizacaoChange = (proxima) => {
        setForm((prev) => {
            const next = { ...prev, realizacao: proxima };
            if (proxima === 'cancelado') {
                next.data_juri = '';
            } else if (proxima === 'redesignado' && proxima !== realizacaoAnterior) {
                next.data_juri = '';
            } else if (proxima === 'realizado' && realizacaoAnterior === 'cancelado') {
                next.data_juri = '';
            } else if (proxima === realizacaoAnterior) {
                // Voltou ao estado original: restaura a data gravada.
                next.data_juri = dataAnterior;
            }
            if (!['redesignado', 'cancelado'].includes(proxima)) {
                next.realizacao_justificativa = '';
            }
            return next;
        });
    };

    useEffect(() => {
        if (!open) return;
        if (isEdit) {
            const base = emptyFormFor(fields);
            for (const key of Object.keys(base)) {
                if (key === 'values') continue;
                base[key] = juri[key] ?? '';
            }
            // Júri anterior à coluna "realização" conta como realizado.
            base.realizacao = base.realizacao || JURIMETRIA_REALIZACAO_PADRAO;
            for (const field of customFields) {
                base.values[field.key] = getJuriFieldValue(juri, field.key)
                    ?? (field.type === 'boolean' ? false : '');
            }
            setForm(base);
        } else {
            setForm(emptyFormFor(fields));
        }
    }, [open, isEdit, juri, fields, customFields]);

    const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
    const setValue = (key, value) => setForm((prev) => ({
        ...prev, values: { ...prev.values, [key]: value },
    }));

    const activeMembers = useMemo(
        () => members.filter((m) => m.active !== false),
        [members]
    );

    // Um júri antigo pode ter uma matéria ou espécie que o administrador
    // removeu depois da lista oficial. Nesse caso o valor gravado entra como
    // opção extra — sem isso, abrir a ficha para editar outro campo apagaria
    // silenciosamente o resultado do júri.
    const tipoOptions = useMemo(() => {
        const base = settings?.tipos || [];
        if (!form.tipo || base.some((t) => t.sigla === form.tipo)) return base;
        return [...base, { sigla: form.tipo, descricao: 'fora da lista atual', legacy: true }];
    }, [settings, form.tipo]);

    const resultadoOptions = useMemo(() => {
        const base = settings?.resultados || [];
        if (!form.resultado || base.includes(form.resultado)) return base;
        return [...base, form.resultado];
    }, [settings, form.resultado]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.numero_processo.trim()) {
            toast.error('Informe o número do processo.');
            return;
        }
        if (realizacao !== 'cancelado' && !form.data_juri) {
            toast.error(realizacao === 'redesignado'
                ? 'Informe a nova data do júri.'
                : 'Informe a data do júri.');
            return;
        }
        if (exigeJustificativa && mudouRealizacao && !form.realizacao_justificativa.trim()) {
            toast.error(realizacao === 'cancelado'
                ? 'Informe a justificativa do cancelamento.'
                : 'Informe a justificativa da redesignação.');
            return;
        }
        if (realizacao === 'redesignado' && mudouRealizacao
            && dataAnterior && form.data_juri === dataAnterior) {
            toast.error('A nova data da redesignação deve ser diferente da anterior.');
            return;
        }
        for (const field of customFields) {
            if (!field.required) continue;
            const value = form.values[field.key];
            if (value === '' || value === null || value === undefined) {
                toast.error(`O campo "${field.label}" é obrigatório.`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                numero_processo: form.numero_processo.trim(),
                data_juri: form.data_juri,
                realizacao,
                realizacao_justificativa: form.realizacao_justificativa.trim(),
                comarca: form.comarca,
                tipo: form.tipo,
                resultado: form.resultado,
                promotor: form.promotor.trim(),
                horario_inicio: form.horario_inicio.trim(),
                horario: form.horario.trim(),
                vara: form.vara.trim(),
                observacoes: form.observacoes.trim(),
                responsible_user_id: form.responsible_user_id || '',
                responsible_user_name: form.responsible_user_name || '',
                values: form.values,
            };

            if (isEdit) {
                await updateJuri(organization.id, juri.id, payload);
                toast.success('Júri atualizado.');
            } else {
                await createJuri(organization.id, payload);
                toast.success('Júri cadastrado.');
            }
            onOpenChange(false);
            if (onSaved) onSaved();
        } catch (error) {
            logger.error('[jurimetria] erro ao salvar júri:', error);
            toast.error(error?.message || 'Não foi possível salvar o júri.');
        } finally {
            setSaving(false);
        }
    };

    const renderCustomField = (field) => {
        const value = form.values[field.key];
        switch (field.type) {
            case 'textarea':
                return (
                    <Textarea
                        value={value || ''}
                        onChange={(e) => setValue(field.key, e.target.value)}
                        rows={3}
                    />
                );
            case 'number':
                return (
                    <Input
                        type="number"
                        value={value ?? ''}
                        onChange={(e) => setValue(field.key, e.target.value)}
                    />
                );
            case 'date':
                return (
                    <Input
                        type="date"
                        value={value || ''}
                        onChange={(e) => setValue(field.key, e.target.value)}
                    />
                );
            case 'boolean':
                return (
                    <div className="flex items-center h-10">
                        <Switch
                            checked={value === true}
                            onCheckedChange={(checked) => setValue(field.key, checked)}
                        />
                        <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                            {value === true ? 'Sim' : 'Não'}
                        </span>
                    </div>
                );
            case 'select':
                return (
                    <Select
                        value={value || NENHUM}
                        onValueChange={(v) => setValue(field.key, v === NENHUM ? '' : v)}
                    >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NENHUM}>— não informado —</SelectItem>
                            {(field.options || []).map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            default:
                return (
                    <Input
                        value={value || ''}
                        onChange={(e) => setValue(field.key, e.target.value)}
                    />
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-3">
                    <DialogTitle>{isEdit ? 'Editar júri' : 'Novo júri'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'As alterações ficam registradas no histórico do júri.'
                            : 'O número do processo é a chave do registro: não é possível cadastrar dois júris com o mesmo número neste órgão.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                    <ScrollArea className="flex-1 px-6">
                        <div className="space-y-4 pb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="juri-numero">
                                        {labelOf('numero_processo', 'Número do processo (CNJ)')} *
                                    </Label>
                                    <Input
                                        id="juri-numero"
                                        value={form.numero_processo}
                                        onChange={(e) => set({ numero_processo: e.target.value })}
                                        placeholder="0001234-56.2026.8.21.0001"
                                        className="font-mono"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>{labelOf('realizacao', 'Realização')} *</Label>
                                    <Select value={realizacao} onValueChange={handleRealizacaoChange}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {JURIMETRIA_REALIZACOES.map((r) => (
                                                <SelectItem key={r.value} value={r.value}>
                                                    <span className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${r.dot}`} />
                                                        {r.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-slate-400">{meta.description}</p>
                                </div>
                            </div>

                            {/* Bloco da data — muda conforme o desfecho da sessão. */}
                            {realizacao === 'cancelado' ? (
                                <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-3 space-y-3">
                                    <p className="text-sm font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
                                        <Ban className="w-4 h-4" />
                                        Júri cancelado — sem data
                                    </p>
                                    {dataAnterior && (
                                        <p className="text-xs text-rose-700 dark:text-rose-300">
                                            A data <strong>{formatDateBR(dataAnterior)}</strong> será removida do
                                            júri e guardada no histórico de datas, com a justificativa abaixo.
                                        </p>
                                    )}
                                </div>
                            ) : realizacao === 'redesignado' ? (
                                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-3">
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                        <CalendarClock className="w-4 h-4" />
                                        Júri redesignado
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Data anterior</Label>
                                            <Input
                                                value={dataAnterior ? formatDateBR(dataAnterior) : '—'}
                                                readOnly
                                                disabled
                                                className="bg-white/60 dark:bg-slate-900/60"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="juri-data" className="text-xs">Nova data do júri *</Label>
                                            <Input
                                                id="juri-data"
                                                type="date"
                                                value={form.data_juri}
                                                onChange={(e) => set({ data_juri: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        A nova data passa a ser a data do júri. A anterior é guardada no
                                        histórico de datas, com a justificativa abaixo.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label htmlFor="juri-data">{labelOf('data_juri', 'Data do júri')} *</Label>
                                    <Input
                                        id="juri-data"
                                        type="date"
                                        value={form.data_juri}
                                        onChange={(e) => set({ data_juri: e.target.value })}
                                        required
                                    />
                                    {realizacaoAnterior === 'cancelado' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Este júri estava cancelado: informe a data em que ele passa a ser
                                            considerado realizado.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Justificativa — obrigatória ao entrar em redesignado/cancelado. */}
                            {exigeJustificativa && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="juri-justificativa">
                                        {realizacao === 'cancelado'
                                            ? 'Justificativa do cancelamento'
                                            : 'Justificativa da redesignação'}
                                        {mudouRealizacao ? ' *' : ''}
                                    </Label>
                                    <Textarea
                                        id="juri-justificativa"
                                        value={form.realizacao_justificativa}
                                        onChange={(e) => set({ realizacao_justificativa: e.target.value })}
                                        rows={2}
                                        placeholder={realizacao === 'cancelado'
                                            ? 'Ex.: óbito do réu; extinção da punibilidade'
                                            : 'Ex.: réu não intimado; ausência de testemunha essencial'}
                                        required={mudouRealizacao}
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Fica registrada no histórico do júri junto com a mudança de data.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {visibleCore.has('comarca') && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="juri-comarca">{labelOf('comarca', 'Comarca')}</Label>
                                        <Input
                                            id="juri-comarca"
                                            value={form.comarca}
                                            onChange={(e) => set({ comarca: e.target.value })}
                                            list="juri-comarcas"
                                            placeholder="Selecione ou digite"
                                        />
                                        <datalist id="juri-comarcas">
                                            {(settings?.comarcas || []).map((c) => <option key={c} value={c} />)}
                                        </datalist>
                                    </div>
                                )}
                                {visibleCore.has('tipo') && (
                                    <div className="space-y-1.5">
                                        <Label>{labelOf('tipo', 'Matéria / Tipo de júri')}</Label>
                                        <Select
                                            value={form.tipo || NENHUM}
                                            onValueChange={(v) => set({ tipo: v === NENHUM ? '' : v })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NENHUM}>— não informado —</SelectItem>
                                                {tipoOptions.map((t) => (
                                                    <SelectItem key={t.sigla} value={t.sigla}>
                                                        {t.sigla} — {t.descricao}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            {visibleCore.has('resultado') && (
                                <div className="space-y-1.5">
                                    <Label>{labelOf('resultado', 'Espécie de resultado')}</Label>
                                    <Select
                                        value={form.resultado || NENHUM}
                                        onValueChange={(v) => set({ resultado: v === NENHUM ? '' : v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NENHUM}>— não informado —</SelectItem>
                                            {resultadoOptions.map((r) => (
                                                <SelectItem key={r} value={r}>
                                                    {r}
                                                    {!(settings?.resultados || []).includes(r) && ' (fora da lista atual)'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {(settings?.dissolucaoResultados || []).includes(form.resultado) && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                            Este resultado é tratado como dissolução: entra no total de júris, mas fica
                                            fora do cálculo de espécies, matérias e aproveitamento.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {visibleCore.has('promotor') && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="juri-promotor">{labelOf('promotor', 'Promotor(a)')}</Label>
                                        <Input
                                            id="juri-promotor"
                                            value={form.promotor}
                                            onChange={(e) => set({ promotor: e.target.value })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Horários da sessão — a duração sai da diferença entre os dois. */}
                            {(visibleCore.has('horario_inicio') || visibleCore.has('horario')) && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                    {visibleCore.has('horario_inicio') && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="juri-horario-inicio">
                                                {labelOf('horario_inicio', 'Horário de início')}
                                            </Label>
                                            <Input
                                                id="juri-horario-inicio"
                                                value={form.horario_inicio}
                                                onChange={(e) => set({ horario_inicio: e.target.value })}
                                                placeholder="13h00"
                                            />
                                        </div>
                                    )}
                                    {visibleCore.has('horario') && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="juri-horario">
                                                {labelOf('horario', 'Horário de conclusão')}
                                            </Label>
                                            <Input
                                                id="juri-horario"
                                                value={form.horario}
                                                onChange={(e) => set({ horario: e.target.value })}
                                                placeholder="18h30"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-slate-400">Duração</Label>
                                        <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-slate-200 dark:border-slate-700 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                                            {duracaoPrevia === null ? '—' : formatDuracao(duracaoPrevia)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {visibleCore.has('vara') && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="juri-vara">{labelOf('vara', 'Vara / Órgão julgador')}</Label>
                                    <Input
                                        id="juri-vara"
                                        value={form.vara}
                                        onChange={(e) => set({ vara: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label>Responsável no órgão</Label>
                                <Select
                                    value={form.responsible_user_id || NENHUM}
                                    onValueChange={(value) => {
                                        if (value === NENHUM) {
                                            set({ responsible_user_id: '', responsible_user_name: '' });
                                            return;
                                        }
                                        const member = activeMembers.find((m) => m.user_id === value);
                                        set({
                                            responsible_user_id: value,
                                            responsible_user_name: member?.user_name || member?.user_email || '',
                                        });
                                    }}
                                >
                                    <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NENHUM}>— sem responsável —</SelectItem>
                                        {activeMembers.map((member) => (
                                            <SelectItem key={member.user_id} value={member.user_id}>
                                                {member.user_name || member.user_email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {settings?.requireResponsible && !form.responsible_user_id && (
                                    <p className="text-xs text-rose-600 dark:text-rose-400">
                                        Este órgão exige um responsável para cada júri.
                                    </p>
                                )}
                            </div>

                            {visibleCore.has('observacoes') && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="juri-obs">{labelOf('observacoes', 'Observações')}</Label>
                                    <Textarea
                                        id="juri-obs"
                                        value={form.observacoes}
                                        onChange={(e) => set({ observacoes: e.target.value })}
                                        rows={3}
                                        placeholder="Motivo da dissolução, particularidades da sessão, etc."
                                    />
                                </div>
                            )}

                            {customFields.length > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                        Colunas do órgão
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {customFields.map((field) => (
                                            <div
                                                key={field.key}
                                                className={`space-y-1.5 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}
                                            >
                                                <Label>
                                                    {field.label}{field.required ? ' *' : ''}
                                                </Label>
                                                {renderCustomField(field)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Histórico de datas: quem vai redesignar precisa ver quantas
                                vezes este júri já foi adiado antes de adiar de novo. */}
                            {isEdit && (juri?.date_history?.length || 0) > 0 && (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                                        <History className="w-3.5 h-3.5" />
                                        Histórico de datas ({juri.date_history.length})
                                    </p>
                                    <JuriDateHistory entries={juri.date_history} compact emptyHint={false} />
                                </div>
                            )}

                            {isEdit && juri?.source === 'import' && (
                                <Alert>
                                    <AlertDescription className="text-xs">
                                        Este júri veio da importação de <strong>{juri.imported_from || 'uma planilha'}</strong>.
                                        Editar aqui não altera o arquivo original; se a planilha for reimportada, a política de
                                        conflito do órgão decide se o dado editado é mantido.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar alterações' : 'Cadastrar júri'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
