import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserCheck, FileText, FolderOpen } from 'lucide-react';
import { getExpedienteField } from '@/utils/expedienteUtils';

/**
 * ExpedienteKanbanTransitionDialog — Modals for Kanban column transitions for Expedientes.
 *
 * Modes:
 *  - "assign"   : Pendente → Análise (Secretary/Decisor chooses an assessor)
 *  - "review"   : Análise → Revisão (observations + network folder required)
 *  - "archive"  : Revisão → Concluído (simple confirmation)
 */
export default function ExpedienteKanbanTransitionDialog({
    open,
    onClose,
    mode, // "assign" | "review" | "archive"
    expediente,
    assessors = [],
    defaultAssessor = '',
    onConfirm,
}) {
    const [selectedAssessor, setSelectedAssessor] = useState(defaultAssessor);
    const [observations, setObservations] = useState(() =>
        getExpedienteField(expediente, 'observations') || ''
    );
    const [networkFolder, setNetworkFolder] = useState(() =>
        getExpedienteField(expediente, 'network_folder') || ''
    );
    const [reviewReturnDate, setReviewReturnDate] = useState(() =>
        new Date().toISOString().split('T')[0]
    );
    const [saving, setSaving] = useState(false);

    const expedienteNumber = getExpedienteField(expediente, 'expediente_number') || 'Expediente';

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            if (mode === 'assign') {
                const member = assessors.find(m => m.user_id === selectedAssessor);
                await onConfirm({
                    responsible_user_id: selectedAssessor,
                    responsible_user_name: member?.user_name || '',
                });
            } else if (mode === 'review') {
                await onConfirm({
                    observations: observations.trim(),
                    network_folder: networkFolder.trim(),
                });
            } else if (mode === 'archive') {
                await onConfirm({
                    review_return_date: reviewReturnDate
                });
            }
            handleClose();
        } catch (err) {
            // Error handled by parent (toast)
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setSelectedAssessor('');
        setObservations(getExpedienteField(expediente, 'observations') || '');
        setNetworkFolder(getExpedienteField(expediente, 'network_folder') || '');
        setReviewReturnDate(new Date().toISOString().split('T')[0]);
        setSaving(false);
        onClose();
    };

    const isValid = () => {
        if (mode === 'assign') return !!selectedAssessor;
        if (mode === 'review') return observations.trim().length > 0 && networkFolder.trim().length > 0;
        if (mode === 'archive') return !!reviewReturnDate;
        return true;
    };

    const titles = {
        assign: 'Atribuir Responsável',
        review: 'Enviar para Revisão',
        archive: 'Arquivar Expediente',
    };

    const descriptions = {
        assign: `Escolha o assessor responsável pelo expediente ${expedienteNumber}.`,
        review: `Preencha os campos obrigatórios para enviar ${expedienteNumber} para revisão.`,
        archive: `Deseja realmente arquivar o expediente ${expedienteNumber}? Esta ação marca o expediente como "Na pasta".`,
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'assign' && <UserCheck className="w-5 h-5 text-indigo-600" />}
                        {mode === 'review' && <FileText className="w-5 h-5 text-blue-600" />}
                        {mode === 'archive' && <FolderOpen className="w-5 h-5 text-green-600" />}
                        {titles[mode]}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        {descriptions[mode]}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* MODE: Assign Assessor */}
                    {mode === 'assign' && (
                        <div className="space-y-2">
                            <Label htmlFor="assessor-select">Assessor Responsável</Label>
                            <Select value={selectedAssessor} onValueChange={setSelectedAssessor}>
                                <SelectTrigger id="assessor-select" className="w-full">
                                    <SelectValue placeholder="Selecione o assessor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assessors.map(member => (
                                        <SelectItem key={member.user_id} value={member.user_id}>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                                                        {getInitials(member.user_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span>{member.user_name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {assessors.length === 0 && (
                                <p className="text-xs text-rose-500 mt-1">
                                    Nenhum assessor encontrado neste órgão. Verifique as funções dos membros.
                                </p>
                            )}
                        </div>
                    )}

                    {/* MODE: Review (Observations + Network Folder) */}
                    {mode === 'review' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="observations">
                                    Observações <span className="text-rose-500">*</span>
                                </Label>
                                <Textarea
                                    id="observations"
                                    placeholder="Descreva as observações sobre a análise realizada..."
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="network-folder">
                                    Pasta na Rede <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="network-folder"
                                    placeholder="Ex: \\\\servidor\\pastas\\processo-123"
                                    value={networkFolder}
                                    onChange={(e) => setNetworkFolder(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {/* MODE: Archive (Confirmation) */}
                    {mode === 'archive' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-sm text-green-800">
                                    O expediente será marcado como <strong>"Na pasta"</strong>.
                                    Por favor, confirme a data de devolução.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="return-date">Data de Devolução</Label>
                                <Input
                                    id="return-date"
                                    type="date"
                                    value={reviewReturnDate}
                                    onChange={(e) => setReviewReturnDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid() || saving}
                        className={
                            mode === 'archive'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            mode === 'archive' ? 'Arquivar' : 'Confirmar'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
