import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { MODULOS, integracoesLigadas } from '@/lib/camposProcesso';
import { ABAS_CONFIG, abaInicial } from '@/lib/passosConfiguracao';
import { RegistroContexto } from './SeletorRegistro';

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
    const estadoQ = useQuery({ queryKey: ['sec-estado', orgId], queryFn: () => secConfig(orgId, 'estado') });
    const estado = estadoQ.data;
    // Aba no endereço (?aba=), para voltar ao mesmo lugar e compartilhar o link. Sem ela, abre no
    // primeiro passo pendente (ou em Ritos), calculado uma vez: concluir um passo não troca a aba.
    const [params, setParams] = useSearchParams();
    const inicial = useRef(null);
    if (estado && !inicial.current) inicial.current = abaInicial(estado);
    const aba = ABAS_CONFIG.includes(params.get('aba')) ? params.get('aba') : (inicial.current || 'unidades');
    const setAba = (v) => { const n = new URLSearchParams(params); n.set('aba', v); setParams(n, { replace: true }); };
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
        <RegistroContexto.Provider value={{ orgId, ligadas: integracoesLigadas(estado) }}>
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
            {estado?.isAdmin && (
                <ConfiguracaoProcessoEletronico orgId={orgId} estado={estado} aba={aba} onAba={setAba}
                    integracoes={<Integracoes estado={estado} saving={saving} onSalvar={(integracoes, ok) => salvar('salvarIntegracoes', { integracoes }, ok)} />}
                    preferencias={<Preferencias estado={estado} saving={saving} onSalvar={(p, ok) => salvar('salvarPreferencias', p, ok)} />} />
            )}
        </div>
        </RegistroContexto.Provider>
    );
}

/** Regras que valem para todos os processos do órgão. */
function Preferencias({ estado, saving, onSalvar }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Preferências</CardTitle>
                <CardDescription>Regras que valem para todos os processos do órgão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex-1 min-w-[14rem]">
                        <p className="font-medium text-slate-800 dark:text-slate-100">Petição da parte interrompe a fase</p>
                        <p>Ligado, cada petição pelo portal das partes suspende a fase até o gabinete apreciá-la. Desligado, a petição abre pendência e a fase segue.</p>
                    </div>
                    <Switch checked={estado.peticao_interrompe === true} disabled={saving} onCheckedChange={(v) => onSalvar({ peticao_interrompe: v, ciencia_dias: estado.ciencia_dias }, 'Preferência salva')} aria-label="Petição da parte interrompe a fase" />
                </div>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex-1 min-w-[14rem]">
                        <label htmlFor="ciencia-dias" className="font-medium text-slate-800 dark:text-slate-100">Ciência por decurso</label>
                        <p>Intimação ou outra comunicação feita pela plataforma que a parte não abrir neste número de dias corridos é dada por ciente, e o prazo começa a contar. Zero desliga: só a parte dá ciência.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input id="ciencia-dias" key={estado.ciencia_dias} type="number" min={0} max={90} defaultValue={estado.ciencia_dias ?? 10} disabled={saving}
                            className="h-10 w-20 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900"
                            onBlur={(e) => { const n = Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))); if (n !== estado.ciencia_dias) onSalvar({ peticao_interrompe: estado.peticao_interrompe === true, ciencia_dias: n }, 'Preferência salva'); }} />
                        <span>dias</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Integrações com os outros módulos do órgão: ligada, o tipo de processo pode
 * ter campo e o rito pode ter ação que escolhe um registro do módulo. Desligar
 * não apaga nada do que os processos já guardaram.
 */
function Integracoes({ estado, saving, onSalvar }) {
    const gravadas = estado.integracoes || {};
    const ativos = estado.modulos_ativos || {};
    const DESCRICAO = {
        consultas: 'Ligar o processo à consulta que o originou ou que ele responde.',
        expedientes: 'Ligar o processo a um expediente do órgão.',
        parcerias: 'Ligar o processo a uma parceria (convênio, termo de cooperação ou fomento).',
        juri: 'Ligar o processo a um júri da base de Jurimetria.',
    };
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Integrações com outros módulos</CardTitle>
                <CardDescription>
                    Ligada, o tipo de processo pode ter um campo e o rito pode ter uma ação que escolhe um registro do módulo, pelo número ou assunto.
                    O processo guarda só o número e o título; as partes veem só o número, e nunca o de acesso restrito. A ficha de cada registro passa a mostrar os processos ligados e o botão "Criar processo eletrônico". Desligar não apaga nada; os módulos continuam funcionando como sempre.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
                {MODULOS.map(([m, rotulo]) => {
                    const ativo = ativos[m] === true;
                    return (
                        <div key={m} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 dark:border-slate-700 p-3">
                            <div className="min-w-0 text-sm">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{rotulo}</p>
                                <p className="text-slate-600 dark:text-slate-400">{ativo ? DESCRICAO[m] : 'O módulo não está ativo neste órgão. Ative em Páginas e módulos para poder integrar.'}</p>
                            </div>
                            <Switch checked={ativo && gravadas[m] === true} disabled={saving || !ativo} aria-label={`Integrar ${rotulo} aos processos`}
                                onCheckedChange={(v) => onSalvar({ ...gravadas, [m]: v }, v ? `${rotulo} integrado aos processos` : `Integração com ${rotulo} desligada`)} />
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
