import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Gavel, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { secConfig } from '@/services/secretariaService';

// Painel do admin do órgão: liga ou desliga a Secretaria Processual. Desligar
// só esconde a página e bloqueia movimentações; nenhum processo é apagado.
export default function SecretariaAtivacao({ organization }) {
    const [enabled, setEnabled] = useState(organization?.secretariaConfig?.enabled === true);
    const [saving, setSaving] = useState(false);
    const [interrompe, setInterrompe] = useState(organization?.secretariaConfig?.peticao_interrompe === true);

    const alternarInterrompe = async (valor) => {
        setSaving(true);
        try {
            await secConfig(organization.id, 'salvarPreferencias', { peticao_interrompe: valor });
            setInterrompe(valor);
            toast.success('Preferência salva');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSaving(false);
        }
    };

    const alternar = async (valor) => {
        setSaving(true);
        try {
            await secConfig(organization.id, 'ativar', { enabled: valor });
            setEnabled(valor);
            toast.success(valor ? 'Secretaria Processual ativada' : 'Secretaria Processual desativada');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" />
                        <div>
                            <CardTitle>Secretaria Processual</CardTitle>
                            <CardDescription className="mt-1">
                                Processo eletrônico do órgão: autuação com rito, tramitação entre secretarias e gabinetes,
                                documentos redigidos ou enviados, assinatura, juntada, linha do tempo com integridade por
                                hash e exportação dos autos em PDF.
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        <Switch checked={enabled} disabled={saving} onCheckedChange={alternar} aria-label="Ativar Secretaria Processual" />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                    Na primeira ativação, a plataforma cria uma unidade “Secretaria” com você lotado e um “Rito comum”.
                    Tipos de processo, ritos, unidades e lotações, papel timbrado, tipos de documento e modelos se ajustam
                    na aba Configuração da própria Secretaria.
                </p>
                {organization.secretariaConfig?.suspensa_plataforma && (
                    <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 text-amber-900 dark:text-amber-100 p-3">
                        A administração da plataforma suspendeu o módulo neste órgão{organization.secretariaConfig?.motivo_suspensao ? `: ${organization.secretariaConfig.motivo_suspensao}` : ''}. Nada foi apagado.
                    </p>
                )}
                <p>Desativar esconde a página e bloqueia movimentações. Nenhum processo ou documento é apagado.</p>
                {enabled && (
                    <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 dark:border-slate-700 p-3">
                        <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">Petição da parte interrompe a fase</p>
                            <p>Quando ligado, cada petição protocolada pelo portal das partes suspende a fase até o gabinete apreciá-la. Desligado, a petição abre pendência e a fase segue.</p>
                        </div>
                        <Switch checked={interrompe} disabled={saving} onCheckedChange={alternarInterrompe} aria-label="Petição da parte interrompe a fase" />
                    </div>
                )}
                {enabled && (
                    <Button asChild variant="outline" className="gap-2">
                        <Link to={`${createPageUrl('Secretaria')}?org=${organization.id}`}>
                            Abrir a Secretaria e a configuração <ExternalLink className="w-4 h-4" />
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
