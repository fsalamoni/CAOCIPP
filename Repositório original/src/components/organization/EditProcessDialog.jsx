import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
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
import { RS_CITIES } from '../constants/cities';

export default function EditProcessDialog({ open, setOpen, process, members, onSuccess }) {
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

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
        network_folder: process.network_folder || ''
      });
    }
  }, [process]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('updateProcess', {
        process_id: process.id,
        updates: data
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Processo atualizado com sucesso!');
      setOpen(false);
      onSuccess();
      queryClient.invalidateQueries(['organization-processes']);
      queryClient.invalidateQueries(['dashboard-processes']);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar processo');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleResponsibleChange = (userId) => {
    const member = members.find(m => m.user_id === userId);
    setFormData({
      ...formData,
      responsible_user_id: userId,
      responsible_user_name: member?.user_name || ''
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Process.delete(process.id);
    },
    onSuccess: () => {
      toast.success('Processo excluído com sucesso!');
      setOpen(false);
      onSuccess();
      queryClient.invalidateQueries(['organization-processes']);
      queryClient.invalidateQueries(['dashboard-processes']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao excluir processo');
    }
  });

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja excluir o processo ${process?.process_number}? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate();
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
              disabled={deleteMutation.isPending}
            >
              Excluir
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
                    value={formData.process_number}
                    onChange={(e) => setFormData({ ...formData, process_number: e.target.value })}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                <div>
                  <Label htmlFor="consultant">Consulente</Label>
                  <Input
                    id="consultant"
                    value={formData.consultant}
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
                    value={formData.location} 
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
                    value={formData.entry_date}
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
                  value={formData.matter_object}
                  onChange={(e) => setFormData({ ...formData, matter_object: e.target.value })}
                  rows={3}
                  disabled
                  className="mt-1 bg-slate-50"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <Label>Pedido de Urgência</Label>
                <Switch
                  checked={formData.urgency_request}
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
                    value={formData.distribution_date}
                    onChange={(e) => setFormData({ ...formData, distribution_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="responsible">Assessor Responsável</Label>
                  <Select 
                    value={formData.responsible_user_id} 
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
                  value={formData.analysis_start_date}
                  onChange={(e) => setFormData({ ...formData, analysis_start_date: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="observations">Observações e Pontos Importantes</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
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
                    value={formData.review_submission_date}
                    onChange={(e) => setFormData({ ...formData, review_submission_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="review_return_date">Devolução após Revisão</Label>
                  <Input
                    id="review_return_date"
                    type="date"
                    value={formData.review_return_date}
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
                  value={formData.archived_date}
                  onChange={(e) => setFormData({ ...formData, archived_date: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="network_folder">Pasta na Rede</Label>
                <Input
                  id="network_folder"
                  value={formData.network_folder}
                  onChange={(e) => setFormData({ ...formData, network_folder: e.target.value })}
                  placeholder="Caminho da pasta na rede..."
                  className="mt-1"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <Label>Restrição de Acesso</Label>
                <Switch
                  checked={formData.access_restriction}
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
             className="bg-gradient-to-r from-indigo-600 to-violet-600"
             disabled={updateMutation.isPending}
           >
             {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
           </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}