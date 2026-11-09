import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gavel, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { secConfig } from '@/services/secretariaService';
import ConfiguracaoProcessoEletronico from './ConfiguracaoProcessoEletronico';
import PrimeirosPassos from './PrimeirosPassos';
import PreviaRito from './PreviaRito';

/**
 * Painel Administrativo do órgão → Processo Eletrônico: liga ou desliga o
 * módulo, preferências e toda a configuração (unidades e equipes, tipos de
 * processo, ritos, documentos e modelos, calendário). Desligar só esconde a
 * página e bloqueia movimentações; nada é apagado.
 */
export default function ProcessoEletronicoAdmin({ organization }) {
    const qc = useQueryClient();
    const orgId = organization.id;
    const [saving, setSaving] = useState(false);
    const [aba, setAba] = useState('unidades');
    const estadoQ = useQuery({ queryKey: ['sec-estado', orgId], queryFn: () => secConfig(orgId, 'estado') });
    const estado = estadoQ.data;
    const enabled = estado ? estado.enabled === true : organization?.secretariaConfig?.enabled === true;

    const salvar = async (action, payload, ok) => {
        setSaving(true);
        try {
            await secConfig(orgId, action, payload);
            toast.success(ok);
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Gavel className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mt-1" aria-hidden />
                            <div>
                                <CardTitle>Processo Eletrônico</CardTitle>
                                <CardDescription className="mt-1">
                                    Autuação com rito, tramitação entre secretarias, gabinetes e assessorias, documentos redigidos
                                    ou enviados, assinatura, juntada com folhas, portal das partes e exportação dos autos em PDF.
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                            <Switch checked={enabled} disabled={saving || estadoQ.isLoading} onCheckedChange={(v) => salvar('ativar', { enabled: v }, v ? 'Processo Eletrônico ativado' : 'Processo Eletrônico desativado')} aria-label="Ativar o Processo Eletrônico" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    {!enabled && <p>Na primeira ativação, a plataforma cria a unidade “Secretaria” com você lotado como gestor e um “Rito comum”. Desativar esconde a página e bloqueia movimentações; nada é apagado.</p>}
                    {estado?.suspensa_plataforma && (
                        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 text-amber-900 dark:text-amber-100 p-3">
                            A administração da plataforma suspendeu o módulo neste órgão{estado.motivo_suspensao ? `: ${estado.motivo_suspensao}` : ''}. Nada foi apagado.
                        </p>
                    )}
                    {enabled && estado && (
                        <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-slate-200 dark:border-slate-700 p-3">
                            <div className="flex-1 min-w-[14rem]">
                                <p className="font-medium text-slate-800 dark:text-slate-100">Petição da parte interrompe a fase</p>
                                <p>Ligado, cada petição pelo portal das partes suspende a fase até o gabinete apreciá-la. Desligado, a petição abre pendência e a fase segue.</p>
                            </div>
                            <Switch checked={estado.peticao_interrompe === true} disabled={saving} onCheckedChange={(v) => salvar('salvarPreferencias', { peticao_interrompe: v }, 'Preferência salva')} aria-label="Petição da parte interrompe a fase" />
                        </div>
                    )}
                    {enabled && (
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="gap-2">
                                <Link to={`${createPageUrl('ProcessoEletronico')}?org=${orgId}`}>Abrir o Processo Eletrônico <ExternalLink className="w-4 h-4" aria-hidden /></Link>
                            </Button>
                            {estado?.isAdmin && <PreviaRito estado={estado} />}
                        </div>
                    )}
                </CardContent>
            </Card>

            {enabled && estado?.isAdmin && <PrimeirosPassos estado={estado} onIr={setAba} />}

            {estadoQ.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando a configuração…</p>}
            {estadoQ.error && <p role="alert" className="text-sm text-red-600">{estadoQ.error.message}</p>}
            {estado?.isAdmin && <ConfiguracaoProcessoEletronico orgId={orgId} estado={estado} aba={aba} onAba={setAba} />}
        </div>
    );
}
