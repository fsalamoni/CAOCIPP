import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { secConfig } from '@/services/secretariaService';
import { dataHora } from './comum';

// ============================================================================
// Editar, duplicar, excluir e restaurar o que o admin cria (ritos, tipos de
// processo e modelos). Excluir é suave: processos já autuados guardam a
// própria cópia e não mudam; o item volta pela lista "Excluídos".
// ============================================================================

const NOMES = { rito: 'o rito', tipo: 'o tipo de processo', modelo: 'o modelo' };

/** Cartão clicável (abre para editar) com o menu ⋯ de Editar, Duplicar e Excluir. */
export function CartaoComMenu({ nome, className, onEditar, onDuplicar, onExcluir, children }) {
    return (
        <div className="relative">
            <button type="button" onClick={onEditar} className={`${className} pr-11`}>{children}</button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="absolute top-1.5 right-1.5 h-9 w-9" aria-label={`Mais opções: ${nome}`}>
                        <MoreHorizontal className="w-4 h-4" aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={onEditar} className="gap-2"><Pencil className="w-4 h-4" aria-hidden /> Editar</DropdownMenuItem>
                    {onDuplicar && <DropdownMenuItem onSelect={onDuplicar} className="gap-2"><Copy className="w-4 h-4" aria-hidden /> Duplicar</DropdownMenuItem>}
                    {onExcluir && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={onExcluir} className="gap-2 text-red-700 focus:text-red-700 dark:text-red-300"><Trash2 className="w-4 h-4" aria-hidden /> Excluir</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/** Por que o rito não pode ser excluído, com atalho para cada tipo que o usa. */
export function BloqueioRito({ tipos, onAbrirTipo }) {
    return (
        <>
            <p>{tipos.length === 1 ? 'Um tipo de processo usa este rito' : `${tipos.length} tipos de processo usam este rito`}. Troque o rito deles ou exclua-os antes. Processos já autuados não são afetados.</p>
            <ul className="space-y-1 text-left">
                {tipos.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2">
                        <span className="flex-1">{t.nome}{!t.ativo && ' (inativo)'}</span>
                        {onAbrirTipo && <Button size="sm" variant="outline" onClick={() => onAbrirTipo(t.id)}>Abrir o tipo</Button>}
                    </li>
                ))}
            </ul>
        </>
    );
}

/**
 * Confirmação de exclusão. `alvo` = { colecao, id, nome } ou null; `bloqueio`
 * (texto + elementos) substitui o botão de excluir quando não dá para excluir.
 */
export function ConfirmarExclusao({ orgId, alvo, onFechar, onExcluido, bloqueio = null }) {
    const qc = useQueryClient();
    const [indo, setIndo] = useState(false);
    const acao = { rito: 'excluirRito', tipo: 'excluirTipo', modelo: 'excluirModelo' }[alvo?.colecao];
    const excluir = async () => {
        setIndo(true);
        try {
            await secConfig(orgId, acao, { id: alvo.id });
            toast.success('Excluído. Dá para restaurar em "Excluídos".');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            onExcluido?.();
            onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível excluir'); } finally { setIndo(false); }
    };
    return (
        <AlertDialog open={!!alvo} onOpenChange={(o) => !o && onFechar()}>
            <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {NOMES[alvo?.colecao] || ''} “{alvo?.nome}”?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2">
                            {bloqueio || (
                                <>
                                    <p>Sai das listas e não pode mais ser usado em novos processos{alvo?.colecao === 'modelo' ? ' nem indicado nas fases' : ''}.</p>
                                    <p>Processos já autuados guardam a própria cópia e não mudam. Dá para restaurar depois, em “Excluídos”.</p>
                                </>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{bloqueio ? 'Fechar' : 'Cancelar'}</AlertDialogCancel>
                    {!bloqueio && (
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" disabled={indo} onClick={(e) => { e.preventDefault(); excluir(); }}>
                            {indo && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />} Excluir
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/** Lista "Excluídos" de uma coleção, com Restaurar. `filtro` escolhe os itens (ex.: modelos de uma unidade). */
export function Excluidos({ orgId, estado, colecao, filtro = () => true }) {
    const qc = useQueryClient();
    const [indo, setIndo] = useState(null);
    const [ritoNovo, setRitoNovo] = useState({});
    const lista = (estado.excluidos || []).filter((x) => x.colecao === colecao && filtro(x));
    if (!lista.length) return null;
    const ritosAtivos = (estado.ritos || []);
    const restaurar = async (x) => {
        setIndo(x.id);
        try {
            await secConfig(orgId, 'restaurar', { colecao, id: x.id, ...(ritoNovo[x.id] ? { rito_id: ritoNovo[x.id] } : {}) });
            toast.success('Restaurado. Está inativo: reative quando quiser usar.');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível restaurar'); } finally { setIndo(null); }
    };
    return (
        <details className="md:col-span-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">Excluídos ({lista.length})</summary>
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                {lista.map((x) => {
                    // Tipo cujo rito também foi excluído só volta apontando para outro rito.
                    const semRito = colecao === 'tipo' && !ritosAtivos.some((r) => r.id === x.rito_id);
                    return (
                        <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                            <span className="flex-1 min-w-[10rem]">{x.nome}{x.em && <span className="block text-xs text-slate-600 dark:text-slate-400">Excluído em {dataHora(x.em)}</span>}</span>
                            {semRito && (
                                <select aria-label={`Rito para restaurar ${x.nome}`} value={ritoNovo[x.id] || ''} onChange={(e) => setRitoNovo({ ...ritoNovo, [x.id]: e.target.value })}
                                    className="h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm">
                                    <option value="">Escolha o rito…</option>
                                    {ritosAtivos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                </select>
                            )}
                            <Button size="sm" variant="outline" className="gap-1" disabled={indo === x.id || (semRito && !ritoNovo[x.id])} onClick={() => restaurar(x)}>
                                {indo === x.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RotateCcw className="w-4 h-4" aria-hidden />} Restaurar
                            </Button>
                        </li>
                    );
                })}
            </ul>
        </details>
    );
}
