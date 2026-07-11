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
import { Loader2, UserCheck, FileText, FolderOpen, CheckCheck, Send } from 'lucide-react';
import { getProcessField } from '@/utils/processUtils';

/**
 * KanbanTransitionDialog — Modals for Kanban column transitions.
 *
 * Modes:
 *  - "assign"          : Pendente → Análise (Secretary/Decisor chooses an assessor)
 *  - "third_party"      : Análise → Aguarda retorno de terceiros (data da remessa + destinatário obrigatórios)
 *  - "review"          : Análise/Aguarda terceiros → Revisão (observations + network folder required)
 *  - "review_complete" : Revisão → Revisadas (confirm review completion date)
 *  - "archive"         : Revisadas → Concluído (simple confirmation)
 */
export default function KanbanTransitionDialog({
    open,
    onClose,
    mode, // "assign" | "third_party" | "review" | "review_complete" | "archive"
    process,
    assessors = [],
    defaultAssessor = '',
    thirdParties = [],
    onConfirm,
}) {
    const [selectedAssessor, setSelectedAssessor] = useState(defaultAssessor);
    const [observations, setObservations] = useState(() =>
        getProcessField(process, 'observations') || ''
    );
    const [networkFolder, setNetworkFolder] = useState(() =>
        getProcessField(process, 'network_folder') || ''
    );
    const [reviewReturnDate, setReviewReturnDate] = useState(() =>
        new Date().toISOString().split('T')[0]
    );
    const [reviewedDate, setReviewedDate] = useState(() =>
        new Date().toISOString().split('T')[0]
    );
    const [thirdPartyReferralDate, setThirdPartyReferralDate] = useState(() =>
        new Date().toISOString().split('T')[0]
    );
    const [thirdPartyRecipient, setThirdPartyRecipient] = useState(() =>
        getProcessField(process, 'third_party_recipient') || ''
    );
    const [saving, setSaving] = useState(false);

    const processNumber = getProcessField(process, 'process_number') || 'Processo';

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
            } else if (mode === 'third_party') {
                await onConfirm({
                    third_party_referral_date: thirdPartyReferralDate,
                    third_party_recipient: thirdPartyRecipient,
                });
            } else if (mode === 'review') {
                await onConfirm({
                    observations: observations.trim(),
                    network_folder: networkFolder.trim(),
                });
            } else if (mode === 'review_complete') {
                await onConfirm({
                    reviewed_date: reviewedDate
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
        setObservations(getProcessField(process, 'observations') || '');
        setNetworkFolder(getProcessField(process, 'network_folder') || '');
        setReviewReturnDate(new Date().toISOString().split('T')[0]);
        setReviewedDate(new Date().toISOString().split('T')[0]);
        setThirdPartyReferralDate(new Date().toISOString().split('T')[0]);
        setThirdPartyRecipient(getProcessField(process, 'third_party_recipient') || '');
        setSaving(false);
        onClose();
    };

    const isValid = () => {
        if (mode === 'assign') return !!selectedAssessor;
        if (mode === 'third_party') return !!thirdPartyReferralDate && !!thirdPartyRecipient;
        if (mode === 'review') return observations.trim().length > 0 && networkFolder.trim().length > 0;
        if (mode === 'review_complete') return !!reviewedDate;
        if (mode === 'archive') return !!reviewReturnDate;
        return true;
    };

    const titles = {
        assign: 'Atribuir Responsável',
        third_party: 'Remeter a Terceiros',
        review: 'Enviar para Revisão',
        review_complete: 'Concluir Revisão',
        archive: 'Arquivar Processo',
    };

    const descriptions = {
        assign: `Escolha o assessor responsável pelo processo ${processNumber}.`,
        third_party: `Preencha os campos obrigatórios para remeter ${processNumber} a terceiros.`,
        review: `Preencha os campos obrigatórios para enviar ${processNumber} para revisão.`,
        review_complete: `Confirme a data em que o processo ${processNumber} foi revisado pelo responsável.`,
        archive: `Deseja realmente arquivar o processo ${processNumber}? Esta ação marca o processo como "Na pasta".`,
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'assign' && <UserCheck className="w-5 h-5 text-indigo-600" />}
                        {mode === 'third_party' && <Send className="w-5 h-5 text-cyan-600" />}
                        {mode === 'review' && <FileText className="w-5 h-5 text-blue-600" />}
                        {mode === 'review_complete' && <CheckCheck className="w-5 h-5 text-violet-600" />}
                        {mode === 'archive' && <FolderOpen className="w-5 h-5 text-green-600" />}
                        {titles[mode]}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
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
                                                    <AvatarFallback className="text-[10px] bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-100">
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

                    {/* MODE: Third Party (Referral date + Recipient) */}
                    {mode === 'third_party' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="third-party-referral-date">
                                    Data da Remessa <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="third-party-referral-date"
                                    type="date"
                                    value={thirdPartyReferralDate}
                                    onChange={(e) => setThirdPartyReferralDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="third-party-recipient">
                                    Remetido para <span className="text-rose-500">*</span>
                                </Label>
                                <Select value={thirdPartyRecipient} onValueChange={setThirdPartyRecipient}>
                                    <SelectTrigger id="third-party-recipient" className="w-full">
                                        <SelectValue placeholder="Selecione o destinatário..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {thirdParties.map(name => (
                                            <SelectItem key={name} value={name}>{name}</SelectItem>
                                        ))}
                                        {thirdPartyRecipient && !thirdParties.includes(thirdPartyRecipient) && (
                                            <SelectItem value={thirdPartyRecipient}>{thirdPartyRecipient} (Histórico)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                {thirdParties.length === 0 && (
                                    <p className="text-xs text-rose-500 mt-1">
                                        Nenhum terceiro cadastrado neste órgão. Configure em Painel Administrativo → Padronização.
                                    </p>
                                )}
                            </div>
                        </>
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

                    {/* MODE: Review Complete (Confirm reviewed date) */}
                    {mode === 'review_complete' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-violet-50 dark:bg-violet-900 rounded-lg border border-violet-200 dark:border-violet-600">
                                <p className="text-sm text-violet-800 dark:text-violet-100">
                                    O processo será marcado como <strong>"Revisadas"</strong>.
                                    Confirme a data em que a revisão foi concluída pelo responsável.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reviewed-date">Revisão Concluída</Label>
                                <Input
                                    id="reviewed-date"
                                    type="date"
                                    value={reviewedDate}
                                    onChange={(e) => setReviewedDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* MODE: Archive (Confirmation) */}
                    {mode === 'archive' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-600">
                                <p className="text-sm text-green-800 dark:text-green-100">
                                    O processo será marcado como <strong>"Na pasta"</strong>.
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
                                : mode === 'review_complete'
                                    ? 'bg-violet-600 hover:bg-violet-700'
                                    : mode === 'third_party'
                                        ? 'bg-cyan-600 hover:bg-cyan-700'
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
