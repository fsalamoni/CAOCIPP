import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    updateOrganization,
    getOrgAccessLog,
    previewAnonymization,
    runAnonymization,
    testOrgWebhook,
} from '@/services/functionsService';
import { toast } from 'sonner';
import { ScrollText, ShieldAlert, Webhook, Save, Loader2, Info, Search, Eraser } from 'lucide-react';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

const ACTION_LABELS = {
    VIEW_RESTRICTED_RECORD: 'Abriu registro com restrição de acesso',
    EXPORT_TABLE: 'Exportou tabela',
};

function AccessAuditLogSection({ organization }) {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getOrgAccessLog({ organizationId: organization.id, limit: 100 })
            .then((data) => setItems(data?.items || []))
            .catch(() => toast.error('Erro ao carregar log de acesso.'))
            .finally(() => setIsLoading(false));
    }, [organization.id]);

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
                <ScrollText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-medium">Log de Acesso e Auditoria</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Últimas 100 aberturas de registros com restrição de acesso e exportações de tabela neste órgão.
            </p>
            {isLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Nenhum evento registrado ainda.</p>
            ) : (
                <div className="max-h-80 overflow-y-auto space-y-1.5">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800 text-sm">
                            <div className="min-w-0">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{item.user_name}</span>
                                <span className="text-slate-500 dark:text-slate-400"> — {ACTION_LABELS[item.action] || item.action}</span>
                            </div>
                            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                                {item.timestamp ? new Date(item.timestamp).toLocaleString('pt-BR') : ''}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DataRetentionSection({ organization }) {
    const [config, setConfig] = useState(organization.retentionConfig || { enabled: false, anonymizeAfterDays: 365 });
    // Sem isto, trocar de órgão sem recarregar a página mantinha a config do
    // órgão anterior no formulário — clicar em "Salvar" gravaria a política
    // de retenção de um órgão em outro (updateOrganization usa organization.id
    // atual, mas `config` continuava sendo o valor antigo em memória).
    useEffect(() => {
        setConfig(organization.retentionConfig || { enabled: false, anonymizeAfterDays: 365 });
    }, [organization.id]);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [running, setRunning] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateOrganization({ organizationId: organization.id, data: { retentionConfig: config } });
            toast.success('Política de retenção atualizada!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        setIsPreviewing(true);
        setPreview(null);
        try {
            const data = await previewAnonymization({ organizationId: organization.id });
            setPreview(data);
            if (data.totalEligible === 0) {
                toast.info('Nenhum registro elegível para anonimização no momento.');
            }
        } catch (error) {
            toast.error('Erro ao pré-visualizar: ' + error.message);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirmAnonymize = async () => {
        if (!preview?.items?.length) return;
        setRunning(true);
        try {
            const ids = preview.items.map((i) => i.id);
            const result = await runAnonymization({ organizationId: organization.id, ids });
            toast.success(`${result.anonymizedCount} registro(s) anonimizado(s).`);
            setPreview(null);
            setConfirmOpen(false);
        } catch (error) {
            toast.error('Erro ao anonimizar: ' + error.message);
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-medium">Política de Retenção e Anonimização</h3>
            </div>
            <Alert variant="destructive" className="mb-4">
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                    Ação irreversível. A anonimização substitui o nome do consulente em Consultas arquivadas
                    há mais do que o prazo abaixo — só acontece após pré-visualizar e confirmar explicitamente,
                    nunca automaticamente.
                </AlertDescription>
            </Alert>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Label>Habilitar política neste órgão</Label>
                    <Switch checked={config.enabled} onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))} />
                </div>
                <div>
                    <Label htmlFor="anonymizeAfterDays">Anonimizar após (dias corridos desde o arquivamento)</Label>
                    <Input
                        id="anonymizeAfterDays"
                        type="number"
                        min={1}
                        max={3650}
                        value={config.anonymizeAfterDays}
                        onChange={(e) => setConfig((c) => ({ ...c, anonymizeAfterDays: Number(e.target.value) }))}
                        className="mt-1 max-w-xs"
                    />
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </Button>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={handlePreview} disabled={isPreviewing} className="gap-2">
                    {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Pré-visualizar registros elegíveis
                </Button>

                {preview && preview.totalEligible > 0 && (
                    <div className="mt-4 space-y-3">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            <strong>{preview.totalEligible}</strong> Consulta(s) elegível(is)
                            {preview.totalEligible > preview.items.length ? ` (mostrando os primeiros ${preview.items.length})` : ''}:
                        </p>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                            {preview.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-xs px-3 py-1.5 rounded border border-slate-100 dark:border-slate-800">
                                    <span className="font-medium">{item.process_number || '(sem número)'}</span>
                                    <span className="text-slate-500 dark:text-slate-400">{item.consultant}</span>
                                </div>
                            ))}
                        </div>
                        <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="gap-2">
                            <Eraser className="w-4 h-4" />
                            Confirmar e anonimizar {preview.items.length} registro(s)
                        </Button>
                    </div>
                )}
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Anonimizar {preview?.items?.length || 0} registro(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação é IRREVERSÍVEL. O nome do consulente será substituído permanentemente em cada
                            um dos registros listados. Tem certeza que deseja continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={running}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAnonymize} disabled={running} className="bg-red-600 hover:bg-red-700">
                            {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Sim, anonimizar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function WebhooksSection({ organization }) {
    const [config, setConfig] = useState(organization.webhookConfig || { enabled: false, url: '', events: ['urgent_created', 'archived'] });
    // Mesma razão da correção equivalente em DataRetentionSection: sem isto,
    // trocar de órgão podia salvar o webhook de um órgão em outro.
    useEffect(() => {
        setConfig(organization.webhookConfig || { enabled: false, url: '', events: ['urgent_created', 'archived'] });
    }, [organization.id]);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateOrganization({ organizationId: organization.id, data: { webhookConfig: config } });
            toast.success('Webhook atualizado!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            await testOrgWebhook({ organizationId: organization.id });
            toast.success('Disparo de teste enviado com sucesso!');
        } catch (error) {
            toast.error('Falha no teste: ' + error.message);
        } finally {
            setTesting(false);
        }
    };

    const toggleEvent = (eventKey) => {
        setConfig((c) => {
            const events = c.events || [];
            return { ...c, events: events.includes(eventKey) ? events.filter((e) => e !== eventKey) : [...events, eventKey] };
        });
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
                <Webhook className="w-5 h-5 text-violet-600" />
                <h3 className="text-lg font-medium">Webhooks de Integração Externa</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Envia um HTTP POST em JSON para a URL abaixo a cada evento selecionado — use para integrar com Slack, Teams ou um sistema próprio.
            </p>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Label>Habilitar webhook neste órgão</Label>
                    <Switch checked={config.enabled} onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))} />
                </div>
                <div>
                    <Label htmlFor="webhookUrl">URL de destino (https)</Label>
                    <Input
                        id="webhookUrl"
                        value={config.url}
                        onChange={(e) => setConfig((c) => ({ ...c, url: e.target.value }))}
                        placeholder="https://hooks.slack.com/services/..."
                        className="mt-1"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Eventos</Label>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-sm">Nova Consulta/Expediente urgente</span>
                        <Switch checked={(config.events || []).includes('urgent_created')} onCheckedChange={() => toggleEvent('urgent_created')} />
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-sm">Consulta/Expediente arquivado</span>
                        <Switch checked={(config.events || []).includes('archived')} onCheckedChange={() => toggleEvent('archived')} />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" onClick={handleTest} disabled={testing || !config.url} className="gap-2">
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Testar
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Painel administrativo (só Criador): log de acesso/auditoria, retenção e
// anonimização, e webhooks de integração externa. Cada seção só aparece se a
// respectiva flag de plataforma estiver ligada. A autenticação em duas etapas
// é uma preferência PESSOAL (não do órgão) — configurada em Meu Perfil.
export default function SecuritySettings({ organization }) {
    const isAccessAuditLogOn = useFlag(FEATURE_FLAGS.ACCESS_AUDIT_LOG.key);
    const isRetentionOn = useFlag(FEATURE_FLAGS.DATA_RETENTION_POLICY.key);
    const isWebhooksOn = useFlag(FEATURE_FLAGS.OUTBOUND_WEBHOOKS.key);

    if (!isAccessAuditLogOn && !isRetentionOn && !isWebhooksOn) {
        return (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                Nenhuma funcionalidade de segurança adicional está habilitada na plataforma no momento.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isAccessAuditLogOn && <AccessAuditLogSection organization={organization} />}
            {isRetentionOn && <DataRetentionSection organization={organization} />}
            {isWebhooksOn && <WebhooksSection organization={organization} />}
        </div>
    );
}
