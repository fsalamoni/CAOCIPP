import React, { useState } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { createProcess } from '@/services/functionsService';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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

export default function CreateProcessDialog({ open, setOpen, organization, members, onSuccess }) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    process_number: '',
    consultant: '',
    location: '',
    entry_date: new Date().toISOString().split('T')[0],
    matter_object: '',
    urgency_request: false,
    distribution_date: '',
    responsible_user_id: '',
    responsible_user_name: ''
  });

  const resetForm = () => {
    setFormData({
      process_number: '',
      consultant: '',
      location: '',
      entry_date: new Date().toISOString().split('T')[0],
      matter_object: '',
      urgency_request: false,
      distribution_date: '',
      responsible_user_id: '',
      responsible_user_name: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsCreating(true);

      // Map snake_case formData to camelCase expected by CreateProcessRequest in the Cloud Function
      const mappedData = {
        organizationId: organization.id,
        processNumber: formData.process_number,
        consultant: formData.consultant,
        location: formData.location,
        entryDate: formData.entry_date,
        matterObject: formData.matter_object,
        urgencyRequest: formData.urgency_request,
        distributionDate: formData.distribution_date || null,
        responsibleUserId: formData.responsible_user_id || null,
        responsibleUserName: formData.responsible_user_name || null
      };

      await createProcess(mappedData);

      toast.success('Processo criado com sucesso!');
      setOpen(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error creating process:', error);
      toast.error('Erro ao criar processo: ' + error.message);
    } finally {
      setIsCreating(false);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="process_number">Nº do Processo *</Label>
              <Input
                id="process_number"
                value={formData.process_number}
                onChange={(e) => setFormData({ ...formData, process_number: e.target.value })}
                placeholder="00021.000.125/2024"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="consultant">Consulente *</Label>
              <Input
                id="consultant"
                value={formData.consultant}
                onChange={(e) => setFormData({ ...formData, consultant: e.target.value })}
                placeholder="Nome do consulente"
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Local dos Fatos *</Label>
              <Select
                value={formData.location}
                onValueChange={(value) => setFormData({ ...formData, location: value })}
                required
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {RS_CITIES.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entry_date">Data de Entrada *</Label>
              <Input
                id="entry_date"
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="matter_object">Matéria e Objeto da Consulta *</Label>
            <Textarea
              id="matter_object"
              value={formData.matter_object}
              onChange={(e) => setFormData({ ...formData, matter_object: e.target.value })}
              placeholder="Descreva a matéria e objeto da consulta..."
              rows={3}
              required
              className="mt-1"
            />
          </div>

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
              <Select value={formData.responsible_user_id} onValueChange={handleResponsibleChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.user_name} {member.function && `(${member.function})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <Label htmlFor="urgency_request" className="cursor-pointer">Pedido de Urgência</Label>
              <p className="text-xs text-slate-500">Marcar este processo como urgente</p>
            </div>
            <Switch
              id="urgency_request"
              checked={formData.urgency_request}
              onCheckedChange={(checked) => setFormData({ ...formData, urgency_request: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Processo'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}