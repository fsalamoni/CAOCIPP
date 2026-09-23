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
import { Badge } from '@/components/ui/badge';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { createPanoramaRegistro, updatePanoramaRegistro } from '@/services/panoramaService';
import { roleMeta, columnForRole } from '@/constants/panorama';

const NENHUM = '__nenhum__';

/**
 * Cadastro e edição de um registro.
 *
 * O formulário é GERADO a partir das colunas da base: cada coluna vira o
 * controle adequado ao seu tipo, e as que ocupam um papel aparecem primeiro,
 * porque são as que alimentam a análise. Nenhum campo é conhecido pelo código.
 */
export default function PanoramaFormDialog({
    open, onOpenChange, organization, base, registro, onSaved,
}) {
    const isEdit = Boolean(registro?.id);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);

    const colunas = useMemo(
        () => [...(base?.columns || [])].sort((a, b) => {
            // Colunas com papel primeiro: são as que a análise usa.
            if (Boolean(a.role) !== Boolean(b.role)) return a.role ? -1 : 1;
            return a.ordem - b.ordem;
        }),
        [base]
    );

    useEffect(() => {
        if (!open) return;
        const inicial = {};
        for (const col of colunas) {
            const valor = registro?.values?.[col.key];
            inicial[col.key] = valor === null || valor === undefined
                ? (col.type === 'booleano' ? false : '')
                : valor;
        }
        setForm(inicial);
    }, [open, registro, colunas]);

    const set = (key, valor) => setForm((prev) => ({ ...prev, [key]: valor }));

    const colId = columnForRole(base, 'identificador');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (colId && !String(form[colId.key] ?? '').trim()) {
            toast.error(`Informe o ${colId.label.toLowerCase()} — é o identificador desta base.`);
            return;
        }

        setSaving(true);
        try {
            // Só os campos preenchidos sobem; o servidor mescla o resto.
            const values = {};
            for (const col of colunas) {
                const v = form[col.key];
                values[col.key] = typeof v === 'string' ? v.trim() : v;
            }

            if (isEdit) {
                await updatePanoramaRegistro({
                    organizationId: organization.id, baseId: base.id, id: registro.id, values,
                });
                toast.success('Registro atualizado.');
            } else {
                await createPanoramaRegistro({
                    organizationId: organization.id, baseId: base.id, values,
                });
                toast.success('Registro cadastrado.');
            }
            onSaved?.();
            onOpenChange(false);
        } catch (error) {
            logger.error('[panorama] erro ao salvar registro:', error);
            toast.error(error?.message || 'Não foi possível salvar.');
        } finally {
            setSaving(false);
        }
    };

    const renderCampo = (col) => {
        const valor = form[col.key];
        switch (col.type) {
            case 'data':
                return (
                    <Input
                        type="date"
                        value={valor || ''}
                        onChange={(e) => set(col.key, e.target.value)}
                    />
                );
            case 'numero':
            case 'moeda':
                return (
                    <Input
                        type="number"
                        step={col.type === 'moeda' ? '0.01' : '1'}
                        value={valor ?? ''}
                        onChange={(e) => set(col.key, e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={col.type === 'moeda' ? '0,00' : '0'}
                    />
                );
            case 'booleano':
                return (
                    <div className="h-9 flex items-center">
                        <Switch
                            checked={valor === true}
                            onCheckedChange={(v) => set(col.key, v)}
                        />
                        <span className="ml-2 text-sm text-slate-500">{valor === true ? 'Sim' : 'Não'}</span>
                    </div>
                );
            case 'lista': {
                const opcoes = col.lista || [];
                if (opcoes.length === 0) {
                    return <Input value={valor || ''} onChange={(e) => set(col.key, e.target.value)} />;
                }
                // Um valor gravado que saiu da lista entra como opção extra: sem
                // isso, abrir a ficha para editar outro campo apagaria este.
                const extras = valor && !opcoes.includes(valor) ? [valor] : [];
                return (
                    <Select
                        value={valor || NENHUM}
                        onValueChange={(v) => set(col.key, v === NENHUM ? '' : v)}
                    >
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NENHUM}>— não informado —</SelectItem>
                            {[...opcoes, ...extras].map((o) => (
                                <SelectItem key={o} value={o}>
                                    {o}{extras.includes(o) ? ' (fora da lista atual)' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }
            default:
                return String(valor || '').length > 80 ? (
                    <Textarea
                        value={valor || ''}
                        onChange={(e) => set(col.key, e.target.value)}
                        rows={3}
                    />
                ) : (
                    <Input value={valor || ''} onChange={(e) => set(col.key, e.target.value)} />
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 gap-0">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle>{isEdit ? 'Editar registro' : 'Novo registro'}</DialogTitle>
                        <DialogDescription>
                            {base?.nome} — os campos são os desta base.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[65vh]">
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {colunas.map((col) => {
                                    const meta = col.role ? roleMeta(col.role) : null;
                                    const largo = col.type === 'texto' && String(form[col.key] || '').length > 80;
                                    return (
                                        <div
                                            key={col.key}
                                            className={`space-y-1.5 ${largo ? 'sm:col-span-2' : ''}`}
                                        >
                                            <Label htmlFor={`pan-${col.key}`} className="flex items-center gap-1.5">
                                                {col.label}
                                                {col.role === 'identificador' && ' *'}
                                                {meta && (
                                                    <Badge variant="outline" className="text-[10px] font-normal">
                                                        {meta.label}
                                                    </Badge>
                                                )}
                                            </Label>
                                            {renderCampo(col)}
                                        </div>
                                    );
                                })}
                            </div>

                            {colunas.length === 0 && (
                                <p className="text-sm text-slate-400 py-8 text-center">
                                    Esta base ainda não tem colunas. Importe uma planilha para criá-las.
                                </p>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving || colunas.length === 0} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar alterações' : 'Cadastrar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
