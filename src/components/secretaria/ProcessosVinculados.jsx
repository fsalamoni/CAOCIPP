// ============================================================================
// "Processos eletrônicos" de um registro de outro módulo (Consultas,
// Expedientes, Parcerias, Júri) ou de outro processo ('pe'): os processos
// ligados a ele e o botão para criar um processo que nasce dele.
// Só aparece com o Processo Eletrônico ativo e a integração ligada pelo admin.
// Nada é escrito no outro módulo: a ligação fica no processo (`vinculos`).
// ============================================================================

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gavel, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganizationRealtime } from '@/hooks/useFirestore';
import { secConfig, secProcesso } from '@/services/secretariaService';
import { useOrgPermission } from '@/lib/OrganizationPermissionsContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { STATUS_ROTULO } from './comum';

/** `registro` = { modulo, id, numero, titulo } (o que aparece como origem do novo processo). */
export default function ProcessosVinculados({ orgId, registro, rotuloCriar = 'Criar processo eletrônico', titulo = 'Processos eletrônicos', className = '' }) {
    const navigate = useNavigate();
    const { organization } = useOrganizationRealtime(registro?.modulo === 'pe' ? null : orgId);
    const cfg = organization?.secretariaConfig;
    const mostrar = !!orgId && !!registro?.id && (registro.modulo === 'pe' || (cfg?.enabled === true && cfg?.integracoes?.[registro.modulo] === true));
    const q = useQuery({
        queryKey: ['sec-vinculados', orgId, registro?.modulo, registro?.id],
        queryFn: () => secProcesso(orgId, 'vinculados', { modulo: registro.modulo, id: registro.id }),
        enabled: mostrar,
        retry: false,
    });
    // PE ou integração desligada: quem configura o PE vê o atalho para ligar; os demais, nada.
    if (!mostrar) return registro?.modulo !== 'pe' && organization ? <OfertaPE orgId={orgId} cfg={cfg} modulo={registro?.modulo} className={className} /> : null;
    // Erro (sem acesso, módulo suspenso) ou integração desligada: o painel some.
    if (q.isError || (q.data && !q.data.ligada)) return null;
    const lista = q.data?.processos || [];
    // Nada ligado e a pessoa não autua: não há o que mostrar.
    if (q.data && !lista.length && !q.data.pode_autuar) return null;
    const criar = () => navigate(`/ProcessoEletronico?org=${orgId}&de=${registro.modulo}:${registro.id}`, { state: { semente: registro } });

    return (
        <section aria-label={titulo} className={`rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden /> {titulo}{q.data ? ` (${lista.length}${q.data.mais ? '+' : ''})` : ''}
                </h3>
                {q.data?.pode_autuar && <Button size="sm" variant="outline" className="gap-1" onClick={criar}><Plus className="w-4 h-4" aria-hidden /> {rotuloCriar}</Button>}
            </div>
            {q.isLoading ? (
                <p role="status" className="text-xs text-slate-600 dark:text-slate-400">Procurando processos…</p>
            ) : lista.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lista.map((p) => (
                        <li key={p.id} className="py-1.5">
                            <Link to={`/ProcessoEletronico?org=${orgId}&p=${p.id}`} className="text-sm text-indigo-700 dark:text-indigo-300 hover:underline">
                                <span className="font-mono">{p.numero}</span> · {p.assunto}
                            </Link>
                            <div className="flex flex-wrap gap-1 mt-0.5 text-xs">
                                <Badge variant="outline" className="font-normal">{p.fase_nome}</Badge>
                                <Badge variant="secondary" className="font-normal">{STATUS_ROTULO[p.status] || p.status}</Badge>
                                {p.origem && <Badge variant="outline" className="font-normal">nasceu daqui</Badge>}
                                {p.sigilo === 'restrito' && <Badge variant="outline" className="font-normal">restrito</Badge>}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400">Nenhum processo eletrônico ligado{registro.modulo === 'pe' ? ' a este processo' : ' a este registro'}.</p>
            )}
        </section>
    );
}

/**
 * Registros deste módulo que têm processo eletrônico que a pessoa vê, para o
 * selo e o filtro das listas: { ids: Set, truncado } ou null (PE ou integração
 * desligada, ou sem acesso). Mesma chave que a busca (Ctrl+K) usa.
 */
export function useComPE(organization, modulo) {
    const cfg = organization?.secretariaConfig;
    const ligado = !!organization?.id && cfg?.enabled === true && cfg?.suspensa_plataforma !== true && cfg?.integracoes?.[modulo] === true;
    const q = useQuery({
        queryKey: ['sec-processos', organization?.id, 'indice'],
        // Falha (sem acesso, PE suspenso) fica guardada como null pelo mesmo tempo: não chama de novo a cada tela.
        queryFn: () => secProcesso(organization.id, 'indice').catch(() => null),
        enabled: ligado, staleTime: 5 * 60e3, retry: false,
    });
    return useMemo(() => (ligado && q.data ? { ids: new Set(q.data.com?.[modulo] || []), truncado: q.data.truncado === true } : null), [ligado, q.data, modulo]);
}

export const SeloPE = () => (
    <Badge variant="outline" role="img" title="Tem processo eletrônico" aria-label="Tem processo eletrônico" className="gap-0.5 px-1 py-0 text-[10px] font-semibold border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-300 shrink-0">
        <Gavel className="w-3 h-3" aria-hidden />PE
    </Badge>
);

/** Filtro "Processo eletrônico": qualquer, com ou sem (o "sem" some se a leitura foi cortada). */
export function FiltroPE({ pe, value, onChange, className = 'text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider' }) {
    if (!pe) return null;
    return (
        <div className="space-y-1.5">
            <p className={className}>Processo eletrônico</p>
            <Select value={peAtivo(pe, value) ? value : 'all'} onValueChange={onChange}>
                <SelectTrigger aria-label="Processo eletrônico" className="h-9"><SelectValue placeholder="Qualquer" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Qualquer</SelectItem>
                    <SelectItem value="com">Com processo eletrônico</SelectItem>
                    {!pe.truncado && <SelectItem value="sem">Sem processo eletrônico</SelectItem>}
                </SelectContent>
            </Select>
        </div>
    );
}

/** O filtro vale? "Sem" não vale quando a leitura foi cortada (viria de uma visão salva). */
export const peAtivo = (pe, valor) => !!pe && !!valor && valor !== 'all' && !(valor === 'sem' && pe.truncado);

/** Aplica o filtro "Processo eletrônico" (só os processos que a pessoa vê contam). */
export const filtrarPE = (lista, pe, valor) => (peAtivo(pe, valor) ? lista.filter((r) => pe.ids.has(r.id) === (valor === 'com')) : lista);

const NOME_MODULO = { consultas: 'Consultas', expedientes: 'Expedientes', parcerias: 'Parcerias', juri: 'Júri' };

/**
 * Atalho para quem configura o PE (criador ou configure_secretaria; o servidor
 * confere): ativar o Processo Eletrônico e ligar a integração com este módulo
 * de onde a pessoa está. "Agora não" vale para este navegador.
 */
function OfertaPE({ orgId, cfg, modulo, className = '' }) {
    const podeConfigurar = useOrgPermission('configure_secretaria');
    const chave = `pe-atalho-off:${orgId}:${modulo}`;
    const [dispensado, setDispensado] = useState(() => { try { return localStorage.getItem(chave) === '1'; } catch { return false; } });
    const [confirmar, setConfirmar] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const qc = useQueryClient();
    if (!podeConfigurar || dispensado || cfg?.suspensa_plataforma === true || !NOME_MODULO[modulo]) return null;
    const desligado = cfg?.enabled !== true;
    const agoraNao = () => { try { localStorage.setItem(chave, '1'); } catch { /* sem armazenamento: só some agora */ } setDispensado(true); };
    const ligar = async () => {
        setSalvando(true);
        try {
            if (desligado) await secConfig(orgId, 'ativar', { enabled: true });
            // O servidor grava o mapa inteiro: as outras integrações seguem como estão.
            await secConfig(orgId, 'salvarIntegracoes', { integracoes: { ...(cfg?.integracoes || {}), [modulo]: true } });
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            toast.success(desligado ? `Processo Eletrônico ativado e ligado a ${NOME_MODULO[modulo]}` : `Integração com ${NOME_MODULO[modulo]} ligada`);
            setConfirmar(false);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível ligar');
        } finally { setSalvando(false); }
    };
    return (
        <section aria-label="Processo Eletrônico" className={`rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-3 flex flex-wrap items-center justify-between gap-2 ${className}`}>
            <p className="text-sm text-indigo-900 dark:text-indigo-100 flex items-center gap-2 min-w-0">
                <Gavel className="w-4 h-4 shrink-0" aria-hidden />
                {desligado ? 'Processo Eletrônico desligado neste órgão.' : `Integração do Processo Eletrônico com ${NOME_MODULO[modulo]} desligada.`}
            </p>
            <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={agoraNao}>Agora não</Button>
                <Button size="sm" onClick={() => setConfirmar(true)}>{desligado ? 'Ativar e ligar' : 'Ligar integração'}</Button>
            </div>
            <AlertDialog open={confirmar} onOpenChange={(v) => !salvando && setConfirmar(v)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{desligado ? 'Ativar o Processo Eletrônico?' : `Ligar a integração com ${NOME_MODULO[modulo]}?`}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {desligado && 'Na primeira ativação, a plataforma cria a unidade "Secretaria" com você lotado como gestor e um "Rito comum". '}
                            {`Os registros de ${NOME_MODULO[modulo]} passam a mostrar os processos ligados e o botão para criar um processo a partir deles. Nada é apagado, e dá para desligar no Painel Administrativo.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={salvando} onClick={(e) => { e.preventDefault(); ligar(); }}>{salvando ? 'Ligando…' : desligado ? 'Ativar e ligar' : 'Ligar'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
