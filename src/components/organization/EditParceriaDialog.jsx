import React, { useState, useEffect } from 'react';
import { updateParceria, updateAditivo, deleteAditivo } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { hasAdditives } from '@/utils/parceriaUtils';

// Defaults alinhados com o backend (sanitizeParceriaSettings em
// functions-v2/src/organizations/update.ts). Usados apenas se o órgão não
// tiver parceriaSettings persistido.
const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_ADITIVO_TIPOS = [
    'Aditivo de Prazo',
    'Aditivo de Valor',
    'Aditivo de Alteração',
    'Aditivo de Reequilíbrio',
    'Aditivo de Execução',
];
const DEFAULT_VIGENCIA_OPTIONS = [
    '6 meses', '12 meses', '24 meses', '36 meses', '60 meses', 'Indeterminado',
];
const DEFAULT_THIRD_PARTIES = ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

export default function EditParceriaDialog({
    open,
    setOpen,
    parceria,
    members = [],
    organizationId,
    organization,
    userRole,
    isAdditive = false,
    additiveData = null,
    onSuccess,
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({});
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        if (!open) return;
        const source = isAdditive && additiveData ? additiveData : parceria;
        if (!source) return;
        setFormData({
            pgea: source.pgea || '',
            subject: source.subject || '',
            object: source.object || '',
            parties: source.parties || '',
            partnership_type: source.partnership_type || '',
            partnership_number: source.partnership_number || '',
            categoria: source.categoria || '',
            signature_date: source.signature_date || '',
            validity_period: source.validity_period || '',
            end_date: source.end_date || '',
            renewal_notice_date: source.renewal_notice_date || '',
            responsible_user_id: source.responsible_user_id || '',
            responsible_user_name: source.responsible_user_name || '',
            responsibility_date: source.responsibility_date || '',
            network_folder: source.network_folder || '',
            observations: source.observations || '',
            review_conclusion_date: source.review_conclusion_date || '',
            third_party: source.third_party || '',
            pgea_date: source.pgea_date || '',
            // Campos de aditivo (só usados quando isAdditive === true).
            aditivo_type: source.aditivo_type || '',
            aditivo_number: source.aditivo_number || '',
        });
        // Se a Parceria original tem aditivos, os campos do original ficam
        // read-only (lock). Para o aditivo em si, nunca há lock.
        if (!isAdditive && hasAdditives(parceria)) {
            setIsLocked(true);
        } else {
            setIsLocked(false);
        }
    }, [open, isAdditive, additiveData, parceria]);

    const isCreator = userRole === 'creator';
    const hasDeletePerm = userRole === 'creator' || isCreator;

    // Configurações do módulo vindas do banco do órgão (com defaults
    // alinhados com sanitizeParceriaSettings do backend).
    const tipos = organization?.parceriaSettings?.tipos?.length
        ? organization.parceriaSettings.tipos
        : DEFAULT_TIPOS;
    const aditivoTipos = organization?.parceriaSettings?.aditivoTipos?.length
        ? organization.parceriaSettings.aditivoTipos
        : DEFAULT_ADITIVO_TIPOS;
    const vigenciaOptions = organization?.parceriaSettings?.vigenciaOptions?.length
        ? organization.parceriaSettings.vigenciaOptions
        : DEFAULT_VIGENCIA_OPTIONS;
    const categorias = organization?.parceriaSettings?.categorias || [];
    const thirdParties = organization?.thirdPartiesSettingsParcerias?.length
        ? organization.thirdPartiesSettingsParcerias
        : DEFAULT_THIRD_PARTIES;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSaving(true);
            const changes = { ...formData };
            // Limpar campos vazios para null (exceto strings "")
            for (const k of Object.keys(changes)) {
                if (changes[k] === '') changes[k] = null;
            }
            // responsible_user_name baseado no member selecionado
            if (changes.responsible_user_id) {
                const m = members.find((mm) => mm.user_id === changes.responsible_user_id);
                if (m) changes.responsible_user_name = m.user_name;
            }
            // Remover campos que pertencem só ao aditivo, se estiver editando original
            // (mantém pgea, pgea_date, etc do original mesmo locked)
            if (!isAdditive && hasAdditives(parceria)) {
                // Se estiver locked, o servidor vai rejeitar — não envia nada
                toast.error('Esta Parceria possui aditivos. Edite o aditivo corrente.');
                return;
            }

            if (isAdditive) {
                await updateAditivo({
                    parceriaId: parceria.id,
                    aditivoId: additiveData.id,
                    organizationId,
                    changes,
                });
            } else {
                await updateParceria({
                    id: parceria.id,
                    organizationId,
                    changes,
                });
            }
            toast.success(isAdditive ? 'Aditivo atualizado!' : 'Parceria atualizada!');
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            logger.error('Error saving parceria/aditivo:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        const isAditivoDelete = isAdditive;
        const msg = isAditivoDelete
            ? `Excluir o Aditivo #${additiveData?.aditivo_number}? Esta ação é irreversível.`
            : `Excluir a Parceria ${parceria.pgea}? Esta ação apaga também todos os aditivos.`;
        if (!window.confirm(msg)) return;
        try {
            setIsSaving(true);
            if (isAditivoDelete) {
                await deleteAditivo({
                    parceriaId: parceria.id,
                    aditivoId: additiveData.id,
                    organizationId,
                });
                toast.success('Aditivo excluído!');
            } else {
                const { deleteParceria } = await import('@/services/functionsService');
                await deleteParceria({ id: parceria.id, organizationId });
                toast.success('Parceria excluída!');
            }
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            logger.error('Error deleting:', error);
            toast.error('Erro ao excluir: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!parceria) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isAdditive
                            ? `Editar Aditivo #${additiveData?.aditivo_number} (${additiveData?.aditivo_type_label})`
                            : `Editar Parceria ${parceria.pgea}`}
                        {isLocked && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                <Lock className="w-3 h-3" />
                                Bloqueado (possui {parceria.aditivo_count} aditivo{parceria.aditivo_count > 1 ? 's' : ''})
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    {!isAdditive && (
                        <>
                            <div>
                                <Label>PGEA</Label>
                                <Input value={formData.pgea || ''} disabled className="mt-1 bg-slate-50" />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Assunto</Label>
                                    <Input value={formData.subject || ''} disabled={isLocked} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="mt-1" />
                                </div>
                                <div>
                                    <Label>Partes</Label>
                                    <Input value={formData.parties || ''} disabled={isLocked} onChange={(e) => setFormData({ ...formData, parties: e.target.value })} className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <Label>Objeto</Label>
                                <Textarea value={formData.object || ''} disabled={isLocked} onChange={(e) => setFormData({ ...formData, object: e.target.value })} rows={3} className="mt-1" />
                            </div>
                        </>
                    )}

                    {isAdditive && (
                        <>
                            <div>
                                <Label>Assunto</Label>
                                <Input value={formData.subject || ''} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="mt-1" />
                            </div>
                            <div>
                                <Label>Partes</Label>
                                <Input value={formData.parties || ''} onChange={(e) => setFormData({ ...formData, parties: e.target.value })} className="mt-1" />
                            </div>
                            <div>
                                <Label>Objeto</Label>
                                <Textarea value={formData.object || ''} onChange={(e) => setFormData({ ...formData, object: e.target.value })} rows={3} className="mt-1" />
                            </div>
                        </>
                    )}

                    <hr className="my-2 border-slate-200" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dados de formalização (fase "Parcerias")</p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de Parceria</Label>
                            <Select
                                value={formData.partnership_type || 'none'}
                                onValueChange={(val) => setFormData({ ...formData, partnership_type: val === 'none' ? null : val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {tipos.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Número da Parceria</Label>
                            <Input value={formData.partnership_number || ''} onChange={(e) => setFormData({ ...formData, partnership_number: e.target.value })} placeholder="Ex.: 001/2024" className="mt-1" />
                        </div>
                    </div>
                    {categorias.length > 0 && (
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Categoria</Label>
                                <Select
                                    value={formData.categoria || 'none'}
                                    onValueChange={(val) => setFormData({ ...formData, categoria: val === 'none' ? null : val })}
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">—</SelectItem>
                                        {categorias.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Data da Assinatura</Label>
                            <Input type="date" value={formData.signature_date || ''} onChange={(e) => setFormData({ ...formData, signature_date: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <Label>Vigência</Label>
                            <Input
                                list="vigencia-options"
                                value={formData.validity_period || ''}
                                onChange={(e) => setFormData({ ...formData, validity_period: e.target.value })}
                                placeholder="Ex.: 12 meses"
                                className="mt-1"
                            />
                            <datalist id="vigencia-options">
                                {vigenciaOptions.map((v) => <option key={v} value={v} />)}
                            </datalist>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Termo Final</Label>
                            <Input type="date" value={formData.end_date || ''} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <Label>Data do Aviso de Renovação</Label>
                            <Input type="date" value={formData.renewal_notice_date || ''} onChange={(e) => setFormData({ ...formData, renewal_notice_date: e.target.value })} className="mt-1" />
                        </div>
                    </div>

                    <hr className="my-2 border-slate-200" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsável e revisão</p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Assessor Responsável</Label>
                            <Select
                                value={formData.responsible_user_id || 'none'}
                                onValueChange={(val) => {
                                    const m = members.find((mm) => mm.user_id === val);
                                    setFormData({
                                        ...formData,
                                        responsible_user_id: val === 'none' ? null : val,
                                        responsible_user_name: m ? m.user_name : '',
                                    });
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {members.map((m) => (
                                        <SelectItem key={m.user_id} value={m.user_id}>
                                            {m.user_name} {m.function ? `(${m.function})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Data de Responsabilidade</Label>
                            <Input type="date" value={formData.responsibility_date || ''} onChange={(e) => setFormData({ ...formData, responsibility_date: e.target.value })} className="mt-1" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Pasta na Rede</Label>
                            <Input value={formData.network_folder || ''} onChange={(e) => setFormData({ ...formData, network_folder: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <Label>Data de Conclusão da Revisão</Label>
                            <Input type="date" value={formData.review_conclusion_date || ''} onChange={(e) => setFormData({ ...formData, review_conclusion_date: e.target.value })} className="mt-1" />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Terceiro</Label>
                            <Select
                                value={formData.third_party || 'none'}
                                onValueChange={(val) => setFormData({ ...formData, third_party: val === 'none' ? null : val })}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {thirdParties.map((tp) => (
                                        <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Observações</Label>
                        <Textarea value={formData.observations || ''} onChange={(e) => setFormData({ ...formData, observations: e.target.value })} rows={3} className="mt-1" />
                    </div>

                    {hasDeletePerm && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir {isAdditive ? 'Aditivo' : 'Parceria'}
                            </Button>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSaving || isLocked}>
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Salvar
                                </Button>
                            </div>
                        </div>
                    )}
                    {!hasDeletePerm && (
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSaving || isLocked}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Salvar
                            </Button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
