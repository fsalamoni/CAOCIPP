import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import GenericFieldInput from './GenericFieldInput';
import { emptyValueForType } from '@/lib/fieldTypes';
import { resolveFormGroups, validatePhaseAwareValues } from '@/lib/customEntityForm';
import { createRecord, updateRecord } from '@/services/customEntitiesService';

/**
 * Diálogo genérico para criar ou editar um registro.
 *
 * Quando o tipo possui colunas atribuídas a fases (ou form_mode = 'tabs'), o
 * formulário é renderizado com UMA ABA POR FASE — cada coluna aparece na aba da
 * sua fase. Caso contrário, mantém o comportamento legado (seções ou lista).
 *
 * props: open, onOpenChange, organizationId, entityType, record (edição), members
 */
export default function GenericRecordForm({
    open, onOpenChange, organizationId, entityType, record, members = [], onSaved,
}) {
    const isEdit = !!record;

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

    // Agrupa os campos em abas-por-fase / seções / lista única.
    const groups = useMemo(() => resolveFormGroups(entityType), [entityType]);
    const useTabs = groups.mode === 'tabs';
    const [activeTab, setActiveTab] = useState(groups.tabs[0]?.key || '');

    useEffect(() => {
        if (open) {
            setValues(buildInitial());
            setErrors({});
            setActiveTab(groups.tabs[0]?.key || '');
        }
    }, [open, record?.id, entityType?.id]);

    const handleChange = (key, v) => {
        setValues((prev) => ({ ...prev, [key]: v }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
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

    const handleSubmit = () => {
        const { ok, errors: errs } = validatePhaseAwareValues(entityType, values, record);
        if (!ok) {
            setErrors(errs);
            // Em modo abas, pula para a primeira aba que contém um erro.
            if (useTabs) {
                const tabWithError = groups.tabs.find((t) => t.fields.some((f) => errs[f.key]));
                if (tabWithError) setActiveTab(tabWithError.key);
            }
            toast.error('Verifique os campos destacados.');
            return;
        }
        // UI otimista: fecha imediatamente e grava em segundo plano.
        const editing = isEdit;
        const recordId = record?.id;
        const payloadValues = values;
        onOpenChange(false);
        const action = editing
            ? updateRecord({ organizationId, recordId, values: payloadValues })
            : createRecord(organizationId, entityType.id, payloadValues);
        toast.promise(action, {
            loading: editing
                ? `Salvando ${entityType.label_singular}...`
                : `Criando ${entityType.label_singular}...`,
            success: () => {
                onSaved?.();
                return editing
                    ? `${entityType.label_singular} atualizado.`
                    : `${entityType.label_singular} criado.`;
            },
            error: (e) => e?.message || 'Erro ao salvar.',
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? `Editar ${entityType.label_singular}` : `Novo ${entityType.label_singular}`}
                    </DialogTitle>
                    <DialogDescription>
                        {useTabs
                            ? 'Preencha as informações de cada fase nas abas abaixo.'
                            : 'Preencha as informações abaixo.'}
                    </DialogDescription>
                </DialogHeader>

                {useTabs ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
                            {groups.tabs.map((t) => {
                                const hasError = t.fields.some((f) => errors[f.key]);
                                return (
                                    <TabsTrigger key={t.key} value={t.key} className="relative data-[state=active]:font-semibold">
                                        {t.color && (
                                            <span className="mr-1.5 h-2 w-2 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                                        )}
                                        {t.label}
                                        {hasError && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>

                        <ScrollArea className="flex-1 -mx-2 px-2 mt-3">
                            {groups.tabs.map((t) => (
                                <TabsContent key={t.key} value={t.key} className="mt-0 space-y-3">
                                    {t.description && (
                                        <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2">{t.description}</p>
                                    )}
                                    {t.fields.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-4">Nenhuma informação nesta fase.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                                            {t.fields.map(renderField)}
                                        </div>
                                    )}
                                </TabsContent>
                            ))}
                        </ScrollArea>
                    </Tabs>
                ) : (
                    <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="space-y-4 py-2">
                            {groups.mode === 'sections' ? (
                                groups.sections.map((sec, i) => (
                                    <div key={i} className="space-y-3">
                                        {sec.title && (
                                            <h4 className="text-sm font-semibold text-foreground/80 border-b pb-1">
                                                {sec.title}
                                            </h4>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {sec.fields.map(renderField)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {groups.fields.map(renderField)}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>
                        {isEdit ? 'Salvar' : 'Criar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
