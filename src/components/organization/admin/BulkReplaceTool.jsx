import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Replace } from 'lucide-react';
import { bulkReplaceFieldValues } from '@/services/functionsService';
import { formatPersonName } from '@/utils/nameUtils';

const FIELD_OPTIONS = [
    { value: 'responsible_user_name', label: 'Assessor responsável' },
    { value: 'consultant', label: 'Consulente (consultas)' },
    { value: 'location', label: 'Local dos fatos (consultas)' },
    { value: 'origin', label: 'Origem (expedientes)' },
    { value: 'object', label: 'Objeto (expedientes)' },
];

const TARGET_OPTIONS = [
    { value: 'processes', label: 'Consultas' },
    { value: 'expedientes', label: 'Expedientes' },
];

export default function BulkReplaceTool({ organization }) {
    const [field, setField] = useState('responsible_user_name');
    const [fromValue, setFromValue] = useState('');
    const [toValue, setToValue] = useState('');
    const [targets, setTargets] = useState(['processes', 'expedientes']);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const normalizedPreview = useMemo(() => {
        if (!toValue.trim()) return '';
        return field === 'responsible_user_name'
            ? formatPersonName(toValue)
            : toValue.trim().replace(/\s+/g, ' ');
    }, [field, toValue]);

    const toggleTarget = (value) => {
        setTargets(prev => (
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        ));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fromValue.trim() || !toValue.trim()) {
            toast.error('Preencha os campos "valor atual" e "novo valor".');
            return;
        }
        if (targets.length === 0) {
            toast.error('Selecione pelo menos um conjunto de dados.');
            return;
        }
        if (!window.confirm(`Confirmar substituição em bloco no órgão "${organization.name}"?`)) {
            return;
        }

        try {
            setIsSubmitting(true);
            const result = await bulkReplaceFieldValues({
                organizationId: organization.id,
                field,
                fromValue,
                toValue,
                targetCollections: targets,
            });

            toast.success(result?.message || 'Substituição realizada com sucesso.');
            setFromValue('');
            setToValue('');
        } catch (error) {
            toast.error(`Erro ao substituir em bloco: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Padronização em Bloco</CardTitle>
                <CardDescription>
                    Substitua valores em consultas e expedientes para unificar nomes e padrões.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="bulk-field">Campo</Label>
                        <select
                            id="bulk-field"
                            value={field}
                            onChange={(e) => setField(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                        >
                            {FIELD_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label>Escopo da varredura</Label>
                        <div className="flex flex-wrap gap-4">
                            {TARGET_OPTIONS.map(option => (
                                <label key={option.value} className="inline-flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={targets.includes(option.value)}
                                        onChange={() => toggleTarget(option.value)}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bulk-from">Valor atual</Label>
                            <Input
                                id="bulk-from"
                                value={fromValue}
                                onChange={(e) => setFromValue(e.target.value)}
                                placeholder="Ex: Francini Lazzari"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bulk-to">Novo valor</Label>
                            <Input
                                id="bulk-to"
                                value={toValue}
                                onChange={(e) => setToValue(e.target.value)}
                                placeholder="Ex: Francini Meneghini Lazzari"
                            />
                        </div>
                    </div>

                    {normalizedPreview && (
                        <p className="text-xs text-slate-500">
                            Valor que será aplicado: <strong>{normalizedPreview}</strong>
                        </p>
                    )}

                    <Button type="submit" disabled={isSubmitting} className="gap-2">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
                        Aplicar Substituição
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

