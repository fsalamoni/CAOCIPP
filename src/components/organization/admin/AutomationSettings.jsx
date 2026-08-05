import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Target, AlertTriangle, Mail, Save, Loader2 } from 'lucide-react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// Painel administrativo (só Criador): metas de conclusão, escalonamento
// automático e relatórios agendados por e-mail. Cada seção só aparece se a
// respectiva flag de plataforma estiver ligada.
export default function AutomationSettings({ organization }) {
    const isGoalsOn = useFlag(FEATURE_FLAGS.ASSESSOR_GOALS.key);
    const isEscalationOn = useFlag(FEATURE_FLAGS.AUTO_ESCALATION.key);
    const isReportsOn = useFlag(FEATURE_FLAGS.SCHEDULED_EMAIL_REPORTS.key);

    const [goals, setGoals] = useState(organization.goalsConfig || { enabled: false, targetPercent: 80, withinDays: 10 });
    const [escalation, setEscalation] = useState(organization.escalationConfig || { enabled: false, maxDaysStalled: 5 });
    const [reports, setReports] = useState(organization.reportsConfig || { dailySummaryEnabled: false, weeklyReportEnabled: false });
    const [savingSection, setSavingSection] = useState(null);

    // Sem isto, trocar de órgão sem recarregar a página mantinha a config do
    // órgão anterior nos formulários — "Salvar" gravaria metas/escalonamento/
    // relatórios de um órgão em outro.
    useEffect(() => {
        setGoals(organization.goalsConfig || { enabled: false, targetPercent: 80, withinDays: 10 });
        setEscalation(organization.escalationConfig || { enabled: false, maxDaysStalled: 5 });
        setReports(organization.reportsConfig || { dailySummaryEnabled: false, weeklyReportEnabled: false });
    }, [organization.id]);

    const saveSection = async (field, value, label) => {
        setSavingSection(field);
        try {
            await updateOrganization({ organizationId: organization.id, data: { [field]: value } });
            toast.success(`${label} atualizado(a)!`);
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSavingSection(null);
        }
    };

    if (!isGoalsOn && !isEscalationOn && !isReportsOn) {
        return (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                Nenhuma funcionalidade de automação está habilitada na plataforma no momento.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isGoalsOn && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-medium">Metas de Conclusão por Assessor</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Cada assessor vê, em Meu Início, o percentual de seus Consultas, Expedientes e Parcerias concluídos (ou ainda dentro do prazo) em até N dias úteis, frente à meta definida aqui.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label>Habilitar metas neste órgão</Label>
                            <Switch checked={goals.enabled} onCheckedChange={(checked) => setGoals((g) => ({ ...g, enabled: checked }))} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="targetPercent">Meta (%)</Label>
                                <Input
                                    id="targetPercent"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={goals.targetPercent}
                                    onChange={(e) => setGoals((g) => ({ ...g, targetPercent: Number(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="withinDays">Em até (dias úteis)</Label>
                                <Input
                                    id="withinDays"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={goals.withinDays}
                                    onChange={(e) => setGoals((g) => ({ ...g, withinDays: Number(e.target.value) }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button onClick={() => saveSection('goalsConfig', goals, 'Metas de conclusão')} disabled={savingSection === 'goalsConfig'} className="gap-2">
                                {savingSection === 'goalsConfig' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isEscalationOn && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <h3 className="text-lg font-medium">Escalonamento de Urgentes Parados</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Uma rotina diária notifica o criador, os administradores delegados e o responsável quando uma Consulta/Expediente urgente fica parado na mesma etapa por mais do que o limite abaixo.
                    </p>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label>Habilitar escalonamento neste órgão</Label>
                            <Switch checked={escalation.enabled} onCheckedChange={(checked) => setEscalation((e) => ({ ...e, enabled: checked }))} />
                        </div>
                        <div>
                            <Label htmlFor="maxDaysStalled">Limite (dias úteis parado)</Label>
                            <Input
                                id="maxDaysStalled"
                                type="number"
                                min={1}
                                max={365}
                                value={escalation.maxDaysStalled}
                                onChange={(e) => setEscalation((s) => ({ ...s, maxDaysStalled: Number(e.target.value) }))}
                                className="mt-1 max-w-xs"
                            />
                        </div>
                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button onClick={() => saveSection('escalationConfig', escalation, 'Escalonamento')} disabled={savingSection === 'escalationConfig'} className="gap-2">
                                {savingSection === 'escalationConfig' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isReportsOn && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-sky-600" />
                        <h3 className="text-lg font-medium">Relatórios Agendados por E-mail</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Enviados para o criador e os administradores. Depende de um provedor de e-mail configurado em Administração da Plataforma — sem isso, fica inativo mesmo ligado aqui.
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label>Resumo diário de urgentes pendentes</Label>
                            <Switch checked={reports.dailySummaryEnabled} onCheckedChange={(checked) => setReports((r) => ({ ...r, dailySummaryEnabled: checked }))} />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Label>Relatório semanal do órgão</Label>
                            <Switch checked={reports.weeklyReportEnabled} onCheckedChange={(checked) => setReports((r) => ({ ...r, weeklyReportEnabled: checked }))} />
                        </div>
                        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button onClick={() => saveSection('reportsConfig', reports, 'Relatórios agendados')} disabled={savingSection === 'reportsConfig'} className="gap-2">
                                {savingSection === 'reportsConfig' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
