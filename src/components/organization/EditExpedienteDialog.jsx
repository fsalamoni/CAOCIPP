import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { updateExpediente, deleteExpediente } from '@/services/functionsService';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { logger } from '@/utils/logger';
import ProcessLogDialog from './ProcessLogDialog';

const DEFAULT_SYSTEMS = ['SIM', 'SGP', 'SPU', 'E-mail'];
const DEFAULT_ORIGINS = ['SUBINST', 'SUBADM', 'Gabinete PGJ', 'SUBGES', 'Outros'];

export default function EditExpedienteDialog({ open, setOpen, expediente, members, onSuccess, organizationId, userRole, organization }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    expediente_number: '',
    system: '',
    origin: '',
    entry_date: '',
    object: '',
    urgency_request: false,
    distribution_date: '',
    responsible_user_id: '',
    responsible_user_name: '',
    analysis_start_date: '',
    observations: '',
    review_submission_date: '',
    review_return_date: '',
    archived_date: '',
    network_folder: '',
    status: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // Get admin-configured lists or use defaults
  const systems = organization?.expedienteSettings?.systems || DEFAULT_SYSTEMS;
  const origins = organization?.expedienteSettings?.origins || DEFAULT_ORIGINS;

  // Helper to safely format dates for input type="date" (YYYY-MM-DD)
  const formatDateForInput = (value) => {
    if (!value) return '';
    try {
      const d = parseLocalDate(value);
      if (isValid(d)) {
        return format(d, 'yyyy-MM-dd');
      }
      return '';
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (expediente) {
      const normalizeKey = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

      const getValue = (keys, defaultValue) => {
        for (const key of keys) {
          if (expediente[key] !== undefined && expediente[key] !== null && String(expediente[key]).trim() !== '') {
            return expediente[key];
          }
        }
        const allKeys = Object.keys(expediente);
        const normalizedRequestedKeys = keys.map(normalizeKey);
        for (const dbKey of allKeys) {
          if (normalizedRequestedKeys.includes(normalizeKey(dbKey))) {
            const val = expediente[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') return val;
          }
        }
        return defaultValue;
      };

      const getBoolValue = (keys, defaultValue = false) => {
        const val = getValue(keys, null);
        if (val === null) return defaultValue;
        if (typeof val === 'boolean') return val;
        const lowerVal = String(val).toLowerCase().trim();
        return lowerVal === 'sim' || lowerVal === 'true' || lowerVal === 's' || lowerVal === '1';
      };

      // Responsible advisor handling
      const respId = getValue(['responsible_user_id', 'responsibleUserId'], '');
      const respName = getValue(['responsible_user_name', 'responsibleUserName', 'assessor', 'responsavel'], '');

      let finalRespId = respId;
      if (!finalRespId && respName && members) {
        const found = members.find(m =>
          m.user_id === respName ||
          m.user_name?.toLowerCase().trim() === respName.toString().toLowerCase().trim()
        );
        if (found) finalRespId = found.user_id;
      }
      if (!finalRespId && respName) {
        finalRespId = 'historical__advisor__placeholder';
      }

      setFormData({
        expediente_number: getValue(['expediente_number', 'numero', 'expediente']),
        system: getValue(['system', 'sistema']),
        origin: getValue(['origin', 'origem']),
        entry_date: formatDateForInput(getValue(['entry_date', 'data_entrada', 'entrada'])),
        object: getValue(['object', 'objeto', 'assunto']),
        urgency_request: getBoolValue(['urgency_request', 'urgente'], false),
        distribution_date: formatDateForInput(getValue(['distribution_date', 'distribuicao'])),
        responsible_user_id: finalRespId || '',
        responsible_user_name: respName || (members?.find(m => m.user_id === finalRespId)?.user_name || ''),
        analysis_start_date: formatDateForInput(getValue(['analysis_start_date', 'inicio_analise'])),
        observations: getValue(['observations', 'observacoes', 'obs']),
        review_submission_date: formatDateForInput(getValue(['review_submission_date', 'remessa_revisao'])),
        review_return_date: formatDateForInput(getValue(['review_return_date', 'devolucao_revisao'])),
        archived_date: formatDateForInput(getValue(['archived_date', 'arquivamento'])),
        network_folder: getValue(['network_folder', 'pasta_rede']),
        status: getValue(['status', 'situacao'], 'Pendente') || 'Pendente',
      });
    }
  }, [expediente, members]);

  const getRollbackByStatus = (status, emptyValue = '') => {
    if (status === 'Pendente') {
      return {
        analysis_start_date: emptyValue,
        review_submission_date: emptyValue,
        review_return_date: emptyValue,
        archived_date: emptyValue,
        responsible_user_id: emptyValue,
        responsible_user_name: emptyValue,
      };
    }

    if (status === 'Em elaboração') {
      return {
        review_submission_date: emptyValue,
        review_return_date: emptyValue,
        archived_date: emptyValue,
      };
    }

    if (status === 'Em revisão') {
      return {
        archived_date: emptyValue,
      };
    }

    return {};
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.expediente_number?.trim()) {
      toast.error('O Número do Expediente é obrigatório.');
      return;
    }

    try {
      setIsUpdating(true);

      const rollbackForStatus = getRollbackByStatus(formData.status, null);

      const updateData = {
        expediente_number: formData.expediente_number,
        system: formData.system,
        origin: formData.origin,
        entry_date: formData.entry_date,
        object: formData.object,
        urgency_request: formData.urgency_request,
        distribution_date: formData.distribution_date || null,
        responsible_user_id: formData.responsible_user_id || null,
        responsible_user_name: formData.responsible_user_name || null,
        analysis_start_date: formData.analysis_start_date || null,
        observations: formData.observations || '',
        review_submission_date: formData.review_submission_date || null,
        review_return_date: formData.review_return_date || null,
        archived_date: formData.archived_date || null,
        network_folder: formData.network_folder || '',
        status: formData.status,
        ...rollbackForStatus,
      };

      await updateExpediente({
        id: expediente.id,
        organizationId: organizationId || expediente.organization_id,
        changes: updateData
      });

      toast.success('Expediente atualizado com sucesso!');
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error updating expediente:', error);
      toast.error('Erro ao atualizar expediente: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResponsibleChange = (userId) => {
    if (userId === 'historical__advisor__placeholder') return;

    if (userId === '__none__') {
      setFormData(prev => ({
        ...prev,
        responsible_user_id: '',
        responsible_user_name: '',
      }));
      return;
    }

    const member = members.find(m => m.user_id === userId);
    setFormData({
      ...formData,
      responsible_user_id: userId,
      responsible_user_name: member?.user_name || member?.displayName || ''
    });
  };

  const handleStatusChange = (status) => {
    setFormData(prev => ({
      ...prev,
      status,
      ...getRollbackByStatus(status),
    }));
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o expediente ${expediente?.expediente_number}? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteExpediente({ id: expediente.id, organizationId: organizationId || expediente.organization_id });
      toast.success('Expediente excluído com sucesso!');
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error deleting expediente:', error);
      toast.error('Erro ao excluir expediente: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = userRole === 'admin' || userRole === 'owner' || userRole === 'creator';

  const renderValidationSignal = (field) => {
    if (formData[field] && String(formData[field]).trim() !== '') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in zoom-in duration-300" />;
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Editar Expediente - {formData.expediente_number || expediente?.expediente_number || 'Sem Número'}</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="mt-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="workflow">Fluxo de Trabalho</TabsTrigger>
                <TabsTrigger value="archive">Revisão e Arquivo</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="expediente_number">Nº do Expediente</Label>
                      {renderValidationSignal('expediente_number')}
                    </div>
                    <Input
                      id="expediente_number"
                      value={formData.expediente_number || ''}
                      onChange={(e) => setFormData({ ...formData, expediente_number: e.target.value })}
                      className={cn(
                        "mt-1 transition-all duration-300",
                        formData.expediente_number ? "border-emerald-200 focus-visible:ring-emerald-500" : ""
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="system">Sistema</Label>
                      {renderValidationSignal('system')}
                    </div>
                    <Select value={formData.system || ''} onValueChange={(val) => setFormData({ ...formData, system: val })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o sistema" />
                      </SelectTrigger>
                      <SelectContent>
                        {systems.map(sys => (
                          <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                        ))}
                        {formData.system && !systems.includes(formData.system) && (
                          <SelectItem value={formData.system}>{formData.system} (Histórico)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="origin">Origem</Label>
                      {renderValidationSignal('origin')}
                    </div>
                    <Select value={formData.origin || ''} onValueChange={(val) => setFormData({ ...formData, origin: val })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione a origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {origins.map(orig => (
                          <SelectItem key={orig} value={orig}>{orig}</SelectItem>
                        ))}
                        {formData.origin && !origins.includes(formData.origin) && (
                          <SelectItem value={formData.origin}>{formData.origin} (Histórico)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="entry_date">Data de Entrada</Label>
                      {renderValidationSignal('entry_date')}
                    </div>
                    <Input
                      id="entry_date"
                      type="date"
                      value={formData.entry_date || ''}
                      onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                      className={cn(
                        "mt-1 transition-all duration-300",
                        formData.entry_date ? "border-emerald-200 focus-visible:ring-emerald-500" : ""
                      )}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="object">Objeto</Label>
                  <Textarea
                    id="object"
                    value={formData.object || ''}
                    onChange={(e) => setFormData({ ...formData, object: e.target.value })}
                    rows={3}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <Label>Pedido de Urgência</Label>
                  <Switch
                    checked={formData.urgency_request || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, urgency_request: checked })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="distribution_date">Data de Distribuição</Label>
                    <Input
                      id="distribution_date"
                      type="date"
                      value={formData.distribution_date || ''}
                      onChange={(e) => setFormData({ ...formData, distribution_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="responsible">Assessor Responsável</Label>
                    <Select
                      value={formData.responsible_user_id || ''}
                      onValueChange={handleResponsibleChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem assessor responsável</SelectItem>
                        {members.map(member => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.user_name}
                          </SelectItem>
                        ))}
                        {formData.responsible_user_id && !members.find(m => m.user_id === formData.responsible_user_id) && formData.responsible_user_name && (
                          <SelectItem value={formData.responsible_user_id}>
                            {formData.responsible_user_name}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="analysis_start_date">Início da Análise</Label>
                  <Input
                    id="analysis_start_date"
                    type="date"
                    value={formData.analysis_start_date || ''}
                    onChange={(e) => setFormData({ ...formData, analysis_start_date: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    value={formData.observations || ''}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    placeholder="Observações sobre o expediente..."
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status do Expediente</Label>
                  <Select
                    value={formData.status || ''}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em elaboração">Em elaboração</SelectItem>
                      <SelectItem value="Em revisão">Em revisão</SelectItem>
                      <SelectItem value="Na pasta">Na pasta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="archive" className="space-y-4 mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="review_submission_date">Remessa para Revisão</Label>
                    <Input
                      id="review_submission_date"
                      type="date"
                      value={formData.review_submission_date || ''}
                      onChange={(e) => setFormData({ ...formData, review_submission_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="review_return_date">Devolução após Revisão</Label>
                    <Input
                      id="review_return_date"
                      type="date"
                      value={formData.review_return_date || ''}
                      onChange={(e) => setFormData({ ...formData, review_return_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="archived_date">Data de Arquivamento</Label>
                  <Input
                    id="archived_date"
                    type="date"
                    value={formData.archived_date || ''}
                    onChange={(e) => setFormData({ ...formData, archived_date: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="network_folder">Pasta na Rede</Label>
                  <Input
                    id="network_folder"
                    value={formData.network_folder || ''}
                    onChange={(e) => setFormData({ ...formData, network_folder: e.target.value })}
                    placeholder="Caminho da pasta na rede..."
                    className="mt-1"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex">
                {canDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting || isUpdating}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      'Excluir'
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {userRole === 'creator' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLogOpen(true)}
                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  >
                    Verificar Log
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-primary"
                  disabled={isUpdating || isDeleting}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity Log Dialog (reuses ProcessLogDialog) */}
      <ProcessLogDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        process={expediente}
      />
    </>
  );
}
