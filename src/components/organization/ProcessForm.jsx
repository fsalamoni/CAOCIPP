import React, { useState } from 'react';
import MatterCategorySelect from './MatterCategorySelect';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

import referenceData from '@/data/referenceLists.json';

const RS_CITIES = referenceData.cities;
const ADVISORS = referenceData.advisors;

export default function ProcessForm({
  open,
  onOpenChange,
  onSubmit,
  initialData = null,
  members = [],
  isLoading = false
}) {
  const [formData, setFormData] = useState(initialData || {
    process_number: "",
    consultant: "",
    location: "",
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    matter_category: "",
    matter_subcategory: "",
    matter_object: "",
    urgency_request: false,
    distribution_date: "",
    responsible_user_id: "",
    responsible_user_name: "",
    analysis_start_date: "",
    observations: "",
    review_submission_date: "",
    review_return_date: "",
    access_restriction: false,
    archived_date: "",
    network_folder: ""
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResponsibleChange = (userId) => {
    const member = members.find(m => m.user_id === userId);
    setFormData(prev => ({
      ...prev,
      responsible_user_id: userId,
      responsible_user_name: member?.user_name || ""
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {initialData ? "Editar Processo" : "Novo Processo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-700 border-b pb-2">Informações Básicas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="process_number">Número do Processo *</Label>
                <Input
                  id="process_number"
                  placeholder="00021.000.125/2024"
                  value={formData.process_number}
                  onChange={(e) => handleChange("process_number", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultant">Consulente *</Label>
                <Input
                  id="consultant"
                  placeholder="Nome do consulente"
                  value={formData.consultant}
                  onChange={(e) => handleChange("consultant", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Local dos Fatos (Cidade) *</Label>
                <div className="relative">
                  <Input
                    id="location"
                    list="cities-list"
                    placeholder="Busque ou digite a cidade..."
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    required
                  />
                  <datalist id="cities-list">
                    {RS_CITIES.map(city => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry_date">Data de Entrada *</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => handleChange("entry_date", e.target.value)}
                  required
                />
              </div>
            </div>

            <MatterCategorySelect
              category={formData.matter_category}
              subcategory={formData.matter_subcategory}
              onCategoryChange={(val) => handleChange("matter_category", val)}
              onSubcategoryChange={(val) => handleChange("matter_subcategory", val)}
            />

            <div className="space-y-2">
              <Label htmlFor="matter_object">Objeto da Consulta *</Label>
              <Textarea
                id="matter_object"
                placeholder="Descreva o objeto da consulta..."
                value={formData.matter_object}
                onChange={(e) => handleChange("matter_object", e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="urgency_request"
                checked={formData.urgency_request}
                onCheckedChange={(v) => handleChange("urgency_request", v)}
              />
              <Label htmlFor="urgency_request" className="text-rose-600 font-medium">
                Pedido de Urgência
              </Label>
            </div>
          </div>

          {/* Distribuição e Análise */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-700 border-b pb-2">Distribuição e Análise</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distribution_date">Data de Distribuição</Label>
                <Input
                  id="distribution_date"
                  type="date"
                  value={formData.distribution_date}
                  onChange={(e) => handleChange("distribution_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsible">Assessor Responsável</Label>
                <div className="relative">
                  <Input
                    id="responsible"
                    list="advisors-list"
                    placeholder="Selecione ou digite o nome..."
                    value={formData.responsible_user_name || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const member = members.find(m => m.user_name === val);
                      setFormData(prev => ({
                        ...prev,
                        responsible_user_name: val,
                        responsible_user_id: member?.user_id || ""
                      }));
                    }}
                  />
                  <datalist id="advisors-list">
                    {Array.from(new Set([...members.map(m => m.user_name), ...ADVISORS])).sort().map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="analysis_start_date">Início da Análise</Label>
                <Input
                  id="analysis_start_date"
                  type="date"
                  value={formData.analysis_start_date}
                  onChange={(e) => handleChange("analysis_start_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="network_folder">Pasta na Rede</Label>
                <Input
                  id="network_folder"
                  placeholder="Caminho da pasta"
                  value={formData.network_folder}
                  onChange={(e) => handleChange("network_folder", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                placeholder="Observações e pontos importantes..."
                value={formData.observations}
                onChange={(e) => handleChange("observations", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Revisão e Arquivamento */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-700 border-b pb-2">Revisão e Arquivamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="review_submission_date">Remessa para Revisão</Label>
                <Input
                  id="review_submission_date"
                  type="date"
                  value={formData.review_submission_date}
                  onChange={(e) => handleChange("review_submission_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review_return_date">Devolução após Revisão</Label>
                <Input
                  id="review_return_date"
                  type="date"
                  value={formData.review_return_date}
                  onChange={(e) => handleChange("review_return_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="archived_date">Data de Arquivamento</Label>
                <Input
                  id="archived_date"
                  type="date"
                  value={formData.archived_date}
                  onChange={(e) => handleChange("archived_date", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="access_restriction"
                  checked={formData.access_restriction}
                  onCheckedChange={(v) => handleChange("access_restriction", v)}
                />
                <Label htmlFor="access_restriction">Restrição de Acesso</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-slate-900 hover:bg-slate-800">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {initialData ? "Salvar Alterações" : "Criar Processo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog >
  );
}