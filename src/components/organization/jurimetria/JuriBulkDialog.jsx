import React, { useMemo, useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { bulkUpdateJuris } from '@/services/jurimetriaService';
import { getJurimetriaFields } from '@/constants/jurimetria';

const NENHUM = '__nenhum__';

/**
 * Aplica a MESMA alteração a vários júris selecionados: atribuir um
 * responsável do órgão, padronizar comarca/matéria/espécie/promotor ou
 * preencher uma coluna personalizada.
 *
 * Só os campos marcados são enviados — os demais permanecem intactos em cada
 * registro, e cada júri recebe sua própria entrada de histórico.
 */
export default function JuriBulkDialog({
    open, onOpenChange, organization, settings, members = [], selectedIds = [], onDone,
}) {
    const fields = useMemo(() => getJurimetriaFields(settings), [settings]);
    const customFields = useMemo(() => fields.filter((f) => f.custom), [fields]);

    const [target, setTarget] = useState('responsible_user_id');
    const [value, setValue] = useState('');
    const [valueName, setValueName] = useState('');
    const [boolValue, setBoolValue] = useState(false);
    const [saving, setSaving] = useState(false);

    const activeMembers = useMemo(() => members.filter((m) => m.active !== false), [members]);
    const customField = customFields.find((f) => f.key === target);

    const reset = () => {
        setValue('');
        setValueName('');
        setBoolValue(false);
    };

    const handleTargetChange = (next) => {
        setTarget(next);
        reset();
    };

    const handleSubmit = async () => {
        if (selectedIds.length === 0) return;

        const data = {};
        if (target === 'responsible_user_id') {
            data.responsible_user_id = value === NENHUM ? '' : value;
            data.responsible_user_name = value === NENHUM ? '' : valueName;
        } else if (customField) {
            data.values = {
                [customField.key]: customField.type === 'boolean' ? boolValue : value,
            };
        } else {
            data[target] = value === NENHUM ? '' : value;
        }

        setSaving(true);
        try {
            const result = await bulkUpdateJuris(organization.id, selectedIds, data);
            const updated = result?.updated ?? 0;
            toast.success(
                `${updated} júri(s) atualizado(s).`
                + (result?.skipped ? ` ${result.skipped} ignorado(s).` : '')
            );
            onOpenChange(false);
            reset();
            if (onDone) onDone();
        } catch (error) {
            logger.error('[jurimetria] erro na atualização em massa:', error);
            toast.error(error?.message || 'Não foi possível aplicar a alteração.');
        } finally {
            setSaving(false);
        }
    };

    const renderValueInput = () => {
        if (target === 'responsible_user_id') {
            return (
                <Select
                    value={value || ''}
                    onValueChange={(next) => {
                        setValue(next);
                        const member = activeMembers.find((m) => m.user_id === next);
                        setValueName(member?.user_name || member?.user_email || '');
                    }}
                >
                    <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NENHUM}>— remover responsável —</SelectItem>
                        {activeMembers.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                                {member.user_name || member.user_email}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (target === 'comarca') {
            return (
                <>
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        list="bulk-comarcas"
                        placeholder="Selecione ou digite a comarca"
                    />
                    <datalist id="bulk-comarcas">
                        {(settings?.comarcas || []).map((c) => <option key={c} value={c} />)}
                    </datalist>
                </>
            );
        }

        if (target === 'tipo') {
            return (
                <Select value={value} onValueChange={setValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a matéria" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NENHUM}>— limpar campo —</SelectItem>
                        {(settings?.tipos || []).map((t) => (
                            <SelectItem key={t.sigla} value={t.sigla}>{t.sigla} — {t.descricao}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (target === 'resultado') {
            return (
                <Select value={value} onValueChange={setValue}>
                    <SelectTrigger><SelectValue placeholder="Selecione a espécie" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NENHUM}>— limpar campo —</SelectItem>
                        {(settings?.resultados || []).map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }

        if (target === 'observacoes') {
            return (
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={3}
                    placeholder="O texto substitui a observação atual de todos os selecionados."
                />
            );
        }

        if (customField) {
            switch (customField.type) {
                case 'boolean':
                    return (
                        <div className="flex items-center gap-2 h-10">
                            <Switch checked={boolValue} onCheckedChange={setBoolValue} />
                            <span className="text-sm text-slate-500">{boolValue ? 'Sim' : 'Não'}</span>
                        </div>
                    );
                case 'date':
                    return <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} />;
                case 'number':
                    return <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />;
                case 'select':
                    return (
                        <Select value={value} onValueChange={setValue}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NENHUM}>— limpar campo —</SelectItem>
                                {(customField.options || []).map((option) => (
                                    <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    );
                default:
                    return <Input value={value} onChange={(e) => setValue(e.target.value)} />;
            }
        }

        return <Input value={value} onChange={(e) => setValue(e.target.value)} />;
    };

    const isBoolean = customField?.type === 'boolean';
    const canSubmit = selectedIds.length > 0 && (isBoolean || value !== '');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-indigo-500" />
                        Alterar em massa
                    </DialogTitle>
                    <DialogDescription>
                        A alteração será aplicada aos <strong>{selectedIds.length}</strong> júri(s) selecionado(s).
                        Nenhum outro campo é tocado.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label>Campo a alterar</Label>
                        <Select value={target} onValueChange={handleTargetChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="responsible_user_id">Responsável no órgão</SelectItem>
                                <SelectItem value="comarca">Comarca</SelectItem>
                                <SelectItem value="tipo">Matéria / Tipo de júri</SelectItem>
                                <SelectItem value="resultado">Espécie de resultado</SelectItem>
                                <SelectItem value="promotor">Promotor(a)</SelectItem>
                                <SelectItem value="vara">Vara / Órgão julgador</SelectItem>
                                <SelectItem value="horario">Horário</SelectItem>
                                <SelectItem value="observacoes">Observações</SelectItem>
                                {customFields.map((field) => (
                                    <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Novo valor</Label>
                        {renderValueInput()}
                    </div>

                    {target === 'resultado' && (
                        <Alert>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-xs">
                                Alterar a espécie muda o aproveitamento calculado nos relatórios, porque cada espécie
                                tem um peso próprio na tabela de pontuação do órgão.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit || saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        Aplicar a {selectedIds.length} júri(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
