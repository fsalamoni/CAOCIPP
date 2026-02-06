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

export default function EditProcessDialog({ open, setOpen, process, members, onSuccess, organizationId }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (process) {
      setFormData({
        process_number: process.process_number || '',
        consultant: process.consultant || '',
        location: process.location || '',
        entry_date: process.entry_date || '',
        matter_object: process.matter_object || '',
        urgency_request: process.urgency_request || false,
        distribution_date: process.distribution_date || '',
        responsible_user_id: process.responsible_user_id || '',
        responsible_user_name: process.responsible_user_name || '',
        analysis_start_date: process.analysis_start_date || '',
        observations: process.observations || '',
        review_submission_date: process.review_submission_date || '',
        review_return_date: process.review_return_date || '',
        access_restriction: process.access_restriction || false,
        archived_date: process.archived_date || '',
        network_folder: process.network_folder || '',
        status: process.status || 'Em triagem',
      });
    }
  }, [process]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsUpdating(true);

      await updateProcess({
        id: process.id,
        organizationId: organizationId || process.organization_id, // Ensure we pass orgId context if validation needs it
        changes: formData
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
    const member = members.find(m => m.user_id === userId);
    setFormData({
      ...formData,
      responsible_user_id: userId,
      responsible_user_name: member?.user_name || ''
    });
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o processo ${process?.process_number}? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);

      await deleteProcess(process.id);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Editar Processo - {process?.process_number}</DialogTitle>
            <Button
              variant="destructive"
              size="sm"
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
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="consultant">Consulente</Label>
                  <Input
                    id="consultant"
                    value={formData.consultant || ''}
                    onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Local dos Fatos</Label>
                  <Select
                    value={formData.location || ''}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                    disabled
                  >
                    <SelectTrigger className="mt-1 bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RS_CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
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
                    disabled
                    className="mt-1 bg-slate-50"
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
                  disabled
                  className="mt-1 bg-slate-50"
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
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
        </form>
      </DialogContent>
    </Dialog>
  );
}