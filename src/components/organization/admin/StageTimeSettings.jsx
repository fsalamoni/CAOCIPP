import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StageTimeBadge from '@/components/ui/StageTimeBadge';
import { cn } from '@/lib/utils';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Timer, Save, Loader2 } from 'lucide-react';
import {
    STAGE_TIME_COLOR_PRESETS,
    STAGE_TIME_DAY_TYPES,
    resolveStageTimeConfig,
} from '@/lib/stageTime';

const SEVERITY_FIELDS = [
    { key: 'ok', label: 'Dentro do prazo (verde por padrão)' },
    { key: 'warn', label: 'Atenção (amarelo/mostarda por padrão)' },
    { key: 'risk', label: 'Risco (vermelho por padrão)' },
];

// Painel administrativo (só Criador): personaliza os limiares de dias e as
// cores do selo "tempo na etapa atual" (flag `stage_time_indicator`). Cada
// órgão define do jeito que melhor entender — os padrões (5/10 dias úteis,
// verde/amarelo/vermelho) seguem valendo até que o admin salve algo diferente.
export default function StageTimeSettings({ organization }) {
    const [config, setConfig] = useState(() => resolveStageTimeConfig(organization.stageTimeConfig));
    const [isSaving, setIsSaving] = useState(false);

    // Sem isto, trocar de órgão sem recarregar a página mantinha a config do
    // órgão anterior no formulário — "Salvar" gravaria os limiares de um
    // órgão em outro.
    useEffect(() => {
        setConfig(resolveStageTimeConfig(organization.stageTimeConfig));
    }, [organization.id]);

    const setColor = (severityKey, colorKey) => {
        setConfig((c) => ({ ...c, colors: { ...c.colors, [severityKey]: colorKey } }));
    };

    const handleSave = async () => {
        if (config.warnMaxDays <= config.okMaxDays) {
            toast.error('O limite de "Atenção" precisa ser maior que o de "Dentro do prazo".');
            return;
        }
        setIsSaving(true);
        try {
            await updateOrganization({ organizationId: organization.id, data: { stageTimeConfig: config } });
            toast.success('Configuração do indicador de tempo atualizada!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const dayUnitLabel = config.dayType === 'calendar' ? 'dias corridos' : 'dias úteis';

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Indicador de Tempo na Etapa Atual</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Defina como o selo de dias parados na etapa atual (Kanban e tabela) deve se comportar
                neste órgão: contagem por dias úteis ou corridos, os prazos de cada faixa e a cor de cada uma.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="stage-time-day-type">Contagem de dias</Label>
                    <Select value={config.dayType} onValueChange={(value) => setConfig((c) => ({ ...c, dayType: value }))}>
                        <SelectTrigger id="stage-time-day-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {STAGE_TIME_DAY_TYPES.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="stage-time-ok-max">Dentro do prazo até (dias)</Label>
                    <Input
                        id="stage-time-ok-max"
                        type="number"
                        min={1}
                        max={365}
                        value={config.okMaxDays}
                        onChange={(e) => setConfig((c) => ({ ...c, okMaxDays: Number(e.target.value) }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="stage-time-warn-max">Atenção até (dias)</Label>
                    <Input
                        id="stage-time-warn-max"
                        type="number"
                        min={1}
                        max={365}
                        value={config.warnMaxDays}
                        onChange={(e) => setConfig((c) => ({ ...c, warnMaxDays: Number(e.target.value) }))}
                    />
                </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
                Acima de {config.warnMaxDays} {dayUnitLabel} na etapa atual, o selo é classificado como risco.
            </p>

            <div className="space-y-4">
                {SEVERITY_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(STAGE_TIME_COLOR_PRESETS).map(([colorKey, preset]) => {
                                const isSelected = config.colors[field.key] === colorKey;
                                return (
                                    <button
                                        key={colorKey}
                                        type="button"
                                        title={preset.label}
                                        onClick={() => setColor(field.key, colorKey)}
                                        className={cn(
                                            'w-8 h-8 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-all',
                                            preset.swatch,
                                            isSelected ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'hover:scale-105'
                                        )}
                                        aria-label={preset.label}
                                        aria-pressed={isSelected}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">Pré-visualização</Label>
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <StageTimeBadge days={Math.max(1, Math.round(config.okMaxDays / 2))} severity="ok" colors={config.colors} dayType={config.dayType} />
                    <StageTimeBadge days={config.warnMaxDays} severity="warn" colors={config.colors} dayType={config.dayType} />
                    <StageTimeBadge days={config.warnMaxDays + 5} severity="risk" colors={config.colors} dayType={config.dayType} />
                </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                </Button>
            </div>
        </div>
    );
}
