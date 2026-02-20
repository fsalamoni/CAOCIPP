import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Bot, Save, Loader2 } from 'lucide-react';

export default function AISettings({ organization }) {
    const [settings, setSettings] = useState(organization.summarySettings || {
        autoSummarize: true,
        customPrompt: '',
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: {
                    summarySettings: settings
                }
            });
            toast.success('Configurações de IA atualizadas!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-medium">Resumos Inteligentes</h3>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="autoSummarize"
                            checked={settings.autoSummarize}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoSummarize: checked }))}
                        />
                        <Label htmlFor="autoSummarize">Gerar resumos automaticamente ao criar/editar processos</Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="customPrompt">Instruções Personalizadas para a IA</Label>
                        <p className="text-sm text-slate-500">
                            Defina regras específicas para a geração de resumos (ex: "Sempre destaque valores monetários", "Use linguagem formal").
                        </p>
                        <Textarea
                            id="customPrompt"
                            value={settings.customPrompt}
                            onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                            placeholder="Digite suas instruções aqui..."
                            className="h-32"
                        />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <Button onClick={handleSave} disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Configurações
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
