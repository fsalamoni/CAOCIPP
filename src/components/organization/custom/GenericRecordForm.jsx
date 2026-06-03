import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import GenericFieldInput from './GenericFieldInput';
import { validateAllValues, emptyValueForType } from '@/lib/fieldTypes';
import { createRecord, updateRecord } from '@/services/customEntitiesService';

/**
 * Diálogo genérico para criar ou editar um registro.
 * props: open, onOpenChange, organizationId, entityType, record (edição), members
 */
export default function GenericRecordForm({
    open, onOpenChange, organizationId, entityType, record, members = [], onSaved,
}) {
    const isEdit = !!record;
    const fields = useMemo(
        () => (entityType?.fields || [])
            .filter((f) => f.form?.show !== false)
            .sort((a, b) => (a.form?.order ?? 0) - (b.form?.order ?? 0)),
        [entityType]
    );

    const buildInitial = () => {
        const init = {};
        for (const f of entityType?.fields || []) {
            if (isEdit && record?.values && record.values[f.key] !== undefined) {
                init[f.key] = record.values[f.key];
            } else if (f.default !== undefined) {
                init[f.key] = f.default;
            } else {
                init[f.key] = emptyValueForType(f.type);
            }
        }
        return init;
    };

    const [values, setValues] = useState(buildInitial);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setValues(buildInitial());
            setErrors({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, record?.id, entityType?.id]);

    const sections = entityType?.form_layout?.sections?.length
        ? entityType.form_layout.sections
        : null;

    const handleChange = (key, v) => {
        setValues((prev) => ({ ...prev, [key]: v }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const handleSubmit = async () => {
        const { ok, errors: errs } = validateAllValues(entityType.fields, values);
        if (!ok) {
            setErrors(errs);
            toast.error('Verifique os campos destacados.');
            return;
        }
        setSaving(true);
        try {
            if (isEdit) {
                await updateRecord({ organizationId, recordId: record.id, values });
                toast.success(`${entityType.label_singular} atualizado.`);
            } else {
                await createRecord(organizationId, entityType.id, values);
                toast.success(`${entityType.label_singular} criado.`);
            }
            onSaved?.();
            onOpenChange(false);
        } catch (e) {
            toast.error(e?.message || 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const renderField = (f) => (
        <GenericFieldInput
            key={f.key}
            field={f}
            value={values[f.key]}
            onChange={(v) => handleChange(f.key, v)}
            members={members}
            error={errors[f.key]}
        />
    );

    const fieldByKey = useMemo(
        () => Object.fromEntries((entityType?.fields || []).map((f) => [f.key, f])),
        [entityType]
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? `Editar ${entityType.label_singular}` : `Novo ${entityType.label_singular}`}
                    </DialogTitle>
                    <DialogDescription>
                        Preencha as informações abaixo.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="space-y-4 py-2">
                        {sections ? (
                            sections.map((sec, i) => (
                                <div key={i} className="space-y-3">
                                    {sec.title && (
                                        <h4 className="text-sm font-semibold text-foreground/80 border-b pb-1">
                                            {sec.title}
                                        </h4>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(sec.field_keys || [])
                                            .map((k) => fieldByKey[k])
                                            .filter((f) => f && f.form?.show !== false)
                                            .map(renderField)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {fields.map(renderField)}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEdit ? 'Salvar' : 'Criar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
