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
import { Loader2, Save, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { createJuri, updateJuri } from '@/services/jurimetriaService';
import { getJurimetriaFields, getJuriFieldValue } from '@/constants/jurimetria';

// Valor sentinela do Select para "nenhum": o Radix Select não aceita item com
// value="" (string vazia é usada internamente para "sem seleção").
const NENHUM = '__nenhum__';

function emptyFormFor(fields) {
    const form = {
        numero_processo: '',
        data_juri: '',
        comarca: '',
        tipo: '',
        resultado: '',
        promotor: '',
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

    useEffect(() => {
        if (!open) return;
        if (isEdit) {
            const base = emptyFormFor(fields);
            for (const key of Object.keys(base)) {
                if (key === 'values') continue;
                base[key] = juri[key] ?? '';
            }
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
        if (!form.data_juri) {
            toast.error('Informe a data do júri.');
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
                comarca: form.comarca,
                tipo: form.tipo,
                resultado: form.resultado,
                promotor: form.promotor.trim(),
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
                                    <Label htmlFor="juri-data">{labelOf('data_juri', 'Data do júri')} *</Label>
                                    <Input
                                        id="juri-data"
                                        type="date"
                                        value={form.data_juri}
                                        onChange={(e) => set({ data_juri: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

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
                                {visibleCore.has('horario') && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="juri-horario">{labelOf('horario', 'Horário')}</Label>
                                        <Input
                                            id="juri-horario"
                                            value={form.horario}
                                            onChange={(e) => set({ horario: e.target.value })}
                                            placeholder="14h30"
                                        />
                                    </div>
                                )}
                            </div>

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
