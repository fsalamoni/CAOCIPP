import React, { useState } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { createExpediente } from '@/services/functionsService';
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
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

// Default options (can be overridden by admin settings)
const DEFAULT_SYSTEMS = ['SIM', 'SGP', 'SPU', 'E-mail'];
const DEFAULT_ORIGINS = ['SUBINST', 'SUBADM', 'Gabinete PGJ', 'SUBGES', 'Outros'];

export default function CreateExpedienteDialog({ open, setOpen, organization, members, onSuccess }) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    expediente_number: '',
    system: '',
    origin: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    object: '',
    urgency_request: false,
    distribution_date: '',
    responsible_user_id: '',
    responsible_user_name: ''
  });

  // Get admin-configured lists or use defaults
  const systems = organization?.expedienteSettings?.systems || DEFAULT_SYSTEMS;
  const origins = organization?.expedienteSettings?.origins || DEFAULT_ORIGINS;

  const resetForm = () => {
    setFormData({
      expediente_number: '',
      system: '',
      origin: '',
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      object: '',
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

      const mappedData = {
        organizationId: organization.id,
        expedienteNumber: formData.expediente_number,
        system: formData.system,
        origin: formData.origin,
        entryDate: formData.entry_date,
        object: formData.object,
        urgencyRequest: formData.urgency_request,
        distributionDate: formData.distribution_date || null,
        responsibleUserId: formData.responsible_user_id || null,
        responsibleUserName: formData.responsible_user_name || null
      };

      await createExpediente(mappedData);

      toast.success('Expediente criado com sucesso!');
      setOpen(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (error) {
      logger.error('Error creating expediente:', error);
      toast.error('Erro ao criar expediente: ' + error.message);
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
          <DialogTitle>Novo Expediente Administrativo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expediente_number">Nº do Expediente *</Label>
              <Input
                id="expediente_number"
                value={formData.expediente_number}
                onChange={(e) => setFormData({ ...formData, expediente_number: e.target.value })}
                placeholder="Número do expediente"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="system">Sistema *</Label>
              <Select value={formData.system} onValueChange={(val) => setFormData({ ...formData, system: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o sistema" />
                </SelectTrigger>
                <SelectContent>
                  {systems.map(sys => (
                    <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="origin">Origem *</Label>
              <Select value={formData.origin} onValueChange={(val) => setFormData({ ...formData, origin: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent>
                  {origins.map(orig => (
                    <SelectItem key={orig} value={orig}>{orig}</SelectItem>
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
            <Label htmlFor="object">Objeto *</Label>
            <Textarea
              id="object"
              value={formData.object}
              onChange={(e) => setFormData({ ...formData, object: e.target.value })}
              placeholder="Descreva o objeto do expediente..."
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
              <p className="text-xs text-slate-500">Marcar este expediente como urgente</p>
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
                'Criar Expediente'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
