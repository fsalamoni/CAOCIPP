import React, { useState } from 'react';
import MatterCategorySelect from './MatterCategorySelect';
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

import { RS_CITIES } from '@/utils/cities';

export default function CreateProcessDialog({ open, setOpen, organization, members, onSuccess }) {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [formData, setFormData] = useState({
    process_number: '',
    consultant: '',
    location: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    matter_category: '',
    matter_subcategory: '',
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
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      matter_category: '',
      matter_subcategory: '',
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
        matterCategory: formData.matter_category || '',
        matterSubcategory: formData.matter_subcategory || '',
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
              <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={locationOpen}
                    className="w-full justify-between mt-1 font-normal"
                  >
                    {formData.location
                      ? formData.location
                      : "Selecione a cidade..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cidade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                      <CommandGroup>
                        {RS_CITIES.map((city) => (
                          <CommandItem
                            key={city}
                            value={city}
                            onSelect={(currentValue) => {
                              // CommandItem lowercases the value by default unless specified, 
                              // but we want the exact case from the array.
                              const actualCity = RS_CITIES.find(c => c.toLowerCase() === currentValue.toLowerCase()) || currentValue;
                              setFormData({ ...formData, location: actualCity });
                              setLocationOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.location === city ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {city}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

          <MatterCategorySelect
            category={formData.matter_category}
            subcategory={formData.matter_subcategory}
            onCategoryChange={(val) => setFormData({ ...formData, matter_category: val, matter_subcategory: '' })}
            onSubcategoryChange={(val) => setFormData({ ...formData, matter_subcategory: val })}
            organization={organization}
          />

          <div>
            <Label htmlFor="matter_object">Objeto da Consulta *</Label>
            <Textarea
              id="matter_object"
              value={formData.matter_object}
              onChange={(e) => setFormData({ ...formData, matter_object: e.target.value })}
              placeholder="Descreva o objeto da consulta..."
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