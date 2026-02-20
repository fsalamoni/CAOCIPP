import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

export default function OrganizationDetails({ organization }) {
    const [formData, setFormData] = useState({
        name: organization.name || '',
        description: organization.description || '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: {
                    name: formData.name,
                    description: formData.description,
                }
            });
            toast.success('Detalhes da organização atualizados com sucesso!');
        } catch (error) {
            toast.error('Erro ao atualizar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-medium mb-4">Informações Básicas</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="orgName">Nome Oficial da Organização</Label>
                        <Input
                            id="orgName"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Ex: Ministério Público de..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="orgDesc">Descrição / Competência</Label>
                        <Textarea
                            id="orgDesc"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Descreva a competência e atribuições deste órgão..."
                            className="h-32"
                        />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <Button type="submit" disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
