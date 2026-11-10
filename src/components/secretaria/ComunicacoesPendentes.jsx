import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secPortal } from '@/services/secretariaService';
import { SeloUrgente, dataHora } from './comum';
import { brData } from './Comunicacoes';

const CHAVE = 'comunicacoes-ver-depois';
const adiadas = () => { try { return JSON.parse(sessionStorage.getItem(CHAVE) || '[]'); } catch { return []; } };

/**
 * Aviso ao entrar: intimações e demais comunicações que aguardam a ciência
 * desta conta, uma por vez. "Ver depois" vale só para esta sessão do
 * navegador; a comunicação continua aguardando (e o decurso continua a correr).
 */
export default function ComunicacoesPendentes({ onAbrirProcesso }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['portal-comunicacoes'], queryFn: () => secPortal('comunicacoes'), staleTime: 60000 });
    const [puladas, setPuladas] = useState(adiadas);
    const [ocupado, setOcupado] = useState(false);
    const [feita, setFeita] = useState(null); // { com, vence_em, prazo } depois da ciência

    const fila = (q.data?.comunicacoes || []).filter((c) => !puladas.includes(c.id));
    const atual = feita?.com || fila[0];
    if (!atual) return null;
    const restam = fila.filter((c) => c.id !== atual.id).length;

    const pular = () => {
        const nova = [...puladas, atual.id];
        try { sessionStorage.setItem(CHAVE, JSON.stringify(nova)); } catch { /* sem armazenamento: vale até recarregar */ }
        setPuladas(nova);
    };
    const darCiencia = async () => {
        setOcupado(true);
        try {
            const r = await secPortal('darCiencia', { processoId: atual.processoId, comunicacaoId: atual.id });
            setFeita({ com: atual, ...r });
            setPuladas((l) => [...l, atual.id]); // não volta a aparecer enquanto a lista recarrega
            qc.invalidateQueries({ queryKey: ['portal-comunicacoes'] });
            qc.invalidateQueries({ queryKey: ['portal-processos'] });
            qc.invalidateQueries({ queryKey: ['portal-proc', atual.processoId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível registrar a ciência');
            q.refetch();
        } finally { setOcupado(false); }
    };
    const abrir = () => { const id = atual.processoId; setFeita(null); onAbrirProcesso(id); };

    return (
        <Dialog open onOpenChange={(o) => { if (!o) { if (feita) setFeita(null); else pular(); } }}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                {feita ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden /> Ciência registrada</DialogTitle>
                            <DialogDescription>Ficou certificado no processo {atual.numero}, em {dataHora(feita.ciencia_em)}.</DialogDescription>
                        </DialogHeader>
                        {feita.vence_em ? (
                            <p className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 px-3 py-2 text-sm">
                                <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                                <span>Seu prazo de {feita.prazo} começou a contar e <b>vence em {brData(feita.vence_em)}</b>. Você responde pelo próprio processo, em “Manifestar-se”.</span>
                            </p>
                        ) : <p className="text-sm text-slate-700 dark:text-slate-300">Esta comunicação não abre prazo de resposta.</p>}
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => setFeita(null)}>{restam ? `Próxima (${restam})` : 'Fechar'}</Button>
                            <Button onClick={abrir}>{feita.vence_em ? 'Abrir o processo e responder' : 'Abrir o processo'}</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2"><BellRing className="w-5 h-5 text-indigo-600" aria-hidden /> {atual.especie_nome} {atual.urgente && <SeloUrgente />}</DialogTitle>
                            <DialogDescription>
                                {atual.orgao} · processo <span className="font-mono">{atual.numero}</span>{atual.assunto ? ` · ${atual.assunto}` : ''}
                                {restam > 0 && ` · mais ${restam} aguardando`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                            <p className="text-xs text-slate-600 dark:text-slate-400">Dirigida a {atual.parte_nome} · expedida em {dataHora(atual.expedida_em)}</p>
                            <p className="whitespace-pre-wrap rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100">{atual.texto}</p>
                            {atual.documento_titulo && <p>Refere-se a: <b>{atual.documento_titulo}</b> (você lê o documento ao abrir o processo).</p>}
                            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                                <li>{atual.prazo ? <>Ao dar ciência, começa a contar o seu <b>prazo de {atual.prazo}</b>.</> : 'Esta comunicação não abre prazo de resposta.'}</li>
                                {atual.limite_ciencia && <li>Se você não der ciência até <b>{brData(atual.limite_ciencia)}</b>, ela será considerada dada nessa data{atual.prazo ? ' e o prazo começará a contar' : ''}.</li>}
                            </ul>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" disabled={ocupado} onClick={pular}>Ver depois</Button>
                            <Button className="gap-2" disabled={ocupado} onClick={darCiencia}>
                                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckCircle2 className="w-4 h-4" aria-hidden />} Dar ciência
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
