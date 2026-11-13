import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderOpen, History, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secConfig } from '@/services/secretariaService';
import { dataHora } from './comum';

/**
 * Versões anteriores de um rito, modelo ou tipo. Com `onAbrir(conteudo)` (tipo),
 * a versão abre no editor e só vale ao salvar; sem ela, "Restaurar" grava
 * direto (a atual vira versão também).
 */
export default function VersoesDialog({ orgId, colecao, id, nome, estado, onRestaurado, onAbrir }) {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const [restaurando, setRestaurando] = useState(null);
    const q = useQuery({ queryKey: ['sec-versoes', colecao, id], queryFn: () => secConfig(orgId, 'versoes', { colecao, id }), enabled: aberto && !!id });
    const nomePessoa = (uid) => estado?.membros?.find((m) => m.uid === uid)?.nome || '';
    const restaurar = async (v) => {
        setRestaurando(v.versao);
        try {
            if (onAbrir) {
                const r = await secConfig(orgId, 'versoes', { colecao, id, versao: v.versao });
                onAbrir(r.tipo, v.versao);
                toast.success(`Versão ${v.versao} aberta no editor: confira e salve para valer`);
                setAberto(false);
                return;
            }
            await secConfig(orgId, 'restaurarVersao', { colecao, id, versao: v.versao });
            toast.success(`Versão ${v.versao} restaurada`);
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            qc.invalidateQueries({ queryKey: ['sec-versoes', colecao, id] });
            setAberto(false);
            onRestaurado?.();
        } catch (e) { toast.error(e?.message || (onAbrir ? 'Não foi possível abrir a versão' : 'Não foi possível restaurar')); } finally { setRestaurando(null); }
    };
    if (!id) return null;
    return (
        <>
            <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setAberto(true)}><History className="w-4 h-4" aria-hidden /> Versões</Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Versões de {nome}</DialogTitle>
                        <DialogDescription>Cada salvamento guarda a versão anterior (até 20). {onAbrir
                            ? 'Abrir carrega a versão no editor; nada muda até você salvar, e salvar cria uma versão nova. Processos já autuados mantêm os dados gravados.'
                            : `Restaurar cria uma versão nova com o conteúdo antigo; ${colecao === 'rito' ? 'processos em andamento continuam com a versão com que foram autuados' : 'documentos já redigidos não mudam'}.`}</DialogDescription>
                    </DialogHeader>
                    {q.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p>}
                    {q.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{q.error.message}</p>}
                    {q.data && (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            <li className="py-2 text-sm text-slate-600 dark:text-slate-400">Versão atual: {q.data.versao_atual}</li>
                            {q.data.versoes.length === 0 && <li className="py-2 text-sm text-slate-600">Nenhuma versão anterior ainda.</li>}
                            {q.data.versoes.map((v) => (
                                <li key={v.versao} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-medium">Versão {v.versao}</span>
                                    <span className="text-slate-600 dark:text-slate-400">{v.em ? dataHora(v.em) : ''}{v.por && nomePessoa(v.por) ? ` · ${nomePessoa(v.por)}` : ''}{v.fases != null ? ` · ${v.fases} fases` : ''}{v.campos != null ? ` · ${v.campos} ${v.campos === 1 ? 'campo próprio' : 'campos próprios'}` : ''}{v.nome && v.nome !== nome ? ` · "${v.nome}"` : ''}</span>
                                    <Button size="sm" variant="outline" className="gap-1 ml-auto" disabled={restaurando != null} onClick={() => restaurar(v)}>
                                        {restaurando === v.versao ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : onAbrir ? <FolderOpen className="w-3.5 h-3.5" aria-hidden /> : <Undo2 className="w-3.5 h-3.5" aria-hidden />} {onAbrir ? 'Abrir no editor' : 'Restaurar'}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
