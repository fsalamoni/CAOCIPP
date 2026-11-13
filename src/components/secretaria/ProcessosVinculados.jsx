// ============================================================================
// "Processos eletrônicos" de um registro de outro módulo (Consultas,
// Expedientes, Parcerias, Júri) ou de outro processo ('pe'): os processos
// ligados a ele e o botão para criar um processo que nasce dele.
// Só aparece com o Processo Eletrônico ativo e a integração ligada pelo admin.
// Nada é escrito no outro módulo: a ligação fica no processo (`vinculos`).
// ============================================================================

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganizationRealtime } from '@/hooks/useFirestore';
import { secProcesso } from '@/services/secretariaService';
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
    // Erro (sem acesso, módulo suspenso) ou integração desligada: o painel some.
    if (!mostrar || q.isError || (q.data && !q.data.ligada)) return null;
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
