import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { updateProcess, deleteProcess } from '@/services/functionsService';
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
import { Loader2 } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { logger } from '@/utils/logger';

const RS_CITIES = [
  "Porto Alegre", "Caxias do Sul", "Pelotas", "Santa Maria", "Canoas", "Gravataí",
  "Viamão", "Novo Hamburgo", "São Leopoldo", "Alvorada", "Sapucaia do Sul", "Esteio",
  "Cachoeirinha", "Guaíba", "Rio Grande", "Bagé", "Bento Gonçalves", "Passo Fundo",
  "Erechim", "Santa Cruz do Sul", "Uruguaiana", "Sapiranga", "Lajeado", "Ijuí",
  "Vacaria", "Farroupilha", "Camaquã", "Santana do Livramento", "Alegrete", "Torres",
  "Tramandaí", "Osório", "Santo Ângelo", "Cruz Alta", "Santiago", "São Borja",
  "Carazinho", "Venâncio Aires", "Taquara", "Montenegro", "Parobé", "Capão da Canoa",
  "Estância Velha", "Campo Bom", "Marau", "Soledade", "Lagoa Vermelha", "Getúlio Vargas"
].sort();

export default function EditProcessDialog({ open, setOpen, process, members, onSuccess, organizationId, userRole }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    process_number: '',
    consultant: '',
    location: '',
    entry_date: '',
    matter_object: '',
    urgency_request: false,
    distribution_date: '',
    responsible_user_id: '',
    responsible_user_name: '',
    analysis_start_date: '',
    observations: '',
    review_submission_date: '',
    review_return_date: '',
    access_restriction: false,
    archived_date: '',
    network_folder: '',
    status: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      console.error('Error formatting date:', value, e);
      return '';
    }
  };

  useEffect(() => {
    if (process) {
      // Aggressive key normalization to match DB keys regardless of casing, underscores, spaces, or line breaks
      const normalizeKey = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

      const getValue = (keys, defaultValue) => {
        // 1. Direct match (highest priority)
        for (const key of keys) {
          if (process[key] !== undefined && process[key] !== null && String(process[key]).trim() !== '') {
            return process[key];
          }
        }

        // 2. Normalized match (aggressive)
        const allKeys = Object.keys(process);
        const normalizedRequestedKeys = keys.map(normalizeKey);

        for (const dbKey of allKeys) {
          const normDbKey = normalizeKey(dbKey);
          if (normalizedRequestedKeys.includes(normDbKey)) {
            const val = process[dbKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              return val;
            }
          }
        }

        return defaultValue;
      };

      // Special helper for booleans to catch "Sim", "Não", "true" etc.
      const getBoolValue = (keys, defaultValue = false) => {
        const val = getValue(keys, null);
        if (val === null) return defaultValue;
        if (typeof val === 'boolean') return val;
        const lowerVal = String(val).toLowerCase().trim();
        return lowerVal === 'sim' || lowerVal === 'true' || lowerVal === 's' || lowerVal === '1';
      };

      // Special handling for responsible advisor to ensure we get an ID even if only name is provided
      const respId = getValue(['responsible_user_id', 'responsibleUserId', 'responsible_id', 'member_id'], '');
      const respName = getValue(['responsible_user_name', 'responsibleUserName', 'assessor', 'assessor_responsavel', 'responsavel'], '');

      let finalRespId = respId;
      // If we don't have an ID but have a name, try to find the member
      if (!finalRespId && respName && members) {
        const found = members.find(m =>
          m.user_id === respName || // Name might actually be an ID string
          m.user_name?.toLowerCase().trim() === respName.toString().toLowerCase().trim() ||
          m.displayName?.toLowerCase().trim() === respName.toString().toLowerCase().trim()
        );
        if (found) {
          finalRespId = found.user_id;
        }
      }

      // Definitive fix: if we have a name but no ID match, use a placeholder ID
      // This ensures the Select component has a non-empty value to match its Item
      if (!finalRespId && respName) {
        finalRespId = 'historical__advisor__placeholder';
      }

      setFormData({
        process_number: getValue(['process_number', 'numero', 'n_processo', 'processo', 'PROCESSO SIM\n(NÚMERO)', 'PROCESSO SIM\\n(NÚMERO)']),
        consultant: getValue(['consultant', 'consulente', 'cliente', 'interessado', 'CONSULENTE']),
        location: getValue(['location', 'local', 'cidade', 'local_fatos', 'municipio', 'LOCAL DOS FATOS\n(CIDADE)', 'LOCAL DOS FATOS\\n(CIDADE)']),
        entry_date: formatDateForInput(getValue(['entry_date', 'data_entrada', 'entrada', 'data', 'ENTRADA NO CAOPP\n(DATA)', 'ENTRADA NO CAOPP\\n(DATA)'])),
        matter_object: getValue(['matter_object', 'objeto', 'assunto', 'materia', 'descricao', 'MATÉRIA E OBJETO DA CONSULTA']),
        urgency_request: getBoolValue(['urgency_request', 'urgente', 'prioridade', 'urgente', 'PEDIDO DE URGÊNCIA', 'Solicitação de Urgência'], false),
        distribution_date: formatDateForInput(getValue(['distribution_date', 'data_distribuicao', 'distribuicao', 'DISTRIBUIÇÃO\n(DATA)', 'DISTRIBUIÇÃO\\n(DATA)'])),
        responsible_user_id: finalRespId || '',
        responsible_user_name: respName || (members?.find(m => m.user_id === finalRespId)?.user_name || ''),
        analysis_start_date: formatDateForInput(getValue(['analysis_start_date', 'inicio_analise', 'data_inicio', 'INÍCIO DA ANÁLISE\n(DATA)', 'INÍCIO DA ANÁLISE\\n(DATA)'])),
        observations: getValue(['observations', 'observacoes', 'notas', 'pontos_importantes', 'obs', 'OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA']),
        review_submission_date: formatDateForInput(getValue(['review_submission_date', 'remessa_revisao', 'data_revisao', 'remessa', 'REMESSA AO DR. PARA REVISÃO (DATA)'])),
        review_return_date: formatDateForInput(getValue(['review_return_date', 'devolucao_revisao', 'retorno_revisao', 'retorno', 'DEVOLUÇÃO APÓS REVISÃO\n(DATA)', 'DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)'])),
        access_restriction: getBoolValue(['access_restriction', 'restricao', 'restrito', 'sigilo', 'RESTRIÇÃO DE ACESSO'], false),
        archived_date: formatDateForInput(getValue(['archived_date', 'data_arquivamento', 'arquivamento', 'data_arquivo', 'NA PASTA\nARQUIVADO\n(DATA)', 'NA PASTA\\nARQUIVADO\\n(DATA)'])),
        network_folder: getValue(['network_folder', 'network_folder_path', 'pasta', 'pasta_rede', 'caminho', 'PASTA NA REDE']),
        status: getValue(['status', 'situacao', 'estado'], 'Pendente') || 'Pendente',
      });
    }
  }, [process, members]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsUpdating(true);

      // Use snake_case keys to match Firestore schema and UI expectations
      // The backend update.ts merges this record directly into Firestore
      const updateData = {
        process_number: formData.process_number,
        consultant: formData.consultant,
        location: formData.location,
        entry_date: formData.entry_date,
        matter_object: formData.matter_object,
        urgency_request: formData.urgency_request,
        distribution_date: formData.distribution_date || null,
        responsible_user_id: formData.responsible_user_id || null,
        responsible_user_name: formData.responsible_user_name || null,
        analysis_start_date: formData.analysis_start_date || null,
        observations: formData.observations || '',
        review_submission_date: formData.review_submission_date || null,
        review_return_date: formData.review_return_date || null,
        access_restriction: formData.access_restriction,
        archived_date: formData.archived_date || null,
        network_folder: formData.network_folder || '',
        status: formData.status
      };

      await updateProcess({
        id: process.id,
        organizationId: organizationId || process.organization_id,
        changes: updateData
      });

      toast.success('Processo atualizado com sucesso!');
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error updating process:', error);
      toast.error('Erro ao atualizar processo: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResponsibleChange = (userId) => {
    if (userId === 'historical__advisor__placeholder') return;
    const member = members.find(m => m.user_id === userId);
    setFormData({
      ...formData,
      responsible_user_id: userId,
      responsible_user_name: member?.user_name || member?.displayName || ''
    });
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o processo ${process?.process_number}? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);

      await deleteProcess({ id: process.id, organizationId: organizationId || process.organization_id });

      toast.success('Processo excluído com sucesso!');
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error deleting process:', error);
      toast.error('Erro ao excluir processo: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Permission check for delete button
  const canDelete = userRole === 'admin' || userRole === 'owner' || userRole === 'creator';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Editar Processo - {formData.process_number || process?.process_number || 'Sem Número'}</DialogTitle>
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
                  <Label htmlFor="process_number">Nº do Processo</Label>
                  <Input
                    id="process_number"
                    value={formData.process_number || ''}
                    onChange={(e) => setFormData({ ...formData, process_number: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="consultant">Consulente</Label>
                  <Input
                    id="consultant"
                    value={formData.consultant || ''}
                    onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Local dos Fatos</Label>
                  <Select
                    value={formData.location || ''}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RS_CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                      {/* Robust check: if the value in formData.location is NOT in RS_CITIES, we must add it as an item so Radix/Shadcn shows it */}
                      {formData.location && !RS_CITIES.includes(formData.location) && (
                        <SelectItem value={formData.location}>{formData.location}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="entry_date">Data de Entrada</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={formData.entry_date || ''}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="matter_object">Matéria e Objeto</Label>
                <Textarea
                  id="matter_object"
                  value={formData.matter_object || ''}
                  onChange={(e) => setFormData({ ...formData, matter_object: e.target.value })}
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
                      {members.map(member => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.user_name}
                        </SelectItem>
                      ))}
                      {/* Definitive fix: use the assigned ID (even placeholder) to match this item */}
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
                <Label htmlFor="observations">Observações e Pontos Importantes</Label>
                <Textarea
                  id="observations"
                  value={formData.observations || ''}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Observações sobre a análise..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="status">Status do Processo</Label>
                <Select
                  value={formData.status || ''}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Em elaboração">Em elaboração</SelectItem>
                    <SelectItem value="Em revisão">Em revisão</SelectItem>
                    <SelectItem value="Para revisão">Para revisão</SelectItem>
                    <SelectItem value="Para assinatura">Para assinatura</SelectItem>
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

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <Label>Restrição de Acesso</Label>
                <Switch
                  checked={formData.access_restriction || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, access_restriction: checked })}
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
  );
}