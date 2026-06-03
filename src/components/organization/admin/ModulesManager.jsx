import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateOrganization } from '@/services/functionsService';
import { BUILTIN_MODULE_META, resolveBuiltinModules } from '@/lib/organizationModules';
import { logger } from '@/utils/logger';
import EntityTypesManager from './EntityTypesManager';

// Painel de administração: liga/desliga os módulos (páginas) do órgão.
// Visível apenas quando a flag CUSTOM_ENTITIES está ligada (controlado pelo pai).
export default function ModulesManager({ organization }) {
    const initial = useMemo(() => resolveBuiltinModules(organization), [organization]);
    const [enabled, setEnabled] = useState(initial);
    const [isSaving, setIsSaving] = useState(false);

    const dirty = useMemo(() => {
        return (
            enabled.processes !== initial.processes ||
            enabled.expedientes !== initial.expedientes ||
            enabled.summary !== initial.summary
        );
    }, [enabled, initial]);

    const toggle = (key) => {
        setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const moduleConfig = {
                processes: { enabled: enabled.processes === true },
                expedientes: { enabled: enabled.expedientes === true },
                summary: { enabled: enabled.summary === true },
            };
            await updateOrganization({
                organizationId: organization.id,
                data: { moduleConfig },
            });
            toast.success('Páginas atualizadas com sucesso!');
        } catch (error) {
            logger.error('Erro ao salvar módulos:', error);
            toast.error('Erro ao salvar páginas: ' + (error?.message || 'tente novamente'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Páginas e Módulos</h3>
                <p className="text-sm text-slate-500">
                    Escolha quais páginas aparecem para este órgão. Desligar uma página apenas a oculta da navegação —
                    nenhum dado é apagado, e você pode religar a qualquer momento.
                </p>
            </div>

            <Alert>
                <AlertDescription>
                    As páginas <strong>Informações Gerais</strong> e <strong>Painel Administrativo</strong> são fixas e
                    estão sempre disponíveis.
                </AlertDescription>
            </Alert>

            <div className="space-y-3">
                {BUILTIN_MODULE_META.map((mod) => {
                    const ModIcon = mod.icon;
                    return (
                        <Card key={mod.key} className="border-slate-200 dark:border-slate-700">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                                            <ModIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <CardTitle className="text-base">{mod.label}</CardTitle>
                                            <CardDescription>{mod.description}</CardDescription>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={enabled[mod.key] === true}
                                        onCheckedChange={() => toggle(mod.key)}
                                        aria-label={`Ativar ${mod.label}`}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-slate-400">
                                    {enabled[mod.key] ? 'Visível na navegação do órgão.' : 'Oculto (os dados permanecem salvos).'}
                                </p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!dirty || isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar páginas
                </Button>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <EntityTypesManager organization={organization} />
            </div>
        </div>
    );
}
