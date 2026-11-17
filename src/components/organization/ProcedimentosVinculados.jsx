import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { format, isValid } from 'date-fns';
import { FilePlus2, ExternalLink, Link2, User } from 'lucide-react';
import { db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { parseLocalDate } from '@/lib/dateUtils';
import { MODULOS_PGEA, raizDe } from '@/lib/registrosPgea';
import { calculateDerivedStatus } from '@/utils/processUtils';
import { calculateExpedienteDerivedStatus } from '@/utils/expedienteUtils';
import NovoAditivoDialog from './NovoAditivoDialog';

const dataBR = (v) => { const d = parseLocalDate(v); return d && isValid(d) ? format(d, 'dd/MM/yyyy') : ''; };

/**
 * Ficha de Consulta ou Expediente: o original e os aditivos da mesma família,
 * cada um com a sua fase e responsável, e o botão para criar um aditivo.
 * Lê ao vivo do banco (o original pode estar fora da página carregada).
 */
export default function ProcedimentosVinculados({ modulo, registro, organization, members, onAbrir }) {
    const cfg = MODULOS_PGEA[modulo];
    const raizId = raizDe(registro);
    const orgId = registro?.organization_id;
    const [raiz, setRaiz] = useState(null);
    const [aditivos, setAditivos] = useState([]);
    const [criando, setCriando] = useState(false);
    // A ficha pode estar com uma cópia antiga do registro: depois de criar, já mostra a família.
    const [criouEm, setCriouEm] = useState(null);
    const temFamilia = criouEm === registro?.id || Boolean(registro?.aditivo_de) || (Number(registro?.aditivos_count) || 0) > 0;

    useEffect(() => {
        if (!raizId || !orgId || !temFamilia) { setRaiz(null); setAditivos([]); return undefined; }
        const off1 = onSnapshot(doc(db, cfg.colecao, raizId), (s) => setRaiz(s.exists() ? { id: s.id, ...s.data() } : null), () => setRaiz(null));
        const off2 = onSnapshot(
            query(collection(db, cfg.colecao), where('organization_id', '==', orgId), where('aditivo_de', '==', raizId)),
            (s) => setAditivos(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.aditivo_numero || 0) - (b.aditivo_numero || 0))),
            () => setAditivos([])
        );
        return () => { off1(); off2(); };
    }, [cfg.colecao, raizId, orgId, temFamilia]);

    const familia = useMemo(() => [raiz, ...aditivos].filter(Boolean), [raiz, aditivos]);
    const fase = modulo === 'consultas' ? calculateDerivedStatus : calculateExpedienteDerivedStatus;

    return (
        <div>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                Original e aditivos
            </h3>
            {temFamilia ? (
                <ul className="space-y-2" aria-label="Procedimentos vinculados">
                    {familia.map((r) => {
                        const atual = r.id === registro.id;
                        const rotulo = r.aditivo_de ? `Aditivo ${r.aditivo_numero}` : 'Original';
                        return (
                            <li
                                key={r.id}
                                className={`rounded-lg border p-3 ${atual ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
                                aria-current={atual ? 'true' : undefined}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-xs font-bold ${r.aditivo_de ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100'}`}>{rotulo}</span>
                                    <StatusBadge status={fase(r)} />
                                    {atual && <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300">· você está aqui</span>}
                                </div>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                    <User className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
                                    {r.responsible_user_name || 'Sem responsável'}
                                    {dataBR(r.entry_date) && <span className="text-slate-400 dark:text-slate-500"> · entrada em {dataBR(r.entry_date)}</span>}
                                </p>
                                {r.aditivo_motivo && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">Motivo: {r.aditivo_motivo}</p>}
                                {!atual && onAbrir && (
                                    <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 px-2 -ml-2 gap-1.5 text-indigo-700 dark:text-indigo-300" onClick={() => onAbrir(r)}>
                                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                        Abrir {rotulo.toLowerCase()}
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                    {familia.length === 0 && <li className="text-xs text-slate-500 dark:text-slate-400">Carregando os vinculados…</li>}
                </ul>
            ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sem aditivos. Use um aditivo quando {cfg.a === 'a' ? 'esta consulta' : 'este expediente'} precisar de nova tramitação, sem mexer no que já foi feito.
                </p>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setCriando(true)}>
                <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                Criar aditivo
            </Button>
            <NovoAditivoDialog
                open={criando}
                onOpenChange={setCriando}
                modulo={modulo}
                organization={organization || { id: orgId }}
                members={members}
                origem={registro}
                onCriado={() => setCriouEm(registro?.id)}
            />
        </div>
    );
}
