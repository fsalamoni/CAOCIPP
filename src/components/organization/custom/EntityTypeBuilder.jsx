import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Plus, Trash2, Loader2, ChevronUp, ChevronDown, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FIELD_TYPE_LIST, FIELD_TYPE_META } from '@/lib/fieldTypes';
import { upsertEntityType } from '@/services/customEntitiesService';

const slugify = (s) => String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([0-9])/, 'f$1')
    .slice(0, 40) || 'campo';

const PHASE_COLORS = ['#64748b', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

function newField() {
    return { key: '', label: '', type: 'text', required: false, options: [], help: '', table: { show: true }, form: { show: true } };
}
function newPhase(i) {
    return { key: '', label: '', color: PHASE_COLORS[i % PHASE_COLORS.length], is_initial: i === 0, is_final: false };
}

/**
 * Construtor no-code de tipos de entidade.
 * props: open, onOpenChange, organizationId, members, entityType (edição),
 *        initialFields (pré-preenchimento ao importar planilha), onSaved
 */
export default function EntityTypeBuilder({ open, onOpenChange, organizationId, members = [], entityType, initialFields, onSaved }) {
    const isEdit = !!entityType;

    const [labelSingular, setLabelSingular] = useState(entityType?.label_singular || '');
    const [labelPlural, setLabelPlural] = useState(entityType?.label_plural || '');
    const [icon, setIcon] = useState(entityType?.icon || 'Folder');
    const [color, setColor] = useState(entityType?.color || '#3b82f6');
    const [enabled, setEnabled] = useState(entityType?.enabled !== false);
    const [fields, setFields] = useState(
        entityType?.fields?.length
            ? entityType.fields.map((f) => ({ ...f, options: f.options || [] }))
            : (initialFields?.length
                ? initialFields.map((f) => ({ ...f, options: f.options || [] }))
                : [newField()])
    );
    const [phases, setPhases] = useState(
        entityType?.phases?.length ? entityType.phases.slice() : [newPhase(0), { ...newPhase(1), label: 'Concluído', key: 'concluido', is_final: true }]
    );
    const [transitions, setTransitions] = useState(entityType?.transitions || []);
    const [saving, setSaving] = useState(false);
    const [advancedFields, setAdvancedFields] = useState({});
    const toggleAdvanced = (idx) => setAdvancedFields((prev) => ({ ...prev, [idx]: !prev[idx] }));
    const updateValidation = (idx, patch) => updateField(idx, { validation: { ...(fields[idx].validation || {}), ...patch } });

    // ---- Campos ----
    const updateField = (idx, patch) => setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    const updateFieldLabel = (idx, label) => {
        const f = fields[idx];
        const patch = { label };
        if (!f.key || f.key === slugify(f.label)) patch.key = slugify(label);
        updateField(idx, patch);
    };
    const addField = () => setFields((prev) => [...prev, newField()]);
    const removeField = (idx) => setFields((prev) => prev.filter((_, i) => i !== idx));
    const moveField = (idx, dir) => setFields((prev) => {
        const arr = prev.slice();
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return prev;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return arr;
    });
    const addOption = (idx) => updateField(idx, { options: [...(fields[idx].options || []), { value: '', label: '' }] });
    const updateOption = (fi, oi, patch) => updateField(fi, {
        options: fields[fi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)),
    });
    const removeOption = (fi, oi) => updateField(fi, { options: fields[fi].options.filter((_, i) => i !== oi) });

    // ---- Fases ----
    const updatePhase = (idx, patch) => setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    const updatePhaseLabel = (idx, label) => {
        const p = phases[idx];
        const oldKey = p.key;
        const patch = { label };
        if (!p.key || p.key === slugify(p.label)) patch.key = slugify(label);
        updatePhase(idx, patch);
        // Ao mudar a chave, remapeia colunas e regras que apontam para a fase.
        if (patch.key && oldKey && patch.key !== oldKey) {
            setFields((prev) => prev.map((f) => (f.phase === oldKey ? { ...f, phase: patch.key } : f)));
            setTransitions((prev) => prev.map((t) => ({
                ...t,
                from: t.from === oldKey ? patch.key : t.from,
                to: t.to === oldKey ? patch.key : t.to,
            })));
        }
    };
    const addPhase = () => setPhases((prev) => [...prev, newPhase(prev.length)]);
    const removePhase = (idx) => {
        const removed = phases[idx];
        setPhases((prev) => prev.filter((_, i) => i !== idx));
        // Desvincula colunas que estavam nesta fase.
        if (removed?.key) {
            setFields((prev) => prev.map((f) => (f.phase === removed.key ? { ...f, phase: undefined, required_to_advance: false } : f)));
        }
    };
    // ---- Atribuição de colunas a fases ----
    const fieldKeyOf = (f) => f.key || slugify(f.label);
    const assignFieldToPhase = (fieldKey, phaseKey) => setFields((prev) => prev.map((f) => {
        if (fieldKeyOf(f) !== fieldKey) return f;
        return phaseKey
            ? { ...f, phase: phaseKey }
            : { ...f, phase: undefined, required_to_advance: false };
    }));
    const setFieldRequired = (fieldKey, val) => setFields((prev) => prev.map((f) => (fieldKeyOf(f) === fieldKey ? { ...f, required: val } : f)));
    const setFieldAdvance = (fieldKey, val) => setFields((prev) => prev.map((f) => (fieldKeyOf(f) === fieldKey ? { ...f, required_to_advance: val } : f)));
    const setInitial = (idx) => setPhases((prev) => prev.map((p, i) => ({ ...p, is_initial: i === idx })));
    const movePhase = (idx, dir) => setPhases((prev) => {
        const arr = prev.slice();
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return prev;
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return arr;
    });

    // ---- Regras ----
    const addTransition = () => setTransitions((prev) => [...prev, {
        from: '*', to: phases[0]?.key || '', requirements: [],
    }]);
    const updateTransition = (idx, patch) => setTransitions((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
    const removeTransition = (idx) => setTransitions((prev) => prev.filter((_, i) => i !== idx));
    const addRequirement = (ti) => updateTransition(ti, {
        requirements: [...(transitions[ti].requirements || []), { type: 'field_required', field: fields[0]?.key }],
    });
    const updateRequirement = (ti, ri, patch) => updateTransition(ti, {
        requirements: transitions[ti].requirements.map((r, i) => (i === ri ? { ...r, ...patch } : r)),
    });
    const removeRequirement = (ti, ri) => updateTransition(ti, {
        requirements: transitions[ti].requirements.filter((_, i) => i !== ri),
    });
    const updateOnSuccess = (ti, patch) => updateTransition(ti, {
        on_success: { ...(transitions[ti].on_success || {}), ...patch },
    });
    const addSetField = (ti) => updateOnSuccess(ti, {
        set_fields: [...(transitions[ti].on_success?.set_fields || []), { field: fields[0]?.key || '', value: '' }],
    });
    const updateSetField = (ti, si, patch) => updateOnSuccess(ti, {
        set_fields: (transitions[ti].on_success?.set_fields || []).map((s, i) => (i === si ? { ...s, ...patch } : s)),
    });
    const removeSetField = (ti, si) => updateOnSuccess(ti, {
        set_fields: (transitions[ti].on_success?.set_fields || []).filter((_, i) => i !== si),
    });

    const handleSave = async () => {
        if (!labelSingular.trim() || !labelPlural.trim()) {
            toast.error('Informe o nome no singular e no plural.');
            return;
        }
        const cleanFields = fields
            .filter((f) => f.label.trim())
            .map(({ _sourceIndex, ...f }) => ({ ...f, key: f.key || slugify(f.label) }));
        if (cleanFields.length === 0) {
            toast.error('Crie pelo menos um campo.');
            return;
        }
        const cleanPhases = phases
            .filter((p) => p.label.trim())
            .map((p) => ({ ...p, key: p.key || slugify(p.label) }));
        if (cleanPhases.length === 0) {
            toast.error('Crie pelo menos uma fase.');
            return;
        }

        const def = {
            ...(isEdit ? { id: entityType.id } : {}),
            label_singular: labelSingular.trim(),
            label_plural: labelPlural.trim(),
            icon,
            color,
            enabled,
            fields: cleanFields,
            phases: cleanPhases,
            transitions: transitions.filter((t) => t.to),
        };

        setSaving(true);
        try {
            await upsertEntityType(organizationId, def);
            toast.success(isEdit ? 'Página atualizada.' : 'Página criada.');
            onSaved?.();
            onOpenChange(false);
        } catch (e) {
            toast.error(e?.message || 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const phaseOptions = phases.filter((p) => p.label.trim());
    const fieldOptions = fields.filter((f) => f.label.trim()).map((f) => ({ ...f, key: f.key || slugify(f.label) }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        {isEdit ? 'Editar página personalizada' : 'Nova página personalizada'}
                    </DialogTitle>
                    <DialogDescription>
                        Monte sua própria página com campos, painel de fases e regras — sem programar.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid grid-cols-4 w-full">
                        <TabsTrigger value="info">Identificação</TabsTrigger>
                        <TabsTrigger value="fields">Campos</TabsTrigger>
                        <TabsTrigger value="phases">Fases</TabsTrigger>
                        <TabsTrigger value="rules">Regras</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="flex-1 mt-3 pr-3">
                        {/* IDENTIFICAÇÃO */}
                        <TabsContent value="info" className="space-y-4 mt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Nome (singular)</Label>
                                    <Input value={labelSingular} onChange={(e) => setLabelSingular(e.target.value)} placeholder="Ex.: Contrato" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Nome (plural)</Label>
                                    <Input value={labelPlural} onChange={(e) => setLabelPlural(e.target.value)} placeholder="Ex.: Contratos" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Ícone (nome lucide, opcional)</Label>
                                <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ex.: Folder, FileText, Briefcase" />
                                <p className="text-xs text-muted-foreground">Use nomes da biblioteca Lucide. Em caso de dúvida, deixe "Folder".</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Cor da página</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="h-9 w-12 rounded border cursor-pointer"
                                            title="Cor"
                                        />
                                        <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Situação</Label>
                                    <label className="flex items-center gap-2 h-9 cursor-pointer">
                                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                                        <span className="text-sm">{enabled ? 'Página ativa (visível no menu)' : 'Página desativada (oculta)'}</span>
                                    </label>
                                </div>
                            </div>
                        </TabsContent>

                        {/* CAMPOS */}
                        <TabsContent value="fields" className="space-y-3 mt-0">
                            {fields.map((f, idx) => (
                                <Card key={idx} className="p-3 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <div className="flex flex-col pt-1">
                                            <button type="button" onClick={() => moveField(idx, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-4 w-4" /></button>
                                            <button type="button" onClick={() => moveField(idx, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Rótulo do campo</Label>
                                                <Input value={f.label} onChange={(e) => updateFieldLabel(idx, e.target.value)} placeholder="Ex.: Valor total" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Tipo</Label>
                                                <Select value={f.type} onValueChange={(v) => updateField(idx, { type: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {FIELD_TYPE_LIST.map((t) => (
                                                            <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => removeField(idx)} className="text-red-500 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {FIELD_TYPE_META[f.type]?.hasOptions && (
                                        <div className="pl-8 space-y-2">
                                            <Label className="text-xs">Opções</Label>
                                            {(f.options || []).map((o, oi) => (
                                                <div key={oi} className="flex gap-2 items-center">
                                                    <input
                                                        type="color"
                                                        value={o.color || '#94a3b8'}
                                                        onChange={(e) => updateOption(idx, oi, { color: e.target.value })}
                                                        className="h-8 w-8 rounded border cursor-pointer shrink-0"
                                                        title="Cor da opção"
                                                    />
                                                    <Input className="h-8" value={o.label} onChange={(e) => updateOption(idx, oi, { label: e.target.value, value: o.value || slugify(e.target.value) })} placeholder="Rótulo" />
                                                    <Button variant="ghost" size="icon" onClick={() => removeOption(idx, oi)} className="text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => addOption(idx)}><Plus className="mr-1 h-3.5 w-3.5" />Opção</Button>
                                        </div>
                                    )}

                                    <div className="pl-8 space-y-1">
                                        <Label className="text-xs">Texto de ajuda (opcional)</Label>
                                        <Input className="h-8" value={f.help || ''} onChange={(e) => updateField(idx, { help: e.target.value })} placeholder="Aparece abaixo do campo, orientando o preenchimento" />
                                    </div>

                                    <div className="pl-8 flex flex-wrap items-center gap-4">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={f.required === true} onCheckedChange={(c) => updateField(idx, { required: c })} />
                                            Obrigatório
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={f.form?.show !== false} onCheckedChange={(c) => updateField(idx, { form: { ...f.form, show: c } })} />
                                            Mostrar no formulário
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={f.table?.show !== false} onCheckedChange={(c) => updateField(idx, { table: { ...f.table, show: c } })} />
                                            Mostrar na tabela
                                        </label>
                                        <button type="button" onClick={() => toggleAdvanced(idx)} className="text-xs text-primary hover:underline ml-auto flex items-center gap-1">
                                            <Settings2 className="h-3.5 w-3.5" /> {advancedFields[idx] ? 'Ocultar avançado' : 'Avançado'}
                                        </button>
                                    </div>

                                    {advancedFields[idx] && (
                                        <div className="pl-8 space-y-3 border-t pt-3">
                                            {(f.type === 'text' || f.type === 'textarea' || f.type === 'link') && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Tamanho mínimo</Label>
                                                        <Input className="h-8" type="number" value={f.validation?.minLength ?? ''} onChange={(e) => updateValidation(idx, { minLength: e.target.value })} placeholder="—" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Tamanho máximo</Label>
                                                        <Input className="h-8" type="number" value={f.validation?.maxLength ?? ''} onChange={(e) => updateValidation(idx, { maxLength: e.target.value })} placeholder="—" />
                                                    </div>
                                                </div>
                                            )}
                                            {(f.type === 'number' || f.type === 'currency') && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Valor mínimo</Label>
                                                        <Input className="h-8" type="number" value={f.validation?.min ?? ''} onChange={(e) => updateValidation(idx, { min: e.target.value })} placeholder="—" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">Valor máximo</Label>
                                                        <Input className="h-8" type="number" value={f.validation?.max ?? ''} onChange={(e) => updateValidation(idx, { max: e.target.value })} placeholder="—" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                <Label className="text-xs">Valor padrão (opcional)</Label>
                                                {f.type === 'boolean' ? (
                                                    <Select value={String(f.default ?? '')} onValueChange={(v) => updateField(idx, { default: v === '' ? undefined : v === 'true' })}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Sem padrão" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="">Sem padrão</SelectItem>
                                                            <SelectItem value="true">Sim</SelectItem>
                                                            <SelectItem value="false">Não</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Input className="h-8" value={f.default ?? ''} onChange={(e) => updateField(idx, { default: e.target.value === '' ? undefined : e.target.value })} placeholder="Preenchido automaticamente em novos registros" />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                            <Button variant="outline" onClick={addField}><Plus className="mr-1.5 h-4 w-4" />Adicionar campo</Button>
                        </TabsContent>

                        {/* FASES */}
                        <TabsContent value="phases" className="space-y-3 mt-0">
                            <p className="text-xs text-muted-foreground">
                                As fases viram as colunas do painel (kanban) e as abas do formulário. A fase inicial recebe novos registros.
                                Atribua colunas a cada fase para que o formulário de criar/editar mostre uma aba por fase.
                            </p>
                            {phases.map((p, idx) => (
                                <Card key={idx} className="p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                            <button type="button" onClick={() => movePhase(idx, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-4 w-4" /></button>
                                            <button type="button" onClick={() => movePhase(idx, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
                                        </div>
                                        <input
                                            type="color"
                                            value={p.color || '#64748b'}
                                            onChange={(e) => updatePhase(idx, { color: e.target.value })}
                                            className="h-8 w-8 rounded border cursor-pointer shrink-0"
                                            title="Cor"
                                        />
                                        <Input value={p.label} onChange={(e) => updatePhaseLabel(idx, e.target.value)} placeholder="Ex.: Em análise" className="flex-1" />
                                        <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                                            <input type="radio" checked={p.is_initial === true} onChange={() => setInitial(idx)} />
                                            Inicial
                                        </label>
                                        <Button variant="ghost" size="icon" onClick={() => removePhase(idx)} className="text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 pl-8">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={p.is_final === true} onCheckedChange={(c) => updatePhase(idx, { is_final: c })} />
                                            Fase final (conclui o registro)
                                        </label>
                                        <label className="flex items-center gap-2 text-xs whitespace-nowrap">
                                            Limite de itens (WIP)
                                            <Input
                                                type="number"
                                                min="0"
                                                className="h-8 w-20"
                                                value={p.wip_limit ?? ''}
                                                onChange={(e) => updatePhase(idx, { wip_limit: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                placeholder="—"
                                            />
                                        </label>
                                    </div>

                                    <div className="pl-8 space-y-1">
                                        <Label className="text-xs">Descrição da fase (opcional)</Label>
                                        <Textarea
                                            value={p.description || ''}
                                            onChange={(e) => updatePhase(idx, { description: e.target.value })}
                                            placeholder="Explique o que acontece nesta fase (aparece no topo da aba)."
                                            className="min-h-[52px] text-sm"
                                        />
                                    </div>

                                    <div className="pl-8 space-y-2 border-t pt-3">
                                        <Label className="text-xs">Colunas desta fase</Label>
                                        <p className="text-[11px] text-muted-foreground">
                                            Marque as colunas que compõem esta fase. Elas aparecerão na aba "{p.label || 'fase'}" do formulário.
                                        </p>
                                        {fieldOptions.length === 0 && (
                                            <p className="text-[11px] text-muted-foreground">Crie colunas na aba "Campos" primeiro.</p>
                                        )}
                                        <div className="space-y-1.5">
                                            {fieldOptions.map((f) => {
                                                const phaseKey = p.key || slugify(p.label);
                                                const assignedHere = f.phase === phaseKey;
                                                const assignedElsewhere = f.phase && f.phase !== phaseKey;
                                                return (
                                                    <div key={f.key} className="flex items-center gap-2 flex-wrap rounded-md border px-2 py-1.5">
                                                        <label className="flex items-center gap-2 text-xs cursor-pointer flex-1 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={assignedHere}
                                                                onChange={(e) => assignFieldToPhase(f.key, e.target.checked ? phaseKey : null)}
                                                            />
                                                            <span className="truncate">{f.label}</span>
                                                            {assignedElsewhere && <Badge variant="secondary" className="text-[10px]">em outra fase</Badge>}
                                                        </label>
                                                        {assignedHere && (
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                                                                    <Switch checked={f.required === true} onCheckedChange={(c) => setFieldRequired(f.key, c)} />
                                                                    Obrigatória
                                                                </label>
                                                                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer whitespace-nowrap">
                                                                    <Switch checked={f.required_to_advance === true} onCheckedChange={(c) => setFieldAdvance(f.key, c)} />
                                                                    Requisito p/ avançar
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            <Button variant="outline" onClick={addPhase}><Plus className="mr-1.5 h-4 w-4" />Adicionar fase</Button>
                        </TabsContent>

                        {/* REGRAS */}
                        <TabsContent value="rules" className="space-y-3 mt-0">
                            <p className="text-xs text-muted-foreground">
                                Regras (opcionais) controlam quando um registro pode mudar de fase. Sem regras, qualquer movimento é permitido.
                            </p>
                            {transitions.map((t, ti) => (
                                <Card key={ti} className="p-3 space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-muted-foreground">Ao mover de</span>
                                        <Select value={t.from} onValueChange={(v) => updateTransition(ti, { from: v })}>
                                            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="*">Qualquer fase</SelectItem>
                                                {phaseOptions.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-xs text-muted-foreground">para</span>
                                        <Select value={t.to} onValueChange={(v) => updateTransition(ti, { to: v })}>
                                            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Fase destino" /></SelectTrigger>
                                            <SelectContent>
                                                {phaseOptions.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" onClick={() => removeTransition(ti)} className="text-red-500 ml-auto"><Trash2 className="h-4 w-4" /></Button>
                                    </div>

                                    <div className="pl-2 space-y-2 border-l-2 border-muted ml-1">
                                        {(t.requirements || []).map((r, ri) => (
                                            <RequirementEditor
                                                key={ri}
                                                req={r}
                                                fieldOptions={fieldOptions}
                                                members={members}
                                                onChange={(patch) => updateRequirement(ti, ri, patch)}
                                                onRemove={() => removeRequirement(ti, ri)}
                                            />
                                        ))}
                                        <Button variant="outline" size="sm" onClick={() => addRequirement(ti)}><Plus className="mr-1 h-3.5 w-3.5" />Requisito</Button>
                                    </div>

                                    <div className="pl-2 ml-1 space-y-2 border-l-2 border-emerald-200 dark:border-emerald-900">
                                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ao concluir a mudança</p>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch
                                                checked={t.on_success?.require_comment === true}
                                                onCheckedChange={(c) => updateOnSuccess(ti, { require_comment: c })}
                                            />
                                            Exigir comentário ao mover
                                        </label>
                                        {(t.on_success?.set_fields || []).map((s, si) => (
                                            <div key={si} className="flex items-center gap-2 flex-wrap text-xs">
                                                <span className="text-muted-foreground">Preencher</span>
                                                <Select value={s.field || ''} onValueChange={(v) => updateSetField(ti, si, { field: v })}>
                                                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Campo" /></SelectTrigger>
                                                    <SelectContent>
                                                        {fieldOptions.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <span className="text-muted-foreground">com</span>
                                                <Input
                                                    className="h-8 w-36"
                                                    value={s.value ?? ''}
                                                    onChange={(e) => updateSetField(ti, si, { value: e.target.value })}
                                                    placeholder='valor ou "now" p/ data'
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => removeSetField(ti, si)} className="text-red-500 h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" onClick={() => addSetField(ti)}><Plus className="mr-1 h-3.5 w-3.5" />Auto-preencher campo</Button>
                                    </div>
                                </Card>
                            ))}
                            <Button variant="outline" onClick={addTransition}><Plus className="mr-1.5 h-4 w-4" />Adicionar regra</Button>
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? 'Salvar alterações' : 'Criar página'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const REQ_TYPES = [
    { value: 'field_required', label: 'Campo preenchido' },
    { value: 'min_value', label: 'Valor mínimo' },
    { value: 'field_condition', label: 'Condição em campo' },
    { value: 'approval', label: 'Aprovação' },
];
const OPERATORS = [
    { value: 'eq', label: 'igual a' },
    { value: 'neq', label: 'diferente de' },
    { value: 'gt', label: 'maior que' },
    { value: 'gte', label: 'maior ou igual' },
    { value: 'lt', label: 'menor que' },
    { value: 'lte', label: 'menor ou igual' },
    { value: 'contains', label: 'contém' },
];

function RequirementEditor({ req, fieldOptions, members, onChange, onRemove }) {
    const selectedUsers = req.users || [];
    const toggleUser = (userId) => {
        const nextUsers = selectedUsers.includes(userId)
            ? selectedUsers.filter((id) => id !== userId)
            : [...selectedUsers, userId];
        onChange({ users: nextUsers });
    };

    return (
        <div className="flex items-center gap-2 flex-wrap text-xs">
            <Select value={req.type} onValueChange={(v) => onChange({ type: v })}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {REQ_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
            </Select>

            {(req.type === 'field_required' || req.type === 'min_value' || req.type === 'field_condition') && (
                <Select value={req.field || ''} onValueChange={(v) => onChange({ field: v })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Campo" /></SelectTrigger>
                    <SelectContent>
                        {fieldOptions.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}

            {req.type === 'field_condition' && (
                <Select value={req.operator || 'eq'} onValueChange={(v) => onChange({ operator: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {OPERATORS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}

            {(req.type === 'min_value' || req.type === 'field_condition') && (
                <Input
                    className="h-8 w-28"
                    value={req.value ?? ''}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder="Valor"
                />
            )}

            {req.type === 'approval' && (
                <Select value={req.mode || 'roles'} onValueChange={(v) => onChange({ mode: v })}>
                    <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="roles">Por papel (Admin/Criador)</SelectItem>
                        <SelectItem value="users">Por pessoa(s) autorizada(s)</SelectItem>
                    </SelectContent>
                </Select>
            )}

            {req.type === 'approval' && req.mode === 'users' && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
                    <span className="text-[11px] text-muted-foreground mr-1">Pessoas autorizadas</span>
                    {members.length === 0 && <span className="text-[11px] text-muted-foreground">Sem membros disponíveis.</span>}
                    {members.map((m) => {
                        const userId = m.user_id || m.id;
                        const checked = selectedUsers.includes(userId);
                        return (
                            <label
                                key={userId}
                                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 cursor-pointer ${checked ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleUser(userId)}
                                />
                                <span>{m.user_name || m.user_email || userId}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            <Button variant="ghost" size="icon" onClick={onRemove} className="text-red-500 h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
    );
}
