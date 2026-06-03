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
    Plus, Trash2, GripVertical, Loader2, ChevronUp, ChevronDown, Settings2,
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
 * props: open, onOpenChange, organizationId, members, entityType (edição), onSaved
 */
export default function EntityTypeBuilder({ open, onOpenChange, organizationId, members = [], entityType, onSaved }) {
    const isEdit = !!entityType;

    const [labelSingular, setLabelSingular] = useState(entityType?.label_singular || '');
    const [labelPlural, setLabelPlural] = useState(entityType?.label_plural || '');
    const [icon, setIcon] = useState(entityType?.icon || 'Folder');
    const [fields, setFields] = useState(
        entityType?.fields?.length ? entityType.fields.map((f) => ({ ...f, options: f.options || [] })) : [newField()]
    );
    const [phases, setPhases] = useState(
        entityType?.phases?.length ? entityType.phases.slice() : [newPhase(0), { ...newPhase(1), label: 'Concluído', key: 'concluido', is_final: true }]
    );
    const [transitions, setTransitions] = useState(entityType?.transitions || []);
    const [saving, setSaving] = useState(false);

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
        const patch = { label };
        if (!p.key || p.key === slugify(p.label)) patch.key = slugify(label);
        updatePhase(idx, patch);
    };
    const addPhase = () => setPhases((prev) => [...prev, newPhase(prev.length)]);
    const removePhase = (idx) => setPhases((prev) => prev.filter((_, i) => i !== idx));
    const setInitial = (idx) => setPhases((prev) => prev.map((p, i) => ({ ...p, is_initial: i === idx })));

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

    const handleSave = async () => {
        if (!labelSingular.trim() || !labelPlural.trim()) {
            toast.error('Informe o nome no singular e no plural.');
            return;
        }
        const cleanFields = fields
            .filter((f) => f.label.trim())
            .map((f) => ({ ...f, key: f.key || slugify(f.label) }));
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
    const fieldOptions = fields.filter((f) => f.label.trim());

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
                                                    <Input className="h-8" value={o.label} onChange={(e) => updateOption(idx, oi, { label: e.target.value, value: o.value || slugify(e.target.value) })} placeholder="Rótulo" />
                                                    <Button variant="ghost" size="icon" onClick={() => removeOption(idx, oi)} className="text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </div>
                                            ))}
                                            <Button variant="outline" size="sm" onClick={() => addOption(idx)}><Plus className="mr-1 h-3.5 w-3.5" />Opção</Button>
                                        </div>
                                    )}

                                    <div className="pl-8 flex flex-wrap items-center gap-4">
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={f.required === true} onCheckedChange={(c) => updateField(idx, { required: c })} />
                                            Obrigatório
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <Switch checked={f.table?.show !== false} onCheckedChange={(c) => updateField(idx, { table: { ...f.table, show: c } })} />
                                            Mostrar na tabela
                                        </label>
                                    </div>
                                </Card>
                            ))}
                            <Button variant="outline" onClick={addField}><Plus className="mr-1.5 h-4 w-4" />Adicionar campo</Button>
                        </TabsContent>

                        {/* FASES */}
                        <TabsContent value="phases" className="space-y-3 mt-0">
                            <p className="text-xs text-muted-foreground">As fases viram as colunas do painel (kanban). A fase inicial recebe novos registros.</p>
                            {phases.map((p, idx) => (
                                <Card key={idx} className="p-3">
                                    <div className="flex items-center gap-2">
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
                        <SelectItem value="users">Por pessoa específica</SelectItem>
                    </SelectContent>
                </Select>
            )}

            {req.type === 'approval' && req.mode === 'users' && (
                <Select value={(req.users || [])[0] || ''} onValueChange={(v) => onChange({ users: [v] })}>
                    <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Pessoa" /></SelectTrigger>
                    <SelectContent>
                        {members.map((m) => <SelectItem key={m.user_id || m.id} value={m.user_id || m.id}>{m.user_name || m.user_id}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}

            <Button variant="ghost" size="icon" onClick={onRemove} className="text-red-500 h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
    );
}
