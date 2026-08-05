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
import { Loader2, UserCheck, Eye, Send, Handshake } from 'lucide-react';

/**
 * ParceriaKanbanTransitionDialog — modal de transição entre fases.
 *
 * Modes (forward only):
 *  - "assign"            : Pendente → Em análise
 *  - "review"            : Em análise → Revisão
 *  - "third_party"       : Em análise/Revisão → Aguarda Terceiros
 *  - "formalize"         : Aguarda Terceiros → Parcerias
 *  - "extinguish"        : Parcerias → Extintos (handled by ExtinguishConfirmDialog;
 *                          este modo fica apenas como fallback futuro)
 */
export default function ParceriaKanbanTransitionDialog({
    open,
    onClose,
    mode,
    parceria,
    assessors = [],
    defaultAssessor = '',
    thirdParties = [],
    onConfirm,
}) {
    const [selectedAssessor, setSelectedAssessor] = useState(defaultAssessor);
    const [observations, setObservations] = useState('');
    const [networkFolder, setNetworkFolder] = useState('');
    const [reviewConclusaoDate, setReviewConclusaoDate] = useState(new Date().toISOString().split('T')[0]);
    const [thirdParty, setThirdParty] = useState('');
    const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0]);
    const [partnershipType, setPartnershipType] = useState('');
    const [partnershipNumber, setPartnershipNumber] = useState('');
    const [validityPeriod, setValidityPeriod] = useState('');
    const [endDate, setEndDate] = useState('');
    const [renewalNoticeDate, setRenewalNoticeDate] = useState('');
    const [saving, setSaving] = useState(false);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const handleConfirm = async () => {
        setSaving(true);
        try {
            if (mode === 'assign') {
                const m = assessors.find((a) => a.user_id === selectedAssessor);
                await onConfirm({
                    responsible_user_id: selectedAssessor,
                    responsible_user_name: m?.user_name || '',
                    responsibility_date: new Date().toISOString().split('T')[0],
                });
            } else if (mode === 'review') {
                await onConfirm({
                    observations: observations.trim(),
                    network_folder: networkFolder.trim(),
                });
            } else if (mode === 'third_party') {
                await onConfirm({
                    review_conclusion_date: reviewConclusaoDate,
                    third_party: thirdParty,
                });
            } else if (mode === 'formalize') {
                await onConfirm({
                    partnership_type: partnershipType,
                    partnership_number: partnershipNumber.trim(),
                    signature_date: signatureDate,
                    validity_period: validityPeriod.trim(),
                    end_date: endDate,
                    renewal_notice_date: renewalNoticeDate,
                });
            }
            handleClose();
        } catch (err) {
            // error handled by parent
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setSelectedAssessor('');
        setObservations('');
        setNetworkFolder('');
        setReviewConclusaoDate(new Date().toISOString().split('T')[0]);
        setThirdParty('');
        setSignatureDate(new Date().toISOString().split('T')[0]);
        setPartnershipType('');
        setPartnershipNumber('');
        setValidityPeriod('');
        setEndDate('');
        setRenewalNoticeDate('');
        setSaving(false);
        onClose();
    };

    const isValid = () => {
        if (mode === 'assign') return !!selectedAssessor;
        if (mode === 'review') return observations.trim().length > 0 && networkFolder.trim().length > 0;
        if (mode === 'third_party') return !!reviewConclusaoDate && !!thirdParty;
        if (mode === 'formalize') {
            return (
                !!partnershipType &&
                partnershipNumber.trim().length > 0 &&
                !!signatureDate &&
                validityPeriod.trim().length > 0 &&
                !!endDate &&
                !!renewalNoticeDate
            );
        }
        return true;
    };

    const titles = {
        assign: 'Atribuir Responsável',
        review: 'Enviar para Revisão',
        third_party: 'Remeter a Terceiros',
        formalize: 'Formalizar Parceria',
    };

    const descriptions = {
        assign: 'Escolha o assessor responsável e a data de responsabilidade.',
        review: 'Preencha os campos obrigatórios para enviar a Parceria para revisão.',
        third_party: 'Preencha os campos para remeter a Parceria a um terceiro.',
        formalize: 'Preencha os dados de formalização da Parceria.',
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'assign' && <UserCheck className="w-5 h-5 text-amber-600" />}
                        {mode === 'review' && <Eye className="w-5 h-5 text-sky-600" />}
                        {mode === 'third_party' && <Send className="w-5 h-5 text-cyan-600" />}
                        {mode === 'formalize' && <Handshake className="w-5 h-5 text-emerald-600" />}
                        {titles[mode]}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500">
                        {descriptions[mode]}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {mode === 'assign' && (
                        <div className="space-y-2">
                            <Label>Assessor Responsável</Label>
                            <Select value={selectedAssessor} onValueChange={setSelectedAssessor}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o assessor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assessors.map((m) => (
                                        <SelectItem key={m.user_id} value={m.user_id}>
                                            {m.user_name} {m.function && `(${m.function})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {assessors.length === 0 && (
                                <p className="text-xs text-rose-500 mt-1">
                                    Nenhum assessor encontrado.
                                </p>
                            )}
                        </div>
                    )}

                    {mode === 'review' && (
                        <>
                            <div>
                                <Label>Pasta na Rede <span className="text-rose-500">*</span></Label>
                                <Input
                                    value={networkFolder}
                                    onChange={(e) => setNetworkFolder(e.target.value)}
                                    placeholder="\\rede\caminho\da\pasta"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Observações <span className="text-rose-500">*</span></Label>
                                <Textarea
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    rows={4}
                                    className="mt-1"
                                />
                            </div>
                        </>
                    )}

                    {mode === 'third_party' && (
                        <>
                            <div>
                                <Label>Data de Conclusão da Revisão <span className="text-rose-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={reviewConclusaoDate}
                                    onChange={(e) => setReviewConclusaoDate(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Terceiro <span className="text-rose-500">*</span></Label>
                                <Select value={thirdParty} onValueChange={setThirdParty}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {thirdParties.map((tp) => (
                                            <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {mode === 'formalize' && (
                        <>
                            <div>
                                <Label>Tipo de Parceria <span className="text-rose-500">*</span></Label>
                                <Select value={partnershipType} onValueChange={setPartnershipType}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="convenio">Convênio</SelectItem>
                                        <SelectItem value="termo_cooperacao">Termo de Cooperação</SelectItem>
                                        <SelectItem value="termo_fomento">Termo de Fomento</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Número <span className="text-rose-500">*</span></Label>
                                    <Input
                                        value={partnershipNumber}
                                        onChange={(e) => setPartnershipNumber(e.target.value)}
                                        placeholder="Ex.: 001/2024"
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Data da Assinatura <span className="text-rose-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={signatureDate}
                                        onChange={(e) => setSignatureDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Vigência <span className="text-rose-500">*</span></Label>
                                <Input
                                    value={validityPeriod}
                                    onChange={(e) => setValidityPeriod(e.target.value)}
                                    placeholder="Ex.: 12 meses"
                                    className="mt-1"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Termo Final <span className="text-rose-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Data do Aviso de Renovação <span className="text-rose-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={renewalNoticeDate}
                                        onChange={(e) => setRenewalNoticeDate(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleConfirm} disabled={!isValid() || saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
