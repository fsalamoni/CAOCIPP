import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { History, Loader2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ErroQuery from './ErroQuery';

const ROTULOS = {
    SECRETARIA_ATIVADA: 'Módulo ativado', SECRETARIA_DESATIVADA: 'Módulo desativado', SECRETARIA_PREFERENCIAS: 'Preferências alteradas',
    SECRETARIA_UNIDADE_SALVA: 'Unidade salva', SECRETARIA_UNIDADE_DOCUMENTO: 'Timbrado ou tipos da unidade', SECRETARIA_EQUIPE_CONVITE: 'Convite à equipe',
    SECRETARIA_EQUIPE_CONVITE_REVOGADO: 'Convite revogado', SECRETARIA_LOTACAO_ADMITIDA: 'Pedido de lotação admitido', SECRETARIA_LOTACAO_RECUSADA: 'Pedido de lotação recusado',
    SECRETARIA_RITO_SALVO: 'Rito salvo', SECRETARIA_RITO_IMPLANTADO: 'Rito implantado de arquivo', SECRETARIA_TIPO_SALVO: 'Tipo de processo salvo',
    SECRETARIA_DOCUMENTO_CONFIG: 'Papel timbrado do órgão', SECRETARIA_MODELO_SALVO: 'Modelo salvo', SECRETARIA_CALENDARIO: 'Calendário salvo',
    SECRETARIA_VERSAO_RESTAURADA: 'Versão anterior restaurada',
};
const OCULTOS = new Set(['modelo_id', 'rito_id', 'tipo_id', 'unidade_id', 'id', 'convite_id']);

/** Quem mudou o quê e quando na configuração do módulo (lê auditLogs, só admins). */
export default function HistoricoConfiguracao({ orgId }) {
    const q = useQuery({
        queryKey: ['sec-historico', orgId],
        queryFn: async () => {
            const snap = await getDocs(query(collection(db, 'auditLogs'),
                where('organization_id', '==', orgId), where('action', '>=', 'SECRETARIA_'), where('action', '<', 'SECRETARIA`'),
                orderBy('action'), orderBy('timestamp', 'desc'), limit(300)));
            return snap.docs.map((d) => ({ id: d.id, ...d.data(), em: d.data().timestamp?.toDate?.() || null }))
                .sort((a, b) => (b.em?.getTime() || 0) - (a.em?.getTime() || 0));
        },
    });
    if (q.isLoading) return <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando o histórico…</p>;
    if (q.error) return <ErroQuery q={q} />;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" aria-hidden /> Histórico de configuração</CardTitle>
                <CardDescription>Quem mudou o quê e quando, nas últimas 300 alterações do módulo. Ritos e modelos guardam as versões anteriores; restaure pelo botão "Versões" de cada um.</CardDescription>
            </CardHeader>
            <CardContent>
                {q.data.length === 0 && <p className="text-sm text-slate-600">Nenhuma alteração registrada ainda.</p>}
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                    {q.data.map((e) => (
                        <li key={e.id} className="py-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <time className="text-slate-600 dark:text-slate-400 tabular-nums w-36 shrink-0" dateTime={e.em?.toISOString()}>{e.em ? e.em.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</time>
                            <span className="font-medium text-slate-900 dark:text-white">{ROTULOS[e.action] || e.action.replace('SECRETARIA_', '').toLowerCase().replace(/_/g, ' ')}</span>
                            <span className="text-slate-600 dark:text-slate-300">{e.user_name || 'alguém'}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 basis-full sm:basis-auto">
                                {Object.entries(e.details || {}).filter(([k, v]) => !OCULTOS.has(k) && v !== null && v !== undefined && v !== '').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}
                            </span>
                        </li>
                    ))}
                </ol>
            </CardContent>
        </Card>
    );
}
