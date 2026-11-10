import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { updateOrganization } from '@/services/functionsService';
import { BUILTIN_MODULE_META, BUILTIN_MODULES, resolveBuiltinModules, getModuleOrder } from '@/lib/organizationModules';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { logger } from '@/utils/logger';
import EntityTypesManager from './EntityTypesManager';

const META = Object.fromEntries(BUILTIN_MODULE_META.map((m) => [m.key, m]));

// Painel Administrativo → Páginas e módulos: liga, desliga e ordena as páginas
// do órgão. Visível apenas com a flag CUSTOM_ENTITIES ligada (controlado pelo pai).
export default function ModulesManager({ organization }) {
    const initial = useMemo(() => resolveBuiltinModules(organization), [organization]);
    const initialOrder = useMemo(() => getModuleOrder(organization), [organization]);
    const [enabled, setEnabled] = useState(initial);
    const [order, setOrder] = useState(initialOrder);
    const [isSaving, setIsSaving] = useState(false);

    // Módulos que dependem de uma flag global da plataforma: enquanto a flag
    // estiver desligada, o módulo não aparece em órgão nenhum, então também
    // não faz sentido oferecer o interruptor aqui. O VALOR salvo do órgão é
    // preservado (ver handleSave): religar a flag traz a escolha de volta.
    const jurimetriaOn = useFlag(FEATURE_FLAGS.JURIMETRIA.key);
    const panoramaOn = useFlag(FEATURE_FLAGS.PANORAMA.key);
    const calendarOn = useFlag(FEATURE_FLAGS.DEADLINE_CALENDAR.key);
    const visibleKeys = useMemo(() => {
        const flagDoModulo = {
            [BUILTIN_MODULES.JURIMETRIA]: jurimetriaOn,
            [BUILTIN_MODULES.PANORAMA]: panoramaOn,
            [BUILTIN_MODULES.CALENDAR]: calendarOn,
        };
        return order.filter((key) => flagDoModulo[key] !== false);
    }, [order, jurimetriaOn, panoramaOn, calendarOn]);

    const dirty = useMemo(
        () => visibleKeys.some((key) => enabled[key] !== initial[key]) || order.join() !== initialOrder.join(),
        [enabled, initial, visibleKeys, order, initialOrder]
    );

    const toggle = (key) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

    // Troca o módulo com o vizinho VISÍVEL (os ocultos por flag mantêm o lugar).
    const move = (key, delta) => {
        const vizinho = visibleKeys[visibleKeys.indexOf(key) + delta];
        if (!vizinho) return;
        setOrder((prev) => {
            const next = [...prev];
            const a = next.indexOf(key);
            const b = next.indexOf(vizinho);
            [next[a], next[b]] = [next[b], next[a]];
            return next;
        });
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            // Envia TODOS os módulos built-in (não apenas os alterados), para que
            // o sanitizeModuleConfig do backend receba um payload completo.
            const moduleConfig = {};
            order.forEach((key, index) => {
                moduleConfig[key] = { enabled: enabled[key] === true, order: index };
            });
            await updateOrganization({ organizationId: organization.id, data: { moduleConfig } });
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
            <Alert>
                <AlertDescription>
                    Desligar uma página só a esconde da navegação: nenhum dado é apagado e você pode religar quando quiser.
                    Use as setas para definir a ordem em que as páginas aparecem. <strong>Informações Gerais</strong> vem
                    sempre primeiro; páginas personalizadas, <strong>Processo Eletrônico</strong> e{' '}
                    <strong>Painel Administrativo</strong> vêm sempre depois destas.
                </AlertDescription>
            </Alert>

            <ol className="space-y-2">
                {visibleKeys.map((key, index) => {
                    const mod = META[key];
                    const ModIcon = mod.icon;
                    const on = enabled[key] === true;
                    return (
                        <li
                            key={key}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4"
                        >
                            <div className="flex flex-col shrink-0">
                                <Button
                                    variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => move(key, -1)} disabled={index === 0}
                                    aria-label={`Subir ${mod.label}`}
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => move(key, 1)} disabled={index === visibleKeys.length - 1}
                                    aria-label={`Descer ${mod.label}`}
                                >
                                    <ArrowDown className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className={`hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0 ${on ? 'bg-indigo-50 dark:bg-indigo-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                <ModIcon className={`w-5 h-5 ${on ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 dark:text-white">{mod.label}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{mod.description}</p>
                                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                                    {on ? 'Visível na navegação do órgão.' : 'Oculta (os dados permanecem salvos).'}
                                </p>
                            </div>
                            <Switch checked={on} onCheckedChange={() => toggle(key)} aria-label={`Ativar ${mod.label}`} />
                        </li>
                    );
                })}
            </ol>

            <div className="flex items-center justify-end gap-3">
                {dirty && <span className="text-sm text-amber-700 dark:text-amber-400">Há alterações não salvas.</span>}
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
